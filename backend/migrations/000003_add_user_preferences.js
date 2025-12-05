exports.shorthands = undefined;

exports.up = (pgm) => {
  pgm.createTable('user_preferences', {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    user_id: { type: 'uuid', notNull: true, references: 'users', onDelete: 'cascade' },
    alerts_enabled: { type: 'boolean', notNull: true, default: true },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
    updated_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
  });

  pgm.createIndex('user_preferences', 'user_id', { unique: true, name: 'user_preferences_user_uidx' });
};

exports.down = (pgm) => {
  pgm.dropIndex('user_preferences', 'user_id', { ifExists: true, name: 'user_preferences_user_uidx' });
  pgm.dropTable('user_preferences');
};
