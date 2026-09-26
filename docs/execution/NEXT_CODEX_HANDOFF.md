# Next Codex handoff

## Current staging checkpoint — 26/09/2026

Production remains read-only. Staging `zwxulgpjucxudadjdqov` now contains a catalog-derived schema-only baseline plus the existing Wealth migration. Audit covers 71 local files and 51 remote ledger entries. Baseline comparison: zero semantic differences in audited metadata. Final delta: 154 additions belonging only to the six Wealth/ecosystem tables and their supporting objects; no existing object changed.

Hosted Supabase E2E: 13 checks PASS, fixture users/audit rows cleaned. Types generated. Build/typecheck/60 regression tests/scoped lint PASS. Real E2E found and fixed login destination loss after rerender and consent revocation clock/microsecond skew. No historical replay, production db push, migration repair, data copy or production promotion occurred.

Vercel CLI authentication was renewed by the owner. Preview-only variables for branch `codex/orcaly-ecosystem` target staging and enable Wealth there. Preview `dpl_2UQGyp24Qp76u4E5PF243rJs1aQY` is READY at https://orcaly-mkw4graiy-vinicius-araujos-projects.vercel.app, exact commit `df87d092d617facf9d937fb8fcfb1e095837b53b`. All **14 fully hosted E2E checks passed**, fixtures removed. Staging is certified for the tested Auth/Hub/Wealth/entitlement/consent scope. Production catalog, 51-entry ledger, Vercel environment metadata, main and production deployment remain unchanged. See `reconciliation/STAGING_VALIDATION.md` and `vercel-staging-e2e.json`. These results supersede earlier no-staging/no-hosted-test statements preserved below. Continue the pending master work; do not bootstrap staging again.

## Prior implementation checkpoint (historical context)

Mission remains PARTIAL. The owner requested execution of the whole CODEX_ORCALY_ECOSYSTEM_MASTER_EXECUTION.md. Read ORCALY_EXECUTION_STATE.md and ORCALY_FINAL_REPORT.md before changing anything. Do not assume the ecosystem is finished.

## Current checkout and authorization

Workspace: C:\Users\arauj\grafica-flash. PowerShell, Node 24.16.0, npm, Next 16.3.4. Branch codex/orcaly-ecosystem. Read AGENTS.md and relevant node_modules/next/dist/docs pages before writing Next code.

00aa4f7 preserves preexisting integrations; c3f367b is the validated application implementation. A documentation-only checkpoint follows. The owner explicitly authorized Preview only, and explicitly authorized this branch to GitHub repository viniciusaraujoop/grafica-flash. Production promotion is not authorized by that follow-up.

Commands:
```powershell
git status --short --branch
git log -3 --oneline
git rev-parse HEAD
git ls-remote --heads origin main codex/orcaly-ecosystem
npm run typecheck
npm run test:ecosystem
```

Do not repeat all checks without new changes. Global lint has preexisting failures documented in ORCALY_EVIDENCE.json. No user changes were discarded. No hosted migration was applied.

## Preview

Candidate URL: https://orcaly-md3lq40q7-vinicius-araujos-projects.vercel.app
ID: dpl_EJNCkF8pbfMhZUP1mxx4xhw7kD33, commit c3f367b, Vercel project prj_SzlsQ0ovx6JnDE8v5jJbAa5U9U4O / team_c5p2Uiz9b1SqKxOhmnmxUWZH. Consult final report for terminal status.

Use connected Vercel list/get/build-log/fetch tools to verify exact SHA. Direct deploy_to_vercel is advertised but returns Tool not found; get_project has a schema mismatch. CLI is unauthenticated. Git integration creates Preview for this branch. Do not disable Preview protection to test. A tool-generated temporary access URL, if needed, must never be committed.

Production was d940debf / dpl_3HeTKTcSdeM2kvzYUk5Drw5yJVtf and remains unchanged. No merge to main or promote command.

## Database release gate

