-- ORCALY_OWNER_SUPPORT_CONTROL_V1
-- Controle do dono, equipe de suporte e revisao financeira de indicacoes.
-- Esta migration nao contem senhas nem outros segredos de autenticacao.

begin;

alter table public.platform_admins
  add column if not exists nome text,
  add column if not exists permissions jsonb not null default '{}'::jsonb,
  add column if not exists area text not null default 'Plataforma',
  add column if not exists observacoes text,
  add column if not exists created_by text,
  add column if not exists last_login_at timestamptz,
  add column if not exists must_change_password boolean not null default false;

update public.platform_admins
set role = case
  when lower(role) in ('super_admin', 'owner') then 'owner'
  when lower(role) in ('suporte', 'support') then 'support'
  when lower(role) = 'finance' then 'finance'
  else 'admin'
end,
permissions = case
  when lower(role) in ('super_admin', 'owner')
    then '{"all":true}'::jsonb
  else coalesce(permissions, '{}'::jsonb)
end,
updated_at = now();

insert into public.platform_admins (
  user_id,
  email,
  role,
  is_active,
  nome,
  permissions,
  area,
  observacoes,
  created_by,
  created_at,
  updated_at
)
select
  u.id,
  lower(a.email),
  case
    when lower(a.role) = 'super_admin' then 'owner'
    when lower(a.role) = 'suporte' then 'support'
    else 'admin'
  end,
  a.ativo,
  coalesce(
    nullif(trim(a.nome), ''),
    split_part(a.email, '@', 1)
  ),
  case
    when lower(a.role) = 'super_admin'
      then '{"all":true}'::jsonb
    else coalesce(a.permissions, '{}'::jsonb)
  end,
  coalesce(nullif(trim(a.area), ''), 'Plataforma'),
  a.observacoes,
  coalesce(a.created_by, 'migração admin_users'),
  coalesce(a.created_at, now()),
  now()
from public.admin_users a
left join auth.users u
  on lower(u.email) = lower(a.email)
on conflict (email) do update
set user_id = coalesce(
      excluded.user_id,
      public.platform_admins.user_id
    ),
    nome = excluded.nome,
    role = excluded.role,
    is_active = excluded.is_active,
    permissions = excluded.permissions,
    area = excluded.area,
    observacoes = excluded.observacoes,
    updated_at = now();

create index if not exists platform_admins_role_active_idx
  on public.platform_admins (
    role,
    is_active,
    created_at desc
  );

alter table public.affiliate_referrals
  add column if not exists review_status text not null default 'pending',
  add column if not exists reviewed_at timestamptz,
  add column if not exists reviewed_by text,
  add column if not exists review_note text;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname =
      'affiliate_referrals_review_status_check'
      and conrelid =
        'public.affiliate_referrals'::regclass
  ) then
    alter table public.affiliate_referrals
      add constraint
        affiliate_referrals_review_status_check
      check (
        review_status in (
          'pending',
          'approved',
          'rejected',
          'flagged'
        )
      );
  end if;
end;
$$;

update public.affiliate_referrals
set review_status = 'approved',
    reviewed_at = coalesce(
      reviewed_at,
      created_at
    ),
    reviewed_by = coalesce(
      reviewed_by,
      'migration'
    )
where review_status = 'pending'
  and created_at < now();

create index if not exists affiliate_referrals_review_idx
  on public.affiliate_referrals (
    review_status,
    status,
    created_at desc
  );

create or replace function public.release_affiliate_commissions_admin()
returns integer
language plpgsql
security definer
set search_path =
  pg_catalog,
  public,
  orcaly_private
as $$
declare
  changed integer;
begin
  update public.affiliate_commissions c
  set status = 'available',
      available_at = coalesce(
        c.available_at,
        now()
      ),
      updated_at = now()
  from public.affiliate_profiles p,
       public.affiliate_referrals r
  where p.id = c.affiliate_id
    and r.id = c.referral_id
    and p.status = 'active'
    and r.review_status = 'approved'
    and c.status = 'hold'
    and c.hold_until is not null
    and c.hold_until <= now();

  get diagnostics changed = row_count;
  return changed;
end;
$$;

revoke all
on function public.release_affiliate_commissions_admin()
from public, anon, authenticated;

grant execute
on function public.release_affiliate_commissions_admin()
to service_role;

