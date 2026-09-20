# Automated data pipeline

Runs every six hours through `.github/workflows/data-pipeline.yml`; no ChatGPT or other LLM is needed.

1. Load curated and previously auto-published products.
2. Refresh permitted structured product data, YouTube metadata, and configured optional APIs.
3. Discover candidate URLs from `config/catalog_sources.json`.
4. Check up to eight candidates for an unambiguous product SKU/brand. Publish qualified products with **unverified fitment**; keep ambiguous products pending.
5. Refresh the official FuelEconomy.gov configuration table using the data-driven family definitions in `config/vehicle_families.json`. Normalize stable family and conservative engine-configuration IDs; exclude models outside each family's explicit bounds.
6. Rotate two official NHTSA make/year requests from `config/vehicle_discovery.json`. Do not infer trims, engines or fitments from those model records.
7. Derive source-backed range rules from explicit catalog ranges, evaluate every rule against every normalized application, and write the auditable expansion to `data/live/fitment_rules.json`.
8. Quarantine invalid records; retain original timestamps on prior observations; calculate published-review ratings.
9. Validate, sync to Supabase with GitHub OIDC, commit canonical JSON and `pipeline-data.js`.

Ratings require product-matched published review averages and counts. URLs or search results alone cannot create ratings. Review evidence expires after 90 days. Price comparisons show USD observations under seven days old and omit unavailable/unmatched marketplace listings. Unknown costs remain unknown.

Sources are opt-in, robots-aware, bounded and cached. Failed fetches do not bypass source restrictions. Disabled APIs are reported separately from failed enabled sources. See the health page and GitHub Actions logs.


## Platform and application scopes

`config/platforms.json` and `data/manual/platforms.json` define engine or chassis groups, aliases, the exact vehicle application records they cover, and category allow-lists. The pipeline exports these records into `pipeline-data.js`. The browser uses them for platform browsing while continuing to display exact fitment status per selected application.

`config/vehicle_families.json` controls which official EPA rows belong to a normalized family. A family addition is reviewed once; after that, every future import of an in-range application is eligible for the family's source-backed rules without hand-editing parts or fitment arrays.

Manual inputs are validated before collection. The workflow fails before publication when a manual record references an unknown vehicle, has an invalid URL, or includes a hand-entered ranking.

## Official configuration import

See [DATA_IMPORTS.md](DATA_IMPORTS.md) for the EPA database import, source manifest, constrained compatibility rules, manual additions and remaining accuracy gates.
