import request from 'supertest';
import jwt from 'jsonwebtoken';
import type { Express } from 'express';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const queryMock = vi.fn();

vi.mock('../src/db/pool', () => ({
  query: (...args: unknown[]) => queryMock(...(args as [string, unknown[]?])),
}));

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-secret';

let app: Express;
let token: string;

const baseAlert = {
  id: '00000000-0000-0000-0000-000000000010',
  site_id: '00000000-0000-0000-0000-0000000000a1',
  device_id: '00000000-0000-0000-0000-0000000000d1',
  severity: 'critical',
  type: 'offline',
  message: 'Offline',
  status: 'active',
  first_seen_at: '2025-01-01T00:00:00.000Z',
  last_seen_at: '2025-01-01T00:00:00.000Z',
  acknowledged_by: null,
  acknowledged_at: null,
  muted_until: null,
};

const userRow = {
  id: 'user-2',
  organisation_id: 'org-1',
  email: 'user@example.com',
  name: 'Test User',
};

beforeAll(async () => {
  const mod = await import('../src/index');
  app = mod.default;
  token = jwt.sign({ sub: userRow.id, type: 'access' }, process.env.JWT_SECRET!);
});

beforeEach(() => {
  queryMock.mockReset();
});

describe('alert scoping by organisation', () => {
  it('filters alert listing to the user organisation', async () => {
    queryMock.mockImplementation((text: string, params?: any[]) => {
      if (text.includes('from users')) {
        return { rows: [userRow], rowCount: 1 };
      }

      if (text.includes('from alerts a') && text.includes('left join devices')) {
        expect(params?.[0]).toBe(userRow.organisation_id);
        return { rows: [baseAlert], rowCount: 1 };
      }

      throw new Error(`Unexpected query: ${text}`);
    });

    const res = await request(app).get('/alerts').set('Authorization', `Bearer ${token}`).expect(200);

    expect(res.body).toEqual([baseAlert]);
  });

  it('blocks acknowledging an alert outside the organisation', async () => {
    queryMock.mockImplementation((text: string, params?: any[]) => {
      if (text.includes('from users')) {
        return { rows: [userRow], rowCount: 1 };
      }

      if (text.includes('from alerts a') && text.includes('limit 1')) {
        expect(params).toEqual([baseAlert.id, userRow.organisation_id]);
        return { rows: [], rowCount: 0 };
      }

      if (text.startsWith('\n    update alerts')) {
        throw new Error('Should not update alerts from another organisation');
      }

      throw new Error(`Unexpected query: ${text}`);
    });

    await request(app)
      .post(`/alerts/${baseAlert.id}/acknowledge`)
      .set('Authorization', `Bearer ${token}`)
      .expect(404);
  });

  it('blocks muting an alert outside the organisation', async () => {
    queryMock.mockImplementation((text: string, params?: any[]) => {
      if (text.includes('from users')) {
        return { rows: [userRow], rowCount: 1 };
      }

      if (text.includes('from alerts a') && text.includes('limit 1')) {
        expect(params).toEqual([baseAlert.id, userRow.organisation_id]);
        return { rows: [], rowCount: 0 };
      }

      if (text.startsWith('\n    update alerts\n    set muted_until')) {
        throw new Error('Should not update mute for another organisation');
      }

      throw new Error(`Unexpected query: ${text}`);
    });

    await request(app)
      .post(`/alerts/${baseAlert.id}/mute`)
      .set('Authorization', `Bearer ${token}`)
      .send({ minutes: 30 })
      .expect(404);
  });

  it('allows acknowledging alerts within the organisation', async () => {
    queryMock.mockImplementation((text: string, params?: any[]) => {
      if (text.includes('from users')) {
        return { rows: [userRow], rowCount: 1 };
      }

      if (text.includes('from alerts a') && text.includes('limit 1')) {
        return { rows: [baseAlert], rowCount: 1 };
      }

      if (text.startsWith('\n    update alerts')) {
        expect(params).toEqual([userRow.id, baseAlert.id]);
        return {
          rows: [{ ...baseAlert, acknowledged_by: userRow.id, acknowledged_at: baseAlert.last_seen_at }],
          rowCount: 1,
        };
      }

      throw new Error(`Unexpected query: ${text}`);
    });

    const res = await request(app)
      .post(`/alerts/${baseAlert.id}/acknowledge`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(res.body.acknowledged_by).toBe(userRow.id);
  });

  it('allows muting alerts within the organisation', async () => {
    queryMock.mockImplementation((text: string, params?: any[]) => {
      if (text.includes('from users')) {
        return { rows: [userRow], rowCount: 1 };
      }

      if (text.includes('from alerts a') && text.includes('limit 1')) {
        return { rows: [baseAlert], rowCount: 1 };
      }

      if (text.startsWith('\n    update alerts\n    set muted_until')) {
        expect(params).toEqual([baseAlert.id, 45]);
        return {
          rows: [{ ...baseAlert, muted_until: '2025-01-03T00:00:00.000Z' }],
          rowCount: 1,
        };
      }

      throw new Error(`Unexpected query: ${text}`);
    });

    const res = await request(app)
      .post(`/alerts/${baseAlert.id}/mute`)
      .set('Authorization', `Bearer ${token}`)
      .send({ minutes: 45 })
      .expect(200);

    expect(res.body.muted_until).toBe('2025-01-03T00:00:00.000Z');
  });

  it('scopes device alert queries to the organisation', async () => {
    queryMock.mockImplementation((text: string, params?: any[]) => {
      if (text.includes('from users')) {
        return { rows: [userRow], rowCount: 1 };
      }

      if (text.includes('from alerts a') && text.includes('join devices d')) {
        expect(params).toEqual([baseAlert.device_id, userRow.organisation_id]);
        return { rows: [baseAlert], rowCount: 1 };
      }

      throw new Error(`Unexpected query: ${text}`);
    });

    const res = await request(app)
      .get(`/devices/${baseAlert.device_id}/alerts`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(res.body[0].id).toBe(baseAlert.id);
  });
});
