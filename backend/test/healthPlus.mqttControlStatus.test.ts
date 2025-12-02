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
  updated_at: new Date(),
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
  process.env.PUSH_HEALTHCHECK_ENABLED = 'false';
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

  queryMock.mockResolvedValue({ rows: [{ ok: 1 }], rowCount: 1 });
  getControlStatusMock.mockReturnValue(defaultControl);
  getMqttHealthMock.mockReturnValue(defaultMqtt);
  runPushHealthCheckMock.mockResolvedValue(defaultPushHealth);
  getSystemStatusMock.mockResolvedValue(baseSystemStatus());

  process.env.NODE_ENV = 'test';
  delete process.env.ALERT_WORKER_ENABLED;
  delete process.env.ALERT_WORKER_INTERVAL_SEC;
});

afterAll(() => {
  consoleErrorSpy.mockRestore();
});

describe('GET /health-plus mqtt/control status', () => {
  it('returns ok when mqtt and control are not configured', async () => {
    const res = await request(app).get('/health-plus').expect(200);

    expect(res.body.ok).toBe(true);
    expect(res.body.mqtt.configured).toBe(false);
    expect(res.body.mqtt.healthy).toBe(true);
    expect(res.body.control.configured).toBe(false);
    expect(res.body.control.healthy).toBe(true);
  });

  it('marks mqtt unhealthy when configured with stale ingest and recent error', async () => {
    getMqttHealthMock.mockReturnValue({
      ...defaultMqtt,
      configured: true,
    });
    const staleIngest = new Date(Date.now() - 10 * 60 * 1000);
    const recentError = new Date(Date.now() - 60 * 1000);
    getSystemStatusMock.mockResolvedValue({
      ...baseSystemStatus(),
      mqtt_last_ingest_at: staleIngest,
      mqtt_last_error_at: recentError,
      mqtt_last_error: 'ingest failed',
    });

    const res = await request(app).get('/health-plus').expect(200);

    expect(res.body.mqtt.configured).toBe(true);
    expect(res.body.mqtt.lastIngestAt).toBe(staleIngest.toISOString());
    expect(res.body.mqtt.lastErrorAt).toBe(recentError.toISOString());
    expect(res.body.mqtt.lastError).toBe('ingest failed');
    expect(res.body.mqtt.healthy).toBe(false);
    expect(res.body.ok).toBe(false);
  });

  it('shows mqtt healthy when ingest is recent and no recent error', async () => {
    getMqttHealthMock.mockReturnValue({
      ...defaultMqtt,
      configured: true,
    });
    const recentIngest = new Date(Date.now() - 60 * 1000);
    getSystemStatusMock.mockResolvedValue({
      ...baseSystemStatus(),
      mqtt_last_ingest_at: recentIngest,
    });

    const res = await request(app).get('/health-plus').expect(200);

    expect(res.body.mqtt.configured).toBe(true);
    expect(res.body.mqtt.lastIngestAt).toBe(recentIngest.toISOString());
    expect(res.body.mqtt.healthy).toBe(true);
    expect(res.body.ok).toBe(true);
  });

  it('marks control unhealthy when configured with a recent error and no successes', async () => {
    getControlStatusMock.mockReturnValue({
      ...defaultControl,
      configured: true,
    });
    const recentError = new Date(Date.now() - 2 * 60 * 1000);
    getSystemStatusMock.mockResolvedValue({
      ...baseSystemStatus(),
      control_last_error_at: recentError,
      control_last_error: 'command failed',
    });

    const res = await request(app).get('/health-plus').expect(200);

    expect(res.body.control.configured).toBe(true);
    expect(res.body.control.lastErrorAt).toBe(recentError.toISOString());
    expect(res.body.control.lastError).toBe('command failed');
    expect(res.body.control.healthy).toBe(false);
    expect(res.body.ok).toBe(false);
  });

  it('tracks alerts worker heartbeat freshness when expected in production', async () => {
    process.env.NODE_ENV = 'production';
    process.env.ALERT_WORKER_ENABLED = 'true';
    process.env.ALERT_WORKER_INTERVAL_SEC = '60';

    const freshHeartbeat = new Date(Date.now() - 30 * 1000);
    getSystemStatusMock.mockResolvedValue({
      ...baseSystemStatus(),
      alerts_worker_last_heartbeat_at: freshHeartbeat,
    });

    const fresh = await request(app).get('/health-plus').expect(200);
    expect(fresh.body.alertsWorker.healthy).toBe(true);
    expect(fresh.body.ok).toBe(true);

    const staleHeartbeat = new Date(Date.now() - 5 * 60 * 1000);
    getSystemStatusMock.mockResolvedValue({
      ...baseSystemStatus(),
      alerts_worker_last_heartbeat_at: staleHeartbeat,
    });

    const stale = await request(app).get('/health-plus').expect(200);
    expect(stale.body.alertsWorker.healthy).toBe(false);
    expect(stale.body.ok).toBe(false);
  });
});
