const fs   = require('fs');
const path = require('path');
const { createAIClient } = require('./aiClient');

/**
 * Master pipeline: analyze → components → pages → boilerplate
 * model: 'gemini-2.5-flash' | 'claude-opus-4-5' | etc.
 */
async function generateRedesign(siteData, framework = 'react', onProgress = () => {}, model = 'claude-opus-4-5') {
  const ai = createAIClient(model);

  onProgress(1, `Analyzing brand identity… [${model}]`);
  const tokens = await analyzeAndTokenize(siteData, ai, (msg) => onProgress(1, msg));
  onProgress(1, `Brand analyzed — ${tokens.brandName} · ${tokens.styleArchetype || tokens.siteType} · ${tokens.brandPersonality || ''}`);

  onProgress(2, 'Creating layout strategy…');
  const layout = await generateLayoutStrategy(tokens, siteData, ai, (msg) => onProgress(2, msg));
  onProgress(2, `Layout — ${layout.sectionOrder.join(' → ')} | ${layout.designNotes || 'custom composition'}`);

  onProgress(3, 'Generating shared components…');
  const components = await generateComponents(tokens, layout, siteData, framework, ai, (msg) => onProgress(3, msg));

  onProgress(4, 'Generating pages…');
  const pages = await generatePages(tokens, layout, components, siteData, framework, ai, (msg) => onProgress(4, msg));

  onProgress(5, 'Assembling project boilerplate…');
  const boilerplate = buildBoilerplate(tokens, siteData, framework, pages);

  // Post-process: lift all <style>{`...`}</style> blocks out of JSX → global.css
  // This eliminates the entire class of "Missing semicolon" / "Expected ;" Babel errors
  // caused by CSS template literals in JSX files.
  let files = { ...boilerplate, ...components, ...pages };
  files = extractInlineCssToGlobal(files);
  files = sanitizeTokensCss(files);

  return { tokens, files };
}

// ─── Step 1: Design Tokens ────────────────────────────────────────────────────

async function analyzeAndTokenize(siteData, ai, onLog = () => {}) {
  const system = `You are a world-class brand strategist, product designer, and design system architect.
You do NOT just extract styles — you interpret brand identity and elevate it to premium quality.
Return ONLY valid JSON. No markdown. No explanation. Every field must be filled.`;

  const user = `Deeply analyze this website and generate a comprehensive brand system + creative direction.

URL: ${siteData.url}
Title: ${siteData.title}
Description: ${siteData.description}
Detected Colors: ${JSON.stringify((siteData.colors || []).slice(0, 20))}
Detected Fonts: ${JSON.stringify(siteData.fonts || [])}
CSS Variables: ${JSON.stringify(siteData.cssVars || {})}
Nav Links: ${JSON.stringify(siteData.navLinks || [])}
Page Sections: ${JSON.stringify((siteData.sections || []).slice(0, 8))}
Headings: ${JSON.stringify((siteData.headings || []).slice(0, 10))}
HTML Excerpt: ${(siteData.bodyHTML || '').slice(0, 4000)}

YOUR TASKS:

1. BRAND INTELLIGENCE
Infer:
- brandPersonality: one of [bold, playful, corporate, futuristic, minimal, authoritative, warm, innovative]
- targetAudience: concise description (e.g. "enterprise legal teams", "indie developers", "fashion-forward millennials")
- pricePositioning: budget | mid | premium | luxury
- visualMaturity: basic | decent | strong | elite

2. STYLE ARCHETYPE (critical — drives all visual variation)
Choose ONE styleArchetype that BEST fits the brand:
- "glassmorphism" — frosted glass panels, luminous accents, gradient backgrounds
- "brutalism" — raw borders, bold type, high contrast, intentional roughness
- "neo-banking" — ultra-clean, trust-first, data-rich, precise grid, no-fluff
- "editorial-luxury" — strong typographic hierarchy, generous whitespace, serif accents, restrained palette
- "playful-startup" — rounded everything, bright accent colors, friendly tone, organic shapes
- "tech-futuristic" — dark mode first, grid overlays, neon accents, terminal-inspired
- "minimal-swiss" — grid-based, whitespace as design element, muted palette, typographic focus
- "gradient-saas" — vibrant gradients, feature-rich layouts, conversion-optimized
Also choose secondaryStyle (optional blend) from same list.

3. COLOR SYSTEM (WCAG AA — primary/text must have ≥4.5:1 contrast on bg)
- primaryColor, secondaryColor, accentColor (hex)
- bgColor, bgSecondary, bgCard
- textColor, textMuted, textSubtle, borderColor
- gradientStart, gradientEnd, gradientAngle
- heroOverlay (rgba for dark overlays)
- successColor, warningColor
Choose colors that feel brand-authentic. NO generic purple/indigo unless brand actually uses it.

4. TYPOGRAPHY
- fontHeading: a Google Font that matches brand personality (editorial → serif, tech → geometric, creative → display)
- fontBody: readable Google Font (can be same as heading)
- fontMono: "JetBrains Mono"
- fontWeightHeading, fontWeightBody, baseFontSize, lineHeight, letterSpacingHeading

5. SPATIAL SYSTEM
- borderRadius (sharp=2px for enterprise/editorial, medium=8px general, round=16px+ for SaaS/consumer)
- borderRadiusLg, borderRadiusFull: 9999px
- spacing: base rem value (e.g. "1.5rem")
- boxShadow, boxShadowLg, boxShadowCard

6. MOTION SYSTEM
- animationMood: subtle (corporate) | dynamic (agency/creative) | playful (consumer) | none (minimal)
- transitionSpeed: e.g. "180ms"
- transitionCurve: e.g. "cubic-bezier(0.4,0,0.2,1)"
- scrollAnimation: "fade-up" | "slide-in" | "scale-in" | "none"

7. COMPONENT STRATEGY (drives layout variation — NO generic defaults)
For each component, choose layout type and visual approach appropriate for this SPECIFIC brand:
{
  "hero": {
    "layout": "centered|split-left|split-right|asymmetric|immersive|editorial",
    "visual": "blobs|product-ui|illustration|abstract-grid|minimal|pattern",
    "ctaStyle": "dual-button|single-cta|inline-form"
  },
  "features": {
    "layout": "3-col-grid|bento-grid|alternating-rows|timeline|2-col-asymmetric",
    "cardStyle": "bordered|elevated|flat|gradient-border"
  },
  "testimonials": {
    "layout": "3-col|masonry|featured-center|single-large"
  },
  "stats": {
    "layout": "4-col-dividers|2x2-grid|horizontal-banner",
    "style": "minimal-numbers|icon-led|gradient-text|bordered-cells"
  },
  "cta": {
    "layout": "centered-gradient|split-dark|full-bleed|minimal-border"
  }
}

8. CONTENT STRATEGY
- toneOfVoice: authoritative | friendly | bold | aspirational | technical | empathetic
- headlineStyle: short-punchy | descriptive | bold-claim | question-led
- ctaLanguage: example CTA text that fits this brand (e.g. "Request a Demo" vs "Start Building" vs "Get Early Access")
- tagline: short, brand-authentic tagline

9. NAVIGATION — MAX 5 links, relevant to actual brand
- navLinks: [{text, path}]
- pages: ["Home"]
- components: ["Features","Testimonials","CTA","Stats"]

10. CREATIVE DIRECTION (most important output — this is what prevents every site from looking the same)
Generate a bold, opinionated creative direction unique to this brand. Do NOT be safe or generic.
- designConcept: One strong sentence describing the core visual idea (e.g. "A high-contrast legal-tech interface that blends editorial seriousness with modern SaaS clarity")
- visualMotif: A recurring visual element woven throughout (e.g. "diagonal rule lines", "glowing edge accents", "frosted glass panels", "paper grain texture", "neon dot grid")
- layoutEnergy: calm | balanced | dynamic | experimental
- density: airy | balanced | dense
- uniquenessScore: low | medium | high | very-high (be honest — push for high/very-high)
- doNotDo: Array of 3 specific things to AVOID for THIS brand (e.g. "no playful blob shapes", "no centered hero layout", "no bright gradient backgrounds")
- mustHaveMoments: Array of 3 standout design moments this page MUST include (e.g. "asymmetric hero with large typographic statement", "dark immersive CTA section", "editorial section-break dividers")

Return ONLY this JSON (no markdown, no backticks, all fields filled):
{
  "brandName": "", "tagline": "", "siteType": "corporate|saas|e-commerce|portfolio|agency|blog|other",
  "brandPersonality": "", "targetAudience": "", "pricePositioning": "", "visualMaturity": "",
  "styleArchetype": "", "secondaryStyle": "",
  "primaryColor": "", "secondaryColor": "", "accentColor": "",
  "successColor": "", "warningColor": "",
  "bgColor": "", "bgSecondary": "", "bgCard": "",
  "textColor": "", "textMuted": "", "textSubtle": "", "borderColor": "",
  "gradientStart": "", "gradientEnd": "", "gradientAngle": "135deg",
  "heroOverlay": "rgba(0,0,0,0.45)",
  "fontHeading": "", "fontBody": "", "fontMono": "JetBrains Mono",
  "fontWeightHeading": "700", "fontWeightBody": "400",
  "baseFontSize": "16px", "lineHeight": "1.65", "letterSpacingHeading": "-0.02em",
  "borderRadius": "8px", "borderRadiusLg": "16px", "borderRadiusFull": "9999px",
  "spacing": "1.5rem",
  "boxShadow": "0 2px 16px rgba(0,0,0,0.08)",
  "boxShadowLg": "0 8px 40px rgba(0,0,0,0.12)",
  "boxShadowCard": "0 1px 4px rgba(0,0,0,0.06), 0 4px 24px rgba(0,0,0,0.08)",
  "animationMood": "subtle", "transitionSpeed": "200ms",
  "transitionCurve": "cubic-bezier(0.4,0,0.2,1)", "scrollAnimation": "fade-up",
  "componentStrategy": {
    "hero": { "layout": "centered", "visual": "blobs", "ctaStyle": "dual-button" },
    "features": { "layout": "3-col-grid", "cardStyle": "bordered" },
    "testimonials": { "layout": "3-col" },
    "stats": { "layout": "4-col-dividers", "style": "icon-led" },
    "cta": { "layout": "centered-gradient" }
  },
  "toneOfVoice": "", "headlineStyle": "", "ctaLanguage": "",
  "creativeDirection": {
    "designConcept": "",
    "visualMotif": "",
    "layoutEnergy": "balanced",
    "density": "balanced",
    "uniquenessScore": "high",
    "doNotDo": [],
    "mustHaveMoments": []
  },
  "navLinks": [], "pages": ["Home"],
  "components": ["Features","Testimonials","CTA","Stats"],
  "darkMode": false
}`;

  return withRetry(async () => {
    const raw = (await ai.complete(system, user, 4096, { isJson: true })).trim()
      .replace(/^```json?\n?/, '').replace(/\n?```$/, '');
    try { return JSON.parse(raw); }
    catch (_) {
      console.log("Raw JSON fail:", raw);
      const m = raw.match(/\{[\s\S]*\}/);
      if (m) {
        try { return JSON.parse(m[0]); }
        catch(e) { /* ignore and throw below */ }
      }
      throw new Error('PARSE_FAIL:' + raw);
    }
  }, ai, onLog, 'tokenize');
}

