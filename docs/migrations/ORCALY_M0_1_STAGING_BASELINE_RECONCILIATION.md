# ORÇALY — M0.1 Staging Baseline & Migration Ledger Reconciliation

## Executive Summary

M0.1 foi executado em modo estritamente **read-only** para production e staging.

- Repository: `viniciusaraujoop/grafica-flash`
- Main analisada: `2da6a56cf7edc67a1598c18302d73dfdfecbea97`
- Working branch: `reconcile/m0-1-staging-baseline`
- Production: `ozrasuktfthsvbqprtel`
- Staging: `zwxulgpjucxudadjdqov`
- Database mutation: **NONE**
- Migrations executed: **NONE**
- Migration history mutation: **NONE**
- Main merge: **NOT AUTHORIZED / NOT PERFORMED**

A conclusão principal é dupla:

1. **O schema estrutural de production está integralmente presente em staging.**
2. **O baseline de staging não reproduz todos os efeitos não-DDL/configuration de migrations de production e a provenance de staging ainda não está na main.**

Por isso, a reconciliação não deve terminar com replay de migrations antigas. O estado correto é **HOLD** até que os gaps de provenance e de configuração sejam tratados por unidades forward-only e explicitamente autorizadas.

### Required declarations

- **LAST_CANONICAL_MIGRATION_VERSION:** `20260927170000`
- **NEXT_SAFE_MIGRATION_PREFIX:** `20260929` (qualquer nova versão deve ser um timestamp de 14 dígitos estritamente maior que `20260927170000`)
- **STAGING_BASELINE_STATUS:** `STRUCTURAL_PARITY_CONFIRMED__NON_DDL_GAPS_PRESENT`
- **PRODUCTION_BASELINE_STATUS:** `CANONICAL_LEDGER_CONFIRMED`
- **REPOSITORY_LEDGER_STATUS:** `PARTIAL_PROVENANCE__HISTORICAL_AND_STAGING_GAPS`
- **MIGRATION_OWNER_STATUS:** `AGENT_1__HOLD`

---

## Repository Ledger

A main contém **67 migration files**.

Em relação às **51** versions do production ledger:

- Exact production version + repository file: **24**
- Production version ausente, mas mesmo migration name existe com timestamp diferente: **17**
- Production version ausente e nenhum arquivo com mesmo migration name: **10**
- Total de production versions sem filename/timestamp canônico na main: **27**

As cinco migrations de integração restauradas no M0 estão agora presentes com a identity canônica de production:

- `20260910001442_integration_platform_foundation.sql`
- `20260910004555_integration_google_oauth_security.sql`
- `20260910122922_background_job_worker_transitions.sql`
- `20260910135326_company_timezone_foundation.sql`
- `20260910150730_google_calendar_complete.sql`

### Production versions represented exactly in main

- `20260728173219_orcaly_marketplace_stock_reservations.sql`
- `20260728173500_orcaly_marketplace_stock_fk_indexes.sql`
- `20260728174830_orcaly_internal_views_security.sql`
- `20260728180403_orcaly_public_views_security.sql`
- `20260728182610_orcaly_security_definer_functions.sql`
- `20260728183312_orcaly_trigger_function_search_path.sql`
- `20260728184242_orcaly_storage_bucket_security.sql`
- `20260728224535_orcaly_mercado_pago_checkout_activation.sql`
- `20260808031654_affiliate_partner_growth_hub.sql`
- `20260811230446_founder_program_database_foundation.sql`
- `20260811230525_founder_program_database_foundation_hardening.sql`
- `20260811231921_platform_admin_prospector_permissions_foundation.sql`
- `20260811235346_platform_admin_invites_and_activation_v1.sql`
- `20260812001520_sales_prospecting_crm_foundation_v1.sql`
- `20260812002052_sales_prospecting_crm_hardening_v1.sql`
- `20260812003227_founder_invite_sales_integration_v1.sql`
- `20260812005359_founder_public_activation_trial_v1.sql`
- `20260812011742_founder_billing_lifecycle_v1.sql`
- `20260812221532_founder_final_regression_hardening_v1.sql`
- `20260910001442_integration_platform_foundation.sql`
- `20260910004555_integration_google_oauth_security.sql`
- `20260910122922_background_job_worker_transitions.sql`
- `20260910135326_company_timezone_foundation.sql`
- `20260910150730_google_calendar_complete.sql`

### Same-name / wrong-version files with normalized SQL equivalence confirmed

Essas 12 entries são **REPOSITORY_PROVENANCE_GAP**. O SQL do arquivo de mesmo nome foi comparado ao SQL gravado no production ledger e normalizou para a mesma sequência semântica:

