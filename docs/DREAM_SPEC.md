# Dream Spec implementation and deployment

## Appearance and rollback

The default is Racing + Light. The header toggle switches color mode; Account → Appearance switches Racing/Classic. Both preferences use the non-sensitive dreamspec-appearance-v1 localStorage item. Preferences load in the document head to avoid a dark flash. Classic + Dark retains the earlier styling of existing screens.

All new styling is in dreamspec-theme.css, scoped to the root data-ds-ui/data-ds-color attributes. Removing ds-appearance.js and that stylesheet disables the new appearance layer. The separate new hub/account/planner markup and backend features remain functional. Old catalog/style files and the source-linked car/truck concept asset remain available.

## Existing data and internal names

Visible app branding, titles and exported filenames say Dream Spec. modpicker-state-v2, modpicker-owner-garage-v1, the existing data globals and catalog IDs remain compatibility identifiers, not display branding. Do not mass-rename those identifiers or the GitHub repository/OIDC audience.

Garage data now uses authenticated owned_vehicles UUIDs. Two owned vehicles can share a catalog application and keep separate profiles/builds. Private cloud profiles and build sheets stay in memory, not the legacy localStorage keys. Logout clears private form data and restores the public/local working build. A per-tab route preference and Supabase session use sessionStorage; the AI key uses neither storage API.

The explicit "Import my previous browser garage" action copies legacy profiles/builds into the current account and preserves the originals. A per-owner import key prevents repeated imports. Profile export embeds private photos into a portable JPEG-backed JSON file; import applies only to the matching saved application. Photos are compressed, limited to four and stored in a private Storage bucket.

## Supabase deployment

Private account project: kpbhtjllscadpigxyhpj (Dream Spec, in Dream Spec Org).
Public catalog project: pzxofwrdidvqhdlqbehk (the existing read-only catalog and its unchanged ingestion pipeline).

The private project owns Auth, owned_vehicles, diagnostic_runs, vehicle_events, and the private vehicle-photos bucket. The browser's account configuration points only to this private project. The diagnosis function reads canonical vehicle/part fitment through the existing catalog's public key; it never forwards an account JWT, symptoms, profile, or AI key to that catalog project. Public browsing still uses supabase-bridge.js and its bundled-data fallback.

1. Review and apply supabase/migrations/20261020170000_dream_spec_private_garage.sql. It only adds owned-vehicle, diagnostic-run/event tables, policies, RPCs and a private photo bucket. It does not alter catalog ingestion tables.
2. Enable email/password authentication and email confirmations. Set Site URL to https://imsambtw.github.io/modpicker/ and allow the same redirect URL for confirmation/recovery. Keep email confirmations enabled. Configure custom SMTP before allowing public signups: Supabase's default mail delivery is limited to project-team email addresses.
3. Deploy supabase/functions/dreamspec-diagnose with verify_jwt=true.
4. Optional overrides: DREAMSPEC_PUBLISHABLE_KEY for the private project, DREAMSPEC_CATALOG_URL / DREAMSPEC_CATALOG_KEY for the read-only catalog. Safe public-key defaults and the platform's SUPABASE_ANON_KEY keep deployment independent of custom secret setup.
5. Set DREAMSPEC_ALLOWED_ORIGINS=https://imsambtw.github.io and DREAMSPEC_DIAGNOSIS_MODEL=gpt-5-mini. Add explicit localhost origins only for local development. Do not add OPENAI_API_KEY: there is deliberately no host-credential fallback.
6. Run node tests/dreamspec-live.mjs for read-only endpoint checks and verify owned-row/photo isolation between two accounts. No provider key is needed for these checks. Never run the bootstrap SQL test directly against a hosted project; its live isolation equivalent must use a transaction with rollback.

The publishable key is public configuration. Supabase secrets and provider credentials must never be committed. The add-on UI fails closed if user verification, the private tables or the function are unavailable.

