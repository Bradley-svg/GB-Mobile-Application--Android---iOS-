import { api } from "./httpClient";
import type { ShareLink } from "@/lib/types/shareLinks";

type ShareScope = "site" | "device";

const pathForScope = (scope: ShareScope, id: string) =>
  scope === "site" ? `/sites/${id}/share-links` : `/devices/${id}/share-links`;

const normalizeShareLink = (link: ShareLink): ShareLink => {
  const expiresAt = link.expiresAt ?? (link as { expires_at?: string }).expires_at ?? "";
  const createdAt = link.createdAt ?? (link as { created_at?: string }).created_at ?? "";
  const revokedAt = link.revokedAt ?? (link as { revoked_at?: string | null }).revoked_at ?? null;

  return {
    ...link,
    expiresAt,
    createdAt,
    revokedAt,
  };
};

export async function listShareLinks(scope: ShareScope, id: string): Promise<ShareLink[]> {
  const res = await api.get<ShareLink[]>(pathForScope(scope, id));
  return (res.data ?? []).map((link) => normalizeShareLink(link));
}

export async function createShareLink(params: {
  scope: ShareScope;
  id: string;
  expiresAt: string;
  permissions?: string;
}): Promise<ShareLink> {
  const res = await api.post<ShareLink>(pathForScope(params.scope, params.id), {
    expiresAt: params.expiresAt,
    permissions: params.permissions ?? "read_only",
  });
  return normalizeShareLink(res.data);
}

export async function revokeShareLink(linkId: string): Promise<void> {
  await api.delete(`/share-links/${linkId}`);
}
