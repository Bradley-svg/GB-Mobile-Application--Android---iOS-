import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type {
  HeatPumpHistoryRequest,
  HeatPumpHistoryResponse,
} from '../src/integrations/heatPumpHistoryClient';

const fetchMock = vi.fn();
const originalFetch = global.fetch;
const originalEnv = { ...process.env };

let fetchHeatPumpHistory: typeof import('../src/integrations/heatPumpHistoryClient').fetchHeatPumpHistory;

const baseRequest: HeatPumpHistoryRequest = {
  mac: '38:18:2B:60:A9:94',
  from: '2025-12-03T08:12:46.503Z',
  to: '2025-12-03T14:12:46.503Z',
  aggregation: 'raw',
  mode: 'live',
  fields: [{ field: 'metric_compCurrentA', unit: 'A', decimals: 1 }],
};

beforeAll(async () => {
  const mod = await import('../src/integrations/heatPumpHistoryClient');
  fetchHeatPumpHistory = mod.fetchHeatPumpHistory;
});

beforeEach(() => {
  process.env = { ...originalEnv };
  process.env.NODE_ENV = 'test';
  process.env.HEATPUMP_HISTORY_URL =
    'https://za-iot-dev-api.azurewebsites.net/api/HeatPumpHistory/historyHeatPump';
  process.env.HEATPUMP_HISTORY_API_KEY = 'test-key';
  fetchMock.mockReset();
  (global as any).fetch = fetchMock;
});

afterAll(() => {
  process.env = originalEnv;
  (global as any).fetch = originalFetch;
});

describe('heatPumpHistoryClient', () => {
  it('maps a successful response into HeatPumpHistoryResponse', async () => {
    const upstream: HeatPumpHistoryResponse = {
      series: [
        {
          field: 'metric_compCurrentA',
          points: [{ timestamp: '2025-12-03T08:12:46.503Z', value: 12.3 }],
        },
      ],
    };

    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      statusText: 'OK',
      text: vi.fn().mockResolvedValue(JSON.stringify(upstream)),
    });

    const result = await fetchHeatPumpHistory(baseRequest);

    expect(fetchMock).toHaveBeenCalledWith(
      process.env.HEATPUMP_HISTORY_URL,
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({ 'x-api-key': 'test-key' }),
      })
    );
    expect(result).toEqual(upstream);
  });

  it('throws a friendly error when the upstream responds with an error status', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 500,
      statusText: 'Server error',
      text: vi.fn().mockResolvedValue('boom'),
    });

    await expect(fetchHeatPumpHistory(baseRequest)).rejects.toThrow(
      'HEATPUMP_HISTORY_UPSTREAM_ERROR'
    );
  });

  it('throws a timeout error when the request is aborted', async () => {
    const abortError = new Error('Aborted');
    abortError.name = 'AbortError';
    fetchMock.mockRejectedValueOnce(abortError);

    await expect(fetchHeatPumpHistory(baseRequest)).rejects.toThrow('HEATPUMP_HISTORY_TIMEOUT');
  });

  it('throws a configuration error when API key is missing in production', async () => {
    process.env.NODE_ENV = 'production';
    delete process.env.HEATPUMP_HISTORY_API_KEY;

    await expect(fetchHeatPumpHistory(baseRequest)).rejects.toThrow(
      'HEATPUMP_HISTORY_API_KEY is required when NODE_ENV is not development'
    );
  });
});
