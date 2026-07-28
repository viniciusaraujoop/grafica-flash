-- ORCALY_INTERNAL_VIEWS_SECURITY_1D1

create or replace view public.company_members_public
with (security_invoker = true)
as
select
  cm.id,
  cm.company_id,
  cm.user_id,
  cm.cargo,
  cm.status,
  cm.created_at,
  cm.email::varchar as email,
  cm.nome
from public.company_members cm;

alter view public.admin_signup_leads_overview
  set (security_invoker = true);

alter view public.proposals_dashboard
  set (security_invoker = true);

alter view public.production_dashboard
  set (security_invoker = true);

alter view public.orcaly_company_health
  set (security_invoker = true);

revoke all privileges on public.company_members_public
  from public, anon, authenticated, service_role;
revoke all privileges on public.admin_signup_leads_overview
  from public, anon, authenticated, service_role;
revoke all privileges on public.proposals_dashboard
  from public, anon, authenticated, service_role;
revoke all privileges on public.production_dashboard
  from public, anon, authenticated, service_role;
revoke all privileges on public.orcaly_company_health
  from public, anon, authenticated, service_role;

grant select on public.company_members_public
  to authenticated, service_role;
grant select on public.admin_signup_leads_overview
  to authenticated, service_role;
grant select on public.proposals_dashboard
  to authenticated, service_role;
grant select on public.production_dashboard
  to authenticated, service_role;
grant select on public.orcaly_company_health
  to service_role;
