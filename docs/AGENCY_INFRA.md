# Agency pipeline — provisioned infrastructure

GCP project **`sunlit-cyclist-497019-i3`** (number `947669951938`), created 2026-09-04.

## APIs enabled

| API | Purpose |
|---|---|
| `places.googleapis.com` | discovery (Text Search New) — was already on |
| `pagespeedonline.googleapis.com` | website audit (Lighthouse scores) |
| `billingbudgets.googleapis.com` | cost alerts |

## API key

- Display name **`websight-leadgen`**, uid `54b9de6d-32ef-4e41-8410-01fae8e11188`
- Restricted to `places.googleapis.com` + `pagespeedonline.googleapis.com` only
- Value lives in `backend/.env` as `GOOGLE_API_KEY` (and belongs in Secret Manager for Cloud Run)
- Rotate: `gcloud services api-keys create ...` then delete the old uid

## GCS bucket

- **`gs://websight-leadgen`** — region `us-central1`, uniform bucket-level access,
  **public access prevention: enforced**
- Holds `companies/<lead_id>/scrape/…`, `…/mockup.png`, `…/proposal.pdf`
- `backend/.env` → `GCS_BUCKET=websight-leadgen`
- Dashboard reads assets by streaming them through `GET /api/app/leadgen/leads/:id/asset`
  (no signed URLs — works with plain ADC). If you later want direct signed URLs,
  grant the Cloud Run runtime SA `roles/iam.serviceAccountTokenCreator` on itself.

## Cost guardrails

| Guard | Setting |
|---|---|
| Places `SearchTextRequest` per-day | **200 / day** (hard cap; default was 75,000) |
| Places `SearchTextRequest` per-minute | **60 / min** (default 600) |
| Billing budget `websight-leadgen-guard` | **₹2000 / month** scoped to this project, email alerts at 50 / 90 / 100 % |
| App-level tick limits | `TICK_SCRAPE_LIMIT=5`, `TICK_AUDIT_LIMIT=10` per tick |

One default-grid discovery sweep ≈ 30 queries ≈ 30–90 Places calls, so the
200/day cap allows ~2–3 full sweeps per day. Raise it with:

```bash
gcloud alpha services quota update --service=places.googleapis.com \
  --consumer=projects/sunlit-cyclist-497019-i3 \
  --metric=places.googleapis.com/SearchTextRequest --unit="1/d/{project}" --value=<N> --force
```

## Design MCP (Phase D — no gpt-image-1, no per-image API cost)

`backend/mcp/design/` — a second, **authenticated** MCP server (separate from the
public scrape MCP) exposing:

- `list_pending_designs` — leads approved and waiting on a redesign image (status `building_pdf`)
- `get_design_brief(leadId)` — business info, audit findings, the scraped design system, the
  current screenshot (embedded image), and a ready-to-use art-direction prompt
- `submit_design(leadId, imageBase64, filename)` — uploads the mockup, flips the lead to
  `ui_generated`, and **automatically builds + queues the pitch PDF** (Puppeteer only, $0 cost)

It does not call any image API and does not automate the ChatGPT web app — it's a plain data
hand-off. Point any MCP-capable client at it (an agent session with an image tool, a scheduled
Claude Code routine, etc.) or use it as a structured checklist for manual work: pull the brief,
generate the image with whatever you already have (ChatGPT Plus app, etc.), then upload it either
through this MCP or straight from the dashboard (Lead detail → Assets → Redesign mockup → Upload).

Run it: `cd backend && npm run mcp:design:dev` — listens on `127.0.0.1:3003/mcp`, requires
`MCP_DESIGN_TOKEN` (generated into `backend/.env`) as a `Bearer` header. Refuses to start without
the token set.

## Local dev notes

- `backend/.env` (gitignored) carries `DATABASE_URL` (Supabase **session pooler**,
  `aws-0-ap-northeast-2.pooler.supabase.com:5432` — the direct `db.<ref>.supabase.co`
  host is IPv6-only and does not resolve locally), `GOOGLE_API_KEY`, `GCS_BUCKET`,
  `CRON_SECRET`, plus the keys copied from `env.yaml`.
- GCS uses Application Default Credentials: `gcloud auth application-default login`.
- Puppeteer needs a browser: `cd backend && npx puppeteer browsers install chrome`.
