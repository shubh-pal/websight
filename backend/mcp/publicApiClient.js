const { URL } = require('url');

class PublicApiError extends Error {
  constructor(message, statusCode = null) {
    super(message);
    this.name = 'PublicApiError';
    this.statusCode = statusCode;
  }
}

function buildScrapeEndpoint(apiBaseUrl) {
  let base;
  try {
    base = new URL(apiBaseUrl);
  } catch (_) {
    throw new PublicApiError('WEBSIGHT_PUBLIC_API_BASE_URL must be an absolute HTTP(S) URL');
  }
  if (!['http:', 'https:'].includes(base.protocol)) {
    throw new PublicApiError('WEBSIGHT_PUBLIC_API_BASE_URL must use HTTP or HTTPS');
  }
  return new URL('/api/public/scrape', base).href;
}

function filenameFromDisposition(value) {
  const match = /filename="?([^";]+)"?/i.exec(value || '');
  return match?.[1] || 'websight-scrape-export.zip';
}

async function readArchive(response, maxBytes) {
  const declaredSize = Number(response.headers.get('content-length'));
  if (Number.isFinite(declaredSize) && declaredSize > maxBytes) {
    throw new PublicApiError(`Scrape export exceeds the ${maxBytes} byte MCP response limit`);
  }

  if (!response.body) throw new PublicApiError('Public scrape API returned an empty response');

  const reader = response.body.getReader();
  const chunks = [];
  let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > maxBytes) {
        await reader.cancel();
        throw new PublicApiError(`Scrape export exceeds the ${maxBytes} byte MCP response limit`);
      }
      chunks.push(Buffer.from(value));
    }
  } finally {
    reader.releaseLock();
  }
  return Buffer.concat(chunks, total);
}

async function fetchScrapeExport({ url, apiBaseUrl, timeoutMs, maxZipBytes }) {
  const endpoint = buildScrapeEndpoint(apiBaseUrl);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/zip, application/json' },
      body: JSON.stringify({ url }),
      signal: controller.signal,
    });

    if (!response.ok) {
      const body = await response.text();
      let message = `Public scrape API returned HTTP ${response.status}`;
      try {
        const parsed = JSON.parse(body);
        if (typeof parsed.error === 'string') message = parsed.error;
      } catch (_) {}
      throw new PublicApiError(message, response.status);
    }

    const contentType = response.headers.get('content-type') || '';
    if (!contentType.toLowerCase().includes('application/zip')) {
      throw new PublicApiError('Public scrape API returned a non-ZIP success response');
    }

    return {
      archive: await readArchive(response, maxZipBytes),
      filename: filenameFromDisposition(response.headers.get('content-disposition')),
      sourceEndpoint: endpoint,
    };
  } catch (err) {
    if (err.name === 'AbortError') {
      throw new PublicApiError(`Public scrape API exceeded the ${timeoutMs}ms timeout`);
    }
    if (err instanceof PublicApiError) throw err;
    throw new PublicApiError(`Unable to reach public scrape API: ${err.message}`);
  } finally {
    clearTimeout(timeout);
  }
}

module.exports = { PublicApiError, buildScrapeEndpoint, fetchScrapeExport };
