-- HISTORICAL EXECUTION RECORD: supabase/provenance/ledger/production/20260809185046_align_order_status_history_with_api/ledger.sql (non-executable evidence).
-- FRESH-ENVIRONMENT REPLAY FORM: VERBATIM_LEDGER.
-- Production must NEVER re-execute this historical identity.
-- Prepared only; frontier/fixed-point certification is pending.
alter table public.order_status_history
  add column if not exists changed_by_email text;

comment on column public.order_status_history.changed_by_email is
  'E-mail do usuário que alterou o status, quando a mudança é feita pelo painel.';
