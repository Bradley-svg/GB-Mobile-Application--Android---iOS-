import { describe, expect, it, vi } from 'vitest';
import { checkVendorDisableFlags } from '../src/config/vendorGuards';

vi.mock('../src/config/logger', () => {
  const warn = vi.fn();
  return { logger: { warn } };
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
});
