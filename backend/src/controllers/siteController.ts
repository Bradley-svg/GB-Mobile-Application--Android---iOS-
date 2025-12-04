import { NextFunction, Request, Response } from 'express';
import { z } from 'zod';
import { getDevicesForSite, getSiteById, getSitesForOrganisation } from '../services/siteService';
import { resolveOrganisationId } from '../utils/organisation';

const siteIdSchema = z.object({ id: z.string().uuid() });

export async function listSites(req: Request, res: Response, next: NextFunction) {
  try {
    const organisationId = await resolveOrganisationId(req.user!.id, res);
    if (!organisationId) return;

    const sites = await getSitesForOrganisation(organisationId);
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
