import request from 'supertest';
import type { Express } from 'express';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { SystemStatus } from '../src/services/statusService';

const queryMock = vi.fn();
const getControlStatusMock = vi.fn();
const getMqttHealthMock = vi.fn();
const runPushHealthCheckMock = vi.fn();
const getSystemStatusMock = vi.fn();
const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

vi.mock('../src/config/db', () => ({
  query: (...args: unknown[]) => queryMock(...(args as [string, unknown[]?])),
}));
vi.mock('../src/services/deviceControlService', () => ({
  getControlChannelStatus: (...args: unknown[]) => getControlStatusMock(...args),
}));
vi.mock('../src/integrations/mqttClient', () => ({
  getMqttHealth: (...args: unknown[]) => getMqttHealthMock(...args),
}));
vi.mock('../src/services/pushService', () => ({
  runPushHealthCheck: (...args: unknown[]) => runPushHealthCheckMock(...args),
}));
vi.mock('../src/services/statusService', () => ({
  getSystemStatus: (...args: unknown[]) => getSystemStatusMock(...args),
}));

let app: Express;
const baseSystemStatus = (): SystemStatus => ({
  key: 'global',
  payload: {},
  mqtt_last_ingest_at: null,
  mqtt_last_error_at: null,
  mqtt_last_error: null,
  control_last_command_at: null,
  control_last_error_at: null,
  control_last_error: null,
  alerts_worker_last_heartbeat_at: null,
  push_last_sample_at: null,
  push_last_error: null,
  heat_pump_history_last_success_at: null,
  heat_pump_history_last_error_at: null,
  heat_pump_history_last_error: null,
  updated_at: new Date('2025-01-01T00:00:00.000Z'),
});
const defaultControl = {
  configured: false,
  type: null,
  target: null,
  lastCommandAt: null,
  lastError: null,
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
const defaultPushHealth = { configured: false, tokensPresent: false, lastSample: null };

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
  getSystemStatusMock.mockReset();

  getControlStatusMock.mockReturnValue(defaultControl);
  getMqttHealthMock.mockReturnValue(defaultMqtt);
  runPushHealthCheckMock.mockResolvedValue(defaultPushHealth);
  getSystemStatusMock.mockResolvedValue(baseSystemStatus());
});

afterAll(() => {
  consoleErrorSpy.mockRestore();
});

describe('GET /health-plus (baseline)', () => {
  it('returns ok with version and db ok when query succeeds', async () => {
    queryMock.mockResolvedValueOnce({ rows: [{ ok: 1 }], rowCount: 1 });

    const res = await request(app).get('/health-plus').expect(200);

    expect(res.body).toEqual({
      ok: true,
      env: process.env.NODE_ENV,
      db: 'ok',
      version: 'test-version',
      mqtt: {
        configured: false,
        lastIngestAt: null,
        lastErrorAt: null,
        lastError: null,
        healthy: true,
      },
      control: {
        configured: false,
        lastCommandAt: null,
        lastErrorAt: null,
        lastError: null,
        healthy: true,
      },
      heatPumpHistory: {
        configured: false,
        lastSuccessAt: null,
        lastErrorAt: null,
        lastError: null,
        healthy: true,
      },
      alertsWorker: {
        lastHeartbeatAt: null,
        healthy: true,
      },
      push: {
        enabled: false,
        lastSampleAt: null,
        lastError: null,
      },
    });
  });

  it('returns error when db query throws', async () => {
    queryMock.mockRejectedValueOnce(new Error('db down'));

    const res = await request(app).get('/health-plus').expect(500);

    expect(consoleErrorSpy).toHaveBeenCalledWith('health-plus error', expect.any(Error));
    expect(res.body).toEqual({
      ok: false,
      env: process.env.NODE_ENV,
      db: 'error',
      version: 'test-version',
      mqtt: {
        configured: false,
        lastIngestAt: null,
        lastErrorAt: null,
        lastError: null,
        healthy: true,
      },
      control: {
        configured: false,
        lastCommandAt: null,
        lastErrorAt: null,
        lastError: null,
        healthy: true,
      },
      heatPumpHistory: {
        configured: false,
        lastSuccessAt: null,
        lastErrorAt: null,
        lastError: null,
        healthy: true,
      },
      alertsWorker: {
        lastHeartbeatAt: null,
        healthy: false,
      },
      push: {
        enabled: false,
        lastSampleAt: null,
        lastError: null,
      },
    });
  });

  it('recovers after a transient db failure', async () => {
    queryMock
      .mockRejectedValueOnce(new Error('connection lost'))
      .mockResolvedValueOnce({ rows: [{ ok: 1 }], rowCount: 1 });

    const first = await request(app).get('/health-plus').expect(500);
    expect(first.body.ok).toBe(false);

    const second = await request(app).get('/health-plus').expect(200);
    expect(second.body.ok).toBe(true);
  });
});
