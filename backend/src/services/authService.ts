import { createHash, randomUUID, timingSafeEqual } from 'crypto';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import {
  findRefreshTokenById,
  revokeAllRefreshTokensForUser as revokeAllLegacyTokensForUser,
  revokeRefreshToken as revokeLegacyRefreshToken,
} from '../repositories/refreshTokensRepository';
import {
  findUserByEmail,
  getUserContextById,
  insertUser,
  type UserRole,
  updateUserPasswordHash,
} from '../repositories/usersRepository';
import {
  findAuthSessionById,
  insertAuthSession,
  markAuthSessionUsed,
  revokeAuthSession,
  revokeAuthSessionsForUser,
} from '../modules/auth/authSessionsRepository';
import { consumePasswordResetToken } from '../modules/auth/passwordResetService';

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
const REFRESH_EXPIRY_MS = REFRESH_EXPIRY_DAYS * 24 * 60 * 60 * 1000;
const TWO_FACTOR_ENABLED = process.env.AUTH_2FA_ENABLED === 'true';

export type AuthUser = {
  id: string;
  email: string;
  name: string;
  organisation_id: string | null;
  role: UserRole;
};

function isUserRole(value: unknown): value is UserRole {
  return value === 'owner' || value === 'admin' || value === 'facilities' || value === 'contractor';
}

async function getRoleForUser(userId: string): Promise<UserRole> {
  const user = await getUserContextById(userId);
  if (!user) {
    throw new Error('USER_NOT_FOUND');
  }
  return user.role;
}

export async function registerUser(email: string, password: string, name: string): Promise<AuthUser> {
  const existing = await findUserByEmail(email);
  if (existing) {
    throw new Error('EMAIL_EXISTS');
  }

  const hash = await bcrypt.hash(password, 10);

  const user = await insertUser(email, hash, name);
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    organisation_id: user.organisation_id,
    role: user.role,
  };
}

export async function loginUser(email: string, password: string): Promise<AuthUser> {
  const user = await findUserByEmail(email);
  if (!user) {
    throw new Error('INVALID_CREDENTIALS');
  }

  const ok = await bcrypt.compare(password, user.password_hash);
  if (!ok) {
    throw new Error('INVALID_CREDENTIALS');
  }

  return {
    id: user.id,
    email: user.email,
    name: user.name,
    organisation_id: user.organisation_id,
    role: user.role,
  };
}

type RefreshSource = 'session' | 'legacy';

type IssueTokensOptions = {
  rotateFrom?: { id: string; type: RefreshSource };
  role?: UserRole;
  metadata?: { userAgent?: string | null; ip?: string | null };
};

type VerifiedRefreshToken = {
  userId: string;
  tokenId: string;
  role: UserRole;
  source: RefreshSource;
};

function hashToken(token: string) {
  return createHash('sha256').update(token).digest('hex');
}

function safeHashEquals(left: string, right: string) {
  const leftBuf = Buffer.from(left);
  const rightBuf = Buffer.from(right);
  if (leftBuf.length !== rightBuf.length) {
    return false;
  }
  return timingSafeEqual(leftBuf, rightBuf);
}

async function createAuthSession(
  sessionId: string,
  userId: string,
  refreshToken: string,
  metadata?: IssueTokensOptions['metadata']
) {
  const refreshTokenHash = hashToken(refreshToken);
  const refreshExpiresAt = new Date(Date.now() + REFRESH_EXPIRY_MS);

  await insertAuthSession({
    id: sessionId,
    userId,
    refreshTokenHash,
    expiresAt: refreshExpiresAt,
    userAgent: metadata?.userAgent ?? null,
    ip: metadata?.ip ?? null,
  });
}

