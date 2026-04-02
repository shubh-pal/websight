const express = require('express');
const { getJob, getJobSync, updateJob } = require('../services/jobStore');
const { slugify, getPublishedUrl, buildProject, isBuilt, registerSubdomain, unregisterSubdomain, screenshotProject } = require('../services/publisher');
const requireAuth = require('../middleware/requireAuth');

const router = express.Router();

// POST /api/jobs/:id/publish
// Triggers a build and publishes the project to a subdomain.
// Pass ?force=true to rebuild even if already live (redeploy).
router.post('/:id/publish', requireAuth, async (req, res) => {
  const job = await getJob(req.params.id);
  if (!job) return res.status(404).json({ error: 'Job not found' });
  if (job.status !== 'done') return res.status(400).json({ error: 'Job must be complete before publishing' });

  const force = req.query.force === 'true';

  // Already published and built → return existing URL immediately (unless forced)
  if (!force && job.publishedSubdomain && isBuilt(req.params.id)) {
    return res.json({
      subdomain: job.publishedSubdomain,
      url: getPublishedUrl(job.publishedSubdomain),
      alreadyPublished: true,
    });
  }

  const subdomain = job.publishedSubdomain || slugify(job.projectName || job.id.slice(0, 8));

  // Mark as building
  updateJob(req.params.id, { publishStatus: 'building', publishedSubdomain: subdomain });
  registerSubdomain(subdomain, req.params.id);

  // Respond immediately — build runs in background
  res.json({ subdomain, url: getPublishedUrl(subdomain), building: true });

  buildProject(req.params.id)
    .then(async () => {
      const redesignScreenshot = await screenshotProject(subdomain);
      updateJob(req.params.id, {
        publishStatus: 'live',
        redesignScreenshot,
      });
      console.log(`[publish] ${subdomain} is live → ${getPublishedUrl(subdomain)}`);
    })
    .catch(err => {
      updateJob(req.params.id, { publishStatus: 'error', publishError: err.message });
      console.error(`[publish] ${subdomain} build error:`, err.message);
    });
});

// DELETE /api/jobs/:id/publish  (unpublish)
router.delete('/:id/publish', requireAuth, async (req, res) => {
  const job = await getJob(req.params.id);
  if (!job) return res.status(404).json({ error: 'Job not found' });

  if (job.publishedSubdomain) {
    unregisterSubdomain(job.publishedSubdomain);
  }

  updateJob(req.params.id, {
    publishStatus: null,
    publishedSubdomain: null,
    publishError: null,
  });

  res.json({ ok: true });
});

// GET /api/jobs/:id/publish-status
router.get('/:id/publish-status', async (req, res) => {
  const job = await getJob(req.params.id);
  if (!job) return res.status(404).json({ error: 'Job not found' });

  res.json({
    publishStatus: job.publishStatus || null,
    publishedSubdomain: job.publishedSubdomain || null,
    url: job.publishedSubdomain ? getPublishedUrl(job.publishedSubdomain) : null,
    publishError: job.publishError || null,
  });
});

module.exports = router;
