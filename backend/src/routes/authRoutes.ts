import { Router } from 'express';
import {
  authLimiter,
  login,
  me,
  logout,
  logoutAll,
  refresh,
  registerPushToken,
  signup,
} from '../controllers/authController';
import { requireAuth } from '../middleware/requireAuth';

const router = Router();

router.use(['/login', '/signup', '/refresh', '/logout', '/logout-all'], authLimiter);

router.post('/signup', signup);
router.post('/login', login);
// Password reset remains intentionally unimplemented; do not expose until a full flow exists.
router.post('/refresh', refresh);
router.get('/me', requireAuth, me);
router.post('/me/push-tokens', requireAuth, registerPushToken);
router.post('/logout', requireAuth, logout);
router.post('/logout-all', requireAuth, logoutAll);

export default router;
