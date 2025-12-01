import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const queryMock = vi.fn();
const upsertActiveAlertMock = vi.fn();
const clearAlertIfExistsMock = vi.fn();
const sendAlertNotificationMock = vi.fn();
const consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

vi.mock('../src/db/pool', () => ({
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

let evaluateOfflineAlerts: (now: Date) => Promise<{
  offlineCount: number;
  clearedCount: number;
  mutedCount: number;
}>;

beforeAll(async () => {
  const mod = await import('../src/workers/alertsWorker');
  evaluateOfflineAlerts = mod.evaluateOfflineAlerts;
});

beforeEach(() => {
  queryMock.mockReset();
  upsertActiveAlertMock.mockReset();
  clearAlertIfExistsMock.mockReset();
  sendAlertNotificationMock.mockReset();
  consoleLogSpy.mockClear();
});

describe('evaluateOfflineAlerts', () => {
  it('creates offline alerts and clears recovered devices', async () => {
    const now = new Date('2025-01-01T01:10:00.000Z');

    queryMock
      .mockResolvedValueOnce({
        rows: [
          {
            id: 'device-1',
            site_id: 'site-1',
            last_seen_at: new Date(now.getTime() - 70 * 60 * 1000),
            muted_until: null,
          },
        ],
        rowCount: 1,
      })
      .mockResolvedValueOnce({
        rows: [
          {
            id: 'device-2',
            site_id: 'site-2',
            last_seen_at: now,
          },
        ],
        rowCount: 1,
      });

    upsertActiveAlertMock.mockResolvedValueOnce({
      alert: {
        id: 'alert-1',
        site_id: 'site-1',
        device_id: 'device-1',
        severity: 'critical',
        type: 'offline',
        message: 'Offline for 60 minutes',
        status: 'active',
        first_seen_at: now.toISOString(),
        last_seen_at: now.toISOString(),
        acknowledged_by: null,
        acknowledged_at: null,
        muted_until: null,
      },
      isNew: true,
    });

    const result = await evaluateOfflineAlerts(now);

    expect(result).toEqual({ offlineCount: 1, clearedCount: 1, mutedCount: 0 });
    expect(upsertActiveAlertMock).toHaveBeenCalledWith({
      siteId: 'site-1',
      deviceId: 'device-1',
      type: 'offline',
      severity: 'critical',
      message: expect.stringContaining('offline'),
      now,
    });
    expect(clearAlertIfExistsMock).toHaveBeenCalledWith('device-2', 'offline', now);
    expect(sendAlertNotificationMock).toHaveBeenCalledTimes(1);
  });

  it('skips muted offline alerts inside the mute window', async () => {
    const now = new Date('2025-01-01T01:10:00.000Z');
    queryMock
      .mockResolvedValueOnce({
        rows: [
          {
            id: 'device-3',
            site_id: 'site-3',
            last_seen_at: new Date(now.getTime() - 90 * 60 * 1000),
            muted_until: new Date(now.getTime() + 15 * 60 * 1000),
          },
        ],
        rowCount: 1,
      })
      .mockResolvedValueOnce({ rows: [], rowCount: 0 });

    const result = await evaluateOfflineAlerts(now);

    expect(result).toEqual({ offlineCount: 1, clearedCount: 0, mutedCount: 1 });
    expect(upsertActiveAlertMock).not.toHaveBeenCalled();
    expect(sendAlertNotificationMock).not.toHaveBeenCalled();
  });
});

afterAll(() => {
  consoleLogSpy.mockRestore();
});
