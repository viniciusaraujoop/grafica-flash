# ORÇALY — M0.2 Provenance Recovery & Staging Non-DDL Remediation Plan

## Executive Summary

M0.2 was executed as a **read-only investigation** of repository history, production, and staging.

No database or runtime mutation was performed.

- Repository: `viniciusaraujoop/grafica-flash`
- Main baseline: `2da6a56cf7edc67a1598c18302d73dfdfecbea97`
- M0.1 branch: `reconcile/m0-1-staging-baseline`
- M0.1 commit: `b64c77d6e562e69eaa56701b8d8faa8abc3071b6`
- M0.2 branch: `reconcile/m0-2-provenance-remediation`
- Production: `ozrasuktfthsvbqprtel`
- Staging: `zwxulgpjucxudadjdqov`
- Database mutation: **NONE**
- Migrations executed: **NONE**
- Main merge: **NONE**

M0.1 proved structural production → staging parity and identified provenance plus non-DDL gaps.

M0.2 resolves the two previously ambiguous staging migrations at the source/schema level, recovers source provenance for 26 of 27 staging ledger entries, classifies the remaining baseline as historical staging bootstrap provenance, inventories the known non-DDL gaps, and determines the future remediation mechanism without executing anything.

### Final M0.2 decision

```
M0_2:
COMPLETE

PROVENANCE:
PARTIAL

AMBIGUOUS_MIGRATIONS:
RESOLVED

STAGING_SEEDS:
PLANNED

STORAGE_BASELINE:
PLANNED

CRON_BASELINE:
PLANNED

NEXT_SAFE_MIGRATION_PREFIX:
20260929

DATABASE_MUTATION:
NONE

MIGRATIONS_EXECUTED:
NONE

READY_FOR_SHARED_FOUNDATION_MIGRATION_DESIGN:
YES
```

`PROVENANCE: PARTIAL` is retained because the source file/commit for the staging-only `20260926030809 production_schema_baseline` could not be located. This is accepted as non-blocking historical drift for **design**, because staging schema state was already structurally reconciled in M0.1.

This does **not** authorize Shared Foundation implementation, migration creation, migration execution, production mutation, staging mutation, deploy, or main merge.

---

# 1. Staging Migration Provenance

## Classification rule

- **PROVENANCE_CONFIRMED** — source branch, source commit, original file, and semantic/live schema evidence are recoverable.
- **PROVENANCE_RECOVERABLE** — source exists, but canonical repository recovery is still pending.
- **PROVENANCE_MISSING_BUT_SCHEMA_CONFIRMED** — exact historical source is missing, but live schema state is reconciled.
- **SUPERSEDED** — history represented by a later baseline or replacement.
- **AMBIGUOUS** — conflicting source evidence remains.
- **UNKNOWN** — insufficient evidence.

Git metadata identifies the repository author as `viniciusaraujoop`. The implementation line is the `codex/orcaly-ecosystem` branch; Git history does not independently encode a human/agent implementation owner beyond that branch and author.

## Per-migration provenance

