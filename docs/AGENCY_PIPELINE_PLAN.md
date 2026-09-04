# WebSight Agency Pipeline — Plan

An internal lead-gen → redesign-proposal → outreach pipeline, built **on top of**
the existing `websight-app` Cloud Run service without touching any public /
user-facing view.

Everything new lives under:

- **Frontend:** `/app/*` routes (new), admin-gated
- **Backend:** `/api/app/*` routers (new) + `/api/app/cron/*` + `/api/app/webhooks/*`
- **Workers:** Cloud Run **Jobs** (same Docker image, different entrypoint), triggered by Cloud Scheduler
- **DB:** new tables in the existing Supabase Postgres
- **Object storage:** new GCS bucket (findings + PDFs), **replaces the ZIP download for the internal flow only**

The public `POST /api/public/scrape` ZIP endpoint and all `/`, `/dashboard`,
`/result`, `/admin` routes stay exactly as they are.

---

## 1. Lead state machine

One row per business in a new `leads` table. `status` drives everything; a
worker/cron only ever picks up leads in a specific status, does its stage, and
advances (or moves to `error` with `error_stage`).

```
discovered
  └─(scrape worker)──► scraping ──► scraped         (findings in GCS)
        └─(audit worker)──► auditing ──► audited      (score + reasons)
              └─(qualify worker, Gemini)──► qualifying ──► qualified
                                                        └► rejected  (dead end)
                    └─(redesign, OpenAI Batch)──► redesigning ──► redesigned
                          └─(pdf worker)──► building_pdf ──► pdf_ready
                                └─(human review in /app)──► ready_to_send
                                                          └► on_hold
                                      └─(outreach cron)──► contacted
                                            └─(ESP webhook)──► replied | bounced | unsubscribed
```

Human gates: **qualification review** (audited → qualified/rejected, Gemini
proposes, you confirm) and **proposal review** (pdf_ready → ready_to_send/on_hold).
Everything else is automatic.

---

## 2. Database (Supabase Postgres — new migration)

`backend/migrations/agency_pipeline.sql`

```sql
CREATE TABLE lead_runs (              -- one discovery execution
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  grid          JSONB NOT NULL,       -- {countries, targets:[{country,cities,categories}]}
  requested_by  TEXT,
  places_calls  INTEGER DEFAULT 0,
  new_leads     INTEGER DEFAULT 0,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE leads (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id         UUID REFERENCES lead_runs(id) ON DELETE SET NULL,
  place_id       TEXT UNIQUE NOT NULL,          -- Places TOS: safe to store forever
  name           TEXT,
  country        TEXT,
  city           TEXT,
  category       TEXT,
  address        TEXT,
  phone          TEXT,
  phone_intl     TEXT,
  website        TEXT,
  rating         REAL,                          -- Places TOS: refresh within 30 days
  reviews        INTEGER,
  business_status TEXT,
  maps_uri       TEXT,
  places_refreshed_at TIMESTAMPTZ,

  status         TEXT NOT NULL DEFAULT 'discovered',
  error_stage    TEXT,
  error          TEXT,
  attempts       JSONB DEFAULT '{}'::jsonb,     -- {scrape:1, audit:0, ...}

  gcs_prefix     TEXT,                          -- companies/<id>/
  contact_email  TEXT,

  audit_score    INTEGER,                       -- 0-100 opportunity
  audit_reasons  TEXT,
  audit_signals  JSONB,                         -- {https, viewport, psi:{...}, staleYear...}

  qualify_decision   TEXT,                      -- qualified | rejected
  qualify_confidence REAL,
  qualify_value_usd  INTEGER,                   -- Gemini estimate, 200-1000
  qualify_angle      TEXT,                      -- suggested pitch angle
  qualify_raw        JSONB,

  redesign_concept   JSONB,                     -- OpenAI structured output
  mockup_gcs_key     TEXT,                      -- new-design screenshot
  proposal_gcs_key   TEXT,                      -- proposal.pdf

  hold_reason    TEXT,
  created_at     TIMESTAMPTZ DEFAULT NOW(),
  updated_at     TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX leads_status_idx ON leads(status);
CREATE INDEX leads_country_idx ON leads(country);

CREATE TABLE lead_events (            -- append-only audit log
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id    UUID REFERENCES leads(id) ON DELETE CASCADE,
  from_status TEXT,
  to_status   TEXT,
  detail      JSONB,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE outreach_messages (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id       UUID REFERENCES leads(id) ON DELETE CASCADE,
  channel       TEXT DEFAULT 'email',
  to_address    TEXT,
  subject       TEXT,
  body          TEXT,
  esp_message_id TEXT,
  status        TEXT DEFAULT 'queued', -- queued|sent|delivered|opened|replied|bounced|failed
  sent_at       TIMESTAMPTZ,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE suppressions (           -- unsubscribe / do-not-contact
  email      TEXT PRIMARY KEY,
  reason     TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

Schema is applied the same way the app already does it — add the `CREATE TABLE
IF NOT EXISTS` block to `backend/db/index.js` `ensureSchema()`, or run the
migration file once against Supabase.

---

## 3. Stage 1 — Lead gen (Places API, Node port)

New: `backend/services/places.js` — port of the Python reference in
`~/Projects/leadgen/leadgen/places.py`.

- `POST /api/app/leadgen/runs` `{ grid }` → creates a `lead_runs` row, then for
  each `(city × category)` calls Places **Text Search (New)**
  `https://places.googleapis.com/v1/places:searchText`, paginating to 60.