- `20260723221339 subscription_webhook_unified`
- `20260808032708 affiliate_partner_growth_hub_indexes`
- `20260820231839 fix_logo_storage_schema_usage`
- `20260830200818 platform_evolution_3_observability`
- `20260830201025 admin_control_center_v2`
- `20260830211222 platform_evolution_3_qa_vault`
- `20260830213641 fix_admin_users_rls_recursion`
- `20260907135613 orcaly_3_1_db_hardening_batch_1`
- `20260907140405 orcaly_3_1_admin_server_only_grants`
- `20260907232527 orcaly_3_1_reliability_foundation`
- `20260908222043 orcaly_3_1_customer_data_quality_certification`
- `20260908222651 orcaly_3_1_data_quality_rule_hardening`

Essas migrations precisam de provenance canônica futura, **não de execução**.

### Same-name / wrong-version files that are NOT semantically identical to the applied ledger statement

Essas 5 entries não podem ser "corrigidas" simplesmente renomeando o arquivo atual:

- `20260729181400 delivery_drivers_and_assignments`
- `20260729191021 affiliate_program_sixty_percent`
- `20260729204111 owner_support_control_v1`
- `20260729213924 harden_platform_admin_owner_access_v1`
- `20260907233411 orcaly_3_1_customer_data_quality`

Classification:

- **REPOSITORY_PROVENANCE_GAP**
- **UNKNOWN_REQUIRES_INVESTIGATION** para provenance exata
- schema live não está faltando em staging

Required resolution: restaurar futuramente a provenance a partir do statement realmente aplicado no production ledger ou de uma fonte histórica comprovada. Não usar o arquivo de mesmo nome como substituto automático.

### Production ledger entries without same-name file in main

As 10 entries abaixo também são provenance-only do ponto de vista do schema live, porque seus efeitos estruturais estão presentes em production e no baseline de staging:

- `20260723210120 checkout_asaas_pix_payout_grafica_flash`
- `20260729153535 orcaly_security_hardening_20260729`
- `20260729191143 affiliate_payout_account_service_functions`
- `20260729191347 affiliate_payout_commission_lock_fix`
- `20260729191437 affiliate_internal_tables_explicit_deny`
- `20260809185046 align_order_status_history_with_api`
- `20260809185653 pre_validation_core_index_cleanup`
- `20260809185723 pre_validation_remaining_fk_indexes`
- `20260821012633 orcaly_assistant_v2_analytics`
- `20260823163043 whatsapp_cloud_api_v1`

Classification: **REPOSITORY_PROVENANCE_GAP**.

### Full main migration inventory

- `20260628_notificacoes_inteligentes.sql`
- `20260628_operacao_inteligente.sql`
- `20260628_orcaly_consolidado.sql`
- `20260628_pedidos_pro_v2.sql`
- `20260628_pedidos_produtos_pro.sql`
- `20260630_fix_cupons_loading.sql`
- `20260630_painel_whatsapp_pro.sql`
- `20260630_pre_validacao_orcaly.sql`
- `20260630_whatsapp_pedidos_status.sql`
- `20260701_cadastro_onboarding_inteligente.sql`
- `20260701_modulos_por_segmento_food_mvp.sql`
- `20260702_sites_premium_segmentos.sql`
- `20260704_financeiro_base_seguro.sql`
- `20260705_food_operacao_funcional.sql`
- `20260706_assinatura_pix_avulso.sql`
- `20260706_marketplace_checkout_cupons_segmentos.sql`
- `20260706_marketplace_food_checkout.sql`
- `20260706_marketplace_mercado_pago_split.sql`
- `20260716_estabilizacao_orcaly_fases_2_a_12.sql`
- `20260717_subscription_trial_cancellation.sql`
- `20260723213000_checkout_asaas_pix_payout.sql`
- `20260723234500_subscription_webhook_unified.sql`
- `20260723_migracao_gradual_asaas_orcaly.sql`
- `20260728173219_orcaly_marketplace_stock_reservations.sql`
- `20260728173500_orcaly_marketplace_stock_fk_indexes.sql`
- `20260728174830_orcaly_internal_views_security.sql`
- `20260728180403_orcaly_public_views_security.sql`
- `20260728182610_orcaly_security_definer_functions.sql`
- `20260728183312_orcaly_trigger_function_search_path.sql`
- `20260728184242_orcaly_storage_bucket_security.sql`
- `20260728224535_orcaly_mercado_pago_checkout_activation.sql`
- `20260729133000_orcaly_security_hardening.sql`
- `20260729165627_affiliate_program_sixty_percent.sql`
- `20260729182742_delivery_drivers_and_assignments.sql`
- `20260729212519_owner_support_control_v1.sql`
- `20260729214347_harden_platform_admin_owner_access_v1.sql`
- `20260730212000_unify_payment_domain_phase_1.sql`
- `20260808031654_affiliate_partner_growth_hub.sql`
- `20260808031810_affiliate_partner_growth_hub_indexes.sql`
- `20260811230446_founder_program_database_foundation.sql`
- `20260811230525_founder_program_database_foundation_hardening.sql`
- `20260811231921_platform_admin_prospector_permissions_foundation.sql`
- `20260811235346_platform_admin_invites_and_activation_v1.sql`
- `20260812001520_sales_prospecting_crm_foundation_v1.sql`
- `20260812002052_sales_prospecting_crm_hardening_v1.sql`
- `20260812003227_founder_invite_sales_integration_v1.sql`
- `20260812005359_founder_public_activation_trial_v1.sql`
- `20260812011742_founder_billing_lifecycle_v1.sql`
- `20260812221532_founder_final_regression_hardening_v1.sql`
- `20260819221500_partner_portal_v2_indexes.sql`
- `20260819230000_admin_control_center_v2.sql`
- `20260819234000_storefront_marketplace_v2.sql`
- `20260820230000_fix_logo_storage_schema_usage.sql`
- `20260830143000_platform_evolution_3_observability.sql`
- `20260830184500_fix_admin_users_rls_recursion.sql`
- `20260830_platform_evolution_3_qa_vault.sql`
- `20260907140500_orcaly_3_1_db_hardening_batch_1.sql`
- `20260907142000_orcaly_3_1_admin_server_only_grants.sql`
- `20260907233000_orcaly_3_1_reliability_foundation.sql`
- `20260907234500_orcaly_3_1_customer_data_quality.sql`
- `20260908222500_orcaly_3_1_customer_data_quality_certification.sql`
- `20260908223500_orcaly_3_1_data_quality_rule_hardening.sql`
- `20260910001442_integration_platform_foundation.sql`
- `20260910004555_integration_google_oauth_security.sql`
- `20260910122922_background_job_worker_transitions.sql`
- `20260910135326_company_timezone_foundation.sql`
- `20260910150730_google_calendar_complete.sql`