| Version | Name | Source branch | Source commit | Original migration file | Known implementation line | Semantic purpose | Current repository presence | Classification |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 20260926014103 | ecosystem_identity_wealth | codex/orcaly-ecosystem | c3f367b87b844dbe85220264ebe6fa0f5b647a3c | 20260926014103_ecosystem_identity_wealth.sql | Codex branch / Git author viniciusaraujoop | Product-hub identity and isolated personal Wealth core | main absent; source branch present | PROVENANCE_CONFIRMED |
| 20260926030809 | production_schema_baseline | not located | not located | not located | unknown | Staging bootstrap containing the production structural schema frontier | main absent; no exact source file found in inspected active migration branches | PROVENANCE_MISSING_BUT_SCHEMA_CONFIRMED |
| 20260926103114 | wealth_lifecycle_aggregates | codex/orcaly-ecosystem | 510b38aeb7aacd15ecbc8e50b113eb1269998920 | 20260926103114_wealth_lifecycle_aggregates.sql | Codex branch / Git author viniciusaraujoop | Wealth lifecycle management and aggregate completion | main absent; source branch present | PROVENANCE_CONFIRMED |
| 20260926110128 | wealth_recurring_schedules | codex/orcaly-ecosystem | de7346756d9dd053544a5767827f5f506008c2f7 | 20260926110128_wealth_recurring_schedules.sql | Codex branch / Git author viniciusaraujoop | Idempotent recurring schedules and worker | main absent; source branch present | PROVENANCE_CONFIRMED |
| 20260926153138 | wealth_recurrence_rpc_boundary | codex/orcaly-ecosystem | de7346756d9dd053544a5767827f5f506008c2f7 | 20260926153138_wealth_recurrence_rpc_boundary.sql | Codex branch / Git author viniciusaraujoop | RPC boundary for recurrence processing | main absent; source branch present | PROVENANCE_CONFIRMED |
| 20260926164000 | wealth_recurrence_clock | codex/orcaly-ecosystem | aaf4eccf3969ffe1e82a674033a23b6caf43ce27 | 20260926164000_wealth_recurrence_clock.sql | Codex branch / Git author viniciusaraujoop | Isolated staging recurrence clock | main absent; source branch present | PROVENANCE_CONFIRMED |
| 20260926165000 | wealth_debt_center | codex/orcaly-ecosystem | 0df50275488e326aa0b2da8cab2a96b085a66841 | 20260926165000_wealth_debt_center.sql | Codex branch / Git author viniciusaraujoop | Declared debt center and payoff simulation | main absent; source branch present | PROVENANCE_CONFIRMED |
| 20260926171000 | wealth_debt_conflict_response | codex/orcaly-ecosystem | 0df50275488e326aa0b2da8cab2a96b085a66841 | 20260926171000_wealth_debt_conflict_response.sql | Codex branch / Git author viniciusaraujoop | Debt conflict/error response boundary | main absent; source branch present | PROVENANCE_CONFIRMED |
| 20260926180000 | wealth_net_worth | codex/orcaly-ecosystem | b59749f4ae1e68149f9441ee2887d91f80f5f243 | 20260926180000_wealth_net_worth.sql | Codex branch / Git author viniciusaraujoop | Exact net-worth composition and snapshots | main absent; source branch present | PROVENANCE_CONFIRMED |
| 20260926181546 | wealth_portfolio_foundation | codex/orcaly-ecosystem | 1340b180ebee3f1dd1de82f41e2762edf69409f0 | 20260926181546_wealth_portfolio_foundation.sql | Codex branch / Git author viniciusaraujoop | Portfolio foundation, ledger and simulations | main absent; source branch present | PROVENANCE_CONFIRMED |
| 20260926185024 | wealth_portfolio_target_binding | codex/orcaly-ecosystem | 1340b180ebee3f1dd1de82f41e2762edf69409f0 | 20260926185024_wealth_portfolio_target_binding.sql | Codex branch / Git author viniciusaraujoop | Bind portfolios to targets/goals | main absent; source branch present | PROVENANCE_CONFIRMED |
| 20260926190000 | wealth_financial_health | codex/orcaly-ecosystem | 73c8d1dc735728a386a4968f89943ae515da3794 | 20260926190000_wealth_financial_health.sql | Codex branch / Git author viniciusaraujoop | Explain financial health from declared records | main absent; source branch present | PROVENANCE_CONFIRMED |
| 20260926190250 | wealth_portfolio_blind_dml_guard | codex/orcaly-ecosystem | 7dad853c8724e7aeae08fc9dcf739a841eb53380 | 20260926190250_wealth_portfolio_blind_dml_guard.sql | Codex branch / Git author viniciusaraujoop | Prevent blind/write-only portfolio history mutation | main absent; source branch present | PROVENANCE_CONFIRMED |
| 20260926195246 | wealth_financial_calendar | codex/orcaly-ecosystem | 1b5328190bd1ad81ef9c957bdf2f4856a9f0f7d3 | 20260926195246_wealth_financial_calendar.sql | Codex branch / Git author viniciusaraujoop | Financial calendar and recurring bills center | main absent; source branch present | PROVENANCE_CONFIRMED |
| 20260926205052 | wealth_goal_funding_life_plans | codex/orcaly-ecosystem | 56055cb4d2799fbad3137324f31fb339a0395943 | 20260926205052_wealth_goal_funding_life_plans.sql | Codex branch / Git author viniciusaraujoop | Goal funding and explicit life-event scenarios | main absent; source branch present | PROVENANCE_CONFIRMED |
| 20260926214929 | wealth_documents_vault | codex/orcaly-ecosystem | da9c03f68d7f39f9a96851521e1c41154a641911 | 20260926214929_wealth_documents_vault.sql | Codex branch / Git author viniciusaraujoop | Private document vault with revocable access | main absent; source branch present | PROVENANCE_CONFIRMED |
| 20260926220404 | wealth_documents_storage_read_compatibility | codex/orcaly-ecosystem | da9c03f68d7f39f9a96851521e1c41154a641911 | 20260926220404_wealth_documents_storage_read_compatibility.sql | Codex branch / Git author viniciusaraujoop | Storage read compatibility for Wealth documents | main absent; source branch present | PROVENANCE_CONFIRMED |
| 20260926222248 | wealth_timeline_read_model | codex/orcaly-ecosystem | a1c6b6214d21d9859a120f730badeaf73dcd4505 | 20260926222248_wealth_timeline_read_model.sql | Codex branch / Git author viniciusaraujoop | Owner-scoped Wealth activity timeline | main absent; source branch present | PROVENANCE_CONFIRMED |
| 20260926222931 | wealth_timeline_transaction_binding | codex/orcaly-ecosystem | a1c6b6214d21d9859a120f730badeaf73dcd4505 | 20260926222931_wealth_timeline_transaction_binding.sql | Codex branch / Git author viniciusaraujoop | Bind timeline entries to transactions | main absent; source branch present | PROVENANCE_CONFIRMED |
| 20260926225948 | wealth_family_explicit_sharing | codex/orcaly-ecosystem | 40ddacb2ee9842e9ca32fc4a1ee1b4817fa8520b | 20260926225948_wealth_family_explicit_sharing.sql | Codex branch / Git author viniciusaraujoop | Explicit revocable family sharing | main absent; source branch present | PROVENANCE_CONFIRMED |
| 20260926233156 | wealth_automation_center | codex/orcaly-ecosystem | 36b3c639be95d3c2d890a65d8ee778cf8d68edcf | 20260926233156_wealth_automation_center.sql | Codex branch / Git author viniciusaraujoop | Controlled Wealth Automation Center | main absent; source branch present | PROVENANCE_CONFIRMED |
| 20260927001122 | wealth_fee_analyzer | codex/orcaly-ecosystem | 086bf5773e6cfb10d9e7a1574bf036ea6df96e8c | 20260927001122_wealth_fee_analyzer.sql | Codex branch / Git author viniciusaraujoop | Declared portfolio fee analysis | main absent; source branch present | PROVENANCE_CONFIRMED |
| 20260927003416 | wealth_shield_declared_policies | codex/orcaly-ecosystem | d0c3383098264fc0ae1e4db708eb52c2c3d81d94 | 20260927003416_wealth_shield_declared_policies.sql | Codex branch / Git author viniciusaraujoop | Declared insurance/protection records | main absent; source branch present | PROVENANCE_CONFIRMED |
| 20260927013000 | wealth_tax_center_foundation | codex/orcaly-ecosystem | e7122f0e969794a73d2819cd92fb7c6365874f42 | 20260927013000_wealth_tax_center_foundation.sql | Codex branch / Git author viniciusaraujoop | Tax-center foundation with month alias parser fix | main absent; source branch present | PROVENANCE_CONFIRMED |
| 20260927132000 | wealth_morning_night_briefing | codex/orcaly-ecosystem | 5ef848e068fa0d3faa0538c418b33938e958441a | 20260927132000_wealth_morning_night_briefing.sql | Codex branch / Git author viniciusaraujoop | Morning/Night briefing read model | main absent; source branch present | PROVENANCE_CONFIRMED |
| 20260927162000 | wealth_document_expiry | codex/orcaly-ecosystem | cddf983147d386bdeef7be7a562f2822ef9e160d | 20260927162000_wealth_document_expiry.sql | Codex branch / Git author viniciusaraujoop | Explicit Vault document expiry metadata and command validation | main absent; source branch present | PROVENANCE_CONFIRMED |
| 20260927170000 | wealth_alert_center | codex/orcaly-ecosystem | bc6d745ae3477cddf76fddc182b2c91c01fe1f44 | 20260927170000_wealth_alert_center.sql | Codex branch / Git author viniciusaraujoop | Deterministic Wealth Alerts center with final command-token fix | main absent; source branch present | PROVENANCE_CONFIRMED |

