'use strict';
/**
 * Design Intelligence Service
 * Loads ui-ux-pro-max CSV data and provides expert design system lookups.
 * Maps: siteType + brand signals → color palette, font pairing, landing pattern, UX rules, anti-patterns
 */

const fs   = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '../data');

// ─── CSV Parser ──────────────────────────────────────────────────────────────
// Handles quoted fields with commas, newlines inside quotes, etc.
function parseCSV(raw) {
  const rows = [];
  const lines = raw.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  let i = 0, headers = null;

  function parseField() {
    if (lines[i] === '"') {
      i++; // skip opening quote
      let field = '';
      while (i < lines.length) {
        if (lines[i] === '"' && lines[i + 1] === '"') { field += '"'; i += 2; }
        else if (lines[i] === '"') { i++; break; }
        else { field += lines[i++]; }
      }
      return field.trim();
    }
    let field = '';
    while (i < lines.length && lines[i] !== ',' && lines[i] !== '\n') {
      field += lines[i++];
    }
    return field.trim();
  }

  function parseLine() {
    const fields = [];
    while (i < lines.length && lines[i] !== '\n') {
      fields.push(parseField());
      if (lines[i] === ',') i++;
    }
    if (lines[i] === '\n') i++;
    return fields;
  }

  while (i < lines.length) {
    const fields = parseLine();
    if (!fields.length || (fields.length === 1 && fields[0] === '')) continue;
    if (!headers) { headers = fields; continue; }
    const row = {};
    headers.forEach((h, idx) => { row[h] = fields[idx] || ''; });
    rows.push(row);
  }
  return rows;
}

// ─── Load CSVs (lazy-cached) ─────────────────────────────────────────────────
const _cache = {};
function loadCSV(name) {
  if (_cache[name]) return _cache[name];
  const file = path.join(DATA_DIR, `${name}.csv`);
  if (!fs.existsSync(file)) { console.warn(`[DI] Missing CSV: ${name}`); return []; }
  _cache[name] = parseCSV(fs.readFileSync(file, 'utf-8'));
  return _cache[name];
}

// ─── Site-type → category mapping ────────────────────────────────────────────
// Maps WebSight's siteType + keywords to the ui-reasoning UI_Category values
const CATEGORY_MAP = {
  saas:        ['SaaS (General)', 'Micro SaaS', 'Enterprise SaaS', 'B2B SaaS'],
  'e-commerce':['E-commerce / Retail', 'D2C Brand', 'Fashion / Apparel', 'Marketplace'],
  portfolio:   ['Portfolio / Personal Brand', 'Creative Agency', 'Freelancer / Consultant'],
  agency:      ['Creative Agency', 'Marketing Agency', 'Design Agency', 'Digital Agency'],
  blog:        ['Blog / Content Site', 'News / Media', 'Newsletter'],
  corporate:   ['Corporate / Enterprise', 'Professional Services', 'Consulting'],
  healthcare:  ['Healthcare / Medical', 'Wellness / Fitness', 'Mental Health'],
  finance:     ['Finance / Banking', 'FinTech', 'Insurance', 'Accounting'],
  legal:       ['Legal Services', 'Law Firm'],
  realestate:  ['Real Estate', 'Property'],
  restaurant:  ['Restaurant / Food & Beverage', 'Food Delivery'],
  education:   ['Education / EdTech', 'Online Learning', 'Course Platform'],
  startup:     ['Startup / Launch', 'Product Hunt Launch', 'SaaS (General)'],
  ai:          ['AI / ML Platform', 'AI Tool', 'Chatbot Platform'],
  crypto:      ['Crypto / Web3 / DeFi', 'Blockchain', 'NFT Platform'],
  gaming:      ['Gaming / Entertainment', 'Game Studio'],
  nonprofit:   ['Non-Profit / NGO', 'Charity'],
  travel:      ['Travel / Hospitality', 'Hotel', 'Tourism'],
  other:       ['SaaS (General)', 'Corporate / Enterprise'],
};

