alter table public.signup_leads
  add column if not exists sales_stage text,
  add column if not exists assigned_to_admin_id uuid references public.platform_admins(id) on delete set null,
  add column if not exists created_by_admin_id uuid references public.platform_admins(id) on delete set null,
  add column if not exists sales_notes text,
  add column if not exists sales_stage_updated_at timestamptz,
  add column if not exists sales_last_contact_at timestamptz,
  add column if not exists sales_next_action_at timestamptz,
  add column if not exists sales_lost_reason text;

update public.signup_leads
set sales_stage = case
  when converted_company_id is not null then 'cliente'
  else 'novo'
end
where sales_stage is null;

update public.signup_leads
set sales_stage_updated_at = coalesce(updated_at, created_at, now())
where sales_stage_updated_at is null;

alter table public.signup_leads
  alter column sales_stage set default 'novo',
  alter column sales_stage set not null,
  alter column sales_stage_updated_at set default now(),
  alter column sales_stage_updated_at set not null;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.signup_leads'::regclass
      and conname = 'signup_leads_sales_stage_check'
  ) then
    alter table public.signup_leads
      add constraint signup_leads_sales_stage_check
      check (
        sales_stage in (
          'novo',
          'contatado',
          'interessado',
          'demonstracao',
          'convite_fundador',
          'conta_ativada',
          'cliente',
          'perdido'
        )
      );
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.signup_leads'::regclass
      and conname = 'signup_leads_sales_lost_reason_check'
  ) then
    alter table public.signup_leads
      add constraint signup_leads_sales_lost_reason_check
      check (
        sales_stage <> 'perdido'
        or nullif(btrim(sales_lost_reason), '') is not null
      );
  end if;
end
$$;

alter table public.signup_lead_followups
  add column if not exists created_by_admin_id uuid references public.platform_admins(id) on delete set null,
  add column if not exists sales_event_type text;

update public.signup_lead_followups
set sales_event_type = 'legacy'
where sales_event_type is null;

alter table public.signup_lead_followups
  alter column sales_event_type set default 'contact',
  alter column sales_event_type set not null;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.signup_lead_followups'::regclass
      and conname = 'signup_lead_followups_sales_event_type_check'
  ) then
    alter table public.signup_lead_followups
      add constraint signup_lead_followups_sales_event_type_check
      check (sales_event_type in ('legacy','contact','note','stage_change','system'));
  end if;
end
$$;

create index if not exists idx_signup_leads_sales_stage
  on public.signup_leads (sales_stage, updated_at desc);

create index if not exists idx_signup_leads_sales_assignee_stage
  on public.signup_leads (assigned_to_admin_id, sales_stage, updated_at desc);

create index if not exists idx_signup_leads_sales_creator
  on public.signup_leads (created_by_admin_id, created_at desc);

create index if not exists idx_signup_leads_sales_next_action
  on public.signup_leads (sales_next_action_at)
  where sales_next_action_at is not null
    and sales_stage not in ('cliente','perdido');

create index if not exists idx_signup_lead_followups_sales_lead_created
  on public.signup_lead_followups (lead_id, created_at desc);

create index if not exists idx_signup_lead_followups_sales_admin
  on public.signup_lead_followups (created_by_admin_id, created_at desc)
  where created_by_admin_id is not null;

create or replace function orcaly_private.sync_signup_lead_sales_stage()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $$
begin
  if new.converted_company_id is not null
     and (
       tg_op = 'INSERT'
       or old.converted_company_id is distinct from new.converted_company_id
       or new.sales_stage <> 'cliente'
     )
  then
    new.sales_stage := 'cliente';
    new.sales_lost_reason := null;
  end if;

  if tg_op = 'INSERT'
     or old.sales_stage is distinct from new.sales_stage
  then
    new.sales_stage_updated_at := now();
  end if;

  return new;
end;
$$;

drop trigger if exists trg_sync_signup_lead_sales_stage on public.signup_leads;
create trigger trg_sync_signup_lead_sales_stage
before insert or update on public.signup_leads
for each row
execute function orcaly_private.sync_signup_lead_sales_stage();

create or replace function public.create_or_claim_sales_prospect(
  p_actor_admin_id uuid,
  p_assigned_admin_id uuid,
  p_email text,
  p_empresa_nome text,
  p_nome_responsavel text default null,
  p_whatsapp text default null,
  p_segmento text default null,
  p_cidade text default null,
  p_estado text default null
)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_actor_role text;
  v_target_id uuid;
  v_target_role text;
  v_email text := lower(btrim(coalesce(p_email, '')));
  v_lead public.signup_leads%rowtype;
