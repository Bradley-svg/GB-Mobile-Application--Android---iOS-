import { getSiteById as getSiteByIdRepo, getSitesForOrganisation as getSitesRepo } from '../repositories/sitesRepository';
import { getDevicesForSite as getDevicesForSiteRepo } from '../repositories/devicesRepository';

export async function getSitesForOrganisation(organisationId: string) {
  return getSitesRepo(organisationId);
}

export async function getSiteById(id: string, organisationId: string) {
  return getSiteByIdRepo(id, organisationId);
}

export async function getDevicesForSite(siteId: string, organisationId: string) {
  return getDevicesForSiteRepo(siteId, organisationId);
}