// Keywords that help detect sub-category more precisely
const KEYWORD_SIGNALS = [
  { keywords: ['law', 'legal', 'attorney', 'counsel', 'litigation', 'firm'], category: 'Legal Services' },
  { keywords: ['health', 'medical', 'doctor', 'hospital', 'clinic', 'patient', 'care'], category: 'Healthcare / Medical' },
  { keywords: ['finance', 'bank', 'invest', 'insurance', 'fintech', 'trading', 'payment'], category: 'Finance / Banking' },
  { keywords: ['real estate', 'property', 'housing', 'mortgage', 'realty'], category: 'Real Estate' },
  { keywords: ['restaurant', 'food', 'dining', 'menu', 'cuisine', 'cafe', 'catering'], category: 'Restaurant / Food & Beverage' },
  { keywords: ['edu', 'learning', 'course', 'training', 'school', 'academy', 'university'], category: 'Education / EdTech' },
  { keywords: ['ai', 'artificial intelligence', 'machine learning', 'llm', 'gpt', 'chatbot'], category: 'AI / ML Platform' },
  { keywords: ['crypto', 'blockchain', 'nft', 'defi', 'web3', 'token', 'bitcoin', 'ethereum'], category: 'Crypto / Web3 / DeFi' },
  { keywords: ['game', 'gaming', 'esport', 'play', 'studio'], category: 'Gaming / Entertainment' },
  { keywords: ['shop', 'store', 'buy', 'cart', 'ecommerce', 'retail', 'product'], category: 'E-commerce / Retail' },
  { keywords: ['saas', 'platform', 'software', 'tool', 'dashboard', 'app', 'workspace'], category: 'SaaS (General)' },
  { keywords: ['agency', 'creative', 'design', 'branding', 'marketing', 'studio'], category: 'Creative Agency' },
  { keywords: ['blog', 'article', 'content', 'newsletter', 'publication', 'media', 'news'], category: 'Blog / Content Site' },
  { keywords: ['portfolio', 'work', 'projects', 'freelance', 'hire me'], category: 'Portfolio / Personal Brand' },
  { keywords: ['nonprofit', 'charity', 'foundation', 'ngo', 'donation', 'volunteer'], category: 'Non-Profit / NGO' },
  { keywords: ['travel', 'hotel', 'resort', 'booking', 'hospitality', 'tourism', 'vacation'], category: 'Travel / Hospitality' },
  { keywords: ['startup', 'launch', 'beta', 'waitlist', 'early access', 'product hunt'], category: 'Startup / Launch' },
];

function detectCategory(siteData, siteType) {
  const text = [
    siteData.url || '',
    siteData.title || '',
    siteData.description || '',
    ...(siteData.headings || []),
    ...(siteData.navLinks || []).map(n => n.text || n),
  ].join(' ').toLowerCase();

  // 1. Keyword signals (most specific)
  for (const { keywords, category } of KEYWORD_SIGNALS) {
    if (keywords.some(kw => text.includes(kw))) return category;
  }

  // 2. siteType fallback
  const mapped = CATEGORY_MAP[siteType] || CATEGORY_MAP['other'];
  return mapped[0];
}

// ─── Lookup functions ─────────────────────────────────────────────────────────

function findReasoningRule(category) {
  const rules = loadCSV('ui-reasoning');
  // Exact match first
  let rule = rules.find(r => r.UI_Category === category);
  // Partial match fallback
  if (!rule) rule = rules.find(r =>
    r.UI_Category?.toLowerCase().includes(category.toLowerCase().split('/')[0].trim())
  );
  return rule || rules[0]; // default to SaaS if nothing matches
}

function findColorPalette(category) {
  const palettes = loadCSV('colors');
  let palette = palettes.find(p => p['Product Type'] === category);
  if (!palette) palette = palettes.find(p =>
    p['Product Type']?.toLowerCase().includes(category.toLowerCase().split('/')[0].trim())
  );
  return palette || palettes[0];
}

