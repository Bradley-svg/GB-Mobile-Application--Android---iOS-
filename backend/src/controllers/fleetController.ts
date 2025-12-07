import { NextFunction, Request, Response } from 'express';
import { z } from 'zod';
import { searchFleet } from '../services/fleetService';
import { resolveOrganisationId } from './organisation';
import type { HealthStatus } from '../services/healthScoreService';

const fleetQuerySchema = z.object({
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

export async function listFleet(req: Request, res: Response, next: NextFunction) {
  const parsed = fleetQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    return res.status(400).json({ message: 'Invalid query' });
  }

  const healthFilters = (parsed.data.health || [])
    .map((h) => h.toLowerCase() as HealthStatus)
    .filter((h) => allowedHealth.has(h));

  try {
    const organisationId = await resolveOrganisationId(req.user!.id, res);
    if (!organisationId) return;

    const result = await searchFleet({
      organisationId,
      search: parsed.data.q,
      health: healthFilters,
      tag: parsed.data.tag,
      limit: parsed.data.limit,
      offset: parsed.data.offset,
    });

    res.json({
      sites: result.sites,
      devices: result.devices,
      meta: {
        siteCount: result.sites.length,
        deviceCount: result.devices.length,
      },
    });
  } catch (e) {
    next(e);
  }
}
