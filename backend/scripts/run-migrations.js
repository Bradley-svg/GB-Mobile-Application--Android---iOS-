/* eslint-disable no-console */
const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');
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

function loadEnvIfMissing() {
  const hasDbVars =
    process.env.MIGRATION_DATABASE_URL || process.env.DATABASE_URL || process.env.TEST_DATABASE_URL;

  if (hasDbVars) {
    return;
  }

  const envPath = path.resolve(__dirname, '../.env');
  if (!fs.existsSync(envPath)) {
    console.warn(`No DATABASE_URL/TEST_DATABASE_URL set and .env not found at ${envPath}.`);
    return;
  }

  dotenv.config({ path: envPath });
  console.log(`Loaded environment from ${envPath}.`);
}

async function main() {
  loadEnvIfMissing();
  const databaseUrl = resolveDatabaseUrl();
  if (!databaseUrl) {
    console.error(
      'Database URL not provided. Set DATABASE_URL or TEST_DATABASE_URL (or pass --database-url=<connection-string>). Copy backend/.env.example to backend/.env if you have not already.'
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
