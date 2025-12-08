import fs from 'fs';
import path from 'path';
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const originalEnv = {
  NODE_ENV: process.env.NODE_ENV,
  AV_SCANNER_ENABLED: process.env.AV_SCANNER_ENABLED,
  AV_SCANNER_CMD: process.env.AV_SCANNER_CMD,
  AV_SCANNER_HOST: process.env.AV_SCANNER_HOST,
  AV_SCANNER_PORT: process.env.AV_SCANNER_PORT,
};

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
    process.env.NODE_ENV = originalEnv.NODE_ENV;
    if (originalEnv.AV_SCANNER_ENABLED === undefined) delete process.env.AV_SCANNER_ENABLED;
    else process.env.AV_SCANNER_ENABLED = originalEnv.AV_SCANNER_ENABLED;
    if (originalEnv.AV_SCANNER_CMD === undefined) delete process.env.AV_SCANNER_CMD;
    else process.env.AV_SCANNER_CMD = originalEnv.AV_SCANNER_CMD;
    if (originalEnv.AV_SCANNER_HOST === undefined) delete process.env.AV_SCANNER_HOST;
    else process.env.AV_SCANNER_HOST = originalEnv.AV_SCANNER_HOST;
    if (originalEnv.AV_SCANNER_PORT === undefined) delete process.env.AV_SCANNER_PORT;
    else process.env.AV_SCANNER_PORT = originalEnv.AV_SCANNER_PORT;
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

describe('virusScanner command integration', () => {
  const fixturePath = path.resolve(__dirname, 'fixtures/av-sim.js');
  const tmpDir = path.resolve(__dirname, 'tmp-av');
  let tmpFile: string;

  beforeEach(async () => {
    vi.resetModules();
    process.env.NODE_ENV = 'development';
    process.env.AV_SCANNER_ENABLED = 'true';
    delete process.env.AV_SCANNER_HOST;
    delete process.env.AV_SCANNER_PORT;
    await fs.promises.mkdir(tmpDir, { recursive: true });
    tmpFile = path.join(tmpDir, `sample-${Date.now()}.txt`);
    await fs.promises.writeFile(tmpFile, 'sample');
  });

  afterEach(async () => {
    await fs.promises.rm(tmpDir, { recursive: true, force: true }).catch(() => {});
  });

  it('treats exit 0 as clean when scanner is enabled', async () => {
    process.env.AV_SCANNER_CMD = `node "${fixturePath}"`;
    const mod = await import('../src/services/virusScanner');

    const result = await mod.scanFile(tmpFile);

    expect(result).toBe('clean');
    expect(mod.getVirusScannerStatus()).toMatchObject({
      configured: true,
      enabled: true,
      lastResult: 'clean',
      target: 'command',
    });
  });

  it('treats exit 1 as infected', async () => {
    process.env.AV_SCANNER_CMD = `node "${fixturePath}" --infected`;
    const mod = await import('../src/services/virusScanner');

    const result = await mod.scanFile(tmpFile);

    expect(result).toBe('infected');
  });

  it('treats other failures as error', async () => {
    process.env.AV_SCANNER_CMD = `node "${fixturePath}" --error`;
    const mod = await import('../src/services/virusScanner');

    const result = await mod.scanFile(tmpFile);

    expect(result).toBe('error');
  });
});

afterAll(() => {
  process.env.NODE_ENV = originalEnv.NODE_ENV;
  if (originalEnv.AV_SCANNER_ENABLED === undefined) delete process.env.AV_SCANNER_ENABLED;
  else process.env.AV_SCANNER_ENABLED = originalEnv.AV_SCANNER_ENABLED;
  if (originalEnv.AV_SCANNER_CMD === undefined) delete process.env.AV_SCANNER_CMD;
  else process.env.AV_SCANNER_CMD = originalEnv.AV_SCANNER_CMD;
  if (originalEnv.AV_SCANNER_HOST === undefined) delete process.env.AV_SCANNER_HOST;
  else process.env.AV_SCANNER_HOST = originalEnv.AV_SCANNER_HOST;
  if (originalEnv.AV_SCANNER_PORT === undefined) delete process.env.AV_SCANNER_PORT;
  else process.env.AV_SCANNER_PORT = originalEnv.AV_SCANNER_PORT;
});
