-- Additive only. Validate in an isolated database before applying remotely.
begin;

create schema if not exists ecosystem_private;
revoke all on schema ecosystem_private from public, anon;
grant usage on schema ecosystem_private to authenticated, service_role;

create table public.ecosystem_product_entitlements (
  id uuid primary key default gen_random_uuid(),
  product_id text not null check (product_id in ('business','wealth','growth','flow','academy','market','partners','one')),
  user_id uuid references auth.users(id) on delete cascade,
  company_id uuid references public.companies(id) on delete cascade,
  status text not null default 'active' check (status in ('active','revoked','expired')),
  starts_at timestamptz not null default now(),
  expires_at timestamptz,
  permissions text[] not null default '{}',
  source text not null check (source in ('subscription','trial','manual','bundle')),
  source_reference text check (length(source_reference) <= 200),
  created_at timestamptz not null default now(),
  check (num_nonnulls(user_id, company_id) = 1),
  check (expires_at is null or expires_at > starts_at),
  check (permissions <@ array[product_id || '.read', product_id || '.write', product_id || '.export']),
  check ((product_id not in ('wealth','academy','market') or user_id is not null)
    and (product_id not in ('business','growth','flow') or company_id is not null))
);
create unique index ecosystem_entitlement_user_product on public.ecosystem_product_entitlements(user_id,product_id) where user_id is not null;
create unique index ecosystem_entitlement_company_product on public.ecosystem_product_entitlements(company_id,product_id) where company_id is not null;
alter table public.ecosystem_product_entitlements enable row level security;
revoke all on public.ecosystem_product_entitlements from anon, authenticated;
grant select on public.ecosystem_product_entitlements to authenticated;
grant all on public.ecosystem_product_entitlements to service_role;
create policy entitlement_read_own on public.ecosystem_product_entitlements for select to authenticated using (
  user_id = (select auth.uid()) or exists (
    select 1 from public.companies c where c.id = company_id and c.owner_id = (select auth.uid())
  ) or exists (
    select 1 from public.company_members m where m.company_id = ecosystem_product_entitlements.company_id
      and m.user_id = (select auth.uid()) and m.status = 'ativo'
  )
);

create function ecosystem_private.has_personal_access(product text, permission text)
returns boolean language sql stable security invoker set search_path = '' as $$
  select exists (select 1 from public.ecosystem_product_entitlements e
    where e.user_id = (select auth.uid()) and e.company_id is null
      and e.product_id = product and e.status = 'active' and e.starts_at <= now()
      and (e.expires_at is null or e.expires_at > now()) and permission = any(e.permissions));
$$;
revoke all on function ecosystem_private.has_personal_access(text,text) from public, anon;
grant execute on function ecosystem_private.has_personal_access(text,text) to authenticated, service_role;

create table public.ecosystem_context_consents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  source_product text not null check (source_product in ('business','wealth','growth','flow','academy','market','partners','one')),
  target_product text not null check (target_product in ('business','wealth','growth','flow','academy','market','partners','one')),
  source_company_id uuid references public.companies(id) on delete cascade,
  target_company_id uuid references public.companies(id) on delete cascade,
  data_scope text not null check (data_scope in ('financial.summary','learning.progress')),
  purpose text not null check (purpose in ('personal.planning','learning.personalization')),
  granted_at timestamptz not null default now(),
  expires_at timestamptz not null,
  revoked_at timestamptz,
  check (source_product <> target_product),
  check (expires_at > granted_at and expires_at <= granted_at + interval '1 year'),
  check (revoked_at is null or revoked_at >= granted_at),
  check ((source_product in ('business','growth','flow')) = (source_company_id is not null)),
  check ((target_product in ('business','growth','flow')) = (target_company_id is not null))
);
create index ecosystem_consents_user on public.ecosystem_context_consents(user_id,expires_at);
create index ecosystem_consents_source_company on public.ecosystem_context_consents(source_company_id) where source_company_id is not null;
create index ecosystem_consents_target_company on public.ecosystem_context_consents(target_company_id) where target_company_id is not null;
alter table public.ecosystem_context_consents enable row level security;
revoke all on public.ecosystem_context_consents from anon, authenticated;
grant select on public.ecosystem_context_consents to authenticated;
grant update(revoked_at) on public.ecosystem_context_consents to authenticated;
-- Consent grants are server-operated until all cross-product permission checks are implemented.
-- No client INSERT grant or policy: a consent row alone never authorizes a data transfer.
grant all on public.ecosystem_context_consents to service_role;
create policy consents_read_own on public.ecosystem_context_consents for select to authenticated using (user_id = (select auth.uid()));
create policy consents_revoke_own on public.ecosystem_context_consents for update to authenticated
  using (user_id = (select auth.uid()) and revoked_at is null)
  with check (user_id = (select auth.uid()) and revoked_at is not null);

