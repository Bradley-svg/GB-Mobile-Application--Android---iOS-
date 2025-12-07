import {
  getSitesForOrganisation as getSitesRepo,
  type SiteWithStatsRow,
} from '../repositories/sitesRepository';
import { searchDevices, type DeviceSearchRow } from '../repositories/devicesRepository';
import { getActiveAlertsForOrganisation } from '../repositories/alertsRepository';
import { type HealthStatus } from './healthScoreService';
import {
  indexAlerts,
  mapDeviceHealth,
  mapSiteHealth,
  type DeviceWithHealth,
  type SiteWithHealth,
} from './siteService';

type FleetSearchOptions = {
  organisationId: string;
  search?: string | null;
  health?: HealthStatus[];
  tag?: string | string[] | null;
  limit?: number;
  offset?: number;
};

export type FleetSearchResult = {
  sites: SiteWithHealth[];
  devices: Array<DeviceWithHealth & { site_name: string; site_city: string | null }>;
};

export async function searchFleet(options: FleetSearchOptions): Promise<FleetSearchResult> {
  const [sites, devices, alerts] = await Promise.all([
    getSitesRepo(options.organisationId, {
      search: options.search ?? undefined,
      limit: options.limit,
      offset: options.offset,
    }),
    searchDevices({
      organisationId: options.organisationId,
      search: options.search ?? undefined,
      limit: options.limit,
      offset: options.offset,
    }),
    getActiveAlertsForOrganisation(options.organisationId),
  ]);

  const { alertsBySite, alertsByDevice } = indexAlerts(alerts);

  let mappedSites = sites.map((site: SiteWithStatsRow) =>
    mapSiteHealth(site, alertsBySite.get(site.id) ?? [])
  );
  let mappedDevices = devices.map((device: DeviceSearchRow) => ({
    ...mapDeviceHealth(device, alertsByDevice.get(device.id) ?? []),
    site_name: device.site_name,
    site_city: device.site_city,
  }));

  if (options.health && options.health.length > 0) {
    const allowed = new Set<HealthStatus>(options.health);
    mappedSites = mappedSites.filter((s) => allowed.has(s.health));
    mappedDevices = mappedDevices.filter((d) => allowed.has(d.health));
  }

  return { sites: mappedSites, devices: mappedDevices };
}
