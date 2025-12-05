import request from 'supertest';
import jwt from 'jsonwebtoken';
import type { Express } from 'express';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { HeatPumpHistoryResult } from '../src/integrations/heatPumpHistoryClient';

const fetchHeatPumpHistoryMock = vi.fn();
const queryMock = vi.fn();

vi.mock('../src/config/db', () => ({
  query: (...args: unknown[]) => queryMock(...(args as [string, unknown[]?])),
}));

vi.mock('../src/integrations/heatPumpHistoryClient', () => ({
  fetchHeatPumpHistory: (...args: unknown[]) =>
    fetchHeatPumpHistoryMock(...(args as [{ mac: string }])),
}));

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-secret';

let app: Express;
let token: string;

beforeAll(async () => {
  const mod = await import('../src/index');
  app = mod.default;
  token = jwt.sign({ sub: 'user-123', type: 'access' }, process.env.JWT_SECRET!);
});

beforeEach(() => {
  fetchHeatPumpHistoryMock.mockReset();
  queryMock.mockReset();
});

describe('POST /heat-pump-history', () => {
  const requestBody = {
    mac: '38:18:2B:60:A9:94',
    from: '2025-12-03T08:12:46.503Z',
    to: '2025-12-03T14:12:46.503Z',
    aggregation: 'raw' as const,
    mode: 'live' as const,
    fields: [{ field: 'metric_compCurrentA' }],
  };

  it('requires authentication', async () => {
    const res = await request(app).post('/heat-pump-history').send(requestBody).expect(401);

    expect(res.body).toEqual({ message: 'Unauthorized' });
    expect(fetchHeatPumpHistoryMock).not.toHaveBeenCalled();
  });

  it('returns normalized data from the integration client', async () => {
    const historyResponse: HeatPumpHistoryResult = {
      ok: true,
      series: [
        {
          field: 'metric_compCurrentA',
          points: [{ timestamp: '2025-12-03T08:12:46.503Z', value: 12.3 }],
        },
      ],
    };
    fetchHeatPumpHistoryMock.mockResolvedValueOnce(historyResponse);

    const res = await request(app)
      .post('/heat-pump-history')
      .set('Authorization', `Bearer ${token}`)
      .send(requestBody)
      .expect(200);

    expect(fetchHeatPumpHistoryMock).toHaveBeenCalledWith(requestBody);
    expect(res.body).toEqual({ series: historyResponse.series });
  });

  it('returns 400 on invalid body', async () => {
    const res = await request(app)
      .post('/heat-pump-history')
      .set('Authorization', `Bearer ${token}`)
      .send({ ...requestBody, fields: [], from: '2025-12-04T10:00:00Z', to: '2025-12-03T10:00:00Z' })
      .expect(400);

    expect(res.body).toEqual({ message: 'Invalid body' });
    expect(fetchHeatPumpHistoryMock).not.toHaveBeenCalled();
  });

  it('returns 502 when the upstream call fails', async () => {
    fetchHeatPumpHistoryMock.mockResolvedValueOnce({
      ok: false,
      kind: 'UPSTREAM_ERROR',
      message: 'Upstream failed',
    });

    const res = await request(app)
      .post('/heat-pump-history')
      .set('Authorization', `Bearer ${token}`)
      .send(requestBody)
      .expect(502);

    expect(res.body).toEqual({ error: 'upstream_history_error', message: 'Upstream failed' });
  });

  it('returns 503 when the circuit is open', async () => {
    fetchHeatPumpHistoryMock.mockResolvedValueOnce({
      ok: false,
      kind: 'CIRCUIT_OPEN',
      message: 'Temporarily unavailable',
    });

    const res = await request(app)
      .post('/heat-pump-history')
      .set('Authorization', `Bearer ${token}`)
      .send(requestBody)
      .expect(503);

    expect(res.body).toEqual({
      error: 'history_temporarily_unavailable',
      message: 'Temporarily unavailable',
    });
  });
});
