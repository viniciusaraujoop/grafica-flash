# Cross-Agent Conflict Map

Audit snapshot: 2026-09-27
Audit base SHA: 9a2c66dbb2e6bf00c484b1791103b2bccd15becd

This map is based on live GitHub branch heads observed during the audit. Branches are moving; re-run the file delta before integration.

## Agent ownership

| Agent | Branch | Observed head | Ownership |
| --- | --- | --- | --- |
| Agent 1 | codex/orcaly-ecosystem | 0324d440ee87a77a8ddb12071fa7a18b6381e37f at observation | Wealth runtime, Morning/Night, Alerts, Ask Wealth, Portfolio Intelligence, Market/Radar, Open Finance, Regulatory Mode, staging/certification |
| Agent 2 | claude/orcaly-ux-foundation | add99438d032da82a1c32ae82524843158073e94 | UX Foundation, skins, registry v2, Hub/Launcher/Palette/Landings/PWA/Intelligence UX specs |
| Agent 3 | gpt/orcaly-quality-hardening | a017effbe6b2cc0821af79cad389532ed2015070 at observation | global lint debt, legacy/Main Site static hardening |
| Agent 4 | gpt/orcaly-audit-readiness | branch created from base | audit/readiness docs only |

All three parallel branches were based on the same frozen 9a2c... neighborhood. Agent 1 then continued advancing.

## Current file-level collision result

