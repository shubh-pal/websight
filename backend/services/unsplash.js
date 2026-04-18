const UNSPLASH_API_BASE = 'https://api.unsplash.com';

function isEnabled() {
  return Boolean(process.env.UNSPLASH_ACCESS_KEY);
}

function buildReferralUrl(url) {
  if (!url) return null;
  const joiner = url.includes('?') ? '&' : '?';
  const source = encodeURIComponent(process.env.UNSPLASH_APP_NAME || 'websight');
  return `${url}${joiner}utm_source=${source}&utm_medium=referral`;
}

function normalizePhoto(photo) {
  return {
    id: photo.id,
    alt: photo.alt_description || photo.description || 'Unsplash photo',
    color: photo.color || null,
    width: photo.width || null,
    height: photo.height || null,
    description: photo.description || photo.alt_description || '',
    urls: {
      raw: photo.urls?.raw || null,
      full: photo.urls?.full || null,
      regular: photo.urls?.regular || null,
      small: photo.urls?.small || null,
      thumb: photo.urls?.thumb || null,
    },
    links: {
      html: buildReferralUrl(photo.links?.html),
      downloadLocation: photo.links?.download_location || null,
    },
    user: {
      name: photo.user?.name || 'Unsplash photographer',
      username: photo.user?.username || null,
      profile: buildReferralUrl(photo.user?.links?.html || (photo.user?.username ? `https://unsplash.com/@${photo.user.username}` : null)),
    },
    attribution: photo.user?.name && photo.user?.username
      ? `Photo by ${photo.user.name} on Unsplash`
      : 'Photo from Unsplash',
  };
}

async function unsplashFetch(pathname, params = {}) {
  const accessKey = process.env.UNSPLASH_ACCESS_KEY;
  if (!accessKey) throw new Error('UNSPLASH_ACCESS_KEY is not set');

  const url = new URL(`${UNSPLASH_API_BASE}${pathname}`);
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') url.searchParams.set(key, String(value));
  });

  const res = await fetch(url, {
    headers: {
      Authorization: `Client-ID ${accessKey}`,
      'Accept-Version': 'v1',
    },
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Unsplash API error ${res.status}: ${body || res.statusText}`);
  }

  return res.json();
}

async function searchPhotos(query, options = {}) {
  const {
    page = 1,
    perPage = 6,
    orientation = 'landscape',
  } = options;

  const data = await unsplashFetch('/search/photos', {
    query,
    page,
    per_page: perPage,
    orientation,
    content_filter: 'high',
  });

  return {
    total: data.total || 0,
    totalPages: data.total_pages || 0,
    results: Array.isArray(data.results) ? data.results.map(normalizePhoto) : [],
  };
}

async function trackDownload(downloadLocation) {
  if (!downloadLocation || !isEnabled()) return false;

  const url = new URL(downloadLocation);
  const res = await fetch(url, {
    headers: {
      Authorization: `Client-ID ${process.env.UNSPLASH_ACCESS_KEY}`,
      'Accept-Version': 'v1',
    },
  });

  return res.ok;
}

function buildImageQueries(siteData = {}, tokens = {}) {
  const base = [];
  const siteType = tokens.siteType || 'business';
  const audience = tokens.targetAudience || '';
  const title = siteData.title || tokens.brandName || '';
  const headings = (siteData.headings || []).slice(0, 3).map((h) => String(h).trim()).filter(Boolean);

  if (title) base.push(`${title} ${siteType}`.trim());
  if (audience) base.push(`${audience} ${siteType}`.trim());
  base.push(...headings.map((h) => `${h} ${siteType}`.trim()));

  const fallbackByType = {
    saas: ['software team collaboration', 'developer workspace', 'modern office technology'],
    corporate: ['corporate boardroom', 'business meeting', 'professional office'],
    agency: ['creative team studio', 'design workshop', 'brand presentation'],
    'e-commerce': ['premium product photography', 'shopping experience', 'modern retail'],
    portfolio: ['creative workspace', 'designer desk setup', 'art direction studio'],
    blog: ['editorial workspace', 'writer desk', 'magazine layout'],
    other: ['professional workspace', 'modern architecture', 'team collaboration'],
  };

  base.push(...(fallbackByType[siteType] || fallbackByType.other));

  return [...new Set(base.map((q) => q.replace(/\s+/g, ' ').trim()).filter(Boolean))].slice(0, 5);
}

async function getImageLibrary(siteData = {}, tokens = {}) {
  if (!isEnabled()) return { queries: [], photos: [], promptBlock: '' };

  const queries = buildImageQueries(siteData, tokens);
  const photos = [];
  const seen = new Set();

  for (const query of queries) {
    try {
      const result = await searchPhotos(query, { perPage: 3 });
      for (const photo of result.results) {
        if (seen.has(photo.id)) continue;
        seen.add(photo.id);
        photos.push(photo);
        if (photos.length >= 6) break;
      }
      if (photos.length >= 6) break;
    } catch (_) {
      // ignore individual query failures
    }
  }

  if (photos.length === 0) return { queries, photos, promptBlock: '' };

  const promptBlock = `
UNSPLASH IMAGES AVAILABLE:
- You MAY use these exact hotlinked image URLs in <img> tags or CSS backgrounds.
- If you use one, include visible attribution text nearby using the provided photographer + Unsplash links.
- Prefer 1-2 images total. Only use them where they materially improve the layout.

${photos.map((photo, index) => (
`${index + 1}. "${photo.alt}"
   image: ${photo.urls.regular}
   photographer: ${photo.user.name}
   photographerLink: ${photo.user.profile}
   unsplashLink: ${photo.links.html}
   attributionText: ${photo.attribution}`
)).join('\n\n')}`.trim();

  return { queries, photos, promptBlock };
}

module.exports = {
  isEnabled,
  searchPhotos,
  trackDownload,
  getImageLibrary,
};
