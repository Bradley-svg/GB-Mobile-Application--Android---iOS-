import request from 'supertest';
import type { Express } from 'express';
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { resetTestDb } from './testDbSetup';

const SITE_TOKEN = 'site-share-token';
const DEVICE_TOKEN = 'device-share-token';
const EXPIRED_TOKEN = 'expired-share-token';

let app: Express;

beforeAll(async () => {
  process.env.NODE_ENV = 'test';
  process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret';
  const mod = await import('../src/index');
  app = mod.default;
});

beforeEach(async () => {
  await resetTestDb();
});

describe('public share links', () => {
  it('returns a site payload for a valid token', async () => {
    const res = await request(app).get(`/public/share/${SITE_TOKEN}`).expect(200);

    expect(res.body.share).toMatchObject({ scopeType: 'site' });
    expect(res.body.site).toBeDefined();
    expect(Array.isArray(res.body.devices)).toBe(true);
  });

  it('returns a device payload for a valid token', async () => {
    const res = await request(app).get(`/public/share/${DEVICE_TOKEN}`).expect(200);

    expect(res.body.share).toMatchObject({ scopeType: 'device' });
    expect(res.body.device).toBeDefined();
  });

  it('returns 404 for expired tokens', async () => {
    await request(app).get(`/public/share/${EXPIRED_TOKEN}`).expect(404);
  });

  it('returns 404 for unknown tokens', async () => {
    await request(app).get('/public/share/not-a-real-token').expect(404);
  });
});
