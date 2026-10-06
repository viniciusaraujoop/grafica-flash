-- HISTORICAL EXECUTION RECORD: supabase/provenance/ledger/production/20260812221532_founder_final_regression_hardening_v1/ledger.sql (non-executable evidence).
-- FRESH-ENVIRONMENT REPLAY FORM: VERBATIM_LEDGER.
-- Production must NEVER re-execute this historical identity.
-- Prepared only; frontier/fixed-point certification is pending.
drop index if exists public.idx_signup_lead_followups_sales_lead_created;

create index if not exists founder_invites_revoked_by_admin_idx
  on public.founder_invites(revoked_by_admin_id, revoked_at desc)
  where revoked_by_admin_id is not null;
