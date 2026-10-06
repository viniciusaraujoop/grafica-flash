-- HISTORICAL EXECUTION RECORD: supabase/provenance/ledger/production/20260908222043_orcaly_3_1_customer_data_quality_certification/ledger.sql (non-executable evidence).
-- FRESH-ENVIRONMENT REPLAY FORM: VERBATIM_LEDGER.
-- Production must NEVER re-execute this historical identity.
-- Prepared only; frontier/fixed-point certification is pending.
alter function public.orcaly_normalize_email(text)
  set search_path = '';

alter function public.orcaly_normalize_phone_br(text)
  set search_path = '';

alter function public.orcaly_normalize_name(text)
  set search_path = '';

create index if not exists customer_duplicate_candidates_left_idx
  on public.customer_duplicate_candidates (left_customer_id);

create index if not exists timeline_events_customer_profile_id_idx
  on public.timeline_events (customer_profile_id);
