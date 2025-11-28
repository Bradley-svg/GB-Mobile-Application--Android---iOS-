import 'dotenv/config';
import { initMqtt } from '../services/mqttClient';

console.log('Starting MQTT ingest worker...');
initMqtt();
