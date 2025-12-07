import axios from 'axios';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../client';
import type {
  WorkOrder,
  WorkOrderDetail,
  WorkOrderFilters,
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
      return res.data;
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
      return res.data;
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
    }) => {
      const res = await api.post('/work-orders', payload);
      return res.data as WorkOrderDetail;
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
      return res.data as WorkOrderDetail;
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
    }) => {
      const { workOrderId, ...body } = payload;
      const res = await api.patch(`/work-orders/${workOrderId}`, body);
      return res.data as WorkOrderDetail;
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
      return res.data as WorkOrderDetail;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['work-orders'] });
      queryClient.setQueryData(['work-orders', data.id], data);
    },
  });
}
