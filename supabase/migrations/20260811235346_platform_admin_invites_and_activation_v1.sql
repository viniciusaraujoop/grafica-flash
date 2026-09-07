create table public.platform_admin_invites (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  email_normalized text generated always as (lower(btrim(email))) stored,
  nome text not null,
  role text not null default 'prospector',
  area text not null default 'Comercial',
  permissions jsonb not null default '{}'::jsonb,
  observacoes text,
  token_hash text not null,
  status text not null default 'pending',
  expires_at timestamptz not null,
  invited_at timestamptz not null default now(),
  claimed_at timestamptz,
  activation_claim_id uuid,
  activated_at timestamptz,
  revoked_at timestamptz,
  user_id uuid references auth.users(id) on delete set null,
  platform_admin_id uuid references public.platform_admins(id) on delete set null,
  created_by_admin_id uuid references public.platform_admins(id) on delete set null,
  created_by_email text not null,
  last_token_rotated_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint platform_admin_invites_email_check
    check (
      length(btrim(email)) between 5 and 320
      and position('@' in btrim(email)) > 1
    ),
  constraint platform_admin_invites_nome_check
    check (length(btrim(nome)) between 2 and 160),
  constraint platform_admin_invites_role_check
    check (lower(role) = 'prospector'),
  constraint platform_admin_invites_area_check
    check (length(btrim(area)) between 2 and 80),
  constraint platform_admin_invites_permissions_object_check
    check (jsonb_typeof(permissions) = 'object'),
  constraint platform_admin_invites_observacoes_check
    check (observacoes is null or length(observacoes) <= 500),
  constraint platform_admin_invites_token_hash_check
    check (token_hash ~ '^[0-9a-f]{64}$'),
  constraint platform_admin_invites_status_check
    check (status in ('pending', 'activating', 'activated', 'revoked', 'expired')),
  constraint platform_admin_invites_expiry_check
    check (expires_at > invited_at),
  constraint platform_admin_invites_state_check
    check (
      (
        status = 'pending'
        and claimed_at is null
        and activation_claim_id is null
        and activated_at is null
        and revoked_at is null
        and user_id is null
        and platform_admin_id is null
      )
      or
      (
        status = 'activating'
        and claimed_at is not null
        and activation_claim_id is not null
        and activated_at is null
        and revoked_at is null
        and user_id is null
        and platform_admin_id is null
      )
      or
      (
        status = 'activated'
        and claimed_at is null
        and activation_claim_id is null
        and activated_at is not null
        and revoked_at is null
        and user_id is not null
        and platform_admin_id is not null
      )
      or
      (
        status = 'revoked'
        and claimed_at is null
        and activation_claim_id is null
        and activated_at is null
        and revoked_at is not null
        and user_id is null
        and platform_admin_id is null
      )
      or
      (
        status = 'expired'
        and claimed_at is null
        and activation_claim_id is null
        and activated_at is null
        and revoked_at is null
        and user_id is null
        and platform_admin_id is null
      )
    )
);

create unique index platform_admin_invites_token_hash_uq
  on public.platform_admin_invites(token_hash);

create unique index platform_admin_invites_live_email_uq
  on public.platform_admin_invites(email_normalized)
  where status in ('pending', 'activating');

create unique index platform_admin_invites_activated_user_uq
  on public.platform_admin_invites(user_id)
  where status = 'activated' and user_id is not null;

create unique index platform_admin_invites_activated_admin_uq
  on public.platform_admin_invites(platform_admin_id)
  where status = 'activated' and platform_admin_id is not null;

create index platform_admin_invites_status_expires_idx
  on public.platform_admin_invites(status, expires_at);

create index platform_admin_invites_created_by_idx
  on public.platform_admin_invites(created_by_admin_id, created_at desc);

create trigger platform_admin_invites_set_updated_at
before update on public.platform_admin_invites
for each row
execute function public.set_updated_at();

alter table public.platform_admin_invites enable row level security;

create policy "platform admin invites deny direct client access"
on public.platform_admin_invites
for all
to anon, authenticated
using (false)
with check (false);

revoke all on table public.platform_admin_invites from anon, authenticated, service_role;
grant select, insert, update on table public.platform_admin_invites to service_role;

