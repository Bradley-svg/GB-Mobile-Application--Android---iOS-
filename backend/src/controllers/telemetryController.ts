import { Request, Response } from 'express';

// Intentionally disabled HTTP telemetry ingest; MQTT is the supported path.
export function ingestHttpTelemetry(_req: Request, res: Response) {
  return res.status(501).json({
    error: 'HTTP telemetry ingest is disabled in this build. Use MQTT ingest.',
  });
}
