# Orçaly Security Phase A — Certification Report

Date: 2026-09-27  
Branch: `gpt/orcaly-security-hardening`  
Original base: `7401e20576ca4b686c03871ff0211474001ce620`

## Identity of what is certified

**CERTIFIED_RUNTIME_SHA:** `1990c17949f30bad2bfaa37c4addf30ed6e1d878`

**RUNTIME_DEPLOYMENT:** `dpl_Daq9xi2Sq4ZyCkoq3mecGBBniD1W`

**RUNTIME_PREVIEW:** `https://orcaly-qdgkcouqu-vinicius-araujos-projects.vercel.app`

**DOCUMENTATION_BASE_BEFORE_FINAL_CHECKPOINT:** `dc58026de0dd1c64ff454bd10e5d0b722948effe`

**DOCUMENTATION_HEAD:** the single final documentation checkpoint commit containing this report on `gpt/orcaly-security-hardening`. Its exact SHA is emitted in the external handoff because a Git commit cannot embed its own hash without changing that hash.

No runtime file changed after `1990c179...` in the documentation lineage being certified here.

## Runtime certification evidence

GitHub Actions run `36338157582`, job `certify`, completed SUCCESS on `1990c179...`.

All steps:
- Security Phase A invariants: PASS
- Scoped lint for Security delta: PASS
- Security inventory snapshot: PASS
- Typecheck: PASS
- Build: PASS

Vercel:
- deployment state: READY
- Git SHA: exact `1990c179...`
- GitHub Vercel status: SUCCESS
- Vercel Preview Comments check: SUCCESS

## API inventory

Route handlers: **181 / 181 classified**

- PASS: **142**
- INTENTIONAL_PUBLIC: **38**
- PARTIAL: **1**

The only PARTIAL route is `GET,POST /api/whatsapp/webhook`.

Residual reason:
- Meta signature / verify-token controls exist;
- explicit max-body/replay/idempotency evidence is incomplete;
- WhatsApp runtime is frozen by ownership instruction;
- no P0/P1 evidence justified altering it in the final Phase A pass.

## Security-domain result

| Domain | Result | Basis |
|---|---|---|
| NEXT_PUBLIC / client secret boundary | PASS | 0 known secret-pattern NEXT_PUBLIC names; 0 client service-role references in source audit |
| Service role boundary | PASS | reviewed service role remains server-side; high-risk account/company paths hardened |
| IDOR / BOLA | PARTIAL | static/app boundaries and RLS are strong; final hosted Business guessed-ID/cross-tenant matrix remains open |
| Login / rate limit / anti-enumeration | PASS | DB-backed network+identifier limits and uniform invalid/unconfirmed response |
| Session / cookie lifecycle | PARTIAL | Supabase SSR/proxy/no-store present; exact hosted refresh/logout/revoke matrix remains pending |
| MFA / step-up | PARTIAL | critical mutations wired and tested; `data.export` complete caller inventory + hosted lifecycle pending |
| Webhook / OAuth | PARTIAL | Google/Resend/MP/Asaas PASS; WhatsApp remains PARTIAL/frozen |
| Upload / Storage | PARTIAL | site upload and Wealth strong; public-art intent binding, legacy client content validation and malware scanning remain open |
| RLS / grants | READ_ONLY_COMPLETE | production + staging metadata and critical table grants/policies reviewed |
| SECURITY DEFINER | PASS / SAFE_INTENTIONAL | production own-access admin RPC scoped to `auth.uid()`; staging Wealth RPC model documented, no mutation |
| ENV presence | UNVERIFIED | safe Vercel NAME/SCOPE inventory not exposed by available interface |
| Leaked Password Protection | DISABLED in production | live Supabase Advisor |

## Threat model

Complete for Phase A, covering:
- anonymous abuse;
- authenticated IDOR;
- malicious company member;
- cross-tenant owner/member;
- partner/support/admin compromise;
- session theft;
- webhook replay;
- OAuth callback attacks;
- malicious uploads;
- bots/resource abuse;
- leaked secrets;
- provider compromise;
- DB/service credential insiders;
- OWASP API Security Top 10 mapping.

