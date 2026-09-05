/**
 * Public "Yes, I'm interested" link — the button on the last page of the
 * pitch PDF. No auth (a prospect clicking a link in their email/PDF has no
 * session); the lead id in the URL is an unguessable UUID, and the only
 * effect of hitting this is marking that one lead as having replied.
 */
const express = require('express');
const store = require('../services/leadgen/store');

const router = express.Router();

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function page({ title, heading, body }) {
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${title}</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Fraunces:opsz,wght@9..144,600;9..144,700&display=swap');
  :root { --ink:#142235; --navy:#10233b; --gold:#bd8a3d; --paper:#f6f1e8; --cream:#fffdf8; --muted:#68717d; }
  * { box-sizing: border-box; }
  html,body { margin:0; height:100%; }
  body {
    font-family: Inter, sans-serif; color: var(--ink); background: var(--paper);
    display:flex; align-items:center; justify-content:center; padding:24px;
  }
  .card {
    max-width: 460px; width:100%; background: var(--cream); border-radius: 18px;
    box-shadow: 0 28px 70px rgba(22,31,45,.15); padding: 44px 38px; text-align:center;
  }
  h1 { font-family: Fraunces, Georgia, serif; font-weight:700; font-size:28px; letter-spacing:-.03em; margin:0 0 14px; color: var(--navy); }
  p { font-size:15px; line-height:1.6; color: var(--muted); margin:0; }
  .mark { width:52px; height:52px; border-radius:50%; background: rgba(189,138,61,.15); border:1px solid rgba(189,138,61,.4);
    display:flex; align-items:center; justify-content:center; margin:0 auto 20px; font-size:24px; color: var(--gold); }
</style></head>
<body><div class="card"><div class="mark">✓</div><h1>${heading}</h1>${body}</div></body></html>`;
}

router.get('/interested/:leadId', async (req, res) => {
  const { leadId } = req.params;
  if (!UUID_RE.test(leadId)) {
    return res.status(400).send(page({
      title: 'Something went wrong',
      heading: "That link isn't quite right",
      body: '<p>Please reach out to whoever sent you the proposal and ask them to resend it.</p>',
    }));
  }

  const [lead] = await store.q(`SELECT id, name, status FROM leads WHERE id = $1`, [leadId]);
  if (!lead) {
    return res.status(404).send(page({
      title: 'Something went wrong',
      heading: "We couldn't find that proposal",
      body: '<p>This link may be out of date. Reach out to whoever sent it to you and ask for a fresh one.</p>',
    }));
  }

  if (lead.status !== 'closed') {
    const nextStatus = 'replied';
    await store.q(
      `UPDATE leads SET status = $2, interested_at = COALESCE(interested_at, NOW()) WHERE id = $1`,
      [lead.id, nextStatus]
    );
    await store.recordEvent(lead.id, lead.status, nextStatus, { source: 'pdf-interest-button' });
  }

  res.send(page({
    title: 'Thank you!',
    heading: "Thank you, we've got your interest",
    body: `<p>We'll reach out to you soon${lead.name ? ` about the redesign for <strong>${esc(lead.name)}</strong>` : ''} to take the next step.</p>`,
  }));
});

module.exports = router;
