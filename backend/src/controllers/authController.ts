import { NextFunction, Request, Response } from 'express';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import {
  issueTokens,
  loginUser,
  registerUser,
  resetPasswordWithToken,
  revokeAllRefreshTokensForUser,
  revokeRefreshTokenForSession,
  issueTwoFactorChallengeToken,
  verifyTwoFactorChallengeToken,
  verifyRefreshToken,
} from '../services/authService';
import { getUserContext } from '../services/userService';
import { authAttemptLimiter } from '../middleware/rateLimit';
import { createPasswordResetToken } from '../modules/auth/passwordResetService';
import { findUserByEmail, findUserById } from '../repositories/usersRepository';
import { logger } from '../config/logger';
import {
  confirmTwoFactorSetup,
  disableTwoFactorForUser,
  isTwoFactorFeatureEnabled,
  roleRequiresTwoFactor,
  startTwoFactorSetup,
  verifyTwoFactorForUser,
} from '../modules/auth/twoFactorService';
import { recordAuditEvent } from '../modules/audit/auditService';

export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 50,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Too many auth attempts. Please try again shortly.' },
});

function getAuthMetadata(req: Request) {
  const userAgentHeader = req.headers['user-agent'];
  return {
    userAgent: typeof userAgentHeader === 'string' ? userAgentHeader : null,
    ip: req.ip,
  };
}

export async function signup(req: Request, res: Response, next: NextFunction) {
  const allowPublicSignup = process.env.AUTH_ALLOW_PUBLIC_SIGNUP === 'true';
  if (!allowPublicSignup) {
    return res.status(403).json({ error: 'Signup disabled. Contact administrator.' });
  }

  const schema = z.object({
    email: z.string().email(),
    password: z.string().min(6),
    name: z.string().min(2),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: 'Invalid body' });

  try {
    const user = await registerUser(parsed.data.email, parsed.data.password, parsed.data.name);
    const tokens = await issueTokens(user.id, { role: user.role });
    res.json({ ...tokens, user });
  } catch (e) {
    if (e instanceof Error && e.message === 'EMAIL_EXISTS') {
      return res.status(409).json({ message: 'Email already in use' });
    }
    next(e);
  }
}

export async function login(req: Request, res: Response, next: NextFunction) {
  const schema = z.object({
    email: z.string().email(),
    password: z.string().min(1),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: 'Invalid body' });

  const authMetadata = getAuthMetadata(req);
  const twoFactorEnabled = isTwoFactorFeatureEnabled();

  try {
    const user = await loginUser(parsed.data.email, parsed.data.password);

    const roleEnforced = twoFactorEnabled && roleRequiresTwoFactor(user.role);
    const requiresTwoFactor = twoFactorEnabled && user.two_factor_enabled;
    if (requiresTwoFactor) {
      const challengeToken = issueTwoFactorChallengeToken(user.id, user.role, authMetadata);
      authAttemptLimiter.recordSuccess(req.ip, parsed.data.email);
      return res.json({ requires2fa: true, challengeToken });
    }

    const tokens = await issueTokens(user.id, { role: user.role, metadata: authMetadata });
    authAttemptLimiter.recordSuccess(req.ip, parsed.data.email);
    res.json({ ...tokens, user, twoFactorSetupRequired: roleEnforced && !user.two_factor_enabled });
  } catch (e) {
    if (e instanceof Error && e.message === 'INVALID_CREDENTIALS') {
      authAttemptLimiter.recordFailure(req.ip, parsed.data.email);
      return res.status(401).json({ message: 'Invalid email or password' });
    }
    next(e);
  }
}

