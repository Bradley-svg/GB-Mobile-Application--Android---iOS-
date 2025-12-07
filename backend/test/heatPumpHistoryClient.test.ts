import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { HeatPumpHistoryRequest } from '../src/integrations/heatPumpHistoryClient';

const fetchMock = vi.fn();
const originalFetch = global.fetch;
const originalEnv = { ...process.env };
const markHeatPumpHistorySuccessMock = vi.fn();
const markHeatPumpHistoryErrorMock = vi.fn();
const loggerInfoSpy = vi.fn();
const loggerWarnSpy = vi.fn();
const loggerErrorSpy = vi.fn();
const loggerChildSpy = vi.fn(() => ({
  info: loggerInfoSpy,
  warn: loggerWarnSpy,
  error: loggerErrorSpy,
  child: loggerChildSpy,
}));

vi.mock('../src/services/statusService', () => ({
  markHeatPumpHistorySuccess: (...args: unknown[]) =>
    markHeatPumpHistorySuccessMock(...(args as [Date | undefined])),
  markHeatPumpHistoryError: (...args: unknown[]) =>
    markHeatPumpHistoryErrorMock(...(args as [Date | undefined, unknown])),
}));
vi.mock('../src/config/logger', () => ({
  logger: {
    info: loggerInfoSpy,
    warn: loggerWarnSpy,
    error: loggerErrorSpy,
    child: loggerChildSpy,
  },
}));

