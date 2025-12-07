import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { randomUUID } from 'crypto';
import { query } from '../src/config/db';
import { searchFleet } from '../src/services/fleetService';
import { setupTestDb, resetTestDb, teardownTestDb } from './testDbSetup';

const ORG_ID = '11111111-1111-1111-1111-111111111111';
const BASE_DEVICE_ID = '33333333-3333-3333-3333-333333333333';

describe('fleetService search', () => {
  beforeAll(async () => {
    await setupTestDb();
  });

  beforeEach(async () => {
    await resetTestDb();
  });

  afterAll(async () => {
    await teardownTestDb();
  });

  it('applies search and health filters across fleet', async () => {
    const offlineTs = new Date(Date.now() - 2 * 60 * 60 * 1000);
    await query(`update device_snapshots set last_seen_at = $1 where device_id = $2`, [
      offlineTs,
      BASE_DEVICE_ID,
    ]);
    await query(`update devices set last_seen_at = $1, status = 'offline' where id = $2`, [
      offlineTs,
      BASE_DEVICE_ID,
    ]);

    const secondSiteId = randomUUID();
    const secondDeviceId = randomUUID();

    await query(
      `
      insert into sites (id, organisation_id, name, city, status, last_seen_at)
      values ($1, $2, 'Boiler House', 'Johannesburg', 'healthy', now())
    `,
      [secondSiteId, ORG_ID]
    );

    await query(
      `
      insert into devices (id, site_id, name, type, status, last_seen_at)
      values ($1, $2, 'Boiler 2000', 'boiler', 'online', now())
    `,
      [secondDeviceId, secondSiteId]
    );

    await query(
      `
      insert into device_snapshots (device_id, last_seen_at, data, updated_at)
      values ($1, now(), '{}'::jsonb, now())
    `,
      [secondDeviceId]
    );

    await query(
      `
      insert into alerts (id, site_id, device_id, severity, type, message, status, first_seen_at, last_seen_at)
      values ($1, $2, $3, 'critical', 'offline', 'Device offline', 'active', now(), now())
    `,
      [randomUUID(), secondSiteId, secondDeviceId]
    );

    const allResults = await searchFleet({ organisationId: ORG_ID, search: null });
    const deviceHealthStates = allResults.devices.map((d) => d.health);
    expect(deviceHealthStates).toContain('offline');
    expect(deviceHealthStates).toContain('critical');

    const offlineOnly = await searchFleet({
      organisationId: ORG_ID,
      search: 'Demo',
      health: ['offline'],
    });
    expect(offlineOnly.devices.every((d) => d.health === 'offline')).toBe(true);

    const criticalOnly = await searchFleet({
      organisationId: ORG_ID,
      search: 'Boiler',
      health: ['critical'],
    });
    expect(criticalOnly.devices).toHaveLength(1);
    expect(criticalOnly.devices[0].health).toBe('critical');
    expect(criticalOnly.devices[0].name).toBe('Boiler 2000');
  });
});
