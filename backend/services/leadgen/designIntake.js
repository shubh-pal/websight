/**
 * Single entry point for "a redesign mockup image arrived for this lead" —
 * used by the manual dashboard upload AND the design MCP's submit_design
 * tool. Stores the image, flips the lead to building_pdf, then immediately
 * builds the pitch PDF (Puppeteer only — no paid API call) and queues it for
 * contact.
 *
 * Status flow after approval:
 *   approved_ready_for_ui  -- design MCP pulls the brief -->  building_ui
 *   (either of those)      -- mockup arrives            -->  building_pdf
 *   building_pdf            -- PDF built                -->  queued_for_contact
 */
const gcs = require('../gcsStorage');
const store = require('./store');
const { buildProposalPdf } = require('./proposalPdf');

const CONTENT_TYPE = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', webp: 'image/webp' };

// A mockup can be uploaded/replaced any time from "approved" onward — including
// after the proposal already went out, so a correction just rebuilds the PDF
// and re-queues it.
const MOCKUP_ELIGIBLE_STATUSES = [
  'approved_ready_for_ui', 'building_ui', 'building_pdf', 'queued_for_contact',
  'contacted', 'replied', 'bounced', 'error',
];

async function receiveMockup(leadId, buffer, ext, { source = 'manual' } = {}) {
  if (!gcs.isEnabled) throw new Error('GCS not configured');
  const contentType = CONTENT_TYPE[ext];
  if (!contentType) throw new Error(`unsupported image type: .${ext}`);
  if (buffer.length > 8 * 1024 * 1024) throw new Error('image over 8 MB');

  const [lead] = await store.q(`SELECT * FROM leads WHERE id = $1`, [leadId]);
  if (!lead) throw new Error('lead not found');
  if (!MOCKUP_ELIGIBLE_STATUSES.includes(lead.status)) {
    throw new Error(`lead is '${lead.status}' — approve it first (must be past 'waiting_approval')`);
  }

  const key = `companies/${leadId}/mockup.${ext === 'jpeg' ? 'jpg' : ext}`;
  await gcs.uploadFile(key, buffer, contentType);
  await store.updateLead(leadId, { mockup_gcs_key: key, status: 'building_pdf', error: null, error_stage: null });
  await store.recordEvent(leadId, lead.status, 'building_pdf', { source });

  try {
    const { proposalKey } = await buildProposalPdf(leadId);
    await store.updateLead(leadId, { proposal_gcs_key: proposalKey, status: 'queued_for_contact' });
    await store.recordEvent(leadId, 'building_pdf', 'queued_for_contact', { source: 'auto-pdf' });
    return { status: 'queued_for_contact', mockupKey: key, proposalKey };
  } catch (err) {
    await store.markError({ id: leadId, status: 'building_pdf', attempts: lead.attempts }, 'pdf', err);
    throw err;
  }
}

/** List leads waiting on a redesign image (for the design MCP / a review page). */
async function listPending(limit = 25) {
  return store.q(
    `SELECT * FROM leads WHERE status IN ('approved_ready_for_ui', 'building_ui')
      ORDER BY approved_at ASC NULLS LAST, updated_at ASC LIMIT $1`,
    [limit]
  );
}

/** The design MCP pulled the brief for this lead — mark it actively in progress. */
async function markBuildingUi(leadId) {
  const [lead] = await store.q(`SELECT id, status FROM leads WHERE id = $1`, [leadId]);
  if (!lead) return;
  if (lead.status !== 'approved_ready_for_ui') return;
  await store.updateLead(leadId, { status: 'building_ui' });
  await store.recordEvent(leadId, 'approved_ready_for_ui', 'building_ui', { source: 'design-mcp' });
}

module.exports = { receiveMockup, listPending, markBuildingUi };