function findFontPairing(typographyMood, siteType) {
  const pairings = loadCSV('typography');
  const mood = (typographyMood || '').toLowerCase();
  const type = (siteType || '').toLowerCase();

  // Score each pairing
  const scored = pairings.map(p => {
    const keywords = (p['Mood/Style Keywords'] || '').toLowerCase();
    const bestFor  = (p['Best For'] || '').toLowerCase();
    let score = 0;
    mood.split(/[+,\s]+/).forEach(word => {
      if (word.length > 2 && keywords.includes(word)) score += 2;
    });
    if (bestFor.includes(type)) score += 3;
    return { pairing: p, score };
  });

  scored.sort((a, b) => b.score - a.score);
  return scored[0]?.pairing || pairings[1]; // default: Modern Professional
}

function findLandingPattern(recommendedPattern) {
  const patterns = loadCSV('landing');
  if (!recommendedPattern) return patterns[0];
  const pattern = patterns.find(p =>
    p['Pattern Name']?.toLowerCase().includes(recommendedPattern.toLowerCase().split('+')[0].trim())
  );
  return pattern || patterns[0];
}

function getHighSeverityGuidelines(count = 8) {
  const guidelines = loadCSV('ux-guidelines');
  return guidelines
    .filter(g => g.Severity === 'High')
    .slice(0, count)
    .map(g => `• ${g.Issue}: ${g.Do}`);
}

// ─── Known brand identity overrides ──────────────────────────────────────────
// For well-known brands, use their actual design DNA instead of category defaults.
// Keyed by hostname fragment (lowercase).
const BRAND_OVERRIDES = {
  'notion.so':        { primary: '#000000', secondary: '#f7f6f3', accent: '#2eaadc', background: '#ffffff', foreground: '#37352f', card: '#f7f6f3', muted: '#f1f0ef', border: '#e9e8e5', heading: 'Inter', body: 'Inter', archetype: 'minimal-swiss', googleImport: "@import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap');" },
  'notion.com':       { primary: '#000000', secondary: '#f7f6f3', accent: '#2eaadc', background: '#ffffff', foreground: '#37352f', card: '#f7f6f3', muted: '#f1f0ef', border: '#e9e8e5', heading: 'Inter', body: 'Inter', archetype: 'minimal-swiss', googleImport: "@import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap');" },
  'stripe.com':       { primary: '#635bff', secondary: '#0a2540', accent: '#00d4ff', background: '#ffffff', foreground: '#0a2540', card: '#f6f9fc', muted: '#e6ebf1', border: '#e0e0e0', heading: 'Inter', body: 'Inter', archetype: 'neo-banking', googleImport: "@import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap');" },
  'linear.app':       { primary: '#5e6ad2', secondary: '#1a1a2e', accent: '#e8e8ff', background: '#fafafa', foreground: '#1a1a1a', card: '#ffffff', muted: '#f5f5f5', border: '#ebebeb', heading: 'Inter', body: 'Inter', archetype: 'tech-futuristic', googleImport: "@import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap');" },
  'vercel.com':       { primary: '#000000', secondary: '#111111', accent: '#0070f3', background: '#000000', foreground: '#ffffff', card: '#111111', muted: '#222222', border: '#333333', heading: 'Inter', body: 'Inter', archetype: 'tech-futuristic', googleImport: "@import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap');" },
  'figma.com':        { primary: '#f24e1e', secondary: '#a259ff', accent: '#1abcfe', background: '#ffffff', foreground: '#1e1e1e', card: '#f5f5f5', muted: '#e8e8e8', border: '#e0e0e0', heading: 'Inter', body: 'Inter', archetype: 'playful-startup', googleImport: "@import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap');" },
  'airbnb.com':       { primary: '#ff385c', secondary: '#222222', accent: '#ff385c', background: '#ffffff', foreground: '#222222', card: '#f7f7f7', muted: '#ebebeb', border: '#dddddd', heading: 'Circular Std', body: 'Circular Std', archetype: 'playful-startup', googleImport: "@import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');" },
  'shopify.com':      { primary: '#008060', secondary: '#212b36', accent: '#ffd79d', background: '#f6f6f7', foreground: '#1a1a1a', card: '#ffffff', muted: '#f1f2f3', border: '#e1e3e5', heading: 'Shopify Sans', body: 'Inter', archetype: 'gradient-saas', googleImport: "@import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap');" },
  'framer.com':       { primary: '#0055ff', secondary: '#111111', accent: '#05f', background: '#111111', foreground: '#ffffff', card: '#1a1a1a', muted: '#222222', border: '#333333', heading: 'Inter', body: 'Inter', archetype: 'gradient-saas', googleImport: "@import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap');" },
  'webflow.com':      { primary: '#4353ff', secondary: '#1a1a2e', accent: '#00c9ff', background: '#0a0a0f', foreground: '#ffffff', card: '#12122a', muted: '#1e1e3a', border: '#2a2a4a', heading: 'Inter', body: 'Inter', archetype: 'tech-futuristic', googleImport: "@import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap');" },
  'wordpress.com':    { primary: '#3858e9', secondary: '#1d35b4', accent: '#00ba37', background: '#f0f0f1', foreground: '#1e1e1e', card: '#ffffff', muted: '#dcdcde', border: '#c3c4c7', heading: 'Inter', body: 'Inter', archetype: 'gradient-saas', googleImport: "@import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap');" },
  'slack.com':        { primary: '#4a154b', secondary: '#36c5f0', accent: '#ecb22e', background: '#ffffff', foreground: '#1d1c1d', card: '#f8f8f8', muted: '#f1f1f1', border: '#e8e8e8', heading: 'Larsseit', body: 'Slack-Lato', archetype: 'playful-startup', googleImport: "@import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');" },
  'dropbox.com':      { primary: '#0061ff', secondary: '#2c2c2c', accent: '#0061ff', background: '#ffffff', foreground: '#1e1919', card: '#f7f5f2', muted: '#edebe6', border: '#e2e0db', heading: 'Sharp Grotesk', body: 'Atlas Grotesk', archetype: 'minimal-swiss', googleImport: "@import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600;700&display=swap');" },
};

