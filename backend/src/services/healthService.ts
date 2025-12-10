import fs from 'fs';
import { performance } from 'node:perf_hooks';
import { query } from '../config/db';
import { getControlChannelStatus } from './deviceControlService';
import { getMqttHealth } from '../integrations/mqttClient';
import { runPushHealthCheck, type PushHealthStatus } from './pushService';
import { type SystemStatus, getSystemStatus, getSystemStatusByKey } from './statusService';
import { logger } from '../config/logger';
import { getStorageRoot } from '../config/storage';
import { getHeatPumpHistoryConfig } from '../integrations/heatPumpHistoryClient';
import { getVirusScannerStatus } from './virusScanner';

const MQTT_INGEST_STALE_MS = 5 * 60 * 1000;
const MQTT_ERROR_WINDOW_MS = 5 * 60 * 1000;
const CONTROL_ERROR_WINDOW_MS = 10 * 60 * 1000;
const HEAT_PUMP_HISTORY_STALE_MS = 6 * 60 * 60 * 1000;
const log = logger.child({ module: 'health' });

function toIso(value: Date | string | null | undefined) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function isStale(date: Date | null, thresholdMs: number, now: Date) {
  if (!date) return true;
  return now.getTime() - date.getTime() > thresholdMs;
}

function isRecent(date: Date | null, windowMs: number, now: Date) {
  if (!date) return false;
  return now.getTime() - date.getTime() <= windowMs;
}

function mostRecentDate(dates: Array<Date | null>) {
  const valid = dates.filter((d): d is Date => Boolean(d));
  if (valid.length === 0) return null;
  return valid.reduce((latest, current) =>
    current.getTime() > latest.getTime() ? current : latest
  );
}

export type HealthPlusPayload = {
  ok: boolean;
  env: string;
  db: 'ok' | 'error';
  dbLatencyMs: number | null;
  version: string | null;
  vendorFlags?: {
    prodLike: boolean;
    disabled: string[];
    mqttDisabled: boolean;
    controlDisabled: boolean;
    heatPumpHistoryDisabled: boolean;
    pushNotificationsDisabled: boolean;
  };
  mqtt: {
    configured: boolean;
    disabled?: boolean;
    lastIngestAt: string | null;
    lastErrorAt: string | null;
    lastError: string | null;
    healthy: boolean;
  };
  control: {
    configured: boolean;
    disabled?: boolean;
    lastCommandAt: string | null;
    lastErrorAt: string | null;
    lastError: string | null;
    healthy: boolean;
  };
  heatPumpHistory: {
    configured: boolean;
    disabled: boolean;
    lastSuccessAt: string | null;
    lastErrorAt: string | null;
    lastError: string | null;
    lastCheckAt: string | null;
    healthy: boolean;
  };
  alertsWorker: {
    lastHeartbeatAt: string | null;
    healthy: boolean;
  };
  push: {
    enabled: boolean;
    disabled?: boolean;
    lastSampleAt: string | null;
    lastError: string | null;
  };
  antivirus: {
    configured: boolean;
    enabled: boolean;
    target: 'command' | 'socket' | null;
    lastRunAt: string | null;
    lastResult: 'clean' | 'infected' | 'error' | null;
    lastError: string | null;
    latencyMs: number | null;
  };
  maintenance?: {
    openCount: number;
    overdueCount: number;
    lastCalcAt: string | null;
  };
  storage?: {
    root: string;
    writable: boolean;
    latencyMs: number | null;
  };
  alertsEngine: {
    lastRunAt: string | null;
    lastDurationMs: number | null;
    rulesLoaded: number | null;
    activeAlertsTotal: number | null;
    activeWarning: number | null;
    activeCritical: number | null;
    activeInfo: number | null;
    evaluated: number | null;
    triggered: number | null;
  };
};

export type HealthPlusResult = {
  status: number;
  body: HealthPlusPayload;
  error?: unknown;
};

