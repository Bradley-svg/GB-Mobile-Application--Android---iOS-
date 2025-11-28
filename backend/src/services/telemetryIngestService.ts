import { query } from '../db/pool';

type ParsedTopic = {
  siteExternalId: string;
  deviceExternalId: string;
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
    console.error('Failed to parse MQTT payload', e);
    return;
  }

  const tsMs = data.ts || Date.now();
  const ts = new Date(tsMs);

  const metrics: Record<string, number | undefined> = {
    supply_temp: data.supplyTemp,
    return_temp: data.returnTemp,
    power_kw: data.powerKw,
    flow_rate: data.flowRate,
    cop: data.cop,
  };

  const entries = Object.entries(metrics).filter(
    ([, value]) => typeof value === 'number' && !Number.isNaN(value)
  );

  if (entries.length === 0) return;

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
    ...data,
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
}
