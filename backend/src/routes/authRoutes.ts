import { Router } from 'express';
import { z } from 'zod';
import { issueTokens, loginUser, registerUser } from '../services/authService';
import { query } from '../db/pool';
import { requireAuth } from '../middleware/requireAuth';

const router = Router();

router.post('/signup', async (req, res) => {
  const schema = z.object({
    email: z.string().email(),
    password: z.string().min(6),
    name: z.string().min(2),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: 'Invalid body' });

  try {
    const user = await registerUser(parsed.data.email, parsed.data.password, parsed.data.name);
    const tokens = issueTokens(user.id);
    res.json({ ...tokens, user });
  } catch (e: any) {
    if (e.message === 'EMAIL_EXISTS') {
      return res.status(409).json({ message: 'Email already in use' });
    }
    console.error(e);
    res.status(500).json({ message: 'Server error' });
  }
});

router.post('/login', async (req, res) => {
  const schema = z.object({
    email: z.string().email(),
    password: z.string().min(1),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: 'Invalid body' });

  try {
    const user = await loginUser(parsed.data.email, parsed.data.password);
    const tokens = issueTokens(user.id);
    res.json({ ...tokens, user });
  } catch (e: any) {
    if (e.message === 'INVALID_CREDENTIALS') {
      return res.status(401).json({ message: 'Invalid email or password' });
    }
    console.error(e);
    res.status(500).json({ message: 'Server error' });
  }
});

router.get('/me', requireAuth, async (req, res) => {
  const userId = req.user!.id;

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
});

router.post('/me/push-tokens', requireAuth, async (req, res) => {
  const userId = req.user!.id;

  const schema = z.object({
    token: z.string().min(1),
  });

  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: 'Invalid body' });
  }

  const { token } = parsed.data;

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
});

export default router;
