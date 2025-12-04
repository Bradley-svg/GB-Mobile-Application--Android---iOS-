import { query } from '../config/db';

export type RefreshTokenRow = {
  id: string;
  user_id: string;
  revoked: boolean;
  replaced_by: string | null;
  expires_at: Date | null;
};

export async function insertRefreshToken(id: string, userId: string, expiresAt: Date) {
  await query(
    `
    insert into refresh_tokens (id, user_id, revoked, replaced_by, expires_at, created_at)
    values ($1, $2, false, null, $3, now())
  `,
    [id, userId, expiresAt]
  );
}

export async function findRefreshTokenById(id: string): Promise<RefreshTokenRow | null> {
  const res = await query<RefreshTokenRow>(
    `
    select id, user_id, revoked, replaced_by, expires_at
    from refresh_tokens
    where id = $1
  `,
    [id]
  );
  return res.rows[0] || null;
}

export async function revokeRefreshToken(id: string, reason: string, replacedBy?: string) {
  await query(
    `
    update refresh_tokens
    set revoked = true,
        revoked_reason = $2,
        revoked_at = now(),
        replaced_by = coalesce(replaced_by, $3)
    where id = $1
  `,
    [id, reason, replacedBy || null]
  );
}
