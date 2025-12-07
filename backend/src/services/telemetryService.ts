import { getTelemetryForDevice } from '../repositories/telemetryRepository';

const DEFAULT_MAX_POINTS_PER_SERIES = 500;

export type TelemetryPoint = {
  ts: string;
  value: number;
};

export type TelemetryRange = '24h' | '7d';

export type TelemetryResult = {
  range: TelemetryRange;
  metrics: Record<string, TelemetryPoint[]>;
};

function clampMaxPoints(maxPoints?: number) {
  if (!maxPoints || Number.isNaN(maxPoints)) return DEFAULT_MAX_POINTS_PER_SERIES;
  const bounded = Math.max(10, Math.min(DEFAULT_MAX_POINTS_PER_SERIES, Math.floor(maxPoints)));
  return bounded;
}

function downsampleSeries(series: TelemetryPoint[], maxPoints: number): TelemetryPoint[] {
  if (series.length <= maxPoints) return series;

  const bucketSize = Math.ceil(series.length / maxPoints);
  const buckets: TelemetryPoint[] = [];

  for (let i = 0; i < series.length; i += bucketSize) {
    const bucket = series.slice(i, i + bucketSize);
    if (bucket.length === 0) continue;

    const average = bucket.reduce((sum, point) => sum + point.value, 0) / bucket.length;
    buckets.push({ ts: bucket[0].ts, value: average });
  }

  return buckets;
}

export async function getDeviceTelemetry(
  deviceId: string,
  range: TelemetryRange,
  maxPoints?: number
): Promise<TelemetryResult> {
  const maxPointsPerSeries = clampMaxPoints(maxPoints);
  const rows = await getTelemetryForDevice(deviceId, range);

  const metrics: Record<string, TelemetryPoint[]> = {};

  for (const row of rows) {
    if (!metrics[row.metric]) metrics[row.metric] = [];
    metrics[row.metric].push({ ts: row.ts.toISOString(), value: row.value });
  }

  const metricKeys = ['supply_temp', 'return_temp', 'power_kw', 'flow_rate', 'cop'] as const;
  for (const key of metricKeys) {
    const series = metrics[key] || [];
    metrics[key] = downsampleSeries(series, maxPointsPerSeries);
  }

  return { range, metrics };
}
