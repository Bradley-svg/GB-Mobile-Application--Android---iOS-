import mqtt, { MqttClient } from 'mqtt';
import { handleTelemetryMessage } from './telemetryIngestService';
import { markMqttIngestError, markMqttIngestSuccess } from './statusService';

let client: MqttClient | null = null;
let messageCount = 0;
let lastMessageAt: Date | null = null;
let lastConnectAt: Date | null = null;
let lastDisconnectAt: Date | null = null;
let lastError: string | null = null;

async function safeMarkMqttSuccess(now: Date) {
  try {
    await markMqttIngestSuccess(now);
  } catch (statusErr) {
    console.warn('[mqttIngest] failed to record ingest success', statusErr);
  }
}

async function safeMarkMqttError(now: Date, err: unknown) {
  try {
    await markMqttIngestError(now, err);
  } catch (statusErr) {
    console.warn('[mqttIngest] failed to record ingest error', statusErr);
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

export function initMqtt() {
  const url = process.env.MQTT_URL;
  const username = process.env.MQTT_USERNAME;
  const password = process.env.MQTT_PASSWORD;

  if (!url) {
    console.warn('MQTT_URL not set; MQTT ingest is disabled');
    return null;
  }

  client = mqtt.connect(url, {
    username,
    password,
  });

  client.on('connect', () => {
    console.log('[mqttIngest] connected to broker');
    lastConnectAt = new Date();
    lastError = null;
    client!.subscribe('greenbro/+/+/telemetry', (err) => {
      if (err) console.error('[mqttIngest] subscribe error', err);
      else console.log('[mqttIngest] subscribed to greenbro/+/+/telemetry');
    });
  });

  client.on('message', async (topic, payload) => {
    messageCount += 1;
    const now = new Date();
    lastMessageAt = now;
    console.log(`[mqttIngest] message #${messageCount} topic=${topic}`);

    try {
      const ok = await handleTelemetryMessage(topic, payload);
      if (ok) {
        await safeMarkMqttSuccess(now);
      } else {
        await safeMarkMqttError(now, 'telemetry ingest returned false');
      }
    } catch (e) {
      console.error('[mqttIngest] failed to handle MQTT message', e);
      await safeMarkMqttError(new Date(), e);
    }
  });

  client.on('error', (err) => {
    console.error('[mqttIngest] error', err);
    lastError = err?.message || 'MQTT error';
    safeMarkMqttError(new Date(), err);
  });

  client.on('close', () => {
    console.warn('[mqttIngest] connection closed');
    lastDisconnectAt = new Date();
  });

  return client;
}
