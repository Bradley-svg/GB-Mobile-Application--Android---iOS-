import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../client';
import { ShareLink } from '../types';

type Scope = 'site' | 'device';

const shareLinksKey = (scope: Scope, id: string) => ['share-links', scope, id];

export function useShareLinks(scope: Scope, id: string) {
  return useQuery({
    queryKey: shareLinksKey(scope, id),
    enabled: !!id,
    queryFn: async () => {
      const path =
        scope === 'site' ? `/sites/${id}/share-links` : `/devices/${id}/share-links`;
      const res = await api.get<ShareLink[]>(path);
      return res.data;
    },
  });
}

type CreateShareLinkArgs = {
  scope: Scope;
  id: string;
  expiresAt: string;
  permissions?: string;
};

export function useCreateShareLink() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ scope, id, expiresAt, permissions = 'read_only' }: CreateShareLinkArgs) => {
      const path =
        scope === 'site' ? `/sites/${id}/share-links` : `/devices/${id}/share-links`;
      const res = await api.post<ShareLink>(path, { expiresAt, permissions });
      return res.data;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: shareLinksKey(variables.scope, variables.id) });
    },
  });
}

type RevokeShareLinkArgs = {
  linkId: string;
  scope: Scope;
  scopeId: string;
};

export function useRevokeShareLink() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ linkId }: RevokeShareLinkArgs) => {
      await api.delete(`/share-links/${linkId}`);
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: shareLinksKey(variables.scope, variables.scopeId),
      });
    },
  });
}
