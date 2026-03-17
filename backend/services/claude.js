const fs   = require('fs');
const path = require('path');
const { createAIClient } = require('./aiClient');

/**
 * Master pipeline: analyze → creativeDirection → scenePlan → components → pages → boilerplate
 * model: 'gemini-2.5-flash' | 'claude-opus-4-5' | etc.
 */
async function generateRedesign(siteData, framework = 'react', onProgress = () => {}, model = 'claude-opus-4-5') {
  const ai = createAIClient(model);

  onProgress(1, `Analyzing brand identity… [${model}]`);
  const tokens = await analyzeAndTokenize(siteData, ai, (msg) => onProgress(1, msg));
  onProgress(1, `Brand analyzed — ${tokens.brandName} · ${tokens.styleArchetype || tokens.siteType} · ${tokens.brandPersonality || ''}`);

  onProgress(2, 'Generating creative direction…');
  const creativeDirection = await generateCreativeDirection(tokens, siteData, ai, (msg) => onProgress(2, msg));
  onProgress(2, `Creative direction — ${(creativeDirection.designConcept || '').slice(0, 70)}…`);

  onProgress(3, 'Planning page scenes…');
  const scenePlan = await generateScenePlan(tokens, creativeDirection, ai, (msg) => onProgress(3, msg));
  onProgress(3, `Scenes — ${(scenePlan.scenes || []).map(s => s.name).join(' → ')}`);

  onProgress(4, 'Generating shared components…');
  const components = await generateComponents(tokens, creativeDirection, scenePlan, siteData, framework, ai, (msg) => onProgress(4, msg));

  onProgress(5, 'Generating pages…');
  const pages = await generatePages(tokens, creativeDirection, scenePlan, components, siteData, framework, ai, (msg) => onProgress(5, msg));

  onProgress(6, 'Assembling project boilerplate…');
  const boilerplate = buildBoilerplate(tokens, siteData, framework, pages);

  // Post-process: lift all <style>{`...`}</style> blocks out of JSX → global.css
  // This eliminates the entire class of "Missing semicolon" / "Expected ;" Babel errors
  // caused by CSS template literals in JSX files.
  let files = { ...boilerplate, ...components, ...pages };
  files = extractInlineCssToGlobal(files);
  files = sanitizeTokensCss(files);

  // Post-generation design quality validation
  const evaluation = evaluateDesign(files, tokens, scenePlan);
  if (evaluation.score < 6) {
    onProgress(6, `⚠ Design score ${evaluation.score}/10 — ${evaluation.issues.slice(0, 2).join(', ')}`);
  }

  return { tokens, creativeDirection, scenePlan, evaluation, files };
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

// ─── Step 1b: Creative Direction ──────────────────────────────────────────────
// Generates a rich, opinionated creative brief unique to this brand.
// Expands on the basic creativeDirection seeded in analyzeAndTokenize.

async function generateCreativeDirection(tokens, siteData, ai, onLog = () => {}) {
  const system = `You are an avant-garde creative director who designs websites that win awards and stop people mid-scroll.
You REJECT safe, templated thinking. Every output must feel designed for THIS brand specifically.
Return ONLY valid JSON. No markdown. No explanation.`;

  const existing  = tokens.creativeDirection || {};
  const archetype = tokens.styleArchetype || 'gradient-saas';

  const designTensions = [
    'minimal vs expressive', 'structured vs organic', 'calm vs energetic',
    'precise vs fluid', 'restrained vs bold', 'dark vs luminous',
    'serious vs playful', 'corporate vs avant-garde',
  ];
  const assignedTension = designTensions[Math.floor(Math.random() * designTensions.length)];

  const user = `Create a deep, opinionated creative direction for "${tokens.brandName}" (${tokens.siteType}).

Brand intelligence:
- Personality: ${tokens.brandPersonality} | Audience: ${tokens.targetAudience}
- Positioning: ${tokens.pricePositioning} | Visual maturity: ${tokens.visualMaturity}
- Style archetype: ${archetype} | Tone: ${tokens.toneOfVoice}

Existing creative seed (EXPAND and make MORE specific — do NOT be generic):
${existing.designConcept  ? `Concept: ${existing.designConcept}`                     : ''}
${existing.visualMotif    ? `Motif: ${existing.visualMotif}`                          : ''}
${existing.mustHaveMoments?.length ? `Must-haves: ${existing.mustHaveMoments.join(', ')}` : ''}

Design tension to explore: "${assignedTension}"

Site content hints:
Title: ${siteData.title}
Description: ${(siteData.description || '').slice(0, 200)}
Top headings: ${JSON.stringify((siteData.headings || []).slice(0, 5))}

Return ONLY this JSON:
{
  "designConcept": "One powerful sentence — the core visual and emotional idea driving this entire design",
  "visualMotif": "A specific, repeatable visual element woven throughout every section (e.g. 'thin diagonal rule lines echoing legal precision', 'glowing amber edge accents', 'typographic weight contrast between serif and grotesque')",
  "layoutEnergy": "calm|balanced|dynamic|experimental",
  "density": "airy|balanced|dense",
  "uniquenessScore": "low|medium|high|very-high",
  "designTension": "${assignedTension}",
  "doNotDo": ["specific thing to avoid #1", "specific thing to avoid #2", "specific thing to avoid #3"],
  "mustHaveMoments": ["specific standout moment #1", "specific standout moment #2", "specific standout moment #3"],
  "heroMood": "One sentence describing the exact emotional feeling the hero should evoke",
  "colorApplication": "How colors should be applied — which dominates, where accent appears, dark/light rhythm",
  "typographyExpression": "How typography should be used expressively — size contrasts, weight play, mixed fonts",
  "spacingPhilosophy": "How space is used as a design tool — tight vs generous, rhythm, breathing room"
}`;

  try {
    return await withRetry(async () => {
      const raw = (await ai.complete(system, user, 2048, { isJson: true })).trim()
        .replace(/^```json?\n?/, '').replace(/\n?```$/, '');
      return JSON.parse(raw);
    }, ai, onLog, 'creative-direction');
  } catch (err) {
    console.warn('[generateCreativeDirection] Failed, using tokens seed:', err.message);
    return {
      ...existing,
      designTension:        assignedTension,
      heroMood:             `A premium ${archetype} experience communicating ${tokens.brandPersonality} authority`,
      colorApplication:     `${tokens.primaryColor} as dominant, ${tokens.accentColor} as conversion accent`,
      typographyExpression: `${tokens.fontHeading} at high weight with generous scale contrast`,
      spacingPhilosophy:    'Balanced rhythm with generous section padding and tight component spacing',
    };
  }
}

// ─── Step 1c: Scene Plan ───────────────────────────────────────────────────────
// Replaces generateLayoutStrategy — produces a cinematic scene-by-scene plan
// that drives component generation and page assembly order.

async function generateScenePlan(tokens, creativeDirection, ai, onLog = () => {}) {
  const system = `You are a master narrative designer who builds website experiences like film directors build scenes.
Each section of the page is a "scene" with a specific goal, mood, and visual approach.
Return ONLY valid JSON. No markdown. No explanation.`;

  const comps     = tokens.components || ['Features', 'Testimonials', 'CTA', 'Stats'];
  const archetype = tokens.styleArchetype || 'gradient-saas';

  const user = `Design a cinematic scene plan for "${tokens.brandName}" (${tokens.siteType}).

Creative direction:
Concept: ${creativeDirection.designConcept}
Visual motif: ${creativeDirection.visualMotif}
Design tension: ${creativeDirection.designTension}
Layout energy: ${creativeDirection.layoutEnergy} | Density: ${creativeDirection.density}
Must-have moments: ${(creativeDirection.mustHaveMoments || []).join(' · ')}
Avoid: ${(creativeDirection.doNotDo || []).join(' · ')}
Hero mood: ${creativeDirection.heroMood || ''}

Available component types: Hero (always scene 1), ${comps.join(', ')}
Style archetype: ${archetype}
Brand: ${tokens.brandPersonality} targeting ${tokens.targetAudience}

SCENE DESIGN RULES:
1. Design 4–6 scenes total. Hero is always scene 1. Use ALL available component types.
2. Each scene must have a DISTINCT visual treatment — no two scenes can feel the same.
3. Alternate density: dense scene MUST be followed by airy scene.
4. At least ONE scene must be visually unconventional (not a standard layout).
5. Background rhythm creates drama — not all light, not all dark.
6. Sequence tells a story: hook → proof → emotion → conversion.

Layout options per component:
- Hero: centered | split-left | split-right | asymmetric | immersive | editorial
- Features: 3-col-grid | bento-grid | alternating-rows | timeline | 2-col-asymmetric
- Stats: 4-col-dividers | 2x2-grid | horizontal-banner
- Testimonials: 3-col | masonry | featured-center | single-large
- CTA: centered-gradient | split-dark | full-bleed | minimal-border

Return ONLY this JSON:
{
  "scenes": [
    {
      "name": "Hero",
      "componentType": "Hero",
      "goal": "Hook visitor immediately — establish brand identity in 3 seconds",
      "layout": "asymmetric",
      "visualHook": "The single most striking visual element in this scene",
      "interaction": "How users interact or are drawn in (scroll cue, animated element, etc.)",
      "density": "airy",
      "background": "gradient|dark|light|pattern|image-overlay|primary",
      "twist": "One unconventional design decision that makes this scene memorable"
    }
  ],
  "pageNarrative": "One sentence describing the emotional arc of the full page",
  "transitionStyle": "How sections connect visually (e.g. 'diagonal cuts', 'wave dividers', 'hard color blocks', 'seamless gradient flow')"
}`;

  try {
    return await withRetry(async () => {
      const raw = (await ai.complete(system, user, 2048, { isJson: true })).trim()
        .replace(/^```json?\n?/, '').replace(/\n?```$/, '');
      const parsed = JSON.parse(raw);
      if (!parsed.scenes?.length) throw new Error('No scenes returned');
      // Ensure Hero is always first
      if (parsed.scenes[0]?.componentType !== 'Hero') {
        parsed.scenes.unshift({
          name: 'Hero', componentType: 'Hero',
          goal: 'Establish brand identity and hook the visitor',
          layout: 'centered', visualHook: 'Large typographic statement',
          interaction: 'Scroll indicator', density: 'airy',
          background: 'gradient', twist: 'Gradient text headline',
        });
      }
      return parsed;
    }, ai, onLog, 'scene-plan');
  } catch (err) {
    console.warn('[generateScenePlan] Failed, using default scene plan:', err.message);
    const strategy = tokens.componentStrategy || {};
    const defaultScenes = [
      { name: 'Hero',         componentType: 'Hero',         goal: 'Hook visitor and establish brand',    layout: strategy.hero?.layout         || 'centered',         visualHook: 'Bold gradient headline with social proof',         interaction: 'Scroll cue',            density: 'airy',    background: 'gradient', twist: 'Oversized gradient headline text' },
      { name: 'Stats',        componentType: 'Stats',        goal: 'Establish instant credibility',       layout: strategy.stats?.layout        || '4-col-dividers',   visualHook: 'Large animated numbers',                           interaction: 'Count-up animation',    density: 'dense',   background: 'dark',     twist: 'Dark band contrasting with light sections' },
      { name: 'Features',     componentType: 'Features',     goal: 'Demonstrate value and capability',    layout: strategy.features?.layout     || '3-col-grid',       visualHook: 'Icon-led feature cards with gradient accents',     interaction: 'Hover lift effect',     density: 'balanced',background: 'light',    twist: 'One dominant featured card breaking the grid' },
      { name: 'Testimonials', componentType: 'Testimonials', goal: 'Build trust through social proof',    layout: strategy.testimonials?.layout || 'featured-center',  visualHook: 'Featured center card with brand color accent border',interaction: 'Hover reveal detail',   density: 'airy',    background: 'secondary',twist: 'Featured testimonial at 1.04x scale' },
      { name: 'CTA',          componentType: 'CTA',          goal: 'Drive conversion — final impression', layout: strategy.cta?.layout          || 'centered-gradient', visualHook: 'Full-bleed gradient with floating decorative blobs', interaction: 'Button glow on hover',   density: 'airy',    background: 'gradient', twist: 'Asymmetric blob shapes behind CTA content' },
    ].filter(s => s.componentType === 'Hero' || comps.includes(s.componentType));
    return {
      scenes: defaultScenes,
      pageNarrative: 'A compelling journey from brand discovery to conversion',
      transitionStyle: 'seamless gradient flow',
    };
  }
}

// ─── Step 2: Components ───────────────────────────────────────────────────────

async function generateComponents(tokens, creativeDirection, scenePlan, siteData, framework, ai, onLog = () => {}) {
  const isReact = framework === 'react';
  const ext     = isReact ? 'jsx' : 'ts';
  const compDir = isReact ? 'src/components' : 'src/app/components';
  const tokenCtx = buildTokenContext(tokens, creativeDirection);
  const siteCtx  = buildSiteContext(siteData);
  const navJson  = JSON.stringify((tokens.navLinks || []).slice(0, 5));

  // Extract per-component scene from scene plan (with fallbacks from componentStrategy)
  const heroScene  = getSceneForComponent('Hero',         scenePlan);
  const featScene  = getSceneForComponent('Features',     scenePlan);
  const testScene  = getSceneForComponent('Testimonials', scenePlan);
  const statsScene = getSceneForComponent('Stats',        scenePlan);
  const ctaScene   = getSceneForComponent('CTA',          scenePlan);

  const strategy = tokens.componentStrategy || {};

  // Derive layout types from scenes, falling back to componentStrategy
  const heroLayout   = heroScene?.layout  || strategy.hero?.layout         || 'centered';
  const heroVisual   = heroScene?.background === 'dark' ? 'abstract-grid' : (heroScene?.visualHook?.toLowerCase().includes('blob') ? 'blobs' : (strategy.hero?.visual || 'blobs'));
  const heroCtaStyle = strategy.hero?.ctaStyle  || 'dual-button';
  const featLayout   = featScene?.layout  || strategy.features?.layout     || '3-col-grid';
  const featCard     = strategy.features?.cardStyle || 'bordered';
  const testLayout   = testScene?.layout  || strategy.testimonials?.layout || 'featured-center';
  const statsLayout  = statsScene?.layout || strategy.stats?.layout        || '4-col-dividers';
  const statsStyle   = strategy.stats?.style    || 'icon-led';
  const ctaLayout    = ctaScene?.layout   || strategy.cta?.layout          || 'centered-gradient';
  const archetype    = tokens.styleArchetype                                || 'gradient-saas';
  const toneOfVoice  = tokens.toneOfVoice                                  || 'professional';
  const ctaLanguage  = tokens.ctaLanguage                                  || 'Get Started';

  // Creative direction fields (from the rich standalone creativeDirection object)
  const designConcept = creativeDirection.designConcept    || '';
  const visualMotif   = creativeDirection.visualMotif      || '';
  const layoutEnergy  = creativeDirection.layoutEnergy     || 'balanced';
  const density       = creativeDirection.density          || 'balanced';
  const doNotDo       = (creativeDirection.doNotDo         || []).join(' · ');
  const mustHave      = (creativeDirection.mustHaveMoments || []).join(' · ');
  const designTension = creativeDirection.designTension    || 'restrained vs bold';

  // Creative constraints block — injected into every component prompt
  const creativeBlock = `
🎨 CREATIVE DIRECTION (follow strictly — this is what makes this site unique):
Design concept: ${designConcept || `${archetype} aesthetic for ${tokens.brandPersonality} brand`}
Visual motif: ${visualMotif || 'subtle brand-consistent visual theme'} — weave this throughout every element
Layout energy: ${layoutEnergy} | Density: ${density} | Design tension: ${designTension}
${doNotDo   ? `AVOID: ${doNotDo}` : ''}
${mustHave  ? `MUST INCLUDE: ${mustHave}` : ''}

🔥 DESIGN OVERRIDE RULES — apply to EVERY component:
- At least ONE element must break the grid or be positioned asymmetrically
- Use layering: overlap elements, use z-index for depth, avoid flat same-plane layouts
- Typography must vary dramatically in scale — giant headings next to fine print
- At least ONE edge-to-edge full-bleed treatment in the section
- This component must feel crafted by a human designer with a strong opinion — not generated by AI.`;

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
      prompt: `Design a visually striking, non-generic Hero section for "${tokens.brandName}" that expresses the scene and creative direction below. This MUST feel custom-designed for this brand — not reusable for any other site.

${tokenCtx}
${siteCtx}
${creativeBlock}
${buildSceneBlock(heroScene)}

STYLING: <style>{\`...\`}</style> first, "hero-" prefixed classes, @media (max-width: 768px) + (max-width: 480px).

LAYOUT TYPE: "${heroLayout}" — follow this strictly:
${heroLayout === 'split-left'    ? '- Split: text LEFT (max-width 520px), visual element RIGHT. Equal columns. Text left-aligned.' : ''}
${heroLayout === 'split-right'   ? '- Split: visual LEFT, text RIGHT (max-width 520px). Text left-aligned.' : ''}
${heroLayout === 'asymmetric'    ? '- Asymmetric: 60/40 split. Intentional imbalance. Left-heavy text block, right decorative element.' : ''}
${heroLayout === 'immersive'     ? '- Full viewport immersive. Background IS the design. Content centered, overlaid. Dramatic.' : ''}
${heroLayout === 'editorial'     ? '- Editorial: large typographic statement. Minimal decoration. Grid-based alignment. Like NYT or Bloomberg.' : ''}
${heroLayout === 'centered'      ? '- Centered: text + CTAs centered. Visual elements as background/beneath content.' : ''}

BACKGROUND: "${heroScene?.background || 'gradient'}"
${(heroScene?.background || '') === 'dark'            ? '- Dark section: deep black/near-black bg, white text, bright accent pops.' : ''}
${(heroScene?.background || 'gradient') === 'gradient'? '- Gradient bg: var(--gradient), or custom CSS gradient from token colors.' : ''}
${(heroScene?.background || '') === 'light'           ? '- Light bg: var(--bg), clean and airy.' : ''}
${(heroScene?.background || '') === 'pattern'         ? '- Pattern bg: CSS radial-gradient dots or repeating line grid overlay.' : ''}

VISUAL ELEMENT: ${heroScene?.visualHook || 'bold gradient headline with decorative background element'}
${heroVisual === 'blobs'         ? '- 2-3 blurred gradient blobs (position:absolute, filter:blur(80px), opacity:0.35, 300-600px circles)' : ''}
${heroVisual === 'abstract-grid' ? '- Subtle CSS grid/dot pattern overlay + geometric line shapes' : ''}
${heroVisual === 'minimal'       ? '- Zero visual decoration. Typography IS the design. Maximum white space.' : ''}

HERO MOOD: ${creativeDirection.heroMood || `Premium ${archetype} feel — ${tokens.brandPersonality} and ${toneOfVoice}`}

CONTENT (NO placeholders — write real brand copy):
- Badge: pill with "✦ ${tokens.tagline || tokens.brandName}" — rgba(primary,0.1) bg, border, border-radius 9999px
- Headline: clamp(3rem, 7vw, 5.5rem), weight 800-900, tracking -0.04em, line-height 1.05. Match "${tokens.headlineStyle}" style. Max 10 words. Must NOT sound generic SaaS.
- Subheadline: clamp(1rem, 2vw, 1.25rem), line-height 1.7, max-width 560px, var(--text-muted). Real brand description.
- CTAs (${heroCtaStyle}): primary="${ctaLanguage}" (--primary bg), secondary="Learn More" (bordered). Hover: translateY(-2px) scale(1.02), glow
- Social proof row: stars + trust signals specific to "${tokens.targetAudience}"
- Brand: "${tokens.brandName}", desc: "${siteData.description || ''}"

TONE: ${toneOfVoice}. Write as a ${tokens.brandPersonality} brand — not a generic tech startup.

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
${buildSceneBlock(featScene)}

STYLING: <style>{\`...\`}</style> with "feat-" prefixed classes. @media (max-width: 768px) + (max-width: 480px).

BACKGROUND: "${featScene?.background || 'light'}" section.
DENSITY: "${featScene?.density || 'balanced'}" — ${featScene?.density === 'dense' ? 'pack in more information, tighter spacing, data-rich' : featScene?.density === 'airy' ? 'generous whitespace, breathe, calm' : 'balanced rhythm'}

STRUCTURE RULES (override generic defaults):
- DO NOT default to equal uniform cards — vary emphasis and visual hierarchy
- At least ONE feature must be visually dominant (larger, different treatment, spans 2 columns)
- Apply the visual motif "${visualMotif}" as a recurring accent element across cards
- TWIST TO IMPLEMENT: "${featScene?.twist || 'One dominant oversized feature card'}"

LAYOUT: "${featLayout}" — implement this layout type precisely:
${featLayout === '3-col-grid'        ? '- 3-column equal grid → 2-col tablet → 1-col mobile. Uniform card heights. But: first card spans 2 columns or is visually elevated.' : ''}
${featLayout === 'bento-grid'        ? '- Bento grid: CSS grid with varying card sizes. One large (2×2), two medium (1×2), three small (1×1). Asymmetric but balanced. No two adjacent cells same size.' : ''}
${featLayout === 'alternating-rows'  ? '- Alternating rows: icon/text LEFT then RIGHT each row. 2-column full-width rows. Large icon on one side, text on other. Generous spacing between rows.' : ''}
${featLayout === 'timeline'          ? '- Vertical timeline: center line (2px, --gradient), alternating left/right content blocks, circle dot connector.' : ''}
${featLayout === '2-col-asymmetric'  ? '- 2-column asymmetric: left 40% = one large dominant feature card, right 60% = 2×2 smaller feature cards.' : ''}

CARD STYLE: "${featCard}"
${featCard === 'bordered'        ? '- border: 1px solid var(--border), hover: border-color rgba(var(--primary-rgb),0.4), box-shadow var(--shadow-lg)' : ''}
${featCard === 'elevated'        ? '- box-shadow: 0 1px 3px rgba(0,0,0,.06), 0 8px 32px rgba(0,0,0,.08), hover: translateY(-6px), shadow-xl' : ''}
${featCard === 'flat'            ? '- No border, no shadow. Background var(--bg-secondary) tint. Hover: brightness(0.97).' : ''}
${featCard === 'gradient-border' ? '- Gradient border via ::before pseudo-element with var(--gradient) background. Glows on hover.' : ''}

SECTION HEADER: Eyebrow ("WHY CHOOSE ${tokens.brandName.toUpperCase()}", letter-spacing 0.1em, --primary, 0.8rem uppercase) + heading clamp(2rem,4vw,3rem) + subtext max-width 560px.
ICONS: 48×48 containers, rgba(var(--primary-rgb),0.1) bg, 24×24 SVG paths (geometric, meaningful — NOT emoji). Each feature gets a UNIQUE icon.
Write 6 REAL, specific features for "${tokens.brandName}" audience: "${tokens.targetAudience}".
Tone: ${toneOfVoice}.

Import '../styles/tokens.css'; Default export.
Return ONLY complete raw JSX file.`
    },

    Testimonials: {
      prompt: () => `Design a compelling Testimonials section for "${tokens.brandName}" that feels emotionally real — not like AI filler.
${tokenCtx}
${creativeBlock}
${buildSceneBlock(testScene)}

STYLING: <style>{\`...\`}</style> with "test-" prefixed classes. @media (max-width: 768px).

BACKGROUND: "${testScene?.background || 'secondary'}" — ${testScene?.background === 'dark' ? 'dark section, white text, light card treatments' : 'light/secondary bg for trust and openness'}
DENSITY: "${testScene?.density || 'airy'}" — breathing room between testimonials
TWIST: "${testScene?.twist || 'Featured center card with brand accent border'}" — implement this.

CONTENT RULES (critical — generic testimonials destroy credibility):
Each testimonial MUST include: (1) a specific scenario/context, (2) a measurable outcome or metric, (3) emotional resonance authentic to "${tokens.targetAudience}"
NO generic phrases like "highly recommend" or "great experience" — write vivid, specific, believable quotes.

LAYOUT: "${testLayout}"
${testLayout === '3-col'            ? '- 3 equal columns, uniform cards.' : ''}
${testLayout === 'masonry'          ? '- Masonry: CSS columns:3, vary card heights naturally. Staggered visual rhythm.' : ''}
${testLayout === 'featured-center'  ? '- Center card larger/elevated (scale 1.04, --primary border), flanked by 2 smaller cards.' : ''}
${testLayout === 'single-large'     ? '- One large featured quote at 2/3 width (large italic type, big quote mark) + 2 stacked smaller on right.' : ''}

SECTION: bg varies per background type above. Padding 96px 0. Eyebrow "TRUSTED BY LEADING ${tokens.siteType.toUpperCase()}S" + heading clamp(1.8rem,4vw,2.75rem).

CARDS: bg var(--bg), border 1px solid var(--border), border-radius var(--radius-lg), padding 32px.
Hover: translateY(-5px), shadow-lg, border-color rgba(var(--primary-rgb),0.25).
Contents: ★★★★★ (#f59e0b stars) → large decorative quote mark (opacity 0.15, font-size 4rem) → italic quote text → horizontal rule → avatar (initials circle, --gradient bg) + name + role/company.
Featured card: border: 2px solid var(--primary), box-shadow: 0 0 0 1px var(--primary), 0 8px 40px rgba(var(--primary-rgb),0.15).

Write 3 vivid, SPECIFIC testimonials for "${tokens.brandName}" — real metrics, no generic praise.
Tone: ${toneOfVoice}. Audience: "${tokens.targetAudience}".

Import '../styles/tokens.css'; Default export.
Return ONLY complete raw JSX file.`
    },

    CTA: {
      prompt: () => `Design an emotionally resonant, visually striking CTA section for "${tokens.brandName}" — this is the LAST IMPRESSION. Make it unforgettable.
${tokenCtx}
${creativeBlock}
${buildSceneBlock(ctaScene)}

STYLING: <style>{\`...\`}</style> with "cta-" prefixed classes.

BACKGROUND: "${ctaScene?.background || 'gradient'}" — this is the final visual punch.
DENSITY: "${ctaScene?.density || 'airy'}" — the CTA must breathe and command attention.
TWIST: "${ctaScene?.twist || 'Asymmetric blob shapes behind content'}" — implement this.

LAYOUT: "${ctaLayout}"
${ctaLayout === 'centered-gradient' ? '- Full-width gradient bg (var(--gradient)), content centered, max-width 640px. 2-3 decorative blobs (position:absolute, filter:blur(80px), opacity:0.2-0.4, 300-500px).' : ''}
${ctaLayout === 'split-dark'        ? '- 2-column split: left dark panel with large headline, right lighter panel with input/trust signals.' : ''}
${ctaLayout === 'full-bleed'        ? '- Full-bleed: extreme padding 120px 0, immersive gradient that spans edge-to-edge, very large headline.' : ''}
${ctaLayout === 'minimal-border'    ? '- Minimal: var(--bg) bg, bordered container (border: 1px solid var(--border), border-radius var(--radius-lg)), refined typography, no gradients.' : ''}

CONTENT (tone: "${toneOfVoice}" — NOT generic, NOT SaaS filler):
- Eyebrow pill: rgba(255,255,255,0.15) bg, 1px white/primary border, brand-relevant label that fits "${tokens.brandName}"
- Headline: clamp(2.2rem,5vw,3.5rem), weight 800, 2 lines max. Emotionally resonant for "${tokens.targetAudience}". Write as ${tokens.brandPersonality} brand.
- Subtext: rgba(255,255,255,0.8) or var(--text-muted), 1.1rem, line-height 1.7, max-width 560px
- Primary CTA: "${ctaLanguage}" — white/light bg, var(--primary) text, hover scale(1.03) with glow
- Secondary CTA: transparent bg, border, hover rgba(white,0.1)
- Trust line: specific, credible signal for "${tokens.brandName}" — NOT generic "No credit card required" unless truly relevant

Import '../styles/tokens.css'; Default export.
Return ONLY complete raw JSX file.`
    },

    Stats: {
      prompt: () => `Design a Stats section for "${tokens.brandName}" that makes numbers feel like a story — not a uniform data table.
${tokenCtx}
${creativeBlock}
${buildSceneBlock(statsScene)}

STYLING: <style>{\`...\`}</style> with "stat-" prefixed classes. @media (max-width: 768px).

BACKGROUND: "${statsScene?.background || 'dark'}" — ${statsScene?.background === 'dark' ? 'dark band creates dramatic contrast, white numbers pop' : statsScene?.background === 'primary' ? 'brand primary color bg, white text for strong visual identity' : 'light section, primary-colored numbers'}
DENSITY: "${statsScene?.density || 'dense'}" — pack in the credibility signals
TWIST: "${statsScene?.twist || 'Dark band contrasting with light sections'}" — implement this.

HIERARCHY RULES (numbers as storytelling):
- Stats MUST NOT be uniform blocks of equal visual weight
- 1 hero stat (largest, most impactful number) + 3 supporting stats
- Each number gets a contextual micro-label beneath it (story-driven, e.g. "spanning 7 offices" not just "offices")
- Apply visual motif "${visualMotif}" as a subtle accent

LAYOUT: "${statsLayout}"
${statsLayout === '4-col-dividers'   ? '- 4 equal columns, 1px var(--border) dividers between cells (border-right trick, last has none). Padding 48px 32px each cell.' : ''}
${statsLayout === '2x2-grid'         ? '- 2×2 grid with gap 24px. Each cell: card with border-radius var(--radius-lg). First cell larger/featured.' : ''}
${statsLayout === 'horizontal-banner'? '- Single horizontal row, full-width. Stats inline with dividers. Dense, impactful band.' : ''}

NUMBER STYLE: "${statsStyle}"
${statsStyle === 'minimal-numbers'  ? '- Just the number, very large (clamp(3rem,6vw,5rem)), weight 900, --primary or white. No icons.' : ''}
${statsStyle === 'icon-led'         ? '- 32×32 SVG icon above number. Icon styled to match section bg. Each stat gets unique, meaningful icon.' : ''}
${statsStyle === 'gradient-text'    ? '- Number: background var(--gradient), -webkit-background-clip: text, -webkit-text-fill-color: transparent.' : ''}
${statsStyle === 'bordered-cells'   ? '- Each stat in bordered card (border: 1px solid var(--border), radius var(--radius-lg)), hover lift.' : ''}

ANIMATION: useEffect + IntersectionObserver + requestAnimationFrame counter (0 → value, 1.5s ease-out sqrt curve). No libraries.
SUFFIX: +/% styled in var(--accent), font-size 60% of number size.

Stats MUST be real, credible metrics for "${tokens.brandName}" (${tokens.siteType}) audience: "${tokens.targetAudience}".
NOT generic "99.9% uptime" — use context-appropriate numbers (years of history, countries served, cases won, awards, clients, etc).

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

async function generatePages(tokens, creativeDirection, scenePlan, components, siteData, framework, ai, onLog = () => {}) {
  const isReact = framework === 'react';
  const ext     = isReact ? 'jsx' : 'ts';
  const pageDir = isReact ? 'src/pages' : 'src/app/pages';

  // Build list of available components
  const compNames = Object.keys(components)
    .filter(k => k.includes('/components/') && !k.endsWith('.css'))
    .map(k => k.split('/').pop().replace(/\.\w+$/, ''));

  const tokenCtx = buildTokenContext(tokens, creativeDirection);
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
This is the ENTIRE website in one page — a rich, full-length landing page that tells a complete story.

${tokenCtx}
${siteCtx}

AVAILABLE COMPONENTS (import ALL relevant ones from '../components/X'):
${compNames.join(', ')}

MANDATORY PAGE STRUCTURE — include EVERY section in this EXACT scene-driven order:
${buildPageStructure(pageName, compNames, tokens, scenePlan)}

PAGE NARRATIVE: ${scenePlan?.pageNarrative || 'A compelling journey from brand discovery to conversion'}
TRANSITION STYLE: ${scenePlan?.transitionStyle || 'seamless gradient flow'} — implement section transitions accordingly

DESIGN MISSION — this page must feel PREMIUM and UNIQUE:
- Style archetype: ${tokens.styleArchetype || 'professional'} — let this drive every visual decision
- Creative concept: ${creativeDirection.designConcept || 'A distinctive premium experience'}
- Visual motif: ${creativeDirection.visualMotif || ''} — weave through connecting elements
- Background rhythm alternates per scene — dark sections create drama, light breathe
- Scroll animations: ${tokens.scrollAnimation || 'fade-up'} with 80ms stagger between elements
- Tone of voice: ${tokens.toneOfVoice || 'professional'} — reflect this in any inline text/labels

CRITICAL STYLING RULES:
- Use <style>{\`...\`}</style> CSS tag with "home-" prefixed class names for page-specific styles
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

function buildPageStructure(pageName, available, tokens, scenePlan = null) {
  const page = pageName.toLowerCase();
  const has = (c) => available.includes(c);

  if (page === 'home') {
    // Use scene plan order if available — this is the scene-driven assembly
    const scenes = scenePlan?.scenes;
    if (scenes?.length) {
      const sceneDescriptions = scenes
        .filter(scene => scene.componentType === 'Hero' || has(scene.componentType))
        .map((scene, i) => {
          const bg    = scene.background ? ` [bg: ${scene.background}]` : '';
          const dens  = scene.density    ? ` [density: ${scene.density}]` : '';
          const goal  = scene.goal       ? ` — ${scene.goal}` : '';
          const twist = scene.twist      ? ` ✦ twist: "${scene.twist}"` : '';
          return `${i + 1}. <${scene.componentType} />${goal}${bg}${dens}${twist}`;
        });
      return sceneDescriptions.join('\n');
    }

    // Fallback: default order
    const sectionOrder = ['Hero', 'Stats', 'Features', 'Testimonials', 'CTA'];
    const sectionDescriptions = {
      Hero:         '<Hero /> — full viewport hero section',
      Stats:        '<Stats /> — impressive numbers row',
      Features:     '<Features /> — feature showcase section',
      Testimonials: '<Testimonials /> — social proof section',
      Pricing:      '<Pricing /> — pricing cards',
      CTA:          '<CTA /> — conversion/call-to-action section',
    };
    return sectionOrder
      .filter(s => s === 'Hero' || has(s))
      .map((s, i) => `${i + 1}. ${sectionDescriptions[s] || `<${s} />`}`)
      .join('\n');
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

═══ CSS VARIABLE NAMES — use ONLY these exact names ═══
var(--primary) var(--secondary) var(--accent) | var(--bg) var(--bg-secondary) var(--bg-alt) | var(--text) var(--text-muted) var(--muted) | var(--border) | var(--shadow) var(--shadow-lg) var(--shadow-xl) | var(--radius) var(--radius-lg) var(--radius-full) var(--radius-pill) | var(--spacing) var(--spacing-sm) var(--spacing-lg) var(--spacing-xl) | var(--gradient) var(--gradient-accent) var(--gradient-subtle) | var(--transition) var(--transition-slow) | var(--font-heading) var(--font-body) var(--container)
For spacing values use: 8px, 16px, 24px, 32px, 48px, 64px, 80px, 96px directly — NEVER invent --spacing-unit, --spacing-2, --pill, --transition-ease or any other custom variable not in this list.

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
    const code = extractFirstCodeBlock(raw).replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '').replace(/<ctrl\d+>/g, '').trim();
    // Return empty string here — withRetry will detect it and retry
    return code;
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
      const result = await fn();
      // Treat empty response as a retryable failure
      if (result === null || result === undefined || result === '') {
        if (attempt < retries) {
          const delay = 3000 * attempt;
          onLog(`Empty response on ${label} — retrying (${attempt}/${retries})…`);
          await new Promise(r => setTimeout(r, delay));
          continue;
        }
        throw new Error(`Empty response after ${retries} attempts`);
      }
      return result;
    } catch (err) {
      const msg = err.message || '';
      const is429       = msg.includes('429') || msg.includes('Quota') || msg.includes('RESOURCE_EXHAUSTED');
      const isTransient = msg.includes('500') || msg.includes('502') || msg.includes('503')
                       || msg.includes('UNAVAILABLE') || msg.includes('network') || msg.includes('ECONNRESET')
                       || msg.includes('timeout') || msg.includes('socket');

      if ((is429 || isTransient) && attempt < retries) {
        const delay = is429 ? attempt * 25000 : attempt * 4000;
        onLog(`${is429 ? 'Rate limit' : 'Transient error'} on ${label} — retrying in ${delay / 1000}s… (${attempt}/${retries})`);
        console.warn(`[ai] ${is429 ? '429' : 'transient'} on ${label}, attempt ${attempt}/${retries}, waiting ${delay}ms: ${msg}`);
        await new Promise(r => setTimeout(r, delay));
      } else {
        throw err;
      }
    }
  }
}

// ─── Context helpers ──────────────────────────────────────────────────────────

function buildTokenContext(tokens, creativeDirection = null) {
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

  // Use the rich creativeDirection object if provided (from generateCreativeDirection step)
  // Fall back to tokens.creativeDirection (seeded by analyzeAndTokenize)
  const cd = creativeDirection || tokens.creativeDirection || {};
  const creativeNotes = cd.designConcept ? `
CREATIVE DIRECTION:
Concept: ${cd.designConcept}
Motif: ${cd.visualMotif || ''} | Tension: ${cd.designTension || ''}
Energy: ${cd.layoutEnergy || 'balanced'} | Density: ${cd.density || 'balanced'}
Color application: ${cd.colorApplication || ''}
Typography: ${cd.typographyExpression || ''}
Spacing: ${cd.spacingPhilosophy || ''}
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
Dark mode: ${tokens.darkMode || false}${creativeNotes}

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
Base spacing: ${tokens.spacing}

⚠️ CSS VARIABLE RULE — CRITICAL:
Use ONLY these exact CSS variable names. NEVER invent new ones (e.g. --spacing-unit, --pill, --transition-ease are NOT valid):
Colors:    var(--primary)  var(--secondary)  var(--accent)
BG:        var(--bg)  var(--bg-secondary)  var(--bg-alt)
Text:      var(--text)  var(--text-muted)  var(--muted)
Border:    var(--border)
Spacing:   var(--spacing)  var(--spacing-sm)  var(--spacing-lg)  var(--spacing-xl)
Shape:     var(--radius)  var(--radius-lg)  var(--radius-full)  var(--radius-pill)
Shadow:    var(--shadow)  var(--shadow-lg)  var(--shadow-xl)
Gradient:  var(--gradient)  var(--gradient-accent)  var(--gradient-subtle)
Motion:    var(--transition)  var(--transition-slow)
Font:      var(--font-heading)  var(--font-body)  var(--font-mono)
RGB:       var(--primary-rgb)  var(--accent-rgb)  var(--bg-rgb)  var(--border-rgb)
For raw spacing values use: 8px, 16px, 24px, 32px, 48px, 64px, 80px, 96px (NOT calc(n * var(--spacing-unit)))`;
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
  let css = files[key];

  // Strip JS if AI corrupted the file
  if (/export\s+default|import\s+[\w{]|function\s+\w+\s*\(/.test(css)) {
    console.warn('[sanitizeTokensCss] tokens.css contains JavaScript — stripping to :root block only');
    const rootMatch = css.match(/:root\s*\{[\s\S]*?\}/);
    if (rootMatch) css = rootMatch[0];
    else {
      console.warn('[sanitizeTokensCss] Could not extract :root block — leaving tokens.css as-is');
      return files;
    }
  }

  // Inject aliases for common variables the AI invents but are not in the standard token set.
  // This is a safety net — the real fix is the CSS variable rule in prompts.
  const aliasBlock = `
/* ─── Auto-injected aliases for AI-invented variable names ─── */
  --spacing-unit:          8px;
  --spacing-xs:            0.5rem;
  --spacing-2:             1rem;
  --spacing-3:             1.5rem;
  --spacing-4:             2rem;
  --spacing-md:            1rem;
  --spacing-xxl:           5rem;
  --spacing-xxxl:          7rem;
  --pill:                  9999px;
  --pill-radius:           9999px;
  --transition-speed:      0.2s;
  --transition-ease:       cubic-bezier(0.4,0,0.2,1);
  --font-size-base:        16px;
  --letter-spacing-heading: -0.02em;
  --line-height-body:      1.65;
  --card:                  var(--bg-secondary);
  --card-bg:               var(--bg-secondary);
  --card-shadow:           var(--shadow);
  --card-shadow-featured:  var(--shadow-lg);
  --ftr-bg:                #0d0d0d;
  --ftr-border:            rgba(255,255,255,0.1);
  --ftr-link-hover:        #ffffff;
  --ftr-radius:            var(--radius);
  --ftr-shadow:            var(--shadow-lg);
  --ftr-social-bg:         rgba(255,255,255,0.06);
  --ftr-text-light:        rgba(255,255,255,0.9);
  --ftr-text-muted:        rgba(255,255,255,0.5);
  --ftr-transition:        var(--transition);`;

  // Insert aliases before the closing } of :root
  css = css.replace(/(\s*)\}(\s*)$/, `${aliasBlock}\n}$2`);

  return { ...files, [key]: css };
}

// ─── Scene helpers ────────────────────────────────────────────────────────────

/**
 * Find the scene in the scene plan that corresponds to a given component type.
 * Returns null if no scene found (component will fall back to defaults).
 */
function getSceneForComponent(componentType, scenePlan) {
  if (!scenePlan?.scenes?.length) return null;
  return scenePlan.scenes.find(s => s.componentType === componentType) || null;
}

/**
 * Build a scene context block to inject into a component prompt.
 * Gives each component its cinematic "scene brief" — goal, mood, twist.
 */
function buildSceneBlock(scene) {
  if (!scene) return '';
  return `
🎬 YOUR SCENE:
Goal: ${scene.goal}
Layout: ${scene.layout}
Visual hook: ${scene.visualHook}
Density: ${scene.density} | Background: ${scene.background}
Interaction: ${scene.interaction}
Creative twist — IMPLEMENT THIS: "${scene.twist}"`;
}

// ─── Post-generation design validator ────────────────────────────────────────
// Scores the generated output 0–10 and flags issues that suggest template-like
// or broken output. Used to surface warnings in the progress log.

function evaluateDesign(files, tokens, scenePlan) {
  const issues = [];
  let score = 10;

  // Check 1: global.css must have substantial component CSS
  const globalCss = files['src/styles/global.css'] || '';
  if (globalCss.length < 800) {
    issues.push('CSS appears minimal — styles may not have been extracted from components');
    score -= 2;
  }

  // Check 2: All scene components should appear in Home page
  const homeContent = Object.entries(files).find(([k]) => k.includes('Home'))?.[1] || '';
  const sceneComponents = (scenePlan?.scenes || []).map(s => s.componentType);
  const missingInHome = sceneComponents.filter(c => homeContent && !homeContent.includes(c));
  if (missingInHome.length > 0) {
    issues.push(`Home page missing scene components: ${missingInHome.join(', ')}`);
    score -= missingInHome.length;
  }

  // Check 3: Hero component must exist and have real content
  const heroContent = Object.entries(files).find(([k]) => k.includes('Hero.'))?.[1] || '';
  if (heroContent.length < 400) {
    issues.push('Hero component appears incomplete or was stubbed');
    score -= 3;
  }

  // Check 4: No Lorem ipsum placeholder text
  const allContent = Object.values(files).join(' ');
  if (/lorem ipsum/i.test(allContent)) {
    issues.push('Contains Lorem ipsum placeholder text — regenerate');
    score -= 2;
  }

  // Check 5: Stub components detected (generation failures)
  const stubCount = Object.values(files).filter(f =>
    typeof f === 'string' && f.includes('failed to generate')
  ).length;
  if (stubCount > 0) {
    issues.push(`${stubCount} component(s) failed to generate — showing stub placeholders`);
    score -= stubCount * 2;
  }

  // Check 6: CSS variable invention — detect variables not in the standard set or aliases
  const allowedVars = new Set([
    'primary','secondary','accent','bg','bg-secondary','bg-alt','text','text-muted','muted',
    'border','shadow','shadow-lg','shadow-xl','radius','radius-lg','radius-full','radius-pill',
    'spacing','spacing-sm','spacing-lg','spacing-xl','gradient','gradient-accent','gradient-subtle',
    'transition','transition-slow','font-heading','font-body','font-mono','font-base','container',
    'primary-rgb','accent-rgb','bg-rgb','secondary-rgb','border-rgb',
    // aliased set injected by sanitizeTokensCss
    'spacing-unit','spacing-xs','spacing-2','spacing-3','spacing-4','spacing-md','spacing-xxl','spacing-xxxl',
    'pill','pill-radius','transition-speed','transition-ease','font-size-base','letter-spacing-heading',
    'line-height-body','card','card-bg','card-shadow','card-shadow-featured',
    'ftr-bg','ftr-border','ftr-link-hover','ftr-radius','ftr-shadow','ftr-social-bg',
    'ftr-text-light','ftr-text-muted','ftr-transition',
  ]);
  const usedVars = [...globalCss.matchAll(/var\(--([a-z][a-z0-9-]*)\)/g)].map(m => m[1]);
  const unknownVars = [...new Set(usedVars.filter(v => !allowedVars.has(v)))];
  if (unknownVars.length > 3) {
    issues.push(`${unknownVars.length} potentially undefined CSS variables: ${unknownVars.slice(0, 5).join(', ')}…`);
    score -= Math.min(2, Math.floor(unknownVars.length / 4));
  }

  return {
    score:          Math.max(0, score),
    issues,
    unknownCssVars: unknownVars,
    recommendation: score < 5
      ? 'Output quality poor — consider regenerating with a stronger model'
      : score < 7
      ? 'Some issues found — review flagged components'
      : 'Design quality acceptable',
  };
}

module.exports = { generateRedesign };
