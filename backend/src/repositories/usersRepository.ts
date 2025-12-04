import { query } from '../config/db';

export type UserRow = {
  id: string;
  email: string;
  password_hash: string;
  name: string;
  organisation_id: string | null;
};

export async function findUserByEmail(email: string): Promise<UserRow | null> {
  const existing = await query<UserRow>('select * from users where email = $1', [email]);
  return existing.rows[0] ?? null;
}

export async function insertUser(email: string, passwordHash: string, name: string) {
  const result = await query<UserRow>(
    'insert into users (email, password_hash, name) values ($1, $2, $3) returning id, email, name, organisation_id, password_hash',
    [email, passwordHash, name]
  );

  return result.rows[0];
}

export async function getUserContextById(userId: string): Promise<Omit<UserRow, 'password_hash'> | null> {
  const res = await query<Omit<UserRow, 'password_hash'>>(
    `
    select id, email, name, organisation_id
    from users
    where id = $1
  `,
    [userId]
  );

  return res.rows[0] ?? null;
}
