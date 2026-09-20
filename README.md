# ModPicker

A working static prototype of a **PCPartPicker-style automotive build planner**.

## Prototype capabilities

- Vehicle garage and vehicle-specific catalogs
- Chassis / engine / drivetrain fitment context
- Search and category filtering
- Goal-aware rankings: balanced, reliability, power, handling, track, budget
- Quality, reliability, power, handling and value ratings
- Confidence score for ranking evidence
- Side-by-side comparison for up to four parts
- Multiple seller/price offers per part and lowest-price selection
- Links to check current vendor/search pricing
- Persistent build sheets using browser local storage
- Build cost, average rating, estimated power impact and confidence
- Supporting-mod dependency rules
- Conflict detection, such as coilovers vs separate spring/damper setups
- Shareable build URLs
- Responsive desktop/mobile UI
- Scheduled data-refresh and scoring scaffolds under `scripts/` and `.github/workflows/`

## Current demo vehicles

- 2000 BMW Z3 2.8 (M52TU) — most complete demo catalog
- 1999 Mazda MX-5 Miata (NB)
- 2017 Subaru BRZ (ZC6)

## Data caveat

This is a prototype. Scores and displayed prices are **seed/demo snapshots** used to exercise the product and should not be treated as guaranteed current quotes or independently verified rankings.

The production system should separate:

1. canonical part and fitment data,
2. vendor price offers and price history,
3. evidence records from permitted sources/APIs,
4. calculated score snapshots,
5. user builds.

## Production data model

Recommended tables/collections:

- `vehicles`
- `parts`
- `fitments`
- `part_dependencies`
- `part_conflicts`
- `vendors`
- `offers`
- `price_history`
- `evidence`
- `score_snapshots`
- `users`
- `builds`
- `build_items`

## Price ingestion

Use official vendor APIs/feeds where available. Where automated collection is permitted, normalize offers into a common schema and refresh them on a schedule. Do not bypass authentication, anti-bot protections, or source terms.

## Review / Reddit scoring

Store evidence before calculating scores. Useful evidence fields include source type/URL, date, normalized part identity, metric relevance, normalized score or sentiment, source weight, duplicate hash, and verification state.

Reddit ingestion should use Reddit OAuth/API credentials. The current workflow contains placeholders for those secrets rather than anonymous scraping.

## Run locally

```bash
python -m http.server 8000
```

Open `http://localhost:8000`.

## GitHub Pages

The site is static and ready to publish from the repository root with GitHub Pages.
