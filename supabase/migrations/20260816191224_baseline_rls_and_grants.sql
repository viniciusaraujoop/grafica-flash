-- Recovery R3 authorization baseline.
-- The Data API receives only explicit DML grants; backend-only tables deliberately have no client policy or grant.
set lock_timeout = '5s';
set statement_timeout = '120s';

revoke all on schema orcaly_private from public, anon, authenticated;
-- USAGE only permits resolving the small allowlist of helper functions granted
-- below. The schema is not exposed by PostgREST and no private table grant is
-- given to a client role.
grant usage on schema orcaly_private to anon, authenticated, service_role;

revoke all privileges on all tables in schema public from anon, authenticated;
revoke all privileges on all tables in schema orcaly_private from public, anon, authenticated, service_role;
grant all privileges on all tables in schema public to service_role;

revoke execute on all functions in schema public from public, anon, authenticated, service_role;
revoke execute on all functions in schema orcaly_private from public, anon, authenticated, service_role;

alter default privileges in schema public revoke all on tables from anon, authenticated;
alter default privileges in schema public revoke execute on functions from public, anon, authenticated;
alter default privileges in schema orcaly_private revoke all on tables from public, anon, authenticated, service_role;
alter default privileges in schema orcaly_private revoke execute on functions from public, anon, authenticated, service_role;

alter table public.admin_audit_logs enable row level security;

alter table public.admin_bug_reports enable row level security;

alter table public.admin_scan_runs enable row level security;

alter table public.admin_system_snapshots enable row level security;

alter table public.admin_users enable row level security;

alter table public.affiliate_achievements enable row level security;

alter table public.affiliate_activity_events enable row level security;

alter table public.affiliate_announcements enable row level security;

alter table public.affiliate_audit_logs enable row level security;

alter table public.affiliate_certifications enable row level security;

alter table public.affiliate_clicks enable row level security;

alter table public.affiliate_commissions enable row level security;

alter table public.affiliate_course_progress enable row level security;

alter table public.affiliate_goals enable row level security;

alter table public.affiliate_leads enable row level security;

alter table public.affiliate_payout_items enable row level security;

alter table public.affiliate_payouts enable row level security;

alter table public.affiliate_profiles enable row level security;

alter table public.affiliate_program_settings enable row level security;

alter table public.affiliate_referrals enable row level security;

alter table public.affiliate_tasks enable row level security;

alter table public.affiliate_training_sessions enable row level security;

alter table public.app_notifications enable row level security;

alter table public.art_approval_requests enable row level security;

alter table public.business_hours enable row level security;

alter table public.companies enable row level security;

alter table public.company_members enable row level security;

alter table public.company_niche_templates enable row level security;

alter table public.company_proposal_settings enable row level security;

alter table public.company_whatsapp_settings enable row level security;

alter table public.crm_leads enable row level security;

alter table public.customer_followups enable row level security;

alter table public.customer_internal_notes enable row level security;

alter table public.customer_magic_links enable row level security;

alter table public.customer_notes enable row level security;

alter table public.customer_portal_events enable row level security;

alter table public.deliveries enable row level security;

alter table public.delivery_assignments enable row level security;

alter table public.delivery_drivers enable row level security;

alter table public.delivery_zones enable row level security;

alter table public.finance_accounts enable row level security;

alter table public.financial_categories enable row level security;

alter table public.financial_material_entries enable row level security;

alter table public.financial_transactions enable row level security;

alter table public.founder_invites enable row level security;

alter table public.internal_tasks enable row level security;

alter table public.marketplace_commission_rules enable row level security;

alter table public.marketplace_commissions enable row level security;

alter table public.marketplace_coupons enable row level security;

alter table public.marketplace_oauth_states enable row level security;

alter table public.marketplace_payment_settings enable row level security;

alter table public.marketplace_payments enable row level security;

alter table public.marketplace_stock_reservations enable row level security;

alter table public.notifications enable row level security;

alter table public.order_internal_comments enable row level security;

alter table public.order_items enable row level security;

alter table public.order_payments enable row level security;

alter table public.order_status_history enable row level security;

alter table public.orders enable row level security;

alter table public.payment_methods enable row level security;

alter table public.payment_payouts enable row level security;

alter table public.payment_webhook_events enable row level security;

alter table public.plan_payments enable row level security;

alter table public.platform_admin_invites enable row level security;

alter table public.platform_admins enable row level security;

alter table public.product_stock_movements enable row level security;

alter table public.production_orders enable row level security;

alter table public.production_steps enable row level security;

alter table public.products enable row level security;

alter table public.proposal_events enable row level security;

alter table public.proposals enable row level security;

alter table public.provider_customers enable row level security;

alter table public.quote_templates enable row level security;

alter table public.recurring_orders enable row level security;

alter table public.security_blocklist enable row level security;

alter table public.security_events enable row level security;

alter table public.signup_lead_followups enable row level security;

alter table public.signup_leads enable row level security;

alter table public.site_sections enable row level security;

alter table public.site_template_presets enable row level security;

alter table public.smart_notification_events enable row level security;

alter table public.smart_notification_settings enable row level security;

alter table public.subscription_events enable row level security;

alter table public.system_audit_logs enable row level security;

alter table public.whatsapp_conversations enable row level security;

alter table public.whatsapp_message_logs enable row level security;

create policy "Admin vê auditoria"
on public.admin_audit_logs
as permissive
for select
to authenticated
using ((EXISTS ( SELECT 1
   FROM admin_users au
  WHERE ((au.ativo = true) AND (lower(au.email) = lower((auth.jwt() ->> 'email'::text)))))));

create policy "Admins inserem audit logs"
on public.admin_audit_logs
as permissive
for insert
to authenticated
with check ((EXISTS ( SELECT 1
   FROM admin_users au
  WHERE ((au.ativo = true) AND (lower(au.email) = lower((auth.jwt() ->> 'email'::text)))))));

create policy "Admins inserem logs administrativos"
on public.admin_audit_logs
as permissive
for insert
to authenticated
with check ((EXISTS ( SELECT 1
   FROM admin_users au
  WHERE ((au.ativo = true) AND (lower(au.email) = lower((auth.jwt() ->> 'email'::text)))))));

create policy "Admins veem audit logs"
on public.admin_audit_logs
as permissive
for select
to authenticated
using ((EXISTS ( SELECT 1
   FROM admin_users au
  WHERE ((au.ativo = true) AND (lower(au.email) = lower((auth.jwt() ->> 'email'::text)))))));

create policy "Admins veem logs administrativos"
on public.admin_audit_logs
as permissive
for select
to authenticated
using ((EXISTS ( SELECT 1
   FROM admin_users au
  WHERE ((au.ativo = true) AND (lower(au.email) = lower((auth.jwt() ->> 'email'::text)))))));

create policy "Admin vê bugs"
on public.admin_bug_reports
as permissive
for select
to authenticated
using ((EXISTS ( SELECT 1
   FROM admin_users au
  WHERE ((au.ativo = true) AND (lower(au.email) = lower((auth.jwt() ->> 'email'::text)))))));

create policy "Admins gerenciam bugs"
on public.admin_bug_reports
as permissive
for all
to authenticated
using ((EXISTS ( SELECT 1
   FROM admin_users au
  WHERE ((au.ativo = true) AND (lower(au.email) = lower((auth.jwt() ->> 'email'::text)))))))
with check ((EXISTS ( SELECT 1
   FROM admin_users au
  WHERE ((au.ativo = true) AND (lower(au.email) = lower((auth.jwt() ->> 'email'::text)))))));

create policy "Admins veem bugs"
on public.admin_bug_reports
as permissive
for select
to authenticated
using ((EXISTS ( SELECT 1
   FROM admin_users au
  WHERE ((au.ativo = true) AND (lower(au.email) = lower((auth.jwt() ->> 'email'::text)))))));

create policy "Admins gerenciam scans"
on public.admin_scan_runs
as permissive
for all
to authenticated
using ((EXISTS ( SELECT 1
   FROM admin_users au
  WHERE ((au.ativo = true) AND (lower(au.email) = lower((auth.jwt() ->> 'email'::text)))))))
with check ((EXISTS ( SELECT 1
   FROM admin_users au
  WHERE ((au.ativo = true) AND (lower(au.email) = lower((auth.jwt() ->> 'email'::text)))))));

create policy "Admins veem scans"
on public.admin_scan_runs
as permissive
for select
to authenticated
using ((EXISTS ( SELECT 1
   FROM admin_users au
  WHERE ((au.ativo = true) AND (lower(au.email) = lower((auth.jwt() ->> 'email'::text)))))));

create policy "Admin vê snapshots"
on public.admin_system_snapshots
as permissive
for select
to authenticated
using ((EXISTS ( SELECT 1
   FROM admin_users au
  WHERE ((au.ativo = true) AND (lower(au.email) = lower((auth.jwt() ->> 'email'::text)))))));

create policy "Admin vê próprio cadastro admin"
on public.admin_users
as permissive
for select
to authenticated
using (((ativo = true) AND (lower(email) = lower((auth.jwt() ->> 'email'::text)))));

create policy "Admins veem admin users"
on public.admin_users
as permissive
for select
to authenticated
using ((EXISTS ( SELECT 1
   FROM admin_users au
  WHERE ((au.ativo = true) AND (lower(au.email) = lower((auth.jwt() ->> 'email'::text)))))));

create policy "Super admin gerencia admin users"
on public.admin_users
as permissive
for all
to authenticated
using ((EXISTS ( SELECT 1
   FROM admin_users au
  WHERE ((au.ativo = true) AND (au.role = 'super_admin'::text) AND (lower(au.email) = lower((auth.jwt() ->> 'email'::text)))))))
with check ((EXISTS ( SELECT 1
   FROM admin_users au
  WHERE ((au.ativo = true) AND (au.role = 'super_admin'::text) AND (lower(au.email) = lower((auth.jwt() ->> 'email'::text)))))));

create policy affiliate_achievements_delete_own
on public.affiliate_achievements
as permissive
for delete
to authenticated
using ((EXISTS ( SELECT 1
   FROM affiliate_profiles p
  WHERE ((p.id = affiliate_achievements.affiliate_id) AND (p.user_id = ( SELECT auth.uid() AS uid))))));

