import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const queryMock = vi.fn();

vi.mock('../src/config/db', () => ({
  query: (...args: unknown[]) => queryMock(...(args as [string, unknown[]?])),
}));

let getDeviceTelemetry: typeof import('../src/services/telemetryService').getDeviceTelemetry;

beforeAll(async () => {
  const mod = await import('../src/services/telemetryService');
  getDeviceTelemetry = mod.getDeviceTelemetry;
});

beforeEach(() => {
  queryMock.mockReset();
});

describe('getDeviceTelemetry', () => {
  it('returns all metric keys with empty arrays when missing', async () => {
    queryMock.mockResolvedValueOnce({
      rows: [
        { metric: 'supply_temp', ts: new Date('2025-01-01T00:00:00.000Z'), value: 45.5 },
      ],
      rowCount: 1,
    });

    const result = await getDeviceTelemetry('device-1', '24h');

    expect(queryMock).toHaveBeenCalledTimes(1);
    expect(result.metrics).toMatchObject({
      supply_temp: [{ ts: '2025-01-01T00:00:00.000Z', value: 45.5 }],
      return_temp: [],
      power_kw: [],
      flow_rate: [],
      cop: [],
    });
    expect(Object.keys(result.metrics).sort()).toEqual([
      'cop',
      'flow_rate',
      'power_kw',
      'return_temp',
      'supply_temp',
    ]);
  });

  it('downsamples series that exceed the maximum point count', async () => {
    const now = Date.now();
    const rows = Array.from({ length: 600 }, (_, idx) => ({
      metric: 'supply_temp',
      ts: new Date(now + idx * 1000),
      value: idx,
    }));
    queryMock.mockResolvedValueOnce({ rows, rowCount: rows.length });

    const result = await getDeviceTelemetry('device-1', '24h');

    expect(result.metrics.supply_temp.length).toBeLessThanOrEqual(500);
    expect(result.metrics.return_temp.length).toBe(0);
  });

  it('respects custom maxPoints and averages buckets', async () => {
    const rows = Array.from({ length: 50 }, (_, idx) => ({
      metric: 'power_kw',
      ts: new Date(`2025-01-01T00:${String(idx).padStart(2, '0')}:00Z`),
      value: idx,
    }));
    queryMock.mockResolvedValueOnce({ rows, rowCount: rows.length });

    const result = await getDeviceTelemetry('device-2', '24h', 20);

    expect(result.metrics.power_kw.length).toBeLessThanOrEqual(20);
    expect(result.metrics.power_kw[0]).toEqual({ ts: rows[0].ts.toISOString(), value: 1 });
  });

  it('supports 1h range queries', async () => {
    queryMock.mockResolvedValueOnce({ rows: [], rowCount: 0 });

    await getDeviceTelemetry('device-3', '1h');

    expect(queryMock).toHaveBeenCalledTimes(1);
    const [sql] = queryMock.mock.calls[0] as [string];
    expect(sql).toContain("interval '1 hour'");
  });
});