// ─── Step 1b: Layout Strategy ─────────────────────────────────────────────────
// Determines unique section order + layout types per section for this brand.
// This is what prevents every site from looking like the same SaaS template.

async function generateLayoutStrategy(tokens, siteData, ai, onLog = () => {}) {
  const system = `You are an award-winning creative director designing unique landing pages.
Return ONLY valid JSON. No markdown. No explanation.`;

  const archetype = tokens.styleArchetype || 'gradient-saas';
  const strategy  = tokens.componentStrategy || {};
  const comps     = (tokens.components || ['Features','Testimonials','CTA','Stats']);

  const user = `Create a unique layout composition for "${tokens.brandName}" (${tokens.siteType}).

Brand personality: ${tokens.brandPersonality}
Style archetype: ${archetype}
Target audience: ${tokens.targetAudience}
Tone of voice: ${tokens.toneOfVoice}
Component strategy: ${JSON.stringify(strategy)}
Available sections: ${comps.join(', ')}

DO NOT use a generic fixed order. Design a page flow that tells THIS brand's specific story.

🔥 HARD RULES — these override everything else:
1. This layout MUST NOT resemble a standard SaaS landing page template (Hero → Features → Pricing → CTA is banned)
2. At least ONE section must be visually unconventional — asymmetric, editorial, broken-grid, or full-bleed immersive
3. NEVER use the same layout type for two consecutive sections
4. Introduce at least ONE density contrast: a dense/information-rich section immediately followed by an airy/spacious one
5. Section ORDER must serve brand narrative — credibility brands lead with Stats, product-led with Features, trust-driven surface Testimonials early
6. Background rhythm MUST alternate meaningfully — not just light/light/light. Use dark sections to create drama.

Creative direction to apply:
${tokens.creativeDirection?.designConcept ? `Concept: ${tokens.creativeDirection.designConcept}` : ''}
${tokens.creativeDirection?.mustHaveMoments?.length ? `Must-have moments: ${tokens.creativeDirection.mustHaveMoments.join(' · ')}` : ''}
${tokens.creativeDirection?.doNotDo?.length ? `Avoid: ${tokens.creativeDirection.doNotDo.join(' · ')}` : ''}

Return JSON (only sections from available list + Hero):
{
  "sectionOrder": ["Hero", "Stats", "Features", "Testimonials", "CTA"],
  "sections": {
    "Hero": { "layout": "centered|split-left|split-right|asymmetric|immersive|editorial", "bg": "gradient|dark|light|pattern", "visual": "blobs|grid|illustration|product-ui|minimal" },
    "Features": { "layout": "3-col-grid|bento-grid|alternating-rows|timeline|2-col-asymmetric", "bg": "light|dark|secondary|accent-tint", "cardStyle": "bordered|elevated|flat|gradient-border" },
    "Stats": { "layout": "4-col-dividers|2x2-grid|horizontal-banner", "bg": "dark|primary|light|secondary", "style": "minimal-numbers|icon-led|gradient-text" },
    "Testimonials": { "layout": "3-col|masonry|featured-center|single-large", "bg": "light|secondary|dark" },
    "CTA": { "layout": "centered-gradient|split-dark|full-bleed|minimal-border", "bg": "gradient|dark|primary|accent" }
  },
  "globalAnimations": "fade-up|slide-in|scale-in|none",
  "designNotes": "One sentence of creative direction specific to this brand"
}`;

  try {
    return await withRetry(async () => {
      const raw = (await ai.complete(system, user, 2048, { isJson: true })).trim()
        .replace(/^```json?\n?/, '').replace(/\n?```$/, '');
      return JSON.parse(raw);
    }, ai, onLog, 'layout-strategy');
  } catch (err) {
    console.warn('[generateLayoutStrategy] Failed, using defaults:', err.message);
    // Sensible defaults so the pipeline never crashes
    return {
      sectionOrder: ['Hero', ...comps.filter(c => c !== 'Hero')],
      sections: {
        Hero:         { layout: strategy.hero?.layout         || 'centered',           bg: 'gradient',   visual: strategy.hero?.visual || 'blobs' },
        Features:     { layout: strategy.features?.layout     || '3-col-grid',         bg: 'light',      cardStyle: strategy.features?.cardStyle || 'bordered' },
        Stats:        { layout: strategy.stats?.layout        || '4-col-dividers',     bg: 'secondary',  style: strategy.stats?.style || 'icon-led' },
        Testimonials: { layout: strategy.testimonials?.layout || 'featured-center',    bg: 'light' },
        CTA:          { layout: strategy.cta?.layout          || 'centered-gradient',  bg: 'gradient' },
      },
      globalAnimations: tokens.scrollAnimation || 'fade-up',
      designNotes: '',
    };
  }
}

// ─── Step 2: Components ───────────────────────────────────────────────────────

