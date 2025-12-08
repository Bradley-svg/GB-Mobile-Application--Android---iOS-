import { NextFunction, Request, Response } from 'express';
import { z } from 'zod';
import { getDeviceById } from '../services/deviceService';
import {
  ControlThrottleError,
  setDeviceMode,
  setDeviceSetpoint,
} from '../services/deviceControlService';
import { getDeviceTelemetry } from '../services/telemetryService';
import { ControlValidationError } from '../services/deviceControlValidationService';
import { resolveOrganisationId } from './organisation';
import { getCommandsForDevice, getLastCommandForDevice } from '../repositories/controlCommandsRepository';
import {
  getDeviceSchedule as getDeviceScheduleService,
  upsertDeviceSchedule,
  ScheduleValidationError,
} from '../services/deviceScheduleService';
import { ExportError, exportDeviceTelemetryCsv } from '../services/exportService';
import { canControlDevice, canEditSchedules, canExportData } from '../services/rbacService';

const deviceIdSchema = z.object({ id: z.string().uuid() });
const telemetryQuerySchema = z.object({
  range: z
    .union([z.literal('1h'), z.literal('24h'), z.literal('7d')])
    .optional()
    .transform((val) => val ?? '24h'),
  maxPoints: z.preprocess(
    (val) => (val === undefined ? undefined : Number(val)),
    z.number().int().positive().optional()
  ),
});
const paginationSchema = z.object({
  limit: z.coerce.number().int().positive().max(100).optional(),
  offset: z.coerce.number().int().min(0).optional(),
});
const scheduleBodySchema = z.object({
  name: z.string().min(1).max(120).optional(),
  enabled: z.boolean().optional(),
  startHour: z.number().int().min(0).max(24),
  endHour: z.number().int().min(0).max(24),
  targetSetpoint: z.number(),
  targetMode: z.enum(['OFF', 'HEATING', 'COOLING', 'AUTO']),
});
const telemetryExportSchema = z.object({
  from: z.string().datetime(),
  to: z.string().datetime(),
  metrics: z.string().optional(),
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

    const telemetry = await getDeviceTelemetry(
      device.id,
      parsedQuery.data.range,
      parsedQuery.data.maxPoints
    );
    res.json(telemetry);
  } catch (e) {
    next(e);
  }
}

export async function getLastCommand(req: Request, res: Response, next: NextFunction) {
  const parsedParams = deviceIdSchema.safeParse(req.params);
  if (!parsedParams.success) {
    return res.status(400).json({ message: 'Invalid device id' });
  }

  try {
    const organisationId = await resolveOrganisationId(req.user!.id, res);
    if (!organisationId) return;

    const device = await getDeviceById(parsedParams.data.id, organisationId);
    if (!device) return res.status(404).json({ message: 'Not found' });

    const lastCommand = await getLastCommandForDevice(device.id);
    if (!lastCommand) return res.status(404).json({ message: 'Not found' });

    return res.status(200).json({
      status: lastCommand.status,
      requested_value: lastCommand.requested_value,
      failure_reason: lastCommand.failure_reason,
      failure_message: lastCommand.failure_message,
      created_at: lastCommand.requested_at,
    });
  } catch (e) {
    next(e);
  }
}

export async function getDeviceCommands(req: Request, res: Response, next: NextFunction) {
  const parsedParams = deviceIdSchema.safeParse(req.params);
  if (!parsedParams.success) {
    return res.status(400).json({ message: 'Invalid device id' });
  }
  const parsedQuery = paginationSchema.safeParse(req.query);
  if (!parsedQuery.success) {
    return res.status(400).json({ message: 'Invalid query' });
  }

  try {
    const organisationId = await resolveOrganisationId(req.user!.id, res);
    if (!organisationId) return;

    const device = await getDeviceById(parsedParams.data.id, organisationId);
    if (!device) return res.status(404).json({ message: 'Not found' });

    const commands = await getCommandsForDevice(
      device.id,
      parsedQuery.data.limit ?? 20,
      parsedQuery.data.offset ?? 0
    );

    return res.json(
      commands.map((cmd) => ({
        id: cmd.id,
        device_id: cmd.device_id,
        status: cmd.status,
        command_type: cmd.command_type,
        requested_value: cmd.requested_value,
        payload: cmd.payload,
        requested_at: cmd.requested_at,
        completed_at: cmd.completed_at,
        failure_reason: cmd.failure_reason,
        failure_message: cmd.failure_message,
        actor: {
          id: cmd.user_id,
          email: cmd.user_email,
          name: cmd.user_name,
        },
      }))
    );
  } catch (e) {
    next(e);
  }
}

