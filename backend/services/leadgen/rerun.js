/**
 * Manually re-run scrape + audit on specific leads (from the dashboard —
 * single "Run audit" button or a multi-select bulk action).
 *
 * Runs in the background: the caller gets an immediate response and the
 * leads move through `scraping` / `auditing` as they process. Not tied to
 * the cron tick.
 */
const store = require('./store');
const { scrapeLead } = require('./scrapeWorker');
const { auditLead } = require('./audit');

let running = false;
const queue = [];

async function drain() {
  if (running) return;
  running = true;
  while (queue.length) {
    const id = queue.shift();
    try {
      const [lead] = await store.q(`SELECT * FROM leads WHERE id = $1`, [id]);
      if (!lead || lead.status === 'closed') continue;

      if (lead.website) {
        await store.setStatus(lead.id, 'scraping');
        await scrapeLead({ ...lead, status: lead.status });
      }
      const [afterScrape] = await store.q(`SELECT * FROM leads WHERE id = $1`, [id]);
      await store.setStatus(id, 'auditing');
      await auditLead({ ...afterScrape, status: afterScrape.status });
    } catch (err) {
      console.error(`[rerun] lead ${id} failed:`, err.message);
      const [lead] = await store.q(`SELECT * FROM leads WHERE id = $1`, [id]);
      if (lead) await store.markError({ ...lead, status: 'auditing' }, 'audit', err);
    }
  }
  running = false;
}

/**
 * Enqueue leads for re-audit. Returns the number queued.
 */
async function enqueueAudit(ids) {
  const unique = [...new Set(ids)].filter(Boolean);
  for (const id of unique) {
    if (!queue.includes(id)) {
      queue.push(id);
      await store.recordEvent(id, null, 'auditing', { manualRerun: true }).catch(() => {});
    }
  }
  drain().catch((e) => console.error('[rerun] drain error:', e.message));
  return unique.length;
}

module.exports = { enqueueAudit, get isRunning() { return running; }, get pending() { return queue.length; } };
