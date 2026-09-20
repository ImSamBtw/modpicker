# ModPicker

Automotive parts research and build planning at https://imsambtw.github.io/modpicker/.

- Source-linked product catalog, fitment labels, recent USD seller observations. Browse cars with Make → Model → Year → Variant, or browse engine/platform families such as BMW M52TU.
- Published owner-review ratings where evidence exists; never synthetic performance scores.
- Per-vehicle local builds with quantities, seller selection, notes, costs, purchase status, undo, sharing and JSON export/import.
- Scheduled deterministic product discovery/publication and official NHTSA vehicle-model discovery.
- Supabase public read catalog with a complete Git-backed static fallback.

Run locally: `python -m http.server 8000`.

Read [project goals and roadmap](PROJECT.md), [review and improvement plan](REVIEW_AND_PLAN.md), [pipeline](PIPELINE.md), and [operations](OPERATIONS.md).

Tests: `python -m unittest discover -s tests -v`. Pipeline: `python -m pipeline.run`. Publication gate: `python -m pipeline.validate`.

Catalog contribution rules are documented in [MANUAL_CATALOG.md](MANUAL_CATALOG.md).
