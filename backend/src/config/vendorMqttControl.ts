import { logger } from './logger';

const DEFAULT_TELEMETRY_TOPIC = 'greenbro/+/+/telemetry';
const DEFAULT_COMMAND_TOPIC_TEMPLATE = 'greenbro/{deviceExternalId}/commands';
const DEFAULT_MQTT_CONNECT_TIMEOUT_MS = 10_000;
const DEFAULT_COMMAND_THROTTLE_MS = 5_000;

type ConfigOpts = { logMissing?: boolean };

export type VendorMqttConfig = {
  url: string | null;
  username: string | null;
  password: string | null;
  telemetryTopic: string;
  connectTimeoutMs: number;
  disabled: boolean;
  configured: boolean;
  missingKeys: string[];
};

export type VendorControlConfig = {
  transport: 'http' | 'mqtt' | null;
  disabled: boolean;
  configured: boolean;
  apiUrl: string | null;
  apiKey: string | null;
  mqttUrl: string | null;
  mqttUsername: string | null;
  mqttPassword: string | null;
  commandTopicTemplate: string;
  commandThrottleMs: number;
  missingKeys: string[];
};

let mqttMissingWarned = false;
let controlMissingWarned = false;

function cleanEnv(key: string) {
  const raw = process.env[key];
  if (!raw) return null;
  const trimmed = raw.trim();
  return trimmed.length === 0 ? null : trimmed;
}

function parsePositiveInt(value: string | null, fallback: number) {
  if (!value) return fallback;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return parsed;
}

export function getVendorMqttConfig(opts: ConfigOpts = {}): VendorMqttConfig {
  const disabled = process.env.MQTT_DISABLED === 'true';
  const url = cleanEnv('MQTT_URL');
  const username = cleanEnv('MQTT_USERNAME');
  const password = cleanEnv('MQTT_PASSWORD');
  const telemetryTopic = cleanEnv('MQTT_TELEMETRY_TOPIC') || DEFAULT_TELEMETRY_TOPIC;
  const connectTimeoutMs = parsePositiveInt(
    cleanEnv('MQTT_CONNECT_TIMEOUT_MS'),
    DEFAULT_MQTT_CONNECT_TIMEOUT_MS
  );
  const missingKeys = disabled || url ? [] : ['MQTT_URL'];
  if (!disabled && missingKeys.length > 0 && opts.logMissing !== false && !mqttMissingWarned) {
    logger.warn({ missing: missingKeys }, 'MQTT ingest config missing required env vars');
    mqttMissingWarned = true;
  }

  return {
    url,
    username,
    password,
    telemetryTopic,
    connectTimeoutMs,
    disabled,
    configured: !disabled && Boolean(url),
    missingKeys,
  };
}

export function getVendorControlConfig(opts: ConfigOpts = {}): VendorControlConfig {
  const disabled = process.env.CONTROL_API_DISABLED === 'true';
  const apiUrl = cleanEnv('CONTROL_API_URL');
  const apiKey = cleanEnv('CONTROL_API_KEY');
  const mqttConfig = getVendorMqttConfig({ logMissing: false });
  const commandTopicTemplate =
    cleanEnv('MQTT_CONTROL_TOPIC_TEMPLATE') || DEFAULT_COMMAND_TOPIC_TEMPLATE;
  const commandThrottleMs = parsePositiveInt(
    cleanEnv('CONTROL_COMMAND_THROTTLE_MS'),
    DEFAULT_COMMAND_THROTTLE_MS
  );

  let transport: VendorControlConfig['transport'] = null;
  const missingKeys: string[] = [];

  if (!disabled && apiUrl && apiKey) {
    transport = 'http';
  } else if (!disabled && (apiUrl || apiKey) && !(apiUrl && apiKey)) {
    missingKeys.push(apiUrl ? 'CONTROL_API_KEY' : 'CONTROL_API_URL');
  } else if (!disabled && mqttConfig.configured) {
    transport = 'mqtt';
  } else if (!disabled && !mqttConfig.configured) {
    missingKeys.push('CONTROL_API_URL', 'CONTROL_API_KEY');
  }

  if (!disabled && missingKeys.length > 0 && opts.logMissing !== false && !controlMissingWarned) {
    logger.warn({ missing: missingKeys }, 'Control channel config missing required env vars');
    controlMissingWarned = true;
  }

  return {
    transport,
    disabled,
    configured: !disabled && transport !== null,
    apiUrl,
    apiKey,
    mqttUrl: mqttConfig.url,
    mqttUsername: mqttConfig.username,
    mqttPassword: mqttConfig.password,
    commandTopicTemplate,
    commandThrottleMs,
    missingKeys,
  };
}
