# Orçaly Ecosystem — Final checkpoint report

## Current staging checkpoint — 26/09/2026

Production remains read-only. Staging `zwxulgpjucxudadjdqov` now contains a catalog-derived schema-only baseline plus the existing Wealth migration. Audit covers 71 local files and 51 remote ledger entries. Baseline comparison: zero semantic differences in audited metadata. Final delta: 154 additions belonging only to the six Wealth/ecosystem tables and their supporting objects; no existing object changed.

Hosted Supabase E2E: 13 checks PASS, fixture users/audit rows cleaned. Types generated. Build/typecheck/60 regression tests/scoped lint PASS. Real E2E found and fixed login destination loss after rerender and consent revocation clock/microsecond skew. No historical replay, production db push, migration repair, data copy or production promotion occurred.

Vercel CLI authentication was renewed by the owner. Preview-only variables for branch `codex/orcaly-ecosystem` now target staging and enable Wealth there. Verification of the Vercel URL is still in progress at this checkpoint. Production configuration is unchanged. See `reconciliation/STAGING_VALIDATION.md`, `BASELINE_STRATEGY.md`, the complete migration matrix and comparison JSONs. These current results supersede the earlier no-staging/no-hosted-test statements preserved below.

## Prior implementation checkpoint (historical context)

Date: 2026-09-26 UTC. Overall status: PARTIAL. This is a verified implementation checkpoint, not completion of the entire master specification.

## Executive Summary

The initial repository contained Business, a partner portal, a tenant storefront and substantial integration work already in progress. It lacked the ecosystem registry, personal Wealth data boundary and App Hub. Build, generated types, dependency installation and global lint had existing problems.

The repository now builds with its locked Next 16.3.4 version. It includes the ecosystem Home, product discovery, authenticated Hub, preserved Business marketing and a usable personal Wealth core backed by a tested additive schema. The financial flow was exercised through the browser, real Server Actions and isolated PostgreSQL RLS. No hosted migration or production release occurred. The larger ecosystem still requires substantial implementation.

## Git

- Branch: codex/orcaly-ecosystem.
- Base: 5d1a1f640b0b2e4be873587b61d299e87bd39dd7.
- 00aa4f7c2465c4b07cdda3468aff11195e5e8e98: separate preservation of existing integration expansion, plus the small provider-form lifecycle repair.
- c3f367b87b844dbe85220264ebe6fa0f5b647a3c: validated ecosystem/Wealth implementation, tests and architecture docs.
- Final HEAD: the documentation checkpoint containing this report follows c3f367b; obtain its exact hash with git rev-parse HEAD. The application commit tested and deployed is stated above.
- Remote: https://github.com/viniciusaraujoop/grafica-flash.git. Implementation pushed after explicit authorization.
- No reset, force push, merge to main or production promotion.

## Product Implementation

| Product | Status | Evidence / remaining scope |
| --- | --- | --- |
| Business | PARTIAL, preserved | Existing /painel, permissions, pricing and integrations retained; former Home at /business. Invariant/payment tests pass. Full customer→order→finance live E2E remains open. |
| Wealth | PARTIAL | Profile, budget, reserve, income/expenses/assets/liabilities, goals, scenario calculator, persistence, entitlement and RLS. Edit/archive, pagination, recurring jobs, richer holdings/debt analytics, family context and export remain open. |
| Growth | NOT_STARTED beyond discovery | Registry and public description only; no new acquisition/Experiment OS backend. |
| Flow | NOT_STARTED beyond discovery | Existing job system retained; no new builder, approval execution or replay UI. |
| Academy | NOT_STARTED beyond discovery | No book catalog/reading notebook backend, licensed content import, recommendation or learning engine. |
| Market | NOT_STARTED beyond discovery | Existing tenant storefront retained; new ecosystem tools/services marketplace not implemented. |
| Partners | PARTIAL, preserved | Existing referral portal and commissions retained and discovered by Hub. No new commercial provider or payout flow. |
| One | NOT_STARTED beyond discovery | Proposal page only; no bundle billing or implied access to other products. |

Life is absent as a separate product. Personal finance belongs to Wealth. Availability labels reflect actual status.

## Platform

