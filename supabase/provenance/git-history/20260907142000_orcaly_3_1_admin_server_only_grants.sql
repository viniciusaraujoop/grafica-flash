-- ORÇALY 3.1 — classify Control Center tables as ADMIN_ONLY / SERVER_ONLY.
-- Admin API routes access these tables through a service-role server client after
-- requirePlatformAdmin authorization. Direct anon/authenticated table grants are unnecessary.

revoke all privileges on table public.platform_feature_flags from anon, authenticated;
revoke all privileges on table public.platform_support_tickets from anon, authenticated;
revoke all privileges on table public.platform_support_ticket_events from anon, authenticated;

-- Keep explicit server access. RLS remains enabled and no permissive client policy is added.
grant select, insert, update, delete on table public.platform_feature_flags to service_role;
grant select, insert, update, delete on table public.platform_support_tickets to service_role;
grant select, insert, update, delete on table public.platform_support_ticket_events to service_role;
