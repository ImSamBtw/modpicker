# Dream Spec implementation and deployment

## Appearance and rollback

The default is Racing + Light. The header toggle switches color mode; Account → Appearance switches Racing/Classic. Both preferences use the non-sensitive dreamspec-appearance-v1 localStorage item. Preferences load in the document head to avoid a dark flash. Classic + Dark retains the earlier styling of existing screens.

All new styling is in dreamspec-theme.css, scoped to the root data-ds-ui/data-ds-color attributes. Removing ds-appearance.js and that stylesheet disables the new appearance layer. The separate new hub/account/planner markup and backend features remain functional. Old catalog/style files and the source-linked car/truck concept asset remain available.

## Existing data and internal names

Visible app branding, titles and exported filenames say Dream Spec. modpicker-state-v2, modpicker-owner-garage-v1, the existing data globals and catalog IDs remain compatibility identifiers, not display branding. Do not mass-rename those identifiers, the repository basename or the GitHub OIDC audience. The repository owner changed by transfer; the ingestion trust rule must follow its new exact owner/repository identity.

Garage data now uses authenticated owned_vehicles UUIDs. Two owned vehicles can share a catalog application and keep separate profiles/builds. Private cloud profiles and build sheets stay in memory, not the legacy localStorage keys. Logout clears private form data and restores the public/local working build. A per-tab route preference and Supabase session use sessionStorage; the AI key uses neither storage API.

The explicit "Import my previous browser garage" action copies legacy profiles/builds into the current account and preserves the originals. A per-owner import key prevents repeated imports. Profile export embeds private photos into a portable JPEG-backed JSON file; import applies only to the matching saved application. Photos are compressed, limited to four and stored in a private Storage bucket.

## Supabase deployment

Private account project: kpbhtjllscadpigxyhpj (Dream Spec, in Dream Spec Org).
Public catalog project: pzxofwrdidvqhdlqbehk (the existing read-only catalog and its unchanged ingestion pipeline).

The private project owns Auth, owned_vehicles, diagnostic_runs, vehicle_events, and the private vehicle-photos bucket. The browser's account configuration points only to this private project. The diagnosis function reads canonical vehicle/part fitment through the existing catalog's public key; it never forwards an account JWT, symptoms, profile, or AI key to that catalog project. Public browsing still uses supabase-bridge.js and its bundled-data fallback.

The following is the deployment reference, not a request to repeat completed deployment. Verify the existing project before applying changes.

1. For a new, undeployed project, review and apply supabase/migrations/20261020170000_dream_spec_private_garage.sql. It only adds owned-vehicle, diagnostic-run/event tables, policies, RPCs and a private photo bucket. It does not alter catalog ingestion tables. The existing private project already has this migration; do not blindly reapply it.
2. Enable email/password authentication and email confirmations. Set Site URL to https://imsambtw.github.io/modpicker/ and allow the same redirect URL for confirmation/recovery. Keep email confirmations enabled. Configure custom SMTP before allowing public signups: Supabase's default mail delivery is limited to project-team email addresses.
3. Deploy supabase/functions/dreamspec-diagnose with verify_jwt=true.
4. Optional overrides: DREAMSPEC_PUBLISHABLE_KEY for the private project, DREAMSPEC_CATALOG_URL / DREAMSPEC_CATALOG_KEY for the read-only catalog. Safe public-key defaults and the platform's SUPABASE_ANON_KEY keep deployment independent of custom secret setup.
5. Set DREAMSPEC_ALLOWED_ORIGINS=https://imsambtw.github.io and DREAMSPEC_DIAGNOSIS_MODEL=gpt-5-mini. Add explicit localhost origins only for local development. Do not add OPENAI_API_KEY: there is deliberately no host-credential fallback.
6. Run node tests/dreamspec-live.mjs for read-only endpoint checks and verify owned-row/photo isolation between two accounts. No provider key is needed for these checks. Never run the bootstrap SQL test directly against a hosted project; its live isolation equivalent must use a transaction with rollback.

The publishable key is public configuration. Supabase secrets and provider credentials must never be committed. The add-on UI fails closed if user verification, the private tables or the function are unavailable.

## Hosted deployment status

On 2026-10-20 the private schema and JWT-protected dreamspec-diagnose Edge Function were deployed to kpbhtjllscadpigxyhpj. A hosted PostgreSQL transaction verified account separation, rejected foreign writes and photo access, enforced cross-owner diagnostic references, and proved idempotent unconfirmed history; all synthetic rows were rolled back.