### Summary

- Staging ledger entries: **27**
- Exact source file recovered: **26**
- Source commit recovered: **26**
- Exact source missing: **1**
- Previously ambiguous migrations resolved: **2**
- Remaining AMBIGUOUS classifications: **0**

The source files are still not present in `main`; recovery into the canonical repository migration line is a separate repository operation and is not authorized in M0.2.

---

# 2. Resolution of Previously Ambiguous Migrations

## 2.1 20260927162000 — wealth_document_expiry

### Source

- Branch: `codex/orcaly-ecosystem`
- Commit: `cddf983147d386bdeef7be7a562f2822ef9e160d`
- Commit message: `feat(wealth): add explicit Vault expiry metadata`
- File: `supabase/migrations/20260927162000_wealth_document_expiry.sql`
- File history on source branch: **one commit**
- Rename detected: **NO**
- Rewrite history detected: **NO**

### Live staging evidence

The live `ecosystem_private.manage_wealth_document(text,jsonb)` body contains the canonical source behavior, including:

- `expires_on` support;
- correct anchored date regex `^\d{4}-\d{2}-\d{2}$`;
- owner-scoped access checks;
- advisory transaction locking;
- idempotency token handling;
- Vault Storage verification;
- soft-delete cleanup behavior.

The live schema also contains the `wealth_documents.expires_on` state introduced by the migration.

