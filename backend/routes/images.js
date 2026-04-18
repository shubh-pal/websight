const express = require('express');
const { searchPhotos, trackDownload, isEnabled } = require('../services/unsplash');

const router = express.Router();

router.get('/search', async (req, res) => {
  const q = String(req.query.q || '').trim();
  const count = Math.max(1, Math.min(12, Number(req.query.count) || 6));

  if (!q) return res.status(400).json({ error: 'q is required' });
  if (!isEnabled()) return res.status(503).json({ error: 'Unsplash is not configured' });

  try {
    const result = await searchPhotos(q, { perPage: count });
    res.json(result);
  } catch (err) {
    console.error('[images/search] error:', err.message);
    res.status(500).json({ error: 'Failed to search images' });
  }
});

router.post('/track-download', async (req, res) => {
  const downloadLocation = req.body?.downloadLocation;

  if (!downloadLocation) return res.status(400).json({ error: 'downloadLocation is required' });
  if (!isEnabled()) return res.status(503).json({ error: 'Unsplash is not configured' });

  try {
    const ok = await trackDownload(downloadLocation);
    res.json({ ok });
  } catch (err) {
    console.error('[images/track-download] error:', err.message);
    res.status(500).json({ error: 'Failed to track image download' });
  }
});

module.exports = router;
