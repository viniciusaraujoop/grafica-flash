# Security Hardening Backlog

Audit snapshot: 2026-09-27
Base SHA: 9a2c66dbb2e6bf00c484b1791103b2bccd15becd
Method: static repository review + read-only Supabase Advisors/schema/ACL inspection.

## Severity policy

CRITICAL/HIGH are reserved for evidenced exploitable conditions or a demonstrated control failure with material impact. No CRITICAL or HIGH item is asserted by this audit.

Advisor warnings are not automatically vulnerabilities.

## Findings

| ID | Severity | Status | Finding | Evidence | Exploit precondition | Likely impact | Remediation idea | Suggested owner | Safe parallel fix? |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| SEC-01 | MEDIUM | CONFIRMED | Production leaked-password protection is disabled | Supabase production Security Advisor: auth_leaked_password_protection | attacker relies on a user's compromised/reused password | account takeover likelihood increases for reused credentials | enable leaked-password protection after auth regression and support review | Auth/platform | YES, but only with auth owner approval |
| SEC-02 | LOW | CONFIRMED | get_my_platform_admin_access is SECURITY DEFINER and executable by authenticated | Supabase Advisor + live pg_get_functiondef | authenticated user can call the RPC | function returns only the caller's active platform-admin row because WHERE p.user_id = auth.uid(); current definition shows no cross-user read | decide whether REST exposure is intentional; if not, move lookup behind server-only boundary or narrow EXECUTE | Admin/auth | NO during parallel work without proxy/admin regression |
| SEC-03 | MEDIUM | CONFIRMED | Public art upload can write to a service-role-backed public bucket for any active company slug | app/api/public/uploads/art/route.ts | same-origin caller knows an active slug and can pass DB-backed rate limit | storage consumption/content planting under a company's public path; no evidence of code execution | bind upload to an explicit quote/order/upload capability or signed short-lived upload intent; retain magic-byte/type/size checks | Business/public upload | YES after Business ownership review |
| SEC-04 | MEDIUM | CONFIRMED | Authenticated site-assets upload trusts declared MIME rather than file signature | app/api/site/upload/route.ts; public site-assets bucket | authenticated canManage user uploads crafted bytes with allowed MIME declaration | malformed/polyglot public asset; impact depends on CDN/browser content handling | reuse magic-byte validation used by public art upload; consider decode/re-encode for images | Business/storage | YES after Agent 3 merge if file untouched |
| SEC-05 | LOW | CONFIRMED | site-assets upload has no explicit route-level rate limit or same-origin guard | app/api/site/upload/route.ts | authenticated canManage account | avoidable storage/API abuse by a compromised or automated session | add scoped DB-backed rate limit and align origin/CSRF policy with privileged mutations | Business/security | YES after behavior review |
| SEC-06 | MEDIUM | CONFIRMED | RLS policy overlap is material | Supabase Performance Advisor: 54 multiple_permissive_policies; live policies on companies/members/orders/order_items/products/finance | policy combinations authorize broader access than intended or become inconsistent over time | tenant/role authorization drift; no leak demonstrated | consolidate overlapping policies and add allow/deny truth-table tests before changing them | DB/security | NO while Wealth/Business branches move |
| SEC-07 | INFO | CONFIRMED | 44 production tables have RLS enabled with no policies | Supabase Security Advisor rls_enabled_no_policy | direct client attempts access | fail-closed for browser roles; can surprise runtime relying on client access | classify each table as intentionally server-only vs missing policy; document ownership | DB/platform | YES as documentation; DB fix NO |
| SEC-08 | MEDIUM | CONFIRMED | Global hosted Auth/MFA certification remains incomplete | docs/qa/ORCALY_SECURITY_TESTS.md and execution state; MFA code exists | authorization-sensitive action escapes scoped test coverage | inconsistent step-up enforcement or session assumptions | hosted staging matrix for password reset, refresh, MFA enrollment/challenge, role transition and privileged actions | Auth/platform | NO until integrated candidate |
| SEC-09 | LOW | CONFIRMED | Several public Storage buckets have no bucket-level MIME allowlist | live production storage.buckets: logos, product-images, produtos | authorized upload path accepts an undesired MIME unless application route blocks it | content-type/storage hygiene drift | add bucket MIME limits only after inventorying legitimate legacy formats | Business/storage | NO without compatibility audit |
| SEC-10 | INFO | CONFIRMED | Finance bucket is private | live production storage.buckets | n/a | positive control | keep private; verify signed-URL lifetime and tenant path tests | Business/finance | YES as QA |
| SEC-11 | INFO | CONFIRMED | Integration credential RPCs are server-only by ACL | live function privileges: integration_credentials_* anon=false/authenticated=false; constrained search_path | service role compromise only | positive control | retain ACL and regression-test after migrations | Integrations/security | YES as tests/docs |
| SEC-12 | INFO | CONFIRMED | Google OAuth state/PKCE foundation exists | oauth-state.ts + google OAuth security migration | n/a | positive control against login CSRF/code interception | preserve one-time state consume, expiry and provider/company/user binding | Integrations | YES as regression |
| SEC-13 | INFO | CONFIRMED | Google Calendar webhook validates token/resource/expiry and idempotency | calendar webhook + calendar.ts | n/a | positive control | retain and test replay/expired channel paths | Integrations | YES as tests |
| SEC-14 | INFO | CONFIRMED | Resend webhook performs signed replay-window validation | resend webhook + email/core.ts | n/a | positive control | retain Svix signature/timestamp/idempotency tests | Integrations | YES as tests |
| SEC-15 | LOW | CONFIRMED | Asaas webhook token compare is ordinary string equality | app/api/webhooks/asaas/route.ts | remote timing observation precise enough to exploit comparison, which is usually difficult | theoretical secret-comparison side channel; no exploit evidence | use timing-safe comparison for secret material when touching this code | Payments/security | YES after payment owner review |
| SEC-16 | INFO | CONFIRMED | Mercado Pago subscription webhook verifies provider signature | app/api/mercado-pago/webhook/route.ts | n/a | positive control | retain provider-signature regression and idempotency coverage | Payments | YES as tests |
| SEC-17 | INFO | CONFIRMED | WhatsApp webhook signature verification exists but is frozen | app/api/whatsapp/webhook/route.ts | n/a | positive control, out of current implementation scope | do not modify in this mission | WhatsApp owner | NO |
| SEC-18 | MEDIUM | INFERRED | CSRF/origin strategy is not demonstrably uniform across all 182 route handlers | explicit same-origin checks appear on selected public/checkout routes, not a universal wrapper | cookie-authenticated mutation endpoint accepts cross-site request and browser sends usable credentials | unauthorized state change | inventory mutation routes by auth mechanism; require same-origin/CSRF token where cookie semantics need it | Platform security | NO until route inventory test exists |
| SEC-19 | MEDIUM | INFERRED | Rate limiting is selective rather than visibly universal for abuse-sensitive public endpoints | DB-backed limiter exists and is used by selected routes; no centralized middleware found | attacker targets an unthrottled expensive/state-changing public route | abuse, cost amplification, resource exhaustion | classify public endpoints and apply per-scope limits to mutation/provider/AI/upload endpoints | Platform security | YES route-by-route after ownership review |
| SEC-20 | LOW | UNKNOWN | Signed URL lifetime/renewal policy across all private assets is not fully mapped | finance private bucket exists; Wealth private bucket exists in staging | overly long signed URL is leaked | extended unintended access | inventory all createSignedUrl calls and standardize short TTLs by asset class | Storage owners | YES as audit first |
| SEC-21 | LOW | UNKNOWN | SSRF exposure in provider/import features was not proven | reviewed Google provider URLs are fixed; no global dynamic-fetch proof | attacker controls an arbitrary server-side URL sink | internal network/provider metadata access | static sink inventory for fetch/axios URL inputs; add URL allowlists where dynamic URLs are legitimate | Platform/integrations | YES as audit |
| SEC-22 | LOW | CONFIRMED | Error telemetry stores sanitized stack/message/metadata, but coverage is not universal | lib/observability/application-errors.ts | sensitive content reaches a route that bypasses sanitizer and logs raw data | secret/PII leakage in logs | prohibit raw provider payloads/secrets in console; migrate critical routes to shared reporter | Observability/security | YES route-by-route |
| SEC-23 | MEDIUM | CONFIRMED | Production and repository schema states differ substantially | repo has 94 migration files; production live list has 51, ending at Google Calendar | unsafe operator assumes repository migration inventory equals production | accidental blind push, destructive drift or unreviewed feature activation | use explicit reconciliation plan and versioned promotion batches; never blind db push | DB/release | NO during parallel feature work |

