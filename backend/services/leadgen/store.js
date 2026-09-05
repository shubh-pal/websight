/**
 * Thin data-access helpers for the agency pipeline tables.
 */
const db = require('../../db');

async function q(text, params) {
  const { rows } = await db.query(text, params);
  return rows;
}

async function createRun(grid, requestedBy, nicheId = null) {
  const [row] = await q(
    `INSERT INTO lead_runs (grid, requested_by, niche_id) VALUES ($1::jsonb, $2, $3) RETURNING *`,
    [JSON.stringify(grid), requestedBy || null, nicheId]
  );
  return row;
}

async function finishRun(id, { places_calls, new_leads, status = 'done', error = null }) {
  await q(
    `UPDATE lead_runs
        SET places_calls = $2, new_leads = $3, status = $4, error = $5, finished_at = NOW()
      WHERE id = $1`,
    [id, places_calls, new_leads, status, error]
  );
}

/**
 * Insert a business if its place_id is new. Refreshes volatile Places fields
 * (rating/reviews/phone/website/status) on conflict but never resets `status`.
 * @returns {Promise<boolean>} true if newly inserted
 */
async function upsertLead(runId, b, nicheId = null) {
  const rows = await q(
    `INSERT INTO leads
       (run_id, niche_id, place_id, name, country, city, category, address, phone, phone_intl,
        website, rating, reviews, business_status, maps_uri, places_refreshed_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15, NOW())
     ON CONFLICT (place_id) DO UPDATE SET
       phone = EXCLUDED.phone,
       phone_intl = EXCLUDED.phone_intl,
       website = EXCLUDED.website,
       rating = EXCLUDED.rating,
       reviews = EXCLUDED.reviews,
       business_status = EXCLUDED.business_status,
       niche_id = COALESCE(leads.niche_id, EXCLUDED.niche_id),
       places_refreshed_at = NOW()
     RETURNING (xmax = 0) AS inserted`,
    [
      runId, nicheId, b.place_id, b.name, b.country, b.city || null, b.category || null,
      b.address, b.phone, b.phone_intl, b.website, b.rating, b.reviews,
      b.business_status, b.maps_uri,
    ]
  );
  return rows[0]?.inserted === true;
}

/**
 * Manually add one lead (from a picked Places search result, or a raw
 * website URL) — used by the "Add lead" flow, not the discovery sweep.
 * @returns {Promise<{id: string, created: boolean}>}
 */
async function createManualLead(b, nicheId = null) {
  const existing = await q(`SELECT id FROM leads WHERE place_id = $1`, [b.place_id]);
  if (existing[0]) return { id: existing[0].id, created: false };

  const [row] = await q(
    `INSERT INTO leads
       (run_id, niche_id, place_id, name, country, city, category, address, phone, phone_intl,
        website, rating, reviews, business_status, maps_uri, places_refreshed_at)
     VALUES (NULL,$1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14, NOW())
     ON CONFLICT (place_id) DO NOTHING
     RETURNING id`,
    [
      nicheId, b.place_id, b.name, b.country || null, b.city || null, b.category || null,
      b.address || null, b.phone || null, b.phone_intl || null, b.website || null,
      b.rating ?? null, b.reviews ?? null, b.business_status || null, b.maps_uri || null,
    ]
  );
  if (row) return { id: row.id, created: true };
  // Lost a race with a concurrent insert of the same place_id.
  const [after] = await q(`SELECT id FROM leads WHERE place_id = $1`, [b.place_id]);
  return { id: after.id, created: false };
}

async function claimLeads(fromStatus, toStatus, limit) {
  // Atomically move a batch so concurrent ticks don't double-process.
  return q(
    `UPDATE leads SET status = $2, updated_at = NOW()
       WHERE id IN (
         SELECT id FROM leads
          WHERE status = $1
          ORDER BY created_at
          LIMIT $3
          FOR UPDATE SKIP LOCKED
       )
     RETURNING *`,
    [fromStatus, toStatus, limit]
  );
}

