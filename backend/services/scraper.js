const cheerio = require('cheerio');
const puppeteer = require('puppeteer');

/**
 * Scrape a URL. PRIORITIZES SPEED. 
 * Fetches basic data immediately, then tries Puppeteer for 8s to get rich styles.
 */
async function scrapeURL(url, onProgress = () => {}) {
  console.log(`[scraper] Starting scrape for: ${url}`);
  onProgress('Starting fast-fetch analysis…');

  let data;
  try {
    data = await scrapeWithFetch(url);
    onProgress('Structure analyzed. Augmenting with design tokens…');
  } catch (err) {
    console.warn(`[scraper] Initial fetch failed: ${err.message}`);
    onProgress('Fetch failed, attempting browser render…');
  }

  try {
    const browserData = await Promise.race([
      scrapeWithPuppeteer(url, onProgress),
      new Promise((_, reject) => setTimeout(() => reject(new Error('Browser timed out')), 8000))
    ]);
    
    if (data) {
      data.colors  = browserData.colors.length > 0 ? browserData.colors : data.colors;
      data.fonts   = browserData.fonts.length  > 0 ? browserData.fonts  : data.fonts;
      data.cssVars = browserData.cssVars;
      // Prefer Puppeteer logo (fully-resolved absolute URL); fall back to cheerio result
      data.logoUrl = browserData.logoUrl || data.logoUrl || '';
      data.source  = 'hybrid';
    } else {
      data = browserData;
    }
  } catch (err) {
    console.warn(`[scraper] Augmentation failed: ${err.message}`);
    onProgress('Bypassing full render (site restricted browser analysis).');
    if (!data) throw new Error(`Scraper failed: ${err.message}`);
  }

  return data;
}

async function scrapeWithPuppeteer(url, onProgress = () => {}) {
  let browser;
  try {
    onProgress('Rendering page for design analysis…');
    browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu'],
    });
    
    const page = await browser.newPage();
    await page.setViewport({ width: 1440, height: 900 });
    await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
    
    console.log(`[scraper] Navigating to ${url}...`);
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 15000 });
    
    onProgress('Extracting visual tokens…');

    const data = await page.evaluate(() => {
      // --- Collect colors from computed styles (sampled) ---
      const colorMap = new Map(); // color -> frequency
      const fontSet = new Set();
      const elements = [...document.querySelectorAll('*')].slice(0, 400);
      elements.forEach(el => {
        const s = window.getComputedStyle(el);
        [s.color, s.backgroundColor, s.borderColor, s.outlineColor].forEach(c => {
          if (c && c !== 'rgba(0, 0, 0, 0)' && c !== 'transparent' && c !== 'rgba(0,0,0,0)') {
            colorMap.set(c, (colorMap.get(c) || 0) + 1);
          }
        });
        // Also grab background-image gradients
        if (s.backgroundImage && s.backgroundImage.includes('gradient')) {
          const matches = s.backgroundImage.match(/#[0-9a-fA-F]{3,8}/g) || [];
          matches.forEach(hex => colorMap.set(hex, (colorMap.get(hex) || 0) + 2));
        }
        const font = s.fontFamily?.split(',')[0].trim().replace(/['"]/g, '');
        if (font && font !== 'system-ui' && font !== 'inherit' && font !== '-apple-system') fontSet.add(font);
      });
      // Sort by frequency, highest first
      const colors = [...colorMap.entries()]
        .sort((a, b) => b[1] - a[1])
        .map(([c]) => c)
        .slice(0, 30);

      // --- Nav links ---
      const navLinks = [];
      document.querySelectorAll('nav a, header a, [role="navigation"] a').forEach(a => {
        const text = a.textContent.trim();
        const href = a.getAttribute('href');
        if (text && href && text.length < 30 && !navLinks.find(n => n.text === text)) {
          navLinks.push({ text, href });
        }
      });

      // --- Page sections ---
      const sections = [];
      document.querySelectorAll('section, main > *, article, [class*="section"]').forEach((s, i) => {
        if (i >= 15) return;
        sections.push({
          tag: s.tagName.toLowerCase(),
          id: s.id || null,
          className: [...s.classList].slice(0, 3).join(' ') || null,
          headingText: s.querySelector('h1,h2,h3')?.textContent.trim().slice(0, 100) || null,
          textSnippet: s.innerText?.trim().slice(0, 300) || null,
        });
      });

      // --- CSS custom properties ---
      const cssVars = {};
      try {
        for (const sheet of document.styleSheets) {
          try {
            for (const rule of sheet.cssRules || []) {
              if (rule.selectorText === ':root') {
                for (const prop of rule.style) {
                  if (prop.startsWith('--')) {
                    cssVars[prop] = rule.style.getPropertyValue(prop).trim();
                  }
                }
              }
            }
          } catch (_) {} // cross-origin stylesheets
        }
      } catch (_) {}

      // --- All headings text ---
      const headings = [...document.querySelectorAll('h1,h2,h3,h4')].slice(0, 15).map(h => ({
        level: h.tagName,
        text: h.textContent.trim().slice(0, 120),
      }));

      // --- Key feature/benefit text (paragraphs under headings) ---
      const keyParagraphs = [...document.querySelectorAll('h2 + p, h3 + p, .hero p, [class*="hero"] p')]
        .slice(0, 6)
        .map(p => p.textContent.trim().slice(0, 200));

      // --- Logo detection (priority-ordered) ---
      let logoUrl = '';
      const resolveUrl = (src) => {
        if (!src) return '';
        try { return new URL(src, window.location.href).href; } catch (_) { return src; }
      };

      // P1: img inside header/nav with logo-hinting class or alt
      const logoSelectors = [
        'header img[class*="logo" i]', 'header img[alt*="logo" i]',
        'nav img[class*="logo" i]',    'nav img[alt*="logo" i]',
        '[class*="navbar"] img[class*="logo" i]', '[class*="header"] img[class*="logo" i]',
        '[class*="logo"] img', 'img[class*="logo" i]',
      ];
      for (const sel of logoSelectors) {
        const el = document.querySelector(sel);
        if (el?.src) { logoUrl = el.src; break; }
      }
      // P2: first img inside a nav/header anchor (common logo link pattern)
      if (!logoUrl) {
        const navImg = document.querySelector('header a img, nav a img');
        if (navImg?.src && !navImg.src.endsWith('.svg') === false || navImg?.src) logoUrl = navImg?.src || '';
      }
      // P3: any img whose src contains "logo"
      if (!logoUrl) {
        const srcLogo = document.querySelector('img[src*="logo" i]');
        if (srcLogo?.src) logoUrl = srcLogo.src;
      }
      // P4: apple-touch-icon (high-res, good quality)
      if (!logoUrl) {
        const touch = document.querySelector('link[rel="apple-touch-icon"]');
        if (touch) logoUrl = resolveUrl(touch.getAttribute('href'));
      }
      // P5: SVG favicon
      if (!logoUrl) {
        const svgIcon = document.querySelector('link[rel="icon"][type="image/svg+xml"]');
        if (svgIcon) logoUrl = resolveUrl(svgIcon.getAttribute('href'));
      }
      // P6: any favicon (last resort)
      if (!logoUrl) {
        const fav = document.querySelector('link[rel~="icon"]');
        if (fav) logoUrl = resolveUrl(fav.getAttribute('href'));
      }

      return {
        title: document.title,
        description: document.querySelector('meta[name="description"]')?.content || '',
        ogImage: document.querySelector('meta[property="og:image"]')?.content || '',
        logoUrl,
        colors,
        fonts: [...fontSet].slice(0, 8),
        navLinks: navLinks.slice(0, 15),
        sections,
        headings,
        keyParagraphs,
        cssVars,
        bodyHTML: document.body.innerHTML.slice(0, 12000),
      };
    });

    return { ...data, url, source: 'puppeteer' };
  } finally {
    if (browser) {
      browser.close().catch(() => {});
    }
  }
}

async function scrapeWithFetch(url) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 25000);
  
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml',
      },
    });
    const html = await res.text();
    return parseSiteData(url, html);
  } finally {
    clearTimeout(timeoutId);
  }
}