## Detailed notes

### SEC-02: SECURITY DEFINER advisor finding

Live production definition was inspected read-only. The function:
- is STABLE SECURITY DEFINER;
- uses search_path pg_catalog, public;
- filters platform_admins by p.user_id = auth.uid();
- only returns an active admin row for the caller;
- normalizes role and returns permissions.

Therefore the Advisor warning is real, but the evidence does not support labeling it HIGH. It should be reviewed as an exposed privileged helper and kept least-privilege.

### RLS and tenant boundary

Positive evidence:
- RLS is enabled on inspected Business tables.
- existing ecosystem DB tests exercise cross-user and entitlement denial for new ecosystem/Wealth tables.
- production storage writes for managed Business buckets use company-path helper policies.

Gap:
- final hosted Business nested-resource tests remain open.
- multiple overlapping permissive policies make the effective authorization graph harder to reason about.

Do not rewrite policy sets during parallel feature integration. Build deterministic truth-table tests first.

### MFA

lib/security/mfa.ts uses Supabase authenticator assurance levels and a step-up decision layer. Privileged company settings import the MFA and privileged-action helpers.

The open issue is coverage, not absence of code. Final QA needs to prove that every high-impact action requiring step-up actually invokes it.

### Service role

getSupabaseAdmin reads NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY and is server-side infrastructure. No client bundle exposure was found in reviewed imports.

