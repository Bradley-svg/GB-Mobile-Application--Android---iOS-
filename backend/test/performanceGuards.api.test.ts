import request from 'supertest';
import jwt from 'jsonwebtoken';
import type { Express } from 'express';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  ERR_PAGE_TOO_LARGE,
  MAX_ALERTS_PAGE_SIZE,
  MAX_FLEET_PAGE_SIZE,
  MAX_TELEMETRY_POINTS,
  MAX_WORK_ORDERS_PAGE_SIZE,
} from '../src/config/limits';

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

beforeEach(() => {
  queryMock.mockReset();
});

describe('page size guards', () => {
  it('rejects fleet pages that exceed the cap', async () => {
    const res = await request(app)
      .get(`/fleet?limit=${MAX_FLEET_PAGE_SIZE + 1}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(400);

    expect(res.body).toEqual({
      message: `Requested page size too large (max ${MAX_FLEET_PAGE_SIZE})`,
      code: ERR_PAGE_TOO_LARGE,
      max: MAX_FLEET_PAGE_SIZE,
    });
    expect(queryMock).not.toHaveBeenCalled();
  });

  it('rejects alerts pages that exceed the cap', async () => {
    const res = await request(app)
      .get(`/alerts?limit=${MAX_ALERTS_PAGE_SIZE + 1}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(400);

    expect(res.body).toEqual({
      message: `Requested page size too large (max ${MAX_ALERTS_PAGE_SIZE})`,
      code: ERR_PAGE_TOO_LARGE,
      max: MAX_ALERTS_PAGE_SIZE,
    });
    expect(queryMock).not.toHaveBeenCalled();
  });

  it('rejects work order pages that exceed the cap', async () => {
    const res = await request(app)
      .get(`/work-orders?limit=${MAX_WORK_ORDERS_PAGE_SIZE + 1}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(400);

    expect(res.body).toEqual({
      message: `Requested page size too large (max ${MAX_WORK_ORDERS_PAGE_SIZE})`,
      code: ERR_PAGE_TOO_LARGE,
      max: MAX_WORK_ORDERS_PAGE_SIZE,
    });
    expect(queryMock).not.toHaveBeenCalled();
  });

  it('rejects telemetry requests with too many points', async () => {
    const res = await request(app)
      .get(`/devices/00000000-0000-0000-0000-000000000000/telemetry?maxPoints=${MAX_TELEMETRY_POINTS + 50}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(400);

    expect(res.body).toEqual({
      message: `maxPoints cannot exceed ${MAX_TELEMETRY_POINTS}`,
      code: ERR_PAGE_TOO_LARGE,
      max: MAX_TELEMETRY_POINTS,
    });
    expect(queryMock).not.toHaveBeenCalled();
  });
});
