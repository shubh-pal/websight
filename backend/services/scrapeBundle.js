const fs = require('fs/promises');
const path = require('path');

function archiveName(value = 'website') {
  return value.toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48) || 'website';
}

/**
 * Shape a scrape result + design system into an in-memory artifact list.
 * Pure — no disk or network. Consumed by both writeScrapeBundle (ZIP, public
 * product) and the internal lead pipeline (uploads to GCS).
 *
 * @returns {{ archiveName: string, manifest: object,
 *             files: Array<{ path: string, body: Buffer|string, contentType: string }> }}
 */
function buildScrapeArtifacts(siteData, designSystem, requestedUrl) {
  const { bodyHTML = '', originalScreenshot, ...scrapedData } = siteData;

  const page = {
    url: siteData.url,
    title: siteData.title || '',
    description: siteData.description || '',
    headings: siteData.headings || [],
    sections: siteData.sections || [],
    keyParagraphs: siteData.keyParagraphs || [],
    contentFile: 'content/page.html',
  };

  const assetManifest = {
    logoUrl: siteData.logoUrl || null,
    ogImage: siteData.ogImage || null,
    assets: siteData.assets || [],
    note: 'Asset URLs are source references. They are not mirrored in this export.',
  };

  const manifest = {
    format: 'websight-scrape-export/v1',
    requestedUrl,
    finalUrl: siteData.url,
    capturedAt: new Date().toISOString(),
    source: siteData.source || 'unknown',
    pagesCaptured: 1,
    pageCount: 1,
    files: {
      page: 'content/page.html',
      scrapedData: 'data/scraped-data.json',
      designSystem: 'data/design-system.json',
      assets: 'assets/asset-manifest.json',
      screenshot: originalScreenshot ? 'assets/original-screenshot.webp' : null,
    },
  };

  const files = [
    { path: 'manifest.json', body: JSON.stringify(manifest, null, 2), contentType: 'application/json' },
    { path: 'data/scraped-data.json', body: JSON.stringify({ ...scrapedData, page }, null, 2), contentType: 'application/json' },
    { path: 'data/design-system.json', body: JSON.stringify(designSystem, null, 2), contentType: 'application/json' },
    { path: 'assets/asset-manifest.json', body: JSON.stringify(assetManifest, null, 2), contentType: 'application/json' },
    { path: 'content/page.html', body: bodyHTML, contentType: 'text/html' },
  ];

  if (originalScreenshot) {
    files.push({
      path: 'assets/original-screenshot.webp',
      body: Buffer.from(originalScreenshot, 'base64'),
      contentType: 'image/webp',
    });
  }

  const name = archiveName(siteData.title || new URL(siteData.url || requestedUrl).hostname);
  return { archiveName: name, manifest, files };
}

/**
 * Write the scrape bundle to a directory (used by the public ZIP export).
 * Behaviour unchanged from the original implementation.
 */
async function writeScrapeBundle(directory, siteData, designSystem, requestedUrl) {
  const { archiveName: name, manifest, files } = buildScrapeArtifacts(siteData, designSystem, requestedUrl);

  const dirs = new Set(files.map((f) => path.dirname(f.path)).filter((d) => d && d !== '.'));
  await Promise.all([...dirs].map((d) => fs.mkdir(path.join(directory, d), { recursive: true })));

  await Promise.all(
    files.map((f) =>
      fs.writeFile(
        path.join(directory, f.path),
        Buffer.isBuffer(f.body) ? f.body : String(f.body)
      )
    )
  );

  return { archiveName: name, manifest };
}

module.exports = { writeScrapeBundle, buildScrapeArtifacts };
