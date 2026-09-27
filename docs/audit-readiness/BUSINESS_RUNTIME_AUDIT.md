# Business Runtime Audit

Audit snapshot: 2026-09-27
Base SHA: 9a2c66dbb2e6bf00c484b1791103b2bccd15becd
Rule: audit only; no Business runtime was modified.

## Classification

- STABLE: sufficient current evidence for the scoped behavior.
- PARTIAL: substantial runtime exists but the end-to-end contract is incomplete or not fully deployed.
- LEGACY: active preexisting implementation with material consolidation debt.
- NEEDS_TEST: implementation exists but current evidence is insufficient for final certification.
- NEEDS_HARDENING: implementation exists and concrete hardening debt was observed.
- BLOCKED_EXTERNAL: external provider/configuration blocks certification.
- UNKNOWN: evidence is insufficient.

No domain is promoted to STABLE merely because a page renders or a table exists.

## Executive summary

Business is a broad, functioning legacy-plus-modern product, not a small greenfield module. The panel has 102 page routes and mixes:
- server route handlers;
- direct browser Supabase/RLS data access;
- very large client components;
- newer API-backed workspaces;
- payment/marketplace/provider surfaces;
- older settings and public storefront code.

The largest release risk is not one identified catastrophic defect. It is breadth without a single current Business customer-to-order-to-delivery-to-finance hosted regression proving tenant isolation and failure states across the complete journey.

Existing QA documentation explicitly says the Business customer→order→finance live journey was not started in the ecosystem release evidence. That remains the conservative baseline.

## Domain inventory

