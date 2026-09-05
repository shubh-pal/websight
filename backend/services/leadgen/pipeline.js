/**
 * Cron tick — advances a bounded number of leads through each automatic stage.
 * Called by POST /api/app/cron/tick (Cloud Scheduler).
 *
 * waiting_approval -> approved_ready_for_ui ("approve") is opt-in per call
 * via `limits.approve` (defaults to 0, see config.js) — a separate scheduled
 * job hits this same endpoint with an explicit approve limit on its own
 * cadence, so it's still a deliberate policy choice, just an automated one:
 * approving only queues a lead for a redesign image, it never sends
 * anything to a prospect — that still always goes through a human-reviewed
 * Contact-card action (call/WhatsApp/email).
 */
const store = require('./store');
const { scrapeLead } = require('./scrapeWorker');
const { auditLead } = require('./audit');
const { qualifyLead } = require('./qualify');
const { TICK_LIMITS } = require('./config');

async function autoApprove(limit) {
  if (!limit) return { claimed: 0, ok: 0, failed: 0 };
  const claimed = await store.claimLeads('waiting_approval', 'approved_ready_for_ui', limit);
  for (const lead of claimed) {
    await store.updateLead(lead.id, { approved_at: new Date().toISOString(), approved_by: 'cron-auto-approve' });
    await store.recordEvent(lead.id, 'waiting_approval', 'approved_ready_for_ui', { source: 'cron-auto-approve' });
  }
  return { claimed: claimed.length, ok: claimed.length, failed: 0 };
}

/**
 * Self-heal transient PDF-build failures: the mockup uploaded fine, only
 * page.pdf() crashed. Rebuild and advance — no re-scrape, no re-qualify.
 * error_stage='pdf' can't be claimed via claimLeads (which filters on status
 * only, and 'error' covers every stage), so it has a dedicated claim query.
 */
async function recoverPdfErrors(limit) {
  if (!limit) return { claimed: 0, ok: 0, failed: 0 };
  const { buildProposalPdf } = require('./proposalPdf');
  const claimed = await store.q(
    `UPDATE leads SET status = 'building_pdf', updated_at = NOW()
       WHERE id IN (
         SELECT id FROM leads
          WHERE status = 'error' AND error_stage = 'pdf' AND mockup_gcs_key IS NOT NULL
          ORDER BY updated_at LIMIT $1 FOR UPDATE SKIP LOCKED
       )
     RETURNING *`,
    [limit]
  );
  let ok = 0;
  let failed = 0;
  for (const lead of claimed) {
    try {
      const { proposalKey } = await buildProposalPdf(lead.id);
      await store.updateLead(lead.id, { proposal_gcs_key: proposalKey, status: 'queued_for_contact', error: null, error_stage: null });
      await store.recordEvent(lead.id, 'error', 'queued_for_contact', { source: 'cron-pdf-recover' });
      ok += 1;
    } catch (err) {
      console.error(`[pipeline] pdf-recover lead ${lead.id} failed:`, err.message);
      await store.markError({ ...lead, status: 'building_pdf' }, 'pdf', err);
      failed += 1;
    }
  }
  return { claimed: claimed.length, ok, failed };
}

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
  result.approve = await autoApprove(L.approve);
  result.pdfRecover = await recoverPdfErrors(L.pdfRecover);

  return result;
}

module.exports = { tick, runStage, autoApprove, recoverPdfErrors };
