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

  let gcsPrefix = null;
  if (gcs.isEnabled) {
    gcsPrefix = await gcs.uploadArtifacts(`${prefix}/scrape`, files);
  }

  const email = lead.contact_email || extractEmail(siteData);

  await store.updateLead(lead.id, {
    status: 'scraped',
    gcs_prefix: gcsPrefix,
    contact_email: email,
    audit_signals: {
      has_website: true,
      final_url: siteData.url,
      source: siteData.source,
      screenshot: manifest.files.screenshot ? `${prefix}/scrape/assets/original-screenshot.webp` : null,
    },
  });
  await store.recordEvent(lead.id, lead.status, 'scraped', { gcsPrefix, email: !!email, gcsEnabled: gcs.isEnabled });
  return { hasWebsite: true, gcsPrefix, email };
}

module.exports = { scrapeLead, extractEmail };
