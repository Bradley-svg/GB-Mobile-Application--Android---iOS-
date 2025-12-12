import path from 'path';
import { Client } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { seedDemo, DEMO_DEFAULTS } from '../scripts/seed-demo';
import { resetTestDb } from './testDbSetup';

describe('seed-demo script', () => {
  const connectionString = process.env.TEST_DATABASE_URL;
  let client: Client;

  beforeAll(async () => {
    if (!connectionString) {
      throw new Error('TEST_DATABASE_URL must be set for seed-demo tests');
    }
    process.env.ALLOW_TEST_DB_RESET = 'true';
    process.env.FILE_STORAGE_ROOT = path.resolve(__dirname, '../uploads-test');
    await resetTestDb();
    client = new Client({ connectionString });
    await client.connect();
  });

  afterAll(async () => {
    if (connectionString) {
      await resetTestDb();
    }
    if (client) {
      await client.end();
    }
  });

  it('can be applied twice without creating duplicates', async () => {
    const email = DEMO_DEFAULTS.email;
    const heroDeviceId = DEMO_DEFAULTS.ids.deviceHero;

    await seedDemo({ connectionString, reset: true });
    const firstUser = await client.query(
      'select id, organisation_id from users where email = $1',
      [email]
    );
    expect(firstUser.rowCount).toBe(1);

    await seedDemo({ connectionString });
    const secondUser = await client.query(
      'select id, organisation_id from users where email = $1',
      [email]
    );
    expect(secondUser.rowCount).toBe(1);
    expect(secondUser.rows[0].id).toBe(firstUser.rows[0].id);
    expect(secondUser.rows[0].organisation_id).toBe(firstUser.rows[0].organisation_id);

    const alerts = await client.query(
      'select count(*)::int as count from alerts where device_id = $1',
      [heroDeviceId]
    );
    expect(alerts.rows[0].count).toBeGreaterThanOrEqual(2);

    const workOrders = await client.query(
      'select count(*)::int as count from work_orders where organisation_id = $1',
      [DEMO_DEFAULTS.ids.org]
    );
    expect(workOrders.rows[0].count).toBeGreaterThanOrEqual(3);

    const orgRow = await client.query(
      'select is_demo, demo_seeded_at from organisations where id = $1',
      [DEMO_DEFAULTS.ids.org]
    );
    expect(orgRow.rows[0]?.is_demo).toBe(true);
    expect(orgRow.rows[0]?.demo_seeded_at).toBeTruthy();

    const heroRow = await client.query(
      'select is_demo, is_demo_hero from devices where id = $1',
      [heroDeviceId]
    );
    expect(heroRow.rows[0]).toMatchObject({ is_demo: true, is_demo_hero: true });

    const demoTenantRow = await client.query(
      'select enabled, hero_device_id, hero_device_mac, seeded_at from demo_tenants where org_id = $1',
      [DEMO_DEFAULTS.ids.org]
    );
    expect(demoTenantRow.rows[0]?.enabled).toBe(true);
    expect(demoTenantRow.rows[0]?.hero_device_id).toBe(heroDeviceId);
    expect(demoTenantRow.rows[0]?.hero_device_mac?.toUpperCase()).toBe(
      DEMO_DEFAULTS.deviceMac.toUpperCase()
    );
    expect(demoTenantRow.rows[0]?.seeded_at).toBeTruthy();
  });
});
