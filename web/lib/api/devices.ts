import { api } from "./httpClient";
import type { ApiDevice } from "@/lib/types/fleet";
import type { DeviceTelemetry, TimeRange } from "@/lib/types/telemetry";

export async function fetchDevice(deviceId: string) {
  const res = await api.get<ApiDevice>(`/devices/${deviceId}`);
  return res.data;
}

export async function fetchDeviceTelemetry(deviceId: string, range: TimeRange = "1h") {
  const res = await api.get<DeviceTelemetry>(`/devices/${deviceId}/telemetry`, {
    params: { range },
  });
  return res.data;
}
