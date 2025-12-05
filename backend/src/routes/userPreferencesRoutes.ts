import { Router } from 'express';
import {
  getUserPreferencesHandler,
  updateUserPreferencesHandler,
} from '../controllers/userPreferencesController';
import { requireAuth } from '../middleware/requireAuth';

const router = Router();

router.get('/user/preferences', requireAuth, getUserPreferencesHandler);
router.put('/user/preferences', requireAuth, updateUserPreferencesHandler);

export default router;
