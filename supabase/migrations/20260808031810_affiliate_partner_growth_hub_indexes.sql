create index if not exists affiliate_tasks_lead_idx
  on public.affiliate_tasks(lead_id)
  where lead_id is not null;

create index if not exists affiliate_activity_events_lead_idx
  on public.affiliate_activity_events(lead_id)
  where lead_id is not null;
