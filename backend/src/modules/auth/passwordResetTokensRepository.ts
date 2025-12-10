import { query } from '../../config/db';

export type PasswordResetTokenRow = {
  id: string;
  user_id: string;
  token_hash: string;
  expires_at: Date;
  used_at: Date | null;
  created_at: Date;
};

export async function insertPasswordResetToken(
  userId: string,
  tokenHash: string,
  expiresAt: Date
): Promise<PasswordResetTokenRow> {
  const res = await query<PasswordResetTokenRow>(
    `
    insert into password_reset_tokens (
      user_id,
      token_hash,
      expires_at,
      created_at
    )
    values ($1, $2, $3, now())
    returning id, user_id, token_hash, expires_at, used_at, created_at
  `,
    [userId, tokenHash, expiresAt]
  );

  return res.rows[0];
}

export async function findPasswordResetTokenByHash(
  tokenHash: string
): Promise<PasswordResetTokenRow | null> {
  const res = await query<PasswordResetTokenRow>(
    `
    select
      id,
      user_id,
      token_hash,
      expires_at,
      used_at,
      created_at
    from password_reset_tokens
    where token_hash = $1
    order by created_at desc
    limit 1
  `,
    [tokenHash]
  );

  return res.rows[0] ?? null;
}

export async function markPasswordResetTokenUsed(id: string) {
  await query(
    `
    update password_reset_tokens
    set used_at = now()
    where id = $1
  `,
    [id]
  );
}

export async function invalidateOutstandingTokensForUser(userId: string) {
  await query(
    `
    update password_reset_tokens
    set used_at = now()
    where user_id = $1
      and used_at is null
  `,
    [userId]
  );
}
