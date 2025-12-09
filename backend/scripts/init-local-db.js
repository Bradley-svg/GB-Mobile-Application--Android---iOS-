const fs = require('fs');
const path = require('path');
const { Client } = require('pg');
const bcrypt = require('bcryptjs');

require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const DEFAULT_IDS = {
  organisation: '11111111-1111-1111-1111-111111111111',
  site: '22222222-2222-2222-2222-222222222222',
  device: '33333333-3333-3333-3333-333333333333',
  user: '55555555-5555-5555-5555-555555555555',
};

const ALERT_RULE_IDS = {
  highTemp: 'aaaaaaaa-bbbb-cccc-dddd-000000000001',
  offline: 'aaaaaaaa-bbbb-cccc-dddd-000000000002',
};

const ALERT_IDS = {
  offline: '44444444-4444-4444-4444-444444444444',
  highTemp: '44444444-4444-4444-4444-444444444445',
  resolved: '44444444-4444-4444-4444-444444444446',
};

const WORK_ORDER_IDS = {
  linkedToAlert: '55555555-5555-5555-5555-555555555555',
  inProgress: '66666666-6666-6666-6666-666666666666',
  done: '77777777-7777-7777-7777-777777777777',
};

const DOCUMENT_IDS = {
  site: 'dddddddd-1111-2222-3333-444444444444',
  device: 'dddddddd-aaaa-bbbb-cccc-444444444444',
};

const SHARE_LINK_TOKENS = {
  site: 'demo-site-share-token',
  device: 'demo-device-share-token',
  expired: 'demo-expired-share-token',
};

// Must match the MAC Azure expects for the demo heat pump history calls.
const DEMO_HEATPUMP_MAC = '38:18:2B:60:A9:94';
const STORAGE_ROOT = path.resolve(
  process.env.FILE_STORAGE_ROOT || path.join(__dirname, '..', 'uploads')
);
const STORAGE_BASE_URL = (process.env.FILE_STORAGE_BASE_URL || 'http://localhost:4000/files').replace(
  /\/$/,
  ''
);

async function ensureStorageFile(relativePath, contents) {
  const fullPath = path.join(STORAGE_ROOT, ...relativePath.split('/'));
  await fs.promises.mkdir(path.dirname(fullPath), { recursive: true });
  await fs.promises.writeFile(fullPath, contents);
}

async function insertTelemetry(client, deviceId) {
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
    for (let hour = 0; hour <= 24 * 7; hour += 1) {
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
    const params = [deviceId];
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

async function insertAlertsAndRules(client, orgId, siteId, deviceId, demoUserId) {
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
    [ALERT_RULE_IDS.highTemp, orgId, siteId, ALERT_RULE_IDS.offline]
  );

  await client.query('delete from alerts where device_id = $1 or site_id = $2', [deviceId, siteId]);

  const now = Date.now();
  const alerts = [
    {
      id: ALERT_IDS.offline,
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
      id: ALERT_IDS.highTemp,
      severity: 'critical',
      type: 'high_temp',
      message: 'Supply temperature above threshold',
      status: 'active',
      first_seen_at: new Date(now - 90 * 60 * 1000),
      last_seen_at: new Date(now - 5 * 60 * 1000),
      rule_id: ALERT_RULE_IDS.highTemp,
      acknowledged_by: demoUserId,
      acknowledged_at: new Date(now - 45 * 60 * 1000),
      muted_until: new Date(now + 15 * 60 * 1000),
    },
    {
      id: ALERT_IDS.resolved,
      severity: 'warning',
      type: 'rule',
      message: 'Flow rate recovered',
      status: 'cleared',
      first_seen_at: new Date(now - 24 * 60 * 60 * 1000),
      last_seen_at: new Date(now - 20 * 60 * 60 * 1000),
      rule_id: ALERT_RULE_IDS.highTemp,
      acknowledged_by: demoUserId,
      acknowledged_at: new Date(now - 23 * 60 * 60 * 1000),
      muted_until: null,
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

async function insertSchedules(client, siteId, deviceId) {
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
    [deviceId]
  );

  await client.query('delete from site_schedules where site_id = $1', [siteId]);
  await client.query(
    `
      insert into site_schedules (site_id, day_of_week, start_time_local, end_time_local, kind)
      values
        ($1, 1, '06:00', '10:00', 'tou_peak'),
        ($1, 3, '18:00', '22:00', 'load_shedding')
    `,
    [siteId]
  );
}

async function insertWorkOrders(client, orgId, siteId, deviceId, demoUserId) {
  const now = new Date();
  const future = new Date(now.getTime() + 48 * 60 * 60 * 1000);
  const soon = new Date(now.getTime() + 6 * 60 * 60 * 1000);
  const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);

  const workOrders = [
    {
      id: WORK_ORDER_IDS.linkedToAlert,
      alert_id: ALERT_IDS.highTemp,
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
      relative_path: `work-orders/${DEFAULT_IDS.organisation}/${WORK_ORDER_IDS.linkedToAlert}/pump-photo.jpg`,
    },
    {
      id: '99999999-aaaa-bbbb-cccc-000000000002',
      workOrderId: WORK_ORDER_IDS.inProgress,
      label: 'Maintenance checklist',
      filename: 'maintenance-checklist.pdf',
      original_name: 'maintenance-checklist.pdf',
      mime_type: 'application/pdf',
      size_bytes: 4096,
      relative_path: `work-orders/${DEFAULT_IDS.organisation}/${WORK_ORDER_IDS.inProgress}/maintenance-checklist.pdf`,
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
          created_at
        )
        values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,now())
        on conflict (id) do update
          set label = excluded.label,
              filename = excluded.filename,
              original_name = excluded.original_name,
              mime_type = excluded.mime_type,
              size_bytes = excluded.size_bytes,
              url = excluded.url,
              relative_path = excluded.relative_path
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

async function insertDocuments(client, orgId, siteId, deviceId, demoUserId) {
  const docs = [
    {
      id: DOCUMENT_IDS.site,
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
    },
    {
      id: DOCUMENT_IDS.device,
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
          created_at
        )
        values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,now())
        on conflict (id) do update
          set title = excluded.title,
              category = excluded.category,
              description = excluded.description,
              filename = excluded.filename,
              original_name = excluded.original_name,
              mime_type = excluded.mime_type,
              size_bytes = excluded.size_bytes,
              relative_path = excluded.relative_path
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
      ]
    );
  }
}