The owner answered that no staging project exists. Connected production is ozrasuktfthsvbqprtel (GRAFICA FLASH). The unrelated other project is not a test target. There is no usable local Docker/psql. New SQL has been tested with actual PostgreSQL/PGlite and synthetic company fixtures only.

Exact next database task: establish an explicitly selected isolated hosted project/branch, compare actual company/member schema and policies, reconcile remote migration history, apply only the new additive SQL there, then run real Supabase Auth + PostgREST A/B tests. Account/project provisioning can have billing consequences; do not create paid resources merely to avoid the gate.

Migration: supabase/migrations/20260926014103_ecosystem_identity_wealth.sql.
Tests: scripts/test-ecosystem-database.mjs and scripts/helpers/ecosystem-test-db.mjs.
Boundary implementation: lib/ecosystem/server.ts, lib/ecosystem/access.ts, app/apps/wealth/actions.ts.

No blind supabase db push: 51 remote migration records differ from local history; Resend and two preexisting integration migrations are not recorded remotely. No migration repair or production application was attempted.

Keep ORCALY_WEALTH_ENABLED off until hosted schema and Auth tests pass. Enabling the flag is insufficient: an actual personal entitlement with wealth.read/wealth.write is required. Only a trusted commercial/admin lifecycle may create that grant. Never add a client grant endpoint or service-role fallback to make the UI work.

## Useful local QA commands

```powershell
npm ci
npm run build
npm run typecheck
npm run security:check
npm audit
npm start -- --hostname 127.0.0.1 --port 4173
# Run the next command in a separate terminal while the server is ready.
npm run e2e:ecosystem
```

The E2E launches Chrome (installed channel chrome), a loopback protocol gateway on 54329, and a synthetic Next dev app on 4174. It shuts the fixture down. It does not create real accounts. Test fixtures are never imported by production code. Local public server on 4173 may already be running.

Logs/screenshots: .local-qa/final-*.log, .local-qa/ecosystem-browser/. Durable evidence: docs/qa/ORCALY_EVIDENCE.json. Local protocol fixture coverage must not be described as hosted Supabase certification.

## Remaining implementation order and exact starting files

1. Finish Wealth record lifecycle, paginated/aggregate views and export with server actions and RLS tests. Start app/apps/wealth/page.tsx, actions.ts, lib/wealth/core.ts and scripts/test-ecosystem-database.mjs. Do not turn recurrence metadata into automatic charges; use existing jobs/outbox for future idempotent recurrence.
2. Implement commercial entitlement issuance using existing subscription/billing sources after auditing lib/plans and payment boundary docs. A One grant must not bypass product/tenant permissions.
3. Add consent grant UX only with independent source/target access and bounded scope/purpose/expiry. Start app/apps/privacidade, lib/ecosystem/access.ts and the migration. Add consumer denial tests before any cross-product transfer.
4. Build Academy/affiliate provider capabilities with official eligibility and rights verification; start docs/architecture/ORCALY_AFFILIATE_ENGINE.md and existing lib/affiliates. Do not fabricate third-party conversion APIs or host unlicensed books.
5. Implement shared intelligence/Decision Receipts by reusing existing app/api/ai/business-assistant, lib/jobs, feature flags and integration error classification. Start docs/architecture/ORCALY_INTELLIGENCE.md. No personal finance or reading notes in company context without exact consent.
6. Continue Growth, Flow, Market and One with genuine workflows and persistence. Registry/page presence alone does not establish availability. Preserve existing Business/Partners/storefront flows.
7. Complete product branding/PWA only after approved assets. public/brand/README.md lists missing primary assets/icons. Do not generate or crop replacement logos.

Risk if continued incorrectly: production migration drift, accidental personal/company data mixing, fake entitlement availability, circular RLS, unlicensed content, duplicate recurring financial entries, irreversible external financial actions and marketing that claims unimplemented features.

CONTINUE FROM HERE:
Confirm HEAD and the final Preview evidence, keep production and Wealth release disabled, reconcile the new migration against an isolated hosted schema, then complete the unfinished product workstreams with the listed code paths and authorization tests.
