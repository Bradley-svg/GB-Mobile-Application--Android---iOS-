import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { HeatPumpHistoryRequest } from '../src/integrations/heatPumpHistoryClient';

const fetchMock = vi.fn();
const originalFetch = global.fetch;
const originalEnv = { ...process.env };

let fetchHeatPumpHistory: typeof import('../src/integrations/heatPumpHistoryClient').fetchHeatPumpHistory;
let consoleWarnSpy: ReturnType<typeof vi.spyOn>;

const baseRequest: HeatPumpHistoryRequest = {
  mac: '38:18:2B:60:A9:94',
  from: '2025-12-03T08:12:46.503Z',
  to: '2025-12-03T14:12:46.503Z',
  aggregation: 'raw',
  mode: 'live',
  fields: [{ field: 'metric_compCurrentA', unit: 'A', decimals: 1 }],
};

async function loadClient() {
  const mod = await import('../src/integrations/heatPumpHistoryClient');
  fetchHeatPumpHistory = mod.fetchHeatPumpHistory;
}

beforeEach(async () => {
  vi.resetModules();
  vi.restoreAllMocks();
  process.env = { ...originalEnv };
  process.env.NODE_ENV = 'test';
  process.env.HEATPUMP_HISTORY_URL =
    'https://za-iot-dev-api.azurewebsites.net/api/HeatPumpHistory/historyHeatPump';
  process.env.HEATPUMP_HISTORY_API_KEY = 'test-key';
  delete process.env.HEATPUMP_HISTORY_TIMEOUT_MS;
  delete process.env.HEAT_PUMP_HISTORY_TIMEOUT_MS;
  delete process.env.HEAT_PUMP_HISTORY_URL;
  delete process.env.HEAT_PUMP_HISTORY_API_KEY;
  fetchMock.mockReset();
  (global as any).fetch = fetchMock;
  consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
  await loadClient();
});

afterAll(() => {
  process.env = originalEnv;
  (global as any).fetch = originalFetch;
});

describe('heatPumpHistoryClient', () => {
  it('uses canonical env vars when provided', async () => {
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
    expect(options.headers).toMatchObject({
      'x-api-key': 'test-key',
    });
    expect(JSON.parse(options.body)).toEqual(baseRequest);
    expect(consoleWarnSpy).not.toHaveBeenCalled();
  });

  it('falls back to legacy env vars when canonical is missing and logs a deprecation warning', async () => {
    process.env.HEATPUMP_HISTORY_URL = '';
    process.env.HEATPUMP_HISTORY_API_KEY = '';
    process.env.HEATPUMP_HISTORY_TIMEOUT_MS = '';
    process.env.HEAT_PUMP_HISTORY_URL = 'https://legacy.example.com/history';
    process.env.HEAT_PUMP_HISTORY_API_KEY = 'legacy-key';
    process.env.HEAT_PUMP_HISTORY_TIMEOUT_MS = '15000';
    const setTimeoutSpy = vi.spyOn(global, 'setTimeout');

    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      statusText: 'OK',
      text: vi.fn().mockResolvedValue('{}'),
    });

    await fetchHeatPumpHistory(baseRequest);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, options] = fetchMock.mock.calls[0] as [string, any];
    expect(url).toBe('https://legacy.example.com/history');
    expect(options.headers).toMatchObject({
      'x-api-key': 'legacy-key',
    });
    const timeoutCall = setTimeoutSpy.mock.calls.find(([, delay]) => typeof delay === 'number');
    expect(timeoutCall?.[1]).toBe(15000);
    expect(consoleWarnSpy).toHaveBeenCalledWith(
      expect.stringContaining('HEAT_PUMP_* env vars are deprecated')
    );
    setTimeoutSpy.mockRestore();
  });

  it('prefers canonical env vars when both canonical and legacy are set', async () => {
    process.env.HEATPUMP_HISTORY_URL = 'https://canonical.example.com/history';
    process.env.HEATPUMP_HISTORY_API_KEY = 'canonical-key';
    process.env.HEAT_PUMP_HISTORY_URL = 'https://legacy.example.com/history';
    process.env.HEAT_PUMP_HISTORY_API_KEY = 'legacy-key';

    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      statusText: 'OK',
      text: vi.fn().mockResolvedValue('{}'),
    });

    await fetchHeatPumpHistory(baseRequest);

    const [url, options] = fetchMock.mock.calls[0] as [string, any];
    expect(url).toBe('https://canonical.example.com/history');
    expect(options.headers).toMatchObject({ 'x-api-key': 'canonical-key' });
    expect(consoleWarnSpy).not.toHaveBeenCalled();
  });

  it('falls back to the default timeout when the env var is invalid and logs a warning', async () => {
    process.env.HEATPUMP_HISTORY_TIMEOUT_MS = 'abc';
    const setTimeoutSpy = vi.spyOn(global, 'setTimeout');

    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      statusText: 'OK',
      text: vi.fn().mockResolvedValue('{}'),
    });

    await fetchHeatPumpHistory(baseRequest);

    const timeoutCall = setTimeoutSpy.mock.calls.find(([, delay]) => typeof delay === 'number');
    expect(timeoutCall?.[1]).toBe(10_000);
    expect(consoleWarnSpy).toHaveBeenCalledWith(
      expect.stringContaining('Invalid HEATPUMP_HISTORY_TIMEOUT_MS')
    );
    setTimeoutSpy.mockRestore();
  });

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
