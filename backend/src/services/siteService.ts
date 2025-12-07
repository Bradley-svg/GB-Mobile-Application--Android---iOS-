import {
  getSiteById as getSiteByIdRepo,
  getSitesForOrganisation as getSitesRepo,
  type SiteWithStatsRow,
} from '../repositories/sitesRepository';
import {
  getDevicesForSite as getDevicesForSiteRepo,
  type DeviceRow,
} from '../repositories/devicesRepository';
import {
  getActiveAlertsForOrganisation,
  type AlertSeverity,
  type AlertWithSite,
} from '../repositories/alertsRepository';
import {
  combineHealth,
  computeHealthFromSignals,
  summarizeLastSeen,
  type HealthStatus,
} from './healthScoreService';

type SiteFilters = {
  search?: string | null;
  health?: HealthStatus[];
  tag?: string | string[] | null;
  limit?: number;
  offset?: number;
};

export type DeviceWithHealth = DeviceRow & {
  health: HealthStatus;
  last_seen: ReturnType<typeof summarizeLastSeen>;
};

export type SiteWithHealth = SiteWithStatsRow & {
  health: HealthStatus;
  last_seen: ReturnType<typeof summarizeLastSeen>;
};

export function indexAlerts(alerts: AlertWithSite[]) {
  const alertsBySite = new Map<string, AlertSeverity[]>();
  const alertsByDevice = new Map<string, AlertSeverity[]>();

  for (const alert of alerts) {
    const deviceId = alert.device_id;
    const siteId = alert.resolved_site_id || alert.site_id;

    if (siteId) {
      const list = alertsBySite.get(siteId) ?? [];
      list.push(alert.severity);
      alertsBySite.set(siteId, list);
    }

    if (deviceId) {
      const list = alertsByDevice.get(deviceId) ?? [];
      list.push(alert.severity);
      alertsByDevice.set(deviceId, list);
    }
  }

  return { alertsBySite, alertsByDevice };
}

export function mapSiteHealth(
  site: SiteWithStatsRow,
  alertsForSite: AlertSeverity[]
): SiteWithHealth {
  const lastSeenAt = site.latest_device_seen_at || site.last_seen_at || null;
  const { health, lastSeen } = computeHealthFromSignals({
    status: site.status,
    lastSeenAt,
    alerts: alertsForSite,
  });

  return {
    ...site,
    last_seen: lastSeen,
    last_seen_at: lastSeen.at ? new Date(lastSeen.at) : null,
    health,
  };
}

export function mapDeviceHealth(
  device: DeviceRow,
  alertsForDevice: AlertSeverity[]
): DeviceWithHealth {
  const { health, lastSeen } = computeHealthFromSignals({
    status: device.status,
    lastSeenAt: device.last_seen_at ?? null,
    alerts: alertsForDevice,
  });

  return { ...device, health, last_seen: lastSeen };
}

export async function getSitesForOrganisation(
  organisationId: string,
  filters: SiteFilters = {}
): Promise<SiteWithHealth[]> {
  const [sites, activeAlerts] = await Promise.all([
    getSitesRepo(organisationId, {
      search: filters.search ?? undefined,
      limit: filters.limit,
      offset: filters.offset,
    }),
    getActiveAlertsForOrganisation(organisationId),
  ]);

  const { alertsBySite } = indexAlerts(activeAlerts);

  let mapped = sites.map((site) => mapSiteHealth(site, alertsBySite.get(site.id) ?? []));

  if (filters.health && filters.health.length > 0) {
    const allowed = new Set<HealthStatus>(filters.health);
    mapped = mapped.filter((site) => allowed.has(site.health));
  }

  return mapped;
}

export async function getSiteById(id: string, organisationId: string) {
  const [site, activeAlerts] = await Promise.all([
    getSiteByIdRepo(id, organisationId),
    getActiveAlertsForOrganisation(organisationId),
  ]);

  if (!site) return null;

  const { alertsBySite } = indexAlerts(activeAlerts);
  return mapSiteHealth(site, alertsBySite.get(site.id) ?? []);
}

export async function getDevicesForSite(
  siteId: string,
  organisationId: string
): Promise<DeviceWithHealth[]> {
  const [devices, activeAlerts] = await Promise.all([
    getDevicesForSiteRepo(siteId, organisationId),
    getActiveAlertsForOrganisation(organisationId),
  ]);

  const { alertsByDevice } = indexAlerts(activeAlerts);
  const devicesWithHealth = devices.map((device) =>
    mapDeviceHealth(device, alertsByDevice.get(device.id) ?? [])
  );

  return devicesWithHealth;
}

export function deriveSiteHealthFromDevices(
  site: SiteWithStatsRow,
  devices: DeviceWithHealth[]
): SiteWithHealth {
  const worstDeviceHealth = combineHealth(devices.map((d) => d.health));
  const { health: baseHealth, lastSeen } = computeHealthFromSignals({
    status: site.status,
    lastSeenAt: site.latest_device_seen_at || site.last_seen_at,
  });

  const health = combineHealth([baseHealth, worstDeviceHealth]);
  return {
    ...site,
    health,
    last_seen: lastSeen,
    last_seen_at: lastSeen.at ? new Date(lastSeen.at) : null,
  };
}
