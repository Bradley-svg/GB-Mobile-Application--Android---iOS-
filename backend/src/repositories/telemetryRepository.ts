import { query } from '../config/db';

export type TelemetryMetricRow = {
  metric: string;
  ts: Date;
  value: number;
};

export type LatestMetricRow = TelemetryMetricRow & { device_id: string };

export async function getTelemetryForDevice(
  deviceId: string,
  range: '1h' | '24h' | '7d'
): Promise<TelemetryMetricRow[]> {
  const interval =
    range === '1h' ? "interval '1 hour'" : range === '24h' ? "interval '24 hours'" : "interval '7 days'";

  const res = await query<TelemetryMetricRow>(
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

  return res.rows;
}

export async function getTelemetryForDeviceRange(
  deviceId: string,
  from: Date,
  to: Date,
  metrics?: string[]
): Promise<TelemetryMetricRow[]> {
  const params: Array<string | Date | string[]> = [deviceId, from, to];
  let metricClause = '';
  if (metrics && metrics.length > 0) {
    params.push(metrics);
    metricClause = 'and metric = ANY($4)';
  }

  const res = await query<TelemetryMetricRow>(
    `
    select metric, ts, value
    from telemetry_points
    where device_id = $1
      and ts between $2 and $3
      ${metricClause}
    order by ts asc
  `,
    params
  );

  return res.rows;
}

export async function insertTelemetryBatch(
  deviceId: string,
  metrics: Record<string, number>,
  timestamp: Date
) {
  const entries = Object.entries(metrics);
  if (entries.length === 0) return;

  const valuesClause = entries
    .map(
      (_, idx) =>
        `($1, $${idx * 3 + 2}, $${idx * 3 + 3}, $${idx * 3 + 4}, 'good', now())`
    )
    .join(', ');

  const params: Array<string | number | Date> = [deviceId];
  for (const [metricName, value] of entries) {
    params.push(metricName, timestamp, value);
  }

  const insertSql = `
    insert into telemetry_points (device_id, metric, ts, value, quality, created_at)
    values ${valuesClause}
  `;

  await query(insertSql, params);
}

export async function upsertDeviceSnapshot(deviceId: string, timestamp: Date, data: unknown) {
  await query(
    `
    insert into device_snapshots (device_id, last_seen_at, data, updated_at)
    values ($1, $2, $3::jsonb, now())
    on conflict (device_id)
    do update set last_seen_at = excluded.last_seen_at,
                  data = excluded.data,
                  updated_at = now()
  `,
    [deviceId, timestamp, JSON.stringify(data)]
  );
}

export async function getLatestTelemetryForMetrics(
  metrics: string[],
  deviceIds?: string[]
): Promise<LatestMetricRow[]> {
  if (metrics.length === 0) return [];

  const params: Array<string[] | string> = [metrics];
  let deviceClause = '';
  if (deviceIds && deviceIds.length > 0) {
    params.push(deviceIds);
    deviceClause = `and device_id = ANY($2)`;
  }

  const res = await query<LatestMetricRow>(
    `
    select distinct on (device_id, metric) device_id, metric, ts, value
    from telemetry_points
    where metric = ANY($1)
      ${deviceClause}
    order by device_id, metric, ts desc
  `,
    params
  );

  return res.rows;
}

export async function getTelemetryWindowBounds(
  deviceId: string,
  metric: string,
  since: Date
): Promise<{ first: TelemetryMetricRow | null; last: TelemetryMetricRow | null }> {
  const earliest = await query<TelemetryMetricRow>(
    `
    select metric, ts, value
    from telemetry_points
    where device_id = $1
      and metric = $2
      and ts >= $3
    order by ts asc
    limit 1
  `,
    [deviceId, metric, since]
  );

  const latest = await query<TelemetryMetricRow>(
    `
    select metric, ts, value
    from telemetry_points
    where device_id = $1
      and metric = $2
      and ts >= $3
    order by ts desc
    limit 1
  `,
    [deviceId, metric, since]
  );

  return {
    first: earliest.rows[0] ?? null,
    last: latest.rows[0] ?? null,
  };
}
