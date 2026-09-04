require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const cors = require('cors');
const { createMcpExpressApp } = require('@modelcontextprotocol/sdk/server/express.js');
const { StreamableHTTPServerTransport } = require('@modelcontextprotocol/sdk/server/streamableHttp.js');
const { createWebsightMcpServer } = require('./server');

function boundedInteger(value, fallback, min, max) {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed >= min && parsed <= max ? parsed : fallback;
}

const host = process.env.MCP_HOST || '127.0.0.1';
const port = boundedInteger(process.env.MCP_PORT, 3002, 1, 65535);
const allowedHosts = (process.env.MCP_ALLOWED_HOSTS || '')
  .split(',').map(value => value.trim()).filter(Boolean);
const config = {
  apiBaseUrl: process.env.WEBSIGHT_PUBLIC_API_BASE_URL || 'http://127.0.0.1:3001',
  timeoutMs: boundedInteger(process.env.MCP_SCRAPE_TIMEOUT_MS, 330000, 1000, 600000),
  maxZipBytes: boundedInteger(process.env.MCP_MAX_ZIP_BYTES, 15 * 1024 * 1024, 1024, 50 * 1024 * 1024),
};

const app = createMcpExpressApp({ host, allowedHosts: allowedHosts.length ? allowedHosts : undefined });
app.use(cors({
  origin: process.env.MCP_CORS_ORIGIN || '*',
  methods: ['POST', 'OPTIONS'],
  credentials: false,
}));

app.get('/health', (_, res) => {
  res.json({ status: 'ok', transport: 'streamable-http', apiBaseUrl: config.apiBaseUrl });
});

app.post('/mcp', async (req, res) => {
  const server = createWebsightMcpServer(config);
  const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });

  try {
    await server.connect(transport);
    await transport.handleRequest(req, res, req.body);
    res.on('close', () => {
      transport.close().catch(() => {});
      server.close().catch(() => {});
    });
  } catch (err) {
    console.error('[mcp] Request failed:', err.message);
    if (!res.headersSent) {
      res.status(500).json({
        jsonrpc: '2.0',
        error: { code: -32603, message: 'Internal MCP server error' },
        id: null,
      });
    }
  }
});

app.all('/mcp', (_, res) => {
  res.status(405).json({ jsonrpc: '2.0', error: { code: -32000, message: 'Method not allowed' }, id: null });
});

app.listen(port, host, () => {
  console.log(`[mcp] WebSight MCP server listening at http://${host}:${port}/mcp`);
  console.log(`[mcp] Public scrape API: ${config.apiBaseUrl}`);
});
