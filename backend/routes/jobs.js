const express = require('express');
const fs = require('fs');
const { getJob, addSSEClient, removeSSEClient, listJobs, loadFilesFromDisk } = require('../services/jobStore');

const router = express.Router();

// GET /api/jobs — list all past projects
router.get('/', (req, res) => {
  const allJobs = listJobs().map(j => {
    const { files, logs, ...rest } = j;
    return { ...rest, fileCount: files ? Object.keys(files).length : 0 };
  });
  res.json(allJobs);
});

// GET /api/jobs/:id — full job state (for initial load / polling fallback)
router.get('/:id', (req, res) => {
  const job = getJob(req.params.id);
  if (!job) return res.status(404).json({ error: 'Job not found' });

  // Don't send raw file contents in list view (can be huge)
  const { files, ...rest } = job;
  res.json({ ...rest, fileCount: files ? Object.keys(files).length : 0 });
});

// GET /api/jobs/:id/events — SSE stream of real-time job updates
router.get('/:id/events', (req, res) => {
  const job = getJob(req.params.id);
  if (!job) return res.status(404).json({ error: 'Job not found' });

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders();

  // Send current state immediately so client doesn't wait
  const { files, ...safe } = job;
  res.write(`data: ${JSON.stringify({ ...safe, fileCount: files ? Object.keys(files).length : 0 })}\n\n`);

  addSSEClient(req.params.id, res);

  // Heartbeat every 25s to keep connection alive through proxies
  const heartbeat = setInterval(() => {
    res.write(': ping\n\n');
  }, 25000);

  req.on('close', () => {
    clearInterval(heartbeat);
    removeSSEClient(req.params.id, res);
  });
});

// GET /api/jobs/:id/files — returns the full file map (code content)
router.get('/:id/files', (req, res) => {
  const job = getJob(req.params.id);
  if (!job) return res.status(404).json({ error: 'Job not found' });
  
  const files = loadFilesFromDisk(req.params.id);
  if (!files) return res.status(202).json({ message: 'Not ready yet' });
  
  res.json({ files, tree: job.tree, fileList: job.fileList });
});

// GET /api/jobs/:id/file?path=src/App.jsx — returns a single file's content
router.get('/:id/file', (req, res) => {
  const files = loadFilesFromDisk(req.params.id);
  if (!files) return res.status(404).json({ error: 'Not found' });
  
  const content = files[req.query.path];
  if (content === undefined) return res.status(404).json({ error: 'File not in project' });
  res.json({ path: req.query.path, content });
});

// GET /api/jobs/:id/download — streams the ZIP file
router.get('/:id/download', (req, res) => {
  const job = getJob(req.params.id);
  if (!job) return res.status(404).json({ error: 'Job not found' });
  if (!job.zipPath) return res.status(202).json({ message: 'ZIP not ready yet' });
  if (!fs.existsSync(job.zipPath)) return res.status(410).json({ error: 'ZIP expired' });

  const filename = `${job.projectName || 'websight-project'}.zip`;
  res.download(job.zipPath, filename);
});

module.exports = router;
