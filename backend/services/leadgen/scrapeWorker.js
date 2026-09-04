/**
 * Stage 2 — scrape a lead's current site and upload the findings bundle to GCS
 * under companies/<lead_id>/scrape/. Reuses the product scraper + design
 * intelligence; does NOT produce a ZIP.
 */
const { scrapeURL } = require('../scraper');
const { getDesignSystem } = require('../designIntelligence');
const { buildScrapeArtifacts } = require('../scrapeBundle');
const gcs = require('../gcsStorage');
const store = require('./store');

let assertSafePublicUrl;
try {
  ({ assertSafePublicUrl } = require('../publicUrlSafety'));
} catch (_) {
  assertSafePublicUrl = null;
}

const EMAIL_RE = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;
const JUNK = ['example.com', 'sentry.io', 'wixpress.com', 'yourdomain', 'domain.com', '.png', '.jpg', '.gif', '@2x', 'schema.org'];

function extractEmail(siteData) {
  const hay = [
    siteData.bodyHTML || '',
    JSON.stringify(siteData.sections || []),
    JSON.stringify(siteData.keyParagraphs || []),
  ].join(' ');
  const found = (hay.match(EMAIL_RE) || []).filter(
    (e) => !JUNK.some((j) => e.toLowerCase().includes(j))
  );
  if (!found.length) return null;
  const host = (() => { try { return new URL(siteData.url).hostname.replace(/^www\./, ''); } catch { return ''; } })();
  const onDomain = found.filter((e) => host && e.toLowerCase().endsWith('@' + host));
  const pool = onDomain.length ? onDomain : found;
  for (const pref of ['info@', 'hello@', 'contact@', 'enquiries@', 'office@', 'admin@']) {
    const hit = pool.find((e) => e.toLowerCase().startsWith(pref));
    if (hit) return hit;
  }
  return pool[0];
}

async function scrapeLead(lead) {
  const prefix = `companies/${lead.id}`;

  if (!lead.website) {
    await store.setStatus(lead.id, 'scraped', { audit_signals: { has_website: false } });
    await store.recordEvent(lead.id, lead.status, 'scraped', { note: 'no website on listing' });
    return { hasWebsite: false };
  }

  if (assertSafePublicUrl) {
    await assertSafePublicUrl(lead.website); // SSRF guard (throws on private/loopback)
  }

  const siteData = await scrapeURL(lead.website, () => {}, { validateUrl: assertSafePublicUrl || undefined });
  const designSystem = getDesignSystem(siteData, siteData.siteType || 'other');
  const { files, manifest } = buildScrapeArtifacts(siteData, designSystem, lead.website);

  let uploaded = false;
  let logoKey = null;
  if (gcs.isEnabled) {
    await gcs.uploadArtifacts(`${prefix}/scrape`, files);
    logoKey = await mirrorLogo(siteData.logoUrl, `${prefix}/scrape/assets`);
    uploaded = true;
  }

  const email = lead.contact_email || extractEmail(siteData);

  await store.updateLead(lead.id, {
    status: 'scraped',
    gcs_prefix: uploaded ? prefix : null,   // company root; bundle lives under <prefix>/scrape/
    contact_email: email,
    audit_signals: {
      has_website: true,
      final_url: siteData.url,
      source: siteData.source,
      screenshot: manifest.files.screenshot ? `${prefix}/scrape/assets/original-screenshot.webp` : null,
      logo: logoKey,
      logo_url: siteData.logoUrl || null,
    },
  });
  await store.recordEvent(lead.id, lead.status, 'scraped', { gcsPrefix: prefix, email: !!email, gcsEnabled: gcs.isEnabled });
  return { hasWebsite: true, gcsPrefix: prefix, email };
}

const LOGO_EXT = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp', 'image/svg+xml': 'svg', 'image/gif': 'gif', 'image/x-icon': 'ico', 'image/vnd.microsoft.icon': 'ico' };

/** Fetch the site's logo and mirror it into GCS. Returns the key or null. */
async function mirrorLogo(logoUrl, destDir) {
  if (!logoUrl) return null;
  try {
    if (assertSafePublicUrl) await assertSafePublicUrl(logoUrl);
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 10000);
    const resp = await fetch(logoUrl, { signal: ctrl.signal });
    clearTimeout(t);
    if (!resp.ok) return null;
    const ct = (resp.headers.get('content-type') || '').split(';')[0].trim();
    const ext = LOGO_EXT[ct] || (logoUrl.split('.').pop().split(/[?#]/)[0].toLowerCase().match(/^(png|jpe?g|webp|svg|gif|ico)$/)?.[0]) || null;
    if (!ext) return null;
    const buf = Buffer.from(await resp.arrayBuffer());
    if (buf.length > 5 * 1024 * 1024) return null;
    const key = `${destDir}/logo.${ext === 'jpeg' ? 'jpg' : ext}`;
    await gcs.uploadFile(key, buf, ct || 'application/octet-stream');
    return key;
  } catch (_) {
    return null;
  }
}

module.exports = { scrapeLead, extractEmail, mirrorLogo };