begin
  select lower(role)
    into v_actor_role
  from public.platform_admins
  where id = p_actor_admin_id
    and is_active = true;

  if v_actor_role not in ('owner','prospector') then
    raise exception 'SALES_ACTOR_NOT_ALLOWED';
  end if;

  if v_email = '' or position('@' in v_email) <= 1 then
    raise exception 'INVALID_EMAIL';
  end if;

  if nullif(btrim(coalesce(p_empresa_nome, '')), '') is null then
    raise exception 'COMPANY_NAME_REQUIRED';
  end if;

  v_target_id := coalesce(p_assigned_admin_id, p_actor_admin_id);

  select lower(role)
    into v_target_role
  from public.platform_admins
  where id = v_target_id
    and is_active = true;

  if v_target_role not in ('owner','prospector') then
    raise exception 'INVALID_ASSIGNEE';
  end if;

  if v_actor_role = 'prospector' and v_target_id <> p_actor_admin_id then
    raise exception 'PROSPECTOR_CANNOT_REASSIGN';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(v_email, 0));

  select *
    into v_lead
  from public.signup_leads
  where lower(btrim(email)) = v_email
  order by created_at desc nulls last, id
  limit 1
  for update;

  if found then
    if v_lead.assigned_to_admin_id is not null
       and v_lead.assigned_to_admin_id <> v_target_id
    then
      raise exception 'PROSPECT_ALREADY_ASSIGNED';
    end if;

    update public.signup_leads
    set assigned_to_admin_id = coalesce(assigned_to_admin_id, v_target_id),
        created_by_admin_id = coalesce(created_by_admin_id, p_actor_admin_id),
        nome_responsavel = coalesce(nullif(btrim(p_nome_responsavel), ''), nome_responsavel),
        empresa_nome = coalesce(nullif(btrim(p_empresa_nome), ''), empresa_nome),
        whatsapp = coalesce(nullif(btrim(p_whatsapp), ''), whatsapp),
        segmento = coalesce(nullif(btrim(p_segmento), ''), segmento),
        cidade = coalesce(nullif(btrim(p_cidade), ''), cidade),
        estado = coalesce(nullif(btrim(p_estado), ''), estado),
        sales_stage = case
          when converted_company_id is not null then 'cliente'
          else sales_stage
        end,
        updated_at = now()
    where id = v_lead.id;

    return v_lead.id;
  end if;

  insert into public.signup_leads (
    nome_responsavel,
    email,
    whatsapp,
    empresa_nome,
    segmento,
    cidade,
    estado,
    status,
    lead_source,
    marketing_opt_in,
    sales_stage,
    assigned_to_admin_id,
    created_by_admin_id,
    sales_stage_updated_at,
    raw_data
  )
  values (
    nullif(btrim(p_nome_responsavel), ''),
    v_email,
    nullif(btrim(p_whatsapp), ''),
    btrim(p_empresa_nome),
    nullif(btrim(p_segmento), ''),
    nullif(btrim(p_cidade), ''),
    nullif(btrim(p_estado), ''),
    'lead',
    'prospeccao',
    false,
    'novo',
    v_target_id,
    p_actor_admin_id,
    now(),
    jsonb_build_object(
      'sales_created', true,
      'sales_created_by_admin_id', p_actor_admin_id
    )
  )
  returning id into v_lead.id;

  return v_lead.id;
end;
$$;

create or replace function public.change_signup_lead_sales_stage(
  p_lead_id uuid,
  p_actor_admin_id uuid,
  p_stage text,
  p_note text default null,
  p_lost_reason text default null
)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_actor_role text;
  v_actor_email text;
  v_assigned_to uuid;
  v_old_stage text;
  v_new_stage text := lower(btrim(coalesce(p_stage, '')));