create policy affiliate_achievements_insert_own
on public.affiliate_achievements
as permissive
for insert
to authenticated
with check ((EXISTS ( SELECT 1
   FROM affiliate_profiles p
  WHERE ((p.id = affiliate_achievements.affiliate_id) AND (p.user_id = ( SELECT auth.uid() AS uid))))));

create policy affiliate_achievements_select_own
on public.affiliate_achievements
as permissive
for select
to authenticated
using ((EXISTS ( SELECT 1
   FROM affiliate_profiles p
  WHERE ((p.id = affiliate_achievements.affiliate_id) AND (p.user_id = ( SELECT auth.uid() AS uid))))));

create policy affiliate_achievements_update_own
on public.affiliate_achievements
as permissive
for update
to authenticated
using ((EXISTS ( SELECT 1
   FROM affiliate_profiles p
  WHERE ((p.id = affiliate_achievements.affiliate_id) AND (p.user_id = ( SELECT auth.uid() AS uid))))))
with check ((EXISTS ( SELECT 1
   FROM affiliate_profiles p
  WHERE ((p.id = affiliate_achievements.affiliate_id) AND (p.user_id = ( SELECT auth.uid() AS uid))))));

create policy affiliate_events_delete_own
on public.affiliate_activity_events
as permissive
for delete
to authenticated
using ((EXISTS ( SELECT 1
   FROM affiliate_profiles p
  WHERE ((p.id = affiliate_activity_events.affiliate_id) AND (p.user_id = ( SELECT auth.uid() AS uid))))));

create policy affiliate_events_insert_own
on public.affiliate_activity_events
as permissive
for insert
to authenticated
with check ((EXISTS ( SELECT 1
   FROM affiliate_profiles p
  WHERE ((p.id = affiliate_activity_events.affiliate_id) AND (p.user_id = ( SELECT auth.uid() AS uid))))));

create policy affiliate_events_select_own
on public.affiliate_activity_events
as permissive
for select
to authenticated
using ((EXISTS ( SELECT 1
   FROM affiliate_profiles p
  WHERE ((p.id = affiliate_activity_events.affiliate_id) AND (p.user_id = ( SELECT auth.uid() AS uid))))));

create policy affiliate_events_update_own
on public.affiliate_activity_events
as permissive
for update
to authenticated
using ((EXISTS ( SELECT 1
   FROM affiliate_profiles p
  WHERE ((p.id = affiliate_activity_events.affiliate_id) AND (p.user_id = ( SELECT auth.uid() AS uid))))))
with check ((EXISTS ( SELECT 1
   FROM affiliate_profiles p
  WHERE ((p.id = affiliate_activity_events.affiliate_id) AND (p.user_id = ( SELECT auth.uid() AS uid))))));

create policy affiliate_announcements_read
on public.affiliate_announcements
as permissive
for select
to authenticated
using (((is_active = true) AND (published_at <= now())));

create policy affiliate_audit_logs_deny_client
on public.affiliate_audit_logs
as permissive
for all
to authenticated
using (false)
with check (false);

create policy affiliate_cert_delete_own
on public.affiliate_certifications
as permissive
for delete
to authenticated
using ((EXISTS ( SELECT 1
   FROM affiliate_profiles p
  WHERE ((p.id = affiliate_certifications.affiliate_id) AND (p.user_id = ( SELECT auth.uid() AS uid))))));

create policy affiliate_cert_insert_own
on public.affiliate_certifications
as permissive
for insert
to authenticated
with check ((EXISTS ( SELECT 1
   FROM affiliate_profiles p
  WHERE ((p.id = affiliate_certifications.affiliate_id) AND (p.user_id = ( SELECT auth.uid() AS uid))))));

create policy affiliate_cert_select_own
on public.affiliate_certifications
as permissive
for select
to authenticated
using ((EXISTS ( SELECT 1
   FROM affiliate_profiles p
  WHERE ((p.id = affiliate_certifications.affiliate_id) AND (p.user_id = ( SELECT auth.uid() AS uid))))));

create policy affiliate_cert_update_own
on public.affiliate_certifications
as permissive
for update
to authenticated
using ((EXISTS ( SELECT 1
   FROM affiliate_profiles p
  WHERE ((p.id = affiliate_certifications.affiliate_id) AND (p.user_id = ( SELECT auth.uid() AS uid))))))
with check ((EXISTS ( SELECT 1
   FROM affiliate_profiles p
  WHERE ((p.id = affiliate_certifications.affiliate_id) AND (p.user_id = ( SELECT auth.uid() AS uid))))));

create policy affiliate_clicks_deny_client
on public.affiliate_clicks
as permissive
for all
to authenticated
using (false)
with check (false);

create policy affiliate_commissions_select_own
on public.affiliate_commissions
as permissive
for select
to authenticated
using ((EXISTS ( SELECT 1
   FROM affiliate_profiles p
  WHERE ((p.id = affiliate_commissions.affiliate_id) AND (p.user_id = ( SELECT auth.uid() AS uid))))));

create policy affiliate_course_delete_own
on public.affiliate_course_progress
as permissive
for delete
to authenticated
using ((EXISTS ( SELECT 1
   FROM affiliate_profiles p
  WHERE ((p.id = affiliate_course_progress.affiliate_id) AND (p.user_id = ( SELECT auth.uid() AS uid))))));

create policy affiliate_course_insert_own
on public.affiliate_course_progress
as permissive
for insert
to authenticated
with check ((EXISTS ( SELECT 1
   FROM affiliate_profiles p
  WHERE ((p.id = affiliate_course_progress.affiliate_id) AND (p.user_id = ( SELECT auth.uid() AS uid))))));

create policy affiliate_course_select_own
on public.affiliate_course_progress
as permissive
for select
to authenticated
using ((EXISTS ( SELECT 1
   FROM affiliate_profiles p
  WHERE ((p.id = affiliate_course_progress.affiliate_id) AND (p.user_id = ( SELECT auth.uid() AS uid))))));

create policy affiliate_course_update_own
on public.affiliate_course_progress
as permissive
for update
to authenticated
using ((EXISTS ( SELECT 1
   FROM affiliate_profiles p
  WHERE ((p.id = affiliate_course_progress.affiliate_id) AND (p.user_id = ( SELECT auth.uid() AS uid))))))
with check ((EXISTS ( SELECT 1
   FROM affiliate_profiles p
  WHERE ((p.id = affiliate_course_progress.affiliate_id) AND (p.user_id = ( SELECT auth.uid() AS uid))))));

create policy affiliate_goals_delete_own
on public.affiliate_goals
as permissive
for delete
to authenticated
using ((EXISTS ( SELECT 1
   FROM affiliate_profiles p
  WHERE ((p.id = affiliate_goals.affiliate_id) AND (p.user_id = ( SELECT auth.uid() AS uid))))));

create policy affiliate_goals_insert_own
on public.affiliate_goals
as permissive
for insert
to authenticated
with check ((EXISTS ( SELECT 1
   FROM affiliate_profiles p
  WHERE ((p.id = affiliate_goals.affiliate_id) AND (p.user_id = ( SELECT auth.uid() AS uid))))));

create policy affiliate_goals_select_own
on public.affiliate_goals
as permissive
for select
to authenticated
using ((EXISTS ( SELECT 1
   FROM affiliate_profiles p
  WHERE ((p.id = affiliate_goals.affiliate_id) AND (p.user_id = ( SELECT auth.uid() AS uid))))));

create policy affiliate_goals_update_own
on public.affiliate_goals
as permissive
for update
to authenticated
using ((EXISTS ( SELECT 1
   FROM affiliate_profiles p
  WHERE ((p.id = affiliate_goals.affiliate_id) AND (p.user_id = ( SELECT auth.uid() AS uid))))))
with check ((EXISTS ( SELECT 1
   FROM affiliate_profiles p
  WHERE ((p.id = affiliate_goals.affiliate_id) AND (p.user_id = ( SELECT auth.uid() AS uid))))));

create policy affiliate_leads_delete_own
on public.affiliate_leads
as permissive
for delete
to authenticated
using ((EXISTS ( SELECT 1
   FROM affiliate_profiles p
  WHERE ((p.id = affiliate_leads.affiliate_id) AND (p.user_id = ( SELECT auth.uid() AS uid))))));

create policy affiliate_leads_insert_own
on public.affiliate_leads
as permissive
for insert
to authenticated
with check ((EXISTS ( SELECT 1
   FROM affiliate_profiles p
  WHERE ((p.id = affiliate_leads.affiliate_id) AND (p.user_id = ( SELECT auth.uid() AS uid))))));

create policy affiliate_leads_select_own
on public.affiliate_leads
as permissive
for select
to authenticated
using ((EXISTS ( SELECT 1
   FROM affiliate_profiles p
  WHERE ((p.id = affiliate_leads.affiliate_id) AND (p.user_id = ( SELECT auth.uid() AS uid))))));

create policy affiliate_leads_update_own
on public.affiliate_leads
as permissive
for update
to authenticated
using ((EXISTS ( SELECT 1
   FROM affiliate_profiles p
  WHERE ((p.id = affiliate_leads.affiliate_id) AND (p.user_id = ( SELECT auth.uid() AS uid))))))
with check ((EXISTS ( SELECT 1
   FROM affiliate_profiles p
  WHERE ((p.id = affiliate_leads.affiliate_id) AND (p.user_id = ( SELECT auth.uid() AS uid))))));

create policy affiliate_payout_items_deny_client
on public.affiliate_payout_items
as permissive
for all
to authenticated
using (false)
with check (false);

create policy affiliate_payouts_select_own
on public.affiliate_payouts
as permissive
for select
to authenticated
using ((EXISTS ( SELECT 1
   FROM affiliate_profiles p
  WHERE ((p.id = affiliate_payouts.affiliate_id) AND (p.user_id = ( SELECT auth.uid() AS uid))))));

create policy affiliate_profiles_select_own
on public.affiliate_profiles
as permissive
for select
to authenticated
using ((( SELECT auth.uid() AS uid) = user_id));

create policy affiliate_settings_deny_client
on public.affiliate_program_settings
as permissive
for all
to authenticated
using (false)
with check (false);

