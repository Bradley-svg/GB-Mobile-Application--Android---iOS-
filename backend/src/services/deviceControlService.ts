import mqtt, { type MqttClient } from 'mqtt';
import { sendControlOverHttp } from '../integrations/controlClient';
import {
  insertCommandRow,
  markCommandFailure,
  markCommandSuccess as markCommandSuccessRow,
  getLastCommandForDevice,
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
import { logger } from '../config/logger';
import { getVendorControlConfig } from '../config/vendorMqttControl';

let commandClient: MqttClient | null = null;
export const CONTROL_CHANNEL_UNCONFIGURED = 'CONTROL_CHANNEL_UNCONFIGURED';
let lastControlError: string | null = null;
let lastControlAttemptAt: Date | null = null;
const COMMAND_SOURCE = 'api';
const log = logger.child({ module: 'command' });

export class ControlThrottleError extends Error {
  type = 'THROTTLED' as const;

  constructor(message: string) {
    super(message);
    this.name = 'ControlThrottleError';
  }
}

type ControlConfig =
  | { type: 'http'; url: string; apiKey: string }
  | {
      type: 'mqtt';
      url: string;
      username: string | null;
      password: string | null;
      commandTopicTemplate: string;
    };

function getThrottleWindowMs() {
  const config = getVendorControlConfig({ logMissing: false });
  return config.commandThrottleMs;
}

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
    log.warn({ err: statusErr }, 'failed to record control success');
  }
}

async function safeMarkControlError(now: Date, err: unknown) {
  try {
    await markControlCommandError(now, err);
  } catch (statusErr) {
    log.warn({ err: statusErr }, 'failed to record control error');
  }
}

async function enforceCommandThrottle(
  deviceId: string,
  userId: string,
  commandType: 'setpoint' | 'mode',
  payload: SetpointCommandPayload | ModeCommandPayload,
  requestedValue: object,
  windowMs: number
): Promise<ControlThrottleError | null> {
  const lastCommand = await getLastCommandForDevice(deviceId);
  if (!lastCommand || !lastCommand.requested_at) return null;

  const lastRequestedAt = new Date(lastCommand.requested_at);
  if (Number.isNaN(lastRequestedAt.getTime())) return null;

  const elapsedMs = Date.now() - lastRequestedAt.getTime();
  if (elapsedMs >= windowMs) return null;

  const secondsAgo = Math.max(1, Math.round(elapsedMs / 1000));
  const message = `Last ${commandType} command was ${secondsAgo}s ago; throttling repeat command.`;

  await insertCommandRow({
    deviceId,
    userId,
    commandType,
    payload,
    requestedValue,
    status: 'failed',
    errorMessage: message,
    failureReason: 'THROTTLED',
    failureMessage: message,
    source: COMMAND_SOURCE,
  });

  return new ControlThrottleError(message);
}

function resolveControlConfig(): ControlConfig {
  const config = getVendorControlConfig();
  if (config.disabled || !config.transport) {
    recordControlError(CONTROL_CHANNEL_UNCONFIGURED);
    throw new Error(CONTROL_CHANNEL_UNCONFIGURED);
  }

  if (config.transport === 'http') {
    if (!config.apiUrl || !config.apiKey) {
      recordControlError(CONTROL_CHANNEL_UNCONFIGURED);
      throw new Error(CONTROL_CHANNEL_UNCONFIGURED);
    }
    lastControlError = null;
    return { type: 'http', url: config.apiUrl, apiKey: config.apiKey };
  }

  if (!config.mqttUrl) {
    recordControlError(CONTROL_CHANNEL_UNCONFIGURED);
    throw new Error(CONTROL_CHANNEL_UNCONFIGURED);
  }

  lastControlError = null;
  return {
    type: 'mqtt',
    url: config.mqttUrl,
    username: config.mqttUsername,
    password: config.mqttPassword,
    commandTopicTemplate: config.commandTopicTemplate,
  };
}

