import { query } from '../config/db';

export type UserRole = 'owner' | 'admin' | 'facilities' | 'contractor';

export type UserRow = {
  id: string;
  email: string;
  password_hash: string;
  name: string;
  organisation_id: string | null;
  role: UserRole;
  can_impersonate: boolean;
  two_factor_enabled: boolean;
  two_factor_secret: string | null;
  two_factor_temp_secret: string | null;
};

export async function findUserByEmail(email: string): Promise<UserRow | null> {
  const existing = await query<UserRow>('select * from users where email = $1', [email]);
  return existing.rows[0] ?? null;
}

export async function insertUser(
  email: string,
  passwordHash: string,
  name: string,
  role: UserRole = 'facilities'
) {
  const result = await query<UserRow>(
    `insert into users (email, password_hash, name, role)
     values ($1, $2, $3, $4)
     returning id, email, name, organisation_id, password_hash, role, can_impersonate, two_factor_enabled, two_factor_secret, two_factor_temp_secret`,
    [email, passwordHash, name, role]
  );

  return result.rows[0];
}

export async function getUserContextById(
  userId: string
): Promise<Omit<UserRow, 'password_hash' | 'two_factor_secret' | 'two_factor_temp_secret'> | null> {
  const res = await query<Omit<UserRow, 'password_hash' | 'two_factor_secret' | 'two_factor_temp_secret'>>(
    `
    select id, email, name, organisation_id, role, can_impersonate, two_factor_enabled
    from users
    where id = $1
  `,
    [userId]
  );

  return res.rows[0] ?? null;
}

export async function updateUserPasswordHash(userId: string, passwordHash: string) {
  await query(
    `
    update users
    set password_hash = $2
    where id = $1
  `,
    [userId, passwordHash]
  );
}

export async function findUserById(userId: string): Promise<UserRow | null> {
  const res = await query<UserRow>(
    `
    select id, email, password_hash, name, organisation_id, role, can_impersonate, two_factor_enabled, two_factor_secret, two_factor_temp_secret
    from users
    where id = $1
  `,
    [userId]
  );

  return res.rows[0] ?? null;
}

export async function setTwoFactorTempSecret(userId: string, secret: string) {
  await query(
    `
    update users
    set two_factor_temp_secret = $2
    where id = $1
  `,
    [userId, secret]
  );
}

export async function activateTwoFactorSecret(userId: string) {
  await query(
    `
    update users
    set two_factor_secret = two_factor_temp_secret,
        two_factor_temp_secret = null,
        two_factor_enabled = true
    where id = $1
  `,
    [userId]
  );
}

export async function disableTwoFactor(userId: string) {
  await query(
    `
    update users
    set two_factor_enabled = false,
        two_factor_secret = null,
        two_factor_temp_secret = null
    where id = $1
  `,
    [userId]
  );
}

export async function getTwoFactorState(userId: string) {
  const res = await query<
    Pick<UserRow, 'id' | 'email' | 'role' | 'organisation_id' | 'two_factor_enabled' | 'two_factor_secret' | 'two_factor_temp_secret'>
  >(
    `
    select id, email, role, organisation_id, two_factor_enabled, two_factor_secret, two_factor_temp_secret
    from users
    where id = $1
  `,
    [userId]
  );

  return res.rows[0] ?? null;
}

export async function getUsersByRoles(
  organisationId: string,
  roles: UserRole[]
): Promise<Array<Pick<UserRow, 'id' | 'role' | 'email' | 'name'>>> {
  if (!roles.length) return [];
  const res = await query<Pick<UserRow, 'id' | 'role' | 'email' | 'name'>>(
    `
    select id, role, email, name
    from users
    where organisation_id = $1
      and role = ANY($2::text[])
  `,
    [organisationId, roles]
  );

  return res.rows;
}
