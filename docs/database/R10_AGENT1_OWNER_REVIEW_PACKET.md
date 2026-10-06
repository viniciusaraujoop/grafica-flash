# R10 — Agent 1 owner review packet

## P3 completion addendum — 2026-10-06

The historical P1–P6 checkpoint below is retained as its original decision context.
Its row30 blocker and 50-form total are superseded by this P3-only addendum:
51 proposed forms (47 VERBATIM_LEDGER, 0 GIT_EQUIVALENT, 4 NEUTRALIZED).
The Founder relayed AGENT_1's owner decision and AGENT_4 PASS_WITH_REQUIREMENTS in
the direct instruction "R10 — P3 REPLAY FORMS COMPLETION". Evidence/reference:
supabase/provenance/replay/P3_OWNER_SECURITY_DECISION.json.

Row30 now uses only a matching active public.platform_admins row and exact owner
or owner/prospector role sets. Explicit null actor, NOT FOUND and null role guards
fail closed. No email predicate, alias, fallback, owner seed or provisioning.
The email read from the authoritative row remains ONLY for unchanged audit fields.
All four gates have exact before/after/remainder hashes in neutralization.json;
the reversible static comparison preserves all other SQL bytes.

The allowlist is supabase/provenance/replay/SIGNATURE_ALLOWLIST.json: only #1, #3,
#18 and #30; no generic function-body/signature/ACL/RLS exception. #1 still requires
is_active=false and automatic_payout_enabled=false defaults in a future frontier.
#3 remains unscheduled; #18 has no identity/Auth/audit seed and retains its existing
partial unique zero-or-one-active-owner index. No owner is required or provisioned.

Trusted server callers MUST derive/validate p_actor_admin_id from trusted execution
context. Possession of that parameter is not authentication. Call-site redesign is
out of scope. Function owner DDL, SECURITY DEFINER, search_path and service_role-only
ACL statements are unchanged; materialized runtime ownership/ACL still need later
validation in disposable infrastructure.

Tests: 30/30 (11 checkpoint + 19 focused P3 static tests, including all 18 required
checks), STATIC_VERIFIED only. No database/PLpgSQL execution, frontier derivation,
fixed-point, P5 expansion, P6, P7 or push. See R10_P3_CHECKPOINT_EVIDENCE.json.
The old frontier status artifact is untouched historical checkpoint evidence; its
row30 decision-pending note is superseded here, not a claim that P4 has started.

Executor CODEX_ASTRA_6; migration owner AGENT_1. Architecture approved, implementation checkpoint BLOCKED.

## Frozen inputs

Base main: 9611d195290247694ad60d5aa2638ac8b96ecefb
Ledger 51; ordered digest 48d34e8fec27c3afc640b166306d5b2fb5f0e876daff22939a817638c93c699a
Production signature affd3c4f7a5155fcbedb9bcf9999477c2e3275a492710fd2859b98ba88f82be9

## All 51 identity mappings

Full commits/blob SHAs, comparison evidence, hashes and targets are in each meta.json and the machine-readable INDEX/plan. The table lists proposed identities, not active or executed migrations.

