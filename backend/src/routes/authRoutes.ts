import { Router } from 'express';
import { z } from 'zod';
import { issueTokens, loginUser, registerUser } from '../services/authService';

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

router.get('/me', async (_req, res) => {
  return res.status(501).json({ message: 'Not implemented yet' });
});

export default router;
