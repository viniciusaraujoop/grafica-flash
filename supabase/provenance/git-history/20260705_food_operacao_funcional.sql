-- ORÇALY - FOOD OPERAÇÃO FUNCIONAL
-- Entregas, horários, taxas de entrega e formas de pagamento com CRUD real.
-- Idempotente: pode rodar mais de uma vez.
-- Não usa DROP, DELETE ou TRUNCATE. Não apaga dados existentes.

create extension if not exists "pgcrypto";

-- =========================
-- TAXAS / ZONAS DE ENTREGA
-- =========================

create table if not exists public.delivery_zones (
  id uuid primary key default gen_random_uuid(),
  company_id uuid references public.companies(id) on delete cascade,
  name text not null,
  fee numeric(12,2) not null default 0,
  minimum_order numeric(12,2) default 0,
  estimated_time_min integer,
  estimated_time_max integer,
  is_active boolean default true,
  notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.delivery_zones add column if not exists company_id uuid references public.companies(id) on delete cascade;
alter table public.delivery_zones add column if not exists name text;
alter table public.delivery_zones add column if not exists fee numeric(12,2) default 0;
alter table public.delivery_zones add column if not exists minimum_order numeric(12,2) default 0;
alter table public.delivery_zones add column if not exists estimated_time_min integer;
alter table public.delivery_zones add column if not exists estimated_time_max integer;
alter table public.delivery_zones add column if not exists is_active boolean default true;
alter table public.delivery_zones add column if not exists notes text;
alter table public.delivery_zones add column if not exists created_at timestamptz default now();
alter table public.delivery_zones add column if not exists updated_at timestamptz default now();

-- Compatibilidade com a migration antiga do Food MVP.
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'delivery_zones' and column_name = 'min_order'
  ) then
    update public.delivery_zones
    set minimum_order = coalesce(minimum_order, min_order, 0)
    where minimum_order is null;
  end if;

  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'delivery_zones' and column_name = 'active'
  ) then
    update public.delivery_zones
    set is_active = coalesce(is_active, active, true)
    where is_active is null;
  end if;
end $$;

update public.delivery_zones set fee = coalesce(fee, 0), minimum_order = coalesce(minimum_order, 0), is_active = coalesce(is_active, true);

-- =========================
-- HORÁRIOS DE FUNCIONAMENTO
-- =========================

create table if not exists public.business_hours (
  id uuid primary key default gen_random_uuid(),
  company_id uuid references public.companies(id) on delete cascade,
  weekday integer not null,
  is_open boolean default true,
  open_time time,
  close_time time,
  break_start time,
  break_end time,
  closed_message text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.business_hours add column if not exists company_id uuid references public.companies(id) on delete cascade;
alter table public.business_hours add column if not exists weekday integer;
alter table public.business_hours add column if not exists is_open boolean default true;
alter table public.business_hours add column if not exists open_time time;
alter table public.business_hours add column if not exists close_time time;
alter table public.business_hours add column if not exists break_start time;
alter table public.business_hours add column if not exists break_end time;
alter table public.business_hours add column if not exists closed_message text;
alter table public.business_hours add column if not exists created_at timestamptz default now();
alter table public.business_hours add column if not exists updated_at timestamptz default now();

-- Compatibilidade com opens_at/closes_at/active da versão anterior.
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'business_hours' and column_name = 'opens_at'
  ) then
    update public.business_hours
    set open_time = coalesce(open_time, opens_at)
    where open_time is null;
  end if;

  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'business_hours' and column_name = 'closes_at'
  ) then
    update public.business_hours
    set close_time = coalesce(close_time, closes_at)
    where close_time is null;
  end if;

  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'business_hours' and column_name = 'active'
  ) then
    update public.business_hours
    set is_open = coalesce(is_open, active, true)
    where is_open is null;
  end if;
end $$;

update public.business_hours set is_open = coalesce(is_open, true);

-- Cria constraint única quando o banco ainda não tem uma. Se houver duplicados antigos,
-- a constraint não é forçada aqui para evitar alteração destrutiva. A tela funciona atualizando por id + company_id.
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'business_hours_company_weekday_unique'
  ) then
    begin
      alter table public.business_hours
        add constraint business_hours_company_weekday_unique unique(company_id, weekday);
    exception
      when unique_violation then
        raise notice 'business_hours tem duplicados por company_id/weekday; constraint única não foi aplicada.';
      when others then
        raise notice 'constraint business_hours_company_weekday_unique não aplicada: %', sqlerrm;
    end;
  end if;
end $$;

-- =========================
-- FORMAS DE PAGAMENTO
-- =========================