function getCommandClient(config: Extract<ControlConfig, { type: 'mqtt' }>) {
  if (commandClient) return commandClient;

  const url = config.url;
  commandClient = mqtt.connect(url, {
    username: config.username || undefined,
    password: config.password || undefined,
  });

  commandClient.on('connect', () => {
    log.info({ broker: formatTarget(url) }, 'MQTT command client connected');
  });

  commandClient.on('error', (err) => {
    log.error({ err }, 'MQTT command error');
    recordControlError(err);
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

function buildCommandTopic(template: string, deviceExternalId: string) {
  return template.replace('{deviceExternalId}', deviceExternalId);
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
    log.info(
      {
        deviceExternalId,
        metric: payload.metric,
        value: payload.value,
        transport: 'http',
      },
      'sending setpoint over HTTP'
    );
    try {
      await sendControlOverHttp(deviceExternalId, body, controlConfig);
      lastControlError = null;
      return;
    } catch (err) {
      log.error(
        {
          deviceExternalId,
          metric: payload.metric,
          value: payload.value,
          err,
        },
        'setpoint HTTP send failed'
      );
      recordControlError(err);
      throw err;
    }
  }

  const topic = buildCommandTopic(controlConfig.commandTopicTemplate, deviceExternalId);
  const message = JSON.stringify(body);

  log.info(
    {
      deviceExternalId,
      metric: payload.metric,
      value: payload.value,
      transport: 'mqtt',
      topic,
    },
    'publishing setpoint'
  );

  try {
    await publishCommand(topic, message, controlConfig);
    log.info({ deviceExternalId }, 'setpoint publish success');
    lastControlError = null;
  } catch (err) {
    log.error({ deviceExternalId, err }, 'setpoint publish failed');
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
    log.info({ deviceExternalId, mode: payload.mode, transport: 'http' }, 'sending mode over HTTP');
    try {
      await sendControlOverHttp(deviceExternalId, body, controlConfig);
      lastControlError = null;
      return;
    } catch (err) {
      log.error({ deviceExternalId, mode: payload.mode, err }, 'mode HTTP send failed');
      recordControlError(err);
      throw err;
    }
  }

  const topic = buildCommandTopic(controlConfig.commandTopicTemplate, deviceExternalId);
  const message = JSON.stringify(body);

  log.info({ deviceExternalId, mode: payload.mode, transport: 'mqtt', topic }, 'publishing mode');

  try {
    await publishCommand(topic, message, controlConfig);
    log.info({ deviceExternalId }, 'mode publish success');
    lastControlError = null;
  } catch (err) {
    log.error({ deviceExternalId, err }, 'mode publish failed');
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

  log.info(
    {
      deviceId: device.id,
      deviceExternalId: device.external_id,
      mac: device.mac ?? null,
      commandType: 'setpoint',
      payload,
    },
    'attempting setpoint command'
  );

  let controlConfig: ControlConfig;
  const throttleWindowMs = getThrottleWindowMs();
  try {
    controlConfig = resolveControlConfig();
  } catch (err) {
    await safeMarkControlError(new Date(), err);
    throw err;
  }
  const requestedValue = { metric: payload.metric, value: payload.value };
  const throttleError = await enforceCommandThrottle(
    deviceId,
    userId,
    'setpoint',
    payload,
    requestedValue,
    throttleWindowMs
  );
  if (throttleError) {
    log.warn(
      {
        deviceId: device.id,
        deviceExternalId: device.external_id,
        windowMs: throttleWindowMs,
      },
      'setpoint command throttled'
    );
    throw throttleError;
  }
  const commandRow = await insertCommandRow({
    deviceId,
    userId,
    commandType: 'setpoint',
    payload,
    requestedValue,
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
  } catch (e) {
    const failureMessage = (e as Error | undefined)?.message || 'External command failed';
    const failureReason = (e as Error | undefined)?.message?.startsWith('CONTROL_HTTP_FAILED')
      ? 'EXTERNAL_ERROR'
      : 'SEND_FAILED';
    await markCommandFailure(commandRow.id, failureMessage, failureReason);
    await safeMarkControlError(new Date(), e);
    throw new Error('COMMAND_FAILED');
  }
}

export function getControlChannelStatus() {
  const config = getVendorControlConfig({ logMissing: false });
  let target: string | null = null;
  if (config.transport === 'http') {
    target = config.apiUrl;
  } else if (config.transport === 'mqtt') {
    target = config.mqttUrl;
  }
  let error = lastControlError;
  if (!config.configured && !config.disabled) {
    error = CONTROL_CHANNEL_UNCONFIGURED;
  }

  return {
    configured: config.configured,
    disabled: config.disabled,
    type: config.transport,
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

  log.info(
    {
      deviceId: device.id,
      deviceExternalId: device.external_id,
      mac: device.mac ?? null,
      commandType: 'mode',
      payload,
    },
    'attempting mode command'
  );

  let controlConfig: ControlConfig;
  const throttleWindowMs = getThrottleWindowMs();
  try {
    controlConfig = resolveControlConfig();
  } catch (err) {
    await safeMarkControlError(new Date(), err);
    throw err;
  }
  const requestedValue = { mode: payload.mode };
  const throttleError = await enforceCommandThrottle(
    deviceId,
    userId,
    'mode',
    payload,
    requestedValue,
    throttleWindowMs
  );
  if (throttleError) {
    log.warn(
      {
        deviceId: device.id,
        deviceExternalId: device.external_id,
        windowMs: throttleWindowMs,
      },
      'mode command throttled'
    );
    throw throttleError;
  }
  const commandRow = await insertCommandRow({
    deviceId,
    userId,
    commandType: 'mode',
    payload,
    requestedValue,
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
  } catch (e) {
    const failureMessage = (e as Error | undefined)?.message || 'External command failed';
    const failureReason = (e as Error | undefined)?.message?.startsWith('CONTROL_HTTP_FAILED')
      ? 'EXTERNAL_ERROR'
      : 'SEND_FAILED';
    await markCommandFailure(commandRow.id, failureMessage, failureReason);
    await safeMarkControlError(new Date(), e);
    throw new Error('COMMAND_FAILED');
  }
}
