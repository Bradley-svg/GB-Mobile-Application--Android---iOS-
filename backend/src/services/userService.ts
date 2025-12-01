import { query } from '../db/pool';

export type UserContext = {
  id: string;
  email?: string;
  name?: string;
  organisation_id: string | null;
};

export async function getUserContext(userId: string): Promise<UserContext | null> {
  const res = await query<UserContext>(
    `
    select id, email, name, organisation_id
    from users
    where id = $1
  `,
    [userId]
  );

  return res.rows[0] || null;
}

export function requireOrganisationId(user: UserContext): string {
  if (!user.organisation_id) {
    throw new Error('USER_ORG_MISSING');
  }
  return user.organisation_id;
}
