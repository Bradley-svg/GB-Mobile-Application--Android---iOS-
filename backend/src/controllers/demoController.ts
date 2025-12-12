import { NextFunction, Request, Response } from 'express';
import { resolveOrganisationId } from './organisation';
import { getDemoStatusForOrg } from '../services/demoService';
import { getVendorFlagSummary } from '../config/vendorGuards';

export async function getDemoStatus(req: Request, res: Response, next: NextFunction) {
  try {
    const organisationId = await resolveOrganisationId(req.user!.id, res);
    if (!organisationId) return;

    const status = await getDemoStatusForOrg(organisationId);
    const vendorFlags = getVendorFlagSummary();
    res.json({
      isDemoOrg: status.isDemoOrg,
      heroDeviceId: status.heroDeviceId,
      heroDeviceMac: status.heroDeviceMac,
      seededAt: status.seededAt ? status.seededAt.toISOString() : null,
      vendorFlags,
    });
  } catch (err) {
    next(err);
  }
}
