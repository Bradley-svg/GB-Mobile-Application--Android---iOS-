import 'dotenv/config';
import { QueryResultRow } from 'pg';
import { query } from '../config/db';
import { logger } from '../config/logger';

type SnapshotMetrics = {
  supply_temp: number | null;
  return_temp: number | null;
  power_kw: number | null;
  flow_rate: number | null;
  cop: number | null;
};

type SnapshotRow = QueryResultRow & {
  device_id: string;
  data: unknown;
};

const METRIC_KEYS = ['supply_temp', 'return_temp', 'power_kw', 'flow_rate', 'cop'] as const;
const log = logger.child({ module: 'backfillDeviceSnapshots' });

const isNumber = (value: unknown): value is number =>
  typeof value === 'number' && !Number.isNaN(value);

function coerceMetrics(value: unknown): SnapshotMetrics {
  const metrics = value && typeof value === 'object' ? (value as Record<string, unknown>) : {};

  return {
    supply_temp: isNumber(metrics.supply_temp) ? metrics.supply_temp : null,
    return_temp: isNumber(metrics.return_temp) ? metrics.return_temp : null,
    power_kw: isNumber(metrics.power_kw) ? metrics.power_kw : null,
    flow_rate: isNumber(metrics.flow_rate) ? metrics.flow_rate : null,
    cop: isNumber(metrics.cop) ? metrics.cop : null,
  };
}

function metricsFromSensor(sensor: unknown, fallback: SnapshotMetrics): SnapshotMetrics {
  const sensorObj = sensor && typeof sensor === 'object' ? (sensor as Record<string, unknown>) : {};

  const watts = isNumber(sensorObj.power_w) ? sensorObj.power_w : null;

  return {
    supply_temp:
      fallback.supply_temp ?? (isNumber(sensorObj.supply_temperature_c) ? sensorObj.supply_temperature_c : null),
    return_temp:
      fallback.return_temp ?? (isNumber(sensorObj.return_temperature_c) ? sensorObj.return_temperature_c : null),
    power_kw: fallback.power_kw ?? (watts === null ? null : watts / 1000),
    flow_rate: fallback.flow_rate ?? (isNumber(sensorObj.flow_lps) ? sensorObj.flow_lps : null),
    cop: fallback.cop ?? (isNumber(sensorObj.cop) ? sensorObj.cop : null),
  };
}

function buildCanonicalMetrics(snapshotData: unknown, rawPayload: unknown): SnapshotMetrics {
  const snapshotObj =
    snapshotData && typeof snapshotData === 'object' ? (snapshotData as Record<string, unknown>) : {};
  const rawObj = rawPayload && typeof rawPayload === 'object' ? (rawPayload as Record<string, unknown>) : {};

  const existingMetrics = coerceMetrics(snapshotObj.metrics);
  const rawMetrics = coerceMetrics(rawObj.metrics);

  // Prefer metrics already saved on the snapshot, then fall back to metrics embedded in the raw payload.
  const mergedMetrics: SnapshotMetrics = {
    supply_temp: existingMetrics.supply_temp ?? rawMetrics.supply_temp,
    return_temp: existingMetrics.return_temp ?? rawMetrics.return_temp,
    power_kw: existingMetrics.power_kw ?? rawMetrics.power_kw,
    flow_rate: existingMetrics.flow_rate ?? rawMetrics.flow_rate,
    cop: existingMetrics.cop ?? rawMetrics.cop,
  };

  return metricsFromSensor(rawObj.sensor, mergedMetrics);
}

function hasCanonicalShape(data: unknown): data is { metrics: SnapshotMetrics; raw: unknown } {
  if (!data || typeof data !== 'object') return false;

  const payload = data as Record<string, unknown>;
  if (!payload.metrics || !payload.raw || typeof payload.metrics !== 'object') return false;

  const metrics = payload.metrics as Record<string, unknown>;
  const hasAllKeys = METRIC_KEYS.every(
    (key) => key in metrics && (metrics[key] === null || isNumber(metrics[key]))
  );

  return hasAllKeys;
}

async function main() {
  const res = await query<SnapshotRow>('select device_id, data from device_snapshots');

  let updated = 0;

  for (const row of res.rows) {
    const { device_id, data } = row;

    if (hasCanonicalShape(data)) {
      continue;
    }

    const payload = data && typeof data === 'object' && 'raw' in (data as Record<string, unknown>)
      ? (data as Record<string, unknown>).raw
      : data;

    const metrics = buildCanonicalMetrics(data, payload);

    const canonical = {
      metrics,
      raw: payload,
    };

    await query(
      'update device_snapshots set data = $1::jsonb, updated_at = now() where device_id = $2',
      [JSON.stringify(canonical), device_id]
    );

    updated += 1;
  }

  log.info({ updated, total: res.rows.length }, 'backfill completed');
}

main()
  .catch((err) => {
    log.error({ err }, 'backfill error');
    process.exitCode = 1;
  })
  .finally(() => process.exit());
