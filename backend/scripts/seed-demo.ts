import fs from 'fs';
import path from 'path';
import { Client } from 'pg';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';

dotenv.config({ path: path.join(__dirname, '..', '.env') });

type SeedDemoOptions = {
  connectionString?: string;
  reset?: boolean;
};

const DEFAULT_IDS = {
  org: process.env.DEMO_ORG_ID || '11111111-1111-1111-1111-111111111111',
  siteHero: process.env.DEMO_SITE_ID || '22222222-2222-2222-2222-222222222222',
  siteSecondary: process.env.DEMO_SITE_2_ID || '22222222-2222-2222-2222-222222222223',
  deviceHero: process.env.DEMO_DEVICE_ID || '33333333-3333-3333-3333-333333333333',
  deviceSecondary: process.env.DEMO_DEVICE_2_ID || '33333333-3333-3333-3333-333333333334',
  demoUser: process.env.DEMO_USER_ID || '55555555-5555-5555-5555-555555555555',
  adminUser: process.env.DEMO_ADMIN_USER_ID || '44444444-4444-4444-4444-444444444445',
  facilitiesUser: process.env.DEMO_FACILITIES_USER_ID || '44444444-4444-4444-4444-444444444446',
  contractorUser: process.env.DEMO_CONTRACTOR_USER_ID || '44444444-4444-4444-4444-444444444447',
};

const ALERT_RULE_IDS = {
  highTemp: 'aaaaaaaa-bbbb-cccc-dddd-000000000001',
  offline: 'aaaaaaaa-bbbb-cccc-dddd-000000000002',
};

const ALERT_IDS = {
  warning: '44444444-4444-4444-4444-444444444444',
  critical: '44444444-4444-4444-4444-444444444445',
};

const WORK_ORDER_IDS = {
  linkedToAlert: '55555555-5555-5555-5555-555555555555',
  inProgress: '66666666-6666-6666-6666-666666666666',
  done: '77777777-7777-7777-7777-777777777777',
};

const DOCUMENT_IDS = {
  siteManual: 'dddddddd-1111-2222-3333-444444444444',
  deviceSchematic: 'dddddddd-aaaa-bbbb-cccc-444444444444',
  blockedReport: 'dddddddd-bbbb-cccc-dddd-444444444444',
};

const SHARE_LINK_TOKENS = {
  site: 'demo-site-share-token',
  device: 'demo-device-share-token',
  expired: 'demo-expired-share-token',
  revoked: 'demo-revoked-share-token',
};

const DEMO_EMAIL = process.env.DEMO_EMAIL || 'demo@greenbro.com';
const DEMO_PASSWORD =
  process.env.DEMO_PASSWORD || process.env.DEMO_USER_PASSWORD || 'GreenbroDemo#2025!';
const DEMO_DEVICE_MAC = (process.env.DEMO_DEVICE_MAC || '38:18:2B:60:A9:94').toUpperCase();
export const DEMO_DEFAULTS = {
  ids: DEFAULT_IDS,
  email: DEMO_EMAIL,
  deviceMac: DEMO_DEVICE_MAC,
};

const STORAGE_ROOT = path.resolve(
  process.env.FILE_STORAGE_ROOT || path.join(__dirname, '..', 'uploads')
);
const STORAGE_BASE_URL = (process.env.FILE_STORAGE_BASE_URL || 'http://localhost:4000/files').replace(
  /\/$/,
  ''
);

async function ensureStorageFile(relativePath: string, contents: string) {
  const fullPath = path.join(STORAGE_ROOT, ...relativePath.split('/'));
  await fs.promises.mkdir(path.dirname(fullPath), { recursive: true });
  await fs.promises.writeFile(fullPath, contents);
}

