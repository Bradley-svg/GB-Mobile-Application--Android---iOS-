// These workers are designed to run as a single instance. Running multiple instances without
// coordination/locking may cause duplicate processing.
import 'dotenv/config';
import { randomUUID } from 'crypto';
import { initMqtt } from '../integrations/mqttClient';
import { logger } from '../config/logger';
import {
  acquireWorkerLock,
  releaseWorkerLock,
  renewWorkerLock,
} from '../repositories/workerLocksRepository';
import { getVendorMqttConfig } from '../config/vendorMqttControl';

const WORKER_NAME = 'mqttIngest';
const ownerId = randomUUID();
const log = logger.child({ worker: WORKER_NAME, ownerId });
let renewTimer: NodeJS.Timeout | null = null;
let mqttClient: ReturnType<typeof initMqtt> | null = null;

function parseLockTtlMs() {
  const parsed = Number(process.env.WORKER_LOCK_TTL_SEC);
  if (Number.isFinite(parsed) && parsed > 0) {
    return parsed * 1000;
  }
  return 60_000;
}

const lockTtlMs = parseLockTtlMs();

function resolveBrokerHost(url: string | undefined | null) {
  if (!url) return 'unset';
  try {
    return new URL(url).host || url;
  } catch {
    return url;
  }
}

async function shutdown(code = 0) {
  if (renewTimer) {
    clearInterval(renewTimer);
    renewTimer = null;
  }

  try {
    await releaseWorkerLock(WORKER_NAME, ownerId);
  } catch (err) {
    log.warn({ err }, 'failed to release worker lock');
  }

  if (mqttClient) {
    mqttClient.end(true);
  }

  if (code !== null) {
    process.exit(code);
  }
}

function startRenewLoop() {
  const interval = Math.max(5_000, Math.floor(lockTtlMs / 2));
  renewTimer = setInterval(async () => {
    try {
      const renewed = await renewWorkerLock(WORKER_NAME, ownerId, lockTtlMs);
      if (!renewed) {
        log.error({ ttlMs: lockTtlMs }, 'lost worker lock; shutting down to avoid duplicate ingest');
        await shutdown(0);
      }
    } catch (err) {
      log.error({ err }, 'failed to renew worker lock; shutting down to avoid duplicate ingest');
      await shutdown(1);
    }
  }, interval);
}

async function start() {
  const env = process.env.NODE_ENV || 'development';
  const mqttConfig = getVendorMqttConfig({ logMissing: false });
  const mqttUsernameSet = Boolean(mqttConfig.username);

  log.info(
    {
      env,
      broker: resolveBrokerHost(mqttConfig.url),
      disabled: mqttConfig.disabled,
      usernameConfigured: mqttUsernameSet,
      lockTtlMs,
    },
    'starting mqtt ingest worker'
  );

  if (mqttConfig.disabled) {
    log.warn({ reason: 'disabled' }, 'MQTT ingest disabled; exiting worker');
    return;
  }

  const acquired = await acquireWorkerLock(WORKER_NAME, ownerId, lockTtlMs);
  if (!acquired) {
    log.warn({ ownerId }, 'worker lock already held; exiting without starting MQTT ingest');
    return;
  }

  startRenewLoop();
  mqttClient = initMqtt();

  if (!mqttClient) {
    const reason = mqttConfig.url ? 'failed-to-connect' : 'missing-mqtt-url';
    log.warn({ reason }, 'MQTT ingest not started');
    await shutdown(0);
  }
}

const signals: NodeJS.Signals[] = ['SIGINT', 'SIGTERM'];
for (const signal of signals) {
  process.on(signal, () => {
    log.info({ signal }, 'received shutdown signal');
    void shutdown(0);
  });
}

void start().catch(async (err) => {
  log.error({ err }, 'mqtt ingest worker crashed during startup');
  await shutdown(1);
});
