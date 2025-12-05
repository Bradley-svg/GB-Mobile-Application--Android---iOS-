import { Router } from 'express';
import {
  acknowledgeAlertHandler,
  listAlerts,
  listDeviceAlerts,
  muteAlertHandler,
} from '../controllers/alertController';
import { requireAuth } from '../middleware/requireAuth';

const router = Router();

router.get('/alerts', requireAuth, listAlerts);
router.get('/devices/:id/alerts', requireAuth, listDeviceAlerts);
router.post('/alerts/:id/acknowledge', requireAuth, acknowledgeAlertHandler);
router.post('/alerts/:id/mute', requireAuth, muteAlertHandler);

export default router;
