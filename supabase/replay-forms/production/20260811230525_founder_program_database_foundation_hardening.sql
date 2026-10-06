-- HISTORICAL EXECUTION RECORD: supabase/provenance/ledger/production/20260811230525_founder_program_database_foundation_hardening/ledger.sql (non-executable evidence).
-- FRESH-ENVIRONMENT REPLAY FORM: VERBATIM_LEDGER.
-- Production must NEVER re-execute this historical identity.
-- Prepared only; frontier/fixed-point certification is pending.
-- Orçaly — Programa Clientes Fundadores
-- FASE 1 hardening: founder_invites preserva histórico e não aceita DELETE via service_role.

revoke all on table public.founder_invites from service_role;
grant select, insert, update on table public.founder_invites to service_role;

