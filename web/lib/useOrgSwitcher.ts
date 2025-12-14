"use client";

import { useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { shallow } from "zustand/shallow";
import { useOrgStore } from "@/lib/orgStore";

export function useOrgSwitcher() {
  const queryClient = useQueryClient();
  const currentOrgId = useOrgStore((state) => state.currentOrgId);
  const orgs = useOrgStore((state) => state.orgs, shallow);
  const setOrg = useOrgStore((state) => state.setOrg);

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
