import request from 'supertest';
import jwt from 'jsonwebtoken';
import type { Express } from 'express';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { ControlValidationError } from '../src/services/deviceControlValidationService';

const setDeviceSetpointMock = vi.fn();
const setDeviceModeMock = vi.fn();
const getUserContextMock = vi.fn();
const getDeviceByIdMock = vi.fn();
const getLastCommandForDeviceMock = vi.fn();
const getCommandsForDeviceMock = vi.fn();

vi.mock('../src/services/deviceControlService', async () => {
  const actual = await vi.importActual<typeof import('../src/services/deviceControlService')>(
    '../src/services/deviceControlService'
  );
  return {
    ...actual,
    setDeviceSetpoint: (...args: unknown[]) => setDeviceSetpointMock(...(args as [any])),
    setDeviceMode: (...args: unknown[]) => setDeviceModeMock(...(args as [any])),
  };
});

vi.mock('../src/services/deviceService', () => ({
  getDeviceById: (...args: unknown[]) => getDeviceByIdMock(...(args as [any])),
}));

vi.mock('../src/repositories/controlCommandsRepository', () => ({
  getLastCommandForDevice: (...args: unknown[]) => getLastCommandForDeviceMock(...(args as [any])),
  getCommandsForDevice: (...args: unknown[]) => getCommandsForDeviceMock(...(args as [any])),
}));

vi.mock('../src/services/userService', () => ({
  getUserContext: (...args: unknown[]) => getUserContextMock(...(args as [any])),
  requireOrganisationId: (user: { organisation_id: string | null }) => {
    if (!user.organisation_id) throw new Error('USER_ORG_MISSING');
    return user.organisation_id;
  },
}));

// Prevent real DB calls when routes import other services
vi.mock('../src/config/db', () => ({
  query: () => Promise.resolve({ rows: [], rowCount: 0 }),
}));

let app: Express;
let token: string;

beforeAll(async () => {
  process.env.NODE_ENV = 'test';
  process.env.JWT_SECRET = 'test-secret';
  const mod = await import('../src/index');
  app = mod.default;
  token = jwt.sign({ sub: 'user-ctrl', type: 'access', role: 'admin' }, process.env.JWT_SECRET!);
});

beforeEach(() => {
  setDeviceSetpointMock.mockReset();
  setDeviceModeMock.mockReset();
  getUserContextMock.mockReset();
  getDeviceByIdMock.mockReset();
  getLastCommandForDeviceMock.mockReset();
  getCommandsForDeviceMock.mockReset();
  getUserContextMock.mockResolvedValue({
    id: 'user-ctrl',
    organisation_id: 'org-ctrl',
    email: 'ctrl@test.com',
    name: 'Controller',
    role: 'admin',
  });
  getDeviceByIdMock.mockResolvedValue({ id: 'device-123', organisation_id: 'org-ctrl' });
  getCommandsForDeviceMock.mockResolvedValue([]);
});

