-- ORCALY_SUBSCRIPTION_WEBHOOK_V1
create unique index if not exists subscription_events_provider_event_uidx
  on public.subscription_events (provider, provider_event_id)
  where provider_event_id is not null;
create index if not exists plan_payments_company_created_idx
  on public.plan_payments (company_id, created_at desc);
create index if not exists plan_payments_provider_subscription_idx
  on public.plan_payments (provider, provider_subscription_id)
  where provider_subscription_id is not null;
create index if not exists plan_payments_provider_payment_idx
  on public.plan_payments (provider, provider_payment_id)
  where provider_payment_id is not null;
