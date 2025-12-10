import request from 'supertest';
import type { Express } from 'express';
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { query } from '../src/config/db';
import { resetTestDb } from './testDbSetup';

const SITE_ID = '22222222-2222-2222-2222-222222222222';
const DEVICE_ID = '33333333-3333-3333-3333-333333333333';

let app: Express;
let ownerToken: string;
let contractorToken: string;

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
  ownerToken = await login('owner@example.com');
  contractorToken = await login('contractor@example.com');
});

describe('share links (authenticated)', () => {
  it('creates a share link for a site', async () => {
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    const res = await request(app)
      .post(`/sites/${SITE_ID}/share-links`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ expiresAt })
      .expect(201);

    expect(res.body).toMatchObject({
      scopeType: 'site',
      scopeId: SITE_ID,
      permissions: 'read_only',
    });
    expect(res.body.token).toBeTruthy();

    const audits = await query<{ action: string }>(
      'select action from audit_events order by created_at asc'
    );
    expect(audits.rows.map((row) => row.action)).toContain('share_link_created');
  });

  it('lists existing share links for a site', async () => {
    const res = await request(app)
      .get(`/sites/${SITE_ID}/share-links`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(200);

    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body[0]).toHaveProperty('expiresAt');
    expect(res.body[0]).toHaveProperty('token');
  });

  it('revokes a share link', async () => {
    const expiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString();
    const createRes = await request(app)
      .post(`/devices/${DEVICE_ID}/share-links`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ expiresAt })
      .expect(201);

    const linkId = createRes.body.id;

    await request(app)
      .delete(`/share-links/${linkId}`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(204);

    const listRes = await request(app)
      .get(`/devices/${DEVICE_ID}/share-links`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(200);

    const ids = (listRes.body as any[]).map((l) => l.id);
    expect(ids).not.toContain(linkId);

    const audits = await query<{ action: string }>(
      'select action from audit_events order by created_at asc'
    );
    expect(audits.rows.map((row) => row.action)).toEqual([
      'share_link_created',
      'share_link_revoked',
    ]);
  });

  it('rejects share link creation for contractors', async () => {
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    await request(app)
      .post(`/sites/${SITE_ID}/share-links`)
      .set('Authorization', `Bearer ${contractorToken}`)
      .send({ expiresAt })
      .expect(403);
  });
});
