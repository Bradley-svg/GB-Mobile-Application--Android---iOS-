import fs from 'fs';
import { query } from '../config/db';
import { getControlChannelStatus } from './deviceControlService';
import { getMqttHealth } from '../integrations/mqttClient';
import { runPushHealthCheck, type PushHealthStatus } from './pushService';
import { type SystemStatus, getSystemStatus, getSystemStatusByKey } from './statusService';
import { logger } from '../config/logger';
import { getStorageRoot } from '../config/storage';
import { getHeatPumpHistoryConfig } from '../integrations/heatPumpHistoryClient';

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

export type HealthPlusPayload = {
  ok: boolean;
  env: string;
  db: 'ok' | 'error';
  version: string | null;
  mqtt: {
    configured: boolean;
    lastIngestAt: string | null;
    lastErrorAt: string | null;
    lastError: string | null;
    healthy: boolean;
  };
  control: {
    configured: boolean;
    lastCommandAt: string | null;
    lastErrorAt: string | null;
    lastError: string | null;
    healthy: boolean;
  };
  heatPumpHistory: {
    configured: boolean;
    lastSuccessAt: string | null;
    lastErrorAt: string | null;
    lastError: string | null;
    healthy: boolean;
  };
  alertsWorker: {
    lastHeartbeatAt: string | null;
    healthy: boolean;
  };
  push: {
    enabled: boolean;
    lastSampleAt: string | null;
    lastError: string | null;
  };
  maintenance?: {
    openCount: number;
    overdueCount: number;
    lastCalcAt: string | null;
  };
  storage?: {
    root: string;
    writable: boolean;
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
  const mqttSnapshot = getMqttHealth();
  const controlSnapshot = getControlChannelStatus();
  const pushEnabled = process.env.PUSH_HEALTHCHECK_ENABLED === 'true';
  const alertsIntervalSec = Number(process.env.ALERT_WORKER_INTERVAL_SEC || 60);
  const alertsHeartbeatWindowMs = Math.max(alertsIntervalSec * 2 * 1000, 60 * 1000);
  const alertsWorkerEnabled =
    (process.env.ALERT_WORKER_ENABLED || 'true').toLowerCase() !== 'false';
  const alertsExpected = env === 'production' && alertsWorkerEnabled;
  const heatPumpConfigured = getHeatPumpHistoryConfig().configured;

  try {
    const dbRes = await query('select 1 as ok');
    const dbOk = dbRes.rows[0]?.ok === 1;
    const storageRoot = getStorageRoot();
    let storageWritable = false;

    try {
      await fs.promises.mkdir(storageRoot, { recursive: true });
      await fs.promises.access(storageRoot, fs.constants.W_OK);
      storageWritable = true;
    } catch (storageErr) {
      log.warn({ err: storageErr }, 'storage root not writable');
    }

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
    const mqttHealthy = statusLoadFailed
      ? !mqttSnapshot.configured
      : !mqttSnapshot.configured || (!mqttStale && !mqttRecentError);

    const controlLastCommandAt = systemStatus?.control_last_command_at ?? null;
    const controlLastErrorAt = systemStatus?.control_last_error_at ?? null;
    const controlLastError =
      systemStatus?.control_last_error ?? controlSnapshot.lastError ?? null;
    const controlRecentError =
      controlSnapshot.configured &&
      isRecent(controlLastErrorAt, CONTROL_ERROR_WINDOW_MS, now) &&
      (!controlLastCommandAt || (controlLastErrorAt as Date) >= controlLastCommandAt);
    const controlHealthy = statusLoadFailed
      ? !controlSnapshot.configured
      : !controlSnapshot.configured || !controlRecentError;

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
      lastSampleAt: toIso(pushLastSampleAt),
      lastError: pushEnabled ? pushLastError : null,
    };

    const heatPumpLastSuccessAt = systemStatus?.heat_pump_history_last_success_at ?? null;
    const heatPumpLastErrorAt = systemStatus?.heat_pump_history_last_error_at ?? null;
    const heatPumpLastError = systemStatus?.heat_pump_history_last_error ?? null;
    const heatPumpSuccessRecent =
      heatPumpConfigured && !isStale(heatPumpLastSuccessAt, HEAT_PUMP_HISTORY_STALE_MS, now);
    const heatPumpErrorRecent =
      heatPumpConfigured && isRecent(heatPumpLastErrorAt, HEAT_PUMP_HISTORY_STALE_MS, now);
    const heatPumpHealthy = statusLoadFailed
      ? !heatPumpConfigured
      : !heatPumpConfigured ||
        (heatPumpSuccessRecent && (!heatPumpErrorRecent || (heatPumpLastSuccessAt as Date) >= (heatPumpLastErrorAt as Date)));

    const ok = statusLoadFailed
      ? dbOk
      : dbOk &&
        (!mqttSnapshot.configured || mqttHealthy) &&
        (!controlSnapshot.configured || controlHealthy) &&
        (!alertsExpected || alertsHealthy) &&
        (!push.enabled || !push.lastError) &&
        (!heatPumpConfigured || heatPumpHealthy);

    const body: HealthPlusPayload = {
      ok,
      env,
      db: dbOk ? 'ok' : 'error',
      version,
      mqtt: {
        configured: mqttSnapshot.configured,
        lastIngestAt: toIso(mqttLastIngestAt),
        lastErrorAt: toIso(mqttLastErrorAt),
        lastError: mqttLastError,
        healthy: mqttHealthy,
      },
      control: {
        configured: controlSnapshot.configured,
        lastCommandAt: toIso(controlLastCommandAt),
        lastErrorAt: toIso(controlLastErrorAt),
        lastError: controlLastError,
        healthy: controlHealthy,
      },
      heatPumpHistory: {
        configured: heatPumpConfigured,
        lastSuccessAt: toIso(heatPumpLastSuccessAt),
        lastErrorAt: toIso(heatPumpLastErrorAt),
        lastError: heatPumpLastError,
        healthy: heatPumpHealthy,
      },
      alertsWorker: {
        lastHeartbeatAt: toIso(alertsHeartbeat),
        healthy: alertsHealthy,
      },
      push,
      maintenance: undefined,
      storage: {
        root: storageRoot,
        writable: storageWritable,
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
      version,
      mqtt: {
        configured: mqttSnapshot.configured,
        lastIngestAt: null,
        lastErrorAt: null,
        lastError: mqttSnapshot.lastError ?? null,
        healthy: !mqttSnapshot.configured,
      },
      control: {
        configured: controlSnapshot.configured,
        lastCommandAt: null,
        lastErrorAt: null,
        lastError: controlSnapshot.lastError ?? null,
        healthy: !controlSnapshot.configured,
      },
      heatPumpHistory: {
        configured: heatPumpConfigured,
        lastSuccessAt: null,
        lastErrorAt: null,
        lastError: null,
        healthy: !heatPumpConfigured,
      },
      alertsWorker: {
        lastHeartbeatAt: null,
        healthy: false,
      },
      push: {
        enabled: pushEnabled,
        lastSampleAt: null,
        lastError: null,
      },
      storage: {
        root: getStorageRoot(),
        writable: false,
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
