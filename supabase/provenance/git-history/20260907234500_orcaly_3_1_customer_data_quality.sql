-- Orçaly 3.1 customer directory, normalization and deterministic data-quality engine.

create index if not exists automation_runs_outbox_event_id_idx
  on public.automation_runs (outbox_event_id);

create or replace function public.orcaly_normalize_email(p_value text)
returns text
language sql
immutable
strict
as $$
  select nullif(lower(btrim(p_value)), '')
$$;

create or replace function public.orcaly_normalize_phone_br(p_value text)
returns text
language plpgsql
immutable
strict
as $$
declare
  digits text;
begin
  digits := regexp_replace(p_value, '[^0-9]', '', 'g');
  if digits = '' then return null; end if;
  if length(digits) in (10,11) then return '+55' || digits; end if;
  if length(digits) in (12,13) and left(digits,2) = '55' then return '+' || digits; end if;
  return null;
end;
$$;

create or replace function public.orcaly_normalize_name(p_value text)
returns text
language sql
immutable
strict
as $$
  select nullif(regexp_replace(lower(btrim(p_value)), '[^a-z0-9áàâãéèêíïóôõöúçñ ]', '', 'g'), '')
$$;

revoke all on function public.orcaly_normalize_email(text) from public, anon, authenticated;
revoke all on function public.orcaly_normalize_phone_br(text) from public, anon, authenticated;
revoke all on function public.orcaly_normalize_name(text) from public, anon, authenticated;
grant execute on function public.orcaly_normalize_email(text) to service_role;
grant execute on function public.orcaly_normalize_phone_br(text) to service_role;
grant execute on function public.orcaly_normalize_name(text) to service_role;

create table if not exists public.customer_profiles (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  contact_key text not null,
  display_name text,
  normalized_name text,
  phone_raw text,
  phone_normalized text,
  email_raw text,
  email_normalized text,
  source text not null default 'manual'
    check (source in ('manual','public_site','whatsapp','api','import','automation','ai','portal','system')),
  source_id text,
  created_by uuid,
  updated_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_activity_at timestamptz,
  merged_into_id uuid references public.customer_profiles(id) on delete set null,
  archived boolean not null default false,
  metadata jsonb not null default '{}'::jsonb,
  unique (company_id, contact_key)
);

create index if not exists customer_profiles_company_phone_idx
  on public.customer_profiles (company_id, phone_normalized)
  where phone_normalized is not null and archived = false;
create index if not exists customer_profiles_company_email_idx
  on public.customer_profiles (company_id, email_normalized)
  where email_normalized is not null and archived = false;
create index if not exists customer_profiles_company_name_idx
  on public.customer_profiles (company_id, normalized_name)
  where normalized_name is not null and archived = false;
create index if not exists customer_profiles_merged_into_idx
  on public.customer_profiles (merged_into_id)
  where merged_into_id is not null;

create table if not exists public.customer_duplicate_candidates (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  left_customer_id uuid not null references public.customer_profiles(id) on delete cascade,
  right_customer_id uuid not null references public.customer_profiles(id) on delete cascade,
  reasons jsonb not null default '[]'::jsonb,
  confidence integer not null default 0 check (confidence between 0 and 100),
  status text not null default 'needs_review'
    check (status in ('needs_review','dismissed','merged')),
  reviewed_by uuid,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (left_customer_id <> right_customer_id),
  unique (company_id, left_customer_id, right_customer_id)
);

create index if not exists customer_duplicate_candidates_review_idx
  on public.customer_duplicate_candidates (company_id, status, confidence desc, created_at desc);
create index if not exists customer_duplicate_candidates_right_idx
  on public.customer_duplicate_candidates (right_customer_id);

create table if not exists public.data_quality_issues (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  fingerprint text not null,
  rule_key text not null,
  severity text not null check (severity in ('CRITICAL','HIGH','MEDIUM','LOW','INFO')),
  entity_type text not null,
  entity_id text,
  title text not null,
  detail text not null,
  recommended_action text not null,
  auto_fixable boolean not null default false,
  status text not null default 'open' check (status in ('open','resolved','ignored')),
  metadata jsonb not null default '{}'::jsonb,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  resolved_at timestamptz,
  unique (company_id, fingerprint)
);

create index if not exists data_quality_issues_company_status_idx
  on public.data_quality_issues (company_id, status, severity, last_seen_at desc);

create table if not exists public.product_analytics_events (
  id bigint generated always as identity primary key,
  company_id uuid references public.companies(id) on delete cascade,
  user_id uuid,
  session_id text,
  event_name text not null,
  source text not null default 'app',
  occurred_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb
);

create index if not exists product_analytics_events_event_time_idx
  on public.product_analytics_events (event_name, occurred_at desc);
create index if not exists product_analytics_events_company_time_idx
  on public.product_analytics_events (company_id, occurred_at desc);

create table if not exists public.company_health_snapshots (
  id bigint generated always as identity primary key,
  company_id uuid not null references public.companies(id) on delete cascade,
  score integer not null check (score between 0 and 100),
  reasons jsonb not null default '[]'::jsonb,
  metrics jsonb not null default '{}'::jsonb,
  calculated_at timestamptz not null default now()
);

