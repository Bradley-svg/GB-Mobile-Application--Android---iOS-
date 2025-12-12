"use client";

import { useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useOrgStore } from "@/lib/orgStore";

export function useOrgSwitcher() {
  const queryClient = useQueryClient();
  const { currentOrgId, orgs, setOrg } = useOrgStore((state) => ({
    currentOrgId: state.currentOrgId,
    orgs: state.orgs,
    setOrg: state.setOrg,
  }));

  const resetOrgQueries = useCallback(() => {
    queryClient.cancelQueries();
    queryClient.resetQueries({ predicate: () => true });
  }, [queryClient]);

  const switchOrg = useCallback(
    (orgId: string) => {
      if (!orgId || orgId === currentOrgId) return;
      resetOrgQueries();
      setOrg(orgId);
    },
    [currentOrgId, resetOrgQueries, setOrg],
  );

  return {
    currentOrgId,
    orgs,
    switchOrg,
    resetOrgQueries,
  };
}