- Field mask kept minimal:
  `places.id,places.displayName,places.formattedAddress,places.nationalPhoneNumber,places.internationalPhoneNumber,places.websiteUri,places.rating,places.userRatingCount,places.businessStatus,places.primaryType,places.location,nextPageToken`
- Upsert into `leads` on `place_id`, status `discovered`.
- Billing guardrails: website/phone/rating fields ⇒ Enterprise SKU tier
  (~1,000 free calls/mo, 20 businesses each). Set a **daily quota cap** on the
  Places API in the Cloud console. Store `places_calls` on the run.

Key: reuse the existing `GOOGLE_API_KEY` (Places API New + PageSpeed Insights
API both enabled on it) — put it in **Secret Manager**, not `env.yaml`.

---

## 4. Stage 2 — Scrape → GCS (refactor, not rewrite)

**Requirement change:** the internal flow uploads findings to GCS per company
instead of returning a ZIP.

1. New `backend/services/gcsStorage.js` — mirror of `s3Storage.js` using
   `@google-cloud/storage` (new dep). Bucket e.g. `websight-leadgen`
   (project `sunlit-cyclist-497019-i3`, uniform access, private). On Cloud Run
   the service account auth is automatic.
2. Extract the bundle builder: `publicScrape.js` currently does
   `scrapeURL` → `getDesignSystem` → `writeScrapeBundle` → `createZip`.
   Move the first three into a shared `services/scrapeBundle.js` helper
   `buildScrapeArtifacts(url)` returning the in-memory file map.
   - Public endpoint: unchanged behaviour — calls helper, then `createZip`.
   - Internal: `scrapeLeadToGcs(lead)` — calls helper, then uploads each file to
     `companies/<lead_id>/scrape/` (`manifest.json`, `content/page.html`,
     `data/scraped-data.json`, `data/design-system.json`,
     `assets/asset-manifest.json`, `assets/original-screenshot.webp`).
3. Scrape **worker** (`workers/scrape.js`, Cloud Run Job):
   `SELECT * FROM leads WHERE status='discovered' ORDER BY created_at LIMIT N`
   → `scraping` → `scrapeLeadToGcs` → write `gcs_prefix`, `contact_email`
   (extract mailto/regex from `page.html` + `/contact`) → `scraped`.
   Failure → `error`, `error_stage='scrape'`, bump `attempts.scrape`.

Puppeteer scrape is heavy (up to 25 s) → runs in the **Job**, never in the web
service, so user traffic is unaffected.

---

## 5. Stage 3 — Audit + score

New `backend/services/leadAudit.js`. Inputs: the scraped `scraped-data.json` +
`design-system.json` already in GCS, plus a live PageSpeed Insights call.

Signals + scoring (port from `~/Projects/leadgen/leadgen/audit.py`):

