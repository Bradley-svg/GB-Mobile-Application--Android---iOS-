import { query } from '../db/pool';

type ParsedTopic = {
  siteExternalId: string;
  deviceExternalId: string;
};

type SnapshotMetrics = {
  supply_temp: number | null;
  return_temp: number | null;
  power_kw: number | null;
  flow_rate: number | null;
  cop: number | null;
};

function parseTopic(topic: string): ParsedTopic | null {
  const parts = topic.split('/');
  if (parts.length !== 4) return null;

  const [root, siteExternalId, deviceExternalId, type] = parts;
  if (root !== 'greenbro' || type !== 'telemetry') return null;

  return { siteExternalId, deviceExternalId };
}

async function getDeviceIdByExternalId(externalId: string) {
  const res = await query<{ id: string }>('select id from devices where external_id = $1', [
    externalId,
  ]);
  return res.rows[0]?.id || null;
}

export async function handleTelemetryMessage(topic: string, payload: Buffer) {
  const parsedTopic = parseTopic(topic);
  if (!parsedTopic) {
    console.warn('Ignoring unknown topic', topic);
    return;
  }

  const { deviceExternalId } = parsedTopic;
  const deviceId = await getDeviceIdByExternalId(deviceExternalId);
  if (!deviceId) {
    console.warn('No device mapped for external id', deviceExternalId);
    return;
  }

  let data: any;
  try {
    data = JSON.parse(payload.toString('utf8'));
  } catch (e) {
    console.error('Failed to parse MQTT payload', { topic, error: e });
    return;
  }

  if (!data || typeof data !== 'object') {
    console.log('Telemetry payload is not an object; topic', topic);
    return;
  }

  const sensor = (data as any).sensor;
  if (!sensor || typeof sensor !== 'object') {
    console.log('Telemetry payload missing sensor object; topic', topic);
    return;
  }

  const rawTimestamp = (data as any).timestamp;
  if (typeof rawTimestamp !== 'number') {
    console.log('Telemetry payload missing timestamp; defaulting to now; topic', topic);
  }

  const tsMs = typeof rawTimestamp === 'number' ? rawTimestamp : Date.now();
  const ts = new Date(tsMs);

  const toNumber = (value: unknown): number | null =>
    typeof value === 'number' && !Number.isNaN(value) ? value : null;

  const metrics: SnapshotMetrics = {
    supply_temp: toNumber((sensor as any).supply_temperature_c),
    return_temp: toNumber((sensor as any).return_temperature_c),
    power_kw: (() => {
      const watts = toNumber((sensor as any).power_w);
      return watts === null ? null : watts / 1000;
    })(),
    flow_rate: toNumber((sensor as any).flow_lps),
    cop: toNumber((sensor as any).cop),
  };

  const entries = Object.entries(metrics).filter(
    (entry): entry is [string, number] => entry[1] !== null
  );

  if (entries.length === 0) {
    console.log('Telemetry payload had no numeric metrics; topic', topic);
    return;
  }

  const valuesClause = entries
    .map(
      (_, idx) =>
        `($1, $${idx * 3 + 2}, $${idx * 3 + 3}, $${idx * 3 + 4}, 'good', now())`
    )
    .join(', ');

  const params: any[] = [deviceId];
  for (const [metricName, value] of entries) {
    params.push(metricName, ts, value);
  }

  const insertSql = `
    insert into telemetry_points (device_id, metric, ts, value, quality, created_at)
    values ${valuesClause}
  `;

  await query(insertSql, params);

  const snapshotData = {
    metrics,
    raw: data,
  };

  await query(
    `
    insert into device_snapshots (device_id, last_seen_at, data, updated_at)
    values ($1, $2, $3::jsonb, now())
    on conflict (device_id)
    do update set last_seen_at = excluded.last_seen_at,
                  data = excluded.data,
                  updated_at = now()
  `,
    [deviceId, ts, JSON.stringify(snapshotData)]
  );

  console.log(
    `[telemetry] stored telemetry device=${deviceId} metrics=${entries.length} ts=${ts.toISOString()}`
  );
}
