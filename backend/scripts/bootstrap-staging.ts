import { execSync } from 'node:child_process';

type Summary = {
  stage: string;
  db: string;
  migrations: string;
  seed: string;
};

function fail(message: string): never {
  console.error(`\n[staging:bootstrap] ${message}\n`);
  process.exit(1);
}

function ensureStagingUrl(url: string | undefined): string {
  if (!url) {
    fail('STAGING_DATABASE_URL is required (postgres://<user>:<pass>@<host>:<port>/greenbro_staging).');
  }

  const lower = url.toLowerCase();
  if (!lower.includes('staging')) {
    fail('Refusing to run because STAGING_DATABASE_URL does not look like a staging database (expected name to contain "staging").');
  }

  return url;
}

function run(command: string, env: NodeJS.ProcessEnv, label: string) {
  try {
    execSync(command, { stdio: 'inherit', env });
  } catch (error) {
    const reason = (error as Error).message || 'unknown error';
    fail(`Failed to ${label}. ${reason}`);
  }
}

function main() {
  const stagingDatabaseUrl = ensureStagingUrl(process.env.STAGING_DATABASE_URL);
  const env = { ...process.env, DATABASE_URL: stagingDatabaseUrl };

  const summary: Summary = {
    stage: 'staging',
    db: 'ok',
    migrations: 'pending',
    seed: 'pending',
  };

  console.log(`Applying migrations to staging database at ${stagingDatabaseUrl}`);
  run('npm run migrate:dev', env, 'apply migrations');
  summary.migrations = 'applied';

  console.log('Seeding staging database with demo data...');
  run('npm run seed:demo -- --reset', env, 'seed staging database');
  summary.seed = 'ok';

  console.log(JSON.stringify(summary, null, 2));
}

main();
