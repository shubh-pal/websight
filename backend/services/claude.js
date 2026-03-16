const fs   = require('fs');
const path = require('path');
const { createAIClient } = require('./aiClient');

/**
 * Master pipeline: analyze → components → pages → boilerplate
 * model: 'gemini-2.5-flash' | 'claude-opus-4-5' | etc.
 */
async function generateRedesign(siteData, framework = 'react', onProgress = () => {}, model = 'claude-opus-4-5') {
  const ai = createAIClient(model);

  onProgress(1, `Analyzing site structure… [${model}]`);
  const tokens = await analyzeAndTokenize(siteData, ai, (msg) => onProgress(1, msg));
  onProgress(1, `Design tokens extracted — ${tokens.brandName} (${tokens.siteType})`);

  onProgress(2, 'Generating shared components…');
  const components = await generateComponents(tokens, siteData, framework, ai, (msg) => onProgress(2, msg));

  onProgress(3, 'Generating pages…');
  const pages = await generatePages(tokens, components, siteData, framework, ai, (msg) => onProgress(3, msg));

  onProgress(4, 'Assembling project boilerplate…');
  const boilerplate = buildBoilerplate(tokens, siteData, framework, pages);

  return { tokens, files: { ...boilerplate, ...components, ...pages } };
}

// ─── Step 1: Design Tokens ────────────────────────────────────────────────────

