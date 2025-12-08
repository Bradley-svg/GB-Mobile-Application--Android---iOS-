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
     returning id, email, name, organisation_id, password_hash, role, can_impersonate`,
    [email, passwordHash, name, role]
  );

  return result.rows[0];
}

export async function getUserContextById(userId: string): Promise<Omit<UserRow, 'password_hash'> | null> {
  const res = await query<Omit<UserRow, 'password_hash'>>(
    `
    select id, email, name, organisation_id, role, can_impersonate
    from users
    where id = $1
  `,
    [userId]
  );

  return res.rows[0] ?? null;
}
