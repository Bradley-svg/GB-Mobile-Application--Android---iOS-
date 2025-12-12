import request from 'supertest';
import type { Express } from 'express';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { SystemStatus } from '../src/services/statusService';

const queryMock = vi.fn();
const getControlStatusMock = vi.fn();
const getMqttHealthMock = vi.fn();
const runPushHealthCheckMock = vi.fn();
const getSystemStatusMock = vi.fn();
const getSystemStatusByKeyMock = vi.fn();
const getVirusScannerStatusMock = vi.fn();
const loggerInfoSpy = vi.fn();
const loggerWarnSpy = vi.fn();
const loggerErrorSpy = vi.fn();
const loggerChildSpy = vi.fn(() => ({
  info: loggerInfoSpy,
  warn: loggerWarnSpy,
  error: loggerErrorSpy,
  child: loggerChildSpy,
}));
const verifyAccessTokenMock = vi.fn();
const getUserContextMock = vi.fn();
const getDemoStatusForOrgMock = vi.fn();

vi.mock('../src/config/db', () => ({
  query: (...args: unknown[]) => queryMock(...(args as [string, unknown[]?])),
}));
vi.mock('../src/config/logger', () => ({
  logger: {
    info: loggerInfoSpy,
    warn: loggerWarnSpy,
    error: loggerErrorSpy,
    child: loggerChildSpy,
  },
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
  getSystemStatusByKey: (...args: unknown[]) => getSystemStatusByKeyMock(...args),
}));
vi.mock('../src/services/virusScanner', () => ({
  getVirusScannerStatus: (...args: unknown[]) => getVirusScannerStatusMock(...args),
}));
vi.mock('../src/services/authService', () => ({
  verifyAccessToken: (...args: unknown[]) => verifyAccessTokenMock(...(args as [string])),
}));
vi.mock('../src/services/userService', () => ({
  getUserContext: (...args: unknown[]) => getUserContextMock(...(args as [string])),
  requireOrganisationId: (user: { organisation_id: string | null }) => {
    if (!user.organisation_id) throw new Error('USER_ORG_MISSING');
    return user.organisation_id;
  },
}));
vi.mock('../src/services/demoService', () => ({
  getDemoStatusForOrg: (...args: unknown[]) => getDemoStatusForOrgMock(...(args as [string])),
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
const defaultPerfRow = {
  open_count: '0',
  overdue_count: '0',
  device_count: '0',
  alert_count: '0',
  work_order_count: '0',
  slow_query_count: null,
};
const defaultQueryResponse = async (sql: string) => {
  const normalized = sql.toLowerCase();
  if (normalized.includes('select 1 as ok')) {
    return { rows: [{ ok: 1 }], rowCount: 1 };
  }
  if (normalized.includes('open_count') || normalized.includes('work_order_count')) {
    return { rows: [defaultPerfRow], rowCount: 1 };
  }
  return { rows: [], rowCount: 0 };
};

beforeAll(async () => {
  process.env.NODE_ENV = 'test';
  process.env.APP_VERSION = 'test-version';
  const mod = await import('../src/index');
  app = mod.default;
});

beforeEach(() => {
  queryMock.mockReset();
  queryMock.mockImplementation(defaultQueryResponse);
  loggerInfoSpy.mockClear();
  loggerWarnSpy.mockClear();
  loggerErrorSpy.mockClear();
  loggerChildSpy.mockClear();
  getControlStatusMock.mockReset();
  getMqttHealthMock.mockReset();
  runPushHealthCheckMock.mockReset();
  getSystemStatusMock.mockReset();
  getSystemStatusByKeyMock.mockReset();
  getVirusScannerStatusMock.mockReset();
  verifyAccessTokenMock.mockReset();
  getUserContextMock.mockReset();
  getDemoStatusForOrgMock.mockReset();
  delete process.env.HEATPUMP_HISTORY_URL;
  delete process.env.HEAT_PUMP_HISTORY_URL;
  delete process.env.HEATPUMP_HISTORY_API_KEY;
  delete process.env.HEAT_PUMP_HISTORY_API_KEY;
  delete process.env.MQTT_DISABLED;
  delete process.env.CONTROL_API_DISABLED;
  delete process.env.HEATPUMP_HISTORY_DISABLED;
  delete process.env.PUSH_NOTIFICATIONS_DISABLED;

  getControlStatusMock.mockReturnValue(defaultControl);
  getMqttHealthMock.mockReturnValue(defaultMqtt);
  runPushHealthCheckMock.mockResolvedValue(defaultPushHealth);
  getSystemStatusMock.mockResolvedValue(baseSystemStatus());
  getSystemStatusByKeyMock.mockResolvedValue(baseSystemStatus());
  getVirusScannerStatusMock.mockReturnValue({
    configured: false,
    enabled: false,
    target: null,
    lastRunAt: null,
    lastResult: null,
    lastError: null,
  });
  verifyAccessTokenMock.mockImplementation(() => {
    throw new Error('NO_TOKEN');
  });
  getUserContextMock.mockResolvedValue(null);
  getDemoStatusForOrgMock.mockResolvedValue({
    isDemoOrg: false,
    heroDeviceId: null,
    heroDeviceMac: null,
    seededAt: null,
  });
});

describe('GET /health-plus (baseline)', () => {
  it('returns ok with version and db ok when query succeeds', async () => {
    queryMock
      .mockResolvedValueOnce({ rows: [{ ok: 1 }], rowCount: 1 })
      .mockResolvedValueOnce({
        rows: [
          {
            open_count: '5',
            overdue_count: '2',
            device_count: '10',
            alert_count: '30',
            work_order_count: '6',
            slow_query_count: '1',
          },
        ],
        rowCount: 1,
      });

    const res = await request(app).get('/health-plus').expect(200);

    expect(res.body).toMatchObject({
      ok: true,
      env: process.env.NODE_ENV,
      db: 'ok',
      dbLatencyMs: expect.any(Number),
      version: 'test-version',
      vendorFlags: {
        prodLike: false,
        disabled: [],
        mqttDisabled: false,
        controlDisabled: false,
        heatPumpHistoryDisabled: false,
        pushNotificationsDisabled: false,
      },
      mqtt: {
        configured: false,
        disabled: false,
        lastIngestAt: null,
        lastErrorAt: null,
        lastError: null,
        healthy: true,
      },
      control: {
        configured: false,
        disabled: false,
        lastCommandAt: null,
        lastErrorAt: null,
        lastError: null,
        healthy: true,
      },
      heatPumpHistory: {
        configured: false,
        disabled: false,
        lastSuccessAt: null,
        lastErrorAt: null,
        lastError: null,
        lastCheckAt: null,
        healthy: true,
      },
      alertsWorker: {
        lastHeartbeatAt: null,
        healthy: true,
      },
      push: {
        enabled: false,
        disabled: false,
        lastSampleAt: null,
        lastError: null,
      },
      antivirus: {
        configured: false,
        enabled: false,
        target: null,
        lastRunAt: null,
        lastResult: null,
        lastError: null,
        latencyMs: null,
      },
      storage: {
        root: expect.any(String),
        writable: expect.any(Boolean),
        latencyMs: expect.any(Number),
      },
      maintenance: {
        openCount: 5,
        overdueCount: 2,
        lastCalcAt: expect.any(String),
      },
      perfHints: {
        deviceCount: 10,
        alertCount: 30,
        workOrderCount: 6,
        avgAlertsPerDevice: 3,
        avgWorkOrdersPerDevice: 0.6,
        slowQueriesLastHour: 1,
      },
      alertsEngine: {
        lastRunAt: null,
        lastDurationMs: null,
        rulesLoaded: null,
        activeAlertsTotal: null,
        activeWarning: null,
        activeCritical: null,
        activeInfo: null,
        evaluated: null,
        triggered: null,
      },
    });
  });

  it('returns error when db query throws', async () => {
    queryMock.mockRejectedValueOnce(new Error('db down'));

    const res = await request(app).get('/health-plus').expect(500);

    expect(loggerErrorSpy).toHaveBeenCalledWith(
      { module: 'health', err: expect.any(Error) },
      'health-plus error'
    );
    expect(res.body).toMatchObject({
      ok: false,
      env: process.env.NODE_ENV,
      db: 'error',
      dbLatencyMs: expect.any(Number),
      version: 'test-version',
      vendorFlags: {
        prodLike: false,
        disabled: [],
        mqttDisabled: false,
        controlDisabled: false,
        heatPumpHistoryDisabled: false,
        pushNotificationsDisabled: false,
      },
      mqtt: {
        configured: false,
        disabled: false,
        lastIngestAt: null,
        lastErrorAt: null,
        lastError: null,
        healthy: true,
      },
      control: {
        configured: false,
        disabled: false,
        lastCommandAt: null,
        lastErrorAt: null,
        lastError: null,
        healthy: true,
      },
      heatPumpHistory: {
        configured: false,
        disabled: false,
        lastSuccessAt: null,
        lastErrorAt: null,
        lastError: null,
        lastCheckAt: null,
        healthy: true,
      },
      alertsWorker: {
        lastHeartbeatAt: null,
        healthy: false,
      },
      push: {
        enabled: false,
        disabled: false,
        lastSampleAt: null,
        lastError: null,
      },
      antivirus: {
        configured: false,
        enabled: false,
        target: null,
        lastRunAt: null,
        lastResult: null,
        lastError: null,
        latencyMs: null,
      },
      storage: {
        root: expect.any(String),
        writable: expect.any(Boolean),
        latencyMs: null,
      },
      maintenance: {
        openCount: 0,
        overdueCount: 0,
        lastCalcAt: null,
      },
      alertsEngine: {
        lastRunAt: null,
        lastDurationMs: null,
        rulesLoaded: null,
        activeAlertsTotal: null,
        activeWarning: null,
        activeCritical: null,
        activeInfo: null,
        evaluated: null,
        triggered: null,
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

describe('GET /health-plus heat pump history', () => {
  it('marks heat pump history healthy when configured with a recent success', async () => {
    process.env.HEATPUMP_HISTORY_URL = 'https://example.com/history';
    process.env.HEATPUMP_HISTORY_API_KEY = 'test-key';
    const recentSuccess = new Date(Date.now() - 10 * 60 * 1000);
    queryMock.mockResolvedValueOnce({ rows: [{ ok: 1 }], rowCount: 1 });
    getSystemStatusMock.mockResolvedValue({
      ...baseSystemStatus(),
      heat_pump_history_last_success_at: recentSuccess,
    });

    const res = await request(app).get('/health-plus').expect(200);

    expect(res.body.heatPumpHistory.configured).toBe(true);
    expect(res.body.heatPumpHistory.disabled).toBe(false);
    expect(res.body.heatPumpHistory.lastSuccessAt).toBe(recentSuccess.toISOString());
    expect(res.body.heatPumpHistory.lastCheckAt).toBe(recentSuccess.toISOString());
    expect(res.body.heatPumpHistory.healthy).toBe(true);
    expect(res.body.ok).toBe(true);
  });

  it('marks heat pump history unhealthy when recent errors outnumber stale successes', async () => {
    process.env.HEATPUMP_HISTORY_URL = 'https://example.com/history';
    process.env.HEATPUMP_HISTORY_API_KEY = 'test-key';
    const staleSuccess = new Date(Date.now() - 7 * 60 * 60 * 1000);
    const recentError = new Date(Date.now() - 30 * 60 * 1000);
    queryMock.mockResolvedValueOnce({ rows: [{ ok: 1 }], rowCount: 1 });
    getSystemStatusMock.mockResolvedValue({
      ...baseSystemStatus(),
      heat_pump_history_last_success_at: staleSuccess,
      heat_pump_history_last_error_at: recentError,
      heat_pump_history_last_error: 'timeout',
    });

    const res = await request(app).get('/health-plus').expect(200);

    expect(res.body.heatPumpHistory.configured).toBe(true);
    expect(res.body.heatPumpHistory.disabled).toBe(false);
    expect(res.body.heatPumpHistory.lastErrorAt).toBe(recentError.toISOString());
    expect(res.body.heatPumpHistory.lastCheckAt).toBe(recentError.toISOString());
    expect(res.body.heatPumpHistory.healthy).toBe(false);
    expect(res.body.ok).toBe(false);
  });
});

describe('GET /health-plus antivirus status', () => {
  it('includes antivirus block when configured and recently successful', async () => {
    queryMock.mockResolvedValueOnce({ rows: [{ ok: 1 }], rowCount: 1 });

    const lastRunAt = new Date().toISOString();
    getVirusScannerStatusMock.mockReturnValue({
      configured: true,
      enabled: true,
      target: 'command',
      lastRunAt,
      lastResult: 'clean',
      lastError: null,
    });

    const res = await request(app).get('/health-plus').expect(200);

    expect(res.body.antivirus).toMatchObject({
      configured: true,
      enabled: true,
      target: 'command',
      lastRunAt,
      lastResult: 'clean',
      lastError: null,
      latencyMs: expect.any(Number),
    });
    expect(res.body.ok).toBe(true);
  });

  it('marks ok false when antivirus is configured but failing', async () => {
    queryMock.mockResolvedValueOnce({ rows: [{ ok: 1 }], rowCount: 1 });

    const lastRunAt = new Date().toISOString();
    getVirusScannerStatusMock.mockReturnValue({
      configured: true,
      enabled: true,
      target: 'command',
      lastRunAt,
      lastResult: 'scan_failed',
      lastError: 'timeout',
    });

    const res = await request(app).get('/health-plus').expect(200);

    expect(res.body.antivirus).toMatchObject({
      configured: true,
      enabled: true,
      target: 'command',
      lastRunAt,
      lastResult: 'scan_failed',
      lastError: 'timeout',
      latencyMs: expect.any(Number),
    });
    expect(res.body.ok).toBe(false);
  });
});

describe('GET /health-plus demo metadata', () => {
  it('includes demo block when the caller belongs to a demo org', async () => {
    verifyAccessTokenMock.mockReturnValue({ userId: 'user-demo', role: 'admin' });
    getUserContextMock.mockResolvedValue({
      id: 'user-demo',
      email: 'demo@example.com',
      name: 'Demo User',
      organisation_id: 'org-demo',
      role: 'admin',
    });
    getDemoStatusForOrgMock.mockResolvedValue({
      isDemoOrg: true,
      heroDeviceId: 'device-hero',
      heroDeviceMac: 'AA:BB:CC:DD:EE:FF',
      seededAt: new Date('2025-01-02T00:00:00.000Z'),
    });

    const res = await request(app)
      .get('/health-plus')
      .set('Authorization', 'Bearer demo-token')
      .expect(200);

    expect(getDemoStatusForOrgMock).toHaveBeenCalledWith('org-demo');
    expect(res.body.demo).toEqual({
      isDemoOrg: true,
      heroDeviceId: 'device-hero',
      heroDeviceMac: 'AA:BB:CC:DD:EE:FF',
      seededAt: '2025-01-02T00:00:00.000Z',
    });
  });
});
