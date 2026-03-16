const BACKEND = 'http://localhost:3001';
let selectedFw = 'react';
let currentJobId = null;
let pollTimer = null;

// ── Init ────────────────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', async () => {
  // Load persisted framework choice
  const stored = await chrome.storage.local.get(['framework', 'lastJobId', 'lastJobStatus']);
  if (stored.framework) setFw(stored.framework);

  // Load active tab info
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tab) {
    document.getElementById('siteTitle').textContent = tab.title || tab.url;
    document.getElementById('siteUrl').textContent   = tab.url;
    document.getElementById('favicon').src = tab.favIconUrl || '';
  }

  // Restore last job state
  if (stored.lastJobId && stored.lastJobStatus !== 'done' && stored.lastJobStatus !== 'error') {
    currentJobId = stored.lastJobId;
    startPolling();
  } else if (stored.lastJobId && stored.lastJobStatus === 'done') {
    currentJobId = stored.lastJobId;
    showStatus('done', '✓ Last redesign complete');
    document.getElementById('viewResultBtn').classList.add('visible');
  }
});

// ── Framework selector ──────────────────────────────────────────────────────

function setFw(fw) {
  selectedFw = fw;
  document.getElementById('fw-react').classList.toggle('active', fw === 'react');
  document.getElementById('fw-angular').classList.toggle('active', fw === 'angular');
  chrome.storage.local.set({ framework: fw });
}

// ── Capture & send ──────────────────────────────────────────────────────────

async function capture() {
  const btn = document.getElementById('captureBtn');
  btn.disabled = true;
  btn.innerHTML = '<span class="spinner"></span> Capturing…';
  showStatus('running', 'Injecting content script…');
  clearInterval(pollTimer);

  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

    // Inject content script to extract DOM data
    const [result] = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: extractPageData,
    });

    const snapshot = result.result;
    showStatus('running', 'Sending to WebSight AI…');
    btn.innerHTML = '<span class="spinner"></span> Sending…';

    const res = await fetch(`${BACKEND}/api/snapshot`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ snapshot, framework: selectedFw }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: res.statusText }));
      throw new Error(err.error || 'Backend error');
    }

    const { jobId } = await res.json();
    currentJobId = jobId;
    await chrome.storage.local.set({ lastJobId: jobId, lastJobStatus: 'running' });

    showStatus('running', 'Job started — generating project…');
    btn.innerHTML = '<span class="spinner"></span> Generating…';
    startPolling();
  } catch (err) {
    showStatus('error', err.message || 'Something went wrong');
    btn.disabled = false;
    btn.innerHTML = '⟳ Retry';
  }
}

// ── DOM Extractor (runs in page context) ────────────────────────────────────

function extractPageData() {
  const colorSet = new Set();
  const fontSet  = new Set();
  const els = [...document.querySelectorAll('*')].slice(0, 400);

  els.forEach(el => {
    const s = window.getComputedStyle(el);
    [s.color, s.backgroundColor, s.borderColor].forEach(c => {
      if (c && c !== 'rgba(0, 0, 0, 0)' && c !== 'transparent') colorSet.add(c);
    });
    const font = s.fontFamily?.split(',')[0].trim().replace(/['"]/g, '');
    if (font && font !== 'inherit' && font !== 'initial') fontSet.add(font);
  });

  const navLinks = [];
  document.querySelectorAll('nav a, header a, [role="navigation"] a').forEach(a => {
    const text = a.textContent.trim();
    const href = a.getAttribute('href');
    if (text && href && !navLinks.find(n => n.text === text)) {
      navLinks.push({ text, href });
    }
  });

  const headings = [...document.querySelectorAll('h1,h2,h3')].slice(0, 12).map(h => ({
    level: h.tagName,
    text: h.textContent.trim().slice(0, 100),
  }));

  // CSS custom props
  const cssVars = {};
  try {
    for (const sheet of document.styleSheets) {
      try {
        for (const rule of sheet.cssRules || []) {
          if (rule.selectorText === ':root') {
            for (const prop of rule.style) {
              if (prop.startsWith('--')) cssVars[prop] = rule.style.getPropertyValue(prop).trim();
            }
          }
        }
      } catch (_) {}
    }
  } catch (_) {}

  return {
    url:         location.href,
    title:       document.title,
    description: document.querySelector('meta[name="description"]')?.content || '',
    html:        document.documentElement.outerHTML.slice(0, 30000),
    colors:      [...colorSet].slice(0, 25),
    fonts:       [...fontSet].filter(f => !['system-ui','serif','sans-serif','monospace'].includes(f)).slice(0, 8),
    navLinks:    navLinks.slice(0, 12),
    headings,
    cssVars,
    capturedAt:  Date.now(),
  };
}

// ── Polling ──────────────────────────────────────────────────────────────────

function startPolling() {
  clearInterval(pollTimer);
  pollTimer = setInterval(poll, 3000);
  poll();
}

async function poll() {
  if (!currentJobId) return;
  try {
    const res  = await fetch(`${BACKEND}/api/jobs/${currentJobId}`);
    const data = await res.json();

    chrome.storage.local.set({ lastJobStatus: data.status });

    const btn = document.getElementById('captureBtn');

    if (data.status === 'running' || data.status === 'pending') {
      showStatus('running', data.stepName || 'Processing…');
      btn.disabled = true;
      btn.innerHTML = `<span class="spinner"></span> Step ${data.step}/5`;

    } else if (data.status === 'done') {
      clearInterval(pollTimer);
      showStatus('done', `✓ Done — ${data.fileCount || '?'} files generated`);
      document.getElementById('viewResultBtn').classList.add('visible');
      btn.disabled = false;
      btn.innerHTML = '⟳ Redesign Again';

    } else if (data.status === 'error') {
      clearInterval(pollTimer);
      showStatus('error', data.error || 'Job failed');
      btn.disabled = false;
      btn.innerHTML = '⟳ Retry';
    }
  } catch (_) {
    // backend unreachable — keep polling silently
  }
}

// ── Actions ──────────────────────────────────────────────────────────────────

function viewResult() {
  if (!currentJobId) return;
  const appUrl = `http://localhost:5173/result/${currentJobId}`;
  chrome.tabs.create({ url: appUrl });
}

function openApp() {
  chrome.tabs.create({ url: 'http://localhost:5173' });
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function showStatus(type, msg) {
  const el = document.getElementById('status');
  const msgEl = document.getElementById('statusMsg');
  el.className = `status visible ${type}`;
  msgEl.textContent = msg;
}

// Expose globals for inline onclick handlers
window.setFw     = setFw;
window.capture   = capture;
window.viewResult = viewResult;
window.openApp   = openApp;
