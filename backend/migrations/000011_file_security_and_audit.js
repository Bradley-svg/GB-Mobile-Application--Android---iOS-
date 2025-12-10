/* eslint-disable @typescript-eslint/no-var-requires */

exports.shorthands = undefined;

const FILE_STATUS_ENUM = ['clean', 'infected', 'scan_failed'];

exports.up = (pgm) => {
  pgm.addColumns(
    'documents',
    {
      file_status: { type: 'text', notNull: true, default: 'clean' },
    },
    { ifNotExists: true }
  );
  pgm.addColumns(
    'work_order_attachments',
    {
      file_status: { type: 'text', notNull: true, default: 'clean' },
    },
    { ifNotExists: true }
  );

  pgm.addConstraint('documents', 'documents_file_status_check', {
    check: `file_status in (${FILE_STATUS_ENUM.map((v) => `'${v}'`).join(', ')})`,
  });
  pgm.addConstraint('work_order_attachments', 'wo_attachments_file_status_check', {
    check: `file_status in (${FILE_STATUS_ENUM.map((v) => `'${v}'`).join(', ')})`,
  });

  pgm.createTable('audit_events', {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('uuid_generate_v4()') },
    org_id: { type: 'uuid', notNull: true, references: 'organisations', onDelete: 'cascade' },
    user_id: { type: 'uuid', references: 'users', onDelete: 'set null' },
    action: { type: 'text', notNull: true },
    entity_type: { type: 'text', notNull: true },
    entity_id: { type: 'text', notNull: true },
    metadata: { type: 'jsonb', notNull: true, default: pgm.func(`'{}'::jsonb`) },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
  });
  pgm.createIndex('audit_events', ['org_id', { name: 'created_at', sort: 'DESC' }], {
    name: 'audit_events_org_created_idx',
  });
};

exports.down = (pgm) => {
  pgm.dropIndex('audit_events', ['org_id', 'created_at'], {
    ifExists: true,
    name: 'audit_events_org_created_idx',
  });
  pgm.dropTable('audit_events', { ifExists: true });

  pgm.dropConstraint('work_order_attachments', 'wo_attachments_file_status_check', { ifExists: true });
  pgm.dropConstraint('documents', 'documents_file_status_check', { ifExists: true });

  pgm.dropColumn('work_order_attachments', 'file_status', { ifExists: true });
  pgm.dropColumn('documents', 'file_status', { ifExists: true });
};
