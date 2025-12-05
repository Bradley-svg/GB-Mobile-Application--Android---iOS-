import EventEmitter from 'events';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const loggerInfoMock = vi.fn();
const loggerWarnMock = vi.fn();
const loggerErrorMock = vi.fn();

const mockClientFactory = () => {
  const emitter = new EventEmitter() as any;
  emitter.subscribe = vi.fn((_topic: string, cb?: (err?: Error) => void) => cb && cb());
  emitter.publish = vi.fn();
  emitter.end = vi.fn();
  emitter.connected = false;
  return emitter;
};

const connectMock = vi.fn();
let lastClient: any;
const originalDatabaseUrl = process.env.DATABASE_URL;
const originalMqttUrl = process.env.MQTT_URL;
let setTimeoutSpy: ReturnType<typeof vi.spyOn>;

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

describe('mqttClient backoff', () => {
  afterEach(() => {
    vi.useRealTimers();
    setTimeoutSpy.mockRestore();
    if (originalDatabaseUrl) {
      process.env.DATABASE_URL = originalDatabaseUrl;
    } else {
      delete process.env.DATABASE_URL;
    }
    if (originalMqttUrl) {
      process.env.MQTT_URL = originalMqttUrl;
    } else {
      delete process.env.MQTT_URL;
    }
  });

  beforeEach(() => {
    vi.useFakeTimers();
    vi.resetModules();
    setTimeoutSpy = vi.spyOn(global, 'setTimeout');
    loggerInfoMock.mockReset();
    loggerWarnMock.mockReset();
    loggerErrorMock.mockReset();
    connectMock.mockReset();
    process.env.MQTT_URL = 'mqtt://test-broker';
    process.env.DATABASE_URL = 'postgres://user:pass@localhost:5432/testdb';
    connectMock.mockImplementation(() => {
      lastClient = mockClientFactory();
      return lastClient;
    });
  });

  it('schedules a reconnect with backoff on close', async () => {
    const mod = await import('../src/integrations/mqttClient');
    mod.initMqtt();

    lastClient.emit('close');

    expect(loggerWarnMock).toHaveBeenCalledWith('connection closed');
    expect(setTimeoutSpy).toHaveBeenCalled();
    const delay = setTimeoutSpy.mock.calls[0][1] as number;
    expect(delay).toBeGreaterThan(0);

    vi.runOnlyPendingTimers();

    expect(connectMock).toHaveBeenCalledTimes(2);
  });
});
