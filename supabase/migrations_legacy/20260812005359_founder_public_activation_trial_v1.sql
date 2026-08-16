alter table public.founder_invites
  add column if not exists activation_claim_id uuid null,
  add column if not exists activation_claimed_at timestamptz null,
  add column if not exists activation_attempts integer not null default 0,
  add column if not exists activation_last_error text null;

alter table public.founder_invites
  drop constraint if exists founder_invites_status_check,
  drop constraint if exists founder_invites_state_check,
  drop constraint if exists founder_invites_activation_claim_pair_check,
  drop constraint if exists founder_invites_activation_attempts_check;

alter table public.founder_invites
  add constraint founder_invites_status_check
    check (status in ('pending','activating','activated','revoked','expired')),
  add constraint founder_invites_activation_claim_pair_check
    check (
      (activation_claim_id is null and activation_claimed_at is null)
      or
      (activation_claim_id is not null and activation_claimed_at is not null)
    ),
  add constraint founder_invites_activation_attempts_check
    check (activation_attempts >= 0),
  add constraint founder_invites_state_check
    check (
      (
        status = 'pending'
        and activated_at is null
        and revoked_at is null
        and user_id is null
        and company_id is null
        and activation_claim_id is null
        and activation_claimed_at is null
      )
      or
      (
        status = 'activating'
        and activated_at is null
        and revoked_at is null
        and user_id is null
        and company_id is null
        and activation_claim_id is not null
        and activation_claimed_at is not null
      )
      or
      (
        status = 'activated'
        and activated_at is not null
        and revoked_at is null
        and user_id is not null
        and company_id is not null
        and activation_claim_id is null
        and activation_claimed_at is null
      )
      or
      (
        status = 'revoked'
        and activated_at is null
        and revoked_at is not null
        and user_id is null
        and company_id is null
        and activation_claim_id is null
        and activation_claimed_at is null
      )
      or
      (
        status = 'expired'
        and activated_at is null
        and user_id is null
        and company_id is null
        and activation_claim_id is null
        and activation_claimed_at is null
      )
    );

drop index if exists public.founder_invites_live_number_uq;
drop index if exists public.founder_invites_live_email_uq;
drop index if exists public.founder_invites_live_sales_lead_uq;

create unique index founder_invites_live_number_uq
  on public.founder_invites(founder_number)
  where status in ('pending','activating','activated');

create unique index founder_invites_live_email_uq
  on public.founder_invites(email_normalized)
  where status in ('pending','activating','activated');

create unique index founder_invites_live_sales_lead_uq
  on public.founder_invites(sales_lead_id)
  where sales_lead_id is not null
    and status in ('pending','activating','activated');

create index if not exists founder_invites_activation_claim_idx
  on public.founder_invites(activation_claim_id)
  where status = 'activating';

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
  update public.founder_invites
  set status = 'pending',
      activation_claim_id = null,
      activation_claimed_at = null,
      activation_last_error = 'STALE_ACTIVATION_CLAIM_RECOVERED',
      updated_at = now()
  where status = 'activating'
    and activation_claimed_at < now() - interval '10 minutes';

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
        v_invite.sales_lead_id,
        'system',
        'registrado',
        'Convite Founder #' || lpad(v_invite.founder_number::text, 2, '0') || ' expirou.',
        now(),
        now(),
        v_invite.created_by_email,
        v_invite.created_by_admin_id,
        'system',
        jsonb_build_object(
          'source', 'founder_program',
          'event', 'invite_expired',
          'founder_invite_id', v_invite.id,
          'founder_number', v_invite.founder_number
        )
      );
    end if;

    v_count := v_count + 1;
  end loop;

  return v_count;
end;
$$;

create or replace function public.preview_founder_activation(
  p_token_hash text
)
returns table (
  invite_id uuid,
  email text,
  founder_number integer,
  plan_key text,
  founder_price_cents integer,
  token_expires_at timestamptz,
  sales_lead_id uuid,
  empresa_nome text,
  nome_responsavel text,
  whatsapp text,
  segmento text,
  modelo_negocio text,
  cidade text,
  estado text,
  slug_sugerido text
)
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  perform public.expire_pending_founder_invites();

  if p_token_hash is null
     or p_token_hash !~ '^[0-9a-f]{64}$'
  then
    return;
  end if;

  return query
  select
    fi.id,
    fi.email,
    fi.founder_number,
    fi.plan_key,
    fi.founder_price_cents,
    fi.token_expires_at,
    fi.sales_lead_id,
    sl.empresa_nome,
    sl.nome_responsavel,
    sl.whatsapp,
    sl.segmento,
    sl.modelo_negocio,
    sl.cidade,
    sl.estado,
    sl.slug_sugerido
  from public.founder_invites fi
  left join public.signup_leads sl
    on sl.id = fi.sales_lead_id
  where fi.token_hash = p_token_hash
    and fi.status = 'pending'
    and (
      fi.token_expires_at is null
      or fi.token_expires_at > now()
    )
  limit 1;
