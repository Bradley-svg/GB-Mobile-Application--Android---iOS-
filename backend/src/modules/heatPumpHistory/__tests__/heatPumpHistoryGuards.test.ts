import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  HeatPumpHistoryFeatureDisabledError,
  HeatPumpHistoryValidationError,
  getHistoryForRequest,
} from '../../../services/heatPumpHistoryService';

const getHeatPumpHistoryConfigMock = vi.fn();
const fetchHeatPumpHistoryMock = vi.fn();
const getDeviceByIdMock = vi.fn();

vi.mock('../../../integrations/heatPumpHistoryClient', () => ({
  getHeatPumpHistoryConfig: (...args: unknown[]) => getHeatPumpHistoryConfigMock(...args),
  fetchHeatPumpHistory: (...args: unknown[]) => fetchHeatPumpHistoryMock(...args),
}));

vi.mock('../../../repositories/devicesRepository', () => ({
  getDeviceById: (...args: unknown[]) => getDeviceByIdMock(...args),
}));

const baseConfig = {
  url: 'https://example.com/history',
  apiKey: 'key',
  requestTimeoutMs: 1000,
  configured: true,
  missingKeys: [],
  nodeEnv: 'test',
  disabled: false,
};

const basePayload = {
  deviceId: 'device-1',
  from: '2025-12-03T08:12:46.503Z',
  to: '2025-12-03T10:12:46.503Z',
  aggregation: 'raw' as const,
  mode: 'live' as const,
  fields: [{ field: 'metric_compCurrentA' }],
};

beforeEach(() => {
  getHeatPumpHistoryConfigMock.mockReturnValue(baseConfig);
  fetchHeatPumpHistoryMock.mockResolvedValue({ ok: true, series: [] });
  getDeviceByIdMock.mockResolvedValue({
    id: 'device-1',
    site_id: 'site-1',
    name: 'Heat Pump',
    type: 'heat_pump',
    external_id: 'demo-device',
    mac: 'AA:BB:CC:DD:EE:FF',
    status: 'online',
    last_seen_at: null,
    controller: 'mqtt',
    firmware_version: null,
    connectivity_status: null,
  });
});

afterEach(() => {
  delete process.env.HEATPUMP_HISTORY_DISABLED;
  delete process.env.HEATPUMP_HISTORY_MAX_RANGE_HOURS;
  vi.clearAllMocks();
});

describe('heat pump history guards', () => {
  it('throws a feature disabled error when vendor access is disabled', async () => {
    getHeatPumpHistoryConfigMock.mockReturnValueOnce({ ...baseConfig, disabled: true });

    await expect(
      getHistoryForRequest({ userId: 'user-1', organisationId: 'org-1' }, basePayload)
    ).rejects.toBeInstanceOf(HeatPumpHistoryFeatureDisabledError);
    expect(fetchHeatPumpHistoryMock).not.toHaveBeenCalled();
  });

  it('rejects requests that exceed the configured time window', async () => {
    process.env.HEATPUMP_HISTORY_MAX_RANGE_HOURS = '1';
    const widePayload = {
      ...basePayload,
      from: '2025-12-03T00:00:00.000Z',
      to: '2025-12-03T03:00:00.000Z',
    };

    const error = await getHistoryForRequest(
      { userId: 'user-1', organisationId: 'org-1' },
      widePayload
    ).catch((err) => err);

    expect(error).toBeInstanceOf(HeatPumpHistoryValidationError);
    expect((error as Error).message).toMatch(/maximum of 1 hours/);
    expect(fetchHeatPumpHistoryMock).not.toHaveBeenCalled();
  });
});
