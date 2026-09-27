# Production Readiness Checklist

Audit snapshot: 2026-09-27
Base SHA: 9a2c66dbb2e6bf00c484b1791103b2bccd15becd

This checklist maps readiness. It does not declare the system production-ready.

Legend:
- PASS: evidenced for the scoped item.
- PARTIAL: some controls/evidence exist.
- OPEN: required gate not yet satisfied.
- BLOCKED_EXTERNAL: depends on provider/account/approval.
- UNKNOWN: not safely verified by this audit.
- NOT_APPLICABLE: not applicable to current runtime.

## Release identity

- [PASS] Base SHA frozen and recorded: 9a2c66dbb2e6bf00c484b1791103b2bccd15becd.
- [PASS] Audit branch isolated: gpt/orcaly-audit-readiness.
- [PASS] Exact base Vercel deployment identified: dpl_4JpN5CxFx9qT4nMgy3kTANxEKLek.
- [PASS] Exact base deployment state observed READY.
- [OPEN] Final integrated candidate SHA does not exist yet because parallel branches remain active.
- [OPEN] All gates must be rerun on the eventual merged candidate.

## Database

- [PASS] Production project is ACTIVE_HEALTHY at observation.
- [PASS] Staging project is ACTIVE_HEALTHY at observation.
- [PASS] Inspected Business/integration tables have RLS enabled.
- [OPEN] Repository migration inventory and production migration history are not aligned.
- [OPEN] Production ends at 51 live migrations / Google Calendar; repository contains later Resend, public API and Wealth migrations.
- [OPEN] Staging is a separate project, not a Supabase development branch of production.
- [PASS] Production Supabase branch list contains only default main.
- [PASS] Staging branch list is empty.
- [OPEN] Reconciliation plan required before any production schema promotion.
- [OPEN] No blind supabase db push.
- [OPEN] Post-integration Advisor scan required.

## Migrations

- [PASS] Base tree contains 94 migration files.
- [PASS] Staging Wealth chain is versioned and reaches Morning/Night at the snapshot.
- [OPEN] Confirm exact set/order intended for the next production promotion.
- [OPEN] Confirm all migrations are forward-only or have documented rollback/roll-forward strategy.
- [OPEN] Execute migrations first in isolated staging clone/equivalent environment with production-compatible schema.
- [OPEN] Run schema diff before and after.
- [OPEN] Confirm grants/RLS/functions/indexes/extensions.
- [OPEN] Confirm no historical migration is reapplied.

## RLS / authorization

- [PASS] RLS enabled on inspected core Business tables.
- [PASS] Wealth certified units have real staging owner/cross-user/unentitled evidence.
- [PARTIAL] Business has company access and existing RLS but lacks one final hosted nested-resource matrix.
- [OPEN] Test owner/manager/member/outsider across products/orders/order_items/delivery/finance/settings.
- [OPEN] Resolve/accept 54 multiple-permissive-policy Advisor warnings with tests before policy changes.
- [OPEN] Re-run cross-tenant guessed-ID tests after Agent 3 changes.

## Auth

- [PASS] Supabase SSR/client auth architecture exists.
- [PASS] proxy protects authenticated/admin/product surfaces.
- [PARTIAL] hosted Auth is proven for certified Wealth flows.
- [OPEN] whole-app login/logout/refresh/password-reset/expired-session matrix.
- [OPEN] role transition and revoked member-session tests.
- [OPEN] invalid redirect/deep-link regression across product routes.

## MFA

- [PASS] MFA assurance-level/step-up implementation exists.
- [PARTIAL] privileged settings integrate MFA helpers.
- [OPEN] enumerate every sensitive action and prove required step-up.
- [OPEN] hosted enrollment/challenge/recovery tests.
- [OPEN] emergency/support procedure for locked-out privileged users.

## Secrets

- [PASS] reviewed .env.example contains placeholders, not live secret values.
- [PASS] service role is used server-side in reviewed code.
- [PASS] integration credential RPCs are not executable by anon/authenticated.
- [OPEN] secret inventory by environment.
- [OPEN] ownership/rotation dates for Supabase service role, Google OAuth, Mercado Pago, Asaas, Resend, WhatsApp, AI/provider keys and CRON_SECRET.
- [OPEN] rotation rehearsal for critical provider credentials.
- [OPEN] verify no historical backups/artifacts contain secrets.

## Domains / DNS

- [PARTIAL] application has canonical/public URL assumptions such as ORCALY_PUBLIC_URL.
- [UNKNOWN] final production DNS records and TTL posture were not audited through a DNS-specific source.
- [OPEN] confirm apex/www/application routing.
- [OPEN] confirm TLS/certificate issuance.
- [OPEN] confirm webhook callback URLs use the intended production host.
- [OPEN] confirm no Preview URL is registered as a production OAuth/webhook callback.

## Vercel

