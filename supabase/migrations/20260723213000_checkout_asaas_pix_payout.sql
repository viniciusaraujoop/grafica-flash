-- ORCALY_CHECKOUT_ASAAS_PIX_PAYOUT_V1
-- MantÃ©m histÃ³rico do Mercado Pago, ativa o novo fluxo Asaas e adiciona repasse Pix externo.

alter table public.marketplace_payment_settings
  add column if not exists payout_pix_key_encrypted text,
  add column if not exists payout_pix_key_type text,
  add column if not exists payout_pix_key_masked text,
  add column if not exists payout_pix_owner_name text,
  add column if not exists payout_pix_owner_document_masked text,
  add column if not exists automatic_payout_enabled boolean not null default false,
  add column if not exists minimum_payout_amount numeric(12,2) not null default 0,
  add column if not exists last_payout_at timestamptz;

alter table public.payment_payouts
  add column if not exists external_reference text,
  add column if not exists pix_key_type text,
  add column if not exists pix_key_masked text,
  add column if not exists attempts integer not null default 0;

create unique index if not exists payment_payouts_marketplace_payment_id_uidx
  on public.payment_payouts (marketplace_payment_id);

create unique index if not exists marketplace_payment_settings_company_provider_uidx
  on public.marketplace_payment_settings (company_id, provider);

create index if not exists marketplace_payment_settings_active_idx
  on public.marketplace_payment_settings (company_id, is_active, provider);

create index if not exists payment_payouts_provider_id_idx
  on public.payment_payouts (provider, provider_payout_id);

-- O Mercado Pago nÃ£o Ã© apagado. Apenas deixa de ser o provedor ativo da empresa piloto.
update public.marketplace_payment_settings
set
  is_active = false,
  updated_at = now()
where provider = 'mercado_pago'
  and company_id in (
    select id
    from public.companies
    where slug = 'grafica-flash'
       or subdomain_slug = 'grafica-flash'
  );
