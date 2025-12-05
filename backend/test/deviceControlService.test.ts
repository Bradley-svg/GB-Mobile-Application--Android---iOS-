import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const queryMock = vi.fn();
const getDeviceByIdMock = vi.fn();
const publishMock = vi.fn();
const connectMock = vi.fn();
const onMock = vi.fn();
const fetchMock = vi.fn();
const markControlCommandSuccessMock = vi.fn();
const markControlCommandErrorMock = vi.fn();
const loggerInfoMock = vi.fn();
const loggerWarnMock = vi.fn();
const loggerErrorMock = vi.fn();

vi.mock('../src/config/db', () => ({
  query: (...args: unknown[]) => queryMock(...(args as [string, unknown[]?])),
}));

vi.mock('../src/services/deviceService', () => ({
  getDeviceById: (...args: unknown[]) => getDeviceByIdMock(...(args as [string])),
}));

vi.mock('../src/services/statusService', () => ({
  markControlCommandSuccess: (...args: unknown[]) => markControlCommandSuccessMock(...args),
  markControlCommandError: (...args: unknown[]) => markControlCommandErrorMock(...args),
}));

vi.mock('../src/utils/logger', () => ({
  logger: {
    info: (...args: unknown[]) => loggerInfoMock(...args),
    warn: (...args: unknown[]) => loggerWarnMock(...args),
    error: (...args: unknown[]) => loggerErrorMock(...args),
  },
}));

vi.mock('mqtt', () => {
  const mockClient = {
    publish: (...args: unknown[]) => publishMock(...(args as [string, string, any, any])),
    on: (...args: unknown[]) => onMock(...args),
  };
  connectMock.mockReturnValue(mockClient);
  return {
    __esModule: true,
    default: { connect: (...args: unknown[]) => connectMock(...args) },
    connect: (...args: unknown[]) => connectMock(...args),
  };
});

let setDeviceSetpoint: typeof import('../src/services/deviceControlService').setDeviceSetpoint;
let setDeviceMode: typeof import('../src/services/deviceControlService').setDeviceMode;

const originalMqttUrl = process.env.MQTT_URL;
const originalControlUrl = process.env.CONTROL_API_URL;
const originalControlKey = process.env.CONTROL_API_KEY;

beforeAll(async () => {
  const mod = await import('../src/services/deviceControlService');
  setDeviceSetpoint = mod.setDeviceSetpoint;
  setDeviceMode = mod.setDeviceMode;
});

beforeEach(() => {
  queryMock.mockReset();
  queryMock.mockImplementation(() => Promise.resolve({ rows: [], rowCount: 0 }));
  getDeviceByIdMock.mockReset();
  publishMock.mockReset();
  connectMock.mockClear();
  onMock.mockReset();
  fetchMock.mockReset();
  markControlCommandSuccessMock.mockReset();
  markControlCommandErrorMock.mockReset();
  process.env.MQTT_URL = 'mqtt://test-broker';
  delete process.env.CONTROL_API_URL;
  delete process.env.CONTROL_API_KEY;
  (global as any).fetch = undefined;
  loggerInfoMock.mockReset();
  loggerWarnMock.mockReset();
  loggerErrorMock.mockReset();
});

afterAll(() => {
  process.env.MQTT_URL = originalMqttUrl;
  if (originalControlUrl) process.env.CONTROL_API_URL = originalControlUrl;
  if (originalControlKey) process.env.CONTROL_API_KEY = originalControlKey;
});

