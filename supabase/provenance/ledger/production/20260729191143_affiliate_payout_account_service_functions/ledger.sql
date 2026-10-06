begin;

create or replace function public.save_affiliate_payout_account_admin(
  p_affiliate_id uuid,
  p_pix_key_type text,
  p_pix_key_encrypted text,
  p_pix_key_masked text,
  p_holder_name text,
  p_holder_document_hash text,
  p_holder_document_last4 text,
  p_bank_name text,
  p_provider_validation jsonb,
  p_is_verified boolean,
  p_verified_by text
)
returns boolean
language plpgsql
security definer
set search_path = pg_catalog, public, orcaly_private
as $$
begin
  if p_pix_key_type not in ('CPF','CNPJ','EMAIL','PHONE','EVP') then
    raise exception 'Tipo de chave Pix inválido.';
  end if;

  if not exists (
    select 1 from public.affiliate_profiles
    where id = p_affiliate_id
      and status in ('pending','active')
  ) then
    raise exception 'Indicador não encontrado ou bloqueado.';
  end if;

  insert into orcaly_private.affiliate_payout_accounts (
    affiliate_id,
    pix_key_type,
    pix_key_encrypted,
    pix_key_masked,
    holder_name,
    holder_document_hash,
    holder_document_last4,
    bank_name,
    provider_validation,
    is_verified,
    verified_at,
    verified_by
  ) values (
    p_affiliate_id,
    p_pix_key_type,
    p_pix_key_encrypted,
    p_pix_key_masked,
    p_holder_name,
    p_holder_document_hash,
    p_holder_document_last4,
    nullif(trim(p_bank_name), ''),
    coalesce(p_provider_validation, '{}'::jsonb),
    p_is_verified,
    case when p_is_verified then now() else null end,
    nullif(trim(p_verified_by), '')
  )
  on conflict (affiliate_id) do update
  set pix_key_type = excluded.pix_key_type,
      pix_key_encrypted = excluded.pix_key_encrypted,
      pix_key_masked = excluded.pix_key_masked,
      holder_name = excluded.holder_name,
      holder_document_hash = excluded.holder_document_hash,
      holder_document_last4 = excluded.holder_document_last4,
      bank_name = excluded.bank_name,
      provider_validation = excluded.provider_validation,
      is_verified = excluded.is_verified,
      verified_at = excluded.verified_at,
      verified_by = excluded.verified_by,
      updated_at = now();

  update public.affiliate_profiles
  set payout_status = case when p_is_verified then 'verified' else 'pending_verification' end,
      updated_at = now()
  where id = p_affiliate_id;

  return true;
end;
$$;

revoke all on function public.save_affiliate_payout_account_admin(uuid,text,text,text,text,text,text,text,jsonb,boolean,text) from public, anon, authenticated;
grant execute on function public.save_affiliate_payout_account_admin(uuid,text,text,text,text,text,text,text,jsonb,boolean,text) to service_role;

create or replace function public.get_affiliate_payout_account_admin(p_affiliate_id uuid)
returns table (
  affiliate_id uuid,
  pix_key_type text,
  pix_key_encrypted text,
  pix_key_masked text,
  holder_name text,
  holder_document_hash text,
  holder_document_last4 text,
  bank_name text,
  provider_validation jsonb,
  is_verified boolean,
  verified_at timestamptz,
  updated_at timestamptz
)
language sql
security definer
set search_path = pg_catalog, public, orcaly_private
as $$
  select
    a.affiliate_id,
    a.pix_key_type,
    a.pix_key_encrypted,
    a.pix_key_masked,
    a.holder_name,
    a.holder_document_hash,
    a.holder_document_last4,
    a.bank_name,
    a.provider_validation,
    a.is_verified,
    a.verified_at,
    a.updated_at
  from orcaly_private.affiliate_payout_accounts a
  where a.affiliate_id = p_affiliate_id;
$$;

revoke all on function public.get_affiliate_payout_account_admin(uuid) from public, anon, authenticated;
grant execute on function public.get_affiliate_payout_account_admin(uuid) to service_role;

create or replace function public.set_affiliate_payout_account_verification_admin(
  p_affiliate_id uuid,
  p_verified boolean,
  p_verified_by text,
  p_note text default null
)
returns boolean
language plpgsql
security definer
set search_path = pg_catalog, public, orcaly_private
as $$
begin
  update orcaly_private.affiliate_payout_accounts
  set is_verified = p_verified,
      verified_at = case when p_verified then now() else null end,
      verified_by = nullif(trim(p_verified_by), ''),
      provider_validation = provider_validation || jsonb_build_object(
        'manual_note', nullif(trim(p_note), ''),
        'manual_verified', p_verified,
        'manual_verified_at', now()
      ),
      updated_at = now()
  where affiliate_id = p_affiliate_id;

  if not found then
    return false;
  end if;

  update public.affiliate_profiles
  set payout_status = case when p_verified then 'verified' else 'pending_verification' end,
      updated_at = now()
  where id = p_affiliate_id;

  return true;
end;
$$;

revoke all on function public.set_affiliate_payout_account_verification_admin(uuid,boolean,text,text) from public, anon, authenticated;
grant execute on function public.set_affiliate_payout_account_verification_admin(uuid,boolean,text,text) to service_role;

commit;
