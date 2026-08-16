-- ORÇALY - SITES PREMIUM INTELIGENTES POR SEGMENTO
-- Seguro/idempotente: não apaga dados, não usa DROP.
-- Rode no Supabase antes de usar o novo editor em produção.

alter table public.companies
  add column if not exists site_template text;

alter table public.companies
  add column if not exists site_theme text;

alter table public.companies
  add column if not exists site_primary_color text;

alter table public.companies
  add column if not exists site_accent_color text;

alter table public.companies
  add column if not exists site_headline text;

alter table public.companies
  add column if not exists site_subheadline text;

alter table public.companies
  add column if not exists site_cta_label text;

alter table public.companies
  add column if not exists site_about_title text;

alter table public.companies
  add column if not exists site_about_text text;

alter table public.companies
  add column if not exists site_sections jsonb default '[]'::jsonb;

alter table public.companies
  add column if not exists site_benefits jsonb default '[]'::jsonb;

alter table public.companies
  add column if not exists site_faq jsonb default '[]'::jsonb;

alter table public.companies
  add column if not exists site_testimonials jsonb default '[]'::jsonb;

alter table public.companies
  add column if not exists site_gallery jsonb default '[]'::jsonb;

alter table public.companies
  add column if not exists site_features jsonb default '[]'::jsonb;

alter table public.companies
  add column if not exists site_payment_methods jsonb default '[]'::jsonb;

alter table public.companies
  add column if not exists site_delivery_options jsonb default '[]'::jsonb;

alter table public.companies
  add column if not exists site_updated_at timestamptz;

alter table public.companies
  add column if not exists logo_url text;

alter table public.companies
  add column if not exists business_type text default 'services';

create index if not exists companies_business_type_idx
  on public.companies (business_type);

-- Preenche apenas o business_type vazio para empresas antigas.
update public.companies
set business_type = 'services'
where business_type is null or business_type = '';
