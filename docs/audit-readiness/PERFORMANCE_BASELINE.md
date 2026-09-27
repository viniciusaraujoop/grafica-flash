# Performance Baseline

Audit snapshot: 2026-09-27
Base SHA: 9a2c66dbb2e6bf00c484b1791103b2bccd15becd
No runtime performance mutation or load test was performed.

## Baseline rule

If a metric was not measured with an appropriate tool, it is recorded as NOT_MEASURED. Source size, route count or advisor warnings are indicators, not fabricated milliseconds.

## Measured / observed signals

| Signal | Value | Evidence | Confidence |
| --- | --- | --- | --- |
| Next.js version | 16.3.4 | package.json | CONFIRMED |
| React version | 19.2.4 | package.json | CONFIRMED |
| app route pages | 202 | repo tree | CONFIRMED |
| route handlers | 182 | repo tree | CONFIRMED |
| Vercel exact base deployment | READY | dpl_4JpN5CxFx9qT4nMgy3kTANxEKLek | CONFIRMED |
| Vercel deployment region observed | iad1 | deployment metadata | CONFIRMED |
| Supabase production region | sa-east-1 | project metadata | CONFIRMED |
| Supabase staging region | sa-east-1 | project metadata | CONFIRMED |
| production unindexed FK warnings | 1 | Supabase Performance Advisor | CONFIRMED |
| production auth RLS initplan warnings | 63 | Supabase Performance Advisor | CONFIRMED |
| production multiple permissive policy warnings | 54 | Supabase Performance Advisor | CONFIRMED |
| production unused-index notices | 174 | Supabase Performance Advisor | CONFIRMED |
| staging unused-index notices | 296 | Supabase Performance Advisor | CONFIRMED but low-traffic staging makes interpretation weak |
| Vercel runtime error clusters, previous 24h | none returned | Vercel runtime-errors query | CONFIRMED, not a performance metric |

## Core metrics

| Metric | Baseline |
| --- | --- |
| Server response p50/p95/p99 | NOT_MEASURED |
| Database query p50/p95/p99 | NOT_MEASURED |
| Web Vitals LCP/INP/CLS production distribution | NOT_MEASURED |
| JS bundle total / per-route | NOT_MEASURED |
| React hydration time | NOT_MEASURED |
| cold-start latency | NOT_MEASURED |
| API throughput | NOT_MEASURED |
| background job throughput | NOT_MEASURED |
| job queue latency | NOT_MEASURED |
| webhook processing latency | NOT_MEASURED |
| external provider latency | NOT_MEASURED |
| memory / CPU | NOT_MEASURED |
| cache hit ratio | NOT_MEASURED |

## Topology risk: Vercel iad1 ↔ Supabase sa-east-1

CONFIRMED topology:
- frozen Preview deployment reports region iad1;
- both Supabase projects report sa-east-1.

INFERRED impact:
server functions that make synchronous Supabase calls can incur inter-region network latency. The magnitude is NOT_MEASURED and should not be guessed.

Recommended evidence:
1. capture Server-Timing around representative Supabase calls;
2. compare a no-DB route vs one-query vs multi-query route;
3. confirm actual production function placement before changing regions;
4. do not move infrastructure solely from this audit finding.

Priority: P1 performance investigation.

## Build characteristics

package.json prebuild runs a large validation chain before next build, including:
- test suite;
- payment-flow verification;
- integration/security/ecosystem verification;
- scoped eslint over many critical paths.

This increases build gate cost but is intentional release safety. Build duration was NOT_MEASURED in this audit.

The exact frozen Vercel deployment reached READY. This proves a successful hosted build for that SHA, not a bundle or runtime performance target.

## Large client components / hydration indicators

| File | Approx. lines | Client | Risk |
| --- | ---: | --- | --- |
| components/food/DeliveriesManager.tsx | 1,746 | yes | HIGH structural indicator: hydration/state/query coupling |
| app/painel/produtos/page.tsx | 1,659 | yes | HIGH structural indicator |
| components/financeiro/FinancialAreaClient.tsx | 1,397 | yes | HIGH structural indicator |
| components/painel/MarketplacePaymentsPanel.tsx | 796 | yes | MEDIUM/HIGH structural indicator |
| components/food/DeliveryZonesManager.tsx | 456 | yes | MEDIUM |
| components/orders/OrdersWorkspaceV2.tsx | 382 | yes | MEDIUM |

These labels describe structural performance risk, not measured slowness.

Recommended later work:
- measure route bundle contribution;
- split data/loading/error boundaries before cosmetic component splitting;
- move server-safe initial reads to server components only when behavior remains equivalent;
- avoid decomposition solely to reduce line count.

## Client/server boundary

Observed patterns:
- app/painel/layout.tsx is server-side and force-dynamic.
- several Business modules are client components that query Supabase directly.
- report pages fetch internal APIs from the browser.
- public /site/[slug] is force-dynamic.
- checkout shell delegates to a client experience.

Risks:
- extra hydration and browser waterfalls;
- duplicated company-context lookup;
- larger client bundles;
- harder cache use.