async function upsertSystemStatus(client: Client) {
  await client.query(
    `
      insert into system_status (key, payload, alerts_worker_last_heartbeat_at, updated_at)
      values ('global', '{}'::jsonb, now(), now())
      on conflict (key) do update
        set alerts_worker_last_heartbeat_at = excluded.alerts_worker_last_heartbeat_at,
            updated_at = now()
    `
  );

  const alertsEnginePayload = {
    lastRunAt: new Date().toISOString(),
    lastDurationMs: 120,
    rulesLoaded: 2,
    activeCounts: { warning: 1, critical: 1, info: 0, total: 2 },
    evaluated: 3,
    triggered: 2,
  };

  await client.query(
    `
      insert into system_status (key, payload, updated_at)
      values ('alerts_engine', $1::jsonb, now())
      on conflict (key) do update
        set payload = excluded.payload,
            updated_at = now()
    `,
    [JSON.stringify(alertsEnginePayload)]
  );
}

async function insertTelemetry(client: Client, deviceId: string) {
  await client.query('delete from telemetry_points where device_id = $1', [deviceId]);

  const now = Date.now();
  const telemetryPoints: Array<{ metric: string; ts: Date; value: number }> = [];
  const metrics: Array<[string, number]> = [
    ['supply_temp', 45.2],
    ['return_temp', 39.1],
    ['power_kw', 5.4],
    ['flow_rate', 0.28],
    ['cop', 3.1],
    ['compressor_current', 6.2],
  ];

  for (const [metric, baseValue] of metrics) {
    for (let hour = 0; hour <= 24 * 2; hour += 1) {
      const ts = new Date(now - hour * 60 * 60 * 1000);
      telemetryPoints.push({
        metric,
        ts,
        value: Number(baseValue) + Math.sin(hour / 5) + Math.cos(hour / 7) * 0.5,
      });
    }
  }

  const chunkSize = 50;
  for (let i = 0; i < telemetryPoints.length; i += chunkSize) {
    const chunk = telemetryPoints.slice(i, i + chunkSize);
    const valuesClause = chunk
      .map(
        (_row, idx) =>
          `($1, $${idx * 3 + 2}, $${idx * 3 + 3}, $${idx * 3 + 4}, 'good', now())`
      )
      .join(', ');
    const params: Array<string | Date | number> = [deviceId];
    chunk.forEach((row) => params.push(row.metric, row.ts, row.value));
    await client.query(
      `
        insert into telemetry_points (device_id, metric, ts, value, quality, created_at)
        values ${valuesClause}
      `,
      params
    );
  }
}

