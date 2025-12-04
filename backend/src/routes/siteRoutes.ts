import { Router } from 'express';
import { getSite, getSiteDevices, listSites } from '../controllers/siteController';
import { requireAuth } from '../middleware/requireAuth';

const router = Router();
router.use(requireAuth);

router.get('/sites', listSites);
router.get('/sites/:id', getSite);
router.get('/sites/:id/devices', getSiteDevices);

export default router;
