import request from 'supertest';
import jwt from 'jsonwebtoken';
import type { Express } from 'express';
import { beforeAll, describe, expect, it } from 'vitest';
import { normalizeHeatPumpHistoryResponse } from '../src/integrations/heatPumpHistoryClient';

const shouldRun =
  process.env.RUN_VENDOR_INTEGRATION_TESTS === 'true' &&
  Boolean(
    process.env.HEATPUMP_HISTORY_API_KEY || process.env.HEAT_PUMP_HISTORY_API_KEY
  );

const DEFAULT_DEVICE_ID = process.env.DEMO_DEVICE_ID || '33333333-3333-3333-3333-333333333333';
const DEFAULT_USER_ID = process.env.DEMO_USER_ID || '44444444-4444-4444-4444-444444444444';
const DEFAULT_VENDOR_URL =
  process.env.HEATPUMP_HISTORY_URL ||
  process.env.HEAT_PUMP_HISTORY_URL ||
  'https://za-iot-dev-api.azurewebsites.net/api/HeatPumpHistory/historyHeatPump';

(shouldRun ? describe : describe.skip)(
  'vendor heat pump history integration (env gated)',
  () => {
    let app: Express;
    let token: string;

    beforeAll(async () => {
      process.env.NODE_ENV = process.env.NODE_ENV || 'test';
      process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret';
      const mod = await import('../src/index');
      app = mod.default;
      token = jwt.sign({ sub: DEFAULT_USER_ID, type: 'access' }, process.env.JWT_SECRET!);
    });

    it('returns vendor data and mirrored backend history for the last 6h', async () => {
      const apiKey =
        process.env.HEATPUMP_HISTORY_API_KEY || process.env.HEAT_PUMP_HISTORY_API_KEY || '';
      const mac = (process.env.DEMO_DEVICE_MAC || '38:18:2B:60:A9:94').toUpperCase();
      const to = new Date();
      const from = new Date(to.getTime() - 6 * 60 * 60 * 1000);

      const vendorRes = await fetch(DEFAULT_VENDOR_URL, {
        method: 'POST',
        headers: {
          accept: 'text/plain',
          'content-type': 'application/json-patch+json',
          ...(apiKey ? { 'x-api-key': apiKey } : {}),
        },
        body: JSON.stringify({
          aggregation: 'raw',
          mode: 'live',
          from: from.toISOString(),
          to: to.toISOString(),
          fields: [{ field: 'metric_compCurrentA' }],
          mac,
        }),
      });

      expect(vendorRes.status).toBe(200);
      const vendorText = await vendorRes.text();
      let vendorParsed: unknown = {};
      try {
        vendorParsed = vendorText ? JSON.parse(vendorText) : {};
      } catch {
        vendorParsed = vendorText;
      }
      const vendorNormalized = normalizeHeatPumpHistoryResponse(vendorParsed);
      expect(Array.isArray(vendorNormalized.series)).toBe(true);
      expect(vendorNormalized.series.every((s) => Array.isArray(s.points))).toBe(true);

      const proxyRes = await request(app)
        .post('/heat-pump-history')
        .set('Authorization', `Bearer ${token}`)
        .send({
          deviceId: DEFAULT_DEVICE_ID,
          from: from.toISOString(),
          to: to.toISOString(),
          aggregation: 'raw',
          mode: 'live',
          fields: [{ field: 'metric_compCurrentA' }],
        })
        .expect(200);

      const proxySeries = proxyRes.body?.series ?? [];
      expect(Array.isArray(proxySeries)).toBe(true);

      const vendorHasPoints = vendorNormalized.series.some((series) =>
        (series.points ?? []).some((p) => p.value !== null)
      );
      if (vendorHasPoints) {
        expect(
          proxySeries.some(
            (series: { points?: Array<{ value: number | null }> }) =>
              (series.points ?? []).some((p) => p.value !== null)
          )
        ).toBe(true);
      }
    });
  }
);

