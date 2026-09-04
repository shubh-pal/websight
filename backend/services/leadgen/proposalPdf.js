/**
 * Builds the pitch PDF as a 16:9 slide deck (960x540pt, PowerPoint widescreen)
 * once a redesign mockup exists. Puppeteer only — no external API calls, no
 * per-PDF cost.
 *
 * Ported from the approved "v3 — Creative" draft
 * (backend/templates/pitch/v3-creative.html). Keep that file and this
 * renderer in sync if the design changes again.
 */
const puppeteer = require('puppeteer');
const gcs = require('../gcsStorage');
const store = require('./store');
const settings = require('./settings');

function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

async function toDataUrl(key) {
  if (!key || !gcs.isEnabled) return null;
  try {
    const buf = await gcs.downloadBuffer(key);
    if (!buf) return null;
    const ext = key.split('.').pop().toLowerCase();
    const mime = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', webp: 'image/webp', svg: 'image/svg+xml', gif: 'image/gif' }[ext] || 'image/png';
    return `data:${mime};base64,${buf.toString('base64')}`;
  } catch (_) {
    return null;
  }
}

function duoMedia(url) {
  return url
    ? `<img src="${url}" />`
    : `<div class="placeholder" style="width:100%;height:100%"><span>no image yet</span></div>`;
}

