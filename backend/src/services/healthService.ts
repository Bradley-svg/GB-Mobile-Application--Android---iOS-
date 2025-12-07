import { query } from '../config/db';
import { getControlChannelStatus } from './deviceControlService';
import { getMqttHealth } from '../integrations/mqttClient';
import { runPushHealthCheck, type PushHealthStatus } from './pushService';
import { type SystemStatus, getSystemStatus, getSystemStatusByKey } from './statusService';
import { logger } from '../config/logger';

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
  alertsEngine: {
    lastRunAt: string | null;
    lastDurationMs: number | null;
    rulesLoaded: number | null;
    activeWarning: number | null;
    activeCritical: number | null;
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
  const heatPumpConfigured = Boolean(
    process.env.HEATPUMP_HISTORY_API_KEY || process.env.HEAT_PUMP_HISTORY_API_KEY
  );

  try {
    const dbRes = await query('select 1 as ok');
    const dbOk = dbRes.rows[0]?.ok === 1;

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

    const alertsPayload = (alertsEngineStatus?.payload ??
      {}) as Record<string, unknown> & {
      lastRunAt?: string | null;
      lastDurationMs?: number | null;
      rulesLoaded?: number | null;
      activeCounts?: { warning?: number; critical?: number };
    };
    const alertsEngine = {
      lastRunAt: toIso(alertsPayload.lastRunAt as string | null),
      lastDurationMs:
        typeof alertsPayload.lastDurationMs === 'number' ? alertsPayload.lastDurationMs : null,
      rulesLoaded: typeof alertsPayload.rulesLoaded === 'number' ? alertsPayload.rulesLoaded : null,
      activeWarning:
        typeof alertsPayload.activeCounts?.warning === 'number'
          ? alertsPayload.activeCounts.warning
          : null,
      activeCritical:
        typeof alertsPayload.activeCounts?.critical === 'number'
          ? alertsPayload.activeCounts.critical
          : null,
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
      alertsEngine,
    };

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
      alertsEngine: {
        lastRunAt: null,
        lastDurationMs: null,
        rulesLoaded: null,
        activeWarning: null,
        activeCritical: null,
      },
    };

    return { status: 500, body: fallback, error };
  }
}
