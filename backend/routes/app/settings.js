/**
 * /api/app/settings/company — the agency profile injected into every pitch
 * PDF (name, logo, website, contact). Admin-gated by the parent router.
 */
const express = require('express');
const settings = require('../../services/leadgen/settings');
const gcs = require('../../services/gcsStorage');

const router = express.Router();

router.get('/company', async (req, res) => {
  const company = await settings.getCompany();
  res.json({
    ...company,
    logoUrl: company.logo_gcs_key ? `/api/app/settings/company/logo` : null,
  });
});

const FIELDS = ['name', 'website', 'contact_email', 'contact_phone', 'portfolio_url', 'tagline', 'price_min', 'price_max', 'price_per_page', 'delivery_days'];
const NUMERIC_FIELDS = ['price_min', 'price_max', 'price_per_page', 'delivery_days'];
router.put('/company', async (req, res) => {
  const patch = {};
  for (const f of FIELDS) {
    if (req.body?.[f] === undefined) continue;
    patch[f] = NUMERIC_FIELDS.includes(f) ? Number(req.body[f]) : String(req.body[f]);
  }
  res.json(await settings.setCompany(patch));
});

const LOGO_EXT = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', webp: 'image/webp', svg: 'image/svg+xml' };
router.post('/company/logo', async (req, res) => {
  if (!gcs.isEnabled) return res.status(503).json({ error: 'GCS not configured' });
  const { filename, dataBase64 } = req.body || {};
  const ext = String(filename || '').split('.').pop().toLowerCase();
  const contentType = LOGO_EXT[ext];
  if (!contentType) return res.status(400).json({ error: `unsupported file type: .${ext}` });
  const buf = Buffer.from((dataBase64 || '').replace(/^data:[^,]+,/, ''), 'base64');
  if (buf.length > 4 * 1024 * 1024) return res.status(413).json({ error: 'file over 4 MB' });

  const key = `app/company/logo.${ext === 'jpeg' ? 'jpg' : ext}`;
  await gcs.uploadFile(key, buf, contentType);
  await settings.setCompany({ logo_gcs_key: key });
  res.json({ ok: true, key });
});

// Streams the company logo (no auth token games needed for internal admin use).
router.get('/company/logo', async (req, res) => {
  const company = await settings.getCompany();
  if (!company.logo_gcs_key || !gcs.isEnabled) return res.status(404).end();
  const buf = await gcs.downloadBuffer(company.logo_gcs_key);
  if (!buf) return res.status(404).end();
  const ext = company.logo_gcs_key.split('.').pop().toLowerCase();
  res.set('Content-Type', LOGO_EXT[ext] || 'application/octet-stream');
  res.set('Cache-Control', 'private, max-age=300');
  res.send(buf);
});

module.exports = router;
