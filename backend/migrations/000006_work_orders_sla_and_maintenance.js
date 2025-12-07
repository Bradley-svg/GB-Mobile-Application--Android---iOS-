/* eslint-disable @typescript-eslint/no-var-requires */

exports.shorthands = undefined;

exports.up = (pgm) => {
  pgm.addColumns(
    'work_orders',
    {
      sla_due_at: { type: 'timestamptz' },
      resolved_at: { type: 'timestamptz' },
      sla_breached: { type: 'boolean', notNull: true, default: false },
      reminder_at: { type: 'timestamptz' },
      category: { type: 'varchar(64)' },
    },
    { ifNotExists: true }
  );

  pgm.createIndex('work_orders', ['organisation_id', { name: 'sla_due_at', sort: 'ASC' }], {
    ifNotExists: true,
    name: 'work_orders_org_sla_due_at_idx',
  });
};

exports.down = (pgm) => {
  pgm.dropIndex('work_orders', ['organisation_id', 'sla_due_at'], {
    ifExists: true,
    name: 'work_orders_org_sla_due_at_idx',
  });
  pgm.dropColumn('work_orders', 'category', { ifExists: true });
  pgm.dropColumn('work_orders', 'reminder_at', { ifExists: true });
  pgm.dropColumn('work_orders', 'sla_breached', { ifExists: true });
  pgm.dropColumn('work_orders', 'resolved_at', { ifExists: true });
  pgm.dropColumn('work_orders', 'sla_due_at', { ifExists: true });
};
