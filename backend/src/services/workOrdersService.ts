import { findAlertForOrganisation, type AlertSeverity } from '../repositories/alertsRepository';
import { getDeviceById } from '../repositories/devicesRepository';
import { getSiteById } from '../repositories/sitesRepository';
import {
  createWorkOrder as insertWorkOrder,
  findWorkOrderById,
  findWorkOrdersForAlert,
  findWorkOrdersForDevice,
  findWorkOrdersForOrg,
  findWorkOrdersBySlaWindow,
  getMaintenanceCounts,
  listWorkOrderAttachments,
  listTasks,
  setTasks,
  updateWorkOrder,
  type CreateWorkOrderInput,
  type WorkOrderAttachmentRow,
  type WorkOrderPriority,
  type WorkOrderStatus,
  type WorkOrderTaskInput,
  type WorkOrderTaskRow,
  type WorkOrderWithRefs,
} from '../repositories/workOrdersRepository';
import { buildPublicUrl } from '../config/storage';

export type WorkOrderWithDetails = WorkOrderWithRefs & {
  tasks: WorkOrderTaskRow[];
  attachments: WorkOrderAttachmentRow[];
};

type MaintenanceItem = {
  workOrderId: string;
  title: string;
  siteName: string | null;
  deviceName: string | null;
  slaDueAt: string;
  status: WorkOrderStatus;
};

export type MaintenanceSummary = {
  openCount: number;
  overdueCount: number;
  dueSoonCount: number;
  byDate: Array<{
    date: string;
    open: MaintenanceItem[];
    overdue: MaintenanceItem[];
    done: MaintenanceItem[];
  }>;
};

export class WorkOrderValidationError extends Error {
  constructor(public code: string, message: string) {
    super(message);
    this.name = 'WorkOrderValidationError';
  }
}

export class InvalidStatusTransitionError extends Error {
  constructor(public from: WorkOrderStatus, public to: WorkOrderStatus) {
    super(`Cannot transition work order from ${from} to ${to}`);
    this.name = 'InvalidStatusTransitionError';
  }
}

const MAX_SLA_PAST_MS = 30 * 24 * 60 * 60 * 1000;

function toDate(value: Date | string | null | undefined): Date | null {
  if (value === null || value === undefined) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function computeSlaBreached(
  status: WorkOrderStatus,
  slaDueAt: Date | null,
  resolvedAt: Date | null,
  now: Date
): boolean {
  if (!slaDueAt) return false;
  if (status === 'done') {
    if (!resolvedAt) return false;
    return resolvedAt.getTime() > slaDueAt.getTime();
  }

  return now.getTime() > slaDueAt.getTime();
}

function deriveDefaultSlaDueAtFromSeverity(severity: AlertSeverity | null, now: Date): Date | null {
  if (!severity) return null;
  const cloned = new Date(now);
  const hours =
    severity === 'critical'
      ? 4
      : severity === 'warning'
      ? 24
      : 48;
  cloned.setHours(cloned.getHours() + hours);
  return cloned;
}

function validateSlaFields(options: { slaDueAt?: Date | string | null; reminderAt?: Date | string | null }) {
  const now = new Date();
  const slaDueAtDate = toDate(options.slaDueAt ?? null);
  const reminderAtDate = toDate(options.reminderAt ?? null);

  if (options.slaDueAt !== undefined && options.slaDueAt !== null && !slaDueAtDate) {
    throw new WorkOrderValidationError('SLA_INVALID', 'Invalid SLA due date');
  }
  if (options.reminderAt !== undefined && options.reminderAt !== null && !reminderAtDate) {
    throw new WorkOrderValidationError('REMINDER_INVALID', 'Invalid reminder date');
  }
  if (slaDueAtDate && now.getTime() - slaDueAtDate.getTime() > MAX_SLA_PAST_MS) {
    throw new WorkOrderValidationError('SLA_TOO_OLD', 'SLA due date too far in the past');
  }
  if (reminderAtDate && now.getTime() - reminderAtDate.getTime() > MAX_SLA_PAST_MS) {
    throw new WorkOrderValidationError('REMINDER_TOO_OLD', 'Reminder too far in the past');
  }
  if (reminderAtDate && slaDueAtDate && reminderAtDate.getTime() > slaDueAtDate.getTime()) {
    throw new WorkOrderValidationError('REMINDER_AFTER_SLA', 'Reminder must be before the SLA due date');
  }

  return { slaDueAtDate, reminderAtDate };
}

function withComputedSla<T extends WorkOrderWithRefs>(order: T, now: Date = new Date()): T {
  const computed = computeSlaBreached(
    order.status,
    toDate(order.sla_due_at),
    toDate(order.resolved_at),
    now
  );
  if (computed === order.sla_breached) {
    return order;
  }

  return { ...order, sla_breached: computed };
}

function startOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function endOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(23, 59, 59, 999);
  return d;
}

