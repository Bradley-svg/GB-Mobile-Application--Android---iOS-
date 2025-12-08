import request from 'supertest';
import type { Express } from 'express';
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { resetTestDb } from './testDbSetup';

const SITE_ID = '22222222-2222-2222-2222-222222222222';
const DEVICE_ID = '33333333-3333-3333-3333-333333333333';

let app: Express;

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
});

describe('CSV exports', () => {
  it('allows owner to export devices for a site', async () => {
    const token = await login('owner@example.com');

    const res = await request(app)
      .get(`/sites/${SITE_ID}/export/devices.csv`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(res.headers['content-type']).toContain('text/csv');
    expect(res.text).toContain('device_id,name,firmware_version,connectivity_status,last_seen,site_name');
    expect(res.text).toContain(DEVICE_ID);
  });

  it('allows admin to export devices for a site', async () => {
    const token = await login('admin@example.com');

    const res = await request(app)
      .get(`/sites/${SITE_ID}/export/devices.csv`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(res.headers['content-type']).toContain('text/csv');
    expect(res.text).toContain('device_id,name,firmware_version,connectivity_status,last_seen,site_name');
    expect(res.text).toContain(DEVICE_ID);
  });

  it('allows facilities to export devices for a site', async () => {
    const token = await login('demo@example.com');

    const res = await request(app)
      .get(`/sites/${SITE_ID}/export/devices.csv`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(res.headers['content-type']).toContain('text/csv');
    expect(res.text).toContain('device_id,name,firmware_version,connectivity_status,last_seen,site_name');
    expect(res.text).toContain(DEVICE_ID);
  });

  it('blocks contractor from exporting devices for a site', async () => {
    const token = await login('contractor@example.com');

    const res = await request(app)
      .get(`/sites/${SITE_ID}/export/devices.csv`)
      .set('Authorization', `Bearer ${token}`)
      .expect(403);

    expect(res.body.code).toBe('ERR_FORBIDDEN_EXPORT');
  });

  it('allows owner to export telemetry for a device', async () => {
    const token = await login('owner@example.com');
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

  it('allows admin to export telemetry for a device', async () => {
    const token = await login('admin@example.com');
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

  it('allows facilities to export telemetry for a device', async () => {
    const token = await login('demo@example.com');
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

  it('blocks contractor from exporting telemetry for a device', async () => {
    const token = await login('contractor@example.com');
    const from = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
    const to = new Date().toISOString();

    const res = await request(app)
      .get(`/devices/${DEVICE_ID}/export/telemetry.csv`)
      .query({ from, to })
      .set('Authorization', `Bearer ${token}`)
      .expect(403);

    expect(res.body.code).toBe('ERR_FORBIDDEN_EXPORT');
  });
});
