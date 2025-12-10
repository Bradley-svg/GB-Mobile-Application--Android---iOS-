import { performance } from 'node:perf_hooks';
import { Pool, QueryResult, QueryResultRow } from 'pg';
import { logger } from './logger';
import { getRequestContext } from './requestContext';

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
const SLOW_QUERY_DEFAULT_MS = 500;
const slowQueryThresholdMs = resolveSlowQueryThreshold();

export async function query<T extends QueryResultRow = QueryResultRow>(
  text: string,
  params?: unknown[]
): Promise<QueryResult<T>> {
  const startedAt = performance.now();
  try {
    const result = await pool.query<T>(text, params);
    const durationMs = performance.now() - startedAt;
    maybeLogSlowQuery(durationMs, text, result.rowCount);
    return result;
  } catch (err) {
    const durationMs = performance.now() - startedAt;
    log.error({ err, text: summarizeQuery(text), durationMs }, 'database query failed');
    throw err;
  }
}

export async function closePool() {
  await pool.end();
}

function resolveSlowQueryThreshold(): number | null {
  const raw = process.env.DB_SLOW_QUERY_MS;
  if (!raw) return SLOW_QUERY_DEFAULT_MS;

  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    log.warn(
      { raw, fallbackMs: SLOW_QUERY_DEFAULT_MS },
      'invalid DB_SLOW_QUERY_MS; falling back to default'
    );
    return SLOW_QUERY_DEFAULT_MS;
  }

  return parsed;
}

function summarizeQuery(text: string) {
  const normalized = text.replace(/\s+/g, ' ').trim();
  const limit = 500;
  return normalized.length > limit ? `${normalized.slice(0, limit)}...` : normalized;
}

function maybeLogSlowQuery(durationMs: number, text: string, rowCount?: number | null) {
  if (!slowQueryThresholdMs) return;
  if (durationMs < slowQueryThresholdMs) return;

  const requestId = getRequestContext()?.requestId;
  log.warn(
    {
      durationMs,
      thresholdMs: slowQueryThresholdMs,
      rowCount: rowCount ?? null,
      requestId,
      text: summarizeQuery(text),
    },
    'slow query detected'
  );
}
