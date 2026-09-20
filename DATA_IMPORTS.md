# Vehicle databases and fitment maintenance

## Goals and boundaries

Improve depth for BMW Z3, NB Miata and first-generation BRZ/FR-S/86. Every published fact must retain its source. More model records do not imply more compatible parts. Model year is distinct from production date; a shared engine does not establish body, gearbox, emissions or mounting compatibility.

## Official database import

`python scripts/import_vehicle_database.py` downloads the official FuelEconomy.gov ZIP, parses the vehicle table and writes the scoped configurations to `data/reference/epa_vehicles.json`. No API key, paid service or LLM is required. For repeatable offline imports use `--archive /path/to/vehicles.csv.zip`.

The import manifest `data/reference/epa_import.json` records the upstream URL, retrieval time, SHA-256, source row count and imported row count. EPA IDs are stable identities. Duplicate display configurations retain separate IDs and labels. Manual and automatic versions remain separate. The source does not establish BMW engine codes, trim packages, production month or compatible parts; these remain unknown.

Official documentation: https://www.fueleconomy.gov/feg/ws/index.shtml

The scheduled workflow refreshes this subset before catalog validation. A failed download/empty scope fails the run before overwriting the previous committed snapshot. NHTSA continues providing broader model discovery. The EPA subset is limited to the current researched vehicle families for usability; expanding it requires an explicit scope addition in `normalize()` and tests.

## Reviewed applications

`data/reference/vehicle_applications.json` preserves the three existing curated build targets and stable IDs. Engine platform membership is explicit. EPA configurations do not automatically inherit engine codes from similar curated targets. This prevents, for example, assigning every NB engine to BP-4W or every Z3 to M52TU.

## Compatibility rules

`data/reference/fitment_rules.json` maps named part IDs to explicit application selectors. Supported constraints include family, engine family, year bounds, body and exact transmission. Unknown selector fields and empty selectors fail closed. Never infer a range from a search query or category membership. Use the exact product's fitment page and preserve restrictions in `notes`.

Rules are evaluated against the complete normalized application table on every refresh. That means a newly imported year automatically receives a part when its `family_id`, engine family, year, trim, body or transmission satisfies the rule; no generated catalog file or database row is hand-edited. The same rule can therefore cover every matching Z3 year added later, while a nonmatching engine, gearbox or production range remains excluded. `trim_contains_any` is available for product application tables that name multiple engines (for example Z3 2.3/2.5i/2.8/3.0i).

The reviewed rules include the Koni Special Active NB set across 1999–2005 and evidence-backed Z3 ranges. Z3 2.8 rules cover the official 1997–2000 2.8 configurations; Turner product application tables cover the 1997–2002 brake-line range and the 1999–2002 six-cylinder cooling range. Category-page rules remain `probable` and show a confirmation prompt; product application tables retain `verified` status only when the page exposes the application table. The Koni page excludes stock Mazdaspeed springs; because imported configurations do not prove spring type, expanded entries remain `probable`. Details exposes each restriction and source.

Public evidence used for the current Z3 ranges includes the [Turner brake-line application table](https://www.turnermotorsport.com/p-583489-turner-motorsport-stainless-steel-brake-lines-complete-kit/), [Turner cooling-overhaul application table](https://www.turnermotorsport.com/p-339093-complete-cooling-system-overhaul-package-1999-2002-z3-23-25i-28-30/), and [RealOEM Z3 model ranges](https://www.realoem.com/bmw/enUS/options?code=L830A&series=Z3). These pages are retained on each rule so a maintainer can re-check the exact SKU and production-date caveat.

Before adding a verified rule, establish exact SKU, model-year bounds, market, engine/body/transmission restrictions and production-date breaks. If a required condition cannot be represented or established, use probable or keep the candidate pending. Do not assign an unrelated product's source URL to a group of parts.

For manual additions: add the product in `data/manual/parts.json`, add reviewed applications if needed, then a product-specific rule. Use a stable `family_id` for all exact applications that share the platform, and express the verified year/engine/body/transmission range in the rule selector. Do not edit generated fitments or hand-enter scores. Run `python scripts/validate_catalog.py`, `python -m unittest discover -s tests -v`, then rebuild and run `python -m pipeline.validate` before publication. Review the actual expanded IDs by year and the evidence, not only counts. Add a regression test with a synthetic future application so the next database import cannot silently lose the range.

## Remaining work

- Add licensed/open manufacturer fitment feeds with production-month, market and equipment conditions.
- Review existing legacy source-listed fitments that cite category pages rather than exact SKUs.
- Establish primary-source engine mappings for imported Z3 variants before adding them to engine families.
- The ingestion function is deployed as version 8 with one database row per expanded application. It clears the previous fitment rows for each published part before inserting the current expansion, including parts whose generated `fitments` array is explicitly empty. Removed years, narrowed selectors, and retired applications cannot linger in Supabase after a refresh. Bundled fitments remain authoritative for the published catalog while synchronization completes.
- Reconcile source removal/retraction for candidates and observations next; fitment rows are now reconciled on every ingest.
