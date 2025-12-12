import { Router } from 'express';
import { getDemoStatus } from '../controllers/demoController';
import { requireAuth } from '../middleware/requireAuth';

const router = Router();

router.get('/demo/status', requireAuth, getDemoStatus);

export default router;