describe('control endpoints', () => {
  it('returns validation error for malformed setpoint body', async () => {
    await request(app)
      .post('/devices/00000000-0000-0000-0000-000000000111/commands/setpoint')
      .set('Authorization', `Bearer ${token}`)
      .send({ value: 12 })
      .expect(400);

    expect(setDeviceSetpointMock).not.toHaveBeenCalled();
  });

  it('forbids contractors from issuing control commands', async () => {
    const contractorToken = jwt.sign(
      { sub: 'user-ctrl', type: 'access', role: 'contractor' },
      process.env.JWT_SECRET!
    );
    getUserContextMock.mockResolvedValueOnce({
      id: 'user-contractor',
      organisation_id: 'org-ctrl',
      email: 'contractor@test.com',
      name: 'Contractor',
      role: 'contractor',
    });

    await request(app)
      .post('/devices/00000000-0000-0000-0000-000000000111/commands/setpoint')
      .set('Authorization', `Bearer ${contractorToken}`)
      .send({ metric: 'flow_temp', value: 44 })
      .expect(403);

    expect(setDeviceSetpointMock).not.toHaveBeenCalled();
  });

  it('allows facilities role to issue control commands', async () => {
    const facilitiesToken = jwt.sign(
      { sub: 'user-ctrl', type: 'access', role: 'facilities' },
      process.env.JWT_SECRET!
    );
    getUserContextMock.mockResolvedValueOnce({
      id: 'user-fac',
      organisation_id: 'org-ctrl',
      email: 'fac@test.com',
      name: 'Facilities',
      role: 'facilities',
    });
    setDeviceSetpointMock.mockResolvedValueOnce({ id: 'cmd-fac', status: 'success' });

    await request(app)
      .post('/devices/00000000-0000-0000-0000-000000000111/commands/setpoint')
      .set('Authorization', `Bearer ${facilitiesToken}`)
      .send({ metric: 'flow_temp', value: 44 })
      .expect(200);

    expect(setDeviceSetpointMock).toHaveBeenCalled();
  });

  it('maps validation errors from control service', async () => {
    setDeviceSetpointMock.mockRejectedValueOnce(
      new ControlValidationError('ABOVE_MAX', 'Setpoint above maximum of 60C')
    );

    const res = await request(app)
      .post('/devices/00000000-0000-0000-0000-000000000111/commands/setpoint')
      .set('Authorization', `Bearer ${token}`)
      .send({ metric: 'flow_temp', value: 99 })
      .expect(400);

    expect(res.body).toEqual({ message: 'Setpoint above maximum of 60C' });
  });

  it('returns 503 when control channel is not configured for setpoint', async () => {
    setDeviceSetpointMock.mockRejectedValueOnce(new Error('CONTROL_CHANNEL_UNCONFIGURED'));

    const res = await request(app)
      .post('/devices/00000000-0000-0000-0000-000000000111/commands/setpoint')
      .set('Authorization', `Bearer ${token}`)
      .send({ metric: 'flow_temp', value: 44 })
      .expect(503);

    expect(res.body).toEqual({ message: 'Control channel not configured' });
  });

  it('returns a successful mode command response', async () => {
    const command = {
      id: 'cmd-1',
      device_id: 'device-321',
      status: 'success',
      command_type: 'mode',
      payload: { mode: 'AUTO' },
      requested_at: new Date().toISOString(),
      completed_at: new Date().toISOString(),
    };
    setDeviceModeMock.mockResolvedValueOnce(command);

    const res = await request(app)
      .post('/devices/00000000-0000-0000-0000-000000000222/commands/mode')
      .set('Authorization', `Bearer ${token}`)
      .send({ mode: 'AUTO' })
      .expect(200);

    expect(setDeviceModeMock).toHaveBeenCalledWith(
      '00000000-0000-0000-0000-000000000222',
      'user-ctrl',
      { mode: 'AUTO' },
      'org-ctrl'
    );
    expect(res.body.id).toBe('cmd-1');
  });

  it('returns 404 when device not found for mode commands', async () => {
    setDeviceModeMock.mockRejectedValueOnce(new Error('DEVICE_NOT_FOUND'));

    await request(app)
      .post('/devices/00000000-0000-0000-0000-000000000333/commands/mode')
      .set('Authorization', `Bearer ${token}`)
      .send({ mode: 'OFF' })
      .expect(404);
  });

  it('returns validation error when mode is not supported by device', async () => {
    setDeviceModeMock.mockRejectedValueOnce(
      new ControlValidationError('DEVICE_NOT_CAPABLE', 'Device does not support COOLING mode')
    );

    const res = await request(app)
      .post('/devices/00000000-0000-0000-0000-000000000333/commands/mode')
      .set('Authorization', `Bearer ${token}`)
      .send({ mode: 'COOLING' })
      .expect(400);

    expect(res.body).toEqual({ message: 'Device does not support COOLING mode' });
  });

  it('returns 503 when control channel is not configured for mode', async () => {
    setDeviceModeMock.mockRejectedValueOnce(new Error('CONTROL_CHANNEL_UNCONFIGURED'));

    const res = await request(app)
      .post('/devices/00000000-0000-0000-0000-000000000444/commands/mode')
      .set('Authorization', `Bearer ${token}`)
      .send({ mode: 'AUTO' })
      .expect(503);

    expect(res.body).toEqual({ message: 'Control channel not configured' });
  });

  it('returns the last control command for a device', async () => {
    const lastCommand = {
      status: 'failed',
      requested_value: { mode: 'AUTO' },
      failure_reason: 'SEND_FAILED',
      failure_message: 'publish failed',
      requested_at: new Date('2025-01-02T00:00:00.000Z'),
    } as any;
    getLastCommandForDeviceMock.mockResolvedValueOnce(lastCommand);

    const res = await request(app)
      .get('/devices/00000000-0000-0000-0000-000000000555/last-command')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(getDeviceByIdMock).toHaveBeenCalledWith(
      '00000000-0000-0000-0000-000000000555',
      'org-ctrl'
    );
    expect(getLastCommandForDeviceMock).toHaveBeenCalledWith('device-123');
    expect(res.body).toEqual({
      status: 'failed',
      requested_value: { mode: 'AUTO' },
      failure_reason: 'SEND_FAILED',
      failure_message: 'publish failed',
      created_at: '2025-01-02T00:00:00.000Z',
    });
  });

  it('returns 404 when no last control command exists', async () => {
    getLastCommandForDeviceMock.mockResolvedValueOnce(null);

    await request(app)
      .get('/devices/00000000-0000-0000-0000-000000000556/last-command')
      .set('Authorization', `Bearer ${token}`)
      .expect(404);
  });

  it('returns control command history including failures', async () => {
    const commands = [
      {
        id: 'cmd-2',
        device_id: 'device-123',
        user_id: 'user-ctrl',
        command_type: 'mode',
        payload: { mode: 'OFF' },
        requested_value: { mode: 'OFF' },
        status: 'failed',
        requested_at: new Date('2025-01-02T00:00:00.000Z'),
        completed_at: new Date('2025-01-02T00:01:00.000Z'),
        error_message: 'throttled',
        failure_reason: 'THROTTLED',
        failure_message: 'throttled',
        source: 'api',
        user_email: 'ctrl@test.com',
        user_name: 'Controller',
      },
      {
        id: 'cmd-1',
        device_id: 'device-123',
        user_id: 'user-ctrl',
        command_type: 'setpoint',
        payload: { metric: 'flow_temp', value: 48 },
        requested_value: { metric: 'flow_temp', value: 48 },
        status: 'success',
        requested_at: new Date('2025-01-01T00:00:00.000Z'),
        completed_at: new Date('2025-01-01T00:01:00.000Z'),
        error_message: null,
        failure_reason: null,
        failure_message: null,
        source: 'api',
        user_email: 'ctrl@test.com',
        user_name: 'Controller',
      },
    ];
    getCommandsForDeviceMock.mockResolvedValueOnce(commands);

    const res = await request(app)
      .get('/devices/00000000-0000-0000-0000-000000000777/commands')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(getDeviceByIdMock).toHaveBeenCalledWith(
      '00000000-0000-0000-0000-000000000777',
      'org-ctrl'
    );
    expect(getCommandsForDeviceMock).toHaveBeenCalledWith('device-123', 20, 0);
    expect(res.body).toEqual([
      {
        id: 'cmd-2',
        device_id: 'device-123',
        status: 'failed',
        command_type: 'mode',
        requested_value: { mode: 'OFF' },
        payload: { mode: 'OFF' },
        requested_at: new Date('2025-01-02T00:00:00.000Z').toISOString(),
        completed_at: new Date('2025-01-02T00:01:00.000Z').toISOString(),
        failure_reason: 'THROTTLED',
        failure_message: 'throttled',
        actor: {
          id: 'user-ctrl',
          email: 'ctrl@test.com',
          name: 'Controller',
        },
      },
      {
        id: 'cmd-1',
        device_id: 'device-123',
        status: 'success',
        command_type: 'setpoint',
        requested_value: { metric: 'flow_temp', value: 48 },
        payload: { metric: 'flow_temp', value: 48 },
        requested_at: new Date('2025-01-01T00:00:00.000Z').toISOString(),
        completed_at: new Date('2025-01-01T00:01:00.000Z').toISOString(),
        failure_reason: null,
        failure_message: null,
        actor: {
          id: 'user-ctrl',
          email: 'ctrl@test.com',
          name: 'Controller',
        },
      },
    ]);
  });

  it('returns 404 for command history when device is outside the user org', async () => {
    getDeviceByIdMock.mockResolvedValueOnce(null);

    await request(app)
      .get('/devices/00000000-0000-0000-0000-000000000888/commands')
      .set('Authorization', `Bearer ${token}`)
      .expect(404);

    expect(getCommandsForDeviceMock).not.toHaveBeenCalled();
  });

  it('returns an empty list when no command history exists', async () => {
    getCommandsForDeviceMock.mockResolvedValueOnce([]);

    const res = await request(app)
      .get('/devices/00000000-0000-0000-0000-000000000889/commands')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(res.body).toEqual([]);
  });
});
