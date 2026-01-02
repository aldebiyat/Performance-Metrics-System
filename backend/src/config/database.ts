import { Pool, PoolClient } from 'pg';
import dotenv from 'dotenv';
import logger from './logger';

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
  ssl: process.env.DB_SSL === 'true' ? {
    rejectUnauthorized: process.env.DB_SSL_REJECT_UNAUTHORIZED !== 'false',
    ca: process.env.DB_CA_CERT || undefined,
  } : false,
});

pool.on('error', (err) => {
  logger.error('Unexpected database pool error', {
    error: err.message,
    stack: err.stack
  });

  // Only exit for fatal/unrecoverable errors
  if (err.message.includes('Connection terminated') || err.message.includes('FATAL')) {
    logger.error('Fatal database error - initiating graceful shutdown');
    // Allow time for logging before exit
    setTimeout(() => process.exit(1), 1000);
  }
  // For transient errors, the pool will attempt to recover
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