type ListFilters = {
  siteId?: string;
  deviceId?: string;
  alertId?: string;
  status?: WorkOrderStatus;
  search?: string;
  limit?: number;
};

type CreateWorkOrderOptions = Omit<CreateWorkOrderInput, 'organisationId'> & {
  orgId: string;
  tasks?: WorkOrderTaskInput[];
  slaDueAt?: Date | string | null;
  reminderAt?: Date | string | null;
  category?: string | null;
};

type UpdateWorkOrderOptions = {
  orgId: string;
  workOrderId: string;
  title?: string;
  description?: string | null;
  priority?: WorkOrderPriority;
  assigneeUserId?: string | null;
  dueAt?: Date | string | null;
  status?: WorkOrderStatus;
  slaDueAt?: Date | string | null;
  resolvedAt?: Date | string | null;
  reminderAt?: Date | string | null;
  category?: string | null;
};

async function hydrateWorkOrder(
  organisationId: string,
  workOrderId: string
): Promise<WorkOrderWithDetails | null> {
  const base = await findWorkOrderById(organisationId, workOrderId);
  if (!base) return null;

  const [tasks, attachments] = await Promise.all([
    listTasks(workOrderId),
    listWorkOrderAttachments(organisationId, workOrderId),
  ]);
  const normalizedAttachments = attachments.map((att) => ({
    ...att,
    url: att.url ?? (att.relative_path ? buildPublicUrl(att.relative_path) : null),
  }));
  const withSla = withComputedSla(base);
  return { ...withSla, tasks, attachments: normalizedAttachments };
}

const DEFAULT_ALERT_TASKS: WorkOrderTaskInput[] = [
  { label: 'Diagnose issue' },
  { label: 'Record readings' },
  { label: 'Confirm resolved' },
];

function assertStatusTransition(current: WorkOrderStatus, next: WorkOrderStatus) {
  const allowed: Record<WorkOrderStatus, WorkOrderStatus[]> = {
    open: ['in_progress', 'cancelled'],
    in_progress: ['done', 'cancelled'],
    done: [],
    cancelled: [],
  };

  if (current === next) return;
  const permitted = allowed[current] ?? [];
  if (!permitted.includes(next)) {
    throw new InvalidStatusTransitionError(current, next);
  }
}

export async function listWorkOrders(orgId: string, filters: ListFilters = {}) {
  const orders = await findWorkOrdersForOrg(orgId, filters);
  return orders.map((order) => withComputedSla(order));
}

export async function listWorkOrdersForDevice(orgId: string, deviceId: string) {
  const orders = await findWorkOrdersForDevice(orgId, deviceId);
  return orders.map((order) => withComputedSla(order));
}

export async function listWorkOrdersForAlert(orgId: string, alertId: string) {
  const orders = await findWorkOrdersForAlert(orgId, alertId);
  return orders.map((order) => withComputedSla(order));
}

export async function getWorkOrder(orgId: string, workOrderId: string) {
  return hydrateWorkOrder(orgId, workOrderId);
}

