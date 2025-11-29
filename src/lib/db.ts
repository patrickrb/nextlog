import { Pool, PoolClient, QueryResult } from 'pg';
import { logger } from './logger';

// Global connection pool
let pool: Pool;

/**
 * Get or create the database connection pool
 */
function getPool(): Pool {
  if (!pool) {
    const sslConfig = process.env.DATABASE_SSL === 'true'
      ? { rejectUnauthorized: false }
      : false;

    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: sslConfig,
      max: 20, // Maximum number of clients in the pool
      idleTimeoutMillis: 60000, // Close idle clients after 60 seconds
      connectionTimeoutMillis: 10000, // Return an error after 10 seconds if connection could not be established
      query_timeout: 30000, // Query timeout: 30 seconds
      statement_timeout: 30000, // Statement timeout: 30 seconds
    });

    // Handle pool errors
    pool.on('error', (err) => {
      logger.error('Unexpected error on idle client', err);
    });

    logger.info('Database connection pool initialized');
  }

  return pool;
}


/**
 * Execute a query using the connection pool
 */
export async function query(text: string, params?: unknown[]): Promise<QueryResult> {
  const pool = getPool();
  const start = Date.now();

  try {
    const result = await pool.query(text, params);
    const duration = Date.now() - start;

    // Log slow queries (> 100ms)
    if (duration > 100) {
      logger.slowQuery(duration, text, params);
    }

    return result;
  } catch (error) {
    logger.error('Database query error', error, {
      query: text.substring(0, 100) + (text.length > 100 ? '...' : ''),
      params: params?.length ? `${params.length} params` : 'no params'
    });
    throw error;
  }
}

/**
 * Get a client from the pool for transactions
 */
export async function getClient(): Promise<PoolClient> {
  const pool = getPool();
  return await pool.connect();
}

/**
 * Execute multiple queries in a transaction
 */
export async function transaction<T>(
  callback: (client: PoolClient) => Promise<T>
): Promise<T> {
  const client = await getClient();

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
}

/**
 * Close the connection pool (for graceful shutdown)
 */
export async function closePool(): Promise<void> {
  if (pool) {
    await pool.end();
  }
}

// Handle process termination
process.on('SIGINT', async () => {
  logger.info('Shutting down: Closing database pool');
  await closePool();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  logger.info('Shutting down: Closing database pool');
  await closePool();
  process.exit(0);
});

// Default export for compatibility
const db = {
  query,
  getClient,
  transaction,
  closePool,
  connect: getClient // Alias for pool.connect() compatibility
};

export default db;