create index if not exists company_health_snapshots_company_time_idx
  on public.company_health_snapshots (company_id, calculated_at desc);

create table if not exists public.demo_data_registry (
  id bigint generated always as identity primary key,
  company_id uuid not null references public.companies(id) on delete cascade,
  entity_type text not null,
  entity_id text not null,
  template_key text,
  created_at timestamptz not null default now(),
  unique (company_id, entity_type, entity_id)
);

create index if not exists demo_data_registry_company_idx
  on public.demo_data_registry (company_id, created_at desc);

-- Link legacy business entities to the additive customer directory without replacing their existing keys.
alter table public.orders add column if not exists customer_profile_id uuid references public.customer_profiles(id) on delete set null;
alter table public.proposals add column if not exists customer_profile_id uuid references public.customer_profiles(id) on delete set null;
alter table public.crm_leads add column if not exists customer_profile_id uuid references public.customer_profiles(id) on delete set null;
alter table public.customer_notes add column if not exists customer_profile_id uuid references public.customer_profiles(id) on delete set null;
alter table public.customer_followups add column if not exists customer_profile_id uuid references public.customer_profiles(id) on delete set null;
alter table public.financial_transactions add column if not exists customer_profile_id uuid references public.customer_profiles(id) on delete set null;

create index if not exists orders_customer_profile_id_idx on public.orders(customer_profile_id);
create index if not exists proposals_customer_profile_id_idx on public.proposals(customer_profile_id);
create index if not exists crm_leads_customer_profile_id_idx on public.crm_leads(customer_profile_id);
create index if not exists customer_notes_customer_profile_id_idx on public.customer_notes(customer_profile_id);
create index if not exists customer_followups_customer_profile_id_idx on public.customer_followups(customer_profile_id);
create index if not exists financial_transactions_customer_profile_id_idx on public.financial_transactions(customer_profile_id);

alter table public.timeline_events
  add constraint timeline_events_customer_profile_id_fkey
  foreign key (customer_profile_id) references public.customer_profiles(id) on delete set null;

-- Provenance additions are nullable and backwards-compatible.
alter table public.orders add column if not exists created_by uuid;
alter table public.orders add column if not exists updated_by uuid;
alter table public.orders add column if not exists source_id text;
alter table public.proposals add column if not exists created_by uuid;
alter table public.proposals add column if not exists updated_by uuid;
alter table public.proposals add column if not exists source_id text;
alter table public.products add column if not exists created_by uuid;
alter table public.products add column if not exists updated_by uuid;
alter table public.products add column if not exists source text;
alter table public.products add column if not exists source_id text;

-- New operational tables stay server-only; authenticated users reach them through tenant-aware Next routes.
do $$
declare
  t text;
begin
  foreach t in array array[
    'customer_profiles','customer_duplicate_candidates','data_quality_issues',
    'product_analytics_events','company_health_snapshots','demo_data_registry'
  ] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all privileges on table public.%I from anon, authenticated', t);
    execute format('grant select, insert, update, delete on table public.%I to service_role', t);
  end loop;
end $$;

grant usage, select on sequence public.product_analytics_events_id_seq to service_role;
grant usage, select on sequence public.company_health_snapshots_id_seq to service_role;
grant usage, select on sequence public.demo_data_registry_id_seq to service_role;