| Capability | Status / evidence |
| --- | --- |
| ID | PARTIAL: existing Supabase identity reused; personal destination, authenticated Home redirect, MFA boundary and safe next path. Hosted refresh/session E2E pending. |
| Entitlements | PARTIAL: server-enforced personal access and real SQL policies; read-only client grants. No commercial issuance/bundle lifecycle yet. |
| Experience | PARTIAL: single registry, product tokens, shared shell and Wealth theme; broader product experiences pending. |
| PWA | PARTIAL: master manifest and actual browser install affordance. Product PWA icons, subdomains, offline and push not implemented. |
| Intelligence | NOT_STARTED for shared platform; preexisting Business assistant retained. No new model router, receipts, evaluations or live inference verification. |
| Affiliate | NOT_STARTED for new commerce providers. Existing referrals retained; no fabricated Amazon/Mercado Livre capabilities. |
| App Hub | PARTIAL: verified identity and real company/partner association discovery, gated Wealth, privacy and installation. Unified notifications/briefing/billing pending. |
| Home | Implemented and locally verified: eight products, intent paths, journeys, One, ID/privacy and Business bridge. |
| Billing | Existing Business billing preserved. New individual products/bundles not connected. |
| Consents | PARTIAL: exact contract validation, owned rows and constrained revocation. Grant creation and transfer consumers not enabled. |
| Events | PARTIAL: private identifier-only audit events for new tables. Existing outbox/jobs retained; no new cross-product event consumers. |

## Database

Migration: supabase/migrations/20260926014103_ecosystem_identity_wealth.sql, generated with pinned Supabase CLI 2.118.0 and additive transaction.

Six tables: ecosystem_product_entitlements, ecosystem_context_consents, wealth_profiles, wealth_entries, wealth_goals, ecosystem_audit_events. All enable RLS. Personal data requires owner identity plus active permission. Client writes cannot reassign ownership or create commercial grants. Consent UPDATE grants only revoked_at and cannot restore revoked consent. Financial amounts are constrained integer cents, BRL and bounded dates.

Eight explicit supporting indexes cover subject/product uniqueness, consent owner/company lookup, personal entries/goals dates and audit actor/date; primary and idempotency constraints add their own indexes. Private functions use fixed search paths; access checks use invoker rights, audit triggers use definer rights with direct execution revoked. Audit events omit amounts and private text.

Applied environments: isolated ephemeral PGlite only. No hosted Supabase migration. Production metadata: 111 RLS-enabled public tables, 143 policies, 510 indexes, 173 foreign keys, 38 triggers and 51 migration records. Historical local/remote drift makes blind db push unsafe. The owner confirmed no staging project.

## Security

Fixed: build-blocking form state effect, stale generated types, locked dependency drift, six dependency advisories, client-side login redirect race and unsafe encoded login destinations.

Verified locally: cross-user read/write/delete denial, owner reassignment rejection, unentitled/read-only/expired/revoked grants, company grant boundary, exact consent scope/purpose/expiry, idempotent entries, anonymous denial and private audit access.

The hosted get_my_platform_admin_access function was reviewed as intentionally restricted to auth.uid and active roles; existing grants retained. Leaked-password protection is disabled on the hosted project. Forty-four no-policy advisor notices require classification, not broad policies.

Residual validation: hosted Auth/MFA/refresh, storage and all existing APIs/workers, rate limiting, retention/export/deletion, production provider webhooks and existing Business critical journey. Local gateway tests do not certify hosted Supabase. No secret values were printed or committed by the new work.

## QA

| Command / check | Result |
| --- | --- |
| npm run build | PASS, Next 16.3.4; prebuild includes existing tests, payments and focused lint |
| npm run test:ecosystem | PASS, 60 tests: 42 contracts/domain, 18 PostgreSQL/RLS |
| npm run typecheck | PASS |
| npm run security:check | PASS |
| npm run e2e:ecosystem | PASS, 11 browser checks, zero page errors |
| axe Home and Wealth | PASS, no WCAG A/AA violations in scanned states; full manual screen-reader assessment not done |
| Responsive | PASS at 320, 390, 768, 1440 and 1920 pixels; no horizontal overflow |
| npm audit | PASS, 0 vulnerabilities |
| New ecosystem lint | PASS, 0 errors/warnings |
| npm run lint (global) | FAIL, 257 errors / 148 warnings / 666 files; baseline 258/129/644 before installed-tool correction |
| git diff --check | PASS |

Final global warnings are in preexisting files. The old/new lint runs used different installed Next/eslint versions, so the warning increase is recorded without claiming a clean global result.

Browser coverage: public product links, Business 49.90 price, invalid Life route, private login redirect, authenticated Home→Hub, Wealth profile/budget/entry/goal/simulation/reload and persisted exact cents, cross-user privacy and unentitled denial. Auth/PostgREST is a synthetic loopback protocol fixture connected to real isolated PostgreSQL. No production data was used.

Durable evidence: docs/qa/ORCALY_EVIDENCE.json. Full logs/screenshots remain ignored in .local-qa (final-build.log, final-typecheck.log, final-audit.json, final-e2e.log, security-check.log and ecosystem-browser/). Earlier baseline logs under .next can be removed by Next builds; numerical baseline findings are retained here.

## Performance

