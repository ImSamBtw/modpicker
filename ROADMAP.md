# ModPicker product roadmap

This roadmap extends the evidence-first catalog into a complete virtual garage, build planner, ownership record, research assistant and automotive community. Accuracy rules in `PROJECT.md` remain binding: fitment, specifications, maintenance data, ratings, prices and interchange claims must retain provenance and uncertainty instead of being guessed.

## Product direction

ModPicker should become a vehicle-centered workspace rather than only a parts catalog. A user should be able to describe the exact car they own, record what has happened to it, explain what they want from it, research compatible parts and swaps, build a plan, find local help, track maintenance and document the finished vehicle.

The long-term recommendation input is:

`exact vehicle + installed parts + condition/problems + maintenance state + owner preferences + budget + build goal + evidence-backed catalog + community evidence`

The output is a practical plan with fitment status, prerequisites, alternatives, estimated cost, source links and explicit uncertainty.

## Priority 1 — Garage profile and ownership context

**Status: active prototype.**

- [x] Add a first Garage route to the static application.
- [x] Store a separate profile for each selected vehicle in the browser prototype.
- [x] Capture nickname, odometer, condition, current modifications, ownership/build history, current problems, likes, dislikes and free-form goals.
- [x] Capture recommendation preferences such as reliability priority, comfort priority, noise tolerance, budget and target power increase.
- [x] Support a small local photo gallery for the current vehicle.
- [x] Expose a structured recommendation-context object for future AI or deterministic recommendation engines.
- [x] Add browser coverage for profile persistence and navigation.
- [x] Correct profile-completeness reporting so it reflects the six actual recommendation-context fields rather than starting partially complete.
- [ ] Move profiles and media to authenticated Supabase storage after account/privacy behavior is defined.
- [ ] Add multiple owned vehicles independent of the catalog selector.
- [ ] Add privacy controls for public/private build information.

## Priority 2 — Maintenance tracker and vehicle history

**Status: source-backed pilot active.**

- [x] Add maintenance-item records per vehicle.
- [x] Add due mileage/date calculations when the user provides an interval and last-service information.
- [x] Add fluid/specification, capacity, part-number and notes fields without inventing values.
- [x] Add a common-service starter checklist that leaves vehicle-specific intervals/specifications unverified.
- [x] Add diagnostic-code history records.
- [x] Add receipt/purchase metadata records and a copyable maintenance-history report.
- [x] Add browser tests for due-status calculations, codes, receipts and persistence.
- [x] Add a reviewable source-backed maintenance data contract and a first BMW Z3 2.8 oil/coolant pilot from the BMW owner manual.
- [x] Auto-create sourced maintenance items for supported pilot vehicles and attach source/document/page provenance to the Garage record and report.
- [x] Leave intervals blank when the cited source does not state a fixed interval instead of converting condition-based service guidance into an invented schedule.
- [ ] Expand licensed/public authoritative service-interval, fluid and capacity coverage to additional deep vehicle families.
- [ ] Add notification delivery for due maintenance.
- [ ] Add receipt-image/PDF storage and extraction.
- [ ] Add email-receipt ingestion with explicit account permission and merchant/vehicle matching.
- [ ] Generate a shareable maintenance report suitable for a vehicle sale, including source documents and receipt links.

## Priority 3 — Interchangeable parts across makes and models

**Status: first reviewed pilot implemented.**

Create a first-class **interchange group** separate from ordinary fitment. A shared steering wheel, brake caliper, sensor, transmission, engine accessory or OEM component can therefore be discovered on a different make/model without pretending every member has identical installation requirements.

- [x] Add a reviewable interchange-group data contract separate from fitment rules.
- [x] Add automated validation that interchange part IDs and evidence are reviewable.
- [x] Add the first cross-make pilot for PERRIN PSP-BRK-406BK across documented BRZ / FR-S / 86 / GR86 applications.
- [x] Preserve manufacturer model-year gaps instead of flattening application ranges.
- [x] Show reviewed shared applications and constraints in part details without mutating exact fitment.
- [ ] Expand to OEM/shared components where donor pricing can materially differ by make/model listing.
- [ ] Add normalized donor listing price comparison and a “cheaper donor application” view.
- [ ] Add modification-required and adapter-required examples.
- [ ] Add community submission flow with moderator/evidence review.

