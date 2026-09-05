/**
 * /api/app/leadgen/* — discovery runs + lead browsing. Admin-gated by the
 * parent router.
 */
const express = require('express');
const { runDiscovery } = require('../../services/leadgen/discover');
const { searchText } = require('../../services/leadgen/places');
const store = require('../../services/leadgen/store');
const niches = require('../../services/leadgen/niches');
const rerun = require('../../services/leadgen/rerun');
const settings = require('../../services/leadgen/settings');
const { reevaluate } = require('../../services/leadgen/qualify');
const designIntake = require('../../services/leadgen/designIntake');
const gcs = require('../../services/gcsStorage');
const mailer = require('../../services/leadgen/mailer');

const router = express.Router();

// ── Settings ──────────────────────────────────────────────────────────────
router.get('/settings', async (req, res) => res.json(await settings.get()));
router.put('/settings', async (req, res) => {
  const patch = {};
  if (req.body?.default_min_score != null) patch.default_min_score = Math.max(0, Math.min(100, Number(req.body.default_min_score)));
  if (req.body?.gemini_model) patch.gemini_model = String(req.body.gemini_model);
  res.json(await settings.set(patch));
});

// ── Niches ────────────────────────────────────────────────────────────────
router.get('/niches', async (req, res) => {
  const list = await niches.listNiches({ includeInactive: req.query.all === '1' });
  res.json(list);
});

router.get('/niches/stats', async (req, res) => {
  res.json(await niches.stats());
});

router.post('/niches', async (req, res) => {
  const { name, search_terms, locations, notes } = req.body || {};
  if (!name || !Array.isArray(search_terms) || !search_terms.length) {
    return res.status(400).json({ error: 'name and non-empty search_terms[] required' });
  }
  try {
    res.status(201).json(await niches.createNiche({ name, search_terms, locations: locations || [], notes }));
  } catch (err) {
    res.status(err.code === '23505' ? 409 : 500).json({ error: err.message });
  }
});

router.put('/niches/:id', async (req, res) => {
  const n = await niches.getNiche(req.params.id);
  if (!n) return res.status(404).json({ error: 'Niche not found' });
  res.json(await niches.updateNiche(req.params.id, req.body || {}));
});

router.delete('/niches/:id', async (req, res) => {
  const n = await niches.getNiche(req.params.id);
  if (!n) return res.status(404).json({ error: 'Niche not found' });
  await niches.updateNiche(req.params.id, { active: false });
  res.json({ ok: true, deactivated: true });
});

// ── Discovery runs ────────────────────────────────────────────────────────
// Body: { nicheId, overrides:{ countries?:[], cities?:[] } }  (or legacy { grid })
router.post('/runs', async (req, res) => {
  if (!process.env.GOOGLE_API_KEY) {
    return res.status(503).json({ error: 'GOOGLE_API_KEY not configured' });
  }
  const { nicheId, overrides, grid } = req.body || {};
  if (!nicheId && !grid) {
    return res.status(400).json({ error: 'nicheId (or a raw grid) is required' });
  }

  res.status(202).json({ started: true });
  runDiscovery({ nicheId, overrides: overrides || {}, grid, requestedBy: req.user?.email || 'admin' })
    .then((r) => console.log('[leadgen] discovery done:', r.runId, r.niche, r.newLeads, 'new'))
    .catch((err) => console.error('[leadgen] discovery failed:', err.message));
});

router.get('/runs', async (req, res) => {
  const rows = await store.q(
    `SELECT r.*, n.name AS niche_name
       FROM lead_runs r LEFT JOIN niches n ON n.id = r.niche_id
      ORDER BY r.created_at DESC LIMIT 25`
  );
  res.json(rows);
});

// ── Manual lead entry ─────────────────────────────────────────────────────
// Search Google Business listings by name (does not create anything yet —
// the admin picks a result to add).
router.post('/leads/manual/search-places', async (req, res) => {
  if (!process.env.GOOGLE_API_KEY) return res.status(503).json({ error: 'GOOGLE_API_KEY not configured' });
  const query = (req.body?.query || '').trim();
  if (!query) return res.status(400).json({ error: 'query is required' });
  try {
    const { results } = await searchText(process.env.GOOGLE_API_KEY, query, req.body?.country || null, 8);
    res.json({ results });
  } catch (err) {
    res.status(502).json({ error: err.message });
  }
});

