import { describe, expect, it } from 'vitest';
import { validateModeCommand, validateSetpointCommand } from '../src/services/deviceControlValidationService';

const baseDevice = {
  id: 'device-1',
  site_id: 'site-1',
  name: 'Heat Pump',
  type: 'heat_pump',
} as const;

describe('deviceControlValidationService', () => {
  it('rejects setpoints below device minimum', () => {
    const result = validateSetpointCommand(
      { ...baseDevice, min_setpoint: 40, max_setpoint: 55 },
      { metric: 'flow_temp', value: 35 }
    );

    expect(result).toEqual({
      ok: false,
      reason: 'BELOW_MIN',
      message: 'Setpoint below minimum of 40C',
    });
  });

  it('rejects setpoints above maximum', () => {
    const result = validateSetpointCommand(baseDevice, { metric: 'flow_temp', value: 75 });

    expect(result).toEqual({
      ok: false,
      reason: 'ABOVE_MAX',
      message: 'Setpoint above maximum of 60C',
    });
  });

  it('accepts valid setpoints within bounds', () => {
    const result = validateSetpointCommand(baseDevice, { metric: 'flow_temp', value: 45 });
    expect(result).toEqual({ ok: true });
  });

  it('rejects invalid mode values', () => {
    const result = validateModeCommand(baseDevice, { mode: 'INVALID' as any });

    expect(result).toEqual({
      ok: false,
      reason: 'INVALID_VALUE',
      message: 'Unsupported mode value',
    });
  });

  it('rejects modes outside device capabilities', () => {
    const result = validateModeCommand(
      { ...baseDevice, allowed_modes: ['OFF', 'HEATING'] },
      { mode: 'COOLING' }
    );

    expect(result).toEqual({
      ok: false,
      reason: 'DEVICE_NOT_CAPABLE',
      message: 'Device does not support COOLING mode',
    });
  });

  it('accepts allowed modes', () => {
    const result = validateModeCommand(
      { ...baseDevice, supports_cooling: true },
      { mode: 'COOLING' }
    );

    expect(result).toEqual({ ok: true });
  });
});