async function generateComponents(tokens, layout, siteData, framework, ai, onLog = () => {}) {
  const isReact = framework === 'react';
  const ext     = isReact ? 'jsx' : 'ts';
  const compDir = isReact ? 'src/components' : 'src/app/components';
  const tokenCtx = buildTokenContext(tokens, layout);
  const siteCtx  = buildSiteContext(siteData);
  const navJson  = JSON.stringify((tokens.navLinks || []).slice(0, 5));

  // Pull layout-strategy specifics with safe fallbacks
  const heroLayout   = layout?.sections?.Hero?.layout         || 'centered';
  const heroVisual   = layout?.sections?.Hero?.visual         || 'blobs';
  const heroCtaStyle = tokens.componentStrategy?.hero?.ctaStyle || 'dual-button';
  const featLayout   = layout?.sections?.Features?.layout     || '3-col-grid';
  const featCard     = layout?.sections?.Features?.cardStyle  || 'bordered';
  const testLayout   = layout?.sections?.Testimonials?.layout || 'featured-center';
  const statsLayout  = layout?.sections?.Stats?.layout        || '4-col-dividers';
  const statsStyle   = layout?.sections?.Stats?.style         || 'icon-led';
  const ctaLayout    = layout?.sections?.CTA?.layout          || 'centered-gradient';
  const archetype    = tokens.styleArchetype                   || 'gradient-saas';
  const toneOfVoice  = tokens.toneOfVoice                     || 'professional';
  const ctaLanguage  = tokens.ctaLanguage                     || 'Get Started';

  // Creative direction fields
  const cd              = tokens.creativeDirection || {};
  const designConcept   = cd.designConcept    || '';
  const visualMotif     = cd.visualMotif      || '';
  const layoutEnergy    = cd.layoutEnergy     || 'balanced';
  const density         = cd.density         || 'balanced';
  const doNotDo         = (cd.doNotDo        || []).join(' · ');
  const mustHave        = (cd.mustHaveMoments || []).join(' · ');

  // Controlled randomness: inject a design tension to push each generation in a slightly different direction
  const designTensions  = ['minimal vs expressive', 'structured vs organic', 'calm vs energetic', 'precise vs fluid', 'restrained vs bold', 'dark vs luminous'];
  const designTension   = designTensions[Math.floor(Math.random() * designTensions.length)];

  // Creative constraints block — injected into every component prompt
  const creativeBlock = `
🎨 CREATIVE DIRECTION (follow strictly — this is what makes this site unique):
Design concept: ${designConcept || `${archetype} aesthetic for ${tokens.brandPersonality} brand`}
Visual motif: ${visualMotif || 'subtle brand-consistent visual theme'} — weave this throughout
Layout energy: ${layoutEnergy} | Density: ${density}
Design tension to explore: ${designTension}
${doNotDo   ? `AVOID: ${doNotDo}` : ''}
${mustHave  ? `MUST INCLUDE: ${mustHave}` : ''}

🔥 GLOBAL DIRECTIVE: This component must feel crafted by a human designer with a strong opinion — not generated by AI. Make at least ONE unexpected visual decision that a generic template would never make.`;

  // NOTE: tokens.css is NOT AI-generated — built deterministically in buildBoilerplate().

  const coreComponents = [
    {
      name: `Header.${ext}`, dir: compDir,
      prompt: `Generate ONLY a complete, production-quality ${isReact ? 'React JSX' : 'Angular TS'} Header component for "${tokens.brandName}".

${tokenCtx}
Nav links (MAX 5): ${navJson}

STYLING RULES:
- <style>{\`...\`}</style> as FIRST child in return(), "hdr-" prefixed classes — NO inline styles
- Include :hover states, transitions, @media (max-width: 768px)

DESIGN — archetype: ${archetype}
- Sticky, z-index 100. Background: rgba(var(--bg-rgb), 0.88), backdrop-filter: blur(20px) saturate(180%)
- Border-bottom: 1px solid rgba(var(--border-rgb), 0.5). On scroll: add box-shadow via scroll listener.
- Logo: ${siteData.logoUrl
  ? `USE REAL LOGO → <img src="${siteData.logoUrl}" alt="${tokens.brandName}" className="hdr-logo-img" style treated as .hdr-logo-img { height: 36px; width: auto; object-fit: contain; display: block; }. Place BEFORE brand name or use INSTEAD of it. No placeholder SVG.`
  : `geometric SVG mark (initials or shape fitting "${archetype}" archetype) + brand name in --font-heading, font-weight 700`}
- Nav: gap 32px, font-size 0.9rem, weight 500, color var(--text-muted). Hover: color var(--text) + ::after underline slide-in
- Active link: color var(--primary), underline visible
- CTA: --primary bg, white text, padding 10px 22px, var(--radius-full). Hover: scale(1.03), glow shadow
- Mobile (≤768px): 3-bar hamburger, slide-down nav, 48px touch targets

REQUIRED IMPORTS:
${isReact ? `import { useState, useEffect } from 'react';\nimport { Link, useLocation } from 'react-router-dom';` : ''}
import '../styles/tokens.css';
${isReact ? 'Default export function Header().' : 'Standalone Angular component.'}
Return ONLY raw file from imports. No markdown fences.`,
    },
    {
      name: `Footer.${ext}`, dir: compDir,
      prompt: `Generate ONLY a complete, production-quality ${isReact ? 'React JSX' : 'Angular TS'} Footer for "${tokens.brandName}".

${tokenCtx}
Nav links: ${navJson}
Tagline: "${tokens.tagline || ''}"

STYLING: <style>{\`...\`}</style> with "ftr-" prefixed classes. @media (max-width: 768px).

DESIGN — premium footer (Vercel/Linear quality) — archetype: ${archetype}

STRUCTURE: dark background (#0d0d0d for dark archetype, near-black on light themes), padding 64px 0 32px.
Gradient separator line at very top: 1px, linear-gradient(90deg, transparent, var(--border), transparent).

4-COLUMN GRID (→ 2-col tablet → 1-col mobile):
Col 1 BRAND:
- ${siteData.logoUrl
  ? `Real logo: <img src="${siteData.logoUrl}" className="ftr-logo-img" /> CSS: height:32px; filter:brightness(0) invert(1); opacity:0.9`
  : `SVG initials mark + brand name`}
- Tagline text, max-width 200px, color rgba(255,255,255,0.5)
- LinkedIn + Twitter/X social icons (20×20 SVG, 36×36 circle containers, rgba(255,255,255,0.05) bg, hover lift)

Col 2 "SERVICES": 4-5 links relevant to ${tokens.siteType}
Col 3 "COMPANY": About Us, Our Team, Careers, Contact
Col 4 NEWSLETTER: "Stay updated" heading + email input + Subscribe button (flex row, --primary bg btn)

LINK STYLING: 0.75rem uppercase letter-spacing headings; 0.9rem links, rgba(255,255,255,0.5) color, hover white.
BOTTOM BAR: flex space-between, © ${new Date().getFullYear()} ${tokens.brandName}. All rights reserved. | Privacy · Terms · Cookies

REQUIRED IMPORTS:
import '../styles/tokens.css';
${isReact ? 'Default export function Footer().' : ''}
Return ONLY raw file. No markdown fences.`,
    },
    {
      name: `Layout.${ext}`, dir: compDir,
      prompt: `Generate ONLY the ${isReact ? 'React JSX' : 'Angular TS'} Layout wrapper for "${tokens.brandName}".

${isReact ? `Import Header, Footer, tokens.css.
export default function Layout({ children }) {
  return (<><Header /><main className="layout-main">{children}</main><Footer /></>);
}
Add <style> with: .layout-main { min-height: calc(100vh - 140px); }` : 'Angular: router-outlet between Header and Footer.'}
Return ONLY raw file. No markdown fences.`,
    },
    {
      name: `Hero.${ext}`, dir: compDir,
      prompt: `Design a visually striking, non-generic Hero section for "${tokens.brandName}" that expresses the creativeDirection below. This MUST feel custom-designed for this brand — not reusable for any other site.

${tokenCtx}
${siteCtx}
${creativeBlock}

STYLING: <style>{\`...\`}</style> first, "hero-" prefixed classes, @media (max-width: 768px) + (max-width: 480px).

LAYOUT TYPE: "${heroLayout}" — follow this strictly:
${heroLayout === 'split-left'    ? '- Split: text LEFT (max-width 520px), visual element RIGHT. Equal columns. Text left-aligned.' : ''}
${heroLayout === 'split-right'   ? '- Split: visual LEFT, text RIGHT (max-width 520px). Text left-aligned.' : ''}
${heroLayout === 'asymmetric'    ? '- Asymmetric: 60/40 split. Intentional imbalance. Left-heavy text block, right decorative.' : ''}
${heroLayout === 'immersive'     ? '- Full viewport immersive. Background IS the design. Content centered, overlaid. Dramatic.' : ''}
${heroLayout === 'editorial'     ? '- Editorial: large typographic statement. Minimal decoration. Grid-based alignment. Like NYT or Bloomberg.' : ''}
${heroLayout === 'centered'      ? '- Centered: text + CTAs centered. Visual elements as background/beneath content.' : ''}

VISUAL: "${heroVisual}"
${heroVisual === 'blobs'         ? '- 2-3 blurred gradient blobs (position:absolute, filter:blur(80px), opacity:0.35, 300-600px circles)' : ''}
${heroVisual === 'product-ui'    ? '- Mockup of product UI (use realistic placeholder divs styled as UI components — cards, graphs, etc.)' : ''}
${heroVisual === 'abstract-grid' ? '- Subtle CSS grid/dot pattern overlay + geometric line shapes' : ''}
${heroVisual === 'minimal'       ? '- Zero visual decoration. Typography IS the design. Maximum white space.' : ''}
${heroVisual === 'pattern'       ? '- Repeating pattern background (CSS radial-gradient dots or lines)' : ''}

CONTENT:
- Badge: pill with "✦ ${tokens.tagline || tokens.brandName}" — rgba(primary,0.1) bg, border, border-radius 9999px
- Headline: clamp(3rem, 7vw, 5.5rem), weight 800-900, tracking -0.04em, line-height 1.05. Match "${tokens.headlineStyle}" style. Max 10 words.
- Subheadline: clamp(1rem, 2vw, 1.25rem), line-height 1.7, max-width 560px, var(--text-muted)
- CTAs (${heroCtaStyle}): primary="${ctaLanguage}" (--primary bg), secondary="Learn More" (bordered). Hover: translateY(-2px) scale(1.02), glow
- Social proof row: stars + trust signals relevant to "${tokens.brandName}" audience: "${tokens.targetAudience}"
- Real content: brand="${tokens.brandName}", desc="${siteData.description || ''}"

TONE: ${toneOfVoice}. Headline must NOT sound generic SaaS. Write as a ${tokens.brandPersonality} brand.

REQUIRED IMPORTS:
import { useEffect, useRef } from 'react';
import '../styles/tokens.css';
${isReact ? 'Default export function Hero().' : ''}
Return ONLY raw file from imports. No markdown fences.`,
    },
  ];

  // ─── Extra components (adaptive prompts) ───────────────────────────────────

  const extraDefs = {
    Features: {
      prompt: () => `Design a visually distinctive Features section for "${tokens.brandName}" (${tokens.siteType}). This must feel custom — not a generic feature grid.
${tokenCtx}
${siteCtx}
${creativeBlock}

STYLING: <style>{\`...\`}</style> with "feat-" prefixed classes. @media (max-width: 768px) + (max-width: 480px).

STRUCTURE RULES (override generic defaults):
- DO NOT default to equal uniform cards — vary emphasis and hierarchy
- At least ONE feature must be visually dominant (larger, different treatment)
- Apply the visual motif "${visualMotif}" as a recurring accent element

LAYOUT: "${featLayout}" — implement this layout type precisely:
${featLayout === '3-col-grid'        ? '- 3-column equal grid → 2-col tablet → 1-col mobile. Uniform card heights.' : ''}
${featLayout === 'bento-grid'        ? '- Bento grid: CSS grid with varying card sizes (1 large + 2 small + 1 medium + 2 small). Asymmetric but balanced.' : ''}
${featLayout === 'alternating-rows'  ? '- Alternating rows: icon/text LEFT then RIGHT each row. 2-column, full-width rows. Generous spacing.' : ''}
${featLayout === 'timeline'          ? '- Vertical timeline: center line, alternating left/right content blocks, connected dots.' : ''}
${featLayout === '2-col-asymmetric'  ? '- 2-column asymmetric: left column 40% (large feature), right column 60% (2×2 smaller features).' : ''}

CARD STYLE: "${featCard}"
${featCard === 'bordered'        ? '- border: 1px solid var(--border), no shadow by default, hover: border-color rgba(primary,0.4), shadow-lg' : ''}
${featCard === 'elevated'        ? '- box-shadow: var(--shadow-card), no border, hover: translateY(-6px), shadow-lg' : ''}
${featCard === 'flat'            ? '- No border, no shadow. Background tint only. Hover: bg-secondary.' : ''}
${featCard === 'gradient-border' ? '- Gradient border: use CSS background-clip trick or pseudo-element gradient border. Glows on hover.' : ''}

SECTION HEADER: Eyebrow ("WHY CHOOSE ${tokens.brandName.toUpperCase()}", letter-spacing 0.1em, --primary, 0.8rem) + heading clamp(2rem,4vw,3rem) + subtext max-width 560px.
ICONS: 48×48 containers, rgba(primary,0.1) bg, 24×24 SVG (geometric, not emoji). Unique icon per feature.
Write 6 REAL features for "${tokens.brandName}" audience: "${tokens.targetAudience}".
Tone: ${toneOfVoice}.

Import '../styles/tokens.css'; Default export.
Return ONLY complete raw JSX file.`
    },

    Testimonials: {
      prompt: () => `Design a compelling Testimonials section for "${tokens.brandName}" that feels emotionally real — not like AI filler.
${tokenCtx}
${creativeBlock}

STYLING: <style>{\`...\`}</style> with "test-" prefixed classes. @media (max-width: 768px).

CONTENT RULES (critical — generic testimonials ruin credibility):
Each testimonial MUST include: (1) a specific scenario/context, (2) a measurable outcome or metric, (3) an emotional resonance authentic to "${tokens.targetAudience}"
NO generic phrases like "highly recommend" or "great experience" — write vivid, specific, believable quotes.

LAYOUT: "${testLayout}"
${testLayout === '3-col'            ? '- 3 equal columns, uniform cards.' : ''}
${testLayout === 'masonry'          ? '- Masonry/Pinterest layout: CSS columns:3, varying card heights, natural flow.' : ''}
${testLayout === 'featured-center'  ? '- Center card larger/elevated (scale 1.04, featured border), flanked by 2 smaller cards.' : ''}
${testLayout === 'single-large'     ? '- One large featured quote taking 2/3 width + 2 stacked smaller quotes on right.' : ''}

SECTION: bg var(--bg-secondary) or rgba(primary,0.03). Padding 96px 0. Eyebrow "TRUSTED BY LEADING ${tokens.siteType.toUpperCase()}S" + heading clamp(1.8rem,4vw,2.75rem).

CARDS: bg var(--bg), border 1px solid var(--border), border-radius var(--radius-lg), padding 32px.
Hover: translateY(-5px), shadow-lg, border-color rgba(primary,0.25).
Contents: ★★★★★ (#f59e0b) → large quote mark (opacity 0.2) → italic quote → divider → avatar (initials circle, --gradient bg) + name + role/company.
Featured card: border-color var(--primary), box-shadow 0 0 0 1px var(--primary), 0 8px 40px rgba(primary-rgb, 0.15).

Write 3 vivid, SPECIFIC testimonials for "${tokens.brandName}" — real metrics, no generic praise.
Tone: ${toneOfVoice}. Audience: "${tokens.targetAudience}".

Import '../styles/tokens.css'; Default export.
Return ONLY complete raw JSX file.`
    },

    CTA: {
      prompt: () => `Design an emotionally resonant, visually striking CTA section for "${tokens.brandName}" — this is the last impression. Make it memorable.
${tokenCtx}
${creativeBlock}

STYLING: <style>{\`...\`}</style> with "cta-" prefixed classes.

LAYOUT: "${ctaLayout}"
${ctaLayout === 'centered-gradient' ? '- Full-width gradient bg (--gradient), content centered, max-width 640px. Decorative blobs.' : ''}
${ctaLayout === 'split-dark'        ? '- 2-column split: left dark bg with large heading, right lighter with form or trust signals.' : ''}
${ctaLayout === 'full-bleed'        ? '- Full-bleed: extreme padding 120px 0, immersive gradient, very large headline.' : ''}
${ctaLayout === 'minimal-border'    ? '- Minimal: white bg, subtle border-radius container, refined typography, no gradient flash.' : ''}

CONTENT (fit the "${toneOfVoice}" tone):
- Eyebrow pill: rgba(white,0.15) bg, white border, brand-relevant label — NOT generic "Get Started Today"
- Headline: clamp(2.2rem,5vw,3.5rem), weight 800, white, 2 lines max. Make it emotionally resonant for "${tokens.targetAudience}"
- Subtext: rgba(255,255,255,0.8), 1.1rem, line-height 1.7
- Primary CTA: "${ctaLanguage}" — white bg, var(--primary) text, hover scale(1.03)
- Secondary CTA: transparent, white border, hover rgba(white,0.1)
- Trust line: specific to "${tokens.brandName}" (not generic "No credit card required" unless relevant)

Import '../styles/tokens.css'; Default export.
Return ONLY complete raw JSX file.`
    },

    Stats: {
      prompt: () => `Design a Stats section for "${tokens.brandName}" that makes numbers feel like a story — not a uniform data table.
${tokenCtx}
${creativeBlock}

STYLING: <style>{\`...\`}</style> with "stat-" prefixed classes. @media (max-width: 768px).

HIERARCHY RULES:
- Stats MUST NOT be uniform blocks of equal visual weight
- Use hierarchy: 1 hero stat (largest, most impactful) + supporting stats
- Add contextual micro-labels below each number (story-driven, not just unit labels)
- Apply visual motif "${visualMotif}" as a subtle accent in this section

LAYOUT: "${statsLayout}"
${statsLayout === '4-col-dividers'   ? '- 4 equal columns, 1px var(--border) dividers between cells (border-right trick). Padding 48px 32px each.' : ''}
${statsLayout === '2x2-grid'         ? '- 2×2 grid with gap 24px. Each cell is a card with border-radius var(--radius-lg).' : ''}
${statsLayout === 'horizontal-banner'? '- Single horizontal row, full-width, stats inline. bg var(--primary) or dark. White text.' : ''}

NUMBER STYLE: "${statsStyle}"
${statsStyle === 'minimal-numbers'  ? '- Just the number, very large (clamp(3rem,6vw,5rem)), weight 900, --primary color. No icons.' : ''}
${statsStyle === 'icon-led'         ? '- 32×32 SVG icon above number, icon in --primary, opacity 0.8.' : ''}
${statsStyle === 'gradient-text'    ? '- Number uses gradient text: background var(--gradient), -webkit-background-clip: text, color transparent.' : ''}
${statsStyle === 'bordered-cells'   ? '- Each stat in a bordered card, border-radius var(--radius-lg), hover lift effect.' : ''}

ANIMATION: useEffect + IntersectionObserver + requestAnimationFrame counter (0 → value, 1.5s ease-out). No libraries.
SUFFIX: +/% in --accent, font-size 60% of number.

Stats MUST be real, credible metrics for "${tokens.brandName}" (${tokens.siteType}) audience: "${tokens.targetAudience}".
NOT generic "99.9% uptime" — use context-appropriate numbers (cases won, countries, years, clients, awards, etc).

REQUIRED IMPORTS:
import { useEffect, useRef, useState } from 'react';
import '../styles/tokens.css';
Default export.
Return ONLY complete raw JSX file.`
    },

    Pricing: {
      prompt: () => `Generate ONLY a complete React JSX Pricing section for "${tokens.brandName}" (${tokens.siteType}).
${tokenCtx}

STYLING: <style>{\`...\`}</style> with "price-" prefixed classes. @media (max-width: 768px).

DESIGN — premium SaaS pricing (Vercel / Linear / Lemon Squeezy quality):
- Eyebrow + heading "Simple, Transparent Pricing" + subtext
- Monthly/Annual toggle (useState). Annual shows "Save 20%" badge in --accent.
- 3-column grid (→ 1-col mobile). Middle card: scale(1.04), --gradient or --primary bg, "MOST POPULAR" badge, white text.
- Card anatomy: tier name → price (clamp(2.5rem,5vw,3.5rem), weight 900) → description → divider → feature list (SVG checkmarks) → CTA button.
- Annual pricing: monthly × 0.8, strikethrough original.
- REAL features/tiers for "${tokens.brandName}" (${tokens.siteType}).

import { useState } from 'react'; import '../styles/tokens.css'; Default export.
Return ONLY complete raw JSX file.`
    },

    FAQ: {
      prompt: () => `Generate ONLY a complete React JSX FAQ accordion for "${tokens.brandName}".
${tokenCtx}

STYLING: <style>{\`...\`}</style> with "faq-" prefixed classes.
- Smooth accordion: max-height transition 300ms cubic-bezier(0.4,0,0.2,1). One open at a time (useState openIndex).
- Chevron rotates 180° when open. Border-bottom-only dividers (no card containers).
- Question hover: bg var(--bg-secondary). Active question: color var(--primary).
- 7-8 REAL, specific FAQs for "${tokens.brandName}" (${tokens.siteType}). No generic questions.

import { useState } from 'react'; import '../styles/tokens.css'; Default export.
Return ONLY complete raw JSX file.`
    },
  };

  // Determine which extras to generate
  const requestedExtras = (tokens.components || []).filter(c => !['Header','Footer','Layout','Hero'].includes(c));
  const defaultExtras   = ['Features', 'Testimonials', 'CTA', 'Stats'];
  const extrasToGenerate = [
    ...requestedExtras.filter(n => extraDefs[n]),
    ...defaultExtras.filter(n => !requestedExtras.includes(n)),
  ].filter(n => extraDefs[n]).slice(0, 4);

  const extras = extrasToGenerate.map(name => ({
    name: `${name}.${ext}`, dir: compDir,
    prompt: extraDefs[name].prompt(),
  }));

  const files = {};
  for (const comp of [...coreComponents, ...extras]) {
    const filePath = `${comp.dir}/${comp.name}`;
    onLog(`Generating ${comp.name}…`);
    try {
      files[filePath] = await generateSingleFile(comp.prompt, framework, ai, onLog);
    } catch (err) {
      console.error(`[pipeline] Failed ${filePath}:`, err.message);
      files[filePath] = buildStubComponent(comp.name.replace(/\.\w+$/, ''), err.message);
    }
  }
  return files;
}

