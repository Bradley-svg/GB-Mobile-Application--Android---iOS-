// These workers are designed to run as a single instance. Running multiple instances without
// coordination/locking may cause duplicate processing.
import 'dotenv/config';
import { initMqtt } from '../integrations/mqttClient';
import { logger } from '../utils/logger';

// TODO: Migrate to structured JSON logging (e.g. pino) for production observability.

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

logger.info('mqttIngest', 'starting', {
  env,
  broker: brokerHost,
  usernameConfigured: mqttUsernameSet,
});
const mqttClient = initMqtt();

if (!mqttClient) {
  logger.warn('mqttIngest', 'MQTT ingest not started (MQTT_URL missing)');
}
