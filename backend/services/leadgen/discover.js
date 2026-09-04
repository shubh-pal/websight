/**
 * Stage 1 — discovery. Sweeps a (country × city × category) grid through the
 * Places API and upserts businesses as `discovered` leads.
 *
 * Preferred entry: runDiscovery({ nicheId, overrides }) — the grid is built
 * from the niche and every lead is stamped with niche_id.
 */
const { searchText } = require('./places');
const niches = require('./niches');
const store = require('./store');
const { DEFAULT_GRID } = require('./config');

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function runDiscovery({ nicheId = null, overrides = {}, grid = null, requestedBy = null } = {}) {
  const apiKey = process.env.GOOGLE_API_KEY;
  if (!apiKey) throw new Error('GOOGLE_API_KEY not configured');

  let niche = null;
  if (nicheId) {
    niche = await niches.getNiche(nicheId);
    if (!niche) throw new Error(`niche ${nicheId} not found`);
    grid = niches.buildGrid(niche, overrides);
  }
  if (!grid) grid = DEFAULT_GRID;
  if (!grid.targets?.some((t) => t.cities?.length && t.categories?.length)) {
    throw new Error('grid has no city/category to search');
  }

  const run = await store.createRun(grid, requestedBy, niche?.id || null);
  let totalCalls = 0;
  let newLeads = 0;
  const perQuery = [];

  try {
    for (const group of grid.targets || []) {
      for (const city of group.cities || []) {
        for (const category of group.categories || []) {
          const query = `${category} in ${city}`;
          try {
            const { results, calls } = await searchText(apiKey, query, group.country);
            totalCalls += calls;
            let added = 0;
            for (const b of results) {
              const isNew = await store.upsertLead(run.id, { ...b, city, category }, niche?.id || null);
              if (isNew) { added += 1; newLeads += 1; }
            }
            perQuery.push({ query, results: results.length, new: added });
          } catch (err) {
            perQuery.push({ query, error: err.message });
          }
          await sleep(400);
        }
      }
    }
    await store.finishRun(run.id, { places_calls: totalCalls, new_leads: newLeads });
  } catch (err) {
    await store.finishRun(run.id, {
      places_calls: totalCalls, new_leads: newLeads, status: 'error', error: err.message,
    });
    throw err;
  }

  return { runId: run.id, niche: niche?.slug || null, placesCalls: totalCalls, newLeads, perQuery };
}

module.exports = { runDiscovery };