## Hosted deployment status

On 2026-10-20 the private schema and JWT-protected dreamspec-diagnose Edge Function were deployed to kpbhtjllscadpigxyhpj. A hosted PostgreSQL transaction verified account separation, rejected foreign writes and photo access, enforced cross-owner diagnostic references, and proved idempotent unconfirmed history; all synthetic rows were rolled back.

The Supabase connector cannot edit hosted Auth URL or SMTP settings. Before releasing account creation, confirm Site URL and the allowed redirect are both https://imsambtw.github.io/modpicker/ in Authentication → URL Configuration. Add SMTP credentials directly in Authentication → Email → SMTP settings when enabling non-team signups.

Appearance rollback requires no database deletion. To pause diagnosis independently, disable the function or stop routing to it; retain private data. Catalog ingestion remains unchanged.

## Diagnosis flow

A logged-in user selects a saved vehicle and connects an OpenAI API key for the current tab. The backend verifies the Supabase user, checks ownership using that user's RLS-scoped token, loads canonical application metadata, and reserves a request UUID before calling OpenAI. No service-role client is used.

One Responses API call performs web search and returns a structured diagnostic plan. Both model and search charges use the request's key; store:false disables response storage. The key is never part of the model prompt, database writes, diagnostic history or application logs. Only the fixed OpenAI endpoint receives it. Reload, logout and disconnect clear the browser's copy.

The model sees vehicle details, symptoms/codes, modifications, known problems and a limited maintenance context. Retrieved forum/DIY references are displayed with clickable sources. Only URLs found in actual tool-result sources/citations can be displayed as retrieved evidence. User text and forum content are treated as untrusted data.

Replacement components remain conditional on confirming the fault. Exact catalog part numbers are accepted only from source-listed fitment records for the canonical vehicle. The function cannot establish a physical fault or exact VIN-specific supersession from a code alone; unknown parts/fitment remain unknown.

The result is transactionally written to the selected vehicle's history as an unconfirmed diagnostic session. Idempotent request IDs prevent duplicate inference/logging. User/vehicle foreign keys prevent cross-owner history attachments. If inference completes but history saving fails, the UI retains the result and offers retry-save without another AI call. A user must explicitly record repair/verification notes to resolve an entry.

## Guided upgrades

ds-core.js is a pure planner shared by the public goal path and Garage. It checks exact source-listed fitment, dependencies, conflicts, current USD observations and known labor cost. Preview never changes a build; applying requires a separate click and a still-matching vehicle/build state. Missing prices/hours/rates remain explicit.

Off-road/weight-reduction recommendations require explicit matching catalog tags; ordinary components are not inferred to improve either goal. No additive horsepower or weight-reduction totals are invented.

## Verification

- node tests/dreamspec-core.cjs
- node tests/dreamspec-backend.mjs
- node tests/dreamspec-live.mjs (read-only hosted checks; no account creation or AI inference)
- node tests/browser-smoke.cjs
- node tests/garage-smoke.cjs
- node tests/ui-cleanup-smoke.cjs
- node tests/dreamspec-browser.cjs
- psql ... -f tests/dreamspec-rls.sql (isolated test database only)

Browser tests mock auth/network only in tests/dreamspec-fixture.cjs. Production has no test-login bypass. The backend tests check no-host-token fallback, forged/foreign requests, actual retrieval citations, idempotency and logging failures. The SQL workflow exercises the migration and RLS in a real isolated PostgreSQL instance. Browser captures are uploaded as GitHub Actions artifacts.

Authoritative API references checked during implementation:
- https://supabase.com/docs/reference/javascript/auth-getuser
- https://supabase.com/docs/guides/database/postgres/row-level-security
- https://supabase.com/docs/guides/functions/auth
- https://developers.openai.com/api/docs/guides/tools-web-search
- https://developers.openai.com/api/docs/guides/structured-outputs
