import { query } from '../config/db';
import type { AlertSeverity } from './alertsRepository';

export type WorkOrderStatus = 'open' | 'in_progress' | 'done' | 'cancelled';
export type WorkOrderPriority = 'low' | 'medium' | 'high';

export type WorkOrderRow = {
  id: string;
  organisation_id: string;
  site_id: string;
  device_id: string | null;
  alert_id: string | null;
  title: string;
  description: string | null;
  status: WorkOrderStatus;
  priority: WorkOrderPriority;
  assignee_user_id: string | null;
  created_by_user_id: string;
  due_at: string | null;
  created_at: string;
  updated_at: string;
};

export type WorkOrderWithRefs = WorkOrderRow & {
  site_name: string | null;
  device_name: string | null;
  alert_severity: AlertSeverity | null;
};

export type WorkOrderTaskRow = {
  id: string;
  work_order_id: string;
  label: string;
  is_completed: boolean;
  position: number;
  created_at: string;
  updated_at: string;
};

export type WorkOrderAttachmentRow = {
  id: string;
  work_order_id: string;
  label: string;
  url: string;
  created_at: string;
};

export type CreateWorkOrderInput = {
  organisationId: string;
  siteId: string;
  deviceId?: string | null;
  alertId?: string | null;
  title: string;
  description?: string | null;
  status?: WorkOrderStatus;
  priority?: WorkOrderPriority;
  assigneeUserId?: string | null;
  createdByUserId: string;
  dueAt?: Date | string | null;
};

type WorkOrderFilters = {
  siteId?: string;
  deviceId?: string;
  alertId?: string;
  status?: WorkOrderStatus;
  search?: string;
  limit?: number;
};

export type WorkOrderTaskInput = {
  label: string;
  is_completed?: boolean;
  position?: number;
};

export async function createWorkOrder(input: CreateWorkOrderInput): Promise<WorkOrderRow> {
  const res = await query<WorkOrderRow>(
    `
    insert into work_orders (
      organisation_id,
      site_id,
      device_id,
      alert_id,
      title,
      description,
      status,
      priority,
      assignee_user_id,
      created_by_user_id,
      due_at,
      created_at,
      updated_at
    )
    values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, now(), now())
    returning *
  `,
    [
      input.organisationId,
      input.siteId,
      input.deviceId ?? null,
      input.alertId ?? null,
      input.title,
      input.description ?? null,
      input.status ?? 'open',
      input.priority ?? 'medium',
      input.assigneeUserId ?? null,
      input.createdByUserId,
      input.dueAt ?? null,
    ]
  );

  return res.rows[0];
}

export async function updateWorkOrder(
  workOrderId: string,
  organisationId: string,
  updates: Partial<{
    title: string;
    description: string | null;
    status: WorkOrderStatus;
    priority: WorkOrderPriority;
    assigneeUserId: string | null;
    dueAt: Date | string | null;
  }>
): Promise<WorkOrderRow | null> {
  const sets: string[] = [];
  const params: Array<string | Date | null> = [];
  let idx = 1;

  if (updates.title !== undefined) {
    sets.push(`title = $${idx++}`);
    params.push(updates.title);
  }
  if (updates.description !== undefined) {
    sets.push(`description = $${idx++}`);
    params.push(updates.description);
  }
  if (updates.status !== undefined) {
    sets.push(`status = $${idx++}`);
    params.push(updates.status);
  }
  if (updates.priority !== undefined) {
    sets.push(`priority = $${idx++}`);
    params.push(updates.priority);
  }
  if (updates.assigneeUserId !== undefined) {
    sets.push(`assignee_user_id = $${idx++}`);
    params.push(updates.assigneeUserId);
  }
  if (updates.dueAt !== undefined) {
    sets.push(`due_at = $${idx++}`);
    params.push(updates.dueAt ?? null);
  }

  if (sets.length === 0) {
    const existing = await findWorkOrderById(organisationId, workOrderId);
    return existing;
  }

  sets.push('updated_at = now()');
  const res = await query<WorkOrderRow>(
    `
    update work_orders
    set ${sets.join(', ')}
    where id = $${idx}
      and organisation_id = $${idx + 1}
    returning *
  `,
    [...params, workOrderId, organisationId]
  );

  return res.rows[0] ?? null;
}

