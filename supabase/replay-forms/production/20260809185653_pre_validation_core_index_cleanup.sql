-- HISTORICAL EXECUTION RECORD: supabase/provenance/ledger/production/20260809185653_pre_validation_core_index_cleanup/ledger.sql (non-executable evidence).
-- FRESH-ENVIRONMENT REPLAY FORM: VERBATIM_LEDGER.
-- Production must NEVER re-execute this historical identity.
-- Prepared only; frontier/fixed-point certification is pending.
-- Remove apenas indices comprovadamente identicos, preservando os vinculados a constraints.
drop index if exists public.idx_admin_audit_logs_created_at;
drop index if exists public.art_approval_requests_token_unique;
drop index if exists public.idx_business_hours_company_id;
drop index if exists public.idx_delivery_zones_company_id;
drop index if exists public.idx_financial_transactions_competencia;
drop index if exists public.idx_marketplace_payments_order;
drop index if exists public.idx_order_items_order_id;
drop index if exists public.idx_orders_company_created_at;
drop index if exists public.idx_plan_payments_company_created;
drop index if exists public.idx_plan_payments_preapproval_id;
drop index if exists public.idx_products_marketplace_categoria;
drop index if exists public.idx_proposals_company_score;
drop index if exists public.idx_proposals_token_unique;
drop index if exists public.idx_quote_templates_company_tipo;
drop index if exists public.idx_whatsapp_message_logs_company_id;
drop index if exists public.idx_whatsapp_message_logs_order_id;

-- FKs dos fluxos operacionais, financeiros, pagamento e producao.
create index if not exists idx_deliveries_assigned_driver_id
  on public.deliveries (assigned_driver_id);
create index if not exists idx_deliveries_delivery_zone_id
  on public.deliveries (delivery_zone_id);
create index if not exists idx_deliveries_payment_method_id
  on public.deliveries (payment_method_id);

create index if not exists idx_delivery_assignments_created_by
  on public.delivery_assignments (created_by);
create index if not exists idx_delivery_assignments_driver_id_fk
  on public.delivery_assignments (driver_id);
create index if not exists idx_delivery_assignments_order_id_fk
  on public.delivery_assignments (order_id);

create index if not exists idx_financial_transactions_account_id
  on public.financial_transactions (account_id);
create index if not exists idx_financial_transactions_category_id
  on public.financial_transactions (category_id);
create index if not exists idx_financial_transactions_created_by
  on public.financial_transactions (created_by);

create index if not exists idx_marketplace_commissions_order_id
  on public.marketplace_commissions (order_id);
create index if not exists idx_order_payments_payment_method_id
  on public.order_payments (payment_method_id);

create index if not exists idx_orders_delivery_zone_id
  on public.orders (delivery_zone_id);
create index if not exists idx_orders_marketplace_payment_id
  on public.orders (marketplace_payment_id);
create index if not exists idx_orders_original_order_id
  on public.orders (original_order_id);
create index if not exists idx_orders_payment_method_id
  on public.orders (payment_method_id);

create index if not exists idx_production_orders_order_id
  on public.production_orders (order_id);
create index if not exists idx_production_steps_assigned_to
  on public.production_steps (assigned_to);
create index if not exists idx_production_steps_company_id
  on public.production_steps (company_id);
create index if not exists idx_production_steps_completed_by
  on public.production_steps (completed_by);
