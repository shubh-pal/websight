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

  // Assets are streamed back through this API (works with plain ADC — no
  // service-account signing key needed locally or on Cloud Run).
  const media = {};
  if (gcs.isEnabled) {
    const asset = (key) => key ? `/api/app/leadgen/leads/${lead.id}/asset?key=${encodeURIComponent(key)}` : null;
    media.beforeScreenshot = asset(lead.audit_signals?.screenshot);
    media.mockup = asset(lead.mockup_gcs_key);
    media.proposalPdf = asset(lead.proposal_gcs_key);
  }

  res.json({ lead, events, media });
});

// Stream a GCS object that belongs to this lead's folder.
router.get('/leads/:id/asset', async (req, res) => {
  if (!gcs.isEnabled) return res.status(503).json({ error: 'GCS not configured' });
  const key = String(req.query.key || '');
  const [lead] = await store.q(`SELECT id, gcs_prefix FROM leads WHERE id = $1`, [req.params.id]);
  if (!lead) return res.status(404).json({ error: 'Lead not found' });
  if (!key.startsWith(`companies/${lead.id}/`)) {
    return res.status(400).json({ error: 'key outside lead folder' });
  }
  try {
    const buf = await gcs.downloadBuffer(key);
    if (!buf) return res.status(404).json({ error: 'asset not found' });
    const ext = key.split('.').pop().toLowerCase();
    const types = { webp: 'image/webp', png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', pdf: 'application/pdf', json: 'application/json', html: 'text/html' };
    res.set('Content-Type', types[ext] || 'application/octet-stream');
    res.set('Cache-Control', 'private, max-age=300');
    res.send(buf);
  } catch (err) {
    console.error('[app] asset stream error:', err.message);
    res.status(502).json({ error: err.message });
  }
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