async function validateSiteAndDevice(
  orgId: string,
  siteId: string,
  deviceId?: string | null
): Promise<{ deviceSiteId: string | null }> {
  const site = await getSiteById(siteId, orgId);
  if (!site) {
    throw new WorkOrderValidationError('SITE_NOT_FOUND', 'Site not found in organisation');
  }

  if (!deviceId) {
    return { deviceSiteId: null };
  }

  const device = await getDeviceById(deviceId, orgId);
  if (!device) {
    throw new WorkOrderValidationError('DEVICE_NOT_FOUND', 'Device not found in organisation');
  }
  if (device.site_id !== siteId) {
    throw new WorkOrderValidationError('DEVICE_SITE_MISMATCH', 'Device does not belong to the site');
  }

  return { deviceSiteId: device.site_id };
}

export async function createWorkOrder(options: CreateWorkOrderOptions) {
  const { orgId, tasks, slaDueAt, reminderAt, category, ...input } = options;
  await validateSiteAndDevice(orgId, input.siteId, input.deviceId ?? null);
  const { slaDueAtDate, reminderAtDate } = validateSlaFields({ slaDueAt, reminderAt });
  const now = new Date();
  let resolvedSlaDueAt = slaDueAtDate;
  let resolvedCategory = category ?? null;

  if (input.alertId) {
    const alert = await findAlertForOrganisation(input.alertId, orgId);
    if (!alert) {
      throw new WorkOrderValidationError('ALERT_NOT_FOUND', 'Alert not found for organisation');
    }
    const alertSiteId = alert.site_id ?? null;
    let resolvedSiteId = alertSiteId;
    if (!resolvedSiteId && alert.device_id) {
      const alertDevice = await getDeviceById(alert.device_id, orgId);
      resolvedSiteId = alertDevice?.site_id ?? null;
    }
    if (resolvedSiteId && resolvedSiteId !== input.siteId) {
      throw new WorkOrderValidationError(
        'ALERT_SITE_MISMATCH',
        'Alert belongs to a different site than the work order'
      );
    }
    resolvedSlaDueAt = resolvedSlaDueAt ?? deriveDefaultSlaDueAtFromSeverity(alert.severity, now);
    resolvedCategory = resolvedCategory ?? 'breakdown';
  }

  const status = input.status ?? 'open';
  const resolvedAt = status === 'done' ? now : null;
  const slaBreached = computeSlaBreached(status, resolvedSlaDueAt, resolvedAt, now);

  const workOrder = await insertWorkOrder({
    ...input,
    organisationId: orgId,
    slaDueAt: resolvedSlaDueAt ?? null,
    resolvedAt,
    slaBreached,
    reminderAt: reminderAtDate ?? null,
    category: resolvedCategory ?? null,
  });

  if (tasks && tasks.length > 0) {
    await setTasks(workOrder.id, tasks);
  }

  return hydrateWorkOrder(orgId, workOrder.id);
}

export async function createFromAlert(options: {
  orgId: string;
  userId: string;
  alertId: string;
  title?: string;
  description?: string;
}) {
  const { orgId, userId, alertId, title, description } = options;
  const alert = await findAlertForOrganisation(alertId, orgId);
  if (!alert) return null;

  let siteId = alert.site_id ?? null;
  const deviceId = alert.device_id ?? null;

  if (!siteId && deviceId) {
    const device = await getDeviceById(deviceId, orgId);
    if (!device) {
      throw new WorkOrderValidationError(
        'DEVICE_NOT_FOUND',
        'Alert is linked to a device outside this organisation'
      );
    }
    siteId = device.site_id;
  }

  if (!siteId) {
    throw new WorkOrderValidationError('ALERT_SITE_MISSING', 'Alert has no site or device associated');
  }

  const workOrder = await createWorkOrder({
    orgId,
    siteId,
    deviceId,
    alertId,
    title: title ?? alert.message ?? 'Work order',
    description: description ?? null,
    createdByUserId: userId,
    tasks: DEFAULT_ALERT_TASKS,
    slaDueAt: deriveDefaultSlaDueAtFromSeverity(alert.severity, new Date()),
    category: 'breakdown',
  });

  return workOrder;
}

