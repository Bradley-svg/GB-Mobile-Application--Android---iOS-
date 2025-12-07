// These workers are designed to run as a single instance. Running multiple instances without
// coordination/locking may cause duplicate processing.
import 'dotenv/config';
import { randomUUID } from 'crypto';
import {
  findOfflineDevices,
  findOnlineDevices,
  getDeviceSnapshotTemperatures,
  getDeviceLastSeen,
  type DeviceLastSeenRow,
} from '../repositories/devicesRepository';
import { clearAlertIfExists, upsertActiveAlert, getActiveAlertCountsForOrg } from '../services/alertService';
import { sendAlertNotification } from '../services/pushService';
import { markAlertsWorkerHeartbeat, upsertStatus } from '../services/statusService';
import { logger } from '../config/logger';
import {
  acquireWorkerLock,
  releaseWorkerLock,
  renewWorkerLock,
} from '../repositories/workerLocksRepository';
import {
  getAllEnabledRules,
  type AlertRuleRow,
} from '../repositories/alertRulesRepository';
import {
  getLatestTelemetryForMetrics,
  getTelemetryWindowBounds,
} from '../repositories/telemetryRepository';
import { getScheduleContextForSite, type ScheduleContext } from '../services/siteScheduleService';

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
let rulesCache: AlertRuleRow[] = [];
let lastRulesLoadedAt: Date | null = null;

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
  rules?: RuleMetrics;
};

type RuleMetrics = {
  evaluated: number;
  triggered: number;
  cleared: number;
  skipped: number;
};

type ActiveAlertCounts = {
  warning: number;
  critical: number;
  info?: number;
};

type SeverityWithContext = {
  severity: AlertRuleRow['severity'];
  modifier: string;
};

function parseLockTtlMs() {
  const parsed = Number(process.env.WORKER_LOCK_TTL_SEC);
  if (Number.isFinite(parsed) && parsed > 0) {
    return parsed * 1000;
  }
  return 60_000;
}

const lockTtlMs = parseLockTtlMs();
const ruleRefreshMs = Math.max(60_000, Number(process.env.ALERT_RULE_REFRESH_MINUTES || 5) * 60_000);
const MIN_RUN_INTERVAL_MS = 15_000;

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

async function refreshRulesCache(force = false) {
  const now = Date.now();
  if (!force && lastRulesLoadedAt && now - lastRulesLoadedAt.getTime() < ruleRefreshMs) {
    return rulesCache;
  }

  rulesCache = await getAllEnabledRules();
  lastRulesLoadedAt = new Date();
  log.info({ rules: rulesCache.length }, 'loaded alert rules');
  return rulesCache;
}

function buildDeviceScopes(lastSeen: DeviceLastSeenRow[]) {
  const siteToDevice = new Map<string, string[]>();
  const deviceToSite = new Map<string, string>();

  lastSeen.forEach((row) => {
    deviceToSite.set(row.id, row.site_id);
    const devices = siteToDevice.get(row.site_id) || [];
    devices.push(row.id);
    siteToDevice.set(row.site_id, devices);
  });

  return { siteToDevice, deviceToSite };
}

async function resolveScheduleContext(
  siteId: string,
  cache: Map<string, ScheduleContext>,
  at: Date
) {
  const cached = cache.get(siteId);
  if (cached) return cached;
  const context = await getScheduleContextForSite(siteId, at);
  cache.set(siteId, context);
  return context;
}

function withAlertTotals(counts: ActiveAlertCounts) {
  const warning = counts.warning ?? 0;
  const critical = counts.critical ?? 0;
  const info = counts.info ?? 0;
  return {
    warning,
    critical,
    info,
    total: warning + critical + info,
  };
}

