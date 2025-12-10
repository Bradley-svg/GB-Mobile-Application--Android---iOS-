import { query } from '../../config/db';

export type AuthSessionRow = {
  id: string;
  user_id: string;
  refresh_token_hash: string;
  created_at: Date;
  last_used_at: Date | null;
  revoked_at: Date | null;
  revoked_reason: string | null;
  replaced_by: string | null;
  expires_at: Date | null;
  user_agent: string | null;
  ip: string | null;
};

type CreateAuthSessionInput = {
  id: string;
  userId: string;
  refreshTokenHash: string;
  expiresAt: Date;
  userAgent?: string | null;
  ip?: string | null;
};

export async function insertAuthSession(input: CreateAuthSessionInput) {
  const { id, userId, refreshTokenHash, expiresAt, userAgent, ip } = input;
  await query(
    `
    insert into auth_sessions (
      id,
      user_id,
      refresh_token_hash,
      expires_at,
      user_agent,
      ip,
      created_at
    )
    values ($1, $2, $3, $4, $5, $6, now())
  `,
    [id, userId, refreshTokenHash, expiresAt, userAgent ?? null, ip ?? null]
  );
}

export async function findAuthSessionById(id: string): Promise<AuthSessionRow | null> {
  const res = await query<AuthSessionRow>(
    `
    select
      id,
      user_id,
      refresh_token_hash,
      created_at,
      last_used_at,
      revoked_at,
      revoked_reason,
      replaced_by,
      expires_at,
      user_agent,
      ip
    from auth_sessions
    where id = $1
  `,
    [id]
  );

  return res.rows[0] ?? null;
}

export async function markAuthSessionUsed(id: string) {
  await query(
    `
    update auth_sessions
    set last_used_at = now()
    where id = $1
  `,
    [id]
  );
}

export async function revokeAuthSession(id: string, reason: string, replacedBy?: string) {
  await query(
    `
    update auth_sessions
    set revoked_at = now(),
        revoked_reason = $2,
        replaced_by = coalesce(replaced_by, $3)
    where id = $1
  `,
    [id, reason, replacedBy ?? null]
  );
}

export async function revokeAuthSessionsForUser(userId: string, reason: string) {
  await query(
    `
    update auth_sessions
    set revoked_at = now(),
        revoked_reason = $2
    where user_id = $1
      and revoked_at is null
  `,
    [userId, reason]
  );
}