## Secrets

Source inventory: 51 environment names.

Result:
- **SECRETS EXPOSED: NO KNOWN SOURCE-BOUNDARY EXPOSURE**
- no known server secret imported into a Client Component;
- no `NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY`;
- raw secret values were not printed or inventoried.

Operational presence/scope in Vercel remains UNVERIFIED.

## RLS / grants

Production Security Advisor:
- 44 `RLS enabled, no policy` INFO findings;
- 1 authenticated SECURITY DEFINER warning;
- leaked-password protection disabled.

Staging:
- 57 `RLS enabled, no policy` INFO findings;
- 1 public Advisor SECURITY DEFINER warning.

Phase A conclusion:
many no-policy tables are intentional deny-all/service-RPC boundaries. The review explicitly rejects adding broad policies just to clear Advisor.

## SECURITY DEFINER

`public.get_my_platform_admin_access()`:
- authenticated EXECUTE only;
- no anon EXECUTE;
- constrained search path;
- target identity is not a parameter;
- row is filtered by `auth.uid()`;
- active role allowlist;
- self-access result only.

Classification: **SAFE_INTENTIONAL**.

No Phase B change is required unless the proxy architecture is replaced.

## Storage

Strongest certified path: Wealth Documents:
- private bucket;
- owner path;
- entitlement/owner policy;
- 3 MiB bound;
- PDF/JPEG/PNG signature validation;
- SHA-256 and size integrity;
- two-phase delete;
- authenticated streamed download;
- post-retrieval authorization recheck;
- cross-user denial evidence.

Audited server site-upload path:
- same-origin;
- requester/company manage authorization;
- rate limit;
- size/MIME/magic bytes;
- SVG excluded.

Residual storage backlog is recorded separately.

## Priority summary

P0: **0**

P1 open:
1. production leaked-password protection disabled;
2. exact hosted session/MFA lifecycle matrix pending.

P2:
- public-art signed upload intent;
- legacy panel upload content validation / SVG/broad MIME;
- WhatsApp replay/body/idempotency frozen;
- `data.export` caller inventory;
- service-only grant minimization and RLS consolidation after migration ownership release;
- final Business hosted IDOR/BOLA matrix.

P3 / operational:
- Vercel env presence;
- malware scanning;
- retention/orphan cleanup;
- distributed bot/WAF baseline;
- LGPD retention/delete runbook.

## Mutation record

- Production mutations: **NONE**
- Database mutations: **NONE**
- Staging structural mutations: **NONE**
- Migrations created/applied/edited: **NONE**
- RLS/grants/functions changed: **NONE**
- Provider production settings changed: **NONE**

## Hosted security E2E

A dedicated browser security lifecycle matrix was **NOT_CERTIFIED / PENDING** for the exact runtime.

This report does not convert build success into a fictional hosted security E2E pass.

## Phase result

**ORÇALY SECURITY PHASE A: DONE / READY_FOR_INTEGRATION**

Meaning:
- application-security runtime checkpoint is green;
- full route inventory is closed;
- documentation/security matrices are complete;
- read-only DB security review is complete;
- remaining risks are explicitly recorded.

It does **not** mean “production secure” or “all Advisor warnings fixed.”

## Phase B

`MIGRATION_OWNERSHIP_RELEASED = NO`

**PHASE B: BLOCKED**

Agent 1 remains migration owner. Stop here.

## Next safe unit

Integrate the Security branch into a dedicated release candidate after current product branches are frozen; manually reconcile `package.json` and shared auth/payment surfaces; then rerun:
1. `security:phase-a`;
2. scoped/global lint as applicable;
3. inventory snapshot;
4. typecheck;
5. build;
6. exact-SHA Preview;
7. hosted session/MFA and Business cross-tenant/IDOR matrix.

Only after Agent 1 explicitly releases migration ownership may Phase B propose or apply DB/RLS/grant/function changes.
