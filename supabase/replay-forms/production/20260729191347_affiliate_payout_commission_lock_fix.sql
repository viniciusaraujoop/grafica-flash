-- HISTORICAL EXECUTION RECORD: supabase/provenance/ledger/production/20260729191347_affiliate_payout_commission_lock_fix/ledger.sql (non-executable evidence).
-- FRESH-ENVIRONMENT REPLAY FORM: VERBATIM_LEDGER.
-- Production must NEVER re-execute this historical identity.
-- Prepared only; frontier/fixed-point certification is pending.
begin;

create or replace function public.create_affiliate_payout_admin(p_affiliate_id uuid)
returns table (payout_id uuid, payout_amount numeric, gross_amount numeric, debt_applied numeric)
language plpgsql
security definer
set search_path = pg_catalog, public, orcaly_private
as $$
declare
  profile_row public.affiliate_profiles%rowtype;
  account_row orcaly_private.affiliate_payout_accounts%rowtype;
  settings_row public.affiliate_program_settings%rowtype;
  gross numeric(14,2);
  debt numeric(14,2);
  offset_value numeric(14,2);
  net_value numeric(14,2);
  new_payout_id uuid;
begin
  perform public.release_affiliate_commissions_admin();

  select * into profile_row
  from public.affiliate_profiles
  where id = p_affiliate_id
  for update;

  if not found or profile_row.status <> 'active' then
    raise exception 'Indicador inativo ou não encontrado.';
  end if;

  select * into account_row
  from orcaly_private.affiliate_payout_accounts
  where affiliate_id = p_affiliate_id
  for update;

  if not found or not account_row.is_verified then
    raise exception 'Conta Pix ainda não verificada.';
  end if;

  select * into settings_row
  from public.affiliate_program_settings
  where id = 1;

  if not settings_row.payouts_enabled then
    raise exception 'Pagamentos de comissão estão temporariamente desativados.';
  end if;

  if exists (
    select 1 from public.affiliate_payouts
    where affiliate_id = p_affiliate_id
      and status in ('requested','approved','processing')
  ) then
    raise exception 'Já existe um pagamento em andamento.';
  end if;

  select coalesce(sum(locked.commission_amount), 0)
  into gross
  from (
    select c.id, c.commission_amount
    from public.affiliate_commissions c
    where c.affiliate_id = p_affiliate_id
      and c.status = 'available'
    order by c.created_at, c.id
    for update
  ) locked;

  debt := coalesce(profile_row.debt_balance, 0);
  offset_value := least(gross, debt);
  net_value := round(gross - offset_value, 2);

  if net_value < settings_row.minimum_payout_amount then
    raise exception 'Saldo disponível abaixo do mínimo de pagamento.';
  end if;

  insert into public.affiliate_payouts (
    affiliate_id,
    gross_commissions,
    debt_offset,
    amount,
    status,
    provider,
    external_reference,
    pix_key_type,
    pix_key_masked,
    holder_name
  ) values (
    p_affiliate_id,
    gross,
    offset_value,
    net_value,
    'requested',
    'manual',
    'affiliate_payout:' || gen_random_uuid()::text,
    account_row.pix_key_type,
    account_row.pix_key_masked,
    account_row.holder_name
  ) returning id into new_payout_id;

  insert into public.affiliate_payout_items (payout_id, commission_id, amount)
  select new_payout_id, id, commission_amount
  from public.affiliate_commissions
  where affiliate_id = p_affiliate_id
    and status = 'available';

  update public.affiliate_commissions
  set status = 'processing',
      payout_id = new_payout_id,
      updated_at = now()
  where affiliate_id = p_affiliate_id
    and status = 'available';

  update public.affiliate_profiles
  set debt_balance = greatest(0, debt - offset_value),
      updated_at = now()
  where id = p_affiliate_id;

  return query select new_payout_id, net_value, gross, offset_value;
end;
$$;

revoke all on function public.create_affiliate_payout_admin(uuid) from public, anon, authenticated;
grant execute on function public.create_affiliate_payout_admin(uuid) to service_role;

commit;