### Ledger text

The raw statement stored in `supabase_migrations.schema_migrations.statements` is not byte-identical to the repository file and is not a trustworthy source-text artifact around dollar/regex boundaries.

However, the **live schema matches the repository source behavior**.

### Decision

```
PROVENANCE:
PROVENANCE_CONFIRMED

CANONICAL_SOURCE:
cddf983147d386bdeef7be7a562f2822ef9e160d

RENAMED:
NO

SQUASHED:
NO_EVIDENCE

MANUAL_SCHEMA_APPLY:
NO_EVIDENCE

LEDGER_TEXT_SOURCE_FIDELITY:
NOT_CANONICAL

LIVE_SCHEMA_MATCH:
YES
```

---

## 2.2 20260927170000 — wealth_alert_center

### Source history

Branch: `codex/orcaly-ecosystem`

The same migration path has four source revisions:

1. `0324d440ee87a77a8ddb12071fa7a18b6381e37f` — deterministic Alerts center
2. `c8c2901955d0a8c63e7589cbe3be9535a6cf129e` — Alerts UI/controls
3. `d76bfcdaf3ebe2982004624be82cb7d87663d041` — priority ordering fix
4. `bc6d745ae3477cddf76fddc182b2c91c01fe1f44` — command-token disambiguation fix

Canonical source file:

`supabase/migrations/20260927170000_wealth_alert_center.sql`

Canonical source commit:

`bc6d745ae3477cddf76fddc182b2c91c01fe1f44`

### Live staging evidence

The live schema contains the final revision behavior, including:

- `wealth_alert_candidates` with the 365-day tax evidence window;
- `manage_wealth_alerts` using the final `command_token` identifier rather than the earlier ambiguous `token` local variable;
- anchored version validation;
- final alert-state tables, indexes, audit triggers and wrappers;
- final notification/cooldown handling.

This proves staging is not running the initial or intermediate migration revisions.

### Decision

