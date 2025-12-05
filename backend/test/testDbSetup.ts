import fs from 'fs/promises';
import path from 'path';
import dotenv from 'dotenv';
import bcrypt from 'bcryptjs';
import { Client } from 'pg';

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const SCHEMA_FILES = [
  'sql/telemetry_schema.sql',
  'sql/alerts_schema.sql',
  'sql/control_commands_schema.sql',
  'sql/push_tokens_schema.sql',
  'sql/refresh_tokens_schema.sql',
  'sql/system_status_schema.sql',
] as const;

const DEFAULT_IDS = {
  organisation: '11111111-1111-1111-1111-111111111111',
  site: '22222222-2222-2222-2222-222222222222',
  device: '33333333-3333-3333-3333-333333333333',
  user: '44444444-4444-4444-4444-444444444444',
};

const DEMO_HEATPUMP_MAC = '38:18:2B:60:A9:94';

let adminClient: Client | null = null;
let schemaPrepared = false;

function getTestDatabaseUrl(): string {
  const url = process.env.TEST_DATABASE_URL;
  if (!url) {
    throw new Error('TEST_DATABASE_URL must be set to run integration tests');
  }
  return url;
}

function formatDbLocation(url: string): string {
  try {
    const parsed = new URL(url);
    const dbName = parsed.pathname.replace(/^\//, '') || '(default)';
    const port = parsed.port || '5432';
    return `${parsed.hostname || 'localhost'}:${port}/${dbName}`;
  } catch (err) {
    return url;
  }
}

function shouldResetDatabase(connectionString: string): boolean {
  if (process.env.ALLOW_TEST_DB_RESET === 'true') return true;

  try {
    const parsed = new URL(connectionString);
    const dbName = parsed.pathname.replace(/^\//, '').toLowerCase();
    return dbName.includes('test');
  } catch (err) {
    return false;
  }
}

async function getClient(): Promise<Client> {
  if (adminClient) return adminClient;

  const connectionString = getTestDatabaseUrl();
  process.env.NODE_ENV = process.env.NODE_ENV || 'test';

  try {
    adminClient = new Client({ connectionString });
    await adminClient.connect();
    return adminClient;
  } catch (err) {
    console.error(
      `Integration tests require a reachable Postgres at TEST_DATABASE_URL (${formatDbLocation(
        connectionString
      )}). Start Postgres locally (or point TEST_DATABASE_URL at an existing DB) before running tests.`
    );
    throw err;
  }
}

async function applyBaseSchema(client: Client) {
  await client.query('create extension if not exists "uuid-ossp";');
  await client.query('create extension if not exists "pgcrypto";');

  await client.query(`
    create table if not exists organisations (
      id uuid primary key,
      name text not null,
      created_at timestamptz not null default now()
    );

    create table if not exists users (
      id uuid primary key default uuid_generate_v4(),
      organisation_id uuid not null references organisations(id),
      email text not null unique,
      password_hash text not null,
      name text not null,
      created_at timestamptz not null default now()
    );

    create table if not exists sites (
      id uuid primary key default uuid_generate_v4(),
      organisation_id uuid not null references organisations(id),
      name text not null,
      city text,
      status text default 'healthy',
      last_seen_at timestamptz default now(),
      online_devices integer default 0,
      device_count_online integer default 0,
      external_id text,
      created_at timestamptz not null default now()
    );

    alter table sites
      add column if not exists external_id text;

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
  `);
}

async function applySqlFiles(client: Client) {
  for (const file of SCHEMA_FILES) {
    const filePath = path.resolve(__dirname, '..', file);
    const sql = await fs.readFile(filePath, 'utf8');
    await client.query(sql);
  }
}

async function ensureSchema(client: Client) {
  if (schemaPrepared) return;
  await applyBaseSchema(client);
  await applySqlFiles(client);
  schemaPrepared = true;
}

async function seedBaseData(client: Client) {
  const passwordHash = await bcrypt.hash('password123', 10);

  await client.query(
    `
    insert into organisations (id, name)
    values ($1, $2)
    on conflict (id) do nothing
  `,
    [DEFAULT_IDS.organisation, 'Greenbro Demo Org']
  );

  await client.query(
    `
    insert into users (id, organisation_id, email, password_hash, name)
    values ($1, $2, $3, $4, $5)
    on conflict (id) do nothing
  `,
    [DEFAULT_IDS.user, DEFAULT_IDS.organisation, 'demo@example.com', passwordHash, 'Demo User']
  );

  await client.query(
    `
    insert into sites (id, organisation_id, name, city, status, last_seen_at, external_id)
    values ($1, $2, $3, $4, $5, now(), $6)
    on conflict (id) do nothing
  `,
    [DEFAULT_IDS.site, DEFAULT_IDS.organisation, 'Demo Site', 'Cape Town', 'healthy', 'demo-site-1']
  );

  await client.query(
    `
    insert into devices (id, site_id, name, type, external_id, mac, status, last_seen_at, controller)
    values ($1, $2, $3, $4, $5, $6, $7, now(), $8)
    on conflict (id) do nothing
  `,
    [
      DEFAULT_IDS.device,
      DEFAULT_IDS.site,
      'Demo Heat Pump',
      'heat_pump',
      'demo-device-1',
      DEMO_HEATPUMP_MAC,
      'online',
      'mqtt',
    ]
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
    insert into device_snapshots (device_id, last_seen_at, data, updated_at)
    values ($1, now(), $2::jsonb, now())
    on conflict (device_id)
    do update set last_seen_at = excluded.last_seen_at, data = excluded.data, updated_at = excluded.updated_at
  `,
    [
      DEFAULT_IDS.device,
      JSON.stringify({
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
      }),
    ]
  );
}

async function resetTables(client: Client) {
  const connectionString = getTestDatabaseUrl();
  const allowReset = shouldResetDatabase(connectionString);

  if (!allowReset) {
    console.warn(
      `Skipping destructive reset because TEST_DATABASE_URL (${formatDbLocation(
        connectionString
      )}) does not look like a dedicated test database. Set ALLOW_TEST_DB_RESET=true to force truncation.`
    );
    await seedBaseData(client);
    return;
  }

  await client.query(`
      truncate table
        telemetry_points,
        device_snapshots,
        refresh_tokens,
        push_tokens,
        alerts,
        control_commands,
        devices,
        sites,
        users,
        organisations,
        system_status
      restart identity cascade
    `);

  await seedBaseData(client);
}

export async function setupTestDb() {
  const client = await getClient();
  await ensureSchema(client);
  await resetTables(client);
}

export async function resetTestDb() {
  const client = await getClient();
  await ensureSchema(client);
  await resetTables(client);
}

export async function teardownTestDb() {
  if (adminClient) {
    await adminClient.end();
    adminClient = null;
  }

  try {
    const db = await import('../src/config/db');
    if (typeof db.closePool === 'function') {
      await db.closePool();
    }
  } catch (err) {
    // Ignore teardown errors to avoid masking test failures
  } finally {
    schemaPrepared = false;
  }
}
