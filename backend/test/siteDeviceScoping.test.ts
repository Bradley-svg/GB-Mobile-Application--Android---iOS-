import request from 'supertest';
import jwt from 'jsonwebtoken';
import type { Express } from 'express';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const queryMock = vi.fn();

vi.mock('../src/config/db', () => ({
  query: (...args: unknown[]) => queryMock(...(args as [string, unknown[]?])),
}));

let app: Express;
let token: string;
const DEMO_HEATPUMP_MAC = '38:18:2B:60:A9:94';

beforeAll(async () => {
  process.env.NODE_ENV = 'test';
  process.env.JWT_SECRET = 'test-secret';
  const mod = await import('../src/index');
  app = mod.default;
  token = jwt.sign({ sub: 'user-99', type: 'access' }, process.env.JWT_SECRET!);
});

beforeEach(() => {
  queryMock.mockReset();
});

describe('device and site scoping', () => {
  it('returns 404 when device is outside user organisation', async () => {
    queryMock
      .mockResolvedValueOnce({
        rows: [{ id: 'user-99', organisation_id: 'org-a', email: 'a@test.com', name: 'A' }],
        rowCount: 1,
      })
      .mockResolvedValueOnce({ rows: [], rowCount: 0 });

    await request(app)
      .get('/devices/00000000-0000-0000-0000-000000000001')
      .set('Authorization', `Bearer ${token}`)
      .expect(404);

    expect(queryMock.mock.calls[1][0]).toContain('from devices');
    expect(queryMock.mock.calls[1][1]).toEqual([
      '00000000-0000-0000-0000-000000000001',
      'org-a',
    ]);
  });

  it('returns device when scoped to organisation', async () => {
    queryMock
      .mockResolvedValueOnce({
        rows: [{ id: 'user-99', organisation_id: 'org-a', email: 'a@test.com', name: 'A' }],
        rowCount: 1,
      })
      .mockResolvedValueOnce({
        rows: [
          {
            id: 'device-1',
            site_id: 'site-1',
            name: 'Heat Pump',
            external_id: 'ext-1',
            mac: DEMO_HEATPUMP_MAC,
          },
        ],
        rowCount: 1,
      });

    const res = await request(app)
      .get('/devices/00000000-0000-0000-0000-000000000010')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(res.body.id).toBe('device-1');
    expect(res.body.mac).toBe(DEMO_HEATPUMP_MAC);
  });

  it('filters site devices by organisation', async () => {
    queryMock
      .mockResolvedValueOnce({
        rows: [{ id: 'user-99', organisation_id: 'org-b', email: 'a@test.com', name: 'A' }],
        rowCount: 1,
      })
      .mockResolvedValueOnce({
        rows: [{ id: 'device-2', site_id: 'site-2', name: 'Boiler', mac: null }],
        rowCount: 1,
      });

    const res = await request(app)
      .get('/sites/00000000-0000-0000-0000-000000000020/devices')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(res.body).toEqual([
      { id: 'device-2', site_id: 'site-2', name: 'Boiler', mac: null },
    ]);
  });
});
