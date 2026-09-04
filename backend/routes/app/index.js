/**
 * /api/app/* — internal agency pipeline API.
 *
 * Admin-session gated (same gate as /api/admin), except the automation
 * endpoints (/cron/*, /webhooks/*) which use an X-Cron-Secret guard so
 * Cloud Scheduler / ESP webhooks can reach them without a session.
 *
 * None of this is reachable from the public product UI.
 */
const express = require('express');
const requireAdmin = require('../../middleware/requireAdmin');
const requireCronSecret = require('../../middleware/requireCronSecret');
const db = require('../../db');
const gcs = require('../../services/gcsStorage');
const pipeline = require('../../services/leadgen/pipeline');

const router = express.Router();

// ── Automation endpoints (shared-secret, no session) ───────────────────────
router.post('/cron/tick', requireCronSecret, async (req, res) => {
  try {
    const advanced = await pipeline.tick(req.body?.limits || {});
    res.json({ ok: true, advanced });
  } catch (err) {
    console.error('[app] cron tick error:', err.message);
    res.status(500).json({ error: err.message });
  }
});
// Phase E: router.post('/webhooks/esp', requireCronSecret, ...);

// ── Admin-gated endpoints ──────────────────────────────────────────────────
router.use(requireAdmin);

router.get('/ping', (req, res) => {
  res.json({
    ok: true,
    db: !!db.pool,
    gcs: { enabled: gcs.isEnabled, bucket: gcs.bucketName || null },
  });
});

// Everything below needs Postgres.
router.use((req, res, next) => {
  if (!db.pool) return res.status(503).json({ error: 'Database not configured (DATABASE_URL unset)' });
  next();
});

router.get('/pipeline/summary', async (req, res) => {
  try {
    const { rows } = await db.query(
      `SELECT status, COUNT(*)::int AS count FROM leads GROUP BY status ORDER BY count DESC`
    );
    const byStatus = Object.fromEntries(rows.map((r) => [r.status, r.count]));
    const total = rows.reduce((n, r) => n + r.count, 0);
    res.json({ total, byStatus });
  } catch (err) {
    console.error('[app] pipeline summary error:', err.message);
    res.status(500).json({ error: 'Failed to load pipeline summary' });
  }
});

router.use('/leadgen', require('./leadgen'));
router.use('/settings', require('./settings'));
// Phase C+: router.use('/qualify', require('./qualify'));
//           router.use('/proposals', require('./proposals'));

module.exports = router;
