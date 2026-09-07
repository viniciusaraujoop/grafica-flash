begin;

update public.companies
set
  plano = case
    when lower(coalesce(plano, '')) in ('essencial', 'bÃ¡sico') then 'basico'
    when lower(coalesce(plano, '')) in ('intermediario', 'intermediÃ¡rio') then 'profissional'
    else plano
  end,
  assinatura_plano = case
    when lower(coalesce(assinatura_plano, '')) in ('essencial', 'bÃ¡sico') then 'basico'
    when lower(coalesce(assinatura_plano, '')) in ('intermediario', 'intermediÃ¡rio') then 'profissional'
    else assinatura_plano
  end
where
  lower(coalesce(plano, '')) in (
    'essencial',
    'bÃ¡sico',
    'intermediario',
    'intermediÃ¡rio'
  )
  or lower(coalesce(assinatura_plano, '')) in (
    'essencial',
    'bÃ¡sico',
    'intermediario',
    'intermediÃ¡rio'
  );

update public.plan_payments
set plano = case
  when lower(plano) in ('essencial', 'bÃ¡sico') then 'basico'
  when lower(plano) in ('intermediario', 'intermediÃ¡rio') then 'profissional'
  else plano
end
where lower(plano) in (
  'essencial',
  'bÃ¡sico',
  'intermediario',
  'intermediÃ¡rio'
);

update public.plan_payments
set status = case
  when lower(coalesce(status, '')) in (
    'erro',
    'error',
    'subscription_error',
    'approval_error',
    'rejected'
  ) then 'failed'
  when lower(coalesce(status, '')) in (
    'pendente',
    'pending',
    'checkout_gerado',
    'pix_checkout_gerado',
    'subscription_pending',
    'subscription_creating',
    'creating',
    'applying'
  ) then 'pending'
  when lower(coalesce(status, '')) in ('approved', 'paid') then 'paid'
  else lower(status)
end
where status is not null;

update public.plan_payments
set provider = 'mercado_pago'
where provider is null
  and (
    mercado_pago_preference_id is not null
    or mercado_pago_payment_id is not null
    or mercado_pago_preapproval_id is not null
    or provider_payment_id is not null
    or provider_subscription_id is not null
    or lower(coalesce(payment_method, '')) in (
      'pix',
      'card_recurring',
      'credit_card',
      'debit_card'
    )
  );

alter table public.plan_payments
  alter column status set default 'pending';

commit;
