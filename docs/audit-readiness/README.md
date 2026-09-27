# Orçaly Audit & Readiness

Audit snapshot: 2026-09-27  
Audit base SHA: `9a2c66dbb2e6bf00c484b1791103b2bccd15becd`  
Audit branch: `gpt/orcaly-audit-readiness`  
Source branch at freeze: `codex/orcaly-ecosystem`  
Runtime changes by Agent 4: **NONE**  
Database / migrations / CI / dependencies / production changes by Agent 4: **NONE**

## Status

**AUDIT_COMPLETE_FOR_SNAPSHOT / FINAL_RELEASE_SIGNOFF_PENDING**

This audit is complete for the frozen base SHA and records live read-only evidence from GitHub, Vercel, production Supabase and staging Supabase.

It is not a production-readiness declaration.

The source branch continued advancing after the audit freeze. Therefore the final release candidate must receive a delta audit before any final signoff.

## Where we are

At the frozen base:
- the Orçaly repository is a large single Next.js application with **1,985 versioned blobs**, **202 page routes**, **182 route handlers**, **152 component files**, **186 lib files**, **94 migration files** and **13 GitHub workflows**;
- Business is a broad existing runtime with **102 panel page routes** and a mixture of server APIs, direct browser Supabase/RLS access and legacy/newer surfaces;
- Wealth has strong staged certification through **Morning / Night** at the exact frozen runtime SHA;
- Growth, Flow, Academy, Market and One remain planned product surfaces rather than complete runtimes;
- Partners has an existing operational portal;
- Intelligence is partial for the preexisting Business assistant; the shared Intelligence architecture is not complete;
- production and staging are healthy at the infrastructure level, but their schema histories differ materially;
- the exact frozen Vercel deployment is READY;
- the system is **not globally ready for production promotion**.

## Strongest areas

### Wealth certified scope
The strongest current evidence is the Agent 1 certification chain through Morning / Night:
- hosted staging auth;
- owner/RLS/cross-user/entitlement checks;
- responsive coverage;
- light/dark;
- Axe;
- keyboard/focus;
- reduced motion;
- cleanup;
- production-read-only detector;
- exact immutable Preview SHA.

This does **not** certify later Wealth units added after the audit freeze.

### Ecosystem identity / authorization foundation
The ecosystem foundation has concrete entitlement, consent and RLS tests, including cross-user denial.

### Google Calendar engineering
Google Calendar has:
- OAuth + PKCE;
- scope validation;
- mapping;
- incremental sync;
- controlled full-resync;
- watch channels;
- webhook idempotency;
- token/resource validation;
- retry classification.

Production rollout is still disabled and no live connection existed at observation.

### Observability primitives
The platform already has:
- application error persistence;
- error IDs;
- request IDs in selected paths;
- sanitized metadata;
- deployment/Git correlation;
- admin system-health aggregation;
- webhook/job/audit event persistence.

The remaining gap is platform-wide adoption and proactive alerting.

## Biggest risks

1. **Database/schema drift**
   - repository: 94 migration files;
   - production live history: 51 migrations, ending at Google Calendar;
   - staging: separate 25-migration Wealth continuation chain at the audit snapshot.
   - A blind migration push is unsafe.

2. **Business final end-to-end evidence**
   - the active Business runtime is broad;
   - existing QA explicitly records the live customer→order→finance journey as not completed;
   - nested tenant/resource denial still needs final hosted proof.

3. **Moving parallel branches**
   - Agent 1 continued adding Wealth runtime/migrations after the audit base;
   - Agent 3 is changing Business/admin files that this audit inspected;
   - Agent 2 adds isolated TypeScript/TSX that still participates in project-wide build/typecheck.

4. **Global Auth/MFA readiness**
   - useful MFA/step-up primitives exist;
   - global hosted lifecycle and privileged-action coverage remains incomplete.

5. **Operations readiness**
   - alerting, tracing, queue-age SLI and recovery/restore evidence are incomplete.

6. **Performance baseline**
   - trusted latency/Web Vitals/bundle/queue metrics are not yet measured;
   - exact Preview reports Vercel `iad1` while Supabase is `sa-east-1`, so cross-region DB latency must be measured rather than guessed.

## Current blockers

- final Agent 1/2/3 heads are not yet frozen into one candidate;
- global lint baseline remains inherited red until Agent 3 finishes and the integrated candidate is rerun;
- DB migration reconciliation is mandatory before promotion;
- Business final hosted E2E is still open;
- global Auth/MFA gate is still open;
- provider credentials/approvals/configuration block live integrations;
- Resend repository runtime is ahead of production DB schema;
- backup/PITR/restore readiness was not provable from the available read-only evidence;
- performance and proactive observability gates are incomplete.

