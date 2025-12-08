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
  sla_due_at: string | null;
  resolved_at: string | null;
  sla_breached: boolean;
  reminder_at: string | null;
  category: string | null;
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
  organisation_id: string;
  work_order_id: string;
  label: string | null;
  filename: string | null;
  original_name: string | null;
  mime_type: string | null;
  size_bytes: number | null;
  url: string | null;
  relative_path: string | null;
  uploaded_by_user_id: string | null;
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
  slaDueAt?: Date | string | null;
  resolvedAt?: Date | string | null;
  slaBreached?: boolean;
  reminderAt?: Date | string | null;
  category?: string | null;
};

export type CreateWorkOrderAttachmentInput = {
  orgId: string;
  workOrderId: string;
  filename: string;
  originalName: string;
  mimeType?: string | null;
  sizeBytes?: number | null;
  relativePath: string;
  uploadedByUserId?: string | null;
  label?: string | null;
  url?: string | null;
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
      sla_due_at,
      resolved_at,
      sla_breached,
      reminder_at,
      category,
      created_at,
      updated_at
    )
    values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, now(), now())
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
      input.slaDueAt ?? null,
      input.resolvedAt ?? null,
      input.slaBreached ?? false,
      input.reminderAt ?? null,
      input.category ?? null,
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
    slaDueAt: Date | string | null;
    resolvedAt: Date | string | null;
    slaBreached: boolean;
    reminderAt: Date | string | null;
    category: string | null;
  }>
): Promise<WorkOrderRow | null> {
  const sets: string[] = [];
  const params: Array<string | Date | null | boolean> = [];
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
  if (updates.slaDueAt !== undefined) {
    sets.push(`sla_due_at = $${idx++}`);
    params.push(updates.slaDueAt ?? null);
  }
  if (updates.resolvedAt !== undefined) {
    sets.push(`resolved_at = $${idx++}`);
    params.push(updates.resolvedAt ?? null);
  }
  if (updates.slaBreached !== undefined) {
    sets.push(`sla_breached = $${idx++}`);
    params.push(updates.slaBreached);
  }
  if (updates.reminderAt !== undefined) {
    sets.push(`reminder_at = $${idx++}`);
    params.push(updates.reminderAt ?? null);
  }
  if (updates.category !== undefined) {
    sets.push(`category = $${idx++}`);
    params.push(updates.category ?? null);
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

export async function getMaintenanceCounts(
  organisationId: string,
  options: { siteId?: string; deviceId?: string; now?: Date; dueSoonWindowHours?: number } = {}
): Promise<{ openCount: number; overdueCount: number; dueSoonCount: number }> {
  const where: string[] = ['organisation_id = $1'];
  const params: Array<string | Date> = [organisationId];
  let idx = 2;

  if (options.siteId) {
    where.push(`site_id = $${idx++}`);
    params.push(options.siteId);
  }
  if (options.deviceId) {
    where.push(`device_id = $${idx++}`);
    params.push(options.deviceId);
  }

  const now = options.now ?? new Date();
  const dueSoonWindow = options.dueSoonWindowHours ?? 24;
  const soonThreshold = new Date(now.getTime() + dueSoonWindow * 60 * 60 * 1000);

  params.push(now, soonThreshold);

  const res = await query<{ open_count: string; overdue_count: string; due_soon_count: string }>(
    `
    select
      count(*) filter (where status in ('open', 'in_progress')) as open_count,
      count(*) filter (
        where status in ('open', 'in_progress')
          and sla_due_at is not null
          and sla_due_at < $${idx}
      ) as overdue_count,
      count(*) filter (
        where status in ('open', 'in_progress')
          and sla_due_at is not null
          and sla_due_at >= $${idx}
          and sla_due_at <= $${idx + 1}
      ) as due_soon_count
    from work_orders
    where ${where.join(' and ')}
  `,
    params
  );

  const row = res.rows[0] ?? { open_count: '0', overdue_count: '0', due_soon_count: '0' };
  return {
    openCount: Number(row.open_count ?? 0),
    overdueCount: Number(row.overdue_count ?? 0),
    dueSoonCount: Number(row.due_soon_count ?? 0),
  };
}

export async function findWorkOrdersBySlaWindow(
  organisationId: string,
  options: { siteId?: string; deviceId?: string; start: Date; end: Date }
): Promise<WorkOrderWithRefs[]> {
  const where: string[] = ['wo.organisation_id = $1', 'wo.sla_due_at is not null', 'wo.sla_due_at between $2 and $3'];
  const params: Array<string | Date> = [organisationId, options.start, options.end];
  let idx = 4;

  if (options.siteId) {
    where.push(`wo.site_id = $${idx++}`);
    params.push(options.siteId);
  }
  if (options.deviceId) {
    where.push(`wo.device_id = $${idx++}`);
    params.push(options.deviceId);
  }

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
    order by wo.sla_due_at asc
  `,
    params
  );

  return res.rows;
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

export async function createWorkOrderAttachment(
  input: CreateWorkOrderAttachmentInput
): Promise<WorkOrderAttachmentRow> {
  const res = await query<WorkOrderAttachmentRow>(
    `
    insert into work_order_attachments (
      organisation_id,
      work_order_id,
      label,
      filename,
      original_name,
      mime_type,
      size_bytes,
      url,
      relative_path,
      uploaded_by_user_id,
      created_at
    )
    values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, now())
    returning *
  `,
    [
      input.orgId,
      input.workOrderId,
      input.label ?? input.originalName,
      input.filename,
      input.originalName,
      input.mimeType ?? null,
      input.sizeBytes ?? null,
      input.url ?? null,
      input.relativePath,
      input.uploadedByUserId ?? null,
    ]
  );

  return res.rows[0];
}

export async function listWorkOrderAttachments(
  organisationId: string,
  workOrderId: string
): Promise<WorkOrderAttachmentRow[]> {
  const res = await query<WorkOrderAttachmentRow>(
    `
    select *
    from work_order_attachments
    where work_order_id = $1
      and organisation_id = $2
    order by created_at desc
  `,
    [workOrderId, organisationId]
  );

  return res.rows;
}

export async function deleteWorkOrderAttachment(
  organisationId: string,
  attachmentId: string,
  workOrderId?: string
): Promise<WorkOrderAttachmentRow | null> {
  const params: Array<string> = [attachmentId, organisationId];
  let workOrderFilter = '';
  if (workOrderId) {
    params.push(workOrderId);
    workOrderFilter = ' and work_order_id = $3';
  }

  const res = await query<WorkOrderAttachmentRow>(
    `
    delete from work_order_attachments
    where id = $1
      and organisation_id = $2${workOrderFilter}
    returning *
  `,
    params
  );

  return res.rows[0] ?? null;
}
