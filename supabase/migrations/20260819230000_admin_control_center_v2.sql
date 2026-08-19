-- ORCALY ADMIN CONTROL CENTER 2.0
-- Additive-only migration. Do not apply to production without an explicitly confirmed target.

create table if not exists public.platform_support_tickets (
  id uuid primary key default gen_random_uuid(),
  company_id uuid references public.companies(id) on delete set null,
  user_id uuid,
  subject text not null,
  category text not null default 'geral',
  priority text not null default 'medium' check (priority in ('low','medium','high','urgent')),
  description text not null,
  attachments jsonb not null default '[]'::jsonb,
  status text not null default 'new' check (status in ('new','in_progress','waiting_customer','resolved','closed')),
  assignee_admin_id uuid references public.platform_admins(id) on delete set null,
  created_by text,
  first_response_at timestamptz,
  resolved_at timestamptz,
  closed_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.platform_support_ticket_events (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references public.platform_support_tickets(id) on delete cascade,
  admin_id uuid references public.platform_admins(id) on delete set null,
  event_type text not null,
  message text,
  from_status text,
  to_status text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.platform_feature_flags (
  id uuid primary key default gen_random_uuid(),
  key text not null check (key ~ '^[a-z0-9][a-z0-9._-]{1,79}$'),
  description text,
  enabled boolean not null default false,
  scope text not null default 'global' check (scope in ('global','plan','segment','company')),
  scope_value text not null default '*',
  config jsonb not null default '{}'::jsonb,
  created_by text,
  updated_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (key, scope, scope_value)
);

alter table public.platform_support_tickets enable row level security;
alter table public.platform_support_ticket_events enable row level security;
alter table public.platform_feature_flags enable row level security;

-- Deliberately no authenticated-client policies. Control Center APIs use server-side
-- service role only after platform RBAC has validated intent.

create index if not exists idx_platform_support_tickets_status_priority_created
  on public.platform_support_tickets (status, priority, created_at desc);
create index if not exists idx_platform_support_tickets_company_created
  on public.platform_support_tickets (company_id, created_at desc);
create index if not exists idx_platform_support_events_ticket_created
  on public.platform_support_ticket_events (ticket_id, created_at desc);
create index if not exists idx_platform_feature_flags_key_scope
  on public.platform_feature_flags (key, scope, scope_value);
create index if not exists idx_companies_admin_created
  on public.companies (created_at desc);
create index if not exists idx_companies_admin_subscription_status
  on public.companies (assinatura_status, created_at desc);
create index if not exists idx_plan_payments_admin_company_created
  on public.plan_payments (company_id, created_at desc);
create index if not exists idx_plan_payments_admin_status_paid
  on public.plan_payments (status, paid_at desc);
create index if not exists idx_webhook_admin_status_received
  on public.payment_webhook_events (processing_status, received_at desc);
create index if not exists idx_security_admin_open_created
  on public.security_events (resolved, severity, created_at desc);
create index if not exists idx_admin_audit_target_created
  on public.admin_audit_logs (target_id, created_at desc);
