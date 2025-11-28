import { Router } from 'express';
import { requireAuth } from '../middleware/requireAuth';
import { getDeviceById } from '../services/deviceService';

const router = Router();
router.use(requireAuth);

router.get('/devices/:id', async (req, res) => {
  const device = await getDeviceById(req.params.id);
  if (!device) return res.status(404).json({ message: 'Not found' });
  res.json(device);
});

router.get('/devices/:id/telemetry', async (_req, res) => {
  res.json({ points: [] });
});

export default router;
