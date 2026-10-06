-- Platform Evolution 3.0
-- Remove recursive admin_users policies without weakening RLS.

create or replace function orcaly_private.is_orcaly_super_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.platform_admins p
    where p.is_active = true
      and p.user_id = auth.uid()
      and lower(p.role) in ('owner', 'super_admin')
  );
$$;

revoke all on function orcaly_private.is_orcaly_super_admin() from public;
grant execute on function orcaly_private.is_orcaly_super_admin() to authenticated;

drop policy if exists "Admins veem admin users" on public.admin_users;
drop policy if exists "Super admin gerencia admin users" on public.admin_users;

create policy "Admins veem admin users"
on public.admin_users
for select
to authenticated
using (orcaly_private.is_orcaly_admin());

create policy "Super admin gerencia admin users"
on public.admin_users
for all
to authenticated
using (orcaly_private.is_orcaly_super_admin())
with check (orcaly_private.is_orcaly_super_admin());
