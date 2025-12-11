"use client";

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { fetchOrgs, type OrgSummary } from "@/lib/api/orgs";

type OrgState = {
  currentOrgId: string | null;
  orgs: OrgSummary[];
  loading: boolean;
  error?: string | null;
  setOrg: (orgId: string) => void;
  setOrgs: (orgs: OrgSummary[]) => void;
  loadOrgs: (params: { role?: string | null; fallbackOrgId?: string | null }) => Promise<void>;
};

const memoryStorage = {
  getItem: () => null,
  setItem: () => {},
  removeItem: () => {},
};

export const useOrgStore = create<OrgState>()(
  persist(
    (set, get) => ({
      currentOrgId: null,
      orgs: [],
      loading: false,
      error: null,
      setOrg: (currentOrgId) => set({ currentOrgId }),
      setOrgs: (orgs) => set({ orgs }),
      loadOrgs: async ({ role, fallbackOrgId }) => {
        const isPrivileged = role === "owner" || role === "admin" || role === "facilities";
        set({ loading: true, error: null });
        try {
          if (isPrivileged) {
            const list = await fetchOrgs();
            const orgs = list.length ? list : fallbackOrgId ? [{ id: fallbackOrgId, name: "Default org" }] : [];
            set({
              orgs,
              currentOrgId: get().currentOrgId ?? orgs[0]?.id ?? null,
              loading: false,
            });
            return;
          }

          if (fallbackOrgId) {
            set({
              orgs: [{ id: fallbackOrgId, name: "My organisation" }],
              currentOrgId: fallbackOrgId,
              loading: false,
            });
          } else {
            set({ loading: false, error: "No organisation assigned" });
          }
        } catch (err) {
          const message = err instanceof Error ? err.message : "Unable to load organisations";
          const fallbackOrg = fallbackOrgId ? [{ id: fallbackOrgId, name: "My organisation" }] : [];
          set({
            error: message,
            loading: false,
            orgs: fallbackOrg,
            currentOrgId: get().currentOrgId ?? fallbackOrg[0]?.id ?? null,
          });
        }
      },
    }),
    {
      name: "gb-web-org",
      storage: createJSONStorage(() => (typeof window === "undefined" ? memoryStorage : window.localStorage)),
      partialize: (state) => ({ currentOrgId: state.currentOrgId, orgs: state.orgs }),
    },
  ),
);

export function useOrgRoleAwareLoader() {
  const { role } = useUserRole();
  const loadOrgs = useOrgStore((s) => s.loadOrgs);
  return async (fallbackOrgId?: string | null) => loadOrgs({ role, fallbackOrgId: fallbackOrgId ?? null });
}
