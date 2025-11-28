import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const queryMock = vi.fn();

vi.mock('../src/db/pool', () => ({
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
});
