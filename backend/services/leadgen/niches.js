/**
 * Niches — named verticals (search terms + default locations). Discovery runs
 * against a niche; every resulting lead is stamped with niche_id so we can
 * compare which niche produces the most (and best) leads.
 */
const store = require('./store');

function slugify(name) {
  return String(name).toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60);
}

async function listNiches({ includeInactive = false } = {}) {
  return store.q(
    `SELECT * FROM niches ${includeInactive ? '' : 'WHERE active = TRUE'} ORDER BY name`
  );
}

async function getNiche(id) {
  const [n] = await store.q(`SELECT * FROM niches WHERE id = $1`, [id]);
  return n || null;
}

async function createNiche({ name, search_terms = [], locations = [], notes = null }) {
  const [n] = await store.q(
    `INSERT INTO niches (name, slug, search_terms, locations, notes)
     VALUES ($1,$2,$3::jsonb,$4::jsonb,$5) RETURNING *`,
    [name, slugify(name), JSON.stringify(search_terms), JSON.stringify(locations), notes]
  );
  return n;
}

async function updateNiche(id, patch) {
  const cols = [];
  const vals = [];
  for (const k of ['name', 'search_terms', 'locations', 'active', 'notes']) {
    if (patch[k] === undefined) continue;
    vals.push(k === 'search_terms' || k === 'locations' ? JSON.stringify(patch[k]) : patch[k]);
    cols.push(`${k} = $${vals.length + 1}${(k === 'search_terms' || k === 'locations') ? '::jsonb' : ''}`);
  }
  if (patch.name) { vals.push(slugify(patch.name)); cols.push(`slug = $${vals.length + 1}`); }
  if (!cols.length) return getNiche(id);
  const [n] = await store.q(
    `UPDATE niches SET ${cols.join(', ')}, updated_at = NOW() WHERE id = $1 RETURNING *`,
    [id, ...vals]
  );
  return n;
}

/**
 * Turn a niche + optional run-time overrides into a discovery grid.
 * @param overrides { countries?: string[], cities?: string[] }
 */
function buildGrid(niche, overrides = {}) {
  const terms = niche.search_terms || [];
  let locations = niche.locations || [];

  if (overrides.countries && overrides.countries.length) {
    locations = locations.filter((l) => overrides.countries.includes(l.country));
  }
  if (overrides.cities && overrides.cities.length) {
    locations = locations
      .map((l) => ({ ...l, cities: (l.cities || []).filter((c) => overrides.cities.includes(c)) }))
      .filter((l) => l.cities.length);
  }

  return {
    countries: locations.map((l) => l.country),
    niche: niche.slug,
    targets: locations.map((l) => ({
      country: l.country,
      cities: l.cities || [],
      categories: terms,
    })),
  };
}

/**
 * Per niche × country aggregates for the performance view.
 */
async function stats() {
  const rows = await store.q(`
    SELECT
      COALESCE(n.name, '(no niche)')            AS niche,
      COALESCE(n.id::text, 'none')              AS niche_id,
      l.country                                 AS country,
      COUNT(*)::int                             AS leads,
      COUNT(*) FILTER (WHERE l.status NOT IN ('discovered','scraping','scraped','auditing'))::int AS audited,
      COUNT(*) FILTER (WHERE l.qualify_decision = 'qualified')::int AS qualified,
      COUNT(*) FILTER (WHERE l.qualify_decision = 'rejected')::int  AS rejected,
      COUNT(*) FILTER (WHERE l.status = 'contacted')::int           AS contacted,
      COUNT(*) FILTER (WHERE l.status = 'closed')::int              AS closed,
      ROUND(AVG(l.audit_score) FILTER (WHERE l.audit_score IS NOT NULL))::int AS avg_score,
      COALESCE(SUM(l.qualify_value_usd) FILTER (WHERE l.qualify_decision = 'qualified'), 0)::int AS pipeline_value
    FROM leads l
    LEFT JOIN niches n ON n.id = l.niche_id
    GROUP BY n.name, n.id, l.country
    ORDER BY leads DESC
  `);
  return rows.map((r) => ({
    ...r,
    qualified_rate: r.audited ? Math.round((r.qualified / r.audited) * 100) : null,
  }));
}

module.exports = {
  slugify,
  listNiches,
  getNiche,
  createNiche,
  updateNiche,
  buildGrid,
  stats,
};