function resolveLogoUrl(base, src) {
  if (!src) return '';
  try { return new URL(src, base).href; } catch (_) { return src; }
}

function parseSiteData(url, html) {
  const $ = cheerio.load(html);

  // --- Logo extraction ---
  let logoUrl = '';
  const logoAttrSelectors = [
    'header img[class*="logo" i]', 'header img[alt*="logo" i]',
    'nav img[class*="logo" i]',    'nav img[alt*="logo" i]',
    '[class*="logo"] img',         'img[class*="logo" i]',
    'img[src*="logo" i]',
  ];
  for (const sel of logoAttrSelectors) {
    const src = $(sel).first().attr('src');
    if (src) { logoUrl = resolveLogoUrl(url, src); break; }
  }
  // Fallback: first img inside a nav/header link
  if (!logoUrl) {
    const src = $('header a img, nav a img').first().attr('src');
    if (src) logoUrl = resolveLogoUrl(url, src);
  }
  // Fallback: apple-touch-icon
  if (!logoUrl) {
    const href = $('link[rel="apple-touch-icon"]').attr('href');
    if (href) logoUrl = resolveLogoUrl(url, href);
  }
  // Fallback: SVG favicon
  if (!logoUrl) {
    const href = $('link[rel="icon"][type="image/svg+xml"]').attr('href');
    if (href) logoUrl = resolveLogoUrl(url, href);
  }
  // Fallback: any favicon
  if (!logoUrl) {
    const href = $('link[rel~="icon"]').first().attr('href');
    if (href) logoUrl = resolveLogoUrl(url, href);
  }

  const navLinks = [];
  $('nav a, header a').each((_, el) => {
    const text = $(el).text().trim();
    const href = $(el).attr('href');
    if (text && href && !navLinks.find(n => n.text === text)) {
      navLinks.push({ text, href });
    }
  });

  const sections = [];
  $('section, main > div, article').each((i, el) => {
    if (i >= 10) return;
    sections.push({
      tag: el.tagName,
      id: $(el).attr('id') || null,
      className: $(el).attr('class')?.split(' ').slice(0, 3).join(' ') || null,
      headingText: $(el).find('h1,h2,h3').first().text().trim().slice(0, 80) || null,
      textSnippet: $(el).text().trim().slice(0, 200),
    });
  });

  const headings = [];
  $('h1,h2,h3').slice(0, 10).each((_, el) => {
    headings.push({ level: el.tagName, text: $(el).text().trim().slice(0, 100) });
  });

  return {
    url,
    title: $('title').text(),
    description: $('meta[name="description"]').attr('content') || '',
    logoUrl,
    fonts: [],
    colors: [],
    navLinks: navLinks.slice(0, 12),
    sections,
    headings,
    cssVars: {},
    bodyHTML: $('body').html()?.slice(0, 10000) || '',
    source: 'fetch',
  };
}

module.exports = { scrapeURL, parseSiteData };
