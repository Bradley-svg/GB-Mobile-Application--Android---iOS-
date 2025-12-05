import { DeviceRow } from '../repositories/devicesRepository';

export type ControlCommandType = 'setpoint' | 'mode';
export type Mode = 'OFF' | 'HEATING' | 'COOLING' | 'AUTO';

export type SetpointCommandPayload = {
  metric: 'flow_temp';
  value: number;
};

export type ModeCommandPayload = {
  mode: Mode;
};

export type ValidationFailureReason =
  | 'BELOW_MIN'
  | 'ABOVE_MAX'
  | 'DEVICE_NOT_CAPABLE'
  | 'INVALID_VALUE';

export type ControlValidationResult =
  | { ok: true }
  | { ok: false; reason: ValidationFailureReason; message: string };

export type DeviceCapabilities = DeviceRow & {
  min_setpoint?: number | null;
  max_setpoint?: number | null;
  allowed_modes?: Mode[] | null;
  supports_heating?: boolean | null;
  supports_cooling?: boolean | null;
  supports_auto?: boolean | null;
};

const DEFAULT_SETPOINT_BOUNDS = { min: 30, max: 60 };

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function resolveSetpointBounds(device: DeviceCapabilities) {
  const min = isFiniteNumber(device.min_setpoint) ? device.min_setpoint : DEFAULT_SETPOINT_BOUNDS.min;
  const max = isFiniteNumber(device.max_setpoint) ? device.max_setpoint : DEFAULT_SETPOINT_BOUNDS.max;

  if (min >= max) {
    return DEFAULT_SETPOINT_BOUNDS;
  }

  return { min, max };
}

function resolveAllowedModes(device: DeviceCapabilities): Mode[] {
  if (device.allowed_modes && Array.isArray(device.allowed_modes) && device.allowed_modes.length > 0) {
    return device.allowed_modes;
  }

  let modes: Mode[] = ['OFF', 'HEATING', 'COOLING', 'AUTO'];
  if (device.supports_heating === false) {
    modes = modes.filter((mode) => mode !== 'HEATING');
  }
  if (device.supports_cooling === false) {
    modes = modes.filter((mode) => mode !== 'COOLING');
  }
  if (device.supports_auto === false) {
    modes = modes.filter((mode) => mode !== 'AUTO');
  }

  return modes;
}

export function validateSetpointCommand(
  device: DeviceCapabilities,
  payload: SetpointCommandPayload
): ControlValidationResult {
  if (payload.metric !== 'flow_temp') {
    return { ok: false, reason: 'DEVICE_NOT_CAPABLE', message: 'Unsupported setpoint metric' };
  }

  if (!isFiniteNumber(payload.value)) {
    return { ok: false, reason: 'INVALID_VALUE', message: 'Setpoint must be a valid number' };
  }

  const bounds = resolveSetpointBounds(device);

  if (payload.value < bounds.min) {
    return {
      ok: false,
      reason: 'BELOW_MIN',
      message: `Setpoint below minimum of ${bounds.min}C`,
    };
  }

  if (payload.value > bounds.max) {
    return {
      ok: false,
      reason: 'ABOVE_MAX',
      message: `Setpoint above maximum of ${bounds.max}C`,
    };
  }

  return { ok: true };
}

export function validateModeCommand(
  device: DeviceCapabilities,
  payload: ModeCommandPayload
): ControlValidationResult {
  const allowedModes = resolveAllowedModes(device);

  if (!['OFF', 'HEATING', 'COOLING', 'AUTO'].includes(payload.mode)) {
    return {
      ok: false,
      reason: 'INVALID_VALUE',
      message: 'Unsupported mode value',
    };
  }

  if (!allowedModes.includes(payload.mode)) {
    return {
      ok: false,
      reason: 'DEVICE_NOT_CAPABLE',
      message: `Device does not support ${payload.mode} mode`,
    };
  }

  return { ok: true };
}

export class ControlValidationError extends Error {
  reason: ValidationFailureReason;

  constructor(reason: ValidationFailureReason, message: string) {
    super(message);
    this.reason = reason;
    this.name = 'ControlValidationError';
  }
}
