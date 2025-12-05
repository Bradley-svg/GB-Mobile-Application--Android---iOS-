import { Router } from 'express';
import { postHeatPumpHistory } from '../controllers/heatPumpHistoryController';
import { requireAuth } from '../middleware/requireAuth';

const router = Router();

router.post('/heat-pump-history', requireAuth, postHeatPumpHistory);

export default router;
