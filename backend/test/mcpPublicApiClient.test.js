const http = require('node:http');
const test = require('node:test');
const assert = require('node:assert/strict');
const { buildScrapeEndpoint, fetchScrapeExport, PublicApiError } = require('../mcp/publicApiClient');

async function withServer(handler, run) {
  const server = http.createServer(handler);
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address();
  try {
    await run(`http://127.0.0.1:${port}`);
  } finally {
    await new Promise(resolve => server.close(resolve));
  }
}

test('builds the public scrape endpoint from a base URL', () => {
  assert.equal(buildScrapeEndpoint('https://websight.example/custom/path'), 'https://websight.example/api/public/scrape');
  assert.throws(() => buildScrapeEndpoint('file:///tmp'), PublicApiError);
});

test('returns an archive from the public scrape API', async () => {
  await withServer((req, res) => {
    assert.equal(req.url, '/api/public/scrape');
    assert.equal(req.method, 'POST');
    res.writeHead(200, {
      'Content-Type': 'application/zip',
      'Content-Disposition': 'attachment; filename="site-scrape.zip"',
    });
    res.end(Buffer.from('zip-content'));
  }, async apiBaseUrl => {
    const result = await fetchScrapeExport({
      url: 'https://example.com', apiBaseUrl, timeoutMs: 1000, maxZipBytes: 1024,
    });
    assert.equal(result.filename, 'site-scrape.zip');
    assert.equal(result.archive.toString(), 'zip-content');
  });
});

test('surfaces public API errors and rejects oversized archives', async () => {
  let requestCount = 0;
  await withServer((req, res) => {
    requestCount += 1;
    if (requestCount === 1) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'url must be public' }));
      return;
    }
    res.writeHead(200, { 'Content-Type': 'application/zip', 'Content-Length': '2048' });
    res.end(Buffer.alloc(2048));
  }, async apiBaseUrl => {
    await assert.rejects(
      fetchScrapeExport({ url: 'https://example.com', apiBaseUrl, timeoutMs: 1000, maxZipBytes: 1024 }),
      /url must be public/
    );
    await assert.rejects(
      fetchScrapeExport({ url: 'https://example.com', apiBaseUrl, timeoutMs: 1000, maxZipBytes: 1024 }),
      /exceeds the 1024 byte/
    );
  });
});
