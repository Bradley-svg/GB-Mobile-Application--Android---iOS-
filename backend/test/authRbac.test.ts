import request from 'supertest';
import type { Express } from 'express';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import * as deviceControlService from '../src/services/deviceControlService';
import { resetTestDb } from './testDbSetup';

const DEVICE_ID = '33333333-3333-3333-3333-333333333333';
const WORK_ORDER_ID = '55555555-5555-5555-5555-555555555555';

const USERS = {
  owner: 'owner@example.com',
  admin: 'admin@example.com',
  facilities: 'demo@example.com',
  contractor: 'contractor@example.com',
} as const;

let app: Express;
let setpointSpy: ReturnType<typeof vi.spyOn> | null = null;

async function login(email: string) {
  const res = await request(app)
    .post('/auth/login')
    .send({ email, password: 'password123' })
    .expect(200);

  return res.body.accessToken as string;
}

beforeAll(async () => {
  process.env.NODE_ENV = 'test';
  process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret';
  const mod = await import('../src/index');
  app = mod.default;
});

beforeEach(async () => {
  await resetTestDb();
  if (setpointSpy) {
    setpointSpy.mockRestore();
  }
  setpointSpy = vi.spyOn(deviceControlService, 'setDeviceSetpoint').mockResolvedValue({
    id: 'cmd-rbac',
    device_id: DEVICE_ID,
    status: 'queued',
    command_type: 'setpoint',
    payload: { metric: 'flow_temp', value: 45 },
    requested_at: new Date().toISOString(),
  } as any);
});

afterAll(() => {
  if (setpointSpy) {
    setpointSpy.mockRestore();
  }
});

describe('RBAC: device control', () => {
  it('allows owner, admin, and facilities to send control commands', async () => {
    const allowed = [USERS.owner, USERS.admin, USERS.facilities];
    for (const email of allowed) {
      const token = await login(email);
      await request(app)
        .post(`/devices/${DEVICE_ID}/commands/setpoint`)
        .set('Authorization', `Bearer ${token}`)
        .send({ metric: 'flow_temp', value: 45 })
        .expect(200);
    }

    expect(setpointSpy).toHaveBeenCalled();
  });

  it('rejects contractors from sending control commands', async () => {
    const token = await login(USERS.contractor);
    await request(app)
      .post(`/devices/${DEVICE_ID}/commands/setpoint`)
      .set('Authorization', `Bearer ${token}`)
      .send({ metric: 'flow_temp', value: 45 })
      .expect(403);

    expect(setpointSpy).not.toHaveBeenCalled();
  });
});

describe('RBAC: schedules', () => {
  it('allows owner and admin to edit schedules', async () => {
    const allowed = [USERS.owner, USERS.admin];
    for (const email of allowed) {
      const token = await login(email);
      await request(app)
        .put(`/devices/${DEVICE_ID}/schedule`)
        .set('Authorization', `Bearer ${token}`)
        .send({
          name: 'RBAC Test',
          enabled: true,
          startHour: 6,
          endHour: 18,
          targetSetpoint: 42,
          targetMode: 'HEATING',
        })
        .expect(200);
    }
  });

  it('blocks facilities and contractor users from editing schedules', async () => {
    const denied = [USERS.facilities, USERS.contractor];
    for (const email of denied) {
      const token = await login(email);
      await request(app)
        .put(`/devices/${DEVICE_ID}/schedule`)
        .set('Authorization', `Bearer ${token}`)
        .send({
          name: 'Blocked',
          enabled: true,
          startHour: 7,
          endHour: 19,
          targetSetpoint: 40,
          targetMode: 'HEATING',
        })
        .expect(403);
    }
  });
});

describe('RBAC: work orders', () => {
  it('allows owner, admin, and facilities to create work orders', async () => {
    const allowed = [USERS.owner, USERS.admin, USERS.facilities];
    for (const email of allowed) {
      const token = await login(email);
      await request(app)
        .post('/work-orders')
        .set('Authorization', `Bearer ${token}`)
        .send({
          siteId: '22222222-2222-2222-2222-222222222222',
          deviceId: DEVICE_ID,
          title: 'RBAC work order',
          description: 'Created for RBAC test',
          priority: 'medium',
        })
        .expect(201);
    }
  });

  it('allows privileged users to close work orders', async () => {
    const allowed = [USERS.owner, USERS.admin, USERS.facilities];
    for (const email of allowed) {
      const token = await login(email);
      const res = await request(app)
        .patch(`/work-orders/${WORK_ORDER_ID}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ status: 'cancelled' })
        .expect(200);

      expect(res.body.status).toBe('cancelled');
    }
  });

  it('blocks contractors from creating or closing work orders', async () => {
    const token = await login(USERS.contractor);
    await request(app)
      .post('/work-orders')
      .set('Authorization', `Bearer ${token}`)
      .send({
        siteId: '22222222-2222-2222-2222-222222222222',
        deviceId: DEVICE_ID,
        title: 'Blocked creation',
      })
      .expect(403);

    await request(app)
      .patch(`/work-orders/${WORK_ORDER_ID}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ status: 'cancelled' })
      .expect(403);
  });
});