function renderHtml({ lead, company, designSystem, mockup, before }) {
  const colors = designSystem?.colors || {};
  const fonts = designSystem?.fonts || {};
  const verdict = lead.qualify_raw && !lead.qualify_raw.error ? lead.qualify_raw : null;
  const headline = verdict?.pitch_angle || `${lead.name}, it's time to stand out online.`;
  const location = [lead.city, lead.country].filter(Boolean).join(', ');
  const accent = colors.accent || colors.primary || '#b45309';
  const headingFont = fonts.heading || 'serif';
  const bodyFont = fonts.body || 'sans-serif';
  const pricePerPage = company.price_per_page ?? company.price_min ?? 200;

  return `<!doctype html><html><head><meta charset="utf-8"><style>
    @import url('https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,500;9..144,600;9..144,700&family=Inter:wght@400;500;600;700&display=swap');
    * { box-sizing: border-box; }
    html, body { margin: 0; padding: 0; }
    body { font-family: 'Inter', sans-serif; }
    .slide {
      width: 1280px; height: 720px; position: relative; overflow: hidden;
      background: #faf9f6; color: #1c1917; page-break-after: always;
    }
    .slide:last-child { page-break-after: auto; }
    .pad { padding: 60px 72px; height: 100%; box-sizing: border-box; position: relative; z-index: 2; }
    .serif { font-family: 'Fraunces', serif; margin: 0; letter-spacing: -0.01em; }
    .kicker { text-transform: uppercase; letter-spacing: 0.18em; font-size: 11.5px; font-weight: 600; color: #78716c; }
    p { line-height: 1.65; font-size: 16px; color: #57534e; margin: 0; }
    .rule { height: 1px; background: #d6d3cd; border: none; }
    .num-watermark { position: absolute; font-family: 'Fraunces', serif; font-weight: 600; font-size: 280px; color: rgba(0,0,0,0.045); line-height: 1; z-index: 0; user-select: none; }
    .page-num { position: absolute; bottom: 28px; right: 32px; font-size: 12px; color: #a8a29e; z-index: 3; }
    .page-num.on-dark { color: rgba(255,255,255,0.5); }

    .duo { position: absolute; inset: 0; z-index: 0; }
    .duo img, .duo .placeholder { width: 100%; height: 100%; object-fit: cover; filter: grayscale(1) contrast(1.05); }
    .duo-tint { position: absolute; inset: 0; mix-blend-mode: multiply; }
    .duo-scrim { position: absolute; inset: 0; background: linear-gradient(0deg, rgba(20,17,15,0.94) 10%, rgba(20,17,15,0.15) 62%); }
    .cover-text { position: relative; z-index: 2; height: 100%; display: flex; flex-direction: column; justify-content: flex-end; color: #fff; }
    .cover-text h1 { font-size: 54px; line-height: 1.06; max-width: 900px; color: #fff; }
    .wordmark { position: absolute; top: 44px; left: 72px; z-index: 3; font-family: 'Fraunces', serif; font-weight: 600; font-size: 18px; color: #fff; }

    .filmstrip { display: flex; height: 100%; align-items: stretch; }
    .filmstrip .panel { flex: 1; position: relative; }
    .filmstrip .panel img, .filmstrip .panel .placeholder { width: 100%; height: 100%; object-fit: cover; filter: grayscale(0.15); }
    .filmstrip .caption { position: absolute; bottom: 26px; left: 26px; z-index: 3; }
    .filmstrip .caption .mono { font-size: 11px; letter-spacing: 0.1em; text-transform: uppercase; font-family: 'Inter'; }
    .filmstrip .caption .n { font-family: 'Fraunces', serif; font-size: 26px; color: #fff; }
    .filmstrip .divider-arrow { width: 64px; background: #1c1917; display: flex; align-items: center; justify-content: center; color: #faf9f6; font-size: 22px; z-index: 3; }
    .filmstrip .scrim { position: absolute; inset: 0; background: linear-gradient(0deg, rgba(0,0,0,0.55), transparent 50%); z-index: 2; }

    .palette-strip { display: flex; height: 90px; border-radius: 4px; overflow: hidden; margin-top: 26px; }
    .palette-strip div { flex: 1; }
    .glyph-row { display: flex; gap: 56px; margin-top: 30px; align-items: baseline; }
    .glyph-row .Aa { font-size: 110px; line-height: 1; }
    .glyph-row .meta { font-size: 12px; color: #78716c; margin-top: 8px; text-transform: uppercase; letter-spacing: 0.08em; }

    .placeholder { background: #e7e5e0; display: flex; align-items: center; justify-content: center; }
    .placeholder span { font-family: 'Inter'; font-size: 11px; text-transform: uppercase; letter-spacing: 0.08em; color: #a8a29e; }

    .price-fine { font-family: 'Fraunces', serif; font-size: 40px; }
  </style></head><body>

  <!-- 1/5 Cover -->
  <div class="slide">
    <div class="duo">${duoMedia(mockup)}</div>
    <div class="duo-tint" style="background:${accent}"></div>
    <div class="duo-scrim"></div>
    <div class="wordmark">${esc(company.name || 'Your Agency')}</div>
    <div class="cover-text pad">
      <div class="kicker" style="color:rgba(255,255,255,0.7)">Redesign proposal &middot; ${esc(lead.name)}${location ? ` &middot; ${esc(location)}` : ''}</div>
      <h1 class="serif">${esc(headline)}</h1>
      <p style="color:rgba(255,255,255,0.65);margin-top:16px;max-width:560px">${esc(lead.category || '')}${lead.category ? ' &mdash; ' : ''}prepared exclusively for ${esc(lead.name)}.</p>
    </div>
    <div class="num-watermark" style="bottom:-70px;right:20px;color:rgba(255,255,255,0.06)">01</div>
    <div class="page-num on-dark">01 / 05</div>
  </div>

  <!-- 2/5 Before/After filmstrip -->
  <div class="slide">
    <div class="filmstrip">
      <div class="panel">
        <div class="scrim"></div>
        ${duoMedia(before)}
        <div class="caption"><div class="n serif">Before</div><div class="mono" style="color:rgba(255,255,255,0.7)">current site</div></div>
      </div>
      <div class="divider-arrow">&rarr;</div>
      <div class="panel">
        <div class="scrim"></div>
        ${duoMedia(mockup)}
        <div class="caption"><div class="n serif">After</div><div class="mono" style="color:rgba(255,255,255,0.7)">the redesign</div></div>
      </div>
    </div>
    <div class="num-watermark" style="bottom:-60px;left:50%;transform:translateX(-50%);color:rgba(0,0,0,0.04)">02</div>
    <div class="page-num">02 / 05</div>
  </div>

  <!-- 3/5 The craft -->
  <div class="slide">
    <div class="num-watermark" style="top:-40px;left:40px">03</div>
    <div class="pad">
      <div class="kicker">The craft</div>
      <h2 class="serif" style="font-size:36px;margin:14px 0 4px">A system, not a template</h2>
      <p style="max-width:600px">Every color and typeface below is pulled from ${esc(lead.name)}'s own brand signals &mdash; the redesign extends what already exists.</p>
      ${Object.keys(colors).length ? `<div class="palette-strip">${Object.values(colors).filter(Boolean).map((v) => `<div style="background:${esc(v)}"></div>`).join('')}</div>` : ''}
      <div class="glyph-row">
        <div><div class="Aa" style="font-family:'${esc(headingFont)}',serif">Aa</div><div class="meta">${esc(headingFont)} &middot; Heading</div></div>
        <div><div class="Aa" style="font-family:'${esc(bodyFont)}',sans-serif;font-weight:400">Aa</div><div class="meta">${esc(bodyFont)} &middot; Body</div></div>
      </div>
    </div>
    <div class="page-num">03 / 05</div>
  </div>

  <!-- 4/5 The investment -->
  <div class="slide">
    <div class="num-watermark" style="top:-40px;right:40px">04</div>
    <div class="pad">
      <div class="kicker">The investment</div>
      <h2 class="serif" style="font-size:38px;margin:14px 0 26px;max-width:700px">Stand out against your competitors at the cost of just a dinner.</h2>
      <div style="display:flex;align-items:baseline;gap:14px">
        <span class="price-fine" style="font-size:92px">$${pricePerPage}</span>
        <span style="color:#78716c;font-size:16px">per page &middot; fixed price, no surprises</span>
      </div>
      <hr class="rule" style="max-width:780px;margin:34px 0 30px">
      <div style="display:flex;gap:56px;max-width:840px">
        <div style="flex:1.2">
          <div class="kicker" style="color:${accent}">Why is it so affordable?</div>
          <p style="margin-top:10px;font-size:15.5px">Not because the quality is lower. Because the power of AI lets us spend less time on repetitive production &mdash; and more time on the decisions that make your business feel distinct.</p>
        </div>
        <div style="width:1px;background:#d6d3cd"></div>
        <div style="flex:1;display:flex;flex-direction:column;gap:18px">
          <div><div class="kicker" style="font-size:11px">The human part</div><p style="margin-top:4px;font-size:14.5px">Your story, offer, voice and local insight.</p></div>
          <div><div class="kicker" style="font-size:11px">The AI-assisted part</div><p style="margin-top:4px;font-size:14.5px">Faster research, layouts, iteration and delivery.</p></div>
        </div>
      </div>
    </div>
    <div class="page-num">04 / 05</div>
  </div>

  <!-- 5/5 Close -->
  <div class="slide">
    <div class="duo">${duoMedia(mockup)}</div>
    <div class="duo-tint" style="background:${accent}"></div>
    <div class="duo-scrim" style="background:linear-gradient(0deg, rgba(20,17,15,0.96) 30%, rgba(20,17,15,0.55) 100%)"></div>
    <div class="cover-text pad" style="justify-content:center;align-items:flex-start">
      <div class="kicker" style="color:rgba(255,255,255,0.6)">Ready when you are</div>
      <h1 class="serif" style="font-size:42px;max-width:640px">Let's give ${esc(lead.name)} a site worthy of the work you already do.</h1>
      <div style="margin-top:30px;font-size:15px;color:rgba(255,255,255,0.8);display:flex;gap:24px">
        <span>${esc(company.name)}</span><span>${esc(company.contact_email)}</span><span>${esc(company.contact_phone)}</span><span>${esc(company.website)}</span>
      </div>
    </div>
    <div class="page-num on-dark">05 / 05</div>
  </div>

  </body></html>`;
}

