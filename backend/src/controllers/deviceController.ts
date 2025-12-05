import { NextFunction, Request, Response } from 'express';
import { z } from 'zod';
import { getDeviceById } from '../services/deviceService';
import { setDeviceMode, setDeviceSetpoint } from '../services/deviceControlService';
import { getDeviceTelemetry } from '../services/telemetryService';
import { ControlValidationError } from '../services/deviceControlValidationService';
import { resolveOrganisationId } from '../utils/organisation';

const deviceIdSchema = z.object({ id: z.string().uuid() });
const telemetryQuerySchema = z.object({
  range: z
    .union([z.literal('24h'), z.literal('7d')])
    .optional()
    .transform((val) => val ?? '24h'),
});

export async function getDevice(req: Request, res: Response, next: NextFunction) {
  const parsedParams = deviceIdSchema.safeParse(req.params);
  if (!parsedParams.success) {
    return res.status(400).json({ message: 'Invalid device id' });
  }

  try {
    const organisationId = await resolveOrganisationId(req.user!.id, res);
    if (!organisationId) return;

    const device = await getDeviceById(parsedParams.data.id, organisationId);
    if (!device) return res.status(404).json({ message: 'Not found' });
    res.json(device);
  } catch (e) {
    next(e);
  }
}

export async function getDeviceTelemetryHandler(req: Request, res: Response, next: NextFunction) {
  const parsedParams = deviceIdSchema.safeParse(req.params);
  if (!parsedParams.success) {
    return res.status(400).json({ message: 'Invalid device id' });
  }

  const parsedQuery = telemetryQuerySchema.safeParse(req.query);
  if (!parsedQuery.success) {
    return res.status(400).json({ message: 'Invalid query' });
  }

  try {
    const organisationId = await resolveOrganisationId(req.user!.id, res);
    if (!organisationId) return;

    const device = await getDeviceById(parsedParams.data.id, organisationId);
    if (!device) return res.status(404).json({ message: 'Not found' });

    const telemetry = await getDeviceTelemetry(device.id, parsedQuery.data.range);
    res.json(telemetry);
  } catch (e) {
    next(e);
  }
}

export async function sendSetpointCommand(req: Request, res: Response, next: NextFunction) {
  const paramsResult = deviceIdSchema.safeParse(req.params);
  if (!paramsResult.success) {
    return res.status(400).json({ message: 'Invalid device id' });
  }

  const userId = req.user!.id;
  const schema = z.object({
    metric: z.literal('flow_temp'),
    value: z.number(),
  });

  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: 'Invalid body' });
  }

  try {
    const organisationId = await resolveOrganisationId(userId, res);
    if (!organisationId) return;

    const command = await setDeviceSetpoint(paramsResult.data.id, userId, parsed.data, organisationId);
    res.json(command);
  } catch (e: any) {
    if (e instanceof ControlValidationError) {
      return res.status(400).json({ message: e.message });
    }
    switch (e.message) {
      case 'DEVICE_NOT_FOUND':
        return res.status(404).json({ message: 'Device not found' });
      case 'DEVICE_NOT_CONTROLLABLE':
        return res.status(400).json({ message: 'Device not controllable' });
      case 'UNSUPPORTED_METRIC':
        return res.status(400).json({ message: 'Unsupported metric' });
      case 'OUT_OF_RANGE':
        return res.status(400).json({ message: 'Value outside allowed range for this metric' });
      case 'COMMAND_FAILED':
        return res.status(502).json({ message: 'External control command failed' });
      case 'CONTROL_CHANNEL_UNCONFIGURED':
        return res.status(503).json({ message: 'Control channel not configured' });
      default:
        return next(e);
    }
  }
}

export async function sendModeCommand(req: Request, res: Response, next: NextFunction) {
  const paramsResult = deviceIdSchema.safeParse(req.params);
  if (!paramsResult.success) {
    return res.status(400).json({ message: 'Invalid device id' });
  }

  const userId = req.user!.id;
  const schema = z.object({
    mode: z.enum(['OFF', 'HEATING', 'COOLING', 'AUTO']),
  });

  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: 'Invalid body' });
  }

  try {
    const organisationId = await resolveOrganisationId(userId, res);
    if (!organisationId) return;

    const command = await setDeviceMode(paramsResult.data.id, userId, parsed.data, organisationId);
    res.json(command);
  } catch (e: any) {
    if (e instanceof ControlValidationError) {
      return res.status(400).json({ message: e.message });
    }
    switch (e.message) {
      case 'DEVICE_NOT_FOUND':
        return res.status(404).json({ message: 'Device not found' });
      case 'DEVICE_NOT_CONTROLLABLE':
        return res.status(400).json({ message: 'Device not controllable' });
      case 'UNSUPPORTED_MODE':
        return res.status(400).json({ message: 'Unsupported mode' });
      case 'COMMAND_FAILED':
        return res.status(502).json({ message: 'External control command failed' });
      case 'CONTROL_CHANNEL_UNCONFIGURED':
        return res.status(503).json({ message: 'Control channel not configured' });
      default:
        return next(e);
    }
  }
}
