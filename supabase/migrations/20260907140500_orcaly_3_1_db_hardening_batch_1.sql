-- ORÇALY 3.1 — database hardening batch 1
-- Scope: objectively proven, low-risk index corrections only.

create index if not exists idx_platform_support_ticket_events_admin_id
  on public.platform_support_ticket_events (admin_id);

create index if not exists idx_platform_support_tickets_assignee_admin_id
  on public.platform_support_tickets (assignee_admin_id);

-- Live catalog review proved this index is byte-for-byte equivalent to
-- plan_payments_company_created_idx and is not attached to a constraint.
drop index if exists public.idx_plan_payments_admin_company_created;
