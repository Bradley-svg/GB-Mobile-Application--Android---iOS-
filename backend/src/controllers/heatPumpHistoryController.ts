import { NextFunction, Request, Response } from 'express';
import { z } from 'zod';
import { fetchHeatPumpHistory } from '../integrations/heatPumpHistoryClient';

const isoString = z
  .string()
  .min(1)
  .refine((value) => !Number.isNaN(Date.parse(value)), { message: 'Invalid ISO timestamp' });

const heatPumpHistoryRequestSchema = z
  .object({
    mac: z.string().min(1),
    from: isoString,
    to: isoString,
    aggregation: z.enum(['raw', 'avg', 'min', 'max']).default('raw'),
    mode: z.enum(['live', 'history']).default('live'),
    fields: z
      .array(
        z.object({
          field: z.string().min(1),
          unit: z.string().optional(),
          decimals: z.number().int().optional(),
          displayName: z.string().optional(),
          propertyName: z.string().optional(),
        })
      )
      .min(1),
  })
  .refine(
    (value) => Date.parse(value.from) <= Date.parse(value.to),
    { message: '`from` must be before or equal to `to`' }
  );

export async function postHeatPumpHistory(req: Request, res: Response, next: NextFunction) {
  const parsed = heatPumpHistoryRequestSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: 'Invalid body' });
  }

  try {
    const data = await fetchHeatPumpHistory(parsed.data);
    res.json(data);
  } catch (err) {
    next(err);
  }
}