create table public.wealth_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  monthly_income_cents bigint not null default 0 check (monthly_income_cents between 0 and 100000000000000),
  monthly_budget_cents bigint not null default 0 check (monthly_budget_cents between 0 and 100000000000000),
  dependents smallint not null default 0 check (dependents between 0 and 50),
  emergency_months smallint not null default 6 check (emergency_months between 1 and 36),
  currency text not null default 'BRL' check (currency = 'BRL'),
  timezone text not null default 'America/Sao_Paulo' check (length(timezone) between 1 and 80),
  updated_at timestamptz not null default now()
);

create table public.wealth_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null check (kind in ('income','expense','asset','liability')),
  title text not null check (length(btrim(title)) between 1 and 160),
  category text not null check (category in ('salary','housing','food','transport','education','health','leisure','investment','property','loan','other')),
  amount_cents bigint not null check (amount_cents between 1 and 100000000000000),
  currency text not null default 'BRL' check (currency = 'BRL'),
  financial_date date not null check (financial_date between date '1900-01-01' and date '2200-12-31'),
  recurrence text not null default 'none' check (recurrence in ('none','monthly','yearly')),
  idempotency_key uuid not null,
  created_at timestamptz not null default now(),
  unique(user_id,idempotency_key)
);
create index wealth_entries_owner_date on public.wealth_entries(user_id,financial_date desc,id);

create table public.wealth_goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null check (length(btrim(title)) between 1 and 160),
  target_cents bigint not null check (target_cents between 1 and 100000000000000),
  saved_cents bigint not null default 0 check (saved_cents between 0 and 100000000000000),
  monthly_contribution_cents bigint not null default 0 check (monthly_contribution_cents between 0 and 100000000000000),
  target_date date not null check (target_date between date '1900-01-01' and date '2200-12-31'),
  currency text not null default 'BRL' check (currency = 'BRL'),
  idempotency_key uuid not null,
  created_at timestamptz not null default now(),
  unique(user_id,idempotency_key)
);
create index wealth_goals_owner_date on public.wealth_goals(user_id,target_date,id);

-- Permission checks also apply to direct PostgREST requests, independently of the UI.
do $$ declare relation text; begin
  foreach relation in array array['wealth_profiles','wealth_entries','wealth_goals'] loop
    execute format('alter table public.%I enable row level security',relation);
    execute format('revoke all on public.%I from anon, authenticated',relation);
    execute format('grant select, insert, update, delete on public.%I to authenticated',relation);
    execute format('grant all on public.%I to service_role',relation);
    execute format('create policy wealth_read_own on public.%I for select to authenticated using (user_id = (select auth.uid()) and ecosystem_private.has_personal_access(''wealth'',''wealth.read''))',relation);
    execute format('create policy wealth_insert_own on public.%I for insert to authenticated with check (user_id = (select auth.uid()) and ecosystem_private.has_personal_access(''wealth'',''wealth.write''))',relation);
    execute format('create policy wealth_update_own on public.%I for update to authenticated using (user_id = (select auth.uid()) and ecosystem_private.has_personal_access(''wealth'',''wealth.write'')) with check (user_id = (select auth.uid()) and ecosystem_private.has_personal_access(''wealth'',''wealth.write''))',relation);
    execute format('create policy wealth_delete_own on public.%I for delete to authenticated using (user_id = (select auth.uid()) and ecosystem_private.has_personal_access(''wealth'',''wealth.write''))',relation);
  end loop;
end $$;

create table public.ecosystem_audit_events (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references auth.users(id) on delete set null,
  event_type text not null,
  entity_id text not null,
  recorded_at timestamptz not null default now()
);
create index ecosystem_audit_actor_date on public.ecosystem_audit_events(actor_id,recorded_at desc);
alter table public.ecosystem_audit_events enable row level security;
revoke all on public.ecosystem_audit_events from anon, authenticated;
grant select,insert on public.ecosystem_audit_events to service_role;

create function ecosystem_private.record_change() returns trigger
language plpgsql security definer set search_path = '' as $$
declare record_key text;
begin
  if tg_op = 'DELETE' then record_key := coalesce(to_jsonb(old)->>'id',to_jsonb(old)->>'user_id');
  else record_key := coalesce(to_jsonb(new)->>'id',to_jsonb(new)->>'user_id'); end if;
  insert into public.ecosystem_audit_events(actor_id,event_type,entity_id)
    values(auth.uid(),tg_table_name || '.' || lower(tg_op),record_key);
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;
revoke all on function ecosystem_private.record_change() from public, anon, authenticated;
do $$ declare relation text; begin
  foreach relation in array array['ecosystem_product_entitlements','ecosystem_context_consents','wealth_profiles','wealth_entries','wealth_goals'] loop
    execute format('create trigger ecosystem_audit after insert or update or delete on public.%I for each row execute function ecosystem_private.record_change()',relation);
  end loop;
end $$;
commit;