export async function loginTwoFactor(req: Request, res: Response, next: NextFunction) {
  const schema = z.object({
    challengeToken: z.string().min(10),
    code: z.string().min(3),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: 'Invalid body' });

  const authMetadata = getAuthMetadata(req);

  try {
    const { userId, role } = verifyTwoFactorChallengeToken(parsed.data.challengeToken);
    const state = await verifyTwoFactorForUser(userId, parsed.data.code);
    authAttemptLimiter.recordSuccess(req.ip, state.email);

    const tokens = await issueTokens(userId, {
      role: role ?? state.role,
      metadata: authMetadata,
    });

    const dbUser = await findUserById(userId);
    const responseUser = dbUser
      ? {
          id: dbUser.id,
          email: dbUser.email,
          name: dbUser.name,
          organisation_id: dbUser.organisation_id,
          role: dbUser.role,
          two_factor_enabled: dbUser.two_factor_enabled,
        }
      : {
          id: userId,
          email: state.email,
          name: '',
          organisation_id: state.organisation_id,
          role: state.role,
          two_factor_enabled: true,
        };

    await recordAuditEvent({
      action: 'auth_2fa_challenge_passed',
      entityType: 'user',
      entityId: userId,
      userId,
      orgId: state.organisation_id,
      metadata: { role: responseUser.role },
    });

    res.json({ ...tokens, user: responseUser });
  } catch (e) {
    const message = (e as Error | undefined)?.message ?? '';
    if (message === 'INVALID_2FA_CODE') {
      authAttemptLimiter.recordFailure(req.ip);
      return res.status(401).json({ message: 'Invalid or expired 2FA code' });
    }
    if (message === 'TWO_FACTOR_NOT_ENABLED' || message === 'USER_NOT_FOUND') {
      return res.status(400).json({ message: 'Two-factor authentication not enabled for this user' });
    }
    if (message === 'TWO_FACTOR_DISABLED') {
      return res.status(400).json({ message: 'Two-factor authentication is disabled' });
    }
    if ((e as Error | undefined)?.name === 'TokenExpiredError') {
      return res.status(401).json({ message: '2FA challenge expired' });
    }
    if ((e as Error | undefined)?.name === 'JsonWebTokenError' || message === 'INVALID_TOKEN_TYPE') {
      return res.status(401).json({ message: 'Invalid challenge token' });
    }
    next(e);
  }
}

export async function requestPasswordReset(req: Request, res: Response, next: NextFunction) {
  const schema = z.object({
    email: z.string().email(),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: 'Invalid body' });

  try {
    const user = await findUserByEmail(parsed.data.email);
    if (!user) {
      return res.json({ message: 'If an account exists, a reset link has been sent.' });
    }

    const { token, expiresAt } = await createPasswordResetToken(user.id);
    logger.info(
      { userId: user.id, email: user.email, resetToken: token, expiresAt },
      'password reset token generated'
    );

    // TODO: send password reset email with the token/link.
    return res.json({ message: 'If an account exists, a reset link has been sent.' });
  } catch (e) {
    next(e);
  }
}

export async function resetPassword(req: Request, res: Response, next: NextFunction) {
  const schema = z.object({
    token: z.string().min(10),
    password: z.string().min(6),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: 'Invalid body' });

  try {
    await resetPasswordWithToken(parsed.data.token, parsed.data.password);
    return res.json({ ok: true });
  } catch (e) {
    const invalidReasons = ['INVALID_RESET_TOKEN', 'EXPIRED_RESET_TOKEN'];
    if (invalidReasons.includes((e as Error | undefined)?.message ?? '')) {
      return res.status(400).json({ message: 'Invalid or expired reset token' });
    }
    next(e);
  }
}

export async function refresh(req: Request, res: Response, next: NextFunction) {
  const schema = z.object({
    refreshToken: z.string().min(10),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: 'Invalid body' });

  try {
    const { userId, tokenId, role, source } = await verifyRefreshToken(parsed.data.refreshToken);
    if (process.env.AUTH_2FA_ENABLED === 'true') {
      // TODO: ensure the session has a valid second factor before issuing new tokens.
    }
    const tokens = await issueTokens(userId, {
      rotateFrom: { id: tokenId, type: source },
      role,
      metadata: getAuthMetadata(req),
    });
    res.json(tokens);
  } catch (e) {
    const invalidReasons = [
      'INVALID_TOKEN_TYPE',
      'REFRESH_TOKEN_NOT_FOUND',
      'REFRESH_TOKEN_USER_MISMATCH',
      'REFRESH_TOKEN_REVOKED',
      'REFRESH_TOKEN_MISMATCH',
      'REFRESH_TOKEN_EXPIRED',
    ];
    if (invalidReasons.includes((e as Error | undefined)?.message ?? '')) {
      return res.status(401).json({ message: 'Invalid refresh token' });
    }
    if ((e as Error | undefined)?.name === 'JsonWebTokenError' || (e as Error | undefined)?.name === 'TokenExpiredError') {
      return res.status(401).json({ message: 'Invalid refresh token' });
    }
    next(e);
  }
}

