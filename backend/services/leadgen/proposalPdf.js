/**
 * Builds the pitch PDF as a 16:9 slide deck (1280x720 per slide, matches
 * PowerPoint widescreen at 13.333in x 7.5in) once a redesign mockup exists.
 * Puppeteer only — no external API calls, no per-PDF cost.
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

function darken(hex, amt = 0.55) {
  if (!hex || !/^#([0-9a-f]{6})$/i.test(hex)) return '#0f172a';
  const n = parseInt(hex.slice(1), 16);
  const r = Math.round(((n >> 16) & 255) * amt);
  const g = Math.round(((n >> 8) & 255) * amt);
  const b = Math.round((n & 255) * amt);
  return `rgb(${r},${g},${b})`;
}

function renderHtml({ lead, company, designSystem, mockup, before, leadLogo, companyLogo }) {
  const colors = designSystem?.colors || {};
  const fonts = designSystem?.fonts || {};
  const verdict = lead.qualify_raw && !lead.qualify_raw.error ? lead.qualify_raw : null;
  const headline = verdict?.pitch_angle || `${lead.name}, your website is losing you customers.`;
  const positioning = verdict?.summary || 'Your current site is holding your business back online.';
  const reasons = (lead.audit_reasons || '').split(';').map((r) => r.trim()).filter(Boolean);
  const accent = colors.primary || '#6366f1';
  const accentDark = darken(accent, 0.35);
  const fontImport = fonts.googleImport || "@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');";
  const headingFont = fonts.heading ? `'${fonts.heading}', Inter, sans-serif` : "Inter, sans-serif";
  const bodyFont = fonts.body ? `'${fonts.body}', Inter, sans-serif` : "Inter, sans-serif";
  const location = [lead.city, lead.country].filter(Boolean).join(', ');
  const priceRange = `$${company.price_min}–$${company.price_max}`;

  return `<!doctype html><html><head><meta charset="utf-8"><style>
    ${fontImport}
    * { box-sizing: border-box; }
    html, body { margin: 0; padding: 0; }
    body { font-family: ${bodyFont}; color: #0f172a; }
    .slide {
      width: 1280px; height: 720px; position: relative; overflow: hidden;
      page-break-after: always; background: #ffffff;
    }
    .slide:last-child { page-break-after: auto; }
    .pad { padding: 64px 72px; height: 100%; box-sizing: border-box; }
    h1, h2, h3 { font-family: ${headingFont}; margin: 0; letter-spacing: -0.02em; }
    .eyebrow { text-transform: uppercase; letter-spacing: 0.16em; font-size: 13px; font-weight: 700; color: ${accent}; }
    .eyebrow.light { color: rgba(255,255,255,0.85); }
    p { font-family: ${bodyFont}; line-height: 1.6; font-size: 17px; color: #475569; margin: 0; }

    /* ---- Slide 1: Cover ---- */
    .cover { color: #fff; background: linear-gradient(135deg, ${accentDark}, #0f172a); }
    .cover-bg { position: absolute; inset: 0; }
    .cover-bg img { width: 100%; height: 100%; object-fit: cover; opacity: 0.34; }
    .cover-scrim { position: absolute; inset: 0; background: linear-gradient(180deg, rgba(15,23,42,0.15) 0%, rgba(15,23,42,0.92) 78%); }
    .cover-content { position: relative; z-index: 2; display: flex; flex-direction: column; justify-content: flex-end; height: 100%; }
    .cover-content h1 { font-size: 52px; color: #fff; line-height: 1.08; max-width: 980px; margin: 18px 0 14px; }
    .cover-content .meta { font-size: 16px; color: rgba(255,255,255,0.75); }
    .brand-row { position: absolute; top: 40px; left: 72px; right: 72px; z-index: 3; display: flex; justify-content: space-between; align-items: center; }
    .brand-row img { height: 30px; object-fit: contain; filter: brightness(0) invert(1); }
    .brand-row .agency-name { color: #fff; font-weight: 700; font-size: 15px; }

    /* ---- Section header used on inner slides ---- */
    .section-head { margin-bottom: 30px; }
    .section-head h2 { font-size: 34px; margin-top: 8px; color: #0f172a; }

    /* ---- Slide 2: What we noticed ---- */
    .split { display: flex; height: 100%; }
    .split .left { flex: 0 0 46%; background: #0f172a; position: relative; }
    .split .left img { width: 100%; height: 100%; object-fit: cover; opacity: 0.9; }
    .split .right { flex: 1; padding: 64px 56px; display: flex; flex-direction: column; justify-content: center; }
    .reason-card { display: flex; gap: 14px; align-items: flex-start; margin-bottom: 18px; }
    .reason-dot { width: 10px; height: 10px; border-radius: 50%; background: ${accent}; margin-top: 7px; flex-shrink: 0; }
    .reason-card p { font-size: 17px; color: #1e293b; }

    /* ---- Slide 3: Brand direction ---- */
    .swatch-row { display: flex; gap: 14px; margin: 26px 0 22px; flex-wrap: wrap; }
    .swatch { text-align: center; }
    .chip { width: 56px; height: 56px; border-radius: 12px; border: 1px solid #e2e8f0; margin-bottom: 6px; }
    .swatch span { font-size: 11px; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.06em; }
    .type-sample { display: flex; gap: 40px; margin-top: 16px; }
    .type-sample div span { display: block; font-size: 11px; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.08em; margin-bottom: 4px; }
    .type-sample div strong { font-size: 26px; }

    /* ---- Slide 4: Before / After ---- */
    .ba { display: flex; height: 100%; }
    .ba figure { flex: 1; margin: 0; position: relative; }
    .ba img { width: 100%; height: 100%; object-fit: cover; display: block; }
    .ba figcaption { position: absolute; top: 24px; left: 24px; padding: 6px 16px; border-radius: 999px; font-size: 12px; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; }
    .ba .before figcaption { background: rgba(15,23,42,0.75); color: #fff; }
    .ba .after figcaption { background: ${accent}; color: #fff; }
    .ba-divider { width: 4px; background: ${accent}; }

    /* ---- Slide 5: Scope ---- */
    .scope { background: linear-gradient(135deg, ${accentDark}, #0f172a); color: #fff; display: flex; align-items: center; }
    .scope-inner { padding: 0 72px; width: 100%; }
    .scope .price { font-size: 96px; font-weight: 800; letter-spacing: -0.03em; margin: 14px 0 10px; }
    .scope .tagline { font-size: 19px; color: rgba(255,255,255,0.85); max-width: 640px; }
    .scope-facts { display: flex; gap: 40px; margin-top: 34px; }
    .scope-facts div { font-size: 15px; color: rgba(255,255,255,0.9); }
    .scope-facts strong { display: block; font-size: 22px; margin-bottom: 4px; }

    /* ---- Slide 6: Contact / CTA ---- */
    .cta-slide { display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%; text-align: center; }
    .cta-slide img.logo { height: 46px; object-fit: contain; margin-bottom: 28px; }
    .cta-slide h1 { font-size: 44px; max-width: 780px; }
    .cta-btn { margin-top: 30px; padding: 16px 34px; border-radius: 12px; background: ${accent}; color: #fff; font-weight: 700; font-size: 17px; text-decoration: none; }
    .contact-row { margin-top: 34px; font-size: 15px; color: #64748b; display: flex; gap: 22px; }
  </style></head><body>

  <!-- Slide 1: Cover -->
  <div class="slide cover">
    <div class="brand-row">
      ${companyLogo ? `<img src="${companyLogo}" />` : `<span class="agency-name">${esc(company.name || 'Website Redesign')}</span>`}
      <span class="eyebrow light">Website Redesign Proposal</span>
    </div>
    <div class="cover-bg">${mockup ? `<img src="${mockup}" />` : ''}</div>
    <div class="cover-scrim"></div>
    <div class="cover-content pad">
      <span class="eyebrow light">Prepared for ${esc(lead.name)}${location ? ` · ${esc(location)}` : ''}</span>
      <h1>${esc(headline)}</h1>
      <span class="meta">${esc(lead.category || '')}</span>
    </div>
  </div>

  <!-- Slide 2: What we noticed -->
  <div class="slide">
    <div class="split">
      <div class="left">${before ? `<img src="${before}" />` : ''}</div>
      <div class="right">
        <div class="eyebrow">What we noticed</div>
        <h2 style="font-size:32px;margin:10px 0 26px">Your site today</h2>
        ${reasons.length
          ? reasons.map((r) => `<div class="reason-card"><div class="reason-dot"></div><p>${esc(r)}</p></div>`).join('')
          : `<p>${esc(positioning)}</p>`}
      </div>
    </div>
  </div>

  <!-- Slide 3: Brand direction -->
  <div class="slide">
    <div class="pad">
      <div class="section-head">
        <div class="eyebrow">Brand direction</div>
        <h2>Where we'd take it</h2>
      </div>
      <p style="max-width:820px;font-size:18px">${esc(positioning)}</p>
      ${Object.keys(colors).length ? `
        <div class="swatch-row">
          ${Object.entries(colors).filter(([, v]) => v).map(([k, v]) => `<div class="swatch"><div class="chip" style="background:${esc(v)}"></div><span>${esc(k)}</span></div>`).join('')}
        </div>` : ''}
      ${fonts.heading ? `
        <div class="type-sample">
          <div><span>Heading</span><strong style="font-family:${headingFont}">${esc(fonts.heading)}</strong></div>
          <div><span>Body</span><strong style="font-family:${bodyFont};font-weight:400">${esc(fonts.body || fonts.heading)}</strong></div>
        </div>` : ''}
    </div>
  </div>

  <!-- Slide 4: Before / After -->
  <div class="slide">
    <div class="ba">
      <figure class="before">${before ? `<img src="${before}" />` : ''}<figcaption>Before</figcaption></figure>
      <div class="ba-divider"></div>
      <figure class="after">${mockup ? `<img src="${mockup}" />` : ''}<figcaption>After</figcaption></figure>
    </div>
  </div>

  <!-- Slide 5: Scope & investment -->
  <div class="slide scope">
    <div class="scope-inner">
      <span class="eyebrow light">Scope &amp; investment</span>
      <div class="price">${priceRange}</div>
      <p class="tagline">${esc(company.tagline)}</p>
      <div class="scope-facts">
        <div><strong>~${company.delivery_days} days</strong>delivery</div>
        <div><strong>Fully responsive</strong>desktop, tablet, mobile</div>
        <div><strong>Your brand</strong>built on what you already have</div>
      </div>
    </div>
  </div>

  <!-- Slide 6: Contact / CTA -->
  <div class="slide">
    <div class="cta-slide">
      ${companyLogo ? `<img class="logo" src="${companyLogo}" />` : ''}
      <h1>Let's build ${esc(lead.name)} a website that works as hard as you do.</h1>
      <a class="cta-btn" href="mailto:${esc(company.contact_email)}">Get started</a>
      <div class="contact-row">
        <span>${esc(company.name)}</span>
        ${company.website ? `<span>${esc(company.website)}</span>` : ''}
        <span>${esc(company.contact_email)}</span>
        ${company.contact_phone ? `<span>${esc(company.contact_phone)}</span>` : ''}
      </div>
    </div>
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
  const [mockup, before, leadLogo, companyLogo] = await Promise.all([
    toDataUrl(lead.mockup_gcs_key),
    toDataUrl(manual.screenshot || sig.screenshot),
    toDataUrl(manual.logo || sig.logo),
    toDataUrl(company.logo_gcs_key),
  ]);

  const html = renderHtml({ lead, company, designSystem, mockup, before, leadLogo, companyLogo });

  const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox', '--disable-setuid-sandbox'] });
  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 720 });
    await page.setContent(html, { waitUntil: 'networkidle0', timeout: 30000 });
    // Widescreen slide size (1280x720 @ 96dpi = 13.333in x 7.5in, PowerPoint widescreen).
    const pdfBuffer = await page.pdf({
      width: '1280px', height: '720px', printBackground: true,
      margin: { top: 0, bottom: 0, left: 0, right: 0 }, preferCSSPageSize: false,
    });
    const key = `companies/${leadId}/proposal.pdf`;
    if (gcs.isEnabled) await gcs.uploadFile(key, pdfBuffer, 'application/pdf');
    return { proposalKey: key, bytes: pdfBuffer.length };
  } finally {
    await browser.close();
  }
}

module.exports = { buildProposalPdf };
