// These workers are designed to run as a single instance. Running multiple instances without
// coordination/locking may cause duplicate processing.
import 'dotenv/config';
import { randomUUID } from 'crypto';
import {
  findOfflineDevices,
  findOnlineDevices,
  getDeviceSnapshotTemperatures,
} from '../repositories/devicesRepository';
import { clearAlertIfExists, upsertActiveAlert } from '../services/alertService';
import { sendAlertNotification } from '../services/pushService';
import { markAlertsWorkerHeartbeat, upsertStatus } from '../services/statusService';
import { logger } from '../config/logger';
import {
  acquireWorkerLock,
  releaseWorkerLock,
  renewWorkerLock,
} from '../repositories/workerLocksRepository';

const OFFLINE_MINUTES = Number(process.env.ALERT_OFFLINE_MINUTES || 10);
const OFFLINE_CRITICAL_MINUTES = Number(process.env.ALERT_OFFLINE_CRITICAL_MINUTES || 60);
const HIGH_TEMP_THRESHOLD = Number(process.env.ALERT_HIGH_TEMP_THRESHOLD || 60);
const FAILURE_COOLDOWN_MS = 5000;
const WORKER_NAME = 'alertsWorker';
const ownerId = randomUUID();
const log = logger.child({ worker: WORKER_NAME, ownerId });

let inProgress = false;
let lastFailureAt: Date | null = null;
let renewTimer: NodeJS.Timeout | null = null;
let scheduleTimer: NodeJS.Timeout | null = null;
let stopped = false;

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

function parseLockTtlMs() {
  const parsed = Number(process.env.WORKER_LOCK_TTL_SEC);
  if (Number.isFinite(parsed) && parsed > 0) {
    return parsed * 1000;
  }
  return 60_000;
}

const lockTtlMs = parseLockTtlMs();

export async function evaluateOfflineAlerts(now: Date): Promise<OfflineMetrics> {
  const offline = await findOfflineDevices(OFFLINE_MINUTES);

  let mutedCount = 0;

  for (const row of offline) {
    const mutedUntil = row.muted_until ? new Date(row.muted_until) : null;
    if (mutedUntil && mutedUntil > now) {
      mutedCount += 1;
      log.info({ deviceId: row.id, mutedUntil }, 'offline muted device');
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

  log.info({ offlineCount: offline.length }, 'offline check complete');

  const online = await findOnlineDevices(OFFLINE_MINUTES);

  for (const row of online) {
    await clearAlertIfExists(row.id, 'offline', now);
  }

  log.info({ cleared: online.length }, 'offline clear check complete');

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

  log.info(
    {
      evaluated: snapshots.length,
      overThreshold: overThresholdCount,
    },
    'high temp check complete'
  );

  return { evaluatedCount: snapshots.length, overThresholdCount };
}

export async function runOnce(now: Date = new Date()) {
  if (inProgress) {
    log.warn('cycle skipped: already running');
    return { success: true, skipped: true };
  }

  inProgress = true;
  log.info({ at: now.toISOString() }, 'cycle start');

  try {
    const offlineMetrics = await evaluateOfflineAlerts(now);
    const highTempMetrics = await evaluateHighTempAlerts(now);

    log.info(
      {
        at: now.toISOString(),
        offline: offlineMetrics,
        highTemp: highTempMetrics,
      },
      'cycle complete'
    );

    try {
      const heartbeat: AlertsWorkerHeartbeat = {
        last_run_at: now.toISOString(),
        offline: offlineMetrics,
        high_temp: highTempMetrics,
      };
      await upsertStatus('alerts_worker', heartbeat);
    } catch (statusErr) {
      log.error({ err: statusErr }, 'failed to persist heartbeat');
    }

    try {
      await markAlertsWorkerHeartbeat(now);
    } catch (statusErr) {
      log.error({ err: statusErr }, 'failed to record heartbeat timestamp');
    }

    return { success: true };
  } catch (e) {
    log.error({ err: e }, 'cycle failed');
    return { success: false };
  } finally {
    inProgress = false;
  }
}

function scheduleNext(run: () => Promise<void>, delayMs: number) {
  if (stopped) return;
  scheduleTimer = setTimeout(run, delayMs);
}

async function runManagedCycle(intervalMs: number) {
  if (stopped) return;
  const startedAt = Date.now();
  const result = await runOnce();
  lastFailureAt = result.success ? null : new Date();

  const baseDelay = intervalMs;
  const delay = result.success ? baseDelay : baseDelay + FAILURE_COOLDOWN_MS;
  log.info(
    {
      inMs: delay,
      lastDurationMs: Date.now() - startedAt,
      lastFailureAt: lastFailureAt ? lastFailureAt.toISOString() : null,
    },
    'scheduling next cycle'
  );
  scheduleNext(() => runManagedCycle(intervalMs), delay);
}

function startRenewLoop() {
  const interval = Math.max(5_000, Math.floor(lockTtlMs / 2));
  renewTimer = setInterval(async () => {
    if (stopped) return;
    try {
      const renewed = await renewWorkerLock(WORKER_NAME, ownerId, lockTtlMs);
      if (!renewed) {
        log.error({ ttlMs: lockTtlMs }, 'lost worker lock; stopping alerts worker');
        await stop(0);
      }
    } catch (err) {
      log.error({ err }, 'failed to renew worker lock; stopping alerts worker');
      await stop(1);
    }
  }, interval);
}

async function stop(code: number | null = 0) {
  stopped = true;
  if (scheduleTimer) {
    clearTimeout(scheduleTimer);
    scheduleTimer = null;
  }
  if (renewTimer) {
    clearInterval(renewTimer);
    renewTimer = null;
  }

  try {
    await releaseWorkerLock(WORKER_NAME, ownerId);
  } catch (err) {
    log.warn({ err }, 'failed to release worker lock');
  }

  if (code !== null) {
    process.exit(code);
  }
}

export async function start() {
  const intervalSec = Number(process.env.ALERT_WORKER_INTERVAL_SEC || 60);
  log.info(
    {
      env: process.env.NODE_ENV || 'development',
      offlineWarnMinutes: OFFLINE_MINUTES,
      offlineCriticalMinutes: OFFLINE_CRITICAL_MINUTES,
      highTempThreshold: HIGH_TEMP_THRESHOLD,
      intervalSec,
      lockTtlMs,
    },
    'starting alerts worker'
  );

  const acquired = await acquireWorkerLock(WORKER_NAME, ownerId, lockTtlMs);
  if (!acquired) {
    log.warn({ ownerId }, 'worker lock already held; exiting alerts worker');
    return;
  }

  startRenewLoop();
  void runManagedCycle(intervalSec * 1000);
}

if (require.main === module) {
  const signals: NodeJS.Signals[] = ['SIGINT', 'SIGTERM'];
  for (const signal of signals) {
    process.on(signal, () => {
      log.info({ signal }, 'received shutdown signal');
      void stop(0);
    });
  }

  start().catch(async (err) => {
    log.error({ err }, 'alerts worker failed to start');
    await stop(1);
  });
}

export function getAlertsWorkerState() {
  return { inProgress };
}
