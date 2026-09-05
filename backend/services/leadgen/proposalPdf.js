/**
 * Builds the pitch PDF (16:9 slide deck, 1280x720 per page) once a redesign
 * mockup exists. Puppeteer only — no external API calls, no per-PDF cost.
 *
 * Ported from the approved "v4 — MacBook mockup" draft
 * (backend/templates/pitch/v4-macbook.html). Keep that file and this
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

/** A screenshot shown inside a MacBook mockup frame. */
function macbook(url, { flat = false, rotateClass = '' } = {}) {
  const inner = url ? `<img src="${esc(url)}" alt="">` : `<div class="ph">no image yet</div>`;
  return `<div class="macbook${flat ? ' flat' : ''}${rotateClass ? ' ' + rotateClass : ''}">
    <div class="screen"><div class="camera"></div>${inner}</div>
    <div class="base"></div>
  </div>`;
}

const CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Fraunces:opsz,wght@9..144,500;9..144,600;9..144,700&display=swap');
  :root { --ink:#142235; --navy:#10233b; --gold:#bd8a3d; --cream:#fffdf8; --muted:#68717d; --line:rgba(20,34,53,.15); --shadow:0 28px 70px rgba(22,31,45,.15); }
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; background: #fff; }
  body { font-family: 'Inter', sans-serif; }
  .slide {
    position: relative; width: 1280px; height: 720px; overflow: hidden; isolation: isolate;
    background: var(--cream); color: var(--ink); page-break-after: always;
  }
  .slide:last-child { page-break-after: auto; }
  .slide.warm { background: radial-gradient(circle at 4% 0%, rgba(189,138,61,.2), transparent 25%), linear-gradient(135deg,#f9f5ee,#e9dfd0); }
  .slide::before { content:""; position:absolute; z-index:-1; inset:0; opacity:.8;
    background-image: linear-gradient(90deg, rgba(20,34,53,.035) 1px, transparent 1px), linear-gradient(rgba(20,34,53,.035) 1px, transparent 1px);
    background-size: 42px 42px; mask-image: linear-gradient(115deg, black, transparent 65%); }
  .frame { height: 100%; padding: 48px 58px 42px; display: flex; flex-direction: column; }
  .topline, .footer { display: flex; align-items: center; justify-content: space-between; }
  .brand { display: flex; align-items: center; gap: 12px; color: var(--navy); font-size: 12px; font-weight: 700; letter-spacing: .14em; text-transform: uppercase; }
  .brand::before { content:""; width: 32px; height: 2px; background: var(--gold); }
  .index, .eyebrow { color: var(--gold); font-family: 'Inter', sans-serif; font-size: 11px; letter-spacing: .12em; text-transform: uppercase; }
  .index { color: rgba(20,34,53,.52); }
  h1, h2, h3, p { margin: 0; }
  h1, h2 { font-family: Fraunces, Georgia, serif; font-weight: 600; letter-spacing: -.055em; color: var(--navy); }
  h1 { max-width: 610px; font-size: 60px; line-height: .99; }
  h2 { max-width: 705px; font-size: 48px; line-height: 1.02; }
  h3 { font-size: 15px; line-height: 1.3; }
  p { color: var(--muted); font-size: 16px; line-height: 1.58; }
  .lede { max-width: 580px; font-size: 18px; line-height: 1.55; }

  .hero { display: grid; grid-template-columns: 1fr 1.02fr; flex: 1; align-items: center; gap: 36px; }
  .hero-copy { padding: 30px 0 0 30px; }
  .hero-copy .eyebrow { margin-bottom: 18px; }
  .hero-copy .lede { margin-top: 24px; }
  .rule { width: 46px; height: 2px; margin: 26px 0 15px; background: var(--gold); }

  .mockup-wrap { position: relative; display: flex; align-items: center; justify-content: center; min-height: 440px; }
  .halo { position: absolute; width: 440px; height: 440px; border-radius: 50%; background: radial-gradient(circle, rgba(189,138,61,.19), rgba(189,138,61,0) 68%); }
  .macbook { position: relative; z-index: 1; width: 600px; max-width: 100%; transform: rotate(-2deg); filter: drop-shadow(0 27px 20px rgba(13,28,47,.22)); }
  .macbook .screen { position: relative; overflow: hidden; aspect-ratio: 16/10; padding: 11px; border: 5px solid #142235; border-radius: 17px 17px 7px 7px; background: #142235; }
  .macbook .camera { position: absolute; z-index: 2; top: 4px; left: 50%; width: 38px; height: 4px; border-radius: 10px; transform: translateX(-50%); background: #2e4056; }
  .macbook img, .macbook .ph { display: block; width: 100%; height: 100%; object-fit: cover; object-position: top; border-radius: 5px; background: #fff; }
  .macbook .ph { display: flex; align-items: center; justify-content: center; background: #eef1f5; color: #94a3b8; font-family: 'Inter'; font-size: 11px; text-transform: uppercase; letter-spacing: .08em; }
  .macbook .base { position: relative; width: 112%; height: 18px; margin-left: -6%; border-radius: 2px 2px 12px 12px; background: linear-gradient(#d9dce1,#9ea5ad); }
  .macbook .base::after { content:""; position: absolute; top: 0; left: 40%; width: 20%; height: 5px; border-radius: 0 0 5px 5px; background: #858d97; }
  .macbook.flat { width: 490px; transform: none; }
  .macbook.flat .screen { border-width: 4px; border-radius: 13px 13px 5px 5px; padding: 8px; }
  .hero-caption { position: absolute; right: 0; bottom: 6px; z-index: 2; max-width: 225px; padding: 15px 18px; border-left: 2px solid var(--gold); background: rgba(255,253,248,.91); box-shadow: 0 8px 24px rgba(20,34,53,.08); }
  .hero-caption strong { display: block; margin-bottom: 3px; font-size: 13px; }
  .hero-caption p { font-size: 12px; }

  .statement { display: grid; grid-template-columns: .82fr 1.18fr; flex: 1; align-items: center; gap: 54px; padding: 28px 38px 0; }
  .statement .lede { margin-top: 19px; }
  .comparison-mockups { position: relative; height: 480px; }
  .comparison-mockups .current { position: absolute; top: 14px; right: 18px; width: 440px; transform: rotate(2.2deg); }
  .comparison-mockups .proposed { position: absolute; top: 170px; left: 0; width: 415px; transform: rotate(-2.3deg); }
  .tag { position: absolute; z-index: 4; padding: 7px 9px; color: var(--cream); background: var(--navy); font-family: 'Inter', sans-serif; font-size: 10px; letter-spacing: .08em; text-transform: uppercase; }
  .comparison-mockups .tag.current-tag { top: 0; right: 24px; }
  .comparison-mockups .tag.proposed-tag { top: 154px; left: 7px; background: var(--gold); }

  .design { display: grid; grid-template-columns: .9fr 1.1fr; flex: 1; align-items: center; gap: 44px; padding: 16px 42px 0; }
  .design-copy p { max-width: 455px; margin-top: 22px; }
  .design-list { margin: 26px 0 0; padding: 0; list-style: none; border-top: 1px solid var(--line); }
  .design-list li { display: grid; grid-template-columns: 42px 1fr; gap: 12px; padding: 15px 0; border-bottom: 1px solid var(--line); color: var(--navy); font-size: 15px; font-weight: 600; }
  .design-list span { color: var(--gold); font-family: 'Inter', sans-serif; font-size: 11px; padding-top: 3px; }
  .visual { position: relative; min-height: 460px; display: flex; align-items: center; justify-content: center; }
  .visual .macbook { width: 550px; }
  .visual .callout { position: absolute; z-index: 3; padding: 14px 17px; max-width: 190px; background: rgba(255,253,248,.97); border: 1px solid var(--line); box-shadow: 0 13px 25px rgba(20,34,53,.11); }
  .visual .callout strong { display: block; margin-bottom: 3px; font-size: 12px; }
  .visual .callout p { font-size: 11px; line-height: 1.45; }
  .callout.a { top: 30px; right: -5px; border-left: 2px solid var(--gold); }
  .callout.b { bottom: 40px; left: 0; border-left: 2px solid var(--navy); }

  .offer { display: grid; grid-template-columns: 1fr .9fr; flex: 1; align-items: center; gap: 50px; padding: 34px 54px 0; }
  .price-line { display: flex; align-items: baseline; gap: 16px; margin: 22px 0 14px; }
  .price { color: var(--navy); font-family: Fraunces, Georgia, serif; font-size: 88px; font-weight: 600; letter-spacing: -.08em; line-height: .8; }
  .per { color: var(--muted); font-size: 14px; }
  .offer-copy .lede { margin-top: 18px; }
  .deliverables { padding: 34px 38px; background: var(--navy); color: var(--cream); }
  .deliverables .eyebrow { color: #deb878; }
  .deliverables h3 { margin-top: 14px; color: var(--cream); font-family: Fraunces, Georgia, serif; font-size: 28px; letter-spacing: -.04em; }
  .deliverables ul { margin: 24px 0 0; padding: 0; list-style: none; border-top: 1px solid rgba(255,255,255,.18); }
  .deliverables li { position: relative; padding: 14px 0 14px 24px; border-bottom: 1px solid rgba(255,255,255,.18); color: rgba(255,255,255,.82); font-size: 14px; line-height: 1.4; }
  .deliverables li::before { content:""; position: absolute; top: 21px; left: 0; width: 9px; height: 9px; border: 1px solid #deb878; border-radius: 50%; }

  .close { display: grid; grid-template-columns: 1.1fr .9fr; flex: 1; align-items: center; gap: 44px; padding: 28px 36px 0; }
  .close h2 { max-width: 650px; font-size: 40px; }
  .close .lede { margin-top: 18px; }
  .next { display: flex; gap: 26px; margin-top: 30px; }
  .next div { max-width: 175px; padding-top: 12px; border-top: 2px solid var(--gold); }
  .next strong { display: block; margin-bottom: 4px; color: var(--navy); font-size: 13px; }
  .next p { font-size: 12px; }
  .contact-card { padding: 34px 36px; color: var(--cream); background: linear-gradient(135deg,#10233b,#1e3654); box-shadow: 20px 22px 0 rgba(189,138,61,.18); }
  .contact-card h3 { margin: 14px 0 24px; color: var(--cream); font-family: Fraunces, Georgia, serif; font-size: 30px; letter-spacing: -.04em; }
  .contact-card dl { margin: 0; }
  .contact-card div { padding: 13px 0; border-top: 1px solid rgba(255,255,255,.2); }
  .contact-card dt { margin-bottom: 5px; color: #deb878; font-family: 'Inter', sans-serif; font-size: 10px; letter-spacing: .1em; text-transform: uppercase; }
  .contact-card dd { margin: 0; color: rgba(255,255,255,.9); font-size: 15px; }
  .interest-btn {
    display: block; margin-top: 22px; padding: 14px 20px; border-radius: 8px; text-align: center;
    background: var(--gold); color: var(--navy); font-family: 'Inter', sans-serif; font-weight: 700;
    font-size: 14px; letter-spacing: .01em; text-decoration: none;
  }

  .footer { margin-top: auto; padding-top: 20px; border-top: 1px solid var(--line); }
  .footer p { font-size: 11px; }

  .placeholder, .ph { background: #eef1f5; color: #94a3b8; }
`;

function renderHtml({ lead, company, designSystem, mockup, before }) {
  const colors = designSystem?.colors || {};
  const fonts = designSystem?.fonts || {};
  const verdict = lead.qualify_raw && !lead.qualify_raw.error ? lead.qualify_raw : null;
  const positioning = verdict?.summary || lead.audit_reasons || `${lead.name}'s current site is holding the business back online.`;
  const location = [lead.city, lead.country].filter(Boolean).join(', ');
  const name = esc(lead.name);
  const agencyName = esc(company.name || 'Your Agency');
  const price = `$${company.price_per_page ?? company.price_min ?? 200}`;
  const paletteLine = Object.values(colors).filter(Boolean).slice(0, 3).join(' / ') || 'Pulled straight from the current site';
  // Always the agency's own live app (which serves this route) — never the
  // prospect's company.website. FRONTEND_URL is deliberately not used as a
  // fallback: in local dev it points at the separate Vite port, which does
  // not serve /interested (only the backend does).
  const appBase = (process.env.APP_URL || `http://localhost:${process.env.PORT || 3001}`).replace(/\/+$/, '');
  const interestUrl = `${appBase}/interested/${lead.id}`;

  return `<!doctype html><html><head><meta charset="utf-8"><style>${CSS}</style></head><body>

  <!-- 1/5 Hero -->
  <section class="slide warm"><div class="frame">
    <div class="topline"><div class="brand">${agencyName}</div><div class="index">01 / 05</div></div>
    <div class="hero">
      <div class="hero-copy">
        <div class="eyebrow">Website redesign proposal</div>
        <h1>${name}, it's time to stand out online.</h1>
        <p class="lede">A focused redesign for high-intent visitors who need confidence, proof, and a clear reason to contact ${name} now.</p>
        <div class="rule"></div>
      </div>
      <div class="mockup-wrap">
        <div class="halo"></div>
        ${macbook(mockup)}
        <div class="hero-caption"><strong>The work stays visible</strong><p>The proposed homepage is the hero, not an afterthought.</p></div>
      </div>
    </div>
    <div class="footer"><p>${name}</p><p>${esc(location)}</p></div>
  </div></section>

  <!-- 2/5 Comparison -->
  <section class="slide"><div class="frame">
    <div class="topline"><div class="eyebrow">The conversion gap</div><div class="index">02 / 05</div></div>
    <div class="statement">
      <div>
        <h2>When the site feels dated, the right lead keeps searching.</h2>
        <p class="lede">${esc(positioning)}</p>
      </div>
      <div class="comparison-mockups">
        <span class="tag current-tag">Current experience</span>
        ${macbook(before, { flat: true, rotateClass: 'current' })}
        <span class="tag proposed-tag">Proposed direction</span>
        ${macbook(mockup, { flat: true, rotateClass: 'proposed' })}
      </div>
    </div>
    <div class="footer"><p>${name}</p><p>The contrast makes the investment tangible</p></div>
  </div></section>

  <!-- 3/5 Design direction -->
  <section class="slide"><div class="frame">
    <div class="topline"><div class="eyebrow">Design direction</div><div class="index">03 / 05</div></div>
    <div class="design">
      <div class="design-copy">
        <h2>Premium restraint, with the website front and center.</h2>
        <p>Every color and typeface below is pulled from ${name}'s own brand signals &mdash; the redesign extends what already exists rather than replacing it.</p>
        <ul class="design-list">
          <li><span>01</span><div>Authority arrives in the first screen, before the visitor reads every detail.</div></li>
          <li><span>02</span><div>The call-to-action gets clear visual priority without competing with the message.</div></li>
          <li><span>03</span><div>Trust markers support the decision in the moments where hesitation usually appears.</div></li>
        </ul>
      </div>
      <div class="visual">
        <div class="halo"></div>
        ${macbook(mockup)}
        <div class="callout a"><strong>On-brand palette</strong><p>${esc(paletteLine)}</p></div>
        <div class="callout b"><strong>Considered typography</strong><p>${esc(fonts.heading || 'Heading')} / ${esc(fonts.body || 'Body')} &mdash; kept intact from the existing brand.</p></div>
      </div>
    </div>
    <div class="footer"><p>${name}</p><p>A design system with a conversion job</p></div>
  </div></section>

  <!-- 4/5 Investment -->
  <section class="slide"><div class="frame">
    <div class="topline"><div class="eyebrow">Investment</div><div class="index">04 / 05</div></div>
    <div class="offer">
      <div class="offer-copy">
        <h2>Stand out against your competitors at the cost of just a dinner.</h2>
        <div class="price-line"><div class="price">${price}</div><div class="per">per page, fixed project pricing</div></div>
        <p class="lede">Not because the quality is lower &mdash; because the power of AI lets us spend less time on repetitive production, and more time on the decisions that make ${name} feel distinct.</p>
      </div>
      <div class="deliverables">
        <div class="eyebrow">Included in each page</div>
        <h3>Design that looks deliberate and sells the next step.</h3>
        <ul>
          <li>A tailored page design built around your strongest proof.</li>
          <li>A clear conversion path from first impression to contact.</li>
          <li>A visual system that stays consistent as pages are added.</li>
        </ul>
      </div>
    </div>
    <div class="footer"><p>${name}</p><p>Scope can scale with priority pages</p></div>
  </div></section>

  <!-- 5/5 Close -->
  <section class="slide warm"><div class="frame">
    <div class="topline"><div class="brand">${agencyName}</div><div class="index">05 / 05</div></div>
    <div class="close">
      <div>
        <div class="eyebrow">Next step</div>
        <h2>Let's give ${name} a site worthy of the work you already do.</h2>
        <p class="lede">Approve the direction, and we turn this into a production-ready page &mdash; final content, hierarchy, and a contact path tuned to how your leads actually arrive.</p>
        <div class="next">
          <div><strong>Confirm direction</strong><p>Approve the visual and messaging approach.</p></div>
          <div><strong>Set page priority</strong><p>Choose the pages that go live first.</p></div>
          <div><strong>Build the first page</strong><p>Apply final content and begin delivery.</p></div>
        </div>
      </div>
      <div class="contact-card">
        <div class="eyebrow">Start the project</div>
        <h3>${agencyName}</h3>
        <dl>
          <div><dt>Email</dt><dd>${esc(company.contact_email)}</dd></div>
          <div><dt>Phone</dt><dd>${esc(company.contact_phone)}</dd></div>
          <div><dt>Website</dt><dd>${esc(company.website)}</dd></div>
        </dl>
        <a class="interest-btn" href="${interestUrl}">Yes, I'm interested &rarr;</a>
      </div>
    </div>
    <div class="footer"><p>${name}</p><p>Prepared exclusively for this proposal</p></div>
  </div></section>

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
  const pdfBuffer = await renderPdf(html);

  const key = `companies/${leadId}/proposal.pdf`;
  if (gcs.isEnabled) await gcs.uploadFile(key, pdfBuffer, 'application/pdf');
  return { proposalKey: key, bytes: pdfBuffer.length };
}

// Puppeteer on Cloud Run (constrained memory, tiny /dev/shm) crashes Chromium
// mid-render without these flags — "Navigating frame was detached" /
// "Target closed". Matches services/scraper.js, which has run fine in prod.
const LAUNCH_ARGS = ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu'];

async function renderPdfOnce(html) {
  const browser = await puppeteer.launch({ headless: 'new', args: LAUNCH_ARGS });
  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 720 });
    // 'load' rather than 'networkidle0': the only external resource is the
    // Google Fonts CSS, and networkidle0 can hang on Cloud Run's restricted
    // egress waiting for it. 'load' fires once resources settle or error.
    await page.setContent(html, { waitUntil: 'load', timeout: 30000 });
    await page.evaluate(() => (document.fonts ? document.fonts.ready : null)).catch(() => {});
    await page.emulateMediaType('print');
    return await page.pdf({
      width: '1280px', height: '720px', printBackground: true,
      margin: { top: 0, bottom: 0, left: 0, right: 0 },
    });
  } finally {
    await browser.close().catch(() => {});
  }
}

/** One retry with a fresh browser — the Chromium crashes are usually transient. */
async function renderPdf(html) {
  try {
    return await renderPdfOnce(html);
  } catch (err) {
    console.warn(`[proposalPdf] render failed (${err.message}), retrying once`);
    return renderPdfOnce(html);
  }
}

module.exports = { buildProposalPdf, renderHtml, toDataUrl };