async function analyzeAndTokenize(siteData, ai, onLog = () => {}) {
  const system = 'You are a senior design system architect and UI/UX expert. Analyze website data and return ONLY valid JSON — no markdown, no backticks, no explanation.';
  const user = `Analyze this website and return a PREMIUM design system. Apply expert-level design intelligence.

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

DESIGN INTELLIGENCE RULES:
1. COLORS: Primary + accent must have ≥4.5:1 contrast on their backgrounds (WCAG AA). Choose colors that feel intentional and brand-appropriate — not generic purple/blue defaults unless the site actually uses them.
2. STYLE: Classify the visual style accurately. Modern SaaS → clean white space, sharp typography, subtle shadows. Dark/tech → near-black bg, vibrant accent, glow effects. Agency/creative → bold typography, expressive gradients. E-commerce → high contrast, trust-building neutral palette.
3. FONTS: Match font personality to brand — don't default to Inter for everything. Editorial sites → serif heading. Tech → geometric sans. Creative → display or variable font. Pick REAL Google Fonts that suit the brand.
4. SHADOWS: Calibrate depth to the style. Minimal → no shadow. Cards → soft diffuse. Elevated elements → multi-layer shadow.
5. RADIUS: Pill/rounded for SaaS/consumer, sharp for enterprise/editorial, medium for general.
6. ANIMATION: Pick animationMood that fits — "subtle" for corporate/finance, "playful" for consumer apps, "dynamic" for creative/agency, "none" for ultra-minimal.

Return ONLY this JSON (no markdown, no backticks):
{
  "brandName": "...", "tagline": "...",
  "siteType": "e-commerce|portfolio|blog|saas|corporate|agency|news|other",
  "visualStyle": "modern-saas|dark-tech|editorial|glassmorphism|brutalist|minimal|creative|enterprise",
  "animationMood": "subtle|dynamic|playful|none",
  "density": "compact|comfortable|spacious",
  "primaryColor": "#hex", "secondaryColor": "#hex", "accentColor": "#hex",
  "successColor": "#hex", "warningColor": "#hex",
  "bgColor": "#hex", "bgSecondary": "#hex", "bgCard": "#hex",
  "textColor": "#hex", "textMuted": "#hex", "textSubtle": "#hex", "borderColor": "#hex",
  "gradientStart": "#hex", "gradientEnd": "#hex", "gradientAngle": "135deg",
  "heroOverlay": "rgba(0,0,0,0.45)",
  "fontHeading": "Google Font name", "fontBody": "Google Font name", "fontMono": "JetBrains Mono",
  "fontWeightHeading": "700", "fontWeightBody": "400",
  "baseFontSize": "16px", "lineHeight": "1.65", "letterSpacingHeading": "-0.02em",
  "borderRadius": "8px", "borderRadiusLg": "16px", "borderRadiusFull": "9999px",
  "spacing": "1.5rem",
  "boxShadow": "0 2px 16px rgba(0,0,0,0.08)",
  "boxShadowLg": "0 8px 40px rgba(0,0,0,0.12)",
  "boxShadowCard": "0 1px 4px rgba(0,0,0,0.06), 0 4px 24px rgba(0,0,0,0.08)",
  "transitionSpeed": "200ms",
  "navLinks": [{"text": "...", "path": "/..."}],
  "pages": ["Home", "About"], "components": ["Features","Testimonials","CTA","Stats","Pricing"],
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

// ─── Step 2: Components ───────────────────────────────────────────────────────

async function generateComponents(tokens, siteData, framework, ai, onLog = () => {}) {
  const isReact = framework === 'react';
  const ext     = isReact ? 'jsx' : 'ts';
  const compDir = isReact ? 'src/components' : 'src/app/components';
  const tokenCtx = buildTokenContext(tokens);
  const siteCtx  = buildSiteContext(siteData);
  const navJson  = JSON.stringify(tokens.navLinks || []);

  const coreComponents = [
    {
      name: 'tokens.css', dir: 'src/styles',
      prompt: `Generate ONLY the CSS file src/styles/tokens.css for "${tokens.brandName}".
Declare CSS custom properties under :root for every design token:
${tokenCtx}

Include ALL of these variables:
--primary, --secondary, --accent, --bg, --bg-secondary, --text, --text-muted, --border,
--font-heading, --font-body, --font-mono, --font-base,
--radius, --radius-lg, --radius-full,
--spacing, --spacing-sm, --spacing-lg, --spacing-xl,
--shadow, --shadow-lg, --shadow-xl,
--container, --transition, --transition-slow,
--gradient (linear-gradient combining --primary and --secondary),
--gradient-accent (linear-gradient combining --primary and --accent),
--primary-rgb (RGB values of primaryColor for rgba() usage),
--accent-rgb (RGB values of accentColor for rgba() usage)

Return ONLY raw CSS. No JSON, no markdown, no explanation.`,
    },
    {
      name: `Header.${ext}`, dir: compDir,
      prompt: `Generate ONLY a complete, production-quality ${isReact ? 'React JSX' : 'Angular TS'} Header component for "${tokens.brandName}" (${tokens.siteType}).

${tokenCtx}
Nav links: ${navJson}

CRITICAL STYLING RULES:
- Use a <style> JSX tag with CSS classes — NEVER use inline style={{}} attributes
- All CSS goes inside: <style>{\`...\`}</style> as the FIRST child inside the return()
- Use class names prefixed with "hdr-" (e.g. hdr-nav, hdr-logo, hdr-cta)
- CSS MUST include hover states (:hover), transitions, and @media (max-width: 768px) breakpoints

DESIGN REQUIREMENTS:
- Sticky top-0, z-index: 100, backdrop-filter: blur(16px) saturate(180%), background: rgba(bgColor, 0.85), border-bottom: 1px solid rgba(border, 0.6)
- On scroll: add box-shadow via JS scroll listener (window.addEventListener('scroll', ...))
- Logo left: ${siteData.logoUrl
  ? `USE THE REAL BRAND LOGO — render it as: <img src="${siteData.logoUrl}" alt="${tokens.brandName}" className="hdr-logo-img" /> with CSS: .hdr-logo-img { height: 36px; width: auto; object-fit: contain; display: block; }. Place it BEFORE the brand name text, or use it INSTEAD of the brand name if the logo includes the full wordmark. Do NOT generate any placeholder SVG or initials shape.`
  : `brand mark (geometric SVG shape or stylized initials) + brand name in --font-heading, font-weight 700`}
- Nav links: centered or right, gap 32px, font-size 0.9rem, font-weight 500, color var(--text-muted). Hover: color var(--text), underline slide-in via ::after pseudo element
- Active link: color var(--primary), ::after underline visible
- CTA button right: filled --primary bg, white text, padding 10px 22px, border-radius var(--radius-full), font-weight 600. Hover: scale(1.03), shadow glow
- Mobile (≤768px): hamburger icon (3 bars, 20×20px, gap 4px, 2px height bars), toggles a slide-down mobile nav with full-width links, 48px touch targets
- Transition: height/opacity/transform 200ms ease on mobile menu open/close

REQUIRED IMPORTS:
${isReact ? `import { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';` : ''}
import '../styles/tokens.css';

${isReact ? 'Default export function Header().' : 'Standalone Angular component.'}
Return ONLY the complete raw file starting with the import statements. No markdown fences.`,
    },
    {
      name: `Footer.${ext}`, dir: compDir,
      prompt: `Generate ONLY a complete, production-quality ${isReact ? 'React JSX' : 'Angular TS'} Footer component for "${tokens.brandName}".

${tokenCtx}
Nav links: ${navJson}
Tagline: ${tokens.tagline || ''}

CRITICAL STYLING RULES:
- Use <style>{\`...\`}</style> CSS tag with "ftr-" prefixed class names — NOT inline styles
- Include hover states, transitions, and @media (max-width: 768px) responsive layout

DESIGN — premium agency-quality footer like Vercel, Linear, or Stripe:

TOP SECTION:
- Gradient line at the very top: 1px solid with a linear-gradient from transparent → var(--border) → transparent (decorative separator)
- Background: dark — either #0a0a0a (if dark theme), or a very dark version of --bg-secondary (e.g. color-mix or hardcoded near-black). If light theme: use --bg-secondary with slightly lowered opacity.
- Padding: 64px 0 32px

MAIN GRID (4-column → 2-col tablet → 1-col mobile):
Column 1 — BRAND:
  - Logo: ${siteData.logoUrl
    ? `USE THE REAL BRAND LOGO — render <img src="${siteData.logoUrl}" alt="${tokens.brandName}" className="ftr-logo-img" /> with CSS: .ftr-logo-img { height: 32px; width: auto; object-fit: contain; filter: brightness(0) invert(1); opacity: 0.9; } (invert to white on dark footer). Do NOT generate placeholder SVG.`
    : `geometric SVG initials mark + brand name, font-weight 700, var(--font-heading)`}
  - Tagline: "${tokens.tagline || ''}" — font-size: 0.9rem, color: var(--text-muted), max-width: 220px, line-height: 1.6, margin-top: 12px
  - Social icon row (margin-top 24px, gap 12px): GitHub, Twitter/X, LinkedIn — use clean 20×20 SVG icons (inline), each in a 36×36 circle container (background: rgba(255,255,255,0.05), border: 1px solid rgba(255,255,255,0.1), border-radius: 50%, display flex, center). Hover: background rgba(primary, 0.15), border-color: var(--primary), transform: translateY(-2px), transition: 200ms

Column 2 — PRODUCT links (relevant to ${tokens.siteType}): 5-6 links
Column 3 — COMPANY links: About, Blog, Careers, Press, Contact
Column 4 — NEWSLETTER SIGNUP:
  - Heading: "Stay updated" font-size 0.95rem, font-weight 700
  - Sub: "Get the latest news and articles." font-size 0.85rem, var(--text-muted)
  - Input row: email input (background rgba(255,255,255,0.05), border 1px solid rgba(255,255,255,0.12), border-radius var(--radius-full), padding 10px 16px, color var(--text), font-size 0.9rem, flex: 1) + "Subscribe" button (--primary bg, white text, border-radius var(--radius-full), padding 10px 20px, font-weight 600, no-shrink). Row display: flex, gap 8px.
  - Input focus: border-color var(--primary), box-shadow 0 0 0 3px rgba(primary,0.15), outline none

COLUMN LINK STYLING:
- Column heading: font-size: 0.75rem, font-weight: 700, letter-spacing: 0.1em, text-transform: uppercase, color: var(--text-muted), margin-bottom: 16px
- Links: font-size: 0.9rem, color: var(--text-muted), text-decoration: none, display: block, margin-bottom: 10px. Hover: color: var(--text), transition: 150ms. Active/current: color var(--primary)

BOTTOM BAR:
- Divider: 1px solid rgba(255,255,255,0.06) (or var(--border) at 40% opacity)
- Padding: 24px 0. Display flex, justify-content space-between, align-items center. Stack on mobile.
- Left: "© ${new Date().getFullYear()} ${tokens.brandName}. All rights reserved." — font-size 0.85rem, var(--text-muted)
- Right: Privacy Policy · Terms of Service · Cookie Policy — font-size 0.85rem, var(--text-muted), gap 24px, hover: var(--text)

REQUIRED IMPORTS:
import '../styles/tokens.css';
${isReact ? 'Default export function Footer().' : ''}
Return ONLY the complete raw file. No markdown fences.`,
    },
    {
      name: `Layout.${ext}`, dir: compDir,
      prompt: `Generate ONLY the ${isReact ? 'React JSX' : 'Angular TS'} Layout component for "${tokens.brandName}".
This is a simple wrapper: Header + {children} + Footer.

${isReact ? `REQUIRED IMPORTS:
import Header from './Header';
import Footer from './Footer';
import '../styles/tokens.css';

Export: export default function Layout({ children }) { return (<><Header /><main>{children}</main><Footer /></>); }

Add a <style> tag with: .layout-main { min-height: calc(100vh - 140px); }` : 'Standalone Angular with router-outlet. Import Header and Footer components.'}
Return ONLY the complete raw file. No markdown fences.`,
    },
    {
      name: `Hero.${ext}`, dir: compDir,
      prompt: `Generate ONLY a complete, world-class ${isReact ? 'React JSX' : 'Angular TS'} Hero component for "${tokens.brandName}".

${tokenCtx}
${siteCtx}

STYLING: <style>{\`...\`}</style> first in return(), "hero-" prefixed classes, hover states, @media (max-width: 768px) + @media (max-width: 480px).

DESIGN — make this look like it cost $50,000 to design:

BACKGROUND:
- Full viewport: min-height: 100vh, display flex, align-items center
- Background: use --gradient or a radial-gradient mesh. Add 2-3 decorative blurred blobs (div.hero-blob, position: absolute, border-radius: 50%, filter: blur(80px), opacity: 0.35, various sizes 300-600px, placed off-center)
- Subtle @keyframes "float" animation on blobs (translateY ±20px, 6-8s ease-in-out infinite alternate)
- Add a very subtle noise/grain texture overlay using SVG filter or CSS noise pattern (optional but premium)

BADGE: Pill above headline — e.g. "✦ Introducing ${tokens.brandName}" or a product announcement. Style: background rgba(primary,0.1), border 1px solid rgba(primary,0.25), border-radius 9999px, font-size 0.8rem, padding 6px 16px, font-weight 500. Fade-in animation.

HEADLINE:
- font-size: clamp(3rem, 7vw, 5.5rem), font-weight: 800-900, letter-spacing: -0.04em, line-height: 1.05
- Use gradient text via background-clip: text if appropriate for the style (e.g. gradient from --primary to --accent on key words)
- Max 10 words, punchy and brand-accurate

SUBHEADLINE: font-size: clamp(1rem, 2vw, 1.25rem), line-height: 1.7, max-width: 560px, color: var(--text-muted), margin: 24px auto/0

CTA ROW:
- Primary button: background: var(--primary), color: #fff, padding: 14px 32px, border-radius: var(--radius-full), font-weight: 600, font-size: 1rem. Hover: transform: translateY(-2px) scale(1.02), box-shadow: 0 8px 30px rgba(primary,0.4)
- Secondary button: transparent bg, border: 1.5px solid var(--border), same padding. Hover: background var(--bg-secondary), border-color var(--primary)
- Gap: 12px between buttons

SOCIAL PROOF ROW (below CTAs):
- 3-5 trust signals: e.g. "★★★★★ 4.9/5" or "10,000+ users" or logos row (use placeholder text-based company name badges)
- Small font, muted color, dash separator between items

REAL CONTENT:
- Brand: "${tokens.brandName}"
- Tagline: "${tokens.tagline || 'The future of ' + tokens.siteType}"
- Description: "${siteData.description || ''}"

REQUIRED IMPORTS:
import { useEffect, useRef } from 'react';
import '../styles/tokens.css';
${isReact ? 'Default export function Hero().' : ''}
Return ONLY the complete raw file starting with imports. No markdown fences.`,
    },
  ];

  // Determine which extra components to generate based on siteType and requested components
  const requestedExtras = (tokens.components || [])
    .filter(c => !['Header','Footer','Layout','Hero'].includes(c));

  const extraDefs = {
    Features: {
      prompt: (name) => `Generate ONLY a complete React JSX Features/Benefits component for "${tokens.brandName}" (${tokens.siteType}).
${tokenCtx}
${siteCtx}

STYLING: <style>{\`...\`}</style> with "feat-" prefixed classes. @media (max-width: 768px) + @media (max-width: 480px).

DESIGN — make this look like a Stripe/Linear features section:
LAYOUT: 3-column grid (→ 2-col tablet → 1-col mobile), gap: 24px. Section padding: 96px 0.
HEADER: Eyebrow label ("WHY CHOOSE US" in caps, letter-spacing: 0.1em, --primary color, font-size 0.8rem) above heading. Heading: clamp(2rem, 4vw, 3rem), centered. Subtext: max-width: 560px, centered, --text-muted.
CARDS: background var(--bg-card, var(--bg-secondary)), border: 1px solid var(--border), border-radius var(--radius-lg), padding 32px. Hover: translateY(-4px), box-shadow var(--shadow-lg), border-color rgba(primary,0.4), transition 200ms.
ICON: 48×48px container, background rgba(primary,0.1), border-radius var(--radius), display flex, center. Inside: relevant geometric SVG icon (not emoji) in var(--primary), 24×24.
TITLE: font-size 1.1rem, font-weight 700, margin-top 16px, letter-spacing -0.01em.
DESC: font-size 0.95rem, line-height 1.7, color var(--text-muted), margin-top 8px.
Use REAL features for "${tokens.brandName}": "${siteData.description || ''}" — at least 6 cards.

Import '../styles/tokens.css'; Default export.
Return ONLY the complete raw JSX file.`
    },
    Testimonials: {
      prompt: (name) => `Generate ONLY a complete React JSX Testimonials component for "${tokens.brandName}".
${tokenCtx}

STYLING: Use <style>{\`...\`}</style> with "test-" prefixed classes. Include hover states and @media (max-width: 768px).

DESIGN — Stripe/Notion-quality social proof section:

SECTION LAYOUT:
- Background: var(--bg-secondary) or a very light tint of --primary (e.g. rgba(primary,0.03))
- Section padding: 96px 0. Max-width 1200px container, centered.
- Eyebrow label: "TRUSTED BY THOUSANDS" in caps, letter-spacing: 0.12em, font-size: 0.75rem, color var(--primary), font-weight: 600
- Section heading: clamp(1.8rem, 4vw, 2.75rem), font-weight: 800, letter-spacing: -0.03em, color var(--text)
- Grid: 3 columns on desktop → 2 tablet → 1 mobile, gap: 24px

TESTIMONIAL CARDS:
- Background: var(--bg) or white, border: 1px solid var(--border), border-radius: var(--radius-lg)
- Padding: 32px. Box-shadow: var(--shadow-card, 0 1px 4px rgba(0,0,0,.06), 0 8px 32px rgba(0,0,0,.08))
- Hover: translateY(-5px), box-shadow: var(--shadow-lg), border-color: rgba(primary,0.25), transition: 220ms cubic-bezier(0.4,0,0.2,1)

CARD INTERNALS (top to bottom):
1. STAR RATING: 5 gold stars (★★★★★) color: #f59e0b, font-size: 1rem, margin-bottom: 16px
2. QUOTE: Large opening quote SVG icon (") in var(--primary) at 32px, opacity 0.3, positioned top-left. Quote text: font-size: 1.05rem, line-height: 1.75, color: var(--text), font-style: italic, margin-bottom: 24px
3. DIVIDER: 1px solid var(--border), margin: 0
4. AUTHOR ROW (margin-top: 20px): Avatar circle (40×40px, background: var(--gradient), border-radius: 50%, display flex, align-items center, font-size 0.9rem font-weight 700 color #fff initials) + flex-col: author name (font-weight: 700, font-size: 0.95rem) + role & company (font-size: 0.8rem, color: var(--text-muted))

FEATURED CARD (middle): Add data-featured styling — border-color: var(--primary), box-shadow: 0 0 0 1px var(--primary), 0 8px 40px rgba(primary,0.15)

Make 3 vivid, specific, realistic testimonials for "${tokens.brandName}" (${tokens.siteType}) — no generic "Great product!" quotes. Include specific results/metrics in each quote.

REQUIRED IMPORTS:
import '../styles/tokens.css';
Default export.
Return ONLY the complete raw JSX file.`
    },
    CTA: {
      prompt: (name) => `Generate ONLY a complete React JSX CTA (Call-to-Action) section for "${tokens.brandName}".
${tokenCtx}

STYLING: <style>{\`...\`}</style> with "cta-" prefixed classes. Hover states, transitions.

DESIGN — high-converting, visually memorable:
BACKGROUND: Full-width section, padding 96px 0. Use --gradient as background. Add 2-3 decorative blobs (position: absolute, border-radius 50%, filter blur(60px), opacity 0.2, var(--accent) or white color) for depth. Overflow: hidden on section.
CONTENT: max-width 640px, centered, position relative z-index 1.
EYEBROW: Small badge/pill — "Get Started Today" — background rgba(white,0.15), border 1px solid rgba(white,0.25), border-radius 9999px, color white, padding 6px 16px, font-size 0.8rem.
HEADLINE: clamp(2.2rem, 5vw, 3.5rem), font-weight 800, letter-spacing -0.03em, color #fff, line-height 1.1. Two lines max.
SUBTEXT: font-size 1.1rem, color rgba(255,255,255,0.8), line-height 1.7, margin-top 16px.
BUTTONS: Row, gap 12px, justify-content center, margin-top 32px.
  Primary: background #fff, color var(--primary), padding 14px 36px, border-radius var(--radius-full), font-weight 700. Hover: scale(1.03), shadow 0 8px 30px rgba(0,0,0,0.2).
  Secondary: background transparent, border 2px solid rgba(white,0.5), color #fff, same sizing. Hover: background rgba(white,0.1), border-color #fff.
TRUST LINE: Below buttons — small text "No credit card required · Free 14-day trial · Cancel anytime" or similar, color rgba(white,0.6), font-size 0.85rem.

CONTENT: Use real "${tokens.brandName}" messaging from: "${siteData.description || tokens.tagline || ''}"

Import '../styles/tokens.css'; Default export.
Return ONLY the complete raw JSX file.`
    },
    Stats: {
      prompt: (name) => `Generate ONLY a complete React JSX Stats/Numbers section for "${tokens.brandName}" (${tokens.siteType}).
${tokenCtx}

STYLING: Use <style>{\`...\`}</style> with "stat-" prefixed classes. Include @media (max-width: 768px).

DESIGN — make this feel like Linear or Vercel's metrics section:

SECTION:
- Background: var(--bg) or near-white. Padding: 80px 0. Max-width 1100px container.
- Optional subtle background: very light repeating dot grid via CSS background-image (radial-gradient 1px circles, rgba(0,0,0,0.05)) — gives technical depth
- Section tag above: small eyebrow label "BY THE NUMBERS" in caps, letter-spacing: 0.1em, var(--primary), 0.75rem

GRID LAYOUT:
- 4-column grid on desktop → 2×2 on tablet → 1-col on mobile, gap: 2px (border as separator)
- Each cell: padding 48px 32px, text-align center
- Separator style: 1px solid var(--border) between cells (use border-right / border-bottom trick)

STAT CELL (top to bottom):
1. ICON (optional): 32×32 inline SVG in var(--primary), opacity 0.7, margin-bottom 12px
2. NUMBER: font-size: clamp(2.5rem, 5vw, 4rem), font-weight: 900, letter-spacing: -0.04em, color: var(--primary) — OR use gradient text (background: var(--gradient), -webkit-background-clip: text)
3. SUFFIX/PREFIX: "+" or "%" appended inline, font-size: 60% of number, font-weight: 700, color: var(--accent)
4. LABEL: font-size: 1rem, font-weight: 600, color: var(--text), margin-top: 4px
5. SUBLABEL: font-size: 0.85rem, color: var(--text-muted), line-height: 1.5

ANIMATION: Use useEffect + IntersectionObserver. When stat enters viewport, animate the number from 0 to final value using a counter increment over 1.5s with ease-out easing (requestAnimationFrame). Do NOT rely on external libraries.

USE REAL context for "${tokens.brandName}" (${tokens.siteType}) — impressive, believable metrics (e.g. users, uptime, countries, NPS score, time saved).

REQUIRED IMPORTS:
import { useEffect, useRef, useState } from 'react';
import '../styles/tokens.css';
Default export.
Return ONLY the complete raw JSX file.`
    },
    Pricing: {
      prompt: (name) => `Generate ONLY a complete React JSX Pricing section for "${tokens.brandName}" (${tokens.siteType}).
${tokenCtx}

STYLING: Use <style>{\`...\`}</style> with "price-" prefixed classes. Include hover states and @media (max-width: 768px).

DESIGN — premium SaaS pricing like Vercel, Linear, or Lemon Squeezy:

SECTION HEADER:
- Eyebrow: "PRICING" in caps, letter-spacing 0.12em, var(--primary), 0.75rem, font-weight 600
- Heading: "Simple, Transparent Pricing" — clamp(1.8rem, 4vw, 2.75rem), font-weight 800, letter-spacing -0.03em
- Subtext: "No hidden fees. Cancel anytime." — color: var(--text-muted)
- BILLING TOGGLE: Monthly / Annual switch (use useState). Pill-shaped toggle: background var(--bg-secondary), border var(--border), padding 4px, border-radius 9999px. Active option: background var(--primary), color #fff, border-radius 9999px, padding 6px 20px. Annual shows "Save 20%" badge (background: rgba(accent,0.15), color: var(--accent), border-radius 9999px, font-size 0.7rem, font-weight 700).

GRID: 3 columns on desktop → 1-col stacked on mobile, gap: 24px, align-items start (popular card is taller via extra padding).

CARD ANATOMY:

Standard cards (Starter & Enterprise):
- Background: var(--bg), border: 1px solid var(--border), border-radius: var(--radius-lg), padding: 32px
- Hover: translateY(-4px), border-color: rgba(primary, 0.3), box-shadow: var(--shadow-lg), transition: 220ms

Popular card (Pro/Growth — the MIDDLE):
- Transform: scale(1.04) on desktop to make it stand out
- Background: var(--gradient) or var(--primary), color: #fff
- Box-shadow: 0 0 0 2px var(--primary), 0 20px 60px rgba(primary,0.3)
- Border-radius: var(--radius-lg)
- "MOST POPULAR" badge: top of card, centered — background rgba(255,255,255,0.2), color #fff, border-radius 9999px, font-size 0.7rem, font-weight 700, padding 4px 16px, letter-spacing 0.08em
- All text on white/light for popular card, feature checkmarks in rgba(255,255,255,0.9)

CARD INTERNALS (top to bottom):
1. Tier name: font-size: 1rem, font-weight: 700, letter-spacing: 0.05em, text-transform uppercase
2. Price display: font-size: clamp(2.5rem, 5vw, 3.5rem), font-weight: 900, letter-spacing: -0.04em. Billing period: font-size: 0.9rem, font-weight: 400, opacity 0.7
3. Short description: 1 sentence, font-size: 0.9rem, color var(--text-muted), margin: 12px 0 24px
4. Divider: 1px solid var(--border) (or rgba(white,0.2) for popular)
5. Feature list: margin-top: 24px, list-style none. Each item: display flex, align-items flex-start, gap 10px, margin-bottom 12px, font-size 0.9rem. Checkmark: inline SVG (✓) in 18×18px circle — background rgba(primary,0.1) + color var(--primary) for standard, rgba(255,255,255,0.2) + white for popular
6. CTA button: margin-top 32px, full-width, padding 14px 24px, border-radius var(--radius-full), font-weight 700, font-size 1rem. Standard: var(--primary) bg + white text. Popular: white bg + var(--primary) text. Hover: scale(1.02) + deeper shadow.

ANNUAL PRICING LOGIC: When annual toggle active, show discounted price (monthly × 0.8) with a strikethrough of original monthly price inline.

Build REAL feature lists appropriate for "${tokens.brandName}" (${tokens.siteType}).

REQUIRED IMPORTS:
import { useState } from 'react';
import '../styles/tokens.css';
Default export.
Return ONLY the complete raw JSX file.`
    },
    FAQ: {
      prompt: (name) => `Generate ONLY a complete React JSX FAQ accordion component for "${tokens.brandName}".
${tokenCtx}

STYLING: Use <style>{\`...\`}</style> with "faq-" prefixed classes. Include transitions and @media (max-width: 768px).

DESIGN — smooth, polished accordion like Framer or Radix UI docs:

SECTION LAYOUT:
- Padding: 96px 0. Background: var(--bg). Max-width: 800px centered.
- Eyebrow: "FAQ" in caps, letter-spacing: 0.12em, var(--primary), 0.75rem, font-weight: 600
- Heading: "Frequently Asked Questions" — clamp(1.8rem, 4vw, 2.75rem), font-weight: 800, letter-spacing: -0.03em
- Subtext: "Everything you need to know. Can't find the answer? Reach out to our team." — var(--text-muted)
- Items list: margin-top: 48px, display: flex, flex-direction: column, gap: 0

ACCORDION ITEM:
- Container: border-bottom: 1px solid var(--border). First item also has border-top: 1px solid var(--border).
- No outer box-shadow or card container — minimal, editorial feel

QUESTION ROW:
- Button (full width, no browser default): display flex, justify-content space-between, align-items center, padding: 24px 0, cursor pointer, background: transparent
- Question text: font-size: 1.05rem, font-weight: 600, color: var(--text), line-height: 1.5, text-align: left, flex: 1
- Active question text: color: var(--primary)
- Icon: 24×24px chevron SVG (or +/× icon). Closed state: rotate(0deg). Open state: rotate(180deg for chevron, 45deg for +). Transition: transform 250ms cubic-bezier(0.4,0,0.2,1). Color: var(--text-muted), active: var(--primary)

ANSWER PANEL:
- Animated expand/collapse using max-height trick: closed max-height: 0, open max-height: 500px, overflow: hidden, transition: max-height 300ms cubic-bezier(0.4,0,0.2,1)
- Answer text inside: padding: 0 0 24px 0, font-size: 0.95rem, line-height: 1.75, color: var(--text-muted)
- Optional: answer can have inline <strong> or <a href="#"> links styled in var(--primary)

STATE MANAGEMENT: Use useState with openIndex (only one open at a time). Click same item → closes it.

HOVER EFFECT: On question row hover, question text color: var(--text) with smooth 150ms transition. Subtle background: hover adds background: var(--bg-secondary) on the row, -8px padding horizontal (so border spans full width but bg is indented slightly).

Write 7-8 REAL, specific FAQs for "${tokens.brandName}" (${tokens.siteType}) — cover pricing, getting started, integrations, security, cancellation, support. No generic questions.

REQUIRED IMPORTS:
import { useState } from 'react';
import '../styles/tokens.css';
Default export.
Return ONLY the complete raw JSX file.`
    },
  };

  // Pick up to 4 extra components: prefer requested ones, then fill with defaults
  const defaultExtras = ['Features', 'Testimonials', 'CTA', 'Stats'];
  const extrasToGenerate = [
    ...requestedExtras.filter(n => extraDefs[n]),
    ...defaultExtras.filter(n => !requestedExtras.includes(n)),
  ]
    .filter(n => extraDefs[n])
    .slice(0, 4);

  const extras = extrasToGenerate.map(name => ({
    name: `${name}.${ext}`, dir: compDir,
    prompt: extraDefs[name].prompt(name),
  }));

  const files = {};
  for (const comp of [...coreComponents, ...extras]) {
    const filePath = `${comp.dir}/${comp.name}`;
    onLog(`Generating ${comp.name}…`);
    try {
      files[filePath] = await generateSingleFile(comp.prompt, framework, ai, onLog);
    } catch (err) {
      console.error(`[pipeline] Failed ${filePath}:`, err.message);
      // Output a valid stub component so imports don't crash the app
      files[filePath] = buildStubComponent(comp.name.replace(/\.\w+$/, ''), err.message);
    }
  }
  return files;
}

// ─── Step 3: Pages ────────────────────────────────────────────────────────────

async function generatePages(tokens, components, siteData, framework, ai, onLog = () => {}) {
  const isReact = framework === 'react';
  const ext     = isReact ? 'jsx' : 'ts';
  const pageDir = isReact ? 'src/pages' : 'src/app/pages';

  // Build list of available components
  const compNames = Object.keys(components)
    .filter(k => k.includes('/components/') && !k.endsWith('.css'))
    .map(k => k.split('/').pop().replace(/\.\w+$/, ''));

  const tokenCtx = buildTokenContext(tokens);
  const siteCtx  = buildSiteContext(siteData);

  const pageNames = (tokens.pages || ['Home']).slice(0, 3);
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

    const prompt = `Generate ONLY a complete, production-quality ${isReact ? 'React JSX' : 'Angular TS'} ${displayName} page for "${tokens.brandName}" (${tokens.siteType}).

${tokenCtx}
${siteCtx}

AVAILABLE COMPONENTS (import from '../components/X'):
${compNames.join(', ')}

PAGE STRUCTURE for "${displayName}":
${buildPageStructure(pageName, compNames, tokens)}

CRITICAL STYLING RULES:
- Use <style>{\`...\`}</style> CSS tag with "${toKebabCase(pageName)}-" prefixed class names for any page-specific styles
- Import and USE the Layout component to wrap all content
- Use CSS variables throughout: var(--primary), var(--accent), var(--bg), etc.

REQUIRED IMPORTS:
import Layout from '../components/Layout';
${compImports}
import '../styles/tokens.css';
${isReact ? `\nexport default function ${pageName}() { ... }` : ''}

CONTENT RULES:
- Use REAL content: brand="${tokens.brandName}", title="${siteData.title}", desc="${siteData.description || ''}"
- Import and use the pre-built components (Hero, Features, Testimonials, CTA, etc.)
- Add page-specific sections with inline <section> elements if needed
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

function buildPageStructure(pageName, available, tokens) {
  const page = pageName.toLowerCase();
  const has = (c) => available.includes(c);

  if (page === 'home') {
    const sections = ['<Hero /> — full viewport hero section'];
    if (has('Stats')) sections.push('<Stats /> — impressive numbers row');
    if (has('Features')) sections.push('<Features /> — 3-col feature grid');
    if (has('Testimonials')) sections.push('<Testimonials /> — social proof');
    if (has('Pricing')) sections.push('<Pricing /> — pricing cards');
    if (has('CTA')) sections.push('<CTA /> — conversion section');
    return sections.map((s, i) => `${i + 1}. ${s}`).join('\n');
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
    return raw.replace(/^```[\w]*\n?/, '').replace(/\n?```\s*$/g, '').replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '').replace(/<ctrl\d+>/g, '').trim();
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
      return raw.replace(/^```[\w]*\n?/, '').replace(/\n?```\s*$/g, '').replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '').replace(/<ctrl\d+>/g, '').trim();
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
      return raw.replace(/^```[\w]*\n?/, '').replace(/\n?```\s*$/g, '').trim();
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

function buildTokenContext(tokens) {
  const angle = tokens.gradientAngle || '135deg';
  const grad = tokens.gradientStart && tokens.gradientEnd
    ? `linear-gradient(${angle}, ${tokens.gradientStart}, ${tokens.gradientEnd})`
    : `linear-gradient(${angle}, ${tokens.primaryColor || '#6366f1'}, ${tokens.accentColor || '#f59e0b'})`;

  const style = tokens.visualStyle || 'modern-saas';
  const mood  = tokens.animationMood || 'subtle';
  const speed = tokens.transitionSpeed || '200ms';

  // Style-specific design guidance
  const styleGuide = {
    'dark-tech':    'Dark backgrounds, vibrant accent glows, sharp edges, code-aesthetic.',
    'glassmorphism':'backdrop-filter blur panels, frosted glass cards, luminous accents on dark/gradient bg.',
    'editorial':    'Strong typographic hierarchy, generous white space, serif accents, minimal color.',
    'brutalist':    'High contrast, raw borders, bold type, intentional roughness.',
    'minimal':      'Maximum white space, almost no shadow, hairline borders, muted palette.',
    'creative':     'Expressive gradients, asymmetric layouts, bold display fonts, vivid colors.',
    'enterprise':   'Conservative palette, dense information layout, trust-building neutrals.',
    'modern-saas':  'Clean white space, subtle card shadows, rounded corners, clear CTA hierarchy.',
  }[style] || 'Clean, professional, modern SaaS aesthetic.';

  return `DESIGN TOKENS:
Brand: ${tokens.brandName} | Type: ${tokens.siteType} | Style: ${style} | Dark: ${tokens.darkMode || false}
Visual guidance: ${styleGuide}
Animation: ${mood} (transition: ${speed} ease) | Density: ${tokens.density || 'comfortable'}

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
      .replace('{{PRIMARY_COLOR}}',    tokens.primaryColor   || '#6366f1')
      .replace('{{SECONDARY_COLOR}}',  tokens.secondaryColor || '#818cf8')
      .replace('{{ACCENT_COLOR}}',     tokens.accentColor    || '#f59e0b')
      .replace('{{BG_COLOR}}',         tokens.bgColor        || '#ffffff')
      .replace('{{BG_SECONDARY}}',     tokens.bgSecondary    || '#f8fafc')
      .replace('{{TEXT_COLOR}}',       tokens.textColor      || '#111827')
      .replace('{{TEXT_MUTED}}',       tokens.textMuted      || '#6b7280')
      .replace('{{BORDER_COLOR}}',     tokens.borderColor    || '#e5e7eb')
      .replace('{{FONT_HEADING}}',     `'${tokens.fontHeading || 'Inter'}', sans-serif`)
      .replace('{{FONT_BODY}}',        `'${tokens.fontBody    || 'Inter'}', sans-serif`)
      .replace('{{FONT_MONO}}',        `'${tokens.fontMono    || 'JetBrains Mono'}', monospace`)
      .replace('{{FONT_BASE}}',        tokens.baseFontSize   || '16px')
      .replace('{{BORDER_RADIUS}}',    radius)
      .replace('{{BORDER_RADIUS_LG}}', `calc(${radius} * 2)`)
      .replace('{{SPACING}}',          tokens.spacing        || '1.5rem')
      .replace('{{BOX_SHADOW}}',       tokens.boxShadow      || '0 2px 16px rgba(0,0,0,0.08)')
      .replace('{{GRADIENT_START}}',   gradStart)
      .replace('{{GRADIENT_END}}',     gradEnd)
      .replace('{{PRIMARY_RGB}}',      primaryRGB)
      .replace('{{ACCENT_RGB}}',       accentRGB)
      .replace('{{BG_RGB}}',           hexToRGB(tokens.bgColor        || '#ffffff'))
      .replace('{{SECONDARY_RGB}}',    hexToRGB(tokens.secondaryColor || '#818cf8'))
      .replace('{{BORDER_RGB}}',       hexToRGB(tokens.borderColor    || '#e5e7eb')),
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

module.exports = { generateRedesign };
