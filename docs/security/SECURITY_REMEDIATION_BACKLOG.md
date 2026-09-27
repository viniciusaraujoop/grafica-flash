# Orçaly Security Remediation Backlog

Snapshot: 2026-09-27  
Phase A runtime: `1990c17949f30bad2bfaa37c4addf30ed6e1d878`

Priority is based on evidenced impact and likelihood. No P0 is invented to make the report look suitably apocalyptic.

## P0

**None found in Phase A.**

No evidence of a current unauthenticated service-role takeover, cross-tenant data dump, secret committed to client code, or trivial admin escalation was established.

## P1 — release/security gates

| ID | Finding | Evidence | Surface | Threat | Severity / likelihood | Current control | Recommended action | Owner | Phase | Migration? | Provider/prod config? | Status |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| SEC-P1-01 | Production leaked-password protection disabled | Supabase Security Advisor, production | Auth | credential stuffing with known-compromised passwords | MEDIUM / MEDIUM | login limiter, anti-enumeration, Supabase Auth | enable leaked-password protection after auth regression/support approval | Auth/platform | operational | no | production Auth config yes | OPEN |
| SEC-P1-02 | Exact hosted session/MFA lifecycle not certified | Phase A matrix + MFA docs | login/session/admin | stolen/expired session or incomplete step-up lifecycle escapes static coverage | HIGH impact / LOW-MEDIUM likelihood | proxy auth, no-store, AAL2 on critical mutations | run protected Preview browser matrix for login/refresh/logout/revoke/enroll/challenge/step-up on integrated candidate | Auth/security QA | integration QA | no | no | OPEN |

## P2 — hardening

| ID | Finding | Evidence | Surface | Threat | Severity / likelihood | Current control | Recommended action | Owner | Phase | Migration? | Provider/prod config? | Status |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| SEC-P2-01 | Public art upload is not bound to signed workflow intent | `/api/public/uploads/art` | public Storage | storage/content planting under known active company slug | LOW-MEDIUM / MEDIUM | same-origin, 5/10m limiter, 10 MiB, type+magic, UUID | issue short-lived quote/order upload capability and bind company/object purpose | Business/security | later app hardening | no | no | OPEN |
| SEC-P2-02 | Legacy panel uploader trusts client MIME/extension, permits SVG/broad image MIME | `lib/panel-storage.ts` + live bucket config | public product/logo media; private finance docs | active/polyglot content or format abuse | MEDIUM / LOW-MEDIUM | company UUID path + Storage RLS + size checks | move critical uploads through server validator; magic/decode validation; tighten public active formats | Business/storage | later app hardening | maybe bucket config later | maybe | OPEN |
| SEC-P2-03 | WhatsApp webhook replay/body/idempotency remains partial | API matrix + webhook review | WhatsApp | duplicate/oversized provider events causing repeated work/messages | MEDIUM / LOW-MEDIUM | Meta signature + verify token | preserve frozen ownership; add max body + provider event idempotency only when owner resumes or a concrete P1 appears | WhatsApp owner | separate | maybe | provider semantics | BLOCKED/FROZEN |
| SEC-P2-04 | `data.export` step-up policy exists but exporter callers are not fully inventoried | MFA matrix | exports | sensitive export without AAL2 at an unreviewed caller | MEDIUM / LOW | sensitive-action contract exists | map every export endpoint/action before wiring changes | Security + domain owners | Phase A follow-up/integration | no | no | OPEN |
| SEC-P2-05 | Service-only tables sometimes retain authenticated table grants while RLS has no policy | live grants: marketplace payment/system audit examples | DB | future policy mistake creates broader surface than intended | MEDIUM / LOW | RLS deny-all today | Phase B caller map, then revoke redundant grants where safe | DB/security | Phase B | yes | no | BLOCKED by migration ownership |
| SEC-P2-06 | Legacy overlapping company RLS remains complex | live policy inventory | tenant data | policy drift can broaden access during later edits | HIGH impact / LOW likelihood currently | existing company predicates and app authorization | write deterministic role/tenant truth table, then consolidate only with migration owner | DB/security | Phase B | yes | no | BLOCKED |
| SEC-P2-07 | Hosted Business IDOR/BOLA journey still not final-certified | prior audit + Phase A threat model | products/orders/items/delivery/finance | guessed cross-tenant object IDs | HIGH impact / LOW-MEDIUM | application company checks + RLS | integrated hosted attacker matrix on final candidate | Business/QA | integration QA | no | no | OPEN |

## P3 / operational

| ID | Finding | Evidence | Recommended action | Owner | Status |
|---|---|---|---|---|---|
| SEC-P3-01 | Vercel environment NAME/SCOPE presence unverified | available interface did not safely list env names/scopes without values | existence-only operational inventory; never print values | Platform ops | OPEN |
| SEC-P3-02 | Malware scanning not configured | Storage/upload audit | provider-backed quarantine/scanning for untrusted documents when justified | Platform/storage | OPEN |
| SEC-P3-03 | Public/private object retention and orphan cleanup policy incomplete | Storage audit | define retention, orphan cleanup and deletion ownership | Product/legal/ops | OPEN |
| SEC-P3-04 | Distributed bot/WAF protection not certified | threat model | establish edge/WAF/bot thresholds from traffic and cost | Platform ops | OPEN |
| SEC-P3-05 | LGPD retention/export/delete policy is not fully encoded as a security runbook | data classification | legal/product retention matrix + operational deletion verification | Product/legal/security | OPEN |
| SEC-P3-06 | Advisor warning for `get_my_platform_admin_access()` remains visible | live Advisor | document as accepted SAFE_INTENTIONAL; revisit only if proxy architecture changes | Auth/platform | ACCEPTED |
| SEC-P3-07 | RLS-no-policy Advisor counts remain high | production 44, staging 57 | classify service-only rows; do not add permissive policies to chase zero warnings | DB/security | ACCEPTED / REVIEW IN PHASE B |

## Fixed in Phase A runtime

The certified runtime already fixed or strengthened:
- signed checkout proof before service-role account creation;
- same-origin and request bounds on sensitive public/account paths;
- removal of identity-specific company master-email bypass;
- login rate limiting and anti-enumeration;
- password-change rate/origin/body controls;
- site upload magic bytes, rate and origin;
- Asaas constant-time secret compare and body bounds;
- checkout limiter scoping;
- Mercado Pago webhook body bounds;
- finance capability boundaries;
- MFA for privileged mutations;
- platform configuration MFA;
- public token/utility abuse bounds;
- service-role/client secret boundary checks.

These are not reopened without evidence of regression.

## SAFE_INTENTIONAL findings

### `public.get_my_platform_admin_access()`

Status: **ACCEPTED / SAFE_INTENTIONAL**.

Reason:
- authenticated-only EXECUTE;
- no caller-supplied target identity;
- result scoped to `auth.uid()`;
- active role allowlist;
- constrained search path;
- used by proxy for self-access resolution.

The Advisor warning is correct mechanically but does not establish privilege escalation.

## Blocked work

Phase B database work remains blocked until Agent 1 explicitly publishes:

`MIGRATION_OWNERSHIP_RELEASED`

No migration, GRANT, REVOKE, RLS or function-security change belongs in this Phase A branch before that signal.
