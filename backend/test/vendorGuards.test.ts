import { afterEach, describe, expect, it, vi } from 'vitest';
import { checkVendorDisableFlags, getVendorFlagSummary } from '../src/config/vendorGuards';

vi.mock('../src/config/logger', () => {
  const warn = vi.fn();
  return { logger: { warn } };
});

afterEach(() => {
  delete process.env.HEATPUMP_HISTORY_DISABLED;
  delete process.env.CONTROL_API_DISABLED;
  delete process.env.MQTT_DISABLED;
  delete process.env.PUSH_NOTIFICATIONS_DISABLED;
  process.env.NODE_ENV = 'test';
});

describe('vendor disable flag guard', () => {
  it('logs a warning when prod-like and disable flags are set', () => {
    process.env.NODE_ENV = 'production';
    process.env.HEATPUMP_HISTORY_DISABLED = 'true';

    const result = checkVendorDisableFlags('production');
    expect(result.prodLike).toBe(true);
    expect(result.disabledFlags).toContain('HEATPUMP_HISTORY_DISABLED');
  });

  it('does nothing when not prod-like', () => {
    process.env.NODE_ENV = 'development';
    process.env.HEATPUMP_HISTORY_DISABLED = 'true';

    const result = checkVendorDisableFlags('development');
    expect(result.prodLike).toBe(false);
    expect(result.disabledFlags).toContain('HEATPUMP_HISTORY_DISABLED');
  });

  it('summarises vendor flag booleans', () => {
    process.env.NODE_ENV = 'staging';
    process.env.MQTT_DISABLED = 'true';

    const summary = getVendorFlagSummary('staging');
    expect(summary.prodLike).toBe(true);
    expect(summary.disabled).toContain('MQTT_DISABLED');
    expect(summary.mqttDisabled).toBe(true);
    expect(summary.controlDisabled).toBe(false);
  });
});
