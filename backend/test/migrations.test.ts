import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { query } from '../src/config/db';
import { resetTestDb, setupTestDb, teardownTestDb } from './testDbSetup';

describe('database migrations', () => {
  beforeAll(async () => {
    await setupTestDb();
    await resetTestDb();
  });

  afterAll(async () => {
    await teardownTestDb();
  });

  it('creates demo_tenants and seeds demo metadata', async () => {
    const columns = await query(
      `
        select column_name
        from information_schema.columns
        where table_schema = 'public' and table_name = 'demo_tenants'
      `
    );
    expect(columns.rowCount).toBeGreaterThan(0);

    const seeded = await query(
      `
        select enabled, hero_device_id, hero_device_mac, seeded_at
        from demo_tenants
        limit 1
      `
    );
    expect(seeded.rowCount).toBeGreaterThan(0);
    expect(seeded.rows[0].enabled).toBe(true);
    expect(seeded.rows[0].hero_device_id).toBeTruthy();
    expect(seeded.rows[0].hero_device_mac).toBeTruthy();
  });
});
