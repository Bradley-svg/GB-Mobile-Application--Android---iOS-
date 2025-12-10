/* eslint-disable @typescript-eslint/no-var-requires */

exports.shorthands = undefined;

exports.up = (pgm) => {
  pgm.createTable('auth_device_push_tokens', {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('uuid_generate_v4()') },
    user_id: { type: 'uuid', notNull: true, references: 'users', onDelete: 'cascade' },
    org_id: { type: 'uuid', notNull: true, references: 'organisations', onDelete: 'cascade' },
    expo_push_token: { type: 'text', notNull: true },
    platform: { type: 'text', notNull: true, default: 'unknown' },
    is_active: { type: 'boolean', notNull: true, default: true },
    last_used_at: { type: 'timestamptz' },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
    updated_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
  });

  pgm.createIndex('auth_device_push_tokens', ['user_id'], {
    name: 'auth_device_push_tokens_user_idx',
  });
  pgm.createIndex('auth_device_push_tokens', ['org_id'], {
    name: 'auth_device_push_tokens_org_idx',
  });
  pgm.createIndex('auth_device_push_tokens', ['expo_push_token'], {
    name: 'auth_device_push_tokens_token_uidx',
    unique: true,
  });

  pgm.sql(`
    insert into auth_device_push_tokens (
      id,
      user_id,
      org_id,
      expo_push_token,
      platform,
      is_active,
      created_at,
      updated_at,
      last_used_at
    )
    select
      uuid_generate_v4(),
      pt.user_id,
      u.organisation_id,
      pt.expo_token,
      'unknown',
      true,
      pt.created_at,
      pt.created_at,
      pt.last_used_at
    from push_tokens pt
    join users u on u.id = pt.user_id
    on conflict (expo_push_token) do nothing
  `);
};

exports.down = (pgm) => {
  pgm.dropIndex('auth_device_push_tokens', 'auth_device_push_tokens_token_uidx', {
    ifExists: true,
  });
  pgm.dropIndex('auth_device_push_tokens', 'auth_device_push_tokens_org_idx', {
    ifExists: true,
  });
  pgm.dropIndex('auth_device_push_tokens', 'auth_device_push_tokens_user_idx', {
    ifExists: true,
  });
  pgm.dropTable('auth_device_push_tokens', { ifExists: true });
};
