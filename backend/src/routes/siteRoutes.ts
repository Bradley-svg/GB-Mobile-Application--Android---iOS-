import { Router } from 'express';
import {
  exportSiteDevicesCsvHandler,
  getSite,
  getSiteDevices,
  listSites,
} from '../controllers/siteController';
import { requireAuth } from '../middleware/requireAuth';

const router = Router();

router.get('/sites', requireAuth, listSites);
router.get('/sites/:id', requireAuth, getSite);
router.get('/sites/:id/devices', requireAuth, getSiteDevices);
router.get('/sites/:id/export/devices.csv', requireAuth, exportSiteDevicesCsvHandler);

export default router;
