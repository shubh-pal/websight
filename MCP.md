# WebSight Public MCP Server

`backend/mcp/` provides a local, standards-compatible MCP server for the existing public scrape export API. It does not scrape websites itself. The server validates a requested public URL, calls `POST /api/public/scrape`, and returns the resulting ZIP as an embedded `application/zip` MCP resource.

## Run Locally

Install backend dependencies, start the WebSight API, then start the MCP server in a second terminal:

```bash
cd backend
npm install
npm run dev
```

```bash
cd backend
npm run mcp:dev
```

The MCP endpoint is `http://127.0.0.1:3002/mcp`. It uses stateless Streamable HTTP, so MCP clients can connect without a session store. `GET /health` is a local health check.

To point the MCP server at a different WebSight API without changing code:

```bash
WEBSIGHT_PUBLIC_API_BASE_URL=https://your-websight-api.example \
MCP_PORT=3002 \
npm run mcp:start
```

## Tool

`scrape_website_export`

Input:

```json
{ "url": "https://example.com" }
```

The successful tool result includes a short JSON summary and an embedded MCP resource with `mimeType: "application/zip"` and a base64 `blob`. The ZIP is the same export produced by the public API: manifest, captured page content, scraped data, design-system analysis, asset metadata, and an original screenshot when browser rendering succeeds.

## Configuration

| Variable | Default | Purpose |
| --- | --- | --- |
| `MCP_HOST` | `127.0.0.1` | Bind address. Keep the local default for development. |
| `MCP_PORT` | `3002` | MCP HTTP port. |
| `WEBSIGHT_PUBLIC_API_BASE_URL` | `http://127.0.0.1:3001` | Base URL of the existing public scrape API. |
| `MCP_SCRAPE_TIMEOUT_MS` | `330000` | Upstream scrape request timeout, bounded to 1-600 seconds. |
| `MCP_MAX_ZIP_BYTES` | `15728640` | Maximum ZIP size embedded in an MCP tool result, bounded to 1-50 MiB. |
| `MCP_CORS_ORIGIN` | `*` | CORS origin for this unauthenticated development server. |
| `MCP_ALLOWED_HOSTS` | unset | Comma-separated host header allowlist required when binding beyond localhost. |

## Test

```bash
cd backend
npm run mcp:test
```

## Assumptions Before Deployment

- Transport: Streamable HTTP in stateless mode is used because this is intended to become a remote/public MCP endpoint. No legacy SSE transport or session persistence is required for its single tool.
- API base URL: local development targets `http://127.0.0.1:3001`; a later hosted MCP deployment must set `WEBSIGHT_PUBLIC_API_BASE_URL` to the deployed WebSight API origin.
- ZIP delivery: binary archives are returned as embedded base64 MCP resources. This is convenient for MCP clients that support binary resources, but expands payload size. The size cap must be tuned to the chosen host and client limits.
- Public access: this initial version intentionally has no authentication. It inherits the public API's anonymous rate limit but adds no separate distributed rate limit. A production deployment should place the MCP server behind edge rate limiting/WAF controls and consider an API key or OAuth.
- CORS and hosting: localhost gets SDK-provided DNS rebinding protection. A public bind must set `MCP_ALLOWED_HOSTS`, use HTTPS behind a trusted proxy, and configure CORS for the actual MCP clients rather than leaving a permissive wildcard by default.
- Scraping safety: the upstream public API enforces URL and private-network protections. The MCP server validates the same requested URL before forwarding, but outbound network policy is still required in production.
- Deployment decisions: confirm the public MCP hostname, hosting target, client payload limits, authentication policy, proxy/host-header configuration, and observability before exposing this server publicly.
