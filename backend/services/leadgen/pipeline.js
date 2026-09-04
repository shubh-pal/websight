/**
 * Cron tick — advances a bounded number of leads through each automatic stage.
 * Called by POST /api/app/cron/tick (Cloud Scheduler, every 5 min).
 *
 * Human gates (audited -> qualified, pdf_ready -> ready_to_send) are NOT
 * advanced here.
 */
const store = require('./store');
const { scrapeLead } = require('./scrapeWorker');
const { auditLead } = require('./audit');
const { qualifyLead } = require('./qualify');
const { TICK_LIMITS } = require('./config');

async function runStage(fromStatus, workingStatus, limit, handler) {
  const claimed = await store.claimLeads(fromStatus, workingStatus, limit);
  let ok = 0;
  let failed = 0;
  for (const lead of claimed) {
    // Handlers record events with lead.status as the "from" — use the real
    // pre-claim status, not the transient working status.
    const l = { ...lead, status: fromStatus };
    try {
      await handler(l);
      ok += 1;
    } catch (err) {
      console.error(`[pipeline] ${fromStatus} lead ${lead.id} failed:`, err.message);
      await store.markError(l, fromStatus, err);
      failed += 1;
    }
  }
  return { claimed: claimed.length, ok, failed };
}

async function tick(limits = {}) {
  const L = { ...TICK_LIMITS, ...limits };
  const result = {};

  result.scrape = await runStage('discovered', 'scraping', L.scrape, scrapeLead);
  result.audit = await runStage('scraped', 'auditing', L.audit, auditLead);
  result.qualify = await runStage('audited', 'qualifying', L.qualify, qualifyLead);

  return result;
}

module.exports = { tick, runStage };
