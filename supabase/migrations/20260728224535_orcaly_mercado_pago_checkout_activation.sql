-- ORCALY_MERCADO_PAGO_CHECKOUT_ACTIVATION_V1

alter table public.orders
  add column if not exists coupon_consumed_at timestamptz;

create or replace function public.consume_marketplace_coupon(
  p_company_id uuid,
  p_order_id uuid
)
returns boolean
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_coupon_id uuid;
begin
  update public.orders
  set coupon_consumed_at = now(),
      updated_at = now()
  where id = p_order_id
    and company_id = p_company_id
    and coupon_id is not null
    and coupon_consumed_at is null
  returning coupon_id into v_coupon_id;

  if v_coupon_id is null then
    return false;
  end if;

  update public.marketplace_coupons
  set used_count = coalesce(used_count, 0) + 1,
      updated_at = now()
  where id = v_coupon_id
    and company_id = p_company_id;

  return found;
end;
$$;

revoke all
on function public.consume_marketplace_coupon(uuid, uuid)
from public, anon, authenticated;

grant execute
on function public.consume_marketplace_coupon(uuid, uuid)
to service_role;

update public.marketplace_payment_settings
set account_status = 'active',
    charges_enabled = true,
    pix_enabled = true,
    card_enabled = true,
    last_status_check_at = now(),
    updated_at = now()
where provider = 'mercado_pago'
  and is_active = true
  and onboarding_status = 'connected'
  and access_token is not null
  and public_key is not null;