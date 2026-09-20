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

1. **Completed:** the first scheduled refresh after this change exported 96 parts, 394 vehicles, and all three platform families; `data/live/status.json` reports 394 vehicles and 3 platforms.
2. Add exact application records and platform mappings only when the source supports them.
3. Expand structured product sources before expanding the platform list.
4. Add a maintainer review-queue surface for ambiguous product candidates.
5. Re-run this review after the next data refresh and record any source degradation or UI regression.

The refresh was published by GitHub Actions in commit `7bce626` on 2026-09-20. Its generated export contains `bmw-m52tu`, `mazda-bp-4w`, and `subaru-fa20`; the manual application IDs are present in the live vehicle file.

## Iteration: official configurations and constrained compatibility

| Finding | Action/status |
|---|---|
| Draft year/engine tables inferred engine codes and mixed model years with production years | Replaced draft expansion with imported official EPA configurations; only existing curated targets retain engine codes. |
| Draft rules grouped different SKUs under one unrelated source URL | Removed; retained one checked product-specific range with its spring restriction. |
| Manual-only products could match unspecified/automatic applications | Exact transmission constraints and negative regression coverage. |
| Duplicate EPA configurations had identical selector labels | Keep source IDs, add distinguishing labels; do not collapse potentially different configurations. |
| No direct car/engine search | Added keyboard-accessible search with bounded results and year narrowing. |
| Platform parts vanished during build import if not mapped to selected vehicle | Preserve known part selections; fitment checks remain visible. |
| Empty fitment update retained stale compatible vehicle IDs | Empty arrays now clear prior membership. |
| Future-dated offers passed freshness filtering | Require nonnegative observation age. |
| Fitment confidence could be increased by weaker evidence | Preserve the winning record's confidence. |
| Database hydration could erase newer bundled fitment rules | Prefer explicit bundled fitments pending deployed ingestion parity. |

See DATA_IMPORTS.md for source provenance, automated/manual workflows and remaining review items. No comprehensive fitment coverage or database deployment is claimed by this change.

## Iteration: durable multi-year fitment expansion — 2026-09-20

### Problem addressed

The first constrained refresh proved that rule-derived rows could reach Supabase, but most Z3 seed parts still pointed only at the curated `z3-2000-28` record. A Z3 owner selecting another imported year therefore saw an incomplete catalog even when the product source named the shared 2.8, six-cylinder or model-year range.

### Changes executed

- Added selector support for `trim_contains_any` and `trim_prefix_any`, while keeping unknown selectors fail-closed.
- Added product-specific Z3 rules for the 1997–2000 2.8 range, manual 389 mm DSSR, H&R bar, 1997–2002 brake-line range, 1997–2002 control-arm bushing/suspension ranges, and the 1999–2002 six-cylinder cooling ranges.
- Preserved restrictions in each rule: manual transmission for shifter parts, engine labels for six-cylinder cooling parts, non-M application notes, category-page uncertainty, and production-date confirmation.
- Kept M52TU spark plug/coil expansion limited to explicit `engine_family_id=bmw-m52tu` applications. Official EPA configurations do not inherit engine codes.
- Added regression coverage that proves imported Z3 years expand and that a future application with the same family/trim attributes matches without editing generated data.
- Documented the rule contract and contribution steps in `DATA_IMPORTS.md` and `MANUAL_CATALOG.md`.

### Durable future-addition behavior

The importer writes normalized applications with stable family IDs. `pipeline.applications.expand_fitments()` evaluates every rule against that table on every run, then exports one fitment per matching application to the browser snapshot and Supabase. A new year only needs to be present in the normalized reference database; it does not need a new part record or a hand-edited compatibility list. A selector that cannot match any application fails validation before publication.

### Verification targets

The live refresh must show the Z3 range rows in `part_fitments` for every matching EPA application, retain probable status for broad category sources, and preserve exact application evidence for product pages. The next review should add production-month data for parts with known pre/post-09/1998 breaks and reconcile candidate/source observations removed from a source.

Validation for this iteration: 32 unit tests passed, publication validation passed, browser smoke passed (search, hierarchical selection, persistence, quantities/costs, Unicode sharing, import/undo, fitment restriction details, routes and mobile overflow). Mobile screenshot inspected. Snapshot: 96 parts, 505 vehicle records, 94 reference applications (91 official EPA configurations plus 3 curated targets), 4 browsing families, 24 range matches for the single reviewed product rule. This is an offline rebuild using existing price/source observations; it does not claim those observations were refreshed.

Deployment verification: GitHub Actions run 35526811631 completed every stage, including the official import, validation and Supabase synchronization. Ingestion version 6 persisted 23 additional rule-derived fitments with probable status. The reviewed rule matches 24 applications in total, including the pre-existing curated target. Public website assets were fetched and confirmed to contain the new search and import manifest. Local browser coverage passed; a separate remote-browser navigation was blocked by the runtime network, so live interactive browser QA is not claimed.

### Follow-up verification

The follow-up refresh from commit `1fbc4cd` completed successfully as Actions run `35528710326`. It published 96 parts, 94 normalized exact applications, 18 fitment rules, 275 rule expansions and 342 total catalog fitment rows. The live Pages deployment `35528728897` served the same status and catalog snapshot. Supabase ingestion version 9 now replaces fitment rows for all published parts, including uncategorized parts and explicit empty arrays; the database total is 342 rows with 85 parts having at least one compatible application. Z3 checks remain: brake lines span 1997–2002, the 2.8 control-arm range spans 1997–2000, and the six-cylinder cooling rows span 1999–2002.

## Iteration: all-family range expansion and Mustang coverage — 2026-09-20

### Problem addressed

The previous rules were durable for Z3/Miata examples but did not generalize to every catalog family. The 2015 Mustang seed part had no normalized application family or rule, so it remained detached from the imported year records instead of following the S550 range.

### Changes executed

- Added data-driven family definitions for BMW Z3, NB Miata, BRZ/FR-S/86 and Ford Mustang S550 in `config/vehicle_families.json`.
- Expanded the official FuelEconomy.gov import to 2015–2023 gasoline Mustang configurations, excluding Mustang Mach-E records and adding conservative EPA configuration families for 2.3L turbo, 3.7L V6, 5.0L V8 and 5.2L V8 rows.
- Added Mustang S550 chassis, Coyote 5.0L and EcoBoost 2.3L browsing platforms.
- Added six source-linked Mustang products and upgraded the existing Steeda intake record with its 2015–2017 5.0L application selector.
- Added reviewed 2015–2023 GT Performance Package manual/automatic applications so the Steeda PP rear-rotor SKU is not limited to the one EPA row that explicitly labels the package.
- Added deterministic `derive_fitment_rules()` logic. A source-backed explicit range in a catalog row generates one auditable rule, which is evaluated against every normalized application on every refresh. Single-year rows and unscoped model names do not expand.
- Added `data/live/fitment_rules.json` so generated rules can be reviewed alongside the catalog and Supabase payload.
- Added regression tests for future Mustang applications, family normalization, range expansion and dynamic platform resolution.

### Verification

Local refresh produced 102 catalog parts, 227 normalized applications (206 EPA rows, 3 curated targets, and 18 reviewed Mustang Performance Package applications), 7 platforms, 63 total rules (18 reviewed plus 45 generated range rules), 1,808 unique published fitment rows and no fitment warnings. The Steeda 2015–2017 5.0L intake expands to 11 EPA configurations across all three years; the S550 catalog ranges expand across every matching 2015–2023 application; the Performance Package rotor now expands to 19 reviewed/official applications spanning 2015–2023. Unit, catalog, publication and browser checks must pass before the refresh is published.