end;
$$;

create or replace function public.claim_founder_activation(
  p_token_hash text,
  p_email text,
  p_claim_id uuid
)
returns table (
  invite_id uuid,
  email text,
  founder_number integer,
  plan_key text,
  founder_price_cents integer,
  sales_lead_id uuid
)
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_invite public.founder_invites%rowtype;
  v_email text := lower(btrim(coalesce(p_email, '')));
begin
  if p_claim_id is null then
    raise exception 'FOUNDER_ACTIVATION_CLAIM_REQUIRED';
  end if;

  if p_token_hash is null
     or p_token_hash !~ '^[0-9a-f]{64}$'
  then
    raise exception 'FOUNDER_ACTIVATION_INVALID_TOKEN';
  end if;

  if v_email = ''
     or position('@' in v_email) <= 1
  then
    raise exception 'FOUNDER_ACTIVATION_INVALID_EMAIL';
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended(p_token_hash, 0)
  );

  update public.founder_invites
  set status = 'pending',
      activation_claim_id = null,
      activation_claimed_at = null,
      activation_last_error = 'STALE_ACTIVATION_CLAIM_RECOVERED',
      updated_at = now()
  where token_hash = p_token_hash
    and status = 'activating'
    and activation_claimed_at < now() - interval '10 minutes';

  select *
    into v_invite
  from public.founder_invites
  where token_hash = p_token_hash
  for update;

  if not found then
    raise exception 'FOUNDER_ACTIVATION_INVALID_TOKEN';
  end if;

  if v_invite.status = 'activating' then
    raise exception 'FOUNDER_ACTIVATION_IN_PROGRESS';
  end if;

  if v_invite.status <> 'pending' then
    raise exception 'FOUNDER_ACTIVATION_NOT_PENDING';
  end if;

  if v_invite.token_expires_at is not null
     and v_invite.token_expires_at <= now()
  then
    raise exception 'FOUNDER_ACTIVATION_EXPIRED';
  end if;

  if v_invite.email_normalized <> v_email then
    raise exception 'FOUNDER_ACTIVATION_EMAIL_MISMATCH';
  end if;

  update public.founder_invites
  set status = 'activating',
      activation_claim_id = p_claim_id,
      activation_claimed_at = now(),
      activation_attempts = activation_attempts + 1,
      activation_last_error = null,
      updated_at = now()
  where id = v_invite.id;

  return query
  select
    v_invite.id,
    v_invite.email,
    v_invite.founder_number,
    v_invite.plan_key,
    v_invite.founder_price_cents,
    v_invite.sales_lead_id;
end;
$$;

create or replace function public.release_founder_activation_claim(
  p_claim_id uuid,
  p_error text default null
)
returns boolean
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_invite public.founder_invites%rowtype;
  v_new_status text;
begin
  select *
    into v_invite
  from public.founder_invites
  where activation_claim_id = p_claim_id
    and status = 'activating'
  for update;

  if not found then
    return false;
  end if;

  v_new_status := case
    when v_invite.token_expires_at is not null
         and v_invite.token_expires_at <= now()
      then 'expired'
    else 'pending'
  end;

  update public.founder_invites
  set status = v_new_status,
      activation_claim_id = null,
      activation_claimed_at = null,
      activation_last_error = left(
        nullif(btrim(coalesce(p_error, '')), ''),
        1000
      ),
      updated_at = now()
  where id = v_invite.id;

  if v_new_status = 'expired'
     and v_invite.sales_lead_id is not null
  then
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
  end if;

  return true;
end;
$$;

create or replace function public.complete_founder_activation(
  p_claim_id uuid,
  p_user_id uuid,
  p_company_name text,
  p_slug text,
  p_business_type text,
  p_whatsapp text default null,
  p_cidade text default null,
  p_estado text default null,
  p_onboarding_goal text default null,
  p_default_setup jsonb default '{}'::jsonb
)
returns public.companies
language plpgsql
security definer
set search_path = pg_catalog, public, auth
as $$
declare
  v_invite public.founder_invites%rowtype;
  v_lead public.signup_leads%rowtype;
  v_company public.companies%rowtype;
  v_user_email text;

  v_company_name text := btrim(coalesce(p_company_name, ''));
  v_slug text := lower(btrim(coalesce(p_slug, '')));
  v_business_type text := lower(
    btrim(coalesce(p_business_type, 'services'))
  );
  v_whatsapp text := nullif(
    btrim(coalesce(p_whatsapp, '')),
    ''
  );
  v_cidade text := nullif(
    btrim(coalesce(p_cidade, '')),
    ''
  );
  v_estado text := upper(
    nullif(btrim(coalesce(p_estado, '')), '')
  );
  v_onboarding_goal text := nullif(
    btrim(coalesce(p_onboarding_goal, '')),
    ''
  );

  v_started timestamptz := now();
  v_trial_ends timestamptz;
  v_price_ends timestamptz;
  v_payment_methods text[];
  v_delivery_options text[];