Service role is intentionally used for:
- server-side company access;
- protected storage uploads;
- provider/webhook processing;
- jobs/admin operations.

Risk control: every service-role mutation must explicitly bind actor/company/object because RLS is bypassassed by design.

### Upload policy

Public art upload has comparatively strong file validation:
- same-origin
- DB-backed rate limit
- 10 MiB cap
- content-length early rejection
- MIME allowlist
- magic bytes
- random UUID filename
- server-resolved active company

Authenticated site upload is weaker on content validation. Harmonizing these two validators is a straightforward hardening candidate after branch integration.

### Webhook replay

Google Calendar and Resend use event_idempotency.
Asaas uses payment_webhook_events keyed by provider/provider_event_id.
Mercado Pago contains signature verification and subscription-event recording.

Final QA should intentionally replay identical provider events and confirm:
- only one business side effect;
- a duplicate returns a safe response;
- failed processing can be retried without losing the event;
- raw secret material is not persisted.

## Security release gates

Required before a production-ready declaration:
1. Resolve or formally accept SEC-01.
2. Decide SEC-02 intentionality.
3. Hosted tenant/role matrix for Business.
4. Hosted Auth/MFA lifecycle matrix.
5. Storage upload/download denial matrix.
6. Webhook replay and invalid-signature tests.
7. Public endpoint rate-limit inventory.
8. Migration reconciliation before any schema promotion.
9. Post-merge security scan after Agent 1/2/3 branches.
10. No CRITICAL/HIGH unresolved finding from the final integrated scan.

## Severity summary

| Severity | Count |
| --- | ---: |
| CRITICAL | 0 |
| HIGH | 0 |
| MEDIUM | 8 |
| LOW | 8 |
| INFO | 7 |

Counts describe this audit backlog, not a vulnerability score for the product.