function getBrandOverride(url = '') {
  const lower = url.toLowerCase();
  for (const [domain, override] of Object.entries(BRAND_OVERRIDES)) {
    if (lower.includes(domain)) return override;
  }
  return null;
}

// ─── Main export ──────────────────────────────────────────────────────────────

/**
 * getDesignSystem(siteData, siteType)
 * Returns a complete design intelligence package for a given site.
 */
function getDesignSystem(siteData, siteType = 'other') {
  try {
    // Check known brand overrides first
    const brandOverride = getBrandOverride(siteData.url || '');

    const category    = detectCategory(siteData, siteType);
    const rule        = findReasoningRule(category);
    const palette     = findColorPalette(category);
    const fontPairing = findFontPairing(rule?.Typography_Mood, siteType);
    const landing     = findLandingPattern(rule?.Recommended_Pattern);
    const uxRules     = getHighSeverityGuidelines(8);

    // Build CSS import string — brand override wins
    const googleFontsImport = brandOverride?.googleImport || fontPairing?.['CSS Import'] || '';

    // Build anti-patterns list
    const antiPatterns = (rule?.Anti_Patterns || '')
      .split('+').map(s => s.trim()).filter(Boolean);

    // Build color context for prompt injection — brand override takes priority
    const colorContext = brandOverride ? `
BRAND IDENTITY COLORS (exact — use these precisely, this is their real brand):
  Primary:    ${brandOverride.primary}
  Secondary:  ${brandOverride.secondary}
  Accent:     ${brandOverride.accent}
  Background: ${brandOverride.background}
  Foreground: ${brandOverride.foreground}
  Card:       ${brandOverride.card}
  Muted:      ${brandOverride.muted}
  Border:     ${brandOverride.border}` : palette ? `
Expert Color Palette for ${category}:
  Primary:    ${palette.Primary}     (on-primary text: ${palette['On Primary']})
  Secondary:  ${palette.Secondary}   (on-secondary: ${palette['On Secondary']})
  Accent:     ${palette.Accent}      (on-accent: ${palette['On Accent']})
  Background: ${palette.Background}
  Foreground: ${palette.Foreground}
  Card bg:    ${palette.Card}
  Muted:      ${palette.Muted}
  Border:     ${palette.Border}
  Note: ${palette.Notes}` : '';

    // Font context
    const fontContext = fontPairing ? `
Expert Font Pairing for ${category} (${fontPairing['Font Pairing Name']}):
  Heading: ${fontPairing['Heading Font']}
  Body:    ${fontPairing['Body Font']}
  Mood:    ${fontPairing['Mood/Style Keywords']}
  Google Fonts CSS: ${googleFontsImport}` : '';

    // Landing pattern context
    const landingContext = landing ? `
Recommended Landing Pattern: "${landing['Pattern Name']}"
  Section order: ${landing['Section Order']}
  CTA placement: ${landing['Primary CTA Placement']}
  Color strategy: ${landing['Color Strategy']}
  Recommended effects: ${landing['Recommended Effects']}
  Conversion tip: ${landing['Conversion Optimization']}` : '';

    // Style + effects context
    const styleContext = rule ? `
Industry Design Rules for "${category}":
  Style priority:   ${rule.Style_Priority}
  Color mood:       ${rule.Color_Mood}
  Typography mood:  ${rule.Typography_Mood}
  Key effects:      ${rule.Key_Effects}
  Severity:         ${rule.Severity}` : '';

    // Anti-pattern context
    const antiPatternContext = antiPatterns.length
      ? `ANTI-PATTERNS to strictly avoid for ${category}:\n${antiPatterns.map(a => `  ✗ ${a}`).join('\n')}`
      : '';

    // UX guardrails
    const uxContext = uxRules.length
      ? `Non-negotiable UX Requirements (apply to ALL components):\n${uxRules.join('\n')}`
      : '';

    return {
      category,
      rule,
      palette,
      fontPairing,
      landing,
      // String blocks ready to inject into prompts
      colorContext,
      fontContext,
      landingContext,
      styleContext,
      antiPatternContext,
      uxContext,
      // Raw values for token override — brand overrides take precedence
      colors: {
        primary:    brandOverride?.primary    || palette?.Primary    || null,
        secondary:  brandOverride?.secondary  || palette?.Secondary  || null,
        accent:     brandOverride?.accent     || palette?.Accent     || null,
        background: brandOverride?.background || palette?.Background || null,
        foreground: brandOverride?.foreground || palette?.Foreground || null,
        card:       brandOverride?.card       || palette?.Card       || null,
        muted:      brandOverride?.muted      || palette?.Muted      || null,
        border:     brandOverride?.border     || palette?.Border     || null,
      },
      fonts: {
        heading:      brandOverride?.heading      || fontPairing?.['Heading Font'] || null,
        body:         brandOverride?.body         || fontPairing?.['Body Font']    || null,
        googleImport: brandOverride?.googleImport || googleFontsImport,
      },
      brandOverride: brandOverride || null,
      isBrandOverride: !!brandOverride,
    };
  } catch (err) {
    console.warn('[DesignIntelligence] Error:', err.message);
    return { colorContext: '', fontContext: '', landingContext: '', styleContext: '', antiPatternContext: '', uxContext: '', colors: {}, fonts: {} };
  }
}

/**
 * buildDesignIntelligenceBlock(ds)
 * Returns a single formatted string block ready to inject into any AI prompt.
 */
function buildDesignIntelligenceBlock(ds) {
  if (!ds) return '';
  return `
╔══════════════════════════════════════════════════════════════════╗
║  EXPERT DESIGN INTELLIGENCE (ui-ux-pro-max · 161 industry rules) ║
╚══════════════════════════════════════════════════════════════════╝
${ds.styleContext}

${ds.colorContext}

${ds.fontContext}

${ds.landingContext}

${ds.antiPatternContext}

${ds.uxContext}
`.trim();
}

module.exports = { getDesignSystem, buildDesignIntelligenceBlock, detectCategory };
