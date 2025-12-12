/* eslint-disable @typescript-eslint/no-var-requires */

exports.shorthands = undefined;

exports.up = (pgm) => {
  pgm.addColumns('organisations', {
    is_demo: { type: 'boolean', notNull: true, default: false },
    demo_seeded_at: { type: 'timestamptz' },
  });

  pgm.addColumns('devices', {
    is_demo: { type: 'boolean', notNull: true, default: false },
    is_demo_hero: { type: 'boolean', notNull: true, default: false },
  });
};

exports.down = (pgm) => {
  pgm.dropColumns('devices', ['is_demo', 'is_demo_hero']);
  pgm.dropColumns('organisations', ['is_demo', 'demo_seeded_at']);
};