async function insertShareLinks(client, orgId, siteId, deviceId, demoUserId) {
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
        demoUserId,
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

async function upsertSystemStatus(client) {
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

async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error('DATABASE_URL not set');
  }

  const demoUserPassword = process.env.DEMO_USER_PASSWORD || 'password';
  const passwordHash = await bcrypt.hash(demoUserPassword, 10);
  const demoUsers = [
    {
      id: DEFAULT_IDS.user,
      email: 'demo@greenbro.com',
      name: 'Demo User',
      role: 'owner',
    },
    {
      id: '44444444-4444-4444-4444-444444444445',
      email: 'admin@greenbro.com',
      name: 'Admin User',
      role: 'admin',
    },
    {
      id: '44444444-4444-4444-4444-444444444446',
      email: 'facilities@greenbro.com',
      name: 'Facilities User',
      role: 'facilities',
    },
    {
      id: '44444444-4444-4444-4444-444444444447',
      email: 'contractor@greenbro.com',
      name: 'Contractor User',
      role: 'contractor',
    },
  ];
  const client = new Client({ connectionString });

  await client.connect();
  await upsertSystemStatus(client);

  await client.query(
    `
      insert into organisations (id, name)
      values ($1, $2)
      on conflict (id) do update set name = excluded.name
    `,
    [DEFAULT_IDS.organisation, 'Greenbro Demo Org']
  );

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
      [user.id, DEFAULT_IDS.organisation, user.email, passwordHash, user.name, user.role]
    );
  }

  await client.query(
    `
      insert into sites (id, organisation_id, name, city, status, online_devices, device_count_online, last_seen_at, external_id)
      values ($1, $2, $3, $4, $5, $6, $7, now(), $8)
      on conflict (id) do update
        set name = excluded.name,
            city = excluded.city,
            status = excluded.status,
            online_devices = excluded.online_devices,
            device_count_online = excluded.device_count_online,
            last_seen_at = excluded.last_seen_at
    `,
    [DEFAULT_IDS.site, DEFAULT_IDS.organisation, 'Demo Site', 'Cape Town', 'healthy', 1, 1, 'demo-site-1']
  );

  const deviceSnapshot = {
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
      insert into devices (id, site_id, name, type, external_id, mac, status, last_seen_at, controller, firmware_version, connectivity_status)
      values ($1, $2, $3, $4, $5, $6, $7, now(), $8, $9, $10)
      on conflict (id) do update
        set mac = excluded.mac,
            status = excluded.status,
            last_seen_at = excluded.last_seen_at,
            controller = excluded.controller,
            firmware_version = excluded.firmware_version,
            connectivity_status = excluded.connectivity_status
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
      '1.2.3',
      'online',
    ]
  );

  await client.query(
    `
      insert into device_snapshots (device_id, last_seen_at, data, updated_at)
      values ($1, now(), $2::jsonb, now())
      on conflict (device_id)
      do update set last_seen_at = excluded.last_seen_at, data = excluded.data, updated_at = excluded.updated_at
    `,
    [DEFAULT_IDS.device, JSON.stringify(deviceSnapshot)]
  );

  await insertTelemetry(client, DEFAULT_IDS.device);
  await insertAlertsAndRules(client, DEFAULT_IDS.organisation, DEFAULT_IDS.site, DEFAULT_IDS.device, DEFAULT_IDS.user);
  await insertSchedules(client, DEFAULT_IDS.site, DEFAULT_IDS.device);
  await insertWorkOrders(client, DEFAULT_IDS.organisation, DEFAULT_IDS.site, DEFAULT_IDS.device, DEFAULT_IDS.user);
  await insertDocuments(client, DEFAULT_IDS.organisation, DEFAULT_IDS.site, DEFAULT_IDS.device, DEFAULT_IDS.user);
  await insertShareLinks(client, DEFAULT_IDS.organisation, DEFAULT_IDS.site, DEFAULT_IDS.device, DEFAULT_IDS.user);

  console.log('Local database initialized/seeded for demo (users, alerts, work orders, documents, schedules).');
  await client.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
