import EventEmitter from 'events';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const loggerInfoMock = vi.fn();
const loggerWarnMock = vi.fn();
const loggerErrorMock = vi.fn();
const handleTelemetryMessageMock = vi.fn();
const markMqttIngestSuccessMock = vi.fn();
const markMqttIngestErrorMock = vi.fn();

const mockClientFactory = () => {
  const emitter = new EventEmitter() as any;
  emitter.subscribe = vi.fn((_topic: string, cb?: (err?: Error) => void) => {
    cb?.();
    return emitter;
  });
  emitter.publish = vi.fn(
    (_topic: string, _message: string, _opts: any, cb?: (err?: Error) => void) => {
      cb?.();
      return true;
    }
  );
  emitter.end = vi.fn();
  emitter.connected = false;
  return emitter;
};

const connectMock = vi.fn();
let lastClient: any;
let initMqtt: typeof import('../src/integrations/mqttClient').initMqtt;
let getMqttHealth: typeof import('../src/integrations/mqttClient').getMqttHealth;
let setMqttClientFactory: typeof import('../src/integrations/mqttClient').setMqttClientFactory;
let setTimeoutSpy: ReturnType<typeof vi.spyOn>;
const originalEnv = {
  MQTT_URL: process.env.MQTT_URL,
  MQTT_DISABLED: process.env.MQTT_DISABLED,
};

vi.mock('mqtt', () => ({
  __esModule: true,
  default: {
    connect: (...args: unknown[]) => connectMock(...args),
  },
  connect: (...args: unknown[]) => connectMock(...args),
}));

vi.mock('../src/config/logger', () => ({
  logger: {
    child: () => ({
      info: (...args: unknown[]) => loggerInfoMock(...args),
      warn: (...args: unknown[]) => loggerWarnMock(...args),
      error: (...args: unknown[]) => loggerErrorMock(...args),
    }),
  },
}));

vi.mock('../src/services/telemetryIngestService', () => ({
  handleTelemetryMessage: (...args: unknown[]) => handleTelemetryMessageMock(...args),
}));

vi.mock('../src/services/statusService', () => ({
  markMqttIngestSuccess: (...args: unknown[]) => markMqttIngestSuccessMock(...args),
  markMqttIngestError: (...args: unknown[]) => markMqttIngestErrorMock(...args),
}));

beforeAll(async () => {
  const mod = await import('../src/integrations/mqttClient');
  initMqtt = mod.initMqtt;
  getMqttHealth = mod.getMqttHealth;
  setMqttClientFactory = mod.setMqttClientFactory;
});

describe('mqttClient backoff and health', () => {
  afterEach(() => {
    vi.useRealTimers();
    setTimeoutSpy.mockRestore();
    setMqttClientFactory(null);
    if (originalEnv.MQTT_URL) {
      process.env.MQTT_URL = originalEnv.MQTT_URL;
    } else {
      delete process.env.MQTT_URL;
    }
    if (originalEnv.MQTT_DISABLED) {
      process.env.MQTT_DISABLED = originalEnv.MQTT_DISABLED;
    } else {
      delete process.env.MQTT_DISABLED;
    }
  });

  beforeEach(() => {
    vi.useFakeTimers();
    setTimeoutSpy = vi.spyOn(global, 'setTimeout');
    loggerInfoMock.mockReset();
    loggerWarnMock.mockReset();
    loggerErrorMock.mockReset();
    connectMock.mockReset();
    handleTelemetryMessageMock.mockReset();
    markMqttIngestErrorMock.mockReset();
    markMqttIngestSuccessMock.mockReset();
    process.env.MQTT_URL = 'mqtt://test-broker';
    delete process.env.MQTT_DISABLED;
    connectMock.mockImplementation(() => {
      lastClient = mockClientFactory();
      return lastClient;
    });
    setMqttClientFactory((url, options) => connectMock(url, options));
    handleTelemetryMessageMock.mockResolvedValue(true);
  });

  it('schedules a reconnect with backoff on close', async () => {
    initMqtt();

    lastClient.emit('close');

    expect(loggerWarnMock).toHaveBeenCalledWith('connection closed');
    expect(setTimeoutSpy).toHaveBeenCalled();
    const delay = setTimeoutSpy.mock.calls[0][1] as number;
    expect(delay).toBeGreaterThan(0);

    vi.runOnlyPendingTimers();

    expect(connectMock).toHaveBeenCalledTimes(2);
  });

  it('skips connection when MQTT_DISABLED is true', () => {
    process.env.MQTT_DISABLED = 'true';

    const client = initMqtt();

    expect(client).toBeNull();
    expect(connectMock).not.toHaveBeenCalled();
    const health = getMqttHealth();
    expect(health.configured).toBe(false);
    expect(health.connected).toBe(false);
  });

  it('connects, subscribes, and updates health when enabled', async () => {
    const client = initMqtt();
    expect(client).toBeDefined();
    expect(connectMock).toHaveBeenCalledTimes(1);

    lastClient.emit('connect');
    expect(lastClient.subscribe).toHaveBeenCalledWith(
      'greenbro/+/+/telemetry',
      expect.any(Function)
    );

    let health = getMqttHealth();
    expect(health.configured).toBe(true);
    expect(health.connected).toBe(true);

    lastClient.emit(
      'message',
      'greenbro/site-1/device-1/telemetry',
      Buffer.from(JSON.stringify({ sensor: { supply_temperature_c: 40 } }))
    );
    await Promise.resolve();

    health = getMqttHealth();
    expect(health.lastMessageAt).not.toBeNull();
    expect(markMqttIngestSuccessMock).toHaveBeenCalled();
  });
});