create policy affiliate_referrals_select_own
on public.affiliate_referrals
as permissive
for select
to authenticated
using ((EXISTS ( SELECT 1
   FROM affiliate_profiles p
  WHERE ((p.id = affiliate_referrals.affiliate_id) AND (p.user_id = ( SELECT auth.uid() AS uid))))));

create policy affiliate_tasks_delete_own
on public.affiliate_tasks
as permissive
for delete
to authenticated
using ((EXISTS ( SELECT 1
   FROM affiliate_profiles p
  WHERE ((p.id = affiliate_tasks.affiliate_id) AND (p.user_id = ( SELECT auth.uid() AS uid))))));

create policy affiliate_tasks_insert_own
on public.affiliate_tasks
as permissive
for insert
to authenticated
with check ((EXISTS ( SELECT 1
   FROM affiliate_profiles p
  WHERE ((p.id = affiliate_tasks.affiliate_id) AND (p.user_id = ( SELECT auth.uid() AS uid))))));

create policy affiliate_tasks_select_own
on public.affiliate_tasks
as permissive
for select
to authenticated
using ((EXISTS ( SELECT 1
   FROM affiliate_profiles p
  WHERE ((p.id = affiliate_tasks.affiliate_id) AND (p.user_id = ( SELECT auth.uid() AS uid))))));

create policy affiliate_tasks_update_own
on public.affiliate_tasks
as permissive
for update
to authenticated
using ((EXISTS ( SELECT 1
   FROM affiliate_profiles p
  WHERE ((p.id = affiliate_tasks.affiliate_id) AND (p.user_id = ( SELECT auth.uid() AS uid))))))
with check ((EXISTS ( SELECT 1
   FROM affiliate_profiles p
  WHERE ((p.id = affiliate_tasks.affiliate_id) AND (p.user_id = ( SELECT auth.uid() AS uid))))));

create policy affiliate_training_delete_own
on public.affiliate_training_sessions
as permissive
for delete
to authenticated
using ((EXISTS ( SELECT 1
   FROM affiliate_profiles p
  WHERE ((p.id = affiliate_training_sessions.affiliate_id) AND (p.user_id = ( SELECT auth.uid() AS uid))))));

create policy affiliate_training_insert_own
on public.affiliate_training_sessions
as permissive
for insert
to authenticated
with check ((EXISTS ( SELECT 1
   FROM affiliate_profiles p
  WHERE ((p.id = affiliate_training_sessions.affiliate_id) AND (p.user_id = ( SELECT auth.uid() AS uid))))));

create policy affiliate_training_select_own
on public.affiliate_training_sessions
as permissive
for select
to authenticated
using ((EXISTS ( SELECT 1
   FROM affiliate_profiles p
  WHERE ((p.id = affiliate_training_sessions.affiliate_id) AND (p.user_id = ( SELECT auth.uid() AS uid))))));

create policy affiliate_training_update_own
on public.affiliate_training_sessions
as permissive
for update
to authenticated
using ((EXISTS ( SELECT 1
   FROM affiliate_profiles p
  WHERE ((p.id = affiliate_training_sessions.affiliate_id) AND (p.user_id = ( SELECT auth.uid() AS uid))))))
with check ((EXISTS ( SELECT 1
   FROM affiliate_profiles p
  WHERE ((p.id = affiliate_training_sessions.affiliate_id) AND (p.user_id = ( SELECT auth.uid() AS uid))))));

create policy "Empresa gerencia aprovacoes de arte"
on public.art_approval_requests
as permissive
for all
to authenticated
using (((EXISTS ( SELECT 1
   FROM companies c
  WHERE ((c.id = art_approval_requests.company_id) AND ((c.owner_id = auth.uid()) OR (c.tester_id = auth.uid()))))) OR (EXISTS ( SELECT 1
   FROM company_members cm
  WHERE ((cm.company_id = art_approval_requests.company_id) AND (cm.user_id = auth.uid()) AND (cm.status = 'ativo'::text) AND (cm.cargo = ANY (ARRAY['gerente'::text, 'producao'::text]))))) OR (EXISTS ( SELECT 1
   FROM admin_users au
  WHERE ((au.ativo = true) AND (lower(au.email) = lower((auth.jwt() ->> 'email'::text))))))))
with check (((EXISTS ( SELECT 1
   FROM companies c
  WHERE ((c.id = art_approval_requests.company_id) AND ((c.owner_id = auth.uid()) OR (c.tester_id = auth.uid()))))) OR (EXISTS ( SELECT 1
   FROM company_members cm
  WHERE ((cm.company_id = art_approval_requests.company_id) AND (cm.user_id = auth.uid()) AND (cm.status = 'ativo'::text) AND (cm.cargo = ANY (ARRAY['gerente'::text, 'producao'::text]))))) OR (EXISTS ( SELECT 1
   FROM admin_users au
  WHERE ((au.ativo = true) AND (lower(au.email) = lower((auth.jwt() ->> 'email'::text))))))));

create policy "Empresa ve aprovacoes de arte"
on public.art_approval_requests
as permissive
for select
to authenticated
using (((EXISTS ( SELECT 1
   FROM companies c
  WHERE ((c.id = art_approval_requests.company_id) AND ((c.owner_id = auth.uid()) OR (c.tester_id = auth.uid()))))) OR (EXISTS ( SELECT 1
   FROM company_members cm
  WHERE ((cm.company_id = art_approval_requests.company_id) AND (cm.user_id = auth.uid()) AND (cm.status = 'ativo'::text)))) OR (EXISTS ( SELECT 1
   FROM admin_users au
  WHERE ((au.ativo = true) AND (lower(au.email) = lower((auth.jwt() ->> 'email'::text))))))));

create policy business_hours_company_access
on public.business_hours
as permissive
for all
to public
using ((EXISTS ( SELECT 1
   FROM companies c
  WHERE ((c.id = business_hours.company_id) AND ((c.owner_id = auth.uid()) OR (c.tester_id = auth.uid()) OR (EXISTS ( SELECT 1
           FROM company_members m
          WHERE ((m.company_id = c.id) AND (m.user_id = auth.uid()) AND (m.status = 'ativo'::text)))))))))
with check ((EXISTS ( SELECT 1
   FROM companies c
  WHERE ((c.id = business_hours.company_id) AND ((c.owner_id = auth.uid()) OR (c.tester_id = auth.uid()) OR (EXISTS ( SELECT 1
           FROM company_members m
          WHERE ((m.company_id = c.id) AND (m.user_id = auth.uid()) AND (m.status = 'ativo'::text)))))))));

create policy "Dono e gerente editam empresa"
on public.companies
as permissive
for update
to authenticated
using (orcaly_private.can_manage_company(id))
with check (orcaly_private.can_manage_company(id));

create policy "Dono ou tester atualiza empresa"
on public.companies
as permissive
for update
to authenticated
using (((owner_id = auth.uid()) OR (tester_id = auth.uid())))
with check (((owner_id = auth.uid()) OR (tester_id = auth.uid())));

create policy "Dono ou tester vê empresa"
on public.companies
as permissive
for select
to authenticated
using (((owner_id = auth.uid()) OR (tester_id = auth.uid())));

create policy "Funcionario ve empresa vinculada"
on public.companies
as permissive
for select
to authenticated
using (orcaly_private.is_company_member(id));

create policy "Funcionarios acessam empresa"
on public.companies
as permissive
for select
to authenticated
using (orcaly_private.can_manage_company(id));

create policy "Usuário cria própria empresa"
on public.companies
as permissive
for insert
to authenticated
with check (((owner_id = auth.uid()) AND (lower(slug) <> ALL (ARRAY['admin'::text, 'administrador'::text, 'orcaly'::text, 'suporte'::text, 'support'::text, 'api'::text, 'painel'::text, 'dashboard'::text, 'login'::text, 'cadastro'::text, 'checkout'::text, 'assinatura'::text, 'proposta'::text, 'propostas'::text, 'root'::text, 'system'::text, 'sistema'::text, 'mercado-pago'::text, 'mercadopago'::text, 'www'::text, 'app'::text, 'assets'::text, 'static'::text, 'public'::text, 'private'::text, 'config'::text, 'settings'::text, 'security'::text, 'auth'::text, 'null'::text, 'undefined'::text]))));

create policy "Dono gerencia funcionarios"
on public.company_members
as permissive
for all
to authenticated
using (orcaly_private.is_company_owner(company_id))
with check (orcaly_private.is_company_owner(company_id));

create policy "Dono gerencia membros"
on public.company_members
as permissive
for all
to authenticated
using ((orcaly_private.is_company_owner(company_id) OR orcaly_private.is_orcaly_admin()))
with check ((orcaly_private.is_company_owner(company_id) OR orcaly_private.is_orcaly_admin()));

create policy "Dono gerente e admin veem membros"
on public.company_members
as permissive
for select
to authenticated
using ((orcaly_private.is_company_owner(company_id) OR orcaly_private.is_company_member(company_id) OR orcaly_private.is_orcaly_admin()));

create policy "Funcionario ve proprio cadastro"
on public.company_members
as permissive
for select
to authenticated
using (((user_id = auth.uid()) AND (status = 'ativo'::text)));

create policy "Empresa gerencia modelos por nicho"
on public.company_niche_templates
as permissive
for all
to authenticated
using (((EXISTS ( SELECT 1
   FROM companies c
  WHERE ((c.id = company_niche_templates.company_id) AND ((c.owner_id = auth.uid()) OR (c.tester_id = auth.uid()))))) OR (EXISTS ( SELECT 1
   FROM company_members cm
  WHERE ((cm.company_id = company_niche_templates.company_id) AND (cm.user_id = auth.uid()) AND (cm.status = 'ativo'::text) AND (cm.cargo = 'gerente'::text))))))
with check (((EXISTS ( SELECT 1
   FROM companies c
  WHERE ((c.id = company_niche_templates.company_id) AND ((c.owner_id = auth.uid()) OR (c.tester_id = auth.uid()))))) OR (EXISTS ( SELECT 1
   FROM company_members cm
  WHERE ((cm.company_id = company_niche_templates.company_id) AND (cm.user_id = auth.uid()) AND (cm.status = 'ativo'::text) AND (cm.cargo = 'gerente'::text))))));

