import { api } from "./httpClient";
import type {
  WorkOrder,
  WorkOrderAttachment,
  WorkOrderDetail,
  WorkOrderPriority,
  WorkOrderStatus,
} from "@/lib/types/workOrders";

type ListWorkOrdersParams = {
  orgId?: string | null;
  status?: WorkOrderStatus | "all";
  deviceId?: string;
  siteId?: string;
};

type UpdateWorkOrderPayload = {
  workOrderId: string;
  orgId?: string | null;
  status?: WorkOrderStatus;
  title?: string;
  description?: string | null;
  priority?: WorkOrderPriority;
  assigneeUserId?: string | null;
  dueAt?: string | null;
  slaDueAt?: string | null;
  reminderAt?: string | null;
  category?: string | null;
};

const normalizeWorkOrder = (order: WorkOrder): WorkOrder => {
  const slaDueAt = order.slaDueAt ?? order.sla_due_at ?? null;
  const resolvedAt = order.resolvedAt ?? order.resolved_at ?? null;
  const slaBreached = order.slaBreached ?? order.sla_breached ?? false;
  const reminderAt = order.reminderAt ?? order.reminder_at ?? null;

  return {
    ...order,
    slaDueAt,
    sla_due_at: slaDueAt,
    resolvedAt,
    resolved_at: resolvedAt,
    slaBreached,
    sla_breached: slaBreached,
    reminderAt,
    reminder_at: reminderAt,
  };
};

const normalizeAttachment = (attachment: WorkOrderAttachment): WorkOrderAttachment => {
  const mimeType = attachment.mimeType ?? attachment.mime_type ?? null;
  const sizeBytes = attachment.sizeBytes ?? attachment.size_bytes ?? null;
  const createdAt = attachment.createdAt ?? attachment.created_at ?? undefined;
  const originalName = attachment.originalName ?? attachment.original_name ?? attachment.label ?? "file";
  const fileStatus = attachment.fileStatus ?? attachment.file_status ?? null;

  return {
    ...attachment,
    originalName,
    original_name: originalName,
    mimeType,
    mime_type: mimeType,
    sizeBytes,
    size_bytes: sizeBytes,
    createdAt,
    created_at: createdAt,
    fileStatus,
    file_status: fileStatus,
    url: attachment.url,
  };
};

const normalizeDetail = (detail: WorkOrderDetail): WorkOrderDetail => ({
  ...normalizeWorkOrder(detail),
  tasks: detail.tasks ?? [],
  attachments: (detail.attachments ?? []).map(normalizeAttachment),
});

export async function listWorkOrders(params: ListWorkOrdersParams = {}): Promise<WorkOrder[]> {
  const res = await api.get<WorkOrder[]>("/work-orders", {
    params: {
      orgId: params.orgId ?? undefined,
      status: params.status && params.status !== "all" ? params.status : undefined,
      deviceId: params.deviceId ?? undefined,
      siteId: params.siteId ?? undefined,
    },
  });

  return (res.data ?? []).map((order) => normalizeWorkOrder(order));
}

export async function getWorkOrder(workOrderId: string, orgId?: string | null): Promise<WorkOrderDetail> {
  const res = await api.get<WorkOrderDetail>(`/work-orders/${workOrderId}`, {
    params: { orgId: orgId ?? undefined },
  });

  return normalizeDetail(res.data as WorkOrderDetail);
}

export async function updateWorkOrderStatus(payload: UpdateWorkOrderPayload): Promise<WorkOrderDetail> {
  const { workOrderId, orgId, ...body } = payload;
  const filteredBody = Object.fromEntries(
    Object.entries(body).filter(([, value]) => value !== undefined),
  );

  const res = await api.patch<WorkOrderDetail>(`/work-orders/${workOrderId}`, filteredBody, {
    params: { orgId: orgId ?? undefined },
  });

  return normalizeDetail(res.data as WorkOrderDetail);
}