```
PROVENANCE:
PROVENANCE_CONFIRMED

CANONICAL_SOURCE:
bc6d745ae3477cddf76fddc182b2c91c01fe1f44

RENAMED:
NO

REWRITTEN_IN_PLACE:
YES_BEFORE_FINAL_CANONICAL_REVISION

SQUASHED:
NO_EVIDENCE

MANUAL_SCHEMA_APPLY:
NO_EVIDENCE

LEDGER_TEXT_SOURCE_FIDELITY:
NOT_CANONICAL

LIVE_SCHEMA_MATCH_FINAL_SOURCE:
YES
```

The migration path was edited through normal Git history before the final source revision. The live staging schema corresponds to the final revision.

---

# 3. Staging Non-DDL Gap Inventory

## 3.1 platform_feature_flags

### Expected state

Production has **23** rows.

Two platform flags are enabled in production:

- `admin.ai`
- `support.mode`

Twenty-one integration flags exist and are currently disabled:

- `integration_clicksign`
- `integration_erp`
- `integration_erp_bling`
- `integration_erp_omie`
- `integration_gmail`
- `integration_google_business`
- `integration_google_calendar`
- `integration_google_drive`
- `integration_google_maps`
- `integration_google_sheets`
- `integration_make`
- `integration_mercado_livre`
- `integration_meta_leads`
- `integration_microsoft_teams`
- `integration_n8n`
- `integration_nfse`
- `integration_open_finance`
- `integration_resend`
- `integration_shopee`
- `integration_slack`
- `integration_zapier`

### Current staging state

**0 rows**

### Source of truth

- `20260830201025 admin_control_center_v2`
- `20260910001442 integration_platform_foundation`
- production row state, with environment-specific enablement reviewed explicitly

### Runtime correctness

**YES**, because runtime feature gating can behave differently when rows are absent.

### Environment-specific

**YES**, particularly the `enabled` state.

### Recommended future mechanism

**SEED_BOOTSTRAP**

Use an explicit staging feature-flag matrix. Do **not** blindly clone production enablement and do **not** replay historical migrations.

Security review: **YES**.

---

## 3.2 affiliate_program_settings

### Production state

Singleton `id = 1`:

- commission_rate: `0.6000`
- hold_days: `14`
- minimum_payout_amount: `50.00`
- attribution_days: `60`
- payouts_enabled: `true`
- automatic_payout_enabled: `false`
- terms_version: `2026-07-29`

### Staging state

**0 rows**

### Source of truth

`20260729191021 affiliate_program_sixty_percent` in the authoritative production ledger.

### Runtime correctness

**YES** for affiliate payout/program behavior.

### Environment-specific

The commercial values are product policy rather than credentials, but payout enablement may still be environment-specific.

### Recommended future mechanism

**FUTURE_IDEMPOTENT_MIGRATION** or a controlled **SEED_BOOTSTRAP**.

Preferred design: one idempotent invariant that creates the singleton when absent without replaying historical affiliate migrations. Any environment-specific payout enablement must remain explicit.

Security review: **YES**, because this controls financial/payout behavior.

---

## 3.3 affiliate_announcements

### Production state

Two active seeded announcements from `20260808031654 affiliate_partner_growth_hub`.

### Staging state

**0 rows**

### Runtime correctness

**NO**. The affiliate portal remains structurally functional without announcement content.

### Environment-specific

Content is environment-independent but non-critical.

### Recommended future mechanism

Optional **SEED_BOOTSTRAP** or **DOCUMENTATION_ONLY**.

This is **not a Shared Foundation blocker**.

---

## 3.4 Explicit non-seeds

The following production data must **not** be copied merely to make staging resemble production:

- `platform_admins` / administrator identities
- `admin_audit_logs`
- `signup_leads`
- `signup_lead_followups`
- `assistant_events`
- tenant `company_*` configuration rows
- `quote_templates`
- `marketplace_payment_settings`
- `plan_payments`
- tenant integration connections
- OAuth state
- Vault secrets
- customer/order/payment/financial operational data

These are tenant, identity, security, billing, audit, or operational records, not baseline reference data.

---

# 4. Supabase Storage Baseline

Production currently has six application buckets that staging does not have.

Staging has only the Wealth-specific `wealth-documents` bucket.

Storage RLS/policy structures from the production baseline are already present in staging. Therefore missing bucket creation is an environment/configuration gap, not a policy-DDL gap.

