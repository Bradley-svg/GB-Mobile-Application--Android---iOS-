import { NextFunction, Request, Response } from 'express';
import { z } from 'zod';
import { resolveOrganisationId } from './organisation';
import { getDeviceById } from '../services/deviceService';
import { getSiteById } from '../services/siteService';
import { getRulesForDeviceContext, getRulesForSiteContext } from '../services/alertRulesService';

const deviceIdSchema = z.object({ id: z.string().uuid() });
const siteIdSchema = z.object({ id: z.string().uuid() });

export async function listRulesForDevice(req: Request, res: Response, next: NextFunction) {
  const parsedParams = deviceIdSchema.safeParse(req.params);
  if (!parsedParams.success) {
    return res.status(400).json({ message: 'Invalid device id' });
  }

  try {
    const organisationId = await resolveOrganisationId(req.user!.id, res);
    if (!organisationId) return;

    const device = await getDeviceById(parsedParams.data.id, organisationId);
    if (!device) return res.status(404).json({ message: 'Not found' });

    const rules = await getRulesForDeviceContext(device.id, device.site_id ?? null, organisationId);
    return res.json(rules);
  } catch (err) {
    next(err);
  }
}

export async function listRulesForSite(req: Request, res: Response, next: NextFunction) {
  const parsedParams = siteIdSchema.safeParse(req.params);
  if (!parsedParams.success) {
    return res.status(400).json({ message: 'Invalid site id' });
  }

  try {
    const organisationId = await resolveOrganisationId(req.user!.id, res);
    if (!organisationId) return;

    const site = await getSiteById(parsedParams.data.id, organisationId);
    if (!site) return res.status(404).json({ message: 'Not found' });

    const rules = await getRulesForSiteContext(site.id, organisationId);
    return res.json(rules);
  } catch (err) {
    next(err);
  }
}
