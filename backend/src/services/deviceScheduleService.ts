import { getDeviceById } from './deviceService';
import {
  getScheduleForDevice,
  upsertScheduleForDevice,
  type UpsertDeviceScheduleInput,
  type DeviceScheduleRow,
} from '../repositories/deviceSchedulesRepository';
import {
  validateModeCommand,
  validateSetpointCommand,
  type DeviceCapabilities,
} from './deviceControlValidationService';

export class ScheduleValidationError extends Error {
  reason: string;

  constructor(reason: string, message: string) {
    super(message);
    this.reason = reason;
    this.name = 'ScheduleValidationError';
  }
}

type ScheduleInput = {
  name?: string;
  enabled?: boolean;
  startHour: number;
  endHour: number;
  targetSetpoint: number;
  targetMode: 'OFF' | 'HEATING' | 'COOLING' | 'AUTO';
};

function validateHours(startHour: number, endHour: number) {
  const inRange = (val: number) => Number.isInteger(val) && val >= 0 && val <= 24;
  if (!inRange(startHour) || !inRange(endHour)) {
    throw new ScheduleValidationError('INVALID_HOUR', 'Hours must be between 0 and 24');
  }
  if (startHour === endHour) {
    throw new ScheduleValidationError('INVALID_RANGE', 'Start and end hours must differ');
  }
}

async function validateInputs(device: DeviceCapabilities, input: ScheduleInput) {
  validateHours(input.startHour, input.endHour);

  const setpointValidation = validateSetpointCommand(device, {
    metric: 'flow_temp',
    value: input.targetSetpoint,
  });
  if (!setpointValidation.ok) {
    throw new ScheduleValidationError(setpointValidation.reason, setpointValidation.message);
  }

  const modeValidation = validateModeCommand(device, { mode: input.targetMode });
  if (!modeValidation.ok) {
    throw new ScheduleValidationError(modeValidation.reason, modeValidation.message);
  }
}

export async function getDeviceSchedule(
  deviceId: string,
  organisationId: string
): Promise<DeviceScheduleRow | null> {
  const device = await getDeviceById(deviceId, organisationId);
  if (!device) return null;
  return getScheduleForDevice(device.id);
}

export async function upsertDeviceSchedule(
  deviceId: string,
  organisationId: string,
  input: ScheduleInput
): Promise<DeviceScheduleRow> {
  const device = await getDeviceById(deviceId, organisationId);
  if (!device) {
    throw new ScheduleValidationError('NOT_FOUND', 'Device not found');
  }

  await validateInputs(device as DeviceCapabilities, input);

  const payload: UpsertDeviceScheduleInput = {
    deviceId: device.id,
    name: input.name,
    enabled: input.enabled,
    startHour: input.startHour,
    endHour: input.endHour,
    targetSetpoint: input.targetSetpoint,
    targetMode: input.targetMode,
  };

  return upsertScheduleForDevice(payload);
}
