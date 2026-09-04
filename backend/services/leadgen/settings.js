/**
 * Global pipeline settings (app_settings table, key = 'pipeline').
 */
const store = require('./store');

const DEFAULTS = { default_min_score: 30, gemini_model: 'vertex-gemini-2.5-flash' };

async function get() {
  const [row] = await store.q(`SELECT value FROM app_settings WHERE key = 'pipeline'`);
  return { ...DEFAULTS, ...(row?.value || {}) };
}

async function set(patch) {
  const current = await get();
  const next = { ...current, ...patch };
  await store.q(
    `INSERT INTO app_settings (key, value) VALUES ('pipeline', $1::jsonb)
     ON CONFLICT (key) DO UPDATE SET value = $1::jsonb, updated_at = NOW()`,
    [JSON.stringify(next)]
  );
  return next;
}

/** Effective minimum score for a lead: niche override, else global default. */
async function minScoreFor(lead) {
  const s = await get();
  if (lead.niche_id) {
    const [n] = await store.q(`SELECT min_score FROM niches WHERE id = $1`, [lead.niche_id]);
    if (n && n.min_score != null) return n.min_score;
  }
  return s.default_min_score;
}

module.exports = { get, set, minScoreFor, DEFAULTS };