| Bucket | Production mode | Limit | Production MIME restriction | Runtime/repository evidence | Staging | Classification | Future mechanism |
| --- | --- | ---: | --- | --- | --- | --- | --- |
| artes | public | 10 MiB | image/jpeg, image/png, image/webp, application/pdf | current `app/api/public/uploads/art/route.ts` uses `artes`; hardening references bucket | absent | REQUIRED_FOR_RUNTIME | STORAGE_CONFIGURATION |
| financeiro | private | 25 MiB | none at bucket level | created in `20260704_financeiro_base_seguro.sql`; current `lib/panel-storage.ts` uses it for finance documents; later hardened in `20260728184242` | absent | REQUIRED_FOR_RUNTIME | STORAGE_CONFIGURATION |
| logos | public | 5 MiB | none at bucket level | current `lib/panel-storage.ts` and LogoUploader use `logos`; hardening references bucket; exact creation migration not located | absent | REQUIRED_FOR_RUNTIME | STORAGE_CONFIGURATION |
| product-images | public | 25 MiB | none at bucket level | historical storage hardening references it; current product upload path uses `produtos`, not `product-images` | absent | LEGACY | NO_ACTION unless legacy compatibility is explicitly required |
| produtos | public | 25 MiB | none at bucket level | current `lib/panel-storage.ts` uses it for product image/video uploads; hardening references bucket | absent | REQUIRED_FOR_RUNTIME | STORAGE_CONFIGURATION |
| site-assets | public | 10 MiB | image/jpeg, image/png, image/webp, image/gif | created by `20260628_orcaly_consolidado.sql`; current site upload route and banner flow use it; route can create it at runtime | absent | REQUIRED_FOR_RUNTIME | STORAGE_CONFIGURATION |

### Runtime MIME expectations

The application currently adds stricter client/server validation than some bucket definitions:

- `logos`: PNG/JPEG/JPG/WEBP/SVG, max 5 MiB
- `site-assets`: JPEG/PNG/WEBP/GIF, max 10 MiB
- `produtos`: image and video media, max 25 MiB
- `financeiro`: PDF/XML, max 25 MiB
- `artes`: max 10 MiB with explicit type/signature validation

The future staging bootstrap should reproduce the intended Storage security posture, not rely on accidental runtime bucket creation.

### Repository provenance

Confirmed creation provenance:

- `financeiro` → `20260704_financeiro_base_seguro.sql`
- `site-assets` → `20260628_orcaly_consolidado.sql`

Confirmed hardening provenance:

- `20260728184242_orcaly_storage_bucket_security.sql` references/hardens `financeiro`, `artes`, `logos`, `product-images`, `produtos`, and `site-assets`.

Exact original creation migrations for `artes`, `logos`, `product-images`, and `produtos` were not located in the current main migration line during M0.2.

This does not justify reconstructing their historical SQL.

### Recommendation

Use an explicit, idempotent **environment Storage bootstrap/configuration unit** later.

Do not replay old Storage migrations just to create missing buckets.

Security review: **REQUIRED** because bucket public/private state and Storage policies define data exposure.

---

# 5. Stock-expiration Cron Gap

## Source implementation

Repository source:

`supabase/migrations/20260728173219_orcaly_marketplace_stock_reservations.sql`

Production ledger version:

`20260728173219 orcaly_marketplace_stock_reservations`

## Purpose

Release expired temporary stock reservations so abandoned/expired payment flows do not leave inventory permanently reserved.

## Schedule

```
*/5 * * * *
```

## Job name

`orcaly-release-expired-stock`

## Command

```sql
select public.expire_marketplace_stock_reservations(500);
```

## Function chain

`expire_marketplace_stock_reservations(500)`

→ selects only `reserved` rows whose `expires_at <= now()`

→ invokes `settle_marketplace_stock(..., 'expired', ...)`

→ restores product stock

→ transitions reservation/payment state

→ records stock movement.

## Privileges

The source migration:

- revokes execute from `public`, `anon`, and `authenticated`;
- grants execute to `service_role`;
- functions are `SECURITY INVOKER`.