Exact waterfall count: NOT_MEASURED.

## Database advisor findings

### auth_rls_initplan: 63 warnings

Supabase Advisor reports policies that re-evaluate auth/current_setting functions per row. At scale this can increase query cost.

This is a concrete optimization target. However, policy rewrites are authorization changes and must be accompanied by RLS truth-table regression.

Priority: P1 after integrated security tests.

### multiple_permissive_policies: 54 warnings

Multiple permissive policies can create extra policy evaluation work in addition to security complexity.

Performance impact: INFERRED, not measured.

Priority: P1/P2 after policy semantics are locked.

### unindexed foreign key

Production Advisor reports one:
integration_push_channels_connection_id_fkey lacks a covering index.

Google Calendar uses integration_push_channels by connection/channel state, so a covering index should be evaluated.

Impact: workload-dependent; NOT_MEASURED.
Priority: P2 until watch volume is known.

### unused indexes

Production: 174 notices.
Staging: 296 notices.

Do not delete indexes from this count alone:
- production traffic may be low or reset statistics;
- staging is especially unsuitable for proving an index is unnecessary;
- some indexes exist for rare operational/recovery queries.

Priority: INFO until query statistics and workload are representative.

## Query-pattern indicators

### Business direct queries

Large client components access multiple tables directly. Potential issues:
- repeated company/current-context reads;
- sequential queries;
- UI-triggered full-list refetches.

N+1 presence: UNKNOWN without targeted call tracing.

### Reports

reports/decision queries orders, proposals, crm_leads and order_status_history.
reports/storefront queries storefront_events, products and orders.

These are aggregate/read-heavy surfaces. Dataset-size performance is NOT_MEASURED.

Recommended:
- EXPLAIN ANALYZE against synthetic representative sizes in isolated staging;
- deterministic query-count assertions;
- response payload size caps.

### Google Calendar

Positive patterns:
- page size bounded;
- incremental sync token;
- controlled full-resync fallback;
- external mappings indexed by integration schema design;
- rate-limit Retry-After handling.

Provider latency/large-calendar behavior: NOT_MEASURED.

## Cache and revalidation

Observed:
- dynamic/force-dynamic behavior on authenticated panel and selected public routes.
- product/public-site pages contain dynamic data dependencies.
- no comprehensive cache policy document was found in this audit.

Per-route cache correctness: UNKNOWN.
Cache hit rate: NOT_MEASURED.

Recommendation:
classify routes as:
1. personalized/authenticated: no shared cache;
2. company-public but frequently changing: short revalidation/tagged invalidation;
3. marketing/static: static/long-lived;
4. provider/webhook/API: uncached.

Do not apply broad caching without tenant and freshness tests.

## Image usage

The project contains both next/image and raw image usage. Global lint baseline includes 45 @next/next/no-img-element warnings.

Performance implication:
raw img may miss Next image optimization, dimensions or responsive sizing. Agent 3 owns behavior-preserving lint hardening; this audit does not modify images.

Required evidence:
- actual LCP element by key public pages;
- image transfer bytes;
- layout shift;
- third-party image behavior.

Current metrics: NOT_MEASURED.

## Background jobs

Generic worker supports:
- claim
- settle
- stale recovery
- provider retry timing
- registered handlers including integration sync, calendar full resync/watch renewal, email send and Wealth recurrence.

Production background_jobs had zero rows at observation.
Staging had no rows at the later aggregate observation.

This is state at a point in time, not capacity evidence.

Queue depth/processing p95: NOT_MEASURED.

## JSON payloads

Known areas with potentially large payloads:
- reports;
- admin system health;
- marketplace/catalog data;
- integration provider payloads;
- AI/admin events.

Actual response sizes: NOT_MEASURED.

Recommendation:
instrument Content-Length/serialized byte size on representative high-cardinality APIs before adding arbitrary pagination limits.

## Hydration and UI risk

Highest structural candidates:
1. DeliveriesManager
2. Products page
3. FinancialAreaClient
4. MarketplacePaymentsPanel

For each, measure:
- route JS transferred;
- long tasks;
- hydration duration;
- React render count after primary interactions;
- network requests caused by one mutation;
- memory growth during repeated modal/table interactions.

## Performance release gate

Before READY_FOR_PRODUCTION:
- production-like Web Vitals sample exists for public Home, Business storefront, checkout and panel;
- API p95 measured for current-company, orders, products, reports and checkout;
- representative DB EXPLAIN evidence for reports/list queries;
- cross-region topology consciously accepted or corrected;
- 63 RLS initplan warnings triaged;
- integration_push_channels FK index decision documented;
- bundle size regression gate added for core routes or equivalent evidence;
- background-job queue/retry visibility exists;
- no performance change is made without tenant/security regression where RLS/query shape changes.

## Conclusion

The repository has strong functional verification but no trustworthy system-level performance baseline yet. The highest-value next performance work is measurement, not speculative optimization.

Most actionable current signals:
1. Vercel/Supabase region mismatch;
2. large hydrated Business surfaces;
3. 63 RLS initplan warnings;
4. report/query behavior without realistic-size measurements.
