-- ORCALY ADMIN CONTROL CENTER 2.0
-- Preferentially additive migration. The two role CHECK constraints and the invite
-- completion RPC are intentionally replaced to support the new RBAC model.
-- Do not apply to production without an explicitly confirmed target and staging QA.

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

-- No authenticated-client policies by design. Control Center APIs use service role
-- only after server-side platform RBAC validates actor + intent.

-- Non-data-destructive constraint evolution required by the real existing schema.
alter table public.platform_admins drop constraint if exists platform_admins_role_check_v2;
alter table public.platform_admins add constraint platform_admins_role_check_v3
  check (lower(role) = any (array[
    'owner','super_admin','admin','platform_admin','finance','support','suporte',
    'security','seguranca','operations','operacoes','viewer','visualizador','prospector'
  ]::text[]));

alter table public.platform_admin_invites drop constraint if exists platform_admin_invites_role_check;
alter table public.platform_admin_invites add constraint platform_admin_invites_role_check_v2
  check (lower(role) = any (array[
    'admin','platform_admin','finance','support','security','operations','viewer','prospector'
  ]::text[]));

create or replace function public.complete_platform_admin_invite(p_claim_id uuid, p_user_id uuid)
returns setof public.platform_admins
language plpgsql
set search_path to 'pg_catalog', 'public', 'auth'
as $function$
declare
  v_invite public.platform_admin_invites%rowtype;
  v_admin public.platform_admins%rowtype;
  v_role text;
begin
  if p_claim_id is null or p_user_id is null then
    raise exception 'invalid_activation_input';
  end if;

  select * into v_invite
  from public.platform_admin_invites
  where status = 'activating'
    and activation_claim_id = p_claim_id
    and expires_at > now()
  for update;

  if not found then raise exception 'invite_not_claimed'; end if;

  v_role := lower(v_invite.role);
  if v_role not in ('admin','platform_admin','finance','support','security','operations','viewer','prospector') then
    raise exception 'invalid_invite_role';
  end if;

  if exists (select 1 from public.platform_admins p where lower(p.email) = v_invite.email_normalized) then
    raise exception 'platform_admin_email_exists';
  end if;

  insert into public.platform_admins (
    user_id,email,nome,role,is_active,permissions,area,observacoes,created_by,must_change_password,updated_at
  ) values (
    p_user_id,
    v_invite.email_normalized,
    btrim(v_invite.nome),
    v_role,
    true,
    v_invite.permissions,
    coalesce(nullif(btrim(v_invite.area), ''), 'Plataforma'),
    v_invite.observacoes,
    v_invite.created_by_email,
    false,
    now()
  ) returning * into v_admin;

  update public.platform_admin_invites
  set status = 'activated',
      activated_at = now(),
      claimed_at = null,
      activation_claim_id = null,
      user_id = p_user_id,
      platform_admin_id = v_admin.id
  where id = v_invite.id
    and status = 'activating'
    and activation_claim_id = p_claim_id;

  if not found then raise exception 'invite_activation_race'; end if;

  return next v_admin;
  return;
end;
$function$;

insert into public.platform_feature_flags (key,description,enabled,scope,scope_value,created_by,updated_by)
values
  ('support.mode','Permite iniciar Modo Suporte read-only auditado.',false,'global','*','migration','migration'),
  ('admin.ai','Permite gerar resumo administrativo assistido por IA.',false,'global','*','migration','migration')
on conflict (key,scope,scope_value) do nothing;

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
