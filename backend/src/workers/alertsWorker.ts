import 'dotenv/config';
import {
  findOfflineDevices,
  findOnlineDevices,
  getDeviceSnapshotTemperatures,
} from '../repositories/devicesRepository';
import { clearAlertIfExists, upsertActiveAlert } from '../services/alertService';
import { sendAlertNotification } from '../services/pushService';
import { markAlertsWorkerHeartbeat, upsertStatus } from '../services/statusService';
import { logger } from '../utils/logger';

const OFFLINE_MINUTES = Number(process.env.ALERT_OFFLINE_MINUTES || 10);
const OFFLINE_CRITICAL_MINUTES = Number(process.env.ALERT_OFFLINE_CRITICAL_MINUTES || 60);
const HIGH_TEMP_THRESHOLD = Number(process.env.ALERT_HIGH_TEMP_THRESHOLD || 60);
const FAILURE_COOLDOWN_MS = 5000;
const COMPONENT = 'alertsWorker';

let inProgress = false;
let lastFailureAt: Date | null = null;

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
      logger.info(COMPONENT, 'offline muted device', { deviceId: row.id, mutedUntil });
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

  logger.info(COMPONENT, 'offline check complete', { offlineCount: offline.length });

  const online = await findOnlineDevices(OFFLINE_MINUTES);

  for (const row of online) {
    await clearAlertIfExists(row.id, 'offline', now);
  }

  logger.info(COMPONENT, 'offline clear check complete', { cleared: online.length });

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

  logger.info(COMPONENT, 'high temp check complete', {
    evaluated: snapshots.length,
    overThreshold: overThresholdCount,
  });

  return { evaluatedCount: snapshots.length, overThresholdCount };
}

export async function runOnce(now: Date = new Date()) {
  if (inProgress) {
    logger.warn(COMPONENT, 'cycle skipped: already running');
    return { success: true, skipped: true };
  }

  inProgress = true;
  logger.info(COMPONENT, 'cycle start', { at: now.toISOString() });

  try {
    const offlineMetrics = await evaluateOfflineAlerts(now);
    const highTempMetrics = await evaluateHighTempAlerts(now);

    logger.info(COMPONENT, 'cycle complete', {
      at: now.toISOString(),
      offline: offlineMetrics,
      highTemp: highTempMetrics,
    });

    try {
      const heartbeat: AlertsWorkerHeartbeat = {
        last_run_at: now.toISOString(),
        offline: offlineMetrics,
        high_temp: highTempMetrics,
      };
      await upsertStatus('alerts_worker', heartbeat);
    } catch (statusErr) {
      logger.error(COMPONENT, 'failed to persist heartbeat', { error: statusErr });
    }

    try {
      await markAlertsWorkerHeartbeat(now);
    } catch (statusErr) {
      logger.error(COMPONENT, 'failed to record heartbeat timestamp', { error: statusErr });
    }

    return { success: true };
  } catch (e) {
    logger.error(COMPONENT, 'cycle failed', { error: e });
    return { success: false };
  } finally {
    inProgress = false;
  }
}

function scheduleNext(run: () => Promise<void>, delayMs: number) {
  setTimeout(run, delayMs);
}

async function runManagedCycle(intervalMs: number) {
  const startedAt = Date.now();
  const result = await runOnce();
  lastFailureAt = result.success ? null : new Date();

  const baseDelay = intervalMs;
  const delay = result.success ? baseDelay : baseDelay + FAILURE_COOLDOWN_MS;
  logger.info(COMPONENT, 'scheduling next cycle', {
    in: `${delay}ms`,
    lastDurationMs: Date.now() - startedAt,
    lastFailureAt: lastFailureAt ? lastFailureAt.toISOString() : null,
  });
  scheduleNext(() => runManagedCycle(intervalMs), delay);
}

export function start() {
  const intervalSec = Number(process.env.ALERT_WORKER_INTERVAL_SEC || 60);
  logger.info(COMPONENT, 'starting', {
    env: process.env.NODE_ENV || 'development',
    offlineWarnMinutes: OFFLINE_MINUTES,
    offlineCriticalMinutes: OFFLINE_CRITICAL_MINUTES,
    highTempThreshold: HIGH_TEMP_THRESHOLD,
    intervalSec,
  });

  runManagedCycle(intervalSec * 1000);
}

if (require.main === module) {
  start();
}

export function getAlertsWorkerState() {
  return { inProgress };
}
