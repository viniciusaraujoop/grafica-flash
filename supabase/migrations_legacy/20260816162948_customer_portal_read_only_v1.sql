-- ORCALY_CUSTOMER_PORTAL_READ_ONLY_V1
-- Acesso aditivo e server-only para o Portal do Cliente.

begin;

do $$
begin
  if to_regclass('public.feature_flags') is null
    or to_regclass('public.company_feature_flags') is null
    or to_regclass('public.operational_events') is null then
    raise exception
      'A migration operational_foundation_v1 deve ser aplicada antes de customer_portal_read_only_v1.';
  end if;

  if to_regprocedure('orcaly_private.touch_updated_at()') is null then
    raise exception
      'A funcao orcaly_private.touch_updated_at() da Fase 1 nao foi encontrada.';
  end if;
end;
$$;

create table public.customer_portal_access (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null
    references public.companies(id) on delete cascade,
  entity_type text not null,
  entity_id uuid not null,
  token_hash text not null,
  status text not null default 'active',
  expires_at timestamptz,
  revoked_at timestamptz,
  last_accessed_at timestamptz,
  access_count bigint not null default 0,
  created_by uuid references auth.users(id) on delete set null,
  revoked_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint customer_portal_access_entity_type_check
    check (entity_type in ('order', 'quote', 'service_order', 'appointment')),
  constraint customer_portal_access_token_hash_check
    check (token_hash ~ '^[0-9a-f]{64}$'),
  constraint customer_portal_access_status_check
    check (status in ('active', 'revoked')),
  constraint customer_portal_access_count_check
    check (access_count >= 0),
  constraint customer_portal_access_revocation_check
    check (
      (status = 'active' and revoked_at is null)
      or (status = 'revoked' and revoked_at is not null)
    )
);

create unique index customer_portal_access_token_hash_uidx
  on public.customer_portal_access(token_hash);

create unique index customer_portal_access_active_entity_uidx
  on public.customer_portal_access(company_id, entity_type, entity_id)
  where status = 'active' and revoked_at is null;

create index customer_portal_access_lookup_idx
  on public.customer_portal_access(token_hash, status, expires_at);

create index customer_portal_access_company_entity_idx
  on public.customer_portal_access(
    company_id,
    entity_type,
    entity_id,
    created_at desc
  );

create trigger customer_portal_access_touch_updated_at
before update on public.customer_portal_access
for each row execute function orcaly_private.touch_updated_at();

alter table public.customer_portal_access enable row level security;

create policy customer_portal_access_no_direct_client_access
on public.customer_portal_access
for all
to anon, authenticated
using (false)
with check (false);

revoke all privileges on table public.customer_portal_access
  from public, anon, authenticated;

grant select, insert, update, delete
  on table public.customer_portal_access
  to service_role;

create or replace function public.orcaly_rotate_customer_portal_access(
  p_company_id uuid,
  p_entity_type text,
  p_entity_id uuid,
  p_token_hash text,
  p_expires_at timestamptz,
  p_created_by uuid
)
returns public.customer_portal_access
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_access public.customer_portal_access;
begin
  if p_entity_type <> 'order' then
    raise exception 'unsupported portal entity type';
  end if;

  if p_token_hash is null
    or p_token_hash !~ '^[0-9a-f]{64}$' then
    raise exception 'invalid portal token hash';
  end if;

  if p_expires_at is not null
    and p_expires_at <= clock_timestamp() then
    raise exception 'portal access expiry must be in the future';
  end if;

  if not exists (
    select 1
    from public.orders as orders
    where orders.id = p_entity_id
      and orders.company_id = p_company_id
  ) then
    raise exception 'portal entity not found';
  end if;

  update public.customer_portal_access
  set status = 'revoked',
      revoked_at = clock_timestamp(),
      revoked_by = p_created_by
  where company_id = p_company_id
    and entity_type = p_entity_type
    and entity_id = p_entity_id
    and status = 'active'
    and revoked_at is null;

  insert into public.customer_portal_access (
    company_id,
    entity_type,
    entity_id,
    token_hash,
    status,
    expires_at,
    created_by
  )
  values (
    p_company_id,
    p_entity_type,
    p_entity_id,
    p_token_hash,
    'active',
    p_expires_at,
    p_created_by
  )
  returning * into v_access;

  return v_access;
end;
$$;

revoke all on function public.orcaly_rotate_customer_portal_access(
  uuid,
  text,
  uuid,
  text,
  timestamptz,
  uuid
) from public, anon, authenticated;

grant execute on function public.orcaly_rotate_customer_portal_access(
  uuid,
  text,
  uuid,
  text,
  timestamptz,
  uuid
) to service_role;

create or replace function public.orcaly_record_customer_portal_access(
  p_access_id uuid,
  p_token_hash text
)
returns boolean
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_updated_id uuid;
begin
  update public.customer_portal_access
  set last_accessed_at = clock_timestamp(),
      access_count = access_count + 1
  where id = p_access_id
    and token_hash = p_token_hash
    and status = 'active'
    and revoked_at is null
    and (expires_at is null or expires_at > clock_timestamp())
    and (
      last_accessed_at is null
      or last_accessed_at < clock_timestamp() - interval '15 minutes'
    )
  returning id into v_updated_id;

  return v_updated_id is not null;
end;
$$;

revoke all on function public.orcaly_record_customer_portal_access(uuid, text)
  from public, anon, authenticated;

grant execute on function public.orcaly_record_customer_portal_access(uuid, text)
  to service_role;

comment on table public.customer_portal_access is
  'Acessos revogaveis do Portal do Cliente. Tokens puros nunca sao persistidos.';

comment on column public.customer_portal_access.entity_id is
  'Identificador da entidade, sempre validado junto com company_id e entity_type no servidor.';

comment on column public.customer_portal_access.token_hash is
  'SHA-256 hexadecimal de token aleatorio de 32 bytes com separacao de dominio.';

commit;