---

## Production Ledger

Production possui **51** ledger entries.

As cinco integration versions exigidas nesta missão estão confirmadas como applied:

- `20260910001442 integration_platform_foundation`
- `20260910004555 integration_google_oauth_security`
- `20260910122922 background_job_worker_transitions`
- `20260910135326 company_timezone_foundation`
- `20260910150730 google_calendar_complete`

### Full production ledger / repository relation

| Version | Name | Main repository status |
| --- | --- | --- |
| 20260723210120 | checkout_asaas_pix_payout_grafica_flash | NO_SAME_NAME_FILE |
| 20260723221339 | subscription_webhook_unified | WRONG_VERSION_EQUIVALENT → 20260723234500_subscription_webhook_unified.sql |
| 20260728173219 | orcaly_marketplace_stock_reservations | EXACT_VERSION_FILE |
| 20260728173500 | orcaly_marketplace_stock_fk_indexes | EXACT_VERSION_FILE |
| 20260728174830 | orcaly_internal_views_security | EXACT_VERSION_FILE |
| 20260728180403 | orcaly_public_views_security | EXACT_VERSION_FILE |
| 20260728182610 | orcaly_security_definer_functions | EXACT_VERSION_FILE |
| 20260728183312 | orcaly_trigger_function_search_path | EXACT_VERSION_FILE |
| 20260728184242 | orcaly_storage_bucket_security | EXACT_VERSION_FILE |
| 20260728224535 | orcaly_mercado_pago_checkout_activation | EXACT_VERSION_FILE |
| 20260729153535 | orcaly_security_hardening_20260729 | NO_SAME_NAME_FILE |
| 20260729181400 | delivery_drivers_and_assignments | WRONG_VERSION_NON_EQUIVALENT → 20260729182742_delivery_drivers_and_assignments.sql |
| 20260729191021 | affiliate_program_sixty_percent | WRONG_VERSION_NON_EQUIVALENT → 20260729165627_affiliate_program_sixty_percent.sql |
| 20260729191143 | affiliate_payout_account_service_functions | NO_SAME_NAME_FILE |
| 20260729191347 | affiliate_payout_commission_lock_fix | NO_SAME_NAME_FILE |
| 20260729191437 | affiliate_internal_tables_explicit_deny | NO_SAME_NAME_FILE |
| 20260729204111 | owner_support_control_v1 | WRONG_VERSION_NON_EQUIVALENT → 20260729212519_owner_support_control_v1.sql |
| 20260729213924 | harden_platform_admin_owner_access_v1 | WRONG_VERSION_NON_EQUIVALENT → 20260729214347_harden_platform_admin_owner_access_v1.sql |
| 20260808031654 | affiliate_partner_growth_hub | EXACT_VERSION_FILE |
| 20260808032708 | affiliate_partner_growth_hub_indexes | WRONG_VERSION_EQUIVALENT → 20260808031810_affiliate_partner_growth_hub_indexes.sql |
| 20260809185046 | align_order_status_history_with_api | NO_SAME_NAME_FILE |
| 20260809185653 | pre_validation_core_index_cleanup | NO_SAME_NAME_FILE |
| 20260809185723 | pre_validation_remaining_fk_indexes | NO_SAME_NAME_FILE |
| 20260811230446 | founder_program_database_foundation | EXACT_VERSION_FILE |
| 20260811230525 | founder_program_database_foundation_hardening | EXACT_VERSION_FILE |
| 20260811231921 | platform_admin_prospector_permissions_foundation | EXACT_VERSION_FILE |
| 20260811235346 | platform_admin_invites_and_activation_v1 | EXACT_VERSION_FILE |
| 20260812001520 | sales_prospecting_crm_foundation_v1 | EXACT_VERSION_FILE |
| 20260812002052 | sales_prospecting_crm_hardening_v1 | EXACT_VERSION_FILE |
| 20260812003227 | founder_invite_sales_integration_v1 | EXACT_VERSION_FILE |
| 20260812005359 | founder_public_activation_trial_v1 | EXACT_VERSION_FILE |
| 20260812011742 | founder_billing_lifecycle_v1 | EXACT_VERSION_FILE |
| 20260812221532 | founder_final_regression_hardening_v1 | EXACT_VERSION_FILE |
| 20260820231839 | fix_logo_storage_schema_usage | WRONG_VERSION_EQUIVALENT → 20260820230000_fix_logo_storage_schema_usage.sql |
| 20260821012633 | orcaly_assistant_v2_analytics | NO_SAME_NAME_FILE |
| 20260823163043 | whatsapp_cloud_api_v1 | NO_SAME_NAME_FILE |
| 20260830200818 | platform_evolution_3_observability | WRONG_VERSION_EQUIVALENT → 20260830143000_platform_evolution_3_observability.sql |
| 20260830201025 | admin_control_center_v2 | WRONG_VERSION_EQUIVALENT → 20260819230000_admin_control_center_v2.sql |
| 20260830211222 | platform_evolution_3_qa_vault | WRONG_VERSION_EQUIVALENT → 20260830_platform_evolution_3_qa_vault.sql |
| 20260830213641 | fix_admin_users_rls_recursion | WRONG_VERSION_EQUIVALENT → 20260830184500_fix_admin_users_rls_recursion.sql |
| 20260907135613 | orcaly_3_1_db_hardening_batch_1 | WRONG_VERSION_EQUIVALENT → 20260907140500_orcaly_3_1_db_hardening_batch_1.sql |
| 20260907140405 | orcaly_3_1_admin_server_only_grants | WRONG_VERSION_EQUIVALENT → 20260907142000_orcaly_3_1_admin_server_only_grants.sql |
| 20260907232527 | orcaly_3_1_reliability_foundation | WRONG_VERSION_EQUIVALENT → 20260907233000_orcaly_3_1_reliability_foundation.sql |
| 20260907233411 | orcaly_3_1_customer_data_quality | WRONG_VERSION_NON_EQUIVALENT → 20260907234500_orcaly_3_1_customer_data_quality.sql |
| 20260908222043 | orcaly_3_1_customer_data_quality_certification | WRONG_VERSION_EQUIVALENT → 20260908222500_orcaly_3_1_customer_data_quality_certification.sql |
| 20260908222651 | orcaly_3_1_data_quality_rule_hardening | WRONG_VERSION_EQUIVALENT → 20260908223500_orcaly_3_1_data_quality_rule_hardening.sql |
| 20260910001442 | integration_platform_foundation | EXACT_VERSION_FILE |
| 20260910004555 | integration_google_oauth_security | EXACT_VERSION_FILE |
| 20260910122922 | background_job_worker_transitions | EXACT_VERSION_FILE |
| 20260910135326 | company_timezone_foundation | EXACT_VERSION_FILE |
| 20260910150730 | google_calendar_complete | EXACT_VERSION_FILE |

