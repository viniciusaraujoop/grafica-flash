drop index if exists public.idx_signup_lead_followups_sales_lead_created;

create index if not exists founder_invites_revoked_by_admin_idx
  on public.founder_invites(revoked_by_admin_id, revoked_at desc)
  where revoked_by_admin_id is not null;
