# Integration Sequence

Audit snapshot: 2026-09-27
Base SHA: 9a2c66dbb2e6bf00c484b1791103b2bccd15becd

This document proposes the technical integration order. It does not perform any merge.

## Goal

Produce one candidate SHA in which:
- latest accepted Wealth work is intact;
- isolated UX foundation is present without premature runtime adoption;
- quality-hardening changes are applied and revalidated;
- audit/readiness docs are refreshed to the candidate;
- no database or production change occurs until the candidate passes gates.

## Principle

The final candidate should be built from the latest frozen Agent 1 head, not from the old Agent 4 base.

Reason:
Agent 1 owns the active functional/migration continuation and has already advanced beyond 9a2c.... Rebasing/merging all work back onto an older snapshot only to move forward again creates avoidable conflict and evidence drift.

## Phase 0: freeze inputs

Required:
1. stop feature commits for the integration window;
2. record exact heads for:
   - codex/orcaly-ecosystem
   - claude/orcaly-ux-foundation
   - gpt/orcaly-quality-hardening
   - gpt/orcaly-audit-readiness
3. record main SHA;
4. confirm production/staging migration histories read-only;
5. refresh Vercel status for each branch;
6. recalculate file overlap.

Gate:
no branch head changes during the controlled integration run.

Rollback point:
none yet; no integration branch created.

## Phase 1: create final integration candidate from latest Agent 1

Base:
latest accepted codex/orcaly-ecosystem head.

Why Agent 1 first:
- it is the current functional continuation branch;
- it owns the only new migrations among the parallel agents;
- it carries Wealth certification lineage;
- Agent 2/3 are based on the earlier shared SHA and are designed to apply onto it.

Do not:
- merge to main;
- apply production migrations;
- promote Vercel;
- enable feature flags.

Gate A:
- latest Agent 1 scoped tests green;
- exact Preview build green;
- Wealth unit certification complete for every unit included in that head;
- staging migration list matches Agent 1 handoff;
- production remains read-only/unmodified;
- migration files reviewed in order.

Rollback point A:
the frozen Agent 1 head SHA.

## Phase 2: integrate Agent 2 additive UX foundation

Branch:
claude/orcaly-ux-foundation

Current observed nature:
only new files; no existing runtime route, DB, dependency, auth, billing, entitlement, global CSS or Wealth file modified.

Why before Agent 3:
Agent 2 adds TypeScript/TSX files that become visible to project-wide typecheck/lint. Integrating it before the final quality branch lets the global quality gate see the eventual source set.

Expected textual conflict:
none at observed heads.

Mandatory gates B:
- Vercel build for Agent 2 branch is green before integration;
- full candidate typecheck after integration;
- global lint result recorded;
- node test scripts/test-orcaly-next-registry.mjs passes;
- existing test:ecosystem passes;
- visual QA evidence reviewed;
- no existing route imports orcaly-next prototypes unless separately approved;
- no canonical product-registry replacement;
- no global CSS adoption;
- no Wealth layout adoption.

If Agent 2 introduces lint/type failures:
return ownership to Agent 2 rather than silently editing its new UX files from Agent 3.

Rollback point B:
candidate SHA immediately before Agent 2 merge.

## Phase 3: integrate Agent 3 quality hardening

Branch:
gpt/orcaly-quality-hardening

Why after Agent 2:
Agent 3 owns the final static-quality cleanup surface. The global lint measurement must be taken against the source set that will actually ship, including Agent 2 additive files.

Important:
Agent 3 must not “fix” Agent 2 ownership areas if new Agent 2 findings appear. Those findings are routed back to Agent 2. Agent 3's merge should remain within its declared scope.

Expected conflict:
low current file-level overlap with Agent 1/2; meaningful Business/admin semantic risk.

Mandatory gates C:
- inspect every Agent 3 runtime diff for behavior-preserving intent;
- global lint exact final count;
- typecheck;
- build;
- targeted tests for:
  - products/catalog
  - reports/decision
  - company configuration
  - onboarding
  - production/operations
  - admin routes/pages
- security-check/admin-security-check;
- Business company/tenant authorization smoke;
- no Wealth/WhatsApp/Orçaly Next/migration/workflow/dependency changes.

