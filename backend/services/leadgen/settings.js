/**
 * Global settings, stored as rows in app_settings (key -> jsonb value).
 * Two keys in use: 'pipeline' (qualification threshold, model) and
 * 'company' (agency profile injected into every proposal PDF).
 */
const store = require('./store');

const DEFAULTS = {
  pipeline: { default_min_score: 30, gemini_model: 'vertex-gemini-2.5-flash' },
  company: {
    name: '', website: '', contact_email: '', contact_phone: '', portfolio_url: '',
    logo_gcs_key: null,
    price_min: 200, price_max: 1000, price_per_page: 200, delivery_days: 7,
    tagline: 'Modern, fast, mobile-first websites — delivered in about a week.',
  },
};

async function get(key = 'pipeline') {
  const [row] = await store.q(`SELECT value FROM app_settings WHERE key = $1`, [key]);
  return { ...(DEFAULTS[key] || {}), ...(row?.value || {}) };
}

async function set(patch, key = 'pipeline') {
  const current = await get(key);
  const next = { ...current, ...patch };
  await store.q(
    `INSERT INTO app_settings (key, value) VALUES ($1, $2::jsonb)
     ON CONFLICT (key) DO UPDATE SET value = $2::jsonb, updated_at = NOW()`,
    [key, JSON.stringify(next)]
  );
  return next;
}

const getCompany = () => get('company');
const setCompany = (patch) => set(patch, 'company');

/** Effective minimum score for a lead: niche override, else global default. */
async function minScoreFor(lead) {
  const s = await get('pipeline');
  if (lead.niche_id) {
    const [n] = await store.q(`SELECT min_score FROM niches WHERE id = $1`, [lead.niche_id]);
    if (n && n.min_score != null) return n.min_score;
  }
  return s.default_min_score;
}

module.exports = { get, set, getCompany, setCompany, minScoreFor, DEFAULTS };