async function insertAlerts(client: Client, siteId: string, deviceId: string, userId: string) {
  await client.query(
    `
      insert into alert_rules (id, org_id, site_id, device_id, metric, rule_type, threshold, offline_grace_sec, enabled, severity, snooze_default_sec, name, description)
      values
        ($1, $2, $3, null, 'supply_temp', 'threshold_above', 60, null, true, 'critical', 3600, 'High supply temperature', 'Raises a critical alert when supply temperature exceeds the configured limit.'),
        ($4, $2, null, null, 'connectivity', 'offline_window', null, 10 * 60, true, 'warning', 3600, 'Device offline', 'Warns when device has been offline beyond the grace period.')
      on conflict (id) do update
        set org_id = excluded.org_id,
            site_id = excluded.site_id,
            device_id = excluded.device_id,
            threshold = excluded.threshold,
            offline_grace_sec = excluded.offline_grace_sec,
            enabled = excluded.enabled,
            severity = excluded.severity,
            snooze_default_sec = excluded.snooze_default_sec,
            name = excluded.name,
            description = excluded.description
    `,
    [ALERT_RULE_IDS.highTemp, DEFAULT_IDS.org, siteId, ALERT_RULE_IDS.offline]
  );

  await client.query('delete from alerts where device_id = $1 or site_id = $2', [deviceId, siteId]);

  const now = Date.now();
  const alerts = [
    {
      id: ALERT_IDS.warning,
      severity: 'warning',
      type: 'offline',
      message: 'Device connectivity lost',
      status: 'active',
      first_seen_at: new Date(now - 2 * 60 * 60 * 1000),
      last_seen_at: new Date(now - 10 * 60 * 1000),
      rule_id: ALERT_RULE_IDS.offline,
      acknowledged_by: null,
      acknowledged_at: null,
      muted_until: null,
    },
    {
      id: ALERT_IDS.critical,
      severity: 'critical',
      type: 'high_temp',
      message: 'Supply temperature above threshold',
      status: 'active',
      first_seen_at: new Date(now - 90 * 60 * 1000),
      last_seen_at: new Date(now - 5 * 60 * 1000),
      rule_id: ALERT_RULE_IDS.highTemp,
      acknowledged_by: userId,
      acknowledged_at: new Date(now - 45 * 60 * 1000),
      muted_until: new Date(now + 15 * 60 * 1000),
    },
  ];

  for (const alert of alerts) {
    await client.query(
      `
        insert into alerts (
          id,
          site_id,
          device_id,
          severity,
          type,
          message,
          status,
          first_seen_at,
          last_seen_at,
          acknowledged_by,
          acknowledged_at,
          muted_until,
          rule_id
        )
        values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
        on conflict (id) do update
          set severity = excluded.severity,
              type = excluded.type,
              message = excluded.message,
              status = excluded.status,
              first_seen_at = excluded.first_seen_at,
              last_seen_at = excluded.last_seen_at,
              acknowledged_by = excluded.acknowledged_by,
              acknowledged_at = excluded.acknowledged_at,
              muted_until = excluded.muted_until,
              rule_id = excluded.rule_id
      `,
      [
        alert.id,
        siteId,
        deviceId,
        alert.severity,
        alert.type,
        alert.message,
        alert.status,
        alert.first_seen_at,
        alert.last_seen_at,
        alert.acknowledged_by,
        alert.acknowledged_at,
        alert.muted_until,
        alert.rule_id,
      ]
    );
  }
}