describe('deviceControlService', () => {
  const baseDevice = {
    id: 'device-1',
    external_id: 'ext-1',
    site_id: 'site-1',
    name: 'Heat Pump',
    type: 'heatpump',
  };

  it('fails fast when MQTT channel is not configured', async () => {
    process.env.MQTT_URL = '';
    getDeviceByIdMock.mockResolvedValue(baseDevice);

    await expect(
      setDeviceSetpoint('device-1', 'user-1', { metric: 'flow_temp', value: 45 })
    ).rejects.toThrow('CONTROL_CHANNEL_UNCONFIGURED');

    expect(queryMock).not.toHaveBeenCalled();
  });

  it('fails fast on missing MQTT config for mode commands', async () => {
    process.env.MQTT_URL = '';
    getDeviceByIdMock.mockResolvedValue(baseDevice);

    await expect(setDeviceMode('device-1', 'user-2', { mode: 'AUTO' })).rejects.toThrow(
      'CONTROL_CHANNEL_UNCONFIGURED'
    );

    expect(queryMock).not.toHaveBeenCalled();
  });

  it('records a failed command when setpoint validation fails', async () => {
    getDeviceByIdMock.mockResolvedValue({ ...baseDevice, min_setpoint: 40 });
    queryMock.mockResolvedValueOnce({ rows: [{ id: 'cmd-invalid' }], rowCount: 1 });

    await expect(
      setDeviceSetpoint('device-1', 'user-1', { metric: 'flow_temp', value: 35 })
    ).rejects.toThrow('Setpoint below minimum of 40C');

    expect(publishMock).not.toHaveBeenCalled();
    const insertCall = queryMock.mock.calls[0];
    expect(insertCall[0]).toContain('insert into control_commands');
    expect(insertCall[1]).toEqual([
      'device-1',
      'user-1',
      'setpoint',
      JSON.stringify({ metric: 'flow_temp', value: 35 }),
      JSON.stringify({ metric: 'flow_temp', value: 35 }),
      'failed',
      'Setpoint below minimum of 40C',
      'BELOW_MIN',
      'Setpoint below minimum of 40C',
      'api',
    ]);
    expect(markControlCommandErrorMock).toHaveBeenCalledTimes(1);
  });

  it('records a failed command when mode validation fails', async () => {
    getDeviceByIdMock.mockResolvedValue({ ...baseDevice, allowed_modes: ['OFF'] });
    queryMock.mockResolvedValueOnce({ rows: [{ id: 'cmd-invalid-mode' }], rowCount: 1 });

    await expect(setDeviceMode('device-1', 'user-1', { mode: 'COOLING' })).rejects.toThrow(
      'Device does not support COOLING mode'
    );

    expect(publishMock).not.toHaveBeenCalled();
    const insertCall = queryMock.mock.calls[0];
    expect(insertCall[0]).toContain('insert into control_commands');
    expect(insertCall[1]).toEqual([
      'device-1',
      'user-1',
      'mode',
      JSON.stringify({ mode: 'COOLING' }),
      JSON.stringify({ mode: 'COOLING' }),
      'failed',
      'Device does not support COOLING mode',
      'DEVICE_NOT_CAPABLE',
      'Device does not support COOLING mode',
      'api',
    ]);
    expect(markControlCommandErrorMock).toHaveBeenCalledTimes(1);
  });

  it('throttles setpoint commands when a recent command exists', async () => {
    getDeviceByIdMock.mockResolvedValue(baseDevice);
    const recent = new Date(Date.now() - 2000);
    queryMock.mockResolvedValueOnce({
      rows: [
        {
          id: 'last-cmd',
          device_id: 'device-1',
          requested_at: recent,
        },
      ],
      rowCount: 1,
    });
    queryMock.mockResolvedValueOnce({ rows: [{ id: 'throttled' }], rowCount: 1 });

    await expect(
      setDeviceSetpoint('device-1', 'user-1', { metric: 'flow_temp', value: 45 })
    ).rejects.toThrow('throttling');

    expect(publishMock).not.toHaveBeenCalled();
    expect(queryMock).toHaveBeenCalledTimes(2);
    const insertCall = queryMock.mock.calls[1];
    expect(insertCall[0]).toContain('insert into control_commands');
    expect(insertCall[1][5]).toBe('failed');
    expect(insertCall[1][7]).toBe('THROTTLED');
  });

  it('marks setpoint command as failed when publishing throws', async () => {
    getDeviceByIdMock.mockResolvedValue(baseDevice);
    const commandRow = {
      id: 'cmd-1',
      device_id: 'device-1',
      user_id: 'user-1',
      command_type: 'setpoint',
      payload: { metric: 'flow_temp', value: 45 },
      status: 'pending',
      requested_at: new Date(),
      completed_at: null,
      error_message: null,
      requested_value: { metric: 'flow_temp', value: 45 },
      failure_reason: null,
      failure_message: null,
      source: 'api',
    };
    queryMock.mockResolvedValueOnce({ rows: [], rowCount: 0 });
    queryMock.mockResolvedValueOnce({ rows: [commandRow], rowCount: 1 });
    queryMock.mockResolvedValueOnce({ rows: [], rowCount: 1 });
    publishMock.mockImplementation((_topic, _message, _options, cb) => {
      if (typeof cb === 'function') cb(new Error('publish failed'));
    });

    await expect(
      setDeviceSetpoint('device-1', 'user-1', { metric: 'flow_temp', value: 45 })
    ).rejects.toThrow('COMMAND_FAILED');

    expect(queryMock).toHaveBeenCalledTimes(3);
    const updateCall = queryMock.mock.calls[2];
    expect(updateCall[0]).toContain('update control_commands');
    expect(updateCall[1]).toEqual(['cmd-1', 'publish failed', 'SEND_FAILED']);
    expect(loggerInfoMock).toHaveBeenCalledWith(
      'command',
      'attempting setpoint command',
      expect.objectContaining({ deviceId: 'device-1', deviceExternalId: 'ext-1' })
    );
    expect(loggerErrorMock).toHaveBeenCalledWith(
      'command',
      'setpoint publish failed',
      expect.objectContaining({ deviceExternalId: 'ext-1' })
    );
  });

  it('allows commands when the previous command is outside the throttle window', async () => {
    getDeviceByIdMock.mockResolvedValue(baseDevice);
    const oldCommandAt = new Date(Date.now() - 10000);
    const commandRow = {
      id: 'cmd-outside-window',
      device_id: 'device-1',
      user_id: 'user-1',
      command_type: 'setpoint',
      payload: { metric: 'flow_temp', value: 48 },
      status: 'pending',
      requested_at: new Date(),
      completed_at: null,
      error_message: null,
      requested_value: { metric: 'flow_temp', value: 48 },
      failure_reason: null,
      failure_message: null,
      source: 'api',
    };
    queryMock.mockResolvedValueOnce({ rows: [{ id: 'last', requested_at: oldCommandAt }], rowCount: 1 });
    queryMock.mockResolvedValueOnce({ rows: [commandRow], rowCount: 1 });
    queryMock.mockResolvedValueOnce({ rows: [], rowCount: 1 });

    publishMock.mockImplementation((_topic, _message, _options, cb) => {
      if (typeof cb === 'function') cb();
    });

    const result = await setDeviceSetpoint('device-1', 'user-1', {
      metric: 'flow_temp',
      value: 48,
    });

    expect(result.status).toBe('success');
    expect(queryMock).toHaveBeenCalledTimes(3);
    expect(queryMock.mock.calls[2][0]).toContain("status = 'success'");
  });

  it('marks mode command as failed when publishing throws', async () => {
    getDeviceByIdMock.mockResolvedValue(baseDevice);
    const commandRow = {
      id: 'cmd-2',
      device_id: 'device-1',
      user_id: 'user-2',
      command_type: 'mode',
      payload: { mode: 'AUTO' },
      status: 'pending',
      requested_at: new Date(),
      completed_at: null,
      error_message: null,
      requested_value: { mode: 'AUTO' },
      failure_reason: null,
      failure_message: null,
      source: 'api',
    };
    queryMock.mockResolvedValueOnce({ rows: [], rowCount: 0 });
    queryMock.mockResolvedValueOnce({ rows: [commandRow], rowCount: 1 });
    queryMock.mockResolvedValueOnce({ rows: [], rowCount: 1 });
    publishMock.mockImplementation((_topic, _message, _options, cb) => {
      if (typeof cb === 'function') cb(new Error('publish failed'));
    });

    await expect(
      setDeviceMode('device-1', 'user-2', { mode: 'AUTO' })
    ).rejects.toThrow('COMMAND_FAILED');

    expect(queryMock).toHaveBeenCalledTimes(3);
    const updateCall = queryMock.mock.calls[2];
    expect(updateCall[0]).toContain('status = \'failed\'');
    expect(updateCall[1]).toEqual(['cmd-2', 'publish failed', 'SEND_FAILED']);
  });

  it('marks mode command as success when publishing succeeds', async () => {
    getDeviceByIdMock.mockResolvedValue(baseDevice);
    const commandRow = {
      id: 'cmd-3',
      device_id: 'device-1',
      user_id: 'user-3',
      command_type: 'mode',
      payload: { mode: 'HEATING' },
      status: 'pending',
      requested_at: new Date(),
      completed_at: null,
      error_message: null,
      requested_value: { mode: 'HEATING' },
      failure_reason: null,
      failure_message: null,
      source: 'api',
    };
    queryMock.mockResolvedValueOnce({ rows: [], rowCount: 0 });
    queryMock.mockResolvedValueOnce({ rows: [commandRow], rowCount: 1 });
    queryMock.mockResolvedValueOnce({ rows: [], rowCount: 1 });
    publishMock.mockImplementation((_topic, _message, _options, cb) => {
      if (typeof cb === 'function') cb();
    });

    const result = await setDeviceMode('device-1', 'user-3', { mode: 'HEATING' });

    expect(queryMock).toHaveBeenCalledTimes(3);
    expect(queryMock.mock.calls[2][0]).toContain("status = 'success'");
    expect(publishMock).toHaveBeenCalledWith(
      'greenbro/ext-1/commands',
      expect.any(String),
      { qos: 1 },
      expect.any(Function)
    );
    expect(result.status).toBe('success');
    expect(result.completed_at).toBeInstanceOf(Date);
  });

  it('sends commands via HTTP provider when configured', async () => {
    (global as any).fetch = fetchMock;
    fetchMock.mockResolvedValueOnce({ ok: true, text: vi.fn() });
    process.env.CONTROL_API_URL = 'https://control.example.com';
    process.env.CONTROL_API_KEY = 'secret-key';

    getDeviceByIdMock.mockResolvedValue(baseDevice);
    const commandRow = {
      id: 'cmd-http',
      device_id: 'device-1',
      user_id: 'user-4',
      command_type: 'setpoint',
      payload: { metric: 'flow_temp', value: 42 },
      status: 'pending',
      requested_at: new Date(),
      completed_at: null,
      error_message: null,
      requested_value: { metric: 'flow_temp', value: 42 },
      failure_reason: null,
      failure_message: null,
      source: 'api',
    };
    queryMock.mockResolvedValueOnce({ rows: [], rowCount: 0 });
    queryMock.mockResolvedValueOnce({ rows: [commandRow], rowCount: 1 });
    queryMock.mockResolvedValueOnce({ rows: [], rowCount: 1 });

    await setDeviceSetpoint('device-1', 'user-4', { metric: 'flow_temp', value: 42 });

    expect(fetchMock).toHaveBeenCalledWith(
      'https://control.example.com/devices/ext-1/commands',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({ Authorization: 'Bearer secret-key' }),
      })
    );
    expect(publishMock).not.toHaveBeenCalled();
  });
});
