# Orçaly RLS & Grants Matrix

Snapshot: 2026-09-27  
Review mode: **READ ONLY**  
Production project: `ozrasuktfthsvbqprtel`  
Staging project: `zwxulgpjucxudadjdqov`  
Migration owner: Agent 1  
`MIGRATION_OWNERSHIP_RELEASED`: **NO**

No policy, grant, function, schema or migration was changed during this review.

## Interpretation rule

`RLS enabled + no policy` is not automatically a vulnerability. If anon/authenticated have no effective policy, the browser-facing result is deny-all. Several Orçaly infrastructure tables intentionally use this pattern and are reached only through server/service-role or narrow RPC boundaries.

Never add `USING (true)` merely to silence Advisor.

## Advisor snapshot

| Environment | RLS enabled / no policy | Authenticated SECURITY DEFINER warning | Leaked-password warning |
|---|---:|---:|---:|
| Production | 44 | 1 | 1 |
| Staging | 57 | 1 public Advisor warning; additional Wealth RPCs reviewed below | not reported by Advisor |

Production leaked-password protection is disabled. This is Auth configuration, not a Phase A database migration.

## Production critical-table matrix

Legend: grants describe table privileges. RLS policies remain the row authorization boundary for browser roles.

| Table | RLS | Policies | anon | authenticated table grants | Boundary | Classification | Recommendation |
|---|---|---|---|---|---|---|---|
| `public.companies` | ON | SELECT/INSERT/UPDATE; 6 policies | none | CRUD grants | `owner_id` + membership helpers | COMPANY_SCOPED | Keep; reduce overlapping policies only with truth-table regression in Phase B. |
| `public.company_members` | ON | SELECT/INSERT/UPDATE/DELETE; 4 policies | none | CRUD grants | `company_id,user_id` | COMPANY_SCOPED | Keep; verify owner/manager/member matrix on integrated candidate. |
| `public.products` | ON | full CRUD; 7 policies | none | CRUD grants | `company_id` | COMPANY_SCOPED | Keep; policy consolidation is Phase B only. |
| `public.orders` | ON | full commands across 5 policies | none | SELECT/DELETE grants; mutation paths also server-side | `company_id` | COMPANY_SCOPED | Keep; hosted guessed-ID/order-item test remains required. |
| `public.order_items` | ON | full CRUD; 4 policies | none | CRUD grants | `company_id,order_id` | COMPANY_SCOPED | Keep; nested parent/tenant test remains required. |
| `public.deliveries` | ON | one ALL/company policy | none | CRUD grants | `company_id,order_id` | COMPANY_SCOPED | Keep. |
| `public.delivery_zones` | ON | one ALL/company policy | none | CRUD grants | `company_id` | COMPANY_SCOPED | Keep. |
| `public.financial_transactions` | ON | full commands; 3 policies | none | CRUD grants | `company_id,order_id` | COMPANY_SCOPED | Keep; finance capability + RLS regression required. |
| `public.payment_methods` | ON | one ALL/company policy | none | CRUD grants | `company_id` | COMPANY_SCOPED | Keep. |
| `public.signup_leads` | ON | `Admin gerencia leads` | none | CRUD grants | admin ownership/assignment model | ADMIN_ONLY | Keep behind admin policy/server routes; retest role matrix. |
| `public.marketplace_payment_settings` | ON | none | none | CRUD grants exist | `company_id` | SERVICE_ONLY / DENY_ALL_DIRECT | Browser roles are denied by RLS despite table grants. Phase B may revoke unnecessary table grants for defense in depth. |
| `public.marketplace_payments` | ON | none | none | CRUD grants exist | `company_id,order_id` | SERVICE_ONLY / DENY_ALL_DIRECT | Same as above. Do not add permissive policy merely for Advisor. |
| `public.platform_admins` | ON | none | none | none | `user_id` | ADMIN_ONLY / SERVICE_ONLY | Keep direct table access closed; own-access RPC reviewed below. |
| `public.platform_feature_flags` | ON | none | none | none | platform admin | ADMIN_ONLY / SERVICE_ONLY | Keep direct table access closed. |
| `public.background_jobs` | ON | none | none | none | optional `company_id` | SERVICE_ONLY | Intentional deny-all; worker/RPC boundary. |
| `public.transactional_outbox` | ON | none | none | none | `company_id` | SERVICE_ONLY | Intentional deny-all. |
| `public.application_error_events` | ON | none | none | none | `company_id,actor_user_id` | SERVICE_ONLY | Intentional telemetry boundary. |
| `public.system_audit_logs` | ON | none | none | CRUD grants exist | `company_id,user_id` | SERVICE_ONLY / DENY_ALL_DIRECT | Effective direct access remains denied by RLS. Consider grant minimization in Phase B only after callers are mapped. |
| `public.integration_connections` | ON | none | none | none | `company_id` | SERVICE_ONLY | Intentional server/provider boundary. |
| `public.integration_mappings` | ON | none | none | none | `company_id` | SERVICE_ONLY | Intentional. |
| `public.integration_oauth_states` | ON | none | none | none | `company_id,user_id` | SERVICE_ONLY | Intentional OAuth-state boundary. |
| `public.event_idempotency` | ON | none | none | none | `company_id` | SERVICE_ONLY | Intentional webhook/provider boundary. |
| `public.whatsapp_connections` | ON | none | none | none | `company_id` | SERVICE_ONLY | Frozen ownership; direct browser access closed. |
| `public.whatsapp_webhook_events` | ON | none | none | none | `company_id` | SERVICE_ONLY | Frozen ownership; direct browser access closed. |

## Production Advisor: all 44 deny-all/no-policy candidates

