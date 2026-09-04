/**
 * Stage 3 — website audit + opportunity score.
 * Ported from the Python reference (~/Projects/leadgen/leadgen/audit.py).
 * Higher score = weaker current site = better redesign lead.
 */
const pagespeed = require('./pagespeed');
const store = require('./store');

const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';
const WEAK_BUILDERS = [
  ['wix', ['wix.com', 'wixstatic.com', '_wixcss']],
  ['godaddy', ['godaddy', 'gdwebsites', 'websitebuilder']],
  ['weebly', ['weebly.com', 'editmysite.com']],
  ['google sites', ['sites.google.com', 'gstatic.com/sites']],
];
const YEAR_RE = /(?:©|&copy;|copyright)\s*(?:\d{4}\s*[-–]\s*)?(\d{4})/gi;

async function fetchSignals(website, timeoutMs = 15000) {
  const out = { reachable: 0, http_status: null, https: 0, mobile_viewport: 0, platform: null, copyright_year: null, years_stale: null, final_url: null };
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const resp = await fetch(website, { headers: { 'User-Agent': UA }, redirect: 'follow', signal: ctrl.signal });
    out.final_url = resp.url;
    out.http_status = resp.status;
    out.https = resp.url.startsWith('https://') ? 1 : 0;
    out.reachable = resp.status < 400 ? 1 : 0;
    const html = (await resp.text()) || '';
    const low = html.toLowerCase();
    if (/<meta[^>]+name=["']viewport["']/i.test(html)) out.mobile_viewport = 1;
    const gen = html.match(/<meta[^>]+name=["']generator["'][^>]+content=["']([^"']+)["']/i);
    if (gen) out.platform = gen[1].slice(0, 80);
    for (const [label, markers] of WEAK_BUILDERS) {
      if (markers.some((m) => low.includes(m))) {
        out.platform = (out.platform ? out.platform + ' / ' : '') + label;
        break;
      }
    }
    const years = [...html.matchAll(YEAR_RE)].map((m) => Number(m[1])).filter((y) => y >= 2000 && y <= new Date().getFullYear());
    if (years.length) {
      out.copyright_year = Math.max(...years);
      out.years_stale = new Date().getFullYear() - out.copyright_year;
    }
  } catch (_) {
    // leave reachable = 0
  } finally {
    clearTimeout(t);
  }
  return out;
}

function score(lead, s) {
  let pts = 0;
  const reasons = [];
  const hasWebsite = !!lead.website;

  if (!hasWebsite) {
    pts += 60; reasons.push('no website on Google listing (+60)');
  } else if (!s.reachable) {
    pts += 55; reasons.push(`site unreachable / HTTP ${s.http_status} (+55)`);
  } else {
    pts += 8;
    if (!s.https) { pts += 25; reasons.push('no HTTPS (+25)'); }
    if (!s.mobile_viewport) { pts += 28; reasons.push('no mobile viewport (+28)'); }
    if (s.years_stale != null && s.years_stale >= 6) { pts += 22; reasons.push(`footer copyright ${s.copyright_year} (+22)`); }
    else if (s.years_stale != null && s.years_stale >= 3) { pts += 12; reasons.push(`footer copyright ${s.copyright_year} (+12)`); }
    const plat = (s.platform || '').toLowerCase();
    if (['wix', 'godaddy', 'weebly', 'google sites'].some((w) => plat.includes(w))) {
      pts += 10; reasons.push(`weak builder: ${s.platform} (+10)`);
    }
    if (s.psi_performance != null && s.psi_performance < 30) { pts += 25; reasons.push(`PSI performance ${s.psi_performance} (+25)`); }
    else if (s.psi_performance != null && s.psi_performance < 50) { pts += 15; reasons.push(`PSI performance ${s.psi_performance} (+15)`); }
    if (s.psi_seo != null && s.psi_seo < 70) { pts += 10; reasons.push(`PSI SEO ${s.psi_seo} (+10)`); }
    if (s.psi_accessibility != null && s.psi_accessibility < 70) { pts += 8; reasons.push(`PSI accessibility ${s.psi_accessibility} (+8)`); }
  }

  if (!lead.phone && !lead.contact_email) { pts -= 15; reasons.push('no phone and no email (-15)'); }

  return { score: Math.max(0, Math.min(100, pts)), reasons: reasons.join('; ') };
}

async function auditLead(lead) {
  const prev = lead.audit_signals || {};
  let signals = { has_website: !!lead.website };

  if (lead.website) {
    signals = { ...signals, ...(await fetchSignals(lead.website)) };
    if (signals.reachable) {
      signals = { ...signals, ...(await pagespeed.analyze(signals.final_url || lead.website)) };
    }
  }
  signals = { ...prev, ...signals };

  const { score: pts, reasons } = score(lead, signals);
  await store.updateLead(lead.id, {
    status: 'audited',
    audit_score: pts,
    audit_reasons: reasons,
    audit_signals: signals,
  });
  await store.recordEvent(lead.id, lead.status, 'audited', { score: pts });
  return { score: pts, reasons, signals };
}

module.exports = { auditLead, fetchSignals, score };
