# Integrations Gap Analysis

Audit snapshot: 2026-09-27
Base SHA: 9a2c66dbb2e6bf00c484b1791103b2bccd15becd
No external mutation was performed.

## Classification

- IMPLEMENTED: provider-specific runtime exists; this does not mean configured in production.
- PARTIAL: meaningful runtime exists but deployment/configuration/coverage is incomplete.
- CONTRACT_ONLY: catalog/configuration adapter exists but real provider operation is intentionally unavailable.
- NOT_CONFIGURED: runtime exists but required external/server setup is absent.
- BLOCKED_EXTERNAL: approval/account/provider dependency blocks progress.
- FROZEN: deliberately excluded from the current integration mission.
- UNKNOWN: insufficient evidence.

## Snapshot facts

CONFIRMED:
- Production contains 21 integration feature flags.
- Every observed production integration feature flag is globally disabled.
- Production contains zero integration_connections rows at the observation point.
- Staging contains zero integration_connections rows at the observation point.
- The frozen repository registers 16 providers in lib/integrations/core/registry.ts.
- Google Calendar and Resend have real adapters.
- Google Maps, NFS-e, Google Business Profile, Drive, Sheets, Meta Leads, Clicksign, Mercado Livre, Shopee, Bling, Omie, Zapier, Make and n8n use configuration-only adapters that reject synchronization.
- Gmail, Slack, Teams and Open Finance are explicitly excluded by the scope-cleanup migration and are not present in the active provider registry.
- Production live migrations end at Google Calendar. Resend, provider-scope cleanup and public-API-key migrations exist in the repository but are not present in production's live migration history.

## Provider matrix

