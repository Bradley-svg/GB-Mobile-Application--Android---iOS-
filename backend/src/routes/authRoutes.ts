import { Router } from 'express';
import {
  authLimiter,
  login,
  me,
  logout,
  logoutAll,
  refresh,
  requestPasswordReset,
  resetPassword,
  registerPushToken,
  signup,
} from '../controllers/authController';
import { requireAuth } from '../middleware/requireAuth';
import { authRateLimitMiddleware } from '../middleware/rateLimit';

const router = Router();

router.use(['/signup', '/refresh', '/logout', '/logout-all', '/request-password-reset', '/reset-password'], authLimiter);

router.post('/signup', signup);
router.post('/login', authRateLimitMiddleware, login);
router.post('/request-password-reset', requestPasswordReset);
router.post('/reset-password', resetPassword);
router.post('/refresh', refresh);
router.get('/me', requireAuth, me);
router.post('/me/push-tokens', requireAuth, registerPushToken);
router.post('/logout', requireAuth, logout);
router.post('/logout-all', requireAuth, logoutAll);

export default router;
