import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const queryMock = vi.fn();

vi.mock('../src/db/pool', () => ({
  query: (...args: unknown[]) => queryMock(...(args as [string, unknown[]?])),
}));

let handleTelemetryMessage: typeof import('../src/services/telemetryIngestService').handleTelemetryMessage;

beforeAll(async () => {
  const mod = await import('../src/services/telemetryIngestService');
  handleTelemetryMessage = mod.handleTelemetryMessage;
});

beforeEach(() => {
  queryMock.mockReset();
});

describe('handleTelemetryMessage', () => {
  it('ignores unknown topics', async () => {
    await handleTelemetryMessage('bad/topic', Buffer.from('{}'));
    expect(queryMock).not.toHaveBeenCalled();
  });

  it('ignores messages with invalid JSON', async () => {
    queryMock.mockResolvedValueOnce({ rows: [{ id: 'device-123' }], rowCount: 1 });

    await handleTelemetryMessage(
      'greenbro/site-1/device-1/telemetry',
      Buffer.from('not-json')
    );

    expect(queryMock).toHaveBeenCalledTimes(1);
  });

  it('stores only present metrics when payload is partial', async () => {
    queryMock
      .mockResolvedValueOnce({ rows: [{ id: 'device-123' }], rowCount: 1 })
      .mockResolvedValueOnce({ rows: [], rowCount: 2 })
      .mockResolvedValueOnce({ rows: [], rowCount: 1 });

    const payload = {
      timestamp: 1730000000000,
      sensor: {
        supply_temperature_c: 48.2,
        power_w: 1200,
      },
    };

    await handleTelemetryMessage(
      'greenbro/site-1/device-1/telemetry',
      Buffer.from(JSON.stringify(payload))
    );

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
});
