const fs = require('fs');
const path = require('path');

const JOBS_FILE = path.join(__dirname, '../../storage/jobs.json');
const jobs = new Map();
const sseClients = new Map();

// Load jobs from disk on startup
if (fs.existsSync(JOBS_FILE)) {
  try {
    const data = JSON.parse(fs.readFileSync(JOBS_FILE, 'utf8'));
    Object.entries(data).forEach(([id, job]) => {
      // If a job was 'running' when the server stopped, mark it as failed
      if (job.status === 'running') {
        job.status = 'error';
        job.error = 'Process was interrupted or timed out.';
      }
      jobs.set(id, job);
    });
  } catch (err) {
    console.error('Failed to load jobs.json:', err.message);
  }
}

let saveTimeout = null;
function saveJobs() {
  if (saveTimeout) return; // Already scheduled
  
  saveTimeout = setTimeout(() => {
    try {
      const data = {};
      for (const [id, job] of jobs) {
        const { files, ...meta } = job;
        data[id] = meta;
      }
      fs.writeFileSync(JOBS_FILE, JSON.stringify(data, null, 2), 'utf8');
    } catch (err) {
      console.error('Failed to save jobs.json:', err.message);
    } finally {
      saveTimeout = null;
    }
  }, 2000); // Batch saves every 2 seconds
}

function saveJobsSync() {
  try {
    const data = {};
    for (const [id, job] of jobs) {
      const { files, ...meta } = job;
      data[id] = meta;
    }
    fs.writeFileSync(JOBS_FILE, JSON.stringify(data, null, 2), 'utf8');
  } catch (_) {}
}

/**
 * Lazy-load files from disk if they aren't in memory
 */
function loadFilesFromDisk(jobId) {
  const job = jobs.get(jobId);
  if (!job || job.files) return job?.files;

  const projectDir = path.join(__dirname, '../../storage/projects', jobId);
  if (!fs.existsSync(projectDir)) return null;

  const files = {};
  const walk = (dir, base = '') => {
    fs.readdirSync(dir).forEach(file => {
      const fullPath = path.join(dir, file);
      const relPath = path.join(base, file);
      if (fs.statSync(fullPath).isDirectory()) {
        if (file !== 'zips') walk(fullPath, relPath);
      } else {
        files[relPath] = fs.readFileSync(fullPath, 'utf8');
      }
    });
  };

  try {
    walk(projectDir);
    job.files = files;
    return files;
  } catch (err) {
    console.error(`Failed to load files for job ${jobId}:`, err.message);
    return null;
  }
}

function createJob(id) {
  const job = {
    id,
    status: 'pending',
    step: 0,
    stepName: 'Queued',
    logs: [],
    files: null,
    tree: null,
    zipPath: null,
    projectName: null,
    tokens: null,
    error: null,
    createdAt: Date.now(),
  };
  jobs.set(id, job);
  saveJobs();
  return job;
}

function updateJob(id, updates) {
  const job = jobs.get(id);
  if (!job) return null;
  Object.assign(job, updates);
  saveJobs();
  broadcast(id, job);
  return job;
}

function getJob(id) {
  return jobs.get(id) || null;
}

function addLog(id, message) {
  const job = jobs.get(id);
  if (!job) return;
  job.logs.push({ time: Date.now(), message });
  saveJobs();
  broadcast(id, job);
}

function broadcast(jobId, data) {
  const clients = sseClients.get(jobId);
  if (!clients) return;
  
  // Never send the full file map over SSE (too large)
  const { files, ...safeData } = data;
  const payload = `data: ${JSON.stringify({ ...safeData, fileCount: files ? Object.keys(files).length : 0 })}\n\n`;
  
  clients.forEach(res => {
    try { res.write(payload); } catch (_) {}
  });
}

function addSSEClient(jobId, res) {
  if (!sseClients.has(jobId)) sseClients.set(jobId, new Set());
  sseClients.get(jobId).add(res);
}

function removeSSEClient(jobId, res) {
  const clients = sseClients.get(jobId);
  if (clients) clients.delete(res);
}

function listJobs() {
  return Array.from(jobs.values()).sort((a, b) => b.createdAt - a.createdAt);
}

module.exports = { createJob, updateJob, getJob, addLog, addSSEClient, removeSSEClient, listJobs, loadFilesFromDisk };