async function resolveSeverityWithSchedule(
  severity: AlertRuleRow['severity'],
  siteId: string | null,
  scheduleCtx: Map<string, ScheduleContext>,
  now: Date
): Promise<SeverityWithContext> {
  if (!siteId) {
    return { severity, modifier: '' };
  }

  const ctx = await resolveScheduleContext(siteId, scheduleCtx, now);
  if (ctx.isLoadShedding && severity === 'critical') {
    return { severity: 'warning', modifier: ' (load-shedding window)' };
  }

  return { severity, modifier: '' };
}

type RuleTarget = {
  deviceId: string;
  siteId: string | null;
};

function resolveRuleTargets(
  rule: AlertRuleRow,
  siteToDevice: Map<string, string[]>,
  allDeviceIds: string[]
): RuleTarget[] {
  if (rule.device_id) {
    return [{ deviceId: rule.device_id, siteId: rule.site_id ?? null }];
  }
  if (rule.site_id) {
    const devices = siteToDevice.get(rule.site_id) || [];
    return devices.map((deviceId) => ({ deviceId, siteId: rule.site_id }));
  }

  return allDeviceIds.map((deviceId) => ({
    deviceId,
    siteId: null,
  }));
}

function getMetricSampleKey(deviceId: string, metric: string) {
  return `${deviceId}:${metric}`;
}

function buildMetricMap(samples: Awaited<ReturnType<typeof getLatestTelemetryForMetrics>>) {
  const map = new Map<string, { value: number; ts: Date }>();
  samples.forEach((sample) => {
    map.set(getMetricSampleKey(sample.device_id, sample.metric), {
      value: sample.value,
      ts: sample.ts,
    });
  });
  return map;
}

function formatRuleMessage(rule: AlertRuleRow, value: number, extra?: string) {
  const baseName = rule.name ?? `${rule.metric} ${rule.rule_type}`;
  let detail = '';
  switch (rule.rule_type) {
    case 'threshold_above':
      detail = `value ${value.toFixed(2)} above threshold ${rule.threshold}`;
      break;
    case 'threshold_below':
      detail = `value ${value.toFixed(2)} below threshold ${rule.threshold}`;
      break;
    default:
      detail = `value ${value.toFixed(2)}`;
  }
  return `${baseName}: ${detail}${extra ? ` (${extra})` : ''}`;
}

async function evaluateOfflineRule(
  rule: AlertRuleRow,
  target: RuleTarget,
  lastSeenMap: Map<string, DeviceLastSeenRow>,
  scheduleCtx: Map<string, ScheduleContext>,
  now: Date
) {
  const lastSeen = lastSeenMap.get(target.deviceId);
  if (!lastSeen) return { triggered: false, skipped: true };
  const graceSec = rule.offline_grace_sec ?? OFFLINE_MINUTES * 60;
  const minutesOffline = (now.getTime() - new Date(lastSeen.last_seen_at).getTime()) / 60_000;
  const overGrace = minutesOffline * 60 >= graceSec;
  if (!overGrace) {
    await clearAlertIfExists(target.deviceId, 'rule', now, rule.id);
    return { triggered: false, skipped: false, cleared: true };
  }

  const siteId = target.siteId ?? lastSeen.site_id ?? null;
  const { severity, modifier } = await resolveSeverityWithSchedule(
    rule.severity,
    siteId,
    scheduleCtx,
    now
  );

  const message = `${rule.name ?? 'Device offline'}: offline for ${minutesOffline.toFixed(
    1
  )} minutes (grace ${Math.round(graceSec / 60)}m)${modifier}`;
  await upsertActiveAlert({
    siteId: siteId ?? null,
    deviceId: target.deviceId,
    type: 'rule',
    severity,
    message,
    ruleId: rule.id,
    now,
  });
  return { triggered: true, skipped: false };
}

