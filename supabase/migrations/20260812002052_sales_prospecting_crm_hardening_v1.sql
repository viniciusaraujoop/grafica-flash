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
    if v_actor_role = 'prospector'
       and (
         v_lead.converted_company_id is not null
         or v_lead.sales_stage = 'cliente'
       )
    then
      raise exception 'PROSPECT_ALREADY_CUSTOMER';
    end if;

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

  if v_actor_role = 'prospector'
     and v_new_stage in ('conta_ativada','cliente')
  then
    raise exception 'SYSTEM_STAGE_ONLY';
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

revoke all on function public.create_or_claim_sales_prospect(uuid,uuid,text,text,text,text,text,text,text) from public, anon, authenticated;
grant execute on function public.create_or_claim_sales_prospect(uuid,uuid,text,text,text,text,text,text,text) to service_role;

revoke all on function public.change_signup_lead_sales_stage(uuid,uuid,text,text,text) from public, anon, authenticated;
grant execute on function public.change_signup_lead_sales_stage(uuid,uuid,text,text,text) to service_role;