export async function getDeviceSchedule(req: Request, res: Response, next: NextFunction) {
  const parsedParams = deviceIdSchema.safeParse(req.params);
  if (!parsedParams.success) {
    return res.status(400).json({ message: 'Invalid device id' });
  }

  try {
    const organisationId = await resolveOrganisationId(req.user!.id, res);
    if (!organisationId) return;

    const schedule = await getDeviceScheduleService(parsedParams.data.id, organisationId);
    return res.json(schedule);
  } catch (err) {
    if (err instanceof ScheduleValidationError) {
      const status = err.reason === 'NOT_FOUND' ? 404 : 400;
      return res.status(status).json({ message: err.message, reason: err.reason });
    }
    next(err);
  }
}

export async function putDeviceSchedule(req: Request, res: Response, next: NextFunction) {
  if (!canEditSchedules(req.user)) {
    return res.status(403).json({ message: 'Forbidden' });
  }

  const parsedParams = deviceIdSchema.safeParse(req.params);
  if (!parsedParams.success) {
    return res.status(400).json({ message: 'Invalid device id' });
  }
  const parsedBody = scheduleBodySchema.safeParse(req.body);
  if (!parsedBody.success) {
    return res.status(400).json({ message: 'Invalid body' });
  }

  try {
    const organisationId = await resolveOrganisationId(req.user!.id, res);
    if (!organisationId) return;

    const schedule = await upsertDeviceSchedule(parsedParams.data.id, organisationId, parsedBody.data);
    return res.json(schedule);
  } catch (err: any) {
    if (err instanceof ScheduleValidationError) {
      const status = err.reason === 'NOT_FOUND' ? 404 : 400;
      return res.status(status).json({ message: err.message, reason: err.reason });
    }
    return next(err);
  }
}

export async function sendSetpointCommand(req: Request, res: Response, next: NextFunction) {
  if (!canControlDevice(req.user)) {
    return res.status(403).json({ message: 'Forbidden' });
  }

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
    if (e instanceof ControlThrottleError || e?.type === 'THROTTLED') {
      return res.status(429).json({ message: e.message });
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
  if (!canControlDevice(req.user)) {
    return res.status(403).json({ message: 'Forbidden' });
  }

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
    if (e instanceof ControlThrottleError || e?.type === 'THROTTLED') {
      return res.status(429).json({ message: e.message });
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

export async function exportDeviceTelemetryCsvHandler(
  req: Request,
  res: Response,
  next: NextFunction
) {
  const parsedParams = deviceIdSchema.safeParse(req.params);
  const parsedQuery = telemetryExportSchema.safeParse(req.query);
  if (!parsedParams.success || !parsedQuery.success) {
    return res.status(400).json({ message: 'Invalid request' });
  }

  if (!canExportData(req.user)) {
    return res.status(403).json({ message: 'Forbidden export', code: 'ERR_FORBIDDEN_EXPORT' });
  }

  const metrics =
    parsedQuery.data.metrics?.split(',').map((m) => m.trim()).filter((m) => m.length > 0) ?? undefined;

  try {
    const organisationId = await resolveOrganisationId(req.user!.id, res);
    if (!organisationId) return;

    const csv = await exportDeviceTelemetryCsv(
      organisationId,
      parsedParams.data.id,
      new Date(parsedQuery.data.from),
      new Date(parsedQuery.data.to),
      metrics
    );

    res
      .setHeader('Content-Type', 'text/csv')
      .setHeader(
        'Content-Disposition',
        `attachment; filename="device-${parsedParams.data.id}-telemetry.csv"`
      )
      .send(csv);
  } catch (err) {
    if (err instanceof ExportError) {
      const status = err.reason === 'NOT_FOUND' ? 404 : 400;
      return res.status(status).json({ message: err.message });
    }
    return next(err);
  }
}
