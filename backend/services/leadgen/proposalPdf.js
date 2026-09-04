/**
 * Builds the fixed-structure pitch PDF once a redesign mockup exists.
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

function swatch(hex, label) {
  if (!hex) return '';
  return `<div class="swatch"><div class="chip" style="background:${esc(hex)}"></div><span>${esc(label)}</span></div>`;
}

function renderHtml({ lead, company, designSystem, mockup, before, leadLogo, companyLogo }) {
  const colors = designSystem?.colors || {};
  const fonts = designSystem?.fonts || {};
  const verdict = lead.qualify_raw && !lead.qualify_raw.error ? lead.qualify_raw : null;
  const headline = verdict?.pitch_angle || `${lead.name}, your website is losing you customers.`;
  const positioning = verdict?.summary || lead.audit_reasons || 'Your current site is holding your business back online.';
  const reasons = (lead.audit_reasons || '').split(';').map((r) => r.trim()).filter(Boolean);
  const accent = colors.primary || '#2563eb';

  return `<!doctype html><html><head><meta charset="utf-8"><style>
    * { box-sizing: border-box; }
    body { font-family: -apple-system, 'Segoe UI', Roboto, Arial, sans-serif; margin: 0; color: #0f172a; }
    .page { width: 210mm; min-height: 297mm; padding: 16mm; page-break-after: always; position: relative; }
    .page:last-child { page-break-after: auto; }
    .eyebrow { text-transform: uppercase; letter-spacing: 0.12em; font-size: 11px; color: ${accent}; font-weight: 700; }
    h1 { font-size: 30px; line-height: 1.15; margin: 8px 0 6px; letter-spacing: -0.02em; }
    h2 { font-size: 20px; margin: 0 0 14px; letter-spacing: -0.01em; }
    p { line-height: 1.6; font-size: 13.5px; color: #334155; }
    .cover-shot { width: 100%; border-radius: 10px; border: 1px solid #e2e8f0; margin-top: 14px; max-height: 150mm; object-fit: cover; }
    .brand-row { display: flex; justify-content: space-between; align-items: center; }
    .brand-row img { height: 28px; object-fit: contain; }
    ul.reasons { padding-left: 18px; }
    ul.reasons li { font-size: 13.5px; color: #334155; margin-bottom: 6px; }
    .before-after { display: flex; gap: 12px; margin-top: 14px; }
    .before-after figure { flex: 1; margin: 0; }
    .before-after img { width: 100%; border-radius: 8px; border: 1px solid #e2e8f0; }
    .before-after figcaption { font-size: 11px; color: #64748b; margin-top: 4px; text-transform: uppercase; letter-spacing: 0.08em; }
    .swatches { display: flex; gap: 10px; flex-wrap: wrap; margin: 12px 0; }
    .swatch { text-align: center; font-size: 10px; color: #64748b; }
    .chip { width: 30px; height: 30px; border-radius: 6px; border: 1px solid #e2e8f0; margin-bottom: 4px; }
    .price-box { background: ${accent}12; border: 1px solid ${accent}33; border-radius: 12px; padding: 20px; margin-top: 20px; }
    .price { font-size: 34px; font-weight: 800; color: ${accent}; }
    .footer-contact { position: absolute; bottom: 16mm; left: 16mm; right: 16mm; border-top: 1px solid #e2e8f0; padding-top: 14px; display: flex; justify-content: space-between; font-size: 12px; color: #64748b; }
    .cta { display: inline-block; margin-top: 16px; padding: 12px 22px; border-radius: 10px; background: ${accent}; color: #fff; font-weight: 700; text-decoration: none; font-size: 14px; }
  </style></head><body>

  <div class="page">
    <div class="brand-row">
      ${companyLogo ? `<img src="${companyLogo}" />` : `<strong>${esc(company.name || 'Website Redesign')}</strong>`}
      <span class="eyebrow">Website Redesign Proposal</span>
    </div>
    <h1>${esc(headline)}</h1>
    <p>Prepared for <strong>${esc(lead.name)}</strong> — ${esc([lead.city, lead.country].filter(Boolean).join(', '))}</p>
    ${mockup ? `<img class="cover-shot" src="${mockup}" />` : ''}
  </div>

  <div class="page">
    <div class="eyebrow">What we noticed</div>
    <h2>Your current site, as visitors see it</h2>
    ${reasons.length ? `<ul class="reasons">${reasons.map((r) => `<li>${esc(r)}</li>`).join('')}</ul>` : `<p>${esc(positioning)}</p>`}
    ${before ? `<img class="cover-shot" src="${before}" style="max-height:110mm" />` : ''}
  </div>

  <div class="page">
    <div class="eyebrow">Brand direction</div>
    <h2>Where we'd take it</h2>
    <p>${esc(positioning)}</p>
    ${Object.keys(colors).length ? `<div class="swatches">${Object.entries(colors).filter(([, v]) => v).map(([k, v]) => swatch(v, k)).join('')}</div>` : ''}
    ${fonts.heading ? `<p>Typography — heading: <strong>${esc(fonts.heading)}</strong>, body: <strong>${esc(fonts.body || fonts.heading)}</strong></p>` : ''}
    <div class="before-after">
      <figure>${before ? `<img src="${before}" />` : ''}<figcaption>Before</figcaption></figure>
      <figure>${mockup ? `<img src="${mockup}" />` : ''}<figcaption>After</figcaption></figure>
    </div>
    ${leadLogo ? `<p style="margin-top:14px">Current logo on file:</p><img src="${leadLogo}" style="max-height:60px;background:#fff;padding:8px;border-radius:8px;border:1px solid #e2e8f0" />` : ''}
  </div>

  <div class="page">
    <div class="eyebrow">Scope &amp; investment</div>
    <h2>Fixed price, fast delivery</h2>
    <p>${esc(company.tagline)}</p>
    <div class="price-box">
      <div class="price">$${company.price_min}–$${company.price_max}</div>
      <p>Delivered in ~${company.delivery_days} days · fully responsive · built on your current brand</p>
    </div>
    <div class="eyebrow" style="margin-top:28px">Next step</div>
    <p>Reply to this email or reach out below and we'll lock in a start date.</p>
    <a class="cta" href="mailto:${esc(company.contact_email)}">Get started</a>
    <div class="footer-contact">
      <span>${esc(company.name)} ${company.website ? `· ${esc(company.website)}` : ''}</span>
      <span>${esc(company.contact_email)} ${company.contact_phone ? `· ${esc(company.contact_phone)}` : ''}</span>
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
    await page.setContent(html, { waitUntil: 'networkidle0', timeout: 30000 });
    const pdfBuffer = await page.pdf({ format: 'A4', printBackground: true, margin: { top: 0, bottom: 0, left: 0, right: 0 } });
    const key = `companies/${leadId}/proposal.pdf`;
    if (gcs.isEnabled) await gcs.uploadFile(key, pdfBuffer, 'application/pdf');
    return { proposalKey: key, bytes: pdfBuffer.length };
  } finally {
    await browser.close();
  }
}

module.exports = { buildProposalPdf };
