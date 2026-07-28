-- ORCALY_TRIGGER_FUNCTION_SEARCH_PATH_1D4
-- Fixa search_path e remove execucao direta das funcoes de trigger.

alter function public.set_company_subdomain_slug()
  set search_path = '';
alter function public.touch_signup_lead_updated_at()
  set search_path = '';
alter function public.company_member_touch()
  set search_path = '';
alter function public.limit_company_members()
  set search_path = '';
alter function public.finance_touch_updated_at()
  set search_path = '';
alter function public.protect_company_trial_used_at()
  set search_path = '';
alter function public.set_updated_at()
  set search_path = '';

revoke all on function public.set_company_subdomain_slug()
  from public, anon, authenticated;
revoke all on function public.touch_signup_lead_updated_at()
  from public, anon, authenticated;
revoke all on function public.company_member_touch()
  from public, anon, authenticated;
revoke all on function public.limit_company_members()
  from public, anon, authenticated;
revoke all on function public.finance_touch_updated_at()
  from public, anon, authenticated;
revoke all on function public.protect_company_trial_used_at()
  from public, anon, authenticated;
revoke all on function public.set_updated_at()
  from public, anon, authenticated;

grant execute on function public.set_company_subdomain_slug()
  to service_role;
grant execute on function public.touch_signup_lead_updated_at()
  to service_role;
grant execute on function public.company_member_touch()
  to service_role;
grant execute on function public.limit_company_members()
  to service_role;
grant execute on function public.finance_touch_updated_at()
  to service_role;
grant execute on function public.protect_company_trial_used_at()
  to service_role;
grant execute on function public.set_updated_at()
  to service_role;
