alter table public.founder_invites
  add column sales_lead_id uuid null references public.signup_leads(id) on delete set null,
  add column token_rotated_at timestamptz null,
  add column revoked_by_admin_id uuid null references public.platform_admins(id) on delete set null,
  add column revocation_reason text null;

drop index if exists public.founder_invites_pending_email_uq;

create unique index founder_invites_live_email_uq
  on public.founder_invites(email_normalized)
  where status in ('pending','activated');

create unique index founder_invites_live_sales_lead_uq
  on public.founder_invites(sales_lead_id)
  where sales_lead_id is not null
    and status in ('pending','activated');

create index founder_invites_sales_lead_idx
  on public.founder_invites(sales_lead_id, invited_at desc)
  where sales_lead_id is not null;

create index founder_invites_expiry_idx
  on public.founder_invites(token_expires_at)
  where status = 'pending'
    and token_expires_at is not null;

create or replace function public.create_founder_invite_for_sales_lead(
  p_actor_admin_id uuid,
  p_lead_id uuid,
  p_plan_key text,
  p_token_hash text,
  p_token_expires_at timestamptz,
  p_requested_founder_number integer default null
)
returns public.founder_invites
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_actor_role text;
  v_actor_email text;
  v_lead public.signup_leads%rowtype;
  v_plan text := lower(btrim(coalesce(p_plan_key,'')));
  v_price integer;
  v_number integer;
  v_invite public.founder_invites%rowtype;
begin
  if p_token_hash is null or p_token_hash !~ '^[0-9a-f]{64}$' then
    raise exception 'INVALID_FOUNDER_TOKEN_HASH';
  end if;

  if p_token_expires_at is null
     or p_token_expires_at <= now()
     or p_token_expires_at > now() + interval '30 days'
  then
    raise exception 'INVALID_FOUNDER_TOKEN_EXPIRY';
  end if;

  if v_plan = 'basico' then
    v_price := 3490;
  elsif v_plan = 'profissional' then
    v_price := 6990;
  elsif v_plan = 'premium' then
    v_price := 9990;
  else
    raise exception 'INVALID_FOUNDER_PLAN';
  end if;

  select lower(role), lower(email)
    into v_actor_role, v_actor_email
  from public.platform_admins
  where id = p_actor_admin_id
    and is_active = true;

  if v_actor_role = 'owner'
     and v_actor_email <> 'viniciusadm@orcaly.com'
  then
    raise exception 'FOUNDER_ACTOR_NOT_ALLOWED';
  end if;

  if v_actor_role not in ('owner','prospector') then
    raise exception 'FOUNDER_ACTOR_NOT_ALLOWED';
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended('orcaly-founder-slot-allocation-v1', 0)
  );

  select *
    into v_lead
  from public.signup_leads
  where id = p_lead_id
  for update;

  if not found then
    raise exception 'FOUNDER_LEAD_NOT_FOUND';
  end if;

  if v_actor_role = 'prospector'
     and v_lead.assigned_to_admin_id is distinct from p_actor_admin_id
  then
    raise exception 'FOUNDER_LEAD_NOT_OWNED';
  end if;

  if v_lead.converted_company_id is not null
     or v_lead.sales_stage in ('conta_ativada','cliente','perdido')
  then
    raise exception 'FOUNDER_LEAD_NOT_ELIGIBLE';
  end if;

  if exists (
    select 1
    from public.founder_invites fi
    where fi.status in ('pending','activated')
      and (
        fi.sales_lead_id = p_lead_id
        or fi.email_normalized = lower(btrim(v_lead.email))
      )
  ) then
    raise exception 'FOUNDER_INVITE_ALREADY_EXISTS';
  end if;

  if p_requested_founder_number is not null then
    if p_requested_founder_number < 1
       or p_requested_founder_number > 10
    then
      raise exception 'INVALID_FOUNDER_NUMBER';
    end if;

    if exists (
      select 1
      from public.founder_invites fi
      where fi.founder_number = p_requested_founder_number
        and fi.status in ('pending','activated')
    ) then
      raise exception 'FOUNDER_NUMBER_TAKEN';
    end if;

    v_number := p_requested_founder_number;
  else
    select slot
      into v_number
    from generate_series(1,10) as slot
    where not exists (
      select 1
      from public.founder_invites fi
      where fi.founder_number = slot
        and fi.status in ('pending','activated')
    )
    order by slot
    limit 1;

    if v_number is null then
      raise exception 'FOUNDER_SLOTS_EXHAUSTED';
    end if;
  end if;

  insert into public.founder_invites (
    email,
    founder_number,
    plan_key,
    founder_price_cents,
    status,
    token_hash,
    token_expires_at,
    invited_at,
    sales_lead_id,
    created_by_admin_id,
    created_by_email
  )
  values (
    lower(btrim(v_lead.email)),
    v_number,
    v_plan,
    v_price,
    'pending',
    p_token_hash,
    p_token_expires_at,
    now(),
    p_lead_id,
    p_actor_admin_id,
    v_actor_email
  )
  returning * into v_invite;

  update public.signup_leads
  set sales_stage = 'convite_fundador',
      sales_lost_reason = null,
      sales_stage_updated_at = now(),
      updated_at = now()
  where id = p_lead_id;

  insert into public.signup_lead_followups (
    lead_id, channel, status, message, scheduled_for, sent_at,
    admin_email, created_by_admin_id, sales_event_type, raw_data
  )
  values (
    p_lead_id,
    'system',
    'registrado',
    'Convite Founder #' || lpad(v_number::text,2,'0') || ' criado.',
    now(),
    now(),
    v_actor_email,
    p_actor_admin_id,
    'system',
    jsonb_build_object(
      'source','founder_program',
      'event','invite_created',
      'founder_invite_id',v_invite.id,
      'founder_number',v_number,
      'plan_key',v_plan,
      'founder_price_cents',v_price
    )
  );

  return v_invite;