| Signal | Weight |
|---|---|
| No website on listing | +60 |
| Site unreachable | +55 |
| No HTTPS | +25 |
| No mobile viewport | +28 |
| Footer copyright ≥3 / ≥6 yrs old | +12 / +22 |
| Wix / GoDaddy / Weebly / Google Sites | +10 |
| PSI performance <50 / <30 | +15 / +25 |
| PSI SEO <70 | +10 |
| PSI accessibility <70 | +8 |
| No phone AND no email | −15 |

Worker: `audited` leads get `audit_score`, `audit_reasons`, `audit_signals`.

---

## 6. Stage 3.5 — Qualification (Gemini, structured output)

New `backend/services/qualify.js` — uses the existing `aiClient` with
`gemini-2.5-flash` (or `vertex-gemini-2.5-flash`, key already present).

- **Structured output** via `responseMimeType: 'application/json'` + a zod
  schema (`zod` is already a dependency), validated on return.
- Input: name, category, city, country, rating/reviews, audit score + reasons,
  a compact extract of the scrape (title, headings, sections, current palette),
  screenshot URL.
- Output JSON:
  ```json
  {
    "decision": "qualified" | "rejected",
    "confidence": 0.0-1.0,
    "estimated_value_usd": 200-1000,
    "reasons": ["..."],
    "pitch_angle": "one sentence",
    "red_flags": ["..."]
  }
  ```
- Rejection heuristics baked into the prompt: already has a strong modern site,
  national chain, no reachable contact, non-target country, likely can't pay.
- Writes `qualify_*` columns, status → `qualifying` then `qualified` / `rejected`.

**Human gate:** `/app/qualify` shows the queue (screenshot, score, Gemini
verdict + value + angle). You Approve / Reject / Edit. Approve → `qualified`.

---

## 7. Stage 4 — Redesign concept + new-design screenshot + PDF

**Not** a full runnable project. Per qualified lead:

### 7a. OpenAI redesign concept — **Batch API**, cached prompt

- Collect all `qualified` leads into a JSONL batch (one `/v1/responses` or
  `/v1/chat/completions` request each), submit to `POST /v1/batches`
  (`completion_window: 24h`, −50 %). Poll status; ingest results file.
- **Prompt structure for ~90 % cache hit** (OpenAI auto-caches identical
  prefixes ≥1024 tokens):
  1. *(static, identical every lead)* system role, redesign design principles,
     the `ui-ux-pro-max` industry rules block from
     `designIntelligence.buildDesignIntelligenceBlock()`, the exact output JSON
     schema, the PDF section contract, the art-direction brief that will seed
     the image prompt.
  2. *(variable, at the very end)* this business's scraped data + audit findings
     + current screenshot description.
- **Output** (structured JSON):
  ```json
  {
    "brand_positioning": { "headline", "statement", "tone", "audience" },
    "design_system": { "palette": {...}, "typography": {...}, "rationale" },
    "page_plan": [ { "section", "purpose", "copy" } ],
    "image_prompt": "detailed art-direction prompt for gpt-image-1: layout, hero, palette, type, mood, device frame"
  }
  ```

### 7b. New-design screenshot — **gpt-image-1**

- Feed `image_prompt` (+ optionally the current screenshot as an image input for
  gpt-image-1 edit/reference) → generate a 1536×1024 (or portrait) mockup image.
- Upload to `companies/<id>/mockup.png`, set `mockup_gcs_key`.
- ⚠️ Verify at build time whether image generation can go through the **Batch
  API** (`/v1/images/generations`). If not, run image gen **synchronously** in
  the `redesigning → redesigned` worker step *after* the text batch returns —
  the concept is batched, the image is a fast per-lead call.
- No editable HTML source is produced by design (that's the paid product's job);
  the proposal sells the *direction*, the build happens after they say yes.

### 7c. Assemble the PDF (fixed structure, always)

`backend/services/proposalPdf.js` — render an HTML template with Puppeteer
`page.pdf()`. **Section order is constant:**

1. **Cover** — business name · "Website Redesign Proposal" · the **new-design
   screenshot** as the hero (this is page 1, per requirement)
