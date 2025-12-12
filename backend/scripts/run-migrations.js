/* eslint-disable no-console */
const path = require('path');
const { default: runMigrations } = require('node-pg-migrate');

function getArg(key) {
  const directIndex = process.argv.findIndex((arg) => arg === key);
  if (directIndex !== -1) {
    return process.argv[directIndex + 1] || null;
  }

  const withValue = process.argv.find((arg) => arg.startsWith(`${key}=`));
  if (withValue) {
    return withValue.split('=').slice(1).join('=') || null;
  }

  return null;
}

function resolveDatabaseUrl() {
  const explicit = getArg('--database-url') || getArg('--url');
  if (explicit) return explicit;

  if (process.env.MIGRATION_DATABASE_URL) return process.env.MIGRATION_DATABASE_URL;
  if (process.env.NODE_ENV === 'test' && process.env.TEST_DATABASE_URL) {
    return process.env.TEST_DATABASE_URL;
  }
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  if (process.env.TEST_DATABASE_URL) return process.env.TEST_DATABASE_URL;

  return null;
}

async function main() {
  const databaseUrl = resolveDatabaseUrl();
  if (!databaseUrl) {
    console.error(
      'Database URL not provided. Set DATABASE_URL or TEST_DATABASE_URL (or pass --database-url=<connection-string>).'
    );
    process.exit(1);
  }

  process.env.NODE_ENV = process.env.NODE_ENV || 'development';

  await runMigrations({
    databaseUrl,
    dir: path.resolve(__dirname, '../migrations'),
    direction: 'up',
    migrationsTable: 'pgmigrations',
    singleTransaction: true,
    count: Infinity,
    logger: {
      info: () => {},
      warn: (msg) => console.warn(msg),
      error: (msg) => console.error(msg),
    },
  });

  console.log('Migrations applied successfully.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
