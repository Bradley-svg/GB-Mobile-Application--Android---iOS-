import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../middleware/requireAuth';
import { getDevicesForSite, getSiteById, getSitesForUser } from '../services/siteService';

const router = Router();
const siteIdSchema = z.object({ id: z.string().uuid() });

router.use(requireAuth);

router.get('/sites', async (req, res, next) => {
  try {
    const sites = await getSitesForUser(req.user!.id);
    res.json(sites);
  } catch (e) {
    next(e);
  }
});

router.get('/sites/:id', async (req, res, next) => {
  const parsedParams = siteIdSchema.safeParse(req.params);
  if (!parsedParams.success) {
    return res.status(400).json({ message: 'Invalid site id' });
  }

  try {
    const site = await getSiteById(parsedParams.data.id);
    if (!site) return res.status(404).json({ message: 'Not found' });
    res.json(site);
  } catch (e) {
    next(e);
  }
});

router.get('/sites/:id/devices', async (req, res, next) => {
  const parsedParams = siteIdSchema.safeParse(req.params);
  if (!parsedParams.success) {
    return res.status(400).json({ message: 'Invalid site id' });
  }

  try {
    const devices = await getDevicesForSite(parsedParams.data.id);
    res.json(devices);
  } catch (e) {
    next(e);
  }
});

export default router;
