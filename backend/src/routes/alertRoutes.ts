import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../middleware/requireAuth';
import {
  acknowledgeAlert,
  getAlerts,
  getAlertsForDevice,
  muteAlert,
} from '../services/alertService';

const router = Router();

router.use(requireAuth);

router.get('/alerts', async (req, res) => {
  const { siteId, severity, status, limit } = req.query;

  const alerts = await getAlerts({
    siteId: siteId as string | undefined,
    severity: severity as string | undefined,
    status: (status as string | undefined) || 'active',
    limit: limit ? Number(limit) : undefined,
  });

  res.json(alerts);
});

router.get('/devices/:id/alerts', async (req, res) => {
  const alerts = await getAlertsForDevice(req.params.id);
  res.json(alerts);
});

router.post('/alerts/:id/acknowledge', async (req, res) => {
  const userId = req.user!.id;
  const alert = await acknowledgeAlert(req.params.id, userId);
  if (!alert) return res.status(404).json({ message: 'Not found' });
  res.json(alert);
});

router.post('/alerts/:id/mute', async (req, res) => {
  const schema = z.object({
    minutes: z.number().int().positive().max(7 * 24 * 60),
  });

  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: 'Invalid body' });
  }

  const alert = await muteAlert(req.params.id, parsed.data.minutes);
  if (!alert) return res.status(404).json({ message: 'Not found' });
  res.json(alert);
});

export default router;