export async function issueTokens(
  userId: string,
  options?: IssueTokensOptions
) {
  const role = options?.role ?? (await getRoleForUser(userId));
  const sessionId = randomUUID();
  const refreshPayload = { sub: userId, type: 'refresh', jti: sessionId, role };

  if (TWO_FACTOR_ENABLED) {
    // TODO: enforce a second factor challenge before issuing session tokens.
  }

  const accessToken = jwt.sign({ sub: userId, type: 'access', role }, JWT_SECRET, {
    expiresIn: '15m',
  });

  const refreshToken = jwt.sign(refreshPayload, JWT_SECRET, {
    expiresIn: `${REFRESH_EXPIRY_DAYS}d`,
  });

  await createAuthSession(sessionId, userId, refreshToken, options?.metadata);

  if (options?.rotateFrom) {
    if (options.rotateFrom.type === 'session') {
      await revokeAuthSession(options.rotateFrom.id, 'rotated', sessionId);
    } else {
      await revokeLegacyRefreshToken(options.rotateFrom.id, 'rotated', sessionId);
    }
  }

  return { accessToken, refreshToken };
}

export function verifyAccessToken(token: string) {
  const decoded = jwt.verify(token, JWT_SECRET) as { sub: string; type: string; role?: UserRole };
  if (decoded.type !== 'access') throw new Error('INVALID_TOKEN_TYPE');
  const role = isUserRole(decoded.role) ? decoded.role : 'facilities';
  return { userId: decoded.sub, role };
}

export async function verifyRefreshToken(token: string) {
  const decoded = jwt.verify(token, JWT_SECRET) as {
    sub: string;
    type: string;
    jti?: string;
    role?: UserRole;
  };
  if (decoded.type !== 'refresh') throw new Error('INVALID_TOKEN_TYPE');
  if (!decoded.jti) throw new Error('MISSING_TOKEN_ID');

  const tokenHash = hashToken(token);
  const session = await findAuthSessionById(decoded.jti);
  if (session) {
    if (session.user_id !== decoded.sub) {
      throw new Error('REFRESH_TOKEN_USER_MISMATCH');
    }

    if (session.revoked_at) {
      throw new Error('REFRESH_TOKEN_REVOKED');
    }

    if (session.expires_at && new Date(session.expires_at) < new Date()) {
      await revokeAuthSession(session.id, 'expired');
      throw new Error('REFRESH_TOKEN_EXPIRED');
    }

    if (!safeHashEquals(session.refresh_token_hash, tokenHash)) {
      await revokeAuthSession(session.id, 'hash_mismatch');
      throw new Error('REFRESH_TOKEN_MISMATCH');
    }

    await markAuthSessionUsed(session.id);

    const role = isUserRole(decoded.role) ? decoded.role : await getRoleForUser(decoded.sub);
    return { userId: decoded.sub, tokenId: session.id, role, source: 'session' } as VerifiedRefreshToken;
  }

  // Legacy refresh token fallback to avoid breaking existing sessions
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
    await revokeLegacyRefreshToken(tokenRow.id, 'expired');
    throw new Error('REFRESH_TOKEN_EXPIRED');
  }

  const role = isUserRole(decoded.role) ? decoded.role : await getRoleForUser(decoded.sub);
  return { userId: decoded.sub, tokenId: decoded.jti, role, source: 'legacy' } as VerifiedRefreshToken;
}

export async function revokeRefreshTokenForSession(userId: string, refreshToken: string) {
  const { userId: tokenUserId, tokenId, source } = await verifyRefreshToken(refreshToken);
  if (tokenUserId !== userId) {
    throw new Error('REFRESH_TOKEN_USER_MISMATCH');
  }

  if (source === 'session') {
    await revokeAuthSession(tokenId, 'user_logout');
  } else {
    await revokeLegacyRefreshToken(tokenId, 'user_logout');
  }
}

export async function revokeAllRefreshTokensForUser(userId: string) {
  await revokeAuthSessionsForUser(userId, 'user_logout_all');
  await revokeAllLegacyTokensForUser(userId, 'user_logout_all');
}

export async function resetPasswordWithToken(token: string, newPassword: string) {
  const { userId } = await consumePasswordResetToken(token);
  const newHash = await bcrypt.hash(newPassword, 10);
  await updateUserPasswordHash(userId, newHash);
  await revokeAllRefreshTokensForUser(userId);
  return { userId };
}
