import { findAlertForOrganisation } from '../repositories/alertsRepository';
import { getDeviceById } from '../repositories/devicesRepository';
import { getSiteById } from '../repositories/sitesRepository';
import {
  createWorkOrder as insertWorkOrder,
  findWorkOrderById,
  findWorkOrdersForAlert,
  findWorkOrdersForDevice,
  findWorkOrdersForOrg,
  listAttachments,
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

export type WorkOrderWithDetails = WorkOrderWithRefs & {
  tasks: WorkOrderTaskRow[];
  attachments: WorkOrderAttachmentRow[];
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

type ListFilters = {
  siteId?: string;
  deviceId?: string;
  alertId?: string;
  status?: WorkOrderStatus;
  search?: string;
};

type CreateWorkOrderOptions = Omit<CreateWorkOrderInput, 'organisationId'> & {
  orgId: string;
  tasks?: WorkOrderTaskInput[];
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
};

async function hydrateWorkOrder(
  organisationId: string,
  workOrderId: string
): Promise<WorkOrderWithDetails | null> {
  const base = await findWorkOrderById(organisationId, workOrderId);
  if (!base) return null;

  const [tasks, attachments] = await Promise.all([listTasks(workOrderId), listAttachments(workOrderId)]);
  return { ...base, tasks, attachments };
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
  return findWorkOrdersForOrg(orgId, filters);
}

export async function listWorkOrdersForDevice(orgId: string, deviceId: string) {
  return findWorkOrdersForDevice(orgId, deviceId);
}

export async function listWorkOrdersForAlert(orgId: string, alertId: string) {
  return findWorkOrdersForAlert(orgId, alertId);
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
  const { orgId, tasks, ...input } = options;
  await validateSiteAndDevice(orgId, input.siteId, input.deviceId ?? null);

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
  }

  const workOrder = await insertWorkOrder({
    ...input,
    organisationId: orgId,
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
  });

  return workOrder;
}

export async function updateWorkOrderDetails(options: UpdateWorkOrderOptions) {
  const { orgId, workOrderId, status, ...rest } = options;
  const existing = await findWorkOrderById(orgId, workOrderId);
  if (!existing) return null;

  if (status) {
    assertStatusTransition(existing.status, status);
  }

  const updated = await updateWorkOrder(workOrderId, orgId, {
    ...rest,
    status,
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