// ─── Step 3: Pages ────────────────────────────────────────────────────────────

async function generatePages(tokens, layout, components, siteData, framework, ai, onLog = () => {}) {
  const isReact = framework === 'react';
  const ext     = isReact ? 'jsx' : 'ts';
  const pageDir = isReact ? 'src/pages' : 'src/app/pages';

  // Build list of available components
  const compNames = Object.keys(components)
    .filter(k => k.includes('/components/') && !k.endsWith('.css'))
    .map(k => k.split('/').pop().replace(/\.\w+$/, ''));

  const tokenCtx = buildTokenContext(tokens, layout);
  const siteCtx  = buildSiteContext(siteData);

  // Single high-quality Home page — full token budget focused on one page
  const pageNames = ['Home'];
  const files = {};

  for (const rawPageName of pageNames) {
    // Sanitize: "Patient-Centered Care" → "PatientCenteredCare" (valid JS identifier + file name)
    const pageName    = toPageIdentifier(rawPageName);
    const displayName = rawPageName; // keep original for prompt context
    const filePath    = `${pageDir}/${pageName}.${ext}`;

    // Build component import list for this page
    const relevantComps = buildPageComponents(pageName, compNames);
    const compImports = relevantComps
      .map(c => `import ${c} from '../components/${c}';`)
      .join('\n');

    const prompt = `Generate a COMPLETE, STUNNING, production-quality ${isReact ? 'React JSX' : 'Angular TS'} Home page for "${tokens.brandName}" (${tokens.siteType}).
This is the ENTIRE website in one page — a rich, full-length landing page that showcases everything.

${tokenCtx}
${siteCtx}

AVAILABLE COMPONENTS (import ALL relevant ones from '../components/X'):
${compNames.join(', ')}

MANDATORY PAGE STRUCTURE — include EVERY section in this exact order:
${buildPageStructure(pageName, compNames, tokens, layout)}

DESIGN MISSION — this page must feel PREMIUM and UNIQUE:
- Style archetype: ${tokens.styleArchetype || tokens.visualStyle || 'professional'} — let this drive every visual decision
- Background rhythm: ${layout?.globalAnimations?.backgroundRhythm || 'alternate between var(--bg) and var(--bg-secondary)'}
- Scroll animations: ${layout?.globalAnimations?.scrollTrigger || tokens.scrollAnimation || 'fade-up'} with ${layout?.globalAnimations?.stagger || '80ms'} stagger
- Design notes: ${layout?.designNotes || 'Each section should feel visually distinct'}
- Tone of voice: ${tokens.toneOfVoice || 'professional'} — reflect this in any inline text/labels
- Use large, bold typography for section headings to create visual hierarchy

CRITICAL STYLING RULES:
- Use <style>{\`...\`}</style> CSS tag with "home-" prefixed class names for ALL page-specific styles
- Import and USE the Layout component to wrap all content
- Use CSS variables throughout: var(--primary), var(--accent), var(--bg), etc.

REQUIRED IMPORTS:
import Layout from '../components/Layout';
${compImports}
import '../styles/tokens.css';
${isReact ? `\nexport default function ${pageName}() { ... }` : ''}

CONTENT RULES:
- Use REAL content: brand="${tokens.brandName}", title="${siteData.title}", desc="${siteData.description || ''}"
- Import and USE every available component — do not skip any
- Pass realistic brand-appropriate props to each component where supported
- NO placeholder text like "Lorem ipsum" — write real, contextual content

Return ONLY the complete raw ${ext.toUpperCase()} file starting with import statements. No markdown fences.`;

    onLog(`Generating ${pageName} page…`);
    try {
      files[filePath] = await generateSingleFile(prompt, framework, ai, onLog);
    } catch (err) {
      console.error(`[pipeline] Failed ${filePath}:`, err.message);
      files[filePath] = buildStubComponent(pageName, err.message);
    }
  }
  return files;
}

// ─── Helper: decide which components belong on which pages ────────────────────

function buildPageComponents(pageName, available) {
  const page = pageName.toLowerCase();
  const all = available.filter(c => !['Header', 'Footer', 'Layout'].includes(c));

  if (page === 'home') return all; // Home uses everything
  if (page === 'about') return all.filter(c => ['Stats', 'Testimonials'].includes(c));
  if (page === 'pricing') return all.filter(c => ['Pricing', 'FAQ', 'CTA'].includes(c));
  if (page === 'contact') return all.filter(c => ['CTA'].includes(c));
  if (page === 'features' || page === 'services') return all.filter(c => ['Features', 'CTA', 'Stats'].includes(c));
  return all.slice(0, 3);
}

