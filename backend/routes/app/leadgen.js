/**
 * /api/app/leadgen/* — discovery runs + lead browsing. Admin-gated by the
 * parent router.
 */
const express = require('express');
const { runDiscovery } = require('../../services/leadgen/discover');
const { DEFAULT_GRID } = require('../../services/leadgen/config');
const store = require('../../services/leadgen/store');
const gcs = require('../../services/gcsStorage');

const router = express.Router();

// Kick off a discovery sweep. Runs in the background; poll GET /runs for status.
router.post('/runs', async (req, res) => {
  const grid = req.body?.grid || DEFAULT_GRID;
  if (!process.env.GOOGLE_API_KEY) {
    return res.status(503).json({ error: 'GOOGLE_API_KEY not configured' });
  }
  if (!Array.isArray(grid.targets) || !grid.targets.length) {
    return res.status(400).json({ error: 'grid.targets must be a non-empty array' });
  }

  res.status(202).json({ started: true });
  runDiscovery({ grid, requestedBy: req.user?.email || 'admin' })
    .then((r) => console.log('[leadgen] discovery done:', r.runId, r.newLeads, 'new'))
    .catch((err) => console.error('[leadgen] discovery failed:', err.message));
});

router.get('/runs', async (req, res) => {
  const rows = await store.q(
    `SELECT * FROM lead_runs ORDER BY created_at DESC LIMIT 25`
  );
  res.json(rows);
});

router.get('/leads', async (req, res) => {
  const { status, country } = req.query;
  const limit = Math.min(Number(req.query.limit) || 100, 500);
  const where = [];
  const params = [];
  if (status) { params.push(status); where.push(`status = $${params.length}`); }
  if (country) { params.push(country); where.push(`country = $${params.length}`); }
  params.push(limit);
  const rows = await store.q(
    `SELECT id, name, country, city, category, website, phone, contact_email,
            rating, reviews, status, audit_score, audit_reasons,
            qualify_decision, qualify_value_usd, error_stage, error, updated_at
       FROM leads
       ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
       ORDER BY audit_score DESC NULLS LAST, updated_at DESC
       LIMIT $${params.length}`,
    params
  );
  res.json(rows);
});

router.get('/leads/:id', async (req, res) => {
  const [lead] = await store.q(`SELECT * FROM leads WHERE id = $1`, [req.params.id]);
  if (!lead) return res.status(404).json({ error: 'Lead not found' });
  const events = await store.q(
    `SELECT * FROM lead_events WHERE lead_id = $1 ORDER BY created_at DESC LIMIT 100`,
    [req.params.id]
  );

  const media = {};
  if (gcs.isEnabled) {
    const shotKey = lead.audit_signals?.screenshot;
    try {
      if (shotKey) media.beforeScreenshot = await gcs.getSignedDownloadUrl(shotKey, 3600);
      if (lead.mockup_gcs_key) media.mockup = await gcs.getSignedDownloadUrl(lead.mockup_gcs_key, 3600);
      if (lead.proposal_gcs_key) media.proposalPdf = await gcs.getSignedDownloadUrl(lead.proposal_gcs_key, 3600);
    } catch (err) {
      media.error = `signed URL failed: ${err.message}`;
    }
  }

  res.json({ lead, events, media });
});

// Close a lead from ANY stage — terminal, excluded from all pipeline ticks.
router.post('/leads/:id/close', async (req, res) => {
  const [lead] = await store.q(`SELECT * FROM leads WHERE id = $1`, [req.params.id]);
  if (!lead) return res.status(404).json({ error: 'Lead not found' });
  if (lead.status === 'closed') return res.json({ ok: true, status: 'closed' });
  await store.updateLead(lead.id, {
    status: 'closed',
    hold_reason: (req.body?.reason || '').slice(0, 300) || null,
  });
  await store.recordEvent(lead.id, lead.status, 'closed', {
    by: req.user?.email || 'admin',
    reason: req.body?.reason || null,
  });
  res.json({ ok: true, status: 'closed', from: lead.status });
});

// Re-open a closed lead back to a chosen stage (default: discovered).
router.post('/leads/:id/reopen', async (req, res) => {
  const [lead] = await store.q(`SELECT * FROM leads WHERE id = $1`, [req.params.id]);
  if (!lead) return res.status(404).json({ error: 'Lead not found' });
  if (lead.status !== 'closed') return res.status(400).json({ error: 'Lead is not closed' });
  const allowed = ['discovered', 'scraped', 'audited', 'qualified'];
  const to = allowed.includes(req.body?.to) ? req.body.to : 'discovered';
  await store.updateLead(lead.id, { status: to, hold_reason: null, error: null, error_stage: null });
  await store.recordEvent(lead.id, 'closed', to, { by: req.user?.email || 'admin', reopened: true });
  res.json({ ok: true, status: to });
});

// Re-queue an errored lead to the start of the stage that failed.
router.post('/leads/:id/retry', async (req, res) => {
  const [lead] = await store.q(`SELECT * FROM leads WHERE id = $1`, [req.params.id]);
  if (!lead) return res.status(404).json({ error: 'Lead not found' });
  if (lead.status !== 'error') return res.status(400).json({ error: 'Lead is not in error state' });
  const back = { scrape: 'discovered', audit: 'scraped', qualify: 'audited', redesign: 'qualified', pdf: 'redesigned' };
  const to = back[lead.error_stage] || 'discovered';
  await store.updateLead(lead.id, { status: to, error: null, error_stage: null });
  await store.recordEvent(lead.id, 'error', to, { manualRetry: true });
  res.json({ ok: true, status: to });
});

module.exports = router;
