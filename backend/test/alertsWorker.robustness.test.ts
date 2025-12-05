import { beforeEach, describe, expect, it, vi } from 'vitest';

const findOfflineDevicesMock = vi.fn();
const findOnlineDevicesMock = vi.fn();
const getDeviceSnapshotTemperaturesMock = vi.fn();
const upsertActiveAlertMock = vi.fn();
const clearAlertIfExistsMock = vi.fn();
const sendAlertNotificationMock = vi.fn();
const markAlertsWorkerHeartbeatMock = vi.fn();
const upsertStatusMock = vi.fn();
const loggerInfoMock = vi.fn();
const loggerWarnMock = vi.fn();
const loggerErrorMock = vi.fn();

vi.mock('../src/repositories/devicesRepository', () => ({
  findOfflineDevices: (...args: unknown[]) => findOfflineDevicesMock(...args),
  findOnlineDevices: (...args: unknown[]) => findOnlineDevicesMock(...args),
  getDeviceSnapshotTemperatures: (...args: unknown[]) => getDeviceSnapshotTemperaturesMock(...args),
}));

vi.mock('../src/services/alertService', () => ({
  upsertActiveAlert: (...args: unknown[]) => upsertActiveAlertMock(...args),
  clearAlertIfExists: (...args: unknown[]) => clearAlertIfExistsMock(...args),
}));

vi.mock('../src/services/pushService', () => ({
  sendAlertNotification: (...args: unknown[]) => sendAlertNotificationMock(...args),
}));

vi.mock('../src/services/statusService', () => ({
  markAlertsWorkerHeartbeat: (...args: unknown[]) => markAlertsWorkerHeartbeatMock(...args),
  upsertStatus: (...args: unknown[]) => upsertStatusMock(...args),
}));

vi.mock('../src/config/logger', () => ({
  logger: {
    child: () => ({
      info: (...args: unknown[]) => loggerInfoMock(...args),
      warn: (...args: unknown[]) => loggerWarnMock(...args),
      error: (...args: unknown[]) => loggerErrorMock(...args),
    }),
  },
}));

let runOnce: typeof import('../src/workers/alertsWorker').runOnce;
let getAlertsWorkerState: typeof import('../src/workers/alertsWorker').getAlertsWorkerState;

beforeEach(async () => {
  vi.resetModules();
  findOfflineDevicesMock.mockReset();
  findOnlineDevicesMock.mockReset();
  getDeviceSnapshotTemperaturesMock.mockReset();
  upsertActiveAlertMock.mockReset();
  clearAlertIfExistsMock.mockReset();
  sendAlertNotificationMock.mockReset();
  markAlertsWorkerHeartbeatMock.mockReset();
  upsertStatusMock.mockReset();
  loggerInfoMock.mockReset();
  loggerWarnMock.mockReset();
  loggerErrorMock.mockReset();

  const mod = await import('../src/workers/alertsWorker');
  runOnce = mod.runOnce;
  getAlertsWorkerState = mod.getAlertsWorkerState;
});

describe('alertsWorker robustness', () => {
  it('logs errors and resets inProgress when a cycle throws', async () => {
    findOfflineDevicesMock.mockRejectedValueOnce(new Error('db down'));
    findOnlineDevicesMock.mockResolvedValue([]);
    getDeviceSnapshotTemperaturesMock.mockResolvedValue([]);

    await runOnce(new Date('2025-01-01T00:00:00.000Z'));

    expect(loggerErrorMock).toHaveBeenCalledWith(
      { err: expect.anything() },
      'cycle failed'
    );
    expect(getAlertsWorkerState().inProgress).toBe(false);
  });
});
