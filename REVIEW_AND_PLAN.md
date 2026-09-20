# ModPicker review and implementation

## Findings and completed changes

| Area | Audit finding | Implemented change |
|---|---|---|
| Ratings | Seed numbers were copied into database scores; evidence counts did not substantiate metrics. | Published-review-only methodology; exact product identity gate, source URL/date, review counts, same-outlet deduplication, 90-day expiration. Unsupported metrics remain null. |
| Pricing | Demo/search-link quotes, missing prices shown as zero, old seed quotes overwriting fetched prices. | Remove demo quotes; recent USD offers only; exclude unavailable/unmatched marketplace listings; unknown prices remain unknown; retain newer observations. |
| Fitment | Generic confidence was treated as proof of compatibility. | Require a vehicle-specific verified source record for the source-listed label; discovered products explicitly require confirmation. |
| Automation | Discovery stopped at a pending queue; cars and promoted parts required manual additions. | Scheduled structured-product publication with SKU identity, rotating NHTSA model discovery, persistent catalog export and database sync. No LLM dependency. |
| Build sheet | Vehicle switching removed parts; notes deleted; incomplete totals looked complete; horsepower estimates were added together. | Per-vehicle saved builds, quantity, notes, seller, unit-cost override, three purchase states, undo, Unicode sharing, JSON import/export, unknown-cost accounting. Remove additive horsepower claims. |
| UI | Rankings claimed goal-specific performance without supporting data. | Owner-review ratings, explicit unrated states, research counts, category comparison, clear price dates, optional goal categories. |
| Reliability | Collector errors could stop all jobs; validation logged invalid data without excluding it; snapshots lacked canonical parts. | Optional collector isolation, invalid-record quarantine, atomic JSON writes, complete snapshot export, pagination/timeouts for database reads, publication gate. |
| Security | Future crawled strings would be interpolated into HTML; pipeline function source not in repo. | Escape catalog text and URL attributes, restrict link protocols, retain GitHub OIDC repository/ref/workflow authorization, version ingestion function in repo. |

## Automated path

GitHub Actions runs every six hours. Allowed collection pages discover product URLs. Up to eight candidates per run are checked against Product JSON-LD. A product needs an unambiguous identity and brand before publication. Collection membership does not verify its fitment. Existing products refresh structured prices/reviews every 24 hours. Vehicle discovery rotates two make/year requests per run across `config/vehicle_discovery.json`. YouTube uses its configured key and existing quota cooldown; Reddit/eBay stay disabled without credentials. No paid AI API is used.

Data flows through normalized records, score calculation, validation, Supabase ingestion, and a bundled static export. Failed sources retain their previous observations, whose original dates determine freshness. Database publication uses GitHub OIDC, not browser credentials.

## Rating methodology

Only an identified product's published aggregate review rating is eligible. Normalize `ratingValue / bestRating × 10`; weight outlet averages by their reported review counts. Deduplicate repeated pages from the same hostname. Show source links, review count and retrieval date. This is an owner-review average, not a quality, reliability, horsepower, handling, value, or fitment measurement. Reviews may be syndicated across outlets and are not independently verified. No eligible evidence means not rated. Zero is not used for missing evidence.

## Limits and next expansion steps

- Automatic vehicle discovery adds model records, not engine/trim-level fitment. It must not copy fitments to similar models or nearby years.
- Catalog growth is restricted to explicitly configured, permitted source domains. Broader coverage requires more permitted retailer feeds and exact fitment mappings; it cannot be honestly promised for every vehicle.
- Variant-specific products without an unambiguous SKU remain pending. No model guesses SKU, fitment, torque specifications, installation difficulty, or review sentiment.
- Existing sourced seed fitments and install estimates still need deeper independent review. Install hours are labeled planning estimates, not quotes.
- Builds save in this browser. JSON export/share are the transfer mechanisms; account synchronization and price-alert delivery are not implemented.
- Tax, shipping, and unknown labor/part costs are outside the known subtotal.
- The source robots policies and API quotas can block updates; the health page reports degradation and source warnings.

## Validation

Run `python -m unittest discover -s tests -v`, `python -m pipeline.run`, and `python -m pipeline.validate`. Browser smoke testing covers build editing, switching vehicles, reload persistence, detail dialogs, routes, sharing, missing prices, and mobile layout.

## Database security review

Supabase security advisors found no exposed-table/RLS errors. The pending candidate table is intentionally denied to public roles (RLS enabled without policies). An existing `pg_net` extension placement warning remains: [Supabase extension guidance](https://supabase.com/docs/guides/database/database-linter?lint=0014_extension_in_public). No extension relocation or schema change was performed in this release.

## Iteration: hierarchical applications and platform scope — 2026-09-20

### Problem addressed

The previous vehicle control rendered one long list. That made a large NHTSA-derived catalog difficult to scan and made an engine-family request such as “M52TU” impossible unless the user already knew which car record carried it.

### Changes executed

- Replaced the long list with Make → Model → Year → Variant controls. The variant is the only exact application ID used for vehicle fitment.
- Added a separate Engine / platform mode with Make → Engine/platform → Application controls.
- Added explicit platform records, aliases, application IDs, category allow-lists, and source URLs. Platform results are discovery results and retain an exact-fitment confirmation label.
- Exported platform records through the deterministic pipeline and browser fallback, and kept them available after Supabase hydration.
- Added manual JSON inputs and a validator that rejects unstable IDs, missing applications, invalid URLs, and hand-entered rankings.
- Added cross-path documentation in `PROJECT.md`, `MANUAL_CATALOG.md`, `PIPELINE.md`, `OPERATIONS.md`, and `data/manual/README.md`.
- Added smoke coverage for car hierarchy, platform browsing, application switching, build persistence, detail evidence, sharing, routes, and mobile overflow.
- Fixed inactive scope controls so hidden selectors do not occupy layout space on mobile or desktop.

### Evidence and limits

The initial platform families are intentionally scoped to exact curated applications already represented in the catalog. The platform view does not claim that every part fits every engine installation. More platforms should be added only with a reviewed application mapping and a documented category scope. Automated NHTSA discovery remains model coverage; it does not create engine or part fitment.

### Next review loop

1. Confirm the first scheduled pipeline refresh exports platform and vehicle counts in status.
2. Add exact application records and platform mappings only when the source supports them.
3. Expand structured product sources before expanding the platform list.
4. Add a maintainer review-queue surface for ambiguous product candidates.
5. Re-run this review after the next data refresh and record any source degradation or UI regression.
