import { beforeEach, describe, expect, it, vi } from 'vitest';

const getAllEnabledRulesMock = vi.fn();
const getDeviceLastSeenMock = vi.fn();
const getLatestTelemetryForMetricsMock = vi.fn();
const getTelemetryWindowBoundsMock = vi.fn();
const getScheduleContextForSiteMock = vi.fn();
const upsertActiveAlertMock = vi.fn();
const clearAlertIfExistsMock = vi.fn();
const getActiveAlertCountsForOrgMock = vi.fn();
const upsertStatusMock = vi.fn();
const markAlertsWorkerHeartbeatMock = vi.fn();
const sendAlertNotificationMock = vi.fn();

vi.mock('../src/repositories/alertRulesRepository', () => ({
  getAllEnabledRules: (...args: unknown[]) => getAllEnabledRulesMock(...(args as [any])),
}));

vi.mock('../src/repositories/devicesRepository', () => ({
  getDeviceLastSeen: (...args: unknown[]) => getDeviceLastSeenMock(...(args as [any])),
  findOfflineDevices: () => Promise.resolve([]),
  findOnlineDevices: () => Promise.resolve([]),
  getDeviceSnapshotTemperatures: () => Promise.resolve([]),
}));

vi.mock('../src/repositories/telemetryRepository', () => ({
  getLatestTelemetryForMetrics: (...args: unknown[]) =>
    getLatestTelemetryForMetricsMock(...(args as [any])),
  getTelemetryWindowBounds: (...args: unknown[]) =>
    getTelemetryWindowBoundsMock(...(args as [any])),
}));

vi.mock('../src/services/siteScheduleService', () => ({
  getScheduleContextForSite: (...args: unknown[]) =>
    getScheduleContextForSiteMock(...(args as [any])),
}));

vi.mock('../src/services/alertService', () => ({
  upsertActiveAlert: (...args: unknown[]) => upsertActiveAlertMock(...(args as [any])),
  clearAlertIfExists: (...args: unknown[]) => clearAlertIfExistsMock(...(args as [any])),
  getActiveAlertCountsForOrg: (...args: unknown[]) =>
    getActiveAlertCountsForOrgMock(...(args as [any])),
}));

vi.mock('../src/services/statusService', () => ({
  upsertStatus: (...args: unknown[]) => upsertStatusMock(...(args as [any])),
  markAlertsWorkerHeartbeat: (...args: unknown[]) =>
    markAlertsWorkerHeartbeatMock(...(args as [any])),
}));

vi.mock('../src/services/pushService', () => ({
  sendAlertNotification: (...args: unknown[]) => sendAlertNotificationMock(...(args as [any])),
}));

vi.mock('../src/config/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    child: () => ({
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      child: vi.fn(),
    }),
  },
}));

const baseRule = {
  org_id: 'org-1',
  threshold: null,
  roc_window_sec: null,
  offline_grace_sec: null,
  enabled: true,
  snooze_default_sec: null,
  name: null,
  description: null,
  created_at: '2025-01-01T00:00:00.000Z',
  updated_at: '2025-01-01T00:00:00.000Z',
} as const;

