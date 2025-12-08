import axios from 'axios';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../client';
import type { Document } from './types';

const shouldRetry = (failureCount: number, error: unknown) => {
  if (axios.isAxiosError(error)) {
    const status = error.response?.status;
    if (status && status < 500 && status !== 429) return false;
  }
  return failureCount < 2;
};

const retryDelay = (attempt: number) => attempt * 1000;

const normalizeDocument = (doc: Document): Document => {
  const originalName = doc.originalName ?? doc.original_name ?? doc.title;
  const mimeType = doc.mimeType ?? doc.mime_type ?? null;
  const sizeBytes = doc.sizeBytes ?? doc.size_bytes ?? null;
  const createdAt = doc.createdAt ?? doc.created_at ?? null;

  return {
    ...doc,
    originalName,
    original_name: originalName,
    mimeType,
    mime_type: mimeType,
    sizeBytes,
    size_bytes: sizeBytes,
    createdAt: createdAt ?? undefined,
    created_at: createdAt ?? undefined,
  };
};

export function useSiteDocuments(siteId: string) {
  return useQuery<Document[]>({
    queryKey: ['documents', 'site', siteId],
    enabled: !!siteId,
    queryFn: async () => {
      const res = await api.get(`/sites/${siteId}/documents`);
      return (res.data as Document[]).map((doc) => normalizeDocument(doc));
    },
    retry: shouldRetry,
    retryDelay,
  });
}

export function useDeviceDocuments(deviceId: string) {
  return useQuery<Document[]>({
    queryKey: ['documents', 'device', deviceId],
    enabled: !!deviceId,
    queryFn: async () => {
      const res = await api.get(`/devices/${deviceId}/documents`);
      return (res.data as Document[]).map((doc) => normalizeDocument(doc));
    },
    retry: shouldRetry,
    retryDelay,
  });
}

type UploadDocumentInput = {
  uri: string;
  name: string;
  type?: string;
  size?: number | null;
  title?: string;
  category?: string;
  description?: string | null;
};

export function useUploadSiteDocument(siteId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: UploadDocumentInput) => {
      const formData = new FormData();
      const filePayload = {
        uri: payload.uri,
        name: payload.name,
        type: payload.type || 'application/octet-stream',
      };
      formData.append('file', filePayload as unknown as Blob);
      if (payload.title) formData.append('title', payload.title);
      if (payload.category) formData.append('category', payload.category);
      if (payload.description) formData.append('description', payload.description);
      const res = await api.post(`/sites/${siteId}/documents`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      return normalizeDocument(res.data as Document);
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['documents', 'site', siteId] });
      queryClient.setQueryData(['documents', 'site', siteId], (existing) => {
        if (Array.isArray(existing)) {
          return [data, ...existing];
        }
        return [data];
      });
    },
  });
}

export function useUploadDeviceDocument(deviceId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: UploadDocumentInput) => {
      const formData = new FormData();
      const filePayload = {
        uri: payload.uri,
        name: payload.name,
        type: payload.type || 'application/octet-stream',
      };
      formData.append('file', filePayload as unknown as Blob);
      if (payload.title) formData.append('title', payload.title);
      if (payload.category) formData.append('category', payload.category);
      if (payload.description) formData.append('description', payload.description);
      const res = await api.post(`/devices/${deviceId}/documents`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      return normalizeDocument(res.data as Document);
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['documents', 'device', deviceId] });
      queryClient.setQueryData(['documents', 'device', deviceId], (existing) => {
        if (Array.isArray(existing)) {
          return [data, ...existing];
        }
        return [data];
      });
    },
  });
}
