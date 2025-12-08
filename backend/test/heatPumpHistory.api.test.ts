import request from 'supertest';
import jwt from 'jsonwebtoken';
import type { Express } from 'express';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { HeatPumpHistoryResult } from '../src/integrations/heatPumpHistoryClient';
import type { DeviceRow } from '../src/repositories/devicesRepository';

const fetchHeatPumpHistoryMock = vi.fn();
const getHeatPumpHistoryConfigMock = vi.fn();
const queryMock = vi.fn();

vi.mock('../src/config/db', () => ({
  query: (...args: unknown[]) => queryMock(...(args as [string, unknown[]?])),
}));

vi.mock('../src/integrations/heatPumpHistoryClient', () => ({
  fetchHeatPumpHistory: (...args: unknown[]) =>
    fetchHeatPumpHistoryMock(...(args as [Record<string, unknown>])),
  getHeatPumpHistoryConfig: (...args: unknown[]) =>
    getHeatPumpHistoryConfigMock(...args),
}));

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-secret';

let app: Express;
let token: string;

const defaultDevice: DeviceRow = {
  id: 'device-123',
  site_id: 'site-123',
  name: 'Demo Heat Pump',
  type: 'heat_pump',
  external_id: null,
  mac: '38:18:2B:60:A9:94',
  status: null,
  last_seen_at: null,
  controller: null,
  firmware_version: null,
  connectivity_status: null,
};

const buildConfig = () => {
  const nodeEnv = process.env.NODE_ENV || 'development';
  const rawUrl =
    process.env.HEATPUMP_HISTORY_URL || process.env.HEAT_PUMP_HISTORY_URL || '';
  const apiKey =
    process.env.HEATPUMP_HISTORY_API_KEY || process.env.HEAT_PUMP_HISTORY_API_KEY;
  const url =
    rawUrl || (nodeEnv === 'development'
      ? 'https://za-iot-dev-api.azurewebsites.net/api/HeatPumpHistory/historyHeatPump'
      : undefined);
  const missingKeys =
    nodeEnv === 'development'
      ? []
      : [
          ...(rawUrl ? [] : ['HEATPUMP_HISTORY_URL']),
          ...(apiKey ? [] : ['HEATPUMP_HISTORY_API_KEY']),
        ];

  return {
    url,
    apiKey,
    requestTimeoutMs: 10_000,
    configured: Boolean(url && apiKey),
    missingKeys,
    nodeEnv,
  };
};

beforeAll(async () => {
  const mod = await import('../src/index');
  app = mod.default;
  token = jwt.sign({ sub: 'user-123', type: 'access' }, process.env.JWT_SECRET!);
});

beforeEach(() => {
  fetchHeatPumpHistoryMock.mockReset();
  queryMock.mockReset();
  getHeatPumpHistoryConfigMock.mockReset();
  process.env.NODE_ENV = 'test';
  process.env.HEATPUMP_HISTORY_URL =
    'https://za-iot-dev-api.azurewebsites.net/api/HeatPumpHistory/historyHeatPump';
  process.env.HEATPUMP_HISTORY_API_KEY = 'test-key';
  delete process.env.HEAT_PUMP_HISTORY_URL;
  delete process.env.HEAT_PUMP_HISTORY_API_KEY;
  getHeatPumpHistoryConfigMock.mockImplementation(buildConfig);
});

function mockDb({
  userOrg = 'org-123',
  deviceOrg = userOrg,
  mac = defaultDevice.mac,
}: {
  userOrg?: string;
  deviceOrg?: string;
  mac?: string | null;
} = {}) {
  queryMock.mockImplementation(async (sql: string, params?: unknown[]) => {
    const text = sql.toLowerCase();

    if (text.includes('from users')) {
      return {
        rows: [
          {
            id: (params?.[0] as string) ?? 'user-123',
            email: 'user@example.com',
            name: 'Test User',
            organisation_id: userOrg,
            role: 'owner',
            can_impersonate: false,
          },
        ],
      };
    }

    if (text.includes('from devices')) {
      if (deviceOrg !== userOrg) return { rows: [] };
      return {
        rows: [
          {
            ...defaultDevice,
            mac,
          },
        ],
      };
    }

    return { rows: [] };
  });
}

