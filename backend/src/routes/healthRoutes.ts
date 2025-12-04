import { Router } from 'express';
import { health, healthPlus } from '../controllers/healthController';

const router = Router();

// health-plus surfaces real connectivity by reading shared system_status fields instead of config-only flags.
router.get('/health', health);
router.get('/health-plus', healthPlus);

export default router;
