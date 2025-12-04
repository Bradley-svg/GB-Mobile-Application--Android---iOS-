import 'dotenv/config';
import { initMqtt } from '../integrations/mqttClient';

const env = process.env.NODE_ENV || 'development';
const mqttUrl = process.env.MQTT_URL;
const mqttUsernameSet = Boolean(process.env.MQTT_USERNAME);

let brokerHost = 'unset';
if (mqttUrl) {
  try {
    brokerHost = new URL(mqttUrl).host || mqttUrl;
  } catch {
    brokerHost = mqttUrl;
  }
}

console.log(
  `[mqttIngest] starting (env=${env}, broker=${brokerHost}, usernameConfigured=${mqttUsernameSet})`
);
const mqttClient = initMqtt();

if (!mqttClient) {
  console.warn('[mqttIngest] MQTT ingest not started (MQTT_URL missing)');
}
