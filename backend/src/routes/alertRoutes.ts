import { Router } from 'express';
import {
  acknowledgeAlertHandler,
  listAlerts,
  listDeviceAlerts,
  muteAlertHandler,
} from '../controllers/alertController';
import { listRulesForDevice, listRulesForSite } from '../controllers/alertRulesController';
import { requireAuth } from '../middleware/requireAuth';

const router = Router();

router.get('/alerts', requireAuth, listAlerts);
router.get('/devices/:id/alerts', requireAuth, listDeviceAlerts);
router.get('/devices/:id/alert-rules', requireAuth, listRulesForDevice);
router.get('/sites/:id/alert-rules', requireAuth, listRulesForSite);
router.post('/alerts/:id/acknowledge', requireAuth, acknowledgeAlertHandler);
router.post('/alerts/:id/mute', requireAuth, muteAlertHandler);

export default router;
