import { NextFunction, Request, Response } from 'express';
import { resolveOrganisationId } from './organisation';
import { getDemoStatusForOrg } from '../services/demoService';

export async function getDemoStatus(req: Request, res: Response, next: NextFunction) {
  try {
    const organisationId = await resolveOrganisationId(req.user!.id, res);
    if (!organisationId) return;

    const status = await getDemoStatusForOrg(organisationId);
    res.json({
      isDemoOrg: status.isDemoOrg,
      heroDeviceId: status.heroDeviceId,
      heroDeviceMac: status.heroDeviceMac,
      seededAt: status.seededAt ? status.seededAt.toISOString() : null,
    });
  } catch (err) {
    next(err);
  }
}
