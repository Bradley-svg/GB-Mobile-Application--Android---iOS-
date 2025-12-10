import { Router } from 'express';
import { registerPushTokenHandler, sendTestPushNotification } from '../controllers/pushController';
import { requireAuth } from '../middleware/requireAuth';

const router = Router();

router.post('/me/push/register', requireAuth, registerPushTokenHandler);
router.post('/me/push/test', requireAuth, sendTestPushNotification);

export default router;
