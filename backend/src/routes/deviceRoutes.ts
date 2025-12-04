import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import {
  getDevice,
  getDeviceTelemetryHandler,
  sendModeCommand,
  sendSetpointCommand,
} from '../controllers/deviceController';
import { requireAuth } from '../middleware/requireAuth';

const router = Router();
const controlLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.user?.id || req.ip || 'unknown',
  message: { message: 'Too many control commands. Please retry in a few minutes.' },
});
router.use(requireAuth);

router.get('/devices/:id', getDevice);
router.get('/devices/:id/telemetry', getDeviceTelemetryHandler);
router.post('/devices/:id/commands/setpoint', controlLimiter, sendSetpointCommand);
router.post('/devices/:id/commands/mode', controlLimiter, sendModeCommand);

export default router;
