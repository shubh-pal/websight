const { Pool } = require('pg');

let pool = null;

async function ensureSchema() {
  if (!pool) return;

  await pool.query(`
    ALTER TABLE users
      ALTER COLUMN google_id DROP NOT NULL;
  `).catch(() => {});

  await pool.query(`
    ALTER TABLE users
      ADD COLUMN IF NOT EXISTS password_hash TEXT;
  `);

  await pool.query(`
    ALTER TABLE users
      ADD COLUMN IF NOT EXISTS is_admin BOOLEAN NOT NULL DEFAULT FALSE;
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS visitor_events (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      visitor_id TEXT NOT NULL,
      user_id UUID REFERENCES users(id) ON DELETE SET NULL,
      path TEXT NOT NULL,
      referrer TEXT,
      user_agent TEXT,
      ip_hash TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
  `);

  await pool.query(`CREATE INDEX IF NOT EXISTS visitor_events_visitor_id_idx ON visitor_events(visitor_id);`);
  await pool.query(`CREATE INDEX IF NOT EXISTS visitor_events_created_at_idx ON visitor_events(created_at DESC);`);
  await pool.query(`CREATE INDEX IF NOT EXISTS visitor_events_user_id_idx ON visitor_events(user_id);`);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS contact_submissions (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      name TEXT NOT NULL,
      email TEXT NOT NULL,
      message TEXT NOT NULL,
      ip TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_contact_email ON contact_submissions (email);`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_contact_created_at ON contact_submissions (created_at DESC);`);

  await pool.query(`ALTER TABLE jobs ADD COLUMN IF NOT EXISTS publish_status TEXT;`);
  await pool.query(`ALTER TABLE jobs ADD COLUMN IF NOT EXISTS published_subdomain TEXT;`);
  await pool.query(`ALTER TABLE jobs ADD COLUMN IF NOT EXISTS publish_error TEXT;`);
  await pool.query(`ALTER TABLE jobs ADD COLUMN IF NOT EXISTS redesign_screenshot TEXT;`);

  const adminEmails = (process.env.ADMIN_EMAILS || 'shubhpalan@gmail.com')
    .split(',')
    .map(email => email.trim().toLowerCase())
    .filter(Boolean);

  if (adminEmails.length) {
    await pool.query(
      `UPDATE users
       SET is_admin = TRUE
       WHERE LOWER(email) = ANY($1::text[])`,
      [adminEmails]
    );
  }
}

if (process.env.DATABASE_URL) {
  pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  pool.on('error', (err) => {
    console.error('[db] Unexpected error on idle client:', err);
  });

  console.log('[db] PostgreSQL pool initialized');
  
  // Test connection on startup to catch DNS/NW issues early
  pool.query('SELECT 1').then(() => {
    console.log('[db] Successfully connected to PostgreSQL');
    return ensureSchema();
  }).then(() => {
    console.log('[db] Schema bootstrap complete');
  }).catch(err => {
    console.error('[db] CRITICAL: Database connection failed:', err.message);
  });
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
  query,
  ensureSchema,
};
