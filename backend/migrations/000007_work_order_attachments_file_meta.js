/* eslint-disable @typescript-eslint/no-var-requires */

exports.shorthands = undefined;

exports.up = (pgm) => {
  pgm.addColumns(
    'work_order_attachments',
    {
      organisation_id: { type: 'uuid', references: 'organisations', onDelete: 'cascade' },
      filename: { type: 'text' },
      original_name: { type: 'text' },
      mime_type: { type: 'text' },
      size_bytes: { type: 'integer' },
      relative_path: { type: 'text' },
      uploaded_by_user_id: { type: 'uuid', references: 'users', onDelete: 'set null' },
    },
    { ifNotExists: true }
  );

  pgm.sql(`
    update work_order_attachments w
    set organisation_id = wo.organisation_id,
        filename = coalesce(w.filename, w.label, 'file'),
        original_name = coalesce(w.original_name, w.label, 'file'),
        mime_type = coalesce(w.mime_type, 'application/octet-stream'),
        size_bytes = coalesce(w.size_bytes, 0),
        relative_path = coalesce(w.relative_path, w.url, '')
    from work_orders wo
    where w.work_order_id = wo.id
  `);

  pgm.alterColumn('work_order_attachments', 'organisation_id', { notNull: true });

  pgm.createIndex(
    'work_order_attachments',
    ['organisation_id', 'work_order_id', { name: 'created_at', sort: 'DESC' }],
    { ifNotExists: true, name: 'work_order_attachments_org_order_created_idx' }
  );

  pgm.createTable('documents', {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('uuid_generate_v4()') },
    org_id: { type: 'uuid', notNull: true, references: 'organisations', onDelete: 'cascade' },
    site_id: { type: 'uuid', references: 'sites', onDelete: 'set null' },
    device_id: { type: 'uuid', references: 'devices', onDelete: 'set null' },
    title: { type: 'text', notNull: true },
    category: { type: 'varchar(64)', notNull: true, default: 'other' },
    description: { type: 'text' },
    filename: { type: 'text', notNull: true },
    original_name: { type: 'text', notNull: true },
    mime_type: { type: 'text' },
    size_bytes: { type: 'integer' },
    relative_path: { type: 'text', notNull: true },
    uploaded_by_user_id: { type: 'uuid', references: 'users', onDelete: 'set null' },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
  });

  pgm.addConstraint(
    'documents',
    'documents_site_or_device',
    'check ((site_id is not null) or (device_id is not null))'
  );
  pgm.createIndex(
    'documents',
    ['org_id', 'site_id', { name: 'created_at', sort: 'DESC' }],
    { ifNotExists: true, name: 'documents_site_idx' }
  );
  pgm.createIndex(
    'documents',
    ['org_id', 'device_id', { name: 'created_at', sort: 'DESC' }],
    { ifNotExists: true, name: 'documents_device_idx' }
  );
};

exports.down = (pgm) => {
  pgm.dropIndex('documents', ['org_id', 'device_id', 'created_at'], { ifExists: true, name: 'documents_device_idx' });
  pgm.dropIndex('documents', ['org_id', 'site_id', 'created_at'], { ifExists: true, name: 'documents_site_idx' });
  pgm.dropConstraint('documents', 'documents_site_or_device', { ifExists: true });
  pgm.dropTable('documents', { ifExists: true });

  pgm.dropIndex('work_order_attachments', ['organisation_id', 'work_order_id', 'created_at'], {
    ifExists: true,
    name: 'work_order_attachments_org_order_created_idx',
  });
  pgm.dropColumn('work_order_attachments', 'uploaded_by_user_id', { ifExists: true });
  pgm.dropColumn('work_order_attachments', 'relative_path', { ifExists: true });
  pgm.dropColumn('work_order_attachments', 'size_bytes', { ifExists: true });
  pgm.dropColumn('work_order_attachments', 'mime_type', { ifExists: true });
  pgm.dropColumn('work_order_attachments', 'original_name', { ifExists: true });
  pgm.dropColumn('work_order_attachments', 'filename', { ifExists: true });
  pgm.dropColumn('work_order_attachments', 'organisation_id', { ifExists: true });
};