| Domain | Classification | Main evidence | Flow / dependencies | Key risk | Existing evidence | Missing evidence | Priority |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Dashboard / panel shell | NEEDS_TEST | app/painel/layout.tsx, PanelAuthenticatedLayout.tsx, app/painel/inicio/page.tsx | Supabase SSR → company access → client panel | Very wide route surface; force-dynamic shell | Ecosystem/public QA and legacy tests | Hosted Business navigation/role matrix | P1 |
| Products / catalog | NEEDS_HARDENING | app/painel/produtos/page.tsx, app/api/products/[id]/route.ts | Browser Supabase + product APIs/storage | 1,659-line client page; direct client table operations; Agent 3 is changing this file | Product/API invariants in legacy suite | owner/member/tenant E2E, upload denial, regression after Agent 3 | P1 |
| Orders | NEEDS_TEST | OrdersWorkspaceV2.tsx, app/api/orders/route.ts, app/api/orders/[id]/route.ts | API-backed list/update; history; internal tasks; WhatsApp notification hook | Multi-side-effect updates require regression | Order APIs include company access and audit/history | full state transition, cross-tenant guessed ID, retry/error E2E | P0 |
| order_items | NEEDS_TEST | DB table/RLS, checkout/order creation flows | Nested under orders and company | Nested-resource authorization needs explicit proof | RLS present | cross-tenant parent/child mismatch tests | P0 |
| Deliveries | NEEDS_HARDENING | components/food/DeliveriesManager.tsx | Direct browser Supabase to deliveries/zones/payment_methods/orders | 1,746-line client component; high UI/query coupling | Existing delivery schema/runtime | hosted role/tenant/state transition tests | P1 |
| Finance | NEEDS_HARDENING | FinancialAreaClient.tsx, financial_transactions | Direct browser Supabase/RLS | 1,397-line client component; overlapping permissive RLS policies | RLS enabled; reports exist | owner/manager/member denial matrix, reconciliation E2E | P0 |
| Payments | PARTIAL | lib/payments/**, app/api/webhooks/asaas/route.ts, Mercado Pago routes | Provider webhook → payment tables → order/subscription/finance side effects | External behavior and replay/failure semantics need provider QA | payment verification scripts; webhook authentication/idempotency patterns | hosted external sandbox matrix, failure recovery, provider credential readiness | P0 |
| Marketplace payments | PARTIAL | MarketplacePaymentsPanel.tsx, app/api/marketplace/payments/** | Mercado Pago OAuth/settings/sales/webhook | External OAuth/provider dependency | storefront-marketplace workflow/script | current external sandbox certification | P1 |
| Marketplace catalog/order | NEEDS_TEST | app/api/marketplace/**, Food/SegmentMarketplaceCatalog | storefront → stock/order/payment | Existing and future “Market” product naming can confuse ownership; broad legacy paths | verify-storefront-marketplace-v2.mjs | current full purchase/stock race/rollback E2E | P1 |
| Checkout | NEEDS_TEST | CheckoutClient/Shell, app/api/checkout/[slug]/route.ts | public request → rate limit/same-origin → checkout service → order/payment | Public abuse/race/provider failure paths | rate limiting and idempotency code observed | current hosted anonymous checkout, double-submit, tenant binding | P0 |
| Public storefront | NEEDS_TEST | app/site/[slug]/page.tsx, PublicSiteClient/Renderer, storefront APIs | public company lookup → catalog → checkout | force-dynamic public route; large legacy component family | storefront-marketplace v2 verifier/workflow | current visual+functional matrix at frozen SHA | P1 |
| Company settings | NEEDS_HARDENING | app/api/company/settings/route.ts, ConfiguracoesLegacy.tsx | privileged settings through service-role-backed server route | 412-line privileged route; broad mutation surface; MFA/privileged audit must stay enforced | security/MFA infrastructure exists | action-by-action role/MFA regression after lint branch | P0 |
| Business hours | NEEDS_TEST | BusinessHoursManager.tsx, business_hours | direct browser RLS | direct client write boundary | RLS enabled | member-role and tenant denial E2E | P2 |
| Delivery zones | NEEDS_TEST | DeliveryZonesManager.tsx, delivery_zones | direct browser RLS | pricing/logistics correctness and tenant denial | RLS enabled | boundary values and cross-tenant E2E | P1 |
| Payment methods | NEEDS_TEST | PaymentMethodsManager.tsx, payment_methods | direct browser RLS | checkout dependency | RLS enabled | disabled method/tenant/checkout consistency | P1 |
| Auth / company context | NEEDS_HARDENING | proxy.ts, company-access.ts, current-company-client.ts | Supabase auth + company membership + service-role server access | global hosted Auth/MFA still open; overlapping policies add complexity | ecosystem auth tests + current RLS | whole Business role matrix against hosted staging | P0 |
| Admin | NEEDS_HARDENING | app/admin/**, app/api/admin/** | platform admin permissions + service role | large privileged surface; active Agent 3 edits | admin QA workflows/security checks | final post-merge admin permission regression | P0 |
| Reports | NEEDS_TEST | app/painel/relatorios/page.tsx, reports/decision and reports/storefront APIs | client fetch → server company access → aggregate queries | aggregate correctness and query cost not currently measured | APIs are company-scoped | fixture correctness + large-data latency | P1 |
| Integrations | PARTIAL | IntegrationHub, lib/integrations/**, integrations APIs | feature flag → credentials/OAuth → jobs/webhooks | most providers are contract-only; production flags all off | Google Calendar implementation/tests; Resend code/tests | production provider setup and real external validation | P1 |
| Public API | PARTIAL | lib/integrations/public-api-keys.ts, app/api/v1/** | hashed API key → scopes → company context | migration exists in repo but is not in production migration history | timing-safe key compare and scoped key model | deploy/schema parity, rotation/revocation/rate-limit hosted tests | P1 |

## Panel and company boundary

app/painel/layout.tsx is server-rendered and force-dynamic. It obtains company access before rendering PanelAuthenticatedLayout. This is a useful centralized gate, but it does not replace table-level RLS or route-level authorization for APIs and browser-side Supabase access.

lib/company-access.ts is a critical trust boundary. It can construct a service-role client and resolves companies/members/platform admins. Therefore:
- it must remain server-only;
- every mutation using it must still constrain company IDs;
- the final QA matrix must include guessed-ID/cross-tenant tests rather than relying on UI navigation.

Status: CONFIRMED.

## Direct browser data access

Observed high-complexity client components:
- app/painel/produtos/page.tsx: 1,659 lines, direct products access.
- components/food/DeliveriesManager.tsx: 1,746 lines, direct deliveries, delivery_zones, payment_methods and orders access.
- components/financeiro/FinancialAreaClient.tsx: 1,397 lines, direct companies/company_members/financial tables access.
- BusinessHoursManager.tsx: direct business_hours access.
- DeliveryZonesManager.tsx: direct delivery_zones access.

Direct browser data access is not intrinsically unsafe when RLS is correct. It does make RLS a production authorization boundary and increases the cost of proving tenant isolation. That is why these areas remain NEEDS_TEST/NEEDS_HARDENING instead of STABLE.

## RLS observations

Read-only live production inspection confirmed RLS enabled on:
- companies
- company_members
- products
- orders
- order_items
- deliveries
- delivery_zones
- financial_transactions
- payment_methods
- marketplace payment tables
- integration tables
- background_jobs
- transactional_outbox
- application_error_events
- system_audit_logs

Supabase Advisor also reports 54 multiple-permissive-policy warnings. Examples include companies, company_members, financial_transactions, orders, order_items and products.

This does not prove a data leak. It proves policy overlap and authorization complexity that should be reduced or formally tested.

## Orders and nested resources

OrdersWorkspaceV2 uses:
- GET /api/orders
- PATCH-like order-specific API access through /api/orders/[id]

The API reads/writes orders and status history and can trigger audit/notification behavior. order_items is independently RLS-protected.

Required final tests:
1. Owner A can only read/update Company A.
2. Member A behavior matches exact role permissions.
3. User B cannot read/update an order guessed from A.
4. A valid order ID paired with the wrong company context is denied.
5. Child order_item cannot be accessed because its parent ID was guessed.
6. Status update is idempotent or safe under retry.
7. Side effects do not fire when authorization/update fails.

Status: missing hosted proof at this audit snapshot.

## Checkout

app/api/checkout/[slug]/route.ts imports:
- checkout service
- same-origin/security helpers
- DB-backed rate limiting
- request helpers

The route contains explicit rate-limit/idempotency signals. This is positive evidence. Final certification still requires hosted tests for:
- double submission;
- stale inventory/stock reservation;
- provider timeout;
- duplicate webhook;
- tenant/store slug mismatch;
- disabled payment method;
- invalid delivery zone;
- malformed monetary values.

## Uploads and storefront assets

Two different upload models exist:

1. Public art upload
   - app/api/public/uploads/art/route.ts
   - public endpoint
   - same-origin enforced
   - DB-backed rate limit: 5 / 600 seconds
   - 10 MiB maximum
   - JPEG/PNG/WEBP/PDF allowlist
   - magic-byte validation
   - random server-generated filename
   - public artes bucket

2. Authenticated site asset upload
   - app/api/site/upload/route.ts
   - requester + canManage required
   - service-role storage write
   - 10 MiB maximum
   - JPEG/PNG/WEBP/GIF declared MIME allowlist
   - sanitized path/filename
   - public site-assets bucket
   - no content magic-byte validation observed
   - no explicit route-level rate limiter observed

The second path is a hardening target, not a demonstrated exploit.

## Payments and webhooks

Positive controls observed:
- Asaas requires an access token.
- Asaas stores provider event ID + payload hash and uses upsert for event tracking.
- Mercado Pago subscription webhook verifies provider signature.
- Google Calendar webhook validates channel/resource/token/expiry and event idempotency.
- Resend webhook verifies Svix HMAC, timestamp tolerance and event idempotency.
- WhatsApp webhook signature verification exists but is frozen/out of this agent's implementation scope.

Remaining readiness questions:
- sandbox/production credential state;
- replay behavior under provider retries;
- dead-letter/manual recovery;
- provider outage behavior;
- finance/order consistency after partial failures.

## Reports

app/painel/relatorios/page.tsx calls:
- /api/reports/decision?days=...
- /api/reports/storefront?days=...

Those routes query orders/proposals/CRM/status history and storefront events/products/orders respectively, under server company access.

Functional aggregation correctness and performance at realistic row counts were not measured in this audit.

## Existing QA evidence

Relevant existing assets:
- scripts/verify-payment-flow-boundaries.mjs
- scripts/verify-storefront-marketplace-v2.mjs
- scripts/security-check.mjs
- scripts/admin-security-check.mjs
- scripts/e2e-auth-first-login.mjs
- scripts/verify-orcaly-3-1-mfa.mjs
- .github/workflows/storefront-marketplace-v2.yml
- .github/workflows/platform-evolution-auth-qa.yml
- docs/qa/ORCALY_QA_MATRIX.md
- docs/qa/ORCALY_SECURITY_TESTS.md

Important inherited statement from ORCALY_QA_MATRIX.md at the base snapshot:
Business customer→order→finance was NOT_STARTED as a live journey.

## Business release gate

Business should not be declared final-ready until all of the following are evidenced on the integrated candidate:
- hosted auth with owner/manager/member/outsider matrix;
- tenant isolation for products/orders/order_items/deliveries/finance/settings;
- customer/storefront→checkout→order→delivery→finance journey;
- duplicate/retry/provider-failure behavior;
- storage denial and file-type checks;
- marketplace/payment sandbox checks;
- reports correctness on deterministic fixtures;
- mobile/desktop/a11y/error/empty/loading states;
- observability evidence for intentionally triggered safe failures;
- regression after Agent 3 lint hardening.

## Audit conclusion

Business is functionally substantial and likely carries the highest breadth-related regression risk in the repository. The correct next move is not a rewrite. It is evidence-driven hosted regression focused on tenant boundaries and the customer-to-cash lifecycle, after parallel branches are integrated.
