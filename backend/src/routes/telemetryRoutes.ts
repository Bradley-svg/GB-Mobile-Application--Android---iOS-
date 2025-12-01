import { Router } from 'express';
import { z } from 'zod';
import {
  handleHttpTelemetryIngest,
  telemetryPayloadSchema,
} from '../services/telemetryIngestService';

const router = Router();

const httpTelemetrySchema = telemetryPayloadSchema.extend({
  siteExternalId: z.string().min(1),
  deviceExternalId: z.string().min(1),
});

export const TELEMETRY_HTTP_KEY = (process.env.TELEMETRY_API_KEY || '').trim();
export const TELEMETRY_HTTP_ENABLED = Boolean(TELEMETRY_HTTP_KEY);

router.post('/telemetry/http', async (req, res) => {
  if (!TELEMETRY_HTTP_ENABLED) {
    return res.status(501).json({ message: 'Telemetry HTTP ingest disabled' });
  }

  const apiKey = req.header('x-api-key');
  if (apiKey !== TELEMETRY_HTTP_KEY) {
    return res.status(401).json({ message: 'Unauthorized' });
  }

  const parsed = httpTelemetrySchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: 'Invalid body' });
  }

  const { deviceExternalId, siteExternalId, ...payload } = parsed.data;

  const ok = await handleHttpTelemetryIngest({
    deviceExternalId,
    siteExternalId,
    payload,
  });

  if (!ok) {
    return res.status(400).json({ message: 'Telemetry rejected' });
  }

  res.json({ ok: true });
});

export default router;
