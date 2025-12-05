const path = require('path');
const { Client } = require('pg');

require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error('DATABASE_URL not set');
  }

  const defaultOrgId = '11111111-1111-1111-1111-111111111111';
  const siteId = '22222222-2222-2222-2222-222222222222';
  const deviceId = '33333333-3333-3333-3333-333333333333';
  // Must match the MAC Azure expects for the demo heat pump history calls.
  const DEMO_HEATPUMP_MAC = '38:18:2B:60:A9:94';

  const client = new Client({ connectionString });
  await client.connect();

  await client.query(
    `
    insert into organisations (id, name)
    values ($1, $2)
    on conflict (id) do nothing
  `,
    [defaultOrgId, 'Greenbro Demo Org']
  );

  await client.query(
    `
    insert into system_status (key, payload)
    values ('global', '{}'::jsonb)
    on conflict (key) do nothing
  `
  );

  await client.query(
    `
    insert into sites (id, organisation_id, name, city, status, online_devices, device_count_online, last_seen_at)
    values ($1, $2, $3, $4, $5, $6, $7, now())
    on conflict (id) do nothing
  `,
    [siteId, defaultOrgId, 'Demo Site', 'Cape Town', 'healthy', 1, 1]
  );

  await client.query(
    `
    insert into devices (id, site_id, name, type, external_id, mac, status, last_seen_at, controller)
    values ($1, $2, $3, $4, $5, $6, $7, now(), $8)
    on conflict (id) do nothing
  `,
    [deviceId, siteId, 'Demo Heat Pump', 'heat_pump', 'demo-device-1', DEMO_HEATPUMP_MAC, 'online', 'mqtt']
  );

  const snapshot = {
    metrics: {
      supply_temp: 45.2,
      return_temp: 39.1,
      power_kw: 5.4,
      flow_rate: 0.28,
      cop: 3.1,
    },
    raw: {
      timestamp: Date.now(),
      sensor: {
        supply_temperature_c: 45.2,
        return_temperature_c: 39.1,
        power_w: 5400,
        flow_lps: 0.28,
        cop: 3.1,
      },
    },
  };

  await client.query(
    `
    insert into device_snapshots (device_id, last_seen_at, data, updated_at)
    values ($1, now(), $2::jsonb, now())
    on conflict (device_id)
    do update set last_seen_at = excluded.last_seen_at, data = excluded.data, updated_at = excluded.updated_at
  `,
    [deviceId, JSON.stringify(snapshot)]
  );

  await client.query('delete from telemetry_points where device_id = $1', [deviceId]);

  const now = Date.now();
  const telemetryPoints = [];
  const metrics = [
    ['supply_temp', 45.2],
    ['return_temp', 39.1],
    ['power_kw', 5.4],
    ['flow_rate', 0.28],
    ['cop', 3.1],
  ];

  for (const [metric, baseValue] of metrics) {
    for (let hour = 0; hour < 12; hour += 1) {
      const ts = new Date(now - hour * 60 * 60 * 1000);
      telemetryPoints.push({ metric, ts, value: Number(baseValue) + Math.sin(hour / 3) });
    }
  }

  for (const point of telemetryPoints) {
    await client.query(
      `
      insert into telemetry_points (device_id, metric, ts, value)
      values ($1, $2, $3, $4)
    `,
      [deviceId, point.metric, point.ts, point.value]
    );
  }

  await client.query('delete from alerts where device_id = $1', [deviceId]);
  await client.query(
    `
    insert into alerts (
      id, site_id, device_id, severity, type, message, status, first_seen_at, last_seen_at
    )
    values ($1, $2, $3, 'warning', 'offline', 'Device connectivity lost', 'active', now() - interval '2 hours', now() - interval '10 minutes')
    on conflict (id) do nothing
  `,
    ['44444444-4444-4444-4444-444444444444', siteId, deviceId]
  );

  console.log('Local database initialized/seeded for demo.');
  await client.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