async function insertWorkOrders(
  client: Client,
  siteId: string,
  deviceId: string,
  orgId: string,
  demoUserId: string
) {
  const now = new Date();
  const future = new Date(now.getTime() + 48 * 60 * 60 * 1000);
  const soon = new Date(now.getTime() + 6 * 60 * 60 * 1000);
  const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);

  const workOrders = [
    {
      id: WORK_ORDER_IDS.linkedToAlert,
      alert_id: ALERT_IDS.critical,
      title: 'Check heat pump performance',
      description: 'Investigate critical temperature alert and verify sensors.',
      status: 'open',
      priority: 'high',
      due_at: future,
      sla_due_at: soon,
      reminder_at: new Date(now.getTime() + 60 * 60 * 1000),
      sla_breached: false,
      category: 'breakdown',
    },
    {
      id: WORK_ORDER_IDS.inProgress,
      alert_id: null,
      title: 'Quarterly maintenance',
      description: 'Perform quarterly inspection and clean filters.',
      status: 'in_progress',
      priority: 'medium',
      due_at: future,
      sla_due_at: new Date(now.getTime() + 24 * 60 * 60 * 1000),
      reminder_at: null,
      sla_breached: false,
      category: 'maintenance',
    },
    {
      id: WORK_ORDER_IDS.done,
      alert_id: null,
      title: 'Replace circulation pump',
      description: 'Completed replacement last week.',
      status: 'done',
      priority: 'medium',
      due_at: yesterday,
      sla_due_at: yesterday,
      reminder_at: null,
      sla_breached: true,
      category: 'repair',
    },
  ];

  const workOrderIds = workOrders.map((w) => w.id);

  await client.query('delete from work_order_tasks where work_order_id = ANY($1::uuid[])', [
    workOrderIds,
  ]);
  await client.query('delete from work_order_attachments where work_order_id = ANY($1::uuid[])', [
    workOrderIds,
  ]);
  await client.query('delete from work_orders where id = ANY($1::uuid[])', [workOrderIds]);

  for (const order of workOrders) {
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
          $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,now(),now()
        )
        on conflict (id) do update
          set status = excluded.status,
              priority = excluded.priority,
              assignee_user_id = excluded.assignee_user_id,
              due_at = excluded.due_at,
              sla_due_at = excluded.sla_due_at,
              resolved_at = excluded.resolved_at,
              sla_breached = excluded.sla_breached,
              reminder_at = excluded.reminder_at,
              category = excluded.category,
              updated_at = now()
      `,
      [
        order.id,
        orgId,
        siteId,
        deviceId,
        order.alert_id,
        order.title,
        order.description,
        order.status,
        order.priority,
        demoUserId,
        demoUserId,
        order.due_at,
        order.sla_due_at,
        order.status === 'done' ? now : null,
        order.sla_breached,
        order.reminder_at,
        order.category,
      ]
    );
  }

  await client.query(
    `
      insert into work_order_tasks (work_order_id, label, is_completed, position, created_at, updated_at)
      values
        ($1, 'Diagnose issue', false, 0, now(), now()),
        ($1, 'Record readings', false, 1, now(), now()),
        ($1, 'Confirm resolved', false, 2, now(), now()),
        ($2, 'Inspect pumps', true, 0, now(), now()),
        ($2, 'Clean filters', false, 1, now(), now())
      on conflict do nothing
    `,
    [WORK_ORDER_IDS.linkedToAlert, WORK_ORDER_IDS.inProgress]
  );

  const attachments = [
    {
      id: '99999999-aaaa-bbbb-cccc-000000000001',
      workOrderId: WORK_ORDER_IDS.linkedToAlert,
      label: 'Pump photo',
      filename: 'pump-photo.jpg',
      original_name: 'pump-photo.jpg',
      mime_type: 'image/jpeg',
      size_bytes: 2048,
      relative_path: `work-orders/${orgId}/${WORK_ORDER_IDS.linkedToAlert}/pump-photo.jpg`,
    },
    {
      id: '99999999-aaaa-bbbb-cccc-000000000002',
      workOrderId: WORK_ORDER_IDS.inProgress,
      label: 'Maintenance checklist',
      filename: 'maintenance-checklist.pdf',
      original_name: 'maintenance-checklist.pdf',
      mime_type: 'application/pdf',
      size_bytes: 4096,
      relative_path: `work-orders/${orgId}/${WORK_ORDER_IDS.inProgress}/maintenance-checklist.pdf`,
    },
  ];

  for (const attachment of attachments) {
    await ensureStorageFile(
      attachment.relative_path,
      `Seed attachment: ${attachment.label} (${attachment.original_name})`
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
          file_status,
          created_at
        )
        values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,'clean',now())
        on conflict (id) do update
          set label = excluded.label,
              filename = excluded.filename,
              original_name = excluded.original_name,
              mime_type = excluded.mime_type,
              size_bytes = excluded.size_bytes,
              url = excluded.url,
              relative_path = excluded.relative_path,
              file_status = excluded.file_status
      `,
      [
        attachment.id,
        orgId,
        attachment.workOrderId,
        attachment.label,
        attachment.filename,
        attachment.original_name,
        attachment.mime_type,
        attachment.size_bytes,
        `${STORAGE_BASE_URL}/${attachment.relative_path}`,
        attachment.relative_path,
        demoUserId,
      ]
    );
  }
}