create policy "Empresa gerencia config propostas"
on public.company_proposal_settings
as permissive
for all
to authenticated
using (orcaly_private.can_manage_company(company_id))
with check (orcaly_private.can_manage_company(company_id));

create policy "Empresa gerencia whatsapp settings"
on public.company_whatsapp_settings
as permissive
for all
to authenticated
using (((EXISTS ( SELECT 1
   FROM companies c
  WHERE ((c.id = company_whatsapp_settings.company_id) AND ((c.owner_id = auth.uid()) OR (c.tester_id = auth.uid()))))) OR (EXISTS ( SELECT 1
   FROM company_members cm
  WHERE ((cm.company_id = company_whatsapp_settings.company_id) AND (cm.user_id = auth.uid()) AND (cm.status = 'ativo'::text) AND (cm.cargo = 'gerente'::text)))) OR (EXISTS ( SELECT 1
   FROM admin_users au
  WHERE ((au.ativo = true) AND (lower(au.email) = lower((auth.jwt() ->> 'email'::text))))))))
with check (((EXISTS ( SELECT 1
   FROM companies c
  WHERE ((c.id = company_whatsapp_settings.company_id) AND ((c.owner_id = auth.uid()) OR (c.tester_id = auth.uid()))))) OR (EXISTS ( SELECT 1
   FROM company_members cm
  WHERE ((cm.company_id = company_whatsapp_settings.company_id) AND (cm.user_id = auth.uid()) AND (cm.status = 'ativo'::text) AND (cm.cargo = 'gerente'::text)))) OR (EXISTS ( SELECT 1
   FROM admin_users au
  WHERE ((au.ativo = true) AND (lower(au.email) = lower((auth.jwt() ->> 'email'::text))))))));

create policy "Equipe gerencia followups de clientes"
on public.customer_followups
as permissive
for all
to authenticated
using ((orcaly_private.is_company_owner(company_id) OR orcaly_private.is_company_member(company_id)))
with check ((orcaly_private.is_company_owner(company_id) OR orcaly_private.is_company_member(company_id)));

create policy "Empresa ve notas internas de clientes"
on public.customer_internal_notes
as permissive
for select
to authenticated
using (((EXISTS ( SELECT 1
   FROM companies c
  WHERE ((c.id = customer_internal_notes.company_id) AND ((c.owner_id = auth.uid()) OR (c.tester_id = auth.uid()))))) OR (EXISTS ( SELECT 1
   FROM company_members cm
  WHERE ((cm.company_id = customer_internal_notes.company_id) AND (cm.user_id = auth.uid()) AND (cm.status = 'ativo'::text))))));

create policy "Empresa gerencia links cliente"
on public.customer_magic_links
as permissive
for all
to authenticated
using (((EXISTS ( SELECT 1
   FROM companies c
  WHERE ((c.id = customer_magic_links.company_id) AND ((c.owner_id = auth.uid()) OR (c.tester_id = auth.uid()))))) OR (EXISTS ( SELECT 1
   FROM company_members cm
  WHERE ((cm.company_id = customer_magic_links.company_id) AND (cm.user_id = auth.uid()) AND (cm.status = 'ativo'::text))))))
with check (((EXISTS ( SELECT 1
   FROM companies c
  WHERE ((c.id = customer_magic_links.company_id) AND ((c.owner_id = auth.uid()) OR (c.tester_id = auth.uid()))))) OR (EXISTS ( SELECT 1
   FROM company_members cm
  WHERE ((cm.company_id = customer_magic_links.company_id) AND (cm.user_id = auth.uid()) AND (cm.status = 'ativo'::text))))));

create policy "Equipe gerencia notas de clientes"
on public.customer_notes
as permissive
for all
to authenticated
using ((orcaly_private.is_company_owner(company_id) OR orcaly_private.is_company_member(company_id)))
with check ((orcaly_private.is_company_owner(company_id) OR orcaly_private.is_company_member(company_id)));

create policy deliveries_company_access
on public.deliveries
as permissive
for all
to public
using ((EXISTS ( SELECT 1
   FROM companies c
  WHERE ((c.id = deliveries.company_id) AND ((c.owner_id = auth.uid()) OR (c.tester_id = auth.uid()) OR (EXISTS ( SELECT 1
           FROM company_members m
          WHERE ((m.company_id = c.id) AND (m.user_id = auth.uid()) AND (m.status = 'ativo'::text)))))))))
with check ((EXISTS ( SELECT 1
   FROM companies c
  WHERE ((c.id = deliveries.company_id) AND ((c.owner_id = auth.uid()) OR (c.tester_id = auth.uid()) OR (EXISTS ( SELECT 1
           FROM company_members m
          WHERE ((m.company_id = c.id) AND (m.user_id = auth.uid()) AND (m.status = 'ativo'::text)))))))));

create policy delivery_assignments_company_access
on public.delivery_assignments
as permissive
for all
to authenticated
using (orcaly_private.can_manage_company(company_id))
with check (orcaly_private.can_manage_company(company_id));

create policy delivery_drivers_company_access
on public.delivery_drivers
as permissive
for all
to authenticated
using (orcaly_private.can_manage_company(company_id))
with check (orcaly_private.can_manage_company(company_id));

create policy delivery_zones_company_access
on public.delivery_zones
as permissive
for all
to public
using ((EXISTS ( SELECT 1
   FROM companies c
  WHERE ((c.id = delivery_zones.company_id) AND ((c.owner_id = auth.uid()) OR (c.tester_id = auth.uid()) OR (EXISTS ( SELECT 1
           FROM company_members m
          WHERE ((m.company_id = c.id) AND (m.user_id = auth.uid()) AND (m.status = 'ativo'::text)))))))))
with check ((EXISTS ( SELECT 1
   FROM companies c
  WHERE ((c.id = delivery_zones.company_id) AND ((c.owner_id = auth.uid()) OR (c.tester_id = auth.uid()) OR (EXISTS ( SELECT 1
           FROM company_members m
          WHERE ((m.company_id = c.id) AND (m.user_id = auth.uid()) AND (m.status = 'ativo'::text)))))))));

create policy "Dono e gerente gerenciam contas financeiras"
on public.finance_accounts
as permissive
for all
to authenticated
using ((orcaly_private.is_company_owner(company_id) OR (orcaly_private.is_company_member(company_id) AND (orcaly_private.my_company_role(company_id) = 'gerente'::text))))
with check ((orcaly_private.is_company_owner(company_id) OR (orcaly_private.is_company_member(company_id) AND (orcaly_private.my_company_role(company_id) = 'gerente'::text))));

create policy "Dono e gerente veem contas financeiras"
on public.finance_accounts
as permissive
for select
to authenticated
using ((orcaly_private.is_company_owner(company_id) OR (orcaly_private.is_company_member(company_id) AND (orcaly_private.my_company_role(company_id) = 'gerente'::text))));

create policy finance_accounts_company_access
on public.finance_accounts
as permissive
for all
to public
using ((EXISTS ( SELECT 1
   FROM companies c
  WHERE ((c.id = finance_accounts.company_id) AND ((c.owner_id = auth.uid()) OR (c.tester_id = auth.uid()) OR (EXISTS ( SELECT 1
           FROM company_members m
          WHERE ((m.company_id = c.id) AND (m.user_id = auth.uid()) AND (m.status = 'ativo'::text)))))))))
with check ((EXISTS ( SELECT 1
   FROM companies c
  WHERE ((c.id = finance_accounts.company_id) AND ((c.owner_id = auth.uid()) OR (c.tester_id = auth.uid()) OR (EXISTS ( SELECT 1
           FROM company_members m
          WHERE ((m.company_id = c.id) AND (m.user_id = auth.uid()) AND (m.status = 'ativo'::text)))))))));

create policy financial_categories_company_access
on public.financial_categories
as permissive
for all
to public
using ((EXISTS ( SELECT 1
   FROM companies c
  WHERE ((c.id = financial_categories.company_id) AND ((c.owner_id = auth.uid()) OR (c.tester_id = auth.uid()) OR (EXISTS ( SELECT 1
           FROM company_members m
          WHERE ((m.company_id = c.id) AND (m.user_id = auth.uid()) AND (m.status = 'ativo'::text)))))))))
with check ((EXISTS ( SELECT 1
   FROM companies c
  WHERE ((c.id = financial_categories.company_id) AND ((c.owner_id = auth.uid()) OR (c.tester_id = auth.uid()) OR (EXISTS ( SELECT 1
           FROM company_members m
          WHERE ((m.company_id = c.id) AND (m.user_id = auth.uid()) AND (m.status = 'ativo'::text)))))))));

create policy "Dono e gerente gerenciam materiais financeiros"
on public.financial_material_entries
as permissive
for all
to authenticated
using ((orcaly_private.is_company_owner(company_id) OR (orcaly_private.is_company_member(company_id) AND (orcaly_private.my_company_role(company_id) = 'gerente'::text))))
with check ((orcaly_private.is_company_owner(company_id) OR (orcaly_private.is_company_member(company_id) AND (orcaly_private.my_company_role(company_id) = 'gerente'::text))));

create policy "Equipe ve materiais financeiros"
on public.financial_material_entries
as permissive
for select
to authenticated
using ((orcaly_private.is_company_owner(company_id) OR (orcaly_private.is_company_member(company_id) AND (orcaly_private.my_company_role(company_id) = ANY (ARRAY['gerente'::text, 'producao'::text])))));

create policy financial_material_entries_company_access
on public.financial_material_entries
as permissive
for all
to public
using ((EXISTS ( SELECT 1
   FROM companies c
  WHERE ((c.id = financial_material_entries.company_id) AND ((c.owner_id = auth.uid()) OR (c.tester_id = auth.uid()) OR (EXISTS ( SELECT 1
           FROM company_members m
          WHERE ((m.company_id = c.id) AND (m.user_id = auth.uid()) AND (m.status = 'ativo'::text)))))))))
with check ((EXISTS ( SELECT 1
   FROM companies c
  WHERE ((c.id = financial_material_entries.company_id) AND ((c.owner_id = auth.uid()) OR (c.tester_id = auth.uid()) OR (EXISTS ( SELECT 1
           FROM company_members m
          WHERE ((m.company_id = c.id) AND (m.user_id = auth.uid()) AND (m.status = 'ativo'::text)))))))));

