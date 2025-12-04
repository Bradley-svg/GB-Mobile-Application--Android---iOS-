import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const queryMock = vi.fn();
const upsertActiveAlertMock = vi.fn();
const clearAlertIfExistsMock = vi.fn();
const sendAlertNotificationMock = vi.fn();
const consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

vi.mock('../src/config/db', () => ({
  query: (...args: unknown[]) => queryMock(...(args as [string, unknown[]?])),
}));

vi.mock('../src/services/alertService', () => ({
  upsertActiveAlert: (...args: unknown[]) => upsertActiveAlertMock(...(args as [any])),
  clearAlertIfExists: (...args: unknown[]) => clearAlertIfExistsMock(...(args as [any])),
}));

vi.mock('../src/services/pushService', () => ({
  sendAlertNotification: (...args: unknown[]) =>
    sendAlertNotificationMock(...(args as [any])),
}));

let evaluateHighTempAlerts: (now: Date) => Promise<{
  evaluatedCount: number;
  overThresholdCount: number;
}>;

beforeAll(async () => {
  const mod = await import('../src/workers/alertsWorker');
  evaluateHighTempAlerts = mod.evaluateHighTempAlerts;
});

beforeEach(() => {
  queryMock.mockReset();
  upsertActiveAlertMock.mockReset();
  clearAlertIfExistsMock.mockReset();
  sendAlertNotificationMock.mockReset();
  consoleLogSpy.mockClear();
});

describe('evaluateHighTempAlerts', () => {
  it('queries supply temp from metrics with a fallback to raw sensor payload', async () => {
    queryMock.mockResolvedValueOnce({ rows: [], rowCount: 0 });

    await evaluateHighTempAlerts(new Date('2025-01-01T00:00:00.000Z'));

    expect(queryMock).toHaveBeenCalledTimes(1);
    expect(queryMock.mock.calls[0][0]).toContain("s.data->'raw'->'sensor'->>'supply_temperature_c'");
  });

  it('creates or updates a critical alert when supply temp exceeds the threshold', async () => {
    const now = new Date('2025-01-01T00:00:00.000Z');

    queryMock.mockResolvedValueOnce({
      rows: [{ id: 'device-1', site_id: 'site-1', supply_temp: 75.2 }],
      rowCount: 1,
    });

    upsertActiveAlertMock.mockResolvedValueOnce({
      alert: {
        id: 'alert-1',
        site_id: 'site-1',
        device_id: 'device-1',
        severity: 'critical',
        type: 'high_temp',
        message: 'Supply temperature high',
        status: 'active',
        first_seen_at: now.toISOString(),
        last_seen_at: now.toISOString(),
        acknowledged_by: null,
        acknowledged_at: null,
        muted_until: null,
      },
      isNew: true,
    });

    await evaluateHighTempAlerts(now);

    expect(upsertActiveAlertMock).toHaveBeenCalledWith({
      siteId: 'site-1',
      deviceId: 'device-1',
      type: 'high_temp',
      severity: 'critical',
      message: expect.stringContaining('Supply temperature high'),
      now,
    });
    expect(sendAlertNotificationMock).toHaveBeenCalledTimes(1);
    expect(clearAlertIfExistsMock).not.toHaveBeenCalled();
  });

  it('clears an active alert when supply temp is below the threshold', async () => {
    const now = new Date('2025-01-01T00:00:00.000Z');

    queryMock.mockResolvedValueOnce({
      rows: [{ id: 'device-2', site_id: 'site-2', supply_temp: 40 }],
      rowCount: 1,
    });

    await evaluateHighTempAlerts(now);

    expect(upsertActiveAlertMock).not.toHaveBeenCalled();
    expect(clearAlertIfExistsMock).toHaveBeenCalledWith('device-2', 'high_temp', now);
    expect(sendAlertNotificationMock).not.toHaveBeenCalled();
  });
});

afterAll(() => {
  consoleLogSpy.mockRestore();
});
