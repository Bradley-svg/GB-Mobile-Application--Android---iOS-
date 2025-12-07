/* eslint-disable @typescript-eslint/no-var-requires */

exports.shorthands = undefined;

exports.up = (pgm) => {
  pgm.createTable('work_orders', {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('uuid_generate_v4()') },
    organisation_id: { type: 'uuid', notNull: true, references: 'organisations', onDelete: 'cascade' },
    site_id: { type: 'uuid', notNull: true, references: 'sites', onDelete: 'cascade' },
    device_id: { type: 'uuid', references: 'devices', onDelete: 'set null' },
    alert_id: { type: 'uuid', references: 'alerts', onDelete: 'set null' },
    title: { type: 'text', notNull: true },
    description: { type: 'text' },
    status: { type: 'varchar(32)', notNull: true, default: 'open' },
    priority: { type: 'varchar(32)', notNull: true, default: 'medium' },
    assignee_user_id: { type: 'uuid', references: 'users', onDelete: 'set null' },
    created_by_user_id: { type: 'uuid', notNull: true, references: 'users', onDelete: 'restrict' },
    due_at: { type: 'timestamptz' },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
    updated_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
  });

  pgm.createIndex('work_orders', ['organisation_id', 'status', { name: 'created_at', sort: 'DESC' }]);
  pgm.createIndex('work_orders', ['organisation_id', 'site_id', { name: 'created_at', sort: 'DESC' }]);
  pgm.createIndex('work_orders', ['organisation_id', 'device_id', { name: 'created_at', sort: 'DESC' }]);
  pgm.createIndex('work_orders', ['organisation_id', { name: 'created_at', sort: 'DESC' }]);
  pgm.createIndex('work_orders', ['organisation_id', 'alert_id']);

  pgm.createTable('work_order_tasks', {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('uuid_generate_v4()') },
    work_order_id: {
      type: 'uuid',
      notNull: true,
      references: 'work_orders',
      onDelete: 'cascade',
    },
    label: { type: 'text', notNull: true },
    is_completed: { type: 'boolean', notNull: true, default: false },
    position: { type: 'integer', notNull: true, default: 0 },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
    updated_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
  });
  pgm.createIndex('work_order_tasks', ['work_order_id', 'position']);

  pgm.createTable('work_order_attachments', {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('uuid_generate_v4()') },
    work_order_id: {
      type: 'uuid',
      notNull: true,
      references: 'work_orders',
      onDelete: 'cascade',
    },
    label: { type: 'text', notNull: true },
    url: { type: 'text', notNull: true },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
  });
  pgm.createIndex('work_order_attachments', ['work_order_id', { name: 'created_at', sort: 'DESC' }]);
};

exports.down = (pgm) => {
  pgm.dropIndex('work_order_attachments', ['work_order_id', 'created_at'], { ifExists: true });
  pgm.dropTable('work_order_attachments');
  pgm.dropIndex('work_order_tasks', ['work_order_id', 'position'], { ifExists: true });
  pgm.dropTable('work_order_tasks');
  pgm.dropIndex('work_orders', ['organisation_id', 'alert_id'], { ifExists: true });
  pgm.dropIndex('work_orders', ['organisation_id', 'created_at'], { ifExists: true });
  pgm.dropIndex('work_orders', ['organisation_id', 'device_id', 'created_at'], { ifExists: true });
  pgm.dropIndex('work_orders', ['organisation_id', 'site_id', 'created_at'], { ifExists: true });
  pgm.dropIndex('work_orders', ['organisation_id', 'status', 'created_at'], { ifExists: true });
  pgm.dropTable('work_orders');
};
