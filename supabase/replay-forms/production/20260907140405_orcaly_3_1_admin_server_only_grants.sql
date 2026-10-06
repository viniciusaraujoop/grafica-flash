-- HISTORICAL EXECUTION RECORD: supabase/provenance/ledger/production/20260907140405_orcaly_3_1_admin_server_only_grants/ledger.sql (non-executable evidence).
-- FRESH-ENVIRONMENT REPLAY FORM: VERBATIM_LEDGER.
-- Production must NEVER re-execute this historical identity.
-- Prepared only; frontier/fixed-point certification is pending.
revoke all privileges on table public.platform_feature_flags from anon, authenticated;
revoke all privileges on table public.platform_support_tickets from anon, authenticated;
revoke all privileges on table public.platform_support_ticket_events from anon, authenticated;

grant select, insert, update, delete on table public.platform_feature_flags to service_role;
grant select, insert, update, delete on table public.platform_support_tickets to service_role;
grant select, insert, update, delete on table public.platform_support_ticket_events to service_role;
