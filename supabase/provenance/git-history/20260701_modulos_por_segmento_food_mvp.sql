-- ORÇALY - ARQUITETURA MODULAR POR SEGMENTO + FOOD MVP
-- Seguro/idempotente: não apaga dados, não usa DROP TABLE.
-- Objetivo: core único + módulos por segmento + templates/campos específicos.

create extension if not exists "pgcrypto";

-- =========================
-- COMPANIES
-- =========================

alter table public.companies
  add column if not exists business_type text default 'services';

alter table public.companies
  add column if not exists site_template text;

alter table public.companies
  add column if not exists site_layout text;

alter table public.companies
  add column if not exists logo_url text;

alter table public.companies
  add column if not exists site_banner_url text;

alter table public.companies
  add column if not exists site_headline text;

alter table public.companies
  add column if not exists site_subheadline text;

alter table public.companies
  add column if not exists site_about_title text;

alter table public.companies
  add column if not exists site_about_text text;

alter table public.companies
  add column if not exists site_features jsonb default '[]'::jsonb;

alter table public.companies
  add column if not exists site_benefits jsonb default '[]'::jsonb;

alter table public.companies
  add column if not exists site_faq jsonb default '[]'::jsonb;

alter table public.companies
  add column if not exists site_testimonials jsonb default '[]'::jsonb;

alter table public.companies
  add column if not exists site_gallery jsonb default '[]'::jsonb;

alter table public.companies
  add column if not exists site_payment_methods jsonb default '[]'::jsonb;

alter table public.companies
  add column if not exists site_delivery_options jsonb default '[]'::jsonb;

alter table public.companies
  add column if not exists site_updated_at timestamptz;

create index if not exists companies_business_type_idx
  on public.companies (business_type);

-- Mantém compatibilidade com templates antigos do Orçaly.
update public.companies
set business_type = case
  when business_type is not null and business_type <> '' then business_type
  when site_template in ('alimenticio', 'food') then 'food'
  when site_template in ('grafica', 'graphic', 'personalizados') then 'graphic'
  when site_template in ('estetica', 'beauty') then 'beauty'
  when site_template in ('barbearia', 'barber') then 'barber'
  when site_template in ('assistencia', 'technical_assistance') then 'technical_assistance'
  when site_template in ('oficina', 'auto') then 'auto'
  when site_template in ('loja', 'store') then 'store'
  when site_template in ('eventos', 'events') then 'events'
  else 'services'
end
where business_type is null or business_type = '';

-- =========================
-- PRODUCTS
-- =========================

alter table public.products
  add column if not exists business_type text;

alter table public.products
  add column if not exists extras jsonb default '{}'::jsonb;

alter table public.products
  add column if not exists variations jsonb default '[]'::jsonb;

alter table public.products
  add column if not exists addons jsonb default '[]'::jsonb;

alter table public.products
  add column if not exists available boolean default true;

alter table public.products
  add column if not exists video_url text;

alter table public.products
  add column if not exists image_urls text[] default '{}'::text[];

create index if not exists products_company_business_type_idx
  on public.products (company_id, business_type);

-- Compatibilidade com produtos antigos.
update public.products
set image_urls = array[imagem_url]
where imagem_url is not null
  and imagem_url <> ''
  and (
    image_urls is null
    or array_length(image_urls, 1) is null
    or array_length(image_urls, 1) = 0
  );

update public.products
set business_type = c.business_type
from public.companies c
where public.products.company_id = c.id
  and (public.products.business_type is null or public.products.business_type = '');

update public.products
set available = coalesce(ativo, true)
where available is null;

-- =========================
-- FOOD MVP: ZONAS DE ENTREGA
-- =========================

create table if not exists public.delivery_zones (
  id uuid primary key default gen_random_uuid(),
  company_id uuid references public.companies(id) on delete cascade,
  name text not null,
  fee numeric(10,2) default 0,
  min_order numeric(10,2),
  active boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists delivery_zones_company_idx
  on public.delivery_zones(company_id);

-- =========================
-- HORÁRIOS DE FUNCIONAMENTO
-- =========================

create table if not exists public.business_hours (
  id uuid primary key default gen_random_uuid(),
  company_id uuid references public.companies(id) on delete cascade,
  weekday int not null,
  opens_at time,
  closes_at time,
  active boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists business_hours_company_idx
  on public.business_hours(company_id);

-- =========================
-- GRANTS
-- =========================

grant select, update on public.companies to authenticated;
grant select, insert, update on public.products to authenticated;
grant select, insert, update on public.delivery_zones to authenticated;
grant select, insert, update on public.business_hours to authenticated;
grant select on public.delivery_zones to anon;
grant select on public.business_hours to anon;
