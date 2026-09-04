/**
 * Stage 1 — discovery. Sweeps the (country × city × category) grid through the
 * Places API and upserts businesses as `discovered` leads.
 */
const { searchText } = require('./places');
const store = require('./store');
const { DEFAULT_GRID } = require('./config');

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function runDiscovery({ grid = DEFAULT_GRID, requestedBy = null } = {}) {
  const apiKey = process.env.GOOGLE_API_KEY;
  if (!apiKey) throw new Error('GOOGLE_API_KEY not configured');

  const run = await store.createRun(grid, requestedBy);
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
              const isNew = await store.upsertLead(run.id, { ...b, city, category });
              if (isNew) {
                added += 1;
                newLeads += 1;
              }
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
      places_calls: totalCalls,
      new_leads: newLeads,
      status: 'error',
      error: err.message,
    });
    throw err;
  }

  return { runId: run.id, placesCalls: totalCalls, newLeads, perQuery };
}

module.exports = { runDiscovery };
