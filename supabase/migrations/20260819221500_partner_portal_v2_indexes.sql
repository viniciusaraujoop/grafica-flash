-- ORCALY Partner Portal v2
-- Additive indexes only. Intentionally not applied automatically to production.

create index if not exists affiliate_referrals_whatsapp_registered_idx
  on public.affiliate_referrals (customer_whatsapp_hash, registered_at desc)
  where customer_whatsapp_hash is not null;

create index if not exists affiliate_clicks_affiliate_ip_created_idx
  on public.affiliate_clicks (affiliate_id, ip_hash, created_at desc)
  where ip_hash is not null;

create index if not exists affiliate_leads_contact_lookup_idx
  on public.affiliate_leads (whatsapp, lower(email), created_at desc);

create index if not exists affiliate_activity_events_metadata_gin_idx
  on public.affiliate_activity_events using gin (metadata jsonb_path_ops);
