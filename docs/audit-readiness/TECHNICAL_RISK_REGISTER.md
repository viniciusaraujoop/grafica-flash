# Technical Risk Register

Audit snapshot: 2026-09-27
Base SHA: 9a2c66dbb2e6bf00c484b1791103b2bccd15becd

Likelihood uses LOW / MEDIUM / HIGH only. It is qualitative and evidence-based, not a numeric probability.

## Register

| ID | TITLE | AREA | SEVERITY | LIKELIHOOD | EVIDENCE | IMPACT | MITIGATION | OWNER | BLOCKER | STATUS |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| R-001 | Repository / production / staging schema drift | DB / release | HIGH | HIGH | repo has 94 migration files; production live history has 51 ending at Google Calendar; staging has separate 25-migration Wealth chain | unsafe promotion, missing objects, accidental reapplication or incompatible assumptions | explicit reconciliation plan, isolated staging apply, schema diff, no blind db push | DB/release owner | YES | OPEN |
| R-002 | Business lacks one current hosted customer→order→finance certification | Business / QA | HIGH | HIGH | base docs/qa/ORCALY_QA_MATRIX.md records this journey as NOT_STARTED | tenant/auth/regression defect can escape release despite unit/scoped tests | integrated hosted E2E with role/tenant matrix and failure/retry paths | Business + QA | YES | OPEN |
| R-003 | Global lint baseline is red | Quality | MEDIUM | HIGH | 257 errors / 148 warnings at frozen baseline | merge/build quality noise masks real regressions and blocks global gate | Agent 3 behavior-preserving remediation; rerun global lint after merge | Agent 3 | YES until remediated/accepted | MITIGATING |
| R-004 | Parallel branches advance after audit snapshot | Release / coordination | MEDIUM | HIGH | Agent 1 advanced from frozen 9a2c... to later Wealth commits; Agent 2/3 active | audit/QA evidence can become stale; merge assumptions can be invalidated | freeze candidate SHA, refresh conflict map and delta audit before final approval | Release owner + Agent 4 | YES for final approval | ACTIVE |
| R-005 | Execution documentation can lag runtime | Documentation / operations | MEDIUM | HIGH | base handoff initially described Morning/Night as next while base code already contained briefing migration/test/workflow; later docs caught up | engineer may redo work, skip completed gate or integrate wrong unit | treat SHA + executable evidence as truth; update handoff in same certification commit where possible | Agent owners | NO | OPEN |
| R-006 | Vercel/Supabase region mismatch may add synchronous latency | Performance | MEDIUM | HIGH | Vercel base deployment reports iad1; Supabase projects are sa-east-1 | extra DB round-trip latency across API/panel operations | measure before changing topology; decide region strategy from p95 evidence | Platform/performance | NO | OPEN |
| R-007 | Large hydrated Business components increase regression/performance risk | Business frontend | MEDIUM | HIGH | Deliveries 1,746 lines; Products 1,659; Finance 1,397; MarketplacePayments 796 | slow hydration, broad state coupling, hard-to-test mutations | measure bundle/render/network behavior; refactor only with regression evidence | Business UI | NO | OPEN |
| R-008 | RLS policy overlap increases authorization complexity | Security / DB | HIGH | MEDIUM | 54 multiple-permissive-policy Advisor warnings; overlapping policies on core tenant tables | future policy changes can accidentally broaden access; current exploit not demonstrated | build permission truth-table tests, then simplify policies deliberately | DB/security | YES for final security signoff | OPEN |
| R-009 | Hosted Auth/MFA is not globally certified | Auth / security | HIGH | MEDIUM | execution/security docs keep Auth/MFA as a global open gate; scoped MFA code exists | privileged action/session/recovery path may behave inconsistently | whole-app hosted auth/MFA lifecycle + privileged action matrix | Auth/platform | YES | OPEN |
| R-010 | Leaked-password protection disabled in production | Auth | MEDIUM | MEDIUM | Supabase Security Advisor production warning | compromised/reused passwords remain accepted without provider breach check | enable after regression/support review | Auth/platform | NO if explicitly risk-accepted; recommended gate | OPEN |
| R-011 | Critical failures rely mostly on pull-based observability | Observability | HIGH | MEDIUM | error tables/admin health exist; no proactive alerting framework located | payment/job/provider failure can persist until a human inspects dashboard | define alerts for 5xx/jobs/webhooks/payments/provider auth; operator ownership | Platform/ops | YES | OPEN |
| R-012 | No system-level performance baseline | Performance | MEDIUM | HIGH | latency/Web Vitals/bundle/job metrics are NOT_MEASURED | optimization/regression decisions lack objective target | collect route/API/DB/Web Vitals/bundle baseline on integrated candidate | Performance owner | YES for performance signoff | OPEN |
| R-013 | Integration catalog can be mistaken for operational integrations | Integrations / product | MEDIUM | HIGH | 14 registered providers use configuration-only adapter that intentionally rejects sync; all production flags false | UI/marketing/operator may claim capability that cannot execute | expose engineering/runtime readiness distinctly; keep flags fail-closed | Integrations/product | YES for enabling provider | OPEN |
| R-014 | Resend repository state exceeds production schema | Integrations / DB | MEDIUM | HIGH | Resend runtime/migration exists in repo; production migration history ends before Resend | enabling code against production schema can fail | promote/certify schema before flag/config; external delivery/webhook tests | Integrations/release | YES for Resend | OPEN |
| R-015 | Public art upload enables service-role storage writes for any active company slug | Storage / abuse | MEDIUM | MEDIUM | public route, same-origin + rate limit + magic checks, but no upload-intent token | storage/content abuse under public company path | bind upload to signed order/quote intent while retaining current validation | Business/security | NO for unrelated release; YES for upload hardening | OPEN |
| R-016 | site-assets upload has weaker file validation than public art upload | Storage | MEDIUM | MEDIUM | declared MIME only; public bucket; authenticated canManage | crafted/polyglot public content or storage hygiene issues | reuse magic-byte/decode validation and add rate limiting | Business/security | NO | OPEN |
| R-017 | Backup/PITR/restore evidence is absent from this audit | Recovery | HIGH | MEDIUM | available read-only tooling did not expose backup policy; no restore evidence found in audited docs | recovery time/data loss may exceed expectations during an incident | document actual backup/PITR configuration and perform non-prod restore rehearsal | Platform/ops | YES for recovery signoff | OPEN |
| R-018 | Background jobs lack explicit queue-age/worker heartbeat alerting | Jobs / ops | MEDIUM | MEDIUM | robust claim/retry/recover exists; alerting/queue SLI not located | silent stuck queue, delayed email/sync/recurrence | queue age SLI, failed/stale counters, heartbeat and alerts | Platform/jobs | YES for async readiness | OPEN |
| R-019 | Agent 3 touches Business/admin files audited at the frozen base | Cross-agent integration | MEDIUM | HIGH | current Agent 3 diff modifies products, company config, reports, admin APIs/pages and related files | final audit conclusions can become stale and merge can alter behavior unintentionally | integrate Agent 3 before final Business regression; rerun targeted audit on changed files | Agent 3 + QA | YES for final audit | ACTIVE |
| R-020 | Agent 1 continues Wealth migrations/runtime after base | Cross-agent integration | HIGH | HIGH | Agent 1 branch adds document-expiry and Alerts migration after 9a2c base | DB/QA/integration order changes; audit base no longer covers latest Wealth | integrate Agent 1 intentionally, run migration/security/rolling V8 gates, refresh risk register | Agent 1 + release | YES | ACTIVE |
| R-021 | Agent 2 prototypes are isolated but enter TypeScript glob after merge | UX / build | MEDIUM | MEDIUM | Agent 2 handoff: all files new, components/orcaly-next/**/*.tsx included by tsconfig; full project typecheck was not run locally | merged build/typecheck can fail even though no runtime route imports them | require successful Vercel build + full typecheck before merge acceptance | Agent 2 + release | YES | MITIGATING |
| R-022 | Production feature flags for integrations are all off, with no live connections | Integrations / rollout | LOW | HIGH | live production read-only query | operational capability unavailable until explicit rollout; safer than accidental activation | keep fail-closed; enable one provider only after complete readiness checklist | Integrations | NO | ACCEPTED CURRENT STATE |
| R-023 | “Market” product vs legacy Business marketplace naming collision | Product architecture | LOW | HIGH | registry Market is planned while app/api/marketplace and storefront marketplace runtime already exist | readiness reports/UX can conflate unrelated domains | consistently call existing surface “Business marketplace”; reserve Orçaly Market for product | Product/UX | NO | OPEN |
| R-024 | No universal request-ID propagation | Observability | MEDIUM | MEDIUM | shared reporter/admin health use requestId; universal proxy propagation not proven | harder incident correlation across request/job/provider boundaries | global ingress ID + propagation to jobs/audit/provider logs | Platform/ops | NO | OPEN |

