begin;

drop policy if exists affiliate_settings_deny_client on public.affiliate_program_settings;
create policy affiliate_settings_deny_client
on public.affiliate_program_settings
for all
to authenticated
using (false)
with check (false);

drop policy if exists affiliate_clicks_deny_client on public.affiliate_clicks;
create policy affiliate_clicks_deny_client
on public.affiliate_clicks
for all
to authenticated
using (false)
with check (false);

drop policy if exists affiliate_payout_items_deny_client on public.affiliate_payout_items;
create policy affiliate_payout_items_deny_client
on public.affiliate_payout_items
for all
to authenticated
using (false)
with check (false);

drop policy if exists affiliate_audit_logs_deny_client on public.affiliate_audit_logs;
create policy affiliate_audit_logs_deny_client
on public.affiliate_audit_logs
for all
to authenticated
using (false)
with check (false);

commit;
