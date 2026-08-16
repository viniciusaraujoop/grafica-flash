-- ORCALY_DELIVERY_DRIVERS_ASSIGNMENTS_V1

begin;

create table if not exists public.delivery_drivers (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  name text not null,
  whatsapp text not null,
  vehicle_plate text,
  notes text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint delivery_drivers_name_check
    check (char_length(trim(name)) between 2 and 80),
  constraint delivery_drivers_whatsapp_check
    check (
      char_length(
        regexp_replace(whatsapp, '[^0-9]', '', 'g')
      ) between 10 and 13
    ),
  constraint delivery_drivers_plate_check
    check (
      vehicle_plate is null
      or char_length(trim(vehicle_plate)) between 5 and 10
    )
);

create index if not exists delivery_drivers_company_active_idx
  on public.delivery_drivers (company_id, is_active, name);

create unique index if not exists delivery_drivers_company_plate_uidx
  on public.delivery_drivers (
    company_id,
    upper(trim(vehicle_plate))
  )
  where vehicle_plate is not null
    and trim(vehicle_plate) <> '';

alter table public.deliveries
  add column if not exists assigned_driver_id uuid
    references public.delivery_drivers(id) on delete set null,
  add column if not exists assigned_at timestamptz,
  add column if not exists dispatched_at timestamptz;

create index if not exists deliveries_company_driver_idx
  on public.deliveries (
    company_id,
    assigned_driver_id,
    status
  );

create table if not exists public.delivery_assignments (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null
    references public.companies(id) on delete cascade,
  delivery_id uuid
    references public.deliveries(id) on delete set null,
  order_id uuid
    references public.orders(id) on delete set null,
  driver_id uuid
    references public.delivery_drivers(id) on delete set null,
  driver_name text not null,
  driver_whatsapp text,
  vehicle_plate text,
  delivery_code text,
  customer_name text,
  customer_phone text,
  address text,
  neighborhood text,
  map_url text,
  payment_method text,
  payment_status text,
  order_total numeric(14,2) not null default 0,
  delivery_fee numeric(14,2) not null default 0,
  status text not null default 'assigned',
  assigned_at timestamptz not null default now(),
  out_for_delivery_at timestamptz,
  delivered_at timestamptz,
  settlement_status text not null default 'pending',
  settled_at timestamptz,
  settlement_note text,
  created_by uuid
    references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint delivery_assignments_status_check
    check (
      status in (
        'assigned',
        'out_for_delivery',
        'delivered',
        'canceled',
        'reassigned'
      )
    ),
  constraint delivery_assignments_settlement_check
    check (
      settlement_status in (
        'pending',
        'settled',
        'waived'
      )
    ),
  constraint delivery_assignments_amounts_check
    check (
      order_total >= 0
      and delivery_fee >= 0
    )
);

create index if not exists delivery_assignments_company_assigned_idx
  on public.delivery_assignments (
    company_id,
    assigned_at desc
  );

create index if not exists delivery_assignments_delivery_idx
  on public.delivery_assignments (
    delivery_id,
    assigned_at desc
  );

create index if not exists delivery_assignments_driver_idx
  on public.delivery_assignments (
    company_id,
    driver_id,
    assigned_at desc
  );

create index if not exists delivery_assignments_settlement_idx
  on public.delivery_assignments (
    company_id,
    settlement_status,
    assigned_at desc
  );

alter table public.delivery_drivers enable row level security;
alter table public.delivery_assignments enable row level security;

drop policy if exists delivery_drivers_company_access
  on public.delivery_drivers;

create policy delivery_drivers_company_access
on public.delivery_drivers
for all
to authenticated
using (
  orcaly_private.can_manage_company(company_id)
)
with check (
  orcaly_private.can_manage_company(company_id)
);

drop policy if exists delivery_assignments_company_access
  on public.delivery_assignments;

create policy delivery_assignments_company_access
on public.delivery_assignments
for all
to authenticated
using (
  orcaly_private.can_manage_company(company_id)
)
with check (
  orcaly_private.can_manage_company(company_id)
);

revoke all on public.delivery_drivers from anon;
revoke all on public.delivery_assignments from anon;

grant select, insert, update, delete
  on public.delivery_drivers
  to authenticated;

grant select, insert, update, delete
  on public.delivery_assignments
  to authenticated;

comment on table public.delivery_drivers is
  'Entregadores cadastrados por empresa para alocacao de entregas.';

comment on table public.delivery_assignments is
  'Historico por snapshot de cada alocacao e prestacao de contas.';

commit;
