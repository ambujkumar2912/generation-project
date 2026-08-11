import { Pool, QueryResultRow } from 'pg';
import { env } from '../config/env';

export const pool = new Pool({
  connectionString: env.databaseUrl,
});

pool.on('error', (err) => {
  // eslint-disable-next-line no-console
  console.error('Unexpected error on idle Postgres client', err);
  process.exit(1);
});

export async function query<T extends QueryResultRow = QueryResultRow>(text: string, params?: unknown[]) {
  const result = await pool.query<T>(text, params);
  return result;
}