2. **What we noticed** — audit findings in plain English + small current screenshot
3. **New brand positioning** — headline, positioning statement, tone
4. **Design system** — palette + type, before/after side by side
5. **Page plan** — section-by-section
6. **Scope & investment** — 1 week delivery, $200–$1000 band
7. **Contact & next step** — your name / email / phone / portfolio (from env), CTA

Upload to `companies/<id>/proposal.pdf`, set `proposal_gcs_key`,
status → `pdf_ready`.

**Human gate:** `/app/proposals` — preview PDF + before/after, then
"Ready to send" (→ `ready_to_send`) or "Hold".

---

## 8. Stage 5 — Outreach (daily schedule)

### Recommended: Cloud Scheduler → authenticated Cloud Run endpoint

Not a Claude/chat scheduled agent. Sending is transactional and needs no
judgement at run time (qualification already happened), must run when your
laptop is off, and should be idempotent. A chat agent is billed, slower, and
less reliable for this. (Use a scheduled *chat* agent only if you also want a
daily human-readable pipeline digest — optional, separate.)

- **Cloud Scheduler** job, daily 09:00 local → `POST /api/app/cron/outreach`
  with an OIDC token (or `X-Cron-Secret` shared secret header).
- Handler:
  ```
  SELECT * FROM leads
   WHERE status='ready_to_send'
     AND contact_email IS NOT NULL
     AND contact_email NOT IN (SELECT email FROM suppressions)
     AND country = ANY($targetCountries)
   ORDER BY audit_score DESC
   LIMIT $dailyCap        -- default 30
  ```
  Per lead: render email (personal first line from `qualify_angle` +
  `audit_reasons`), attach `proposal.pdf` (from GCS), send via ESP,
  insert `outreach_messages`, set lead `contacted` + `contacted_at`,
  write `lead_events`.
- **Replies / bounces:** ESP webhook → `POST /api/app/webhooks/esp` → update
  `outreach_messages.status` and lead → `replied` / `bounced`.
- **Unsubscribe:** `GET /api/app/u/:token` → add to `suppressions`, lead →
  `unsubscribed`. Link + your physical address in every email footer
  (CAN-SPAM / UK PECR).

### Email infrastructure (you still need to set this up)

- **ESP:** Resend (recommended — clean API, good deliverability, cheap) or
  Instantly/Smartlead if you want built-in warmup + rotation.
- **Domain:** a dedicated subdomain e.g. `outreach.websight.pro` (or a separate
  domain). Never send cold mail from the root domain.
- **DNS:** SPF, DKIM, DMARC (`p=none` first). Provider gives exact values.
- **Warmup:** 2–3 weeks ramp; steady-state cap 30–50/day.
- **Compliance:** physical address + working unsubscribe in every mail; skip
  Canada for cold email (CASL); US/UK/AU OK with opt-out.

---

## 9. Dashboard (`/app`, admin-gated)

Reuse `AdminProtectedRoute` + `requireAdminSession` (only `shubhpalan@gmail.com`).
New pages under `frontend/src/pages/app/`:

| Route | Purpose |
|---|---|
| `/app` | Pipeline board — kanban by status, counts, error queue + retry |
| `/app/leadgen` | Grid config editor, "Run discovery", run history |
| `/app/qualify` | Review queue: screenshot, score, Gemini verdict → Approve/Reject |
| `/app/proposals` | `pdf_ready` list: PDF preview, before/after → Ready to send / Hold |
| `/app/outreach` | `ready_to_send` + sent log + replies; daily cap; manual "send now" |
| `/app/settings` | Key status, GCS bucket, ESP config, your contact block, caps, target countries |

Backend: `backend/routes/app/` — `leadgen.js`, `pipeline.js`, `qualify.js`,
`proposals.js`, `outreach.js`, `cron.js`, `webhooks.js`. All under
`app.use('/api/app', requireAdmin, appRouter)` except cron/webhooks which use
their own secret. GCS PDFs shown via short-lived **signed URLs**.

---

## 10. Orchestration

**Start simple, harden later:**

- **Phase 1:** one Cloud Scheduler job every 5 min → `POST /api/app/cron/tick`
  → advances up to N leads per stage (calls the same worker functions
  in-process). Fine for low volume.
