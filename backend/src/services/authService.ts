import { randomUUID } from 'crypto';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { query } from '../db/pool';

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret';
const REFRESH_EXPIRY_DAYS = Number(process.env.REFRESH_TOKEN_DAYS || 30);

type UserRow = {
  id: string;
  email: string;
  password_hash: string;
  name: string;
  organisation_id: string | null;
};

type RefreshTokenRow = {
  id: string;
  user_id: string;
  revoked: boolean;
  replaced_by: string | null;
  expires_at: Date | null;
};

export async function registerUser(email: string, password: string, name: string) {
  const existing = await query<UserRow>('select * from users where email = $1', [email]);
  if ((existing.rowCount ?? 0) > 0) {
    throw new Error('EMAIL_EXISTS');
  }

  const hash = await bcrypt.hash(password, 10);

  const result = await query<UserRow>(
    'insert into users (email, password_hash, name) values ($1, $2, $3) returning id, email, name, organisation_id',
    [email, hash, name]
  );

  return result.rows[0];
}

export async function loginUser(email: string, password: string) {
  const result = await query<UserRow>('select * from users where email = $1', [email]);
  const user = result.rows[0];
  if (!user) {
    throw new Error('INVALID_CREDENTIALS');
  }

  const ok = await bcrypt.compare(password, user.password_hash);
  if (!ok) {
    throw new Error('INVALID_CREDENTIALS');
  }

  return { id: user.id, email: user.email, name: user.name, organisation_id: user.organisation_id };
}

async function persistRefreshToken(id: string, userId: string, expiresAt: Date) {
  await query(
    `
    insert into refresh_tokens (id, user_id, revoked, replaced_by, expires_at, created_at)
    values ($1, $2, false, null, $3, now())
  `,
    [id, userId, expiresAt]
  );
}

async function getRefreshTokenById(id: string): Promise<RefreshTokenRow | null> {
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

async function revokeRefreshToken(id: string, reason: string, replacedBy?: string) {
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

export async function issueTokens(userId: string, options?: { rotateFromId?: string }) {
  const accessToken = jwt.sign({ sub: userId, type: 'access' }, JWT_SECRET, { expiresIn: '15m' });

  const refreshTokenId = randomUUID();
  const refreshToken = jwt.sign(
    { sub: userId, type: 'refresh', jti: refreshTokenId },
    JWT_SECRET,
    { expiresIn: `${REFRESH_EXPIRY_DAYS}d` }
  );

  const refreshExpiresAt = new Date(Date.now() + REFRESH_EXPIRY_DAYS * 24 * 60 * 60 * 1000);
  await persistRefreshToken(refreshTokenId, userId, refreshExpiresAt);

  if (options?.rotateFromId) {
    await revokeRefreshToken(options.rotateFromId, 'rotated', refreshTokenId);
  }

  return { accessToken, refreshToken };
}

export function verifyAccessToken(token: string) {
  const decoded = jwt.verify(token, JWT_SECRET) as { sub: string; type: string };
  if (decoded.type !== 'access') throw new Error('INVALID_TOKEN_TYPE');
  return { userId: decoded.sub };
}

export async function verifyRefreshToken(token: string) {
  const decoded = jwt.verify(token, JWT_SECRET) as { sub: string; type: string; jti?: string };
  if (decoded.type !== 'refresh') throw new Error('INVALID_TOKEN_TYPE');
  if (!decoded.jti) throw new Error('MISSING_TOKEN_ID');

  const tokenRow = await getRefreshTokenById(decoded.jti);
  if (!tokenRow) {
    throw new Error('REFRESH_TOKEN_NOT_FOUND');
  }

  if (tokenRow.user_id !== decoded.sub) {
    throw new Error('REFRESH_TOKEN_USER_MISMATCH');
  }

  if (tokenRow.revoked) {
    throw new Error('REFRESH_TOKEN_REVOKED');
  }

  if (tokenRow.expires_at && new Date(tokenRow.expires_at) < new Date()) {
    await revokeRefreshToken(tokenRow.id, 'expired');
    throw new Error('REFRESH_TOKEN_EXPIRED');
  }

  return { userId: decoded.sub, tokenId: decoded.jti };
}
