import 'dotenv/config';
import { query } from '../db/pool';
import { clearAlertIfExists, upsertActiveAlert } from '../services/alertService';
import { sendAlertNotification } from '../services/pushService';

const OFFLINE_MINUTES = Number(process.env.ALERT_OFFLINE_MINUTES || 10);
const HIGH_TEMP_THRESHOLD = Number(process.env.ALERT_HIGH_TEMP_THRESHOLD || 60);

async function evaluateOfflineAlerts(now: Date) {
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
    const { alert, isNew } = await upsertActiveAlert({
      siteId: row.site_id,
      deviceId: row.id,
      type: 'offline',
      severity: 'warning',
      message: `Device offline for more than ${OFFLINE_MINUTES} minutes`,
      now,
    });

    if (isNew && alert.severity === 'critical') {
      await sendAlertNotification(alert);
    }
  }

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
}

async function evaluateHighTempAlerts(now: Date) {
  const res = await query<{
    id: string;
    site_id: string;
    supply_temp: number | null;
  }>(
    `
    select d.id, d.site_id,
           (s.data->>'supplyTemp')::double precision as supply_temp
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
}

async function runOnce() {
  const now = new Date();
  console.log(`[alertsWorker] running at ${now.toISOString()}`);

  try {
    await evaluateOfflineAlerts(now);
    await evaluateHighTempAlerts(now);
  } catch (e) {
    console.error('[alertsWorker] error', e);
  }
}

function start() {
  const intervalSec = Number(process.env.ALERT_WORKER_INTERVAL_SEC || 60);
  console.log(
    `Starting alertsWorker. Offline threshold=${OFFLINE_MINUTES}min, highTemp=${HIGH_TEMP_THRESHOLD}C, interval=${intervalSec}s`
  );

  runOnce();
  setInterval(runOnce, intervalSec * 1000);
}

start();
