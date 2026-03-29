-- ============================================================
-- WebSight — Contact Submissions Table
-- Run this in your Supabase SQL Editor:
-- https://supabase.com/dashboard → SQL Editor → New Query
-- ============================================================

CREATE TABLE IF NOT EXISTS contact_submissions (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT        NOT NULL,
  email       TEXT        NOT NULL,
  message     TEXT        NOT NULL,
  ip          TEXT,                          -- optional: store requester IP
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for quick lookup by email / date
CREATE INDEX IF NOT EXISTS idx_contact_email      ON contact_submissions (email);
CREATE INDEX IF NOT EXISTS idx_contact_created_at ON contact_submissions (created_at DESC);

-- (Optional) Enable Row Level Security — only you (service role) can read rows
ALTER TABLE contact_submissions ENABLE ROW LEVEL SECURITY;

-- Allow inserts from anon (needed for the public contact form)
CREATE POLICY "Allow public insert"
  ON contact_submissions
  FOR INSERT
  TO anon
  WITH CHECK (true);

-- Only authenticated users (your service role / dashboard) can read
CREATE POLICY "Allow service read"
  ON contact_submissions
  FOR SELECT
  TO authenticated
  USING (true);
