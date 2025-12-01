import mqtt, { MqttClient } from 'mqtt';
import { query } from '../db/pool';
import { getDeviceById } from './deviceService';

type CommandStatus = 'pending' | 'success' | 'failed';

type SetpointCommandPayload = {
  metric: 'flow_temp';
  value: number;
};

type Mode = 'OFF' | 'HEATING' | 'COOLING' | 'AUTO';

type ModeCommandPayload = {
  mode: Mode;
};

const SAFE_BOUNDS = {
  flow_temp: { min: 30, max: 60 },
};

let commandClient: MqttClient | null = null;
const controlHttpUrl = () => process.env.CONTROL_API_URL;
const controlHttpKey = () => process.env.CONTROL_API_KEY;

function getCommandClient() {
  if (commandClient) return commandClient;

  const url = process.env.MQTT_URL;
  const username = process.env.MQTT_USERNAME;
  const password = process.env.MQTT_PASSWORD;

  if (!url) {
    throw new Error('MQTT_URL not set; cannot send commands');
  }

  commandClient = mqtt.connect(url, { username, password });

  commandClient.on('connect', () => {
    console.log('[command] MQTT command client connected');
  });

  commandClient.on('error', (err) => {
    console.error('[command] MQTT command error', err);
  });

  return commandClient;
}

async function publishCommand(topic: string, message: string) {
  const client = getCommandClient();

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

async function insertCommandRow(
  deviceId: string,
  userId: string,
  commandType: string,
  payload: object,
  status: CommandStatus,
  errorMessage?: string
) {
  const res = await query<{
    id: string;
    device_id: string;
    user_id: string;
    command_type: string;
    payload: any;
    status: string;
    requested_at: Date;
    completed_at: Date | null;
    error_message: string | null;
  }>(
    `
    insert into control_commands (device_id, user_id, command_type, payload, status, completed_at, error_message)
    values ($1, $2, $3, $4::jsonb, $5, case when $5 = 'pending' then null else now() end, $6)
    returning *
  `,
    [deviceId, userId, commandType, JSON.stringify(payload), status, errorMessage || null]
  );
  return res.rows[0];
}

async function sendControlOverHttp(
  deviceExternalId: string,
  body: { type: 'setpoint' | 'mode'; payload: object }
) {
  const httpUrl = controlHttpUrl();
  if (!httpUrl) {
    throw new Error('CONTROL_API_URL not set; cannot send HTTP command');
  }

  const headers: Record<string, string> = {
    'content-type': 'application/json',
  };

  const apiKey = controlHttpKey();
  if (apiKey) {
    headers.Authorization = `Bearer ${apiKey}`;
  }

  const res = await fetch(`${httpUrl.replace(/\/$/, '')}/devices/${deviceExternalId}/commands`, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw new Error(`CONTROL_HTTP_FAILED:${res.status}:${detail.slice(0, 120)}`);
  }
}

async function sendSetpointToExternal(
  deviceExternalId: string,
  payload: SetpointCommandPayload
) {
  const body = {
    type: 'setpoint' as const,
    payload: {
      metric: payload.metric,
      value: payload.value,
    },
  };

  if (controlHttpUrl()) {
    console.log(
      `[command] sending setpoint over HTTP deviceExternalId=${deviceExternalId} metric=${payload.metric} value=${payload.value}`
    );
    await sendControlOverHttp(deviceExternalId, body);
    return;
  }

  const topic = `greenbro/${deviceExternalId}/commands`;
  const message = JSON.stringify(body);

  console.log(
    `[command] publishing setpoint deviceExternalId=${deviceExternalId} metric=${payload.metric} value=${payload.value}`
  );

  try {
    await publishCommand(topic, message);
    console.log(`[command] setpoint publish success deviceExternalId=${deviceExternalId}`);
  } catch (err) {
    console.error(`[command] setpoint publish failed deviceExternalId=${deviceExternalId}`, err);
    throw err instanceof Error ? err : new Error('Failed to publish setpoint command');
  }
}

async function sendModeToExternal(deviceExternalId: string, payload: ModeCommandPayload) {
  const body = {
    type: 'mode' as const,
    payload: {
      mode: payload.mode,
    },
  };

  if (controlHttpUrl()) {
    console.log(
      `[command] sending mode over HTTP deviceExternalId=${deviceExternalId} mode=${payload.mode}`
    );
    await sendControlOverHttp(deviceExternalId, body);
    return;
  }

  const topic = `greenbro/${deviceExternalId}/commands`;
  const message = JSON.stringify(body);

  console.log(
    `[command] publishing mode deviceExternalId=${deviceExternalId} mode=${payload.mode}`
  );

  try {
    await publishCommand(topic, message);
    console.log(`[command] mode publish success deviceExternalId=${deviceExternalId}`);
  } catch (err) {
    console.error(`[command] mode publish failed deviceExternalId=${deviceExternalId}`, err);
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

  if (payload.metric !== 'flow_temp') {
    throw new Error('UNSUPPORTED_METRIC');
  }

  const bounds = SAFE_BOUNDS.flow_temp;
  if (payload.value < bounds.min || payload.value > bounds.max) {
    throw new Error('OUT_OF_RANGE');
  }

  const commandRow = await insertCommandRow(deviceId, userId, 'setpoint', payload, 'pending');

  try {
    await sendSetpointToExternal(device.external_id as string, payload);

    await query(
      `
      update control_commands
      set status = 'success',
          completed_at = now()
      where id = $1
    `,
      [commandRow.id]
    );

    return { ...commandRow, status: 'success', completed_at: new Date() };
  } catch (e: any) {
    await query(
      `
      update control_commands
      set status = 'failed',
          completed_at = now(),
          error_message = $2
      where id = $1
    `,
      [commandRow.id, e.message || 'External command failed']
    );
    throw new Error('COMMAND_FAILED');
  }
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

  const allowedModes: Mode[] = ['OFF', 'HEATING', 'COOLING', 'AUTO'];
  if (!allowedModes.includes(payload.mode)) {
    throw new Error('UNSUPPORTED_MODE');
  }

  const commandRow = await insertCommandRow(deviceId, userId, 'mode', payload, 'pending');

  try {
    await sendModeToExternal(device.external_id as string, payload);

    await query(
      `
      update control_commands
      set status = 'success',
          completed_at = now()
      where id = $1
    `,
      [commandRow.id]
    );

    return { ...commandRow, status: 'success', completed_at: new Date() };
  } catch (e: any) {
    await query(
      `
      update control_commands
      set status = 'failed',
          completed_at = now(),
          error_message = $2
      where id = $1
    `,
      [commandRow.id, e.message || 'External command failed']
    );
    throw new Error('COMMAND_FAILED');
  }
}
