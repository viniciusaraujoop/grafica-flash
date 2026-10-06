-- Orçaly Integration Platform foundation.
-- Additive, server-only and intentionally reuses background_jobs,
-- event_idempotency, transactional_outbox, timeline_events and automation tables.

create table if not exists public.integration_connections (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  provider text not null check (provider ~ '^[a-z0-9_]{2,80}$'),
  status text not null default 'NOT_CONFIGURED' check (status in (
    'NOT_CONFIGURED','CONNECTING','CONNECTED','DEGRADED','ERROR',
    'REAUTH_REQUIRED','ACCESS_REQUIRED','DISCONNECTED'
  )),
  display_name text,
  external_account_id text,
  external_account_name text,
  capabilities text[] not null default '{}'::text[],
  config jsonb not null default '{}'::jsonb,
  credentials_reference uuid,
  connected_by uuid,
  connected_at timestamptz,
  last_sync_at timestamptz,
  last_success_at timestamptz,
  last_error_code text,
  last_error_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (company_id, provider)
);

create index if not exists idx_integration_connections_company_status
  on public.integration_connections(company_id, status);
create index if not exists idx_integration_connections_provider_status
  on public.integration_connections(provider, status);
create index if not exists idx_integration_connections_last_sync
  on public.integration_connections(last_sync_at desc) where last_sync_at is not null;

create table if not exists public.integration_sync_cursors (
  connection_id uuid not null references public.integration_connections(id) on delete cascade,
  cursor_key text not null default 'default',
  cursor_value text,
  checkpoint jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  primary key (connection_id, cursor_key)
);

create table if not exists public.integration_mappings (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  connection_id uuid not null references public.integration_connections(id) on delete cascade,
  entity_type text not null,
  orcaly_entity_id text,
  external_id text not null,
  external_version text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (connection_id, entity_type, external_id)
);

create index if not exists idx_integration_mappings_orcaly_entity
  on public.integration_mappings(company_id, entity_type, orcaly_entity_id)
  where orcaly_entity_id is not null;

create table if not exists public.integration_usage_daily (
  company_id uuid not null references public.companies(id) on delete cascade,
  provider text not null,
  metric text not null,
  usage_day date not null default current_date,
  quantity bigint not null default 0 check (quantity >= 0),
  metadata jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  primary key (company_id, provider, metric, usage_day)
);

create table if not exists public.integration_oauth_states (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  user_id uuid not null,
  provider text not null,
  nonce_hash text not null unique,
  expires_at timestamptz not null,
  consumed_at timestamptz,
  created_at timestamptz not null default now(),
  check (expires_at > created_at)
);

create index if not exists idx_integration_oauth_states_lookup
  on public.integration_oauth_states(company_id, user_id, provider, expires_at desc);

-- One active synchronization per connection. The payload continues to live in the
-- existing generic background_jobs table, avoiding provider-specific queues.
create unique index if not exists idx_background_jobs_one_active_integration_sync
  on public.background_jobs(company_id, ((payload ->> 'connection_id')))
  where job_type = 'integration.sync'
    and status in ('queued','running','retrying')
    and payload ? 'connection_id';

alter table public.integration_connections enable row level security;
alter table public.integration_sync_cursors enable row level security;
alter table public.integration_mappings enable row level security;
alter table public.integration_usage_daily enable row level security;
alter table public.integration_oauth_states enable row level security;

-- These are internal infrastructure tables. Browser access is denied even if Data API
-- exposure defaults change. Company-facing reads/writes go through authenticated server routes.
revoke all on table public.integration_connections from public, anon, authenticated;
revoke all on table public.integration_sync_cursors from public, anon, authenticated;
revoke all on table public.integration_mappings from public, anon, authenticated;
revoke all on table public.integration_usage_daily from public, anon, authenticated;
revoke all on table public.integration_oauth_states from public, anon, authenticated;

grant select, insert, update, delete on table public.integration_connections to service_role;
grant select, insert, update, delete on table public.integration_sync_cursors to service_role;
grant select, insert, update, delete on table public.integration_mappings to service_role;
grant select, insert, update, delete on table public.integration_usage_daily to service_role;
grant select, insert, update, delete on table public.integration_oauth_states to service_role;

