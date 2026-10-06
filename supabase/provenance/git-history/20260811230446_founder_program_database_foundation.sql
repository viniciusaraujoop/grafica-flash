-- Orçaly — Programa Clientes Fundadores
-- FASE 1: fundação de banco, sem alterar cadastro normal, permissões, CRM ou cobrança.

create table if not exists public.founder_invites (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  email_normalized text generated always as (lower(btrim(email))) stored,
  founder_number integer not null,
  plan_key text not null,
  founder_price_cents integer not null,
  status text not null default 'pending',
  token_hash text not null,
  token_expires_at timestamptz null,
  invited_at timestamptz not null default now(),
  activated_at timestamptz null,
  revoked_at timestamptz null,
  user_id uuid null references auth.users(id) on delete set null,
  company_id uuid null references public.companies(id) on delete set null,
  created_by_admin_id uuid null references public.platform_admins(id) on delete set null,
  created_by_email text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint founder_invites_email_check check (
    length(email_normalized) >= 3
    and position('@' in email_normalized) > 1
  ),
  constraint founder_invites_number_check check (
    founder_number between 0 and 10
  ),
  constraint founder_invites_plan_check check (
    plan_key in ('basico', 'profissional', 'premium')
  ),
  constraint founder_invites_price_check check (
    (plan_key = 'basico' and founder_price_cents = 3490)
    or (plan_key = 'profissional' and founder_price_cents = 6990)
    or (plan_key = 'premium' and founder_price_cents = 9990)
  ),
  constraint founder_invites_status_check check (
    status in ('pending', 'activated', 'revoked', 'expired')
  ),
  constraint founder_invites_token_hash_check check (
    token_hash ~ '^[0-9a-f]{64}$'
  ),
  constraint founder_invites_state_check check (
    (
      status = 'pending'
      and activated_at is null
      and revoked_at is null
      and user_id is null
      and company_id is null
    )
    or (
      status = 'activated'
      and activated_at is not null
      and revoked_at is null
      and user_id is not null
      and company_id is not null
    )
    or (
      status = 'revoked'
      and activated_at is null
      and revoked_at is not null
      and user_id is null
      and company_id is null
    )
    or (
      status = 'expired'
      and activated_at is null
      and user_id is null
      and company_id is null
    )
  )
);

create unique index if not exists founder_invites_token_hash_uq
  on public.founder_invites (token_hash);

-- O número 00 fica reservado para testes. Números 01–10 são vagas reais.
-- Um convite revogado/expirado libera a vaga; um ativado preserva a numeração.
create unique index if not exists founder_invites_live_number_uq
  on public.founder_invites (founder_number)
  where status in ('pending', 'activated');

-- O mesmo e-mail não pode ter dois convites pendentes, inclusive mudando caixa/espaços.
create unique index if not exists founder_invites_pending_email_uq
  on public.founder_invites (email_normalized)
  where status = 'pending';

create unique index if not exists founder_invites_activated_user_uq
  on public.founder_invites (user_id)
  where status = 'activated' and user_id is not null;

create unique index if not exists founder_invites_activated_company_uq
  on public.founder_invites (company_id)
  where status = 'activated' and company_id is not null;

create index if not exists founder_invites_status_idx
  on public.founder_invites (status, invited_at desc);

create index if not exists founder_invites_created_by_idx
  on public.founder_invites (created_by_admin_id, invited_at desc);

alter table public.founder_invites enable row level security;

-- founder_invites é uma tabela de backoffice. Navegadores não acessam diretamente.
revoke all on table public.founder_invites from anon, authenticated;
grant select, insert, update on table public.founder_invites to service_role;

drop policy if exists founder_invites_no_direct_access on public.founder_invites;
create policy founder_invites_no_direct_access
  on public.founder_invites
  for all
  to anon, authenticated
  using (false)
  with check (false);

drop trigger if exists founder_invites_set_updated_at on public.founder_invites;
create trigger founder_invites_set_updated_at
before update on public.founder_invites
for each row execute function public.set_updated_at();

alter table public.companies
  add column if not exists is_founder boolean not null default false,
  add column if not exists founder_number integer null,
  add column if not exists founder_price_cents integer null,
  add column if not exists founder_started_at timestamptz null,
  add column if not exists founder_trial_ends_at timestamptz null,
  add column if not exists founder_price_ends_at timestamptz null,
  add column if not exists founder_welcome_seen_at timestamptz null,
  add column if not exists founder_price_converted_at timestamptz null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.companies'::regclass
      and conname = 'companies_founder_number_check'
  ) then
    alter table public.companies
      add constraint companies_founder_number_check
      check (
        founder_number is null
        or founder_number between 0 and 10
      );
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.companies'::regclass
      and conname = 'companies_founder_price_check'
  ) then
    alter table public.companies
      add constraint companies_founder_price_check
      check (
        founder_price_cents is null
        or founder_price_cents in (3490, 6990, 9990)
      );
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.companies'::regclass
      and conname = 'companies_founder_required_fields_check'
  ) then
    alter table public.companies
      add constraint companies_founder_required_fields_check
      check (
        not is_founder
        or (
          founder_number is not null
          and founder_price_cents is not null
          and founder_started_at is not null
          and founder_trial_ends_at is not null
          and founder_price_ends_at is not null
        )
      );
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.companies'::regclass
      and conname = 'companies_founder_timeline_check'
  ) then
    alter table public.companies
      add constraint companies_founder_timeline_check
      check (
        not is_founder
        or (
          founder_trial_ends_at = founder_started_at + interval '30 days'
          and founder_price_ends_at = founder_trial_ends_at + interval '6 months'
        )
      );
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.companies'::regclass
      and conname = 'companies_founder_plan_price_check'
  ) then
    alter table public.companies
      add constraint companies_founder_plan_price_check
      check (
        not is_founder
        or case lower(coalesce(assinatura_plano, plano, ''))
          when 'basico' then founder_price_cents = 3490
          when 'básico' then founder_price_cents = 3490
          when 'essencial' then founder_price_cents = 3490
          when 'profissional' then founder_price_cents = 6990
          when 'intermediario' then founder_price_cents = 6990
          when 'intermediário' then founder_price_cents = 6990
          when 'premium' then founder_price_cents = 9990
          else false
        end
      );
  end if;
end
$$;

-- Uma empresa ativada preserva sua numeração Founder para sempre.
create unique index if not exists companies_founder_number_uq
  on public.companies (founder_number)
  where is_founder = true and founder_number is not null;

comment on table public.founder_invites is
  'Convites do Programa Clientes Fundadores Orçaly. Tokens persistidos somente como SHA-256 hexadecimal.';

comment on column public.founder_invites.founder_number is
  '0 reservado para teste; 1 a 10 são vagas reais do Programa Fundadores.';

comment on column public.companies.founder_price_ends_at is
  'Fim dos 6 meses-calendário de preço fundador, contado após o trial de 30 dias.';
