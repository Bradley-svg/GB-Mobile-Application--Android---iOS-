/* eslint-disable @typescript-eslint/no-var-requires */

exports.shorthands = undefined;

exports.up = (pgm) => {
  pgm.addColumn('users', {
    two_factor_enabled: { type: 'boolean', notNull: true, default: false },
    two_factor_secret: { type: 'text' },
    two_factor_temp_secret: { type: 'text' },
  });
};

exports.down = (pgm) => {
  pgm.dropColumns('users', ['two_factor_enabled', 'two_factor_secret', 'two_factor_temp_secret'], {
    ifExists: true,
  });
};