| Integration | Classification | Code / schema evidence | Credentials / auth | Webhook / sync / retry | Live state | Main production-readiness gap |
| --- | --- | --- | --- | --- | --- | --- |
| Google Calendar | IMPLEMENTED | lib/integrations/google/calendar*, OAuth routes, calendar webhook, jobs, production migration google_calendar_complete | OAuth 2 + PKCE; GOOGLE_INTEGRATIONS_CLIENT_ID, GOOGLE_INTEGRATIONS_CLIENT_SECRET, GOOGLE_INTEGRATIONS_REDIRECT_URI; ORCALY_PUBLIC_URL for watch callback | incremental sync token, controlled full-resync on 410/token invalidation, watch renewal, idempotent webhook, retry classification | Production flag false; no connection | real production OAuth client/config, approved rollout, external smoke without mutations beyond approved test account |
| Resend | PARTIAL | lib/integrations/email/**, resend webhook, email-send job, repo migration resend_email_platform | per-company server-stored api_key/from/reply-to/webhook_secret | Svix signature + 5-minute tolerance, event idempotency, transactional outbox/job | Production flag false; production DB lacks Resend migration | apply validated schema to target environment, verified domain/API key, sandbox/production delivery and bounce/complaint tests |
| Google Maps | CONTRACT_ONLY | registry + provider config | API key stored server-side; billing/API enablement required | no operational sync adapter | flag false | implement provider calls, restrictions, quota/retry/error model and tests |
| NFS-e | CONTRACT_ONLY | registry + provider config | provider_name + credential/environment contract | sync explicitly unsupported | flag false | choose fiscal provider/municipal strategy, certificate/credential model, legal/idempotency/cancellation flows |
| Google Business Profile | CONTRACT_ONLY | registry + configuration adapter | OAuth planned; external API/profile eligibility required | sync unsupported | flag false | provider eligibility/approval plus real read/manage adapter |
| Google Drive | CONTRACT_ONLY | registry + configuration adapter | OAuth planned | sync unsupported | flag false | scopes, folder ownership model, upload/download mapping, webhook/change tracking, retention tests |
| Google Sheets | CONTRACT_ONLY | registry + configuration adapter | OAuth planned | sync unsupported | flag false | read/write/export implementation, rate limits, ownership and spreadsheet-not-source-of-truth guarantees |
| Gmail | FROZEN | platform flag exists; scope cleanup explicitly excludes it; absent from active registry | not active | not active | flag false | separate future scope and contract |
| Meta Leads | CONTRACT_ONLY | registry + configuration adapter | OAuth planned; app/page/form approval required | sync unsupported | flag false | Meta app approval, webhook signature/lead dedupe, consent and CRM mapping |
| Clicksign | CONTRACT_ONLY | registry + provider configuration | API key + environment contract | sync unsupported | flag false | sandbox adapter, webhook signature/status mapping, document ownership/retention |
| Mercado Livre | CONTRACT_ONLY | registry + configuration adapter | OAuth planned; app approval required | sync unsupported | flag false | approved application, order mapping, retries, rate limits, reconciliation |
| Shopee | CONTRACT_ONLY | registry + configuration adapter | provider credential strategy; Open Platform approval | sync unsupported | flag false | approved application, signing/auth, order mapping/reconciliation |
| ERP: Bling | CONTRACT_ONLY | registry + configuration adapter | OAuth planned | sync unsupported | subflag false | entity mapping, conflict policy, directionality, pagination/rate limits |
| ERP: Omie | CONTRACT_ONLY | registry + configuration adapter | API key planned | sync unsupported | subflag false | entity mapping, conflict policy, retries/rate limits |
| Public API | PARTIAL | lib/integrations/public-api-keys.ts, app/api/v1/**, repo migration integration_public_api_keys | hashed API key; timing-safe comparison; scoped keys | API surface exists; automation consumers depend on it | schema migration absent from production | production schema promotion, rotation/revocation, rate-limit/abuse tests, complete endpoint inventory |
| Zapier | CONTRACT_ONLY | registry + configuration adapter | depends on Orçaly public API key/scopes | sync unsupported | flag false | Public API first, then trigger/action contract and verification |
| Make | CONTRACT_ONLY | registry + configuration adapter | depends on Orçaly public API key/scopes | sync unsupported | flag false | Public API first, signed webhook/action contract |
| n8n | CONTRACT_ONLY | registry + configuration adapter | depends on Orçaly public API key/scopes | sync unsupported | flag false | Public API first, HTTP/webhook recipes + rate/replay model |
| Slack | FROZEN | flag + scope cleanup exclusion; no active registry provider | not active | not active | flag false | future scope |
| Microsoft Teams | FROZEN | flag + scope cleanup exclusion; no active registry provider | not active | not active | flag false | future scope |
| Open Finance | FROZEN | flag + scope cleanup exclusion; Agent 1 also owns Wealth Open Finance | regulated/external future scope | not active in integration catalog | flag false | do not duplicate Agent 1; regulatory/provider architecture and consent first |
| WhatsApp | FROZEN | existing app/api/whatsapp/** and lib/whatsapp* | Cloud API credentials/tokens | signature verification exists | existing separate runtime | explicit user/agent instruction freezes WhatsApp; audit-only reference, no implementation work |

## Shared integration foundation

### Connections

Migration integration_platform_foundation introduces:
- integration_connections
- integration mappings/state/cursors/usage primitives
- background job integration
- feature-flag rollout
- server-managed credential indirection

Browser access to internal infrastructure tables is intended to be fail-closed.

Status: CONFIRMED in repository. Production has the integration foundation and Google Calendar migration.

### Credential handling

lib/integrations/core/credentials.ts calls:
- integration_credentials_store
- integration_credentials_read
- integration_credentials_delete

Live function inspection showed these SECURITY DEFINER functions are not executable by anon or authenticated roles. Their search_path is constrained to pg_catalog.

Status: positive hardening evidence, CONFIRMED.

### OAuth state and PKCE

lib/integrations/core/oauth-state.ts plus the Google OAuth security migration persist:
- provider/company/user-bound OAuth state;
- PKCE verifier;
- requested scopes;
- expiry/one-time consume behavior.

Google connect/callback routes use this shared foundation.

Status: CONFIRMED in code/schema. External Google authorization was not executed by this agent.

### Runtime lock/retry

lib/integrations/runtime.ts uses integration_refresh_lock / integration_refresh_unlock to avoid concurrent refresh races.

lib/jobs/worker.ts uses claim/settle/recover RPCs and provider errors can carry retry-after timing.

Status: CONFIRMED.

### Webhook idempotency

Shared event_idempotency is used by Google Calendar and Resend. Payment systems also maintain payment_webhook_events.

Status: PRESENT / CONFIRMED, but provider-specific replay behavior still needs hosted tests.

## Google Calendar detail

Engineering evidence:
- OAuth contract/server implementation
- required-scope validation
- list calendars
- writable default-calendar requirement
- incremental sync cursor
- full-resync recovery on invalidated sync token
- mapping table
- create/update/delete policy
- watch channels
- channel token hash with timing-safe comparison
- webhook idempotency
- audit events
- jobs for full resync/watch renewal

Repository QA:
- scripts/verify-integrations-google-oauth.mjs
- scripts/verify-google-calendar.mjs
- scripts/verify-integrations-core.mjs
- scripts/verify-integrations-server-actions.mjs

Production reality:
- schema through google_calendar_complete is live;
- feature flag is false globally;
- no connection exists.

Conclusion: IMPLEMENTED engineering, NOT_CONFIGURED rollout.

## Resend detail

Engineering evidence:
- transactional templates
- HTML escaping
- HTTPS-only CTA sanitizer
- email address normalization
- per-delivery idempotency key
- outbox + background job
- provider message mapping
- signed Svix webhook with timestamp tolerance and timing-safe HMAC compare
- bounce/failure/complaint status mapping
- timeline recording

Repository QA:
- scripts/verify-resend-email.mjs
- integration expansion/core verification scripts

Production reality:
- feature flag exists but false;
- no connection exists;
- resend_email_platform migration is not in the live production migration list.

Conclusion: PARTIAL for production readiness.

## Configuration-only adapter behavior

createConfigurationAdapter is intentionally fail-safe:
- reports ACCESS_REQUIRED for externally gated providers;
- reports NOT_CONFIGURED without credentials;
- reports DEGRADED when credentials are merely stored;
- throws UNSUPPORTED on sync instead of pretending to mutate an external provider.

This is good contract discipline. It also means the catalog must not be presented as “integrated” merely because configuration fields exist.

## Current configuration gaps

provider-configuration.ts exposes concrete manual configuration forms only for a subset such as:
- Google Maps
- NFS-e
- Clicksign

Several registry providers have no manual configuration spec and no real adapter. Therefore their UI/catalog presence is descriptive, not operational.

## Production vs staging integration drift

Production:
- integration platform foundation is live;
- Google OAuth security and Google Calendar are live;
- all feature flags observed false;
- zero integration connections.

Staging:
- built from production schema baseline + Wealth continuation migrations;
- no platform_feature_flags rows were returned at observation;
- zero integration connections.

Implication: integration QA cannot assume staging currently mirrors production's rollout seed/data state. Before integration-provider certification, reconcile the schema/data baseline in an isolated and mutation-safe staging plan.

## Health and observability

Available primitives:
- integration health model
- connection status/error codes
- integration audit events
- usage tables
- jobs with status/retry
- webhook idempotency
- admin/system health for broader platform signals

Missing or not proven:
- external synthetic health checks for each provider
- provider-specific SLOs
- alerting on repeated refresh/webhook failures
- dashboarded rate-limit consumption
- unified dead-letter operator workflow

## Rate limits

Google provider code parses Retry-After and classifies RATE_LIMITED.
The generic integration foundation has retryable jobs.
Provider-specific quotas for contract-only integrations are UNKNOWN because no real adapters exist.

## Secrets

CONFIRMED positive patterns:
- service role remains server-side.
- credential storage uses server-only RPCs.
- public API raw keys are not stored as raw database values in the repository design.
- Resend webhook secret is loaded from integration credentials.
- Google OAuth client secret is server env.
- .env.example contains placeholders, not live secrets.

No secret rotation exercise was performed.

## Recommended implementation sequence for integrations

1. Keep Google Calendar frozen at current engineering-complete state until rollout credentials are intentionally configured.
2. Promote and certify Resend schema/runtime in isolated staging, then external sandbox delivery/webhook.
3. Promote/certify Public API foundation.
4. Choose one real provider category at a time, preferably Maps or Clicksign because their configuration contracts are already explicit.
5. Implement Marketplace/ERP adapters only after canonical mapping/reconciliation contracts are fixed.
6. Add automation consumers Zapier/Make/n8n only after Public API rate/revocation/webhook contracts are certified.
7. Leave Gmail/Slack/Teams/Open Finance frozen until a separate approved scope. Open Finance must coordinate with Agent 1.
8. Keep WhatsApp untouched.

No merge or provider call is performed by this document.
