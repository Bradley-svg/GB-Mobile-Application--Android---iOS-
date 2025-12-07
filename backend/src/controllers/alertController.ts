import { NextFunction, Request, Response } from 'express';
import { z } from 'zod';
import { acknowledgeAlert, getAlerts, getAlertsForDevice, muteAlert } from '../services/alertService';
import { resolveOrganisationId } from './organisation';

const alertIdSchema = z.object({ id: z.string().uuid() });
const deviceIdSchema = z.object({ id: z.string().uuid() });
const alertsQuerySchema = z.object({
  siteId: z.string().uuid().optional(),
  severity: z.enum(['info', 'warning', 'critical']).optional(),
  status: z.enum(['active', 'cleared']).optional(),
  limit: z.coerce.number().int().positive().max(500).optional(),
});

export async function listAlerts(req: Request, res: Response, next: NextFunction) {
  const parsedQuery = alertsQuerySchema.safeParse(req.query);
  if (!parsedQuery.success) {
    return res.status(400).json({ message: 'Invalid query' });
  }

  const { siteId, severity, status, limit } = parsedQuery.data;

  try {
    const organisationId = await resolveOrganisationId(req.user!.id, res);
    if (!organisationId) return;

    const alerts = await getAlerts({
      siteId,
      severity,
      status: status ?? 'active',
      limit,
      organisationId,
    });

    res.json(alerts);
  } catch (e) {
    next(e);
  }
}

export async function listDeviceAlerts(req: Request, res: Response, next: NextFunction) {
  const parsedParams = deviceIdSchema.safeParse(req.params);
  if (!parsedParams.success) {
    return res.status(400).json({ message: 'Invalid device id' });
  }

  try {
    const organisationId = await resolveOrganisationId(req.user!.id, res);
    if (!organisationId) return;

    const alerts = await getAlertsForDevice(parsedParams.data.id, organisationId);
    res.json(alerts);
  } catch (e) {
    next(e);
  }
}

export async function acknowledgeAlertHandler(
  req: Request,
  res: Response,
  next: NextFunction
) {
  const parsedParams = alertIdSchema.safeParse(req.params);
  if (!parsedParams.success) {
    return res.status(400).json({ message: 'Invalid alert id' });
  }

  const userId = req.user!.id;

  try {
    const organisationId = await resolveOrganisationId(userId, res);
    if (!organisationId) return;

    const alert = await acknowledgeAlert(parsedParams.data.id, userId, organisationId);
    if (!alert) return res.status(404).json({ message: 'Not found' });
    res.json(alert);
  } catch (e) {
    next(e);
  }
}

export async function muteAlertHandler(req: Request, res: Response, next: NextFunction) {
  const parsedParams = alertIdSchema.safeParse(req.params);
  if (!parsedParams.success) {
    return res.status(400).json({ message: 'Invalid alert id' });
  }

  const schema = z.object({
    minutes: z.number().int().positive().max(7 * 24 * 60),
  });

  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: 'Invalid body' });
  }

  try {
    const organisationId = await resolveOrganisationId(req.user!.id, res);
    if (!organisationId) return;

    const alert = await muteAlert(parsedParams.data.id, parsed.data.minutes, organisationId);
    if (!alert) return res.status(404).json({ message: 'Not found' });
    res.json(alert);
  } catch (e) {
    next(e);
  }
}
