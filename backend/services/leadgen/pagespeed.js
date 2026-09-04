/**
 * PageSpeed Insights API (v5) — free, uses the same GOOGLE_API_KEY.
 * Enable "PageSpeed Insights API" on the key for this to work.
 */
const ENDPOINT = 'https://www.googleapis.com/pagespeedonline/v5/runPagespeed';
const CATEGORIES = ['performance', 'seo', 'accessibility', 'best-practices'];

async function analyze(url, { apiKey = process.env.GOOGLE_API_KEY, timeoutMs = 60000 } = {}) {
  const params = new URLSearchParams();
  params.set('url', url);
  params.set('strategy', 'mobile');
  if (apiKey) params.set('key', apiKey);
  for (const c of CATEGORIES) params.append('category', c);

  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const resp = await fetch(`${ENDPOINT}?${params}`, { signal: ctrl.signal });
    if (!resp.ok) return {};
    const cats = (await resp.json())?.lighthouseResult?.categories || {};
    const score = (k) => {
      const v = cats[k]?.score;
      return v == null ? null : Math.round(v * 100);
    };
    return {
      psi_performance: score('performance'),
      psi_seo: score('seo'),
      psi_accessibility: score('accessibility'),
      psi_best_practices: score('best-practices'),
    };
  } catch (_) {
    return {};
  } finally {
    clearTimeout(t);
  }
}

module.exports = { analyze };
