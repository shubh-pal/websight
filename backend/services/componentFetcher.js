'use strict';
/**
 * Component Fetcher Service
 * Queries 21st.dev /api/search-mcp to fetch real production-quality component
 * references for each section type. Used to ground AI generation in real code.
 */

const https = require('https');
require('dotenv').config();

const API_KEY  = process.env.TWENTYFIRST_API_KEY || '';
const BASE_URL = 'https://21st.dev';

// In-memory cache: componentType → { code, fetchedAt }
const _cache = new Map();
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

// Search queries for each component type — tuned for best results
const SEARCH_QUERIES = {
  Hero:         'modern hero section landing page headline cta button',
  Features:     'features grid section cards with icons showcase',
  Stats:        'stats counter metrics animated numbers section',
  Testimonials: 'testimonials reviews cards social proof section',
  CTA:          'call to action section gradient background button',
  Pricing:      'pricing cards section tiers subscription',
  FAQ:          'faq accordion section questions answers',
  Header:       'navbar navigation header sticky responsive',
  Footer:       'footer links newsletter social media dark',
};

// ─── HTTP helper ──────────────────────────────────────────────────────────────
function httpPost(url, body, headers = {}) {
  return new Promise((resolve, reject) => {
    const parsed   = new URL(url);
    const payload  = JSON.stringify(body);
    const options  = {
      hostname: parsed.hostname,
      path:     parsed.pathname + parsed.search,
      method:   'POST',
      headers:  {
        'Content-Type':   'application/json',
        'Content-Length': Buffer.byteLength(payload),
        ...headers,
      },
    };

    const req = https.request(options, res => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(data) }); }
        catch (_) { resolve({ status: res.statusCode, body: data }); }
      });
    });

    req.on('error', reject);
    req.setTimeout(10000, () => { req.destroy(); reject(new Error('timeout')); });
    req.write(payload);
    req.end();
  });
}

// ─── Fetch component reference from 21st.dev ─────────────────────────────────
async function fetchComponentReference(componentType) {
  if (!API_KEY) return null;

  // Check cache
  const cached = _cache.get(componentType);
  if (cached && (Date.now() - cached.fetchedAt) < CACHE_TTL_MS) {
    return cached.reference;
  }

  const query = SEARCH_QUERIES[componentType] || componentType.toLowerCase();

  try {
    const { status, body } = await httpPost(
      `${BASE_URL}/api/search-mcp`,
      { search: query, match_threshold: 0.3, limit: 2 },
      { 'x-api-key': API_KEY }
    );

    if (status !== 200) {
      console.warn(`[ComponentFetcher] HTTP ${status} for ${componentType}:`, JSON.stringify(body).slice(0, 200));
      return null;
    }

    // Handle both { results: [...] } and flat array responses
    const rawResults = body?.results ?? body?.data ?? (Array.isArray(body) ? body : null);
    if (!rawResults?.length) {
      console.warn(`[ComponentFetcher] No results for ${componentType}. Response keys:`, Object.keys(body || {}));
      return null;
    }

    // Extract the best reference(s)
    const results = rawResults.slice(0, 2);
    const snippets = results.map((r, i) => {
      const code = r.componentCode || r.demoCode || r.code || r.component_code || r.content || '';
      const name = r.componentName || r.demoName || r.name || r.title || `Reference ${i + 1}`;
      if (!code || code.length < 50) return null;
      return `// Reference ${i + 1}: "${name}"\n${code.slice(0, 2000)}`;
    }).filter(Boolean);

    if (!snippets.length) return null;

    const reference = snippets.join('\n\n// ---\n\n');
    _cache.set(componentType, { reference, fetchedAt: Date.now() });
    console.log(`[ComponentFetcher] ✓ ${componentType} reference loaded (${reference.length} chars)`);
    return reference;

  } catch (err) {
    console.warn(`[ComponentFetcher] Error fetching ${componentType}:`, err.message);
    return null;
  }
}

// ─── Fetch references for all components in parallel ─────────────────────────
async function fetchAllComponentReferences(componentTypes = []) {
  const entries = await Promise.allSettled(
    componentTypes.map(async type => {
      const ref = await fetchComponentReference(type);
      return [type, ref];
    })
  );

  const refs = {};
  for (const result of entries) {
    if (result.status === 'fulfilled' && result.value[1]) {
      refs[result.value[0]] = result.value[1];
    }
  }
  return refs;
}

/**
 * buildReferenceBlock(componentType, referenceCode)
 * Formats the reference code for injection into a generation prompt.
 */
function buildReferenceBlock(componentType, referenceCode) {
  if (!referenceCode) return '';
  return `
┌─────────────────────────────────────────────────────────────────┐
│  REAL PRODUCTION REFERENCE (community component)                │
│  Study the structure, patterns, and quality — then SURPASS it   │
│  with the brand tokens and creative direction above.            │
└─────────────────────────────────────────────────────────────────┘
${referenceCode}
──────────────────────────────────────────────────────────────────
IMPORTANT: Do NOT copy this code. Use it as inspiration for:
- Component structure and naming conventions
- CSS pattern quality and specificity
- Interaction design and hover state sophistication
Then apply the brand tokens and creative direction above to make
it unique to this specific brand.`.trim();
}

module.exports = { fetchComponentReference, fetchAllComponentReferences, buildReferenceBlock };
