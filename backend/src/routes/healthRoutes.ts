import { Router } from 'express';
import { query } from '../db/pool';
import { getControlChannelStatus } from '../services/deviceControlService';
import { getMqttHealth } from '../services/mqttClient';
import { runPushHealthCheck } from '../services/pushService';
import { getStatus } from '../services/statusService';
import type { AlertsWorkerHeartbeat } from '../workers/alertsWorker';

const router = Router();

router.get('/health', (_req, res) => {
  res.json({ ok: true });
});

router.get('/health-plus', async (_req, res) => {
  const env = process.env.NODE_ENV || 'development';
  const version = process.env.APP_VERSION || 'unknown';
  const mqtt = getMqttHealth();
  const control = getControlChannelStatus();
  const fallbackAlerts = { last_run_at: null };
  const fallbackPush = { configured: false, tokensPresent: false, lastSample: null };

  try {
    const dbRes = await query('select 1 as ok');
    const dbOk = dbRes.rows[0]?.ok === 1;

    const [alertsWorkerStatus, pushStatus] = await Promise.all([
      getStatus<AlertsWorkerHeartbeat>('alerts_worker').catch(() => null),
      runPushHealthCheck().catch((err) => ({
        configured: false,
        tokensPresent: false,
        lastSample: {
          status: 'error' as const,
          detail: err instanceof Error ? err.message : 'Unknown push health error',
          at: new Date().toISOString(),
        },
      })),
    ]);

    const alertsWorker = alertsWorkerStatus
      ? {
          ...alertsWorkerStatus.payload,
          updated_at: alertsWorkerStatus.updated_at.toISOString(),
        }
      : { last_run_at: null };

    res.json({
      ok: true,
      env,
      db: dbOk ? 'ok' : 'error',
      version,
      mqtt,
      control,
      alertsWorker,
      push: pushStatus,
    });
  } catch (e) {
    console.error('health-plus error', e);
    res.status(500).json({
      ok: false,
      env,
      db: 'error',
      version,
      mqtt,
      control,
      alertsWorker: fallbackAlerts,
      push: fallbackPush,
    });
  }
});

export default router;
