import { Router } from 'express';
import { postHeatPumpHistory } from '../controllers/heatPumpHistoryController';
import { requireAuth } from '../middleware/requireAuth';

const router = Router();
router.use(requireAuth);

router.post('/heat-pump-history', postHeatPumpHistory);

export default router;
