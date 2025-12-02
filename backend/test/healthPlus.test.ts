import request from 'supertest';
import type { Express } from 'express';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const queryMock = vi.fn();
const getControlStatusMock = vi.fn();
const getMqttHealthMock = vi.fn();
const runPushHealthCheckMock = vi.fn();
const getStatusMock = vi.fn();
const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

vi.mock('../src/db/pool', () => ({
  query: (...args: unknown[]) => queryMock(...(args as [string, unknown[]?])),
}));
vi.mock('../src/services/deviceControlService', () => ({
  getControlChannelStatus: (...args: unknown[]) => getControlStatusMock(...args),
}));
vi.mock('../src/services/mqttClient', () => ({
  getMqttHealth: (...args: unknown[]) => getMqttHealthMock(...args),
}));
vi.mock('../src/services/pushService', () => ({
  runPushHealthCheck: (...args: unknown[]) => runPushHealthCheckMock(...args),
}));
vi.mock('../src/services/statusService', () => ({
  getStatus: (...args: unknown[]) => getStatusMock(...(args as [string])),
}));

let app: Express;
const defaultControl = {
  configured: false,
  type: null,
  target: null,
  lastCommandAt: null,
  lastError: 'CONTROL_CHANNEL_UNCONFIGURED',
};
const defaultMqtt = {
  configured: false,
  connected: false,
  broker: null,
  lastMessageAt: null,
  lastConnectAt: null,
  lastDisconnectAt: null,
  lastError: null,
};
const defaultPush = { configured: false, tokensPresent: false, lastSample: null };

beforeAll(async () => {
  process.env.NODE_ENV = 'test';
  process.env.APP_VERSION = 'test-version';
  const mod = await import('../src/index');
  app = mod.default;
});

beforeEach(() => {
  queryMock.mockReset();
  consoleErrorSpy.mockClear();
  getControlStatusMock.mockReset();
  getMqttHealthMock.mockReset();
  runPushHealthCheckMock.mockReset();
  getStatusMock.mockReset();

  getControlStatusMock.mockReturnValue(defaultControl);
  getMqttHealthMock.mockReturnValue(defaultMqtt);
  runPushHealthCheckMock.mockResolvedValue(defaultPush);
  getStatusMock.mockResolvedValue(null);
});

describe('GET /health-plus', () => {
  it('returns ok with version and db ok when query succeeds', async () => {
    queryMock.mockResolvedValueOnce({ rows: [{ ok: 1 }], rowCount: 1 });
    getStatusMock.mockResolvedValueOnce({
      payload: {
        last_run_at: '2025-01-01T00:00:00.000Z',
        offline: { offlineCount: 0, clearedCount: 0, mutedCount: 0 },
        high_temp: { evaluatedCount: 0, overThresholdCount: 0 },
      },
      updated_at: new Date('2025-01-01T00:00:00.000Z'),
    });

    const res = await request(app).get('/health-plus').expect(200);

    expect(queryMock).toHaveBeenCalledTimes(1);
    expect(res.body).toEqual({
      ok: true,
      env: process.env.NODE_ENV,
      db: 'ok',
      version: 'test-version',
      mqtt: defaultMqtt,
      control: defaultControl,
      alertsWorker: {
        last_run_at: '2025-01-01T00:00:00.000Z',
        offline: { offlineCount: 0, clearedCount: 0, mutedCount: 0 },
        high_temp: { evaluatedCount: 0, overThresholdCount: 0 },
        updated_at: '2025-01-01T00:00:00.000Z',
      },
      push: defaultPush,
    });
  });

  it('returns error when db query throws', async () => {
    queryMock.mockRejectedValueOnce(new Error('db down'));

    const res = await request(app).get('/health-plus').expect(500);

    expect(queryMock).toHaveBeenCalledTimes(1);
    expect(consoleErrorSpy).toHaveBeenCalledWith('health-plus error', expect.any(Error));
    expect(res.body).toEqual({
      ok: false,
      env: process.env.NODE_ENV,
      db: 'error',
      version: 'test-version',
      mqtt: defaultMqtt,
      control: defaultControl,
      alertsWorker: { last_run_at: null },
      push: defaultPush,
    });
  });

  it('recovers after a transient db failure', async () => {
    queryMock
      .mockRejectedValueOnce(new Error('connection lost'))
      .mockResolvedValueOnce({ rows: [{ ok: 1 }], rowCount: 1 });

    const first = await request(app).get('/health-plus').expect(500);
    expect(first.body.ok).toBe(false);

    const second = await request(app).get('/health-plus').expect(200);
    expect(second.body).toEqual({
      ok: true,
      env: process.env.NODE_ENV,
      db: 'ok',
      version: 'test-version',
      mqtt: defaultMqtt,
      control: defaultControl,
      alertsWorker: { last_run_at: null },
      push: defaultPush,
    });
  });
});

afterAll(() => {
  consoleErrorSpy.mockRestore();
});
