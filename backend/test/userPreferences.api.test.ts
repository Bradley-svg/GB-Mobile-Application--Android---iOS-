import request from 'supertest';
import type { Express } from 'express';
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { DEFAULT_USER_PREFERENCES } from '../src/services/userPreferencesService';
import { resetTestDb } from './testDbSetup';

let app: Express;
let accessToken: string;

beforeAll(async () => {
  process.env.NODE_ENV = 'test';
  process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret';
  const mod = await import('../src/index');
  app = mod.default;
});

beforeEach(async () => {
  await resetTestDb();
  const loginRes = await request(app)
    .post('/auth/login')
    .send({ email: 'demo@example.com', password: 'password123' })
    .expect(200);

  accessToken = loginRes.body.accessToken;
});

describe('user preferences API', () => {
  it('returns defaults when no preferences exist', async () => {
    const res = await request(app)
      .get('/user/preferences')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    expect(res.body).toEqual(DEFAULT_USER_PREFERENCES);
  });

  it('updates and returns stored preferences', async () => {
    const updateRes = await request(app)
      .put('/user/preferences')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ alertsEnabled: false })
      .expect(200);

    expect(updateRes.body).toEqual({ alertsEnabled: false });

    const getRes = await request(app)
      .get('/user/preferences')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    expect(getRes.body).toEqual({ alertsEnabled: false });
  });

  it('rejects empty update payloads', async () => {
    const res = await request(app)
      .put('/user/preferences')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({})
      .expect(400);

    expect(res.body).toEqual({ message: 'No preferences provided' });
  });

  it('requires authentication', async () => {
    await request(app).get('/user/preferences').expect(401);
  });
});
