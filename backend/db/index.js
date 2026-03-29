const { Pool } = require('pg');

let pool = null;

if (process.env.DATABASE_URL) {
  pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  pool.on('error', (err) => {
    console.error('[db] Unexpected error on idle client:', err);
  });

  console.log('[db] PostgreSQL pool initialized');
} else {
  console.warn('[db] DATABASE_URL not set – database features disabled (in-memory only)');
}

async function query(...args) {
  if (!pool) {
    return Promise.reject(new Error('[db] No database configured'));
  }
  return pool.query(...args);
}

module.exports = {
  pool,
  query
};