Production compilation completed in 12.9 seconds; 166 static pages generated in about 1.1 seconds on this machine. The whole build's static chunks total 3,670,992 uncompressed bytes across 135 files; this is not a per-route download metric. Largest single JS chunk is about 250 KB. Lighthouse and production Web Vitals were not measured.

Home is server-rendered with small interactive islands; product images use Next Image and original source assets. Wealth reads are bounded, but proper pagination/aggregation is still needed. No private financial data is cached offline. Existing application bundle hotspots were not broadly refactored.

## Integrations

These are verification states for this execution, not assertions that an existing customer account lacks credentials.

| Provider / capability | State | Evidence |
| --- | --- | --- |
| Supabase production | BLOCKED_EXTERNAL for release validation | Read-only audit works; isolated hosted staging absent. New migration not applied remotely. |
| Vercel Preview | DONE | Authorized Git deployment READY; exact-commit and 7 read-only hosted browser checks passed. |
| Google Calendar | BLOCKED_EXTERNAL for live verification | Existing engineering/unit checks retained; no live OAuth/calendar mutation performed. |
| Resend | BLOCKED_EXTERNAL for live verification | Existing engineering/unit checks retained; no test email sent and remote migration absent. |
| Google Maps | NOT_CONFIGURED in new work | Existing adapter/configuration preserved; billing/API operation not verified. |
| NFS-e | NOT_CONFIGURED in new work | No fiscal issuance or provider eligibility verified. |
| Google Business Profile | BLOCKED_EXTERNAL | Account/API eligibility not verified. |
| Google Drive | NOT_CONFIGURED in new work | Existing configuration foundation only; no OAuth/file operation verified. |
| Google Sheets | NOT_CONFIGURED in new work | No export or remote spreadsheet created. |
| Meta Leads | BLOCKED_EXTERNAL | App/page approval not verified. |
| Clicksign | NOT_CONFIGURED in new work | No signing credential/operation verified. |
| Mercado Livre / Shopee order integrations | BLOCKED_EXTERNAL | Existing adapters retained; app approval/live import not verified. |
| Bling / Omie | NOT_CONFIGURED in new work | No ERP account/operation verified. |
| Zapier / Make / n8n | NOT_CONFIGURED in new work | Existing public API foundation retained; no live automation configured. |
| Mercado Pago / Asaas | BLOCKED_EXTERNAL for live verification | Existing billing and payment boundaries retained; no charges or live transaction smoke. |
| Amazon / Mercado Livre affiliate commerce | NOT_CONFIGURED | New provider engine and eligibility not implemented/verified. |
| Market data / new AI provider routing | NOT_CONFIGURED | No live quote or model inference; deterministic scenarios labeled explicitly. |

No new external provider is marked DONE based only on configuration or an interface.

## Deployment

Preview: https://orcaly-md3lq40q7-vinicius-araujos-projects.vercel.app
Deployment ID: dpl_EJNCkF8pbfMhZUP1mxx4xhw7kD33.
Application commit: c3f367b87b844dbe85220264ebe6fa0f5b647a3c.
READY and verified: 7 read-only hosted browser checks passed, exact c3f367b commit confirmed through /api/internal/preview-build, no page errors. Home axe WCAG A/AA, 390/1440 responsiveness and loaded images, eight product routes, Business price, private redirect, manifest and invalid Life route passed. Hosted personal-data/Auth flows remain unverified without staging.

Production remains d940debf9556e1180fa3c709da0f560d3aa96374 / dpl_3HeTKTcSdeM2kvzYUk5Drw5yJVtf. No promotion or hosted migration. Local preview is http://127.0.0.1:4173 while its server is running.

Automatic approval review initially rejected direct Preview export, then GitHub push as a separate destination. The owner explicitly approved each destination before retry. Direct deploy tool is unavailable; CLI unauthenticated. The existing Git integration accepted the authorized branch and created the Preview. These approval boundaries were respected.

## External blockers and deferred work

Real blockers: no isolated hosted Supabase staging environment; migration history drift requiring reconciliation; missing approved product icon/primary assets; provider credentials/eligibility/live verification not established for new services. Do not conflate these with independent product implementation still remaining.

Substantial code work remains: full Wealth lifecycle/analytics, Growth, Flow, Academy, Market, One, shared intelligence/receipts, commercial affiliate providers, unified billing, consent grant/consumer flows, notifications and product PWA. This report does not label those complete or claim external blockers prevent all of that work. The release gate remains closed pending hosted data/auth verification.

## Continuation

Exact files, commands and risks are in NEXT_CODEX_HANDOFF.md. Resume from this committed, tested checkpoint. First validate the Preview and reconcile the additive migration in isolated staging; then continue the outstanding work with real persistence, explicit authorization boundaries and truthful availability. Do not create test users or financial records in production.
