# Observability Gaps

Audit snapshot: 2026-09-27
Base SHA: 9a2c66dbb2e6bf00c484b1791103b2bccd15becd

## Classification

- PRESENT: concrete implementation/evidence exists.
- PARTIAL: some signals exist but coverage/operator workflow is incomplete.
- ABSENT: no implementation located in the audited repository/state.
- BLOCKED_EXTERNAL: depends on provider/account capability.

## Matrix

| Capability | State | Evidence | Gap |
| --- | --- | --- | --- |
| Application error capture | PRESENT | lib/observability/application-errors.ts; application_error_events | not used by every route |
| Structured logging | PARTIAL | application_error JSON console events; selected structured admin/provider logs | legacy console.error/warn remains heterogeneous |
| Error IDs | PRESENT | createErrorId + persisted error_id | coverage depends on shared reporter adoption |
| Request IDs | PARTIAL | reporter creates/accepts requestId; admin system-health returns x-orcaly-request-id | universal ingress/propagation not proven |
| User-safe errors | PARTIAL | shared reporter enables incident IDs; many APIs return sanitized generic errors | legacy endpoints still return direct error.message in places |
| Server logs | PRESENT | Vercel runtime logs + console emission | retention/query/ownership policy not documented here |
| Audit logs | PRESENT | system_audit_logs/admin audit/integration audit/privileged audit structures | unified schema/retention and operator query not proven |
| Job logs/state | PARTIAL | background_jobs status, attempts, last error/recovery model | no dedicated queue dashboard/SLO found |
| Webhook logs | PRESENT | payment_webhook_events, event_idempotency, WhatsApp logs | provider coverage is inconsistent; Resend/Calendar use integration primitives |
| Integration health | PARTIAL | health model, connection status, admin/system signals | external synthetic checks absent |
| Payment failures | PRESENT | payment webhook status/error tables + admin health aggregation | cross-provider alerting/reconciliation workflow incomplete |
| Cron visibility | PARTIAL | pg_cron state queryable; background worker state | no consolidated cron execution dashboard found |
| Alerting | ABSENT | no proactive paging/on-call integration located | failures are mostly pull-based dashboards/logs |
| Distributed tracing | ABSENT | no trace/span framework located | no cross-request/provider trace graph |
| Metrics | PARTIAL | admin/system-health counts + DB/provider status counts | no time-series SLI layer or latency histograms |
| Error aggregation | PARTIAL | application_error_events + Vercel runtime error clusters | no universal error grouping/fingerprinting pipeline beyond provider/Vercel facilities |
| Deployment correlation | PRESENT | VERCEL_DEPLOYMENT_ID / VERCEL_GIT_COMMIT_SHA stored with app errors | not every telemetry table carries deployment |
| Source commit correlation | PRESENT | error reporter + Vercel deployment metadata | same coverage limitation |
| Health endpoints | PRESENT | /api/system/health, /api/admin/system-health, /api/v1/health | scopes differ; no single readiness contract |
| External monitoring | UNKNOWN | Vercel platform data available | no independent uptime/synthetic monitor found in repository |

## Application error model

lib/observability/application-errors.ts provides:
- generated errorId;
- caller-supplied or generated requestId;
- sanitized error type/message/stack;
- normalized HTTP status/provider status;
- metadata sanitizer;
- route + operation fields;
- environment;
- Vercel deployment/Git commit correlation;
- JSON console fallback;
- persistence to application_error_events;
- safe fallback when the telemetry relation is absent.

This is a solid minimum primitive.

Main gap:
adoption is not universal across 182 route handlers. A capability that only some routes call is PARTIAL platform observability even if the helper itself is good.

## Admin health model

app/api/admin/system-health/route.ts is platform-admin protected and aggregates:
- Supabase read health;
- payment webhook outcomes;
- WhatsApp message outcomes;
- latest admin scan;
- open security events;
- assistant events;
- application error events;
- Vercel environment presence.

It returns:
- service status cards;
- observed timestamps;
- 24-hour failure counts;
- recent application errors;
- request ID header.

Limitations:
- health is inferred from persisted events and schema availability;
- absence of events can produce Unknown rather than healthy;
- no latency percentiles;
- no automatic alert dispatch;
- no trace drill-down.

## Vercel evidence

Exact frozen deployment:
- dpl_4JpN5CxFx9qT4nMgy3kTANxEKLek
- SHA 9a2c66dbb2e6bf00c484b1791103b2bccd15becd
- READY
- Next.js
- region iad1

Read-only runtime-error aggregation for the Vercel project over the preceding 24 hours returned no runtime error clusters.

Interpretation:
- CONFIRMED: the query returned none.
- NOT proven: zero application errors, zero client errors, healthy traffic, good latency or full route coverage.

## Audit logging

Observed categories:
- platform/admin audit logs;
- system audit logs;
- privileged-action audit;
- integration audit events;
- payment webhook event records;
- application error events;
- assistant/security/WhatsApp operational events.

Gap:
there is no documented canonical event envelope across all domains.

