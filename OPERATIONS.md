# Operations

GitHub Pages publishes `main` root. GitHub Actions refreshes every six hours. Supabase ingestion function source is `database/ingest-github-pipeline.ts`; deployed function changes must be deployed separately from GitHub commits. Its custom GitHub OIDC validation requires this repository, main branch and workflow; no service secret is shipped to browsers.

Public data tables are read-only under RLS. Build edits are local to the browser; export JSON for a portable backup.

## Credentials

- YouTube: `YOUTUBE_API_KEY` (configured in repository; quota cooldown respected).
- Optional Reddit: `REDDIT_CLIENT_ID`, `REDDIT_CLIENT_SECRET`, `REDDIT_USER_AGENT`.
- Optional eBay: `EBAY_CLIENT_ID`, `EBAY_CLIENT_SECRET`. Search matches are not accepted as exact-SKU price quotes.

No AI API or additional paid service is needed for the scheduled pipeline. Work remains on the existing free services; platform free quotas still apply.

## Adding sources

Edit permitted domains and collection URLs under `config/`; check terms and robots policies first. Unknown/denied robots blocks crawling. Product promotion requires structured identity, not title sentiment. Add more make/year jobs to `vehicle_discovery.json` to expand official model coverage. A model record alone never creates a part fitment.

## Recovery

Inspect `/data-status.html` and the Actions run. A degraded source retains its old observations with their original dates. A failed validation blocks publication. After correcting a source/parser, run the workflow again. Restore a previous Git commit if necessary; avoid overwriting user local builds. No automated job needs a ChatGPT conversation.