begin
  if p_claim_id is null
     or p_user_id is null
  then
    raise exception 'FOUNDER_ACTIVATION_INVALID_FINALIZE';
  end if;

  select lower(email)
    into v_user_email
  from auth.users
  where id = p_user_id;

  if v_user_email is null then
    raise exception 'FOUNDER_ACTIVATION_AUTH_USER_NOT_FOUND';
  end if;

  select *
    into v_invite
  from public.founder_invites
  where activation_claim_id = p_claim_id
    and status = 'activating'
  for update;

  if not found then
    raise exception 'FOUNDER_ACTIVATION_CLAIM_NOT_FOUND';
  end if;

  if v_invite.token_expires_at is not null
     and v_invite.token_expires_at <= now()
  then
    raise exception 'FOUNDER_ACTIVATION_EXPIRED';
  end if;

  if lower(v_invite.email) <> v_user_email then
    raise exception 'FOUNDER_ACTIVATION_AUTH_EMAIL_MISMATCH';
  end if;

  if exists (
    select 1
    from public.companies c
    where c.owner_id = p_user_id
       or lower(coalesce(c.email, '')) = v_user_email
  ) then
    raise exception 'FOUNDER_ACTIVATION_COMPANY_ALREADY_EXISTS';
  end if;

  if length(v_company_name) < 2
     or length(v_company_name) > 80
  then
    raise exception 'FOUNDER_ACTIVATION_INVALID_COMPANY_NAME';
  end if;

  if v_slug !~ '^[a-z0-9][a-z0-9-]{1,40}[a-z0-9]$'
     or v_slug like '%--%'
  then
    raise exception 'FOUNDER_ACTIVATION_INVALID_SLUG';
  end if;

  if v_business_type not in (
    'services',
    'graphic',
    'food',
    'beauty',
    'barber',
    'technical_assistance',
    'auto',
    'store',
    'events',
    'custom_products'
  ) then
    v_business_type := 'services';
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended(
      'orcaly-founder-company:' || v_slug,
      0
    )
  );

  if exists (
    select 1
    from public.companies c
    where c.slug = v_slug
       or lower(c.subdomain_slug) =
          regexp_replace(v_slug, '[^a-z0-9]', '', 'g')
  ) then
    raise exception 'FOUNDER_ACTIVATION_SLUG_TAKEN';
  end if;

  if v_invite.sales_lead_id is not null then
    select *
      into v_lead
    from public.signup_leads
    where id = v_invite.sales_lead_id
    for update;
  end if;

  v_trial_ends := v_started + interval '30 days';
  v_price_ends := v_trial_ends + interval '6 months';

  if jsonb_typeof(
    p_default_setup->'site_payment_methods'
  ) = 'array' then
    select array_agg(value)
      into v_payment_methods
    from jsonb_array_elements_text(
      p_default_setup->'site_payment_methods'
    ) as t(value);
  end if;

  if jsonb_typeof(
    p_default_setup->'site_delivery_options'
  ) = 'array' then
    select array_agg(value)
      into v_delivery_options
    from jsonb_array_elements_text(
      p_default_setup->'site_delivery_options'
    ) as t(value);
  end if;

  insert into public.companies (
    nome,
    slug,
    subdomain_slug,
    owner_id,
    email,
    whatsapp,
    telefone,
    cidade,
    estado,
    segmento,
    modelo_negocio,
    business_type,
    onboarding_goal,
    plano,
    assinatura_plano,
    assinatura_status,
    assinatura_inicio,
    assinatura_expira_em,
    assinatura_auto_recorrente,
    trial_started_at,
    trial_ends_at,
    trial_used_at,
    access_until,
    cancel_at_period_end,
    is_founder,
    founder_number,
    founder_price_cents,
    founder_started_at,
    founder_trial_ends_at,
    founder_price_ends_at,
    site_template,
    site_layout,
    site_cta_text,
    site_marketplace_title,
    site_marketplace_subtitle,
    site_cart_button_text,
    site_checkout_button_text,
    site_empty_catalog_text,
    site_headline,
    site_subheadline,
    site_about_title,
    site_about_text,
    site_benefits,
    site_faq,
    site_features,
    site_payment_methods,
    site_delivery_options
  )
  values (
    v_company_name,
    v_slug,
    v_slug,
    p_user_id,
    v_user_email,
    v_whatsapp,
    v_whatsapp,
    v_cidade,
    v_estado,
    coalesce(
      nullif(btrim(v_lead.segmento), ''),
      v_business_type
    ),
    coalesce(
      nullif(btrim(v_lead.modelo_negocio), ''),
      v_business_type
    ),
    v_business_type,
    v_onboarding_goal,
    v_invite.plan_key,
    v_invite.plan_key,
    'trialing',
    v_started,
    v_trial_ends,
    false,
    v_started,
    v_trial_ends,
    v_started,
    v_trial_ends,
    false,
    true,
    v_invite.founder_number,
    v_invite.founder_price_cents,
    v_started,
    v_trial_ends,
    v_price_ends,
    coalesce(
      nullif(p_default_setup->>'site_template', ''),
      v_business_type
    ),
    coalesce(
      nullif(p_default_setup->>'site_layout', ''),
      'premium'
    ),
    nullif(p_default_setup->>'site_cta_text', ''),
    nullif(p_default_setup->>'site_marketplace_title', ''),
    nullif(p_default_setup->>'site_marketplace_subtitle', ''),
    nullif(p_default_setup->>'site_cart_button_text', ''),
    nullif(p_default_setup->>'site_checkout_button_text', ''),
    nullif(p_default_setup->>'site_empty_catalog_text', ''),
    nullif(p_default_setup->>'site_headline', ''),
    nullif(p_default_setup->>'site_subheadline', ''),
    nullif(p_default_setup->>'site_about_title', ''),
    nullif(p_default_setup->>'site_about_text', ''),
    coalesce(
      p_default_setup->'site_benefits',
      '[]'::jsonb
    ),
    coalesce(
      p_default_setup->'site_faq',
      '[]'::jsonb
    ),
    coalesce(
      p_default_setup->'site_features',
      '[]'::jsonb
    ),
    v_payment_methods,
    v_delivery_options
  )
  returning * into v_company;

  update public.founder_invites
  set status = 'activated',
      activated_at = v_started,
      user_id = p_user_id,
      company_id = v_company.id,
      activation_claim_id = null,
      activation_claimed_at = null,
      activation_last_error = null,
      updated_at = now()
  where id = v_invite.id;

  if v_invite.sales_lead_id is not null then
    update public.signup_leads
    set converted_user_id = p_user_id,
        converted_company_id = v_company.id,
        sales_stage = 'conta_ativada',
        sales_stage_updated_at = now(),
        sales_lost_reason = null,
        raw_data =
          coalesce(raw_data, '{}'::jsonb)
          || jsonb_build_object(
            'founder_invite_id', v_invite.id,
            'founder_number', v_invite.founder_number,
            'founder_activated', true,
            'founder_company_id', v_company.id
          ),
        updated_at = now()
    where id = v_invite.sales_lead_id;

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
      v_invite.sales_lead_id,
      'system',
      'registrado',
      'Conta Founder #'
        || lpad(v_invite.founder_number::text, 2, '0')
        || ' ativada.',
      now(),
      now(),
      v_invite.created_by_email,
      v_invite.created_by_admin_id,
      'system',
      jsonb_build_object(
        'source', 'founder_program',
        'event', 'account_activated',
        'founder_invite_id', v_invite.id,
        'founder_number', v_invite.founder_number,
        'company_id', v_company.id,
        'user_id', p_user_id,
        'trial_ends_at', v_trial_ends,
        'founder_price_ends_at', v_price_ends
      )
    );
  end if;

  return v_company;
end;
$$;

revoke all on function public.preview_founder_activation(text)
  from public, anon, authenticated;
revoke all on function public.claim_founder_activation(text,text,uuid)
  from public, anon, authenticated;
revoke all on function public.release_founder_activation_claim(uuid,text)
  from public, anon, authenticated;
revoke all on function public.complete_founder_activation(
  uuid,uuid,text,text,text,text,text,text,text,jsonb
) from public, anon, authenticated;

grant execute on function public.preview_founder_activation(text)
  to service_role;
grant execute on function public.claim_founder_activation(text,text,uuid)
  to service_role;
grant execute on function public.release_founder_activation_claim(uuid,text)
  to service_role;
grant execute on function public.complete_founder_activation(
  uuid,uuid,text,text,text,text,text,text,text,jsonb
) to service_role;
