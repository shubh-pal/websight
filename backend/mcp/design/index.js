require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });

const cors = require('cors');
const { createMcpExpressApp } = require('@modelcontextprotocol/sdk/server/express.js');
const { StreamableHTTPServerTransport } = require('@modelcontextprotocol/sdk/server/streamableHttp.js');
const { createDesignMcpServer } = require('./server');

function boundedInteger(value, fallback, min, max) {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed >= min && parsed <= max ? parsed : fallback;
}

const host = process.env.MCP_DESIGN_HOST || '127.0.0.1';
// MCP_DESIGN_PORT wins when explicitly set (local dev, where PORT in the
// same .env is the *main app's* port, not this one). Cloud Run never sets
// MCP_DESIGN_PORT for this service, so it falls through to PORT — the
// listening contract Cloud Run actually injects and expects.
const port = boundedInteger(process.env.MCP_DESIGN_PORT || process.env.PORT, 3003, 1, 65535);
const token = process.env.MCP_DESIGN_TOKEN;
const allowedHosts = (process.env.MCP_DESIGN_ALLOWED_HOSTS || '')
  .split(',').map((v) => v.trim()).filter(Boolean);

if (!token) {
  console.error('[mcp-design] MCP_DESIGN_TOKEN is not set. Refusing to start an unauthenticated');
  console.error('[mcp-design] MCP server with write access to lead data. Set it in backend/.env.');
  process.exit(1);
}

const app = createMcpExpressApp({ host, allowedHosts: allowedHosts.length ? allowedHosts : undefined });
app.use(cors({ origin: process.env.MCP_DESIGN_CORS_ORIGIN || false, methods: ['POST', 'OPTIONS'], credentials: false }));

function requireToken(req, res, next) {
  const header = req.get('Authorization') || '';
  const bearer = header.startsWith('Bearer ') ? header.slice(7) : null;
  const provided = bearer || req.get('X-MCP-Token');
  if (provided !== token) {
    return res.status(401).json({ jsonrpc: '2.0', error: { code: -32001, message: 'Unauthorized' }, id: null });
  }
  next();
}

app.get('/health', (_, res) => res.json({ status: 'ok', transport: 'streamable-http' }));

app.post('/mcp', requireToken, async (req, res) => {
  const server = createDesignMcpServer();
  const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
  try {
    await server.connect(transport);
    await transport.handleRequest(req, res, req.body);
    res.on('close', () => {
      transport.close().catch(() => {});
      server.close().catch(() => {});
    });
  } catch (err) {
    console.error('[mcp-design] Request failed:', err.message);
    if (!res.headersSent) {
      res.status(500).json({ jsonrpc: '2.0', error: { code: -32603, message: 'Internal MCP server error' }, id: null });
    }
  }
});

app.all('/mcp', (_, res) => {
  res.status(405).json({ jsonrpc: '2.0', error: { code: -32000, message: 'Method not allowed' }, id: null });
});

app.listen(port, host, () => {
  console.log(`[mcp-design] Design MCP listening at http://${host}:${port}/mcp (bearer token required)`);
});
