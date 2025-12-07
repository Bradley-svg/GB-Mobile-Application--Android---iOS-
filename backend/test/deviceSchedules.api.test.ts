import request from 'supertest';
import jwt from 'jsonwebtoken';
import type { Express } from 'express';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { ScheduleValidationError } from '../src/services/deviceScheduleService';

const getDeviceScheduleMock = vi.fn();
const upsertDeviceScheduleMock = vi.fn();
const getUserContextMock = vi.fn();

vi.mock('../src/services/deviceScheduleService', async () => {
  const actual = await vi.importActual<typeof import('../src/services/deviceScheduleService')>(
    '../src/services/deviceScheduleService'
  );
  return {
    ...actual,
    getDeviceSchedule: (...args: unknown[]) => getDeviceScheduleMock(...(args as [any])),
    upsertDeviceSchedule: (...args: unknown[]) => upsertDeviceScheduleMock(...(args as [any])),
  };
});

vi.mock('../src/services/userService', () => ({
  getUserContext: (...args: unknown[]) => getUserContextMock(...(args as [any])),
  requireOrganisationId: (user: { organisation_id: string | null }) => {
    if (!user.organisation_id) throw new Error('USER_ORG_MISSING');
    return user.organisation_id;
  },
}));

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
  token = jwt.sign({ sub: 'user-sched', type: 'access' }, process.env.JWT_SECRET!);
});

beforeEach(() => {
  getDeviceScheduleMock.mockReset();
  upsertDeviceScheduleMock.mockReset();
  getUserContextMock.mockReset();
  getUserContextMock.mockResolvedValue({
    id: 'user-sched',
    organisation_id: 'org-sched',
    email: 'sched@test.com',
    name: 'Scheduler',
  });
});

describe('device schedule routes', () => {
  it('returns a baseline schedule for a device', async () => {
    const schedule = {
      id: 'sched-1',
      device_id: 'device-abc',
      name: 'Demo schedule',
      enabled: true,
      start_hour: 6,
      end_hour: 18,
      target_setpoint: 20,
      target_mode: 'HEATING',
      created_at: '2025-01-01T00:00:00.000Z',
      updated_at: '2025-01-01T00:00:00.000Z',
    };
    getDeviceScheduleMock.mockResolvedValueOnce(schedule);

    const res = await request(app)
      .get('/devices/00000000-0000-0000-0000-000000000010/schedule')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(getDeviceScheduleMock).toHaveBeenCalledWith(
      '00000000-0000-0000-0000-000000000010',
      'org-sched'
    );
    expect(res.body).toEqual(schedule);
  });

  it('updates schedule via PUT and returns the saved record', async () => {
    const updated = {
      id: 'sched-1',
      device_id: 'device-abc',
      name: 'Updated schedule',
      enabled: false,
      start_hour: 8,
      end_hour: 20,
      target_setpoint: 21,
      target_mode: 'AUTO',
      created_at: '2025-01-01T00:00:00.000Z',
      updated_at: '2025-01-02T00:00:00.000Z',
    };
    upsertDeviceScheduleMock.mockResolvedValueOnce(updated);

    const res = await request(app)
      .put('/devices/00000000-0000-0000-0000-000000000011/schedule')
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: 'Updated schedule',
        enabled: false,
        startHour: 8,
        endHour: 20,
        targetSetpoint: 21,
        targetMode: 'AUTO',
      })
      .expect(200);

    expect(upsertDeviceScheduleMock).toHaveBeenCalledWith(
      '00000000-0000-0000-0000-000000000011',
      'org-sched',
      {
        name: 'Updated schedule',
        enabled: false,
        startHour: 8,
        endHour: 20,
        targetSetpoint: 21,
        targetMode: 'AUTO',
      }
    );
    expect(res.body).toEqual(updated);
  });

  it('returns 400 when the payload is invalid', async () => {
    const res = await request(app)
      .put('/devices/00000000-0000-0000-0000-000000000012/schedule')
      .set('Authorization', `Bearer ${token}`)
      .send({ startHour: -1 })
      .expect(400);

    expect(res.body).toEqual({ message: 'Invalid body' });
    expect(upsertDeviceScheduleMock).not.toHaveBeenCalled();
  });

  it('bubbles up validation errors from the schedule service', async () => {
    upsertDeviceScheduleMock.mockRejectedValueOnce(
      new ScheduleValidationError('INVALID_RANGE', 'Start and end hours must differ')
    );

    const res = await request(app)
      .put('/devices/00000000-0000-0000-0000-000000000013/schedule')
      .set('Authorization', `Bearer ${token}`)
      .send({
        startHour: 6,
        endHour: 6,
        targetSetpoint: 20,
        targetMode: 'HEATING',
      })
      .expect(400);

    expect(res.body).toEqual({
      message: 'Start and end hours must differ',
      reason: 'INVALID_RANGE',
    });
  });

  it('returns 404 when the device is not found for schedule lookups', async () => {
    getDeviceScheduleMock.mockRejectedValueOnce(
      new ScheduleValidationError('NOT_FOUND', 'Device not found')
    );

    const res = await request(app)
      .get('/devices/00000000-0000-0000-0000-000000000099/schedule')
      .set('Authorization', `Bearer ${token}`)
      .expect(404);

    expect(res.body).toEqual({ message: 'Device not found', reason: 'NOT_FOUND' });
  });
});
