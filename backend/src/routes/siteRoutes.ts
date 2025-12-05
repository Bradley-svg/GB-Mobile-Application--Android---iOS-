import { Router } from 'express';
import { getSite, getSiteDevices, listSites } from '../controllers/siteController';
import { requireAuth } from '../middleware/requireAuth';

const router = Router();

router.get('/sites', requireAuth, listSites);
router.get('/sites/:id', requireAuth, getSite);
router.get('/sites/:id/devices', requireAuth, getSiteDevices);

export default router;
