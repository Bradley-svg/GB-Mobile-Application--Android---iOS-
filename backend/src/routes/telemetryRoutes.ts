import { Router } from 'express';

const router = Router();

router.post('/telemetry/http', (req, res) => {
  return res.status(501).json({
    error: 'HTTP telemetry ingest is disabled in this build. Use MQTT ingest.',
  });
});

export default router;