function slugifyHost(url) {
  try {
    const u = new URL(/^https?:\/\//i.test(url) ? url : `https://${url}`);
    return u.hostname.replace(/^www\./, '');
  } catch (_) {
    return null;
  }
}
function humanizeHost(host) {
  const label = host.split('.')[0] || host;
  return label.replace(/[-_]+/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

// Create a lead either from a picked Places search result ({ source:'place',
// place }) or directly from a website URL ({ source:'website', website, name? }).
// Immediately kicks off scrape+audit+qualify so it starts moving right away.
router.post('/leads/manual', async (req, res) => {
  const { source, place, website, name, nicheId, phone, contactEmail } = req.body || {};
  let business;

  if (source === 'place') {
    if (!place?.place_id) return res.status(400).json({ error: 'place.place_id is required' });
    business = { ...place };
  } else if (source === 'website') {
    const host = slugifyHost(website || '');
    if (!host) return res.status(400).json({ error: 'a valid website URL is required' });
    const url = /^https?:\/\//i.test(website) ? website : `https://${website}`;
    business = {
      place_id: `manual:${host}`,
      name: (name || '').trim() || humanizeHost(host),
      website: url,
      country: null, city: null, category: null, address: null,
      phone: null, phone_intl: null, rating: null, reviews: null,
      business_status: null, maps_uri: null,
    };
  } else {
    return res.status(400).json({ error: "source must be 'place' or 'website'" });
  }

  // Manually entered phone/email always win — Places never returns an email,
  // and a hand-typed phone overrides whatever the API found (or fills it in
  // for the website-only path, which has none).
  if (phone && phone.trim()) business.phone = phone.trim();
  if (contactEmail && contactEmail.trim()) business.contact_email = contactEmail.trim();

  const { id, created } = await store.createManualLead(business, nicheId || null);
  if (created) {
    await store.recordEvent(id, null, 'discovered', { manualAdd: true, source, by: req.user?.email || 'admin' });
    rerun.enqueueAudit([id]).catch((e) => console.error('[leadgen] manual-add audit enqueue failed:', e.message));
  }
  res.status(created ? 201 : 200).json({ id, created });
});

router.get('/leads', async (req, res) => {
  const { status, country, niche } = req.query;
  const limit = Math.min(Number(req.query.limit) || 100, 500);
  const where = [];
  const params = [];
  if (status) { params.push(status); where.push(`l.status = $${params.length}`); }
  if (country) { params.push(country); where.push(`l.country = $${params.length}`); }
  if (niche === 'none') { where.push(`l.niche_id IS NULL`); }
  else if (niche) { params.push(niche); where.push(`n.slug = $${params.length}`); }
  params.push(limit);
  const rows = await store.q(
    `SELECT l.id, l.name, l.country, l.city, l.category, l.website, l.phone, l.contact_email,
            l.rating, l.reviews, l.status, l.audit_score, l.audit_reasons,
            l.qualify_decision, l.qualify_value_usd, l.error_stage, l.error, l.updated_at,
            n.name AS niche_name, n.slug AS niche_slug
       FROM leads l
       LEFT JOIN niches n ON n.id = l.niche_id
       ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
       ORDER BY l.audit_score DESC NULLS LAST, l.updated_at DESC
       LIMIT $${params.length}`,
    params
  );
  res.json(rows);
});

// Bulk re-audit (multi-select on the pipeline table).
router.post('/leads/bulk/audit', async (req, res) => {
  const ids = Array.isArray(req.body?.ids) ? req.body.ids : [];
  if (!ids.length) return res.status(400).json({ error: 'ids[] required' });
  const queued = await rerun.enqueueAudit(ids);
  res.json({ ok: true, queued });
});

// Bulk close.
router.post('/leads/bulk/close', async (req, res) => {
  const ids = Array.isArray(req.body?.ids) ? req.body.ids : [];
  if (!ids.length) return res.status(400).json({ error: 'ids[] required' });
  const reason = (req.body?.reason || '').slice(0, 300) || null;
  for (const id of ids) {
    const [lead] = await store.q(`SELECT status FROM leads WHERE id = $1`, [id]);
    if (!lead || lead.status === 'closed') continue;
    await store.updateLead(id, { status: 'closed', hold_reason: reason });
    await store.recordEvent(id, lead.status, 'closed', { by: req.user?.email || 'admin', reason, bulk: true });
  }
  res.json({ ok: true, closed: ids.length });
});

router.get('/leads/:id', async (req, res) => {
  const [lead] = await store.q(`SELECT * FROM leads WHERE id = $1`, [req.params.id]);
  if (!lead) return res.status(404).json({ error: 'Lead not found' });
  const events = await store.q(
    `SELECT * FROM lead_events WHERE lead_id = $1 ORDER BY created_at DESC LIMIT 100`,
    [req.params.id]
  );
  const notes = await store.listNotes(req.params.id);
  const outreach = await store.listOutreach(req.params.id);

  // Assets are streamed back through this API (works with plain ADC — no
  // service-account signing key needed locally or on Cloud Run).
  const manual = lead.manual_assets || {};
  const sig = lead.audit_signals || {};
  const media = {};
  let designSystem = null;
  if (gcs.isEnabled) {
    const asset = (key) => key ? `/api/app/leadgen/leads/${lead.id}/asset?key=${encodeURIComponent(key)}` : null;
    const screenshotKey = manual.screenshot_removed ? null : (manual.screenshot || sig.screenshot);
    const logoKey = manual.logo_removed ? null : (manual.logo || sig.logo);
    media.beforeScreenshot = asset(screenshotKey);
    media.screenshotIsManual = !!manual.screenshot;
    media.screenshotIsRemoved = !!manual.screenshot_removed;
    media.logo = asset(logoKey);
    media.logoIsManual = !!manual.logo;
    media.logoIsRemoved = !!manual.logo_removed;
    media.logoSourceUrl = sig.logo_url || null;
    media.mockup = asset(lead.mockup_gcs_key);
    // Cache-bust: proposal.pdf keeps the same GCS key across rebuilds, but the
    // asset stream is cached client-side (Cache-Control below) — without a
    // version param a rebuilt PDF keeps showing the pre-rebuild cached copy.
    const proposalUrl = asset(lead.proposal_gcs_key);
    media.proposalPdf = proposalUrl ? `${proposalUrl}&v=${encodeURIComponent(new Date(lead.updated_at).getTime())}` : null;
    if (lead.gcs_prefix) {
      const root = lead.gcs_prefix.replace(/\/scrape$/, ''); // tolerate older rows
      const dsKey = `${root}/scrape/data/design-system.json`;
      media.designSystemJson = asset(dsKey);
      try { designSystem = await gcs.readJson(dsKey); } catch (_) { /* ignore */ }
    }
  }

  const threshold = await settings.minScoreFor(lead);
  const effectiveScore = lead.score_override ?? lead.audit_score ?? null;

  res.json({ lead, events, media, notes, outreach, designSystem, threshold, effectiveScore });
});

// Upload / replace a lead asset. Body: { kind: 'screenshot'|'logo'|'mockup', filename, dataBase64 }
// 'mockup' is special: it's the redesign image, so it also flips the lead to
// building_pdf and auto-builds the pitch PDF (see services/leadgen/designIntake.js).
const ASSET_EXT = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', webp: 'image/webp', svg: 'image/svg+xml', gif: 'image/gif' };
router.post('/leads/:id/asset', async (req, res) => {
  if (!gcs.isEnabled) return res.status(503).json({ error: 'GCS not configured' });
  const { kind, filename, dataBase64 } = req.body || {};
  if (!['screenshot', 'logo', 'mockup'].includes(kind)) {
    return res.status(400).json({ error: "kind must be 'screenshot', 'logo', or 'mockup'" });
  }
  if (!dataBase64) return res.status(400).json({ error: 'dataBase64 required' });

  const ext = String(filename || '').split('.').pop().toLowerCase();
  const contentType = ASSET_EXT[ext];
  if (!contentType) return res.status(400).json({ error: `unsupported file type: .${ext}` });
  const buf = Buffer.from(dataBase64.replace(/^data:[^,]+,/, ''), 'base64');
  if (buf.length > 8 * 1024 * 1024) return res.status(413).json({ error: 'file over 8 MB' });

  if (kind === 'mockup') {
    try {
      const result = await designIntake.receiveMockup(req.params.id, buf, ext, { source: req.user?.email || 'manual-upload' });
      return res.json({ ok: true, kind, ...result });
    } catch (err) {
      return res.status(400).json({ error: err.message });
    }
  }

  const [lead] = await store.q(`SELECT id, manual_assets FROM leads WHERE id = $1`, [req.params.id]);
  if (!lead) return res.status(404).json({ error: 'Lead not found' });
  const key = `companies/${lead.id}/manual/${kind}.${ext === 'jpeg' ? 'jpg' : ext}`;
  await gcs.uploadFile(key, buf, contentType);
  // Uploading a new asset supersedes an earlier "remove" — undo that flag.
  const nextAssets = { ...(lead.manual_assets || {}), [kind]: key };
  delete nextAssets[`${kind}_removed`];
  await store.updateLead(lead.id, { manual_assets: nextAssets });
  await store.recordEvent(lead.id, null, null, { uploaded: kind, by: req.user?.email || 'admin' });
  res.json({ ok: true, kind, key });
});

// Fully clear an asset (logo/screenshot) — unlike DELETE /asset/:kind (which
// only reverts a manual upload back to the auto-scraped one), this blanks it
// out regardless of source, e.g. when a business genuinely has no logo.
router.post('/leads/:id/asset/:kind/remove', async (req, res) => {
  const { kind } = req.params;
  if (!['screenshot', 'logo'].includes(kind)) return res.status(400).json({ error: 'bad kind' });
  const [lead] = await store.q(`SELECT id, manual_assets FROM leads WHERE id = $1`, [req.params.id]);
  if (!lead) return res.status(404).json({ error: 'Lead not found' });
  const next = { ...(lead.manual_assets || {}) };
  delete next[kind];
  next[`${kind}_removed`] = true;
  await store.updateLead(lead.id, { manual_assets: next });
  await store.recordEvent(lead.id, null, null, { removed: kind, by: req.user?.email || 'admin' });
  res.json({ ok: true });
});

// Remove a manual asset override (revert to the scraped one).
router.delete('/leads/:id/asset/:kind', async (req, res) => {
  const { kind } = req.params;
  if (!['screenshot', 'logo'].includes(kind)) return res.status(400).json({ error: 'bad kind' });
  const [lead] = await store.q(`SELECT id, manual_assets FROM leads WHERE id = $1`, [req.params.id]);
  if (!lead) return res.status(404).json({ error: 'Lead not found' });
  const next = { ...(lead.manual_assets || {}) };
  delete next[kind];
  await store.updateLead(lead.id, { manual_assets: next });
  res.json({ ok: true });
});

// Edit lead fields (website, name, contact, address, category, ...).
router.patch('/leads/:id', async (req, res) => {
  const [lead] = await store.q(`SELECT * FROM leads WHERE id = $1`, [req.params.id]);
  if (!lead) return res.status(404).json({ error: 'Lead not found' });
  const updated = await store.editLead(req.params.id, req.body || {});
  if (!updated) return res.status(400).json({ error: 'no editable fields supplied' });
  const changed = Object.keys(req.body || {}).filter((k) => lead[k] !== updated[k]);
  if (changed.length) {
    await store.recordEvent(req.params.id, lead.status, lead.status, {
      edited: changed, by: req.user?.email || 'admin',
    });
  }
  res.json(updated);
});

// Approve a waiting_approval lead -> queued for the design MCP / manual upload.
router.post('/leads/:id/approve', async (req, res) => {
  const [lead] = await store.q(`SELECT * FROM leads WHERE id = $1`, [req.params.id]);
  if (!lead) return res.status(404).json({ error: 'Lead not found' });
  if (lead.status !== 'waiting_approval') {
    return res.status(400).json({ error: `lead is ${lead.status}, expected waiting_approval` });
  }
  await store.updateLead(lead.id, {
    status: 'approved_ready_for_ui',
    approved_at: new Date().toISOString(),
    approved_by: req.user?.email || 'admin',
  });
  await store.recordEvent(lead.id, lead.status, 'approved_ready_for_ui', { by: req.user?.email || 'admin' });
  res.json({ ok: true, status: 'approved_ready_for_ui' });
});

// Reject a lead during review.
router.post('/leads/:id/reject', async (req, res) => {
  const [lead] = await store.q(`SELECT * FROM leads WHERE id = $1`, [req.params.id]);
  if (!lead) return res.status(404).json({ error: 'Lead not found' });
  await store.updateLead(lead.id, {
    status: 'disqualified',
    qualify_decision: 'rejected',
    disqualify_reason: (req.body?.reason || 'manual reject').slice(0, 300),
  });
  await store.recordEvent(lead.id, lead.status, 'disqualified', { by: req.user?.email || 'admin', reason: req.body?.reason });
  res.json({ ok: true, status: 'disqualified' });
});

// Manually override the opportunity score, then re-route.
router.post('/leads/:id/score', async (req, res) => {
  const score = Number(req.body?.score);
  if (!Number.isInteger(score) || score < 0 || score > 100) {
    return res.status(400).json({ error: 'score must be an integer 0-100' });
  }
  const [lead] = await store.q(`SELECT * FROM leads WHERE id = $1`, [req.params.id]);
  if (!lead) return res.status(404).json({ error: 'Lead not found' });
  await store.updateLead(lead.id, { score_override: score, score_override_by: req.user?.email || 'admin' });
  await store.recordEvent(lead.id, lead.status, lead.status, { score_override: score, by: req.user?.email || 'admin' });
  const [fresh] = await store.q(`SELECT * FROM leads WHERE id = $1`, [req.params.id]);
  const routed = await reevaluate(fresh);
  res.json({ ok: true, score_override: score, ...routed });
});

// Re-run scrape + audit on one lead.
router.post('/leads/:id/audit', async (req, res) => {
  const [lead] = await store.q(`SELECT id FROM leads WHERE id = $1`, [req.params.id]);
  if (!lead) return res.status(404).json({ error: 'Lead not found' });
  await rerun.enqueueAudit([req.params.id]);
  res.json({ ok: true, queued: 1 });
});

// Re-render the PDF from the current mockup/company settings/lead data — no
// re-scrape, no re-qualify, no new image needed. Use after a template change,
// an edited lead field, or an updated company profile.
router.post('/leads/:id/rebuild-proposal', async (req, res) => {
  const [lead] = await store.q(`SELECT * FROM leads WHERE id = $1`, [req.params.id]);
  if (!lead) return res.status(404).json({ error: 'Lead not found' });
  if (!lead.mockup_gcs_key) {
    return res.status(400).json({ error: 'Lead has no redesign mockup yet — upload one first.' });
  }
  try {
    const { buildProposalPdf } = require('../../services/leadgen/proposalPdf');
    const { proposalKey } = await buildProposalPdf(lead.id);
    await store.updateLead(lead.id, { proposal_gcs_key: proposalKey, error: null, error_stage: null });
    await store.recordEvent(lead.id, lead.status, lead.status, { rebuiltProposal: true, by: req.user?.email || 'admin' });
    res.json({ ok: true, proposalKey });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// A lead in any of these statuses hasn't been reached out to yet — any of the
// three contact actions (call/whatsapp/email) advances it to 'contacted'.
const PRE_CONTACT_STATUSES = ['queued_for_contact', 'building_pdf', 'approved_ready_for_ui', 'building_ui'];

function geminiOutreach(lead) {
  return lead.qualify_raw && !lead.qualify_raw.error ? lead.qualify_raw : null;
}

// Draft the outreach email — prefilled subject/body for the compose modal.
// Not a send; purely computed from lead + company data each time it's opened.
// Prefers Gemini's own draft (written at qualification time) and falls back
// to a plain template for leads qualified before that existed.
router.get('/leads/:id/email-draft', async (req, res) => {
  const [lead] = await store.q(`SELECT * FROM leads WHERE id = $1`, [req.params.id]);
  if (!lead) return res.status(404).json({ error: 'Lead not found' });
  const company = await settings.getCompany();
  const verdict = geminiOutreach(lead);

  const subject = verdict?.email_subject || `A quick redesign idea for ${lead.name}`;
  // No Gemini draft yet for this lead (qualified before that existed) — fall
  // back to whatever real data we already have rather than an unbacked
  // generic compliment. Re-running qualification backfills a proper
  // Gemini-personalized opener.
  const opener = (lead.rating && lead.reviews)
    ? `I came across ${lead.name} online — a ${lead.rating}★ rating from ${lead.reviews} reviews says a lot about how well you take care of your customers.`
    : `I came across ${lead.name} online and wanted to reach out directly.`;
  const body = verdict?.email_body || `Hi there,

${opener}

I'm from India and I help businesses like yours grow and actually stand out against your competitors.

So I've created a sample redesign of your website, I've attached it in the mail. I'd love for you to check it out — if you like it, simply click the "Yes, I'm interested" button inside the PDF and we'll give you a call.

In the age of AI, this is a pressing opportunity for making your digital presence stand out with AI. Hope to hear from you soon.

Warm regards,
Shubh`;

  res.json({
    to: lead.contact_email || '',
    from: `${company.name || 'Your Agency'} <${process.env.ZOHO_SMTP_USER || ''}>`,
    subject,
    body,
    canSend: mailer.isEnabled,
    hasProposal: !!lead.proposal_gcs_key,
    aiGenerated: !!verdict?.email_body,
  });
});

// Send the drafted email (admin-reviewed/edited) with the proposal PDF
// attached. Manual, one-lead-at-a-time — not a bulk sender.
router.post('/leads/:id/send-email', async (req, res) => {
  if (!mailer.isEnabled) return res.status(503).json({ error: 'Email sending is not configured (ZOHO_SMTP_USER / ZOHO_SMTP_PASS missing)' });
  const { to, subject, body } = req.body || {};
  if (!to || !subject || !body) return res.status(400).json({ error: 'to, subject, and body are required' });

  const [lead] = await store.q(`SELECT * FROM leads WHERE id = $1`, [req.params.id]);
  if (!lead) return res.status(404).json({ error: 'Lead not found' });
  if (!lead.proposal_gcs_key) return res.status(400).json({ error: 'Lead has no proposal PDF yet — build one first.' });
  if (await store.isSuppressed(to)) return res.status(400).json({ error: `${to} is on the suppression list` });

  const company = await settings.getCompany();
  try {
    const { messageId } = await mailer.sendMail({
      to, subject, body,
      fromName: company.name,
      replyTo: company.contact_email,
      attachmentKey: lead.proposal_gcs_key,
      attachmentName: `${(lead.name || 'proposal').replace(/[^a-z0-9]+/gi, '-')}-proposal.pdf`,
    });
    await store.recordOutreach(lead.id, { to, subject, body, espMessageId: messageId });
    const nextStatus = PRE_CONTACT_STATUSES.includes(lead.status) ? 'contacted' : lead.status;
    await store.updateLead(lead.id, { status: nextStatus });
    await store.recordEvent(lead.id, lead.status, nextStatus, { channel: 'email', by: req.user?.email || 'admin', to, subject, messageId });
    res.json({ ok: true, status: nextStatus, messageId });
  } catch (err) {
    try { await store.recordOutreach(lead.id, { to, subject, body, status: 'failed' }); } catch (_) { /* best effort */ }
    res.status(500).json({ error: err.message });
  }
});

// Draft the phone-call script (Gemini-written at qualification time; falls
// back to a plain skeleton for leads qualified before this existed).
router.get('/leads/:id/call-script', async (req, res) => {
  const [lead] = await store.q(`SELECT * FROM leads WHERE id = $1`, [req.params.id]);
  if (!lead) return res.status(404).json({ error: 'Lead not found' });
  const verdict = geminiOutreach(lead);
  const script = (verdict?.call_script || `Hi, is this ${lead.name}? I put together a quick redesign concept for your website and ` +
    `wanted to see if you'd be open to a short look. ${lead.qualify_angle || ''}`).trim();
  res.json({ script, phone: lead.phone_intl || lead.phone || '', aiGenerated: !!verdict?.call_script });
});

// Draft the WhatsApp message (Gemini-written at qualification time). No send
// API — the popup opens a wa.me deep link with this text pre-filled, or lets
// the admin copy it, and the admin sends it themselves from their own WhatsApp.
router.get('/leads/:id/whatsapp-draft', async (req, res) => {
  const [lead] = await store.q(`SELECT * FROM leads WHERE id = $1`, [req.params.id]);
  if (!lead) return res.status(404).json({ error: 'Lead not found' });
  const verdict = geminiOutreach(lead);
  const message = verdict?.whatsapp_message ||
    `Hi! I put together a quick website redesign concept for ${lead.name} — mind if I send it over?`;
  res.json({ message, phone: lead.phone_intl || lead.phone || '', aiGenerated: !!verdict?.whatsapp_message });
});

// Manually mark a lead as contacted via a channel with no delivery
// confirmation (a phone call, or a WhatsApp message sent from the admin's own
// phone) — optionally logging a note in the same call. Email marks itself
// contacted on send; this covers the other two Contact-card buttons.
router.post('/leads/:id/mark-contacted', async (req, res) => {
  const { channel, note } = req.body || {};
  if (!['call', 'whatsapp'].includes(channel)) return res.status(400).json({ error: "channel must be 'call' or 'whatsapp'" });
  const [lead] = await store.q(`SELECT * FROM leads WHERE id = $1`, [req.params.id]);
  if (!lead) return res.status(404).json({ error: 'Lead not found' });

  const nextStatus = PRE_CONTACT_STATUSES.includes(lead.status) ? 'contacted' : lead.status;
  await store.updateLead(lead.id, { status: nextStatus });
  await store.recordEvent(lead.id, lead.status, nextStatus, { channel, by: req.user?.email || 'admin' });
  await store.recordOutreach(lead.id, { to: lead.phone_intl || lead.phone || '', subject: null, body: note || null, status: 'sent' });
  if (note && note.trim()) await store.addNote(lead.id, note.trim(), req.user?.email || 'admin');
  res.json({ ok: true, status: nextStatus });
});

// Notes.
router.post('/leads/:id/notes', async (req, res) => {
  const body = (req.body?.body || '').trim();
  if (!body) return res.status(400).json({ error: 'body required' });
  const [lead] = await store.q(`SELECT id FROM leads WHERE id = $1`, [req.params.id]);
  if (!lead) return res.status(404).json({ error: 'Lead not found' });
  const note = await store.addNote(req.params.id, body.slice(0, 4000), req.user?.email || 'admin');
  res.status(201).json(note);
});

router.delete('/leads/:id/notes/:noteId', async (req, res) => {
  await store.deleteNote(req.params.id, req.params.noteId);
  res.json({ ok: true });
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

  // A PDF-stage failure already has the mockup — just rebuild the PDF and
  // advance, the same way receiveMockup's success path does.
  if (lead.error_stage === 'pdf' && lead.mockup_gcs_key) {
    try {
      const { buildProposalPdf } = require('../../services/leadgen/proposalPdf');
      const { proposalKey } = await buildProposalPdf(lead.id);
      await store.updateLead(lead.id, { proposal_gcs_key: proposalKey, status: 'queued_for_contact', error: null, error_stage: null });
      await store.recordEvent(lead.id, 'error', 'queued_for_contact', { manualRetry: true, stage: 'pdf' });
      return res.json({ ok: true, status: 'queued_for_contact' });
    } catch (err) {
      return res.status(500).json({ error: `PDF rebuild failed again: ${err.message}` });
    }
  }

  const back = {
    scrape: 'discovered', audit: 'scraped', qualify: 'audited',
    design: 'approved_ready_for_ui',
  };
  const to = back[lead.error_stage] || 'discovered';
  await store.updateLead(lead.id, { status: to, error: null, error_stage: null });
  await store.recordEvent(lead.id, 'error', to, { manualRetry: true });
  res.json({ ok: true, status: to });
});

module.exports = router;