## Top risks

### 1. R-001: schema drift
This is the highest release-operations risk because the drift is already real, spans production/staging/repository and affects both integrations and Wealth. The mitigation is process discipline plus schema evidence, not “run all migrations and see what happens.”

### 2. R-002: Business end-to-end coverage
Business has the broadest runtime footprint. The lack of one modern hosted journey crossing customer/storefront, checkout, order, delivery and finance is a higher confidence release risk than speculative micro-bugs.

### 3. R-020: continuing Wealth changes
Agent 1 is adding new migrations/runtime while this audit is intentionally frozen. Final signoff must refresh from the integrated candidate, not reuse this snapshot blindly.

### 4. R-009: global Auth/MFA
Scoped controls exist, but authentication is a platform boundary. Partial evidence cannot be promoted into a global PASS.

### 5. R-011: alerting gap
Errors are observable after inspection. Production readiness requires knowing when to inspect without relying on a person noticing first.

## Risk acceptance rules

A risk may move to ACCEPTED only when:
- owner is explicit;
- impact and operational consequence are understood;
- mitigation/monitoring exists or the risk is consciously tolerated;
- acceptance is tied to a release/SHA when relevant.

“Tests passed somewhere last week” is not risk acceptance.

## Refresh trigger

Regenerate this register when any of the following occurs:
- Agent 1/2/3 branch is integrated;
- production/staging migration history changes;
- integration feature flags change;
- provider credentials/connections are configured;
- final candidate SHA is frozen;
- Supabase Advisor counts materially change;
- global lint becomes green;
- Business hosted E2E is completed.