create policy "Dono e gerente gerenciam financeiro"
on public.financial_transactions
as permissive
for all
to authenticated
using ((orcaly_private.is_company_owner(company_id) OR (orcaly_private.is_company_member(company_id) AND (orcaly_private.my_company_role(company_id) = 'gerente'::text))))
with check ((orcaly_private.is_company_owner(company_id) OR (orcaly_private.is_company_member(company_id) AND (orcaly_private.my_company_role(company_id) = 'gerente'::text))));

create policy "Equipe ve financeiro"
on public.financial_transactions
as permissive
for select
to authenticated
using ((orcaly_private.is_company_owner(company_id) OR (orcaly_private.is_company_member(company_id) AND (orcaly_private.my_company_role(company_id) = 'gerente'::text))));

create policy financial_transactions_company_access
on public.financial_transactions
as permissive
for all
to public
using ((EXISTS ( SELECT 1
   FROM companies c
  WHERE ((c.id = financial_transactions.company_id) AND ((c.owner_id = auth.uid()) OR (c.tester_id = auth.uid()) OR (EXISTS ( SELECT 1
           FROM company_members m
          WHERE ((m.company_id = c.id) AND (m.user_id = auth.uid()) AND (m.status = 'ativo'::text)))))))))
with check ((EXISTS ( SELECT 1
   FROM companies c
  WHERE ((c.id = financial_transactions.company_id) AND ((c.owner_id = auth.uid()) OR (c.tester_id = auth.uid()) OR (EXISTS ( SELECT 1
           FROM company_members m
          WHERE ((m.company_id = c.id) AND (m.user_id = auth.uid()) AND (m.status = 'ativo'::text)))))))));

create policy founder_invites_no_direct_access
on public.founder_invites
as permissive
for all
to anon, authenticated
using (false)
with check (false);

create policy "Empresa atualiza notificacoes"
on public.notifications
as permissive
for update
to authenticated
using (((user_id = auth.uid()) OR (EXISTS ( SELECT 1
   FROM companies c
  WHERE ((c.id = notifications.company_id) AND ((c.owner_id = auth.uid()) OR (c.tester_id = auth.uid()))))) OR (EXISTS ( SELECT 1
   FROM company_members cm
  WHERE ((cm.company_id = notifications.company_id) AND (cm.user_id = auth.uid()) AND (cm.status = 'ativo'::text)))) OR (EXISTS ( SELECT 1
   FROM admin_users au
  WHERE ((au.ativo = true) AND (lower(au.email) = lower((auth.jwt() ->> 'email'::text))))))))
with check (((user_id = auth.uid()) OR (EXISTS ( SELECT 1
   FROM companies c
  WHERE ((c.id = notifications.company_id) AND ((c.owner_id = auth.uid()) OR (c.tester_id = auth.uid()))))) OR (EXISTS ( SELECT 1
   FROM company_members cm
  WHERE ((cm.company_id = notifications.company_id) AND (cm.user_id = auth.uid()) AND (cm.status = 'ativo'::text)))) OR (EXISTS ( SELECT 1
   FROM admin_users au
  WHERE ((au.ativo = true) AND (lower(au.email) = lower((auth.jwt() ->> 'email'::text))))))));

create policy "Empresa ve notificacoes"
on public.notifications
as permissive
for select
to authenticated
using (((user_id = auth.uid()) OR (EXISTS ( SELECT 1
   FROM companies c
  WHERE ((c.id = notifications.company_id) AND ((c.owner_id = auth.uid()) OR (c.tester_id = auth.uid()))))) OR (EXISTS ( SELECT 1
   FROM company_members cm
  WHERE ((cm.company_id = notifications.company_id) AND (cm.user_id = auth.uid()) AND (cm.status = 'ativo'::text)))) OR (EXISTS ( SELECT 1
   FROM admin_users au
  WHERE ((au.ativo = true) AND (lower(au.email) = lower((auth.jwt() ->> 'email'::text))))))));

create policy "Dono ou tester atualiza itens"
on public.order_items
as permissive
for update
to authenticated
using ((EXISTS ( SELECT 1
   FROM companies c
  WHERE ((c.id = order_items.company_id) AND ((c.owner_id = auth.uid()) OR (c.tester_id = auth.uid()))))))
with check ((EXISTS ( SELECT 1
   FROM companies c
  WHERE ((c.id = order_items.company_id) AND ((c.owner_id = auth.uid()) OR (c.tester_id = auth.uid()))))));

create policy "Dono ou tester vê itens"
on public.order_items
as permissive
for select
to authenticated
using ((EXISTS ( SELECT 1
   FROM companies c
  WHERE ((c.id = order_items.company_id) AND ((c.owner_id = auth.uid()) OR (c.tester_id = auth.uid()))))));

create policy "Funcionarios acessam itens pedidos"
on public.order_items
as permissive
for all
to authenticated
using (orcaly_private.can_manage_company(company_id))
with check (orcaly_private.can_manage_company(company_id));

create policy order_items_company_access
on public.order_items
as permissive
for all
to public
using ((EXISTS ( SELECT 1
   FROM companies c
  WHERE ((c.id = order_items.company_id) AND ((c.owner_id = auth.uid()) OR (c.tester_id = auth.uid()) OR (EXISTS ( SELECT 1
           FROM company_members m
          WHERE ((m.company_id = c.id) AND (m.user_id = auth.uid()) AND (m.status = 'ativo'::text)))))))))
with check ((EXISTS ( SELECT 1
   FROM companies c
  WHERE ((c.id = order_items.company_id) AND ((c.owner_id = auth.uid()) OR (c.tester_id = auth.uid()) OR (EXISTS ( SELECT 1
           FROM company_members m
          WHERE ((m.company_id = c.id) AND (m.user_id = auth.uid()) AND (m.status = 'ativo'::text)))))))));

create policy order_payments_company_access
on public.order_payments
as permissive
for all
to public
using ((EXISTS ( SELECT 1
   FROM companies c
  WHERE ((c.id = order_payments.company_id) AND ((c.owner_id = auth.uid()) OR (c.tester_id = auth.uid()) OR (EXISTS ( SELECT 1
           FROM company_members m
          WHERE ((m.company_id = c.id) AND (m.user_id = auth.uid()) AND (m.status = 'ativo'::text)))))))))
with check ((EXISTS ( SELECT 1
   FROM companies c
  WHERE ((c.id = order_payments.company_id) AND ((c.owner_id = auth.uid()) OR (c.tester_id = auth.uid()) OR (EXISTS ( SELECT 1
           FROM company_members m
          WHERE ((m.company_id = c.id) AND (m.user_id = auth.uid()) AND (m.status = 'ativo'::text)))))))));

create policy "Dono ou tester atualiza pedidos"
on public.orders
as permissive
for update
to authenticated
using ((EXISTS ( SELECT 1
   FROM companies c
  WHERE ((c.id = orders.company_id) AND ((c.owner_id = auth.uid()) OR (c.tester_id = auth.uid()))))))
with check ((EXISTS ( SELECT 1
   FROM companies c
  WHERE ((c.id = orders.company_id) AND ((c.owner_id = auth.uid()) OR (c.tester_id = auth.uid()))))));

create policy "Dono ou tester vê pedidos"
on public.orders
as permissive
for select
to authenticated
using ((EXISTS ( SELECT 1
   FROM companies c
  WHERE ((c.id = orders.company_id) AND ((c.owner_id = auth.uid()) OR (c.tester_id = auth.uid()))))));

create policy "Funcionarios acessam pedidos"
on public.orders
as permissive
for all
to authenticated
using (orcaly_private.can_manage_company(company_id))
with check (orcaly_private.can_manage_company(company_id));

create policy "Funcionarios atualizam pedidos"
on public.orders
as permissive
for update
to authenticated
using (orcaly_private.is_company_member(company_id))
with check (orcaly_private.is_company_member(company_id));

create policy "Funcionarios veem pedidos"
on public.orders
as permissive
for select
to authenticated
using (orcaly_private.is_company_member(company_id));

create policy payment_methods_company_access
on public.payment_methods
as permissive
for all
to public
using ((EXISTS ( SELECT 1
   FROM companies c
  WHERE ((c.id = payment_methods.company_id) AND ((c.owner_id = auth.uid()) OR (c.tester_id = auth.uid()) OR (EXISTS ( SELECT 1
           FROM company_members m
          WHERE ((m.company_id = c.id) AND (m.user_id = auth.uid()) AND (m.status = 'ativo'::text)))))))))
with check ((EXISTS ( SELECT 1
   FROM companies c
  WHERE ((c.id = payment_methods.company_id) AND ((c.owner_id = auth.uid()) OR (c.tester_id = auth.uid()) OR (EXISTS ( SELECT 1
           FROM company_members m
          WHERE ((m.company_id = c.id) AND (m.user_id = auth.uid()) AND (m.status = 'ativo'::text)))))))));

create policy payment_payouts_company_select
on public.payment_payouts
as permissive
for select
to authenticated
using (orcaly_private.orcaly_user_has_company_access(company_id));

create policy payment_webhook_events_company_select
on public.payment_webhook_events
as permissive
for select
to authenticated
using (((company_id IS NOT NULL) AND orcaly_private.orcaly_user_has_company_access(company_id)));

create policy "Dono pode criar pagamento da propria empresa"
on public.plan_payments
as permissive
for insert
to authenticated
with check ((EXISTS ( SELECT 1
   FROM companies c
  WHERE ((c.id = plan_payments.company_id) AND (c.owner_id = auth.uid())))));

create policy "Dono pode ver pagamentos da propria empresa"
on public.plan_payments
as permissive
for select
to authenticated
using ((EXISTS ( SELECT 1
   FROM companies c
  WHERE ((c.id = plan_payments.company_id) AND (c.owner_id = auth.uid())))));

create policy "platform admin invites deny direct client access"
on public.platform_admin_invites
as permissive
for all
to anon, authenticated
using (false)
with check (false);