Data contract includes:

- canonical component/interchange group ID
- manufacturer/OE part numbers and supersessions
- donor applications
- recipient applications
- exact / direct / modification-required / unknown installation class
- connector, spline, bolt pattern, dimensions or other relevant matching attributes
- required adapters or supporting parts
- evidence source and retrieval date
- community-confirmed examples kept separate from manufacturer/catalog evidence

The normal exact-fitment engine must never infer interchange merely because two applications share a platform or engine family.

## Priority 4 — Engine, transmission and platform build-outs

Extend the existing Engine / platform mode into a real swap/build workspace.

- [ ] Canonical engine-family records with generation/revision distinctions.
- [ ] Transmission-family records and bellhousing/input/output relationships.
- [ ] Engine/transmission swap compatibility records.
- [ ] Chassis-specific mount, oil-pan, accessory-drive, wiring, ECU, driveshaft, cooling, fuel and exhaust requirements.
- [ ] Build templates for common swaps.
- [ ] Donor-car and donor-part discovery.
- [ ] Swap-specific build sheets independent of the original engine.

## Priority 5 — Goal-driven build generation

**Status: dependency-aware deterministic starter planner implemented; evidence-aware optimizer remains future work.**

Examples:

- “I want about 100 more horsepower, reliably, on a budget.”
- “Make the car track-capable but still streetable.”
- “Fix the weak points before I add power.”
- “Lower it without making the ride harsh.”

Planner constraints should include budget, target output, reliability, emissions/legal constraints, noise, comfort, installation skill, existing mods, known problems and maintenance debt.

Implementation stages:

1. [x] deterministic category/constraint planning using current catalog fields, exact source-listed fitment and observed price;
2. [ ] evidence-backed performance ranges from dyno/manufacturer/test sources;
3. [~] prerequisite/conflict graph — the starter planner now consumes recorded `requires` and `conflicts`; broader graph coverage remains to be authored and validated;
4. [ ] optimizer that proposes multiple complete build sheets rather than one opaque answer;
5. [ ] AI explanation layer that cites the underlying records and user preferences.

The current starter planner preserves existing build items, uses the Garage budget and goal, counts saved quantities and paid-price overrides, rejects recorded conflicts, adds recorded supporting requirements when they are source-listed/priced and fit the budget, and does not interpret the target-horsepower field as an additive power calculation.

Do not resurrect unsupported additive horsepower totals. Power targets require measured or otherwise sourced configuration evidence.

## Priority 6 — Community/forum consensus assistant

- [ ] Ingest allowed forum, Reddit, video and article references into normalized discussion records.
- [ ] Cluster discussions by exact part/platform/topic.
- [ ] Separate factual claims, recurring issues, installation notes and subjective opinions.
- [ ] Generate an AI overview of common themes with links to the original discussions.
- [ ] Show disagreement and sample size instead of presenting “the internet says” as fact.
- [ ] Cache summaries and regenerate only when source material materially changes.

## Priority 7 — Local shops and services

Shop categories include:

- lowered-car alignment / specialty alignment racks
- dyno and tuning
- European / Japanese / domestic specialists
- performance fabrication
- wrap / tint / PPF
- body / paint
- wheel/tire
- machine shops
- mobile specialists / community-recommended individuals

Planned ranking inputs should be transparent: service category, distance, current rating/review volume when licensed for use, community recommendations, vehicle specialties, equipment/capabilities and verified business information.

Location must be opt-in. Community recommendations must be distinguishable from third-party reviews and paid placement.

## Priority 8 — Used-parts marketplace search

Create a normalized used-listing adapter instead of tying the UI to one marketplace.

- [ ] eBay API/allowed feed adapter first.
- [ ] Craigslist or other marketplace adapters only where terms/robots/API access allow automated retrieval.
- [ ] Evaluate Marketplace access separately; do not depend on an unsupported private scraper for production.
- [ ] Search by canonical part number, aliases, interchange group and donor applications.
- [ ] Normalize price, shipping, condition, location, seller, listing age and source URL.
- [ ] Deduplicate cross-posted listings when possible.
- [ ] Flag suspiciously low prices and ambiguous fitment rather than silently ranking them first.