export async function updateWorkOrderDetails(options: UpdateWorkOrderOptions) {
  const { orgId, workOrderId, status, slaDueAt, reminderAt, category, resolvedAt: resolvedAtInput, ...rest } =
    options;
  const existing = await findWorkOrderById(orgId, workOrderId);
  if (!existing) return null;

  if (status) {
    assertStatusTransition(existing.status, status);
  }

  const nextStatus = status ?? existing.status;
  const slaValidation = validateSlaFields({
    slaDueAt: slaDueAt ?? existing.sla_due_at,
    reminderAt: reminderAt ?? existing.reminder_at,
  });

  const now = new Date();
  let resolvedAt = toDate(existing.resolved_at);
  if (resolvedAtInput !== undefined) {
    resolvedAt = toDate(resolvedAtInput);
    if (resolvedAtInput !== null && !resolvedAt) {
      throw new WorkOrderValidationError('RESOLVED_AT_INVALID', 'Invalid resolved_at value');
    }
  } else if (nextStatus === 'done' && !resolvedAt) {
    resolvedAt = now;
  }

  const nextSlaDueAt = slaDueAt !== undefined ? slaValidation.slaDueAtDate : toDate(existing.sla_due_at);
  const nextReminderAt =
    reminderAt !== undefined ? slaValidation.reminderAtDate : toDate(existing.reminder_at);
  const slaBreached = computeSlaBreached(nextStatus, nextSlaDueAt, resolvedAt, now);

  const updated = await updateWorkOrder(workOrderId, orgId, {
    ...rest,
    status,
    slaDueAt: slaDueAt !== undefined ? nextSlaDueAt : undefined,
    reminderAt: reminderAt !== undefined ? nextReminderAt : undefined,
    resolvedAt:
      resolvedAtInput !== undefined || (nextStatus === 'done' && !existing.resolved_at)
        ? resolvedAt ?? null
        : undefined,
    slaBreached,
    category: category !== undefined ? category ?? null : undefined,
  });

  if (!updated) return null;
  return hydrateWorkOrder(orgId, workOrderId);
}

export async function updateWorkOrderTasks(
  orgId: string,
  workOrderId: string,
  tasks: WorkOrderTaskInput[]
) {
  const existing = await findWorkOrderById(orgId, workOrderId);
  if (!existing) return null;

  await setTasks(workOrderId, tasks);
  return hydrateWorkOrder(orgId, workOrderId);
}

export async function getMaintenanceSummary(
  orgId: string,
  filters: { siteId?: string; deviceId?: string; now?: Date } = {}
): Promise<MaintenanceSummary> {
  const now = filters.now ?? new Date();
  const start = startOfDay(new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000));
  const end = endOfDay(new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000));

  const [counts, orders] = await Promise.all([
    getMaintenanceCounts(orgId, {
      siteId: filters.siteId,
      deviceId: filters.deviceId,
      now,
      dueSoonWindowHours: 24,
    }),
    findWorkOrdersBySlaWindow(orgId, {
      siteId: filters.siteId,
      deviceId: filters.deviceId,
      start,
      end,
    }),
  ]);

  const buckets = new Map<
    string,
    { date: string; open: MaintenanceItem[]; overdue: MaintenanceItem[]; done: MaintenanceItem[] }
  >();

  orders.forEach((order) => {
    const withSla = withComputedSla(order, now);
    const dueAt = toDate(withSla.sla_due_at);
    if (!dueAt) return;

    const dateKey = dueAt.toISOString().slice(0, 10);
    if (!buckets.has(dateKey)) {
      buckets.set(dateKey, { date: dateKey, open: [], overdue: [], done: [] });
    }
    const bucket = buckets.get(dateKey)!;
    const item: MaintenanceItem = {
      workOrderId: withSla.id,
      title: withSla.title,
      siteName: withSla.site_name,
      deviceName: withSla.device_name,
      slaDueAt: dueAt.toISOString(),
      status: withSla.status,
    };

    if (withSla.status === 'done') {
      bucket.done.push(item);
    } else if (withSla.sla_breached) {
      bucket.overdue.push(item);
    } else {
      bucket.open.push(item);
    }
  });

  const byDate = Array.from(buckets.values()).sort((a, b) => a.date.localeCompare(b.date));

  return { ...counts, byDate };
}
