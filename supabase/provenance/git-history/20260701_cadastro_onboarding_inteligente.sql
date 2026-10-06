-- ORÇALY - CADASTRO / ONBOARDING INTELIGENTE
-- Seguro/idempotente: não apaga dados, não usa DROP.
-- Rode no Supabase antes de usar o novo cadastro em produção.

create extension if not exists "pgcrypto";

alter table public.companies
  add column if not exists business_type text default 'services';

alter table public.companies
  add column if not exists onboarding_goal text;

alter table public.companies
  add column if not exists site_template text;

alter table public.companies
  add column if not exists site_headline text;

alter table public.companies
  add column if not exists site_subheadline text;

alter table public.companies
  add column if not exists site_about_title text;

alter table public.companies
  add column if not exists site_about_text text;

alter table public.companies
  add column if not exists site_benefits jsonb default '[]'::jsonb;

alter table public.companies
  add column if not exists site_faq jsonb default '[]'::jsonb;

alter table public.companies
  add column if not exists site_features jsonb default '[]'::jsonb;

alter table public.companies
  add column if not exists site_updated_at timestamptz;

alter table public.companies
  add column if not exists subdomain_slug text;

create index if not exists companies_business_type_idx
  on public.companies (business_type);

create index if not exists companies_subdomain_slug_idx
  on public.companies (subdomain_slug);

-- Mantém empresas antigas com um tipo padrão sem sobrescrever quem já tem valor.
update public.companies
set business_type = 'services'
where business_type is null or business_type = '';
