# WebSight — AI Website Redesigner

> Paste a URL or capture any tab with the Chrome extension. WebSight scrapes the site, extracts its design system, and generates a **complete, runnable React or Angular project** — not mockups, not snippets. A real project you can `npm install && npm run dev`.

---

## Architecture

```
User
 ├─ Web App (React + Vite, port 5173)  ←── inputs URL or opens extension result
 └─ Chrome Extension                   ←── captures full DOM + styles from any tab

Web App / Extension
 └─► Backend API (Express, port 3001)
       ├─ POST /api/redesign    ← URL input
       ├─ POST /api/snapshot    ← Extension DOM capture
       └─ GET  /api/jobs/:id/*  ← SSE stream, file map, ZIP download

Backend pipeline (per job):
  1. Scrape        ─ Puppeteer renders page, extracts colors/fonts/nav/sections
  2. Analyze       ─ Claude: site data → JSON design tokens (palette, typography, components, pages)
  3. Components    ─ Claude: tokens → Header, Footer, Layout, Hero, ... (all cohesive)
  4. Pages         ─ Claude: tokens + components → Home, About, ... (all reference same system)
  5. Boilerplate   ─ Code: package.json, vite.config, App.jsx, global CSS, tokens.css
  
Output:
  - In-browser file tree + syntax-highlighted code preview (SSE-live)
  - Downloadable ZIP → unzip → npm install → npm run dev → works
```

---

## Project Structure

```
websight/
├── backend/
│   ├── index.js                    Express server entry
│   ├── .env.example                Copy to .env and add your Anthropic key
│   ├── routes/
│   │   ├── redesign.js             POST /api/redesign (URL flow)
│   │   ├── snapshot.js             POST /api/snapshot (extension flow)
│   │   └── jobs.js                 GET /api/jobs/:id/* (SSE, files, download)
│   └── services/
│       ├── jobStore.js             In-memory job store with SSE broadcast
│       ├── scraper.js              Puppeteer + Cheerio fallback
│       ├── claude.js               Multi-step AI generation pipeline
│       ├── projectBuilder.js       Writes files to /tmp, builds file tree
│       └── zipper.js               Creates ZIP from temp dir
│
├── frontend/
│   ├── vite.config.js              Dev proxy → backend :3001
│   ├── src/
│   │   ├── App.jsx                 Router: / and /result/:jobId
│   │   ├── index.css               Dark IDE design system
│   │   ├── pages/
│   │   │   ├── Home.jsx            URL input + framework selector
│   │   │   └── Result.jsx          IDE view: progress + file tree + code + download
│   │   └── components/
│   │       ├── ProgressSteps.jsx   5-step animated pipeline indicator
│   │       ├── FileTree.jsx        Collapsible file explorer
│   │       ├── CodePreview.jsx     Syntax-highlighted code viewer
│   │       └── TokenBadges.jsx     Design token color swatches + meta
│
└── extension/
    ├── manifest.json               Chrome MV3 manifest
    ├── popup.html                  380×auto popup UI
    ├── popup.js                    Capture flow + job polling
    ├── background.js               Service worker
    └── generate-icons.js           Run once to create icons/
```

---

## Setup

### 1. Backend

```bash
cd backend
cp .env.example .env
# Add your ANTHROPIC_API_KEY to .env

npm install
npm run dev
# → http://localhost:3001
```

### 2. Frontend

```bash
cd frontend
npm install
npm run dev
# → http://localhost:5173
```

### 3. Chrome Extension

```bash
cd extension

# Optional: generate icons (requires `canvas` package)
npm install canvas
node generate-icons.js

# Load in Chrome:
# 1. Go to chrome://extensions
# 2. Enable "Developer mode"
# 3. Click "Load unpacked"
# 4. Select the extension/ folder
```

---

## Usage

### Via URL

1. Open `http://localhost:5173`
2. Paste any public URL (e.g. `https://stripe.com`)
3. Choose React or Angular output
4. Click **Generate Project**
5. Watch the 5-step pipeline in real-time
6. Browse the file tree + code preview
7. Click **Download ZIP** when done

### Via Chrome Extension

1. Navigate to any website in Chrome
2. Click the WebSight extension icon
3. Select your output framework
4. Click **Capture & Redesign**
5. Wait for the job to complete
6. Click **View Result →** to open the full IDE view

---

## Generated Project Structure

**React output** (Vite):
```
my-project/
├── package.json          (react, react-dom, react-router-dom)
├── vite.config.js
├── index.html            (Google Fonts loaded)
├── src/
│   ├── main.jsx
│   ├── App.jsx           (react-router-dom Routes)
│   ├── styles/
│   │   ├── global.css    (reset + base)
│   │   └── tokens.css    (all CSS custom properties)
│   ├── components/
│   │   ├── Header.jsx    (sticky nav, logo, CTA)
│   │   ├── Footer.jsx    (rich footer)
│   │   ├── Layout.jsx    (Header + children + Footer)
│   │   ├── Hero.jsx      (hero section)
│   │   └── ...           (more components)
│   └── pages/
│       ├── Home.jsx
│       ├── About.jsx
│       └── ...           (all detected pages)
```

**Run it:**
```bash
cd my-project
npm install
npm run dev
```

---

## Environment Variables

| Variable | Description | Default |
|---|---|---|
| `ANTHROPIC_API_KEY` | Your Anthropic API key | Required |
| `PORT` | Backend server port | `3001` |
| `FRONTEND_URL` | Allowed CORS origin | `http://localhost:5173` |

---

## In-browser Preview (StackBlitz WebContainer)

Once generation is complete, clicking the **Preview** tab boots a full **Vite dev server directly in the browser** using [StackBlitz WebContainers](https://stackblitz.com/docs/platform/webcontainers). No server-side build, no API key required.

What you can do in Preview:
- **Live running site** — the actual React/Angular app, not a screenshot
- **Preview / Editor / Split** view toggle in the toolbar
- **Quick-open** key files (App.jsx, tokens.css, Home.jsx) directly in the embedded editor
- **Hot module replacement** — edit a file in the embedded editor and the preview updates instantly

> ⚠️ WebContainers require a **Chromium-based browser** (Chrome, Edge, Arc). Firefox is not supported by StackBlitz WebContainers.



**Why multi-step AI generation?**
A single prompt for an entire React project hits token limits and loses coherence — later pages start drifting from the design system. Multi-step forces the AI to commit to a design token set first, then generate every component and page referencing those same tokens. Everything looks built together.

**Why SSE instead of WebSockets?**
Jobs are one-directional (server → client updates). SSE is simpler, HTTP-native, and survives proxy restarts better than WebSocket upgrades in typical hosting environments.

**Why Puppeteer + Cheerio fallback?**
Many modern sites are JS-rendered — `fetch` would get skeleton HTML. Puppeteer runs the full JS runtime. The Cheerio fallback covers environments where Chromium can't launch (restricted containers, small VMs).

---

## Production Notes

- Swap `jobStore.js` (in-memory Map) with Redis for multi-instance deployments
- Add rate limiting (e.g. `express-rate-limit`) before exposing publicly
- Puppeteer in production: use `puppeteer-core` + a managed Chrome instance (Browserless, etc.)
- Zip files in `/tmp` are auto-cleaned every hour in `jobStore.js`
- Update `host_permissions` in `manifest.json` to your production backend URL
# websight
