# Orçaly Ecosystem — Execution State

## Current staging checkpoint — 26/09/2026

Production remains read-only. Staging `zwxulgpjucxudadjdqov` now contains a catalog-derived schema-only baseline plus the existing Wealth migration. Audit covers 71 local files and 51 remote ledger entries. Baseline comparison: zero semantic differences in audited metadata. Final delta: 154 additions belonging only to the six Wealth/ecosystem tables and their supporting objects; no existing object changed.

Hosted Supabase E2E: 13 checks PASS, fixture users/audit rows cleaned. Types generated. Build/typecheck/60 regression tests/scoped lint PASS. Real E2E found and fixed login destination loss after rerender and consent revocation clock/microsecond skew. No historical replay, production db push, migration repair, data copy or production promotion occurred.

Vercel CLI authentication was renewed by the owner. Preview-only variables for branch `codex/orcaly-ecosystem` now target staging and enable Wealth there. Verification of the Vercel URL is still in progress at this checkpoint. Production configuration is unchanged. See `reconciliation/STAGING_VALIDATION.md`, `BASELINE_STRATEGY.md`, the complete migration matrix and comparison JSONs. These current results supersede the earlier no-staging/no-hosted-test statements preserved below.

## Prior implementation checkpoint (historical context)

Timestamp: 2026-09-26 UTC. Mission status: PARTIAL. The full 50-section request is not complete.

## Git and preserved work

- Repository: https://github.com/viniciusaraujoop/grafica-flash.git
- Initial branch/HEAD: feat/integrations-expansion / 5d1a1f640b0b2e4be873587b61d299e87bd39dd7.
- Working branch: codex/orcaly-ecosystem.
- Preservation checkpoint: 00aa4f7c2465c4b07cdda3468aff11195e5e8e98.
- Validated implementation HEAD: c3f367b87b844dbe85220264ebe6fa0f5b647a3c; pushed to origin/codex/orcaly-ecosystem with the owner's explicit GitHub authorization.
- Final HEAD includes the documentation checkpoint containing this report; resolve with git rev-parse HEAD and git log -3 --oneline. No merge, force push or production promotion.
- Remote main last verified at d940debf9556e1180fa3c709da0f560d3aa96374.

Preexisting modified files were IntegrationHub.tsx, integration adapters/registry/types/email core/Google OAuth contract, package.json and verify-integrations-core.mjs. Preexisting untracked work comprised provider configuration/API-key/health routes, ProviderConfiguration.tsx, public API docs/helpers/test and migrations 20260914213211 and 20260914213803. Checkpoint 00aa4f7 preserves these separately. The only implementation repair in that checkpoint remounts the provider form by key and removes the synchronous setState effect that blocked the build. The ecosystem work is in c3f367b. No user changes were reset or discarded.

## Baseline and stabilization

Initial inspection covered Git status/history, routes, package/lock, Supabase metadata/migrations/advisors and Vercel deployments. All sections of the supplied master document were read. The local Next guides were read before editing.

- Actual runtime: Node 24.16.0, npm 11.13.0, React 19.2.4, TypeScript 5.9.3, Supabase JS 2.111.0 / SSR 0.12.3.
- package/lock required Next 16.3.4 while installed Next/eslint were 16.2.9. npm ci restored the locked versions.
- Initial existing test suites passed. Build was blocked by the provider form lifecycle. Typecheck had six stale generated-route errors; regenerated route types resolved them.
- Initial lint: 258 errors / 129 warnings / 644 files. Final: 257 errors / 148 warnings / 666 files. Final warnings are in preexisting files; the tool-version change prevents treating the raw warning difference as an equal-tool comparison. New ecosystem scope has zero lint findings. Whole-repository lint is still not clean.
- Approved compatible npm audit fixes reduced 6 advisories (4 high, 2 moderate) to zero. No forced or major dependency upgrade.

## Completed workstreams within this checkpoint

- Central eight-product registry and experience tokens; Life is absent.
- Public ecosystem Home, eight product detail pages and authenticated App Hub.
- Original Business marketing retained at /business; operational /painel and /parceiros paths preserved.
- Existing Supabase identity reused, MFA requirement retained, safe login destinations and authenticated Home redirect.
- Explicit personal grants, permissions and release switch; exact-purpose consent contract and owner-only revocation.
- Wealth profile/budget/reserve, income/expense/assets/liabilities, goals and deterministic simulation, with real Server Actions and database persistence.
- Six-table additive migration, RLS and private identifier-only audit triggers.
- Original supplied branding inventory; unsupported primary logos and product installability stay unavailable.
- Automated contract/PostgreSQL/browser/accessibility verification and architecture/QA documentation.

Current workstream: Preview validation and release handoff. Full Wealth expansion, Growth, Flow, Academy, Market, One, shared intelligence, affiliate commerce and full cross-product billing remain unfinished; see ORCALY_FINAL_REPORT.md. They are not all blocked by external services, and are not marked complete.