| # | Production identity | Provenance | Proposed form | Status |
|---|---|---|---|---|
| 1 | 20260723210120_checkout_asaas_pix_payout_grafica_flash | RENAMED | NEUTRALIZED | PREPARED_NOT_REPLAY_CERTIFIED |
| 2 | 20260723221339_subscription_webhook_unified | RETIMESTAMPED | VERBATIM_LEDGER | PREPARED_NOT_REPLAY_CERTIFIED |
| 3 | 20260728173219_orcaly_marketplace_stock_reservations | CANONICAL_MATCH | NEUTRALIZED | PREPARED_NOT_REPLAY_CERTIFIED |
| 4 | 20260728173500_orcaly_marketplace_stock_fk_indexes | CANONICAL_MATCH | VERBATIM_LEDGER | PREPARED_NOT_REPLAY_CERTIFIED |
| 5 | 20260728174830_orcaly_internal_views_security | CANONICAL_MATCH | VERBATIM_LEDGER | PREPARED_NOT_REPLAY_CERTIFIED |
| 6 | 20260728180403_orcaly_public_views_security | CANONICAL_MATCH | VERBATIM_LEDGER | PREPARED_NOT_REPLAY_CERTIFIED |
| 7 | 20260728182610_orcaly_security_definer_functions | CANONICAL_MATCH | VERBATIM_LEDGER | PREPARED_NOT_REPLAY_CERTIFIED |
| 8 | 20260728183312_orcaly_trigger_function_search_path | CANONICAL_MATCH | VERBATIM_LEDGER | PREPARED_NOT_REPLAY_CERTIFIED |
| 9 | 20260728184242_orcaly_storage_bucket_security | CANONICAL_MATCH | VERBATIM_LEDGER | PREPARED_NOT_REPLAY_CERTIFIED |
| 10 | 20260728224535_orcaly_mercado_pago_checkout_activation | CANONICAL_MATCH | VERBATIM_LEDGER | PREPARED_NOT_REPLAY_CERTIFIED |
| 11 | 20260729153535_orcaly_security_hardening_20260729 | RENAMED | VERBATIM_LEDGER | PREPARED_NOT_REPLAY_CERTIFIED |
| 12 | 20260729181400_delivery_drivers_and_assignments | RETIMESTAMPED | VERBATIM_LEDGER | PREPARED_NOT_REPLAY_CERTIFIED |
| 13 | 20260729191021_affiliate_program_sixty_percent | SQUASHED | VERBATIM_LEDGER | PREPARED_NOT_REPLAY_CERTIFIED |
| 14 | 20260729191143_affiliate_payout_account_service_functions | SQUASHED | VERBATIM_LEDGER | PREPARED_NOT_REPLAY_CERTIFIED |
| 15 | 20260729191347_affiliate_payout_commission_lock_fix | SQUASHED | VERBATIM_LEDGER | PREPARED_NOT_REPLAY_CERTIFIED |
| 16 | 20260729191437_affiliate_internal_tables_explicit_deny | SQUASHED | VERBATIM_LEDGER | PREPARED_NOT_REPLAY_CERTIFIED |
| 17 | 20260729204111_owner_support_control_v1 | RETIMESTAMPED | VERBATIM_LEDGER | PREPARED_NOT_REPLAY_CERTIFIED |
| 18 | 20260729213924_harden_platform_admin_owner_access_v1 | RETIMESTAMPED | NEUTRALIZED | PREPARED_NOT_REPLAY_CERTIFIED |
| 19 | 20260808031654_affiliate_partner_growth_hub | CANONICAL_MATCH | VERBATIM_LEDGER | PREPARED_NOT_REPLAY_CERTIFIED |
| 20 | 20260808032708_affiliate_partner_growth_hub_indexes | RETIMESTAMPED | VERBATIM_LEDGER | PREPARED_NOT_REPLAY_CERTIFIED |
| 21 | 20260809185046_align_order_status_history_with_api | SQUASHED | VERBATIM_LEDGER | PREPARED_NOT_REPLAY_CERTIFIED |
| 22 | 20260809185653_pre_validation_core_index_cleanup | PRODUCTION_ONLY | VERBATIM_LEDGER | PREPARED_NOT_REPLAY_CERTIFIED |
| 23 | 20260809185723_pre_validation_remaining_fk_indexes | PRODUCTION_ONLY | VERBATIM_LEDGER | PREPARED_NOT_REPLAY_CERTIFIED |
| 24 | 20260811230446_founder_program_database_foundation | CANONICAL_MATCH | VERBATIM_LEDGER | PREPARED_NOT_REPLAY_CERTIFIED |
| 25 | 20260811230525_founder_program_database_foundation_hardening | CANONICAL_MATCH | VERBATIM_LEDGER | PREPARED_NOT_REPLAY_CERTIFIED |
| 26 | 20260811231921_platform_admin_prospector_permissions_foundation | CANONICAL_MATCH | VERBATIM_LEDGER | PREPARED_NOT_REPLAY_CERTIFIED |
| 27 | 20260811235346_platform_admin_invites_and_activation_v1 | CANONICAL_MATCH | VERBATIM_LEDGER | PREPARED_NOT_REPLAY_CERTIFIED |
| 28 | 20260812001520_sales_prospecting_crm_foundation_v1 | CANONICAL_MATCH | VERBATIM_LEDGER | PREPARED_NOT_REPLAY_CERTIFIED |
| 29 | 20260812002052_sales_prospecting_crm_hardening_v1 | CANONICAL_MATCH | VERBATIM_LEDGER | PREPARED_NOT_REPLAY_CERTIFIED |
| 30 | 20260812003227_founder_invite_sales_integration_v1 | CANONICAL_MATCH | NOT_SELECTED | MIGRATION_OWNER_DECISION_REQUIRED |
| 31 | 20260812005359_founder_public_activation_trial_v1 | CANONICAL_MATCH | VERBATIM_LEDGER | PREPARED_NOT_REPLAY_CERTIFIED |
| 32 | 20260812011742_founder_billing_lifecycle_v1 | CANONICAL_MATCH | VERBATIM_LEDGER | PREPARED_NOT_REPLAY_CERTIFIED |
| 33 | 20260812221532_founder_final_regression_hardening_v1 | CANONICAL_MATCH | VERBATIM_LEDGER | PREPARED_NOT_REPLAY_CERTIFIED |
| 34 | 20260820231839_fix_logo_storage_schema_usage | RETIMESTAMPED | VERBATIM_LEDGER | PREPARED_NOT_REPLAY_CERTIFIED |
| 35 | 20260821012633_orcaly_assistant_v2_analytics | RETIMESTAMPED | VERBATIM_LEDGER | PREPARED_NOT_REPLAY_CERTIFIED |
| 36 | 20260823163043_whatsapp_cloud_api_v1 | RETIMESTAMPED | VERBATIM_LEDGER | PREPARED_NOT_REPLAY_CERTIFIED |
| 37 | 20260830200818_platform_evolution_3_observability | RETIMESTAMPED | VERBATIM_LEDGER | PREPARED_NOT_REPLAY_CERTIFIED |
| 38 | 20260830201025_admin_control_center_v2 | RETIMESTAMPED | VERBATIM_LEDGER | PREPARED_NOT_REPLAY_CERTIFIED |
| 39 | 20260830211222_platform_evolution_3_qa_vault | RETIMESTAMPED | VERBATIM_LEDGER | PREPARED_NOT_REPLAY_CERTIFIED |
| 40 | 20260830213641_fix_admin_users_rls_recursion | RETIMESTAMPED | VERBATIM_LEDGER | PREPARED_NOT_REPLAY_CERTIFIED |
| 41 | 20260907135613_orcaly_3_1_db_hardening_batch_1 | RETIMESTAMPED | VERBATIM_LEDGER | PREPARED_NOT_REPLAY_CERTIFIED |
| 42 | 20260907140405_orcaly_3_1_admin_server_only_grants | RETIMESTAMPED | VERBATIM_LEDGER | PREPARED_NOT_REPLAY_CERTIFIED |
| 43 | 20260907232527_orcaly_3_1_reliability_foundation | RETIMESTAMPED | VERBATIM_LEDGER | PREPARED_NOT_REPLAY_CERTIFIED |
| 44 | 20260907233411_orcaly_3_1_customer_data_quality | RETIMESTAMPED | VERBATIM_LEDGER | PREPARED_NOT_REPLAY_CERTIFIED |
| 45 | 20260908222043_orcaly_3_1_customer_data_quality_certification | RETIMESTAMPED | VERBATIM_LEDGER | PREPARED_NOT_REPLAY_CERTIFIED |
| 46 | 20260908222651_orcaly_3_1_data_quality_rule_hardening | RETIMESTAMPED | VERBATIM_LEDGER | PREPARED_NOT_REPLAY_CERTIFIED |
| 47 | 20260910001442_integration_platform_foundation | CANONICAL_MATCH | VERBATIM_LEDGER | PREPARED_NOT_REPLAY_CERTIFIED |
| 48 | 20260910004555_integration_google_oauth_security | CANONICAL_MATCH | VERBATIM_LEDGER | PREPARED_NOT_REPLAY_CERTIFIED |
| 49 | 20260910122922_background_job_worker_transitions | CANONICAL_MATCH | VERBATIM_LEDGER | PREPARED_NOT_REPLAY_CERTIFIED |
| 50 | 20260910135326_company_timezone_foundation | CANONICAL_MATCH | VERBATIM_LEDGER | PREPARED_NOT_REPLAY_CERTIFIED |
| 51 | 20260910150730_google_calendar_complete | CANONICAL_MATCH | VERBATIM_LEDGER | PREPARED_NOT_REPLAY_CERTIFIED |

