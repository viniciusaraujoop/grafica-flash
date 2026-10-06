-- HISTORICAL EXECUTION RECORD: supabase/provenance/ledger/production/20260830211222_platform_evolution_3_qa_vault/ledger.sql (non-executable evidence).
-- FRESH-ENVIRONMENT REPLAY FORM: VERBATIM_LEDGER.
-- Production must NEVER re-execute this historical identity.
-- Prepared only; frontier/fixed-point certification is pending.
create or replace function public.get_platform_qa_vercel_share()
returns text
language sql
security definer
set search_path = vault, pg_catalog
as $$
  select decrypted_secret
  from vault.decrypted_secrets
  where name = 'orcaly.platform_evolution.qa_vercel_share'
  order by updated_at desc
  limit 1
$$;

revoke all on function public.get_platform_qa_vercel_share() from public;
revoke all on function public.get_platform_qa_vercel_share() from anon;
revoke all on function public.get_platform_qa_vercel_share() from authenticated;
grant execute on function public.get_platform_qa_vercel_share() to service_role;

comment on function public.get_platform_qa_vercel_share() is
  'Platform Evolution Auth QA only. Returns the encrypted-at-rest temporary Vercel Preview share credential to service_role callers.';