create or replace function public.refresh_customer_directory(p_company_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_profiles integer := 0;
  v_candidates integer := 0;
begin
  if p_company_id is null or not exists(select 1 from public.companies where id=p_company_id) then
    raise exception 'COMPANY_NOT_FOUND' using errcode='22023';
  end if;

  -- CRM sources.
  insert into public.customer_profiles(
    company_id,contact_key,display_name,normalized_name,phone_raw,phone_normalized,email_raw,email_normalized,
    source,source_id,last_activity_at,metadata
  )
  select
    l.company_id,
    coalesce('phone:'||public.orcaly_normalize_phone_br(l.telefone),
             'email:'||public.orcaly_normalize_email(l.email),
             'crm:'||l.id::text),
    nullif(btrim(l.nome),''), public.orcaly_normalize_name(l.nome),
    nullif(btrim(l.telefone),''), public.orcaly_normalize_phone_br(l.telefone),
    nullif(btrim(l.email),''), public.orcaly_normalize_email(l.email),
    case when lower(coalesce(l.origem,''))='whatsapp' then 'whatsapp' when lower(coalesce(l.origem,''))='api' then 'api' else 'manual' end,
    'crm:'||l.id::text,
    coalesce(l.updated_at,l.created_at),
    jsonb_build_object('crm_lead_id',l.id)
  from public.crm_leads l
  where l.company_id=p_company_id
    and (nullif(btrim(l.nome),'') is not null or nullif(btrim(l.telefone),'') is not null or nullif(btrim(l.email),'') is not null)
  on conflict(company_id,contact_key) do update
    set display_name=coalesce(excluded.display_name,public.customer_profiles.display_name),
        normalized_name=coalesce(excluded.normalized_name,public.customer_profiles.normalized_name),
        phone_raw=coalesce(excluded.phone_raw,public.customer_profiles.phone_raw),
        phone_normalized=coalesce(excluded.phone_normalized,public.customer_profiles.phone_normalized),
        email_raw=coalesce(excluded.email_raw,public.customer_profiles.email_raw),
        email_normalized=coalesce(excluded.email_normalized,public.customer_profiles.email_normalized),
        last_activity_at=greatest(coalesce(public.customer_profiles.last_activity_at,'epoch'::timestamptz),coalesce(excluded.last_activity_at,'epoch'::timestamptz)),
        updated_at=now(),
        metadata=public.customer_profiles.metadata||excluded.metadata;

  -- Order sources, using exact normalized contact as deterministic identity where available.
  insert into public.customer_profiles(
    company_id,contact_key,display_name,normalized_name,phone_raw,phone_normalized,email_raw,email_normalized,
    source,source_id,last_activity_at,metadata
  )
  select distinct on (o.company_id,coalesce(public.orcaly_normalize_phone_br(coalesce(o.customer_phone,o.telefone)),public.orcaly_normalize_email(o.customer_email),o.id::text))
    o.company_id,
    coalesce('phone:'||public.orcaly_normalize_phone_br(coalesce(o.customer_phone,o.telefone)),
             'email:'||public.orcaly_normalize_email(o.customer_email),
             'order:'||o.id::text),
    nullif(btrim(coalesce(o.customer_name,o.nome)),''), public.orcaly_normalize_name(coalesce(o.customer_name,o.nome)),
    nullif(btrim(coalesce(o.customer_phone,o.telefone)),''), public.orcaly_normalize_phone_br(coalesce(o.customer_phone,o.telefone)),
    nullif(btrim(o.customer_email),''), public.orcaly_normalize_email(o.customer_email),
    case when lower(coalesce(o.source,o.canal_origem,''))='whatsapp' then 'whatsapp' when lower(coalesce(o.source,o.canal_origem,''))='api' then 'api' else 'public_site' end,
    'order:'||o.id::text,
    coalesce(o.updated_at,o.created_at),
    jsonb_build_object('latest_order_id',o.id)
  from public.orders o
  where o.company_id=p_company_id
    and (nullif(btrim(coalesce(o.customer_name,o.nome)),'') is not null
      or nullif(btrim(coalesce(o.customer_phone,o.telefone)),'') is not null
      or nullif(btrim(o.customer_email),'') is not null)
  order by o.company_id,coalesce(public.orcaly_normalize_phone_br(coalesce(o.customer_phone,o.telefone)),public.orcaly_normalize_email(o.customer_email),o.id::text),coalesce(o.updated_at,o.created_at) desc
  on conflict(company_id,contact_key) do update
    set display_name=coalesce(excluded.display_name,public.customer_profiles.display_name),
        normalized_name=coalesce(excluded.normalized_name,public.customer_profiles.normalized_name),
        phone_raw=coalesce(excluded.phone_raw,public.customer_profiles.phone_raw),
        phone_normalized=coalesce(excluded.phone_normalized,public.customer_profiles.phone_normalized),
        email_raw=coalesce(excluded.email_raw,public.customer_profiles.email_raw),
        email_normalized=coalesce(excluded.email_normalized,public.customer_profiles.email_normalized),
        last_activity_at=greatest(coalesce(public.customer_profiles.last_activity_at,'epoch'::timestamptz),coalesce(excluded.last_activity_at,'epoch'::timestamptz)),
        updated_at=now(),metadata=public.customer_profiles.metadata||excluded.metadata;

  -- Proposal sources.
  insert into public.customer_profiles(
    company_id,contact_key,display_name,normalized_name,phone_raw,phone_normalized,email_raw,email_normalized,
    source,source_id,last_activity_at,metadata
  )
  select distinct on (p.company_id,coalesce(public.orcaly_normalize_phone_br(p.cliente_whatsapp),public.orcaly_normalize_email(p.cliente_email),p.id::text))
    p.company_id,
    coalesce('phone:'||public.orcaly_normalize_phone_br(p.cliente_whatsapp),
             'email:'||public.orcaly_normalize_email(p.cliente_email),
             'proposal:'||p.id::text),
    nullif(btrim(p.cliente_nome),''),public.orcaly_normalize_name(p.cliente_nome),
    nullif(btrim(p.cliente_whatsapp),''),public.orcaly_normalize_phone_br(p.cliente_whatsapp),
    nullif(btrim(p.cliente_email),''),public.orcaly_normalize_email(p.cliente_email),
    case when lower(coalesce(p.origem,''))='whatsapp' then 'whatsapp' when lower(coalesce(p.origem,''))='api' then 'api' else 'manual' end,
    'proposal:'||p.id::text,coalesce(p.updated_at,p.created_at),jsonb_build_object('latest_proposal_id',p.id)
  from public.proposals p
  where p.company_id=p_company_id
    and (nullif(btrim(p.cliente_nome),'') is not null or nullif(btrim(p.cliente_whatsapp),'') is not null or nullif(btrim(p.cliente_email),'') is not null)
  order by p.company_id,coalesce(public.orcaly_normalize_phone_br(p.cliente_whatsapp),public.orcaly_normalize_email(p.cliente_email),p.id::text),coalesce(p.updated_at,p.created_at) desc
  on conflict(company_id,contact_key) do update
    set display_name=coalesce(excluded.display_name,public.customer_profiles.display_name),
        normalized_name=coalesce(excluded.normalized_name,public.customer_profiles.normalized_name),
        phone_raw=coalesce(excluded.phone_raw,public.customer_profiles.phone_raw),
        phone_normalized=coalesce(excluded.phone_normalized,public.customer_profiles.phone_normalized),
        email_raw=coalesce(excluded.email_raw,public.customer_profiles.email_raw),
        email_normalized=coalesce(excluded.email_normalized,public.customer_profiles.email_normalized),
        last_activity_at=greatest(coalesce(public.customer_profiles.last_activity_at,'epoch'::timestamptz),coalesce(excluded.last_activity_at,'epoch'::timestamptz)),
        updated_at=now(),metadata=public.customer_profiles.metadata||excluded.metadata;

  -- Backfill links deterministically by exact phone first, then email.
  update public.crm_leads l set customer_profile_id=c.id
  from public.customer_profiles c
  where l.company_id=p_company_id and c.company_id=p_company_id and c.archived=false
    and c.contact_key=coalesce('phone:'||public.orcaly_normalize_phone_br(l.telefone),'email:'||public.orcaly_normalize_email(l.email),'crm:'||l.id::text)
    and l.customer_profile_id is distinct from c.id;

  update public.orders o set customer_profile_id=c.id
  from public.customer_profiles c
  where o.company_id=p_company_id and c.company_id=p_company_id and c.archived=false
    and c.contact_key=coalesce('phone:'||public.orcaly_normalize_phone_br(coalesce(o.customer_phone,o.telefone)),'email:'||public.orcaly_normalize_email(o.customer_email),'order:'||o.id::text)
    and o.customer_profile_id is distinct from c.id;

  update public.proposals p set customer_profile_id=c.id
  from public.customer_profiles c
  where p.company_id=p_company_id and c.company_id=p_company_id and c.archived=false
    and c.contact_key=coalesce('phone:'||public.orcaly_normalize_phone_br(p.cliente_whatsapp),'email:'||public.orcaly_normalize_email(p.cliente_email),'proposal:'||p.id::text)
    and p.customer_profile_id is distinct from c.id;

  update public.customer_notes n set customer_profile_id=c.id
  from public.customer_profiles c
  where n.company_id=p_company_id and c.company_id=p_company_id and c.archived=false
    and c.phone_normalized=public.orcaly_normalize_phone_br(n.cliente_telefone)
    and n.customer_profile_id is distinct from c.id;

  update public.customer_followups f set customer_profile_id=c.id
  from public.customer_profiles c
  where f.company_id=p_company_id and c.company_id=p_company_id and c.archived=false
    and c.phone_normalized=public.orcaly_normalize_phone_br(f.cliente_telefone)
    and f.customer_profile_id is distinct from c.id;

  -- Exact email shared across different phone identities is strong duplicate evidence.
  insert into public.customer_duplicate_candidates(company_id,left_customer_id,right_customer_id,reasons,confidence)
  select p_company_id,a.id,b.id,jsonb_build_array('same_normalized_email'),95
  from public.customer_profiles a
  join public.customer_profiles b on b.company_id=a.company_id and b.id>a.id
  where a.company_id=p_company_id and a.archived=false and b.archived=false
    and a.email_normalized is not null and a.email_normalized=b.email_normalized
    and a.contact_key<>b.contact_key
  on conflict(company_id,left_customer_id,right_customer_id) do update
    set reasons=excluded.reasons,confidence=greatest(public.customer_duplicate_candidates.confidence,excluded.confidence),updated_at=now();

  -- Exact normalized name with conflicting/nonexistent contact is review-only, never auto-merged.
  insert into public.customer_duplicate_candidates(company_id,left_customer_id,right_customer_id,reasons,confidence)
  select p_company_id,a.id,b.id,jsonb_build_array('same_normalized_name'),60
  from public.customer_profiles a
  join public.customer_profiles b on b.company_id=a.company_id and b.id>a.id
  where a.company_id=p_company_id and a.archived=false and b.archived=false
    and length(coalesce(a.normalized_name,''))>=5 and a.normalized_name=b.normalized_name
    and a.contact_key<>b.contact_key
    and coalesce(a.email_normalized,'')<>coalesce(b.email_normalized,'')
    and coalesce(a.phone_normalized,'')<>coalesce(b.phone_normalized,'')
  on conflict(company_id,left_customer_id,right_customer_id) do update
    set reasons=(public.customer_duplicate_candidates.reasons||excluded.reasons),confidence=greatest(public.customer_duplicate_candidates.confidence,excluded.confidence),updated_at=now();

  select count(*) into v_profiles from public.customer_profiles where company_id=p_company_id and archived=false;
  select count(*) into v_candidates from public.customer_duplicate_candidates where company_id=p_company_id and status='needs_review';
  return jsonb_build_object('profiles',v_profiles,'duplicate_candidates',v_candidates);
end;
$$;

revoke all on function public.refresh_customer_directory(uuid) from public, anon, authenticated;
grant execute on function public.refresh_customer_directory(uuid) to service_role;

create or replace function public.refresh_company_data_quality(p_company_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_open integer;
  v_score integer;
begin
  if p_company_id is null or not exists(select 1 from public.companies where id=p_company_id) then
    raise exception 'COMPANY_NOT_FOUND' using errcode='22023';
  end if;

  perform public.refresh_customer_directory(p_company_id);

  update public.data_quality_issues
     set status='resolved',resolved_at=now()
   where company_id=p_company_id and status='open';

  -- Customer completeness and contact validation.
  insert into public.data_quality_issues(company_id,fingerprint,rule_key,severity,entity_type,entity_id,title,detail,recommended_action,auto_fixable,status,last_seen_at,resolved_at)
  select p_company_id,md5('customer_missing_contact:'||c.id::text),'customer_missing_contact','MEDIUM','customer',c.id::text,
    'Cliente sem contato','Não há telefone nem e-mail normalizado para este cliente.','Adicione ao menos um meio de contato válido.',false,'open',now(),null
  from public.customer_profiles c
  where c.company_id=p_company_id and c.archived=false and c.phone_normalized is null and c.email_normalized is null
  on conflict(company_id,fingerprint) do update set status='open',last_seen_at=now(),resolved_at=null,detail=excluded.detail;

  insert into public.data_quality_issues(company_id,fingerprint,rule_key,severity,entity_type,entity_id,title,detail,recommended_action,auto_fixable,status,last_seen_at,resolved_at)
  select p_company_id,md5('customer_invalid_phone:'||c.id::text),'customer_invalid_phone','HIGH','customer',c.id::text,
    'Telefone inválido','O telefone informado não pôde ser normalizado com segurança para E.164 Brasil.','Revise DDD, quantidade de dígitos e código do país.',false,'open',now(),null
  from public.customer_profiles c
  where c.company_id=p_company_id and c.archived=false and nullif(btrim(c.phone_raw),'') is not null and c.phone_normalized is null
  on conflict(company_id,fingerprint) do update set status='open',last_seen_at=now(),resolved_at=null,detail=excluded.detail;

  insert into public.data_quality_issues(company_id,fingerprint,rule_key,severity,entity_type,entity_id,title,detail,recommended_action,auto_fixable,status,last_seen_at,resolved_at)
  select p_company_id,md5('customer_invalid_email:'||c.id::text),'customer_invalid_email','HIGH','customer',c.id::text,
    'E-mail inválido','O e-mail informado não possui uma estrutura válida.','Corrija o endereço de e-mail antes de utilizá-lo em comunicação.',false,'open',now(),null
  from public.customer_profiles c
  where c.company_id=p_company_id and c.archived=false and nullif(btrim(c.email_raw),'') is not null
    and c.email_normalized !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
  on conflict(company_id,fingerprint) do update set status='open',last_seen_at=now(),resolved_at=null,detail=excluded.detail;

  -- Duplicate candidates are intentionally review-only.
  insert into public.data_quality_issues(company_id,fingerprint,rule_key,severity,entity_type,entity_id,title,detail,recommended_action,auto_fixable,status,metadata,last_seen_at,resolved_at)
  select p_company_id,md5('customer_duplicate:'||d.id::text),'customer_duplicate_candidate','MEDIUM','customer_duplicate',d.id::text,
    'Possível cliente duplicado','Dois perfis apresentam sinais determinísticos de duplicidade.','Revise as diferenças antes de mesclar. Nenhum merge automático será executado.',false,'open',
    jsonb_build_object('confidence',d.confidence,'reasons',d.reasons),now(),null
  from public.customer_duplicate_candidates d
  where d.company_id=p_company_id and d.status='needs_review'
  on conflict(company_id,fingerprint) do update set status='open',last_seen_at=now(),resolved_at=null,metadata=excluded.metadata;

  -- Orders without a usable item representation.
  insert into public.data_quality_issues(company_id,fingerprint,rule_key,severity,entity_type,entity_id,title,detail,recommended_action,auto_fixable,status,last_seen_at,resolved_at)
  select p_company_id,md5('order_no_items:'||o.id::text),'order_no_items','HIGH','order',o.id::text,
    'Pedido sem itens','O pedido não possui item relacional, snapshot nem produto legado identificável.','Revise o pedido e associe pelo menos um item real.',false,'open',now(),null
  from public.orders o
  where o.company_id=p_company_id
    and not exists(select 1 from public.order_items i where i.order_id=o.id)
    and (o.items_snapshot is null or o.items_snapshot='[]'::jsonb or o.items_snapshot='{}'::jsonb)
    and nullif(btrim(o.produto),'') is null
  on conflict(company_id,fingerprint) do update set status='open',last_seen_at=now(),resolved_at=null;

  -- Impossible or inconsistent order values.
  insert into public.data_quality_issues(company_id,fingerprint,rule_key,severity,entity_type,entity_id,title,detail,recommended_action,auto_fixable,status,last_seen_at,resolved_at)
  select p_company_id,md5('order_negative_total:'||o.id::text),'order_negative_total','CRITICAL','order',o.id::text,
    'Total de pedido impossível','O valor total efetivo do pedido é negativo.','Revise itens, desconto e total. Não há auto-fix financeiro.',false,'open',now(),null
  from public.orders o where o.company_id=p_company_id and coalesce(o.total_amount,o.total,o.valor_total,o.preco_estimado,0)<0
  on conflict(company_id,fingerprint) do update set status='open',last_seen_at=now(),resolved_at=null;

  with item_totals as (
    select i.order_id,sum(coalesce(i.total,i.subtotal,(coalesce(i.quantity,0)::numeric*coalesce(i.unit_price,0)),(coalesce(i.quantidade,0)*coalesce(i.preco_unitario,0)),0)) as items_total
    from public.order_items i where i.company_id=p_company_id group by i.order_id
  )
  insert into public.data_quality_issues(company_id,fingerprint,rule_key,severity,entity_type,entity_id,title,detail,recommended_action,auto_fixable,status,metadata,last_seen_at,resolved_at)
  select p_company_id,md5('order_total_mismatch:'||o.id::text),'order_total_mismatch','HIGH','order',o.id::text,
    'Total do pedido diverge dos itens','A soma dos itens diverge do total armazenado em mais de R$ 0,05.','Revise os cálculos antes de cobrar ou conciliar.',false,'open',
    jsonb_build_object('order_total',coalesce(o.total_amount,o.total,o.valor_total,o.preco_estimado,0),'items_total',t.items_total),now(),null
  from public.orders o join item_totals t on t.order_id=o.id
  where o.company_id=p_company_id and abs(coalesce(o.total_amount,o.total,o.valor_total,o.preco_estimado,0)-t.items_total)>0.05
  on conflict(company_id,fingerprint) do update set status='open',last_seen_at=now(),resolved_at=null,metadata=excluded.metadata;

  insert into public.data_quality_issues(company_id,fingerprint,rule_key,severity,entity_type,entity_id,title,detail,recommended_action,auto_fixable,status,last_seen_at,resolved_at)
  select p_company_id,md5('order_item_tenant_mismatch:'||i.id::text),'order_item_tenant_mismatch','CRITICAL','order_item',i.id::text,
    'Item associado ao tenant errado','O company_id do item diverge do company_id do pedido relacionado.','Corrija a relação após investigação; não altere ownership automaticamente.',false,'open',now(),null
  from public.order_items i join public.orders o on o.id=i.order_id
  where (i.company_id=p_company_id or o.company_id=p_company_id) and i.company_id is distinct from o.company_id
  on conflict(company_id,fingerprint) do update set status='open',last_seen_at=now(),resolved_at=null;

  -- Product integrity.
  insert into public.data_quality_issues(company_id,fingerprint,rule_key,severity,entity_type,entity_id,title,detail,recommended_action,auto_fixable,status,last_seen_at,resolved_at)
  select p_company_id,md5('product_invalid_price:'||p.id::text),'product_invalid_price','HIGH','product',p.id::text,
    'Preço de produto inválido','Produto ativo possui preço negativo ou não possui preço quando não está marcado sob consulta.','Defina preço válido ou marque explicitamente como preço sob consulta.',false,'open',now(),null
  from public.products p
  where p.company_id=p_company_id and coalesce(p.archived,p.arquivado,false)=false and coalesce(p.ativo,p.available,p.is_active,true)=true
    and coalesce(p.preco_sob_consulta,false)=false and (coalesce(p.preco,p.preco_sugerido)<0 or coalesce(p.preco,p.preco_sugerido) is null)
  on conflict(company_id,fingerprint) do update set status='open',last_seen_at=now(),resolved_at=null;

  insert into public.data_quality_issues(company_id,fingerprint,rule_key,severity,entity_type,entity_id,title,detail,recommended_action,auto_fixable,status,last_seen_at,resolved_at)
  select p_company_id,md5('product_missing_category:'||p.id::text),'product_missing_category','LOW','product',p.id::text,
    'Produto sem categoria','Produto ativo não possui categoria definida.','Classifique o produto para melhorar catálogo e relatórios.',false,'open',now(),null
  from public.products p
  where p.company_id=p_company_id and coalesce(p.archived,p.arquivado,false)=false and coalesce(p.ativo,p.available,p.is_active,true)=true and nullif(btrim(p.categoria),'') is null
  on conflict(company_id,fingerprint) do update set status='open',last_seen_at=now(),resolved_at=null;

  -- Missing/wrong tenant relations and status/date consistency.
  insert into public.data_quality_issues(company_id,fingerprint,rule_key,severity,entity_type,entity_id,title,detail,recommended_action,auto_fixable,status,last_seen_at,resolved_at)
  select p_company_id,md5('invalid_order_status:'||o.id::text),'invalid_order_status','MEDIUM','order',o.id::text,
    'Status de pedido não canônico','O status atual não está entre os aliases conhecidos da máquina de estados.','Revise o status antes da próxima transição.',false,'open',now(),null
  from public.orders o
  where o.company_id=p_company_id and lower(btrim(coalesce(o.status,''))) not in (
    'recebido','novo','pendente','pending','aguardando pagamento','pending_payment','em análise','em analise','orçamento enviado','orcamento enviado','proposta enviada','aprovado','em produção','em producao','pronto','ready','pronto_para_entrega','pronto para entrega','out_for_delivery','saiu para entrega','entregue','cancelado','canceled','cancelled'
  )
  on conflict(company_id,fingerprint) do update set status='open',last_seen_at=now(),resolved_at=null;

  insert into public.data_quality_issues(company_id,fingerprint,rule_key,severity,entity_type,entity_id,title,detail,recommended_action,auto_fixable,status,last_seen_at,resolved_at)
  select p_company_id,md5('order_impossible_date:'||o.id::text),'order_impossible_date','HIGH','order',o.id::text,
    'Data de pedido impossível','Uma data de conclusão/cancelamento é anterior à criação do pedido.','Revise a origem e o timestamp; não há auto-fix seguro.',false,'open',now(),null
  from public.orders o
  where o.company_id=p_company_id and ((o.entregue_em is not null and o.entregue_em<o.created_at) or (o.cancelado_em is not null and o.cancelado_em<o.created_at) or (o.aprovado_em is not null and o.aprovado_em<o.created_at))
  on conflict(company_id,fingerprint) do update set status='open',last_seen_at=now(),resolved_at=null;

  -- Payment consistency. Detection only, never automatic repair.
  insert into public.data_quality_issues(company_id,fingerprint,rule_key,severity,entity_type,entity_id,title,detail,recommended_action,auto_fixable,status,last_seen_at,resolved_at)
  select p_company_id,md5('paid_without_timestamp:'||o.id::text),'paid_without_timestamp','MEDIUM','order',o.id::text,
    'Pagamento sem timestamp','Pedido está marcado como pago/aprovado sem paid_at.','Confirme o provider e registre a confirmação real; não invente timestamp.',false,'open',now(),null
  from public.orders o where o.company_id=p_company_id and lower(coalesce(o.payment_status,'')) in ('paid','approved','pago','aprovado','authorized') and o.paid_at is null
  on conflict(company_id,fingerprint) do update set status='open',last_seen_at=now(),resolved_at=null;

  insert into public.data_quality_issues(company_id,fingerprint,rule_key,severity,entity_type,entity_id,title,detail,recommended_action,auto_fixable,status,last_seen_at,resolved_at)
  select p_company_id,md5('order_payment_impossible:'||p.id::text),'order_payment_impossible','HIGH','order_payment',p.id::text,
    'Valor de pagamento inconsistente','Pagamento possui valor negativo, pago acima do total ou saldo negativo.','Revise provider e conciliação. Auto-fix financeiro é proibido.',false,'open',now(),null
  from public.order_payments p
  where p.company_id=p_company_id and (coalesce(p.amount,0)<0 or coalesce(p.paid_amount,0)<0 or coalesce(p.remaining_amount,0)<0 or coalesce(p.paid_amount,0)>coalesce(p.amount,0)+0.01)
  on conflict(company_id,fingerprint) do update set status='open',last_seen_at=now(),resolved_at=null;

  insert into public.data_quality_issues(company_id,fingerprint,rule_key,severity,entity_type,entity_id,title,detail,recommended_action,auto_fixable,status,last_seen_at,resolved_at)
  select p_company_id,md5('order_payment_tenant_mismatch:'||p.id::text),'order_payment_tenant_mismatch','CRITICAL','order_payment',p.id::text,
    'Pagamento associado ao tenant errado','O company_id do pagamento diverge do pedido associado.','Bloqueie processamento e investigue ownership antes de qualquer correção.',false,'open',now(),null
  from public.order_payments p join public.orders o on o.id=p.order_id
  where (p.company_id=p_company_id or o.company_id=p_company_id) and p.company_id is distinct from o.company_id
  on conflict(company_id,fingerprint) do update set status='open',last_seen_at=now(),resolved_at=null;

  insert into public.data_quality_issues(company_id,fingerprint,rule_key,severity,entity_type,entity_id,title,detail,recommended_action,auto_fixable,status,last_seen_at,resolved_at)
  select p_company_id,md5('finance_missing_amount:'||f.id::text),'finance_missing_amount','HIGH','financial_transaction',f.id::text,
    'Lançamento financeiro sem valor','Transação financeira não possui valor em nenhum dos campos canônicos/legados.','Revise o lançamento manualmente; não preencha valores automaticamente.',false,'open',now(),null
  from public.financial_transactions f where f.company_id=p_company_id and f.valor is null and f.amount is null
  on conflict(company_id,fingerprint) do update set status='open',last_seen_at=now(),resolved_at=null;

  -- Active art approvals require an artwork URL; actual Storage object verification is done by the server scan.
  insert into public.data_quality_issues(company_id,fingerprint,rule_key,severity,entity_type,entity_id,title,detail,recommended_action,auto_fixable,status,last_seen_at,resolved_at)
  select p_company_id,md5('art_missing_object_reference:'||a.id::text),'art_missing_object_reference','HIGH','art_approval',a.id::text,
    'Arte sem referência de arquivo','Solicitação ativa de aprovação não possui URL de arte.','Reenvie a arte e confirme o objeto no Storage.',false,'open',now(),null
  from public.art_approval_requests a
  where a.company_id=p_company_id and lower(coalesce(a.status,'')) in ('pending','pendente','aguardando','sent','enviado') and nullif(btrim(a.artwork_url),'') is null
  on conflict(company_id,fingerprint) do update set status='open',last_seen_at=now(),resolved_at=null;

  select count(*) into v_open from public.data_quality_issues where company_id=p_company_id and status='open';
  select greatest(0,100-coalesce(sum(case severity when 'CRITICAL' then 25 when 'HIGH' then 10 when 'MEDIUM' then 4 when 'LOW' then 1 else 0 end),0))::integer
    into v_score from public.data_quality_issues where company_id=p_company_id and status='open';

  return jsonb_build_object(
    'score',v_score,
    'open',v_open,
    'critical',(select count(*) from public.data_quality_issues where company_id=p_company_id and status='open' and severity='CRITICAL'),
    'high',(select count(*) from public.data_quality_issues where company_id=p_company_id and status='open' and severity='HIGH'),
    'medium',(select count(*) from public.data_quality_issues where company_id=p_company_id and status='open' and severity='MEDIUM'),
    'low',(select count(*) from public.data_quality_issues where company_id=p_company_id and status='open' and severity='LOW'),
    'info',(select count(*) from public.data_quality_issues where company_id=p_company_id and status='open' and severity='INFO')
  );
end;
$$;

revoke all on function public.refresh_company_data_quality(uuid) from public, anon, authenticated;
grant execute on function public.refresh_company_data_quality(uuid) to service_role;

create or replace function public.merge_customer_profiles(p_company_id uuid,p_primary uuid,p_duplicate uuid,p_actor uuid default null)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  a public.customer_profiles%rowtype;
  b public.customer_profiles%rowtype;
begin
  if p_primary=p_duplicate then raise exception 'SAME_CUSTOMER' using errcode='22023'; end if;
  select * into a from public.customer_profiles where id=p_primary and company_id=p_company_id and archived=false for update;
  select * into b from public.customer_profiles where id=p_duplicate and company_id=p_company_id and archived=false for update;
  if a.id is null or b.id is null then raise exception 'CUSTOMER_NOT_FOUND_OR_TENANT_MISMATCH' using errcode='42501'; end if;

  update public.orders set customer_profile_id=p_primary where company_id=p_company_id and customer_profile_id=p_duplicate;
  update public.proposals set customer_profile_id=p_primary where company_id=p_company_id and customer_profile_id=p_duplicate;
  update public.crm_leads set customer_profile_id=p_primary where company_id=p_company_id and customer_profile_id=p_duplicate;
  update public.customer_notes set customer_profile_id=p_primary where company_id=p_company_id and customer_profile_id=p_duplicate;
  update public.customer_followups set customer_profile_id=p_primary where company_id=p_company_id and customer_profile_id=p_duplicate;
  update public.financial_transactions set customer_profile_id=p_primary where company_id=p_company_id and customer_profile_id=p_duplicate;
  update public.timeline_events set customer_profile_id=p_primary where company_id=p_company_id and customer_profile_id=p_duplicate;

  update public.customer_profiles
     set display_name=coalesce(a.display_name,b.display_name),
         normalized_name=coalesce(a.normalized_name,b.normalized_name),
         phone_raw=coalesce(a.phone_raw,b.phone_raw),
         phone_normalized=coalesce(a.phone_normalized,b.phone_normalized),
         email_raw=coalesce(a.email_raw,b.email_raw),
         email_normalized=coalesce(a.email_normalized,b.email_normalized),
         last_activity_at=greatest(coalesce(a.last_activity_at,'epoch'::timestamptz),coalesce(b.last_activity_at,'epoch'::timestamptz)),
         updated_by=p_actor,updated_at=now(),metadata=a.metadata||b.metadata
   where id=p_primary;

  update public.customer_profiles set archived=true,merged_into_id=p_primary,updated_by=p_actor,updated_at=now() where id=p_duplicate;
  update public.customer_duplicate_candidates set status='merged',reviewed_by=p_actor,reviewed_at=now(),updated_at=now()
    where company_id=p_company_id and status='needs_review' and ((left_customer_id=p_primary and right_customer_id=p_duplicate) or (left_customer_id=p_duplicate and right_customer_id=p_primary));

  insert into public.timeline_events(company_id,customer_profile_id,aggregate_type,aggregate_id,event_type,title,source,actor_id,metadata)
  values(p_company_id,p_primary,'customer',p_primary,'customer.merged','Perfis de cliente mesclados','manual',p_actor,jsonb_build_object('merged_customer_id',p_duplicate));

  return jsonb_build_object('ok',true,'primary',p_primary,'merged',p_duplicate);
end;
$$;

revoke all on function public.merge_customer_profiles(uuid,uuid,uuid,uuid) from public, anon, authenticated;
grant execute on function public.merge_customer_profiles(uuid,uuid,uuid,uuid) to service_role;