async function insertDocuments(
  client: Client,
  orgId: string,
  siteId: string,
  deviceId: string,
  demoUserId: string
) {
  const docs = [
    {
      id: DOCUMENT_IDS.siteManual,
      site_id: siteId,
      device_id: null,
      title: 'Heat pump manual',
      category: 'manual',
      description: 'Seeded manual for the demo site',
      filename: 'manual.pdf',
      original_name: 'manual.pdf',
      mime_type: 'application/pdf',
      size_bytes: 12345,
      relative_path: `documents/${orgId}/site/${siteId}/manual.pdf`,
      file_status: 'clean',
    },
    {
      id: DOCUMENT_IDS.deviceSchematic,
      site_id: null,
      device_id: deviceId,
      title: 'Wiring schematic',
      category: 'schematic',
      description: 'Seeded schematic for demo device',
      filename: 'schematic.png',
      original_name: 'schematic.png',
      mime_type: 'image/png',
      size_bytes: 2345,
      relative_path: `documents/${orgId}/device/${deviceId}/schematic.png`,
      file_status: 'clean',
    },
    {
      id: DOCUMENT_IDS.blockedReport,
      site_id: siteId,
      device_id: null,
      title: 'Incident report',
      category: 'report',
      description: 'Blocked by AV to illustrate infected document handling',
      filename: 'incident-report.pdf',
      original_name: 'incident-report.pdf',
      mime_type: 'application/pdf',
      size_bytes: 5120,
      relative_path: `documents/${orgId}/site/${siteId}/incident-report.pdf`,
      file_status: 'infected',
    },
  ];

  for (const doc of docs) {
    await ensureStorageFile(
      doc.relative_path,
      `Seed document: ${doc.title} (${doc.original_name})`
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
          file_status,
          created_at
        )
        values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,now())
        on conflict (id) do update
          set title = excluded.title,
              category = excluded.category,
              description = excluded.description,
              filename = excluded.filename,
              original_name = excluded.original_name,
              mime_type = excluded.mime_type,
              size_bytes = excluded.size_bytes,
              relative_path = excluded.relative_path,
              file_status = excluded.file_status
      `,
      [
        doc.id,
        orgId,
        doc.site_id,
        doc.device_id,
        doc.title,
        doc.category,
        doc.description,
        doc.filename,
        doc.original_name,
        doc.mime_type,
        doc.size_bytes,
        doc.relative_path,
        demoUserId,
        doc.file_status,
      ]
    );
  }
}

async function insertShareLinks(client: Client, orgId: string, siteId: string, deviceId: string) {
  const links = [
    {
      id: 'aaaaaaaa-1111-2222-3333-444444444444',
      scope_type: 'site',
      scope_id: siteId,
      token: SHARE_LINK_TOKENS.site,
      permissions: 'read_only',
      expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      revoked_at: null,
    },
    {
      id: 'bbbbbbbb-1111-2222-3333-444444444444',
      scope_type: 'device',
      scope_id: deviceId,
      token: SHARE_LINK_TOKENS.device,
      permissions: 'read_only',
      expires_at: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
      revoked_at: null,
    },
    {
      id: 'cccccccc-1111-2222-3333-444444444444',
      scope_type: 'device',
      scope_id: deviceId,
      token: SHARE_LINK_TOKENS.expired,
      permissions: 'read_only',
      expires_at: new Date(Date.now() - 24 * 60 * 60 * 1000),
      revoked_at: null,
    },
    {
      id: 'dddddddd-1111-2222-3333-444444444444',
      scope_type: 'site',
      scope_id: siteId,
      token: SHARE_LINK_TOKENS.revoked,
      permissions: 'read_only',
      expires_at: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
      revoked_at: new Date(Date.now() - 60 * 60 * 1000),
    },
  ];

  for (const link of links) {
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
          revoked_at,
          created_at
        )
        values ($1,$2,$3,$4,$5,$6,$7,$8,$9,now())
        on conflict (id) do update
          set token = excluded.token,
              permissions = excluded.permissions,
              expires_at = excluded.expires_at,
              revoked_at = excluded.revoked_at
      `,
      [
        link.id,
        orgId,
        DEFAULT_IDS.demoUser,
        link.scope_type,
        link.scope_id,
        link.token,
        link.permissions,
        link.expires_at,
        link.revoked_at,
      ]
    );
  }
}

