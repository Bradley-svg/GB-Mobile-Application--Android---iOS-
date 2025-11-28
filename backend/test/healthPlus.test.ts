import request from 'supertest';
import type { Express } from 'express';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const queryMock = vi.fn();
const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

vi.mock('../src/db/pool', () => ({
  query: (...args: unknown[]) => queryMock(...(args as [string, unknown[]?])),
}));

let app: Express;

beforeAll(async () => {
  process.env.NODE_ENV = 'test';
  process.env.APP_VERSION = 'test-version';
  const mod = await import('../src/index');
  app = mod.default;
});

beforeEach(() => {
  queryMock.mockReset();
  consoleErrorSpy.mockClear();
});

describe('GET /health-plus', () => {
  it('returns ok with version and db ok when query succeeds', async () => {
    queryMock.mockResolvedValueOnce({ rows: [{ ok: 1 }], rowCount: 1 });

    const res = await request(app).get('/health-plus').expect(200);

    expect(queryMock).toHaveBeenCalledTimes(1);
    expect(res.body).toEqual({
      ok: true,
      env: process.env.NODE_ENV,
      db: 'ok',
      version: 'test-version',
    });
  });

  it('returns error when db query throws', async () => {
    queryMock.mockRejectedValueOnce(new Error('db down'));

    const res = await request(app).get('/health-plus').expect(500);

    expect(queryMock).toHaveBeenCalledTimes(1);
    expect(consoleErrorSpy).toHaveBeenCalledWith('health-plus error', expect.any(Error));
    expect(res.body).toEqual({
      ok: false,
      env: process.env.NODE_ENV,
      db: 'error',
      version: 'test-version',
    });
  });
});

afterAll(() => {
  consoleErrorSpy.mockRestore();
});
