const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { scrapeURL } = require('../services/scraper');
const { generateRedesign } = require('../services/claude');
const { buildProject } = require('../services/projectBuilder');
const { createZip } = require('../services/zipper');
const { createJob, updateJob, addLog } = require('../services/jobStore');

const router = express.Router();

// POST /api/redesign  { url, framework, model }
router.post('/', async (req, res) => {
  const { url, framework = 'react', model = 'claude-opus-4-5' } = req.body;
  if (!url) return res.status(400).json({ error: 'url is required' });

  const jobId = uuidv4();
  createJob(jobId);
  res.json({ jobId });

  runPipeline(jobId, url, null, framework, model).catch(err => {
    console.error(`[job ${jobId}] unhandled error:`, err);
  });
});

async function runPipeline(jobId, url, snapshot, framework, model = 'claude-opus-4-5') {
  try {
    // ── 1 / 5  Scrape ─────────────────────────────────────────────────────
    updateJob(jobId, { status: 'running', step: 1, stepName: 'Scraping website', model });
    addLog(jobId, `Fetching ${url || snapshot?.url}…`);

    const siteData = snapshot || await scrapeURL(url, (msg) => addLog(jobId, msg));
    addLog(jobId, `Scraped: "${siteData.title || 'untitled'}" via ${siteData.source}`);

    // ── 2-4 / 5  AI generation ────────────────────────────────────────────
    updateJob(jobId, { step: 2, stepName: 'AI design analysis' });

    const { tokens, files } = await generateRedesign(
      siteData,
      framework,
      (step, msg) => {
        // steps from claude.js are 1-based (1=tokens, 2=components, 3=pages, 4=boilerplate)
        updateJob(jobId, { step: step + 1, stepName: msg });
        addLog(jobId, msg);
      },
      model
    );

    // ── 5 / 5  Build + ZIP ────────────────────────────────────────────────
    updateJob(jobId, { step: 5, stepName: 'Building project & ZIP' });
    addLog(jobId, 'Writing project files…');

    const projectName = (tokens.brandName || siteData.title || 'redesigned-site')
      .toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-').slice(0, 40);

    const { dir, tree, fileList } = await buildProject(jobId, files, projectName);

    addLog(jobId, 'Creating ZIP archive…');
    const zipPath = await createZip(dir, projectName);

    updateJob(jobId, {
      status: 'done',
      step: 5,
      stepName: 'Complete ✓',
      files,
      tree,
      fileList,
      zipPath,
      projectName,
      tokens,
    });
    addLog(jobId, '🎉 Your project is ready to download!');
  } catch (err) {
    console.error(`[job ${jobId}] pipeline error:`, err);
    updateJob(jobId, { status: 'error', error: err.message });
    addLog(jobId, `Error: ${err.message}`);
  }
}

// POST /api/redesign/:id/edit { command }
router.post('/:id/edit', async (req, res) => {
  const { id } = req.params;
  const { command } = req.body;
  const { getJob, updateJob, addLog } = require('../services/jobStore');
  const { applyEdit } = require('../services/editor');

  const job = getJob(id);
  if (!job) return res.status(404).json({ error: 'Job not found' });

  res.json({ success: true, message: 'Edit started' });

  updateJob(id, { status: 'running', currentTask: 'editing' });
  addLog(id, `Applying edit: ${command}`);

  applyEdit(id, job, command, (msg) => {
    addLog(id, msg);
  }).catch(err => {
    console.error(`[edit ${id}] error:`, err);
    updateJob(id, { status: 'done', error: err.message }); // Keep it 'done' but with error
    addLog(id, `Edit failed: ${err.message}`);
  });
});

module.exports = router;
module.exports.runPipeline = runPipeline;
