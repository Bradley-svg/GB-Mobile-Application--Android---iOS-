import { api } from './client';

export async function fetchSiteDevicesCsv(siteId: string) {
  const res = await api.get<string>(`/sites/${siteId}/export/devices.csv`, {
    responseType: 'text',
  });
  return res.data;
}

export async function fetchDeviceTelemetryCsv(
  deviceId: string,
  from: string,
  to: string,
  metrics?: string[]
) {
  const res = await api.get<string>(`/devices/${deviceId}/export/telemetry.csv`, {
    params: {
      from,
      to,
      metrics: metrics && metrics.length > 0 ? metrics.join(',') : undefined,
    },
    responseType: 'text',
  });
  return res.data;
}