create policy "Empresa gerencia producao"
on public.production_orders
as permissive
for all
to authenticated
using (((EXISTS ( SELECT 1
   FROM companies c
  WHERE ((c.id = production_orders.company_id) AND ((c.owner_id = auth.uid()) OR (c.tester_id = auth.uid()))))) OR (EXISTS ( SELECT 1
   FROM company_members cm
  WHERE ((cm.company_id = production_orders.company_id) AND (cm.user_id = auth.uid()) AND (cm.status = 'ativo'::text)))) OR (EXISTS ( SELECT 1
   FROM admin_users au
  WHERE ((au.ativo = true) AND (lower(au.email) = lower((auth.jwt() ->> 'email'::text))))))))
with check (((EXISTS ( SELECT 1
   FROM companies c
  WHERE ((c.id = production_orders.company_id) AND ((c.owner_id = auth.uid()) OR (c.tester_id = auth.uid()))))) OR (EXISTS ( SELECT 1
   FROM company_members cm
  WHERE ((cm.company_id = production_orders.company_id) AND (cm.user_id = auth.uid()) AND (cm.status = 'ativo'::text)))) OR (EXISTS ( SELECT 1
   FROM admin_users au
  WHERE ((au.ativo = true) AND (lower(au.email) = lower((auth.jwt() ->> 'email'::text))))))));

create policy "Empresa gerencia producao plus"
on public.production_orders
as permissive
for all
to authenticated
using (((EXISTS ( SELECT 1
   FROM companies c
  WHERE ((c.id = production_orders.company_id) AND ((c.owner_id = auth.uid()) OR (c.tester_id = auth.uid()))))) OR (EXISTS ( SELECT 1
   FROM company_members cm
  WHERE ((cm.company_id = production_orders.company_id) AND (cm.user_id = auth.uid()) AND (cm.status = 'ativo'::text))))))
with check (((EXISTS ( SELECT 1
   FROM companies c
  WHERE ((c.id = production_orders.company_id) AND ((c.owner_id = auth.uid()) OR (c.tester_id = auth.uid()))))) OR (EXISTS ( SELECT 1
   FROM company_members cm
  WHERE ((cm.company_id = production_orders.company_id) AND (cm.user_id = auth.uid()) AND (cm.status = 'ativo'::text))))));

create policy "Empresa gerencia etapas producao"
on public.production_steps
as permissive
for all
to authenticated
using (((EXISTS ( SELECT 1
   FROM companies c
  WHERE ((c.id = production_steps.company_id) AND ((c.owner_id = auth.uid()) OR (c.tester_id = auth.uid()))))) OR (EXISTS ( SELECT 1
   FROM company_members cm
  WHERE ((cm.company_id = production_steps.company_id) AND (cm.user_id = auth.uid()) AND (cm.status = 'ativo'::text)))) OR (EXISTS ( SELECT 1
   FROM admin_users au
  WHERE ((au.ativo = true) AND (lower(au.email) = lower((auth.jwt() ->> 'email'::text))))))))
with check (((EXISTS ( SELECT 1
   FROM companies c
  WHERE ((c.id = production_steps.company_id) AND ((c.owner_id = auth.uid()) OR (c.tester_id = auth.uid()))))) OR (EXISTS ( SELECT 1
   FROM company_members cm
  WHERE ((cm.company_id = production_steps.company_id) AND (cm.user_id = auth.uid()) AND (cm.status = 'ativo'::text)))) OR (EXISTS ( SELECT 1
   FROM admin_users au
  WHERE ((au.ativo = true) AND (lower(au.email) = lower((auth.jwt() ->> 'email'::text))))))));

create policy "Dono ou tester apaga produtos"
on public.products
as permissive
for delete
to authenticated
using ((EXISTS ( SELECT 1
   FROM companies c
  WHERE ((c.id = products.company_id) AND ((c.owner_id = auth.uid()) OR (c.tester_id = auth.uid()))))));

create policy "Dono ou tester atualiza produtos"
on public.products
as permissive
for update
to authenticated
using ((EXISTS ( SELECT 1
   FROM companies c
  WHERE ((c.id = products.company_id) AND ((c.owner_id = auth.uid()) OR (c.tester_id = auth.uid()))))))
with check ((EXISTS ( SELECT 1
   FROM companies c
  WHERE ((c.id = products.company_id) AND ((c.owner_id = auth.uid()) OR (c.tester_id = auth.uid()))))));

create policy "Dono ou tester cria produtos"
on public.products
as permissive
for insert
to authenticated
with check ((EXISTS ( SELECT 1
   FROM companies c
  WHERE ((c.id = products.company_id) AND ((c.owner_id = auth.uid()) OR (c.tester_id = auth.uid()))))));

create policy "Dono ou tester vê produtos"
on public.products
as permissive
for select
to authenticated
using ((EXISTS ( SELECT 1
   FROM companies c
  WHERE ((c.id = products.company_id) AND ((c.owner_id = auth.uid()) OR (c.tester_id = auth.uid()))))));

create policy "Funcionarios acessam produtos"
on public.products
as permissive
for all
to authenticated
using (orcaly_private.can_manage_company(company_id))
with check (orcaly_private.can_manage_company(company_id));

create policy "Funcionarios veem produtos"
on public.products
as permissive
for select
to authenticated
using (orcaly_private.is_company_member(company_id));

create policy "Gerente gerencia produtos"
on public.products
as permissive
for all
to authenticated
using ((orcaly_private.is_company_member(company_id) AND (orcaly_private.my_company_role(company_id) = 'gerente'::text)))
with check ((orcaly_private.is_company_member(company_id) AND (orcaly_private.my_company_role(company_id) = 'gerente'::text)));

create policy "Empresa insere eventos propostas"
on public.proposal_events
as permissive
for insert
to authenticated
with check (orcaly_private.can_manage_company(company_id));

create policy "Empresa ve eventos propostas"
on public.proposal_events
as permissive
for select
to authenticated
using (orcaly_private.can_manage_company(company_id));

create policy "Funcionarios acessam eventos propostas"
on public.proposal_events
as permissive
for all
to authenticated
using (orcaly_private.can_manage_company(company_id))
with check (orcaly_private.can_manage_company(company_id));

create policy "Dono ou tester gerencia propostas"
on public.proposals
as permissive
for all
to authenticated
using ((EXISTS ( SELECT 1
   FROM companies c
  WHERE ((c.id = proposals.company_id) AND ((c.owner_id = auth.uid()) OR (c.tester_id = auth.uid()))))))
with check ((EXISTS ( SELECT 1
   FROM companies c
  WHERE ((c.id = proposals.company_id) AND ((c.owner_id = auth.uid()) OR (c.tester_id = auth.uid()))))));

create policy "Empresa gerencia propostas"
on public.proposals
as permissive
for all
to authenticated
using (orcaly_private.can_manage_company(company_id))
with check (orcaly_private.can_manage_company(company_id));

create policy "Equipe comercial gerencia propostas"
on public.proposals
as permissive
for all
to authenticated
using ((orcaly_private.is_company_member(company_id) AND (orcaly_private.my_company_role(company_id) = ANY (ARRAY['gerente'::text, 'atendente'::text]))))
with check ((orcaly_private.is_company_member(company_id) AND (orcaly_private.my_company_role(company_id) = ANY (ARRAY['gerente'::text, 'atendente'::text]))));

create policy "Equipe comercial ve propostas"
on public.proposals
as permissive
for select
to authenticated
using ((orcaly_private.is_company_member(company_id) AND (orcaly_private.my_company_role(company_id) = ANY (ARRAY['gerente'::text, 'atendente'::text]))));

create policy "Funcionarios acessam propostas"
on public.proposals
as permissive
for all
to authenticated
using (orcaly_private.can_manage_company(company_id))
with check (orcaly_private.can_manage_company(company_id));

create policy provider_customers_company_select
on public.provider_customers
as permissive
for select
to authenticated
using (orcaly_private.orcaly_user_has_company_access(company_id));

create policy "Dono ou tester gerencia modelos"
on public.quote_templates
as permissive
for all
to authenticated
using ((EXISTS ( SELECT 1
   FROM companies c
  WHERE ((c.id = quote_templates.company_id) AND ((c.owner_id = auth.uid()) OR (c.tester_id = auth.uid()))))))
with check ((EXISTS ( SELECT 1
   FROM companies c
  WHERE ((c.id = quote_templates.company_id) AND ((c.owner_id = auth.uid()) OR (c.tester_id = auth.uid()))))));

create policy "Funcionarios acessam modelos orcamento"
on public.quote_templates
as permissive
for all
to authenticated
using (orcaly_private.can_manage_company(company_id))
with check (orcaly_private.can_manage_company(company_id));

create policy "Empresa gerencia recorrentes"
on public.recurring_orders
as permissive
for all
to authenticated
using (((EXISTS ( SELECT 1
   FROM companies c
  WHERE ((c.id = recurring_orders.company_id) AND ((c.owner_id = auth.uid()) OR (c.tester_id = auth.uid()))))) OR (EXISTS ( SELECT 1
   FROM company_members cm
  WHERE ((cm.company_id = recurring_orders.company_id) AND (cm.user_id = auth.uid()) AND (cm.status = 'ativo'::text))))))
with check (((EXISTS ( SELECT 1
   FROM companies c
  WHERE ((c.id = recurring_orders.company_id) AND ((c.owner_id = auth.uid()) OR (c.tester_id = auth.uid()))))) OR (EXISTS ( SELECT 1
   FROM company_members cm
  WHERE ((cm.company_id = recurring_orders.company_id) AND (cm.user_id = auth.uid()) AND (cm.status = 'ativo'::text))))));

create policy "Admins veem blocklist"
on public.security_blocklist
as permissive
for select
to authenticated
using ((EXISTS ( SELECT 1
   FROM admin_users au
  WHERE ((au.ativo = true) AND (lower(au.email) = lower((auth.jwt() ->> 'email'::text)))))));

create policy "Super admin gerencia blocklist"
on public.security_blocklist
as permissive
for all
to authenticated
using ((EXISTS ( SELECT 1
   FROM admin_users au
  WHERE ((au.ativo = true) AND (au.role = 'super_admin'::text) AND (lower(au.email) = lower((auth.jwt() ->> 'email'::text)))))))
