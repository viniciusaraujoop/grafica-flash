# Orçaly Security

Phase A status: **DONE / READY_FOR_INTEGRATION** for the certified runtime and documentation snapshot, subject to the residual backlog below.  
Phase A scope: application hardening + security audit.  
Phase B scope: database/RLS/grants/function hardening.  
Phase B: **BLOCKED until `MIGRATION_OWNERSHIP_RELEASED`**.

## Index

- [Threat Model](./ORCALY_THREAT_MODEL.md)
- [API Security Matrix](./API_SECURITY_MATRIX.md)
- [Environment / Secret Matrix](./ENV_SECRET_MATRIX.md)
- [Data Classification](./DATA_CLASSIFICATION.md)
- [RLS / Grants Matrix](./RLS_GRANTS_MATRIX.md)
- [MFA / Step-Up Matrix](./MFA_STEP_UP_MATRIX.md)
- [OAuth / Webhooks](./WEBHOOK_OAUTH_SECURITY.md)
- [Storage / Upload Security](./STORAGE_UPLOAD_SECURITY.md)
- [Security Remediation Backlog](./SECURITY_REMEDIATION_BACKLOG.md)
- [Phase A Certification Report](./SECURITY_CERTIFICATION_REPORT.md)

## Certified runtime

`1990c17949f30bad2bfaa37c4addf30ed6e1d878`

- GitHub `certify`: SUCCESS
- Security Phase A invariants: SUCCESS
- scoped lint: SUCCESS
- inventory snapshot: SUCCESS
- typecheck: SUCCESS
- build: SUCCESS
- Vercel deployment: `dpl_Daq9xi2Sq4ZyCkoq3mecGBBniD1W`
- Preview: `https://orcaly-qdgkcouqu-vinicius-araujos-projects.vercel.app`
- Vercel state: READY

The later documentation commits do not alter runtime. Do not confuse documentation HEAD with a new deployed runtime.

## Coverage summary

- API routes classified: **181 / 181**
- PASS: **142**
- INTENTIONAL_PUBLIC: **38**
- PARTIAL: **1** — WhatsApp webhook, frozen ownership; signature exists but max-body/replay/idempotency are not fully certified
- known source-boundary secret exposure: **none**
- production DB mutation by Phase A: **none**
- staging structural mutation by Phase A: **none**
- migrations by Phase A: **none**
- RLS/grants: **read-only review complete**
- production SECURITY DEFINER warning: reviewed as **SAFE_INTENTIONAL**
- production leaked-password protection: **disabled**
- Vercel env existence/scope: **unverified without values**
- hosted security browser E2E on exact certified runtime: **not certified as a dedicated matrix**

## Important boundary

This folder does not claim “Orçaly is production secure.” It certifies the Phase A application-security work and records the remaining integration, operational and Phase B gates.
