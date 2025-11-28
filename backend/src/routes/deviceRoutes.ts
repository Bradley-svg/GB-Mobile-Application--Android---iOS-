import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../middleware/requireAuth';
import { getDeviceById } from '../services/deviceService';
import { getDeviceTelemetry } from '../services/telemetryService';
import { setDeviceMode, setDeviceSetpoint } from '../services/deviceControlService';

const router = Router();
router.use(requireAuth);

router.get('/devices/:id', async (req, res) => {
  const device = await getDeviceById(req.params.id);
  if (!device) return res.status(404).json({ message: 'Not found' });
  res.json(device);
});

router.get('/devices/:id/telemetry', async (req, res) => {
  const device = await getDeviceById(req.params.id);
  if (!device) return res.status(404).json({ message: 'Not found' });

  const rangeParam = (req.query.range as string) || '24h';
  const range = rangeParam === '7d' ? '7d' : '24h';

  const telemetry = await getDeviceTelemetry(device.id, range);
  res.json(telemetry);
});

router.post('/devices/:id/commands/setpoint', async (req, res) => {
  const userId = req.user!.id;
  const schema = z.object({
    metric: z.literal('flow_temp'),
    value: z.number(),
  });

  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: 'Invalid body' });
  }

  try {
    const command = await setDeviceSetpoint(req.params.id, userId, parsed.data);
    res.json(command);
  } catch (e: any) {
    switch (e.message) {
      case 'DEVICE_NOT_FOUND':
        return res.status(404).json({ message: 'Device not found' });
      case 'DEVICE_NOT_CONTROLLABLE':
        return res.status(400).json({ message: 'Device not controllable' });
      case 'UNSUPPORTED_METRIC':
        return res.status(400).json({ message: 'Unsupported metric' });
      case 'OUT_OF_RANGE':
        return res.status(400).json({ message: 'Value outside allowed range for this metric' });
      case 'COMMAND_FAILED':
        return res.status(502).json({ message: 'External control command failed' });
      default:
        console.error(e);
        return res.status(500).json({ message: 'Server error' });
    }
  }
});

router.post('/devices/:id/commands/mode', async (req, res) => {
  const userId = req.user!.id;
  const schema = z.object({
    mode: z.enum(['OFF', 'HEATING', 'COOLING', 'AUTO']),
  });

  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: 'Invalid body' });
  }

  try {
    const command = await setDeviceMode(req.params.id, userId, parsed.data);
    res.json(command);
  } catch (e: any) {
    switch (e.message) {
      case 'DEVICE_NOT_FOUND':
        return res.status(404).json({ message: 'Device not found' });
      case 'DEVICE_NOT_CONTROLLABLE':
        return res.status(400).json({ message: 'Device not controllable' });
      case 'UNSUPPORTED_MODE':
        return res.status(400).json({ message: 'Unsupported mode' });
      case 'COMMAND_FAILED':
        return res.status(502).json({ message: 'External control command failed' });
      default:
        console.error(e);
        return res.status(500).json({ message: 'Server error' });
    }
  }
});

export default router;