Production cron currently runs as database role `postgres`, which has the required database privileges.

## Idempotency

The workflow is designed to tolerate repeated execution:

- only `reserved` reservations are selected;
- completed/expired reservations stop matching;
- movement records use per-reservation idempotency keys such as `expire:<reservation_id>`;
- duplicate movement insertion is guarded by conflict handling.

## Production state

Active:

- job: `orcaly-release-expired-stock`
- schedule: every 5 minutes
- command: `select public.expire_marketplace_stock_reservations(500);`

## Staging state

The production stock-expiry job is absent.

Staging instead has:

- `orcaly-staging-wealth-recurrences`
- current state: `active = false`

## Failure impact

Without the stock-expiration scheduler, expired payment reservations can remain reserved longer than intended, causing stale stock availability and potential false out-of-stock behavior.

## Remediation classification

```
ENVIRONMENT_BOOTSTRAP
```

Blocker-table remediation type:

```
CRON_CONFIGURATION
```

Do not replay the original stock-reservation migration.

A later staging-specific environment bootstrap should create or verify the cron job only after security/operational review.

Security review: **YES**.

---

# 6. Migration Prefix Collision Check

M0.1 frontier:

`20260927170000`

M0.2 inspected the active/relevant migration branches including:

- `main`
- `codex/orcaly-ecosystem`
- `qa/ask-7782b89-preview`
- `codex/recovery-r3-staging-baseline`
- `claude/orcaly-wave1-pure-core`
- `claude/orcaly-import-csv-t3`
- `claude/orcaly-smart-setup-t2`
- `claude/orcaly-academy-mvp`
- `claude/orcaly-growth-mvp`
- `claude/orcaly-ux-foundation`
- `feat/integrations-expansion`
- `feat/orcaly-3-1`
- `gpt/orcaly-security-b1`
- `gpt/orcaly-security-hardening`
- `gpt/orcaly-quality-hardening`
- `gpt/orcaly-audit-readiness`
- `gpt/orcaly-frontend-architecture`
- `agent/orcaly-inicio-visual-v3`
- `agent/assinatura-experience-v2`
- `reconcile/m0-1-staging-baseline`

No inspected branch contains a 14-digit migration version greater than:

`20260927170000`

Therefore, at M0.2 investigation time:

```
LAST_CANONICAL_MIGRATION_VERSION:
20260927170000

NEXT_SAFE_MIGRATION_PREFIX:
20260929
```

`20260929` remains collision-safe as a **date prefix**.

The final migration filename must still use a fresh 14-digit timestamp and must be rechecked immediately before creation, because branch activity can change after this report.

---

# 7. Blocker / Remediation Matrix

