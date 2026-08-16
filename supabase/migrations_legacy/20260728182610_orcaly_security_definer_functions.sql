-- ORCALY_SECURITY_DEFINER_FUNCTIONS_1D3
-- Move funcoes privilegiadas para schema privado e remove sua exposicao RPC publica.

create schema if not exists orcaly_private;

alter function public.is_orcaly_admin()
  set schema orcaly_private;
alter function public.can_manage_company(uuid)
  set schema orcaly_private;
alter function public.is_company_member(uuid)
  set schema orcaly_private;
alter function public.is_company_owner(uuid)
  set schema orcaly_private;
alter function public.my_company_role(uuid)
  set schema orcaly_private;
alter function public.orcaly_user_has_company_access(uuid)
  set schema orcaly_private;
alter function public.check_company_member_limit()
  set schema orcaly_private;
alter function public.create_default_site_for_company(uuid)
  set schema orcaly_private;

alter function orcaly_private.is_orcaly_admin()
  set search_path = '';
alter function orcaly_private.is_company_member(uuid)
  set search_path = '';
alter function orcaly_private.is_company_owner(uuid)
  set search_path = '';
alter function orcaly_private.my_company_role(uuid)
  set search_path = '';
alter function orcaly_private.orcaly_user_has_company_access(uuid)
  set search_path = '';
alter function orcaly_private.check_company_member_limit()
  set search_path = '';
alter function orcaly_private.create_default_site_for_company(uuid)
  set search_path = '';

create or replace function orcaly_private.can_manage_company(p_company_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.companies c
    where c.id = p_company_id
      and (c.owner_id = auth.uid() or c.tester_id = auth.uid())
  )
  or exists (
    select 1
    from public.company_members cm
    where cm.company_id = p_company_id
      and cm.user_id = auth.uid()
      and cm.status = 'ativo'
  )
  or orcaly_private.is_orcaly_admin();
$$;

revoke all on function orcaly_private.can_manage_company(uuid)
  from public, anon, authenticated, service_role;
revoke all on function orcaly_private.is_company_member(uuid)
  from public, anon, authenticated, service_role;
revoke all on function orcaly_private.is_company_owner(uuid)
  from public, anon, authenticated, service_role;
revoke all on function orcaly_private.is_orcaly_admin()
  from public, anon, authenticated, service_role;
revoke all on function orcaly_private.my_company_role(uuid)
  from public, anon, authenticated, service_role;
revoke all on function orcaly_private.orcaly_user_has_company_access(uuid)
  from public, anon, authenticated, service_role;
revoke all on function orcaly_private.check_company_member_limit()
  from public, anon, authenticated, service_role;
revoke all on function orcaly_private.create_default_site_for_company(uuid)
  from public, anon, authenticated, service_role;

grant execute on function orcaly_private.can_manage_company(uuid)
  to authenticated, service_role;
grant execute on function orcaly_private.is_company_member(uuid)
  to authenticated, service_role;
grant execute on function orcaly_private.is_company_owner(uuid)
  to authenticated, service_role;
grant execute on function orcaly_private.is_orcaly_admin()
  to authenticated, service_role;
grant execute on function orcaly_private.my_company_role(uuid)
  to authenticated, service_role;
grant execute on function orcaly_private.orcaly_user_has_company_access(uuid)
  to authenticated, service_role;
grant execute on function orcaly_private.check_company_member_limit()
  to authenticated, service_role;
grant execute on function orcaly_private.create_default_site_for_company(uuid)
  to service_role;

alter default privileges for role postgres in schema public
  revoke execute on functions from public;
alter default privileges for role postgres in schema orcaly_private
  revoke execute on functions from public;