create or replace function public.review_affiliate_referral_admin(
  p_referral_id uuid,
  p_decision text,
  p_actor_email text,
  p_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path =
  pg_catalog,
  public,
  orcaly_private
as $$
declare
  referral_row public.affiliate_referrals%rowtype;
  commission_row public.affiliate_commissions%rowtype;
  next_status text;
begin
  if p_decision not in (
    'approved',
    'rejected',
    'flagged'
  ) then
    raise exception
      'Decisão de indicação inválida.';
  end if;

  select *
  into referral_row
  from public.affiliate_referrals
  where id = p_referral_id
  for update;

  if not found then
    raise exception
      'Indicação não encontrada.';
  end if;

  select *
  into commission_row
  from public.affiliate_commissions
  where referral_id = p_referral_id
  for update;

  if p_decision = 'approved' then
    next_status := referral_row.status;

    if referral_row.status = 'rejected' then
      if referral_row.first_payment_reference
        is not null then
        next_status := 'qualified';
      elsif referral_row.trial_ends_at
        is not null
        and referral_row.trial_ends_at > now()
      then
        next_status := 'trial';
      else
        next_status := 'payment_pending';
      end if;
    end if;

    update public.affiliate_referrals
    set review_status = 'approved',
        status = next_status,
        reviewed_at = now(),
        reviewed_by =
          lower(trim(p_actor_email)),
        review_note = nullif(
          left(
            trim(coalesce(p_note, '')),
            500
          ),
          ''
        ),
        rejected_at = null,
        rejection_reason = null,
        updated_at = now()
    where id = p_referral_id;

    if commission_row.id is not null
      and commission_row.status = 'hold'
      and commission_row.hold_until
        is not null
      and commission_row.hold_until <= now()
    then
      update public.affiliate_commissions
      set status = 'available',
          available_at = coalesce(
            available_at,
            now()
          ),
          updated_at = now()
      where id = commission_row.id;
    end if;

    return jsonb_build_object(
      'ok', true,
      'decision', 'approved',
      'referral_id', p_referral_id
    );
  end if;

  if p_decision = 'flagged' then
    update public.affiliate_referrals
    set review_status = 'flagged',
        reviewed_at = now(),
        reviewed_by =
          lower(trim(p_actor_email)),
        review_note = nullif(
          left(
            trim(coalesce(p_note, '')),
            500
          ),
          ''
        ),
        updated_at = now()
    where id = p_referral_id;

    return jsonb_build_object(
      'ok', true,
      'decision', 'flagged',
      'referral_id', p_referral_id
    );
  end if;

  if commission_row.id is not null
    and commission_row.status = 'processing'
  then
    raise exception
      'A indicação possui pagamento em processamento.';
  end if;

  if commission_row.id is not null
    and commission_row.status = 'paid'
  then
    update public.affiliate_profiles
    set debt_balance =
          debt_balance +
          commission_row.commission_amount,
        updated_at = now()
    where id = commission_row.affiliate_id;
  end if;

  if commission_row.id is not null
    and commission_row.status not in (
      'reversed',
      'rejected'
    )
  then
    update public.affiliate_commissions
    set status = 'reversed',
        reversed_at = now(),
        reversal_reason = coalesce(
          nullif(
            left(
              trim(coalesce(p_note, '')),
              500
            ),
            ''
          ),
          'Indicação recusada pela administração.'
        ),
        updated_at = now()
    where id = commission_row.id;
  end if;

  update public.affiliate_referrals
  set review_status = 'rejected',
      status = 'rejected',
      reviewed_at = now(),
      reviewed_by =
        lower(trim(p_actor_email)),
      review_note = nullif(
        left(
          trim(coalesce(p_note, '')),
          500
        ),
        ''
      ),
      rejected_at = now(),
      rejection_reason = coalesce(
        nullif(
          left(
            trim(coalesce(p_note, '')),
            500
          ),
          ''
        ),
        'Indicação recusada pela administração.'
      ),
      updated_at = now()
  where id = p_referral_id;

  return jsonb_build_object(
    'ok', true,
    'decision', 'rejected',
    'referral_id', p_referral_id,
    'commission_reversed',
      commission_row.id is not null
  );
end;
$$;

revoke all
on function public.review_affiliate_referral_admin(
  uuid,
  text,
  text,
  text
)
from public, anon, authenticated;

grant execute
on function public.review_affiliate_referral_admin(
  uuid,
  text,
  text,
  text
)
to service_role;

create or replace function public.list_affiliate_payout_accounts_admin()
returns table (
  affiliate_id uuid,
  pix_key_type text,
  pix_key_masked text,
  holder_name text,
  holder_document_last4 text,
  bank_name text,
  is_verified boolean,
  verified_at timestamptz,
  updated_at timestamptz
)
language sql
security definer
set search_path =
  pg_catalog,
  public,
  orcaly_private
as $$
  select
    a.affiliate_id,
    a.pix_key_type,
    a.pix_key_masked,
    a.holder_name,
    a.holder_document_last4,
    a.bank_name,
    a.is_verified,
    a.verified_at,
    a.updated_at
  from orcaly_private.affiliate_payout_accounts a
  order by a.updated_at desc;
$$;

revoke all
on function public.list_affiliate_payout_accounts_admin()
from public, anon, authenticated;

grant execute
on function public.list_affiliate_payout_accounts_admin()
to service_role;

comment on table public.platform_admins is
  'Equipe interna do Orcaly. Owner possui controle total; support usa permissoes granulares.';

comment on column public.platform_admins.permissions is
  'Permissoes administrativas granulares. Senhas nunca sao armazenadas nesta tabela.';

comment on column public.affiliate_referrals.review_status is
  'Revisao administrativa da elegibilidade antes da liberacao financeira.';

commit;
