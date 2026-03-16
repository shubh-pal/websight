const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { scrapeURL } = require('../services/scraper');
const { generateRedesign } = require('../services/claude');
const { buildProject } = require('../services/projectBuilder');
const { createZip } = require('../services/zipper');
const { createJob, updateJob, addLog, getJob, findCachedJob, registerUrlCache, loadFilesFromDisk } = require('../services/jobStore');

const router = express.Router();

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

// POST /api/redesign  { url, framework, model, bypassCache }
router.post('/', async (req, res) => {
  const { url, framework = 'react', model = 'claude-opus-4-5', bypassCache = false } = req.body;
  if (!url) return res.status(400).json({ error: 'url is required' });

  // ── Cache hit check ────────────────────────────────────────────────────────
  if (!bypassCache) {
    const cachedJobId = findCachedJob(url);
    if (cachedJobId) {
      const jobId = uuidv4();
      createJob(jobId);
      res.json({ jobId, fromCache: true });
      replayFromCache(jobId, cachedJobId, url, framework, model).catch(err => {
        console.error(`[job ${jobId}] cache replay error:`, err);
        updateJob(jobId, { status: 'error', error: err.message });
        addLog(jobId, `Error: ${err.message}`);
      });
      return;
    }
  }

  // ── Fresh generation ───────────────────────────────────────────────────────
  const jobId = uuidv4();
  createJob(jobId);
  res.json({ jobId });

  runPipeline(jobId, url, null, framework, model).catch(err => {
    console.error(`[job ${jobId}] unhandled error:`, err);
  });
});

async function runPipeline(jobId, url, snapshot, framework, model = 'claude-opus-4-5') {
  const targetUrl = url || snapshot?.url;
  try {
    // ── 1 / 5  Scrape ─────────────────────────────────────────────────────
    updateJob(jobId, { status: 'running', step: 1, stepName: 'Scraping website', model, url: targetUrl });
    addLog(jobId, `Fetching ${targetUrl}…`);

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

    // Register in URL cache so future requests for this URL can skip generation
    registerUrlCache(targetUrl, jobId);

  } catch (err) {
    console.error(`[job ${jobId}] pipeline error:`, err);
    updateJob(jobId, { status: 'error', error: err.message });
    addLog(jobId, `Error: ${err.message}`);
  }
}

// ── Cache replay ─────────────────────────────────────────────────────────────
// Simulates the full pipeline visually but serves files from a previous generation.
// Takes ~2-3 seconds total vs 60-120 seconds for a fresh run.

async function replayFromCache(newJobId, cachedJobId, url, framework, model) {
  const cached = getJob(cachedJobId);
  if (!cached) throw new Error('Cached job not found');

  const brand     = cached.tokens?.brandName || 'site';
  const siteType  = cached.tokens?.siteType  || 'website';
  const compCount = (cached.tokens?.components || []).length;
  const pageCount = (cached.tokens?.pages      || []).length;

  // Staggered pipeline simulation — each step logs then waits
  const STEPS = [
    {
      step: 1, stepName: 'Loading from cache',
      logs: [
        `Fetching ${url}…`,
        `⚡ Cache hit — skipping scrape & AI generation`,
        `Restoring previous generation for "${brand}"`,
      ],
      delay: 450,
    },
    {
      step: 2, stepName: 'Restoring design tokens',
      logs: [
        `Design tokens restored — ${brand} (${siteType})`,
        `✓ Colors, typography, spacing, shadows loaded`,
        `✓ Brand: ${cached.tokens?.primaryColor || ''} · ${cached.tokens?.fontHeading || ''}`,
      ],
      delay: 380,
    },
    {
      step: 3, stepName: 'Loading components',
      logs: [
        `✓ Header & Footer restored`,
        ...(cached.tokens?.components || []).slice(0, 6).map(c => `✓ ${c} component loaded`),
        compCount > 6 ? `… and ${compCount - 6} more components` : null,
      ].filter(Boolean),
      delay: 420,
    },
    {
      step: 4, stepName: 'Loading pages',
      logs: [
        ...(cached.tokens?.pages || []).map(p => `✓ ${p} page loaded`),
        `✓ ${pageCount} page${pageCount !== 1 ? 's' : ''} restored`,
      ],
      delay: 360,
    },
    {
      step: 5, stepName: 'Building project & ZIP',
      logs: [
        'Writing project files…',
        'Creating ZIP archive…',
      ],
      delay: 200,
    },
  ];

  updateJob(newJobId, { status: 'running', url, model, framework });

  for (const s of STEPS) {
    updateJob(newJobId, { step: s.step, stepName: s.stepName });
    for (const log of s.logs) {
      await sleep(110);
      addLog(newJobId, log);
    }
    await sleep(Math.max(0, s.delay - s.logs.length * 110));
  }

  // Build a real project on disk for the new jobId using cached files
  const cachedFiles = loadFilesFromDisk(cachedJobId);
  if (!cachedFiles) throw new Error('Cached project files not found on disk');

  const projectName = cached.projectName || brand.toLowerCase().replace(/[^a-z0-9-]/g, '-').slice(0, 40);
  const { dir, tree, fileList } = await buildProject(newJobId, cachedFiles, projectName);
  const zipPath = await createZip(dir, projectName);

  updateJob(newJobId, {
    status: 'done',
    step: 5,
    stepName: 'Complete ✓',
    files: cachedFiles,
    tree,
    fileList,
    zipPath,
    projectName,
    tokens: cached.tokens,
    fromCache: true,
  });
  addLog(newJobId, '🎉 Your project is ready to download!');

  // Keep the URL in cache pointing to this latest job
  registerUrlCache(url, newJobId);
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
