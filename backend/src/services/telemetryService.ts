import { query } from '../db/pool';

export type TelemetryPoint = {
  ts: string;
  value: number;
};

export type TelemetryRange = '24h' | '7d';

export type TelemetryResult = {
  range: TelemetryRange;
  metrics: Record<string, TelemetryPoint[]>;
};

export async function getDeviceTelemetry(
  deviceId: string,
  range: TelemetryRange
): Promise<TelemetryResult> {
  const interval = range === '24h' ? "interval '24 hours'" : "interval '7 days'";

  const res = await query<{
    metric: string;
    ts: Date;
    value: number;
  }>(
    `
    select metric, ts, value
    from telemetry_points
    where device_id = $1
      and ts >= now() - ${interval}
      and metric in ('supply_temp', 'return_temp', 'power_kw', 'flow_rate', 'cop')
    order by ts asc
  `,
    [deviceId]
  );

  const metrics: Record<string, TelemetryPoint[]> = {};

  for (const row of res.rows) {
    if (!metrics[row.metric]) metrics[row.metric] = [];
    metrics[row.metric].push({ ts: row.ts.toISOString(), value: row.value });
  }

  return { range, metrics };
}