let fetchHeatPumpHistory: typeof import('../src/integrations/heatPumpHistoryClient').fetchHeatPumpHistory;

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
  markHeatPumpHistorySuccessMock.mockReset();
  markHeatPumpHistoryErrorMock.mockReset();
  loggerInfoSpy.mockClear();
  loggerWarnSpy.mockClear();
  loggerErrorSpy.mockClear();
  loggerChildSpy.mockClear();
  (global as any).fetch = fetchMock;
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

    const result = await fetchHeatPumpHistory(baseRequest);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, options] = fetchMock.mock.calls[0] as [string, any];
    expect(url).toBe(process.env.HEATPUMP_HISTORY_URL);
    expect(options.headers).toMatchObject({
      'x-api-key': 'test-key',
    });
    expect(JSON.parse(options.body)).toEqual(baseRequest);
    expect(loggerWarnSpy).not.toHaveBeenCalled();
    expect(result).toEqual({ ok: true, series: [] });
    expect(markHeatPumpHistorySuccessMock).toHaveBeenCalledTimes(1);
    expect(markHeatPumpHistoryErrorMock).not.toHaveBeenCalled();
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

    const result = await fetchHeatPumpHistory(baseRequest);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, options] = fetchMock.mock.calls[0] as [string, any];
    expect(url).toBe('https://legacy.example.com/history');
    expect(options.headers).toMatchObject({
      'x-api-key': 'legacy-key',
    });
    const timeoutCall = setTimeoutSpy.mock.calls.find(([, delay]) => typeof delay === 'number');
    expect(timeoutCall?.[1]).toBe(15000);
    expect(loggerWarnSpy).toHaveBeenCalledWith(
      expect.stringContaining('HEAT_PUMP_* env vars are deprecated')
    );
    expect(result.ok).toBe(true);
    expect(markHeatPumpHistorySuccessMock).toHaveBeenCalledTimes(1);
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

    const result = await fetchHeatPumpHistory(baseRequest);

    const [url, options] = fetchMock.mock.calls[0] as [string, any];
    expect(url).toBe('https://canonical.example.com/history');
    expect(options.headers).toMatchObject({ 'x-api-key': 'canonical-key' });
    expect(loggerWarnSpy).not.toHaveBeenCalled();
    expect(result.ok).toBe(true);
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

    const result = await fetchHeatPumpHistory(baseRequest);

    const timeoutCall = setTimeoutSpy.mock.calls.find(([, delay]) => typeof delay === 'number');
    expect(timeoutCall?.[1]).toBe(10_000);
    expect(loggerWarnSpy).toHaveBeenCalledWith(
      expect.stringContaining('Invalid HEATPUMP_HISTORY_TIMEOUT_MS')
    );
    expect(result.ok).toBe(true);
    setTimeoutSpy.mockRestore();
  });

  it('sends the vendor/Azure payload shape (aggregation as string at the top level)', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      statusText: 'OK',
      text: vi.fn().mockResolvedValue('{}'),
    });

    const result = await fetchHeatPumpHistory(baseRequest);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, options] = fetchMock.mock.calls[0] as [string, any];
    expect(url).toBe(process.env.HEATPUMP_HISTORY_URL);
    expect(options.method).toBe('POST');
    expect(options.headers).toMatchObject({
      accept: 'text/plain',
      'content-type': 'application/json-patch+json',
      'x-api-key': 'test-key',
    });
    expect(JSON.parse(options.body)).toEqual(baseRequest);
    expect(JSON.parse(options.body)).not.toHaveProperty('query');
    expect(result.ok).toBe(true);
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
      ok: true,
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
    expect(markHeatPumpHistorySuccessMock).toHaveBeenCalledTimes(1);
  });

  it('throws a friendly error when the upstream responds with an error status', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 500,
      statusText: 'Server error',
      text: vi.fn().mockResolvedValue('boom'),
    });

    const result = await fetchHeatPumpHistory(baseRequest);

    expect(result).toEqual({
      ok: false,
      kind: 'UPSTREAM_ERROR',
      message: 'Heat pump history upstream error (500)',
    });
    expect(markHeatPumpHistoryErrorMock).toHaveBeenCalledTimes(1);
  });

  it('throws a timeout error when the request is aborted', async () => {
    const abortError = new Error('Aborted');
    abortError.name = 'AbortError';
    fetchMock.mockRejectedValueOnce(abortError);

    const result = await fetchHeatPumpHistory(baseRequest);

    expect(result).toEqual({
      ok: false,
      kind: 'UPSTREAM_ERROR',
      message: 'Heat pump history request timed out',
    });
    expect(markHeatPumpHistoryErrorMock).toHaveBeenCalledTimes(1);
  });

  it('opens the circuit after consecutive failures and returns a circuit-open result', async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 500,
      statusText: 'Server error',
      text: vi.fn().mockResolvedValue('boom'),
    });

    for (let i = 0; i < 3; i++) {
      const failure = await fetchHeatPumpHistory(baseRequest);
      expect(failure).toMatchObject({ ok: false, kind: 'UPSTREAM_ERROR' });
    }

    const openResult = await fetchHeatPumpHistory(baseRequest);

    expect(openResult).toEqual({
      ok: false,
      kind: 'CIRCUIT_OPEN',
      message: 'Heat pump history is temporarily unavailable. Please try again shortly.',
    });
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(markHeatPumpHistoryErrorMock).toHaveBeenCalledTimes(3);
  });

  it('retries after the circuit cools down and resets failure counts on success', async () => {
    vi.useFakeTimers();
    fetchMock.mockResolvedValue({
      ok: false,
      status: 500,
      statusText: 'Server error',
      text: vi.fn().mockResolvedValue('boom'),
    });

    for (let i = 0; i < 3; i++) {
      await fetchHeatPumpHistory(baseRequest);
    }

    const circuitOpen = await fetchHeatPumpHistory(baseRequest);
    expect(circuitOpen.kind).toBe('CIRCUIT_OPEN');
    expect(fetchMock).toHaveBeenCalledTimes(3);

    vi.setSystemTime(Date.now() + 61_000);

    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      statusText: 'OK',
      text: vi.fn().mockResolvedValue('{}'),
    });

    const success = await fetchHeatPumpHistory(baseRequest);
    expect(success.ok).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(4);
    expect(markHeatPumpHistorySuccessMock).toHaveBeenCalledTimes(1);
    vi.useRealTimers();
  });

  it('throws a configuration error when API key is missing in production', async () => {
    process.env.NODE_ENV = 'production';
    delete process.env.HEATPUMP_HISTORY_API_KEY;

    await expect(fetchHeatPumpHistory(baseRequest)).rejects.toThrow(
      'HEATPUMP_HISTORY_API_KEY is required when NODE_ENV is not development'
    );
  });
});
