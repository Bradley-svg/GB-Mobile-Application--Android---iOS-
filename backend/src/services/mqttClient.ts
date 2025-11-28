import mqtt, { MqttClient } from 'mqtt';
import { handleTelemetryMessage } from './telemetryIngestService';

let client: MqttClient | null = null;

export function initMqtt() {
  const url = process.env.MQTT_URL;
  const username = process.env.MQTT_USERNAME;
  const password = process.env.MQTT_PASSWORD;

  if (!url) {
    console.warn('MQTT_URL not set; MQTT ingest is disabled');
    return;
  }

  client = mqtt.connect(url, {
    username,
    password,
  });

  client.on('connect', () => {
    console.log('MQTT connected');
    client!.subscribe('greenbro/+/+/telemetry', (err) => {
      if (err) console.error('MQTT subscribe error', err);
      else console.log('MQTT subscribed to greenbro/+/+/telemetry');
    });
  });

  client.on('message', async (topic, payload) => {
    try {
      await handleTelemetryMessage(topic, payload);
    } catch (e) {
      console.error('Failed to handle MQTT message', e);
    }
  });

  client.on('error', (err) => {
    console.error('MQTT error', err);
  });

  client.on('close', () => {
    console.warn('MQTT connection closed');
  });
}