Owner-confirmed on 2026-10-20: Site URL and allowed redirect are both https://imsambtw.github.io/modpicker/. Resend domain verification and custom SMTP are configured, with a Sending key restricted to dream-spec.net, sender Dream Spec <noreply@dream-spec.net>, host smtp.resend.com, port 465 and username resend. The password was entered directly in Supabase. Keep email confirmations enabled. These settings establish configuration, not successful signup, confirmation, login or recovery email delivery.

The domain purchase and SMTP setup do not establish a website cutover to dream-spec.net. Hosting/HTTPS, Auth URLs, function CORS and subpath handling must be coordinated separately before any cutover.

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

## Release verification follow-up — 2026-10-20

PR #11 remains a draft targeting main. At initial inspection, its fetched head was 84d61c73fd0270a9ed9d44c085c607fb25c4e2cf; subsequent release-note commits continue on the same PR. The current cloud checkout is refactor/dream-spec-hub. The public GitHub Pages URL must not be assumed to contain this unmerged branch.

The public GitHub Actions run pages for that head report Success: [PR validation](https://github.com/ImSamBtw/modpicker/actions/runs/39475466669), [UI smoke](https://github.com/ImSamBtw/modpicker/actions/runs/39475466688), [database isolation](https://github.com/ImSamBtw/modpicker/actions/runs/39475466485), and [push validation](https://github.com/ImSamBtw/modpicker/actions/runs/39475459798). These are recorded CI results, distinct from fresh hosted verification in this environment.

Fresh local checks passed: 49 Python tests, manual catalog validation, publication validation (194 parts), JavaScript syntax, vehicle-make regression, Dream Spec core/backend regressions, and all four browser suites (existing application, Garage, UI cleanup and Dream Spec). Browser checks used Playwright with system Chromium 154 and Node 24; CI's Node 22 / Playwright Chromium combination remains the release reference. The isolated PostgreSQL 16 test passed ownership, private-photo, foreign-write and idempotent unconfirmed-history assertions and rolled back its synthetic data. It was not run against production.

This cloud environment currently has Git read access and public GitHub page access, but GitHub API and hosted website/Supabase requests are blocked by its egress policy. The read-only live test did not complete; a proxy-aware retry confirmed HTTP CONNECT 403. Required domains were saved in the cloud environment configuration draft: api.github.com, imsambtw.github.io, kpbhtjllscadpigxyhpj.supabase.co, pzxofwrdidvqhdlqbehk.supabase.co and dream-spec.net. Saving that draft does not activate networking or independently verify deployed schema/function versions. No Supabase management connector or CLI authentication was available; do not recreate projects or infer admin access from the public key.

### Owner-operated email acceptance check

The active owner-operated preview is now https://dream-spec-git-preview.pages.dev/, connected to the transferred GitHub repository's refactor/dream-spec-hub branch in Cloudflare Pages. It supersedes the direct-upload preview at https://dream-spec-preview.pages.dev/; the earlier workers.dev preview was deleted. Add the exact active preview URL, including its trailing slash, to the private project's Auth allowed redirects. Auth redirects are origin/path based in ds-auth.js. Email testing does not require changing diagnosis-function CORS or making a paid AI call; an Auth redirect entry does not establish an allowed diagnosis origin.

Owner-reported acceptance on 2026-10-20: signup sent a real confirmation email, the owner followed the confirmation link, returned to the preview and accessed My Garage. The owner subsequently verified logout and a separate password login. The original recovery submission showed "Cannot read properties of null (reading 'reset')"; after deploying the fix to the Git-connected preview, the owner confirmed the complete reset flow and login with the new password passed. Email signup, confirmation, password login, logout and recovery are accepted on that preview. Persisted vehicle writes and two-account isolation remain pending. No passwords, callback tokens or email links were collected. Hosted management inspection and paid diagnosis remain unverified.

The recovery submit handler read event.currentTarget after awaiting the password-update request; browsers clear currentTarget after dispatch. The fix captures the form before awaiting, then clears it and exits recovery mode after success. The password may already have changed despite the old UI error. A browser regression exercising a recovery callback, a rejected update and a successful retry failed before the fix and now passes, including password-field clearing and success feedback. The full Dream Spec browser suite and core/backend regressions passed locally with this change. Real recovery acceptance subsequently passed on the Git-connected preview. Direct-upload deployments do not update when the PR branch is pushed; the current Git-connected preview does.

1. In a private browser window, open the preview and choose Log in. Create an account using an email address you control and a unique password of at least 12 characters. Enter passwords only into the application. Confirm that the app asks you to check email and does not expose private Garage before confirmation.
2. Check inbox/spam and verify the sender is Dream Spec <noreply@dream-spec.net>. Follow the confirmation link, confirm it returns to the same allowed preview origin, and verify the account is recognized. Callback tokens should disappear from the URL after processing. Never share the email link, tokens or full callback URL.
3. Log out, then log in with the confirmed email/password. Save two vehicles with the same catalog application and distinct nicknames; reload and verify separate records. Log out and verify the private Garage is hidden. A second account should see none of the first account's vehicles or photos.
4. While signed out, enter the email and choose Forgot password. Follow the recovery email on the same allowed origin; the app should show its password-update form. Set a new unique password of at least 12 characters, log out and verify login with the new password. Verify the old password fails. Do not send either password in chat.
5. Report only pass/fail for each step, the origin/path without query or fragment, and any visible error with personal details removed. Remove temporary preview/local redirects when the corresponding test site is retired.

Keep PR #11 unmerged until fresh hosted checks and real email acceptance are recorded; CI is currently green at the inspected head. Hosted migration/function version inspection and live authenticated ownership checks remain separate from local fixtures. A real paid BYOK diagnosis remains untested; any such test uses the owner's in-memory key and explicit action in the app. Do not introduce a host-funded fallback or store the key.

### Repository transfer and remaining release settings

The repository and PR #11 are now at https://github.com/jakehenry076-cmd/modpicker. The local origin was updated to that canonical URL. PR #11 remains open and draft; GitHub reports its existing validation, UI, database-isolation and Cloudflare deployment checks successful at 8017ae6. GitHub Pages is configured for main root at https://jakehenry076-cmd.github.io/modpicker/ with HTTPS; the previous owner's https://imsambtw.github.io/modpicker/ now returns HTTP 404. The new GitHub Pages URL was not independently fetched because that hostname is currently blocked in this execution environment.

The owner reports Supabase Site URL still points to the old GitHub Pages site. Set it to https://dream-spec-git-preview.pages.dev/ while this is the working verification site, retaining that exact URL in allowed redirects. There must be no extra final period in the field. This changes the fallback for Auth emails; it does not connect dream-spec.net or require SMTP changes. Replace the fallback and coordinate redirects/CORS again when a permanent production URL is selected. Retire obsolete redirect entries with their corresponding sites.

Fresh read-only hosted checks now pass through the configured proxy: email Auth availability, anonymous private-table denial, function JWT gate, CORS for the original GitHub origin and public catalog field compatibility. Management access to deployed source/version metadata is still unavailable. The current preview's origin test (DREAMSPEC_TEST_ORIGIN=https://dream-spec-git-preview.pages.dev NODE_USE_ENV_PROXY=1 node tests/dreamspec-live.mjs) fails with HTTP 403 on the diagnosis function. Auth acceptance does not prove diagnosis CORS readiness. Add the exact origin https://dream-spec-git-preview.pages.dev (without a trailing slash) to DREAMSPEC_ALLOWED_ORIGINS in the existing private project kpbhtjllscadpigxyhpj, preserving other still-required entries in the comma-separated list, then rerun that read-only check. No AI key or paid inference is needed to verify preflight and authentication rejection.

The latest production catalog refresh [run 39502014542](https://github.com/jakehenry076-cmd/modpicker/actions/runs/39502014542) failed at the Supabase sync step. Detailed failure logs are inaccessible through the current proxy, so its precise error is not established. Independently, the source still trusted ImSamBtw/modpicker, which would reject tokens from the transferred repository. The source trust rule is now jakehenry076-cmd/modpicker; issuer, signature verification, audience modpicker-supabase, main-only and workflow/event checks are retained. The authorization regression failed before this correction and passes afterward, including rejection of the old owner and unauthorized refs/workflows without catalog writes.

Source changes do not deploy the hosted catalog function. The owner must update ingest-github-pipeline in the existing public catalog project pzxofwrdidvqhdlqbehk to use the same repository identity, preserving all other deployment/authentication settings, then rerun the existing production data workflow and inspect its result. No migration, project recreation or service credential in the browser is needed. Keep the PR unmerged while required deployment and private-data verification remain outstanding.
