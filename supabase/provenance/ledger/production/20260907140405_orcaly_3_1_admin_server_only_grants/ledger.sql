revoke all privileges on table public.platform_feature_flags from anon, authenticated;
revoke all privileges on table public.platform_support_tickets from anon, authenticated;
revoke all privileges on table public.platform_support_ticket_events from anon, authenticated;

grant select, insert, update, delete on table public.platform_feature_flags to service_role;
grant select, insert, update, delete on table public.platform_support_tickets to service_role;
grant select, insert, update, delete on table public.platform_support_ticket_events to service_role;
