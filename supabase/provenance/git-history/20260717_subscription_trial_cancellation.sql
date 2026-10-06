-- Orçaly: teste gratuito único, cancelamento seguro e histórico de assinatura.
-- Migration aditiva e idempotente. Não remove dados nem colunas existentes.

alter table public.companies
  add column if not exists trial_started_at timestamptz,
  add column if not exists trial_ends_at timestamptz,
  add column if not exists trial_used_at timestamptz,
  add column if not exists cancel_at_period_end boolean not null default false,
  add column if not exists access_until timestamptz;

create index if not exists idx_companies_trial_used_at
  on public.companies (trial_used_at);

create index if not exists idx_companies_access_until
  on public.companies (access_until);

create table if not exists public.subscription_events (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  event_type text not null,
  old_status text,
  new_status text,
  provider text not null default 'mercado_pago',
  provider_reference text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_subscription_events_company_created
  on public.subscription_events (company_id, created_at desc);

create unique index if not exists ux_subscription_events_idempotency
  on public.subscription_events (company_id, event_type, provider_reference);

alter table public.subscription_events enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'subscription_events'
      and policyname = 'subscription_events_select_company'
  ) then
    create policy subscription_events_select_company
      on public.subscription_events
      for select
      to authenticated
      using (
        exists (
          select 1
          from public.companies c
          where c.id = subscription_events.company_id
            and (c.owner_id = auth.uid() or c.tester_id = auth.uid())
        )
        or exists (
          select 1
          from public.company_members cm
          where cm.company_id = subscription_events.company_id
            and cm.user_id = auth.uid()
            and cm.status = 'ativo'
        )
      );
  end if;
end $$;

create or replace function public.claim_company_subscription_trial(p_company_id uuid)
returns setof public.companies
language plpgsql
security definer
set search_path = public
as $$
declare
  v_now timestamptz := now();
  v_trial_end timestamptz := now() + interval '7 days';
begin
  return query
  update public.companies
     set trial_started_at = v_now,
         trial_ends_at = v_trial_end,
         trial_used_at = v_now,
         assinatura_status = 'trialing',
         access_until = v_trial_end,
         cancel_at_period_end = false,
         updated_at = v_now
   where id = p_company_id
     and trial_used_at is null
  returning *;
end;
$$;

revoke all on function public.claim_company_subscription_trial(uuid) from public;
revoke all on function public.claim_company_subscription_trial(uuid) from anon;
revoke all on function public.claim_company_subscription_trial(uuid) from authenticated;
grant execute on function public.claim_company_subscription_trial(uuid) to service_role;

create or replace function public.protect_company_trial_used_at()
returns trigger
language plpgsql
as $$
begin
  if old.trial_used_at is not null and new.trial_used_at is null then
    new.trial_used_at := old.trial_used_at;
  end if;
  return new;
end;
$$;

do $$
begin
  if not exists (
    select 1
    from pg_trigger
    where tgname = 'trg_protect_company_trial_used_at'
      and tgrelid = 'public.companies'::regclass
  ) then
    create trigger trg_protect_company_trial_used_at
    before update on public.companies
    for each row
    execute function public.protect_company_trial_used_at();
  end if;
end $$;