create or replace function public.claim_platform_admin_invite(
  p_token_hash text,
  p_claim_id uuid
)
returns setof public.platform_admin_invites
language plpgsql
security invoker
set search_path to 'pg_catalog', 'public'
as $$
begin
  if p_claim_id is null then
    return;
  end if;

  update public.platform_admin_invites
  set
    status = case
      when expires_at <= now() then 'expired'
      else 'pending'
    end,
    claimed_at = null,
    activation_claim_id = null
  where status = 'activating'
    and claimed_at < now() - interval '10 minutes';

  update public.platform_admin_invites
  set status = 'expired'
  where status = 'pending'
    and expires_at <= now();

  return query
  update public.platform_admin_invites
  set
    status = 'activating',
    claimed_at = now(),
    activation_claim_id = p_claim_id
  where token_hash = lower(p_token_hash)
    and status = 'pending'
    and expires_at > now()
  returning *;
end;
$$;

create or replace function public.release_platform_admin_invite_claim(
  p_claim_id uuid
)
returns boolean
language plpgsql
security invoker
set search_path to 'pg_catalog', 'public'
as $$
declare
  v_updated integer := 0;
begin
  update public.platform_admin_invites
  set
    status = case
      when expires_at <= now() then 'expired'
      else 'pending'
    end,
    claimed_at = null,
    activation_claim_id = null
  where status = 'activating'
    and activation_claim_id = p_claim_id;

  get diagnostics v_updated = row_count;
  return v_updated = 1;
end;
$$;

create or replace function public.complete_platform_admin_invite(
  p_claim_id uuid,
  p_user_id uuid
)
returns setof public.platform_admins
language plpgsql
security invoker
set search_path to 'pg_catalog', 'public', 'auth'
as $$
declare
  v_invite public.platform_admin_invites%rowtype;
  v_admin public.platform_admins%rowtype;
begin
  if p_claim_id is null or p_user_id is null then
    raise exception 'invalid_activation_input';
  end if;

  select *
  into v_invite
  from public.platform_admin_invites
  where status = 'activating'
    and activation_claim_id = p_claim_id
    and expires_at > now()
  for update;

  if not found then
    raise exception 'invite_not_claimed';
  end if;

  if lower(v_invite.role) <> 'prospector' then
    raise exception 'invalid_invite_role';
  end if;

  if exists (
    select 1
    from public.platform_admins p
    where lower(p.email) = v_invite.email_normalized
  ) then
    raise exception 'platform_admin_email_exists';
  end if;

  insert into public.platform_admins (
    user_id,
    email,
    nome,
    role,
    is_active,
    permissions,
    area,
    observacoes,
    created_by,
    must_change_password,
    updated_at
  )
  values (
    p_user_id,
    v_invite.email_normalized,
    btrim(v_invite.nome),
    'prospector',
    true,
    v_invite.permissions,
    coalesce(nullif(btrim(v_invite.area), ''), 'Comercial'),
    v_invite.observacoes,
    v_invite.created_by_email,
    false,
    now()
  )
  returning *
  into v_admin;

  update public.platform_admin_invites
  set
    status = 'activated',
    activated_at = now(),
    claimed_at = null,
    activation_claim_id = null,
    user_id = p_user_id,
    platform_admin_id = v_admin.id
  where id = v_invite.id
    and status = 'activating'
    and activation_claim_id = p_claim_id;

  if not found then
    raise exception 'invite_activation_race';
  end if;

  return next v_admin;
  return;
end;
$$;

revoke all on function public.claim_platform_admin_invite(text, uuid)
  from public, anon, authenticated;
revoke all on function public.release_platform_admin_invite_claim(uuid)
  from public, anon, authenticated;
revoke all on function public.complete_platform_admin_invite(uuid, uuid)
  from public, anon, authenticated;

grant execute on function public.claim_platform_admin_invite(text, uuid)
  to service_role;
grant execute on function public.release_platform_admin_invite_claim(uuid)
  to service_role;
grant execute on function public.complete_platform_admin_invite(uuid, uuid)
  to service_role;

comment on table public.platform_admin_invites is
  'Convites internos seguros para membros da plataforma. Tokens em claro nunca sao persistidos.';
comment on column public.platform_admin_invites.token_hash is
  'SHA-256 hexadecimal do token de ativacao. O token em claro existe apenas no link devolvido ao Owner.';
comment on function public.claim_platform_admin_invite(text, uuid) is
  'Reivindica atomicamente um convite pendente para evitar ativacoes concorrentes.';
comment on function public.complete_platform_admin_invite(uuid, uuid) is
  'Conclui atomicamente no banco a criacao de um Prospector ja criado no Supabase Auth.';
