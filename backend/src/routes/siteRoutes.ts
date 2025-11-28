import { Router } from 'express';
import { requireAuth } from '../middleware/requireAuth';
import { getDevicesForSite, getSiteById, getSitesForUser } from '../services/siteService';

const router = Router();

router.use(requireAuth);

router.get('/sites', async (req, res) => {
  const sites = await getSitesForUser(req.user!.id);
  res.json(sites);
});

router.get('/sites/:id', async (req, res) => {
  const site = await getSiteById(req.params.id);
  if (!site) return res.status(404).json({ message: 'Not found' });
  res.json(site);
});

router.get('/sites/:id/devices', async (req, res) => {
  const devices = await getDevicesForSite(req.params.id);
  res.json(devices);
});

export default router;