export async function getHealthPlus(now: Date = new Date()): Promise<HealthPlusResult> {
  const env = process.env.NODE_ENV || 'development';
  const version = process.env.APP_VERSION || null;
  const vendorDisableCandidates = [
    'HEATPUMP_HISTORY_DISABLED',
    'CONTROL_API_DISABLED',
    'MQTT_DISABLED',
    'PUSH_NOTIFICATIONS_DISABLED',
  ];
  const disabledFlags = vendorDisableCandidates.filter((flag) => process.env[flag] === 'true');
  const mqttDisabled = disabledFlags.includes('MQTT_DISABLED');
  const controlDisabled = disabledFlags.includes('CONTROL_API_DISABLED');
  const pushDisabled = disabledFlags.includes('PUSH_NOTIFICATIONS_DISABLED');
  let heatPumpHistoryDisabled = disabledFlags.includes('HEATPUMP_HISTORY_DISABLED');
  const mqttSnapshot = getMqttHealth();
  const controlSnapshot = getControlChannelStatus();
  const pushEnabled = process.env.PUSH_HEALTHCHECK_ENABLED === 'true' && !pushDisabled;
  const alertsIntervalSec = Number(process.env.ALERT_WORKER_INTERVAL_SEC || 60);
  const alertsHeartbeatWindowMs = Math.max(alertsIntervalSec * 2 * 1000, 60 * 1000);
  const alertsWorkerEnabled =
    (process.env.ALERT_WORKER_ENABLED || 'true').toLowerCase() !== 'false';
  const alertsExpected = env === 'production' && alertsWorkerEnabled;
  const prodLike = ['production', 'staging'].includes(env);
  const heatPumpConfig = getHeatPumpHistoryConfig();
  const heatPumpConfigured = heatPumpConfig.configured;
  heatPumpHistoryDisabled = heatPumpConfig.disabled ?? heatPumpHistoryDisabled;
  const antivirusCheckStarted = performance.now();
  const antivirusStatus = getVirusScannerStatus();
  const antivirusLatencyMs = antivirusStatus.enabled ? performance.now() - antivirusCheckStarted : null;
  const vendorFlags = {
    prodLike,
    disabled: disabledFlags,
    mqttDisabled,
    controlDisabled,
    heatPumpHistoryDisabled,
    pushNotificationsDisabled: pushDisabled,
  };
  let dbLatencyMs: number | null = null;
  const storageRoot = getStorageRoot();
  let storageLatencyMs: number | null = null;

  try {
    const dbStartedAt = performance.now();
    let dbOk = false;
    try {
      const dbRes = await query('select 1 as ok');
      dbOk = dbRes.rows[0]?.ok === 1;
    } finally {
      dbLatencyMs = performance.now() - dbStartedAt;
    }
    let storageWritable = false;
    const storageCheckStartedAt = performance.now();

    try {
      await fs.promises.mkdir(storageRoot, { recursive: true });
      await fs.promises.access(storageRoot, fs.constants.W_OK);
      await fs.promises.readdir(storageRoot);
      storageWritable = true;
    } catch (storageErr) {
      log.warn({ err: storageErr }, 'storage root not writable');
    }
    storageLatencyMs = performance.now() - storageCheckStartedAt;

    let pushHealth: PushHealthStatus | null = null;
    try {
      pushHealth = await runPushHealthCheck();
    } catch (pushErr) {
      log.error({ err: pushErr }, 'push health check failed');
    }

    let systemStatus: SystemStatus | null = null;
    let alertsEngineStatus: SystemStatus | null = null;
    let statusLoadFailed = false;
    try {
      systemStatus = await getSystemStatus();
    } catch (statusErr) {
      statusLoadFailed = true;
      log.error({ err: statusErr }, 'failed to load system_status');
    }
    try {
      alertsEngineStatus = await getSystemStatusByKey('alerts_engine');
    } catch (statusErr) {
      log.error({ err: statusErr }, 'failed to load alerts_engine status row');
    }

    const mqttLastIngestAt = systemStatus?.mqtt_last_ingest_at ?? null;
    const mqttLastErrorAt = systemStatus?.mqtt_last_error_at ?? null;
    const mqttLastError = systemStatus?.mqtt_last_error ?? mqttSnapshot.lastError ?? null;
    const mqttStale = mqttSnapshot.configured && isStale(mqttLastIngestAt, MQTT_INGEST_STALE_MS, now);
    const mqttRecentError =
      mqttSnapshot.configured &&
      isRecent(mqttLastErrorAt, MQTT_ERROR_WINDOW_MS, now) &&
      (!mqttLastIngestAt || (mqttLastErrorAt as Date) >= mqttLastIngestAt);
    const mqttExpected = mqttSnapshot.configured && !mqttDisabled;
    const mqttHealthy = statusLoadFailed
      ? !mqttExpected
      : !mqttExpected || (!mqttStale && !mqttRecentError);

    const controlLastCommandAt = systemStatus?.control_last_command_at ?? null;
    const controlLastErrorAt = systemStatus?.control_last_error_at ?? null;
    const controlLastError =
      systemStatus?.control_last_error ?? controlSnapshot.lastError ?? null;
    const controlRecentError =
      controlSnapshot.configured &&
      isRecent(controlLastErrorAt, CONTROL_ERROR_WINDOW_MS, now) &&
      (!controlLastCommandAt || (controlLastErrorAt as Date) >= controlLastCommandAt);
    const controlExpected = controlSnapshot.configured && !controlDisabled;
    const controlHealthy = statusLoadFailed
      ? !controlExpected
      : !controlExpected || !controlRecentError;

    const alertsHeartbeat = systemStatus?.alerts_worker_last_heartbeat_at ?? null;
    const alertsHealthy =
      !alertsExpected ||
      (!statusLoadFailed &&
        alertsHeartbeat != null &&
        !isStale(alertsHeartbeat, alertsHeartbeatWindowMs, now));

    type AlertsEngineStatusPayload = {
      lastRunAt?: string | null;
      lastDurationMs?: number | null;
      rulesLoaded?: number | null;
      activeCounts?: { warning?: number; critical?: number; info?: number; total?: number };
      activeAlertsTotal?: number | null;
      evaluated?: number | null;
      triggered?: number | null;
    };
    const alertsPayload = (alertsEngineStatus?.payload ?? {}) as AlertsEngineStatusPayload;
    const activeWarning =
      typeof alertsPayload.activeCounts?.warning === 'number'
        ? alertsPayload.activeCounts.warning
        : null;
    const activeCritical =
      typeof alertsPayload.activeCounts?.critical === 'number'
        ? alertsPayload.activeCounts.critical
        : null;
    const activeInfo =
      typeof alertsPayload.activeCounts?.info === 'number' ? alertsPayload.activeCounts.info : null;
    const totalFromCounts =
      activeWarning == null && activeCritical == null && activeInfo == null
        ? null
        : (activeWarning ?? 0) + (activeCritical ?? 0) + (activeInfo ?? 0);
    const activeAlertsTotal =
      typeof alertsPayload.activeAlertsTotal === 'number'
        ? alertsPayload.activeAlertsTotal
        : typeof alertsPayload.activeCounts?.total === 'number'
        ? alertsPayload.activeCounts.total
        : totalFromCounts;
    const alertsEngine = {
      lastRunAt: toIso(alertsPayload.lastRunAt ?? null),
      lastDurationMs:
        typeof alertsPayload.lastDurationMs === 'number' ? alertsPayload.lastDurationMs : null,
      rulesLoaded: typeof alertsPayload.rulesLoaded === 'number' ? alertsPayload.rulesLoaded : null,
      activeAlertsTotal: activeAlertsTotal ?? null,
      activeWarning,
      activeCritical,
      activeInfo,
      evaluated: typeof alertsPayload.evaluated === 'number' ? alertsPayload.evaluated : null,
      triggered: typeof alertsPayload.triggered === 'number' ? alertsPayload.triggered : null,
    };

    const pushLastSampleAt =
      systemStatus?.push_last_sample_at ??
      (pushHealth?.lastSample ? new Date(pushHealth.lastSample.at) : null);
    const pushLastError =
      systemStatus?.push_last_error ??
      (pushHealth?.lastSample?.status === 'error'
        ? pushHealth.lastSample.detail ?? 'Push health sample failed'
        : null);

    const push = {
      enabled: pushEnabled,
      disabled: pushDisabled,
      lastSampleAt: toIso(pushLastSampleAt),
      lastError: pushEnabled ? pushLastError : null,
    };

    const heatPumpLastSuccessAt = systemStatus?.heat_pump_history_last_success_at ?? null;
    const heatPumpLastErrorAt = systemStatus?.heat_pump_history_last_error_at ?? null;
    const heatPumpLastError = systemStatus?.heat_pump_history_last_error ?? null;
    const heatPumpLastCheckAt = mostRecentDate([heatPumpLastSuccessAt, heatPumpLastErrorAt]);
    const heatPumpSuccessRecent =
      heatPumpConfigured && !isStale(heatPumpLastSuccessAt, HEAT_PUMP_HISTORY_STALE_MS, now);
    const heatPumpErrorRecent =
      heatPumpConfigured && isRecent(heatPumpLastErrorAt, HEAT_PUMP_HISTORY_STALE_MS, now);
    const heatPumpExpected = heatPumpConfigured && !heatPumpHistoryDisabled;
    const heatPumpHealthy = statusLoadFailed
      ? !heatPumpExpected
      : !heatPumpExpected ||
        (heatPumpSuccessRecent && (!heatPumpErrorRecent || (heatPumpLastSuccessAt as Date) >= (heatPumpLastErrorAt as Date)));
    const antivirusHealthy =
      !antivirusStatus.configured ||
      !antivirusStatus.lastResult ||
      antivirusStatus.lastResult === 'clean';

    const ok = statusLoadFailed
      ? dbOk
      : dbOk &&
        (!mqttExpected || mqttHealthy) &&
        (!controlExpected || controlHealthy) &&
        (!alertsExpected || alertsHealthy) &&
        (!push.enabled || !push.lastError) &&
        (!heatPumpExpected || heatPumpHealthy) &&
        antivirusHealthy;

    const body: HealthPlusPayload = {
      ok,
      env,
      db: dbOk ? 'ok' : 'error',
      dbLatencyMs,
      version,
      vendorFlags,
      mqtt: {
        configured: mqttSnapshot.configured,
        disabled: mqttDisabled,
        lastIngestAt: toIso(mqttLastIngestAt),
        lastErrorAt: toIso(mqttLastErrorAt),
        lastError: mqttLastError,
        healthy: mqttHealthy,
      },
      control: {
        configured: controlSnapshot.configured,
        disabled: controlDisabled,
        lastCommandAt: toIso(controlLastCommandAt),
        lastErrorAt: toIso(controlLastErrorAt),
        lastError: controlLastError,
        healthy: controlHealthy,
      },
      heatPumpHistory: {
        configured: heatPumpConfigured,
        disabled: heatPumpHistoryDisabled,
        lastSuccessAt: toIso(heatPumpLastSuccessAt),
        lastErrorAt: toIso(heatPumpLastErrorAt),
        lastError: heatPumpLastError,
        lastCheckAt: toIso(heatPumpLastCheckAt),
        healthy: heatPumpHealthy,
      },
      alertsWorker: {
        lastHeartbeatAt: toIso(alertsHeartbeat),
        healthy: alertsHealthy,
      },
      push,
      antivirus: {
        configured: antivirusStatus.configured,
        enabled: antivirusStatus.enabled,
        target: antivirusStatus.target,
        lastRunAt: antivirusStatus.lastRunAt,
        lastResult: antivirusStatus.lastResult,
        lastError: antivirusStatus.lastError,
        latencyMs: antivirusLatencyMs,
      },
      maintenance: undefined,
      storage: {
        root: storageRoot,
        writable: storageWritable,
        latencyMs: storageLatencyMs,
      },
      alertsEngine,
    };

    try {
      const maintenanceRes = await query<{ open_count: string; overdue_count: string }>(
        `
        select
          count(*) filter (where status in ('open', 'in_progress')) as open_count,
          count(*) filter (
            where status in ('open', 'in_progress')
              and sla_due_at is not null
              and sla_due_at < $1
          ) as overdue_count
        from work_orders
      `,
        [now]
      );
      const maintenanceRow = maintenanceRes.rows[0] ?? { open_count: '0', overdue_count: '0' };
      body.maintenance = {
        openCount: Number(maintenanceRow.open_count ?? 0),
        overdueCount: Number(maintenanceRow.overdue_count ?? 0),
        lastCalcAt: now.toISOString(),
      };
    } catch (maintenanceErr) {
      log.warn({ err: maintenanceErr }, 'maintenance snapshot failed');
      body.maintenance = {
        openCount: 0,
        overdueCount: 0,
        lastCalcAt: now.toISOString(),
      };
    }

    return { status: 200, body };
  } catch (error) {
    log.error({ err: error }, 'health-plus failed');
    const fallback: HealthPlusPayload = {
      ok: false,
      env,
      db: 'error',
      dbLatencyMs,
      version,
      vendorFlags,
      mqtt: {
        configured: mqttSnapshot.configured,
        disabled: mqttDisabled,
        lastIngestAt: null,
        lastErrorAt: null,
        lastError: mqttSnapshot.lastError ?? null,
        healthy: mqttDisabled || !mqttSnapshot.configured,
      },
      control: {
        configured: controlSnapshot.configured,
        disabled: controlDisabled,
        lastCommandAt: null,
        lastErrorAt: null,
        lastError: controlSnapshot.lastError ?? null,
        healthy: controlDisabled || !controlSnapshot.configured,
      },
      heatPumpHistory: {
        configured: heatPumpConfigured,
        disabled: heatPumpHistoryDisabled,
        lastSuccessAt: null,
        lastErrorAt: null,
        lastError: null,
        lastCheckAt: null,
        healthy: heatPumpHistoryDisabled || !heatPumpConfigured,
      },
      alertsWorker: {
        lastHeartbeatAt: null,
        healthy: false,
      },
      push: {
        enabled: pushEnabled,
        disabled: pushDisabled,
        lastSampleAt: null,
        lastError: null,
      },
      antivirus: {
        configured: antivirusStatus.configured,
        enabled: antivirusStatus.enabled,
        target: antivirusStatus.target,
        lastRunAt: antivirusStatus.lastRunAt,
        lastResult: antivirusStatus.lastResult,
        lastError: antivirusStatus.lastError,
        latencyMs: antivirusLatencyMs,
      },
      storage: {
        root: storageRoot,
        writable: false,
        latencyMs: storageLatencyMs,
      },
      maintenance: {
        openCount: 0,
        overdueCount: 0,
        lastCalcAt: null,
      },
      alertsEngine: {
        lastRunAt: null,
        lastDurationMs: null,
        rulesLoaded: null,
        activeAlertsTotal: null,
        activeWarning: null,
        activeCritical: null,
        activeInfo: null,
        evaluated: null,
        triggered: null,
      },
    };

    return { status: 500, body: fallback, error };
  }
}
