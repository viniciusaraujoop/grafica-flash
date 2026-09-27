# Orçaly Data Classification

Snapshot: 2026-09-27

| Data | Class | Primary boundary | Crypto / hashing | Logging / retention |
|---|---|---|---|---|
| published marketing/catalog/site data | PUBLIC | explicit publication/response allowlist | none | cache/distribute allowed |
| internal configuration without secrets | INTERNAL | admin authorization | none | audit mutations |
| company operations | CONFIDENTIAL | membership/capability + RLS | DB/provider at-rest encryption normally sufficient | minimize telemetry |
| customer/contact/order/delivery | CONFIDENTIAL | tenant isolation | selective only | LGPD retention/delete policy required |
| finance/payout metadata | HIGHLY_SENSITIVE | finance capability + company + step-up | encrypt recoverable provider secrets | mask identifiers |
| passwords | SECRET | Supabase Auth only | never app-store/hash custom | never log |
| session/access/refresh tokens | SECRET | Supabase Auth/session | provider managed | never app-log or manually persist |
| service-role / cron / webhook secrets | SECRET | server env only | n/a | never log; rotate operationally |
| OAuth/provider tokens | SECRET | server credential boundary | application encryption where recoverable storage is needed | never expose raw |
| payment provider credentials | SECRET | server env/encrypted credential store | reuse established payment credential encryption | never return raw |
| Wealth balances/debts/health/portfolio/tax | HIGHLY_SENSITIVE | owner + entitlement + RLS/RPC | selective only | personal-data retention/export/delete |
| Wealth private documents | HIGHLY_SENSITIVE | private bucket + owner/entitlement | storage-at-rest; app encryption only if justified | never log body |
| audit/security logs | CONFIDENTIAL | platform/security authorization | no blanket crypto | redact secrets/PII |
| public API raw key | SECRET | show-once + hash verification | hash, not reversible crypto | prefix/last chars only |
| referral code/session attribution | INTERNAL | integrity/dedupe | IP/session hashed | TTL/business policy |
| remembered login/partner email in localStorage | CONFIDENTIAL PII | local convenience only | none | user-controlled removal; never authorization |
| checkout draft in sessionStorage | CONFIDENTIAL | transient tab storage | none | removed after restore; server recalculates authority/price |
| Home AI chat local history | CONFIDENTIAL | local browser | none | capped, clearable; privacy notice recommended |
| partner course progress | INTERNAL | local/remote convenience | none | never authorization source |

## Decision

Do not encrypt the whole database in application code. Use authenticated encryption only for recoverable secrets (provider/payment credentials), hashing for verifier-style tokens/API keys, and redaction for logs. Keys must not be stored beside ciphertext. No new cryptographic primitive was introduced.
