const express = require('express');
const db = require('../db');

const router = express.Router();

// POST /api/contact
router.post('/', async (req, res) => {
  const { name, email, message } = req.body;

  if (!name?.trim() || !email?.trim() || !message?.trim()) {
    return res.status(400).json({ error: 'Name, email and message are required.' });
  }

  // Basic email format check
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ error: 'Invalid email address.' });
  }

  try {
    if (db.pool) {
      await db.query(
        `INSERT INTO contact_submissions (name, email, message) VALUES ($1, $2, $3)`,
        [name.trim(), email.trim(), message.trim()]
      );
    } else {
      // No DB — log locally so it's not silently dropped
      console.log(`[contact] New submission (no DB): ${name} <${email}> — ${message.slice(0, 80)}`);
    }

    res.json({ ok: true });
  } catch (err) {
    console.error('[contact] Insert error:', err.message);
    res.status(500).json({ error: 'Failed to save your message. Please try emailing directly.' });
  }
});

module.exports = router;
