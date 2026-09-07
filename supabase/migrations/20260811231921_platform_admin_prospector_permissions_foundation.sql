-- Orçaly — FASE 2
-- Fundação de autorização administrativa para o papel Prospector.
-- A autoridade principal continua sendo public.platform_admins.

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.platform_admins'::regclass
      and conname = 'platform_admins_role_check_v2'
  ) then
    alter table public.platform_admins
      add constraint platform_admins_role_check_v2
      check (
        lower(role) in (
          'owner',
          'super_admin',
          'admin',
          'finance',
          'support',
          'suporte',
          'prospector'
        )
      );
  end if;
end
$$;

create or replace function public.get_my_platform_admin_access()
returns table(
  admin_id uuid,
  admin_email text,
  admin_role text,
  admin_is_active boolean,
  must_change_password boolean,
  permissions jsonb
)
language sql
stable
security definer
set search_path to 'pg_catalog', 'public'
as $$
  select
    p.id,
    lower(p.email),
    case
      when lower(p.role) in ('owner', 'super_admin') then 'owner'
      when lower(p.role) in ('support', 'suporte') then 'support'
      when lower(p.role) = 'finance' then 'finance'
      when lower(p.role) = 'prospector' then 'prospector'
      when lower(p.role) = 'admin' then 'admin'
      else null
    end,
    p.is_active,
    p.must_change_password,
    coalesce(p.permissions, '{}'::jsonb)
  from public.platform_admins p
  where p.user_id = auth.uid()
    and p.is_active = true
    and lower(p.role) in (
      'owner',
      'super_admin',
      'admin',
      'finance',
      'support',
      'suporte',
      'prospector'
    )
  order by
    case
      when lower(p.role) in ('owner', 'super_admin') then 0
      when lower(p.role) = 'admin' then 1
      when lower(p.role) = 'finance' then 2
      when lower(p.role) in ('support', 'suporte') then 3
      when lower(p.role) = 'prospector' then 4
      else 9
    end,
    p.created_at
  limit 1;
$$;

revoke all on function public.get_my_platform_admin_access() from public, anon;
grant execute on function public.get_my_platform_admin_access()
  to authenticated, service_role;

create or replace function orcaly_private.is_orcaly_admin()
returns boolean
language sql
stable
security definer
set search_path to ''
as $$
  select exists (
    select 1
    from public.platform_admins p
    where p.is_active = true
      and p.user_id = auth.uid()
      and lower(p.role) in (
        'owner',
        'super_admin',
        'admin',
        'support',
        'suporte'
      )
  );
$$;

update public.admin_users au
set
  ativo = false,
  updated_at = now()
where au.ativo = true
  and exists (
    select 1
    from public.platform_admins p
    where lower(p.email) = lower(au.email)
      and p.is_active = false
  );
