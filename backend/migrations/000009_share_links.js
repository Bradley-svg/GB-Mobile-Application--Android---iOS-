/* eslint-disable @typescript-eslint/no-var-requires */

exports.shorthands = undefined;

const SCOPE_CHECK = 'share_links_scope_type_check';

exports.up = (pgm) => {
  pgm.createTable('share_links', {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('uuid_generate_v4()') },
    org_id: { type: 'uuid', notNull: true, references: 'organisations', onDelete: 'cascade' },
    created_by_user_id: { type: 'uuid', notNull: true, references: 'users', onDelete: 'cascade' },
    scope_type: { type: 'text', notNull: true },
    scope_id: { type: 'uuid', notNull: true },
    token: { type: 'text', notNull: true, unique: true },
    permissions: { type: 'text', notNull: true, default: 'read_only' },
    expires_at: { type: 'timestamptz', notNull: true },
    revoked_at: { type: 'timestamptz' },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
  });

  pgm.addConstraint('share_links', SCOPE_CHECK, {
    check: "scope_type in ('site', 'device')",
  });

  pgm.createIndex('share_links', ['org_id', 'scope_type', 'scope_id'], {
    name: 'share_links_scope_idx',
  });
  pgm.createIndex('share_links', ['token'], { name: 'share_links_token_idx', unique: true });
};

exports.down = (pgm) => {
  pgm.dropIndex('share_links', 'share_links_token_idx', { ifExists: true });
  pgm.dropIndex('share_links', 'share_links_scope_idx', { ifExists: true });
  pgm.dropConstraint('share_links', SCOPE_CHECK, { ifExists: true });
  pgm.dropTable('share_links');
};
