import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const queryMock = vi.fn();
const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
const consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

vi.mock('../src/db/pool', () => ({
  query: (...args: unknown[]) => queryMock(...(args as [string, unknown[]?])),
}));

let handleTelemetryMessage: typeof import('../src/services/telemetryIngestService').handleTelemetryMessage;
let handleHttpTelemetryIngest: typeof import('../src/services/telemetryIngestService').handleHttpTelemetryIngest;

beforeAll(async () => {
  const mod = await import('../src/services/telemetryIngestService');
  handleTelemetryMessage = mod.handleTelemetryMessage;
  handleHttpTelemetryIngest = mod.handleHttpTelemetryIngest;
});

beforeEach(() => {
  queryMock.mockReset();
  consoleWarnSpy.mockClear();
  consoleErrorSpy.mockClear();
  consoleLogSpy.mockClear();
});

afterAll(() => {
  consoleWarnSpy.mockRestore();
  consoleErrorSpy.mockRestore();
  consoleLogSpy.mockRestore();
});

describe('telemetry ingest', () => {
  it('ignores unknown topics', async () => {
    const result = await handleTelemetryMessage('bad/topic', Buffer.from('{}'));
    expect(result).toBe(false);
    expect(queryMock).not.toHaveBeenCalled();
  });

  it('rejects malformed payloads via validation', async () => {
    queryMock.mockResolvedValueOnce({
      rows: [{ id: 'device-123', site_external_id: 'site-1' }],
      rowCount: 1,
    });

    const result = await handleTelemetryMessage(
      'greenbro/site-1/device-1/telemetry',
      Buffer.from(
        JSON.stringify({
          timestamp: 'bad',
          sensor: { supply_temperature_c: 'hot' },
        })
      )
    );

    expect(result).toBe(false);
    expect(queryMock).toHaveBeenCalledTimes(1);
  });

  it('ignores messages with invalid JSON', async () => {
    queryMock.mockResolvedValueOnce({
      rows: [{ id: 'device-123', site_external_id: 'site-1' }],
      rowCount: 1,
    });

    const result = await handleTelemetryMessage(
      'greenbro/site-1/device-1/telemetry',
      Buffer.from('not-json')
    );

    expect(result).toBe(false);
    expect(queryMock).toHaveBeenCalledTimes(1);
  });

  it('skips ingest when the topic site does not match the device site', async () => {
    queryMock.mockResolvedValueOnce({
      rows: [{ id: 'device-123', site_external_id: 'site-expected' }],
      rowCount: 1,
    });

    const payload = {
      timestamp: Date.now(),
      sensor: { supply_temperature_c: 40 },
    };

    const ok = await handleTelemetryMessage(
      'greenbro/site-wrong/device-1/telemetry',
      Buffer.from(JSON.stringify(payload))
    );

    expect(ok).toBe(false);
    expect(queryMock).toHaveBeenCalledTimes(1);
    expect(consoleWarnSpy).toHaveBeenCalled();
  });

  it('stores only present metrics when payload is partial', async () => {
    queryMock
      .mockResolvedValueOnce({ rows: [{ id: 'device-123', site_external_id: 'site-1' }], rowCount: 1 })
      .mockResolvedValueOnce({ rows: [], rowCount: 2 })
      .mockResolvedValueOnce({ rows: [], rowCount: 1 });

    const payload = {
      timestamp: 1730000000000,
      sensor: {
        supply_temperature_c: 48.2,
        power_w: 1200,
      },
    };

    const ok = await handleTelemetryMessage(
      'greenbro/site-1/device-1/telemetry',
      Buffer.from(JSON.stringify(payload))
    );

    expect(ok).toBe(true);
    expect(queryMock).toHaveBeenCalledTimes(3);
    const telemetryParams = queryMock.mock.calls[1][1] as any[];
    expect(telemetryParams[0]).toBe('device-123');
    expect(telemetryParams.length).toBe(7);
    expect(telemetryParams[1]).toBe('supply_temp');
    expect(telemetryParams[3]).toBe(48.2);
    expect(telemetryParams[4]).toBe('power_kw');
    expect(telemetryParams[6]).toBeCloseTo(1.2);

    const snapshotData = JSON.parse(queryMock.mock.calls[2][1][2] as string);
    expect(snapshotData.metrics.supply_temp).toBe(48.2);
    expect(snapshotData.metrics.power_kw).toBeCloseTo(1.2);
    expect(snapshotData.metrics.return_temp).toBeNull();
    expect(snapshotData.raw.sensor.power_w).toBe(1200);
  });

  it('handles HTTP ingest with the same validation path', async () => {
    queryMock
      .mockResolvedValueOnce({
        rows: [{ id: 'device-999', site_external_id: 'site-http' }],
        rowCount: 1,
      })
      .mockResolvedValueOnce({ rows: [], rowCount: 2 })
      .mockResolvedValueOnce({ rows: [], rowCount: 1 });

    const payload = {
      timestamp: 1730000000000,
      sensor: { cop: 3.3, flow_lps: 0.4 },
    };

    const ok = await handleHttpTelemetryIngest({
      deviceExternalId: 'dev-http',
      payload,
    });

    expect(ok).toBe(true);
    expect(queryMock).toHaveBeenCalledTimes(3);
    expect(queryMock.mock.calls[0][1]).toEqual(['dev-http']);
    const snapshotData = JSON.parse(queryMock.mock.calls[2][1][2] as string);
    expect(snapshotData.metrics.cop).toBeCloseTo(3.3);
    expect(snapshotData.metrics.flow_rate).toBeCloseTo(0.4);
  });
});
