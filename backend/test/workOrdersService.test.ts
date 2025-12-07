import { beforeEach, describe, expect, it } from 'vitest';
import { query } from '../src/config/db';
import {
  InvalidStatusTransitionError,
  createFromAlert,
  createWorkOrder,
  updateWorkOrderDetails,
  updateWorkOrderTasks,
} from '../src/services/workOrdersService';
import { resetTestDb } from './testDbSetup';

const ORG_ID = '11111111-1111-1111-1111-111111111111';
const SITE_ID = '22222222-2222-2222-2222-222222222222';
const DEVICE_ID = '33333333-3333-3333-3333-333333333333';
const USER_ID = '44444444-4444-4444-4444-444444444444';

describe('workOrdersService', () => {
  beforeEach(async () => {
    await resetTestDb();
  });

  it('creates a work order from an alert and links site/device/alert', async () => {
    const alertId = '99999999-1111-2222-3333-444444444444';
    await query(
      `
      insert into alerts (
        id, site_id, device_id, severity, type, message, status, first_seen_at, last_seen_at
      ) values ($1, $2, $3, 'warning', 'offline', 'Test alert', 'active', now(), now())
    `,
      [alertId, SITE_ID, DEVICE_ID]
    );

    const result = await createFromAlert({
      orgId: ORG_ID,
      userId: USER_ID,
      alertId,
      title: 'Create via alert',
    });

    expect(result).toBeTruthy();
    expect(result?.alert_id).toBe(alertId);
    expect(result?.site_id).toBe(SITE_ID);
    expect(result?.device_id).toBe(DEVICE_ID);
    expect(result?.tasks.length).toBeGreaterThanOrEqual(3);
  });

  it('enforces forward-only status transitions', async () => {
    const order = await createWorkOrder({
      orgId: ORG_ID,
      siteId: SITE_ID,
      deviceId: DEVICE_ID,
      title: 'Status flow',
      createdByUserId: USER_ID,
    });
    expect(order).toBeTruthy();

    const inProgress = await updateWorkOrderDetails({
      orgId: ORG_ID,
      workOrderId: order!.id,
      status: 'in_progress',
    });
    expect(inProgress?.status).toBe('in_progress');

    const done = await updateWorkOrderDetails({
      orgId: ORG_ID,
      workOrderId: order!.id,
      status: 'done',
    });
    expect(done?.status).toBe('done');

    await expect(
      updateWorkOrderDetails({
        orgId: ORG_ID,
        workOrderId: order!.id,
        status: 'open',
      })
    ).rejects.toBeInstanceOf(InvalidStatusTransitionError);
  });

  it('replaces tasks when toggling checklist items', async () => {
    const order = await createWorkOrder({
      orgId: ORG_ID,
      siteId: SITE_ID,
      deviceId: null,
      title: 'Checklist update',
      createdByUserId: USER_ID,
    });

    const updated = await updateWorkOrderTasks(ORG_ID, order!.id, [
      { label: 'Check filter', is_completed: true },
      { label: 'Log readings', is_completed: false },
    ]);

    expect(updated?.tasks.map((t) => t.label)).toEqual(['Check filter', 'Log readings']);
    expect(updated?.tasks[0].is_completed).toBe(true);
  });
});
