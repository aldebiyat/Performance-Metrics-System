import { Pool, PoolClient } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME || 'performance_metrics',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || '',
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

pool.on('error', (err) => {
  console.error('Unexpected error on idle client', err);
  process.exit(-1);
});

type QueryParam = string | number | boolean | null | Date | Buffer | object | unknown;

export const query = async (text: string, params?: QueryParam[]) => {
  const start = Date.now();
  const res = await pool.query(text, params);
  const duration = Date.now() - start;
  if (process.env.NODE_ENV === 'development') {
    console.log('Executed query', { text: text.substring(0, 50), duration, rows: res.rowCount });
  }
  return res;
};

export const getClient = () => pool.connect();

/**
 * Creates a query function bound to a specific client for use within transactions.
 * This allows queries to participate in the transaction using the client's connection.
 */
export const createTransactionalQuery = (client: PoolClient) => {
  return async (text: string, params?: QueryParam[]) => {
    const start = Date.now();
    const res = await client.query(text, params);
    const duration = Date.now() - start;
    if (process.env.NODE_ENV === 'development') {
      console.log('Executed transactional query', { text: text.substring(0, 50), duration, rows: res.rowCount });
    }
    return res;
  };
};

/**
 * Executes a callback function within a database transaction.
 * - Gets a client from the pool
 * - Runs BEGIN
 * - Calls the callback with the client
 * - Runs COMMIT on success
 * - Runs ROLLBACK on error
 * - Always releases the client back to the pool
 */
export const withTransaction = async <T>(
  callback: (client: PoolClient) => Promise<T>
): Promise<T> => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};

export default pool;