function buildPageStructure(pageName, available, tokens, layout = null) {
  const page = pageName.toLowerCase();
  const has = (c) => available.includes(c);

  if (page === 'home') {
    // Use layout strategy section order if available
    const sectionOrder = layout?.sectionOrder || ['Hero', 'Stats', 'Features', 'Testimonials', 'CTA'];
    const sectionDescriptions = {
      Hero:         '<Hero /> — full viewport hero section',
      Stats:        '<Stats /> — impressive numbers row',
      Features:     '<Features /> — feature showcase section',
      Testimonials: '<Testimonials /> — social proof section',
      Pricing:      '<Pricing /> — pricing cards',
      CTA:          '<CTA /> — conversion/call-to-action section',
    };
    const sections = sectionOrder
      .filter(s => s === 'Hero' || has(s))
      .map(s => sectionDescriptions[s] || `<${s} />`);

    // Append layout notes per section if available
    const layoutAnnotated = sections.map((desc, i) => {
      const compName = sectionOrder.filter(s => s === 'Hero' || has(s))[i];
      const sectionLayout = layout?.sections?.[compName];
      if (sectionLayout?.layoutType) {
        return `${desc} [layout: ${sectionLayout.layoutType}${sectionLayout.cardStyle ? `, cards: ${sectionLayout.cardStyle}` : ''}]`;
      }
      return desc;
    });
    return layoutAnnotated.map((s, i) => `${i + 1}. ${s}`).join('\n');
  }
  if (page === 'about') {
    return `1. Hero-style banner with "About ${tokens.brandName}" heading (page-specific section, NOT <Hero />)
2. Mission/vision section — 2 columns: text + visual
${has('Stats') ? '3. <Stats /> — company metrics\n' : ''}${has('Testimonials') ? '4. <Testimonials /> — team testimonials\n' : ''}5. Team section — 3-4 team member cards`;
  }
  if (page === 'pricing') {
    return `1. Pricing header section (page-specific)
${has('Pricing') ? '2. <Pricing /> — pricing cards\n' : ''}${has('FAQ') ? '3. <FAQ /> — pricing FAQ\n' : ''}${has('CTA') ? '4. <CTA /> — bottom CTA\n' : ''}`;
  }
  return `1. Page header/banner with "${pageName}" title
2. Main content section
${has('CTA') ? '3. <CTA /> — call to action\n' : ''}`;
}

// ─── Stub component fallback (used when AI generation fails) ─────────────────
// Returns a valid, importable React component so the app doesn't crash.
// Shows a visible placeholder card in dev so developers know it needs regeneration.

function buildStubComponent(name, errorMsg) {
  const safeName = name.replace(/[^a-zA-Z0-9]/g, '') || 'Component';
  const shortErr  = (errorMsg || 'Generation failed').slice(0, 120);
  return `import '../styles/tokens.css';

// ⚠ Auto-generated stub — "${name}" failed to generate. Re-run to regenerate.
export default function ${safeName}() {
  return (
    <section style={{
      padding: '48px 24px', textAlign: 'center',
      background: 'var(--bg-secondary)', borderTop: '1px solid var(--border)',
    }}>
      <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontFamily: 'monospace' }}>
        ⚠ ${safeName} failed to generate — please re-run the redesign.
      </p>
      <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '8px', opacity: 0.6 }}>
        {/* ${shortErr} */}
      </p>
    </section>
  );
}
`;
}

// ─── Core generator: generate + detect truncation + continue if needed ────────

async function generateSingleFile(prompt, framework, ai, onLog = () => {}) {
  const isReact = framework === 'react';
  const system = `You are a world-class ${isReact ? 'React/JSX' : 'Angular/TypeScript'} frontend engineer and UI/UX designer. You build websites that look like they were designed by a top-tier agency — not generic templates.

═══ STYLING RULES (non-negotiable) ═══
1. ALL CSS goes in a <style>{\`...\`}</style> tag as the FIRST child inside return() — NEVER inline style={{}}
2. Scoped class names with component prefix (e.g. "hero-", "hdr-", "feat-")
3. Every interactive element needs :hover + transition. Every section needs @media (max-width: 768px) + @media (max-width: 480px)
4. Use CSS variables everywhere: var(--primary), var(--accent), var(--bg), var(--text), var(--radius), var(--shadow), etc.
5. Spacing follows 8px grid: 8, 16, 24, 32, 48, 64, 80, 96px

═══ PREMIUM VISUAL QUALITY (apply these) ═══
- Typography: headings use letter-spacing: -0.02em to -0.04em, font-weight: 700-900. Body line-height: 1.6-1.75.
- Responsive type: use clamp() — e.g. font-size: clamp(2rem, 5vw, 4rem)
- Depth: layer multiple box-shadows for realism. Cards: "0 1px 3px rgba(0,0,0,.06), 0 8px 32px rgba(0,0,0,.08)"
- Micro-interactions: buttons scale on hover (transform: scale(1.02)), links get underline slide-in
- Transitions: 150-200ms for hover, 250-300ms for layout changes — use "ease" or "cubic-bezier(0.4,0,0.2,1)"
- Gradient text: use background-clip: text for hero headlines where appropriate
- Subtle backgrounds: use radial-gradient or mesh patterns instead of flat solid colors
- Icons: use Unicode symbols or inline SVG — NEVER emoji icons in production UI

═══ ANTI-PATTERNS (never do these) ═══
- No gray-on-gray text (ensure ≥4.5:1 contrast on all text)
- No color-only meaning (always pair color with text/icon/shape)
- No placeholder/Lorem text — write real contextual content
- No icon-only buttons without aria-label or visible text
- No transitions faster than 100ms (feels broken) or slower than 400ms (feels sluggish)
- No flat single-color section backgrounds that all look the same — vary bg: white, --bg-secondary, gradient, etc.
- No perfectly centered text walls — use left-aligned body copy with max-width: 65ch

═══ CODE QUALITY & JSX VALIDITY (critical — violations crash the app) ═══
- Return ONLY raw file content. No markdown fences, no JSON, no explanation.
- First character = first character of the file (e.g. 'i' for import).
- COMPLETE file — no cut-offs, no TODO stubs, no placeholder functions.
- Only import what you use. Correct relative paths ('../styles/tokens.css', '../components/Hero').

JSX TAG RULES — follow exactly or the component will crash:
1. Every HTML semantic element opened MUST be closed with its exact matching tag:
   <footer> → </footer>  |  <header> → </header>  |  <nav> → </nav>
   <section> → </section>  |  <main> → </main>  |  <form> → </form>
   <ul>/<ol> → </ul>/</ol>  |  <table> → </table>
2. Self-closing void elements MUST use />: <input />, <img />, <br />, <hr />
3. FRAGMENT RULE — if return() contains a <style> block AND other JSX elements, ALL of them MUST be wrapped in a fragment:
   WRONG:  return (\\n    <style>CSS</style>\\n    <section>...</section>\\n  );
   CORRECT: return (\\n    <>\\n      <style>CSS</style>\\n      <section>...</section>\\n    </>\\n  );
   This is the MOST COMMON crash cause. Every component with a <style> tag MUST use <> </> wrapper.
4. DIV BALANCE CHECK — before finishing: count every opening <div and closing /div> — they MUST be equal. A single extra </div> before </footer> is the #1 crash cause.
5. STRING LITERAL RULE — for ALL data arrays/objects (testimonials, stats, features, etc.): use double quotes for any string value that contains an apostrophe. NEVER use single quotes around text with contractions or possessives.
   WRONG:  { quote: 'Austin's strategic counsel was invaluable.' }
   CORRECT: { quote: "Austin's strategic counsel was invaluable." }
   WRONG:  { text: 'Don't miss this opportunity.' }
   CORRECT: { text: "Don't miss this opportunity." }
6. CSS PROP RULE — when passing CSS variable values as JSX props, ALWAYS use string syntax. NEVER use curly braces around CSS functions — they are not valid JS expressions.
   WRONG:  <Component color={var(--primary)} bg={rgba(0,0,0,0.5)} />
   CORRECT: <Component color="var(--primary)" bg="rgba(0,0,0,0.5)" />
5. Correct final structure of every component with a <style> tag:
       </div>
     </section>  {/* or </footer>, </header>, etc. */}
   </>
   );
   }
   export default ComponentName;`;

  // Pass 1: generate at full token budget
  let content = await withRetry(async () => {
    const raw = (await ai.complete(system, prompt, ai.modelMax)).trim();
    return extractFirstCodeBlock(raw).replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '').replace(/<ctrl\d+>/g, '').trim();
  }, ai, onLog, 'generate');

  // Pass 2: continue ONLY if the output appears truncated
  if (isTruncated(content)) {
    onLog(`Output truncated — continuing…`);
    const continuePrompt = `The following ${isReact ? 'React/JSX' : 'TypeScript'} code was cut off mid-way.
Continue it from EXACTLY where it stopped. Output ONLY the remaining code — do NOT repeat what's already there.
Do NOT add markdown fences. Start immediately with the next character after the cut.

--- CUT OFF CODE (last 1000 chars) ---
${content.slice(-1000)}`;

    const continuation = await withRetry(async () => {
      const raw = (await ai.complete(system, continuePrompt, ai.modelMax)).trim();
      return extractFirstCodeBlock(raw).replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '').replace(/<ctrl\d+>/g, '').trim();
    }, ai, onLog, 'continue').catch(() => '');

    if (continuation) content = content + '\n' + continuation;
  }

  // Pass 3a: auto-fix CSS functions used as raw JSX prop values: ={var(--x)} → ="var(--x)"
  content = fixCssVarProps(content);

  // Pass 3b: auto-fix unescaped apostrophes in single-quoted JS string literals
  content = fixStringLiterals(content);

  // Pass 3c: auto-fix adjacent JSX elements (missing <> fragment wrapper)
  content = fixReturnFragment(content);

  // Pass 3d: auto-fix div/semantic tag imbalance
  content = fixJsxTagBalance(content);

  // Pass 3e: structural integrity check + AI repair if issues remain
  const structuralIssues = detectSyntaxIssues(content);
  if (structuralIssues.length > 0) {
    onLog(`⚠ Structural issues detected — running repair pass (${structuralIssues.join(', ')})…`);
    content = await repairWithAI(content, structuralIssues, framework, ai, onLog);
    // Re-apply mechanical fixes after AI repair
    content = fixCssVarProps(content);
    content = fixStringLiterals(content);
    content = fixReturnFragment(content);
    content = fixJsxTagBalance(content);
  }

  return content;
}

// ─── JSX tag balance auto-fixer ──────────────────────────────────────────────
// Catches the #1 crash pattern: extra </div> just before a closing semantic tag,
// e.g.  </div>\n    </footer>   when <footer> never had that matching <div>.

