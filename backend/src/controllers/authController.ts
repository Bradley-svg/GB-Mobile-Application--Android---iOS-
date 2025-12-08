import { NextFunction, Request, Response } from 'express';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import {
  issueTokens,
  loginUser,
  registerUser,
  revokeAllRefreshTokensForUser,
  revokeRefreshTokenForSession,
  verifyRefreshToken,
} from '../services/authService';
import { registerPushTokenForUser } from '../services/pushService';
import { getUserContext } from '../services/userService';

const PUSH_TOKEN_RECENT_MINUTES = 10;

export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 50,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Too many auth attempts. Please try again shortly.' },
});

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
  } catch (e: any) {
    if (e.message === 'EMAIL_EXISTS') {
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

  try {
    const user = await loginUser(parsed.data.email, parsed.data.password);
    const tokens = await issueTokens(user.id, { role: user.role });
    res.json({ ...tokens, user });
  } catch (e: any) {
    if (e.message === 'INVALID_CREDENTIALS') {
      return res.status(401).json({ message: 'Invalid email or password' });
    }
    next(e);
  }
}

/**
 * Password reset is intentionally not implemented. Do not wire this route
 * until a full token/email-based reset flow is designed and approved.
 */
export async function resetPassword(req: Request, res: Response) {
  const schema = z.object({
    email: z.string().email(),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: 'Invalid body' });

  res.status(501).json({
    error: 'Password reset is not yet implemented; contact support or an administrator.',
  });
}

export async function refresh(req: Request, res: Response, next: NextFunction) {
  const schema = z.object({
    refreshToken: z.string().min(10),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: 'Invalid body' });

  try {
    const { userId, tokenId } = await verifyRefreshToken(parsed.data.refreshToken);
    const tokens = await issueTokens(userId, { rotateFromId: tokenId });
    res.json(tokens);
  } catch (e: any) {
    const invalidReasons = [
      'INVALID_TOKEN_TYPE',
      'REFRESH_TOKEN_NOT_FOUND',
      'REFRESH_TOKEN_USER_MISMATCH',
      'REFRESH_TOKEN_REVOKED',
      'REFRESH_TOKEN_EXPIRED',
    ];
    if (invalidReasons.includes(e?.message)) {
      return res.status(401).json({ message: 'Invalid refresh token' });
    }
    if (e?.name === 'JsonWebTokenError' || e?.name === 'TokenExpiredError') {
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
  } catch (e: any) {
    const invalidReasons = [
      'INVALID_TOKEN_TYPE',
      'REFRESH_TOKEN_NOT_FOUND',
      'REFRESH_TOKEN_USER_MISMATCH',
      'REFRESH_TOKEN_REVOKED',
      'REFRESH_TOKEN_EXPIRED',
      'MISSING_TOKEN_ID',
    ];
    if (invalidReasons.includes(e?.message)) {
      return res.status(401).json({ message: 'Invalid refresh token' });
    }
    if (e?.name === 'JsonWebTokenError' || e?.name === 'TokenExpiredError') {
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

export async function registerPushToken(req: Request, res: Response, next: NextFunction) {
  const userId = req.user!.id;

  const schema = z.object({
    token: z.string().min(1),
  });

  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: 'Invalid body' });
  }

  try {
    const result = await registerPushTokenForUser(
      userId,
      parsed.data.token,
      PUSH_TOKEN_RECENT_MINUTES
    );
    if (result.skipped) {
      res.json({ ok: true, skipped: true });
    } else {
      res.json({ ok: true });
    }
  } catch (e) {
    next(e);
  }
}
