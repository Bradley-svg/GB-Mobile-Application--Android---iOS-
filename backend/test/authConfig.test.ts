import { afterEach, describe, expect, it, vi } from 'vitest';

const originalEnv = { ...process.env };

describe('auth config', () => {
  afterEach(() => {
    process.env = { ...originalEnv };
    vi.resetModules();
  });

  it('throws when using default JWT secret outside development', async () => {
    process.env.NODE_ENV = 'test';
    process.env.JWT_SECRET = 'dev-secret';
    process.env.DATABASE_URL = process.env.DATABASE_URL || 'postgres://test@localhost/db';

    vi.resetModules();

    await expect(import('../src/services/authService')).rejects.toThrow(
      'JWT_SECRET must be set to a non-default value when NODE_ENV is not development'
    );
  });
});
