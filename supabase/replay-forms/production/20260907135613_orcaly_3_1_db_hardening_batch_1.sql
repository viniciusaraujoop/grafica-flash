-- HISTORICAL EXECUTION RECORD: supabase/provenance/ledger/production/20260907135613_orcaly_3_1_db_hardening_batch_1/ledger.sql (non-executable evidence).
-- FRESH-ENVIRONMENT REPLAY FORM: VERBATIM_LEDGER.
-- Production must NEVER re-execute this historical identity.
-- Prepared only; frontier/fixed-point certification is pending.
create index if not exists idx_platform_support_ticket_events_admin_id
  on public.platform_support_ticket_events (admin_id);

create index if not exists idx_platform_support_tickets_assignee_admin_id
  on public.platform_support_tickets (assignee_admin_id);

drop index if exists public.idx_plan_payments_admin_company_created;
