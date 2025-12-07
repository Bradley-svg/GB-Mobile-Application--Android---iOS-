import request from 'supertest';
import jwt from 'jsonwebtoken';
import type { Express } from 'express';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const listWorkOrdersMock = vi.fn();
const listWorkOrdersForDeviceMock = vi.fn();
const listWorkOrdersForAlertMock = vi.fn();
const getWorkOrderMock = vi.fn();
const createWorkOrderMock = vi.fn();
const createFromAlertMock = vi.fn();
const updateWorkOrderDetailsMock = vi.fn();
const updateWorkOrderTasksMock = vi.fn();
const ALERT_ID = '00000000-0000-0000-0000-00000000a123';
const WORK_ORDER_ID = '00000000-0000-0000-0000-00000000b123';
const DEVICE_ID = '00000000-0000-0000-0000-00000000c123';

class MockWorkOrderValidationError extends Error {
  code: string;
  constructor(code: string, message: string) {
    super(message);
    this.code = code;
    this.name = 'WorkOrderValidationError';
  }
}
class MockInvalidStatusTransitionError extends Error {
  from: string;
  to: string;
  constructor(from: string, to: string) {
    super('Invalid status transition');
    this.from = from;
    this.to = to;
    this.name = 'InvalidStatusTransitionError';
  }
}

vi.mock('../src/services/workOrdersService', () => ({
  listWorkOrders: (...args: unknown[]) => listWorkOrdersMock(...args),
  listWorkOrdersForDevice: (...args: unknown[]) => listWorkOrdersForDeviceMock(...args),
  listWorkOrdersForAlert: (...args: unknown[]) => listWorkOrdersForAlertMock(...args),
  getWorkOrder: (...args: unknown[]) => getWorkOrderMock(...args),
  createWorkOrder: (...args: unknown[]) => createWorkOrderMock(...args),
  createFromAlert: (...args: unknown[]) => createFromAlertMock(...args),
  updateWorkOrderDetails: (...args: unknown[]) => updateWorkOrderDetailsMock(...args),
  updateWorkOrderTasks: (...args: unknown[]) => updateWorkOrderTasksMock(...args),
  WorkOrderValidationError: MockWorkOrderValidationError,
  InvalidStatusTransitionError: MockInvalidStatusTransitionError,
}));

vi.mock('../src/services/userService', () => ({
  getUserContext: () => ({
    id: 'user-wo',
    organisation_id: 'org-wo',
    email: 'wo@test.com',
    name: 'WO Tester',
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
  listWorkOrdersMock.mockReset();
  listWorkOrdersForDeviceMock.mockReset();
  listWorkOrdersForAlertMock.mockReset();
  getWorkOrderMock.mockReset();
  createWorkOrderMock.mockReset();
  createFromAlertMock.mockReset();
  updateWorkOrderDetailsMock.mockReset();
  updateWorkOrderTasksMock.mockReset();
});

describe('work orders API', () => {
  it('creates a work order from an alert', async () => {
    createFromAlertMock.mockResolvedValue({ id: 'wo-1', status: 'open' });

    const res = await request(app)
      .post(`/alerts/${ALERT_ID}/work-orders`)
      .set('Authorization', `Bearer ${token}`)
      .send({ title: 'From alert' })
      .expect(201);

    expect(createFromAlertMock).toHaveBeenCalledWith({
      orgId: 'org-wo',
      userId: 'user-wo',
      alertId: ALERT_ID,
      title: 'From alert',
      description: undefined,
    });
    expect(res.body.id).toBe('wo-1');
  });

  it('returns 400 when status transition is invalid', async () => {
    updateWorkOrderDetailsMock.mockRejectedValueOnce(
      new MockInvalidStatusTransitionError('done', 'open')
    );

    const res = await request(app)
      .patch(`/work-orders/${WORK_ORDER_ID}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ status: 'open' })
      .expect(400);

    expect(res.body.code).toBe('INVALID_STATUS');
  });

  it('lists work orders for a device', async () => {
    listWorkOrdersForDeviceMock.mockResolvedValue([{ id: 'wo-2', status: 'open' }]);

    const res = await request(app)
      .get(`/devices/${DEVICE_ID}/work-orders`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(listWorkOrdersForDeviceMock).toHaveBeenCalledWith('org-wo', DEVICE_ID);
    expect(res.body).toEqual([{ id: 'wo-2', status: 'open' }]);
  });

  it('updates tasks list', async () => {
    updateWorkOrderTasksMock.mockResolvedValue({
      id: WORK_ORDER_ID,
      tasks: [
        { id: 'task-1', label: 'Step one', is_completed: false, position: 0 },
        { id: 'task-2', label: 'Step two', is_completed: true, position: 1 },
      ],
    });

    const res = await request(app)
      .put(`/work-orders/${WORK_ORDER_ID}/tasks`)
      .set('Authorization', `Bearer ${token}`)
      .send({ tasks: [{ label: 'Step one' }, { label: 'Step two', is_completed: true }] })
      .expect(200);

    expect(updateWorkOrderTasksMock).toHaveBeenCalledWith('org-wo', WORK_ORDER_ID, [
      { label: 'Step one' },
      { label: 'Step two', is_completed: true },
    ]);
    expect(res.body.tasks[1].is_completed).toBe(true);
  });
});
