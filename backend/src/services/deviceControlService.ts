import mqtt, { MqttClient } from 'mqtt';
import { sendControlOverHttp } from '../integrations/controlClient';
import {
  insertCommandRow,
  markCommandFailure,
  markCommandSuccess as markCommandSuccessRow,
} from '../repositories/controlCommandsRepository';
import { getDeviceById } from './deviceService';
import { markControlCommandError, markControlCommandSuccess } from './statusService';
import {
  ControlValidationError,
  DeviceCapabilities,
  ModeCommandPayload,
  SetpointCommandPayload,
  validateModeCommand,
  validateSetpointCommand,
} from './deviceControlValidationService';
import { logger } from '../utils/logger';

let commandClient: MqttClient | null = null;
const controlHttpUrl = () => process.env.CONTROL_API_URL;
const controlHttpKey = () => process.env.CONTROL_API_KEY;
export const CONTROL_CHANNEL_UNCONFIGURED = 'CONTROL_CHANNEL_UNCONFIGURED';
let lastControlError: string | null = null;
let lastControlAttemptAt: Date | null = null;
const COMMAND_SOURCE = 'api';

type ControlConfig =
  | { type: 'http'; url: string; apiKey: string }
  | { type: 'mqtt'; url: string };

function recordControlError(err: unknown) {
  if (err instanceof Error) {
    lastControlError = err.message;
  } else if (typeof err === 'string') {
    lastControlError = err;
  } else {
    lastControlError = 'Unknown control error';
  }
}

function formatTarget(url: string | null) {
  if (!url) return null;
  try {
    const parsed = new URL(url);
    return parsed.host || url;
  } catch {
    return url;
  }
}

async function safeMarkControlSuccess(now: Date) {
  try {
    await markControlCommandSuccess(now);
  } catch (statusErr) {
    logger.warn('command', 'failed to record control success', { error: statusErr });
  }
}

async function safeMarkControlError(now: Date, err: unknown) {
  try {
    await markControlCommandError(now, err);
  } catch (statusErr) {
    logger.warn('command', 'failed to record control error', { error: statusErr });
  }
}

function resolveControlConfig(): ControlConfig {
  const httpUrl = controlHttpUrl();
  const httpKey = controlHttpKey();

  if (httpUrl) {
    if (!httpKey) {
      recordControlError(CONTROL_CHANNEL_UNCONFIGURED);
      throw new Error(CONTROL_CHANNEL_UNCONFIGURED);
    }
    lastControlError = null;
    return { type: 'http', url: httpUrl, apiKey: httpKey };
  }

  const mqttUrl = process.env.MQTT_URL;
  if (!mqttUrl) {
    recordControlError(CONTROL_CHANNEL_UNCONFIGURED);
    throw new Error(CONTROL_CHANNEL_UNCONFIGURED);
  }

  lastControlError = null;
  return { type: 'mqtt', url: mqttUrl };
}

function getCommandClient(config?: Extract<ControlConfig, { type: 'mqtt' }>) {
  if (commandClient) return commandClient;

  const url = config?.url || process.env.MQTT_URL;
  const username = process.env.MQTT_USERNAME;
  const password = process.env.MQTT_PASSWORD;

  if (!url) {
    throw new Error('MQTT_URL not set; cannot send commands');
  }

  commandClient = mqtt.connect(url, { username, password });

  commandClient.on('connect', () => {
    logger.info('command', 'MQTT command client connected', { broker: formatTarget(url) });
  });

  commandClient.on('error', (err) => {
    logger.error('command', 'MQTT command error', { error: err });
  });

  return commandClient;
}

async function publishCommand(
  topic: string,
  message: string,
  config: Extract<ControlConfig, { type: 'mqtt' }>
) {
  const client = getCommandClient(config);

  await new Promise<void>((resolve, reject) => {
    client.publish(topic, message, { qos: 1 }, (err?: Error) => {
      if (err) {
        reject(err);
      } else {
        resolve();
      }
    });
  });
}

