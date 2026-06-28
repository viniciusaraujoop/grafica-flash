-- ORÇALY OPERAÇÃO INTELIGENTE
-- CRM, tarefas, notificações, auditoria, saúde do sistema e IA integrada.
-- Idempotente: pode rodar mais de uma vez.

create extension if not exists "pgcrypto";

-- =========================
-- CRM / FUNIL
-- =========================

create table if not exists public.crm_leads (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null,
  nome text not null,
  telefone text,
  email text,
  origem text default 'manual',
  etapa text not null default 'novo_lead',
  status text not null default 'ativo',
  valor_estimado numeric default 0,
  proximo_contato_em timestamp with time zone,
  observacoes text,
  tags text[],
  order_id uuid,
  proposal_id uuid,
  created_by uuid,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now()
);

create index if not exists idx_crm_leads_company_id on public.crm_leads(company_id);
create index if not exists idx_crm_leads_etapa on public.crm_leads(company_id, etapa);
create index if not exists idx_crm_leads_next_contact on public.crm_leads(company_id, proximo_contato_em);

-- =========================
-- TAREFAS
-- =========================

create table if not exists public.internal_tasks (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null,
  titulo text not null,
  descricao text,
  status text not null default 'pendente',
  prioridade text not null default 'media',
  due_at timestamp with time zone,
  responsavel_id uuid,
  created_by uuid,
  crm_lead_id uuid,
  order_id uuid,
  proposal_id uuid,
  completed_at timestamp with time zone,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now()
);

create index if not exists idx_internal_tasks_company_id on public.internal_tasks(company_id);
create index if not exists idx_internal_tasks_status on public.internal_tasks(company_id, status);
create index if not exists idx_internal_tasks_due on public.internal_tasks(company_id, due_at);

-- =========================
-- NOTIFICAÇÕES
-- =========================

create table if not exists public.app_notifications (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null,
  user_id uuid,
  tipo text not null default 'info',
  titulo text not null,
  mensagem text,
  link_url text,
  status text not null default 'unread',
  payload jsonb not null default '{}'::jsonb,
  read_at timestamp with time zone,
  created_at timestamp with time zone not null default now()
);

create index if not exists idx_app_notifications_company_id on public.app_notifications(company_id);
create index if not exists idx_app_notifications_status on public.app_notifications(company_id, status);
create index if not exists idx_app_notifications_created on public.app_notifications(company_id, created_at desc);

-- =========================
-- AUDITORIA
-- =========================

create table if not exists public.system_audit_logs (
  id uuid primary key default gen_random_uuid(),
  company_id uuid,
  user_id uuid,
  action text not null,
  entity text,
  entity_id text,
  details jsonb not null default '{}'::jsonb,
  ip text,
  user_agent text,
  created_at timestamp with time zone not null default now()
);

create index if not exists idx_system_audit_logs_company_id on public.system_audit_logs(company_id);
create index if not exists idx_system_audit_logs_created on public.system_audit_logs(company_id, created_at desc);

-- =========================
-- PRODUTOS: CAMPOS AVANÇADOS SE FALTAREM
-- =========================

alter table public.products add column if not exists tipo text default 'produto';
alter table public.products add column if not exists categoria text;
alter table public.products add column if not exists subcategoria text;
alter table public.products add column if not exists preco_sob_consulta boolean default false;
alter table public.products add column if not exists estoque integer;
alter table public.products add column if not exists promocao_ativa boolean default false;
alter table public.products add column if not exists preco_promocional numeric;
alter table public.products add column if not exists campos_orcamento jsonb default '[]'::jsonb;
alter table public.products add column if not exists configuracoes jsonb default '{}'::jsonb;
alter table public.products add column if not exists arquivado boolean default false;

-- =========================
-- VIEW RESUMO
-- =========================

create or replace view public.orcaly_company_health as
select
  c.id as company_id,
  c.nome,
  c.slug,
  c.assinatura_status,
  c.site_publico_ativo,
  c.site_template,
  c.logo_url,
  c.whatsapp,
  c.whatsapp_enabled,
  (select count(*) from public.products p where p.company_id = c.id and coalesce(p.arquivado, false) = false) as products_count,
  (select count(*) from public.orders o where o.company_id = c.id) as orders_count,
  (select count(*) from public.crm_leads l where l.company_id = c.id and l.status = 'ativo') as leads_count,
  (select count(*) from public.internal_tasks t where t.company_id = c.id and t.status <> 'concluida') as open_tasks_count,
  (select count(*) from public.app_notifications n where n.company_id = c.id and n.status = 'unread') as unread_notifications_count
from public.companies c;

grant select on public.orcaly_company_health to authenticated;

-- =========================
-- GRANTS
-- =========================

grant select, insert, update on public.crm_leads to authenticated;
grant select, insert, update on public.internal_tasks to authenticated;
grant select, insert, update on public.app_notifications to authenticated;
grant select, insert on public.system_audit_logs to authenticated;
grant select, update on public.products to authenticated;
