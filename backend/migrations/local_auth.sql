-- migration: add password_hash and email unique constraint

-- Make google_id nullable for local users
ALTER TABLE users ALTER COLUMN google_id DROP NOT NULL;

-- Add password_hash column
ALTER TABLE users ADD COLUMN IF NOT EXISTS password_hash TEXT;

-- Ensure email is unique across all users (Google or Local)
-- If it already is, this might fail, but let's be safe.
-- Use ON CONFLICT (email) in signup too.
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email ON users (email);