end;
$$;

create or replace function public.create_founder_test_invite(
  p_actor_admin_id uuid,
  p_email text,
  p_plan_key text,
  p_token_hash text,
  p_token_expires_at timestamptz
)
returns public.founder_invites
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_actor_role text;
  v_actor_email text;
  v_email text := lower(btrim(coalesce(p_email,'')));
  v_plan text := lower(btrim(coalesce(p_plan_key,'')));
  v_price integer;
  v_invite public.founder_invites%rowtype;
begin
  if v_email = '' or position('@' in v_email) <= 1 then
    raise exception 'INVALID_FOUNDER_EMAIL';
  end if;

  if p_token_hash is null or p_token_hash !~ '^[0-9a-f]{64}$' then
    raise exception 'INVALID_FOUNDER_TOKEN_HASH';
  end if;

  if p_token_expires_at is null
     or p_token_expires_at <= now()
     or p_token_expires_at > now() + interval '30 days'
  then
    raise exception 'INVALID_FOUNDER_TOKEN_EXPIRY';
  end if;

  if v_plan = 'basico' then
    v_price := 3490;
  elsif v_plan = 'profissional' then
    v_price := 6990;
  elsif v_plan = 'premium' then
    v_price := 9990;
  else
    raise exception 'INVALID_FOUNDER_PLAN';
  end if;

  select lower(role), lower(email)
    into v_actor_role, v_actor_email
  from public.platform_admins
  where id = p_actor_admin_id
    and is_active = true;

  if v_actor_role <> 'owner'
     or v_actor_email <> 'viniciusadm@orcaly.com'
  then
    raise exception 'FOUNDER_TEST_OWNER_ONLY';
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended('orcaly-founder-slot-allocation-v1', 0)
  );

  if exists (
    select 1
    from public.founder_invites fi
    where fi.founder_number = 0
      and fi.status in ('pending','activated')
  ) then
    raise exception 'FOUNDER_TEST_SLOT_TAKEN';
  end if;

  if exists (
    select 1
    from public.founder_invites fi
    where fi.email_normalized = v_email
      and fi.status in ('pending','activated')
  ) then
    raise exception 'FOUNDER_INVITE_ALREADY_EXISTS';
  end if;

  insert into public.founder_invites (
    email, founder_number, plan_key, founder_price_cents, status,
    token_hash, token_expires_at, invited_at, sales_lead_id,
    created_by_admin_id, created_by_email
  )
  values (
    v_email, 0, v_plan, v_price, 'pending', p_token_hash,
    p_token_expires_at, now(), null, p_actor_admin_id, v_actor_email
  )
  returning * into v_invite;

  return v_invite;
end;
$$;

