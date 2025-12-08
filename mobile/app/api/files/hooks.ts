import { useMutation } from '@tanstack/react-query';
import { api } from '../client';

export async function requestSignedFileUrl(fileId: string): Promise<string> {
  const res = await api.post<{ url: string }>(`/files/${fileId}/signed-url`, {});
  return (res.data as { url: string }).url;
}

export function useSignedFileUrl() {
  return useMutation({
    mutationFn: (fileId: string) => requestSignedFileUrl(fileId),
  });
}
