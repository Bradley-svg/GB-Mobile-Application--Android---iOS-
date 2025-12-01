import { z } from 'zod';
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

export const telemetryPayloadSchema = z
  .object({
    timestamp: z.number().finite().optional(),
    sensor: z
      .object({
        supply_temperature_c: z.number().finite().optional(),
        return_temperature_c: z.number().finite().optional(),
        power_w: z.number().finite().optional(),
        flow_lps: z.number().finite().optional(),
        cop: z.number().finite().optional(),
      })
      .strict(),
    meta: z.record(z.any()).optional(),
  })
  .strict();

export type TelemetryPayload = z.infer<typeof telemetryPayloadSchema>;

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

function parsePayload(raw: Buffer | unknown, source: string): TelemetryPayload | null {
  let decoded: unknown = raw;

  if (Buffer.isBuffer(raw)) {
    try {
      decoded = JSON.parse(raw.toString('utf8'));
    } catch (e) {
      console.error('Failed to parse MQTT payload', { source, error: e });
      return null;
    }
  }

  const parsed = telemetryPayloadSchema.safeParse(decoded);
  if (!parsed.success) {
    console.warn('[telemetry] payload validation failed', {
      source,
      issues: parsed.error.flatten().fieldErrors,
    });
    return null;
  }

  return parsed.data;
}

async function storeTelemetry(deviceId: string, payload: TelemetryPayload, source: string) {
  const tsMs = payload.timestamp ?? Date.now();
  const ts = new Date(tsMs);

  const metrics: SnapshotMetrics = {
    supply_temp: payload.sensor.supply_temperature_c ?? null,
    return_temp: payload.sensor.return_temperature_c ?? null,
    power_kw:
      payload.sensor.power_w === undefined || payload.sensor.power_w === null
        ? null
        : payload.sensor.power_w / 1000,
    flow_rate: payload.sensor.flow_lps ?? null,
    cop: payload.sensor.cop ?? null,
  };

  const entries = Object.entries(metrics).filter(
    (entry): entry is [string, number] => entry[1] !== null
  );

  if (entries.length === 0) {
    console.log('[telemetry] payload had no numeric metrics; skipping insert');
    return false;
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
    raw: payload,
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
    `[telemetry] stored telemetry device=${deviceId} metrics=${entries.length} ts=${ts.toISOString()} source=${source}`
  );

  return true;
}

export async function handleTelemetryMessage(topic: string, payload: Buffer) {
  const parsedTopic = parseTopic(topic);
  if (!parsedTopic) {
    console.warn('Ignoring unknown topic', topic);
    return false;
  }

  const { deviceExternalId } = parsedTopic;
  const deviceId = await getDeviceIdByExternalId(deviceExternalId);
  if (!deviceId) {
    console.warn('No device mapped for external id', deviceExternalId);
    return false;
  }

  const parsedPayload = parsePayload(payload, 'mqtt');
  if (!parsedPayload) {
    return false;
  }

  return storeTelemetry(deviceId, parsedPayload, 'mqtt');
}

export async function handleHttpTelemetryIngest(params: {
  deviceExternalId: string;
  siteExternalId?: string;
  payload: unknown;
}) {
  const { deviceExternalId, payload } = params;
  const deviceId = await getDeviceIdByExternalId(deviceExternalId);
  if (!deviceId) {
    console.warn('No device mapped for external id', deviceExternalId);
    return false;
  }

  const parsedPayload = parsePayload(payload, 'http');
  if (!parsedPayload) {
    return false;
  }

  return storeTelemetry(deviceId, parsedPayload, 'http');
}
