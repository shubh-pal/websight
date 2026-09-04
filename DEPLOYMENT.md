# Cloud Run Deployment

WebSight is deployed as the public Cloud Run service `websight-app` in GCP project `sunlit-cyclist-497019-i3`, region `us-central1`.

The service serves the frontend and API from the same container. The public scrape export is available at `POST /api/public/scrape`.

## Prerequisites

- A signed-in `gcloud` CLI with access to the target project.
- Dockerfile-based source builds enabled through Cloud Build and Artifact Registry.
- A configured Cloud Run service with its runtime environment already set.
- Public invocation enabled for the service if the public scrape API is intended to be anonymous.

Do not put secret values in the repository, command line, Docker build arguments, or this guide. Configure runtime values through Cloud Run's environment/secret configuration. Before deploying, inspect the existing service configuration:

```bash
gcloud run services describe websight-app \
  --project=sunlit-cyclist-497019-i3 \
  --region=us-central1
```

`.dockerignore` is required for source deployments. It excludes local `.env` files, `env.yaml`, private keys, generated storage, dependencies, and git metadata from the build context. Keep it in place and add any new local credential files to it before deploying.

## Deploy

The Dockerfile installs Puppeteer browser dependencies and builds the frontend. Deploy from the repository root so Cloud Run uses that Dockerfile:

```bash
gcloud run deploy websight-app \
  --source . \
  --project=sunlit-cyclist-497019-i3 \
  --region=us-central1 \
  --cpu=1 \
  --memory=2Gi \
  --timeout=300 \
  --concurrency=1 \
  --max-instances=5
```

Omit flags that replace environment variables or secrets unless their complete intended configuration is supplied. The command above preserves the existing service identity, IAM policy, and runtime configuration while updating the image and explicit scrape-safe runtime settings.

The public scrape endpoint performs synchronous browser work. Keep browser-capable images, at least 2 GiB memory, low concurrency, and a timeout that covers page rendering and ZIP creation. Maintain outbound-network restrictions and rate limiting as defense in depth for the URL-fetching API.

## Verify

Confirm Cloud Run routed all traffic to a Ready revision:

```bash
gcloud run services describe websight-app \
  --project=sunlit-cyclist-497019-i3 \
  --region=us-central1 \
  --format='yaml(status.latestReadyRevisionName,status.traffic,status.conditions)'
```

Use the service URL returned by that command. This safe request confirms the public endpoint and URL validation without triggering a remote scrape:

```bash
curl --silent --show-error --request POST "https://SERVICE_URL/api/public/scrape" \
  --header 'Content-Type: application/json' \
  --data '{"url":"http://127.0.0.1:3000"}'
# Expected: HTTP 400 with a public-IP validation error.
```

To test a full export, use a public URL and save the response as a ZIP:

```bash
curl --fail --request POST "https://SERVICE_URL/api/public/scrape" \
  --header 'Content-Type: application/json' \
  --data '{"url":"https://example.com"}' \
  --output example-com-scrape.zip
```

## Rollback

List recent revisions, choose the last known-good revision, and direct traffic back to it:

```bash
gcloud run revisions list \
  --service=websight-app \
  --project=sunlit-cyclist-497019-i3 \
  --region=us-central1

gcloud run services update-traffic websight-app \
  --project=sunlit-cyclist-497019-i3 \
  --region=us-central1 \
  --to-revisions=REVISION_NAME=100
```

Verify traffic and the public endpoint again after rollback.
