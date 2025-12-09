import { Pool, QueryResult, QueryResultRow } from 'pg';
import { logger } from './logger';

const nodeEnv = process.env.NODE_ENV || 'development';
const isTest = nodeEnv === 'test';
const connectionString = isTest ? process.env.TEST_DATABASE_URL : process.env.DATABASE_URL;

if (isTest && !process.env.TEST_DATABASE_URL) {
  throw new Error('TEST_DATABASE_URL must be set to run integration tests');
}
if (!connectionString) {
  throw new Error('DATABASE_URL not set');
}

const pool = new Pool({ connectionString });
const log = logger.child({ module: 'db' });

export async function query<T extends QueryResultRow = QueryResultRow>(
  text: string,
  params?: unknown[]
): Promise<QueryResult<T>> {
  try {
    const result = await pool.query<T>(text, params);
    return result;
  } catch (err) {
    log.error({ err, text }, 'database query failed');
    throw err;
  }
}

export async function closePool() {
  await pool.end();
}