Production ledger continua sendo a autoridade para a identity/version das migrations já aplicadas em production.

**Nenhuma entry do production ledger deve ser reaplicada para resolver provenance.**

---

## Staging Ledger

Staging possui **27** ledger entries.

A linha é composta por:

- `20260926014103 ecosystem_identity_wealth`
- `20260926030809 production_schema_baseline`
- 25 migrations Wealth posteriores
- frontier atual: `20260927170000 wealth_alert_center`

Nenhuma das 27 versions está hoje na main.

A branch `codex/orcaly-ecosystem` contém **26/27** filenames exatos do staging ledger. O único arquivo não localizado nessa branch é:

- `20260926030809_production_schema_baseline.sql`

Para 24 das 26 migrations localizadas em `codex/orcaly-ecosystem`, a equivalência SQL normalizada com o statement do staging ledger foi confirmada.

Duas migrations têm filename/version source localizado, mas o texto bruto gravado em `schema_migrations.statements` não é idêntico ao arquivo atual da branch:

- `20260927162000 wealth_document_expiry`
- `20260927170000 wealth_alert_center`

Essas duas ficam classificadas como **UNKNOWN_REQUIRES_INVESTIGATION** para provenance textual. Isso não representa prova de schema gap; representa falta de prova de imutabilidade da source migration após apply.

