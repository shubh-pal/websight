-- ============================================================================
-- Agency pipeline — internal lead-gen -> redesign proposal -> outreach
-- Applied automatically by backend/db/index.js ensureSchema(); also runnable
-- standalone against the Supabase database.
-- Nothing here touches existing tables.
-- ============================================================================

-- One discovery execution (a Places API grid sweep).
CREATE TABLE IF NOT EXISTS lead_runs (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  grid          JSONB NOT NULL,
  requested_by  TEXT,
  places_calls  INTEGER DEFAULT 0,
  new_leads     INTEGER DEFAULT 0,
  status        TEXT DEFAULT 'running',      -- running | done | error
  error         TEXT,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  finished_at   TIMESTAMPTZ
);

-- One business. `status` drives the pipeline state machine.
CREATE TABLE IF NOT EXISTS leads (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id          UUID REFERENCES lead_runs(id) ON DELETE SET NULL,

  place_id        TEXT UNIQUE NOT NULL,      -- Places TOS: cacheable indefinitely
  name            TEXT,
  country         TEXT,
  city            TEXT,
  category        TEXT,
  address         TEXT,
  phone           TEXT,
  phone_intl      TEXT,
  website         TEXT,
  rating          REAL,                      -- Places TOS: refresh within 30 days
  reviews         INTEGER,
  business_status TEXT,
  maps_uri        TEXT,
  places_refreshed_at TIMESTAMPTZ,

  status          TEXT NOT NULL DEFAULT 'discovered',
  error_stage     TEXT,
  error           TEXT,
  attempts        JSONB NOT NULL DEFAULT '{}'::jsonb,

  gcs_prefix      TEXT,
  contact_email   TEXT,

  audit_score     INTEGER,
  audit_reasons   TEXT,
  audit_signals   JSONB,

  qualify_decision   TEXT,                   -- qualified | rejected
  qualify_confidence REAL,
  qualify_value_usd  INTEGER,
  qualify_angle      TEXT,
  qualify_raw        JSONB,
  qualified_by       TEXT,                   -- 'gemini' | admin email (manual override)

  redesign_batch_id  TEXT,
  redesign_concept   JSONB,
  mockup_gcs_key     TEXT,
  proposal_gcs_key   TEXT,

  hold_reason     TEXT,
  contacted_at    TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS leads_status_idx  ON leads(status);
CREATE INDEX IF NOT EXISTS leads_country_idx ON leads(country);
CREATE INDEX IF NOT EXISTS leads_run_idx     ON leads(run_id);

-- Append-only transition log.
CREATE TABLE IF NOT EXISTS lead_events (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id     UUID REFERENCES leads(id) ON DELETE CASCADE,
  from_status TEXT,
  to_status   TEXT,
  detail      JSONB,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS lead_events_lead_idx ON lead_events(lead_id, created_at DESC);

-- Outreach (Stage 5, built later).
CREATE TABLE IF NOT EXISTS outreach_messages (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id        UUID REFERENCES leads(id) ON DELETE CASCADE,
  channel        TEXT DEFAULT 'email',
  to_address     TEXT,
  subject        TEXT,
  body           TEXT,
  esp_message_id TEXT,
  status         TEXT DEFAULT 'queued',      -- queued|sent|delivered|opened|replied|bounced|failed
  sent_at        TIMESTAMPTZ,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS outreach_lead_idx ON outreach_messages(lead_id);

CREATE TABLE IF NOT EXISTS suppressions (
  email      TEXT PRIMARY KEY,
  reason     TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Niches: a named vertical + its Places search terms + default locations ──
CREATE TABLE IF NOT EXISTS niches (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL,
  slug        TEXT UNIQUE NOT NULL,
  search_terms JSONB NOT NULL DEFAULT '[]'::jsonb,   -- ["dentist","dental clinic"]
  locations   JSONB NOT NULL DEFAULT '[]'::jsonb,    -- [{"country":"US","cities":["Los Angeles, CA"]}]
  active      BOOLEAN NOT NULL DEFAULT TRUE,
  notes       TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE leads     ADD COLUMN IF NOT EXISTS niche_id UUID REFERENCES niches(id) ON DELETE SET NULL;
ALTER TABLE lead_runs ADD COLUMN IF NOT EXISTS niche_id UUID REFERENCES niches(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS leads_niche_idx ON leads(niche_id);

-- Per-niche minimum opportunity score (NULL -> use the global default).
ALTER TABLE niches ADD COLUMN IF NOT EXISTS min_score INTEGER;

-- Approval / qualification bookkeeping.
ALTER TABLE leads ADD COLUMN IF NOT EXISTS approved_at   TIMESTAMPTZ;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS approved_by   TEXT;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS disqualify_reason TEXT;

-- Global key/value settings (single-row semantics per key).
CREATE TABLE IF NOT EXISTS app_settings (
  key        TEXT PRIMARY KEY,
  value      JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
INSERT INTO app_settings (key, value) VALUES
  ('pipeline', '{"default_min_score": 30, "gemini_model": "vertex-gemini-2.5-flash"}'::jsonb)
ON CONFLICT (key) DO NOTHING;

-- Manually uploaded / overridden assets: { "screenshot": "<gcs key>", "logo": "<gcs key>" }
ALTER TABLE leads ADD COLUMN IF NOT EXISTS manual_assets JSONB NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS score_override INTEGER;      -- set on manual review
ALTER TABLE leads ADD COLUMN IF NOT EXISTS score_override_by TEXT;

-- Free-text notes on a lead (timestamped log).
CREATE TABLE IF NOT EXISTS lead_notes (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id    UUID REFERENCES leads(id) ON DELETE CASCADE,
  body       TEXT NOT NULL,
  author     TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS lead_notes_lead_idx ON lead_notes(lead_id, created_at DESC);

-- Starter niches (idempotent).
INSERT INTO niches (name, slug, search_terms, locations) VALUES
  ('Dental', 'dental',
   '["dentist","dental clinic","cosmetic dentist"]'::jsonb,
   '[{"country":"US","cities":["Los Angeles, CA","Austin, TX","Denver, CO"]},
     {"country":"GB","cities":["Manchester","Leeds","Bristol"]},
     {"country":"AU","cities":["Brisbane","Perth"]}]'::jsonb),
  ('Legal', 'legal',
   '["personal injury law firm","solicitors","conveyancer","family law attorney"]'::jsonb,
   '[{"country":"US","cities":["Los Angeles, CA","Austin, TX","Denver, CO"]},
     {"country":"GB","cities":["Manchester","Leeds","Bristol"]},
     {"country":"AU","cities":["Brisbane","Perth"]}]'::jsonb),
  ('Home Services', 'home-services',
   '["plumber","roofing contractor","electrician","hvac contractor"]'::jsonb,
   '[{"country":"US","cities":["Los Angeles, CA","Austin, TX","Denver, CO"]},
     {"country":"GB","cities":["Manchester","Leeds","Bristol"]},
     {"country":"AU","cities":["Brisbane","Perth"]}]'::jsonb),
  ('Med Spa & Beauty', 'med-spa-beauty',
   '["med spa","aesthetic clinic","hair salon","barber shop"]'::jsonb,
   '[{"country":"US","cities":["Los Angeles, CA","Austin, TX","Denver, CO"]},
     {"country":"GB","cities":["Manchester","Leeds","Bristol"]}]'::jsonb),
  ('Real Estate', 'real-estate',
   '["real estate agency","letting agent","property management company"]'::jsonb,
   '[{"country":"US","cities":["Austin, TX","Denver, CO"]},
     {"country":"GB","cities":["Manchester","Leeds","Bristol"]}]'::jsonb)
ON CONFLICT (slug) DO NOTHING;

-- Public "Yes, I'm interested" button on the pitch PDF's last page.
ALTER TABLE leads ADD COLUMN IF NOT EXISTS interested_at TIMESTAMPTZ;