with check ((EXISTS ( SELECT 1
   FROM admin_users au
  WHERE ((au.ativo = true) AND (au.role = 'super_admin'::text) AND (lower(au.email) = lower((auth.jwt() ->> 'email'::text)))))));

create policy "Admins gerenciam eventos de seguranca"
on public.security_events
as permissive
for update
to authenticated
using ((EXISTS ( SELECT 1
   FROM admin_users au
  WHERE ((au.ativo = true) AND (lower(au.email) = lower((auth.jwt() ->> 'email'::text)))))))
with check ((EXISTS ( SELECT 1
   FROM admin_users au
  WHERE ((au.ativo = true) AND (lower(au.email) = lower((auth.jwt() ->> 'email'::text)))))));

create policy "Admins inserem eventos de seguranca"
on public.security_events
as permissive
for insert
to authenticated
with check ((EXISTS ( SELECT 1
   FROM admin_users au
  WHERE ((au.ativo = true) AND (lower(au.email) = lower((auth.jwt() ->> 'email'::text)))))));

create policy "Admins veem eventos de seguranca"
on public.security_events
as permissive
for select
to authenticated
using ((EXISTS ( SELECT 1
   FROM admin_users au
  WHERE ((au.ativo = true) AND (lower(au.email) = lower((auth.jwt() ->> 'email'::text)))))));

create policy "Dono ou tester vê eventos de segurança"
on public.security_events
as permissive
for select
to authenticated
using ((EXISTS ( SELECT 1
   FROM companies c
  WHERE ((c.id = security_events.company_id) AND ((c.owner_id = auth.uid()) OR (c.tester_id = auth.uid()))))));

create policy "Admin gerencia followups de leads"
on public.signup_lead_followups
as permissive
for all
to authenticated
using ((EXISTS ( SELECT 1
   FROM admin_users au
  WHERE ((au.ativo = true) AND (lower(au.email) = lower((auth.jwt() ->> 'email'::text)))))))
with check ((EXISTS ( SELECT 1
   FROM admin_users au
  WHERE ((au.ativo = true) AND (lower(au.email) = lower((auth.jwt() ->> 'email'::text)))))));

create policy "Admin gerencia leads"
on public.signup_leads
as permissive
for all
to authenticated
using ((EXISTS ( SELECT 1
   FROM admin_users au
  WHERE ((au.ativo = true) AND (lower(au.email) = lower((auth.jwt() ->> 'email'::text)))))))
with check ((EXISTS ( SELECT 1
   FROM admin_users au
  WHERE ((au.ativo = true) AND (lower(au.email) = lower((auth.jwt() ->> 'email'::text)))))));

create policy "Admin gerencia secoes do site"
on public.site_sections
as permissive
for all
to authenticated
using ((EXISTS ( SELECT 1
   FROM admin_users au
  WHERE ((au.ativo = true) AND (lower(au.email) = lower((auth.jwt() ->> 'email'::text)))))))
with check ((EXISTS ( SELECT 1
   FROM admin_users au
  WHERE ((au.ativo = true) AND (lower(au.email) = lower((auth.jwt() ->> 'email'::text)))))));

create policy "Empresa gerencia secoes do site"
on public.site_sections
as permissive
for all
to authenticated
using ((EXISTS ( SELECT 1
   FROM companies c
  WHERE ((c.id = site_sections.company_id) AND ((c.owner_id = auth.uid()) OR (c.tester_id = auth.uid()))))))
with check ((EXISTS ( SELECT 1
   FROM companies c
  WHERE ((c.id = site_sections.company_id) AND ((c.owner_id = auth.uid()) OR (c.tester_id = auth.uid()))))));

create policy subscription_events_select_company
on public.subscription_events
as permissive
for select
to authenticated
using (((EXISTS ( SELECT 1
   FROM companies c
  WHERE ((c.id = subscription_events.company_id) AND ((c.owner_id = auth.uid()) OR (c.tester_id = auth.uid()))))) OR (EXISTS ( SELECT 1
   FROM company_members cm
  WHERE ((cm.company_id = subscription_events.company_id) AND (cm.user_id = auth.uid()) AND (cm.status = 'ativo'::text))))));

create policy "Empresa ve whatsapp conversations"
on public.whatsapp_conversations
as permissive
for select
to authenticated
using (((EXISTS ( SELECT 1
   FROM companies c
  WHERE ((c.id = whatsapp_conversations.company_id) AND ((c.owner_id = auth.uid()) OR (c.tester_id = auth.uid()))))) OR (EXISTS ( SELECT 1
   FROM company_members cm
  WHERE ((cm.company_id = whatsapp_conversations.company_id) AND (cm.user_id = auth.uid()) AND (cm.status = 'ativo'::text)))) OR (EXISTS ( SELECT 1
   FROM admin_users au
  WHERE ((au.ativo = true) AND (lower(au.email) = lower((auth.jwt() ->> 'email'::text))))))));

create policy "Empresa ve whatsapp logs"
on public.whatsapp_message_logs
as permissive
for select
to authenticated
using (((EXISTS ( SELECT 1
   FROM companies c
  WHERE ((c.id = whatsapp_message_logs.company_id) AND ((c.owner_id = auth.uid()) OR (c.tester_id = auth.uid()))))) OR (EXISTS ( SELECT 1
   FROM company_members cm
  WHERE ((cm.company_id = whatsapp_message_logs.company_id) AND (cm.user_id = auth.uid()) AND (cm.status = 'ativo'::text)))) OR (EXISTS ( SELECT 1
   FROM admin_users au
  WHERE ((au.ativo = true) AND (lower(au.email) = lower((auth.jwt() ->> 'email'::text))))))));

grant SELECT, INSERT, UPDATE, DELETE on table public.admin_audit_logs to authenticated;

grant SELECT, INSERT, UPDATE, DELETE on table public.admin_bug_reports to authenticated;

grant SELECT, INSERT, UPDATE, DELETE on table public.admin_scan_runs to authenticated;

grant SELECT on table public.admin_signup_leads_overview to authenticated;

grant SELECT, INSERT, UPDATE, DELETE on table public.admin_system_snapshots to authenticated;

grant SELECT, INSERT, UPDATE, DELETE on table public.admin_users to authenticated;

grant SELECT, INSERT, UPDATE, DELETE on table public.affiliate_achievements to authenticated;

grant SELECT, INSERT, UPDATE, DELETE on table public.affiliate_activity_events to authenticated;

grant SELECT, INSERT, UPDATE, DELETE on table public.affiliate_announcements to authenticated;

grant SELECT, INSERT, UPDATE, DELETE on table public.affiliate_certifications to authenticated;

grant SELECT on table public.affiliate_commissions to authenticated;

grant SELECT, INSERT, UPDATE, DELETE on table public.affiliate_course_progress to authenticated;

grant SELECT, INSERT, UPDATE, DELETE on table public.affiliate_goals to authenticated;

grant SELECT, INSERT, UPDATE, DELETE on table public.affiliate_leads to authenticated;

grant SELECT on table public.affiliate_payouts to authenticated;

grant SELECT on table public.affiliate_profiles to authenticated;

grant SELECT on table public.affiliate_referrals to authenticated;

grant SELECT, INSERT, UPDATE, DELETE on table public.affiliate_tasks to authenticated;

grant SELECT, INSERT, UPDATE, DELETE on table public.affiliate_training_sessions to authenticated;

grant SELECT, INSERT, UPDATE, DELETE on table public.art_approval_requests to authenticated;

grant SELECT, INSERT, UPDATE, DELETE on table public.business_hours to authenticated;

grant SELECT, INSERT, UPDATE, DELETE on table public.companies to authenticated;

grant SELECT, INSERT, UPDATE, DELETE on table public.company_members to authenticated;

grant SELECT on table public.company_members_public to authenticated;

grant SELECT, INSERT, UPDATE, DELETE on table public.company_niche_templates to authenticated;

grant SELECT, INSERT, UPDATE, DELETE on table public.company_proposal_settings to authenticated;

grant SELECT, INSERT, UPDATE, DELETE on table public.company_whatsapp_settings to authenticated;

grant SELECT, INSERT, UPDATE, DELETE on table public.customer_followups to authenticated;

grant SELECT, INSERT, UPDATE, DELETE on table public.customer_internal_notes to authenticated;

grant SELECT, INSERT, UPDATE, DELETE on table public.customer_magic_links to authenticated;

grant SELECT, INSERT, UPDATE, DELETE on table public.customer_notes to authenticated;

grant SELECT, INSERT, UPDATE, DELETE on table public.deliveries to authenticated;

grant SELECT, INSERT, UPDATE, DELETE on table public.delivery_assignments to authenticated;

grant SELECT, INSERT, UPDATE, DELETE on table public.delivery_drivers to authenticated;

grant SELECT, INSERT, UPDATE, DELETE on table public.delivery_zones to authenticated;

grant SELECT, INSERT, UPDATE, DELETE on table public.finance_accounts to authenticated;

grant SELECT, INSERT, UPDATE, DELETE on table public.financial_categories to authenticated;

grant SELECT, INSERT, UPDATE, DELETE on table public.financial_material_entries to authenticated;

grant SELECT, INSERT, UPDATE, DELETE on table public.financial_transactions to authenticated;

grant SELECT, INSERT, UPDATE, DELETE on table public.notifications to authenticated;

grant SELECT, INSERT, UPDATE, DELETE on table public.order_items to authenticated;

grant SELECT, INSERT, UPDATE, DELETE on table public.order_payments to authenticated;

grant SELECT, DELETE on table public.orders to authenticated;

grant SELECT, INSERT, UPDATE, DELETE on table public.payment_methods to authenticated;

grant SELECT, INSERT, UPDATE, DELETE on table public.payment_payouts to authenticated;

grant SELECT, INSERT, UPDATE, DELETE on table public.payment_webhook_events to authenticated;

grant SELECT, INSERT, UPDATE, DELETE on table public.plan_payments to authenticated;

grant SELECT on table public.production_dashboard to authenticated;

grant SELECT, INSERT, UPDATE, DELETE on table public.production_orders to authenticated;

grant SELECT, INSERT, UPDATE, DELETE on table public.production_steps to authenticated;

grant SELECT, INSERT, UPDATE, DELETE on table public.products to authenticated;