function fixJsxTagBalance(code) {
  // Semantic root tags that the AI commonly wraps the whole component in
  const semanticTags = ['footer', 'header', 'nav', 'section', 'main', 'article', 'aside', 'form'];

  for (const tag of semanticTags) {
    // Count opens vs closes for this semantic tag
    const opens  = (code.match(new RegExp(`<${tag}[\\s>]`, 'g')) || []).length;
    const closes = (code.match(new RegExp(`</${tag}>`, 'g')) || []).length;
    if (opens !== closes) continue; // skip if the semantic tag itself is unbalanced (different issue)

    // Now check <div> balance
    const divOpens  = (code.match(/<div[\s>]/g) || []).length;
    const divCloses = (code.match(/<\/div>/g) || []).length;
    const excess    = divCloses - divOpens;

    if (excess > 0) {
      // Remove `excess` stray </div> tags that appear immediately before a closing semantic tag
      let fixed = code;
      for (let i = 0; i < excess; i++) {
        // Remove the last </div> that sits right before </${tag}>
        fixed = fixed.replace(
          new RegExp(`(\\s*)<\\/div>(\\s*)<\\/${tag}>`, ''),
          `$2</${tag}>`
        );
      }
      if (fixed !== code) {
        console.log(`[fixJsxTagBalance] Removed ${excess} extra </div> before </${tag}>`);
        code = fixed;
      }
    }
  }
  return code;
}

// ─── Fix 1c: CSS functions as raw JSX prop values ────────────────────────────
// Catches: "Unexpected token" when AI writes  featureCardBg={var(--bg-alt)}
// `var` is a JS keyword — {var(...)} is not a valid expression.
// Fix: convert  ={cssFunc(...)}  →  ="cssFunc(...)"  (string prop)
// Covers: var(), rgba(), rgb(), hsl(), hsla(), calc(), linear-gradient(), radial-gradient()

/**
 * Extract only the first code block from AI output.
 * Models like Llama sometimes append extra ```css blocks after the JSX — discard them.
 */
function extractFirstCodeBlock(raw) {
  const trimmed = raw.trim();
  // Case 1: well-formed fenced block — ```lang\n...content...\n```
  const fenceMatch = trimmed.match(/^```[\w]*\n?([\s\S]*?)```/);
  if (fenceMatch) return fenceMatch[1].trim();
  // Case 2: opening fence present but no closing fence (truncated AI response)
  // Strip JUST the first line if it's a fence marker so it doesn't corrupt the file
  if (/^```/.test(trimmed)) {
    const withoutOpenFence = trimmed.replace(/^```[\w]*\n?/, '');
    return withoutOpenFence.replace(/\n?```\s*$/, '').trim();
  }
  // Case 3: no fences at all — strip any stray trailing fence and return
  return trimmed.replace(/\n?```\s*$/, '').trim();
}

function fixCssVarProps(code) {
  const CSS_FUNCS = 'var|rgba?|hsla?|calc|linear-gradient|radial-gradient|conic-gradient|clamp|min|max';
  // Match: ={cssFunc(...possibly nested parens...)}
  // The inner capture uses a non-greedy match up to the matching closing brace.
  // We allow nested parens (e.g. rgba(var(--x), 0.5)) by matching [^{}]* inside.
  const re = new RegExp(`=\\{((${CSS_FUNCS})\\([^{}]*\\))\\}`, 'g');
  const fixed = code.replace(re, (match, expr) => `="${expr}"`);
  if (fixed !== code) {
    const count = (code.match(re) || []).length;
    console.log(`[fixCssVarProps] Converted ${count} CSS function prop(s) from {expr} to "expr"`);
  }
  return fixed;
}

// ─── Fix 1b: Unescaped apostrophe in single-quoted JS string literals ─────────
// Catches: "Unexpected token, expected ','" when AI generates text like:
//   quote: 'Sidley Austin's strategic counsel...'
// The apostrophe in "Austin's" terminates the single-quoted string early.
// Strategy: use greedy matching to capture the full value, re-wrap in double quotes.

function fixStringLiterals(code) {
  const lines = code.split('\n');
  let fixCount = 0;

  const fixedLines = lines.map(line => {
    // Skip JSX markup lines — they use different quoting rules
    if (/<[A-Za-z\/!]/.test(line)) return line;

    // Look for: (indent)(key): '(content with apostrophe)'(trailing ,/}/]/;)
    // The greedy .* in '(.*)' captures everything between the outermost single quotes,
    // even if the "string" was broken mid-word by an apostrophe.
    const fixed = line.replace(
      /^(\s*[\w]+:\s*)'(.*)'([\s,}\]]*$)/,
      (match, prefix, content, suffix) => {
        // Only convert if the content contains a word-apostrophe-word pattern
        // (contraction like "don't" or possessive like "Austin's")
        if (/\w'\w/.test(content)) {
          fixCount++;
          // Escape any existing double quotes inside the content, then wrap in double quotes
          const escaped = content.replace(/"/g, '\\"');
          return `${prefix}"${escaped}"${suffix}`;
        }
        return match; // no change for clean strings
      }
    );
    return fixed;
  });

  if (fixCount > 0) {
    console.log(`[fixStringLiterals] Fixed ${fixCount} unescaped apostrophe(s) in string literal(s)`);
  }
  return fixedLines.join('\n');
}

// ─── Fix 2: Return fragment wrapper ──────────────────────────────────────────
// Catches: "Adjacent JSX elements must be wrapped in an enclosing tag"
// Pattern: return ( <style>...</style> <section>...</section> ) without <> wrapper