- [PASS] project orcaly located and exact Preview deployment read.
- [PASS] base deployment is READY.
- [PASS] deployment SHA/source branch metadata matches.
- [PASS] no runtime-error clusters were returned for the preceding 24h query.
- [OPEN] final candidate deployment must be READY at final integrated SHA.
- [OPEN] confirm environment target/aliases for final candidate.
- [OPEN] confirm production region strategy relative to Supabase sa-east-1.
- [OPEN] final deployment protection/bypass policy review.
- [OPEN] no manual promote until all gates pass.

## Environment variables

Known required families include:
- NEXT_PUBLIC_SUPABASE_URL
- NEXT_PUBLIC_SUPABASE_ANON_KEY
- SUPABASE_SERVICE_ROLE_KEY
- CRON_SECRET
- ORCALY_PUBLIC_URL
- GOOGLE_INTEGRATIONS_CLIENT_ID
- GOOGLE_INTEGRATIONS_CLIENT_SECRET
- GOOGLE_INTEGRATIONS_REDIRECT_URI
- Mercado Pago subscription/marketplace variables
- Asaas credentials/webhook token
- WhatsApp variables
- AI/provider variables such as OPENAI_API_KEY where applicable

- [OPEN] verify required names exist in each intended environment without revealing values.
- [OPEN] verify Preview/Staging never points at production for mutation paths.
- [OPEN] verify public variables contain no privileged secret.
- [OPEN] detect stale/unused variables after final integration.

## Cron

Production read-only observation:
- orcaly-release-expired-stock
- schedule: every 5 minutes
- active: true

Staging:
- orcaly-staging-wealth-recurrences
- schedule: every minute
- active: false

- [PARTIAL] cron existence/status is observable.
- [OPEN] document owner, expected last-success cadence and failure alert per cron.
- [OPEN] decide/activate staging recurrence only under Agent 1 plan.
- [OPEN] verify production cron does not call staging or vice versa.
- [OPEN] rollback/disable procedure documented.

## Jobs

- [PASS] generic background worker supports claim/settle/retry/stale recovery.
- [PASS] job types cover integration sync, Google full resync/watch renewal, email and Wealth recurrence.
- [OPEN] queue-age/failed-job alerts.
- [OPEN] dead-letter/manual replay workflow.
- [OPEN] tenant isolation for job payload/object lookup.
- [OPEN] idempotency test for every side-effecting handler.
- [OPEN] concurrency/load baseline.

## Integrations

- [PARTIAL] shared foundation implemented.
- [PASS] Google Calendar engineering implementation present.
- [PARTIAL] Google Calendar live production schema present but rollout flag false/no connection.
- [PARTIAL] Resend code/schema exists in repository but production migration absent.
- [BLOCKED_EXTERNAL] provider approvals/credentials for multiple planned integrations.
- [OPEN] do not present configuration-only adapters as operational.
- [OPEN] external sandbox/health/retry/webhook evidence before enabling each flag.
- [OPEN] Public API must be promoted/certified before Zapier/Make/n8n.

## Providers

For every external provider:
- [OPEN] account owner recorded.
- [OPEN] sandbox vs production credentials recorded.
- [OPEN] allowed redirect/webhook URLs confirmed.
- [OPEN] scopes/permissions least-privilege review.
- [OPEN] rate limits documented.
- [OPEN] retry policy documented.
- [OPEN] outage behavior documented.
- [OPEN] credential expiry/rotation documented.
- [OPEN] support/escalation path documented.
- [OPEN] data retention/privacy implications documented.

## Payments

- [PASS] Asaas webhook token check exists.
- [PASS] Mercado Pago signature verification exists.
- [PASS] payment webhook event persistence exists.
- [PARTIAL] payment-flow verification scripts exist.
- [OPEN] sandbox replay/duplicate/out-of-order event matrix.
- [OPEN] reconciliation after partial provider failure.
- [OPEN] refund/cancel/chargeback lifecycle.
- [OPEN] marketplace split/commission integrity.
- [OPEN] webhook secret rotation.
- [OPEN] production financial monitoring/alerting.

## Webhooks

- [PASS] Google Calendar token/resource/expiry/idempotency controls.
- [PASS] Resend Svix signature/timestamp/idempotency controls in repository.
- [PASS] Mercado Pago signature verification.
- [PASS] WhatsApp signature verification exists but is frozen.
- [OPEN] uniform maximum body size.
- [OPEN] replay test for each provider.
- [OPEN] failure/retry/dead-letter visibility.
- [OPEN] metrics on invalid signature and processing failures.

## Rate limiting

- [PASS] DB-backed rate limiter exists.
- [PASS] selected public upload/checkout paths use it.
- [PARTIAL] provider code classifies rate-limit responses.
- [OPEN] inventory all public/AI/upload/auth-sensitive endpoints.
- [OPEN] define per-route limits from observed usage.
- [OPEN] prove limiter behavior under concurrency and trusted-proxy headers.

## Observability

- [PASS] application_error_events + shared reporter.
- [PASS] errorId/requestId/deployment correlation in shared reporter.
- [PASS] admin system-health aggregation.
- [PARTIAL] job/webhook/integration telemetry.
- [OPEN] global request-ID propagation.
- [OPEN] route/API latency metrics.
- [OPEN] proactive alerts.
- [OPEN] queue age and provider health.
- [OPEN] independent synthetic monitoring.
- [OPEN] distributed tracing or equivalent correlation model.

