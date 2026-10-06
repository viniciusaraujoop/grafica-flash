-- HISTORICAL EXECUTION RECORD: supabase/provenance/ledger/production/20260729213924_harden_platform_admin_owner_access_v1/ledger.sql (non-executable evidence).
-- FRESH-ENVIRONMENT REPLAY FORM: NEUTRALIZED.
-- Production must NEVER re-execute this historical identity.
-- Prepared only; frontier/fixed-point certification is pending.
begin;

alter table public.platform_admins enable row level security;
revoke all on table public.platform_admins from anon, authenticated;

drop index if exists public.platform_admins_single_active_owner_uidx;
create unique index platform_admins_single_active_owner_uidx
  on public.platform_admins ((1))
  where is_active = true
    and lower(role) = 'owner';

create or replace function public.get_my_platform_admin_access()
returns table (
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
set search_path = pg_catalog, public
as $$
  select
    p.id,
    lower(p.email),
    case
      when lower(p.role) in ('owner', 'super_admin') then 'owner'
      when lower(p.role) in ('support', 'suporte') then 'support'
      when lower(p.role) = 'finance' then 'finance'
      else 'admin'
    end,
    p.is_active,
    p.must_change_password,
    coalesce(p.permissions, '{}'::jsonb)
  from public.platform_admins p
  where p.user_id = auth.uid()
    and p.is_active = true
  order by
    case
      when lower(p.role) in ('owner', 'super_admin') then 0
      when lower(p.role) = 'admin' then 1
      when lower(p.role) = 'finance' then 2
      else 3
    end,
    p.created_at
  limit 1;
$$;

revoke all on function public.get_my_platform_admin_access()
  from public, anon;
grant execute on function public.get_my_platform_admin_access()
  to authenticated;

comment on function public.get_my_platform_admin_access() is
  'Retorna somente o acesso administrativo ativo do usuario autenticado; usada pelo proxy antes de renderizar /admin.';

commit;
