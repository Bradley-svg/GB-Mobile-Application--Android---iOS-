import { Router } from 'express';
import { ingestHttpTelemetry } from '../controllers/telemetryController';

const router = Router();

// HTTP telemetry ingest is intentionally disabled; keep the stub for future providers.
router.post('/telemetry/http', ingestHttpTelemetry);

export default router;
