import request from 'supertest';
import jwt from 'jsonwebtoken';
import type { Express } from 'express';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { ControlValidationError } from '../src/services/deviceControlValidationService';

const setDeviceSetpointMock = vi.fn();
const setDeviceModeMock = vi.fn();
const getUserContextMock = vi.fn();

vi.mock('../src/services/deviceControlService', () => ({
  setDeviceSetpoint: (...args: unknown[]) => setDeviceSetpointMock(...(args as [any])),
  setDeviceMode: (...args: unknown[]) => setDeviceModeMock(...(args as [any])),
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
  token = jwt.sign({ sub: 'user-ctrl', type: 'access' }, process.env.JWT_SECRET!);
});

beforeEach(() => {
  setDeviceSetpointMock.mockReset();
  setDeviceModeMock.mockReset();
  getUserContextMock.mockReset();
  getUserContextMock.mockResolvedValue({
    id: 'user-ctrl',
    organisation_id: 'org-ctrl',
    email: 'ctrl@test.com',
    name: 'Controller',
  });
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
});
