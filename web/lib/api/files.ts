import { api } from "./httpClient";

export async function requestSignedFileUrl(fileId: string): Promise<string> {
  const res = await api.post<{ url: string }>(`/files/${fileId}/signed-url`, {});
  return (res.data as { url?: string })?.url ?? "";
}