`public.app_notifications`, `application_error_events`, `assistant_events`, `automation_rules`, `automation_runs`, `background_jobs`, `company_health_snapshots`, `crm_leads`, `customer_duplicate_candidates`, `customer_portal_events`, `customer_profiles`, `data_quality_issues`, `demo_data_registry`, `event_idempotency`, `integration_connections`, `integration_mappings`, `integration_oauth_states`, `integration_push_channels`, `integration_sync_cursors`, `integration_usage_daily`, `internal_tasks`, `marketplace_commission_rules`, `marketplace_commissions`, `marketplace_coupons`, `marketplace_oauth_states`, `marketplace_payment_settings`, `marketplace_payments`, `marketplace_stock_reservations`, `order_internal_comments`, `order_status_history`, `platform_admins`, `platform_feature_flags`, `platform_support_ticket_events`, `platform_support_tickets`, `product_analytics_events`, `product_stock_movements`, `site_template_presets`, `smart_notification_events`, `smart_notification_settings`, `system_audit_logs`, `timeline_events`, `transactional_outbox`, `whatsapp_connections`, `whatsapp_webhook_events`.

These require classification, not automatic policy creation. The critical subset above was checked against live grants. Phase B should only change a table after its actual server/browser callers are proven.

## Staging Wealth / ecosystem matrix

Staging contains the Agent 1 Wealth continuation schema. No mutation was made.

| Table family | RLS / grants | Classification | Evidence / note |
|---|---|---|---|
| `public.ecosystem_product_entitlements` | RLS ON; authenticated SELECT; own-read policy | USER_OWNED | Entitlement is readable only for the current identity. |
| `public.ecosystem_context_consents` | RLS ON; authenticated SELECT; own SELECT/UPDATE policies | USER_OWNED | Own consent read/revoke boundary. |
| `public.wealth_profiles`, `wealth_entries`, `wealth_goals` | RLS ON; own CRUD policies | USER_OWNED | Direct owner-scoped CRUD. |
| `public.wealth_documents` | RLS ON; authenticated SELECT only; `documents_read` | USER_OWNED | Mutations are mediated by RPC/storage workflow. |
| `public.wealth_debt_terms`, `wealth_bill_details`, `wealth_holdings`, `wealth_portfolios`, `wealth_portfolio_transactions`, `wealth_protection_policies`, `wealth_net_worth_snapshots`, `wealth_recurring_schedules`, `wealth_recurrence_occurrences`, planning read models | RLS ON; authenticated SELECT only | USER_OWNED | Read policies; mutation through typed RPCs where supported. |
| `ecosystem_private.wealth_*_commands`, alert/automation preference/state tables, family connections/shares | RLS ON; no anon/auth table grants; no table policies | SERVICE/RPC_ONLY | Intentional deny-all table boundary. Authenticated access occurs through narrow SECURITY DEFINER functions, not direct table access. |

Staging Advisor reports 57 RLS/no-policy tables. Twelve are `ecosystem_private.wealth_*` command/state/family tables added by the continuation chain; their no-policy state is consistent with an RPC-only design because anon/authenticated have no direct table grants.

## Storage RLS

### Production

Authenticated `storage.objects` policies exist for `financeiro`, `logos`, `product-images`, `produtos`, and `site-assets`:
- SELECT when `orcaly_private.can_manage_storage_path(name)`;
- INSERT with the same company-path check;
- UPDATE with the same company-path check;
- DELETE with the same company-path check.

The `artes` public bucket is not included in these authenticated path policies. The audited public-art route writes with service role after validating an active company slug, origin, rate, size, type and magic bytes.

### Staging Wealth

`wealth-documents` is private. Storage policies require:
- authenticated operation type;
- Wealth product access;
- owner document row/path for upload/remove/download;
- active/deleting document state;
- family-share RPC for shared download.

This matches the certified Wealth document lineage.

## SECURITY DEFINER review

### Production: `public.get_my_platform_admin_access()`

Observed:
- `SECURITY DEFINER`;
- `STABLE`;
- `search_path = pg_catalog, public`;
- `anon EXECUTE = false`;
- `authenticated EXECUTE = true`;
- reads `public.platform_admins`;
- filters strictly by `p.user_id = auth.uid()`;
- requires `p.is_active = true`;
- returns only the caller's normalized admin identity/role/status/permissions;
- `LIMIT 1`;
- used by `proxy.ts` to gate admin/support/prospector navigation before privileged service-role route handlers.

Classification: **SAFE_INTENTIONAL**.

No privilege-escalation path was found in the function body: the caller cannot supply another user ID, role or target row. Revoking authenticated EXECUTE now would break the existing proxy boundary. If architecture later removes this RPC, a Phase B migration may retire/revoke it, but there is no evidence-based need to do so merely to clear the Advisor warning.

### Staging Wealth SECURITY DEFINER functions

Read-only catalog inspection shows authenticated EXECUTE on narrow `ecosystem_private` Wealth RPCs such as document/family/automation/alerts/recurrence operations. They use an empty search path configuration and are the intentional mutation/read boundary around deny-all private tables. They remain Agent 1-owned. No Phase A change is authorized.

## Phase B candidates

No SQL is applied now.

Potential Phase B work after `MIGRATION_OWNERSHIP_RELEASED`:
1. map callers for the 44/57 no-policy tables and explicitly label intentional service-only tables;
2. revoke redundant authenticated table grants from service-only tables where proven safe;
3. consolidate overlapping legacy company RLS only with deterministic permission truth-table regression;
4. keep `get_my_platform_admin_access()` unless its proxy dependency is replaced;
5. re-run Advisors after each narrow migration rather than chasing a zero-warning vanity score.

## Result

**RLS / GRANTS: READ_ONLY_COMPLETE for Phase A.**  
No evidence supports a blanket permissive policy change. Phase B remains blocked.