## Replay decisions and divergences

47 VERBATIM_LEDGER + 3 NEUTRALIZED = 50 staged forms; zero GIT_EQUIVALENT. None is fresh-replay certified. Ledger execution evidence is the replay authority even where Git is equivalent.

Divergent retimestamped rows #12 delivery_drivers_and_assignments, #17 owner_support_control_v1, #18 harden_platform_admin_owner_access_v1 and #44 orcaly_3_1_customer_data_quality each have a full redacted current-main-vs-ledger.diff. Divergent Git sources remain archived. No divergent Git schema effects were substituted.

The five squashed identities are separated in proposed forms; combined source is archive only after eventual P6. Two production-only index entries have AUTHORSHIP UNKNOWN and authoritative ledger SQL, with no invented Git source. Renamed targets use authentic production names.

Neutralizations #1 (tenant-specific payment setting UPDATE), #3 (top-level cron schedule) and #18 (four owner/Auth/audit seed units) omit environment-bound effects only; removed-unit hashes and redacted explicit diffs live in neutralization.json. All need AGENT_4 review; none is a reviewed convergence allowlist. Raw hashes preserve private originals, not public sensitive values.

## MIGRATION_OWNER_DECISION_REQUIRED — #30

20260812003227_founder_invite_sales_integration_v1 has a person-specific production email in authorization predicates of create_founder_invite_for_sales_lead, create_founder_test_invite, rotate_founder_invite_token and revoke_founder_invite. The fifth expiry routine is not the four-gate blocker.