| BLOCKER | EVIDENCE | PRODUCTION STATE | STAGING STATE | REPOSITORY STATE | RISK | REMEDIATION TYPE | MUTATION REQUIRED? | SECURITY REVIEW REQUIRED? | NEXT OWNER | BLOCKING_SHARED_FOUNDATION? |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Staging bootstrap source provenance | 20260926030809 exists in ledger; exact source file/commit not found | production history remains authoritative independently | schema baseline structurally reconciled | exact baseline file absent from main/source branches inspected | future engineers can misread staging lineage | DOCUMENTATION_ONLY | NO | NO | Agent 1 / Coordinator | NO |
| Feature-flag seed gap | 23 production rows vs 0 staging | explicit global flags exist | no rows | source migrations known | staging gating differs from intended behavior | SEED_BOOTSTRAP | YES later | YES | Coordinator → Agent 1 + Agent 4 review | NO for design |
| Affiliate program settings singleton | production id=1 exists | configured | no row | source ledger known; main historical source differs in timestamp | affiliate financial behavior can be undefined | FUTURE_IDEMPOTENT_MIGRATION | YES later | YES | Coordinator → Agent 1 + Agent 4 review | NO for design |
| Affiliate announcements | two production seed rows | two active content rows | no rows | source migration known | training/news content absent only | SEED_BOOTSTRAP | OPTIONAL | NO | Product/Commercial owner | NO |
| Storage: artes | runtime route depends on bucket | present/public/10 MiB | absent | hardening provenance known; creation provenance partial | art upload fails | STORAGE_CONFIGURATION | YES later | YES | Agent 1 + Agent 4 | NO for design |
| Storage: financeiro | runtime panel-storage depends on bucket | present/private/25 MiB | absent | creation + hardening provenance known | finance attachment upload fails | STORAGE_CONFIGURATION | YES later | YES | Agent 1 + Agent 4 | NO for design |
| Storage: logos | current logo uploader depends on bucket | present/public/5 MiB | absent | hardening known; creation source not located | logo upload fails | STORAGE_CONFIGURATION | YES later | YES | Agent 1 + Agent 4 | NO for design |
| Storage: produtos | current product media upload depends on bucket | present/public/25 MiB | absent | hardening known; creation source not located | product media upload fails | STORAGE_CONFIGURATION | YES later | YES | Agent 1 + Agent 4 | NO for design |
| Storage: site-assets | current site/banner upload depends on bucket | present/public/10 MiB | absent; route can attempt runtime creation | creation + hardening provenance known | site media upload relies on runtime repair | STORAGE_CONFIGURATION | YES later | YES | Agent 1 + Agent 4 | NO for design |
| Storage: product-images | historical hardening reference only | present/public/25 MiB | absent | hardening known; no current product upload dependency found | legacy compatibility only | NO_ACTION | NO | NO | Coordinator | NO |
| Stock-expiry cron | production job active every 5 min | active | absent | source migration exact in main | stale reserved inventory | CRON_CONFIGURATION | YES later | YES | Agent 1 + Agent 4 / Ops | NO for design |

---

# 8. Remaining Accepted Non-blocking Gaps

Because M0.2 authorizes investigation/planning only, the following gaps remain physically unresolved but are accepted as non-blocking for **Shared Foundation migration design**:

1. `20260926030809 production_schema_baseline` has no recovered source file/commit.
2. The 26 recovered staging migration files are not yet canonicalized into `main`.
3. The 23 staging feature-flag rows have not been seeded.
4. The affiliate-program singleton has not been seeded.
5. Optional affiliate announcement content has not been seeded.
6. Required staging Storage buckets have not been created.
7. `product-images` remains absent and is accepted as legacy unless compatibility scope changes.
8. The stock-expiration cron has not been created in staging.
9. Production historical provenance gaps documented by M0.1 remain historical provenance work and are not repaired by replay.

These gaps are **not authorization to ignore them before staging certification or production rollout**. They are only non-blocking for the next **design** phase because the required future remediation mechanism is now explicit.

---

# 9. Recommended Next Step

The Coordinator may allow **Shared Foundation migration design** to begin, using:

- staging schema as the current structural design frontier;
- `20260927170000` as the last canonical applied version across the inspected ledgers;
- `20260929` as the current safe date prefix, revalidated immediately before any migration is actually created.

In parallel, create separate future work packages, each with independent authorization:

1. **Repository provenance recovery**
   - canonicalize the 26 recovered staging source files or establish a documented staging-only lineage;
   - keep `20260926030809` as documented historical drift unless an exact source artifact is recovered.

2. **Staging seed bootstrap**
   - explicit feature-flag matrix;
   - affiliate settings singleton;
   - optional announcements separately.

3. **Storage configuration**
   - create only buckets required by current runtime;
   - preserve exact public/private boundaries;
   - security review before execution.

4. **Cron configuration**
   - staging-specific decision and bootstrap for stock expiration;
   - verify job role and idempotency before activation.

No old migration should be replayed merely to equalize ledgers.

---

# 10. Final Status

```
M0_2:
COMPLETE

PROVENANCE:
PARTIAL

AMBIGUOUS_MIGRATIONS:
RESOLVED

STAGING_SEEDS:
PLANNED

STORAGE_BASELINE:
PLANNED

CRON_BASELINE:
PLANNED

NEXT_SAFE_MIGRATION_PREFIX:
20260929

DATABASE_MUTATION:
NONE

MIGRATIONS_EXECUTED:
NONE

READY_FOR_SHARED_FOUNDATION_MIGRATION_DESIGN:
YES
```

END OF MISSION.