async function sendSetpointToExternal(
  deviceExternalId: string,
  payload: SetpointCommandPayload,
  controlConfig: ControlConfig
) {
  lastControlAttemptAt = new Date();

  const body = {
    type: 'setpoint' as const,
    payload: {
      metric: payload.metric,
      value: payload.value,
    },
  };

  if (controlConfig.type === 'http') {
    logger.info('command', 'sending setpoint over HTTP', {
      deviceExternalId,
      metric: payload.metric,
      value: payload.value,
      transport: 'http',
    });
    try {
      await sendControlOverHttp(deviceExternalId, body, controlConfig);
      lastControlError = null;
      return;
    } catch (err) {
      logger.error('command', 'setpoint HTTP send failed', {
        deviceExternalId,
        metric: payload.metric,
        value: payload.value,
        error: err,
      });
      recordControlError(err);
      throw err;
    }
  }

  const topic = `greenbro/${deviceExternalId}/commands`;
  const message = JSON.stringify(body);

  logger.info('command', 'publishing setpoint', {
    deviceExternalId,
    metric: payload.metric,
    value: payload.value,
    transport: 'mqtt',
  });

  try {
    await publishCommand(topic, message, controlConfig);
    logger.info('command', 'setpoint publish success', { deviceExternalId });
    lastControlError = null;
  } catch (err) {
    logger.error('command', 'setpoint publish failed', { deviceExternalId, error: err });
    recordControlError(err);
    throw err instanceof Error ? err : new Error('Failed to publish setpoint command');
  }
}

async function sendModeToExternal(
  deviceExternalId: string,
  payload: ModeCommandPayload,
  controlConfig: ControlConfig
) {
  lastControlAttemptAt = new Date();

  const body = {
    type: 'mode' as const,
    payload: {
      mode: payload.mode,
    },
  };

  if (controlConfig.type === 'http') {
    logger.info('command', 'sending mode over HTTP', {
      deviceExternalId,
      mode: payload.mode,
      transport: 'http',
    });
    try {
      await sendControlOverHttp(deviceExternalId, body, controlConfig);
      lastControlError = null;
      return;
    } catch (err) {
      logger.error('command', 'mode HTTP send failed', {
        deviceExternalId,
        mode: payload.mode,
        error: err,
      });
      recordControlError(err);
      throw err;
    }
  }

  const topic = `greenbro/${deviceExternalId}/commands`;
  const message = JSON.stringify(body);

  logger.info('command', 'publishing mode', {
    deviceExternalId,
    mode: payload.mode,
    transport: 'mqtt',
  });

  try {
    await publishCommand(topic, message, controlConfig);
    logger.info('command', 'mode publish success', { deviceExternalId });
    lastControlError = null;
  } catch (err) {
    logger.error('command', 'mode publish failed', { deviceExternalId, error: err });
    recordControlError(err);
    throw err instanceof Error ? err : new Error('Failed to publish mode command');
  }
}

export async function setDeviceSetpoint(
  deviceId: string,
  userId: string,
  payload: SetpointCommandPayload,
  organisationId?: string
) {
  const device = await getDeviceById(deviceId, organisationId);
  if (!device) {
    throw new Error('DEVICE_NOT_FOUND');
  }

  if (!device.external_id) {
    throw new Error('DEVICE_NOT_CONTROLLABLE');
  }

  const validation = validateSetpointCommand(device as DeviceCapabilities, payload);
  if (!validation.ok) {
    await insertCommandRow({
      deviceId,
      userId,
      commandType: 'setpoint',
      payload,
      requestedValue: { metric: payload.metric, value: payload.value },
      status: 'failed',
      errorMessage: validation.message,
      failureReason: validation.reason,
      failureMessage: validation.message,
      source: COMMAND_SOURCE,
    });
    await safeMarkControlError(new Date(), validation.message);
    throw new ControlValidationError(validation.reason, validation.message);
  }

  logger.info('command', 'attempting setpoint command', {
    deviceId: device.id,
    deviceExternalId: device.external_id,
    mac: device.mac ?? null,
    commandType: 'setpoint',
    payload,
  });

  let controlConfig: ControlConfig;
  try {
    controlConfig = resolveControlConfig();
  } catch (err) {
    await safeMarkControlError(new Date(), err);
    throw err;
  }
  const commandRow = await insertCommandRow({
    deviceId,
    userId,
    commandType: 'setpoint',
    payload,
    requestedValue: { metric: payload.metric, value: payload.value },
    status: 'pending',
    source: COMMAND_SOURCE,
  });

  try {
    await sendSetpointToExternal(device.external_id as string, payload, controlConfig);

    await markCommandSuccessRow(commandRow.id);

    await safeMarkControlSuccess(new Date());
    return {
      ...commandRow,
      status: 'success',
      completed_at: new Date(),
      failure_reason: null,
      failure_message: null,
      error_message: null,
    };
  } catch (e: any) {
    const failureMessage = e?.message || 'External command failed';
    const failureReason = e?.message?.startsWith('CONTROL_HTTP_FAILED')
      ? 'EXTERNAL_ERROR'
      : 'SEND_FAILED';
    await markCommandFailure(commandRow.id, failureMessage, failureReason);
    await safeMarkControlError(new Date(), e);
    throw new Error('COMMAND_FAILED');
  }
}

