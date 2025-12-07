import { beforeEach, describe, expect, it } from 'vitest';
import { query } from '../src/config/db';
import {
  WorkOrderValidationError,
  createFromAlert,
  createWorkOrder,
  listWorkOrders,
  updateWorkOrderDetails,
} from '../src/services/workOrdersService';
import { resetTestDb } from './testDbSetup';

const ORG_ID = '11111111-1111-1111-1111-111111111111';
const SITE_ID = '22222222-2222-2222-2222-222222222222';
const DEVICE_ID = '33333333-3333-3333-3333-333333333333';
const USER_ID = '44444444-4444-4444-4444-444444444444';
const OVERDUE_ID = '66666666-6666-6666-6666-666666666666';

describe('workOrdersService SLA handling', () => {
  beforeEach(async () => {
    await resetTestDb();
  });

  it('sets resolved_at when marking a work order as done and keeps SLA status accurate', async () => {
    const slaDueAt = new Date(Date.now() + 3 * 60 * 60 * 1000);
    const workOrder = await createWorkOrder({
      orgId: ORG_ID,
      siteId: SITE_ID,
      deviceId: DEVICE_ID,
      title: 'Finish checklist',
      createdByUserId: USER_ID,
      slaDueAt,
    });

    await updateWorkOrderDetails({
      orgId: ORG_ID,
      workOrderId: workOrder!.id,
      status: 'in_progress',
    });
    const done = await updateWorkOrderDetails({
      orgId: ORG_ID,
      workOrderId: workOrder!.id,
      status: 'done',
    });

    expect(done?.resolved_at).toBeTruthy();
    expect(new Date(done!.resolved_at!).getTime()).toBeLessThanOrEqual(Date.now());
    expect(done?.sla_breached).toBe(false);
  });

  it('recalculates SLA breach for overdue open work orders on read', async () => {
    await query(
      `update work_orders set sla_due_at = now() - interval '1 day', sla_breached = false where id = $1`,
      [OVERDUE_ID]
    );

    const orders = await listWorkOrders(ORG_ID, { status: 'open' });
    const overdue = orders.find((o) => o.id === OVERDUE_ID);
    expect(overdue?.sla_breached).toBe(true);
  });

  it('marks SLA as breached when completion occurs after the due time', async () => {
    const slaDueAt = new Date(Date.now() - 6 * 60 * 60 * 1000);
    const workOrder = await createWorkOrder({
      orgId: ORG_ID,
      siteId: SITE_ID,
      title: 'Late completion',
      createdByUserId: USER_ID,
      slaDueAt,
    });

    await updateWorkOrderDetails({
      orgId: ORG_ID,
      workOrderId: workOrder!.id,
      status: 'in_progress',
    });
    const closed = await updateWorkOrderDetails({
      orgId: ORG_ID,
      workOrderId: workOrder!.id,
      status: 'done',
    });

    expect(closed?.sla_breached).toBe(true);
    expect(closed?.resolved_at).toBeTruthy();
  });

  it('derives a default SLA when creating from an alert', async () => {
    const alertId = '99999999-1111-2222-3333-444444444444';
    const now = Date.now();
    await query(
      `
      insert into alerts (
        id, site_id, device_id, severity, type, message, status, first_seen_at, last_seen_at
      ) values ($1, $2, $3, 'critical', 'offline', 'Critical alert', 'active', now(), now())
    `,
      [alertId, SITE_ID, DEVICE_ID]
    );

    const order = await createFromAlert({
      orgId: ORG_ID,
      userId: USER_ID,
      alertId,
      title: 'Auto-generated from alert',
    });

    expect(order?.sla_due_at).toBeTruthy();
    const slaMs = new Date(order!.sla_due_at!).getTime() - now;
    expect(slaMs).toBeGreaterThanOrEqual(3.5 * 60 * 60 * 1000);
    expect(slaMs).toBeLessThanOrEqual(4.5 * 60 * 60 * 1000);
    expect(order?.category).toBe('breakdown');
  });

  it('rejects invalid reminder timing', async () => {
    const workOrder = await createWorkOrder({
      orgId: ORG_ID,
      siteId: SITE_ID,
      title: 'Reminder validation',
      createdByUserId: USER_ID,
      slaDueAt: new Date(Date.now() + 60 * 60 * 1000),
    });

    await expect(
      updateWorkOrderDetails({
        orgId: ORG_ID,
        workOrderId: workOrder!.id,
        reminderAt: new Date(Date.now() + 2 * 60 * 60 * 1000),
      })
    ).rejects.toBeInstanceOf(WorkOrderValidationError);
  });

  it('rejects SLA targets that are far in the past', async () => {
    await expect(
      updateWorkOrderDetails({
        orgId: ORG_ID,
        workOrderId: OVERDUE_ID,
        slaDueAt: new Date(Date.now() - 40 * 24 * 60 * 60 * 1000),
      })
    ).rejects.toBeInstanceOf(WorkOrderValidationError);
  });
});