### Full staging ledger / repository relation

| Version | Name | Source/provenance status |
| --- | --- | --- |
| 20260926014103 | ecosystem_identity_wealth | MAIN_ABSENT; codex source found; normalized SQL equivalence confirmed |
| 20260926030809 | production_schema_baseline | MAIN_ABSENT; source file not found on codex/orcaly-ecosystem |
| 20260926103114 | wealth_lifecycle_aggregates | MAIN_ABSENT; codex source found; normalized SQL equivalence confirmed |
| 20260926110128 | wealth_recurring_schedules | MAIN_ABSENT; codex source found; normalized SQL equivalence confirmed |
| 20260926153138 | wealth_recurrence_rpc_boundary | MAIN_ABSENT; codex source found; normalized SQL equivalence confirmed |
| 20260926164000 | wealth_recurrence_clock | MAIN_ABSENT; codex source found; normalized SQL equivalence confirmed |
| 20260926165000 | wealth_debt_center | MAIN_ABSENT; codex source found; normalized SQL equivalence confirmed |
| 20260926171000 | wealth_debt_conflict_response | MAIN_ABSENT; codex source found; normalized SQL equivalence confirmed |
| 20260926180000 | wealth_net_worth | MAIN_ABSENT; codex source found; normalized SQL equivalence confirmed |
| 20260926181546 | wealth_portfolio_foundation | MAIN_ABSENT; codex source found; normalized SQL equivalence confirmed |
| 20260926185024 | wealth_portfolio_target_binding | MAIN_ABSENT; codex source found; normalized SQL equivalence confirmed |
| 20260926190000 | wealth_financial_health | MAIN_ABSENT; codex source found; normalized SQL equivalence confirmed |
| 20260926190250 | wealth_portfolio_blind_dml_guard | MAIN_ABSENT; codex source found; normalized SQL equivalence confirmed |
| 20260926195246 | wealth_financial_calendar | MAIN_ABSENT; codex source found; normalized SQL equivalence confirmed |
| 20260926205052 | wealth_goal_funding_life_plans | MAIN_ABSENT; codex source found; normalized SQL equivalence confirmed |
| 20260926214929 | wealth_documents_vault | MAIN_ABSENT; codex source found; normalized SQL equivalence confirmed |
| 20260926220404 | wealth_documents_storage_read_compatibility | MAIN_ABSENT; codex source found; normalized SQL equivalence confirmed |
| 20260926222248 | wealth_timeline_read_model | MAIN_ABSENT; codex source found; normalized SQL equivalence confirmed |
| 20260926222931 | wealth_timeline_transaction_binding | MAIN_ABSENT; codex source found; normalized SQL equivalence confirmed |
| 20260926225948 | wealth_family_explicit_sharing | MAIN_ABSENT; codex source found; normalized SQL equivalence confirmed |
| 20260926233156 | wealth_automation_center | MAIN_ABSENT; codex source found; normalized SQL equivalence confirmed |
| 20260927001122 | wealth_fee_analyzer | MAIN_ABSENT; codex source found; normalized SQL equivalence confirmed |
| 20260927003416 | wealth_shield_declared_policies | MAIN_ABSENT; codex source found; normalized SQL equivalence confirmed |
| 20260927013000 | wealth_tax_center_foundation | MAIN_ABSENT; codex source found; normalized SQL equivalence confirmed |
| 20260927132000 | wealth_morning_night_briefing | MAIN_ABSENT; codex source found; normalized SQL equivalence confirmed |
| 20260927162000 | wealth_document_expiry | MAIN_ABSENT; codex source found; raw applied-statement text differs, semantic provenance requires investigation |
| 20260927170000 | wealth_alert_center | MAIN_ABSENT; codex source found; raw applied-statement text differs, semantic provenance requires investigation |

---

## Semantic Schema Comparison

### Production → staging structural parity

Foi construído um catálogo semântico read-only de:

- relations
- columns
- constraints
- indexes
- public functions
- triggers
- RLS policies
- grants relevantes
- public enum/domain types
- view definitions
- storage policies/triggers
- `orcaly_private` objects

Resultado do catálogo principal `public`:

- Production objects/signatures: **4,701**
- Missing in staging: **0**
- Shared objects with differing signature: **0**
- Extra staging objects: **709**

Staging extras, majoritariamente Ecosystem/Wealth:

