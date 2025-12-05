import { z } from 'zod';
import {
  fetchHeatPumpHistory,
  type HeatPumpHistoryResult,
} from '../integrations/heatPumpHistoryClient';

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

export class HeatPumpHistoryValidationError extends Error {
  constructor(message = 'Invalid body') {
    super(message);
    this.name = 'HeatPumpHistoryValidationError';
  }
}

type UserContext = {
  userId: string | null;
};

export async function getHistoryForRequest(
  _userContext: UserContext,
  payload: unknown
): Promise<HeatPumpHistoryResult> {
  const parsed = heatPumpHistoryRequestSchema.safeParse(payload);
  if (!parsed.success) {
    throw new HeatPumpHistoryValidationError('Invalid body');
  }

  // Future: enforce org/device scoping using userId/org context once available.
  return fetchHeatPumpHistory(parsed.data);
}
