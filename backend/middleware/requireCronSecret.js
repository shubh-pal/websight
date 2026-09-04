/**
 * Guards internal automation endpoints (Cloud Scheduler ticks, ESP webhooks).
 * Cloud Scheduler is configured to send `X-Cron-Secret: <CRON_SECRET>`.
 * If CRON_SECRET is unset the endpoints are disabled (fail closed).
 */
module.exports = function requireCronSecret(req, res, next) {
  const expected = process.env.CRON_SECRET;
  if (!expected) {
    return res.status(503).json({ error: 'Automation disabled: CRON_SECRET not set' });
  }
  const provided = req.get('X-Cron-Secret') || req.query.key;
  if (provided !== expected) {
    return res.status(401).json({ error: 'Invalid cron secret' });
  }
  next();
};
