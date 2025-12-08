import axios from 'axios';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../client';
import type {
  MaintenanceSummary,
  WorkOrder,
  WorkOrderDetail,
  WorkOrderFilters,
  WorkOrderAttachment,
  WorkOrderStatus,
  WorkOrderTask,
} from './types';

const shouldRetry = (failureCount: number, error: unknown) => {
  if (axios.isAxiosError(error)) {
    const status = error.response?.status;
    if (status && status < 500 && status !== 429) return false;
  }
  return failureCount < 2;
};

const retryDelay = (attempt: number) => attempt * 1000;

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
  const originalName =
    attachment.originalName ?? attachment.original_name ?? attachment.label ?? 'file';

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
    url: attachment.url,
  };
};

const normalizeDetail = (detail: WorkOrderDetail): WorkOrderDetail => ({
  ...normalizeWorkOrder(detail),
  tasks: detail.tasks,
  attachments: (detail.attachments || []).map((att) => normalizeAttachment(att)),
});

export function useWorkOrdersList(filters?: WorkOrderFilters) {
  const params: Record<string, string> = {};
  if (filters?.status && filters.status !== 'all') params.status = filters.status;
  if (filters?.siteId) params.siteId = filters.siteId;
  if (filters?.deviceId) params.deviceId = filters.deviceId;
  if (filters?.alertId) params.alertId = filters.alertId;
  if (filters?.q) params.q = filters.q;

  return useQuery<WorkOrder[]>({
    queryKey: ['work-orders', params],
    queryFn: async () => {
      const res = await api.get('/work-orders', { params });
      return (res.data as WorkOrder[]).map((order) => normalizeWorkOrder(order));
    },
    retry: shouldRetry,
    retryDelay,
  });
}

export function useWorkOrder(id: string) {
  return useQuery<WorkOrderDetail>({
    queryKey: ['work-orders', id],
    queryFn: async () => {
      const res = await api.get(`/work-orders/${id}`);
      return normalizeDetail(res.data as WorkOrderDetail);
    },
    enabled: !!id,
    retry: shouldRetry,
    retryDelay,
  });
}

export function useCreateWorkOrder() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: {
      title: string;
      siteId: string;
      deviceId?: string;
      alertId?: string;
      description?: string | null;
      priority?: string;
      assigneeUserId?: string | null;
      dueAt?: string | null;
      slaDueAt?: string | null;
      reminderAt?: string | null;
      category?: string | null;
    }) => {
      const res = await api.post('/work-orders', payload);
      return normalizeDetail(res.data as WorkOrderDetail);
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['work-orders'] });
      queryClient.setQueryData(['work-orders', data.id], data);
    },
  });
}

export function useCreateWorkOrderFromAlert(alertId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: { title?: string; description?: string }) => {
      const res = await api.post(`/alerts/${alertId}/work-orders`, payload ?? {});
      return normalizeDetail(res.data as WorkOrderDetail);
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['work-orders'] });
      queryClient.setQueryData(['work-orders', data.id], data);
    },
  });
}

export function useUpdateWorkOrderStatus() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: {
      workOrderId: string;
      status?: WorkOrderStatus;
      title?: string;
      description?: string | null;
      priority?: string;
      assigneeUserId?: string | null;
      dueAt?: string | null;
      slaDueAt?: string | null;
      reminderAt?: string | null;
      category?: string | null;
    }) => {
      const { workOrderId, ...body } = payload;
      const res = await api.patch(`/work-orders/${workOrderId}`, body);
      return normalizeDetail(res.data as WorkOrderDetail);
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['work-orders'] });
      queryClient.setQueryData(['work-orders', data.id], data);
    },
  });
}

export function useUpdateWorkOrderTasks() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: { workOrderId: string; tasks: Array<Partial<WorkOrderTask>> }) => {
      const res = await api.put(`/work-orders/${payload.workOrderId}/tasks`, {
        tasks: payload.tasks,
      });
      return normalizeDetail(res.data as WorkOrderDetail);
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['work-orders'] });
      queryClient.setQueryData(['work-orders', data.id], data);
    },
  });
}

export function useMaintenanceSummary(filters?: { siteId?: string; deviceId?: string }) {
  const params: Record<string, string> = {};
  if (filters?.siteId) params.siteId = filters.siteId;
  if (filters?.deviceId) params.deviceId = filters.deviceId;

  return useQuery<MaintenanceSummary>({
    queryKey: ['maintenance-summary', params],
    queryFn: async () => {
      const res = await api.get('/maintenance/summary', { params });
      return res.data as MaintenanceSummary;
    },
    retry: shouldRetry,
    retryDelay,
  });
}

type UploadAttachmentInput = {
  uri: string;
  name: string;
  type?: string;
  size?: number | null;
};

export function useWorkOrderAttachments(workOrderId: string) {
  return useQuery<WorkOrderAttachment[]>({
    queryKey: ['work-orders', workOrderId, 'attachments'],
    enabled: !!workOrderId,
    queryFn: async () => {
      const res = await api.get(`/work-orders/${workOrderId}/attachments`);
      return (res.data as WorkOrderAttachment[]).map((att) => normalizeAttachment(att));
    },
    retry: shouldRetry,
    retryDelay,
  });
}

export function useUploadWorkOrderAttachment(workOrderId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: UploadAttachmentInput) => {
      const formData = new FormData();
      const filePayload = {
        uri: payload.uri,
        name: payload.name,
        type: payload.type || 'application/octet-stream',
      };
      formData.append('file', filePayload as unknown as Blob);
      const res = await api.post(`/work-orders/${workOrderId}/attachments`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      return normalizeAttachment(res.data as WorkOrderAttachment);
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['work-orders', workOrderId, 'attachments'] });
      queryClient.invalidateQueries({ queryKey: ['work-orders', workOrderId] });
      queryClient.setQueryData(['work-orders', workOrderId, 'attachments'], (existing) => {
        if (Array.isArray(existing)) {
          return [data, ...existing];
        }
        return [data];
      });
    },
  });
}