At the observed heads:
- Agent 1 changed Wealth runtime/docs/migrations.
- Agent 2 added only new files under components/orcaly-next, lib/orcaly-next, docs/product, scripts and its handoff.
- Agent 3 changed legacy/admin/Business files and added one lint-remediation document.
- Agent 4 changes only docs/audit-readiness/**.

Direct same-path collision among Agent 1, Agent 2, Agent 3 and Agent 4 at this observation: NONE CONFIRMED.

This is good news, not permission to mash merge buttons randomly.

## Agent 1 delta from audit base

Observed 4 commits ahead.

Changed/added runtime-sensitive files:
- app/apps/wealth/documentos/[id]/page.tsx
- app/apps/wealth/documentos/page.tsx
- components/wealth/WealthDocumentForm.tsx
- lib/wealth/documents-server.ts
- lib/wealth/documents.ts
- scripts/test-wealth-documents.mjs
- supabase/migrations/20260927162000_wealth_document_expiry.sql
- supabase/migrations/20260927170000_wealth_alert_center.sql

Documentation/evidence:
- docs/execution/NEXT_CODEX_HANDOFF.md
- docs/execution/ORCALY_EXECUTION_STATE.md
- docs/execution/ORCALY_FINAL_REPORT.md
- docs/execution/reconciliation/CONTINUATION_MIGRATIONS.md
- Wealth briefing QA evidence files

Risk:
HIGH semantic/release impact because migrations and certified Wealth runtime move beyond Agent 4's base snapshot.

Review required:
- migration order and staging apply;
- Wealth document-expiry semantics;
- Alerts RLS/owner/entitlement/noise controls;
- rolling V8 regression;
- production-read-only invariant.

## Agent 2 delta from audit base

Observed one additive commit.

New code:
- components/orcaly-next/command-palette/**
- components/orcaly-next/foundation/**
- components/orcaly-next/hub/**
- components/orcaly-next/launcher/**
- components/orcaly-next/product-landing/**
- lib/orcaly-next/**

New QA/docs:
- scripts/test-orcaly-next-registry.mjs
- scripts/orcaly-next-visual-qa.mjs
- docs/product/**
- docs/execution/CLAUDE_UX_FOUNDATION_HANDOFF.md

Agent 2 reports:
- no existing file modified;
- no runtime route imported;
- no DB/migration/dependency/auth/billing/Wealth/global-CSS change;
- 17/17 registry tests and 112/112 isolated visual checks;
- full project typecheck/lint/build not run locally due environment limitation;
- Vercel Preview is first real full-project build gate.

Current collision risk:
LOW file-level.
MEDIUM build/type-level because new TSX is included by project TypeScript/glob even without route imports.

Future semantic collision points documented by Agent 2:
- lib/ecosystem/products.ts during registry adoption;
- globals.css during token adoption;
- app/apps/wealth/layout.tsx during Wealth UX adoption.

Those future adoption changes must NOT be combined with current branch integration unless separately approved.

## Agent 3 delta from audit base

Observed 6 commits ahead.

Runtime files touched include:
- admin pages/API routes;
- app/api/business-type/apply/route.ts
- app/api/notifications/smart-settings/route.ts
- onboarding routes/pages
- app/api/orders/repeat/route.ts
- app/api/producao/update/route.ts
- app/api/products/[id]/route.ts
- app/api/reports/decision/route.ts
- app/api/system/health/route.ts
- app/api/tasks/route.ts
- app/painel/configuracoes/ConfiguracoesLegacy.tsx
- app/painel/configuracoes/equipe/page.tsx
- app/painel/producao/page.tsx
- app/painel/produtos/[id]/page.tsx
- app/painel/produtos/page.tsx
- app/painel/propostas/page.tsx
- app/painel/setup/page.tsx
- app/painel/site/page.tsx
- selected catalog/delivery components
- lib/segment-modules.ts
- lib/signup-checkout.ts

Documentation:
- docs/qa/ORCALY_GLOBAL_LINT_REMEDIATION.md

Current collision risk:
LOW with Agent 1 current files.
LOW with Agent 2 current files.
HIGH audit-staleness risk for Business conclusions because Agent 3 touches exact Business files Agent 4 audited.

Agent 3 baseline:
- 257 errors
- 148 warnings
- 405 total findings

Agent 3 classifies behavior-risk findings conservatively and excludes Wealth/WhatsApp/Orçaly Next/core restricted areas.

Required review after integration:
- diff confirms no behavior change;
- targeted regression for products/config/reports/admin;
- global lint exact remaining count;
- typecheck/build;
- Business tenant/role tests.

## Agent 4 delta

Only:
docs/audit-readiness/**

No runtime, DB, migration, workflow, dependency or config file is touched.

Collision risk:
LOW.
Potential documentation staleness:
HIGH if merged long after Agent 1/3 continue changing. README must be treated as snapshot until refreshed.

## Shared semantic boundaries

Even with zero current same-path conflicts, these concepts are shared:

| Boundary | Agents | Risk | Coordination |
| --- | --- | --- | --- |
| Product registry/status truth | Agent 2, future Agent 1/product work, Agent 4 audit | MEDIUM | keep lib/ecosystem/products.ts canonical until explicit migration |
| Wealth layout/navigation | Agent 1 + future Agent 2 adoption | HIGH | Agent 2 must wait for Wealth COMPLETE/certified boundary before touching |
| Global lint/typecheck | Agent 2 + Agent 3 + Agent 1 | MEDIUM | run only on integrated candidate; no branch can claim final global gate alone |
| package.json test wiring | Agent 1/2/3 future integration | HIGH | single manual owner; avoid simultaneous edits |
| workflows | Agent 1 CI/certification + final QA | MEDIUM | Agent 4 does not modify; final workflow changes require manual review |
| migrations | Agent 1 + release owner | HIGH | strict sequence; Agent 2/3/4 none |
| Business products/reports/settings | Agent 3 + final Business QA | HIGH | Agent 3 first, then refresh Business audit/test |
| docs/execution | Agent 1 + other handoffs | MEDIUM | exact-SHA truth wins over stale prose |
| UX product status labels | Agent 2 + product/runtime owners | MEDIUM | prototype registry never authorizes or invents runtime availability |

## Files requiring manual review before final integration

Even if Git reports no textual conflict:

1. package.json
   - any future test-script additions from Agent 1/2/3.

2. lib/ecosystem/products.ts
   - if Agent 2 moves from prototype to adoption.

3. app/apps/wealth/layout.tsx
   - if Agent 2 adopts UX before Agent 1 closes Wealth.

4. globals.css / global layout
   - Agent 2 future migration only; not current branch.

5. supabase/migrations/**
   - Agent 1 only in current parallel set; strict ordered review.

6. docs/execution/NEXT_CODEX_HANDOFF.md
   - Agent 1 owns live execution truth; Agent 4 should not overwrite it.

7. Agent 3 touched Business/admin files
   - semantic diff review even when lint-only.

8. .github/workflows/**
   - current Agent 4 never touches; any final CI change requires owner review.

## Commits / changes with highest merge risk

### High
- Agent 1 migrations after 9a2c...
- any future Agent 2 adoption into existing registry/layout/global CSS
- any future shared package/workflow edit
- Agent 3 changes in privileged admin/config/business endpoints if type narrowing alters runtime behavior

### Medium
- Agent 2 additive TSX because project typecheck includes it
- Agent 3 large Business product-page typing cleanup
- execution-document updates that can misstate a moving head

### Low
- Agent 4 audit docs
- Agent 2 pure docs/assets/prototype files after successful build/typecheck

## Wait points

Agent 2 must wait before:
- replacing lib/ecosystem/products.ts;
- modifying Wealth layout/navigation;
- changing globals.css;
- publishing prototype routes.

Agent 3 must wait/avoid:
- Wealth paths;
- Agent 2 orcaly-next files;
- auth/billing/entitlement core;
- WhatsApp;
- migrations/workflows/package.

Agent 4 must wait before final signoff, but not before documentation:
- Agent 1/2/3 final heads;
- integrated candidate SHA;
- final migration state.

Agent 1 should not consume Agent 2 future Wealth UX adoption while Wealth functionality is still moving.

## Merge conflict vs semantic conflict

Git conflict:
same-line/text collision.

Semantic conflict:
two non-overlapping changes alter a shared contract, status, type or runtime assumption.

Current branches are unusually clean at the text level. The semantic risks remain:
- Agent 2 registry successor vs canonical registry;
- Agent 1 product feature progression vs product status/UX claims;
- Agent 3 type cleanup vs hidden runtime assumptions;
- Agent 4 snapshot vs moving target.

Final review must test contracts, not just celebrate a merge with zero conflict markers.

## Refresh procedure

Immediately before integration:
1. fetch exact heads of all four branches;
2. compare each against the chosen integration base;
3. recalculate same-path overlap;
4. inspect package/workflow/migration diffs separately;
5. update this document if Agent 1/2/3 heads changed materially;
6. freeze final candidate SHA;
7. run the integration sequence in INTEGRATION_SEQUENCE.md.
