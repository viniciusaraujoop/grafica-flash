-- Orçaly Assistant v2 public-product analytics.
-- Server-side only. No public/client policy is intentionally created.

create table if not exists public.assistant_events (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null,
  session_hash text not null,
  event_name text not null check (event_name in (
    'assistant_open',
    'assistant_message_sent',
    'assistant_quick_action',
    'assistant_plan_recommended',
    'assistant_demo_opened',
    'assistant_signup_clicked',
    'assistant_whatsapp_clicked',
    'assistant_lead_created',
    'assistant_feedback',
    'assistant_unanswered',
    'assistant_fallback',
    'assistant_provider_error'
  )),
  page_path text,
  segment text,
  recommended_plan text,
  tool_name text,
  status text,
  latency_ms integer check (latency_ms is null or latency_ms >= 0),
  model text,
  prompt_tokens integer check (prompt_tokens is null or prompt_tokens >= 0),
  completion_tokens integer check (completion_tokens is null or completion_tokens >= 0),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.assistant_events enable row level security;

revoke all on table public.assistant_events from anon, authenticated;
grant select, insert on table public.assistant_events to service_role;

create index if not exists assistant_events_created_at_idx
  on public.assistant_events (created_at desc);

create index if not exists assistant_events_name_created_idx
  on public.assistant_events (event_name, created_at desc);

create index if not exists assistant_events_session_created_idx
  on public.assistant_events (session_hash, created_at desc);

create index if not exists assistant_events_plan_created_idx
  on public.assistant_events (recommended_plan, created_at desc)
  where recommended_plan is not null;
