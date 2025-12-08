import path from 'path';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import type { Express } from 'express';
import { beforeAll, describe, expect, it } from 'vitest';

const SITE_ID = '22222222-2222-2222-2222-222222222222';
const DEVICE_ID = '33333333-3333-3333-3333-333333333333';
const USER_ID = '44444444-4444-4444-4444-444444444444';

let app: Express;
let token: string;

beforeAll(async () => {
  process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret';
  process.env.FILE_STORAGE_ROOT =
    process.env.FILE_STORAGE_ROOT || path.resolve(__dirname, '../uploads-test');

  const mod = await import('../src/index');
  app = mod.default;
  token = jwt.sign({ sub: USER_ID, type: 'access' }, process.env.JWT_SECRET);
});

describe('documents API', () => {
  it('lists documents for a site and device', async () => {
    const siteRes = await request(app)
      .get(`/sites/${SITE_ID}/documents`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(Array.isArray(siteRes.body)).toBe(true);
    expect(siteRes.body[0]).toHaveProperty('title');
    expect(siteRes.body[0]).toHaveProperty('url');

    const deviceRes = await request(app)
      .get(`/devices/${DEVICE_ID}/documents`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(Array.isArray(deviceRes.body)).toBe(true);
  });

  it('accepts uploads for a site', async () => {
    const uploadRes = await request(app)
      .post(`/sites/${SITE_ID}/documents`)
      .set('Authorization', `Bearer ${token}`)
      .field('title', 'Upload test')
      .field('category', 'manual')
      .attach('file', Buffer.from('doc body'), { filename: 'upload.pdf', contentType: 'application/pdf' })
      .expect(201);

    expect(uploadRes.body.title).toBe('Upload test');
    expect(uploadRes.body.url).toContain('/files/');
  });
});