-- Vault-backed credential operations. These functions are deliberately SECURITY DEFINER,
-- fully tenant-bound, have a fixed search_path and are executable only by service_role.
create or replace function public.integration_credentials_store(
  p_company_id uuid,
  p_connection_id uuid,
  p_secret text
) returns uuid
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  v_secret_id uuid;
begin
  if p_secret is null or length(p_secret) = 0 then
    raise exception 'empty integration credential';
  end if;

  select c.credentials_reference
    into v_secret_id
  from public.integration_connections c
  where c.id = p_connection_id
    and c.company_id = p_company_id
  for update;

  if not found then
    raise exception 'integration connection not found';
  end if;

  if v_secret_id is null then
    select vault.create_secret(
      p_secret,
      'orcaly.integration.' || p_connection_id::text,
      'Orçaly integration credential bundle'
    ) into v_secret_id;

    update public.integration_connections
      set credentials_reference = v_secret_id,
          updated_at = now()
    where id = p_connection_id and company_id = p_company_id;
  else
    perform vault.update_secret(v_secret_id, p_secret);
  end if;

  return v_secret_id;
end;
$$;

create or replace function public.integration_credentials_read(
  p_company_id uuid,
  p_connection_id uuid
) returns jsonb
language plpgsql
security definer
stable
set search_path = pg_catalog
as $$
declare
  v_secret jsonb;
begin
  select ds.decrypted_secret::jsonb
    into v_secret
  from public.integration_connections c
  join vault.decrypted_secrets ds on ds.id = c.credentials_reference
  where c.id = p_connection_id
    and c.company_id = p_company_id;

  return v_secret;
end;
$$;

create or replace function public.integration_credentials_delete(
  p_company_id uuid,
  p_connection_id uuid
) returns void
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  v_secret_id uuid;
begin
  select c.credentials_reference
    into v_secret_id
  from public.integration_connections c
  where c.id = p_connection_id
    and c.company_id = p_company_id
  for update;

  if not found then
    raise exception 'integration connection not found';
  end if;

  if v_secret_id is not null then
    delete from vault.secrets where id = v_secret_id;
    update public.integration_connections
      set credentials_reference = null,
          updated_at = now()
    where id = p_connection_id and company_id = p_company_id;
  end if;
end;
$$;

revoke all on function public.integration_credentials_store(uuid, uuid, text) from public, anon, authenticated;
revoke all on function public.integration_credentials_read(uuid, uuid) from public, anon, authenticated;
revoke all on function public.integration_credentials_delete(uuid, uuid) from public, anon, authenticated;
grant execute on function public.integration_credentials_store(uuid, uuid, text) to service_role;
grant execute on function public.integration_credentials_read(uuid, uuid) to service_role;
grant execute on function public.integration_credentials_delete(uuid, uuid) to service_role;

-- Integration rollout is fail-closed. Product/commercial decisions can enable a provider
-- globally, by plan, segment or company later without code changes.
insert into public.platform_feature_flags(key, description, enabled, scope, scope_value, config)
values
  ('integration_google_calendar','Google Calendar connector',false,'global','*','{}'::jsonb),
  ('integration_google_drive','Google Drive connector',false,'global','*','{}'::jsonb),
  ('integration_google_sheets','Google Sheets connector',false,'global','*','{}'::jsonb),
  ('integration_gmail','Gmail connector',false,'global','*','{}'::jsonb),
  ('integration_google_business','Google Business Profile connector',false,'global','*','{}'::jsonb),
  ('integration_google_maps','Google Maps connector',false,'global','*','{}'::jsonb),
  ('integration_resend','Transactional email connector',false,'global','*','{}'::jsonb),
  ('integration_nfse','NFS-e connector',false,'global','*','{}'::jsonb),
  ('integration_meta_leads','Meta Leads connector',false,'global','*','{}'::jsonb),
  ('integration_clicksign','Clicksign connector',false,'global','*','{}'::jsonb),
  ('integration_mercado_livre','Mercado Livre connector',false,'global','*','{}'::jsonb),
  ('integration_shopee','Shopee connector',false,'global','*','{}'::jsonb),
  ('integration_erp','ERP connector framework',false,'global','*','{}'::jsonb),
  ('integration_erp_bling','Bling connector',false,'global','*','{}'::jsonb),
  ('integration_erp_omie','Omie connector',false,'global','*','{}'::jsonb),
  ('integration_zapier','Zapier connector',false,'global','*','{}'::jsonb),
  ('integration_make','Make connector',false,'global','*','{}'::jsonb),
  ('integration_n8n','n8n connector',false,'global','*','{}'::jsonb),
  ('integration_slack','Slack connector',false,'global','*','{}'::jsonb),
  ('integration_microsoft_teams','Microsoft Teams connector',false,'global','*','{}'::jsonb),
  ('integration_open_finance','Open Finance connector',false,'global','*','{}'::jsonb)
on conflict (key, scope, scope_value) do nothing;
