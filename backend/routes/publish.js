const express = require('express');
const { getJob, getJobSync, updateJob } = require('../services/jobStore');
const { slugify, getPublishedUrl, buildProject, isBuilt, registerSubdomain, screenshotProject } = require('../services/publisher');
const requireAuth = require('../middleware/requireAuth');

const router = express.Router();

// POST /api/jobs/:id/publish
// Triggers a build and publishes the project to a subdomain.
router.post('/:id/publish', requireAuth, async (req, res) => {
  const job = await getJob(req.params.id);
  if (!job) return res.status(404).json({ error: 'Job not found' });
  if (job.status !== 'done') return res.status(400).json({ error: 'Job must be complete before publishing' });

  // Already published and built → return existing URL immediately
  if (job.publishedSubdomain && isBuilt(req.params.id)) {
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
      // Capture screenshot of the new version
      const redesignScreenshot = await screenshotProject(subdomain);
      updateJob(req.params.id, { 
        publishStatus: 'live',
        redesignScreenshot: redesignScreenshot // Store base64 for now (simple)
      });
      console.log(`[publish] ${subdomain} is live → ${getPublishedUrl(subdomain)}`);
    })
    .catch(err => {
      updateJob(req.params.id, { publishStatus: 'error', publishError: err.message });
      console.error(`[publish] ${subdomain} build error:`, err.message);
    });
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
