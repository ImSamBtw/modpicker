# ModPicker operations

## Current production prototype

- Static application: GitHub Pages from `main`.
- Data refresh: `.github/workflows/data-pipeline.yml` every six hours.
- Free backing store: normalized JSON under `data/live/`.
- Browser export: `pipeline-data.js`.
- Health page: `/data-status.html`.
- Automated writes are committed by `modpicker-data-bot`.

## Required GitHub Actions secrets for live collectors

Add these in **Repository Settings → Secrets and variables → Actions**. Never paste credentials into source code or commit them.

### YouTube
- `YOUTUBE_API_KEY`

### Reddit
- `REDDIT_CLIENT_ID`
- `REDDIT_CLIENT_SECRET`
- `REDDIT_USER_AGENT`

### eBay
- `EBAY_CLIENT_ID`
- `EBAY_CLIENT_SECRET`

### Optional AI curation
- `CLOUDFLARE_ACCOUNT_ID`
- `CLOUDFLARE_API_TOKEN`
- `CLOUDFLARE_AI_MODEL`

The pipeline is intentionally functional when none of these exist. Missing credentials disable only that collector.

## Crawler policy

- Prefer official APIs, feeds, sitemaps and structured Product JSON-LD.
- HTML crawling is opt-in per URL in `config/product_pages.json`.
- The web collector checks `robots.txt`, identifies itself and uses retry/backoff.
- Do not enable a retailer/forum for HTML crawling until its current terms and robots policy have been reviewed.
- Reddit ingestion stores thread metadata and links rather than retaining discussion bodies.

## Data trust model

Every discovered source keeps its original URL, type, retrieval time and confidence. AI is allowed to classify/summarize source metadata, but deterministic code owns deduplication, validation, pricing history and publication rules. Fitment or safety-critical specifications should not become verified facts solely from model output.

## Review queue

`data/live/review_queue.json` receives records that fail validation or fall below confidence thresholds. A later admin surface can approve/reject them before they affect production rankings.

## Database migration

`database/schema.sql` contains the first Postgres model. Supabase is the intended next backing store once provisioned. Public catalog tables should be read-only to browser roles with RLS enabled; user garages/builds/watchlists should use owner-based RLS; ingestion/review data should remain server-only.
