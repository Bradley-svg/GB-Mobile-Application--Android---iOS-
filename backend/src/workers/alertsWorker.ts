import 'dotenv/config';
import {
  findOfflineDevices,
  findOnlineDevices,
  getDeviceSnapshotTemperatures,
} from '../repositories/devicesRepository';
import { clearAlertIfExists, upsertActiveAlert } from '../services/alertService';
import { sendAlertNotification } from '../services/pushService';
import { markAlertsWorkerHeartbeat, upsertStatus } from '../services/statusService';

const OFFLINE_MINUTES = Number(process.env.ALERT_OFFLINE_MINUTES || 10);
const OFFLINE_CRITICAL_MINUTES = Number(process.env.ALERT_OFFLINE_CRITICAL_MINUTES || 60);
const HIGH_TEMP_THRESHOLD = Number(process.env.ALERT_HIGH_TEMP_THRESHOLD || 60);

type OfflineMetrics = {
  offlineCount: number;
  clearedCount: number;
  mutedCount: number;
};

type HighTempMetrics = {
  evaluatedCount: number;
  overThresholdCount: number;
};

export type AlertsWorkerHeartbeat = {
  last_run_at: string;
  offline: OfflineMetrics;
  high_temp: HighTempMetrics;
};

export async function evaluateOfflineAlerts(now: Date): Promise<OfflineMetrics> {
  const offline = await findOfflineDevices(OFFLINE_MINUTES);

  let mutedCount = 0;

  for (const row of offline) {
    const mutedUntil = row.muted_until ? new Date(row.muted_until) : null;
    if (mutedUntil && mutedUntil > now) {
      mutedCount += 1;
      console.log(
        `[alertsWorker] offline muted device=${row.id} until ${mutedUntil.toISOString()}`
      );
      continue;
    }

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

  console.log(`[alertsWorker] offline: ${offline.length} offline devices`);

  const online = await findOnlineDevices(OFFLINE_MINUTES);

  for (const row of online) {
    await clearAlertIfExists(row.id, 'offline', now);
  }

  console.log(`[alertsWorker] offline clear check complete (${online.length} devices)`);

  return { offlineCount: offline.length, clearedCount: online.length, mutedCount };
}

export async function evaluateHighTempAlerts(now: Date): Promise<HighTempMetrics> {
  const snapshots = await getDeviceSnapshotTemperatures();

  for (const row of snapshots) {
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

  const overThresholdCount = snapshots.filter(
    (row) =>
      row.supply_temp != null &&
      !Number.isNaN(row.supply_temp) &&
      row.supply_temp > HIGH_TEMP_THRESHOLD
  ).length;

  console.log(
    `[alertsWorker] highTemp check complete (${snapshots.length} devices, ${overThresholdCount} above threshold)`
  );

  return { evaluatedCount: snapshots.length, overThresholdCount };
}

export async function runOnce(now: Date = new Date()) {
  console.log(`[alertsWorker] cycle start at ${now.toISOString()}`);

  try {
    const offlineMetrics = await evaluateOfflineAlerts(now);
    const highTempMetrics = await evaluateHighTempAlerts(now);

    console.log(
      `[alertsWorker] cycle complete at ${now.toISOString()} offline={checked:${offlineMetrics.offlineCount}, cleared:${offlineMetrics.clearedCount}, muted:${offlineMetrics.mutedCount}} highTemp={evaluated:${highTempMetrics.evaluatedCount}, over:${highTempMetrics.overThresholdCount}}`
    );

    try {
      const heartbeat: AlertsWorkerHeartbeat = {
        last_run_at: now.toISOString(),
        offline: offlineMetrics,
        high_temp: highTempMetrics,
      };
      await upsertStatus('alerts_worker', heartbeat);
    } catch (statusErr) {
      console.error('[alertsWorker] failed to persist heartbeat', statusErr);
    }

    try {
      await markAlertsWorkerHeartbeat(now);
    } catch (statusErr) {
      console.error('[alertsWorker] failed to record heartbeat timestamp', statusErr);
    }
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