## Security summary

No **CRITICAL** or **HIGH** security vulnerability is asserted by this audit because the evidence did not support one.

Concrete findings include:
- production leaked-password protection disabled;
- 54 multiple-permissive-policy Advisor warnings;
- an authenticated `SECURITY DEFINER` admin lookup RPC flagged by Advisor, but its inspected definition restricts results to `auth.uid()`; this is a least-privilege review item, not evidence of cross-user exposure;
- public art upload is well validated but can store content for an active company slug without a signed upload intent;
- authenticated site-assets upload has weaker content validation and no explicit route-level rate limiter;
- hosted global Auth/MFA certification remains open.

See `SECURITY_HARDENING_BACKLOG.md`.

## Performance summary

Measured metrics such as route p95, DB p95, Web Vitals, bundle size, hydration time and queue latency are **NOT_MEASURED**.

Concrete performance indicators:
- Vercel `iad1` vs Supabase `sa-east-1`;
- large hydrated Business surfaces:
  - DeliveriesManager ~1,746 lines;
  - Products page ~1,659 lines;
  - FinancialAreaClient ~1,397 lines;
  - MarketplacePaymentsPanel ~796 lines;
- 63 RLS auth-initplan Advisor warnings;
- one unindexed foreign key warning;
- 54 multiple-permissive-policy warnings.

See `PERFORMANCE_BASELINE.md`.

## Integration summary

Production snapshot:
- 21 integration feature flags;
- all observed flags disabled globally;
- zero `integration_connections`.

Engineering state:
- Google Calendar: real implementation; production schema exists; rollout disabled.
- Resend: real implementation in repository; production schema migration absent.
- Google Maps, NFS-e, Business Profile, Drive, Sheets, Meta Leads, Clicksign, Mercado Livre, Shopee, Bling, Omie, Zapier, Make and n8n: configuration-only contracts at the frozen base, not operational provider sync.
- Gmail, Slack, Teams and Open Finance: explicitly frozen/excluded from the active catalog.
- WhatsApp: existing separate runtime, frozen for this mission.

See `INTEGRATIONS_GAP_ANALYSIS.md`.

## Business summary

Business is active and broad, but final readiness evidence is uneven.

Highest-priority areas:
- orders / order_items;
- checkout;
- finance;
- company settings;
- tenant/company authorization;
- payments/reconciliation.

Main structural concerns:
- very large client components;
- direct browser Supabase access makes RLS a hard production authorization boundary;
- policy overlap complicates authorization review;
- one integrated hosted customer-to-cash journey is still missing.

See `BUSINESS_RUNTIME_AUDIT.md`.

## Parallel branches

| Agent | Branch | Responsibility | Current integration concern |
| --- | --- | --- | --- |
| Agent 1 | `codex/orcaly-ecosystem` | Wealth runtime, staging, certifications | New migrations/runtime after audit freeze |
| Agent 2 | `claude/orcaly-ux-foundation` | UX foundation, registry v2 prototype, Hub/Launcher/Palette/Landings | Additive files today; full-project build/type gate required |
| Agent 3 | `gpt/orcaly-quality-hardening` | inherited lint/static quality hardening | Touches Business/admin files audited here |
| Agent 4 | `gpt/orcaly-audit-readiness` | audit/readiness documentation | Docs-only; snapshot must be refreshed after integration |

At the observed heads there were no direct same-path collisions among the four branches. Semantic conflicts and audit staleness remain real.

See `CROSS_AGENT_CONFLICT_MAP.md`.

## Recommended integration order

1. Freeze latest accepted Agent 1 head.
2. Create the integration candidate from Agent 1.
3. Integrate Agent 2 additive UX foundation after its Preview/build gate.
4. Integrate Agent 3 quality hardening and run final global lint/type/build against the actual source set.
5. Refresh Agent 4 audit docs against the integrated candidate.
6. Reconcile DB/migration state.
7. Run global static/unit/security/dependency gates.
8. Deploy exact candidate SHA to protected Preview.
9. Run Business final hosted E2E.
10. Run Wealth rolling hosted regression.
11. Run final security/Advisor checks.
12. Measure performance and validate observability/alerts.
13. Validate provider/feature-flag state.
14. Validate recovery/rollback procedures.
15. Only then consider production promotion.

