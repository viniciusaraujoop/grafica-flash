-- ORCALY PLATFORM EVOLUTION 3.0 - observability foundation
-- Additive only. This migration is intentionally not applied to production from the implementation branch.

create table if not exists public.application_error_events (
  id uuid primary key default gen_random_uuid(),
  error_id text not null unique,
  request_id text not null,
  created_at timestamptz not null default now(),
  environment text not null default 'unknown',
  deployment text null,
  route text not null,
  operation text not null,
  actor_user_id uuid null,
  company_id uuid null,
  error_type text not null,
  error_code text null,
  http_status integer null,
  message_sanitized text null,
  stack_sanitized text null,
  metadata jsonb not null default '{}'::jsonb,
  constraint application_error_events_error_id_check
    check (error_id ~ '^ORC-[A-Z0-9]{8,16}$'),
  constraint application_error_events_http_status_check
    check (http_status is null or http_status between 100 and 599)
);

alter table public.application_error_events enable row level security;

revoke all on table public.application_error_events from public, anon, authenticated;
grant select, insert on table public.application_error_events to service_role;

create index if not exists application_error_events_created_at_idx
  on public.application_error_events (created_at desc);

create index if not exists application_error_events_route_created_at_idx
  on public.application_error_events (route, created_at desc);

create index if not exists application_error_events_company_created_at_idx
  on public.application_error_events (company_id, created_at desc)
  where company_id is not null;

comment on table public.application_error_events is
  'PII-minimized application error telemetry. Business audit and analytics events belong in separate domains.';