async function buildProposalPdf(leadId) {
  const [lead] = await store.q(`SELECT * FROM leads WHERE id = $1`, [leadId]);
  if (!lead) throw new Error('lead not found');
  if (!lead.mockup_gcs_key) throw new Error('lead has no redesign mockup yet');

  const company = await settings.getCompany();
  let designSystem = null;
  if (lead.gcs_prefix) {
    const root = lead.gcs_prefix.replace(/\/scrape$/, '');
    try { designSystem = await gcs.readJson(`${root}/scrape/data/design-system.json`); } catch (_) { /* ignore */ }
  }

  const manual = lead.manual_assets || {};
  const sig = lead.audit_signals || {};
  const [mockup, before] = await Promise.all([
    toDataUrl(lead.mockup_gcs_key),
    toDataUrl(manual.screenshot || sig.screenshot),
  ]);

  const html = renderHtml({ lead, company, designSystem, mockup, before });

  const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox', '--disable-setuid-sandbox'] });
  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 720 });
    await page.setContent(html, { waitUntil: 'networkidle0', timeout: 30000 });
    const pdfBuffer = await page.pdf({
      width: '1280px', height: '720px', printBackground: true,
      margin: { top: 0, bottom: 0, left: 0, right: 0 },
    });
    const key = `companies/${leadId}/proposal.pdf`;
    if (gcs.isEnabled) await gcs.uploadFile(key, pdfBuffer, 'application/pdf');
    return { proposalKey: key, bytes: pdfBuffer.length };
  } finally {
    await browser.close();
  }
}

module.exports = { buildProposalPdf };
