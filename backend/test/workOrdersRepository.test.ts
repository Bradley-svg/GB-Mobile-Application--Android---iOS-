import { beforeEach, describe, expect, it } from 'vitest';
import { query } from '../src/config/db';
import {
  createWorkOrder,
  findWorkOrderById,
  findWorkOrdersForOrg,
  listTasks,
  setTasks,
} from '../src/repositories/workOrdersRepository';
import { resetTestDb } from './testDbSetup';

const ORG_ID = '11111111-1111-1111-1111-111111111111';
const SITE_ID = '22222222-2222-2222-2222-222222222222';
const DEVICE_ID = '33333333-3333-3333-3333-333333333333';
const USER_ID = '44444444-4444-4444-4444-444444444444';

describe('workOrdersRepository', () => {
  beforeEach(async () => {
    await resetTestDb();
  });

  it('creates and lists work orders scoped by organisation', async () => {
    const workOrder = await createWorkOrder({
      organisationId: ORG_ID,
      siteId: SITE_ID,
      deviceId: DEVICE_ID,
      alertId: null,
      title: 'Inspect compressor noise',
      description: 'Check vibration and log readings',
      status: 'open',
      priority: 'high',
      assigneeUserId: null,
      createdByUserId: USER_ID,
      dueAt: null,
    });

    const orders = await findWorkOrdersForOrg(ORG_ID, { search: 'compressor' });
    const fetched = orders.find((o) => o.id === workOrder.id);
    expect(fetched).toBeTruthy();
    expect(fetched?.site_id).toBe(SITE_ID);
    expect(fetched?.device_id).toBe(DEVICE_ID);

    const detail = await findWorkOrderById(ORG_ID, workOrder.id);
    expect(detail?.title).toBe('Inspect compressor noise');
    expect(detail?.organisation_id).toBe(ORG_ID);
  });

  it('replaces tasks preserving ordering and completion flags', async () => {
    const workOrder = await createWorkOrder({
      organisationId: ORG_ID,
      siteId: SITE_ID,
      deviceId: null,
      alertId: null,
      title: 'Checklist rebuild',
      createdByUserId: USER_ID,
    });

    await setTasks(workOrder.id, [
      { label: 'Second step', position: 1 },
      { label: 'First step', is_completed: true, position: 0 },
    ]);

    const tasks = await listTasks(workOrder.id);
    expect(tasks.map((t) => t.label)).toEqual(['First step', 'Second step']);
    expect(tasks[0].is_completed).toBe(true);
    expect(tasks[1].is_completed).toBe(false);
  });

  it('filters out work orders from other organisations', async () => {
    const OTHER_ORG = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
    const OTHER_SITE = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
    const OTHER_USER = 'cccccccc-cccc-cccc-cccc-cccccccccccc';

    await query(`insert into organisations (id, name, created_at) values ($1, 'Other Org', now())`, [
      OTHER_ORG,
    ]);
    await query(
      `insert into users (id, organisation_id, email, password_hash, name, created_at)
       values ($1, $2, 'other@example.com', 'hash', 'Other User', now())`,
      [OTHER_USER, OTHER_ORG]
    );
    await query(
      `insert into sites (id, organisation_id, name, status, last_seen_at, created_at)
       values ($1, $2, 'Other Site', 'healthy', now(), now())`,
      [OTHER_SITE, OTHER_ORG]
    );

    await createWorkOrder({
      organisationId: OTHER_ORG,
      siteId: OTHER_SITE,
      title: 'Other org order',
      createdByUserId: OTHER_USER,
    });

    const orders = await findWorkOrdersForOrg(ORG_ID);
    expect(orders.find((o) => o.organisation_id === OTHER_ORG)).toBeUndefined();
  });
});