## Files changed

Implementation boundaries: app/page.tsx; app/business; app/produtos; app/apps; components/ecosystem; components/wealth; lib/ecosystem; lib/wealth; lib/auth-navigation.ts; app/login/actions.ts; components/AuthSessionKeeper.tsx; proxy.ts; lib/supabase-server.ts; root metadata/manifest/robots/sitemap; public/brand; package/lock; test scripts; one migration; architecture/QA/execution docs. Exact list: git show --stat c3f367b and git show --stat 00aa4f7.

## Database / flags

- Hosted project: ozrasuktfthsvbqprtel, GRAFICA FLASH, PostgreSQL 17.6. Other unrelated project untouched.
- Hosted audit: 51 migrations (latest 20260910150730_google_calendar_complete), 111 public tables with RLS, 143 policies, 510 indexes, 173 foreign keys and 38 triggers.
- Local/remote historical migration versions/names differ. The Resend and two preexisting integration migrations are not recorded remotely. Never blindly run db push.
- Created: supabase/migrations/20260926014103_ecosystem_identity_wealth.sql.
- Applied locally: repeatedly in isolated ephemeral PGlite/PostgreSQL with synthetic company/member fixtures.
- Applied to hosted Supabase: NONE. No production accounts, data, schema, grants, Vault or credentials changed.
- The user confirmed there is no staging project. Only main was found; no local Docker/psql runtime was available.
- ORCALY_WEALTH_ENABLED must be exactly true, plus an active personal entitlement and required read/write permission. It remains disabled in normal deployment configuration; only the isolated browser fixture enables it.
- Company grants never imply personal Wealth access. No client can self-issue entitlements. No cross-product data-transfer consumer is enabled.

## Verification

Evidence: docs/qa/ORCALY_EVIDENCE.json; local ignored logs in .local-qa.

- npm run build: PASS, includes existing verification suites, payment boundaries and 60 new tests.
- npm run test:ecosystem: 60 passed / 0 failed (42 domain/contract checks, 18 PostgreSQL/RLS checks).
- npm run typecheck: PASS.
- npm run security:check: PASS.
- npm audit: zero vulnerabilities.
- npm run e2e:ecosystem: 11 checks PASS, no page errors. Widths 320/390/768/1440/1920; Home/Wealth axe WCAG A/AA scans have no violations.
- Wealth browser flow: profile/budget → entry → goal → scenario → reload → persisted cents; other user cannot see entries; unentitled user has no editing form.
- New-scope lint and git diff --check: PASS.
- Global lint: preexisting failures as quantified above.
- Hosted Auth/MFA/token refresh, historical schema compatibility, existing Business live order-to-finance and storage/job isolation E2E: NOT CERTIFIED.

Known regressions: none observed in the tested scope. This does not certify the entire existing application. Wealth currently limits overview to 500 entries / 100 goals and visibly labels entry-subset totals; recurrence is reference-only, not an automated job.

## Security and deployment

get_my_platform_admin_access was inspected: fixed search_path, auth.uid filter, active allowed roles and limit 1. No grant change required for the new work. Hosted leaked-password protection remains disabled; no account setting changed. No new secret was committed. New audit payloads contain identifiers only. No WhatsApp expansion or regulated investment execution was implemented.

The initial Vercel deploy was rejected by automatic approval review for insufficient destination-specific authorization. After the owner's explicit Vercel Preview approval, the connector reported deploy_to_vercel unavailable. CLI was unauthenticated. A Git push was separately rejected because GitHub is a different destination; the owner then explicitly authorized this branch to the existing GitHub repository. That push succeeded. No rejection was bypassed.

Preview candidate: dpl_EJNCkF8pbfMhZUP1mxx4xhw7kD33, https://orcaly-md3lq40q7-vinicius-araujos-projects.vercel.app, source c3f367b, target preview. READY and verified: 7 read-only hosted browser checks passed, exact c3f367b commit confirmed through /api/internal/preview-build, no page errors. Home axe WCAG A/AA, 390/1440 responsiveness and loaded images, eight product routes, Business price, private redirect, manifest and invalid Life route passed. Hosted personal-data/Auth flows remain unverified without staging.
Production remains d940debf / dpl_3HeTKTcSdeM2kvzYUk5Drw5yJVtf; no promotion. Local visual preview: http://127.0.0.1:4173 while its server remains running.

## Exact continuation

Read NEXT_CODEX_HANDOFF.md. Validate the candidate Preview read-only, then establish an isolated hosted database before applying the new migration outside the fixture. Do not use the production database as a test environment, replay historical migrations, enable Wealth globally or mark all products available. Continue the unimplemented workstreams with real persistence and focused authorization tests.

CONTINUE FROM HERE:
Inspect docs/execution/NEXT_CODEX_HANDOFF.md and the final Preview evidence, confirm git status and HEAD, then reconcile the migration against an isolated hosted schema before enabling Wealth; keep all remaining product statuses truthful.