describe('POST /heat-pump-history', () => {
  const requestBody = {
    deviceId: defaultDevice.id,
    from: '2025-12-03T08:12:46.503Z',
    to: '2025-12-03T14:12:46.503Z',
    aggregation: 'raw' as const,
    mode: 'live' as const,
    fields: [{ field: 'metric_compCurrentA' }],
  };

  it('requires authentication', async () => {
    mockDb();
    const res = await request(app).post('/heat-pump-history').send(requestBody).expect(401);

    expect(res.body).toEqual({ message: 'Unauthorized' });
    expect(fetchHeatPumpHistoryMock).not.toHaveBeenCalled();
  });

  it('returns normalized data from the integration client', async () => {
    mockDb({ mac: ' 38:18:2b:60:a9:94 ' });
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

    expect(fetchHeatPumpHistoryMock).toHaveBeenCalledWith({
      mac: '38:18:2b:60:a9:94',
      from: requestBody.from,
      to: requestBody.to,
      aggregation: requestBody.aggregation,
      mode: requestBody.mode,
      fields: requestBody.fields,
    });
    expect(res.body).toEqual({ series: historyResponse.series });
  });

  it('returns 400 on invalid body', async () => {
    mockDb();
    const res = await request(app)
      .post('/heat-pump-history')
      .set('Authorization', `Bearer ${token}`)
      .send({ ...requestBody, fields: [], from: '2025-12-04T10:00:00Z', to: '2025-12-03T10:00:00Z' })
      .expect(400);

    expect(res.body).toEqual({ message: 'Invalid body' });
    expect(fetchHeatPumpHistoryMock).not.toHaveBeenCalled();
  });

  it('returns 502 when the upstream call fails', async () => {
    mockDb();
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
    mockDb();
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

  it('returns 404 when the device is not in the user organisation', async () => {
    mockDb({ deviceOrg: 'org-999' });

    const res = await request(app)
      .post('/heat-pump-history')
      .set('Authorization', `Bearer ${token}`)
      .send(requestBody)
      .expect(404);

    expect(res.body).toEqual({ message: 'Device not found for this organisation' });
    expect(fetchHeatPumpHistoryMock).not.toHaveBeenCalled();
  });

  it('returns 400 when the device has no MAC configured', async () => {
    mockDb({ mac: null });

    const res = await request(app)
      .post('/heat-pump-history')
      .set('Authorization', `Bearer ${token}`)
      .send(requestBody)
      .expect(400);

    expect(res.body).toEqual({ message: 'Device has no MAC configured' });
    expect(fetchHeatPumpHistoryMock).not.toHaveBeenCalled();
  });

  it('returns 503 when required env vars are missing outside development', async () => {
    process.env.NODE_ENV = 'production';
    delete process.env.HEATPUMP_HISTORY_URL;
    delete process.env.HEATPUMP_HISTORY_API_KEY;
    getHeatPumpHistoryConfigMock.mockImplementation(buildConfig);
    mockDb();

    const res = await request(app)
      .post('/heat-pump-history')
      .set('Authorization', `Bearer ${token}`)
      .send(requestBody)
      .expect(503);

    expect(res.body).toEqual({
      error: 'heat_pump_history_disabled',
      message: 'Heat pump history is disabled until required env vars are set',
    });
    expect(fetchHeatPumpHistoryMock).not.toHaveBeenCalled();
  });

  it('returns 503 when required env vars are missing in staging', async () => {
    process.env.NODE_ENV = 'staging';
    delete process.env.HEATPUMP_HISTORY_URL;
    delete process.env.HEATPUMP_HISTORY_API_KEY;
    getHeatPumpHistoryConfigMock.mockImplementation(buildConfig);
    mockDb();

    const res = await request(app)
      .post('/heat-pump-history')
      .set('Authorization', `Bearer ${token}`)
      .send(requestBody)
      .expect(503);

    expect(res.body).toEqual({
      error: 'heat_pump_history_disabled',
      message: 'Heat pump history is disabled until required env vars are set',
    });
    expect(fetchHeatPumpHistoryMock).not.toHaveBeenCalled();
  });
});
