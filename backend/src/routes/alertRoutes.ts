import { Router } from 'express';
import {
  acknowledgeAlertHandler,
  listAlerts,
  listDeviceAlerts,
  muteAlertHandler,
} from '../controllers/alertController';
import { requireAuth } from '../middleware/requireAuth';

const router = Router();
router.use(requireAuth);

router.get('/alerts', listAlerts);
router.get('/devices/:id/alerts', listDeviceAlerts);
router.post('/alerts/:id/acknowledge', acknowledgeAlertHandler);
router.post('/alerts/:id/mute', muteAlertHandler);

export default router;
