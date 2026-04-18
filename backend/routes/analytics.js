const crypto = require('crypto');
const express = require('express');
const db = require('../db');

const router = express.Router();

function normalizePath(input) {
  if (!input || typeof input !== 'string') return '/';
  const path = input.trim();
  if (!path.startsWith('/')) return '/';
  return path.slice(0, 255);
}

function hashIp(ip) {
  if (!ip) return null;
  return crypto
    .createHash('sha256')
    .update(`${ip}:${process.env.SESSION_SECRET || 'dev-secret-change-in-production'}`)
    .digest('hex');
}

router.post('/visit', async (req, res) => {
  if (!db.pool) {
    return res.json({ tracked: false, reason: 'database unavailable' });
  }

  const visitorId = typeof req.body?.visitorId === 'string' ? req.body.visitorId.trim().slice(0, 128) : '';
  if (!visitorId) {
    return res.status(400).json({ error: 'visitorId is required' });
  }

  try {
    await db.query(
      `INSERT INTO visitor_events (visitor_id, user_id, path, referrer, user_agent, ip_hash)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        visitorId,
        req.user?.id || null,
        normalizePath(req.body?.path),
        typeof req.body?.referrer === 'string' ? req.body.referrer.slice(0, 500) : null,
        req.get('user-agent')?.slice(0, 500) || null,
        hashIp(req.ip),
      ]
    );

    return res.json({ tracked: true });
  } catch (err) {
    console.error('[analytics] Failed to store visit:', err.message);
    return res.status(500).json({ error: 'Failed to track visit' });
  }
});

module.exports = router;
