exports.shorthands = undefined;

exports.up = (pgm) => {
  pgm.createTable('worker_locks', {
    name: { type: 'text', primaryKey: true },
    owner_id: { type: 'text', notNull: true },
    locked_at: { type: 'timestamptz', notNull: true },
    expires_at: { type: 'timestamptz', notNull: true },
  });
};

exports.down = (pgm) => {
  pgm.dropTable('worker_locks');
};
