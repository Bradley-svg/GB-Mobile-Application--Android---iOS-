import request from 'supertest';
import jwt from 'jsonwebtoken';
import type { Express } from 'express';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const queryMock = vi.fn();

vi.mock('../src/config/db', () => ({
  query: (...args: unknown[]) => queryMock(...(args as [string, unknown[]?])),
}));

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-secret';

let app: Express;
let token: string;

beforeAll(async () => {
  const mod = await import('../src/index');
  app = mod.default;
  token = jwt.sign({ sub: 'user-123', type: 'access' }, process.env.JWT_SECRET!);
});

describe('GET /health', () => {
  it('returns ok', async () => {
    const res = await request(app).get('/health').expect(200);
    expect(res.body).toEqual({ ok: true });
  });
});

describe('GET /sites', () => {
  beforeEach(() => {
    queryMock.mockReset();
  });

  it('requires authentication', async () => {
    const res = await request(app).get('/sites').expect(401);
    expect(res.body).toEqual({ message: 'Unauthorized' });
    expect(queryMock).not.toHaveBeenCalled();
  });

  it('returns sites for an authenticated user', async () => {
    queryMock
      .mockResolvedValueOnce({
        rows: [{ id: 'user-123', organisation_id: 'org-1', email: 'a@test.com', name: 'A' }],
        rowCount: 1,
      })
      .mockResolvedValueOnce({
        rows: [
          {
            id: 'site-1',
            name: 'Test Site',
            city: 'Cape Town',
            status: 'ok',
            last_seen_at: '2025-01-01T00:00:00.000Z',
          },
        ],
        rowCount: 1,
      })
      .mockResolvedValueOnce({
        rows: [],
        rowCount: 0,
      });

    const res = await request(app)
      .get('/sites')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(queryMock).toHaveBeenCalledTimes(3);
    expect(res.body).toEqual([
      {
        id: 'site-1',
        name: 'Test Site',
        city: 'Cape Town',
        status: 'ok',
        last_seen_at: '2025-01-01T00:00:00.000Z',
        health: 'offline',
        last_seen: expect.objectContaining({
          at: '2025-01-01T00:00:00.000Z',
          isOffline: true,
          isStale: true,
          ageMinutes: expect.any(Number),
        }),
      },
    ]);
  });

  it('returns 403 when user has no organisation', async () => {
    queryMock.mockResolvedValueOnce({
      rows: [{ id: 'user-123', organisation_id: null, email: 'a@test.com', name: 'A' }],
      rowCount: 1,
    });

    const res = await request(app)
      .get('/sites')
      .set('Authorization', `Bearer ${token}`)
      .expect(403);

    expect(res.body).toEqual({ message: 'User not assigned to an organisation' });
    expect(queryMock).toHaveBeenCalledTimes(1);
  });
});
