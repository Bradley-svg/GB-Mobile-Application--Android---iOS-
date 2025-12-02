import { Response, Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../middleware/requireAuth';
import {
  acknowledgeAlert,
  getAlerts,
  getAlertsForDevice,
  muteAlert,
} from '../services/alertService';
import { getUserContext, requireOrganisationId } from '../services/userService';

const router = Router();
const alertIdSchema = z.object({ id: z.string().uuid() });
const deviceIdSchema = z.object({ id: z.string().uuid() });
const alertsQuerySchema = z.object({
  siteId: z.string().uuid().optional(),
  severity: z.enum(['info', 'warning', 'critical']).optional(),
  status: z.enum(['active', 'cleared']).optional(),
  limit: z.coerce.number().int().positive().max(500).optional(),
});

router.use(requireAuth);

async function loadOrganisationId(userId: string, res: Response) {
  const user = await getUserContext(userId);
  if (!user) {
    res.status(401).json({ message: 'Unauthorized' });
    return null;
  }

  try {
    return requireOrganisationId(user);
  } catch {
    res.status(403).json({ message: 'User not assigned to an organisation' });
    return null;
  }
}

router.get('/alerts', async (req, res, next) => {
  const parsedQuery = alertsQuerySchema.safeParse(req.query);
  if (!parsedQuery.success) {
    return res.status(400).json({ message: 'Invalid query' });
  }

  const { siteId, severity, status, limit } = parsedQuery.data;

  try {
    const organisationId = await loadOrganisationId(req.user!.id, res);
    if (!organisationId) return;

    const alerts = await getAlerts({
      siteId,
      severity,
      status: status ?? 'active',
      limit,
      organisationId,
    });

    res.json(alerts);
  } catch (e) {
    next(e);
  }
});

router.get('/devices/:id/alerts', async (req, res, next) => {
  const parsedParams = deviceIdSchema.safeParse(req.params);
  if (!parsedParams.success) {
    return res.status(400).json({ message: 'Invalid device id' });
  }

  try {
    const organisationId = await loadOrganisationId(req.user!.id, res);
    if (!organisationId) return;

    const alerts = await getAlertsForDevice(parsedParams.data.id, organisationId);
    res.json(alerts);
  } catch (e) {
    next(e);
  }
});

router.post('/alerts/:id/acknowledge', async (req, res, next) => {
  const parsedParams = alertIdSchema.safeParse(req.params);
  if (!parsedParams.success) {
    return res.status(400).json({ message: 'Invalid alert id' });
  }

  const userId = req.user!.id;

  try {
    const organisationId = await loadOrganisationId(userId, res);
    if (!organisationId) return;

    const alert = await acknowledgeAlert(parsedParams.data.id, userId, organisationId);
    if (!alert) return res.status(404).json({ message: 'Not found' });
    res.json(alert);
  } catch (e) {
    next(e);
  }
});

router.post('/alerts/:id/mute', async (req, res, next) => {
  const parsedParams = alertIdSchema.safeParse(req.params);
  if (!parsedParams.success) {
    return res.status(400).json({ message: 'Invalid alert id' });
  }

  const schema = z.object({
    minutes: z.number().int().positive().max(7 * 24 * 60),
  });

  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: 'Invalid body' });
  }

  try {
    const organisationId = await loadOrganisationId(req.user!.id, res);
    if (!organisationId) return;

    const alert = await muteAlert(parsedParams.data.id, parsed.data.minutes, organisationId);
    if (!alert) return res.status(404).json({ message: 'Not found' });
    res.json(alert);
  } catch (e) {
    next(e);
  }
});

export default router;
