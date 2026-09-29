# Orçaly Integration Migration Provenance

## Status

- M0 repository reconciliation scope: complete on `reconcile/integration-production-ledger`.
- Base `main` SHA: `d940debf9556e1180fa3c709da0f560d3aa96374`.
- Scope is repository provenance only.
- Database mutation: **NONE**.
- Production: **READ ONLY / UNTOUCHED**.
- Staging: **READ ONLY / UNTOUCHED**.
- Runtime: **NOT INCLUDED**.

## Canonical production-ledger mapping

| Production version | Production migration name | Canonical repository filename | Former feature-branch filename | Semantic equivalence | Production applied | Main prior state |
| --- | --- | --- | --- | --- | --- | --- |
| 20260910001442 | integration_platform_foundation | `20260910001442_integration_platform_foundation.sql` | `20260909202000_integration_platform_foundation.sql` | CONFIRMED | YES | ABSENT |
| 20260910004555 | integration_google_oauth_security | `20260910004555_integration_google_oauth_security.sql` | `20260910005500_integration_google_oauth_security.sql` | CONFIRMED | YES | ABSENT |
| 20260910122922 | background_job_worker_transitions | `20260910122922_background_job_worker_transitions.sql` | `20260910122922_background_job_worker_transitions.sql` | CONFIRMED | YES | ABSENT |
| 20260910135326 | company_timezone_foundation | `20260910135326_company_timezone_foundation.sql` | `20260910134500_company_timezone_foundation.sql` | CONFIRMED | YES | ABSENT |
| 20260910150730 | google_calendar_complete | `20260910150730_google_calendar_complete.sql` | `20260910142000_google_calendar_complete.sql` | CONFIRMED | YES | ABSENT |

The repository identity in this branch follows the production migration ledger identity. Historical feature-branch timestamps are not retained as duplicate migration files.

## SQL equivalence method and result

The five historical SQL sources were compared against the `statements` recorded in production `supabase_migrations.schema_migrations`.

Normalization ignored only:
- SQL comments,
- CRLF/LF and whitespace,
- formatting/casing differences in unquoted SQL tokens.

Quoted string values and SQL token order were preserved. Token counts matched exactly for every pair:

- integration_platform_foundation: 1630 / 1630
- integration_google_oauth_security: 801 / 801
- background_job_worker_transitions: 610 / 610
- company_timezone_foundation: 68 / 68
- google_calendar_complete: 275 / 275

Result: **SEMANTIC_EQUIVALENCE_CONFIRMED** for all five migrations.

## Production state

Production project `ozrasuktfthsvbqprtel` records all five canonical versions as applied:

- `20260910001442 integration_platform_foundation`
- `20260910004555 integration_google_oauth_security`
- `20260910122922 background_job_worker_transitions`
- `20260910135326 company_timezone_foundation`
- `20260910150730 google_calendar_complete`

No production migration, repair, ledger edit, DDL, DML, seed, RLS, grant/revoke, function recreation, push or reset was executed by M0 repository reconciliation.

## Staging baseline and ledger difference

Staging project `zwxulgpjucxudadjdqov` records `20260926030809 production_schema_baseline`.

The five production integration migration versions are not individually present in the staging migration ledger. Their schema history is represented principally through the production schema baseline. M0 does not execute, repair or mark these five migrations in staging.

## Staging feature flag seed gap

Read-only verification found no `integration_*` rows in staging `public.platform_feature_flags`.

Status: **STAGING_FEATURE_FLAG_SEED_GAP**.

This is intentionally not corrected by M0. Any reconciliation must be a separate forward-only unit.

## Runtime separation

M0 repository reconciliation does not import or modify:
- Integration Core runtime,
- Google OAuth runtime,
- Google Calendar runtime,
- jobs worker runtime,
- `/api/cron/jobs`,
- integration UI/routes,
- provider adapters,
- cron configuration,
- Google Calendar activation.

The reconciliation only restores canonical migration provenance files plus this documentation.

## Resend exclusion

Resend remains **BRANCH_ONLY / NOT_APPLIED / FUTURE_NOT_DEPLOYED**.

M0 excludes:
- `20260910151500_resend_email_platform.sql`,
- `integration_email_deliveries`,
- `enqueue_integration_email`,
- Resend API/provider/webhook code,
- `email.send` worker,
- adapter/job registration,
- Resend cron/runtime/package changes.

No Resend artifact is part of this reconciliation.

## Google Calendar runtime follow-up

The prior M0 analysis identified a possible runtime renewal-flow mismatch between `watch_enabled` and `push_enabled`.

Status: **DOCUMENTED / FOLLOW_UP_REQUIRED**.

It is not corrected in this mission because runtime changes are outside M0 repository provenance scope.

## M0.1 follow-up

The certified M0 analysis previously identified 51 production ledger entries, with 32 lacking a file in `main` under the exact same timestamp.

The five integration migrations reconciled here do not resolve that global historical drift.

Follow-up unit:

**M0.1 — HISTORICAL MIGRATION PROVENANCE AUDIT**

M0.1 is not executed here. No unrelated historical migration is renamed or rewritten.

## Final repository semantics

When this branch passes QA, the permitted status is:

- `INTEGRATION_MIGRATION_PROVENANCE_RECONCILED_IN_REPOSITORY`

This does **not** mean:

- `GLOBAL_MIGRATION_LEDGER_RECONCILED`
- `PRODUCTION_REPAIRED`
- `STAGING_REPAIRED`
- `MIGRATIONS_APPLIED`
- `RUNTIME_RECONCILED`
- `INTEGRATIONS_READY_FOR_PRODUCTION`
