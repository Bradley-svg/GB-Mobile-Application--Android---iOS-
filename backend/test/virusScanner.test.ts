import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';

const originalNodeEnv = process.env.NODE_ENV;
const originalAvEnabled = process.env.AV_SCANNER_ENABLED;

describe('virusScanner stub behaviour', () => {
  beforeEach(() => {
    vi.resetModules();
    process.env.NODE_ENV = 'test';
    delete process.env.AV_SCANNER_ENABLED;
    delete process.env.AV_SCANNER_CMD;
    delete process.env.AV_SCANNER_HOST;
    delete process.env.AV_SCANNER_PORT;
  });

  afterAll(() => {
    process.env.NODE_ENV = originalNodeEnv;
    if (originalAvEnabled === undefined) {
      delete process.env.AV_SCANNER_ENABLED;
    } else {
      process.env.AV_SCANNER_ENABLED = originalAvEnabled;
    }
  });

  it('returns clean when scanner is disabled', async () => {
    const mod = await import('../src/services/virusScanner');
    const result = await mod.scanFile('ignored.tmp');
    expect(result).toBe('clean');

    const status = mod.getVirusScannerStatus();
    expect(status.configured).toBe(false);
    expect(status.enabled).toBe(false);
    expect(status.lastResult).toBe('clean');
  });

  it('stays stubbed in test env even when enabled flag is set', async () => {
    process.env.AV_SCANNER_ENABLED = 'true';
    vi.resetModules();

    const mod = await import('../src/services/virusScanner');
    const result = await mod.scanFile('ignored.tmp');
    expect(result).toBe('clean');

    const status = mod.getVirusScannerStatus();
    expect(status.configured).toBe(true);
    expect(status.enabled).toBe(false);
    expect(status.lastResult).toBe('clean');
  });
});
