import { Router, Response } from 'express';
import { z } from 'zod';
import { requireAuth } from '../middleware/requireAuth';
import {
  getDevicesForSite,
  getSiteById,
  getSitesForOrganisation,
} from '../services/siteService';
import { getUserContext, requireOrganisationId } from '../services/userService';

const router = Router();
const siteIdSchema = z.object({ id: z.string().uuid() });

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

router.get('/sites', async (req, res, next) => {
  try {
    const organisationId = await loadOrganisationId(req.user!.id, res);
    if (!organisationId) return;

    const sites = await getSitesForOrganisation(organisationId);
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
    const organisationId = await loadOrganisationId(req.user!.id, res);
    if (!organisationId) return;

    const site = await getSiteById(parsedParams.data.id, organisationId);
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
    const organisationId = await loadOrganisationId(req.user!.id, res);
    if (!organisationId) return;

    const devices = await getDevicesForSite(parsedParams.data.id, organisationId);
    res.json(devices);
  } catch (e) {
    next(e);
  }
});

export default router;
