import request from 'supertest';
import jwt from 'jsonwebtoken';
import type { Express } from 'express';
import { afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { query } from '../src/config/db';

const ORG_ID = '11111111-1111-1111-1111-111111111111';
const USER_ID = '44444444-4444-4444-4444-444444444444';
const HERO_DEVICE_ID = '33333333-3333-3333-3333-333333333333';
const HERO_DEVICE_MAC = '38:18:2B:60:A9:94';

let app: Express;
let token: string;

beforeAll(async () => {
  process.env.NODE_ENV = 'test';
  process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret';
  const mod = await import('../src/index');
  app = mod.default;
  token = jwt.sign({ sub: USER_ID, type: 'access' }, process.env.JWT_SECRET);
});

async function flagDemo(isDemo: boolean) {
  await query(
    `
    insert into demo_tenants (org_id, enabled, hero_device_id, hero_device_mac, seeded_at, created_at, updated_at)
    values ($1, $2, $3, $4, now(), now(), now())
    on conflict (org_id) do update
      set enabled = excluded.enabled,
          hero_device_id = excluded.hero_device_id,
          hero_device_mac = excluded.hero_device_mac,
          seeded_at = excluded.seeded_at,
          updated_at = now()
  `,
    [ORG_ID, isDemo, HERO_DEVICE_ID, HERO_DEVICE_MAC]
  );
  await query(
    `
    update organisations
    set is_demo = $2,
        demo_seeded_at = case when $2 then coalesce(demo_seeded_at, now()) else null end
    where id = $1
  `,
    [ORG_ID, isDemo]
  );
  await query('update devices set is_demo = $2, is_demo_hero = $3 where id = $1', [
    HERO_DEVICE_ID,
    isDemo,
    isDemo,
  ]);
}

beforeEach(async () => {
  await flagDemo(true);
});

afterEach(async () => {
  await flagDemo(true);
});

describe('GET /demo/status', () => {
  it('returns demo metadata when org is flagged as demo', async () => {
  const res = await request(app)
    .get('/demo/status')
    .set('Authorization', `Bearer ${token}`)
    .expect(200);

  expect(res.body).toMatchObject({
    isDemoOrg: true,
    heroDeviceId: HERO_DEVICE_ID,
  });
  expect(res.body.heroDeviceMac?.toUpperCase()).toBe('38:18:2B:60:A9:94');
  expect(res.body.seededAt).toBeTruthy();
  expect(res.body.vendorFlags).toMatchObject({
    prodLike: false,
    disabled: [],
    mqttDisabled: false,
    controlDisabled: false,
    heatPumpHistoryDisabled: false,
    pushNotificationsDisabled: false,
  });
});

it('returns non-demo payload when org is not marked as demo', async () => {
  await flagDemo(false);

  const res = await request(app)
    .get('/demo/status')
    .set('Authorization', `Bearer ${token}`)
    .expect(200);

  expect(res.body).toEqual({
    isDemoOrg: false,
    heroDeviceId: null,
    heroDeviceMac: null,
    seededAt: null,
    vendorFlags: {
      prodLike: false,
      disabled: [],
      mqttDisabled: false,
      controlDisabled: false,
      heatPumpHistoryDisabled: false,
      pushNotificationsDisabled: false,
    },
  });
});
});