describe('alerts worker rule evaluation', () => {
  beforeEach(() => {
    vi.resetModules();
    getAllEnabledRulesMock.mockReset();
    getDeviceLastSeenMock.mockReset();
    getLatestTelemetryForMetricsMock.mockReset();
    getTelemetryWindowBoundsMock.mockReset();
    getScheduleContextForSiteMock.mockReset();
    upsertActiveAlertMock.mockReset();
    clearAlertIfExistsMock.mockReset();
    getActiveAlertCountsForOrgMock.mockReset();
    upsertStatusMock.mockReset();
    markAlertsWorkerHeartbeatMock.mockReset();
    sendAlertNotificationMock.mockReset();

    getActiveAlertCountsForOrgMock.mockResolvedValue({ warning: 2, critical: 1 });
    getScheduleContextForSiteMock.mockImplementation(async (siteId: string) =>
      siteId === 'site-loadshed'
        ? { isLoadShedding: true, isTouPeak: false }
        : { isLoadShedding: false, isTouPeak: false }
    );
  });

  it('evaluates threshold, roc, and offline rules and records alerts engine metrics', async () => {
    const now = new Date('2025-01-01T00:10:00.000Z');
    getAllEnabledRulesMock.mockResolvedValue([
      {
        ...baseRule,
        id: 'rule-threshold',
        site_id: 'site-1',
        device_id: 'dev-1',
        metric: 'supply_temp',
        rule_type: 'threshold_above',
        threshold: 55,
        severity: 'warning',
      },
      {
        ...baseRule,
        id: 'rule-roc',
        site_id: 'site-1',
        device_id: 'dev-1',
        metric: 'supply_temp',
        rule_type: 'rate_of_change',
        threshold: 5,
        roc_window_sec: 600,
        severity: 'critical',
      },
      {
        ...baseRule,
        id: 'rule-offline',
        site_id: 'site-2',
        device_id: null,
        metric: 'connectivity',
        rule_type: 'offline_window',
        offline_grace_sec: 300,
        severity: 'critical',
      },
      {
        ...baseRule,
        id: 'rule-loadshed',
        site_id: 'site-loadshed',
        device_id: 'dev-loadshed',
        metric: 'supply_temp',
        rule_type: 'threshold_above',
        threshold: 50,
        severity: 'critical',
      },
    ]);

    getDeviceLastSeenMock.mockResolvedValue([
      { id: 'dev-1', site_id: 'site-1', last_seen_at: now, data: {} },
      { id: 'dev-2', site_id: 'site-2', last_seen_at: new Date(now.getTime() - 20 * 60_000), data: {} },
      { id: 'dev-loadshed', site_id: 'site-loadshed', last_seen_at: now, data: {} },
    ]);

    getLatestTelemetryForMetricsMock.mockResolvedValue([
      { device_id: 'dev-1', metric: 'supply_temp', value: 60, ts: now },
      { device_id: 'dev-loadshed', metric: 'supply_temp', value: 55, ts: now },
    ]);

    getTelemetryWindowBoundsMock.mockResolvedValue({
      first: { value: 10, ts: new Date(now.getTime() - 10 * 60_000) },
      last: { value: 18, ts: now },
    });

    const mod = await import('../src/workers/alertsWorker');
    await mod.runOnce(now);

    expect(upsertActiveAlertMock).toHaveBeenCalledWith(
      expect.objectContaining({
        ruleId: 'rule-threshold',
        deviceId: 'dev-1',
        severity: 'warning',
        type: 'rule',
      })
    );
    expect(upsertActiveAlertMock).toHaveBeenCalledWith(
      expect.objectContaining({
        ruleId: 'rule-roc',
        deviceId: 'dev-1',
        severity: 'critical',
      })
    );
    expect(upsertActiveAlertMock).toHaveBeenCalledWith(
      expect.objectContaining({
        ruleId: 'rule-offline',
        deviceId: 'dev-2',
        severity: 'critical',
      })
    );
    expect(upsertActiveAlertMock).toHaveBeenCalledWith(
      expect.objectContaining({
        ruleId: 'rule-loadshed',
        deviceId: 'dev-loadshed',
        severity: 'warning',
      })
    );

    const alertsEngineCall = upsertStatusMock.mock.calls.find(([key]) => key === 'alerts_engine');
    expect(alertsEngineCall?.[1]).toMatchObject({
      lastRunAt: now.toISOString(),
      rulesLoaded: 4,
      activeAlertsTotal: 3,
      activeCounts: expect.objectContaining({
        warning: 2,
        critical: 1,
        total: 3,
      }),
    });
    expect(markAlertsWorkerHeartbeatMock).toHaveBeenCalledWith(now);
  });
});
