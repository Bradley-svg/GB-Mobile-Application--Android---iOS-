import { Pool, QueryResult } from 'pg';

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error('DATABASE_URL not set');
}

const pool = new Pool({ connectionString });

export async function query<T = any>(text: string, params?: any[]): Promise<QueryResult<T>> {
  try {
    const result = await pool.query<T>(text, params);
    return result;
  } catch (err) {
    console.error('DB error:', err);
    throw err;
  }
}