create or replace function public.rotate_founder_invite_token(
  p_actor_admin_id uuid,
  p_invite_id uuid,
  p_token_hash text,
  p_token_expires_at timestamptz
)
returns public.founder_invites
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_actor_role text;
  v_actor_email text;
  v_invite public.founder_invites%rowtype;
  v_current_assignee uuid;
begin
  if p_token_hash is null or p_token_hash !~ '^[0-9a-f]{64}$' then
    raise exception 'INVALID_FOUNDER_TOKEN_HASH';
  end if;

  if p_token_expires_at is null
     or p_token_expires_at <= now()
     or p_token_expires_at > now() + interval '30 days'
  then
    raise exception 'INVALID_FOUNDER_TOKEN_EXPIRY';
  end if;

  select lower(role), lower(email)
    into v_actor_role, v_actor_email
  from public.platform_admins
  where id = p_actor_admin_id
    and is_active = true;

  if v_actor_role = 'owner'
     and v_actor_email <> 'viniciusadm@orcaly.com'
  then
    raise exception 'FOUNDER_ACTOR_NOT_ALLOWED';
  end if;

  if v_actor_role not in ('owner','prospector') then
    raise exception 'FOUNDER_ACTOR_NOT_ALLOWED';
  end if;

  select *
    into v_invite
  from public.founder_invites
  where id = p_invite_id
  for update;

  if not found then
    raise exception 'FOUNDER_INVITE_NOT_FOUND';
  end if;

  if v_invite.status <> 'pending' then
    raise exception 'FOUNDER_INVITE_NOT_PENDING';
  end if;

  if v_actor_role = 'prospector' then
    if v_invite.created_by_admin_id is distinct from p_actor_admin_id
       or v_invite.sales_lead_id is null
    then
      raise exception 'FOUNDER_INVITE_NOT_OWNED';
    end if;

    select assigned_to_admin_id
      into v_current_assignee
    from public.signup_leads
    where id = v_invite.sales_lead_id;

    if v_current_assignee is distinct from p_actor_admin_id then
      raise exception 'FOUNDER_INVITE_NOT_OWNED';
    end if;
  end if;

  update public.founder_invites
  set token_hash = p_token_hash,
      token_expires_at = p_token_expires_at,
      token_rotated_at = now(),
      updated_at = now()
  where id = p_invite_id
  returning * into v_invite;

  if v_invite.sales_lead_id is not null then
    insert into public.signup_lead_followups (
      lead_id, channel, status, message, scheduled_for, sent_at,
      admin_email, created_by_admin_id, sales_event_type, raw_data
    )
    values (
      v_invite.sales_lead_id, 'system', 'registrado',
      'Link do convite Founder #' || lpad(v_invite.founder_number::text,2,'0') || ' foi renovado.',
      now(), now(), v_actor_email, p_actor_admin_id, 'system',
      jsonb_build_object(
        'source','founder_program',
        'event','invite_rotated',
        'founder_invite_id',v_invite.id,
        'founder_number',v_invite.founder_number
      )
    );
  end if;

  return v_invite;
end;
$$;

create or replace function public.revoke_founder_invite(
  p_actor_admin_id uuid,
  p_invite_id uuid,
  p_reason text default null
)
returns public.founder_invites
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_actor_role text;
  v_actor_email text;
  v_invite public.founder_invites%rowtype;
  v_current_assignee uuid;
  v_reason text := nullif(btrim(coalesce(p_reason,'')),'');