export async function me(req: Request, res: Response, next: NextFunction) {
  const userId = req.user!.id;

  try {
    const user = await getUserContext(userId);
    if (!user) return res.status(404).json({ message: 'User not found' });

    res.json(user);
  } catch (e) {
    next(e);
  }
}

export async function logout(req: Request, res: Response, next: NextFunction) {
  const userId = req.user!.id;
  const schema = z.object({ refreshToken: z.string().min(10) });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: 'Invalid body' });

  try {
    await revokeRefreshTokenForSession(userId, parsed.data.refreshToken);
    res.status(204).send();
  } catch (e) {
    const invalidReasons = [
      'INVALID_TOKEN_TYPE',
      'REFRESH_TOKEN_NOT_FOUND',
      'REFRESH_TOKEN_USER_MISMATCH',
      'REFRESH_TOKEN_REVOKED',
      'REFRESH_TOKEN_EXPIRED',
      'MISSING_TOKEN_ID',
      'REFRESH_TOKEN_MISMATCH',
    ];
    if (invalidReasons.includes((e as Error | undefined)?.message ?? '')) {
      return res.status(401).json({ message: 'Invalid refresh token' });
    }
    if ((e as Error | undefined)?.name === 'JsonWebTokenError' || (e as Error | undefined)?.name === 'TokenExpiredError') {
      return res.status(401).json({ message: 'Invalid refresh token' });
    }
    next(e);
  }
}

export async function logoutAll(req: Request, res: Response, next: NextFunction) {
  const userId = req.user!.id;
  try {
    await revokeAllRefreshTokensForUser(userId);
    res.status(204).send();
  } catch (e) {
    next(e);
  }
}

export async function setupTwoFactor(req: Request, res: Response, next: NextFunction) {
  const userId = req.user!.id;
  try {
    const user = await findUserById(userId);
    if (!user) return res.status(404).json({ message: 'User not found' });
    const { secret, otpauthUrl } = await startTwoFactorSetup(userId, user.email);
    res.json({ secret, otpauthUrl });
  } catch (e) {
    const message = (e as Error | undefined)?.message ?? '';
    if (message === 'TWO_FACTOR_DISABLED') {
      return res.status(400).json({ message: 'Two-factor authentication is disabled' });
    }
    next(e);
  }
}

export async function confirmTwoFactor(req: Request, res: Response, next: NextFunction) {
  const userId = req.user!.id;
  const schema = z.object({ code: z.string().min(3) });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: 'Invalid body' });

  try {
    await confirmTwoFactorSetup(userId, parsed.data.code);
    res.json({ enabled: true });
  } catch (e) {
    const message = (e as Error | undefined)?.message ?? '';
    if (message === 'TWO_FACTOR_DISABLED') {
      return res.status(400).json({ message: 'Two-factor authentication is disabled' });
    }
    if (message === 'NO_TWO_FACTOR_PENDING') {
      return res.status(400).json({ message: 'No pending 2FA setup for this user' });
    }
    if (message === 'INVALID_2FA_CODE') {
      return res.status(401).json({ message: 'Invalid verification code' });
    }
    next(e);
  }
}

export async function disableTwoFactor(req: Request, res: Response, next: NextFunction) {
  const userId = req.user!.id;
  try {
    await disableTwoFactorForUser(userId);
    res.json({ enabled: false });
  } catch (e) {
    const message = (e as Error | undefined)?.message ?? '';
    if (message === 'TWO_FACTOR_DISABLED') {
      return res.status(400).json({ message: 'Two-factor authentication is disabled' });
    }
    next(e);
  }
}