async function evaluateRateOfChangeRule(
  rule: AlertRuleRow,
  target: RuleTarget,
  scheduleCtx: Map<string, ScheduleContext>,
  now: Date
) {
  if (!rule.roc_window_sec || !rule.threshold) return { triggered: false, skipped: true };

  const since = new Date(now.getTime() - rule.roc_window_sec * 1000);
  const { first, last } = await getTelemetryWindowBounds(target.deviceId, rule.metric, since);
  if (!first || !last) return { triggered: false, skipped: true };

  const delta = last.value - first.value;
  const elapsedMs = new Date(last.ts).getTime() - new Date(first.ts).getTime();
  if (elapsedMs <= 0) return { triggered: false, skipped: true };

  const absDelta = Math.abs(delta);
  const exceeded = absDelta >= rule.threshold;
  if (!exceeded) {
    await clearAlertIfExists(target.deviceId, 'rule', now, rule.id);
    return { triggered: false, skipped: false, cleared: true };
  }

  const minutes = elapsedMs / 60_000;
  const { severity, modifier } = await resolveSeverityWithSchedule(
    rule.severity,
    target.siteId,
    scheduleCtx,
    now
  );
  const message = `${rule.name ?? 'Rapid change'}: ${delta.toFixed(
    2
  )} over ${minutes.toFixed(1)}m (threshold ${rule.threshold})${modifier}`;
  await upsertActiveAlert({
    siteId: target.siteId,
    deviceId: target.deviceId,
    type: 'rule',
    severity,
    message,
    ruleId: rule.id,
    now,
  });

  return { triggered: true, skipped: false };
}
async function evaluateThresholdRule(
  rule: AlertRuleRow,
  target: RuleTarget,
  metricMap: Map<string, { value: number; ts: Date }>,
  scheduleCtx: Map<string, ScheduleContext>,
  now: Date
) {
  if (rule.threshold == null) return { triggered: false, skipped: true };
  const sample = metricMap.get(getMetricSampleKey(target.deviceId, rule.metric));
  if (!sample || sample.value == null) return { triggered: false, skipped: true };

  const value = sample.value;
  const over =
    rule.rule_type === 'threshold_above'
      ? value > rule.threshold
      : rule.rule_type === 'threshold_below'
      ? value < rule.threshold
      : false;

  if (!over) {
    await clearAlertIfExists(target.deviceId, 'rule', now, rule.id);
    return { triggered: false, skipped: false, cleared: true };
  }

  const { severity, modifier } = await resolveSeverityWithSchedule(
    rule.severity,
    target.siteId,
    scheduleCtx,
    now
  );
  const message = formatRuleMessage(rule, value, modifier.trim() || undefined);
  await upsertActiveAlert({
    siteId: target.siteId,
    deviceId: target.deviceId,
    type: 'rule',
    severity,
    message,
    ruleId: rule.id,
    now,
  });

  return { triggered: true, skipped: false };
}

async function evaluateRules(now: Date): Promise<RuleMetrics> {
  const rules = await refreshRulesCache();
  const metrics: RuleMetrics = { evaluated: 0, triggered: 0, cleared: 0, skipped: 0 };
  if (rules.length === 0) return metrics;

  const lastSeenRows = await getDeviceLastSeen();
  const lastSeenMap = new Map(lastSeenRows.map((row) => [row.id, row]));
  const { siteToDevice } = buildDeviceScopes(lastSeenRows);
  const allDeviceIds = lastSeenRows.map((row) => row.id);

  const metricsNeeded = Array.from(
    new Set(
      rules
        .filter((r) => r.rule_type === 'threshold_above' || r.rule_type === 'threshold_below')
        .map((r) => r.metric)
    )
  );
  const metricSamples =
    metricsNeeded.length > 0 ? await getLatestTelemetryForMetrics(metricsNeeded, allDeviceIds) : [];
  const metricMap = buildMetricMap(metricSamples);
  const scheduleCtx = new Map<string, ScheduleContext>();

  for (const rule of rules) {
    const targets = resolveRuleTargets(rule, siteToDevice, allDeviceIds);
    for (const target of targets) {
      metrics.evaluated += 1;
      try {
        let result: { triggered?: boolean; skipped?: boolean; cleared?: boolean } = {};
        if (rule.rule_type === 'offline_window') {
          result = await evaluateOfflineRule(rule, target, lastSeenMap, scheduleCtx, now);
        } else if (rule.rule_type === 'rate_of_change') {
          result = await evaluateRateOfChangeRule(rule, target, scheduleCtx, now);
        } else if (
          rule.rule_type === 'threshold_above' ||
          rule.rule_type === 'threshold_below'
        ) {
          result = await evaluateThresholdRule(rule, target, metricMap, scheduleCtx, now);
        } else {
          metrics.skipped += 1;
          continue;
        }

        if (result.triggered) metrics.triggered += 1;
        if (result.skipped) metrics.skipped += 1;
        if (result.cleared) metrics.cleared += 1;
      } catch (err) {
        log.error({ err, ruleId: rule.id, deviceId: target.deviceId }, 'rule evaluation failed');
      }
    }
  }

  return metrics;
}

