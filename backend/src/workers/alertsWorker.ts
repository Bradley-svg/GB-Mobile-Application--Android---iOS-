import 'dotenv/config';
import { query } from '../db/pool';
import { clearAlertIfExists, upsertActiveAlert } from '../services/alertService';
import { sendAlertNotification } from '../services/pushService';

const OFFLINE_MINUTES = Number(process.env.ALERT_OFFLINE_MINUTES || 10);
const OFFLINE_CRITICAL_MINUTES = Number(process.env.ALERT_OFFLINE_CRITICAL_MINUTES || 60);
const HIGH_TEMP_THRESHOLD = Number(process.env.ALERT_HIGH_TEMP_THRESHOLD || 60);

type OfflineMetrics = {
  offlineCount: number;
  clearedCount: number;
};

type HighTempMetrics = {
  evaluatedCount: number;
  overThresholdCount: number;
};

export async function evaluateOfflineAlerts(now: Date): Promise<OfflineMetrics> {
  const offline = await query<{
    id: string;
    site_id: string;
    last_seen_at: Date;
  }>(
    `
    select d.id, d.site_id, s.last_seen_at
    from devices d
    join device_snapshots s on d.id = s.device_id
    where s.last_seen_at < now() - ($1 || ' minutes')::interval
  `,
    [OFFLINE_MINUTES]
  );

  for (const row of offline.rows) {
    const minutesOffline =
      (now.getTime() - new Date(row.last_seen_at).getTime()) / (60 * 1000);
    const severity: 'warning' | 'critical' =
      minutesOffline >= OFFLINE_CRITICAL_MINUTES ? 'critical' : 'warning';
    const message =
      severity === 'critical'
        ? `Device offline for more than ${OFFLINE_CRITICAL_MINUTES} minutes`
        : `Device offline for more than ${OFFLINE_MINUTES} minutes`;

    const { alert, isNew } = await upsertActiveAlert({
      siteId: row.site_id,
      deviceId: row.id,
      type: 'offline',
      severity,
      message,
      now,
    });

    if (isNew && severity === 'critical') {
      await sendAlertNotification(alert);
    }
  }

  console.log(`[alertsWorker] offline: ${offline.rows.length} offline devices`);

  const online = await query<{ id: string; site_id: string; last_seen_at: Date }>(
    `
    select d.id, d.site_id, s.last_seen_at
    from devices d
    join device_snapshots s on d.id = s.device_id
    where s.last_seen_at >= now() - ($1 || ' minutes')::interval
  `,
    [OFFLINE_MINUTES]
  );

  for (const row of online.rows) {
    await clearAlertIfExists(row.id, 'offline', now);
  }

  console.log(`[alertsWorker] offline clear check complete (${online.rows.length} devices)`);

  return { offlineCount: offline.rows.length, clearedCount: online.rows.length };
}

export async function evaluateHighTempAlerts(now: Date): Promise<HighTempMetrics> {
  const res = await query<{
    id: string;
    site_id: string;
    supply_temp: number | null;
  }>(
    `
    select d.id, d.site_id,
           coalesce(
             (s.data->'metrics'->>'supply_temp')::double precision,
             (s.data->'raw'->'sensor'->>'supply_temperature_c')::double precision
           ) as supply_temp
    from devices d
    join device_snapshots s on d.id = s.device_id
  `
  );

  for (const row of res.rows) {
    const temp = row.supply_temp;
    if (temp == null || Number.isNaN(temp)) {
      continue;
    }

    if (temp > HIGH_TEMP_THRESHOLD) {
      const { alert, isNew } = await upsertActiveAlert({
        siteId: row.site_id,
        deviceId: row.id,
        type: 'high_temp',
        severity: 'critical',
        message: `Supply temperature high: ${temp.toFixed(1)}C (limit ${HIGH_TEMP_THRESHOLD}C)`,
        now,
      });

      if (isNew) {
        await sendAlertNotification(alert);
      }
    } else {
      await clearAlertIfExists(row.id, 'high_temp', now);
    }
  }

  const overThresholdCount = res.rows.filter(
    (row) =>
      row.supply_temp != null &&
      !Number.isNaN(row.supply_temp) &&
      row.supply_temp > HIGH_TEMP_THRESHOLD
  ).length;

  console.log(
    `[alertsWorker] highTemp check complete (${res.rows.length} devices, ${overThresholdCount} above threshold)`
  );

  return { evaluatedCount: res.rows.length, overThresholdCount };
}

export async function runOnce(now: Date = new Date()) {
  console.log(`[alertsWorker] cycle start at ${now.toISOString()}`);

  try {
    const offlineMetrics = await evaluateOfflineAlerts(now);
    const highTempMetrics = await evaluateHighTempAlerts(now);

    console.log(
      `[alertsWorker] cycle complete at ${now.toISOString()} offline={checked:${offlineMetrics.offlineCount}, cleared:${offlineMetrics.clearedCount}} highTemp={evaluated:${highTempMetrics.evaluatedCount}, over:${highTempMetrics.overThresholdCount}}`
    );
  } catch (e) {
    console.error('[alertsWorker] error', e);
  }
}

export function start() {
  const intervalSec = Number(process.env.ALERT_WORKER_INTERVAL_SEC || 60);
  console.log(
    `[alertsWorker] starting (env=${process.env.NODE_ENV || 'development'}) offlineThresholds=${OFFLINE_MINUTES}min-warn/${OFFLINE_CRITICAL_MINUTES}min-crit highTemp=${HIGH_TEMP_THRESHOLD}C interval=${intervalSec}s`
  );

  runOnce();
  setInterval(runOnce, intervalSec * 1000);
}

if (require.main === module) {
  start();
}
