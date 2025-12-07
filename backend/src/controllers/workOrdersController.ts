import { NextFunction, Request, Response } from 'express';
import { z } from 'zod';
import { resolveOrganisationId } from './organisation';
import {
  InvalidStatusTransitionError,
  WorkOrderValidationError,
  createFromAlert,
  createWorkOrder,
  getWorkOrder,
  listWorkOrders,
  listWorkOrdersForAlert,
  listWorkOrdersForDevice,
  updateWorkOrderDetails,
  updateWorkOrderTasks,
} from '../services/workOrdersService';

const workOrderIdParamSchema = z.object({ id: z.string().uuid() });
const deviceIdParamSchema = z.object({ id: z.string().uuid() });
const siteIdParamSchema = z.object({ id: z.string().uuid() });

const listQuerySchema = z.object({
  status: z.enum(['open', 'in_progress', 'done', 'cancelled']).optional(),
  siteId: z.string().uuid().optional(),
  deviceId: z.string().uuid().optional(),
  alertId: z.string().uuid().optional(),
  q: z.string().min(1).max(200).optional(),
});

const createWorkOrderSchema = z.object({
  siteId: z.string().uuid(),
  deviceId: z.string().uuid().optional(),
  alertId: z.string().uuid().optional(),
  title: z.string().min(1),
  description: z.string().optional(),
  priority: z.enum(['low', 'medium', 'high']).optional(),
  assigneeUserId: z.string().uuid().nullable().optional(),
  dueAt: z.string().datetime().nullable().optional(),
});

const createFromAlertBodySchema = z.object({
  title: z.string().min(1).optional(),
  description: z.string().optional(),
});

const updateWorkOrderSchema = z
  .object({
    title: z.string().min(1).optional(),
    description: z.string().nullable().optional(),
    priority: z.enum(['low', 'medium', 'high']).optional(),
    assigneeUserId: z.string().uuid().nullable().optional(),
    dueAt: z.string().datetime().nullable().optional(),
    status: z.enum(['open', 'in_progress', 'done', 'cancelled']).optional(),
  })
  .refine((data) => Object.keys(data).length > 0, { message: 'No updates provided' });

const tasksSchema = z.object({
  tasks: z
    .array(
      z.object({
        label: z.string().min(1),
        is_completed: z.boolean().optional(),
        position: z.number().int().min(0).optional(),
      })
    )
    .max(100),
});

export async function listWorkOrdersHandler(req: Request, res: Response, next: NextFunction) {
  const parsed = listQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    return res.status(400).json({ message: 'Invalid query' });
  }

  try {
    const organisationId = await resolveOrganisationId(req.user!.id, res);
    if (!organisationId) return;

    const orders = await listWorkOrders(organisationId, {
      siteId: parsed.data.siteId,
      deviceId: parsed.data.deviceId,
      alertId: parsed.data.alertId,
      status: parsed.data.status,
      search: parsed.data.q,
    });

    res.json(orders);
  } catch (err) {
    next(err);
  }
}

export async function getWorkOrderHandler(req: Request, res: Response, next: NextFunction) {
  const parsedParams = workOrderIdParamSchema.safeParse(req.params);
  if (!parsedParams.success) {
    return res.status(400).json({ message: 'Invalid work order id' });
  }

  try {
    const organisationId = await resolveOrganisationId(req.user!.id, res);
    if (!organisationId) return;

    const order = await getWorkOrder(organisationId, parsedParams.data.id);
    if (!order) return res.status(404).json({ message: 'Not found' });

    res.json(order);
  } catch (err) {
    next(err);
  }
}

export async function createWorkOrderHandler(req: Request, res: Response, next: NextFunction) {
  const parsedBody = createWorkOrderSchema.safeParse(req.body);
  if (!parsedBody.success) {
    return res.status(400).json({ message: 'Invalid body' });
  }

  try {
    const organisationId = await resolveOrganisationId(req.user!.id, res);
    if (!organisationId) return;

    const order = await createWorkOrder({
      orgId: organisationId,
      siteId: parsedBody.data.siteId,
      deviceId: parsedBody.data.deviceId,
      alertId: parsedBody.data.alertId,
      title: parsedBody.data.title,
      description: parsedBody.data.description ?? null,
      priority: parsedBody.data.priority,
      assigneeUserId: parsedBody.data.assigneeUserId ?? null,
      dueAt: parsedBody.data.dueAt ?? null,
      createdByUserId: req.user!.id,
    });

    res.status(201).json(order);
  } catch (err) {
    if (err instanceof WorkOrderValidationError) {
      return res.status(400).json({ message: err.message, code: err.code });
    }
    next(err);
  }
}

