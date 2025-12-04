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

  const ddl = `
    create extension if not exists "uuid-ossp";
    create extension if not exists "pgcrypto";

    create table if not exists organisations (
      id uuid primary key,
      name text not null,
      created_at timestamptz not null default now()
    );

    insert into organisations (id, name)
    values ('${defaultOrgId}', 'Greenbro Demo Org')
    on conflict (id) do nothing;

    create table if not exists users (
      id uuid primary key default uuid_generate_v4(),
      organisation_id uuid not null default '${defaultOrgId}' references organisations(id),
      email text not null unique,
      password_hash text not null,
      name text not null,
      created_at timestamptz not null default now()
    );

    create table if not exists refresh_tokens (
      id uuid primary key,
      user_id uuid not null references users(id) on delete cascade,
      revoked boolean not null default false,
      revoked_reason text,
      revoked_at timestamptz,
      replaced_by uuid references refresh_tokens(id),
      expires_at timestamptz,
      created_at timestamptz not null default now()
    );

    create table if not exists push_tokens (
      id uuid primary key default uuid_generate_v4(),
      user_id uuid not null references users(id) on delete cascade,
      expo_token text not null,
      created_at timestamptz not null default now(),
      last_used_at timestamptz
    );

    create unique index if not exists push_tokens_user_token_uidx
      on push_tokens(user_id, expo_token);

    create table if not exists sites (
      id uuid primary key default uuid_generate_v4(),
      organisation_id uuid not null default '${defaultOrgId}' references organisations(id),
      name text not null,
      city text,
      status text default 'healthy',
      last_seen_at timestamptz default now(),
      online_devices integer default 0,
      device_count_online integer default 0,
      created_at timestamptz not null default now()
    );

    create table if not exists devices (
      id uuid primary key default uuid_generate_v4(),
      site_id uuid not null references sites(id) on delete cascade,
      name text not null,
      type text default 'heat_pump',
      external_id text,
      mac text,
      status text default 'online',
      last_seen_at timestamptz default now(),
      controller text,
      created_at timestamptz not null default now()
    );

    alter table devices
      add column if not exists mac text;

    create table if not exists telemetry_points (
      id bigserial primary key,
      device_id uuid not null references devices(id) on delete cascade,
      metric text not null,
      ts timestamptz not null,
      value double precision not null,
      quality text,
      created_at timestamptz not null default now()
    );

    create index if not exists telemetry_points_device_metric_ts_idx
      on telemetry_points (device_id, metric, ts desc);

    create table if not exists device_snapshots (
      device_id uuid primary key references devices(id) on delete cascade,
      last_seen_at timestamptz not null,
      data jsonb not null,
      updated_at timestamptz not null default now()
    );

    create table if not exists alerts (
      id uuid primary key default uuid_generate_v4(),
      site_id uuid references sites(id),
      device_id uuid references devices(id),
      severity text not null,
      type text not null,
      message text not null,
      status text not null,
      first_seen_at timestamptz not null,
      last_seen_at timestamptz not null,
      acknowledged_by uuid references users(id),
      acknowledged_at timestamptz,
      muted_until timestamptz,
      created_at timestamptz not null default now()
    );

    create index if not exists alerts_device_status_idx on alerts (device_id, status);
    create index if not exists alerts_site_status_idx on alerts (site_id, status);
    create index if not exists alerts_status_severity_idx on alerts (status, severity);

    create table if not exists control_commands (
      id uuid primary key default uuid_generate_v4(),
      device_id uuid not null references devices(id) on delete cascade,
      user_id uuid not null references users(id),
      command_type text not null,
      payload jsonb not null,
      status text not null,
      requested_at timestamptz not null default now(),
      completed_at timestamptz,
      error_message text
    );

    create index if not exists control_commands_device_idx
      on control_commands (device_id, requested_at desc);

    create table if not exists system_status (
      key text primary key,
      payload jsonb not null default '{}'::jsonb,
      mqtt_last_ingest_at timestamptz null,
      mqtt_last_error_at timestamptz null,
      mqtt_last_error text null,
      control_last_command_at timestamptz null,
      control_last_error_at timestamptz null,
      control_last_error text null,
      alerts_worker_last_heartbeat_at timestamptz null,
      push_last_sample_at timestamptz null,
      push_last_error text null,
      updated_at timestamptz not null default now()
    );

    alter table system_status
      alter column payload set default '{}'::jsonb;

    alter table system_status
      add column if not exists mqtt_last_ingest_at timestamptz null,
      add column if not exists mqtt_last_error_at timestamptz null,
      add column if not exists mqtt_last_error text null,
      add column if not exists control_last_command_at timestamptz null,
      add column if not exists control_last_error_at timestamptz null,
      add column if not exists control_last_error text null,
      add column if not exists alerts_worker_last_heartbeat_at timestamptz null,
      add column if not exists push_last_sample_at timestamptz null,
      add column if not exists push_last_error text null;
  `;

  await client.query(ddl);

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
