-- Users table for Google OAuth
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  google_id TEXT UNIQUE NOT NULL,
  email TEXT UNIQUE NOT NULL,
  name TEXT,
  avatar_url TEXT,
  plan TEXT NOT NULL DEFAULT 'free',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Jobs table (tracks all redesign jobs, linked to users)
CREATE TABLE IF NOT EXISTS jobs (
  id TEXT PRIMARY KEY,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  url TEXT,
  framework TEXT,
  model TEXT,
  status TEXT DEFAULT 'pending',
  project_name TEXT,
  tokens JSONB,
  file_map JSONB,
  error TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Sessions table for express-session with connect-pg-simple
CREATE TABLE IF NOT EXISTS sessions (
  sid TEXT PRIMARY KEY,
  sess JSONB NOT NULL,
  expire TIMESTAMPTZ NOT NULL
);
CREATE INDEX IF NOT EXISTS sessions_expire_idx ON sessions(expire);

-- Usage tracking (for rate limiting / plan enforcement)
CREATE TABLE IF NOT EXISTS usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  month TEXT NOT NULL,
  jobs_count INTEGER DEFAULT 0,
  UNIQUE(user_id, month)
);

-- Subscriptions table for Stripe integration
CREATE TABLE IF NOT EXISTS subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  stripe_customer_id TEXT,
  stripe_subscription_id TEXT,
  status TEXT DEFAULT 'inactive',
  current_period_end TIMESTAMPTZ,
  UNIQUE(user_id)
);

-- API keys table (BYOK — bring your own key)
-- Keys are stored AES-256-GCM encrypted; only the hint (last 4 chars) is readable.
CREATE TABLE IF NOT EXISTS api_keys (
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  provider TEXT NOT NULL,       -- 'anthropic' | 'gemini'
  encrypted_key TEXT NOT NULL,  -- AES-256-GCM: iv_hex:authTag_hex:ciphertext_hex
  key_hint TEXT,                -- last 4 chars for display, e.g. "a3F9"
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (user_id, provider)
);
