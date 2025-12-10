/* eslint-disable @typescript-eslint/no-var-requires */

exports.shorthands = undefined;

exports.up = (pgm) => {
  pgm.createTable('auth_sessions', {
    id: { type: 'uuid', primaryKey: true },
    user_id: { type: 'uuid', notNull: true, references: 'users', onDelete: 'cascade' },
    refresh_token_hash: { type: 'text', notNull: true },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
    last_used_at: { type: 'timestamptz' },
    revoked_at: { type: 'timestamptz' },
    revoked_reason: { type: 'text' },
    replaced_by: { type: 'uuid', references: 'auth_sessions' },
    expires_at: { type: 'timestamptz' },
    user_agent: { type: 'text' },
    ip: { type: 'text' },
  });

  pgm.createIndex('auth_sessions', ['user_id', { name: 'created_at', sort: 'DESC' }], {
    name: 'auth_sessions_user_idx',
  });

  pgm.createTable('password_reset_tokens', {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('uuid_generate_v4()') },
    user_id: { type: 'uuid', notNull: true, references: 'users', onDelete: 'cascade' },
    token_hash: { type: 'text', notNull: true },
    expires_at: { type: 'timestamptz', notNull: true },
    used_at: { type: 'timestamptz' },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
  });

  pgm.createIndex('password_reset_tokens', ['token_hash'], {
    unique: true,
    name: 'password_reset_tokens_token_hash_uidx',
  });
  pgm.createIndex('password_reset_tokens', ['user_id', { name: 'created_at', sort: 'DESC' }], {
    name: 'password_reset_tokens_user_idx',
  });
};

exports.down = (pgm) => {
  pgm.dropIndex('password_reset_tokens', 'password_reset_tokens_token_hash_uidx', {
    ifExists: true,
  });
  pgm.dropIndex('password_reset_tokens', 'password_reset_tokens_user_idx', { ifExists: true });
  pgm.dropTable('password_reset_tokens');

  pgm.dropIndex('auth_sessions', 'auth_sessions_user_idx', { ifExists: true });
  pgm.dropTable('auth_sessions');
};
