import mqtt, { MqttClient } from 'mqtt';
import { handleTelemetryMessage } from '../services/telemetryIngestService';
import { markMqttIngestError, markMqttIngestSuccess } from '../services/statusService';
import { logger } from '../utils/logger';

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

async function safeMarkMqttSuccess(now: Date) {
  try {
    await markMqttIngestSuccess(now);
  } catch (statusErr) {
    logger.warn(COMPONENT, 'failed to record ingest success', { error: statusErr });
  }
}

async function safeMarkMqttError(now: Date, err: unknown) {
  try {
    await markMqttIngestError(now, err);
  } catch (statusErr) {
    logger.warn(COMPONENT, 'failed to record ingest error', { error: statusErr });
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
    configured: Boolean(mqttUrl),
    connected: Boolean(client?.connected),
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
  logger.warn(COMPONENT, 'scheduling reconnect', { reason, delayMs: delay });
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
  const url = process.env.MQTT_URL;
  const username = process.env.MQTT_USERNAME;
  const password = process.env.MQTT_PASSWORD;

  if (!url) {
    logger.warn(COMPONENT, 'MQTT_URL not set; MQTT ingest is disabled');
    return null;
  }

  client = mqtt.connect(url, {
    username,
    password,
    reconnectPeriod: 0,
  });

  client.on('connect', () => {
    resetBackoff();
    logger.info(COMPONENT, 'connected to broker', { broker: formatBroker(url), retry: isRetry });
    lastConnectAt = new Date();
    lastError = null;
    client!.subscribe('greenbro/+/+/telemetry', (err) => {
      if (err) {
        logger.error(COMPONENT, 'subscribe error', { error: err });
      } else {
        logger.info(COMPONENT, 'subscribed to telemetry topics');
      }
    });
  });

  client.on('reconnect', () => {
    logger.info(COMPONENT, 'reconnecting to broker', { broker: formatBroker(url) });
  });

  client.on('message', async (topic, payload) => {
    messageCount += 1;
    const now = new Date();
    lastMessageAt = now;
    logger.info(COMPONENT, 'message received', { count: messageCount, topic });

    try {
      const ok = await handleTelemetryMessage(topic, payload);
      if (ok) {
        await safeMarkMqttSuccess(now);
      } else {
        await safeMarkMqttError(now, 'telemetry ingest returned false');
      }
    } catch (e) {
      logger.error(COMPONENT, 'failed to handle MQTT message', { error: e });
      await safeMarkMqttError(new Date(), e);
    }
  });

  client.on('error', (err) => {
    logger.error(COMPONENT, 'client error', { error: err });
    lastError = err?.message || 'MQTT error';
    safeMarkMqttError(new Date(), err);
    scheduleReconnect('error');
  });

  client.on('close', () => {
    logger.warn(COMPONENT, 'connection closed');
    lastDisconnectAt = new Date();
    scheduleReconnect('close');
  });

  return client;
}

export function initMqtt() {
  return initConnection(false);
}
