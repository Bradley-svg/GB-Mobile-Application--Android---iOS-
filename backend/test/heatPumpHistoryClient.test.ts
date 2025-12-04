import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { HeatPumpHistoryRequest } from '../src/integrations/heatPumpHistoryClient';

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
  it('sends the vendor/Azure payload shape (aggregation as string at the top level)', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      statusText: 'OK',
      text: vi.fn().mockResolvedValue('{}'),
    });

    await fetchHeatPumpHistory(baseRequest);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, options] = fetchMock.mock.calls[0] as [string, any];
    expect(url).toBe(process.env.HEATPUMP_HISTORY_URL);
    expect(options.method).toBe('POST');
    expect(options.headers).toMatchObject({
      accept: 'application/json,text/plain',
      'content-type': 'application/json-patch+json',
      'x-api-key': 'test-key',
    });
    expect(JSON.parse(options.body)).toEqual(baseRequest);
  });

  it('normalizes the Azure series shape into HeatPumpHistoryResponse', async () => {
    const upstream = {
      series: [
        {
          name: 'Current',
          yAxis: 0,
          unit: 'A',
          decimals: 1,
          propertyName: '',
          data: [
            [1764749601000.0, 0.0],
            ['2025-12-03T08:12:46.503Z', '12.3'],
            { timestamp: '2025-12-03T09:00:00.000Z', value: null },
          ],
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

    expect(result).toEqual({
      series: [
        {
          field: 'Current',
          points: [
            { timestamp: new Date(1764749601000).toISOString(), value: 0 },
            { timestamp: '2025-12-03T08:12:46.503Z', value: 12.3 },
            { timestamp: '2025-12-03T09:00:00.000Z', value: null },
          ],
        },
      ],
    });
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
