import { api } from "./httpClient";
import type { DemoStatus } from "@/lib/types/demo";

export async function fetchDemoStatus(): Promise<DemoStatus> {
  const res = await api.get<DemoStatus>("/demo/status");
  return res.data;
}