async function purgeDemoData(client: Client) {
  const workOrderIds = Object.values(WORK_ORDER_IDS);
  const deviceIds = [DEFAULT_IDS.deviceHero, DEFAULT_IDS.deviceSecondary];
  const siteIds = [DEFAULT_IDS.siteHero, DEFAULT_IDS.siteSecondary];
  const documentIds = Object.values(DOCUMENT_IDS);
  const alertIds = Object.values(ALERT_IDS);
  const alertRuleIds = Object.values(ALERT_RULE_IDS);
  const shareLinkIds = [
    'aaaaaaaa-1111-2222-3333-444444444444',
    'bbbbbbbb-1111-2222-3333-444444444444',
    'cccccccc-1111-2222-3333-444444444444',
    'dddddddd-1111-2222-3333-444444444444',
  ];

  await client.query('delete from telemetry_points where device_id = ANY($1::uuid[])', [deviceIds]);
  await client.query('delete from device_snapshots where device_id = ANY($1::uuid[])', [deviceIds]);
  await client.query('delete from alerts where id = ANY($1::uuid[]) or device_id = ANY($2::uuid[])', [
    alertIds,
    deviceIds,
  ]);
  await client.query('delete from alert_rules where id = ANY($1::uuid[])', [alertRuleIds]);
  await client.query('delete from work_order_tasks where work_order_id = ANY($1::uuid[])', [
    workOrderIds,
  ]);
  await client.query('delete from work_order_attachments where work_order_id = ANY($1::uuid[])', [
    workOrderIds,
  ]);
  await client.query('delete from work_orders where id = ANY($1::uuid[]) or organisation_id = $2', [
    workOrderIds,
    DEFAULT_IDS.org,
  ]);
  await client.query('delete from documents where id = ANY($1::uuid[]) or org_id = $2', [
    documentIds,
    DEFAULT_IDS.org,
  ]);
  await client.query('delete from share_links where id = ANY($1::uuid[]) or org_id = $2', [
    shareLinkIds,
    DEFAULT_IDS.org,
  ]);
  await client.query('delete from device_schedules where device_id = ANY($1::uuid[])', [deviceIds]);
  await client.query('delete from site_schedules where site_id = ANY($1::uuid[])', [siteIds]);
  await client.query('delete from devices where id = ANY($1::uuid[])', [deviceIds]);
  await client.query('delete from sites where id = ANY($1::uuid[])', [siteIds]);
  await client.query('delete from demo_tenants where org_id = $1', [DEFAULT_IDS.org]);
  await client.query(
    'delete from users where organisation_id = $1 or email in ($2,$3,$4,$5)',
    [
      DEFAULT_IDS.org,
      DEMO_EMAIL,
      'admin@greenbro.com',
      'facilities@greenbro.com',
      'contractor@greenbro.com',
    ]
  );
}