async function updateLead(id, patch) {
  const keys = Object.keys(patch);
  if (!keys.length) return;
  const JSONB_COLS = new Set(['audit_signals', 'qualify_raw', 'redesign_concept', 'attempts', 'manual_assets']);
  const sets = keys
    .map((k, i) => `${k} = $${i + 2}${JSONB_COLS.has(k) ? '::jsonb' : ''}`)
    .join(', ');
  const vals = keys.map((k) => {
    const v = patch[k];
    return JSONB_COLS.has(k) || (v !== null && typeof v === 'object') ? JSON.stringify(v) : v;
  });
  await q(`UPDATE leads SET ${sets}, updated_at = NOW() WHERE id = $1`, [id, ...vals]);
}

async function setStatus(id, status, extra = {}) {
  await updateLead(id, { status, ...extra });
}

async function recordEvent(leadId, from, to, detail = null) {
  await q(
    `INSERT INTO lead_events (lead_id, from_status, to_status, detail)
     VALUES ($1,$2,$3,$4::jsonb)`,
    [leadId, from, to, detail ? JSON.stringify(detail) : null]
  );
}

async function markError(lead, stage, err) {
  const attempts = { ...(lead.attempts || {}) };
  attempts[stage] = (attempts[stage] || 0) + 1;
  await updateLead(lead.id, {
    status: 'error',
    error_stage: stage,
    error: String(err && err.message ? err.message : err).slice(0, 500),
    attempts,
  });
  await recordEvent(lead.id, lead.status, 'error', { stage });
}

const EDITABLE_LEAD_COLS = ['name', 'website', 'contact_email', 'phone', 'phone_intl', 'address', 'category', 'city', 'country', 'rating', 'reviews', 'score_override', 'score_override_by'];

async function editLead(id, patch) {
  const keys = Object.keys(patch).filter((k) => EDITABLE_LEAD_COLS.includes(k));
  if (!keys.length) return null;
  const sets = keys.map((k, i) => `${k} = $${i + 2}`).join(', ');
  await q(`UPDATE leads SET ${sets}, updated_at = NOW() WHERE id = $1`, [id, ...keys.map((k) => patch[k])]);
  const [row] = await q(`SELECT * FROM leads WHERE id = $1`, [id]);
  return row;
}

async function addNote(leadId, body, author) {
  const [row] = await q(
    `INSERT INTO lead_notes (lead_id, body, author) VALUES ($1, $2, $3) RETURNING *`,
    [leadId, body, author || null]
  );
  return row;
}

async function listNotes(leadId) {
  return q(`SELECT * FROM lead_notes WHERE lead_id = $1 ORDER BY created_at DESC`, [leadId]);
}

async function deleteNote(leadId, noteId) {
  await q(`DELETE FROM lead_notes WHERE id = $1 AND lead_id = $2`, [noteId, leadId]);
}

async function summary() {
  const rows = await q(
    `SELECT status, COUNT(*)::int AS count FROM leads GROUP BY status`
  );
  return Object.fromEntries(rows.map((r) => [r.status, r.count]));
}

async function isSuppressed(email) {
  if (!email) return false;
  const [row] = await q(`SELECT 1 FROM suppressions WHERE email = $1`, [email.toLowerCase()]);
  return !!row;
}

async function recordOutreach(leadId, { to, subject, body, espMessageId, status = 'sent' }) {
  await q(
    `INSERT INTO outreach_messages (lead_id, to_address, subject, body, esp_message_id, status, sent_at)
     VALUES ($1,$2,$3,$4,$5,$6, CASE WHEN $6 = 'sent' THEN NOW() ELSE NULL END)`,
    [leadId, to, subject, body, espMessageId || null, status]
  );
}

async function listOutreach(leadId) {
  return q(`SELECT * FROM outreach_messages WHERE lead_id = $1 ORDER BY created_at DESC`, [leadId]);
}

module.exports = {
  q,
  createRun,
  finishRun,
  upsertLead,
  createManualLead,
  claimLeads,
  updateLead,
  setStatus,
  recordEvent,
  markError,
  editLead,
  addNote,
  listNotes,
  deleteNote,
  summary,
  isSuppressed,
  recordOutreach,
  listOutreach,
};
