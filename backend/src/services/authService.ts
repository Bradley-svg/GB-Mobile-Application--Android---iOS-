import { randomUUID } from 'crypto';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import {
  findRefreshTokenById,
  insertRefreshToken,
  revokeAllRefreshTokensForUser as revokeAllTokensForUser,
  revokeRefreshToken,
} from '../repositories/refreshTokensRepository';
import { findUserByEmail, insertUser } from '../repositories/usersRepository';

export function resolveJwtSecret() {
  const nodeEnv = process.env.NODE_ENV || 'development';
  const envSecret = process.env.JWT_SECRET;
  const secret = envSecret || 'dev-secret';

  if (nodeEnv !== 'development' && (!envSecret || envSecret === 'dev-secret')) {
    throw new Error('JWT_SECRET must be set to a non-default value when NODE_ENV is not development');
  }

  return secret;
}

const JWT_SECRET = resolveJwtSecret();
const REFRESH_EXPIRY_DAYS = Number(process.env.REFRESH_TOKEN_DAYS || 30);

export async function registerUser(email: string, password: string, name: string) {
  const existing = await findUserByEmail(email);
  if (existing) {
    throw new Error('EMAIL_EXISTS');
  }

  const hash = await bcrypt.hash(password, 10);

  const user = await insertUser(email, hash, name);
  return { id: user.id, email: user.email, name: user.name, organisation_id: user.organisation_id };
}

export async function loginUser(email: string, password: string) {
  const user = await findUserByEmail(email);
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
  await insertRefreshToken(id, userId, expiresAt);
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

  const tokenRow = await findRefreshTokenById(decoded.jti);
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

export async function revokeRefreshTokenForSession(userId: string, refreshToken: string) {
  const { userId: tokenUserId, tokenId } = await verifyRefreshToken(refreshToken);
  if (tokenUserId !== userId) {
    throw new Error('REFRESH_TOKEN_USER_MISMATCH');
  }

  await revokeRefreshToken(tokenId, 'user_logout');
}

export async function revokeAllRefreshTokensForUser(userId: string) {
  await revokeAllTokensForUser(userId, 'user_logout_all');
}
