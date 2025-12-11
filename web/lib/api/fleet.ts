import { api } from "./httpClient";
import type { FleetSearchResult, HealthStatus } from "@/lib/types/fleet";

type FleetParams = {
  q?: string;
  health?: HealthStatus[];
  tag?: string | null;
};

export async function fetchFleet(params: FleetParams = {}): Promise<FleetSearchResult> {
  const res = await api.get<FleetSearchResult>("/fleet", {
    params: {
      q: params.q?.trim() || undefined,
      health: params.health && params.health.length > 0 ? params.health : undefined,
      tag: params.tag ?? undefined,
    },
  });
  return res.data;
}