See `INTEGRATION_SEQUENCE.md`.

## Gates before production

Required:
- exact candidate SHA frozen;
- global lint/typecheck/build/test gates;
- database migration reconciliation;
- Business hosted tenant/customer-to-cash E2E;
- Wealth rolling regression;
- global Auth/MFA matrix;
- final security/Advisor review;
- measured performance baseline;
- proactive observability for critical failures;
- provider-specific readiness for anything enabled;
- backup/recovery/rollback evidence;
- explicit human release approval.

The detailed checklist is in `PRODUCTION_READINESS_CHECKLIST.md`.

## Audit document index

1. [ORCALY_SYSTEM_MAP.md](./ORCALY_SYSTEM_MAP.md)  
   Architecture, products, routes, APIs, Supabase, jobs, integrations, CI/CD and external providers.

2. [BUSINESS_RUNTIME_AUDIT.md](./BUSINESS_RUNTIME_AUDIT.md)  
   Domain-by-domain Business runtime status, flows, risk and missing tests.

3. [INTEGRATIONS_GAP_ANALYSIS.md](./INTEGRATIONS_GAP_ANALYSIS.md)  
   Provider implementation/configuration/auth/webhook/sync/readiness gaps.

4. [SECURITY_HARDENING_BACKLOG.md](./SECURITY_HARDENING_BACKLOG.md)  
   Evidence-based security findings, severity, preconditions, impact and ownership.

5. [PERFORMANCE_BASELINE.md](./PERFORMANCE_BASELINE.md)  
   Known indicators, explicit NOT_MEASURED metrics and measurement priorities.

6. [OBSERVABILITY_GAPS.md](./OBSERVABILITY_GAPS.md)  
   Logging, request IDs, errors, jobs, webhooks, health, metrics, tracing and alerting.

7. [FINAL_QA_MATRIX.md](./FINAL_QA_MATRIX.md)  
   Product/feature matrix across auth/RLS/tenant/UX/E2E/hosted/cleanup/observability.

8. [PRODUCTION_READINESS_CHECKLIST.md](./PRODUCTION_READINESS_CHECKLIST.md)  
   DB/auth/MFA/secrets/Vercel/jobs/integrations/payments/backup/recovery/release gates.

9. [TECHNICAL_RISK_REGISTER.md](./TECHNICAL_RISK_REGISTER.md)  
   Prioritized technical risks with evidence, likelihood, owner and blockers.

10. [CROSS_AGENT_CONFLICT_MAP.md](./CROSS_AGENT_CONFLICT_MAP.md)  
    Parallel-branch overlap, semantic conflicts, manual-review files and wait points.

11. [INTEGRATION_SEQUENCE.md](./INTEGRATION_SEQUENCE.md)  
    Controlled branch integration order, validation gates and rollback points.

## Next safe audit unit

After Agents 1/2/3 freeze their final heads:

**Run a delta audit from `9a2c66d...` to the integrated candidate, prioritizing Agent 1's new Wealth migrations/runtime and Agent 3's Business/admin diffs, then rerun the final Business + Wealth hosted gates and Supabase Advisors.**

This unit is read-only except for updating `docs/audit-readiness/**`.

## Final snapshot conclusion

The repository has significantly stronger automated evidence than a typical pre-release SaaS, especially around the certified Wealth chain and security primitives. The unresolved risk is concentrated in integration of moving branches, schema reconciliation, Business-wide hosted evidence, global Auth/MFA, measured performance, proactive operations and recovery.

No production-readiness claim should be made before those gates close.


## Final live branch snapshot before handoff

Final observed parallel heads:
- Agent 1: `b8df40d1b0f2991c1f594ea59d6d4d9e19302e78` — hosted Alerts matrix work.
- Agent 2: `0db9b5ba45c8ad54f97bb3b8a174bbc1dea14b5f` — handoff records Preview build/typecheck PASS; latest documentation-only head still showed Vercel pending at observation.
- Agent 3: `b0d4909457635801e7973128671cf6df0ea7ef57` — continued quality hardening.
- Agent 4: this audit branch, docs-only.

New coordination detail:
Agent 3's history now contains an intermediate Agent 1 lineage and is diverged from latest Agent 1. Final integration must therefore be merge-base aware and review the effective Agent 3-only delta rather than replaying the entire branch history from the original audit base.

The audit base remains intentionally frozen at `9a2c66dbb2e6bf00c484b1791103b2bccd15becd`; these later heads are recorded only to prepare the integration handoff.