## Backups

- [UNKNOWN] automated database backup/PITR policy was not exposed by the available read-only audit tools.
- [UNKNOWN] Storage backup/versioning policy.
- [OPEN] record database backup frequency/retention.
- [OPEN] record PITR availability and retention if enabled.
- [OPEN] record Storage recovery expectations.
- [OPEN] define backup ownership and access.
- [OPEN] perform restore rehearsal in a non-production target.

## Recovery

- [OPEN] database restore runbook.
- [OPEN] Storage recovery runbook.
- [OPEN] provider credential loss/revocation recovery.
- [OPEN] job queue corruption/replay recovery.
- [OPEN] webhook outage catch-up procedure.
- [OPEN] RTO/RPO targets.
- [OPEN] named incident commander/decision process.

## Rollback

- [PARTIAL] Vercel immutable deployments provide deploy-level rollback candidates.
- [OPEN] application rollback procedure tied to exact SHA.
- [OPEN] DB roll-forward/compatibility strategy for additive migrations.
- [OPEN] feature-flag kill switches validated.
- [OPEN] rollback point after each parallel branch integration.
- [OPEN] provider flag-disable path tested.

## Deployment

- [PASS] Git-driven Vercel deployments.
- [PASS] multiple CI workflows and exact-SHA verification patterns.
- [OPEN] final branch integration order followed.
- [OPEN] no unresolved merge conflict in auth/RLS/package/workflows.
- [OPEN] exact final SHA recorded in release notes.
- [OPEN] approval owner recorded before production promotion.

## Smoke

Final candidate smoke must cover:
- [OPEN] /
- [OPEN] /business
- [OPEN] /apps
- [OPEN] Business login + /painel/inicio
- [OPEN] public storefront
- [OPEN] checkout
- [OPEN] orders
- [OPEN] delivery
- [OPEN] finance/reports
- [OPEN] partner portal
- [OPEN] all certified Wealth entry routes
- [OPEN] admin health
- [OPEN] public API health where enabled
- [OPEN] provider health without side effects

## Regression

- [OPEN] npm test
- [OPEN] test:ecosystem
- [OPEN] Wealth rolling V8 suite
- [OPEN] global lint after Agent 3
- [OPEN] typecheck
- [OPEN] next build
- [OPEN] payment/storefront/security/integration verification
- [OPEN] cross-tenant auth/RLS matrix
- [OPEN] post-merge targeted tests for files touched by multiple branches

## Accessibility

- [PARTIAL] automated axe evidence exists on ecosystem and certified Wealth flows.
- [PASS] certified Morning/Night includes keyboard/focus/reduced-motion evidence.
- [OPEN] whole-app manual screen-reader sample.
- [OPEN] Business critical journeys at mobile/desktop with keyboard.
- [OPEN] Agent 2 prototypes require final real-runtime Axe/build after adoption.
- [OPEN] color/theme verification for final integrated UI.

## Performance

- [OPEN] Web Vitals baseline.
- [OPEN] API latency p50/p95/p99.
- [OPEN] DB query baseline.
- [OPEN] bundle size baseline.
- [OPEN] Vercel iad1 ↔ Supabase sa-east-1 latency decision.
- [OPEN] RLS initplan warnings triage.
- [OPEN] integration_push_channels FK index decision.
- [OPEN] background job throughput/queue age.

## Legal / compliance dependencies

- [OPEN] LGPD data inventory by product/context.
- [OPEN] retention/deletion/export procedures.
- [OPEN] processor/provider inventory and agreements.
- [OPEN] consent purpose/scope review for cross-product data.
- [OPEN] fiscal/legal review before NFS-e.
- [OPEN] regulated-financial review before Open Finance/Regulatory features.
- [OPEN] AI disclosures/data processing rules for Intelligence.
- [OPEN] accessibility/legal requirements appropriate to target market.

This is a technical readiness map, not legal advice.

## External blockers

Known:
- Google/API credentials and approvals.
- Google Business Profile eligibility.
- Meta app/page/form approval.
- Marketplace/ERP provider approvals.
- NFS-e provider/municipal requirements.
- Resend domain/API key before live email.
- Open Finance/regulatory scope.
- final production credential configuration.

## Final approval gate

Do not mark READY_FOR_PRODUCTION until:
1. parallel branches are integrated in a controlled sequence;
2. exact integrated SHA passes global build/type/lint/test gates;
3. database promotion plan is reconciled and staged;
4. Business hosted tenant journey passes;
5. certified Wealth rolling suite passes on the merged SHA;
6. Auth/MFA global matrix passes;
7. security findings are resolved/accepted;
8. performance baseline exists;
9. observability/alerts cover critical failure modes;
10. provider-specific external blockers are either satisfied or feature flags remain off;
11. rollback/recovery paths are documented;
12. human release owner explicitly approves.

Current result: NOT DECLARED READY.
