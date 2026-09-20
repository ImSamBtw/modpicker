# ModPicker automated data pipeline

The production-data prototype runs every six hours with GitHub Actions and stores normalized, provenance-first records under `data/live/`.

## Works without credentials
- Curated source ingestion
- Deduplication and validation
- Review queue generation
- Static JSON database
- `pipeline-data.js` export consumed by the website
- Unit tests and data-health page

## Optional live collectors
Add these as GitHub repository secrets. Never commit credentials.
- `YOUTUBE_API_KEY`
- `REDDIT_CLIENT_ID`, `REDDIT_CLIENT_SECRET`, `REDDIT_USER_AGENT`
- `EBAY_CLIENT_ID`, `EBAY_CLIENT_SECRET`
- `CLOUDFLARE_ACCOUNT_ID`, `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_AI_MODEL`

## Scraping policy
`WebProductCollector` only crawls explicitly allow-listed product URLs, checks `robots.txt`, identifies itself, and prefers Product JSON-LD. `allow_scrape` is false by default. Review each site's terms and robots policy before enabling it.

## Production migration
`database/schema.sql` contains a Postgres/Supabase-ready schema. The Git-backed JSON store is the default while traffic is low because it is free, inspectable and easy to roll back.
