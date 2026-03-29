const fs = require('fs');
const path = require('path');
const db = require('../db');
const s3Storage = require('./s3Storage');

const JOBS_FILE = path.join(__dirname, '../../storage/jobs.json');
const jobs = new Map();
const sseClients = new Map();

// URL → jobId index for cache hit lookup (most recent completed job per URL)
const urlCache = new Map();

function normalizeUrl(url = '') {
  return url.trim().toLowerCase()
    .replace(/^https?:\/\/(www\.)?/, '')
    .replace(/\/$/, '');
}

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
      // Re-populate URL cache from persisted jobs
      if (job.status === 'done' && job.url) {
        const key = normalizeUrl(job.url);
        const existing = urlCache.get(key);
        if (!existing || job.createdAt > (jobs.get(existing)?.createdAt || 0)) {
          urlCache.set(key, id);
        }
      }
    });
    console.log(`[jobStore] Loaded ${jobs.size} jobs, ${urlCache.size} cached URLs`);
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
 * Lazy-load files from disk; falls back to S3 if not available locally.
 * Returns files object or null. For S3 fallback, returns a Promise.
 */
function loadFilesFromDisk(jobId) {
  const job = jobs.get(jobId);
  if (job?.files) return job.files;

  const projectDir = path.join(__dirname, '../../storage/projects', jobId);

  // Try local disk first
  if (fs.existsSync(projectDir)) {
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
      if (job) job.files = files;
      return files;
    } catch (err) {
      console.error(`Failed to load files for job ${jobId} from disk:`, err.message);
    }
  }

  // Fall back to S3
  if (s3Storage.isEnabled) {
    return s3Storage.downloadProjectFiles(jobId).then(files => {
      if (files && job) job.files = files;
      return files;
    }).catch(err => {
      console.error(`Failed to load files for job ${jobId} from S3:`, err.message);
      return null;
    });
  }

  return null;
}

function createJob(id, data = {}) {
  const job = {
    id,
    status: 'pending',
    step: 0,
    stepName: 'Queued',
    logs: [],
    files: null,
    tree: null,
    zipPath: null,
    projectName: data.projectName || null,
    tokens: null,
    error: null,
    createdAt: Date.now(),
    userId: data.userId || null,
    url: data.url || null,
    framework: data.framework || null,
    model: data.model || null,
  };
  jobs.set(id, job);
  saveJobs();

  // Save to database if available
  if (db.pool && job.userId) {
    db.query(
      `INSERT INTO jobs (id, user_id, url, framework, model, status, project_name)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT (id) DO NOTHING`,
      [job.id, job.userId, job.url, job.framework, job.model, job.status, job.projectName]
    ).catch(err => console.error('[jobStore] Failed to insert job in DB:', err.message));
  }

  return job;
}

function updateJob(id, updates) {
  const job = jobs.get(id);
  if (!job) return null;
  Object.assign(job, updates);
  saveJobs();
  broadcast(id, job);

  // Update in database if available
  if (db.pool) {
    const dbUpdates = {};
    if (updates.status !== undefined) dbUpdates.status = updates.status;
    if (updates.projectName !== undefined) dbUpdates.project_name = updates.projectName;
    if (updates.tokens !== undefined) dbUpdates.tokens = updates.tokens;
    if (updates.error !== undefined) dbUpdates.error = updates.error;
    if (updates.framework !== undefined) dbUpdates.framework = updates.framework;
    if (updates.model !== undefined) dbUpdates.model = updates.model;

    if (Object.keys(dbUpdates).length > 0) {
      const setClauses = Object.keys(dbUpdates).map((key, i) => `${key} = $${i + 2}`).join(', ');
      const values = [id, ...Object.values(dbUpdates)];
      db.query(
        `UPDATE jobs SET ${setClauses}, updated_at = NOW() WHERE id = $1`,
        values
      ).catch(err => console.error('[jobStore] Failed to update job in DB:', err.message));
    }
  }

  return job;
}

async function getJob(id) {
  // Try memory first
  if (jobs.has(id)) {
    return jobs.get(id);
  }

  // Try database if available
  if (db.pool) {
    try {
      const result = await db.query('SELECT * FROM jobs WHERE id = $1', [id]);
      if (result.rows.length > 0) {
        const row = result.rows[0];
        const job = {
          id: row.id,
          user_id: row.user_id,
          status: row.status,
          projectName: row.project_name,
          tokens: row.tokens,
          error: row.error,
          url: row.url,
          framework: row.framework,
          model: row.model,
          createdAt: new Date(row.created_at).getTime(),
          updatedAt: new Date(row.updated_at).getTime(),
        };
        return job;
      }
    } catch (err) {
      console.error('[jobStore] Failed to fetch job from DB:', err.message);
    }
  }

  return null;
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

/**
 * Register a completed job in the URL cache.
 * Called by the pipeline when status → 'done'.
 */
function registerUrlCache(url, jobId) {
  if (!url) return;
  urlCache.set(normalizeUrl(url), jobId);
}

/**
 * Look up the most recent completed job for a given URL.
 * Returns the jobId string if found, null otherwise.
 */
function findCachedJob(url) {
  if (!url) return null;
  const jobId = urlCache.get(normalizeUrl(url));
  if (!jobId) return null;
  const job = jobs.get(jobId);
  if (!job || job.status !== 'done') return null;
  return jobId;
}

/**
 * Get all jobs for a specific user from the database
 */
async function getUserJobs(userId) {
  if (!db.pool) {
    return [];
  }

  try {
    const result = await db.query(
      `SELECT id, user_id, status, project_name, url, framework, model, error, created_at, updated_at
       FROM jobs
       WHERE user_id = $1
       ORDER BY created_at DESC`,
      [userId]
    );
    return result.rows.map(row => ({
      id: row.id,
      userId: row.user_id,
      status: row.status,
      projectName: row.project_name,
      url: row.url,
      framework: row.framework,
      model: row.model,
      error: row.error,
      createdAt: new Date(row.created_at).getTime(),
      updatedAt: new Date(row.updated_at).getTime(),
    }));
  } catch (err) {
    console.error('[jobStore] Failed to fetch user jobs from DB:', err.message);
    return [];
  }
}

module.exports = {
  createJob, updateJob, getJob, addLog,
  addSSEClient, removeSSEClient,
  listJobs, loadFilesFromDisk,
  findCachedJob, registerUrlCache,
  getUserJobs,
};