export async function findWorkOrdersForOrg(
  organisationId: string,
  filters: WorkOrderFilters = {}
): Promise<WorkOrderWithRefs[]> {
  const where: string[] = ['wo.organisation_id = $1'];
  const params: Array<string | number> = [organisationId];
  let idx = 2;

  if (filters.siteId) {
    where.push(`wo.site_id = $${idx++}`);
    params.push(filters.siteId);
  }
  if (filters.deviceId) {
    where.push(`wo.device_id = $${idx++}`);
    params.push(filters.deviceId);
  }
  if (filters.alertId) {
    where.push(`wo.alert_id = $${idx++}`);
    params.push(filters.alertId);
  }
  if (filters.status) {
    where.push(`wo.status = $${idx++}`);
    params.push(filters.status);
  }
  if (filters.search) {
    where.push(`(wo.title ilike $${idx} or coalesce(wo.description, '') ilike $${idx})`);
    params.push(`%${filters.search}%`);
    idx += 1;
  }

  const limit = filters.limit ?? 50;
  const res = await query<WorkOrderWithRefs>(
    `
    select wo.*,
           s.name as site_name,
           d.name as device_name,
           a.severity as alert_severity
    from work_orders wo
    join sites s on wo.site_id = s.id
    left join devices d on wo.device_id = d.id
    left join alerts a on wo.alert_id = a.id
    where ${where.join(' and ')}
    order by wo.created_at desc
    limit ${limit}
  `,
    params
  );

  return res.rows;
}

export async function findWorkOrdersForDevice(
  organisationId: string,
  deviceId: string,
  limit = 50
) {
  return findWorkOrdersForOrg(organisationId, { deviceId, limit });
}

export async function findWorkOrdersForAlert(
  organisationId: string,
  alertId: string,
  limit = 50
) {
  return findWorkOrdersForOrg(organisationId, { alertId, limit });
}

export async function findWorkOrderById(
  organisationId: string,
  workOrderId: string
): Promise<WorkOrderWithRefs | null> {
  const res = await query<WorkOrderWithRefs>(
    `
    select wo.*,
           s.name as site_name,
           d.name as device_name,
           a.severity as alert_severity
    from work_orders wo
    join sites s on wo.site_id = s.id
    left join devices d on wo.device_id = d.id
    left join alerts a on wo.alert_id = a.id
    where wo.id = $1
      and wo.organisation_id = $2
    limit 1
  `,
    [workOrderId, organisationId]
  );

  return res.rows[0] ?? null;
}

export async function listTasks(workOrderId: string): Promise<WorkOrderTaskRow[]> {
  const res = await query<WorkOrderTaskRow>(
    `
    select *
    from work_order_tasks
    where work_order_id = $1
    order by position asc, created_at asc
  `,
    [workOrderId]
  );

  return res.rows;
}

export async function listAttachments(workOrderId: string): Promise<WorkOrderAttachmentRow[]> {
  const res = await query<WorkOrderAttachmentRow>(
    `
    select *
    from work_order_attachments
    where work_order_id = $1
    order by created_at desc
  `,
    [workOrderId]
  );

  return res.rows;
}

export async function setTasks(
  workOrderId: string,
  tasks: WorkOrderTaskInput[]
): Promise<WorkOrderTaskRow[]> {
  await query('begin');
  try {
    await query('delete from work_order_tasks where work_order_id = $1', [workOrderId]);

    for (let i = 0; i < tasks.length; i += 1) {
      const task = tasks[i];
      await query(
        `
        insert into work_order_tasks (work_order_id, label, is_completed, position, created_at, updated_at)
        values ($1, $2, $3, $4, now(), now())
      `,
        [workOrderId, task.label, task.is_completed ?? false, task.position ?? i]
      );
    }

    await query('commit');
  } catch (err) {
    await query('rollback');
    throw err;
  }

  return listTasks(workOrderId);
}
