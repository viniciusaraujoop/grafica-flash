-- ORCALY Platform Evolution 3.0
-- Narrow server-only access to the temporary Vercel Preview share token used by Auth QA.
-- The token itself is stored encrypted in Supabase Vault and is intentionally not versioned.

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
