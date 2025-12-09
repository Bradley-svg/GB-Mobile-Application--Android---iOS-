import mqtt, { MqttClient } from 'mqtt';
import { handleTelemetryMessage } from '../services/telemetryIngestService';
import { markMqttIngestError, markMqttIngestSuccess } from '../services/statusService';
import { logger } from '../config/logger';

let client: MqttClient | null = null;
let messageCount = 0;
let lastMessageAt: Date | null = null;
let lastConnectAt: Date | null = null;
let lastDisconnectAt: Date | null = null;
let lastError: string | null = null;
let reconnectTimer: NodeJS.Timeout | null = null;
const BASE_RECONNECT_MS = 1000;
const MAX_RECONNECT_MS = 30_000;
let reconnectDelayMs = BASE_RECONNECT_MS;
const COMPONENT = 'mqttIngest';
const log = logger.child({ module: COMPONENT });
const MQTT_DISABLED = process.env.MQTT_DISABLED === 'true';

async function safeMarkMqttSuccess(now: Date) {
  try {
    await markMqttIngestSuccess(now);
  } catch (statusErr) {
    log.warn({ err: statusErr }, 'failed to record ingest success');
  }
}

async function safeMarkMqttError(now: Date, err: unknown) {
  try {
    await markMqttIngestError(now, err);
  } catch (statusErr) {
    log.warn({ err: statusErr }, 'failed to record ingest error');
  }
}

function formatBroker(url: string | null) {
  if (!url) return null;
  try {
    const parsed = new URL(url);
    return parsed.host || url;
  } catch {
    return url;
  }
}

export type MqttHealth = {
  configured: boolean;
  connected: boolean;
  broker: string | null;
  lastMessageAt: string | null;
  lastConnectAt: string | null;
  lastDisconnectAt: string | null;
  lastError: string | null;
};

export function getMqttHealth(): MqttHealth {
  const mqttUrl = process.env.MQTT_URL || null;

  return {
    configured: MQTT_DISABLED ? false : Boolean(mqttUrl),
    connected: MQTT_DISABLED ? false : Boolean(client?.connected),
    broker: formatBroker(mqttUrl),
    lastMessageAt: lastMessageAt ? lastMessageAt.toISOString() : null,
    lastConnectAt: lastConnectAt ? lastConnectAt.toISOString() : null,
    lastDisconnectAt: lastDisconnectAt ? lastDisconnectAt.toISOString() : null,
    lastError,
  };
}

function clearReconnectTimer() {
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }
}

function scheduleReconnect(reason: string) {
  if (reconnectTimer) return;
  const delay = reconnectDelayMs;
  reconnectDelayMs = Math.min(reconnectDelayMs * 2, MAX_RECONNECT_MS);
  log.warn({ reason, delayMs: delay }, 'scheduling reconnect');
  reconnectTimer = setTimeout(() => {
    reconnectTimer = null;
    initConnection(true);
  }, delay);
}

function resetBackoff() {
  reconnectDelayMs = BASE_RECONNECT_MS;
  clearReconnectTimer();
}

function initConnection(isRetry: boolean) {
  if (MQTT_DISABLED) {
    log.warn({ reason: 'disabled' }, 'MQTT ingest disabled via MQTT_DISABLED');
    return null;
  }

  const url = process.env.MQTT_URL;
  const username = process.env.MQTT_USERNAME;
  const password = process.env.MQTT_PASSWORD;

  if (!url) {
    log.warn({ reason: 'missing-url' }, 'MQTT_URL not set; MQTT ingest is disabled');
    return null;
  }

  client = mqtt.connect(url, {
    username,
    password,
    reconnectPeriod: 0,
  });

  client.on('connect', () => {
    resetBackoff();
    log.info({ broker: formatBroker(url), retry: isRetry }, 'connected to broker');
    lastConnectAt = new Date();
    lastError = null;
    client!.subscribe('greenbro/+/+/telemetry', (err) => {
      if (err) {
        log.error({ err }, 'subscribe error');
      } else {
        log.info('subscribed to telemetry topics');
      }
    });
  });

  client.on('reconnect', () => {
    log.info({ broker: formatBroker(url) }, 'reconnecting to broker');
  });

  client.on('message', async (topic, payload) => {
    messageCount += 1;
    const now = new Date();
    lastMessageAt = now;
    log.info({ count: messageCount, topic }, 'message received');

    try {
      const ok = await handleTelemetryMessage(topic, payload);
      if (ok) {
        await safeMarkMqttSuccess(now);
      } else {
        await safeMarkMqttError(now, 'telemetry ingest returned false');
      }
    } catch (e) {
      log.error({ err: e, topic }, 'failed to handle MQTT message');
      await safeMarkMqttError(new Date(), e);
    }
  });

  client.on('error', (err) => {
    log.error({ err }, 'client error');
    lastError = err?.message || 'MQTT error';
    safeMarkMqttError(new Date(), err);
    scheduleReconnect('error');
  });

  client.on('close', () => {
    log.warn('connection closed');
    lastDisconnectAt = new Date();
    scheduleReconnect('close');
  });

  return client;
}

export function initMqtt() {
  return initConnection(false);
}
