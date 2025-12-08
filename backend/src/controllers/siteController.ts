import { NextFunction, Request, Response } from 'express';
import { z } from 'zod';
import { getDevicesForSite, getSiteById, getSitesForOrganisation } from '../services/siteService';
import { resolveOrganisationId } from './organisation';
import type { HealthStatus } from '../services/healthScoreService';
import { ExportError, exportSiteDevicesCsv } from '../services/exportService';

const siteIdSchema = z.object({ id: z.string().uuid() });
const siteQuerySchema = z.object({
  q: z.string().trim().optional(),
  health: z
    .union([z.string(), z.array(z.string())])
    .optional()
    .transform((value) => {
      if (!value) return [];
      return Array.isArray(value) ? value : [value];
    }),
  tag: z.string().trim().optional(),
  limit: z.coerce.number().int().positive().max(200).optional(),
  offset: z.coerce.number().int().nonnegative().optional(),
});
const allowedHealth = new Set<HealthStatus>(['healthy', 'warning', 'critical', 'offline']);

export async function listSites(req: Request, res: Response, next: NextFunction) {
  const parsedQuery = siteQuerySchema.safeParse(req.query);
  if (!parsedQuery.success) {
    return res.status(400).json({ message: 'Invalid query' });
  }

  const healthFilters = (parsedQuery.data.health || [])
    .map((h) => h.toLowerCase() as HealthStatus)
    .filter((h) => allowedHealth.has(h));

  try {
    const organisationId = await resolveOrganisationId(req.user!.id, res);
    if (!organisationId) return;

    const sites = await getSitesForOrganisation(organisationId, {
      search: parsedQuery.data.q,
      health: healthFilters,
      tag: parsedQuery.data.tag,
      limit: parsedQuery.data.limit,
      offset: parsedQuery.data.offset,
    });
    res.json(sites);
  } catch (e) {
    next(e);
  }
}

export async function getSite(req: Request, res: Response, next: NextFunction) {
  const parsedParams = siteIdSchema.safeParse(req.params);
  if (!parsedParams.success) {
    return res.status(400).json({ message: 'Invalid site id' });
  }

  try {
    const organisationId = await resolveOrganisationId(req.user!.id, res);
    if (!organisationId) return;

    const site = await getSiteById(parsedParams.data.id, organisationId);
    if (!site) return res.status(404).json({ message: 'Not found' });
    res.json(site);
  } catch (e) {
    next(e);
  }
}

export async function getSiteDevices(req: Request, res: Response, next: NextFunction) {
  const parsedParams = siteIdSchema.safeParse(req.params);
  if (!parsedParams.success) {
    return res.status(400).json({ message: 'Invalid site id' });
  }

  try {
    const organisationId = await resolveOrganisationId(req.user!.id, res);
    if (!organisationId) return;

    const devices = await getDevicesForSite(parsedParams.data.id, organisationId);
    res.json(devices);
  } catch (e) {
    next(e);
  }
}

export async function exportSiteDevicesCsvHandler(req: Request, res: Response, next: NextFunction) {
  const parsedParams = siteIdSchema.safeParse(req.params);
  if (!parsedParams.success) {
    return res.status(400).json({ message: 'Invalid site id' });
  }

  try {
    const organisationId = await resolveOrganisationId(req.user!.id, res);
    if (!organisationId) return;

    const csv = await exportSiteDevicesCsv(organisationId, parsedParams.data.id);
    res
      .setHeader('Content-Type', 'text/csv')
      .setHeader('Content-Disposition', `attachment; filename="site-${parsedParams.data.id}-devices.csv"`)
      .send(csv);
  } catch (err) {
    if (err instanceof ExportError) {
      const status = err.reason === 'NOT_FOUND' ? 404 : 400;
      return res.status(status).json({ message: err.message });
    }
    return next(err);
  }
}
