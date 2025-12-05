import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import {
  getDevice,
  getLastCommand,
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

router.get('/devices/:id', requireAuth, getDevice);
router.get('/devices/:id/telemetry', requireAuth, getDeviceTelemetryHandler);
router.get('/devices/:id/last-command', requireAuth, getLastCommand);
router.post('/devices/:id/commands/setpoint', requireAuth, controlLimiter, sendSetpointCommand);
router.post('/devices/:id/commands/mode', requireAuth, controlLimiter, sendModeCommand);

export default router;
