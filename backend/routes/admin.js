const express = require('express');
const db = require('../db');
const requireAdmin = require('../middleware/requireAdmin');
const { listJobs } = require('../services/jobStore');

const router = express.Router();

router.use(requireAdmin);

router.get('/overview', async (req, res) => {
  if (!db.pool) {
    return res.status(503).json({ error: 'Database not initialized' });
  }

  try {
    const [visitors, accounts, signups, recentVisitors, recentAccounts, jobs, contacts] = await Promise.all([
      db.query(
        `SELECT
           COUNT(DISTINCT visitor_id) AS unique_visitors,
           COUNT(*) AS total_visits
         FROM visitor_events`
      ),
      db.query(
        `SELECT
           COUNT(*) AS total_accounts,
           COUNT(*) FILTER (WHERE is_admin = TRUE) AS admin_accounts
         FROM users`
      ),
      db.query(
        `SELECT
           COUNT(*) AS total_signups,
           COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '7 days') AS signups_last_7_days,
           COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '30 days') AS signups_last_30_days
         FROM users`
      ),
      db.query(
        `SELECT
           visitor_id,
           MIN(ve.created_at) AS first_seen_at,
           MAX(ve.created_at) AS last_seen_at,
           COUNT(*) AS visit_count,
           MAX(ve.path) AS latest_path,
           MAX(ve.referrer) AS latest_referrer,
           MAX(ve.user_agent) AS latest_user_agent,
           MAX(u.email) AS linked_email,
           MAX(u.name) AS linked_name
         FROM visitor_events ve
         LEFT JOIN users u ON u.id = ve.user_id
         GROUP BY visitor_id
         ORDER BY MAX(ve.created_at) DESC
         LIMIT 25`
      ),
      db.query(
        `SELECT
           id,
           email,
           name,
           plan,
           is_admin,
           created_at,
           CASE
             WHEN google_id IS NOT NULL AND password_hash IS NOT NULL THEN 'google + password'
             WHEN google_id IS NOT NULL THEN 'google'
             WHEN password_hash IS NOT NULL THEN 'password'
             ELSE 'unknown'
           END AS auth_method
         FROM users
         ORDER BY created_at DESC
         LIMIT 50`
      ),
      db.query(
        `SELECT
           j.id,
           j.url,
           j.project_name,
           j.framework,
           j.model,
           j.status,
           j.error,
           j.created_at,
           j.updated_at,
           u.email AS user_email,
           u.name AS user_name
         FROM jobs j
         LEFT JOIN users u ON u.id = j.user_id
         ORDER BY j.created_at DESC
         LIMIT 50`
      ),
      db.query(
        `SELECT id, name, email, message, created_at
         FROM contact_submissions
         ORDER BY created_at DESC
         LIMIT 50`
      ),
    ]);

    const runtimeJobs = new Map(listJobs().map((job) => [job.id, job]));

    return res.json({
      summary: {
        uniqueVisitors: Number(visitors.rows[0]?.unique_visitors || 0),
        totalVisits: Number(visitors.rows[0]?.total_visits || 0),
        totalAccounts: Number(accounts.rows[0]?.total_accounts || 0),
        adminAccounts: Number(accounts.rows[0]?.admin_accounts || 0),
        totalSignups: Number(signups.rows[0]?.total_signups || 0),
        signupsLast7Days: Number(signups.rows[0]?.signups_last_7_days || 0),
        signupsLast30Days: Number(signups.rows[0]?.signups_last_30_days || 0),
        totalGeneratedWebsites: jobs.rowCount || 0,
        totalContacts: contacts.rowCount || 0,
      },
      visitors: recentVisitors.rows,
      users: recentAccounts.rows,
      signups: recentAccounts.rows.slice(0, 25),
      jobs: jobs.rows.map((job) => {
        const runtime = runtimeJobs.get(job.id);
        return {
          ...job,
          logs: Array.isArray(runtime?.logs) ? runtime.logs.slice(-12) : [],
        };
      }),
      contacts: contacts.rows,
    });
  } catch (err) {
    console.error('[admin] Failed to load overview:', err.message);
    return res.status(500).json({ error: 'Failed to load admin overview' });
  }
});

module.exports = router;
