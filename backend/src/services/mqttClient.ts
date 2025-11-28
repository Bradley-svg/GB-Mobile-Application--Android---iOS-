import mqtt, { MqttClient } from 'mqtt';
import { handleTelemetryMessage } from './telemetryIngestService';

let client: MqttClient | null = null;
let messageCount = 0;

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
    client!.subscribe('greenbro/+/+/telemetry', (err) => {
      if (err) console.error('[mqttIngest] subscribe error', err);
      else console.log('[mqttIngest] subscribed to greenbro/+/+/telemetry');
    });
  });

  client.on('message', async (topic, payload) => {
    messageCount += 1;
    console.log(`[mqttIngest] message #${messageCount} topic=${topic}`);

    try {
      await handleTelemetryMessage(topic, payload);
    } catch (e) {
      console.error('[mqttIngest] failed to handle MQTT message', e);
    }
  });

  client.on('error', (err) => {
    console.error('[mqttIngest] error', err);
  });

  client.on('close', () => {
    console.warn('[mqttIngest] connection closed');
  });

  return client;
}
