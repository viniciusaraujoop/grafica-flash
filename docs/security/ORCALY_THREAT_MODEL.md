# Orçaly Threat Model

Snapshot: 2026-09-27  
Runtime SHA: `1990c17949f30bad2bfaa37c4addf30ed6e1d878`

Conceptual baseline: **OWASP ASVS v5.0.0** and **OWASP API Security Top 10 2023**, checked on 2026-09-27. The model emphasizes BOLA, broken authentication/function authorization, resource consumption, sensitive business flows, misconfiguration, inventory and unsafe consumption of provider APIs.

## Trust boundaries

1. anonymous browser ↔ public Next.js API;
2. authenticated browser ↔ Supabase Auth ↔ Next.js server;
3. server ↔ service-role database/storage operations;
4. direct browser Supabase access ↔ RLS;
5. tenant A ↔ tenant B;
6. Wealth user/household A ↔ B;
7. ordinary user ↔ partner/support/admin;
8. external webhook ↔ authenticity/replay/idempotency controls;
9. OAuth redirect ↔ state/PKCE ↔ credential storage;
10. upload ↔ Storage public/private buckets;
11. jobs/cron ↔ privileged RPCs;
12. external provider response ↔ canonical internal state.

## Actors, threats and controls

| Actor | Target / threat | Preconditions | Controls | Residual evidence gap |
|---|---|---|---|---|
| anonymous attacker | signup/checkout/quote/upload abuse | internet | signed proofs, body caps, rate limits, same-origin where relevant | distributed bot/WAF not certified |
| authenticated user | IDOR to another user/company | valid session | company/owner context, RLS, entitlement | hosted Business guessed-ID matrix pending |
| malicious company member | finance/settings/role escalation | active membership | capability checks, owner rules, MFA step-up | legacy RLS complexity |
| other tenant owner/member | guessed company/order/customer IDs | valid other tenant | tenant predicates and service boundary checks | final exact-Preview E2E |
| compromised partner account | referrals/payout/contact data | stolen partner session | partner context/permissions, masking, audit | hosted session regression |
| compromised support/admin session | privileged platform action | privileged token theft | role/permission, official-owner boundary, MFA, audit | recovery/revocation hosted test |
| stolen refresh/session token | impersonation | token theft | Supabase session model + AAL2 for sensitive actions + no-store | exact-head refresh/revoke test |
| webhook replay attacker | duplicate payments/sync | valid/captured event | provider signature/token, idempotency hashes/events, body bounds | WhatsApp remains frozen/partial |
| OAuth callback attacker | bind provider to wrong actor/company | callback manipulation | state, expiry, single-use, PKCE on Google, company/user binding | provider config must match prod hosts |
| malicious upload | script/polyglot/storage abuse | upload access | size/MIME/magic-byte, path controls, rate/origin | malware scan not configured |
| automated bot | cost/resource exhaustion | automation | DB-backed scoped rate limiter + body bounds | cross-IP distributed abuse |
| leaked server secret | service/provider compromise | secret exfiltration | server-only env, encrypted credential mechanism, redaction | env rotation/presence operational verification |
| compromised provider | unsafe third-party data | provider breach | signatures, parsers, reference checks, idempotency | provider-specific SLA/trust |
| DB/service credential insider | bypass RLS | privileged credential | least privilege, audit, authorization before service-role operation | organizational credential governance |

## Assets

- account/session/MFA: HIGHLY_SENSITIVE
- company/customer/order/delivery: CONFIDENTIAL
- financial/payout: HIGHLY_SENSITIVE
- Wealth data/private documents: HIGHLY_SENSITIVE
- OAuth/payment/provider credentials: SECRET
- admin/support access: HIGHLY_SENSITIVE
- audit/security logs: CONFIDENTIAL
- API tokens: SECRET
- published catalog/site assets: PUBLIC by product decision

## OWASP API Top 10 coverage

- API1 BOLA: full route inventory + IDOR matrix.
- API2 Broken Authentication: Supabase Auth, login abuse controls, MFA/session review.
- API3 Object Property Authorization: allowlisted DTO/settings and sensitive-response review.
- API4 Resource Consumption: scoped limiter, upload/body/QR bounds.
- API5 Function Authorization: platform/company/partner/capability helpers.
- API6 Sensitive Business Flows: signup, quote, proposal, checkout, payout throttling/MFA.
- API7 SSRF: QR route does not fetch the supplied URL; provider URL sinks remain separate review targets.
- API8 Misconfiguration: env, headers, RLS/grants/Advisor review.
- API9 Inventory: 181/181 route handlers classified.
- API10 Unsafe Consumption: webhook/OAuth/provider validation.
