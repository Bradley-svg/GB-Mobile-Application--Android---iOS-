/* eslint-disable @typescript-eslint/no-var-requires */

const DEFAULT_ORG_ID = '11111111-1111-1111-1111-111111111111';

exports.shorthands = undefined;

exports.up = (pgm) => {
  pgm.createTable('alert_rules', {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('uuid_generate_v4()') },
    org_id: { type: 'uuid', notNull: true, references: 'organisations' },
    site_id: { type: 'uuid', references: 'sites', onDelete: 'cascade' },
    device_id: { type: 'uuid', references: 'devices', onDelete: 'cascade' },
    metric: { type: 'text', notNull: true },
    rule_type: { type: 'text', notNull: true }, // threshold_above | threshold_below | rate_of_change | offline_window | composite
    threshold: { type: 'double precision' },
    roc_window_sec: { type: 'integer' },
    offline_grace_sec: { type: 'integer' },
    enabled: { type: 'boolean', notNull: true, default: true },
    severity: { type: 'text', notNull: true, default: 'warning' }, // warning | critical
    snooze_default_sec: { type: 'integer' },
    name: { type: 'text' },
    description: { type: 'text' },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
    updated_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
  });
  pgm.createIndex('alert_rules', ['org_id', 'enabled']);
  pgm.createIndex('alert_rules', ['site_id']);
  pgm.createIndex('alert_rules', ['device_id']);

  pgm.addColumns('alerts', {
    rule_id: { type: 'uuid', references: 'alert_rules', onDelete: 'set null' },
  });
  pgm.createIndex('alerts', ['rule_id']);

  pgm.createTable('site_schedules', {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('uuid_generate_v4()') },
    site_id: { type: 'uuid', notNull: true, references: 'sites', onDelete: 'cascade' },
    day_of_week: { type: 'integer', notNull: true }, // 0 (Sunday) - 6 (Saturday)
    start_time_local: { type: 'time', notNull: true },
    end_time_local: { type: 'time', notNull: true },
    kind: { type: 'text', notNull: true }, // load_shedding | tou_peak | tou_offpeak
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
    updated_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
  });
  pgm.createIndex('site_schedules', ['site_id', 'day_of_week']);

  pgm.createTable('device_schedules', {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('uuid_generate_v4()') },
    device_id: { type: 'uuid', notNull: true, references: 'devices', onDelete: 'cascade' },
    name: { type: 'text', notNull: true, default: 'Daily schedule' },
    enabled: { type: 'boolean', notNull: true, default: true },
    start_hour: { type: 'integer', notNull: true },
    end_hour: { type: 'integer', notNull: true },
    target_setpoint: { type: 'double precision', notNull: true },
    target_mode: { type: 'text', notNull: true },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
    updated_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
  });
  pgm.addConstraint('device_schedules', 'device_schedules_device_unique', {
    unique: ['device_id'],
  });
  pgm.createIndex('device_schedules', ['device_id']);

  pgm.addColumns('devices', {
    firmware_version: { type: 'text' },
    connectivity_status: { type: 'text' },
  });
  pgm.createIndex('devices', ['connectivity_status']);

  // Seed a minimal set of default rules for the demo org to preserve baseline behaviour.
  pgm.sql(
    `
    insert into alert_rules (org_id, site_id, device_id, metric, rule_type, threshold, offline_grace_sec, enabled, severity, snooze_default_sec, name, description)
    values
      ('${DEFAULT_ORG_ID}', null, null, 'supply_temp', 'threshold_above', coalesce(nullif(current_setting('alert_high_temp_threshold', true), '')::double precision, 60), null, true, 'critical', 3600, 'High supply temperature', 'Raises a critical alert when supply temperature exceeds the configured limit.'),
      ('${DEFAULT_ORG_ID}', null, null, 'connectivity', 'offline_window', null, coalesce(nullif(current_setting('alert_offline_minutes', true), '')::integer, 10) * 60, true, 'warning', 3600, 'Device offline', 'Warns when device has been offline beyond the grace period.')
    on conflict do nothing
  `
  );
};

exports.down = (pgm) => {
  pgm.dropIndex('devices', ['connectivity_status'], { ifExists: true });
  pgm.dropColumns('devices', ['firmware_version', 'connectivity_status']);

  pgm.dropTable('device_schedules');
  pgm.dropTable('site_schedules');

  pgm.dropIndex('alerts', ['rule_id'], { ifExists: true });
  pgm.dropColumns('alerts', ['rule_id']);

  pgm.dropTable('alert_rules');
};
