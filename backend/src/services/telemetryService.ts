import { TelemetryPoint, TelemetryRange, TelemetryResult } from '../domain/telemetry';
import { getTelemetryForDevice } from '../repositories/telemetryRepository';

export async function getDeviceTelemetry(
  deviceId: string,
  range: TelemetryRange
): Promise<TelemetryResult> {
  const rows = await getTelemetryForDevice(deviceId, range);

  const metrics: Record<string, TelemetryPoint[]> = {};

  for (const row of rows) {
    if (!metrics[row.metric]) metrics[row.metric] = [];
    metrics[row.metric].push({ ts: row.ts.toISOString(), value: row.value });
  }

  const metricKeys = ['supply_temp', 'return_temp', 'power_kw', 'flow_rate', 'cop'] as const;
  for (const key of metricKeys) {
    if (!metrics[key]) {
      metrics[key] = [];
    }
  }

  return { range, metrics };
}
