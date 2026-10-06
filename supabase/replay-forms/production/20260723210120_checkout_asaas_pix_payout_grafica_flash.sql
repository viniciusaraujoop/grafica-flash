-- HISTORICAL EXECUTION RECORD: supabase/provenance/ledger/production/20260723210120_checkout_asaas_pix_payout_grafica_flash/ledger.sql (non-executable evidence).
-- FRESH-ENVIRONMENT REPLAY FORM: NEUTRALIZED.
-- Production must NEVER re-execute this historical identity.
-- Prepared only; frontier/fixed-point certification is pending.
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
