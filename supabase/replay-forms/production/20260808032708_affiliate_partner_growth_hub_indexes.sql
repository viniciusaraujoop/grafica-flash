-- HISTORICAL EXECUTION RECORD: supabase/provenance/ledger/production/20260808032708_affiliate_partner_growth_hub_indexes/ledger.sql (non-executable evidence).
-- FRESH-ENVIRONMENT REPLAY FORM: VERBATIM_LEDGER.
-- Production must NEVER re-execute this historical identity.
-- Prepared only; frontier/fixed-point certification is pending.
create index if not exists affiliate_tasks_lead_idx
  on public.affiliate_tasks(lead_id)
  where lead_id is not null;

create index if not exists affiliate_activity_events_lead_idx
  on public.affiliate_activity_events(lead_id)
  where lead_id is not null;
