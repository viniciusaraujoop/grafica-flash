-- Orçaly 3.1 certification hardening for customer/data-quality foundation.
-- Keeps normalization semantics unchanged while removing mutable search_path warnings
-- and covers the two FK columns identified by the Performance Advisor.

alter function public.orcaly_normalize_email(text)
  set search_path = '';

alter function public.orcaly_normalize_phone_br(text)
  set search_path = '';

alter function public.orcaly_normalize_name(text)
  set search_path = '';

create index if not exists customer_duplicate_candidates_left_idx
  on public.customer_duplicate_candidates (left_customer_id);

create index if not exists timeline_events_customer_profile_id_idx
  on public.timeline_events (customer_profile_id);
