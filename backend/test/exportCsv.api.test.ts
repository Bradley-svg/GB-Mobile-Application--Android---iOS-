import request from 'supertest';
import type { Express } from 'express';
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { resetTestDb } from './testDbSetup';

const SITE_ID = '22222222-2222-2222-2222-222222222222';
const DEVICE_ID = '33333333-3333-3333-3333-333333333333';

let app: Express;
let token: string;

async function login(email: string) {
  const res = await request(app)
    .post('/auth/login')
    .send({ email, password: 'password123' })
    .expect(200);

  return res.body.accessToken as string;
}

beforeAll(async () => {
  process.env.NODE_ENV = 'test';
  process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret';
  const mod = await import('../src/index');
  app = mod.default;
});

beforeEach(async () => {
  await resetTestDb();
  token = await login('owner@example.com');
});

describe('CSV exports', () => {
  it('exports devices for a site', async () => {
    const res = await request(app)
      .get(`/sites/${SITE_ID}/export/devices.csv`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(res.headers['content-type']).toContain('text/csv');
    expect(res.text).toContain('device_id,name,firmware_version,connectivity_status,last_seen,site_name');
    expect(res.text).toContain(DEVICE_ID);
  });

  it('exports telemetry for a device', async () => {
    const from = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
    const to = new Date().toISOString();

    const res = await request(app)
      .get(`/devices/${DEVICE_ID}/export/telemetry.csv`)
      .query({ from, to })
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(res.headers['content-type']).toContain('text/csv');
    expect(res.text).toContain('timestamp,metric_name,value');
    expect(res.text).toMatch(/supply_temp/);
  });
});
