/* eslint-disable @typescript-eslint/no-var-requires */

exports.shorthands = undefined;

const ROLE_CONSTRAINT = 'users_role_check';
const ROLE_ENUM_VALUES = ["'owner'", "'admin'", "'facilities'", "'contractor'"].join(', ');

exports.up = (pgm) => {
  pgm.addColumn('users', {
    role: { type: 'text', notNull: true, default: 'facilities' },
    can_impersonate: { type: 'boolean', notNull: true, default: false },
  });

  pgm.sql(`
    alter table users
    add constraint ${ROLE_CONSTRAINT}
    check (role in (${ROLE_ENUM_VALUES}));
  `);
};

exports.down = (pgm) => {
  pgm.sql(`alter table users drop constraint if exists ${ROLE_CONSTRAINT};`);
  pgm.dropColumns('users', ['role', 'can_impersonate']);
};
