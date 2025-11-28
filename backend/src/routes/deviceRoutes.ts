import { Router } from 'express';
import { requireAuth } from '../middleware/requireAuth';
import { getDeviceById } from '../services/deviceService';
import { getDeviceTelemetry } from '../services/telemetryService';

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

export default router;
