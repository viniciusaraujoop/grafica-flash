create index if not exists idx_affiliate_audit_logs_actor_user_id
  on public.affiliate_audit_logs (actor_user_id);
create index if not exists idx_affiliate_commissions_payout_id
  on public.affiliate_commissions (payout_id);
create index if not exists idx_affiliate_commissions_plan_payment_id
  on public.affiliate_commissions (plan_payment_id);

create index if not exists idx_art_approval_requests_order_id
  on public.art_approval_requests (order_id);
create index if not exists idx_art_approval_requests_proposal_id
  on public.art_approval_requests (proposal_id);

create index if not exists idx_company_members_created_by
  on public.company_members (created_by);
create index if not exists idx_customer_followups_created_by
  on public.customer_followups (created_by);
create index if not exists idx_customer_internal_notes_company_id
  on public.customer_internal_notes (company_id);
create index if not exists idx_customer_notes_created_by
  on public.customer_notes (created_by);
create index if not exists idx_customer_portal_events_company_id
  on public.customer_portal_events (company_id);
create index if not exists idx_customer_portal_events_magic_link_id
  on public.customer_portal_events (customer_magic_link_id);

create index if not exists idx_marketplace_oauth_states_company_id
  on public.marketplace_oauth_states (company_id);
create index if not exists idx_marketplace_oauth_states_user_id
  on public.marketplace_oauth_states (user_id);

create index if not exists idx_recurring_orders_original_order_id
  on public.recurring_orders (original_order_id);
create index if not exists idx_security_events_actor_user_id
  on public.security_events (actor_user_id);
create index if not exists idx_signup_leads_affiliate_referral_id
  on public.signup_leads (affiliate_referral_id);