export async function createWorkOrderFromAlertHandler(
  req: Request,
  res: Response,
  next: NextFunction
) {
  const parsedParams = workOrderIdParamSchema.safeParse(req.params);
  if (!parsedParams.success) {
    return res.status(400).json({ message: 'Invalid alert id' });
  }

  const parsedBody = createFromAlertBodySchema.safeParse(req.body ?? {});
  if (!parsedBody.success) {
    return res.status(400).json({ message: 'Invalid body' });
  }

  try {
    const organisationId = await resolveOrganisationId(req.user!.id, res);
    if (!organisationId) return;

    const order = await createFromAlert({
      orgId: organisationId,
      userId: req.user!.id,
      alertId: parsedParams.data.id,
      title: parsedBody.data.title,
      description: parsedBody.data.description,
    });

    if (!order) return res.status(404).json({ message: 'Not found' });

    res.status(201).json(order);
  } catch (err) {
    if (err instanceof WorkOrderValidationError) {
      return res.status(400).json({ message: err.message, code: err.code });
    }
    next(err);
  }
}

export async function updateWorkOrderHandler(req: Request, res: Response, next: NextFunction) {
  const parsedParams = workOrderIdParamSchema.safeParse(req.params);
  if (!parsedParams.success) {
    return res.status(400).json({ message: 'Invalid work order id' });
  }
  const parsedBody = updateWorkOrderSchema.safeParse(req.body);
  if (!parsedBody.success) {
    return res.status(400).json({ message: parsedBody.error.errors[0]?.message || 'Invalid body' });
  }

  try {
    const organisationId = await resolveOrganisationId(req.user!.id, res);
    if (!organisationId) return;

    const order = await updateWorkOrderDetails({
      orgId: organisationId,
      workOrderId: parsedParams.data.id,
      title: parsedBody.data.title,
      description: parsedBody.data.description,
      priority: parsedBody.data.priority,
      assigneeUserId: parsedBody.data.assigneeUserId,
      dueAt: parsedBody.data.dueAt,
      status: parsedBody.data.status,
    });

    if (!order) return res.status(404).json({ message: 'Not found' });

    res.json(order);
  } catch (err) {
    if (err instanceof WorkOrderValidationError) {
      return res.status(400).json({ message: err.message, code: err.code });
    }
    if (err instanceof InvalidStatusTransitionError) {
      return res.status(400).json({ message: err.message, code: 'INVALID_STATUS' });
    }
    next(err);
  }
}

export async function updateWorkOrderTasksHandler(
  req: Request,
  res: Response,
  next: NextFunction
) {
  const parsedParams = workOrderIdParamSchema.safeParse(req.params);
  if (!parsedParams.success) {
    return res.status(400).json({ message: 'Invalid work order id' });
  }
  const parsedBody = tasksSchema.safeParse(req.body);
  if (!parsedBody.success) {
    return res.status(400).json({ message: 'Invalid tasks' });
  }

  try {
    const organisationId = await resolveOrganisationId(req.user!.id, res);
    if (!organisationId) return;

    const order = await updateWorkOrderTasks(
      organisationId,
      parsedParams.data.id,
      parsedBody.data.tasks
    );

    if (!order) return res.status(404).json({ message: 'Not found' });
    res.json(order);
  } catch (err) {
    next(err);
  }
}

export async function listWorkOrdersForDeviceHandler(
  req: Request,
  res: Response,
  next: NextFunction
) {
  const parsedParams = deviceIdParamSchema.safeParse(req.params);
  if (!parsedParams.success) {
    return res.status(400).json({ message: 'Invalid device id' });
  }

  try {
    const organisationId = await resolveOrganisationId(req.user!.id, res);
    if (!organisationId) return;

    const orders = await listWorkOrdersForDevice(organisationId, parsedParams.data.id);
    res.json(orders);
  } catch (err) {
    next(err);
  }
}

export async function listWorkOrdersForSiteHandler(
  req: Request,
  res: Response,
  next: NextFunction
) {
  const parsedParams = siteIdParamSchema.safeParse(req.params);
  if (!parsedParams.success) {
    return res.status(400).json({ message: 'Invalid site id' });
  }

  try {
    const organisationId = await resolveOrganisationId(req.user!.id, res);
    if (!organisationId) return;

    const orders = await listWorkOrders(organisationId, { siteId: parsedParams.data.id });
    res.json(orders);
  } catch (err) {
    next(err);
  }
}

export async function listWorkOrdersForAlertHandler(
  req: Request,
  res: Response,
  next: NextFunction
) {
  const parsedParams = workOrderIdParamSchema.safeParse(req.params);
  if (!parsedParams.success) {
    return res.status(400).json({ message: 'Invalid alert id' });
  }

  try {
    const organisationId = await resolveOrganisationId(req.user!.id, res);
    if (!organisationId) return;

    const orders = await listWorkOrdersForAlert(organisationId, parsedParams.data.id);
    res.json(orders);
  } catch (err) {
    next(err);
  }
}