Recommended minimum envelope:
- event_id
- occurred_at
- source
- environment
- deployment_sha
- request_id
- trace_id when available
- actor_id or actor_hash where appropriate
- company_id or personal scope identifier where appropriate
- action/event_name
- result/status
- error_code
- object type/id, not raw object
- duration_ms
- safe metadata
- retention class

Do not log credentials, access tokens, full financial payloads, document contents or arbitrary AI prompts.

## Jobs and cron

Generic worker:
- claims jobs through RPC;
- settles success/retry/failure;
- recovers stale jobs;
- records attempts and errors;
- respects retry-after classification.

Live observation:
- production pg_cron: orcaly-release-expired-stock, every 5 minutes, active.
- staging pg_cron: orcaly-staging-wealth-recurrences, every minute, inactive.
- aggregate background_jobs query returned no rows in production/staging at the later observation point.

Gaps:
- no queue age SLI;
- no stuck-job alert threshold;
- no worker heartbeat;
- no consolidated dead-letter operator view identified.

## Webhooks

Payment:
payment_webhook_events gives durable provider event state/error history.

Google Calendar:
event_idempotency records provider event identity before enqueueing sync.

Resend:
event_idempotency + integration_email_deliveries + timeline.

WhatsApp:
whatsapp_message_logs exists but runtime is frozen for this audit.

Gaps:
- standardized replay count;
- first/last attempt timestamps across all provider families;
- dead-letter/replay UI;
- alert when signature failures or provider 5xx rates exceed threshold.

## Integration health

Existing integration status model supports:
NOT_CONFIGURED / CONNECTING / CONNECTED / DEGRADED / ERROR and external-gating states.

Provider adapters can expose getHealth.

Gap:
configuration presence must not be treated as operational health. Configuration-only adapters correctly return DEGRADED/ACCESS_REQUIRED rather than HEALTHY.

Minimum future health:
1. credentials present;
2. token not expired/revoked;
3. lightweight provider probe where safe;
4. last successful sync;
5. last failed sync/error code;
6. webhook freshness;
7. queue age;
8. rate-limit/backoff state.

## Request correlation

Positive:
- application reporter carries requestId;
- admin health reads x-request-id and returns x-orcaly-request-id.

Gap:
no evidence that proxy/middleware assigns one request ID to every inbound request and propagates it through:
route → job → provider call → webhook → audit event.

Classification: PARTIAL.

## Metrics

Current metrics are mostly event-derived counts.

Missing production SLIs:
- request rate;
- error rate by route;
- latency p50/p95/p99;
- DB query latency;
- external provider latency;
- queue age/throughput;
- webhook lag;
- checkout success rate;
- payment reconciliation lag;
- auth failure/refresh rates;
- per-product availability.

These are not numbers missing from the document. They are instrumentation gaps.

## Tracing

No OpenTelemetry or equivalent distributed tracing implementation was located in the audited base tree.

Classification: ABSENT.

A minimal trace model could begin without a vendor:
- request_id propagated through headers;
- parent_request_id/job_id in async work;
- provider request correlation ID when available;
- duration_ms on major operations.

Vendor tracing can be added later if justified.

## Alerting

No proactive alerting/paging integration was located for:
- 5xx spikes;
- job queue stalls;
- webhook failures;
- payment reconciliation;
- provider auth expiry;
- DB availability;
- cron inactivity.

Classification: ABSENT.

A production system can have logs and still fail silently at 03:00. Humans have built entire industries around discovering this the next morning.

## Minimum production observability model

### P0
- assign/propagate request ID globally;
- adopt shared application error reporter in critical APIs;
- define error-rate and queue-stall thresholds;
- add alerts for payment/webhook/job failures;
- expose last-success/last-error for jobs/integrations;
- correlate deployment SHA in critical telemetry.

### P1
- route/API latency metrics;
- provider latency/status;
- DB/report query timing;
- synthetic health for public storefront + checkout + authenticated panel;
- operator dead-letter/replay flow.

### P2
- distributed tracing;
- product-level SLO dashboards;
- long-term trend/retention policy.

## Suggested alert set

Without inventing thresholds, define threshold values during baseline measurement for:
- checkout 5xx rate;
- payment webhook failure/retry backlog;
- oldest queued job age;
- cron last successful execution;
- integration refresh failures;
- Google Calendar watch expiry failures;
- Resend bounce/failure spike;
- application_error_events 5xx rate;
- Supabase availability failure;
- Vercel deployment error.

Thresholds are UNKNOWN until normal traffic is measured.

## Readiness gate

Production-readiness requires evidence that:
- an intentionally induced safe failure produces errorId + requestId;
- operator can locate it from the deployment SHA;
- a failed background job is visible;
- a duplicate webhook is visible but does not duplicate side effects;
- a provider credential failure becomes DEGRADED/ERROR rather than silent success;
- critical failure conditions can notify an operator without manual dashboard polling.

## Conclusion

Orçaly has useful observability primitives and significantly more than raw console logging. The gap is platform-wide adoption, time-series metrics, correlation across async boundaries and proactive alerting.
