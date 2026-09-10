-- ORCALY — Google Calendar complete integration support.
-- Additive only. Reuses integration_mappings, integration_sync_cursors and background_jobs.

create unique index if not exists idx_integration_mappings_local_entity_unique
  on public.integration_mappings(connection_id, entity_type, orcaly_entity_id)
  where orcaly_entity_id is not null;

create unique index if not exists idx_background_jobs_one_active_google_calendar_full_resync
  on public.background_jobs(company_id, ((payload ->> 'connection_id')))
  where job_type = 'google.calendar.full_resync'
    and status in ('queued','running','retrying')
    and payload ? 'connection_id';

create table if not exists public.integration_push_channels (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  connection_id uuid not null references public.integration_connections(id) on delete cascade,
  provider text not null,
  resource_type text not null,
  channel_id text not null unique,
  resource_id text not null,
  resource_uri text,
  token_hash text not null,
  expires_at timestamptz,
  state text not null default 'active' check (state in ('active','stopped','expired')),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_integration_push_channels_connection
  on public.integration_push_channels(company_id, connection_id, provider, state);
create index if not exists idx_integration_push_channels_expiry
  on public.integration_push_channels(expires_at)
  where state = 'active' and expires_at is not null;

alter table public.integration_push_channels enable row level security;
revoke all on table public.integration_push_channels from public, anon, authenticated;
grant select, insert, update, delete on table public.integration_push_channels to service_role;
