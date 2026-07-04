-- Users table for Google OAuth
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  google_id TEXT UNIQUE NOT NULL,
  email TEXT UNIQUE NOT NULL,
  name TEXT,
  avatar_url TEXT,
  plan TEXT NOT NULL DEFAULT 'free',
  is_admin BOOLEAN NOT NULL DEFAULT FALSE,
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
  publish_status TEXT,
  published_subdomain TEXT,
  publish_error TEXT,
  original_screenshot TEXT,
  redesign_screenshot TEXT,
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

-- Visitor event tracking for admin analytics
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

CREATE INDEX IF NOT EXISTS visitor_events_visitor_id_idx ON visitor_events(visitor_id);
CREATE INDEX IF NOT EXISTS visitor_events_created_at_idx ON visitor_events(created_at DESC);
CREATE INDEX IF NOT EXISTS visitor_events_user_id_idx ON visitor_events(user_id);

CREATE TABLE IF NOT EXISTS contact_submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  message TEXT NOT NULL,
  ip TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_contact_email ON contact_submissions (email);
CREATE INDEX IF NOT EXISTS idx_contact_created_at ON contact_submissions (created_at DESC);

CREATE TABLE IF NOT EXISTS deployment_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id TEXT NOT NULL UNIQUE REFERENCES jobs(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  actor_email TEXT,
  actor_type TEXT,
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  feedback TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS deployment_reviews_created_at_idx ON deployment_reviews (created_at DESC);
CREATE INDEX IF NOT EXISTS deployment_reviews_rating_idx ON deployment_reviews (rating);
