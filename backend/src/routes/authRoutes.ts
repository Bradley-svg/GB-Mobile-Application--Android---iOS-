import { Router } from 'express';
import {
  authLimiter,
  login,
  me,
  refresh,
  registerPushToken,
  resetPassword,
  signup,
} from '../controllers/authController';
import { requireAuth } from '../middleware/requireAuth';

const router = Router();

router.use(['/login', '/signup', '/refresh', '/reset-password'], authLimiter);

router.post('/signup', signup);
router.post('/login', login);
router.post('/reset-password', resetPassword);
router.post('/refresh', refresh);
router.get('/me', requireAuth, me);
router.post('/me/push-tokens', requireAuth, registerPushToken);

export default router;