begin
  select lower(role), lower(email)
    into v_actor_role, v_actor_email
  from public.platform_admins
  where id = p_actor_admin_id
    and is_active = true;

  if v_actor_role = 'owner'
     and v_actor_email <> 'viniciusadm@orcaly.com'
  then
    raise exception 'FOUNDER_ACTOR_NOT_ALLOWED';
  end if;

  if v_actor_role not in ('owner','prospector') then
    raise exception 'FOUNDER_ACTOR_NOT_ALLOWED';
  end if;

  select *
    into v_invite
  from public.founder_invites
  where id = p_invite_id
  for update;

  if not found then
    raise exception 'FOUNDER_INVITE_NOT_FOUND';
  end if;

  if v_invite.status <> 'pending' then
    raise exception 'FOUNDER_INVITE_NOT_PENDING';
  end if;

  if v_actor_role = 'prospector' then
    if v_invite.created_by_admin_id is distinct from p_actor_admin_id
       or v_invite.sales_lead_id is null
    then
      raise exception 'FOUNDER_INVITE_NOT_OWNED';
    end if;

    select assigned_to_admin_id
      into v_current_assignee
    from public.signup_leads
    where id = v_invite.sales_lead_id;

    if v_current_assignee is distinct from p_actor_admin_id then
      raise exception 'FOUNDER_INVITE_NOT_OWNED';
    end if;
  end if;

  update public.founder_invites
  set status = 'revoked',
      revoked_at = now(),
      revoked_by_admin_id = p_actor_admin_id,
      revocation_reason = left(v_reason,500),
      updated_at = now()
  where id = p_invite_id
  returning * into v_invite;

  if v_invite.sales_lead_id is not null then
    update public.signup_leads
    set sales_stage = case
          when sales_stage = 'convite_fundador' then 'demonstracao'
          else sales_stage
        end,
        sales_stage_updated_at = case
          when sales_stage = 'convite_fundador' then now()
          else sales_stage_updated_at
        end,
        updated_at = now()
    where id = v_invite.sales_lead_id;

    insert into public.signup_lead_followups (
      lead_id, channel, status, message, scheduled_for, sent_at,
      admin_email, created_by_admin_id, sales_event_type, raw_data
    )
    values (
      v_invite.sales_lead_id, 'system', 'registrado',
      'Convite Founder #' || lpad(v_invite.founder_number::text,2,'0') || ' revogado.',
      now(), now(), v_actor_email, p_actor_admin_id, 'system',
      jsonb_build_object(
        'source','founder_program',
        'event','invite_revoked',
        'founder_invite_id',v_invite.id,
        'founder_number',v_invite.founder_number,
        'reason',v_reason
      )
    );
  end if;

  return v_invite;
end;
$$;

create or replace function public.expire_pending_founder_invites()
returns integer
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_invite public.founder_invites%rowtype;
  v_count integer := 0;
begin
  for v_invite in
    select *
    from public.founder_invites
    where status = 'pending'
      and token_expires_at is not null
      and token_expires_at <= now()
    order by id
    for update
  loop
    update public.founder_invites
    set status = 'expired',
        updated_at = now()
    where id = v_invite.id;

    if v_invite.sales_lead_id is not null then
      update public.signup_leads
      set sales_stage = case
            when sales_stage = 'convite_fundador' then 'demonstracao'
            else sales_stage
          end,
          sales_stage_updated_at = case
            when sales_stage = 'convite_fundador' then now()
            else sales_stage_updated_at
          end,
          updated_at = now()
      where id = v_invite.sales_lead_id;

      insert into public.signup_lead_followups (
        lead_id, channel, status, message, scheduled_for, sent_at,
        admin_email, created_by_admin_id, sales_event_type, raw_data
      )
      values (
        v_invite.sales_lead_id, 'system', 'registrado',
        'Convite Founder #' || lpad(v_invite.founder_number::text,2,'0') || ' expirou.',
        now(), now(), v_invite.created_by_email, v_invite.created_by_admin_id, 'system',
        jsonb_build_object(
          'source','founder_program',
          'event','invite_expired',
          'founder_invite_id',v_invite.id,
          'founder_number',v_invite.founder_number
        )
      );
    end if;

    v_count := v_count + 1;
  end loop;

  return v_count;
end;
$$;

revoke all on function public.create_founder_invite_for_sales_lead(uuid,uuid,text,text,timestamptz,integer) from public, anon, authenticated;
revoke all on function public.create_founder_test_invite(uuid,text,text,text,timestamptz) from public, anon, authenticated;
revoke all on function public.rotate_founder_invite_token(uuid,uuid,text,timestamptz) from public, anon, authenticated;
revoke all on function public.revoke_founder_invite(uuid,uuid,text) from public, anon, authenticated;
revoke all on function public.expire_pending_founder_invites() from public, anon, authenticated;

grant execute on function public.create_founder_invite_for_sales_lead(uuid,uuid,text,text,timestamptz,integer) to service_role;
grant execute on function public.create_founder_test_invite(uuid,text,text,text,timestamptz) to service_role;
grant execute on function public.rotate_founder_invite_token(uuid,uuid,text,timestamptz) to service_role;
grant execute on function public.revoke_founder_invite(uuid,uuid,text) to service_role;
grant execute on function public.expire_pending_founder_invites() to service_role;

revoke all on public.founder_invites from anon, authenticated;
grant select, insert, update on public.founder_invites to service_role;
revoke delete, truncate on public.founder_invites from service_role;
