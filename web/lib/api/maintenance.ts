import { api } from "./httpClient";
import type { MaintenanceSummary } from "@/lib/types/maintenance";

type MaintenanceParams = {
  orgId?: string | null;
  from?: string;
  to?: string;
  siteId?: string;
  deviceId?: string;
};

export async function listMaintenanceSummary(params: MaintenanceParams = {}): Promise<MaintenanceSummary> {
  const res = await api.get<MaintenanceSummary>("/maintenance/summary", {
    params: {
      orgId: params.orgId ?? undefined,
      from: params.from ?? undefined,
      to: params.to ?? undefined,
      siteId: params.siteId ?? undefined,
      deviceId: params.deviceId ?? undefined,
    },
  });

  const summary = res.data ?? { openCount: 0, overdueCount: 0, dueSoonCount: 0, byDate: [] };
  return {
    openCount: summary.openCount ?? 0,
    overdueCount: summary.overdueCount ?? 0,
    dueSoonCount: summary.dueSoonCount ?? 0,
    byDate: summary.byDate ?? [],
  };
}
