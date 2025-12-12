import EventEmitter from 'events';
import mqtt, { type IClientOptions, type MqttClient } from 'mqtt';
import { handleTelemetryMessage } from '../services/telemetryIngestService';
import { markMqttIngestError, markMqttIngestSuccess } from '../services/statusService';
import { logger } from '../config/logger';
import { getVendorMqttConfig } from '../config/vendorMqttControl';

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
type ClientFactory = (url: string, options: IClientOptions) => MqttClient;
let clientFactory: ClientFactory | null = null;

export function setMqttClientFactory(factory: ClientFactory | null) {
  clientFactory = factory;
}

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

function createMockClient(): MqttClient {
  const emitter = new EventEmitter() as unknown as MqttClient & { connected?: boolean };
  emitter.connected = false;
  emitter.subscribe = ((_topic: string, cb?: (err?: Error) => void) => {
    cb?.();
    return emitter;
  }) as unknown as MqttClient['subscribe'];
  emitter.publish = ((
    _topic: string,
    _message: string,
    _opts: unknown,
    cb?: (err?: Error) => void
  ) => {
    cb?.();
    return true;
  }) as unknown as MqttClient['publish'];
  emitter.end = ((_force?: boolean) => emitter) as unknown as MqttClient['end'];
  return emitter;
}

function buildClient(url: string, options: IClientOptions) {
  if (clientFactory) return clientFactory(url, options);
  if ((process.env.NODE_ENV || 'development') === 'test') {
    return createMockClient();
  }
  return mqtt.connect(url, options);
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
  const config = getVendorMqttConfig({ logMissing: false });

  return {
    configured: config.configured,
    connected: config.disabled ? false : Boolean(client?.connected),
    broker: formatBroker(config.url),
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
  const config = getVendorMqttConfig({ logMissing: false });
  if (config.disabled) {
    log.warn({ reason }, 'skipping reconnect because MQTT ingest is disabled');
    return;
  }
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
  const config = getVendorMqttConfig();
  if (config.disabled) {
    log.warn({ reason: 'disabled' }, 'MQTT ingest disabled via MQTT_DISABLED');
    return null;
  }

  if (!config.url) {
    log.warn({ reason: 'missing-url' }, 'MQTT_URL not set; MQTT ingest is disabled');
    return null;
  }

  client = buildClient(config.url, {
    username: config.username || undefined,
    password: config.password || undefined,
    reconnectPeriod: 0,
    connectTimeout: config.connectTimeoutMs,
  });

  client.on('connect', () => {
    resetBackoff();
    const mutable = client as unknown as (EventEmitter & { connected?: boolean }) | null;
    if (mutable) mutable.connected = true;
    log.info({ broker: formatBroker(config.url), retry: isRetry }, 'connected to broker');
    lastConnectAt = new Date();
    lastError = null;
    client!.subscribe(config.telemetryTopic, (err) => {
      if (err) {
        log.error({ err }, 'subscribe error');
      } else {
        log.info({ topic: config.telemetryTopic }, 'subscribed to telemetry topics');
      }
    });
  });

  client.on('reconnect', () => {
    log.info({ broker: formatBroker(config.url) }, 'reconnecting to broker');
  });

  client.on('message', async (topic, payload) => {
    messageCount += 1;
    const now = new Date();
    lastMessageAt = now;
    log.info({ count: messageCount, topic }, 'message received');

    try {
      const ok = await handleTelemetryMessage(topic, payload);
      if (ok) {
        lastError = null;
        await safeMarkMqttSuccess(now);
      } else {
        lastError = 'telemetry ingest returned false';
        await safeMarkMqttError(now, 'telemetry ingest returned false');
      }
    } catch (e) {
      log.error({ err: e, topic }, 'failed to handle MQTT message');
      lastError = (e as Error | undefined)?.message || 'MQTT ingest failure';
      await safeMarkMqttError(new Date(), e);
    }
  });

  client.on('error', (err) => {
    const mutable = client as unknown as (EventEmitter & { connected?: boolean }) | null;
    if (mutable) mutable.connected = false;
    log.error({ err }, 'client error');
    lastError = err?.message || 'MQTT error';
    void safeMarkMqttError(new Date(), err);
    scheduleReconnect('error');
  });

  client.on('close', () => {
    const mutable = client as unknown as (EventEmitter & { connected?: boolean }) | null;
    if (mutable) mutable.connected = false;
    log.warn('connection closed');
    lastDisconnectAt = new Date();
    scheduleReconnect('close');
  });

  return client;
}

export function initMqtt() {
  return initConnection(false);
}
