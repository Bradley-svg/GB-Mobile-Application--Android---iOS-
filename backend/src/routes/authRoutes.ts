import { Router } from 'express';
import { z } from 'zod';
import { issueTokens, loginUser, registerUser, verifyRefreshToken } from '../services/authService';
import { query } from '../db/pool';
import { requireAuth } from '../middleware/requireAuth';

const router = Router();
const PUSH_TOKEN_RECENT_MINUTES = 10;

router.post('/signup', async (req, res, next) => {
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
    const tokens = await issueTokens(user.id);
    res.json({ ...tokens, user });
  } catch (e: any) {
    if (e.message === 'EMAIL_EXISTS') {
      return res.status(409).json({ message: 'Email already in use' });
    }
    next(e);
  }
});

router.post('/login', async (req, res, next) => {
  const schema = z.object({
    email: z.string().email(),
    password: z.string().min(1),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: 'Invalid body' });

  try {
    const user = await loginUser(parsed.data.email, parsed.data.password);
    const tokens = await issueTokens(user.id);
    res.json({ ...tokens, user });
  } catch (e: any) {
    if (e.message === 'INVALID_CREDENTIALS') {
      return res.status(401).json({ message: 'Invalid email or password' });
    }
    next(e);
  }
});

router.post('/reset-password', async (req, res) => {
  const schema = z.object({
    email: z.string().email(),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: 'Invalid body' });

  res.status(501).json({
    error: 'Password reset not implemented yet.',
  });
});

router.post('/refresh', async (req, res, next) => {
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
});

router.get('/me', requireAuth, async (req, res, next) => {
  const userId = req.user!.id;

  try {
    const result = await query<{
      id: string;
      email: string;
      name: string;
      organisation_id: string | null;
    }>(
      `
      select id, email, name, organisation_id
      from users
      where id = $1
    `,
      [userId]
    );

    const user = result.rows[0];
    if (!user) return res.status(404).json({ message: 'User not found' });

    res.json(user);
  } catch (e) {
    next(e);
  }
});

router.post('/me/push-tokens', requireAuth, async (req, res, next) => {
  const userId = req.user!.id;

  const schema = z.object({
    token: z.string().min(1),
  });

  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: 'Invalid body' });
  }

  const { token } = parsed.data;
  const recentThreshold = new Date(Date.now() - PUSH_TOKEN_RECENT_MINUTES * 60 * 1000);

  try {
    const existing = await query<{ last_used_at: Date | null }>(
      `
      select last_used_at
      from push_tokens
      where user_id = $1 and expo_token = $2
    `,
      [userId, token]
    );

    const lastUsedRaw = existing.rows[0]?.last_used_at;
    const lastUsedAt = lastUsedRaw ? new Date(lastUsedRaw) : null;

    if (lastUsedAt && lastUsedAt > recentThreshold) {
      return res.json({ ok: true, skipped: true });
    }

    await query(
      `
      insert into push_tokens (user_id, expo_token, created_at, last_used_at)
      values ($1, $2, now(), null)
      on conflict (user_id, expo_token)
      do update set last_used_at = now()
      returning *
    `,
      [userId, token]
    );

    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
});

export default router;
