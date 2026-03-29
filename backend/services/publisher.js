/**
 * publisher.js — Build & publish a generated project to a subdomain
 *
 * Locally:    http://[slug].localhost:3001
 * Production: https://[slug].[APP_DOMAIN]
 */

const { exec } = require('child_process');
const path = require('path');
const fs = require('fs');
const puppeteer = require('puppeteer');

const PROJECTS_DIR = path.join(__dirname, '../../storage/projects');
const APP_URL = process.env.APP_URL || 'localhost:3001';

// In-memory subdomain → jobId index (also rebuilt from jobs on startup)
const subdomainIndex = new Map();

function slugify(name = '') {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 28) || 'site';
}

function getPublishedUrl(subdomain) {
  const isLocal = APP_URL.startsWith('localhost');
  if (isLocal) {
    // e.g. http://stripe.localhost:3001
    const port = APP_URL.split(':')[1] || '3001';
    return `http://${subdomain}.localhost:${port}`;
  }
  // e.g. https://stripe.myapp.com
  const proto = process.env.NODE_ENV === 'production' ? 'https' : 'http';
  return `${proto}://${subdomain}.${APP_URL}`;
}

function registerSubdomain(subdomain, jobId) {
  subdomainIndex.set(subdomain, jobId);
}

function findJobIdBySubdomain(subdomain) {
  return subdomainIndex.get(subdomain) ?? null;
}

function getDistDir(jobId) {
  return path.join(PROJECTS_DIR, jobId, 'dist');
}

function isBuilt(jobId) {
  const distIndex = path.join(getDistDir(jobId), 'index.html');
  return fs.existsSync(distIndex);
}

/**
 * Build the project (npm install + npm run build).
 * Resolves with the dist directory path.
 */
function buildProject(jobId) {
  const dir = path.join(PROJECTS_DIR, jobId);
  if (!fs.existsSync(dir)) return Promise.reject(new Error('Project directory not found'));

  return new Promise((resolve, reject) => {
    console.log(`[publish] Building ${jobId}…`);
    exec(
      'npm install --prefer-offline --no-audit --no-fund && npm run build',
      { cwd: dir, timeout: 180_000 },
      (err, stdout, stderr) => {
        if (err) {
          console.error(`[publish] Build failed for ${jobId}:`, stderr);
          reject(new Error(stderr?.slice(-400) || err.message));
        } else {
          console.log(`[publish] Build succeeded for ${jobId}`);
          resolve(getDistDir(jobId));
        }
      }
    );
  });
}

/**
 * Take a screenshot of the published project for comparison.
 */
async function screenshotProject(subdomain) {
  const url = getPublishedUrl(subdomain);
  let browser;
  try {
    console.log(`[publish] Taking screenshot of: ${url}`);
    browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu'],
    });
    const page = await browser.newPage();
    await page.setViewport({ width: 1440, height: 900 });
    
    // Wait for the local server/middleware to be ready for this subdomain
    await page.goto(url, { waitUntil: 'networkidle0', timeout: 15000 });
    
    // Hide any overlays or dev tools if needed
    const redesignScreenshot = await page.screenshot({ encoding: 'base64', type: 'webp', quality: 65 });
    return redesignScreenshot;
  } catch (err) {
    console.warn(`[publish] Screenshot failed for ${url}:`, err.message);
    return null;
  } finally {
    if (browser) await browser.close();
  }
}

module.exports = { slugify, getPublishedUrl, buildProject, isBuilt, getDistDir, registerSubdomain, findJobIdBySubdomain, screenshotProject };