create table if not exists public.payment_methods (
  id uuid primary key default gen_random_uuid(),
  company_id uuid references public.companies(id) on delete cascade,
  name text not null,
  type text not null,
  is_active boolean default true,
  requires_change boolean default false,
  allow_delivery_payment boolean default true,
  allow_online_payment boolean default false,
  instructions text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.payment_methods add column if not exists company_id uuid references public.companies(id) on delete cascade;
alter table public.payment_methods add column if not exists name text;
alter table public.payment_methods add column if not exists type text;
alter table public.payment_methods add column if not exists is_active boolean default true;
alter table public.payment_methods add column if not exists requires_change boolean default false;
alter table public.payment_methods add column if not exists allow_delivery_payment boolean default true;
alter table public.payment_methods add column if not exists allow_online_payment boolean default false;
alter table public.payment_methods add column if not exists instructions text;
alter table public.payment_methods add column if not exists created_at timestamptz default now();
alter table public.payment_methods add column if not exists updated_at timestamptz default now();

update public.payment_methods
set is_active = coalesce(is_active, true),
    requires_change = coalesce(requires_change, false),
    allow_delivery_payment = coalesce(allow_delivery_payment, true),
    allow_online_payment = coalesce(allow_online_payment, false);

-- =========================
-- ENTREGAS
-- =========================

create table if not exists public.deliveries (
  id uuid primary key default gen_random_uuid(),
  company_id uuid references public.companies(id) on delete cascade,
  order_id uuid null references public.orders(id) on delete set null,
  customer_name text,
  customer_phone text,
  address text,
  neighborhood text,
  delivery_zone_id uuid null references public.delivery_zones(id) on delete set null,
  delivery_fee numeric(12,2) default 0,
  payment_method_id uuid null references public.payment_methods(id) on delete set null,
  status text default 'waiting_preparation',
  notes text,
  estimated_delivery_at timestamptz,
  delivered_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.deliveries add column if not exists company_id uuid references public.companies(id) on delete cascade;
alter table public.deliveries add column if not exists order_id uuid null references public.orders(id) on delete set null;
alter table public.deliveries add column if not exists customer_name text;
alter table public.deliveries add column if not exists customer_phone text;
alter table public.deliveries add column if not exists address text;
alter table public.deliveries add column if not exists neighborhood text;
alter table public.deliveries add column if not exists delivery_zone_id uuid null references public.delivery_zones(id) on delete set null;
alter table public.deliveries add column if not exists delivery_fee numeric(12,2) default 0;
alter table public.deliveries add column if not exists payment_method_id uuid null references public.payment_methods(id) on delete set null;
alter table public.deliveries add column if not exists status text default 'waiting_preparation';
alter table public.deliveries add column if not exists notes text;
alter table public.deliveries add column if not exists estimated_delivery_at timestamptz;
alter table public.deliveries add column if not exists delivered_at timestamptz;
alter table public.deliveries add column if not exists created_at timestamptz default now();
alter table public.deliveries add column if not exists updated_at timestamptz default now();

update public.deliveries
set delivery_fee = coalesce(delivery_fee, 0),
    status = coalesce(status, 'waiting_preparation');

-- =========================
-- ÍNDICES
-- =========================

create index if not exists idx_delivery_zones_company_id on public.delivery_zones(company_id);
create index if not exists idx_delivery_zones_company_active on public.delivery_zones(company_id, is_active);
create index if not exists idx_business_hours_company_id on public.business_hours(company_id);
create index if not exists idx_business_hours_company_weekday on public.business_hours(company_id, weekday);
create index if not exists idx_payment_methods_company_id on public.payment_methods(company_id);
create index if not exists idx_payment_methods_company_active on public.payment_methods(company_id, is_active);
create index if not exists idx_deliveries_company_id on public.deliveries(company_id);
create index if not exists idx_deliveries_company_status on public.deliveries(company_id, status);
create index if not exists idx_deliveries_company_created_at on public.deliveries(company_id, created_at desc);
create index if not exists idx_deliveries_order_id on public.deliveries(order_id);

-- =========================
-- UPDATED_AT AUTOMÁTICO
-- =========================

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

do $$
begin
  if not exists (select 1 from pg_trigger where tgname = 'set_delivery_zones_updated_at') then
    create trigger set_delivery_zones_updated_at
      before update on public.delivery_zones
      for each row execute function public.set_updated_at();
  end if;

  if not exists (select 1 from pg_trigger where tgname = 'set_business_hours_updated_at') then
    create trigger set_business_hours_updated_at
      before update on public.business_hours
      for each row execute function public.set_updated_at();
  end if;

  if not exists (select 1 from pg_trigger where tgname = 'set_payment_methods_updated_at') then
    create trigger set_payment_methods_updated_at
      before update on public.payment_methods
      for each row execute function public.set_updated_at();
  end if;

  if not exists (select 1 from pg_trigger where tgname = 'set_deliveries_updated_at') then
    create trigger set_deliveries_updated_at
      before update on public.deliveries
      for each row execute function public.set_updated_at();
  end if;
end $$;

-- =========================
-- RLS POR EMPRESA
-- =========================

alter table public.delivery_zones enable row level security;
alter table public.business_hours enable row level security;
alter table public.payment_methods enable row level security;
alter table public.deliveries enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'delivery_zones' and policyname = 'delivery_zones_company_access') then
    create policy delivery_zones_company_access on public.delivery_zones
    for all using (
      exists (
        select 1 from public.companies c
        where c.id = delivery_zones.company_id
          and (
            c.owner_id = auth.uid()
            or c.tester_id = auth.uid()
            or exists (select 1 from public.company_members m where m.company_id = c.id and m.user_id = auth.uid() and m.status = 'ativo')
          )
      )
    ) with check (
      exists (
        select 1 from public.companies c
        where c.id = delivery_zones.company_id
          and (
            c.owner_id = auth.uid()
            or c.tester_id = auth.uid()
            or exists (select 1 from public.company_members m where m.company_id = c.id and m.user_id = auth.uid() and m.status = 'ativo')
          )
      )
    );
  end if;

  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'business_hours' and policyname = 'business_hours_company_access') then
    create policy business_hours_company_access on public.business_hours
    for all using (
      exists (
        select 1 from public.companies c
        where c.id = business_hours.company_id
          and (
            c.owner_id = auth.uid()
            or c.tester_id = auth.uid()
            or exists (select 1 from public.company_members m where m.company_id = c.id and m.user_id = auth.uid() and m.status = 'ativo')
          )
      )
    ) with check (
      exists (
        select 1 from public.companies c
        where c.id = business_hours.company_id
          and (
            c.owner_id = auth.uid()
            or c.tester_id = auth.uid()
            or exists (select 1 from public.company_members m where m.company_id = c.id and m.user_id = auth.uid() and m.status = 'ativo')
          )
      )
    );
  end if;

  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'payment_methods' and policyname = 'payment_methods_company_access') then
    create policy payment_methods_company_access on public.payment_methods
    for all using (
      exists (
        select 1 from public.companies c
        where c.id = payment_methods.company_id
          and (
            c.owner_id = auth.uid()
            or c.tester_id = auth.uid()
            or exists (select 1 from public.company_members m where m.company_id = c.id and m.user_id = auth.uid() and m.status = 'ativo')
          )
      )
    ) with check (
      exists (
        select 1 from public.companies c
        where c.id = payment_methods.company_id
          and (
            c.owner_id = auth.uid()
            or c.tester_id = auth.uid()
            or exists (select 1 from public.company_members m where m.company_id = c.id and m.user_id = auth.uid() and m.status = 'ativo')
          )
      )
    );
  end if;

  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'deliveries' and policyname = 'deliveries_company_access') then
    create policy deliveries_company_access on public.deliveries
    for all using (
      exists (
        select 1 from public.companies c
        where c.id = deliveries.company_id
          and (
            c.owner_id = auth.uid()
            or c.tester_id = auth.uid()
            or exists (select 1 from public.company_members m where m.company_id = c.id and m.user_id = auth.uid() and m.status = 'ativo')
          )
      )
    ) with check (
      exists (
        select 1 from public.companies c
        where c.id = deliveries.company_id
          and (
            c.owner_id = auth.uid()
            or c.tester_id = auth.uid()
            or exists (select 1 from public.company_members m where m.company_id = c.id and m.user_id = auth.uid() and m.status = 'ativo')
          )
      )
    );
  end if;
end $$;

-- Grants explícitos para o client autenticado do painel.
grant select, insert, update, delete on public.delivery_zones to authenticated;
grant select, insert, update, delete on public.business_hours to authenticated;
grant select, insert, update, delete on public.payment_methods to authenticated;
grant select, insert, update, delete on public.deliveries to authenticated;

-- Diagnóstico final para confirmar colunas críticas.
select
  table_name,
  column_name,
  data_type
from information_schema.columns
where table_schema = 'public'
  and table_name in ('delivery_zones', 'business_hours', 'payment_methods', 'deliveries')
order by table_name, ordinal_position;
