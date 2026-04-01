const express = require('express');
const db = require('../db');

const router = express.Router();

// POST /api/waitlist
router.post('/', async (req, res) => {
  const { name, email, plan } = req.body;

  if (!name?.trim() || !email?.trim() || !plan?.trim()) {
    return res.status(400).json({ error: 'Name, email and plan are required.' });
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ error: 'Invalid email address.' });
  }

  if (!['pro', 'max'].includes(plan)) {
    return res.status(400).json({ error: 'Invalid plan.' });
  }

  try {
    if (db.pool) {
      await db.query(
        `INSERT INTO waitlist (name, email, plan)
         VALUES ($1, $2, $3)
         ON CONFLICT (email, plan) DO NOTHING`,
        [name.trim(), email.trim(), plan]
      );
    } else {
      console.log(`[waitlist] New signup (no DB): ${name} <${email}> — plan: ${plan}`);
    }

    res.json({ ok: true });
  } catch (err) {
    console.error('[waitlist] Insert error:', err.message);
    res.status(500).json({ error: 'Failed to join waitlist. Please try again.' });
  }
});

module.exports = router;