export async function seedDemo(options: SeedDemoOptions = {}) {
  const connectionString = options.connectionString || process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error('DATABASE_URL not set (or pass connectionString)');
  }

  const client = new Client({ connectionString });
  await client.connect();

  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 10);
  const seededAt = new Date();

  try {
    await client.query('begin');
    if (options.reset) {
      await purgeDemoData(client);
    }

    await upsertSystemStatus(client);

    await client.query(
      `
        insert into organisations (id, name, is_demo, demo_seeded_at)
        values ($1, $2, true, $3)
        on conflict (id) do update
          set name = excluded.name,
              is_demo = excluded.is_demo,
              demo_seeded_at = excluded.demo_seeded_at
      `,
      [DEFAULT_IDS.org, 'Demo Organisation', seededAt]
    );

    const demoUsers = [
      { id: DEFAULT_IDS.demoUser, email: DEMO_EMAIL, name: 'Demo Owner', role: 'owner' },
      { id: DEFAULT_IDS.adminUser, email: 'admin@greenbro.com', name: 'Admin User', role: 'admin' },
      {
        id: DEFAULT_IDS.facilitiesUser,
        email: 'facilities@greenbro.com',
        name: 'Facilities User',
        role: 'facilities',
      },
      {
        id: DEFAULT_IDS.contractorUser,
        email: 'contractor@greenbro.com',
        name: 'Contractor User',
        role: 'contractor',
      },
    ];

    for (const user of demoUsers) {
      await client.query(
        `
          insert into users (id, organisation_id, email, password_hash, name, role, can_impersonate)
          values ($1, $2, $3, $4, $5, $6, false)
          on conflict (email)
          do update set organisation_id = excluded.organisation_id,
                        name = excluded.name,
                        password_hash = excluded.password_hash,
                        role = excluded.role
        `,
        [user.id, DEFAULT_IDS.org, user.email, passwordHash, user.name, user.role]
      );
    }

    await client.query(
      `
        insert into sites (id, organisation_id, name, city, status, online_devices, device_count_online, last_seen_at, external_id)
        values
          ($1, $3, $4, $5, $6, 1, 1, now(), $7),
          ($2, $3, $8, $9, $10, 0, 0, now(), $11)
        on conflict (id) do update
          set name = excluded.name,
              city = excluded.city,
              status = excluded.status,
              online_devices = excluded.online_devices,
              device_count_online = excluded.device_count_online,
              last_seen_at = excluded.last_seen_at,
              external_id = excluded.external_id
      `,
      [
        DEFAULT_IDS.siteHero,
        DEFAULT_IDS.siteSecondary,
        DEFAULT_IDS.org,
        'Demo HQ',
        'Cape Town',
        'healthy',
        'demo-site-1',
        'Demo Plant',
        'Johannesburg',
        'warning',
        'demo-site-2',
      ]
    );

    const deviceSnapshot = {
      metrics: {
        supply_temp: 45.2,
        return_temp: 39.1,
        power_kw: 5.4,
        flow_rate: 0.28,
        cop: 3.1,
        compressor_current: 6.2,
      },
      raw: {
        timestamp: Date.now(),
        sensor: {
          supply_temperature_c: 45.2,
          return_temperature_c: 39.1,
          power_w: 5400,
          flow_lps: 0.28,
          cop: 3.1,
          compressor_current_a: 6.2,
        },
      },
    };

    await client.query(
      `
        insert into devices (id, site_id, name, type, external_id, mac, status, last_seen_at, controller, firmware_version, connectivity_status, is_demo, is_demo_hero)
        values ($1, $2, $3, $4, $5, $6, $7, now(), $8, $9, $10, true, true)
        on conflict (id) do update
          set mac = excluded.mac,
              status = excluded.status,
              last_seen_at = excluded.last_seen_at,
              controller = excluded.controller,
              firmware_version = excluded.firmware_version,
              connectivity_status = excluded.connectivity_status,
              is_demo = excluded.is_demo,
              is_demo_hero = excluded.is_demo_hero
      `,
      [
        DEFAULT_IDS.deviceHero,
        DEFAULT_IDS.siteHero,
        'Heat Pump #1',
        'heat_pump',
        'demo-device-1',
        DEMO_DEVICE_MAC,
        'online',
        'mqtt',
        '1.2.3',
        'online',
      ]
    );

    await client.query(
      `
        insert into devices (id, site_id, name, type, external_id, mac, status, last_seen_at, controller, firmware_version, connectivity_status, is_demo, is_demo_hero)
        values ($1, $2, $3, $4, $5, $6, $7, now(), $8, $9, $10, true, false)
        on conflict (id) do update
          set mac = excluded.mac,
              status = excluded.status,
              last_seen_at = excluded.last_seen_at,
              controller = excluded.controller,
              firmware_version = excluded.firmware_version,
              connectivity_status = excluded.connectivity_status,
              is_demo = excluded.is_demo,
              is_demo_hero = excluded.is_demo_hero
      `,
      [
        DEFAULT_IDS.deviceSecondary,
        DEFAULT_IDS.siteSecondary,
        'Heat Pump #2',
        'heat_pump',
        'demo-device-2',
        '38:18:2B:60:A9:95',
        'offline',
        'modbus',
        '1.1.0',
        'offline',
      ]
    );

    await client.query(
      `
        insert into demo_tenants (org_id, enabled, hero_device_id, hero_device_mac, seeded_at, created_at, updated_at)
        values ($1, true, $2, $3, $4, now(), now())
        on conflict (org_id) do update
          set enabled = excluded.enabled,
              hero_device_id = excluded.hero_device_id,
              hero_device_mac = excluded.hero_device_mac,
              seeded_at = excluded.seeded_at,
              updated_at = now()
      `,
      [DEFAULT_IDS.org, DEFAULT_IDS.deviceHero, DEMO_DEVICE_MAC, seededAt]
    );

    await client.query(
      `
        insert into device_snapshots (device_id, last_seen_at, data, updated_at)
        values ($1, now(), $2::jsonb, now())
        on conflict (device_id)
        do update set last_seen_at = excluded.last_seen_at, data = excluded.data, updated_at = excluded.updated_at
      `,
      [DEFAULT_IDS.deviceHero, JSON.stringify(deviceSnapshot)]
    );

    await client.query(
      `
        insert into device_snapshots (device_id, last_seen_at, data, updated_at)
        values ($1, now() - interval '4 hours', $2::jsonb, now())
        on conflict (device_id)
        do update set last_seen_at = excluded.last_seen_at, data = excluded.data, updated_at = excluded.updated_at
      `,
      [
        DEFAULT_IDS.deviceSecondary,
        JSON.stringify({
          metrics: { supply_temp: 32.1, return_temp: 29.4, power_kw: 0, flow_rate: 0, cop: 0 },
          raw: { timestamp: Date.now() - 4 * 60 * 60 * 1000 },
        }),
      ]
    );

    await insertTelemetry(client, DEFAULT_IDS.deviceHero);
    await insertAlerts(client, DEFAULT_IDS.siteHero, DEFAULT_IDS.deviceHero, DEFAULT_IDS.demoUser);

    await client.query(
      `
        insert into device_schedules (device_id, name, enabled, start_hour, end_hour, target_setpoint, target_mode, created_at, updated_at)
        values ($1, 'Demo schedule', true, 6, 18, 20, 'HEATING', now(), now())
        on conflict (device_id) do update
          set enabled = excluded.enabled,
              start_hour = excluded.start_hour,
              end_hour = excluded.end_hour,
              target_setpoint = excluded.target_setpoint,
              target_mode = excluded.target_mode,
              updated_at = now()
      `,
      [DEFAULT_IDS.deviceHero]
    );

    await client.query('delete from site_schedules where site_id in ($1, $2)', [
      DEFAULT_IDS.siteHero,
      DEFAULT_IDS.siteSecondary,
    ]);
    await client.query(
      `
        insert into site_schedules (site_id, day_of_week, start_time_local, end_time_local, kind)
        values
          ($1, 1, '06:00', '10:00', 'tou_peak'),
          ($1, 3, '18:00', '22:00', 'load_shedding'),
          ($2, 2, '05:00', '07:00', 'tou_peak')
      `,
      [DEFAULT_IDS.siteHero, DEFAULT_IDS.siteSecondary]
    );

    await insertWorkOrders(
      client,
      DEFAULT_IDS.siteHero,
      DEFAULT_IDS.deviceHero,
      DEFAULT_IDS.org,
      DEFAULT_IDS.demoUser
    );
    await insertDocuments(
      client,
      DEFAULT_IDS.org,
      DEFAULT_IDS.siteHero,
      DEFAULT_IDS.deviceHero,
      DEFAULT_IDS.demoUser
    );
    await insertShareLinks(client, DEFAULT_IDS.org, DEFAULT_IDS.siteHero, DEFAULT_IDS.deviceHero);

    await client.query('commit');
  } catch (err) {
    await client.query('rollback');
    throw err;
  } finally {
    await client.end();
  }
}

if (require.main === module) {
  const reset = process.argv.includes('--reset');
  seedDemo({ reset })
    .then(() => {
      console.log(
        `Demo seed complete for ${DEMO_EMAIL} (${DEFAULT_IDS.org}) with hero MAC ${DEMO_DEVICE_MAC}`
      );
    })
    .catch((error) => {
      console.error('Demo seed failed', error);
      process.exit(1);
    });
}