- 216 columns
- 190 constraints
- 31 functions
- 55 indexes
- 27 policies
- 18 relations
- 152 table grants
- 20 triggers

`orcaly_private`:

- Production signatures: **46**
- Staging signatures: **46**
- Missing: **0**
- Different: **0**

Storage/public types/views additional comparison:

- Missing production objects/policies in staging: **0**
- Differing production objects/policies in staging: **0**
- Staging adds 3 Wealth storage policies

Installed extension set is equivalent in both environments:

- `pg_cron 1.6.4`
- `pg_stat_statements 1.11`
- `pgcrypto 1.3`
- `plpgsql 1.0`
- `supabase_vault 0.3.1`
- `uuid-ossp 1.1`

Therefore:

**PRODUCTION STRUCTURAL SCHEMA ⊆ STAGING STRUCTURAL SCHEMA**

with no detected structural signature drift for production-owned objects.

### The five canonical integration migrations in staging

| Production version | Production ledger | Main file | Staging ledger entry | Staging structural state | Classification |
| --- | --- | --- | --- | --- | --- |
| 20260910001442 | APPLIED | PRESENT | ABSENT | PRESENT | SUPERSEDED_HISTORY + STAGING_BASELINE_GAP for seed rows |
| 20260910004555 | APPLIED | PRESENT | ABSENT | PRESENT | SUPERSEDED_HISTORY |
| 20260910122922 | APPLIED | PRESENT | ABSENT | PRESENT | SUPERSEDED_HISTORY |
| 20260910135326 | APPLIED | PRESENT | ABSENT | PRESENT | SUPERSEDED_HISTORY |
| 20260910150730 | APPLIED | PRESENT | ABSENT | PRESENT | SUPERSEDED_HISTORY |

The five versions **must not** be executed in staging simply because their ledger versions are absent there.

Their DDL effects were superseded by the staging baseline.

---

## Non-DDL / Environment State Gaps

Structural parity is not equivalent to complete migration-effect parity.

### 1. platform_feature_flags

Production:

- **23 rows**

Staging:

- **0 rows**

Missing staging configuration includes:

- `admin.ai`
- `support.mode`
- 21 `integration_*` flags

The staging baseline SQL mentions `platform_feature_flags`, but does **not** contain a top-level `insert into public.platform_feature_flags` seed.

Classification:

- **STAGING_BASELINE_GAP**
- **REQUIRES_FUTURE_MIGRATION** or explicitly authorized environment seed reconciliation

Risk:

- feature-gated behavior in staging can fail closed or differ from production even when tables/functions are identical.

Required resolution:

- forward-only, idempotent seed/config reconciliation;
- **do not replay** `admin_control_center_v2` or `integration_platform_foundation`.

### 2. affiliate_program_settings

Production has the global singleton:

- `id = 1`
- commission rate: `0.6000`
- hold days: `14`
- minimum payout: `50.00`
- attribution days: `60`
- payouts enabled: `true`
- automatic payout: `false`
- terms version: `2026-07-29`

Staging:

- **0 rows**

Classification:

- **STAGING_BASELINE_GAP**
- **REQUIRES_FUTURE_MIGRATION** if affiliate behavior is expected in staging

Required resolution:

- forward-only singleton seed reconciliation;
- do not replay historical affiliate migrations.

### 3. storage.buckets

Production has six application buckets absent from staging:

- `artes`
- `financeiro`
- `logos`
- `product-images`
- `produtos`
- `site-assets`

Staging currently has only:

- `wealth-documents`

Storage policies from production are structurally present in staging, but the bucket configuration rows are not.

Classification:

- **STAGING_BASELINE_GAP**
- environment/infrastructure configuration gap

Risk:

- staging upload flows can fail even while RLS policies exist correctly.

Required resolution:

- separate authorized bucket provisioning or forward-only idempotent environment migration;
- do not replay `orcaly_storage_bucket_security` or `orcaly_security_hardening_20260729`.

### 4. pg_cron scheduled state

Production:

- `orcaly-release-expired-stock`
- schedule: `*/5 * * * *`
- active: `true`

Staging:

- production job absent
- staging has `orcaly-staging-wealth-recurrences`
- Wealth recurrence job is currently `active = false`

Classification:

- **STAGING_BASELINE_GAP**
- environment/runtime database state gap

Required resolution:

- explicit decision whether production-equivalent stock-expiry scheduling is required in staging;
- if required, add it through a separate forward-only/environment-specific change;
- never replay the stock-reservation migration solely to recreate the cron row.

---

## Drift Classification

### LEDGER_ONLY_DRIFT

- Production historical versions absent from staging ledger while their structural effects are present through the staging baseline.
- The five canonical integration versions are the clearest verified example.

### REPOSITORY_PROVENANCE_GAP

Production:

