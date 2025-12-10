/* eslint-disable @typescript-eslint/no-var-requires */

exports.shorthands = undefined;

exports.up = (pgm) => {
  // Work orders: org + site/status filters with recency sort when listing.
  pgm.createIndex(
    'work_orders',
    ['organisation_id', 'site_id', 'status', { name: 'created_at', sort: 'DESC' }],
    { name: 'work_orders_site_status_idx', ifNotExists: true }
  );
  pgm.sql(
    "comment on index work_orders_site_status_idx is 'Hot path for site-scoped work order listings filtered by status and sorted by creation time'"
  );

  // Work orders: assignee dashboards often filter by user + status + recency.
  pgm.createIndex(
    'work_orders',
    ['organisation_id', 'assignee_user_id', 'status', { name: 'created_at', sort: 'DESC' }],
    { name: 'work_orders_assignee_status_idx', ifNotExists: true }
  );
  pgm.sql(
    "comment on index work_orders_assignee_status_idx is 'Supports assignee-based work order queues filtered by status with newest first'"
  );

  // Work orders: maintenance windows filter open/in_progress by SLA due date.
  pgm.createIndex(
    'work_orders',
    ['organisation_id', 'status', { name: 'sla_due_at', sort: 'ASC' }],
    { name: 'work_orders_status_sla_due_idx', ifNotExists: true }
  );
  pgm.sql(
    "comment on index work_orders_status_sla_due_idx is 'Speeds SLA/maintenance calculations over open work orders ordered by SLA due date'"
  );

  // Alerts: device timelines and recency filtered by status.
  pgm.createIndex(
    'alerts',
    ['device_id', 'status', { name: 'last_seen_at', sort: 'DESC' }],
    { name: 'alerts_device_status_last_seen_idx', ifNotExists: true }
  );
  pgm.sql(
    "comment on index alerts_device_status_last_seen_idx is 'Optimizes fetching device alerts by status sorted by most recent activity'"
  );

  // Alerts: severity dashboards by status + severity ordered by recency.
  pgm.createIndex(
    'alerts',
    ['status', 'severity', { name: 'last_seen_at', sort: 'DESC' }],
    { name: 'alerts_status_severity_last_seen_idx', ifNotExists: true }
  );
  pgm.sql(
    "comment on index alerts_status_severity_last_seen_idx is 'Speeds severity/status alert listings ordered by last_seen_at'"
  );

  // Alerts: site-scoped alert feeds by status with newest first.
  pgm.createIndex(
    'alerts',
    ['site_id', 'status', { name: 'last_seen_at', sort: 'DESC' }],
    { name: 'alerts_site_status_last_seen_idx', ifNotExists: true }
  );
  pgm.sql(
    "comment on index alerts_site_status_last_seen_idx is 'Accelerates site-level alert streams filtered by status and ordered by recency'"
  );

  // Telemetry/history: range scans by device and timestamp.
  pgm.createIndex(
    'telemetry_points',
    ['device_id', { name: 'ts', sort: 'DESC' }],
    { name: 'telemetry_points_device_ts_idx', ifNotExists: true }
  );
  pgm.sql(
    "comment on index telemetry_points_device_ts_idx is 'Supports device telemetry history range scans by device_id + timestamp'"
  );
};

exports.down = (pgm) => {
  pgm.dropIndex('telemetry_points', ['device_id', 'ts'], {
    name: 'telemetry_points_device_ts_idx',
    ifExists: true,
  });
  pgm.dropIndex('alerts', ['site_id', 'status', 'last_seen_at'], {
    name: 'alerts_site_status_last_seen_idx',
    ifExists: true,
  });
  pgm.dropIndex('alerts', ['status', 'severity', 'last_seen_at'], {
    name: 'alerts_status_severity_last_seen_idx',
    ifExists: true,
  });
  pgm.dropIndex('alerts', ['device_id', 'status', 'last_seen_at'], {
    name: 'alerts_device_status_last_seen_idx',
    ifExists: true,
  });
  pgm.dropIndex('work_orders', ['organisation_id', 'status', 'sla_due_at'], {
    name: 'work_orders_status_sla_due_idx',
    ifExists: true,
  });
  pgm.dropIndex('work_orders', ['organisation_id', 'assignee_user_id', 'status', 'created_at'], {
    name: 'work_orders_assignee_status_idx',
    ifExists: true,
  });
  pgm.dropIndex('work_orders', ['organisation_id', 'site_id', 'status', 'created_at'], {
    name: 'work_orders_site_status_idx',
    ifExists: true,
  });
};
