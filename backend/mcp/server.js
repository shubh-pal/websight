const crypto = require('crypto');
const { McpServer } = require('@modelcontextprotocol/sdk/server/mcp.js');
const z = require('zod/v4');
const { assertSafePublicUrl } = require('../services/publicUrlSafety');
const { fetchScrapeExport, PublicApiError } = require('./publicApiClient');

function createWebsightMcpServer(config) {
  const server = new McpServer({
    name: 'websight-public-scrape',
    version: '1.0.0',
  }, {
    capabilities: { tools: {} },
    instructions: 'Use scrape_website_export to receive a ZIP export of a public website. The archive is returned as an embedded binary MCP resource.',
  });

  server.registerTool('scrape_website_export', {
    title: 'Scrape Website Export',
    description: 'Scrape one public website and return the WebSight ZIP export with page content, visual tokens, design-system analysis, asset metadata, and a screenshot when rendering succeeds.',
    inputSchema: {
      url: z.string().min(1).max(2048).describe('Public HTTP(S) website URL to scrape.'),
    },
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      openWorldHint: true,
    },
  }, async ({ url }) => {
    let safeUrl;
    try {
      safeUrl = await assertSafePublicUrl(url);
    } catch (err) {
      return {
        isError: true,
        content: [{ type: 'text', text: `Invalid website URL: ${err.message}` }],
      };
    }

    try {
      const result = await fetchScrapeExport({
        url: safeUrl.href,
        apiBaseUrl: config.apiBaseUrl,
        timeoutMs: config.timeoutMs,
        maxZipBytes: config.maxZipBytes,
      });
      const resourceUri = `websight://scrape-exports/${crypto.randomUUID()}/${encodeURIComponent(result.filename)}`;
      const summary = {
        url: safeUrl.href,
        filename: result.filename,
        bytes: result.archive.byteLength,
        mimeType: 'application/zip',
        delivery: 'embedded MCP binary resource',
      };

      return {
        content: [
          { type: 'text', text: JSON.stringify(summary, null, 2) },
          {
            type: 'resource',
            resource: {
              uri: resourceUri,
              mimeType: 'application/zip',
              blob: result.archive.toString('base64'),
            },
          },
        ],
      };
    } catch (err) {
      const message = err instanceof PublicApiError ? err.message : 'Unexpected MCP scrape failure';
      return {
        isError: true,
        content: [{ type: 'text', text: `WebSight scrape export failed: ${message}` }],
      };
    }
  });

  return server;
}

module.exports = { createWebsightMcpServer };