function fixReturnFragment(code) {
  // Only apply if: <style> appears directly after return( without a <> wrapper
  if (!/return\s*\(\s*\r?\n\s*<style>/.test(code)) return code;
  if (/return\s*\(\s*\r?\n\s*<>/.test(code))         return code; // already correct
  if (/return\s*\(\s*\r?\n\s*<React\.Fragment/.test(code)) return code;

  const lines = code.split('\n');

  // Find the `return (` line
  let returnIdx = -1;
  for (let i = 0; i < lines.length; i++) {
    if (/^\s*return\s*\(\s*$/.test(lines[i])) { returnIdx = i; break; }
  }
  if (returnIdx === -1) return code;

  // Get the indent of the first content line
  const firstContent = lines[returnIdx + 1];
  const contentIndent = firstContent ? (firstContent.match(/^(\s*)/)?.[1] ?? '    ') : '    ';

  // Insert <> on the line after return (
  lines.splice(returnIdx + 1, 0, `${contentIndent}<>`);

  // Find the matching ); that closes the return — track paren depth from the return line
  let depth = 1; // entered the ( on the return line
  let closingIdx = -1;
  for (let i = returnIdx + 2; i < lines.length; i++) {
    for (const ch of lines[i]) {
      if (ch === '(') depth++;
      else if (ch === ')') { depth--; if (depth === 0) { closingIdx = i; break; } }
    }
    if (closingIdx !== -1) break;
  }

  if (closingIdx === -1) {
    // Couldn't find closing — undo the insertion and return original
    lines.splice(returnIdx + 1, 1);
    return lines.join('\n');
  }

  // Insert </> on the line before the closing );
  lines.splice(closingIdx, 0, `${contentIndent}</>`);

  console.log('[fixReturnFragment] Wrapped return content in React fragment <>');
  return lines.join('\n');
}

// ─── Fix 3: Structural integrity checker ─────────────────────────────────────
// Detects issues that can't be fixed mechanically — triggers AI repair pass.

function detectSyntaxIssues(code) {
  const issues = [];

  // 1. Missing export default → module has no exports → blank screen
  if (!/export\s+default/.test(code)) {
    issues.push('missing export default');
  }

  // 2. Missing return statement
  if (!/\breturn\s*\(/.test(code)) {
    issues.push('missing return statement');
  }

  // 3. Adjacent JSX still present after fixReturnFragment (edge case)
  if (/return\s*\(\s*\r?\n\s*<style>/.test(code) && !/return\s*\(\s*\r?\n\s*<>/.test(code)) {
    issues.push('adjacent JSX elements — <style> without fragment wrapper');
  }

  // 4. Semantic tag imbalance (section/main/article — footer/header handled by fixJsxTagBalance)
  for (const tag of ['section', 'main', 'article', 'aside']) {
    const opens  = (code.match(new RegExp(`<${tag}[\\s>]`, 'g')) || []).length;
    const closes = (code.match(new RegExp(`</${tag}>`, 'g')) || []).length;
    if (opens > 0 && opens !== closes) {
      issues.push(`<${tag}> mismatch (${opens} open, ${closes} close)`);
    }
  }

  // 5. Unclosed JSX template literal (style tag never closed)
  const styleOpens  = (code.match(/<style>\s*\{`/g) || []).length;
  const styleCloses = (code.match(/`\}\s*<\/style>/g) || []).length;
  if (styleOpens !== styleCloses) {
    issues.push(`<style> template literal not closed (${styleOpens} open, ${styleCloses} close)`);
  }

  // 6. Unescaped apostrophes in single-quoted string literals (e.g. 'Austin's')
  // Regex: property pattern with a single-quoted value that has word-apostrophe-word inside
  const apostropheMatches = code.match(/[\w]+:\s*'[^'\n]*\w'\w[^'\n]*'/g) || [];
  const apostropheIssues  = apostropheMatches.filter(m => !/<[A-Za-z]/.test(m));
  if (apostropheIssues.length > 0) {
    issues.push(`unescaped apostrophes in string literals (${apostropheIssues.length} occurrence(s))`);
  }

  // 7. CSS functions as raw JSX prop curly-brace values: ={var(--x)} ={rgba(...)} etc.
  const CSS_FUNCS_RE = /=\{(?:var|rgba?|hsla?|calc|linear-gradient|radial-gradient)\([^{}]*\)\}/g;
  const cssVarPropMatches = code.match(CSS_FUNCS_RE) || [];
  if (cssVarPropMatches.length > 0) {
    issues.push(`CSS functions as JSX prop expressions — use string syntax instead: ={var(--x)} → ="var(--x)" (${cssVarPropMatches.length} occurrence(s))`);
  }

  return issues;
}

// ─── Fix 4: AI repair pass ────────────────────────────────────────────────────
// Sends broken code back to the AI with targeted error description for repair.
// Only triggers when mechanical fixes couldn't solve the detected issues.

async function repairWithAI(code, issues, framework, ai, onLog) {
  const isReact = framework === 'react';
  const repairSystem = `You are a ${isReact ? 'React/JSX' : 'Angular/TypeScript'} syntax repair specialist.
Your ONLY job is to fix the reported syntax issues in the provided component code.
Do NOT change any functionality, styling, design, or content.
Return the complete corrected file — raw code only, no markdown fences.`;

  const repairPrompt = `Fix these syntax issues in the following ${isReact ? 'React JSX' : 'Angular TypeScript'} component:

ISSUES TO FIX:
${issues.map((issue, i) => `${i + 1}. ${issue}`).join('\n')}

CRITICAL REMINDERS:
- If "adjacent JSX elements": wrap ALL return() children in <> </> fragment
- If "missing export default": add "export default function ComponentName() {"
- If tag mismatch: ensure every opening tag has a matching closing tag
- If "unescaped apostrophes": use double quotes for string values with apostrophes (e.g. 'Austin's text' → "Austin's text")
- If "CSS functions as JSX prop expressions": convert ={var(--x)} or ={rgba(...)} to string props: ="var(--x)" or ="rgba(...)"
- Keep ALL existing CSS, content, and logic exactly as-is

--- COMPONENT TO REPAIR (${code.split('\n').length} lines) ---
${code}`;

  try {
    const repaired = await withRetry(async () => {
      // Use a fast, smaller token budget for repair — it just needs to fix structure
      const budget = Math.min(ai.modelMax, 32000);
      const raw = (await ai.complete(repairSystem, repairPrompt, budget)).trim();
      return extractFirstCodeBlock(raw).trim();
    }, ai, onLog, 'repair');

    if (repaired && repaired.length > 200 && /export\s+default/.test(repaired)) {
      console.log('[repairWithAI] Repair successful');
      return repaired;
    }
    console.warn('[repairWithAI] Repair output invalid, keeping original');
  } catch (err) {
    console.warn('[repairWithAI] Repair failed:', err.message);
  }
  return code; // Fall back to original if repair fails
}

// ─── Truncation detector ──────────────────────────────────────────────────────

function isTruncated(code) {
  const t = code.trim();
  if (!t || t.length < 100) return false;

  // Well-formed endings for JSX/JS/CSS
  if (t.endsWith('}')    || t.endsWith('};'))   return false;
  if (t.endsWith('}\n')  || t.endsWith('}\r\n')) return false;
  if (t.endsWith(';')    || t.endsWith('*/'))    return false;
  if (t.endsWith('>')    || t.endsWith('/>')     || t.endsWith('>\n')) return false;
  if (t.endsWith('`}'))  return false; // ends with template literal in JSX style tag

  // Additional JSX-specific well-formed endings
  const lastLines = t.split('\n').slice(-5).join('\n');
  if (lastLines.includes('export default') && (t.endsWith('}') || t.endsWith(';\n'))) return false;

  // Definitely truncated
  return true;
}

// ─── Retry wrapper (handles 429 rate limits only) ────────────────────────────

async function withRetry(fn, ai, onLog, label = 'call', retries = 3) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      const is429 = err.message && (err.message.includes('429') || err.message.includes('Quota') || err.message.includes('RESOURCE_EXHAUSTED'));
      if (is429 && attempt < retries) {
        const delay = attempt * 25000;
        onLog(`Rate limit hit on ${label} — pausing ${delay / 1000}s…`);
        console.warn(`[ai] 429 on ${label}, attempt ${attempt}/${retries}, waiting ${delay}ms`);
        await new Promise(r => setTimeout(r, delay));
      } else {
        throw err;
      }
    }
  }
}

// ─── Context helpers ──────────────────────────────────────────────────────────

function buildTokenContext(tokens, layout = null) {
  const angle = tokens.gradientAngle || '135deg';
  const grad = tokens.gradientStart && tokens.gradientEnd
    ? `linear-gradient(${angle}, ${tokens.gradientStart}, ${tokens.gradientEnd})`
    : `linear-gradient(${angle}, ${tokens.primaryColor || '#6366f1'}, ${tokens.accentColor || '#f59e0b'})`;

  const archetype = tokens.styleArchetype || tokens.visualStyle || 'gradient-saas';
  const mood      = tokens.animationMood || 'subtle';
  const speed     = tokens.transitionSpeed || '200ms';
  const curve     = tokens.transitionCurve || 'cubic-bezier(0.4,0,0.2,1)';

  // Archetype-specific design guidance
  const archetypeGuide = {
    'glassmorphism':    'backdrop-filter: blur(16px) panels, frosted glass cards, luminous accents on dark/gradient backgrounds. Think Apple Vision Pro UI.',
    'brutalism':        'Raw borders, bold stark typography, high contrast, intentional roughness. No gradients. Monochrome + one accent. Grid-heavy.',
    'neo-banking':      'Ultra-clean white space, precision grid, trust-first palette, no decorative elements. Data lives center stage. Think Mercury or Stripe.',
    'editorial-luxury': 'Strong typographic hierarchy, generous white space, serif heading font, restrained palette. Think NYT or Loewe.com.',
    'playful-startup':  'Rounded everything (radius-full), bright accent colors, friendly conversational tone, organic blob shapes. Think Notion or Linear.',
    'tech-futuristic':  'Dark mode first, subtle grid overlays, neon or electric accents, terminal/mono aesthetic. Think Vercel or Railway.',
    'minimal-swiss':    'Grid-based, white space as primary design element, muted palette, typographic focus. No decorative elements. Think Swiss posters.',
    'gradient-saas':    'Vibrant mesh gradients, feature-rich layouts, conversion-optimized hierarchy. Bold gradient CTAs. Think Framer or Webflow.',
  }[archetype] || 'Clean, professional aesthetic with clear visual hierarchy.';

  const layoutNotes = layout ? `\nLAYOUT STRATEGY:
Section composition: ${(layout.sectionOrder || []).join(' → ')}
Animations: ${layout.globalAnimations || 'fade-up'}
Design notes: ${layout.designNotes || ''}` : '';

  const cd = tokens.creativeDirection || {};
  const creativeNotes = cd.designConcept ? `\nCREATIVE DIRECTION:
Concept: ${cd.designConcept}
Motif: ${cd.visualMotif || ''}
Energy: ${cd.layoutEnergy || 'balanced'} | Density: ${cd.density || 'balanced'}
Avoid: ${(cd.doNotDo || []).join(' · ')}
Must include: ${(cd.mustHaveMoments || []).join(' · ')}` : '';

  return `BRAND IDENTITY:
Name: ${tokens.brandName} | Type: ${tokens.siteType} | Personality: ${tokens.brandPersonality || 'professional'}
Audience: ${tokens.targetAudience || 'general'} | Positioning: ${tokens.pricePositioning || 'mid'}
Tone of voice: ${tokens.toneOfVoice || 'professional'} | Headline style: ${tokens.headlineStyle || 'clear'}
CTA language: "${tokens.ctaLanguage || 'Get Started'}"

STYLE ARCHETYPE: ${archetype}
Design direction: ${archetypeGuide}
Animation: ${mood} | Transition: ${speed} ${curve} | Scroll: ${tokens.scrollAnimation || 'fade-up'}
Dark mode: ${tokens.darkMode || false}${layoutNotes}${creativeNotes}

COLORS:
Primary: ${tokens.primaryColor} | Secondary: ${tokens.secondaryColor} | Accent: ${tokens.accentColor}
BG: ${tokens.bgColor} | BG-alt: ${tokens.bgSecondary} | Card: ${tokens.bgCard || tokens.bgSecondary}
Text: ${tokens.textColor} | Muted: ${tokens.textMuted} | Subtle: ${tokens.textSubtle || tokens.textMuted} | Border: ${tokens.borderColor}
Gradient: ${grad}
Shadow: ${tokens.boxShadow} | Shadow-lg: ${tokens.boxShadowLg || '0 8px 40px rgba(0,0,0,0.12)'}
Card shadow: ${tokens.boxShadowCard || tokens.boxShadow}

TYPOGRAPHY:
Heading: ${tokens.fontHeading} (weight ${tokens.fontWeightHeading || '700'}, tracking ${tokens.letterSpacingHeading || '-0.02em'})
Body: ${tokens.fontBody} (weight ${tokens.fontWeightBody || '400'}, line-height ${tokens.lineHeight || '1.65'})

SPACING & SHAPE:
Radius: ${tokens.borderRadius} | Radius-lg: ${tokens.borderRadiusLg || '16px'} | Pill: ${tokens.borderRadiusFull || '9999px'}
Base spacing: ${tokens.spacing}`;
}

function buildSiteContext(siteData) {
  return `SITE CONTENT:
URL: ${siteData.url} | Title: ${siteData.title}
Description: ${siteData.description}
Logo URL: ${siteData.logoUrl || '(not found — generate SVG placeholder)'}
Headings: ${JSON.stringify((siteData.headings || []).slice(0, 8))}
Sections: ${JSON.stringify((siteData.sections || []).slice(0, 4).map(s => s.headingText || s.textSnippet?.slice(0, 60)))}`;
}

// ─── Step 4: Boilerplate (pure JS, no AI needed) ─────────────────────────────

function readTemplate(framework, filePath) {
  return fs.readFileSync(
    path.join(__dirname, '../templates', framework, filePath),
    'utf8'
  );
}

function buildBoilerplate(tokens, siteData, framework, pages) {
  if (framework === 'react') return buildReactBoilerplate(tokens, siteData, pages);
  return buildAngularBoilerplate(tokens, siteData, pages);
}

function buildReactBoilerplate(tokens, siteData, pages) {
  const routes = Object.keys(pages).map(p => {
    // File path already uses the sanitized PascalCase name (e.g. PatientCenteredCare.jsx)
    const name = toPageIdentifier(p.split('/').pop().replace(/\.\w+$/, ''));
    // URL path: PascalCase → kebab-case  (PatientCenteredCare → /patient-centered-care)
    const urlPath = name === 'Home' ? '/' : `/${toKebabCase(name)}`;
    return { name, path: urlPath };
  });

  const safeName = (tokens.brandName || siteData.title || 'redesigned-site')
    .toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-');

  const fonts = [tokens.fontHeading, tokens.fontBody]
    .filter(Boolean)
    .filter((f, i, arr) => arr.indexOf(f) === i); // deduplicate

  const gFonts = fonts
    .map(f => encodeURIComponent(f) + ':ital,wght@0,300;0,400;0,500;0,600;0,700;1,400')
    .join('&family=');

  const radius = tokens.borderRadius || '8px';

  // Derive gradient colors
  const gradStart = tokens.gradientStart || tokens.primaryColor || '#6366f1';
  const gradEnd   = tokens.gradientEnd   || tokens.accentColor  || tokens.secondaryColor || '#f59e0b';

  // Derive RGB values for rgba() usage
  const primaryRGB = hexToRGB(tokens.primaryColor || '#6366f1');
  const accentRGB  = hexToRGB(tokens.accentColor  || '#f59e0b');

  return {
    'package.json': readTemplate('react', 'package.json')
      .replace('{{PROJECT_NAME}}', safeName),

    'vite.config.js': readTemplate('react', 'vite.config.js'),

    'index.html': readTemplate('react', 'index.html')
      .replace('{{TITLE}}', tokens.brandName || siteData.title)
      .replace('{{DESCRIPTION}}', siteData.description || tokens.tagline || '')
      .replace('{{GOOGLE_FONTS}}', gFonts),

    'src/main.jsx': readTemplate('react', 'src/main.jsx'),

    'src/App.jsx': readTemplate('react', 'src/App.jsx')
      .replace('{{PAGE_IMPORTS}}', routes.map(r => `import ${r.name} from './pages/${r.name}';`).join('\n'))
      .replace('{{PAGE_ROUTES}}', routes.map(r => `<Route path="${r.path}" element={<${r.name} />} />`).join('\n      ')),

    'src/styles/global.css': readTemplate('react', 'src/styles/global.css'),

    'src/styles/tokens.css': readTemplate('react', 'src/styles/tokens.css')
      .replaceAll('{{PRIMARY_COLOR}}',    tokens.primaryColor   || '#6366f1')
      .replaceAll('{{SECONDARY_COLOR}}',  tokens.secondaryColor || '#818cf8')
      .replaceAll('{{ACCENT_COLOR}}',     tokens.accentColor    || '#f59e0b')
      .replaceAll('{{BG_COLOR}}',         tokens.bgColor        || '#ffffff')
      .replaceAll('{{BG_SECONDARY}}',     tokens.bgSecondary    || '#f8fafc')
      .replaceAll('{{TEXT_COLOR}}',       tokens.textColor      || '#111827')
      .replaceAll('{{TEXT_MUTED}}',       tokens.textMuted      || '#6b7280')
      .replaceAll('{{BORDER_COLOR}}',     tokens.borderColor    || '#e5e7eb')
      .replaceAll('{{FONT_HEADING}}',     `'${tokens.fontHeading || 'Inter'}', sans-serif`)
      .replaceAll('{{FONT_BODY}}',        `'${tokens.fontBody    || 'Inter'}', sans-serif`)
      .replaceAll('{{FONT_MONO}}',        `'${tokens.fontMono    || 'JetBrains Mono'}', monospace`)
      .replaceAll('{{FONT_BASE}}',        tokens.baseFontSize   || '16px')
      .replaceAll('{{BORDER_RADIUS}}',    radius)
      .replaceAll('{{BORDER_RADIUS_LG}}', `calc(${radius} * 2)`)
      .replaceAll('{{SPACING}}',          tokens.spacing        || '1.5rem')
      .replaceAll('{{BOX_SHADOW}}',       tokens.boxShadow      || '0 2px 16px rgba(0,0,0,0.08)')
      .replaceAll('{{GRADIENT_START}}',   gradStart)
      .replaceAll('{{GRADIENT_END}}',     gradEnd)
      .replaceAll('{{PRIMARY_RGB}}',      primaryRGB)
      .replaceAll('{{ACCENT_RGB}}',       accentRGB)
      .replaceAll('{{BG_RGB}}',           hexToRGB(tokens.bgColor        || '#ffffff'))
      .replaceAll('{{SECONDARY_RGB}}',    hexToRGB(tokens.secondaryColor || '#818cf8'))
      .replaceAll('{{BORDER_RGB}}',       hexToRGB(tokens.borderColor    || '#e5e7eb')),
  };
}

function buildAngularBoilerplate(tokens, siteData, pages) {
  const safeName = (tokens.brandName || 'redesigned-site')
    .toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-');
  return {
    'package.json': JSON.stringify({
      name: safeName, version: '0.0.0',
      scripts: { ng: 'ng', start: 'ng serve', build: 'ng build' },
      dependencies: {
        '@angular/animations': '^17.3.0', '@angular/common': '^17.3.0',
        '@angular/compiler': '^17.3.0', '@angular/core': '^17.3.0',
        '@angular/forms': '^17.3.0', '@angular/platform-browser': '^17.3.0',
        '@angular/platform-browser-dynamic': '^17.3.0', '@angular/router': '^17.3.0',
        rxjs: '~7.8.0', tslib: '^2.3.0', 'zone.js': '~0.14.3',
      },
      devDependencies: {
        '@angular-devkit/build-angular': '^17.3.8', '@angular/cli': '^17.3.8',
        '@angular/compiler-cli': '^17.3.0', typescript: '~5.4.2',
      },
    }, null, 2),
    'src/styles/tokens.css': `:root {
  --primary: ${tokens.primaryColor || '#6366f1'};
  --secondary: ${tokens.secondaryColor || '#818cf8'};
  --accent: ${tokens.accentColor || '#f59e0b'};
  --bg: ${tokens.bgColor || '#ffffff'};
  --bg-secondary: ${tokens.bgSecondary || '#f8fafc'};
  --text: ${tokens.textColor || '#111827'};
  --text-muted: ${tokens.textMuted || '#6b7280'};
  --border: ${tokens.borderColor || '#e5e7eb'};
  --font-heading: '${tokens.fontHeading}', sans-serif;
  --font-body: '${tokens.fontBody}', sans-serif;
  --radius: ${tokens.borderRadius || '8px'};
  --spacing: ${tokens.spacing || '1.5rem'};
  --shadow: ${tokens.boxShadow || '0 2px 16px rgba(0,0,0,0.08)'};
  --gradient: linear-gradient(135deg, ${tokens.gradientStart || tokens.primaryColor || '#6366f1'}, ${tokens.gradientEnd || tokens.accentColor || '#f59e0b'});
}`,
  };
}

// ─── Utility: safe page/component name helpers ───────────────────────────────
// AI can return page names like "Patient-Centered Care" or "About Mayo Clinic".
// These must be sanitized before use as JS identifiers, file names, or URL paths.

/**
 * Convert any display name to a valid PascalCase JS identifier.
 * "Patient-Centered Care" → "PatientCenteredCare"
 * "About Mayo Clinic"     → "AboutMayoClinic"
 * "FAQ"                   → "Faq"  (single word capitalised)
 */
function toPageIdentifier(name) {
  return (name || 'Page')
    .replace(/[^a-zA-Z0-9\s\-_]/g, '')   // strip everything except word chars, spaces, hyphens, underscores
    .split(/[\s\-_]+/)                    // split on whitespace / hyphens / underscores
    .filter(Boolean)
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join('');                            // PascalCase, no separators
}

/**
 * Convert a PascalCase identifier back to a kebab-case URL segment.
 * "PatientCenteredCare" → "patient-centered-care"
 * "Home"               → "home"  (handled as "/" by caller)
 */
function toKebabCase(name) {
  return name
    .replace(/([A-Z])/g, (m, c, i) => (i === 0 ? '' : '-') + c.toLowerCase())
    .replace(/^-/, '')
    .toLowerCase();
}

// ─── Utility: hex color to "R, G, B" string for CSS rgba() ───────────────────

function hexToRGB(hex) {
  const clean = hex.replace('#', '');
  const full  = clean.length === 3
    ? clean.split('').map(c => c + c).join('')
    : clean;
  const r = parseInt(full.slice(0, 2), 16);
  const g = parseInt(full.slice(2, 4), 16);
  const b = parseInt(full.slice(4, 6), 16);
  if (isNaN(r) || isNaN(g) || isNaN(b)) return '99, 102, 241';
  return `${r}, ${g}, ${b}`;
}

// ─── Post-processor: extract <style>{`...`}</style> from JSX → global.css ────
//
// The #1 source of "Missing semicolon" / "Expected ;" Babel/esbuild errors is CSS
// template literals inside JSX <style> tags. esbuild's dependency scanner and some
// Babel configs misparse them. The fix: lift ALL component CSS out of JSX files and
// append it to global.css, which is a plain CSS file that never gets JSX-parsed.
//
// Before: Footer.jsx has  <style>{` .ftr-container { ... } `}</style>
// After:  Footer.jsx has nothing; global.css has  .ftr-container { ... }
//
function extractInlineCssToGlobal(files) {
  const extractedCss = [];
  const updatedFiles = { ...files };

  for (const [filePath, content] of Object.entries(files)) {
    if (!filePath.endsWith('.jsx') && !filePath.endsWith('.tsx')) continue;
    if (!content.includes('<style>')) continue;

    const lines   = content.split('\n');
    const newLines = [];
    let insideStyle = false;
    let cssLines    = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      if (!insideStyle && /<style>\{\`/.test(line)) {
        // Same-line open+close: <style>{` .foo { ... } `}</style>
        const sameLineMatch = line.match(/<style>\{\`([\s\S]*?)\`\}<\/style>/);
        if (sameLineMatch) {
          if (sameLineMatch[1].trim()) extractedCss.push(sameLineMatch[1]);
          // Remove the style tag from this line; keep anything else on the line
          const rest = line.replace(/<style>\{`[\s\S]*?`\}<\/style>/, '').trim();
          if (rest) newLines.push(rest);
        } else {
          // Multi-line: capture CSS after the opening backtick
          const afterOpen = line.replace(/.*<style>\{\`/, '');
          if (afterOpen.trim()) cssLines.push(afterOpen);
          insideStyle = true;
          // Don't push this line to newLines (the <style> tag is being removed)
        }
      } else if (insideStyle) {
        if (/`\}<\/style>/.test(line)) {
          // Closing line: capture CSS before the closing backtick
          const beforeClose = line.replace(/`\}<\/style>.*/, '');
          if (beforeClose.trim()) cssLines.push(beforeClose);
          extractedCss.push(cssLines.join('\n'));
          cssLines    = [];
          insideStyle = false;
          // Don't push this line to newLines (closing </style> is removed)
        } else {
          cssLines.push(line);
        }
      } else {
        newLines.push(line);
      }
    }

    // Only update if we actually removed something
    if (newLines.length !== lines.length) {
      updatedFiles[filePath] = newLines.join('\n');
      console.log(`[extractInlineCssToGlobal] Lifted styles out of ${filePath}`);
    }
  }

  if (extractedCss.length > 0) {
    const block = '\n\n/* ─── Component styles (auto-extracted from JSX) ─── */\n'
                + extractedCss.join('\n\n');
    updatedFiles['src/styles/global.css'] = (updatedFiles['src/styles/global.css'] || '') + block;
    console.log(`[extractInlineCssToGlobal] Appended CSS from ${extractedCss.length} component(s) to global.css`);
  }

  return updatedFiles;
}

// ─── Post-processor: ensure tokens.css is pure CSS ───────────────────────────
// Smaller models (Llama 3.1 8B, DeepSeek V3) sometimes generate a JSX component
// as their response to the tokenize prompt instead of valid JSON. When the JSON
// parser salvages partial data the CSS file can end up with JS content if an older
// code-path wrote it. Strip any JS wrapper and keep only the :root { … } block.
function sanitizeTokensCss(files) {
  const key = 'src/styles/tokens.css';
  if (!files[key]) return files;
  const css = files[key];
  if (/export\s+default|import\s+[\w{]|function\s+\w+\s*\(/.test(css)) {
    console.warn('[sanitizeTokensCss] tokens.css contains JavaScript — stripping to :root block only');
    const rootMatch = css.match(/:root\s*\{[\s\S]*?\}/);
    if (rootMatch) return { ...files, [key]: rootMatch[0] };
    // If we can't find :root, fall back to the global.css (tokens will be missing but app won't crash)
    console.warn('[sanitizeTokensCss] Could not extract :root block — leaving tokens.css as-is');
  }
  return files;
}

module.exports = { generateRedesign };
