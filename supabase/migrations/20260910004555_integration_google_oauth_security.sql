-- Harden the shared OAuth foundation without changing provider rollout.
-- PKCE verifiers live in Vault; OAuth state remains one-time and tenant-bound.

alter table public.integration_oauth_states
  add column if not exists requested_scopes text[] not null default '{}'::text[],
  add column if not exists pkce_reference uuid;

alter table public.integration_connections
  add column if not exists refresh_locked_at timestamptz,
  add column if not exists refresh_lock_id uuid;

create index if not exists idx_integration_oauth_states_unconsumed
  on public.integration_oauth_states(expires_at)
  where consumed_at is null;

create or replace function public.integration_oauth_pkce_store(
  p_company_id uuid,
  p_state_id uuid,
  p_verifier text
) returns uuid
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  v_secret_id uuid;
begin
  if p_verifier is null or length(p_verifier) < 43 then
    raise exception 'invalid PKCE verifier';
  end if;

  perform 1
  from public.integration_oauth_states s
  where s.id = p_state_id
    and s.company_id = p_company_id
    and s.consumed_at is null
    and s.expires_at > now()
  for update;

  if not found then
    raise exception 'oauth state not available';
  end if;

  select vault.create_secret(
    p_verifier,
    'orcaly.oauth.pkce.' || p_state_id::text,
    'Orçaly integration OAuth PKCE verifier'
  ) into v_secret_id;

  update public.integration_oauth_states
  set pkce_reference = v_secret_id
  where id = p_state_id and company_id = p_company_id;

  return v_secret_id;
end;
$$;

create or replace function public.integration_oauth_state_consume(
  p_company_id uuid,
  p_user_id uuid,
  p_provider text,
  p_nonce_hash text
) returns table (
  state_id uuid,
  requested_scopes text[],
  pkce_verifier text
)
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  v_state public.integration_oauth_states%rowtype;
  v_verifier text;
begin
  select s.* into v_state
  from public.integration_oauth_states s
  where s.company_id = p_company_id
    and s.user_id = p_user_id
    and s.provider = p_provider
    and s.nonce_hash = p_nonce_hash
    and s.consumed_at is null
    and s.expires_at > now()
  for update;

  if not found then
    return;
  end if;

  if v_state.pkce_reference is null then
    raise exception 'oauth PKCE verifier missing';
  end if;

  select ds.decrypted_secret
    into v_verifier
  from vault.decrypted_secrets ds
  where ds.id = v_state.pkce_reference;

  if v_verifier is null then
    raise exception 'oauth PKCE verifier unavailable';
  end if;

  update public.integration_oauth_states
  set consumed_at = now(), pkce_reference = null
  where id = v_state.id;

  delete from vault.secrets where id = v_state.pkce_reference;

  state_id := v_state.id;
  requested_scopes := v_state.requested_scopes;
  pkce_verifier := v_verifier;
  return next;
end;
$$;

create or replace function public.integration_refresh_lock(
  p_company_id uuid,
  p_connection_id uuid,
  p_lock_id uuid,
  p_ttl_seconds integer default 45
) returns boolean
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  v_acquired boolean := false;
  v_ttl interval;
begin
  v_ttl := make_interval(secs => greatest(5, least(coalesce(p_ttl_seconds, 45), 120)));

  update public.integration_connections c
  set refresh_lock_id = p_lock_id,
      refresh_locked_at = now(),
      updated_at = now()
  where c.id = p_connection_id
    and c.company_id = p_company_id
    and (
      c.refresh_lock_id is null
      or c.refresh_locked_at is null
      or c.refresh_locked_at < now() - v_ttl
    );

  v_acquired := found;
  return v_acquired;
end;
$$;

create or replace function public.integration_refresh_unlock(
  p_company_id uuid,
  p_connection_id uuid,
  p_lock_id uuid
) returns void
language plpgsql
security definer
set search_path = pg_catalog
as $$
begin
  update public.integration_connections c
  set refresh_lock_id = null,
      refresh_locked_at = null,
      updated_at = now()
  where c.id = p_connection_id
    and c.company_id = p_company_id
    and c.refresh_lock_id = p_lock_id;
end;
$$;

revoke all on function public.integration_oauth_pkce_store(uuid, uuid, text) from public, anon, authenticated;
revoke all on function public.integration_oauth_state_consume(uuid, uuid, text, text) from public, anon, authenticated;
revoke all on function public.integration_refresh_lock(uuid, uuid, uuid, integer) from public, anon, authenticated;
revoke all on function public.integration_refresh_unlock(uuid, uuid, uuid) from public, anon, authenticated;
grant execute on function public.integration_oauth_pkce_store(uuid, uuid, text) to service_role;
grant execute on function public.integration_oauth_state_consume(uuid, uuid, text, text) to service_role;
grant execute on function public.integration_refresh_lock(uuid, uuid, uuid, integer) to service_role;
grant execute on function public.integration_refresh_unlock(uuid, uuid, uuid) to service_role;
