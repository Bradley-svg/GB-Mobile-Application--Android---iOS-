import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const queryMock = vi.fn();
const getDeviceByIdMock = vi.fn();
const publishMock = vi.fn();
const connectMock = vi.fn();
const onMock = vi.fn();
const fetchMock = vi.fn();
const consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

vi.mock('../src/db/pool', () => ({
  query: (...args: unknown[]) => queryMock(...(args as [string, unknown[]?])),
}));

vi.mock('../src/services/deviceService', () => ({
  getDeviceById: (...args: unknown[]) => getDeviceByIdMock(...(args as [string])),
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
  getDeviceByIdMock.mockReset();
  publishMock.mockReset();
  connectMock.mockClear();
  onMock.mockReset();
  fetchMock.mockReset();
  process.env.MQTT_URL = 'mqtt://test-broker';
  delete process.env.CONTROL_API_URL;
  delete process.env.CONTROL_API_KEY;
  (global as any).fetch = undefined;
  consoleLogSpy.mockClear();
  consoleErrorSpy.mockClear();
});

afterAll(() => {
  process.env.MQTT_URL = originalMqttUrl;
  if (originalControlUrl) process.env.CONTROL_API_URL = originalControlUrl;
  if (originalControlKey) process.env.CONTROL_API_KEY = originalControlKey;
  consoleLogSpy.mockRestore();
  consoleErrorSpy.mockRestore();
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
    };
    queryMock.mockResolvedValueOnce({ rows: [commandRow], rowCount: 1 });
    queryMock.mockResolvedValueOnce({ rows: [], rowCount: 1 });
    publishMock.mockImplementation((_topic, _message, _options, cb) => {
      if (typeof cb === 'function') cb(new Error('publish failed'));
    });

    await expect(
      setDeviceSetpoint('device-1', 'user-1', { metric: 'flow_temp', value: 45 })
    ).rejects.toThrow('COMMAND_FAILED');

    expect(queryMock).toHaveBeenCalledTimes(2);
    const updateCall = queryMock.mock.calls[1];
    expect(updateCall[0]).toContain('update control_commands');
    expect(updateCall[1]).toEqual(['cmd-1', 'publish failed']);
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
    };
    queryMock.mockResolvedValueOnce({ rows: [commandRow], rowCount: 1 });
    queryMock.mockResolvedValueOnce({ rows: [], rowCount: 1 });
    publishMock.mockImplementation((_topic, _message, _options, cb) => {
      if (typeof cb === 'function') cb(new Error('publish failed'));
    });

    await expect(
      setDeviceMode('device-1', 'user-2', { mode: 'AUTO' })
    ).rejects.toThrow('COMMAND_FAILED');

    expect(queryMock).toHaveBeenCalledTimes(2);
    const updateCall = queryMock.mock.calls[1];
    expect(updateCall[0]).toContain('status = \'failed\'');
    expect(updateCall[1]).toEqual(['cmd-2', 'publish failed']);
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
    };
    queryMock.mockResolvedValueOnce({ rows: [commandRow], rowCount: 1 });
    queryMock.mockResolvedValueOnce({ rows: [], rowCount: 1 });
    publishMock.mockImplementation((_topic, _message, _options, cb) => {
      if (typeof cb === 'function') cb();
    });

    const result = await setDeviceMode('device-1', 'user-3', { mode: 'HEATING' });

    expect(queryMock).toHaveBeenCalledTimes(2);
    expect(queryMock.mock.calls[1][0]).toContain('status = \'success\'');
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
    };
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