export async function runOnce(now: Date = new Date()) {
  if (inProgress) {
    log.warn('cycle skipped: already running');
    return { success: true, skipped: true };
  }

  inProgress = true;
  log.info({ at: now.toISOString() }, 'cycle start');

  try {
    const evalStarted = Date.now();
    const ruleMetrics = await evaluateRules(now);
    const hasOfflineRules = rulesCache.some((r) => r.rule_type === 'offline_window');
    const hasHighTempRule = rulesCache.some(
      (r) =>
        (r.rule_type === 'threshold_above' || r.rule_type === 'threshold_below') &&
        r.metric === 'supply_temp'
    );

    const offlineMetrics = hasOfflineRules
      ? { offlineCount: 0, clearedCount: 0, mutedCount: 0 }
      : await evaluateOfflineAlerts(now);
    const highTempMetrics = hasHighTempRule
      ? { evaluatedCount: 0, overThresholdCount: 0 }
      : await evaluateHighTempAlerts(now);
    const durationMs = Date.now() - evalStarted;
    const activeCounts = withAlertTotals(await getActiveAlertCountsForOrg());

    log.info(
      {
        at: now.toISOString(),
        offline: offlineMetrics,
        highTemp: highTempMetrics,
        rules: ruleMetrics,
        durationMs,
        activeAlerts: activeCounts,
      },
      'cycle complete'
    );

    try {
      const heartbeat: AlertsWorkerHeartbeat = {
        last_run_at: now.toISOString(),
        offline: offlineMetrics,
        high_temp: highTempMetrics,
        rules: ruleMetrics,
      };
      await upsertStatus('alerts_worker', heartbeat);
      await upsertStatus('alerts_engine', {
        lastRunAt: now.toISOString(),
        lastDurationMs: durationMs,
        rulesLoaded: rulesCache.length,
        triggered: ruleMetrics.triggered,
        evaluated: ruleMetrics.evaluated,
        activeAlertsTotal: activeCounts.total,
        activeCounts,
      });
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
  const requestedIntervalSec = Number(process.env.ALERT_WORKER_INTERVAL_SEC || 60);
  const intervalMs = Math.max(MIN_RUN_INTERVAL_MS, requestedIntervalSec * 1000);
  log.info(
    {
      env: process.env.NODE_ENV || 'development',
      offlineWarnMinutes: OFFLINE_MINUTES,
      offlineCriticalMinutes: OFFLINE_CRITICAL_MINUTES,
      highTempThreshold: HIGH_TEMP_THRESHOLD,
      intervalSec: requestedIntervalSec,
      intervalMs,
      lockTtlMs,
      ruleRefreshMs,
    },
    'starting alerts worker'
  );

  const acquired = await acquireWorkerLock(WORKER_NAME, ownerId, lockTtlMs);
  if (!acquired) {
    log.warn({ ownerId }, 'worker lock already held; exiting alerts worker');
    return;
  }

  startRenewLoop();
  void runManagedCycle(intervalMs);
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


