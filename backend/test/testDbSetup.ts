import path from 'path';
import dotenv from 'dotenv';
import bcrypt from 'bcryptjs';
import { Client } from 'pg';
import runMigrations, { RunnerOption } from 'node-pg-migrate';

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const DEFAULT_IDS = {
  organisation: '11111111-1111-1111-1111-111111111111',
  site: '22222222-2222-2222-2222-222222222222',
  device: '33333333-3333-3333-3333-333333333333',
  user: '44444444-4444-4444-4444-444444444444',
};

const DEMO_HEATPUMP_MAC = '38:18:2B:60:A9:94';
const MIGRATIONS_DIR = path.resolve(__dirname, '../migrations');

let adminClient: Client | null = null;
let migrationsApplied = false;

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

async function ensureMigrations(connectionString: string) {
  if (migrationsApplied) return;
  process.env.NODE_ENV = process.env.NODE_ENV || 'test';

  const options: RunnerOption = {
    databaseUrl: connectionString,
    dir: MIGRATIONS_DIR,
    direction: 'up',
    migrationsTable: 'pgmigrations',
    count: Infinity,
    singleTransaction: true,
    logger: {
      info: () => {},
      warn: (msg: string) => console.warn(msg),
      error: (msg: string) => console.error(msg),
    },
  };

  await runMigrations(options);
  migrationsApplied = true;
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

  await client.query(
    `
    insert into alert_rules (org_id, site_id, device_id, metric, rule_type, threshold, severity, enabled, name, description)
    values
      ($1, $2, null, 'supply_temp', 'threshold_above', 60, 'critical', true, 'High supply temperature', 'Seed rule for tests'),
      ($1, null, null, 'connectivity', 'offline_window', null, 'warning', true, 'Offline', 'Offline rule with default grace')
    on conflict do nothing
  `,
    [DEFAULT_IDS.organisation, DEFAULT_IDS.site]
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
        user_preferences,
        alerts,
        alert_rules,
        device_schedules,
        site_schedules,
        control_commands,
        devices,
        sites,
        users,
        organisations,
        system_status,
        worker_locks
      restart identity cascade
    `);

  await seedBaseData(client);
}

export async function setupTestDb() {
  await ensureMigrations(getTestDatabaseUrl());
  const client = await getClient();
  await resetTables(client);
}

export async function resetTestDb() {
  await ensureMigrations(getTestDatabaseUrl());
  const client = await getClient();
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
    migrationsApplied = false;
  }
}