“Swoopa-style” source coverage is a product goal, but each source needs its own permitted access strategy rather than copying an unknown scraper implementation.

## Priority 9 — Local/community social layer

- [ ] Public/private build profiles.
- [ ] Progress posts with photos and linked build-sheet changes.
- [ ] Repair/upgrade questions tied to exact vehicle and installed parts.
- [ ] Local meets and track events.
- [ ] Follow builds/vehicles/users.
- [ ] Community recommendations for shops and interchange examples.
- [ ] Reporting, moderation, spam controls and rate limits before broad public posting.

## Priority 10 — Vehicle visualizer / AI render

Generate a visual preview from the selected car, current photos and proposed build sheet.

- wheel/tire stance
- ride height
- body/aero parts
- colors/wrap
- lighting and trim changes

Architecture goal: support ModPicker-hosted inference as an optional provider while allowing advanced users to connect a compatible external/local diffusion service. Treat generated images as visual concepts, not dimensional fitment proof.

## UI improvements

**Ongoing.**

- [ ] simplify the home page and reduce simultaneous controls;
- [x] elevate Garage and build planning into primary navigation/workflows;
- [x] move advanced filters behind a secondary control on small screens;
- [ ] use vehicle graphics and opt-in community-submitted images;
- [x] keep exact vehicle / platform / build context persistent and obvious;
- [x] keep evidence and fitment warnings visible without allowing uncertainty to silently become compatibility;
- [x] continue mobile overflow checks in automated browser testing.

## Testing and release quality

- [x] Keep deterministic Python catalog/unit tests.
- [x] Add pull-request JavaScript syntax checks.
- [x] Add pull-request Playwright smoke tests rather than relying only on manual browser checks.
- [x] Cover Garage profile persistence, maintenance calculations, codes, receipts, starter planning, budget accounting, recorded dependencies/conflicts, interchange UI and collapsible mobile filters in browser smoke tests.
- [x] Add keyboard-navigation regression coverage for primary navigation, expandable mobile filters and native dialog dismissal.
- [ ] Add a broader automated accessibility audit (roles, labels, contrast and semantic checks).
- [x] Retain desktop/mobile browser screenshots as CI artifacts for visual review.

## Naming track

Working candidates from product planning:

- ModPicker — current project/working name
- VOSS — Virtual One Stop Shop
- MVG — My Virtual Garage
- a short name built around “virtual garage” remains an open naming direction

Before a rename, run domain, app-store, search-confusion and trademark screening. The codebase should avoid hard-coding a replacement brand until that review is complete.

## Cost / architecture principles

- Keep the static GitHub Pages frontend viable.
- Use Supabase free-tier capabilities where practical for normalized relational data, auth and small-scale storage.
- Prefer scheduled GitHub Actions and permitted public/free APIs for ingestion.
- Cache expensive AI/forum-summary work and regenerate only when inputs change.
- Keep AI optional for core fitment, pricing and maintenance facts; those should remain source-backed structured data.
- Allow bring-your-own inference/API connections where this materially reduces hosted cost and can be done safely.

## Implementation order

1. Finish Garage/profile and maintenance UX, tests and data export. **Prototype coverage substantially complete; account/media work remains.**
2. Add a reviewed interchange-group schema and one small real-world pilot family. **First pilot complete; expand donor-price use cases next.**
3. Add goal/build-plan input and deterministic prerequisite planning. **Starter planner now consumes current recorded dependency/conflict rules; broader rule coverage and multi-plan optimization remain.**
4. Add sourced maintenance specifications for the first deep vehicle families. **BMW Z3 2.8 oil/coolant pilot complete; expand authoritative coverage next.**
5. Add forum/community evidence normalization and cached consensus summaries.
6. Add eBay/used-listing adapter.
7. Add accounts/media sync, local shops and community submissions.
8. Add social features only after moderation/privacy controls exist.
9. Add visualizer/provider integrations after build-sheet identity and photo storage are stable.
