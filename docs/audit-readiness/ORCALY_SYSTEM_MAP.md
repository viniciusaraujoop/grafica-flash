# Orçaly System Map

Audit snapshot: 2026-09-27
Base SHA: 9a2c66dbb2e6bf00c484b1791103b2bccd15becd
Source branch at audit start: codex/orcaly-ecosystem
Audit branch: gpt/orcaly-audit-readiness
Runtime mutation: NONE

## Evidence rules

- CONFIRMED: directly observed in repository, GitHub/Vercel metadata, or read-only Supabase queries.
- INFERRED: technically supported inference that was not exercised end-to-end in this audit.
- UNKNOWN: evidence was absent, stale, or not safe to obtain without side effects.
- This is a point-in-time map at the frozen base SHA. The source branch advanced after the audit started.

## Repository scale

| Signal | Snapshot | Confidence |
| --- | ---: | --- |
| Versioned blobs | 1,985 | CONFIRMED |
| app/** files | 620 | CONFIRMED |
| Route pages | 202 | CONFIRMED |
| Route handlers | 182 | CONFIRMED |
| components/** files | 152 | CONFIRMED |
| lib/** files | 186 | CONFIRMED |
| Supabase migration files | 94 | CONFIRMED |
| GitHub workflows | 13 | CONFIRMED |
| Non-asset docs/qa files | 67 | CONFIRMED |

Primary evidence: repository tree at the base SHA, package.json, app/**, components/**, lib/**, supabase/**, .github/workflows/** and docs/qa/**.

## Product map

| Product / surface | Runtime truth | Main files/routes | Logical owner | State | Risk / gap |
| --- | --- | --- | --- | --- | --- |
| Mother / Hub | Root product discovery + authenticated /apps hub | lib/ecosystem/products.ts, components/ecosystem/**, app/apps/**, app/manifest.ts | Shared platform | PARTIAL | Global release is not certified; product-specific PWA remains gated. CONFIRMED |
| Business | Existing company runtime | app/painel/**, app/business/page.tsx, company/business APIs | Business | AVAILABLE / NEEDS_FINAL_QA | Broad legacy surface and direct client DB access remain. CONFIRMED |
| Wealth | Personal product | app/apps/wealth/**, lib/wealth/**, components/wealth/** | Agent 1 | PREVIEW / CERTIFIED_BY_UNIT | Morning/Night runtime at base SHA has dedicated migration/tests and exact READY Preview evidence. Production DB is not promoted. CONFIRMED |
| Growth | Product identity only | lib/ecosystem/products.ts, app/admin/growth/** is partner/admin functionality, not Orçaly Growth product runtime | Future product | PLANNED | Do not confuse affiliate growth screens with product completion. CONFIRMED |
| Flow | Product identity only | lib/ecosystem/products.ts | Future product | PLANNED | No product runtime located. CONFIRMED |
| Academy | Product identity only | lib/ecosystem/products.ts | Future product | PLANNED | Partner academy components are not the Orçaly Academy product. CONFIRMED |
| Market | Product identity only; existing Business marketplace is separate | lib/ecosystem/products.ts, existing app/api/marketplace/** | Future product / Business marketplace | PLANNED + LEGACY MARKETPLACE | Naming collision can mislead readiness reporting. CONFIRMED |
| Partners | Existing partner portal | app/parceiros/**, components/parceiros/** | Partners | AVAILABLE / EXISTING | Existing portal is separate from future UX foundation work. CONFIRMED |
| One | Product identity only | lib/ecosystem/products.ts | Future bundle | PLANNED | Composition/pricing unpublished. CONFIRMED |
| Intelligence | Existing Business assistant partial; shared intelligence architecture not started | docs/architecture/ORCALY_INTELLIGENCE.md, AI routes/events | Shared intelligence | PARTIAL | Shared model router, tool registry, evaluation harness and Decision Receipts are explicitly not started. CONFIRMED |

Product registry evidence: lib/ecosystem/products.ts lists business, wealth, growth, flow, academy, market, partners and one. Intelligence is documented separately and is not present in that registry.

## Route topology

### Public surfaces

Representative public routes:
- / and product marketing/discovery
- /business
- /produtos/[slug]
- /site/[slug]
- /loja/[slug]
- /checkout/[slug]
- /orcamento/[slug]
- partner/public activation and payment-return surfaces
- public API endpoints under app/api/public/** and app/api/v1/**

Status: CONFIRMED by app tree. This list is representative; the repository contains 202 page routes.

### Authenticated surfaces

- /apps and /apps/wealth/**
- /painel/** with 102 page routes under the panel root
- /admin/** with 34 page routes
- /parceiros/** partner portal routes
- MFA/login/account flows

Status: CONFIRMED.

### API topology

There are 182 route handlers. Large families include:
- app/api/admin/**
- app/api/ai/**
- app/api/assinatura/**
- app/api/checkout/**
- app/api/company/**
- app/api/cron/**
- app/api/integrations/**
- app/api/marketplace/**
- app/api/orders/**
- app/api/payments/**
- app/api/public/**
- app/api/reports/**
- app/api/webhooks/**
- app/api/whatsapp/**
- app/api/wealth/**

Status: CONFIRMED.

## Platform areas

| Area | Main evidence | Dependencies | Owner | State | Risk / tests / gaps |
| --- | --- | --- | --- | --- | --- |
| Supabase | lib/supabase-server.ts, lib/company-access.ts, 94 migration files | Postgres/Auth/Storage | Shared platform | ACTIVE | Production and staging schemas intentionally differ. No blind promotion is safe. CONFIRMED |
| Auth | Supabase SSR, proxy.ts, login/MFA routes | Supabase Auth | Shared platform | PARTIAL | Hosted auth/MFA global certification remains an open gate despite module-level tests. CONFIRMED |
| Tenant/company context | lib/company-access.ts, lib/current-company-client.ts, company APIs | companies, company_members, RLS | Business/platform | ACTIVE / NEEDS_HARDENING | Multiple overlapping RLS policies; broad legacy surface. CONFIRMED |
| Entitlements | ecosystem access contracts + DB migrations | Supabase | Shared platform | PARTIAL | New ecosystem boundaries are tested; whole legacy surface not recertified. CONFIRMED |
| Storage | Production buckets artes, financeiro, logos, product-images, produtos, site-assets | Supabase Storage | Business | ACTIVE / MIXED | Five public buckets; only artes/site-assets have live MIME allowlists. Financeiro is private. CONFIRMED |
| Jobs | lib/jobs/**, app/api/cron/jobs/route.ts, background_jobs | CRON_SECRET, Supabase RPCs | Shared platform | IMPLEMENTED | Generic worker, retry/recovery RPCs. Production had no queued rows at observation. CONFIRMED |
| Cron | pg_cron + API cron | Postgres/Vercel | Shared platform | PARTIAL | Production pg_cron has orcaly-release-expired-stock every 5 minutes. Staging recurrence cron exists but is inactive. CONFIRMED |
| Integrations | lib/integrations/**, app/api/integrations/** | external providers | Integrations | PARTIAL | Calendar engineered; Resend repo-only for DB promotion; most others are configuration-only contracts. CONFIRMED |
| Payments | lib/payments/**, checkout/webhook APIs | Asaas, Mercado Pago | Payments | ACTIVE / NEEDS_EXTERNAL_QA | Webhook/idempotency infrastructure exists. External-provider production readiness not certified here. CONFIRMED |
| Admin | app/admin/**, app/api/admin/** | platform_admins, service role, audit tables | Platform admin | ACTIVE / NEEDS_HARDENING | Large privileged surface; Agent 3 is currently touching several admin files for lint hardening. CONFIRMED |
| Wealth | lib/wealth/**, app/apps/wealth/** | staging Wealth schema | Agent 1 | ACTIVE PREVIEW | Certified units live only in staging/Preview; production promotion intentionally absent. CONFIRMED |
| Business | app/painel/** + core business APIs | company context, RLS | Business | ACTIVE / LEGACY+MODERN | Functional breadth is high; final cross-domain Business E2E is missing. CONFIRMED |
| Marketplace | app/api/marketplace/**, storefront components | Mercado Pago, stock, orders | Business marketplace | PARTIAL | Existing runtime is separate from future Orçaly Market product. CONFIRMED |
| Delivery | components/food/DeliveriesManager.tsx + tables | deliveries, zones, orders, payment methods | Business | ACTIVE / NEEDS_TEST | 1,746-line client component with direct Supabase operations. CONFIRMED |
| Finance | components/financeiro/FinancialAreaClient.tsx + reports | financial tables, RLS | Business | ACTIVE / NEEDS_HARDENING | 1,397-line client component; RLS policy overlap exists. CONFIRMED |
| Marketing | components/marketing/**, public home/product routes | public content | Marketing | ACTIVE | Global lint debt overlaps legacy/main-site code. CONFIRMED |
| AI | Business assistant routes + assistant_events | model provider keys | AI/platform | PARTIAL | Shared Intelligence is explicitly incomplete. CONFIRMED |
| Observability | lib/observability/application-errors.ts, admin/system-health, audit/webhook tables | Supabase + Vercel | Platform | PARTIAL | Error IDs/request IDs/deployment correlation exist; tracing and proactive alerting were not found. CONFIRMED/INFERRED |
| CI/CD | 13 workflows + package scripts | GitHub Actions, Vercel | Shared platform | ACTIVE | Global lint baseline remains red; scoped gates exist. CONFIRMED |
| Vercel | project orcaly | Next.js 16.3.4 | Deployment | ACTIVE | Base deployment dpl_4JpN5CxFx9qT4nMgy3kTANxEKLek is READY. Region observed: iad1. CONFIRMED |

## Database topology

### Production

Project: ozrasuktfthsvbqprtel
Region: sa-east-1
State at observation: ACTIVE_HEALTHY
Live migrations: 51
Last live migration: 20260910150730_google_calendar_complete

Relevant live tables include companies, company_members, products, orders, order_items, deliveries, delivery_zones, financial_transactions, payment_methods, marketplace payment tables, integration foundation tables, background_jobs, transactional_outbox, application_error_events and system_audit_logs. RLS is enabled on the inspected tables.

### Staging

Project: zwxulgpjucxudadjdqov
Region: sa-east-1
State at observation: ACTIVE_HEALTHY
Live migrations: 25
Last live migration at snapshot: 20260927132000_wealth_morning_night_briefing

Staging uses a production-schema baseline plus Wealth continuation migrations. It is not a byte-for-byte mirror of production and does not currently contain integration rollout seed rows observed in production.

## Storage

Production buckets:
- artes: public, 10 MiB, JPEG/PNG/WEBP/PDF allowlist
- financeiro: private, 25 MiB, no bucket MIME allowlist observed
- logos: public, 5 MiB, no bucket MIME allowlist observed
- product-images: public, 25 MiB, no bucket MIME allowlist observed
- produtos: public, 25 MiB, no bucket MIME allowlist observed
- site-assets: public, 10 MiB, JPEG/PNG/WEBP/GIF allowlist

Staging adds wealth-documents as private, 3 MiB, PDF/JPEG/PNG.

Production storage.objects policies are company-path scoped for authenticated Business writes on the managed buckets. Wealth adds separate authenticated policies in staging.

## Integration map

Registered runtime providers at the base SHA:
- Google Calendar
- Resend
- Google Maps
- NFS-e
- Google Business Profile
- Google Drive
- Google Sheets
- Meta Leads
- Clicksign
- Mercado Livre
- Shopee
- Bling
- Omie
- Zapier
- Make
- n8n

Google Calendar and Resend have real provider adapters. The remaining registered providers use configuration-only adapters that explicitly reject synchronization. Gmail, Slack, Teams and Open Finance are excluded/frozen from the catalog at this stage.

Production has 21 integration feature flags and every observed flag is globally disabled. No integration_connections rows existed at observation.

## Security boundary map

Positive controls observed:
- server-only service role usage in company-access and security/integration infrastructure
- OAuth state + PKCE persistence/consume RPCs
- credential RPCs unavailable to anon/authenticated roles
- Google Calendar channel-token hash check and webhook idempotency
- Resend Svix signature with timestamp tolerance and timing-safe comparison
- public-art upload same-origin check, DB-backed rate limit, size/type and magic-byte validation
- checkout rate limiting and idempotency
- application errors sanitize persisted metadata

Open global gates:
- one authenticated SECURITY DEFINER RPC is flagged by Supabase Advisor
- leaked-password protection is disabled in production
- 54 multiple-permissive-policy warnings
- hosted Auth/MFA whole-app review remains open
- existing Business nested-resource/storage denial needs final cross-domain QA

See SECURITY_HARDENING_BACKLOG.md.

## Observability map

Present:
- application_error_events
- structured JSON console error emission
- generated errorId and requestId
- Vercel deployment/Git SHA correlation
- admin system-health read model
- payment webhook event persistence
- WhatsApp message logs
- security/audit event tables
- integration audit foundation
- job state/error fields

Not proven:
- distributed tracing
- SLO/SLI definitions
- proactive paging/alert routing
- durable provider-level metrics for every integration
- full request-ID propagation across every route

## CI/CD and deployment

Workflows include platform, auth, marketplace/storefront, main-site visual, partner portal, Wealth Tax and Wealth Briefing QA.

At the frozen SHA:
- Vercel combined status: success
- exact deployment: dpl_4JpN5CxFx9qT4nMgy3kTANxEKLek
- deployment state: READY
- framework: Next.js
- Vercel region observed: iad1
- Supabase region: sa-east-1
- Vercel runtime-error query for the project over the preceding 24h returned no clusters

The absence of runtime error clusters is not evidence of load, coverage or latency quality. It only means no Vercel runtime-error clusters were returned for that window.

## Source-of-truth drift

CONFIRMED: the execution handoff files as read at the initial base state described Morning/Night as the next unit, while the frozen base SHA already contained the Morning/Night migration, test command and workflow and corresponded to the eventual certified Preview deployment. The Agent 1 branch subsequently updated the execution docs and moved to Alerts.

Risk: documentation can lag executable state during rapid parallel work. Integration must privilege exact SHA + executable evidence over narrative handoff text.

## External providers

Observed or referenced provider dependencies:
- Supabase
- Vercel
- GitHub Actions
- Google Calendar / Google APIs
- Resend
- Google Maps
- Google Business Profile
- Mercado Pago
- Asaas
- Meta
- Clicksign
- Mercado Livre
- Shopee
- Bling
- Omie
- Zapier
- Make
- n8n
- WhatsApp Cloud API
- model provider(s) for Business AI

Provider existence in code does not imply production configuration or approval.
