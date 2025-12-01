import request from 'supertest';
import jwt from 'jsonwebtoken';
import type { Express } from 'express';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const queryMock = vi.fn();
const acknowledgeAlertMock = vi.fn();
const muteAlertMock = vi.fn();

vi.mock('../src/db/pool', () => ({
  query: (...args: unknown[]) => queryMock(...(args as [string, unknown[]?])),
}));

vi.mock('../src/services/alertService', () => ({
  getAlerts: () => Promise.resolve([]),
  getAlertsForDevice: () => Promise.resolve([]),
  acknowledgeAlert: (...args: unknown[]) => acknowledgeAlertMock(...(args as [any])),
  muteAlert: (...args: unknown[]) => muteAlertMock(...(args as [any])),
}));

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-secret';

let app: Express;
let token: string;

beforeAll(async () => {
  const mod = await import('../src/index');
  app = mod.default;
  token = jwt.sign({ sub: 'user-2', type: 'access' }, process.env.JWT_SECRET!);
});

beforeEach(() => {
  queryMock.mockReset();
  acknowledgeAlertMock.mockReset();
  muteAlertMock.mockReset();
});

describe('/alerts/:id/acknowledge', () => {
  it('returns 400 on invalid id', async () => {
    await request(app)
      .post('/alerts/not-a-uuid/acknowledge')
      .set('Authorization', `Bearer ${token}`)
      .expect(400);
    expect(acknowledgeAlertMock).not.toHaveBeenCalled();
  });

  it('acknowledges an alert and echoes the record', async () => {
    const alert = {
      id: 'alert-1',
      site_id: 'site-1',
      device_id: 'device-1',
      severity: 'warning',
      type: 'offline',
      message: 'Offline',
      status: 'active',
      first_seen_at: '2025-01-01T00:00:00.000Z',
      last_seen_at: '2025-01-01T00:00:00.000Z',
      acknowledged_by: 'user-2',
      acknowledged_at: '2025-01-02T00:00:00.000Z',
      muted_until: null,
    };

    acknowledgeAlertMock.mockResolvedValueOnce(alert);

    const res = await request(app)
      .post('/alerts/0f7e1ae8-0b4f-43b4-96e8-000000000001/acknowledge')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(acknowledgeAlertMock).toHaveBeenCalledWith(
      '0f7e1ae8-0b4f-43b4-96e8-000000000001',
      'user-2'
    );
    expect(res.body).toEqual(alert);
  });

  it('returns 404 when alert not found', async () => {
    acknowledgeAlertMock.mockResolvedValueOnce(null);

    await request(app)
      .post('/alerts/0f7e1ae8-0b4f-43b4-96e8-000000000009/acknowledge')
      .set('Authorization', `Bearer ${token}`)
      .expect(404);
  });
});

describe('/alerts/:id/mute', () => {
  it('validates body minutes', async () => {
    await request(app)
      .post('/alerts/0f7e1ae8-0b4f-43b4-96e8-000000000001/mute')
      .set('Authorization', `Bearer ${token}`)
      .send({ minutes: -5 })
      .expect(400);

    expect(muteAlertMock).not.toHaveBeenCalled();
  });

  it('mutes an alert for the requested window', async () => {
    const muted = {
      id: 'alert-1',
      site_id: 'site-1',
      device_id: 'device-1',
      severity: 'warning',
      type: 'offline',
      message: 'Offline',
      status: 'active',
      first_seen_at: '2025-01-01T00:00:00.000Z',
      last_seen_at: '2025-01-01T00:00:00.000Z',
      acknowledged_by: 'user-2',
      acknowledged_at: '2025-01-02T00:00:00.000Z',
      muted_until: '2025-01-03T00:00:00.000Z',
    };
    muteAlertMock.mockResolvedValueOnce(muted);

    const res = await request(app)
      .post('/alerts/0f7e1ae8-0b4f-43b4-96e8-000000000001/mute')
      .set('Authorization', `Bearer ${token}`)
      .send({ minutes: 30 })
      .expect(200);

    expect(muteAlertMock).toHaveBeenCalledWith(
      '0f7e1ae8-0b4f-43b4-96e8-000000000001',
      30
    );
    expect(res.body.muted_until).toBe(muted.muted_until);
  });

  it('returns 404 when alert to mute is missing', async () => {
    muteAlertMock.mockResolvedValueOnce(null);

    await request(app)
      .post('/alerts/0f7e1ae8-0b4f-43b4-96e8-000000000099/mute')
      .set('Authorization', `Bearer ${token}`)
      .send({ minutes: 60 })
      .expect(404);
  });
});
