import mqtt, { MqttClient } from 'mqtt';
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

let commandClient: MqttClient | null = null;
const controlHttpUrl = () => process.env.CONTROL_API_URL;
const controlHttpKey = () => process.env.CONTROL_API_KEY;
export const CONTROL_CHANNEL_UNCONFIGURED = 'CONTROL_CHANNEL_UNCONFIGURED';
let lastControlError: string | null = null;
let lastControlAttemptAt: Date | null = null;
const COMMAND_SOURCE = 'api';
const COMMAND_THROTTLE_WINDOW_MS = Number(process.env.CONTROL_COMMAND_THROTTLE_MS || 5000);
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
  requestedValue: object
): Promise<ControlThrottleError | null> {
  const lastCommand = await getLastCommandForDevice(deviceId);
  if (!lastCommand || !lastCommand.requested_at) return null;

  const lastRequestedAt = new Date(lastCommand.requested_at);
  if (Number.isNaN(lastRequestedAt.getTime())) return null;

  const elapsedMs = Date.now() - lastRequestedAt.getTime();
  if (elapsedMs >= COMMAND_THROTTLE_WINDOW_MS) return null;

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
    log.info({ broker: formatTarget(url) }, 'MQTT command client connected');
  });

  commandClient.on('error', (err) => {
    log.error({ err }, 'MQTT command error');
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

  const topic = `greenbro/${deviceExternalId}/commands`;
  const message = JSON.stringify(body);

  log.info(
    {
      deviceExternalId,
      metric: payload.metric,
      value: payload.value,
      transport: 'mqtt',
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

  const topic = `greenbro/${deviceExternalId}/commands`;
  const message = JSON.stringify(body);

  log.info({ deviceExternalId, mode: payload.mode, transport: 'mqtt' }, 'publishing mode');

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
    requestedValue
  );
  if (throttleError) {
    log.warn(
      {
        deviceId: device.id,
        deviceExternalId: device.external_id,
        windowMs: COMMAND_THROTTLE_WINDOW_MS,
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
    requestedValue
  );
  if (throttleError) {
    log.warn(
      {
        deviceId: device.id,
        deviceExternalId: device.external_id,
        windowMs: COMMAND_THROTTLE_WINDOW_MS,
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
