const express = require('express');
const cors = require('cors');
const fs = require('fs/promises');
const os = require('os');
const path = require('path');
const rateLimit = require('express-rate-limit');
const { scrapeURL } = require('../services/scraper');
const { getDesignSystem } = require('../services/designIntelligence');
const { assertSafePublicUrl } = require('../services/publicUrlSafety');
const { writeScrapeBundle } = require('../services/scrapeBundle');
const { createZip } = require('../services/zipper');

const router = express.Router();
const limit = Number.parseInt(process.env.PUBLIC_SCRAPE_RATE_LIMIT_MAX || '5', 10);

router.use(cors({ origin: '*', methods: ['POST', 'OPTIONS'], credentials: false }));
router.use((_, res, next) => {
  // Override the app-wide credentialed CORS policy for this intentionally public API.
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.removeHeader('Access-Control-Allow-Credentials');
  next();
});
router.use(rateLimit({
  windowMs: 60 * 60 * 1000,
  max: Number.isFinite(limit) && limit > 0 ? limit : 5,
  message: { error: 'Too many public scrape requests from this IP. Try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
}));

// POST /api/public/scrape { url } -> application/zip
router.post('/scrape', async (req, res) => {
  const requestedUrl = req.body?.url;
  let temporaryDir;

  try {
    const safeUrl = await assertSafePublicUrl(requestedUrl);
    const url = safeUrl.href;
    const siteData = await scrapeURL(url, () => {}, { validateUrl: assertSafePublicUrl });
    const designSystem = getDesignSystem(siteData, siteData.siteType || 'other');

    temporaryDir = await fs.mkdtemp(path.join(os.tmpdir(), 'websight-public-scrape-'));
    const bundleDir = path.join(temporaryDir, 'bundle');
    await fs.mkdir(bundleDir);
    const { archiveName } = await writeScrapeBundle(bundleDir, siteData, designSystem, url);
    const { zipPath } = await createZip(bundleDir, `${archiveName}-scrape`, {
      outputDir: temporaryDir,
      uploadToS3: false,
    });

    res.download(zipPath, `${archiveName}-scrape.zip`, async (err) => {
      await fs.rm(temporaryDir, { recursive: true, force: true }).catch(() => {});
      if (err && !res.headersSent) {
        res.status(500).json({ error: 'Failed to send scrape archive' });
      }
    });
  } catch (err) {
    if (temporaryDir) await fs.rm(temporaryDir, { recursive: true, force: true }).catch(() => {});
    const message = err.message || 'Unable to scrape the requested URL';
    const isInputError = /url |public host|public IP|resolved|credentials|http or https/i.test(message);
    console.warn('[public-scrape] Request failed:', message);
    res.status(isInputError ? 400 : 502).json({ error: message });
  }
});

module.exports = router;
