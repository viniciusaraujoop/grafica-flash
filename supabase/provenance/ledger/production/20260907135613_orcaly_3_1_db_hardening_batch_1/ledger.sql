create index if not exists idx_platform_support_ticket_events_admin_id
  on public.platform_support_ticket_events (admin_id);

create index if not exists idx_platform_support_tickets_assignee_admin_id
  on public.platform_support_tickets (assignee_admin_id);

drop index if exists public.idx_plan_payments_admin_company_created;
