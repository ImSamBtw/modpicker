# ModPicker catalog contribution process

ModPicker has two data paths. The automated path collects from permitted APIs and explicitly allow-listed product pages. The manual path is a pull-request-style JSON change in `data/manual/`. Both paths end at the same validation, provenance, and static-export pipeline.

## Add a vehicle

Add an object to `data/manual/vehicles.json` with:

```json
{
  "id": "bmw-e46-330i-2003",
  "year": 2003,
  "make": "BMW",
  "model": "3 Series",
  "trim": "330i",
  "chassis": "E46",
  "engine": "M54B30",
  "drivetrain": "RWD",
  "transmission": "5-speed manual",
  "tags": ["E46", "M54B30"]
}
```

Use a stable lowercase ID. Do not use `Unspecified` for an exact curated application. Include a source in `metadata.source_url` when the record is not an internal application target. The automated NHTSA collector may add model records, but it cannot invent trim, engine, chassis, or fitment.

## Add a platform or engine family

Add an object to `config/platforms.json` or `data/manual/platforms.json`:

```json
{
  "id": "bmw-m54b30",
  "make": "BMW",
  "name": "M54B30",
  "display_name": "BMW M54B30 3.0L",
  "type": "engine",
  "aliases": ["M54B30", "M54 B30"],
  "vehicle_ids": ["bmw-e46-330i-2003"],
  "categories": ["Cooling", "Maintenance", "Intake", "Exhaust", "Drivetrain"],
  "source_urls": ["https://example.com/primary-fitment-source"]
}
```

`vehicle_ids` are the applications represented in the catalog. `categories` is an explicit scope allow-list. A platform result is labeled as platform-related and still asks the user to confirm exact vehicle fitment.

## Add a part

Add an object to `data/manual/parts.json`:

```json
{
  "id": "brand-part-vehicle",
  "brand": "Example Brand",
  "name": "Example Product",
  "vehicle_id": "bmw-e46-330i-2003",
  "vehicle_query": "2003 BMW 330i E46 M54B30",
  "category": "Cooling",
  "fitment_status": "verified",
  "fitment_confidence": 0.95,
  "fitment_source_url": "https://example.com/fitment",
  "official_url": "https://example.com/product",
  "manufacturer_part_number": "EX-123",
  "description": "Only factual, source-supported description.",
  "install": {"difficulty": "Moderate", "hours": 2},
  "status": "active",
  "price_hint": {"vendor": "Example Brand", "url": "https://example.com/product", "currency": "USD"}
}
```

A part must have a stable ID, brand, name, category, exact application, and source URL. Add `price_hint` only for a directly observed product page. Do not copy a search URL, marketplace result, or generic category URL as a product quote. Do not add `ranking`; the pipeline ignores seed ratings and calculates only from eligible published review evidence.

## Review and publish

1. Run `python scripts/validate_catalog.py`.
2. Run `python -m unittest discover -s tests -v`.
3. Run `python -m pipeline.run` locally when network access and permitted sources are available.
4. Run `python -m pipeline.validate`.
5. Inspect `data/live/status.json`, `data/live/review_queue.json`, and the generated catalog diff.
6. Commit the manual JSON and code/data changes. GitHub Actions repeats the same checks, syncs Supabase through GitHub OIDC, and publishes the static fallback.

For the complete product and data contract, see [PROJECT.md](PROJECT.md). When a contribution changes a user flow, update the project roadmap and add or revise the browser smoke coverage in the same change.

## Automated source additions

Add a permitted page to `config/catalog_sources.json` or a product page to `config/product_pages.json`. Add or update the matching domain policy in `config/product_domains.json`. The collector must be allowed by `robots.txt`, identify itself, use structured Product JSON-LD, and have an unambiguous SKU or MPN. Ambiguous variants remain candidates for review. Never bypass authentication, rate limits, or anti-bot controls.

The vehicle collector rotates a bounded list in `config/vehicle_discovery.json`. Add makes/years there only when model records are useful to the catalog. Official model discovery does not create part fitment.

## Evidence rules

Every source keeps its URL, source type, retrieval timestamp, and confidence. Product prices retain their observation date. A rating requires a matched product identity, a current aggregate rating, and a reported review count. A platform association helps discovery but cannot create exact fitment. Safety-critical specifications, torque values, and installation procedures need a primary manual or manufacturer source.

## Official configuration import

See [DATA_IMPORTS.md](DATA_IMPORTS.md) for the EPA database import, source manifest, constrained compatibility rules, manual additions and remaining accuracy gates.

The multi-application ingestion function was deployed as version 6. A refresh following deployment verifies expanded fitments in the database; selectors and evidence remain available from the bundled snapshot during synchronization.
