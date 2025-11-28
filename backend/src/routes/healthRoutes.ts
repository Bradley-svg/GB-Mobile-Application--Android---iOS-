import { Router } from 'express';
import { query } from '../db/pool';

const router = Router();

router.get('/health', (_req, res) => {
  res.json({ ok: true });
});

router.get('/health-plus', async (_req, res) => {
  try {
    const dbRes = await query('select 1 as ok');
    const dbOk = dbRes.rows[0]?.ok === 1;

    res.json({
      ok: true,
      env: process.env.NODE_ENV || 'development',
      db: dbOk ? 'ok' : 'error',
      version: process.env.APP_VERSION || 'unknown',
    });
  } catch (e) {
    console.error('health-plus error', e);
    res.status(500).json({
      ok: false,
      env: process.env.NODE_ENV || 'development',
      db: 'error',
      version: process.env.APP_VERSION || 'unknown',
    });
  }
});

export default router;
