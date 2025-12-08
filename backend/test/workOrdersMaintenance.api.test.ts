import request from 'supertest';
import jwt from 'jsonwebtoken';
import type { Express } from 'express';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const getMaintenanceSummaryMock = vi.fn();

vi.mock('../src/services/workOrdersService', async () => {
  const actual = await vi.importActual<typeof import('../src/services/workOrdersService')>(
    '../src/services/workOrdersService'
  );
  return { ...actual, getMaintenanceSummary: (...args: unknown[]) => getMaintenanceSummaryMock(...args) };
});

vi.mock('../src/services/userService', () => ({
  getUserContext: () => ({
    id: 'user-wo',
    organisation_id: 'org-wo',
    email: 'wo@test.com',
    name: 'WO Tester',
    role: 'admin',
  }),
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
  token = jwt.sign({ sub: 'user-wo', type: 'access' }, process.env.JWT_SECRET!);
});

beforeEach(() => {
  getMaintenanceSummaryMock.mockReset();
});

describe('GET /maintenance/summary', () => {
  it('returns maintenance summary scoped to the organisation', async () => {
    const summary = {
      openCount: 3,
      overdueCount: 1,
      dueSoonCount: 1,
      byDate: [
        {
          date: '2025-12-08',
          open: [
            {
              workOrderId: 'wo-1',
              title: 'Inspect pump',
              siteName: 'Site A',
              deviceName: 'Pump',
              slaDueAt: '2025-12-08T10:00:00.000Z',
              status: 'open',
            },
          ],
          overdue: [],
          done: [],
        },
      ],
    };
    getMaintenanceSummaryMock.mockResolvedValueOnce(summary);

    const res = await request(app)
      .get('/maintenance/summary')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(getMaintenanceSummaryMock).toHaveBeenCalledWith('org-wo', { siteId: undefined, deviceId: undefined });
    expect(res.body.openCount).toBe(3);
    expect(res.body.byDate[0].open[0].workOrderId).toBe('wo-1');
  });

  it('applies optional site/device filters', async () => {
    getMaintenanceSummaryMock.mockResolvedValueOnce({ openCount: 0, overdueCount: 0, dueSoonCount: 0, byDate: [] });
    const siteId = '11111111-2222-3333-4444-555555555555';
    const deviceId = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';

    await request(app)
      .get(`/maintenance/summary?siteId=${siteId}&deviceId=${deviceId}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(getMaintenanceSummaryMock).toHaveBeenCalledWith('org-wo', { siteId, deviceId });
  });

  it('returns 400 for invalid query params', async () => {
    await request(app)
      .get('/maintenance/summary?siteId=not-a-uuid')
      .set('Authorization', `Bearer ${token}`)
      .expect(400);
    expect(getMaintenanceSummaryMock).not.toHaveBeenCalled();
  });
});
