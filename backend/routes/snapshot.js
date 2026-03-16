const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { parseSiteData } = require('../services/scraper');
const { createJob } = require('../services/jobStore');
const { runPipeline } = require('./redesign');

const router = express.Router();

/**
 * POST /api/snapshot
 * Body: {
 *   snapshot: {
 *     url, title, description, html, computedStyles, navLinks, fonts, colors, cssVars
 *   },
 *   framework: 'react' | 'angular'
 * }
 * Sent by the Chrome extension's content.js capture.
 */
router.post('/', async (req, res) => {
  const { snapshot, framework = 'react', model = 'claude-opus-4-5' } = req.body;
  if (!snapshot || !snapshot.url) {
    return res.status(400).json({ error: 'snapshot with url is required' });
  }

  const siteData = {
    ...parseSiteData(snapshot.url, snapshot.html || ''),
    url: snapshot.url,
    title: snapshot.title || '',
    description: snapshot.description || '',
    colors: snapshot.colors || [],
    fonts: snapshot.fonts || [],
    navLinks: snapshot.navLinks || [],
    cssVars: snapshot.cssVars || {},
    headings: snapshot.headings || [],
    bodyHTML: snapshot.html?.slice(0, 10000) || '',
    source: 'extension',
  };

  const jobId = uuidv4();
  createJob(jobId);
  res.json({ jobId });

  runPipeline(jobId, snapshot.url, siteData, framework, model).catch(err => {
    console.error(`[job ${jobId}] snapshot pipeline error:`, err);
  });
});

module.exports = router;