- **Phase 2 (when volume grows):** move scrape + PDF render to **Cloud Run
  Jobs** (same image, `ENTRYPOINT` switch via `WORKER=scrape node workers/run.js`),
  triggered by Scheduler; keep qualify/outreach on the tick. Optionally Cloud
  Tasks for per-lead retries.

The web service (`websight-app`) keeps its current config
(`--timeout=300 --concurrency=1 --max-instances=5`); heavy work never runs in a
user-facing request.

---

## 11. Secrets & security (do this before building)

- `env.yaml` currently holds **live** API keys in plaintext in the repo working
  tree (gitignored + dockerignored, but still on disk). Move pipeline secrets
  (`GOOGLE_API_KEY`, `OPENAI_API_KEY`, Gemini/Vertex, ESP key, `CRON_SECRET`)
  into **GCP Secret Manager**, referenced from Cloud Run. **Rotate the keys that
  have been sitting in `env.yaml`.**
- `/app` + `/api/app/*` → admin session only.
- `/api/app/cron/*`, `/api/app/webhooks/*` → OIDC or `X-Cron-Secret`.
- GCS bucket private; dashboard reads via signed URLs.
- Places API: daily quota cap set in console.

---

## 12. Reference code already written

`~/Projects/leadgen/` (Python) is a working reference for Stages 1–3:
`places.py` (Text Search + field mask), `audit.py` (signals + scoring),
`pagespeed.py`. Port the logic to `backend/services/*.js`; the Python folder is
scratch and can be deleted once ported.

---

## Locked decisions

1. **New-design screenshot:** `gpt-image-1` image generation from an
   art-direction `image_prompt` (produced by the concept step) + current
   screenshot as reference. No mockup HTML.
2. **OpenAI redesign concept:** **Batch API** (24 h window, −50 %), cache-structured
   prompt. Image gen runs synchronously per lead if Batch can't do images.
3. **Outreach / ESP:** deferred. Build Stages 1–4; pipeline halts at
   `ready_to_send`. Stage 5 (`/api/app/cron/outreach`, ESP, domain, warmup,
   compliance) is a later phase.
4. **Orchestration:** Cloud Scheduler → `POST /api/app/cron/tick` every 5 min,
   in-process workers advancing N leads per stage. Cloud Run Jobs later.
5. **`/app` auth:** reuse the existing admin session gate (`requireAdminSession`,
   `shubhpalan@gmail.com` only).
6. **Target countries / categories:** _still needed for the first real discovery
   run_ — not a blocker for building.

---

## Build sequence

**Phase A — foundation**
1. `backend/migrations/agency_pipeline.sql` + wire into `ensureSchema()`
2. `services/gcsStorage.js` (+ `@google-cloud/storage` dep), private bucket
3. Refactor `scrapeBundle.js` → shared `buildScrapeArtifacts(url)`; public ZIP
   endpoint unchanged
4. `middleware` + `routes/app/index.js` mounted at `/api/app` behind `requireAdmin`

**Phase B — stages 1–3**
5. `services/places.js` + `POST /api/app/leadgen/runs` + `/app/leadgen` page
6. `workers/scrape.js` (discovered → scraped, findings to GCS, email extract)
7. `services/leadAudit.js` + PageSpeed call (scraped → audited)
8. `POST /api/app/cron/tick` + Cloud Scheduler; `/app` pipeline board

**Phase C — qualification**
9. `services/qualify.js` (Gemini structured output, zod schema) → `qualified`/`rejected`
10. `/app/qualify` review queue with Approve / Reject / Edit

**Phase D — redesign + PDF**
11. `services/redesignBatch.js` — build JSONL, submit `/v1/batches`, poll, ingest
12. `services/mockupImage.js` — gpt-image-1 → `mockup.png` to GCS
13. `services/proposalPdf.js` — fixed 7-section template → Puppeteer `page.pdf()` → GCS
14. `/app/proposals` — PDF preview, before/after, Ready-to-send / Hold

**Phase E — outreach** (after ESP decision)
15. suppression + unsubscribe, `cron/outreach`, ESP adapter, webhook

**Then:** port complete → delete `~/Projects/leadgen` Python scratch.
