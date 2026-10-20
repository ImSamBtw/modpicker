# Operations

The repository is now `jakehenry076-cmd/modpicker`. GitHub Pages is configured to publish `main` root at `https://jakehenry076-cmd.github.io/modpicker/`; the former owner's Pages URL returns 404. The Dream Spec release preview at `https://dream-spec-git-preview.pages.dev/` is connected to `refactor/dream-spec-hub` in Cloudflare Pages.

GitHub Actions refreshes every six hours. Supabase ingestion function source is `database/ingest-github-pipeline.ts`; deployed function changes must be deployed separately from GitHub commits. Its custom GitHub OIDC validation requires repository `jakehenry076-cmd/modpicker`, the main branch and the data-pipeline workflow; no service secret is shipped to browsers. After the ownership transfer, update the deployed `ingest-github-pipeline` function in the public catalog project `pzxofwrdidvqhdlqbehk` to match the new repository identity, retaining its existing JWT signature, issuer, audience, branch and workflow checks. The audience remains `modpicker-supabase`. Run `node tests/github-ingestion-auth.mjs` to verify the source authorization rules without calling the hosted service.

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


## Data addition runbook

For a manual vehicle, platform, or part, follow `MANUAL_CATALOG.md`. Add the JSON, run `python scripts/validate_catalog.py`, run the unit tests, then inspect the pipeline output and review queue. For automated sources, update the allow-listed config and domain policy, verify robots and terms, and let the scheduled job collect structured records. The same publication gate handles both paths.


## Homepage assets and verification

Run `node tests/ui-cleanup-smoke.cjs` after changing Home, header navigation or `home.css`; run the existing browser and Garage smoke tests for routing changes. Desktop/mobile captures are written to `/tmp/modpicker-home-*.png`. The showcase asset and its provenance/future submission requirements live in `assets/README.md`. The page uses a static concept image until an opt-in moderation and attribution workflow exists.


## Dream Spec account and diagnostic services

See [DREAM_SPEC.md](docs/DREAM_SPEC.md) for the private-data migration, email-auth configuration, BYOK-only diagnostic function, appearance rollback and regression checks. Do not configure host AI credentials for the diagnostic function.
