import { api } from "./httpClient";
import type { DeviceTelemetry } from "@/lib/types/telemetry";

export async function fetchDeviceTelemetry(deviceId: string, range: DeviceTelemetry["range"] = "1h") {
  const res = await api.get<DeviceTelemetry>(`/devices/${deviceId}/telemetry`, {
    params: { range },
  });
  return res.data;
}