- **27/51** production versions do not have an exact-timestamp file in main.
- 12 have semantically equivalent same-name sources with different timestamps.
- 5 have same-name sources that are not equivalent to the applied statement.
- 10 have no same-name file in main.

Staging:

- **27/27** staging versions are absent from main.
- 26 source files exist on `codex/orcaly-ecosystem`.
- the staging bootstrap baseline `20260926030809` has no located repository source file.

### SCHEMA_STATE_GAP

No structural production-owned schema object gap was found in staging.

Current detected gaps are non-DDL/configuration/environment state, not missing relations/functions/indexes/policies.

### STAGING_BASELINE_GAP

Confirmed:

- 23 `platform_feature_flags` rows
- `affiliate_program_settings.id = 1`
- six production Storage bucket rows
- production stock-expiry cron job

### SUPERSEDED_HISTORY

Production migration history prior to staging bootstrap is represented structurally by:

- `20260926030809 production_schema_baseline`

This does not mean production ledger entries ceased to be canonical in production. It means staging intentionally has a squashed/bootstrap lineage.

### REQUIRES_FUTURE_MIGRATION

Potential forward-only reconciliation units:

1. staging global configuration seed reconciliation;
2. storage bucket/environment provisioning reconciliation;
3. staging cron/bootstrap reconciliation, if operational parity is required;
4. repository canonical provenance restoration for production historical versions.

### UNKNOWN_REQUIRES_INVESTIGATION

1. Exact source provenance for:
   - `20260927162000 wealth_document_expiry`
   - `20260927170000 wealth_alert_center`
2. Original canonical source for:
   - `20260926030809 production_schema_baseline`
3. Exact applied source reconstruction for the 5 production same-name/non-equivalent migrations.

---

## Do-Not-Reapply List

### Production

Do not reapply **any of the 51 production ledger entries** to production for provenance repair.

In particular, do not reapply:

- `20260910001442 integration_platform_foundation`
- `20260910004555 integration_google_oauth_security`
- `20260910122922 background_job_worker_transitions`
- `20260910135326 company_timezone_foundation`
- `20260910150730 google_calendar_complete`

### Staging

Do not apply production historical migrations to staging merely because their original versions are absent from the staging ledger.

Do not reapply any existing staging ledger entry:

- `20260926014103 ecosystem_identity_wealth`
- `20260926030809 production_schema_baseline`
- `20260926103114 wealth_lifecycle_aggregates`
- `20260926110128 wealth_recurring_schedules`
- `20260926153138 wealth_recurrence_rpc_boundary`
- `20260926164000 wealth_recurrence_clock`
- `20260926165000 wealth_debt_center`
- `20260926171000 wealth_debt_conflict_response`
- `20260926180000 wealth_net_worth`
- `20260926181546 wealth_portfolio_foundation`
- `20260926185024 wealth_portfolio_target_binding`
- `20260926190000 wealth_financial_health`
- `20260926190250 wealth_portfolio_blind_dml_guard`
- `20260926195246 wealth_financial_calendar`
- `20260926205052 wealth_goal_funding_life_plans`
- `20260926214929 wealth_documents_vault`
- `20260926220404 wealth_documents_storage_read_compatibility`
- `20260926222248 wealth_timeline_read_model`
- `20260926222931 wealth_timeline_transaction_binding`
- `20260926225948 wealth_family_explicit_sharing`
- `20260926233156 wealth_automation_center`
- `20260927001122 wealth_fee_analyzer`
- `20260927003416 wealth_shield_declared_policies`
- `20260927013000 wealth_tax_center_foundation`
- `20260927132000 wealth_morning_night_briefing`
- `20260927162000 wealth_document_expiry`
- `20260927170000 wealth_alert_center`

Do not apply `20260926030809 production_schema_baseline` to production or on top of an already-established schema.

---

## Future Migration Starting Point

The highest applied migration version across the authoritative ledgers inspected is:

`20260927170000`

Therefore:

**LAST_CANONICAL_MIGRATION_VERSION = 20260927170000**

At the time of this reconciliation, the next safe UTC date prefix is:

**NEXT_SAFE_MIGRATION_PREFIX = 20260929**

Any future migration must:

1. use a 14-digit timestamp strictly greater than `20260927170000`;
2. be forward-only;
3. not attempt to replay/synchronize historical ledger versions;
4. be authored against the actual staging schema frontier, not only the current main migration directory;
5. be created only after the HOLD items below are resolved or explicitly waived by the Coordinator.

No Shared Foundation migration was created in M0.1.

---

## Risks

