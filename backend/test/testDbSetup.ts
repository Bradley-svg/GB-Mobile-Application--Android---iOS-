import fs from 'fs';
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

const DEMO_USERS = {
  facilities: {
    id: DEFAULT_IDS.user,
    email: 'demo@example.com',
    name: 'Demo User',
    role: 'facilities' as const,
  },
  owner: {
    id: '44444444-4444-4444-4444-444444444445',
    email: 'owner@example.com',
    name: 'Owner User',
    role: 'owner' as const,
  },
  admin: {
    id: '44444444-4444-4444-4444-444444444446',
    email: 'admin@example.com',
    name: 'Admin User',
    role: 'admin' as const,
  },
  contractor: {
    id: '44444444-4444-4444-4444-444444444447',
    email: 'contractor@example.com',
    name: 'Contractor User',
    role: 'contractor' as const,
  },
};

const DEMO_SHARE_LINKS = {
  site: 'site-share-token',
  device: 'device-share-token',
  expired: 'expired-share-token',
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

  const users = [
    DEMO_USERS.facilities,
    DEMO_USERS.owner,
    DEMO_USERS.admin,
    DEMO_USERS.contractor,
  ];

  for (const user of users) {
    await client.query(
      `
      insert into users (id, organisation_id, email, password_hash, name, role)
      values ($1, $2, $3, $4, $5, $6)
      on conflict (id) do nothing
    `,
      [user.id, DEFAULT_IDS.organisation, user.email, passwordHash, user.name, user.role]
    );
  }

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
    insert into telemetry_points (device_id, metric, ts, value, quality, created_at)
    values
      ($1, 'supply_temp', now() - interval '1 hour', 45.2, 'good', now()),
      ($1, 'return_temp', now() - interval '1 hour', 39.1, 'good', now()),
      ($1, 'power_kw', now() - interval '1 hour', 5.4, 'good', now())
  `,
    [DEFAULT_IDS.device]
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

  await client.query(
    `
    insert into device_schedules (
      device_id,
      name,
      enabled,
      start_hour,
      end_hour,
      target_setpoint,
      target_mode,
      created_at,
      updated_at
    )
    values ($1, 'Demo schedule', true, 6, 18, 20, 'HEATING', now(), now())
    on conflict (device_id) do nothing
  `,
    [DEFAULT_IDS.device]
  );

  const defaultWorkOrderId = '55555555-5555-5555-5555-555555555555';
  await client.query(
    `
    insert into work_orders (
      id,
      organisation_id,
      site_id,
      device_id,
      alert_id,
      title,
      description,
      status,
      priority,
      assignee_user_id,
      created_by_user_id,
      due_at,
      sla_due_at,
      resolved_at,
      sla_breached,
      reminder_at,
      category,
      created_at,
      updated_at
    )
    values (
      $1,
      $2,
      $3,
      $4,
      null,
      'Check heat pump performance',
      'Seeded work order for regression tests',
      'open',
      'medium',
      null,
      $5,
      now() + interval '2 days',
      now() + interval '2 days',
      null,
      false,
      now() + interval '1 day',
      'maintenance',
      now(),
      now()
    )
    on conflict (id) do nothing
  `,
    [defaultWorkOrderId, DEFAULT_IDS.organisation, DEFAULT_IDS.site, DEFAULT_IDS.device, DEFAULT_IDS.user]
  );

  const overdueWorkOrderId = '66666666-6666-6666-6666-666666666666';
  await client.query(
    `
    insert into work_orders (
      id,
      organisation_id,
      site_id,
      device_id,
      alert_id,
      title,
      description,
      status,
      priority,
      assignee_user_id,
      created_by_user_id,
      due_at,
      sla_due_at,
      resolved_at,
      sla_breached,
      reminder_at,
      category,
      created_at,
      updated_at
    )
    values (
      $1,
      $2,
      $3,
      $4,
      null,
      'Overdue pump inspection',
      'Seeded overdue work order',
      'open',
      'high',
      null,
      $5,
      now() - interval '3 days',
      now() - interval '2 days',
      null,
      true,
      now() - interval '1 day',
      'maintenance',
      now() - interval '5 days',
      now() - interval '1 day'
    )
    on conflict (id) do nothing
  `,
    [overdueWorkOrderId, DEFAULT_IDS.organisation, DEFAULT_IDS.site, DEFAULT_IDS.device, DEFAULT_IDS.user]
  );

  const doneWithinSlaId = '77777777-7777-7777-7777-777777777777';
  await client.query(
    `
    insert into work_orders (
      id,
      organisation_id,
      site_id,
      device_id,
      alert_id,
      title,
      description,
      status,
      priority,
      assignee_user_id,
      created_by_user_id,
      due_at,
      sla_due_at,
      resolved_at,
      sla_breached,
      reminder_at,
      category,
      created_at,
      updated_at
    )
    values (
      $1,
      $2,
      $3,
      $4,
      null,
      'Completed within SLA',
      'Seeded closed order completed on time',
      'done',
      'medium',
      null,
      $5,
      now() - interval '1 day',
      now() + interval '6 hours',
      now(),
      false,
      null,
      'inspection',
      now() - interval '2 days',
      now()
    )
    on conflict (id) do nothing
  `,
    [doneWithinSlaId, DEFAULT_IDS.organisation, DEFAULT_IDS.site, DEFAULT_IDS.device, DEFAULT_IDS.user]
  );

  const doneBreachedId = '88888888-8888-8888-8888-888888888888';
  await client.query(
    `
    insert into work_orders (
      id,
      organisation_id,
      site_id,
      device_id,
      alert_id,
      title,
      description,
      status,
      priority,
      assignee_user_id,
      created_by_user_id,
      due_at,
      sla_due_at,
      resolved_at,
      sla_breached,
      reminder_at,
      category,
      created_at,
      updated_at
    )
    values (
      $1,
      $2,
      $3,
      $4,
      null,
      'Completed after SLA',
      'Seeded closed order that breached SLA',
      'done',
      'medium',
      null,
      $5,
      now() - interval '4 days',
      now() - interval '3 days',
      now() - interval '1 day',
      true,
      null,
      'breakdown',
      now() - interval '5 days',
      now() - interval '1 day'
    )
    on conflict (id) do nothing
  `,
    [doneBreachedId, DEFAULT_IDS.organisation, DEFAULT_IDS.site, DEFAULT_IDS.device, DEFAULT_IDS.user]
  );

  await client.query(
    `
    insert into work_order_tasks (work_order_id, label, is_completed, position, created_at, updated_at)
    values
      ($1, 'Diagnose issue', false, 0, now(), now()),
      ($1, 'Record readings', false, 1, now(), now()),
      ($1, 'Confirm resolved', false, 2, now(), now())
    on conflict do nothing
  `,
    [defaultWorkOrderId]
  );

  await client.query(
    `
    insert into work_order_attachments (
      id,
      organisation_id,
      work_order_id,
      label,
      filename,
      original_name,
      mime_type,
      size_bytes,
      url,
      relative_path,
      uploaded_by_user_id,
      created_at
    )
    values
      ('99999999-aaaa-bbbb-cccc-000000000001', $1, $2, 'Pump photo', 'pump-photo.jpg', 'pump-photo.jpg', 'image/jpeg', 2048, '/files/work-orders/seed/pump-photo.jpg', 'work-orders/11111111-1111-1111-1111-111111111111/55555555-5555-5555-5555-555555555555/pump-photo.jpg', $3, now()),
      ('99999999-aaaa-bbbb-cccc-000000000002', $1, $4, 'Report', 'report.pdf', 'report.pdf', 'application/pdf', 4096, '/files/work-orders/seed/report.pdf', 'work-orders/11111111-1111-1111-1111-111111111111/66666666-6666-6666-6666-666666666666/report.pdf', $3, now())
    on conflict do nothing
  `,
    [DEFAULT_IDS.organisation, defaultWorkOrderId, DEFAULT_IDS.user, overdueWorkOrderId]
  );

  await client.query(
    `
    insert into documents (
      id,
      org_id,
      site_id,
      device_id,
      title,
      category,
      description,
      filename,
      original_name,
      mime_type,
      size_bytes,
      relative_path,
      uploaded_by_user_id,
      created_at
    )
    values
      ('dddddddd-1111-2222-3333-444444444444', $1, $2, null, 'Heat pump manual', 'manual', 'Seeded manual', 'manual.pdf', 'manual.pdf', 'application/pdf', 12345, 'documents/11111111-1111-1111-1111-111111111111/site/22222222-2222-2222-2222-222222222222/manual.pdf', $3, now()),
      ('dddddddd-aaaa-bbbb-cccc-444444444444', $1, null, $4, 'Wiring schematic', 'schematic', null, 'schematic.png', 'schematic.png', 'image/png', 2345, 'documents/11111111-1111-1111-1111-111111111111/device/33333333-3333-3333-3333-333333333333/schematic.png', $3, now())
    on conflict do nothing
  `,
    [DEFAULT_IDS.organisation, DEFAULT_IDS.site, DEFAULT_IDS.user, DEFAULT_IDS.device]
  );

  await client.query(
    `
    insert into share_links (
      id,
      org_id,
      created_by_user_id,
      scope_type,
      scope_id,
      token,
      permissions,
      expires_at,
      created_at
    )
    values
      ('aaaaaaaa-1111-2222-3333-444444444444', $1, $2, 'site', $3, $5, 'read_only', now() + interval '7 days', now()),
      ('bbbbbbbb-1111-2222-3333-444444444444', $1, $2, 'device', $4, $6, 'read_only', now() + interval '14 days', now()),
      ('cccccccc-1111-2222-3333-444444444444', $1, $2, 'device', $4, $7, 'read_only', now() - interval '1 day', now() - interval '2 days')
    on conflict (id) do nothing
  `,
    [
      DEFAULT_IDS.organisation,
      DEMO_USERS.owner.id,
      DEFAULT_IDS.site,
      DEFAULT_IDS.device,
      DEMO_SHARE_LINKS.site,
      DEMO_SHARE_LINKS.device,
      DEMO_SHARE_LINKS.expired,
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
        work_order_tasks,
        work_order_attachments,
        documents,
        share_links,
        work_orders,
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

  const storageRoot = process.env.FILE_STORAGE_ROOT;
  if (storageRoot) {
    await fs.promises.rm(storageRoot, { recursive: true, force: true }).catch(() => {});
  }
}