grant SELECT, INSERT, UPDATE, DELETE on table public.proposal_events to authenticated;

grant SELECT, INSERT, UPDATE, DELETE on table public.proposals to authenticated;

grant SELECT on table public.proposals_dashboard to authenticated;

grant SELECT, INSERT, UPDATE, DELETE on table public.provider_customers to authenticated;

grant SELECT on table public.public_company_profiles to anon;

grant SELECT on table public.public_company_profiles to authenticated;

grant SELECT on table public.public_marketplace_companies to anon;

grant SELECT on table public.public_marketplace_companies to authenticated;

grant SELECT on table public.public_marketplace_products to anon;

grant SELECT on table public.public_marketplace_products to authenticated;

grant SELECT on table public.public_site_companies to anon;

grant SELECT on table public.public_site_companies to authenticated;

grant SELECT on table public.public_site_sections to anon;

grant SELECT on table public.public_site_sections to authenticated;

grant SELECT on table public.public_store_products to anon;

grant SELECT on table public.public_store_products to authenticated;

grant SELECT, INSERT, UPDATE, DELETE on table public.quote_templates to authenticated;

grant SELECT, INSERT, UPDATE, DELETE on table public.recurring_orders to authenticated;

grant SELECT, INSERT, UPDATE, DELETE on table public.security_blocklist to authenticated;

grant SELECT, INSERT, UPDATE, DELETE on table public.security_events to authenticated;

grant SELECT, INSERT, UPDATE, DELETE on table public.signup_lead_followups to authenticated;

grant SELECT, INSERT, UPDATE, DELETE on table public.signup_leads to authenticated;

grant SELECT, INSERT, UPDATE, DELETE on table public.site_sections to authenticated;

grant SELECT, INSERT, UPDATE, DELETE on table public.subscription_events to authenticated;

grant SELECT, INSERT, UPDATE, DELETE on table public.whatsapp_conversations to authenticated;

grant SELECT, INSERT, UPDATE, DELETE on table public.whatsapp_message_logs to authenticated;

grant execute on function orcaly_private.can_manage_company(p_company_id uuid) to authenticated;

grant execute on function orcaly_private.can_manage_company(p_company_id uuid) to service_role;

grant execute on function orcaly_private.can_manage_storage_path(p_name text) to authenticated;

grant execute on function orcaly_private.can_manage_storage_path(p_name text) to service_role;

grant execute on function orcaly_private.create_default_site_for_company(p_company_id uuid) to service_role;

grant execute on function orcaly_private.is_company_member(p_company_id uuid) to authenticated;

grant execute on function orcaly_private.is_company_member(p_company_id uuid) to service_role;

grant execute on function orcaly_private.is_company_owner(p_company_id uuid) to authenticated;

grant execute on function orcaly_private.is_company_owner(p_company_id uuid) to service_role;

grant execute on function orcaly_private.is_orcaly_admin() to authenticated;

grant execute on function orcaly_private.is_orcaly_admin() to service_role;

grant execute on function orcaly_private.my_company_role(p_company_id uuid) to authenticated;

grant execute on function orcaly_private.my_company_role(p_company_id uuid) to service_role;

grant execute on function orcaly_private.orcaly_user_has_company_access(target_company uuid) to authenticated;

grant execute on function orcaly_private.orcaly_user_has_company_access(target_company uuid) to service_role;

grant execute on function orcaly_private.public_companies_data() to anon;

grant execute on function orcaly_private.public_companies_data() to authenticated;

grant execute on function orcaly_private.public_companies_data() to service_role;

grant execute on function orcaly_private.public_products_data() to anon;

grant execute on function orcaly_private.public_products_data() to authenticated;

grant execute on function orcaly_private.public_products_data() to service_role;

grant execute on function orcaly_private.public_site_sections_data() to anon;

grant execute on function orcaly_private.public_site_sections_data() to authenticated;

grant execute on function orcaly_private.public_site_sections_data() to service_role;

grant execute on function orcaly_private.storage_path_company_id(p_name text) to authenticated;

grant execute on function orcaly_private.storage_path_company_id(p_name text) to service_role;

grant execute on function public.cancel_affiliate_payout_admin(p_payout_id uuid, p_reason text) to service_role;

grant execute on function public.change_signup_lead_sales_stage(p_lead_id uuid, p_actor_admin_id uuid, p_stage text, p_note text, p_lost_reason text) to service_role;

grant execute on function public.claim_company_subscription_trial(p_company_id uuid) to service_role;

grant execute on function public.claim_due_founder_price_conversions(p_limit integer) to service_role;

grant execute on function public.claim_founder_activation(p_token_hash text, p_email text, p_claim_id uuid) to service_role;

grant execute on function public.claim_founder_billing_setup(p_company_id uuid, p_claim_id uuid) to service_role;

grant execute on function public.claim_platform_admin_invite(p_token_hash text, p_claim_id uuid) to service_role;

grant execute on function public.complete_founder_activation(p_claim_id uuid, p_user_id uuid, p_company_name text, p_slug text, p_business_type text, p_whatsapp text, p_cidade text, p_estado text, p_onboarding_goal text, p_default_setup jsonb) to service_role;

grant execute on function public.complete_founder_billing_setup(p_company_id uuid, p_claim_id uuid, p_plan_payment_id uuid, p_subscription_id text, p_provider_status text, p_checkout_url text, p_next_payment_date timestamp with time zone, p_provider_payload jsonb) to service_role;

grant execute on function public.complete_founder_price_conversion(p_company_id uuid, p_claim_id uuid, p_provider_status text, p_provider_payload jsonb, p_action text) to service_role;

grant execute on function public.complete_platform_admin_invite(p_claim_id uuid, p_user_id uuid) to service_role;

grant execute on function public.consume_marketplace_coupon(p_company_id uuid, p_order_id uuid) to service_role;

grant execute on function public.create_affiliate_payout_admin(p_affiliate_id uuid) to service_role;

grant execute on function public.create_founder_invite_for_sales_lead(p_actor_admin_id uuid, p_lead_id uuid, p_plan_key text, p_token_hash text, p_token_expires_at timestamp with time zone, p_requested_founder_number integer) to service_role;

grant execute on function public.create_founder_test_invite(p_actor_admin_id uuid, p_email text, p_plan_key text, p_token_hash text, p_token_expires_at timestamp with time zone) to service_role;

grant execute on function public.create_or_claim_sales_prospect(p_actor_admin_id uuid, p_assigned_admin_id uuid, p_email text, p_empresa_nome text, p_nome_responsavel text, p_whatsapp text, p_segmento text, p_cidade text, p_estado text) to service_role;

grant execute on function public.expire_due_founder_trials() to service_role;

grant execute on function public.expire_marketplace_stock_reservations(p_limit integer) to service_role;

grant execute on function public.expire_pending_founder_invites() to service_role;

grant execute on function public.fail_affiliate_payout_admin(p_payout_id uuid, p_reason text) to service_role;

grant execute on function public.finance_touch_updated_at() to service_role;

grant execute on function public.get_affiliate_payout_account_admin(p_affiliate_id uuid) to service_role;

grant execute on function public.get_my_platform_admin_access() to authenticated;

grant execute on function public.get_my_platform_admin_access() to service_role;

grant execute on function public.list_affiliate_payout_accounts_admin() to service_role;

grant execute on function public.mark_affiliate_payout_paid_admin(p_payout_id uuid, p_provider text, p_provider_transfer_id text, p_proof_url text) to service_role;

grant execute on function public.orcaly_consume_rate_limit(p_key text, p_limit integer, p_window_seconds integer) to service_role;

grant execute on function public.preview_founder_activation(p_token_hash text) to service_role;

grant execute on function public.protect_company_trial_used_at() to service_role;

grant execute on function public.record_founder_payment_approved(p_company_id uuid, p_subscription_id text, p_payment_id text, p_next_payment_date timestamp with time zone, p_provider_payload jsonb) to service_role;

grant execute on function public.record_signup_lead_sales_followup(p_lead_id uuid, p_actor_admin_id uuid, p_channel text, p_message text, p_next_action_at timestamp with time zone) to service_role;

grant execute on function public.release_affiliate_commissions_admin() to service_role;

grant execute on function public.release_founder_activation_claim(p_claim_id uuid, p_error text) to service_role;

grant execute on function public.release_founder_billing_claim(p_company_id uuid, p_claim_id uuid, p_error text) to service_role;

grant execute on function public.release_founder_price_conversion_claim(p_company_id uuid, p_claim_id uuid, p_error text) to service_role;

grant execute on function public.release_platform_admin_invite_claim(p_claim_id uuid) to service_role;

grant execute on function public.reserve_marketplace_stock(p_company_id uuid, p_order_id uuid, p_marketplace_payment_id uuid, p_expires_at timestamp with time zone, p_items jsonb) to service_role;

grant execute on function public.reverse_affiliate_commission_admin(p_provider_payment_id text, p_reason text) to service_role;

grant execute on function public.review_affiliate_referral_admin(p_referral_id uuid, p_decision text, p_actor_email text, p_note text) to service_role;

grant execute on function public.revoke_founder_invite(p_actor_admin_id uuid, p_invite_id uuid, p_reason text) to service_role;

grant execute on function public.rotate_founder_invite_token(p_actor_admin_id uuid, p_invite_id uuid, p_token_hash text, p_token_expires_at timestamp with time zone) to service_role;

grant execute on function public.save_affiliate_payout_account_admin(p_affiliate_id uuid, p_pix_key_type text, p_pix_key_encrypted text, p_pix_key_masked text, p_holder_name text, p_holder_document_hash text, p_holder_document_last4 text, p_bank_name text, p_provider_validation jsonb, p_is_verified boolean, p_verified_by text) to service_role;

grant execute on function public.set_affiliate_payout_account_verification_admin(p_affiliate_id uuid, p_verified boolean, p_verified_by text, p_note text) to service_role;

grant execute on function public.set_company_subdomain_slug() to service_role;

grant execute on function public.set_updated_at() to service_role;

grant execute on function public.settle_marketplace_stock(p_company_id uuid, p_marketplace_payment_id uuid, p_payment_status text, p_reason text) to service_role;

grant execute on function public.touch_signup_lead_updated_at() to service_role;