If behavior changes unexpectedly:
revert the smallest Agent 3 commit/file group rather than weakening tests.

Rollback point C:
candidate SHA immediately before Agent 3 merge.

## Phase 4: refresh Agent 4 audit against the integrated candidate

Branch:
gpt/orcaly-audit-readiness

Current docs are a snapshot of 9a2c... plus live read-only observations and parallel-branch deltas.

Do not merge the audit docs unchanged if:
- Agent 1 added more features/migrations;
- Agent 3 materially changed Business code;
- Agent 2 changed from additive prototype to runtime adoption;
- Advisor counts changed;
- staging/prod state changed.

Refresh:
- ORCALY_SYSTEM_MAP.md
- BUSINESS_RUNTIME_AUDIT.md
- INTEGRATIONS_GAP_ANALYSIS.md
- SECURITY_HARDENING_BACKLOG.md
- PERFORMANCE_BASELINE.md
- OBSERVABILITY_GAPS.md
- FINAL_QA_MATRIX.md
- PRODUCTION_READINESS_CHECKLIST.md
- TECHNICAL_RISK_REGISTER.md
- CROSS_AGENT_CONFLICT_MAP.md
- this integration sequence
- README.md

Gate D:
Agent 4 diff still contains docs/audit-readiness/** only.

Rollback point D:
candidate SHA before audit-doc merge.

## Phase 5: database reconciliation gate

Still no production mutation.

Inputs:
- final candidate migration directory;
- production live migration list;
- staging live migration list;
- production schema baseline/reconciliation docs;
- Agent 1 continuation migration ledger.

Required outputs:
- exact migrations intended for staging;
- exact migrations intended later for production;
- preconditions;
- expected objects;
- grants/RLS/index/function changes;
- post-migration verification SQL;
- rollback/roll-forward strategy.

Rules:
- no blind db push;
- no old migration reapplication;
- no migration reorder;
- no “production has fewer versions so run everything.”

Gate E:
human-reviewed reconciliation artifact + clean isolated staging apply.

Rollback point E:
database snapshot/restore point or equivalent documented recovery state before any approved schema mutation.

## Phase 6: integrated static and unit gates

On the final candidate SHA:

Required:
1. global lint
2. typecheck
3. next build
4. npm test
5. test:ecosystem
6. relevant Agent 2 tests
7. relevant Agent 3 regression tests
8. Wealth complete rolling suite for all units included
9. payment-flow verification
10. storefront/marketplace verification
11. security checks
12. integration core/calendar/resend verification
13. dependency/security audit

Gate F:
no unexplained regression relative to branch-specific certified evidence.

Rollback:
bisect by integration phase, not random patching.

## Phase 7: hosted Preview gate

Deploy exact candidate SHA to protected Preview.

Verify:
- /api/internal/preview-build or equivalent exact-SHA evidence;
- no fallback to a newer deployment;
- no production API/database mutation;
- no runtime error clusters attributable to candidate;
- protected Preview access remains controlled.

Gate G:
exact SHA is READY and all hosted suites target that immutable deployment.

Rollback:
previous READY candidate deployment.

## Phase 8: Business final hosted E2E

This is the largest missing product-level gate.

Journey:
1. authenticated company owner
2. product/catalog
3. public storefront
4. checkout
5. order + order_items
6. status transition
7. delivery/withdrawal path
8. payment/finance consequence
9. report visibility
10. cleanup

Security variants:
- manager/member allowed actions;
- outsider/cross-tenant denial;
- guessed object IDs;
- disabled method/zone;
- duplicate submit;
- provider failure/retry.

UI:
320/390/768/1024/1440/1920 where meaningful, keyboard, focus, error/empty/loading, automated accessibility.

Gate H:
Business_RUNTIME_AUDIT P0 items can move from NEEDS_TEST only with evidence.

Rollback:
no production mutation; discard synthetic staging data and candidate deployment if needed.

## Phase 9: Wealth rolling regression

Run all Wealth modules included in candidate, not only the latest one.

Minimum:
- auth
- RLS
- owner/cross-user
- entitlement
- consent
- mobile/desktop
- light/dark
- Axe
- keyboard/focus
- reduced motion
- no overflow
- cleanup
- production request detector

Gate I:
rolling suite green on exact integrated candidate.

Rollback:
candidate to pre-Agent-1 functional baseline only if regression is caused by new Wealth change; otherwise fix responsible integration phase.

## Phase 10: security/advisor gate

Read-only:
- Supabase Security Advisor
- Supabase Performance Advisor
- policy/grant/function diff
- Storage bucket/policy review
- Vercel runtime errors
- dependency scanner

Required decisions:
- leaked-password protection;
- SECURITY DEFINER RPC acceptance/change;
- RLS overlap;
- new Advisor findings introduced by candidate;
- upload/rate-limit findings;
- Auth/MFA global gate.

Gate J:
no unresolved CRITICAL/HIGH security finding and all MEDIUM release-blocking findings either fixed or explicitly accepted by owner.

## Phase 11: performance/observability gate

Collect actual measurements:
- Web Vitals;
- route/API latency;
- DB report/list query plans;
- bundle sizes;
- queue behavior;
- cross-region DB timing.

Observability:
- safe induced API failure produces errorId/requestId/deployment;
- failed/retried job visible;
- duplicate webhook visible and side-effect safe;
- alerting path for critical failure tested.

Gate K:
baseline recorded and no obvious catastrophic regression.

## Phase 12: provider/feature-flag gate

For every provider intended to remain disabled:
confirm flag is false.

For every provider proposed to enable:
require provider-specific readiness checklist:
- credentials;
- scopes;
- webhook;
- signature/replay;
- retry/rate limit;
- health;
- operator visibility;
- external sandbox result.

Google Calendar:
implemented but current production flag is false/no connection.

Resend:
must not be enabled until DB schema/runtime is promoted and certified.

Configuration-only providers:
must remain disabled.

## Phase 13: recovery/rollback review

Before production:
- database backup/PITR state known;
- restore procedure documented;
- Vercel rollback deployment identified;
- feature-flag kill switches checked;
- cron/job disable procedures documented;
- provider disconnect/revoke procedure documented;
- incident owner identified.

Gate L:
release owner can explain how to undo or contain each change class.

## Phase 14: production promotion

Only after Gates A–L.

Sequence:
1. freeze final SHA;
2. record release evidence;
3. apply explicitly approved production DB migrations, if any;
4. run post-migration read-only checks;
5. promote/deploy exact candidate;
6. smoke critical routes;
7. inspect errors/jobs/webhooks;
8. enable only pre-approved feature flags;
9. retain previous deployment/schema recovery reference.

This document does not authorize those actions.

## Phase 15: post-release smoke

Immediately verify:
- auth/login;
- Business panel;
- storefront;
- checkout;
- orders;
- finance/reporting read;
- partner portal;
- Wealth certified entry points;
- admin system health;
- cron/jobs expected state;
- provider health for enabled integrations;
- application-error rate.

No destructive “test transaction” in real customer context.

## Recommended order summary

1. Freeze latest Agent 1.
2. Create integration candidate from Agent 1.
3. Merge Agent 2 additive foundation after its build gate.
4. Merge Agent 3 hardening after semantic diff review.
5. Refresh/merge Agent 4 audit docs.
6. Reconcile DB.
7. Run global static/unit gates.
8. Hosted exact-SHA Preview.
9. Business final E2E.
10. Wealth rolling E2E.
11. Security/Advisor.
12. Performance/observability.
13. Provider/feature flags.
14. Recovery review.
15. Only then production promotion.

## Why not merge Agent 3 first?

Because Agent 2 adds TS/TSX that participates in project-wide type/lint checks. A “green global lint” before those files arrive is not the final global lint.

## Why not integrate from Agent 4 base?

Because the audit branch intentionally froze at 9a2c... while Agent 1 continued functional work. The final integration base should be the latest accepted functional lineage, not an audit snapshot.

## Why Agent 4 docs last?

Because audit truth should describe the candidate, not force the candidate to resemble an old audit. Documentation is safest last, after the code branches stop moving.

## Final rule

Every gate is SHA-bound.

Never combine evidence from:
- one source SHA,
- another Preview deployment,
- a different staging migration state,
- and a third branch

and call the result “certified.” That is how release folklore is born.
