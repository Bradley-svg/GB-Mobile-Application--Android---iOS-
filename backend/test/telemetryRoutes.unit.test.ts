import express from 'express';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import telemetryRoutes from '../src/routes/telemetryRoutes';

describe('telemetryRoutes HTTP ingest', () => {
  const app = express();
  app.use(express.json());
  app.use(telemetryRoutes);

  it('returns 501 and instructs clients to use MQTT ingest', async () => {
    const res = await request(app).post('/telemetry/http').send({ foo: 'bar' }).expect(501);

    expect(res.body).toEqual({
      error: 'HTTP telemetry ingest is disabled in this build. Use MQTT ingest.',
    });
  });
});
