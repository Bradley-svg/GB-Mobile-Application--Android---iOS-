import { getDeviceById } from './deviceService';
import { getDevicesForSite, getSiteById } from './siteService';
import { getTelemetryForDeviceRange } from '../repositories/telemetryRepository';

const ALLOWED_METRICS = ['supply_temp', 'return_temp', 'power_kw', 'flow_rate', 'cop'];

export class ExportError extends Error {
  reason: string;

  constructor(reason: string, message: string) {
    super(message);
    this.reason = reason;
    this.name = 'ExportError';
  }
}

function csvEscape(value: unknown) {
  const str = value === null || value === undefined ? '' : String(value);
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function buildCsv(rows: (string | number | null | undefined)[][]): string {
  return rows.map((row) => row.map(csvEscape).join(',')).join('\n');
}

export async function exportSiteDevicesCsv(orgId: string, siteId: string): Promise<string> {
  const site = await getSiteById(siteId, orgId);
  if (!site) {
    throw new ExportError('NOT_FOUND', 'Site not found');
  }

  const devices = await getDevicesForSite(site.id, orgId);
  const header = ['device_id', 'name', 'firmware_version', 'connectivity_status', 'last_seen', 'site_name'];
  const rows = devices.map((device) => [
    device.id,
    device.name ?? '',
    device.firmware_version ?? '',
    device.connectivity_status ?? '',
    device.last_seen_at ? new Date(device.last_seen_at).toISOString() : '',
    site.name ?? '',
  ]);

  return buildCsv([header, ...rows]);
}

export async function exportDeviceTelemetryCsv(
  orgId: string,
  deviceId: string,
  from: Date,
  to: Date,
  metrics?: string[]
): Promise<string> {
  if (from.getTime() >= to.getTime()) {
    throw new ExportError('INVALID_RANGE', '`from` must be before `to`');
  }

  const device = await getDeviceById(deviceId, orgId);
  if (!device) {
    throw new ExportError('NOT_FOUND', 'Device not found');
  }

  const normalizedMetrics = (metrics || [])
    .map((m) => m.trim())
    .filter((m) => m.length > 0 && ALLOWED_METRICS.includes(m));
  const metricsToQuery = normalizedMetrics.length > 0 ? normalizedMetrics : ALLOWED_METRICS;

  const points = await getTelemetryForDeviceRange(device.id, from, to, metricsToQuery);
  const header = ['timestamp', 'metric_name', 'value'];
  const rows = points.map((point) => [
    point.ts instanceof Date ? point.ts.toISOString() : new Date(point.ts).toISOString(),
    point.metric,
    point.value,
  ]);

  return buildCsv([header, ...rows]);
}