export function getControlChannelStatus() {
  const httpUrl = controlHttpUrl();
  const httpKey = controlHttpKey();
  const mqttUrl = process.env.MQTT_URL || null;

  let configured = false;
  let type: ControlConfig['type'] | null = null;
  let target: string | null = null;
  let error = lastControlError;

  if (httpUrl) {
    type = 'http';
    target = httpUrl;
    configured = Boolean(httpKey);
    if (!configured) {
      error = CONTROL_CHANNEL_UNCONFIGURED;
    }
  } else if (mqttUrl) {
    type = 'mqtt';
    target = mqttUrl;
    configured = true;
  } else {
    error = CONTROL_CHANNEL_UNCONFIGURED;
  }

  return {
    configured,
    type,
    target: formatTarget(target),
    lastCommandAt: lastControlAttemptAt ? lastControlAttemptAt.toISOString() : null,
    lastError: error,
  };
}

export async function setDeviceMode(
  deviceId: string,
  userId: string,
  payload: ModeCommandPayload,
  organisationId?: string
) {
  const device = await getDeviceById(deviceId, organisationId);
  if (!device) {
    throw new Error('DEVICE_NOT_FOUND');
  }

  if (!device.external_id) {
    throw new Error('DEVICE_NOT_CONTROLLABLE');
  }

  const validation = validateModeCommand(device as DeviceCapabilities, payload);
  if (!validation.ok) {
    await insertCommandRow({
      deviceId,
      userId,
      commandType: 'mode',
      payload,
      requestedValue: { mode: payload.mode },
      status: 'failed',
      errorMessage: validation.message,
      failureReason: validation.reason,
      failureMessage: validation.message,
      source: COMMAND_SOURCE,
    });
    await safeMarkControlError(new Date(), validation.message);
    throw new ControlValidationError(validation.reason, validation.message);
  }

  logger.info('command', 'attempting mode command', {
    deviceId: device.id,
    deviceExternalId: device.external_id,
    mac: device.mac ?? null,
    commandType: 'mode',
    payload,
  });

  let controlConfig: ControlConfig;
  try {
    controlConfig = resolveControlConfig();
  } catch (err) {
    await safeMarkControlError(new Date(), err);
    throw err;
  }
  const commandRow = await insertCommandRow({
    deviceId,
    userId,
    commandType: 'mode',
    payload,
    requestedValue: { mode: payload.mode },
    status: 'pending',
    source: COMMAND_SOURCE,
  });

  try {
    await sendModeToExternal(device.external_id as string, payload, controlConfig);

    await markCommandSuccessRow(commandRow.id);

    await safeMarkControlSuccess(new Date());
    return {
      ...commandRow,
      status: 'success',
      completed_at: new Date(),
      failure_reason: null,
      failure_message: null,
      error_message: null,
    };
  } catch (e: any) {
    const failureMessage = e?.message || 'External command failed';
    const failureReason = e?.message?.startsWith('CONTROL_HTTP_FAILED')
      ? 'EXTERNAL_ERROR'
      : 'SEND_FAILED';
    await markCommandFailure(commandRow.id, failureMessage, failureReason);
    await safeMarkControlError(new Date(), e);
    throw new Error('COMMAND_FAILED');
  }
}