No raw identity is committed; no executable placeholder or modified authorization behavior was emitted. Owner + security/privacy + Coordinator must choose an explicitly approved treatment. Removing/replacing this identity is not automatically an environment-side-effect neutralization: it changes routine authorization. A routine cannot be labeled equivalent merely because its signature matches. No implementation decision is inferred from the architecture approval.

## Frontier assumptions and validation

Frontier SQL/FRONTIER.json are deliberately absent. Head catalog evidence is not a pre-ledger bootstrap. Reverse effects, platform prerequisite analysis and local fixed-point remain pending. No Docker, installed WSL, PostgreSQL runtime or Supabase CLI is available; no hosted replacement or global install was attempted. Need a separately available disposable local runtime and resolution of #30 before continuation.

No allowlist is approved. Raw production signature, functions/search_path, grants/ACL, RLS/policy, indexes, constraints, views/triggers and migration-list comparisons have NOT_EXECUTED status. Application-owned Vault-using function definitions take runtime parameters; their presence is not a copied Vault secret or a top-level secret creation. Platform internals are not recreated.

## Active directory and immutable hashes

Before = 71, actual after this checkpoint = 71 (unchanged), desired after eventual P6 = 55 (51+4). Strict guard currently rejects count71, missing27, unexpected43. Current exact production identity coverage24/51. No active files moved.

- 20260929211421_m1a_event_fabric_safety_contract.sql: 4bec9898e69a8feea2815649f45cb8e2ffd808fbe97dd87814b7f523743b8d07
- 20260929222634_m1a_event_fabric_dispatch_eligibility_fix.sql: 29d818394fc6e3c180bea4bdbc09848c2c9658238bb8c93266b42d577a8a652f
- 20260929225302_m1a_event_fabric_failure_settlement_due_guard.sql: a5b724df00163c46d1e51b7b8d9b0b01db75bdfe09b07ecdccac3f185044c2ea
- 20260930155522_m1b_shared_audit_contract.sql: 8ad806eaf22223c03fc1543526aae6b7fe43de613ef305de1738425374c297f8

Frontier hash is UNPINNED_NOT_DERIVED, not a placeholder hash. M1 pins are raw Git bytes; current tracked files remain unchanged. Evidence MANIFEST verifies actual artifact bytes and lossless decoded catalog/binary envelopes.

## Resumption ownership

AGENT_1 remains owner; no long forensic re-investigation is required. Review the decision above, the three neutralizations and the catalog boundary. P6 must not start without 51 usable forms and frontier convergence. No CFR, P7, production migration, repair, --include-all, PR, merge, push or protected-target mutation has occurred.
