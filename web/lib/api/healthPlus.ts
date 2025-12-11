import { api } from "./httpClient";
import type { HealthPlusPayload } from "@/lib/types/health";

export async function fetchHealthPlus() {
  const res = await api.get<HealthPlusPayload>("/health-plus");
  return res.data;
}
