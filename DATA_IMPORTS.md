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

The initial checked rule maps the Koni Special Active NB set across 1999–2005. The page excludes stock Mazdaspeed springs; because the imported configuration does not prove spring type, expanded entries remain `probable`. Details exposes that restriction and its source. The source: https://flyinmiata.com/products/koni-special-active-shock-set-1999-2005

Before adding a verified rule, establish exact SKU, model-year bounds, market, engine/body/transmission restrictions and production-date breaks. If a required condition cannot be represented or established, use probable or keep the candidate pending. Do not assign an unrelated product's source URL to a group of parts.

For manual additions: add the product in `data/manual/parts.json`, add reviewed applications if needed, then a product-specific rule. Do not edit generated fitments or hand-enter scores. Run `python scripts/validate_catalog.py`, `python -m unittest discover -s tests -v`, then rebuild and run `python -m pipeline.validate` before publication. Review the actual expanded IDs and evidence, not only counts.

## Remaining work

- Add licensed/open manufacturer fitment feeds with production-month, market and equipment conditions.
- Review existing legacy source-listed fitments that cite category pages rather than exact SKUs.
- Establish primary-source engine mappings for imported Z3 variants before adding them to engine families.
- The ingestion function is deployed as version 6 with one database row per expanded application. Verify rule counts after the first refresh using this version. Bundled fitments remain authoritative for the published catalog.
- Add source removal/retraction reconciliation; the existing database ingest is upsert-only.
