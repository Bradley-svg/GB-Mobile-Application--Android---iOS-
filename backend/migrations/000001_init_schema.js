/* eslint-disable @typescript-eslint/no-var-requires */

const DEFAULT_ORG_ID = '11111111-1111-1111-1111-111111111111';

exports.shorthands = undefined;

exports.up = (pgm) => {
  pgm.createExtension('uuid-ossp', { ifNotExists: true });
  pgm.createExtension('pgcrypto', { ifNotExists: true });

  pgm.createTable('organisations', {
    id: { type: 'uuid', primaryKey: true },
    name: { type: 'text', notNull: true },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
  });

  pgm.createTable('users', {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('uuid_generate_v4()') },
    organisation_id: {
      type: 'uuid',
      notNull: true,
      references: 'organisations',
      default: DEFAULT_ORG_ID,
    },
    email: { type: 'text', notNull: true, unique: true },
    password_hash: { type: 'text', notNull: true },
    name: { type: 'text', notNull: true },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
  });

  pgm.createTable('refresh_tokens', {
    id: { type: 'uuid', primaryKey: true },
    user_id: { type: 'uuid', notNull: true, references: 'users', onDelete: 'cascade' },
    revoked: { type: 'boolean', notNull: true, default: false },
    revoked_reason: { type: 'text' },
    revoked_at: { type: 'timestamptz' },
    replaced_by: { type: 'uuid', references: 'refresh_tokens' },
    expires_at: { type: 'timestamptz' },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
  });
  pgm.createIndex('refresh_tokens', ['user_id', { name: 'created_at', sort: 'DESC' }], {
    name: 'refresh_tokens_user_idx',
  });

  pgm.createTable('push_tokens', {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('uuid_generate_v4()') },
    user_id: { type: 'uuid', notNull: true, references: 'users', onDelete: 'cascade' },
    expo_token: { type: 'text', notNull: true },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
    last_used_at: { type: 'timestamptz' },
  });
  pgm.createIndex('push_tokens', ['user_id', 'expo_token'], {
    unique: true,
    name: 'push_tokens_user_token_uidx',
  });

  pgm.createTable('sites', {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('uuid_generate_v4()') },
    organisation_id: {
      type: 'uuid',
      notNull: true,
      references: 'organisations',
      default: DEFAULT_ORG_ID,
    },
    name: { type: 'text', notNull: true },
    city: { type: 'text' },
    status: { type: 'text', default: 'healthy' },
    last_seen_at: { type: 'timestamptz', default: pgm.func('now()') },
    online_devices: { type: 'integer', default: 0 },
    device_count_online: { type: 'integer', default: 0 },
    external_id: { type: 'text' },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
  });

  pgm.createTable('devices', {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('uuid_generate_v4()') },
    site_id: { type: 'uuid', notNull: true, references: 'sites', onDelete: 'cascade' },
    name: { type: 'text', notNull: true },
    type: { type: 'text', default: 'heat_pump' },
    external_id: { type: 'text' },
    mac: { type: 'text' },
    status: { type: 'text', default: 'online' },
    last_seen_at: { type: 'timestamptz', default: pgm.func('now()') },
    controller: { type: 'text' },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
  });

  pgm.createTable('telemetry_points', {
    id: 'bigserial',
    device_id: { type: 'uuid', notNull: true, references: 'devices', onDelete: 'cascade' },
    metric: { type: 'text', notNull: true },
    ts: { type: 'timestamptz', notNull: true },
    value: { type: 'double precision', notNull: true },
    quality: { type: 'text' },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
  });
  pgm.createIndex('telemetry_points', ['device_id', 'metric', { name: 'ts', sort: 'DESC' }], {
    name: 'telemetry_points_device_metric_ts_idx',
  });

  pgm.createTable('device_snapshots', {
    device_id: { type: 'uuid', primaryKey: true, references: 'devices', onDelete: 'cascade' },
    last_seen_at: { type: 'timestamptz', notNull: true },
    data: { type: 'jsonb', notNull: true },
    updated_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
  });

  pgm.createTable('alerts', {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('uuid_generate_v4()') },
    site_id: { type: 'uuid', references: 'sites' },
    device_id: { type: 'uuid', references: 'devices' },
    severity: { type: 'text', notNull: true },
    type: { type: 'text', notNull: true },
    message: { type: 'text', notNull: true },
    status: { type: 'text', notNull: true },
    first_seen_at: { type: 'timestamptz', notNull: true },
    last_seen_at: { type: 'timestamptz', notNull: true },
    acknowledged_by: { type: 'uuid', references: 'users' },
    acknowledged_at: { type: 'timestamptz' },
    muted_until: { type: 'timestamptz' },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
  });
  pgm.createIndex('alerts', ['device_id', 'status'], { name: 'alerts_device_status_idx' });
  pgm.createIndex('alerts', ['site_id', 'status'], { name: 'alerts_site_status_idx' });
  pgm.createIndex('alerts', ['status', 'severity'], { name: 'alerts_status_severity_idx' });

  pgm.createTable('control_commands', {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('uuid_generate_v4()') },
    device_id: { type: 'uuid', notNull: true, references: 'devices', onDelete: 'cascade' },
    user_id: { type: 'uuid', notNull: true, references: 'users' },
    command_type: { type: 'text', notNull: true },
    payload: { type: 'jsonb', notNull: true },
    requested_value: { type: 'jsonb' },
    status: { type: 'text', notNull: true },
    requested_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
    completed_at: { type: 'timestamptz' },
    error_message: { type: 'text' },
    failure_reason: { type: 'text' },
    failure_message: { type: 'text' },
    source: { type: 'text', default: 'unknown' },
  });
  pgm.createIndex('control_commands', ['device_id', { name: 'requested_at', sort: 'DESC' }], {
    name: 'control_commands_device_idx',
  });

  pgm.createTable('system_status', {
    key: { type: 'text', primaryKey: true },
    payload: { type: 'jsonb', notNull: true, default: pgm.func(`'{}'::jsonb`) },
    mqtt_last_ingest_at: { type: 'timestamptz' },
    mqtt_last_error_at: { type: 'timestamptz' },
    mqtt_last_error: { type: 'text' },
    control_last_command_at: { type: 'timestamptz' },
    control_last_error_at: { type: 'timestamptz' },
    control_last_error: { type: 'text' },
    alerts_worker_last_heartbeat_at: { type: 'timestamptz' },
    push_last_sample_at: { type: 'timestamptz' },
    push_last_error: { type: 'text' },
    heat_pump_history_last_success_at: { type: 'timestamptz' },
    heat_pump_history_last_error_at: { type: 'timestamptz' },
    heat_pump_history_last_error: { type: 'text' },
    updated_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
  });

  pgm.sql(
    `
    insert into organisations (id, name, created_at)
    values ('${DEFAULT_ORG_ID}', 'Greenbro Demo Org', now())
    on conflict (id) do nothing
  `
  );
};

exports.down = (pgm) => {
  pgm.dropTable('system_status');
  pgm.dropTable('control_commands');
  pgm.dropTable('alerts');
  pgm.dropTable('device_snapshots');
  pgm.dropIndex('telemetry_points', 'telemetry_points_device_metric_ts_idx', { ifExists: true });
  pgm.dropTable('telemetry_points');
  pgm.dropIndex('push_tokens', 'push_tokens_user_token_uidx', { ifExists: true });
  pgm.dropTable('push_tokens');
  pgm.dropIndex('refresh_tokens', 'refresh_tokens_user_idx', { ifExists: true });
  pgm.dropTable('refresh_tokens');
  pgm.dropTable('devices');
  pgm.dropTable('sites');
  pgm.dropTable('users');
  pgm.dropTable('organisations');

  pgm.dropExtension('pgcrypto', { ifExists: true });
  pgm.dropExtension('uuid-ossp', { ifExists: true });
};
