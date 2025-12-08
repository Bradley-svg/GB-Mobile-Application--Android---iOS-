import { z } from 'zod';
import {
  fetchHeatPumpHistory,
  getHeatPumpHistoryConfig,
  type HeatPumpHistoryResult,
} from '../integrations/heatPumpHistoryClient';
import { getDeviceById } from '../repositories/devicesRepository';

const isoString = z
  .string()
  .min(1)
  .refine((value) => !Number.isNaN(Date.parse(value)), { message: 'Invalid ISO timestamp' });

const heatPumpHistoryRequestSchema = z
  .object({
    deviceId: z.string().min(1),
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

export class HeatPumpHistoryFeatureDisabledError extends Error {
  constructor(message = 'Heat pump history is disabled in this environment') {
    super(message);
    this.name = 'HeatPumpHistoryFeatureDisabledError';
  }
}

export class HeatPumpHistoryDeviceNotFoundError extends Error {
  constructor(message = 'Device not found') {
    super(message);
    this.name = 'HeatPumpHistoryDeviceNotFoundError';
  }
}

export class HeatPumpHistoryMissingMacError extends Error {
  constructor(message = 'Device is missing a MAC address') {
    super(message);
    this.name = 'HeatPumpHistoryMissingMacError';
  }
}

type UserContext = {
  userId: string;
  organisationId: string;
};

export async function getHistoryForRequest(
  userContext: UserContext,
  payload: unknown
): Promise<HeatPumpHistoryResult> {
  const parsed = heatPumpHistoryRequestSchema.safeParse(payload);
  if (!parsed.success) {
    throw new HeatPumpHistoryValidationError('Invalid body');
  }

  const config = getHeatPumpHistoryConfig();
  if (config.nodeEnv !== 'development' && config.missingKeys.length > 0) {
    throw new HeatPumpHistoryFeatureDisabledError(
      'Heat pump history is disabled until required env vars are set'
    );
  }

  const device = await getDeviceById(parsed.data.deviceId, userContext.organisationId);
  if (!device) {
    throw new HeatPumpHistoryDeviceNotFoundError('Device not found for this organisation');
  }

  const mac = (device.mac ?? '').trim();
  if (!mac) {
    throw new HeatPumpHistoryMissingMacError('Device has no MAC configured');
  }

  const { deviceId: _deviceId, ...historyRequest } = parsed.data;
  return fetchHeatPumpHistory({ ...historyRequest, mac });
}