begin
  if v_new_stage not in (
    'novo',
    'contatado',
    'interessado',
    'demonstracao',
    'convite_fundador',
    'conta_ativada',
    'cliente',
    'perdido'
  ) then
    raise exception 'INVALID_SALES_STAGE';
  end if;

  if v_new_stage = 'perdido'
     and nullif(btrim(coalesce(p_lost_reason, '')), '') is null
  then
    raise exception 'LOST_REASON_REQUIRED';
  end if;

  select lower(role), lower(email)
    into v_actor_role, v_actor_email
  from public.platform_admins
  where id = p_actor_admin_id
    and is_active = true;

  if v_actor_role not in ('owner','prospector') then
    raise exception 'SALES_ACTOR_NOT_ALLOWED';
  end if;

  select assigned_to_admin_id, sales_stage
    into v_assigned_to, v_old_stage
  from public.signup_leads
  where id = p_lead_id
  for update;

  if not found then
    raise exception 'LEAD_NOT_FOUND';
  end if;

  if v_actor_role = 'prospector'
     and v_assigned_to is distinct from p_actor_admin_id
  then
    raise exception 'LEAD_NOT_OWNED';
  end if;

  update public.signup_leads
  set sales_stage = v_new_stage,
      sales_lost_reason = case
        when v_new_stage = 'perdido'
          then nullif(btrim(p_lost_reason), '')
        else null
      end,
      sales_stage_updated_at = now(),
      updated_at = now()
  where id = p_lead_id;

  if v_old_stage is distinct from v_new_stage then
    insert into public.signup_lead_followups (
      lead_id,
      channel,
      status,
      message,
      scheduled_for,
      sent_at,
      admin_email,
      created_by_admin_id,
      sales_event_type,
      raw_data
    )
    values (
      p_lead_id,
      'system',
      'registrado',
      coalesce(
        nullif(btrim(p_note), ''),
        'Etapa comercial alterada de ' || coalesce(v_old_stage, 'sem etapa') || ' para ' || v_new_stage
      ),
      now(),
      now(),
      v_actor_email,
      p_actor_admin_id,
      'stage_change',
      jsonb_build_object(
        'from_stage', v_old_stage,
        'to_stage', v_new_stage,
        'lost_reason', nullif(btrim(p_lost_reason), '')
      )
    );
  end if;
end;
$$;

create or replace function public.record_signup_lead_sales_followup(
  p_lead_id uuid,
  p_actor_admin_id uuid,
  p_channel text,
  p_message text,
  p_next_action_at timestamptz default null
)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_actor_role text;
  v_actor_email text;
  v_assigned_to uuid;
  v_channel text := lower(btrim(coalesce(p_channel, '')));
  v_followup_id uuid;
begin
  if v_channel not in ('whatsapp','telefone','email','reuniao','nota') then
    raise exception 'INVALID_CONTACT_CHANNEL';
  end if;

  if nullif(btrim(coalesce(p_message, '')), '') is null then
    raise exception 'MESSAGE_REQUIRED';
  end if;

  select lower(role), lower(email)
    into v_actor_role, v_actor_email
  from public.platform_admins
  where id = p_actor_admin_id
    and is_active = true;

  if v_actor_role not in ('owner','prospector') then
    raise exception 'SALES_ACTOR_NOT_ALLOWED';
  end if;

  select assigned_to_admin_id
    into v_assigned_to
  from public.signup_leads
  where id = p_lead_id
  for update;

  if not found then
    raise exception 'LEAD_NOT_FOUND';
  end if;

  if v_actor_role = 'prospector'
     and v_assigned_to is distinct from p_actor_admin_id
  then
    raise exception 'LEAD_NOT_OWNED';
  end if;

  insert into public.signup_lead_followups (
    lead_id,
    channel,
    status,
    message,
    scheduled_for,
    sent_at,
    admin_email,
    created_by_admin_id,
    sales_event_type,
    raw_data
  )
  values (
    p_lead_id,
    v_channel,
    'registrado',
    btrim(p_message),
    now(),
    now(),
    v_actor_email,
    p_actor_admin_id,
    case when v_channel = 'nota' then 'note' else 'contact' end,
    jsonb_build_object(
      'source', 'sales_crm',
      'next_action_at', p_next_action_at
    )
  )
  returning id into v_followup_id;

  update public.signup_leads
  set followup_count = followup_count + 1,
      last_followup_at = now(),
      sales_last_contact_at = now(),
      next_followup_at = p_next_action_at,
      sales_next_action_at = p_next_action_at,
      updated_at = now()
  where id = p_lead_id;

  return v_followup_id;
end;
$$;

revoke all on function public.create_or_claim_sales_prospect(uuid,uuid,text,text,text,text,text,text,text) from public, anon, authenticated;
grant execute on function public.create_or_claim_sales_prospect(uuid,uuid,text,text,text,text,text,text,text) to service_role;

revoke all on function public.change_signup_lead_sales_stage(uuid,uuid,text,text,text) from public, anon, authenticated;
grant execute on function public.change_signup_lead_sales_stage(uuid,uuid,text,text,text) to service_role;

revoke all on function public.record_signup_lead_sales_followup(uuid,uuid,text,text,timestamptz) from public, anon, authenticated;
grant execute on function public.record_signup_lead_sales_followup(uuid,uuid,text,text,timestamptz) to service_role;

comment on column public.signup_leads.sales_stage is
  'Etapa comercial independente do status de checkout/pagamento.';
comment on column public.signup_leads.assigned_to_admin_id is
  'Responsavel comercial atual em platform_admins.';
comment on column public.signup_leads.created_by_admin_id is
  'Usuario interno que originou a oportunidade comercial, quando aplicavel.';
