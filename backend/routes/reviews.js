const express = require('express');
const db = require('../db');
const { getJob } = require('../services/jobStore');
const requireUserOrAdmin = require('../middleware/requireUserOrAdmin');

const router = express.Router();

router.post('/:id/review', requireUserOrAdmin, async (req, res) => {
  const { rating, feedback } = req.body || {};
  const normalizedRating = Number(rating);
  const normalizedFeedback = typeof feedback === 'string' ? feedback.trim().slice(0, 2000) : '';

  if (!Number.isInteger(normalizedRating) || normalizedRating < 1 || normalizedRating > 5) {
    return res.status(400).json({ error: 'Rating must be an integer between 1 and 5' });
  }

  const job = await getJob(req.params.id);
  if (!job) {
    return res.status(404).json({ error: 'Job not found' });
  }

  if (!db.pool) {
    return res.status(503).json({ error: 'Database not initialized' });
  }

  try {
    const actorEmail = req.user?.email || req.session?.adminEmail || null;
    const actorType = req.user?.id ? 'user' : (req.session?.adminAuthenticated ? 'admin' : 'unknown');

    await db.query(
      `INSERT INTO deployment_reviews (job_id, user_id, actor_email, actor_type, rating, feedback)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (job_id) DO UPDATE SET
         user_id = EXCLUDED.user_id,
         actor_email = EXCLUDED.actor_email,
         actor_type = EXCLUDED.actor_type,
         rating = EXCLUDED.rating,
         feedback = EXCLUDED.feedback,
         created_at = NOW()`,
      [
        req.params.id,
        req.user?.id || null,
        actorEmail,
        actorType,
        normalizedRating,
        normalizedFeedback || null,
      ]
    );

    return res.json({ ok: true });
  } catch (err) {
    console.error('[review] Failed to save review:', err.message);
    return res.status(500).json({ error: 'Failed to save review' });
  }
});

module.exports = router;
