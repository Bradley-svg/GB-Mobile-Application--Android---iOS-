import { Router } from 'express';
import { listFleet } from '../controllers/fleetController';
import { requireAuth } from '../middleware/requireAuth';

const router = Router();

router.get('/fleet', requireAuth, listFleet);

export default router;