1. **Main is not the complete staging lineage.** A developer reading only main sees a latest migration of `20260910150730`, while staging is already at `20260927170000`.
2. **Historical production provenance remains partial.** Fresh rebuilds or migration tooling can infer a different history from production.
3. **Replaying old files is unsafe.** Several same-name repository files are not the SQL actually applied under the production version.
4. **Structural parity hides configuration drift.** Staging has correct tables/functions/policies but misses feature flags, global affiliate settings, buckets and at least one production cron job.
5. **Baseline provenance is staging-specific.** Treating `20260926030809 production_schema_baseline` as a normal forward production migration would be unsafe.
6. **Two recent staging source files are not text-identical to stored applied statements.** Immutability/provenance must be resolved before those files are treated as canonical migration evidence.

---

## Open Questions

1. Should the 26 staging Ecosystem/Wealth migration files be promoted from `codex/orcaly-ecosystem` into the canonical repository line before Shared Foundation implementation?
2. Is `20260926030809 production_schema_baseline` intentionally staging-only and therefore documentation-only, or is there an original generated artifact that must be retained outside the forward migration chain?
3. Are production-equivalent Storage buckets expected in staging, or should staging provision a deliberately smaller bucket set?
4. Should `orcaly-release-expired-stock` run in staging, or is its absence intentional?
5. Should all 23 production feature flags be seeded into staging, or should staging use an explicit environment-specific flag matrix?
6. What was the exact applied source for the five production same-name/non-equivalent migrations?

---

## Recommended Next Step

Do **not** create or execute the next Shared Foundation migration yet.

Required sequence:

1. Coordinator decides canonical repository strategy for the 26 staging migration files and the staging-only baseline.
2. Resolve the two recent staging provenance ambiguities (`20260927162000`, `20260927170000`).
3. Authorize separate forward-only staging reconciliation for required global seeds/configuration:
   - feature flags,
   - affiliate program singleton,
   - Storage buckets if staging parity is required,
   - cron state if staging operational parity is required.
4. Keep production read-only and do not repair migration history.
5. After these are resolved, start Shared Foundation from a timestamp strictly greater than `20260927170000`.

---

## Final Status

```
M0_1_RECONCILIATION:
HOLD

PRODUCTION_LEDGER:
RECONCILED_AS_AUTHORITY

STAGING_LEDGER:
STRUCTURALLY_RECONCILED__PROVENANCE_AND_NON_DDL_GAPS_OPEN

DATABASE_MUTATION:
NONE

MIGRATIONS_EXECUTED:
NONE

MIGRATION_OWNER:
AGENT_1

READY_FOR_SHARED_FOUNDATION_MIGRATION_DESIGN:
NO

LAST_CANONICAL_MIGRATION_VERSION:
20260927170000

NEXT_SAFE_MIGRATION_PREFIX:
20260929

STAGING_BASELINE_STATUS:
STRUCTURAL_PARITY_CONFIRMED__NON_DDL_GAPS_PRESENT

PRODUCTION_BASELINE_STATUS:
CANONICAL_LEDGER_CONFIRMED

REPOSITORY_LEDGER_STATUS:
PARTIAL_PROVENANCE__HOLD
```

### HOLD blockers

#### Blocker A — Staging configuration seed gap

- ledger: staging baseline
- version: `20260926030809`
- schema/state object: `public.platform_feature_flags`, `public.affiliate_program_settings`
- evidence: production has 23 feature-flag rows and one affiliate settings singleton; staging has none
- risk: environment behavior diverges despite structural schema parity
- required resolution: separate forward-only, idempotent configuration reconciliation

#### Blocker B — Storage environment gap

- ledger: production historical effects vs staging baseline
- versions: `20260728184242`, `20260729153535` contribute production bucket state
- schema/state object: `storage.buckets`
- evidence: six production application buckets absent from staging; Storage policies themselves match
- risk: staging file-upload flows can fail
- required resolution: explicit environment provisioning decision and separate authorized reconciliation

#### Blocker C — Cron environment gap

- ledger: production historical effect vs staging baseline
- version: `20260728173219`
- schema/state object: `cron.job / orcaly-release-expired-stock`
- evidence: active in production, absent in staging
- risk: stock reservation expiry behavior differs
- required resolution: Coordinator decides whether staging must mirror the schedule; if yes, create a separate forward-only/environment-specific unit

#### Blocker D — Staging repository provenance

- ledger: staging
- versions: all 27 staging versions
- schema object: migration source provenance
- evidence: none of the 27 versions exists in main; 26 exist on `codex/orcaly-ecosystem`; baseline source file not located
- risk: main does not describe the schema frontier on which the next migration would be authored
- required resolution: canonicalize or formally designate staging source lineage before Shared Foundation implementation

#### Blocker E — Applied-source ambiguity

- ledger: staging
- versions: `20260927162000`, `20260927170000`
- schema object: migration source provenance
- evidence: source files exist with exact version/name, but stored applied statement text is not byte-identical
- risk: accidental post-apply migration edits or non-canonical source
- required resolution: recover/verify the exact applied SQL or establish an immutable canonical artifact

END OF MISSION.
