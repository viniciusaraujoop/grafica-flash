-- Schema-only catalog baseline. No client/auth/Vault rows, cron jobs or external calls.

-- Generated from production metadata; apply ONLY to the verified empty staging project.

begin;

set local statement_timeout = '90s';

set local lock_timeout = '5s';

set local check_function_bodies = false;

set local search_path = pg_catalog, public, extensions;

do $guard$ begin
 if current_setting('orcaly.staging_guard', true) is distinct from 'zwxulgpjucxudadjdqov' then raise exception 'STAGING_GUARD_REQUIRED'; end if;
 if current_user <> 'postgres' then raise exception 'BASELINE_REQUIRES_POSTGRES_OWNER'; end if;
 if exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind in ('r','p')) then raise exception 'BASELINE_REQUIRES_EMPTY_PUBLIC_SCHEMA'; end if;
 if exists(select 1 from auth.users) or exists(select 1 from storage.objects) or exists(select 1 from vault.secrets) then raise exception 'BASELINE_REQUIRES_NO_PERSONAL_DATA_OR_SECRETS'; end if;
end $guard$;

create extension if not exists "pg_cron" with schema "pg_catalog" version '1.6.4';

create schema "api" authorization "postgres";

create schema "orcaly_private" authorization "postgres";

create table "orcaly_private"."affiliate_payout_accounts" (
  "id" uuid not null,
  "affiliate_id" uuid not null,
  "pix_key_type" text not null,
  "pix_key_encrypted" text not null,
  "pix_key_masked" text not null,
  "holder_name" text not null,
  "holder_document_hash" text not null,
  "holder_document_last4" text not null,
  "bank_name" text,
  "provider_validation" jsonb not null,
  "is_verified" boolean not null,
  "verified_at" timestamp with time zone,
  "verified_by" text,
  "created_at" timestamp with time zone not null,
  "updated_at" timestamp with time zone not null
);

create table "orcaly_private"."api_rate_limits" (
  "key" text not null,
  "window_started_at" timestamp with time zone not null,
  "request_count" integer not null,
  "updated_at" timestamp with time zone not null
);

create table "public"."admin_audit_logs" (
  "id" uuid not null,
  "admin_email" text not null,
  "action" text not null,
  "metadata" jsonb,
  "created_at" timestamp with time zone,
  "target_type" text,
  "target_id" text,
  "target_label" text,
  "payload" jsonb not null
);

create table "public"."admin_bug_reports" (
  "id" uuid not null,
  "severity" text not null,
  "category" text not null,
  "title" text not null,
  "description" text,
  "table_name" text,
  "record_id" text,
  "fingerprint" text not null,
  "status" text not null,
  "metadata" jsonb not null,
  "first_seen_at" timestamp with time zone,
  "last_seen_at" timestamp with time zone,
  "resolved_at" timestamp with time zone,
  "resolved_by" text,
  "resolution_note" text,
  "code" text not null,
  "area" text not null,
  "entity_type" text,
  "entity_id" text,
  "entity_label" text,
  "suggested_action" text,
  "occurrences" integer not null,
  "fix_steps" jsonb not null,
  "fix_sql" text,
  "fix_route" text,
  "auto_fixable" boolean not null,
  "affected_table" text,
  "affected_field" text
);

create table "public"."admin_scan_runs" (
  "id" uuid not null,
  "started_at" timestamp with time zone,
  "finished_at" timestamp with time zone,
  "status" text not null,
  "total_issues" integer not null,
  "critical_count" integer not null,
  "high_count" integer not null,
  "medium_count" integer not null,
  "low_count" integer not null,
  "created_by" text,
  "summary" jsonb not null
);

create table "public"."admin_system_snapshots" (
  "id" uuid not null,
  "companies_total" integer,
  "companies_active" integer,
  "companies_overdue" integer,
  "bugs_green" integer,
  "bugs_yellow" integer,
  "bugs_red" integer,
  "metadata" jsonb,
  "created_at" timestamp with time zone
);

create table "public"."admin_users" (
  "id" uuid not null,
  "email" text not null,
  "nome" text,
  "role" text not null,
  "ativo" boolean not null,
  "created_at" timestamp with time zone,
  "permissions" jsonb not null,
  "area" text,
  "observacoes" text,
  "created_by" text,
  "updated_at" timestamp with time zone
);

create table "public"."affiliate_achievements" (
  "id" uuid not null,
  "affiliate_id" uuid not null,
  "achievement_id" text not null,
  "title" text not null,
  "metadata" jsonb not null,
  "unlocked_at" timestamp with time zone not null
);

create table "public"."affiliate_activity_events" (
  "id" uuid not null,
  "affiliate_id" uuid not null,
  "lead_id" uuid,
  "kind" text not null,
  "xp" integer not null,
  "metadata" jsonb not null,
  "created_at" timestamp with time zone not null
);

create table "public"."affiliate_announcements" (
  "id" uuid not null,
  "title" text not null,
  "body" text not null,
  "kind" text not null,
  "cta_label" text,
  "cta_href" text,
  "is_active" boolean not null,
  "published_at" timestamp with time zone not null,
  "created_at" timestamp with time zone not null
);

create table "public"."affiliate_audit_logs" (
  "id" uuid not null,
  "affiliate_id" uuid,
  "actor_user_id" uuid,
  "actor_email" text,
  "action" text not null,
  "target_type" text,
  "target_id" text,
  "ip_hash" text,
  "metadata" jsonb not null,
  "created_at" timestamp with time zone not null
);

create table "public"."affiliate_certifications" (
  "id" uuid not null,
  "affiliate_id" uuid not null,
  "certification_id" text not null,
  "title" text not null,
  "score" numeric(5,2) not null,
  "status" text not null,
  "issued_at" timestamp with time zone not null,
  "expires_at" timestamp with time zone,
  "metadata" jsonb not null
);

create table "public"."affiliate_clicks" (
  "id" uuid not null,
  "affiliate_id" uuid not null,
  "code_snapshot" text not null,
  "session_hash" text,
  "ip_hash" text,
  "user_agent_hash" text,
  "landing_path" text,
  "referrer_host" text,
  "created_at" timestamp with time zone not null
);

create table "public"."affiliate_commissions" (
  "id" uuid not null,
  "affiliate_id" uuid not null,
  "referral_id" uuid not null,
  "company_id" uuid not null,
  "plan_payment_id" uuid,
  "provider_payment_id" text not null,
  "plan" text not null,
  "gross_amount" numeric(14,2) not null,
  "eligible_amount" numeric(14,2) not null,
  "commission_rate" numeric(5,4) not null,
  "commission_amount" numeric(14,2) not null,
  "status" text not null,
  "hold_until" timestamp with time zone,
  "available_at" timestamp with time zone,
  "payout_id" uuid,
  "reversed_at" timestamp with time zone,
  "reversal_reason" text,
  "created_at" timestamp with time zone not null,
  "updated_at" timestamp with time zone not null
);

create table "public"."affiliate_course_progress" (
  "id" uuid not null,
  "affiliate_id" uuid not null,
  "course_id" text not null,
  "lesson_id" text not null,
  "score" numeric(5,2),
  "completed_at" timestamp with time zone not null,
  "created_at" timestamp with time zone not null
);

create table "public"."affiliate_goals" (
  "id" uuid not null,
  "affiliate_id" uuid not null,
  "period_start" date not null,
  "contacts_target" integer not null,
  "demos_target" integer not null,
  "trials_target" integer not null,
  "customers_target" integer not null,
  "content_target" integer not null,
  "study_target" integer not null,
  "created_at" timestamp with time zone not null,
  "updated_at" timestamp with time zone not null
);

create table "public"."affiliate_leads" (
  "id" uuid not null,
  "affiliate_id" uuid not null,
  "name" text not null,
  "company_name" text,
  "whatsapp" text,
  "email" text,
  "segment" text not null,
  "status" text not null,
  "source" text not null,
  "notes" text,
  "next_follow_up_at" timestamp with time zone,
  "estimated_plan" text,
  "estimated_value" numeric(12,2) not null,
  "lost_reason" text,
  "converted_at" timestamp with time zone,
  "created_at" timestamp with time zone not null,
  "updated_at" timestamp with time zone not null
);

create table "public"."affiliate_payout_items" (
  "payout_id" uuid not null,
  "commission_id" uuid not null,
  "amount" numeric(14,2) not null,
  "created_at" timestamp with time zone not null
);

create table "public"."affiliate_payouts" (
  "id" uuid not null,
  "affiliate_id" uuid not null,
  "gross_commissions" numeric(14,2) not null,
  "debt_offset" numeric(14,2) not null,
  "amount" numeric(14,2) not null,
  "status" text not null,
  "provider" text not null,
  "provider_transfer_id" text,
  "external_reference" text not null,
  "pix_key_type" text not null,
  "pix_key_masked" text not null,
  "holder_name" text not null,
  "requested_at" timestamp with time zone not null,
  "approved_at" timestamp with time zone,
  "processing_at" timestamp with time zone,
  "paid_at" timestamp with time zone,
  "failed_at" timestamp with time zone,
  "cancelled_at" timestamp with time zone,
  "failure_reason" text,
  "proof_url" text,
  "admin_note" text,
  "created_at" timestamp with time zone not null,
  "updated_at" timestamp with time zone not null
);

create table "public"."affiliate_profiles" (
  "id" uuid not null,
  "user_id" uuid not null,
  "name" text not null,
  "email" text not null,
  "whatsapp" text not null,
  "document_type" text not null,
  "document_hash" text not null,
  "document_last4" text not null,
  "code" text not null,
  "status" text not null,
  "payout_status" text not null,
  "commission_rate" numeric(5,4) not null,
  "debt_balance" numeric(14,2) not null,
  "terms_version" text not null,
  "terms_accepted_at" timestamp with time zone not null,
  "marketing_opt_in" boolean not null,
  "approved_at" timestamp with time zone,
  "suspended_at" timestamp with time zone,
  "suspension_reason" text,
  "last_login_at" timestamp with time zone,
  "created_at" timestamp with time zone not null,
  "updated_at" timestamp with time zone not null
);

create table "public"."affiliate_program_settings" (
  "id" smallint not null,
  "commission_rate" numeric(5,4) not null,
  "hold_days" integer not null,
  "minimum_payout_amount" numeric(14,2) not null,
  "attribution_days" integer not null,
  "payouts_enabled" boolean not null,
  "automatic_payout_enabled" boolean not null,
  "terms_version" text not null,
  "updated_at" timestamp with time zone not null
);

create table "public"."affiliate_referrals" (
  "id" uuid not null,
  "affiliate_id" uuid not null,
  "referral_code" text not null,
  "signup_lead_id" uuid,
  "company_id" uuid,
  "status" text not null,
  "plan" text,
  "customer_name_masked" text,
  "customer_email_masked" text,
  "customer_document_hash" text,
  "customer_whatsapp_hash" text,
  "source" text not null,
  "registered_at" timestamp with time zone not null,
  "trial_ends_at" timestamp with time zone,
  "qualified_at" timestamp with time zone,
  "rejected_at" timestamp with time zone,
  "rejection_reason" text,
  "first_payment_reference" text,
  "first_payment_amount" numeric(14,2),
  "commission_expected" numeric(14,2) not null,
  "ip_hash" text,
  "device_hash" text,
  "created_at" timestamp with time zone not null,
  "updated_at" timestamp with time zone not null,
  "review_status" text not null,
  "reviewed_at" timestamp with time zone,
  "reviewed_by" text,
  "review_note" text
);

create table "public"."affiliate_tasks" (
  "id" uuid not null,
  "affiliate_id" uuid not null,
  "lead_id" uuid,
  "title" text not null,
  "task_type" text not null,
  "priority" text not null,
  "due_at" timestamp with time zone,
  "notes" text,
  "completed_at" timestamp with time zone,
  "created_at" timestamp with time zone not null,
  "updated_at" timestamp with time zone not null
);

create table "public"."affiliate_training_sessions" (
  "id" uuid not null,
  "affiliate_id" uuid not null,
  "mode" text not null,
  "scenario_id" text not null,
  "answer" text,
  "total_score" numeric(5,2) not null,
  "score_json" jsonb not null,
  "feedback" text,
  "completed_at" timestamp with time zone not null,
  "created_at" timestamp with time zone not null
);

create table "public"."app_notifications" (
  "id" uuid not null,
  "company_id" uuid not null,
  "user_id" uuid,
  "tipo" text not null,
  "titulo" text not null,
  "mensagem" text,
  "link_url" text,
  "status" text not null,
  "payload" jsonb not null,
  "read_at" timestamp with time zone,
  "created_at" timestamp with time zone not null
);

create table "public"."application_error_events" (
  "id" uuid not null,
  "error_id" text not null,
  "request_id" text not null,
  "created_at" timestamp with time zone not null,
  "environment" text not null,
  "deployment" text,
  "route" text not null,
  "operation" text not null,
  "actor_user_id" uuid,
  "company_id" uuid,
  "error_type" text not null,
  "error_code" text,
  "http_status" integer,
  "message_sanitized" text,
  "stack_sanitized" text,
  "metadata" jsonb not null
);

create table "public"."art_approval_requests" (
  "id" uuid not null,
  "company_id" uuid not null,
  "order_id" uuid,
  "proposal_id" uuid,
  "token" text not null,
  "title" text,
  "produto_nome" text,
  "cliente_nome" text,
  "cliente_whatsapp" text,
  "artwork_url" text,
  "preview_url" text,
  "instructions" text,
  "status" text not null,
  "comentario_cliente" text,
  "internal_notes" text,
  "approved_at" timestamp with time zone,
  "requested_changes_at" timestamp with time zone,
  "created_by" uuid,
  "created_at" timestamp with time zone not null,
  "updated_at" timestamp with time zone not null,
  "expires_at" timestamp with time zone,
  "responded_at" timestamp with time zone,
  "revoked_at" timestamp with time zone
);

create table "public"."assistant_events" (
  "id" uuid not null,
  "request_id" uuid not null,
  "session_hash" text not null,
  "event_name" text not null,
  "page_path" text,
  "segment" text,
  "recommended_plan" text,
  "tool_name" text,
  "status" text,
  "latency_ms" integer,
  "model" text,
  "prompt_tokens" integer,
  "completion_tokens" integer,
  "metadata" jsonb not null,
  "created_at" timestamp with time zone not null
);

create table "public"."automation_rules" (
  "id" uuid not null,
  "company_id" uuid not null,
  "name" text not null,
  "description" text,
  "enabled" boolean not null,
  "trigger_key" text not null,
  "conditions" jsonb not null,
  "actions" jsonb not null,
  "created_by" uuid,
  "updated_by" uuid,
  "created_at" timestamp with time zone not null,
  "updated_at" timestamp with time zone not null
);

create table "public"."automation_runs" (
  "id" uuid not null,
  "company_id" uuid not null,
  "rule_id" uuid not null,
  "outbox_event_id" uuid,
  "run_key" text not null,
  "status" text not null,
  "attempts" integer not null,
  "max_attempts" integer not null,
  "input" jsonb not null,
  "result" jsonb not null,
  "last_error" text,
  "created_at" timestamp with time zone not null,
  "started_at" timestamp with time zone,
  "completed_at" timestamp with time zone
);

create table "public"."background_jobs" (
  "id" uuid not null,
  "company_id" uuid,
  "job_type" text not null,
  "payload" jsonb not null,
  "status" text not null,
  "attempts" integer not null,
  "max_attempts" integer not null,
  "run_after" timestamp with time zone not null,
  "locked_at" timestamp with time zone,
  "locked_by" text,
  "created_at" timestamp with time zone not null,
  "started_at" timestamp with time zone,
  "completed_at" timestamp with time zone,
  "last_error" text,
  "metadata" jsonb not null
);

create table "public"."business_hours" (
  "id" uuid not null,
  "company_id" uuid,
  "weekday" integer not null,
  "opens_at" time without time zone,
  "closes_at" time without time zone,
  "active" boolean,
  "created_at" timestamp with time zone,
  "updated_at" timestamp with time zone,
  "is_active" boolean not null,
  "is_open" boolean,
  "open_time" time without time zone,
  "close_time" time without time zone,
  "break_start" time without time zone,
  "break_end" time without time zone,
  "closed_message" text
);

create table "public"."companies" (
  "id" uuid not null,
  "nome" text not null,
  "slug" text not null,
  "logo_url" text,
  "whatsapp" text,
  "cor_principal" text,
  "plano" text,
  "ativo" boolean,
  "created_at" timestamp with time zone,
  "owner_id" uuid,
  "email" text,
  "segmento" text,
  "telefone" text,
  "cidade" text,
  "estado" text,
  "pix_key" text,
  "pix_nome" text,
  "pix_cidade" text,
  "aceita_pix" boolean,
  "aceita_cartao" boolean,
  "cobrar_sinal" boolean,
  "percentual_sinal" numeric,
  "assinatura_status" text,
  "assinatura_plano" text,
  "assinatura_inicio" timestamp with time zone,
  "assinatura_expira_em" timestamp with time zone,
  "assinatura_ultimo_pagamento" timestamp with time zone,
  "mercado_pago_customer_email" text,
  "tester_id" uuid,
  "modelo_negocio" text,
  "modelo_nome" text,
  "modelo_perguntas" jsonb,
  "subdomain_slug" text,
  "site_template" text,
  "site_status" text,
  "site_primary_color" text,
  "site_accent_color" text,
  "site_config" jsonb,
  "site_updated_at" timestamp with time zone,
  "pix_tipo" text,
  "atendimento_horario" text,
  "atendimento_observacao" text,
  "instagram" text,
  "marketplace_ativo" boolean,
  "marketplace_titulo" text,
  "marketplace_subtitulo" text,
  "marketplace_banner_url" text,
  "marketplace_texto_botao" text,
  "marketplace_sobre" text,
  "marketplace_endereco" text,
  "marketplace_mapa_url" text,
  "marketplace_termos" text,
  "marketplace_config" jsonb,
  "site_publico_ativo" boolean,
  "site_background_color" text,
  "site_headline" text,
  "site_subheadline" text,
  "site_cta_text" text,
  "site_banner_url" text,
  "site_about_title" text,
  "site_about_text" text,
  "site_services_title" text,
  "site_contact_title" text,
  "site_show_store" boolean,
  "site_show_about" boolean,
  "site_show_contact" boolean,
  "site_show_featured" boolean,
  "site_features" jsonb,
  "site_faq" jsonb,
  "site_testimonials" jsonb,
  "site_custom_sections" jsonb,
  "updated_at" timestamp with time zone,
  "assinatura_auto_recorrente" boolean,
  "assinatura_cancelada_em" timestamp with time zone,
  "assinatura_checkout_url" text,
  "assinatura_mp_payload" jsonb,
  "assinatura_proxima_cobranca" timestamp with time zone,
  "mercado_pago_subscription_id" text,
  "mercado_pago_subscription_status" text,
  "modelo_status" text[],
  "modelo_mensagens" jsonb,
  "modelo_proposta" jsonb,
  "modelo_campos_recomendados" text[],
  "site_layout" text,
  "site_art_style" text,
  "site_font_style" text,
  "site_button_style" text,
  "site_hero_alignment" text,
  "site_text_color" text,
  "site_card_color" text,
  "site_badge_text" text,
  "site_secondary_cta_text" text,
  "site_whatsapp_message" text,
  "site_show_faq" boolean,
  "site_show_testimonials" boolean,
  "site_show_gallery" boolean,
  "site_show_benefits" boolean,
  "site_gallery" jsonb,
  "site_benefits" jsonb,
  "site_seo_title" text,
  "site_seo_description" text,
  "site_keywords" text[],
  "site_promo_title" text,
  "site_promo_text" text,
  "site_promo_active" boolean,
  "site_promo_button_text" text,
  "site_business_hours" jsonb,
  "site_payment_methods" text[],
  "site_delivery_options" text[],
  "site_hero_style" text,
  "site_art_variant" text,
  "site_section_style" text,
  "site_product_card_style" text,
  "site_nav_variant" text,
  "site_corner_style" text,
  "site_density" text,
  "site_show_marketplace" boolean,
  "site_enable_cart" boolean,
  "site_enable_coupons" boolean,
  "site_show_prices" boolean,
  "site_checkout_mode" text,
  "site_marketplace_title" text,
  "site_marketplace_subtitle" text,
  "site_cart_button_text" text,
  "site_checkout_button_text" text,
  "site_empty_catalog_text" text,
  "site_trust_title" text,
  "site_hero_highlights" jsonb,
  "site_brand_words" text[],
  "site_footer_text" text,
  "whatsapp_enabled" boolean,
  "whatsapp_phone_number_id" text,
  "whatsapp_access_token" text,
  "whatsapp_verify_token" text,
  "whatsapp_business_account_id" text,
  "whatsapp_auto_reply_enabled" boolean,
  "whatsapp_order_notifications" boolean,
  "whatsapp_status_notifications" boolean,
  "whatsapp_ai_enabled" boolean,
  "whatsapp_ai_prompt" text,
  "banner_url" text,
  "onboarding_current_step" integer,
  "onboarding_completed" boolean,
  "onboarding_completed_at" timestamp with time zone,
  "onboarding_dismissed" boolean,
  "onboarding_updated_at" timestamp with time zone,
  "business_type" text,
  "onboarding_goal" text,
  "site_theme" text,
  "site_cta_label" text,
  "site_sections" jsonb,
  "assinatura_forma_pagamento_preferida" text,
  "assinatura_pix_avulso_status" text,
  "assinatura_pix_avulso_ultimo_pagamento" timestamp with time zone,
  "trial_started_at" timestamp with time zone,
  "trial_ends_at" timestamp with time zone,
  "trial_used_at" timestamp with time zone,
  "cancel_at_period_end" boolean not null,
  "access_until" timestamp with time zone,
  "subscription_provider" text,
  "provider_customer_id" text,
  "provider_subscription_id" text,
  "next_billing_at" timestamp with time zone,
  "is_founder" boolean not null,
  "founder_number" integer,
  "founder_price_cents" integer,
  "founder_started_at" timestamp with time zone,
  "founder_trial_ends_at" timestamp with time zone,
  "founder_price_ends_at" timestamp with time zone,
  "founder_welcome_seen_at" timestamp with time zone,
  "founder_price_converted_at" timestamp with time zone,
  "founder_billing_claim_id" uuid,
  "founder_billing_claimed_at" timestamp with time zone,
  "founder_billing_attempts" integer not null,
  "founder_billing_last_error" text,
  "founder_billing_setup_at" timestamp with time zone,
  "founder_billing_authorized_at" timestamp with time zone,
  "founder_billing_last_sync_at" timestamp with time zone,
  "founder_price_conversion_claim_id" uuid,
  "founder_price_conversion_claimed_at" timestamp with time zone,
  "founder_price_conversion_attempts" integer not null,
  "founder_price_conversion_last_error" text,
  "timezone" text
);

create table "public"."company_health_snapshots" (
  "id" bigint generated always as identity (sequence name "public"."company_health_snapshots_id_seq" start with 1 increment by 1 minvalue 1 maxvalue 9223372036854775807 cache 1 no cycle) not null,
  "company_id" uuid not null,
  "score" integer not null,
  "reasons" jsonb not null,
  "metrics" jsonb not null,
  "calculated_at" timestamp with time zone not null
);

create table "public"."company_members" (
  "id" uuid not null,
  "company_id" uuid not null,
  "user_id" uuid not null,
  "nome" text not null,
  "email" text not null,
  "cargo" text not null,
  "status" text not null,
  "permissions" jsonb not null,
  "created_by" uuid,
  "created_at" timestamp with time zone,
  "updated_at" timestamp with time zone
);

create table "public"."company_niche_templates" (
  "id" uuid not null,
  "company_id" uuid not null,
  "niche_id" text not null,
  "niche_name" text not null,
  "categories" text[] not null,
  "questions" text[] not null,
  "statuses" text[] not null,
  "ready_messages" jsonb not null,
  "proposal_model" jsonb not null,
  "recommended_fields" text[] not null,
  "applied_by" uuid,
  "applied_at" timestamp with time zone not null,
  "updated_at" timestamp with time zone not null
);

create table "public"."company_proposal_settings" (
  "id" uuid not null,
  "company_id" uuid not null,
  "default_validity_days" integer,
  "default_terms" text,
  "default_intro" text,
  "default_approval_message" text,
  "default_rejection_message" text,
  "require_document" boolean,
  "require_signature_name" boolean,
  "auto_generate_pix" boolean,
  "created_at" timestamp with time zone,
  "updated_at" timestamp with time zone
);

create table "public"."company_whatsapp_settings" (
  "company_id" uuid not null,
  "enabled" boolean not null,
  "ai_enabled" boolean not null,
  "notify_owner_new_order" boolean not null,
  "notify_client_new_order" boolean not null,
  "notify_client_order_status" boolean not null,
  "notify_client_proposal" boolean not null,
  "notify_owner_proposal" boolean not null,
  "owner_phone" text,
  "phone_number_id" text,
  "business_account_id" text,
  "ai_prompt" text,
  "fallback_message" text,
  "template_order_created" text,
  "template_order_status" text,
  "template_proposal_update" text,
  "template_payment_update" text,
  "template_language" text not null,
  "metadata" jsonb not null,
  "created_at" timestamp with time zone not null,
  "updated_at" timestamp with time zone not null
);

create table "public"."crm_leads" (
  "id" uuid not null,
  "company_id" uuid not null,
  "nome" text not null,
  "telefone" text,
  "email" text,
  "origem" text,
  "etapa" text not null,
  "status" text not null,
  "valor_estimado" numeric,
  "proximo_contato_em" timestamp with time zone,
  "observacoes" text,
  "tags" text[],
  "order_id" uuid,
  "proposal_id" uuid,
  "created_by" uuid,
  "created_at" timestamp with time zone not null,
  "updated_at" timestamp with time zone not null,
  "customer_profile_id" uuid
);

create table "public"."customer_duplicate_candidates" (
  "id" uuid not null,
  "company_id" uuid not null,
  "left_customer_id" uuid not null,
  "right_customer_id" uuid not null,
  "reasons" jsonb not null,
  "confidence" integer not null,
  "status" text not null,
  "reviewed_by" uuid,
  "reviewed_at" timestamp with time zone,
  "created_at" timestamp with time zone not null,
  "updated_at" timestamp with time zone not null
);

create table "public"."customer_followups" (
  "id" uuid not null,
  "company_id" uuid not null,
  "cliente_nome" text,
  "cliente_telefone" text not null,
  "titulo" text not null,
  "descricao" text,
  "status" text not null,
  "prioridade" text not null,
  "due_at" timestamp with time zone,
  "completed_at" timestamp with time zone,
  "created_by" uuid,
  "created_at" timestamp with time zone,
  "customer_profile_id" uuid
);

create table "public"."customer_internal_notes" (
  "id" uuid not null,
  "company_id" uuid not null,
  "customer_phone" text,
  "customer_name" text,
  "note" text not null,
  "created_by" uuid,
  "created_at" timestamp with time zone not null
);

create table "public"."customer_magic_links" (
  "id" uuid not null,
  "company_id" uuid not null,
  "customer_name" text,
  "customer_phone" text not null,
  "token" text not null,
  "status" text not null,
  "last_access_at" timestamp with time zone,
  "created_by" uuid,
  "created_at" timestamp with time zone not null
);

create table "public"."customer_notes" (
  "id" uuid not null,
  "company_id" uuid not null,
  "cliente_nome" text,
  "cliente_telefone" text not null,
  "tipo" text not null,
  "conteudo" text not null,
  "created_by" uuid,
  "created_at" timestamp with time zone,
  "customer_profile_id" uuid
);

create table "public"."customer_portal_events" (
  "id" uuid not null,
  "company_id" uuid,
  "customer_magic_link_id" uuid,
  "event_type" text not null,
  "metadata" jsonb not null,
  "created_at" timestamp with time zone not null
);

create table "public"."customer_profiles" (
  "id" uuid not null,
  "company_id" uuid not null,
  "contact_key" text not null,
  "display_name" text,
  "normalized_name" text,
  "phone_raw" text,
  "phone_normalized" text,
  "email_raw" text,
  "email_normalized" text,
  "source" text not null,
  "source_id" text,
  "created_by" uuid,
  "updated_by" uuid,
  "created_at" timestamp with time zone not null,
  "updated_at" timestamp with time zone not null,
  "last_activity_at" timestamp with time zone,
  "merged_into_id" uuid,
  "archived" boolean not null,
  "metadata" jsonb not null
);

create table "public"."data_quality_issues" (
  "id" uuid not null,
  "company_id" uuid not null,
  "fingerprint" text not null,
  "rule_key" text not null,
  "severity" text not null,
  "entity_type" text not null,
  "entity_id" text,
  "title" text not null,
  "detail" text not null,
  "recommended_action" text not null,
  "auto_fixable" boolean not null,
  "status" text not null,
  "metadata" jsonb not null,
  "first_seen_at" timestamp with time zone not null,
  "last_seen_at" timestamp with time zone not null,
  "resolved_at" timestamp with time zone
);

create table "public"."deliveries" (
  "id" uuid not null,
  "company_id" uuid,
  "order_id" uuid,
  "customer_name" text,
  "customer_phone" text,
  "address" text,
  "neighborhood" text,
  "delivery_zone_id" uuid,
  "delivery_fee" numeric(12,2),
  "payment_method_id" uuid,
  "status" text,
  "notes" text,
  "estimated_delivery_at" timestamp with time zone,
  "delivered_at" timestamp with time zone,
  "created_at" timestamp with time zone,
  "updated_at" timestamp with time zone,
  "assigned_driver_id" uuid,
  "assigned_at" timestamp with time zone,
  "dispatched_at" timestamp with time zone
);

create table "public"."delivery_assignments" (
  "id" uuid not null,
  "company_id" uuid not null,
  "delivery_id" uuid,
  "order_id" uuid,
  "driver_id" uuid,
  "driver_name" text not null,
  "driver_whatsapp" text,
  "vehicle_plate" text,
  "delivery_code" text,
  "customer_name" text,
  "customer_phone" text,
  "address" text,
  "neighborhood" text,
  "map_url" text,
  "payment_method" text,
  "payment_status" text,
  "order_total" numeric(14,2) not null,
  "delivery_fee" numeric(14,2) not null,
  "status" text not null,
  "assigned_at" timestamp with time zone not null,
  "out_for_delivery_at" timestamp with time zone,
  "delivered_at" timestamp with time zone,
  "settlement_status" text not null,
  "settled_at" timestamp with time zone,
  "settlement_note" text,
  "created_by" uuid,
  "created_at" timestamp with time zone not null,
  "updated_at" timestamp with time zone not null
);

create table "public"."delivery_drivers" (
  "id" uuid not null,
  "company_id" uuid not null,
  "name" text not null,
  "whatsapp" text not null,
  "vehicle_plate" text,
  "notes" text,
  "is_active" boolean not null,
  "created_at" timestamp with time zone not null,
  "updated_at" timestamp with time zone not null
);

create table "public"."delivery_zones" (
  "id" uuid not null,
  "company_id" uuid,
  "name" text not null,
  "fee" numeric(10,2),
  "min_order" numeric(10,2),
  "active" boolean,
  "created_at" timestamp with time zone,
  "updated_at" timestamp with time zone,
  "is_active" boolean not null,
  "minimum_order" numeric(12,2),
  "estimated_time_min" integer,
  "estimated_time_max" integer,
  "notes" text
);

create table "public"."demo_data_registry" (
  "id" bigint generated always as identity (sequence name "public"."demo_data_registry_id_seq" start with 1 increment by 1 minvalue 1 maxvalue 9223372036854775807 cache 1 no cycle) not null,
  "company_id" uuid not null,
  "entity_type" text not null,
  "entity_id" text not null,
  "template_key" text,
  "created_at" timestamp with time zone not null
);

create table "public"."event_idempotency" (
  "id" uuid not null,
  "provider" text not null,
  "event_id" text not null,
  "company_id" uuid,
  "event_type" text,
  "payload_hash" text,
  "received_at" timestamp with time zone not null,
  "processed_at" timestamp with time zone,
  "status" text not null,
  "attempt" integer not null,
  "last_error" text,
  "metadata" jsonb not null
);

create table "public"."finance_accounts" (
  "id" uuid not null,
  "company_id" uuid not null,
  "nome" text not null,
  "tipo" text not null,
  "saldo_inicial" numeric not null,
  "ativo" boolean not null,
  "created_at" timestamp with time zone,
  "updated_at" timestamp with time zone not null
);

create table "public"."financial_categories" (
  "id" uuid not null,
  "company_id" uuid not null,
  "name" text not null,
  "type" text,
  "created_at" timestamp with time zone not null
);

create table "public"."financial_material_entries" (
  "id" uuid not null,
  "company_id" uuid not null,
  "transaction_id" uuid,
  "nome" text not null,
  "quantidade" numeric not null,
  "unidade" text,
  "valor_unitario" numeric,
  "valor_total" numeric,
  "codigo" text,
  "categoria" text,
  "fornecedor" text,
  "created_at" timestamp with time zone
);

create table "public"."financial_transactions" (
  "id" uuid not null,
  "company_id" uuid not null,
  "tipo" text not null,
  "categoria" text not null,
  "descricao" text not null,
  "valor" numeric not null,
  "data_competencia" date not null,
  "status" text not null,
  "forma_pagamento" text,
  "fornecedor_cliente" text,
  "documento_url" text,
  "documento_nome" text,
  "documento_tipo" text,
  "codigo_barras" text,
  "nota_chave" text,
  "nota_numero" text,
  "nota_serie" text,
  "nota_emitente" text,
  "nota_cnpj_emitente" text,
  "nota_data_emissao" text,
  "origem" text not null,
  "raw_data" jsonb not null,
  "created_by" uuid,
  "created_at" timestamp with time zone,
  "updated_at" timestamp with time zone,
  "vencimento" date,
  "observacoes" text,
  "centro_custo" text,
  "tags" text[],
  "recorrente" boolean,
  "recorrencia_grupo" uuid,
  "parcela_atual" integer,
  "parcelas_total" integer,
  "account_id" uuid,
  "type" text,
  "description" text,
  "amount" numeric(12,2),
  "category_id" uuid,
  "customer_id" uuid,
  "order_id" uuid,
  "proposal_id" uuid,
  "invoice_id" uuid,
  "payment_method" text,
  "due_date" date,
  "paid_at" timestamp with time zone,
  "notes" text,
  "customer_profile_id" uuid
);

create table "public"."founder_invites" (
  "id" uuid not null,
  "email" text not null,
  "email_normalized" text generated always as (lower(btrim(email))) stored,
  "founder_number" integer not null,
  "plan_key" text not null,
  "founder_price_cents" integer not null,
  "status" text not null,
  "token_hash" text not null,
  "token_expires_at" timestamp with time zone,
  "invited_at" timestamp with time zone not null,
  "activated_at" timestamp with time zone,
  "revoked_at" timestamp with time zone,
  "user_id" uuid,
  "company_id" uuid,
  "created_by_admin_id" uuid,
  "created_by_email" text not null,
  "created_at" timestamp with time zone not null,
  "updated_at" timestamp with time zone not null,
  "sales_lead_id" uuid,
  "token_rotated_at" timestamp with time zone,
  "revoked_by_admin_id" uuid,
  "revocation_reason" text,
  "activation_claim_id" uuid,
  "activation_claimed_at" timestamp with time zone,
  "activation_attempts" integer not null,
  "activation_last_error" text
);

create table "public"."integration_connections" (
  "id" uuid not null,
  "company_id" uuid not null,
  "provider" text not null,
  "status" text not null,
  "display_name" text,
  "external_account_id" text,
  "external_account_name" text,
  "capabilities" text[] not null,
  "config" jsonb not null,
  "credentials_reference" uuid,
  "connected_by" uuid,
  "connected_at" timestamp with time zone,
  "last_sync_at" timestamp with time zone,
  "last_success_at" timestamp with time zone,
  "last_error_code" text,
  "last_error_at" timestamp with time zone,
  "created_at" timestamp with time zone not null,
  "updated_at" timestamp with time zone not null,
  "refresh_locked_at" timestamp with time zone,
  "refresh_lock_id" uuid
);

create table "public"."integration_mappings" (
  "id" uuid not null,
  "company_id" uuid not null,
  "connection_id" uuid not null,
  "entity_type" text not null,
  "orcaly_entity_id" text,
  "external_id" text not null,
  "external_version" text,
  "metadata" jsonb not null,
  "created_at" timestamp with time zone not null,
  "updated_at" timestamp with time zone not null
);

create table "public"."integration_oauth_states" (
  "id" uuid not null,
  "company_id" uuid not null,
  "user_id" uuid not null,
  "provider" text not null,
  "nonce_hash" text not null,
  "expires_at" timestamp with time zone not null,
  "consumed_at" timestamp with time zone,
  "created_at" timestamp with time zone not null,
  "requested_scopes" text[] not null,
  "pkce_reference" uuid
);

create table "public"."integration_push_channels" (
  "id" uuid not null,
  "company_id" uuid not null,
  "connection_id" uuid not null,
  "provider" text not null,
  "resource_type" text not null,
  "channel_id" text not null,
  "resource_id" text not null,
  "resource_uri" text,
  "token_hash" text not null,
  "expires_at" timestamp with time zone,
  "state" text not null,
  "metadata" jsonb not null,
  "created_at" timestamp with time zone not null,
  "updated_at" timestamp with time zone not null
);

create table "public"."integration_sync_cursors" (
  "connection_id" uuid not null,
  "cursor_key" text not null,
  "cursor_value" text,
  "checkpoint" jsonb not null,
  "updated_at" timestamp with time zone not null
);

create table "public"."integration_usage_daily" (
  "company_id" uuid not null,
  "provider" text not null,
  "metric" text not null,
  "usage_day" date not null,
  "quantity" bigint not null,
  "metadata" jsonb not null,
  "updated_at" timestamp with time zone not null
);

create table "public"."internal_tasks" (
  "id" uuid not null,
  "company_id" uuid not null,
  "titulo" text not null,
  "descricao" text,
  "status" text not null,
  "prioridade" text not null,
  "due_at" timestamp with time zone,
  "responsavel_id" uuid,
  "created_by" uuid,
  "crm_lead_id" uuid,
  "order_id" uuid,
  "proposal_id" uuid,
  "completed_at" timestamp with time zone,
  "created_at" timestamp with time zone not null,
  "updated_at" timestamp with time zone not null
);

create table "public"."marketplace_commission_rules" (
  "id" uuid not null,
  "company_id" uuid,
  "plan_key" text,
  "commission_percentage" numeric(5,2) not null,
  "commission_fixed" numeric(12,2) not null,
  "is_active" boolean not null,
  "created_at" timestamp with time zone,
  "updated_at" timestamp with time zone
);

create table "public"."marketplace_commissions" (
  "id" uuid not null,
  "company_id" uuid not null,
  "order_id" uuid,
  "marketplace_payment_id" uuid,
  "provider" text not null,
  "gross_amount" numeric(12,2) not null,
  "commission_percentage" numeric(5,2) not null,
  "commission_fixed" numeric(12,2) not null,
  "commission_amount" numeric(12,2) not null,
  "status" text not null,
  "confirmed_at" timestamp with time zone,
  "created_at" timestamp with time zone,
  "updated_at" timestamp with time zone,
  "provider_split_id" text,
  "calculation_base" text,
  "fee_percent" numeric(8,4),
  "estimated_amount" numeric(14,2),
  "confirmed_amount" numeric(14,2),
  "refusal_reason" text,
  "external_reference" text
);

create table "public"."marketplace_coupons" (
  "id" uuid not null,
  "company_id" uuid not null,
  "codigo" text not null,
  "codigo_normalizado" text not null,
  "descricao" text,
  "tipo" text not null,
  "valor" numeric not null,
  "valor_minimo_pedido" numeric not null,
  "valor_maximo_desconto" numeric,
  "starts_at" timestamp with time zone,
  "ends_at" timestamp with time zone,
  "usage_limit" integer,
  "used_count" integer not null,
  "ativo" boolean not null,
  "created_at" timestamp with time zone not null,
  "updated_at" timestamp with time zone not null,
  "coupon_type" text,
  "free_delivery" boolean not null,
  "allowed_product_ids" jsonb not null,
  "allowed_categories" jsonb not null
);

create table "public"."marketplace_oauth_states" (
  "id" uuid not null,
  "company_id" uuid not null,
  "user_id" uuid,
  "provider" text not null,
  "state_hash" text not null,
  "expires_at" timestamp with time zone not null,
  "consumed_at" timestamp with time zone,
  "created_at" timestamp with time zone
);

create table "public"."marketplace_payment_settings" (
  "id" uuid not null,
  "company_id" uuid not null,
  "provider" text not null,
  "provider_user_id" text,
  "provider_account_id" text,
  "access_token" text,
  "refresh_token" text,
  "public_key" text,
  "token_expires_at" timestamp with time zone,
  "onboarding_status" text not null,
  "is_active" boolean not null,
  "last_error" text,
  "created_at" timestamp with time zone,
  "updated_at" timestamp with time zone,
  "provider_wallet_id" text,
  "encrypted_provider_api_key" text,
  "encrypted_webhook_auth_token" text,
  "account_status" text,
  "charges_enabled" boolean,
  "payouts_enabled" boolean,
  "pix_enabled" boolean,
  "card_enabled" boolean,
  "onboarding_url" text,
  "last_status_check_at" timestamp with time zone,
  "provider_metadata_sanitized" jsonb,
  "legal_name" text,
  "document_last4" text,
  "bank_name" text,
  "bank_account_last4" text,
  "bank_account_type" text,
  "payout_pix_key_encrypted" text,
  "payout_pix_key_type" text,
  "payout_pix_key_masked" text,
  "payout_pix_owner_name" text,
  "payout_pix_owner_document_masked" text,
  "automatic_payout_enabled" boolean not null,
  "minimum_payout_amount" numeric(12,2) not null,
  "last_payout_at" timestamp with time zone
);

create table "public"."marketplace_payments" (
  "id" uuid not null,
  "company_id" uuid not null,
  "order_id" uuid,
  "provider" text not null,
  "provider_preference_id" text,
  "provider_payment_id" text,
  "provider_status" text,
  "status" text not null,
  "checkout_url" text,
  "sandbox_checkout_url" text,
  "amount" numeric(12,2) not null,
  "subtotal" numeric(12,2) not null,
  "delivery_fee" numeric(12,2) not null,
  "discount_amount" numeric(12,2) not null,
  "commission_amount" numeric(12,2) not null,
  "commission_percentage" numeric(5,2) not null,
  "currency" text not null,
  "payer_name" text,
  "payer_email" text,
  "payer_phone" text,
  "last_error" text,
  "raw_payload" jsonb,
  "paid_at" timestamp with time zone,
  "created_at" timestamp with time zone,
  "updated_at" timestamp with time zone,
  "provider_customer_id" text,
  "payment_method" text,
  "gross_amount" numeric(14,2),
  "provider_fee_amount" numeric(14,2),
  "provider_net_amount" numeric(14,2),
  "platform_fee_percent" numeric(8,4),
  "platform_fee_amount" numeric(14,2),
  "seller_net_amount" numeric(14,2),
  "split_status" text,
  "payout_status" text,
  "idempotency_key" text,
  "external_reference" text,
  "expires_at" timestamp with time zone,
  "card_brand" text,
  "card_last4" text,
  "error_message" text,
  "stock_reservation_status" text,
  "stock_reserved_at" timestamp with time zone,
  "stock_confirmed_at" timestamp with time zone,
  "stock_released_at" timestamp with time zone
);

create table "public"."marketplace_stock_reservations" (
  "id" uuid not null,
  "company_id" uuid not null,
  "order_id" uuid not null,
  "marketplace_payment_id" uuid not null,
  "product_id" uuid not null,
  "quantity" integer not null,
  "status" text not null,
  "stock_before" integer not null,
  "stock_after" integer not null,
  "expires_at" timestamp with time zone not null,
  "confirmed_at" timestamp with time zone,
  "released_at" timestamp with time zone,
  "release_reason" text,
  "created_at" timestamp with time zone not null,
  "updated_at" timestamp with time zone not null
);

create table "public"."notifications" (
  "id" uuid not null,
  "company_id" uuid,
  "user_id" uuid,
  "type" text not null,
  "title" text not null,
  "message" text,
  "link" text,
  "priority" text,
  "read_at" timestamp with time zone,
  "metadata" jsonb,
  "created_at" timestamp with time zone
);

create table "public"."order_internal_comments" (
  "id" uuid not null,
  "company_id" uuid not null,
  "order_id" uuid not null,
  "user_id" uuid,
  "comentario" text not null,
  "created_at" timestamp with time zone not null
);

create table "public"."order_items" (
  "id" uuid not null,
  "order_id" uuid,
  "company_id" uuid,
  "product_id" uuid,
  "nome" text not null,
  "tipo" text,
  "unidade" text,
  "quantidade" numeric,
  "preco_unitario" numeric,
  "subtotal" numeric,
  "created_at" timestamp with time zone,
  "largura" numeric,
  "altura" numeric,
  "comprimento" numeric,
  "area_m2" numeric,
  "precificacao" text,
  "detalhes_calculo" text,
  "respostas" jsonb,
  "product_name" text,
  "quantity" integer,
  "unit_price" numeric(12,2),
  "addons" jsonb,
  "variation" jsonb,
  "notes" text,
  "total" numeric(14,2),
  "variation_json" jsonb,
  "addons_json" jsonb,
  "observation" text
);

create table "public"."order_payments" (
  "id" uuid not null,
  "company_id" uuid,
  "order_id" uuid,
  "payment_method_id" uuid,
  "type" text,
  "status" text,
  "amount" numeric(12,2) not null,
  "paid_amount" numeric(12,2),
  "remaining_amount" numeric(12,2),
  "provider" text,
  "provider_payment_id" text,
  "proof_url" text,
  "notes" text,
  "created_at" timestamp with time zone,
  "updated_at" timestamp with time zone,
  "provider_status" text,
  "idempotency_key" text,
  "external_reference" text,
  "paid_at" timestamp with time zone
);

create table "public"."order_status_history" (
  "id" uuid not null,
  "company_id" uuid not null,
  "order_id" uuid not null,
  "old_status" text,
  "new_status" text not null,
  "changed_by" uuid,
  "note" text,
  "created_at" timestamp with time zone not null,
  "changed_by_email" text
);

create table "public"."orders" (
  "id" uuid not null,
  "nome" text not null,
  "telefone" text not null,
  "produto" text not null,
  "largura" numeric,
  "altura" numeric,
  "quantidade" integer,
  "observacoes" text,
  "status" text,
  "preco_estimado" numeric,
  "created_at" timestamp with time zone,
  "arquivo_url" text,
  "company_id" uuid,
  "valor_total" numeric,
  "valor_sinal" numeric,
  "percentual_sinal" numeric,
  "forma_pagamento" text,
  "parcelas" integer,
  "itens_resumo" text,
  "cliente_empresa" text,
  "dados_inteligentes" jsonb,
  "marketplace_origem" text,
  "prazo" text,
  "priority" text,
  "internal_notes" text,
  "files" jsonb,
  "source" text,
  "original_order_id" uuid,
  "customer_portal_token" text,
  "cupom_id" uuid,
  "cupom_codigo" text,
  "valor_desconto" numeric,
  "valor_total_original" numeric,
  "prioridade" text,
  "prazo_entrega" timestamp with time zone,
  "responsavel_id" uuid,
  "canal_origem" text,
  "endereco_entrega" text,
  "observacoes_internas" text,
  "aprovado_em" timestamp with time zone,
  "entregue_em" timestamp with time zone,
  "cancelado_em" timestamp with time zone,
  "updated_at" timestamp with time zone,
  "responsavel_nome" text,
  "whatsapp_owner_notified_at" timestamp with time zone,
  "whatsapp_client_created_notified_at" timestamp with time zone,
  "whatsapp_last_status_notified" text,
  "whatsapp_last_status_notified_at" timestamp with time zone,
  "visualizado_em" timestamp with time zone,
  "notificado_em" timestamp with time zone,
  "delivery_type" text,
  "delivery_fee" numeric(12,2),
  "subtotal" numeric(12,2),
  "total_amount" numeric(12,2),
  "payment_method_id" uuid,
  "payment_status" text,
  "delivery_zone_id" uuid,
  "address" text,
  "neighborhood" text,
  "complement" text,
  "reference_point" text,
  "change_for" numeric(12,2),
  "items_snapshot" jsonb,
  "discount_amount" numeric(12,2),
  "coupon_code" text,
  "payment_provider" text,
  "marketplace_payment_id" uuid,
  "paid_at" timestamp with time zone,
  "customer_name" text,
  "customer_email" text,
  "customer_phone" text,
  "total" numeric(14,2),
  "payment_method" text,
  "coupon_id" uuid,
  "checkout_idempotency_key" text,
  "coupon_consumed_at" timestamp with time zone,
  "customer_profile_id" uuid,
  "created_by" uuid,
  "updated_by" uuid,
  "source_id" text
);

create table "public"."payment_methods" (
  "id" uuid not null,
  "company_id" uuid,
  "name" text not null,
  "type" text not null,
  "is_active" boolean,
  "requires_change" boolean,
  "allow_delivery_payment" boolean,
  "allow_online_payment" boolean,
  "instructions" text,
  "created_at" timestamp with time zone,
  "updated_at" timestamp with time zone
);

create table "public"."payment_payouts" (
  "id" uuid not null,
  "company_id" uuid not null,
  "marketplace_payment_id" uuid,
  "provider" text not null,
  "provider_payout_id" text,
  "amount" numeric(14,2) not null,
  "status" text not null,
  "expected_at" timestamp with time zone,
  "paid_at" timestamp with time zone,
  "failure_reason" text,
  "created_at" timestamp with time zone not null,
  "updated_at" timestamp with time zone not null,
  "external_reference" text,
  "pix_key_type" text,
  "pix_key_masked" text,
  "attempts" integer not null
);

create table "public"."payment_webhook_events" (
  "id" uuid not null,
  "provider" text not null,
  "provider_event_id" text not null,
  "event_type" text not null,
  "provider_object_id" text,
  "company_id" uuid,
  "payload_hash" text not null,
  "payload_sanitized" jsonb not null,
  "processing_status" text not null,
  "attempts" integer not null,
  "received_at" timestamp with time zone not null,
  "processed_at" timestamp with time zone,
  "error_message" text
);

create table "public"."plan_payments" (
  "id" uuid not null,
  "company_id" uuid,
  "plano" text not null,
  "valor" numeric not null,
  "status" text,
  "email" text,
  "nome_empresa" text,
  "mercado_pago_preference_id" text,
  "mercado_pago_payment_id" text,
  "checkout_url" text,
  "raw_webhook" jsonb,
  "raw_payment" jsonb,
  "created_at" timestamp with time zone,
  "paid_at" timestamp with time zone,
  "tipo" text,
  "mercado_pago_preapproval_id" text,
  "mercado_pago_authorized_payment_id" text,
  "raw_subscription" jsonb,
  "raw_authorized_payment" jsonb,
  "next_payment_date" timestamp with time zone,
  "cancelled_at" timestamp with time zone,
  "updated_at" timestamp with time zone,
  "payment_method" text,
  "provider" text,
  "provider_customer_id" text,
  "provider_payment_id" text,
  "provider_subscription_id" text,
  "billing_type" text,
  "external_reference" text,
  "idempotency_key" text
);

create table "public"."platform_admin_invites" (
  "id" uuid not null,
  "email" text not null,
  "email_normalized" text generated always as (lower(btrim(email))) stored,
  "nome" text not null,
  "role" text not null,
  "area" text not null,
  "permissions" jsonb not null,
  "observacoes" text,
  "token_hash" text not null,
  "status" text not null,
  "expires_at" timestamp with time zone not null,
  "invited_at" timestamp with time zone not null,
  "claimed_at" timestamp with time zone,
  "activation_claim_id" uuid,
  "activated_at" timestamp with time zone,
  "revoked_at" timestamp with time zone,
  "user_id" uuid,
  "platform_admin_id" uuid,
  "created_by_admin_id" uuid,
  "created_by_email" text not null,
  "last_token_rotated_at" timestamp with time zone,
  "created_at" timestamp with time zone not null,
  "updated_at" timestamp with time zone not null
);

create table "public"."platform_admins" (
  "id" uuid not null,
  "user_id" uuid,
  "email" text not null,
  "role" text not null,
  "is_active" boolean,
  "created_at" timestamp with time zone,
  "updated_at" timestamp with time zone,
  "nome" text,
  "permissions" jsonb not null,
  "area" text not null,
  "observacoes" text,
  "created_by" text,
  "last_login_at" timestamp with time zone,
  "must_change_password" boolean not null
);

create table "public"."platform_feature_flags" (
  "id" uuid not null,
  "key" text not null,
  "description" text,
  "enabled" boolean not null,
  "scope" text not null,
  "scope_value" text not null,
  "config" jsonb not null,
  "created_by" text,
  "updated_by" text,
  "created_at" timestamp with time zone not null,
  "updated_at" timestamp with time zone not null
);

create table "public"."platform_support_ticket_events" (
  "id" uuid not null,
  "ticket_id" uuid not null,
  "admin_id" uuid,
  "event_type" text not null,
  "message" text,
  "from_status" text,
  "to_status" text,
  "metadata" jsonb not null,
  "created_at" timestamp with time zone not null
);

create table "public"."platform_support_tickets" (
  "id" uuid not null,
  "company_id" uuid,
  "user_id" uuid,
  "subject" text not null,
  "category" text not null,
  "priority" text not null,
  "description" text not null,
  "attachments" jsonb not null,
  "status" text not null,
  "assignee_admin_id" uuid,
  "created_by" text,
  "first_response_at" timestamp with time zone,
  "resolved_at" timestamp with time zone,
  "closed_at" timestamp with time zone,
  "metadata" jsonb not null,
  "created_at" timestamp with time zone not null,
  "updated_at" timestamp with time zone not null
);

create table "public"."product_analytics_events" (
  "id" bigint generated always as identity (sequence name "public"."product_analytics_events_id_seq" start with 1 increment by 1 minvalue 1 maxvalue 9223372036854775807 cache 1 no cycle) not null,
  "company_id" uuid,
  "user_id" uuid,
  "session_id" text,
  "event_name" text not null,
  "source" text not null,
  "occurred_at" timestamp with time zone not null,
  "metadata" jsonb not null
);

create table "public"."product_stock_movements" (
  "id" uuid not null,
  "company_id" uuid not null,
  "product_id" uuid not null,
  "order_id" uuid,
  "marketplace_payment_id" uuid,
  "reservation_id" uuid,
  "movement_type" text not null,
  "quantity_delta" integer not null,
  "stock_before" integer not null,
  "stock_after" integer not null,
  "reason" text,
  "metadata" jsonb not null,
  "idempotency_key" text not null,
  "created_at" timestamp with time zone not null
);

create table "public"."production_orders" (
  "id" uuid not null,
  "company_id" uuid not null,
  "proposal_id" uuid,
  "order_id" uuid,
  "title" text not null,
  "customer_name" text,
  "customer_whatsapp" text,
  "total_value" numeric,
  "signal_value" numeric,
  "status" text,
  "priority" text,
  "due_date" timestamp with time zone,
  "started_at" timestamp with time zone,
  "completed_at" timestamp with time zone,
  "metadata" jsonb,
  "created_at" timestamp with time zone,
  "updated_at" timestamp with time zone,
  "responsible_user_id" uuid,
  "responsible_name" text,
  "files" jsonb,
  "internal_notes" text,
  "created_by" uuid
);

create table "public"."production_steps" (
  "id" uuid not null,
  "production_order_id" uuid not null,
  "company_id" uuid not null,
  "title" text not null,
  "description" text,
  "status" text,
  "sort_order" integer,
  "assigned_to" uuid,
  "due_date" timestamp with time zone,
  "started_at" timestamp with time zone,
  "completed_at" timestamp with time zone,
  "completed_by" uuid,
  "metadata" jsonb,
  "created_at" timestamp with time zone,
  "updated_at" timestamp with time zone
);

create table "public"."products" (
  "id" uuid not null,
  "nome" text not null,
  "preco" numeric not null,
  "ativo" boolean,
  "created_at" timestamp with time zone,
  "imagem_url" text,
  "company_id" uuid,
  "descricao" text,
  "categoria" text,
  "tipo" text,
  "unidade" text,
  "destaque" boolean,
  "precificacao" text,
  "unidade_label" text,
  "permite_largura" boolean,
  "permite_altura" boolean,
  "permite_comprimento" boolean,
  "permite_quantidade" boolean,
  "valor_minimo" numeric,
  "cobrar_sinal_personalizado" boolean,
  "percentual_sinal_produto" numeric,
  "configuracoes" jsonb,
  "image_urls" text[],
  "variacoes" text,
  "prazo_medio" text,
  "arquivado" boolean,
  "deleted_at" timestamp with time zone,
  "updated_at" timestamp with time zone,
  "custo_material" numeric,
  "custo_mao_obra" numeric,
  "custo_taxas" numeric,
  "custo_entrega" numeric,
  "margem_desejada" numeric,
  "preco_minimo" numeric,
  "preco_sugerido" numeric,
  "margem_estimada" numeric,
  "archived" boolean,
  "video_url" text,
  "subcategoria" text,
  "preco_sob_consulta" boolean,
  "estoque" integer,
  "promocao_ativa" boolean,
  "preco_promocional" numeric,
  "campos_orcamento" jsonb,
  "descricao_curta" text,
  "descricao_detalhada" text,
  "unidade_preco" text,
  "sku" text,
  "oculto" boolean,
  "adicionais" jsonb,
  "foto_url" text,
  "business_type" text,
  "extras" jsonb,
  "variations" jsonb,
  "addons" jsonb,
  "available" boolean,
  "is_active" boolean not null,
  "created_by" uuid,
  "updated_by" uuid,
  "source" text,
  "source_id" text
);

create table "public"."proposal_events" (
  "id" uuid not null,
  "proposal_id" uuid,
  "company_id" uuid,
  "event_type" text not null,
  "actor_type" text,
  "actor_name" text,
  "actor_email" text,
  "note" text,
  "metadata" jsonb,
  "ip" text,
  "user_agent" text,
  "created_at" timestamp with time zone
);

create table "public"."proposals" (
  "id" uuid not null,
  "company_id" uuid,
  "order_id" uuid,
  "token" text not null,
  "titulo" text,
  "cliente_nome" text,
  "cliente_whatsapp" text,
  "itens" jsonb not null,
  "valor_total" numeric,
  "valor_sinal" numeric,
  "prazo" text,
  "condicoes" text,
  "status" text,
  "payment_url" text,
  "raw_data" jsonb,
  "created_at" timestamp with time zone,
  "approved_at" timestamp with time zone,
  "cliente_email" text,
  "valor_desconto" numeric,
  "percentual_sinal" numeric,
  "introducao" text,
  "validade_dias" integer,
  "valid_until" timestamp with time zone,
  "pix_payload" text,
  "pix_txid" text,
  "pix_valor" numeric,
  "sent_at" timestamp with time zone,
  "viewed_at" timestamp with time zone,
  "rejected_at" timestamp with time zone,
  "change_requested_at" timestamp with time zone,
  "expired_at" timestamp with time zone,
  "approval_name" text,
  "approval_document" text,
  "approval_note" text,
  "rejection_reason" text,
  "client_ip" text,
  "user_agent" text,
  "accepted_terms" boolean,
  "approval_hash" text,
  "proposta_numero" text,
  "version" integer,
  "updated_at" timestamp with time zone,
  "production_order_id" uuid,
  "signature_signed_at" timestamp with time zone,
  "prazo_producao" text,
  "prazo_entrega" text,
  "condicao_pagamento" text,
  "payment_terms" text,
  "imagem_url" text,
  "capa_url" text,
  "preview_url" text,
  "descricao" text,
  "resumo" text,
  "margem_percentual" numeric,
  "sinal_pago" boolean,
  "view_count" integer,
  "last_viewed_at" timestamp with time zone,
  "origem" text,
  "customer_profile_id" uuid,
  "created_by" uuid,
  "updated_by" uuid,
  "source_id" text
);

create table "public"."provider_customers" (
  "id" uuid not null,
  "company_id" uuid not null,
  "customer_id" text,
  "provider" text not null,
  "provider_customer_id" text not null,
  "document_hash" text,
  "created_at" timestamp with time zone not null,
  "updated_at" timestamp with time zone not null
);

create table "public"."quote_templates" (
  "id" uuid not null,
  "company_id" uuid,
  "nome" text not null,
  "tipo" text not null,
  "perguntas" jsonb not null,
  "ativo" boolean,
  "created_at" timestamp with time zone,
  "updated_at" timestamp with time zone
);

create table "public"."recurring_orders" (
  "id" uuid not null,
  "company_id" uuid not null,
  "original_order_id" uuid,
  "customer_name" text,
  "customer_phone" text,
  "title" text,
  "frequency" text,
  "next_due_at" timestamp with time zone,
  "last_repeated_at" timestamp with time zone,
  "status" text not null,
  "notes" text,
  "created_by" uuid,
  "created_at" timestamp with time zone not null
);

create table "public"."security_blocklist" (
  "id" uuid not null,
  "type" text not null,
  "value" text not null,
  "reason" text,
  "active" boolean not null,
  "created_by" text,
  "created_at" timestamp with time zone
);

create table "public"."security_events" (
  "id" uuid not null,
  "company_id" uuid,
  "actor_user_id" uuid,
  "event_type" text not null,
  "metadata" jsonb not null,
  "created_at" timestamp with time zone,
  "severity" text not null,
  "source" text not null,
  "path" text,
  "method" text,
  "ip" text,
  "user_agent" text,
  "user_email" text,
  "description" text,
  "resolved" boolean not null,
  "resolved_at" timestamp with time zone,
  "resolved_by" text
);

create table "public"."signup_lead_followups" (
  "id" uuid not null,
  "lead_id" uuid not null,
  "channel" text not null,
  "status" text not null,
  "message" text,
  "scheduled_for" timestamp with time zone,
  "sent_at" timestamp with time zone,
  "admin_email" text,
  "raw_data" jsonb not null,
  "created_at" timestamp with time zone,
  "created_by_admin_id" uuid,
  "sales_event_type" text not null
);

create table "public"."signup_leads" (
  "id" uuid not null,
  "nome_responsavel" text,
  "email" text not null,
  "whatsapp" text,
  "empresa_nome" text not null,
  "slug_sugerido" text,
  "segmento" text,
  "modelo_negocio" text,
  "cidade" text,
  "estado" text,
  "plano" text not null,
  "status" text not null,
  "marketing_opt_in" boolean not null,
  "marketing_opt_in_text" text,
  "lead_source" text not null,
  "checkout_url" text,
  "mercado_pago_preference_id" text,
  "mercado_pago_payment_id" text,
  "payment_status" text,
  "paid_at" timestamp with time zone,
  "followup_count" integer not null,
  "last_followup_at" timestamp with time zone,
  "next_followup_at" timestamp with time zone,
  "converted_user_id" uuid,
  "converted_company_id" uuid,
  "raw_data" jsonb not null,
  "created_at" timestamp with time zone,
  "updated_at" timestamp with time zone,
  "referral_code" text,
  "affiliate_referral_id" uuid,
  "sales_stage" text not null,
  "assigned_to_admin_id" uuid,
  "created_by_admin_id" uuid,
  "sales_notes" text,
  "sales_stage_updated_at" timestamp with time zone not null,
  "sales_last_contact_at" timestamp with time zone,
  "sales_next_action_at" timestamp with time zone,
  "sales_lost_reason" text
);

create table "public"."site_sections" (
  "id" uuid not null,
  "company_id" uuid not null,
  "type" text not null,
  "title" text,
  "subtitle" text,
  "content" text,
  "image_url" text,
  "button_label" text,
  "button_url" text,
  "sort_order" integer not null,
  "active" boolean not null,
  "locked" boolean not null,
  "config" jsonb not null,
  "created_at" timestamp with time zone,
  "updated_at" timestamp with time zone
);

create table "public"."site_template_presets" (
  "id" text not null,
  "name" text not null,
  "segment" text not null,
  "description" text,
  "payload" jsonb not null,
  "is_active" boolean not null,
  "created_at" timestamp with time zone not null
);

create table "public"."smart_notification_events" (
  "id" uuid not null,
  "company_id" uuid not null,
  "event_key" text not null,
  "event_type" text not null,
  "entity" text,
  "entity_id" text,
  "created_at" timestamp with time zone not null,
  "resolved_at" timestamp with time zone
);

create table "public"."smart_notification_settings" (
  "company_id" uuid not null,
  "new_order_enabled" boolean not null,
  "order_stuck_enabled" boolean not null,
  "order_stuck_days" integer not null,
  "task_due_today_enabled" boolean not null,
  "lead_idle_enabled" boolean not null,
  "lead_idle_days" integer not null,
  "proposal_idle_enabled" boolean not null,
  "proposal_idle_days" integer not null,
  "coupon_expiring_enabled" boolean not null,
  "coupon_expiring_days" integer not null,
  "product_without_image_enabled" boolean not null,
  "site_without_logo_enabled" boolean not null,
  "subscription_expiring_enabled" boolean not null,
  "subscription_expiring_days" integer not null,
  "created_at" timestamp with time zone not null,
  "updated_at" timestamp with time zone not null
);

create table "public"."subscription_events" (
  "id" uuid not null,
  "company_id" uuid not null,
  "event_type" text not null,
  "old_status" text,
  "new_status" text,
  "provider" text not null,
  "provider_reference" text,
  "metadata" jsonb not null,
  "created_at" timestamp with time zone not null,
  "provider_event_id" text,
  "provider_object_id" text,
  "payload_hash" text,
  "processing_status" text,
  "processed_at" timestamp with time zone,
  "error_message" text
);

create table "public"."system_audit_logs" (
  "id" uuid not null,
  "company_id" uuid,
  "user_id" uuid,
  "action" text not null,
  "entity" text,
  "entity_id" text,
  "details" jsonb not null,
  "ip" text,
  "user_agent" text,
  "created_at" timestamp with time zone not null
);

create table "public"."timeline_events" (
  "id" uuid not null,
  "company_id" uuid not null,
  "customer_profile_id" uuid,
  "aggregate_type" text not null,
  "aggregate_id" uuid,
  "event_type" text not null,
  "title" text not null,
  "detail" text,
  "source" text not null,
  "source_id" text,
  "actor_id" uuid,
  "occurred_at" timestamp with time zone not null,
  "metadata" jsonb not null
);

create table "public"."transactional_outbox" (
  "id" uuid not null,
  "company_id" uuid,
  "event_type" text not null,
  "aggregate_type" text not null,
  "aggregate_id" uuid,
  "payload" jsonb not null,
  "status" text not null,
  "attempts" integer not null,
  "max_attempts" integer not null,
  "available_at" timestamp with time zone not null,
  "created_at" timestamp with time zone not null,
  "processed_at" timestamp with time zone,
  "last_error" text
);

create table "public"."whatsapp_connections" (
  "id" uuid not null,
  "company_id" uuid not null,
  "provider" text not null,
  "status" text not null,
  "waba_id" text,
  "phone_number_id" text,
  "display_phone_number" text,
  "business_name" text,
  "access_token_ciphertext" text,
  "token_expires_at" timestamp with time zone,
  "metadata" jsonb not null,
  "connected_at" timestamp with time zone,
  "last_verified_at" timestamp with time zone,
  "created_at" timestamp with time zone not null,
  "updated_at" timestamp with time zone not null
);

create table "public"."whatsapp_conversations" (
  "id" uuid not null,
  "company_id" uuid,
  "phone" text not null,
  "customer_name" text,
  "last_inbound_at" timestamp with time zone,
  "last_outbound_at" timestamp with time zone,
  "last_message" text,
  "ai_enabled" boolean not null,
  "metadata" jsonb not null,
  "created_at" timestamp with time zone not null,
  "updated_at" timestamp with time zone not null
);

create table "public"."whatsapp_message_logs" (
  "id" uuid not null,
  "company_id" uuid,
  "order_id" uuid,
  "proposal_id" uuid,
  "direction" text not null,
  "event_type" text,
  "to_phone" text,
  "from_phone" text,
  "message_type" text not null,
  "content" text,
  "status" text not null,
  "meta_message_id" text,
  "raw_payload" jsonb,
  "raw_response" jsonb,
  "error" text,
  "created_at" timestamp with time zone not null,
  "conversation_id" uuid,
  "provider_timestamp" timestamp with time zone,
  "updated_at" timestamp with time zone not null
);

create table "public"."whatsapp_webhook_events" (
  "id" uuid not null,
  "company_id" uuid,
  "event_key" text not null,
  "event_type" text not null,
  "payload_hash" text,
  "processing_status" text not null,
  "received_at" timestamp with time zone not null,
  "processed_at" timestamp with time zone,
  "error_message" text
);

CREATE OR REPLACE FUNCTION orcaly_private.can_manage_company(p_company_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select exists (
    select 1
    from public.companies c
    where c.id = p_company_id
      and (c.owner_id = auth.uid() or c.tester_id = auth.uid())
  )
  or exists (
    select 1
    from public.company_members cm
    where cm.company_id = p_company_id
      and cm.user_id = auth.uid()
      and cm.status = 'ativo'
  )
  or orcaly_private.is_orcaly_admin();
$function$;

CREATE OR REPLACE FUNCTION orcaly_private.can_manage_storage_path(p_name text)
 RETURNS boolean
 LANGUAGE sql
 STABLE
 SET search_path TO ''
AS $function$
  select coalesce(
    orcaly_private.can_manage_company(
      orcaly_private.storage_path_company_id(p_name)
    ),
    false
  );
$function$;

CREATE OR REPLACE FUNCTION orcaly_private.check_company_member_limit()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  active_count integer;
begin
  if new.status = 'ativo' then
    select count(*)
    into active_count
    from public.company_members
    where company_id = new.company_id
      and status = 'ativo'
      and id is distinct from new.id;

    if active_count >= 2 then
      raise exception 'Limite de 2 funcionários ativos atingido para esta empresa.';
    end if;
  end if;

  new.email = lower(new.email);
  new.updated_at = now();

  return new;
end;
$function$;

CREATE OR REPLACE FUNCTION orcaly_private.create_default_site_for_company(p_company_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  c record;
  hero_title text;
  hero_subtitle text;
  services_title text;
  trust_title text;
begin
  select * into c from public.companies where id = p_company_id;

  if not found then
    return;
  end if;

  if exists (select 1 from public.site_sections where company_id = p_company_id) then
    return;
  end if;

  hero_title := 'Atendimento profissional para o seu pedido';
  hero_subtitle := 'Conheça produtos e serviços, envie sua solicitação e receba uma proposta organizada.';
  services_title := 'Produtos e serviços';
  trust_title := 'Por que escolher a nossa empresa?';

  if c.modelo_negocio = 'grafica' then
    hero_title := 'Impressos, personalizados e comunicação visual sob medida';
    hero_subtitle := 'Envie medidas, quantidades, acabamento e arte para receber uma proposta rápida.';
    services_title := 'Materiais gráficos e personalizados';
    trust_title := 'Qualidade visual, prazo e atendimento claro';

  elsif c.modelo_negocio = 'assistencia_tecnica' then
    hero_title := 'Assistência técnica com diagnóstico organizado';
    hero_subtitle := 'Informe aparelho, defeito e urgência para receber orientação com mais agilidade.';
    services_title := 'Serviços de assistência';
    trust_title := 'Diagnóstico, transparência e acompanhamento';

  elsif c.modelo_negocio = 'beleza_estetica' then
    hero_title := 'Serviços de beleza com atendimento profissional';
    hero_subtitle := 'Conheça os serviços, envie sua solicitação e receba atendimento pelo WhatsApp.';
    services_title := 'Serviços de beleza e estética';
    trust_title := 'Cuidado, pontualidade e resultado';

  elsif c.modelo_negocio = 'alimenticio' then
    hero_title := 'Encomendas e pedidos feitos do jeito certo';
    hero_subtitle := 'Escolha sabores, tamanhos, datas e detalhes para receber uma proposta sem bagunça.';
    services_title := 'Cardápio e encomendas';
    trust_title := 'Capricho, organização e sabor';

  elsif c.modelo_negocio = 'automotivo' then
    hero_title := 'Serviços automotivos com orçamento claro';
    hero_subtitle := 'Informe o veículo, serviço desejado e detalhes para receber uma proposta organizada.';
    services_title := 'Serviços automotivos';
    trust_title := 'Confiança, clareza e cuidado com seu veículo';

  elsif c.modelo_negocio = 'construcao_reformas' then
    hero_title := 'Orçamentos para obras, reformas e serviços técnicos';
    hero_subtitle := 'Envie medidas, fotos e detalhes do serviço para receber uma proposta mais precisa.';
    services_title := 'Obras, reformas e serviços';
    trust_title := 'Planejamento, transparência e execução';

  elsif c.modelo_negocio = 'eventos' then
    hero_title := 'Eventos organizados com proposta clara';
    hero_subtitle := 'Informe data, local, quantidade de pessoas e estilo do evento para receber uma proposta.';
    services_title := 'Pacotes, eventos e festas';
    trust_title := 'Organização, presença e atenção aos detalhes';

  elsif c.modelo_negocio = 'moda_varejo' then
    hero_title := 'Produtos, novidades e pedidos em um só lugar';
    hero_subtitle := 'Veja opções, escolha variações e envie seu pedido pelo WhatsApp.';
    services_title := 'Catálogo de produtos';
    trust_title := 'Atendimento rápido, vitrine clara e compra facilitada';

  elsif c.modelo_negocio = 'pet_shop' then
    hero_title := 'Cuidado para pets com atendimento organizado';
    hero_subtitle := 'Escolha serviços, informe dados do pet e solicite atendimento com praticidade.';
    services_title := 'Serviços e produtos pet';
    trust_title := 'Cuidado, carinho e organização';

  elsif c.modelo_negocio = 'educacao_cursos' then
    hero_title := 'Cursos e aulas com inscrição simplificada';
    hero_subtitle := 'Conheça turmas, modalidades e envie seu interesse para receber atendimento.';
    services_title := 'Cursos, aulas e treinamentos';
    trust_title := 'Aprendizado, clareza e acompanhamento';

  elsif c.modelo_negocio = 'consultoria' then
    hero_title := 'Consultoria com briefing claro desde o primeiro contato';
    hero_subtitle := 'Explique seu objetivo, prazo e necessidade para receber uma proposta consultiva.';
    services_title := 'Serviços profissionais';
    trust_title := 'Estratégia, clareza e solução sob medida';

  elsif c.modelo_negocio = 'fotografia_video' then
    hero_title := 'Fotografia e vídeo para registrar momentos e vender melhor';
    hero_subtitle := 'Informe data, local, estilo e pacote desejado para receber uma proposta.';
    services_title := 'Ensaios, eventos e produção visual';
    trust_title := 'Imagem profissional, sensibilidade e entrega';

  elsif c.modelo_negocio = 'saude_bem_estar' then
    hero_title := 'Atendimento de saúde e bem-estar com cuidado';
    hero_subtitle := 'Conheça serviços e envie sua solicitação de forma simples e organizada.';
    services_title := 'Serviços de cuidado e bem-estar';
    trust_title := 'Acolhimento, organização e confiança';

  elsif c.modelo_negocio = 'tecnologia' then
    hero_title := 'Soluções digitais com escopo mais claro';
    hero_subtitle := 'Explique seu projeto, objetivo e prazo para receber uma proposta organizada.';
    services_title := 'Tecnologia, digital e automações';
    trust_title := 'Clareza, processo e entrega profissional';

  elsif c.modelo_negocio = 'servicos_gerais' then
    hero_title := 'Serviços sob orçamento com atendimento direto';
    hero_subtitle := 'Informe o serviço, local, prazo e detalhes para receber uma proposta.';
    services_title := 'Serviços disponíveis';
    trust_title := 'Agilidade, clareza e atendimento local';
  end if;

  insert into public.site_sections
    (company_id, type, title, subtitle, content, button_label, button_url, sort_order, active, locked, config)
  values
    (p_company_id, 'hero', hero_title, hero_subtitle, 'Site profissional criado automaticamente pelo Orçaly para apresentar a empresa e receber solicitações.', 'Fazer solicitação', '#pedido', 1, true, false, '{"layout":"premium"}'::jsonb),
    (p_company_id, 'services', services_title, 'Veja opções disponíveis e envie uma solicitação personalizada.', 'Os itens do catálogo aparecem com destaque para facilitar pedidos.', 'Ver serviços', '#servicos', 2, true, false, '{"source":"products"}'::jsonb),
    (p_company_id, 'trust', trust_title, 'Atendimento pensado para reduzir dúvidas e organizar cada solicitação.', 'Pedido estruturado, proposta profissional e contato direto pelo WhatsApp.', null, null, 3, true, false, '{"items":["Atendimento pelo WhatsApp","Pedido organizado","Proposta profissional"]}'::jsonb),
    (p_company_id, 'about', 'Sobre nós', coalesce(c.nome, 'Nossa empresa'), 'Conte aqui a história, diferenciais e forma de atendimento da empresa. Esse texto pode ser editado no painel.', null, null, 4, true, false, '{}'::jsonb),
    (p_company_id, 'cta', 'Pronto para fazer seu pedido?', 'Envie sua solicitação agora e receba atendimento pelo WhatsApp.', 'Use o formulário inteligente para mandar as informações certas desde o primeiro contato.', 'Começar pedido', '#pedido', 5, true, false, '{}'::jsonb);
end;
$function$;

CREATE OR REPLACE FUNCTION orcaly_private.is_company_member(p_company_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select exists (
    select 1
    from public.company_members cm
    where cm.company_id = p_company_id
      and cm.user_id = auth.uid()
      and cm.status = 'ativo'
  );
$function$;

CREATE OR REPLACE FUNCTION orcaly_private.is_company_owner(p_company_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select exists (
    select 1
    from public.companies c
    where c.id = p_company_id
      and (
        c.owner_id = auth.uid()
        or c.tester_id = auth.uid()
      )
  );
$function$;

CREATE OR REPLACE FUNCTION orcaly_private.is_orcaly_admin()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select exists (
    select 1
    from public.platform_admins p
    where p.is_active = true
      and p.user_id = auth.uid()
      and lower(p.role) in ('owner','super_admin','admin','support','suporte')
  );
$function$;

CREATE OR REPLACE FUNCTION orcaly_private.is_orcaly_super_admin()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select exists (
    select 1
    from public.platform_admins p
    where p.is_active = true
      and p.user_id = auth.uid()
      and lower(p.role) in ('owner', 'super_admin')
  );
$function$;

CREATE OR REPLACE FUNCTION orcaly_private.my_company_role(p_company_id uuid)
 RETURNS text
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select m.cargo
  from public.company_members m
  where m.company_id = p_company_id
    and m.user_id = auth.uid()
    and m.status = 'ativo'
  limit 1;
$function$;

CREATE OR REPLACE FUNCTION orcaly_private.orcaly_user_has_company_access(target_company uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  allowed boolean := false;
begin
  if auth.uid() is null then
    return false;
  end if;

  if to_regclass('public.companies') is not null then
    begin
      execute
        'select exists (
           select 1
             from public.companies
            where id = $1
              and (
                owner_id = $2
                or tester_id = $2
              )
         )'
        into allowed
        using target_company, auth.uid();
    exception
      when undefined_column then
        allowed := false;
    end;

    if allowed then
      return true;
    end if;
  end if;

  if to_regclass('public.company_members') is not null then
    begin
      execute
        'select exists (
           select 1
             from public.company_members
            where company_id = $1
              and user_id = $2
              and coalesce(status, ''ativo'') = ''ativo''
         )'
        into allowed
        using target_company, auth.uid();
    exception
      when undefined_column then
        allowed := false;
    end;
  end if;

  return coalesce(allowed, false);
end;
$function$;

CREATE OR REPLACE FUNCTION orcaly_private.public_companies_data()
 RETURNS TABLE(id uuid, nome text, slug text, logo_url text, whatsapp text, cor_principal text, ativo boolean, segmento text, cidade text, estado text, aceita_pix boolean, cobrar_sinal boolean, percentual_sinal numeric, modelo_negocio text, modelo_nome text, modelo_perguntas jsonb, subdomain_slug text, site_template text, site_status text, site_primary_color text, site_accent_color text, site_config jsonb, atendimento_horario text, atendimento_observacao text, instagram text, marketplace_ativo boolean, marketplace_titulo text, marketplace_subtitulo text, marketplace_texto_botao text, marketplace_endereco text, marketplace_mapa_url text, site_publico_ativo boolean, site_background_color text, site_headline text, site_subheadline text, site_cta_text text, site_banner_url text, site_about_title text, site_about_text text, site_services_title text, site_contact_title text, site_show_store boolean, site_show_about boolean, site_show_contact boolean, site_show_featured boolean, site_features jsonb, site_faq jsonb, site_testimonials jsonb, site_custom_sections jsonb, site_layout text, site_art_style text, site_font_style text, site_button_style text, site_hero_alignment text, site_text_color text, site_card_color text, site_badge_text text, site_secondary_cta_text text, site_whatsapp_message text, site_show_faq boolean, site_show_testimonials boolean, site_show_gallery boolean, site_show_benefits boolean, site_gallery jsonb, site_benefits jsonb, site_seo_title text, site_seo_description text, site_keywords text[], site_promo_title text, site_promo_text text, site_promo_active boolean, site_promo_button_text text, site_business_hours jsonb, site_payment_methods text[], site_delivery_options text[])
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select
    c.id,
    c.nome,
    c.slug,
    c.logo_url,
    c.whatsapp,
    c.cor_principal,
    c.ativo,
    c.segmento,
    c.cidade,
    c.estado,
    c.aceita_pix,
    c.cobrar_sinal,
    c.percentual_sinal,
    c.modelo_negocio,
    c.modelo_nome,
    c.modelo_perguntas,
    c.subdomain_slug,
    c.site_template,
    c.site_status,
    c.site_primary_color,
    c.site_accent_color,
    c.site_config,
    c.atendimento_horario,
    c.atendimento_observacao,
    c.instagram,
    c.marketplace_ativo,
    c.marketplace_titulo,
    c.marketplace_subtitulo,
    c.marketplace_texto_botao,
    c.marketplace_endereco,
    c.marketplace_mapa_url,
    c.site_publico_ativo,
    c.site_background_color,
    c.site_headline,
    c.site_subheadline,
    c.site_cta_text,
    c.site_banner_url,
    c.site_about_title,
    c.site_about_text,
    c.site_services_title,
    c.site_contact_title,
    c.site_show_store,
    c.site_show_about,
    c.site_show_contact,
    c.site_show_featured,
    c.site_features,
    c.site_faq,
    c.site_testimonials,
    c.site_custom_sections,
    c.site_layout,
    c.site_art_style,
    c.site_font_style,
    c.site_button_style,
    c.site_hero_alignment,
    c.site_text_color,
    c.site_card_color,
    c.site_badge_text,
    c.site_secondary_cta_text,
    c.site_whatsapp_message,
    c.site_show_faq,
    c.site_show_testimonials,
    c.site_show_gallery,
    c.site_show_benefits,
    c.site_gallery,
    c.site_benefits,
    c.site_seo_title,
    c.site_seo_description,
    c.site_keywords,
    c.site_promo_title,
    c.site_promo_text,
    c.site_promo_active,
    c.site_promo_button_text,
    c.site_business_hours,
    c.site_payment_methods,
    c.site_delivery_options
  from public.companies c
  where coalesce(c.ativo, true) = true;
$function$;

CREATE OR REPLACE FUNCTION orcaly_private.public_products_data()
 RETURNS TABLE(id uuid, company_id uuid, nome text, preco numeric, ativo boolean, descricao text, categoria text, tipo text, unidade text, imagem_url text, image_urls text[], destaque boolean, precificacao text, unidade_label text, permite_largura boolean, permite_altura boolean, permite_comprimento boolean, permite_quantidade boolean, valor_minimo numeric, configuracoes jsonb, prazo_medio text, created_at timestamp with time zone, variacoes text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select
    p.id,
    p.company_id,
    p.nome,
    p.preco,
    p.ativo,
    p.descricao,
    p.categoria,
    p.tipo,
    p.unidade,
    p.imagem_url,
    p.image_urls,
    p.destaque,
    p.precificacao,
    p.unidade_label,
    p.permite_largura,
    p.permite_altura,
    p.permite_comprimento,
    p.permite_quantidade,
    p.valor_minimo,
    p.configuracoes,
    p.prazo_medio,
    p.created_at,
    p.variacoes
  from public.products p
  where coalesce(p.ativo, true) = true;
$function$;

CREATE OR REPLACE FUNCTION orcaly_private.public_site_sections_data()
 RETURNS TABLE(id uuid, company_id uuid, type text, title text, subtitle text, content text, image_url text, button_label text, button_url text, sort_order integer, active boolean, config jsonb, updated_at timestamp with time zone)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select
    s.id,
    s.company_id,
    s.type,
    s.title,
    s.subtitle,
    s.content,
    s.image_url,
    s.button_label,
    s.button_url,
    s.sort_order,
    s.active,
    s.config,
    s.updated_at
  from public.site_sections s
  where s.active = true;
$function$;

CREATE OR REPLACE FUNCTION orcaly_private.storage_path_company_id(p_name text)
 RETURNS uuid
 LANGUAGE plpgsql
 IMMUTABLE
 SET search_path TO ''
AS $function$
declare
  v_segment text;
begin
  v_segment := split_part(coalesce(p_name, ''), '/', 1);

  if v_segment ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' then
    return v_segment::uuid;
  end if;

  return null;
end;
$function$;

CREATE OR REPLACE FUNCTION orcaly_private.sync_signup_lead_sales_stage()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'pg_catalog', 'public'
AS $function$
begin
  if new.converted_company_id is not null
     and (
       tg_op = 'INSERT'
       or old.converted_company_id is distinct from new.converted_company_id
       or new.sales_stage <> 'cliente'
     )
  then
    new.sales_stage := 'cliente';
    new.sales_lost_reason := null;
  end if;

  if tg_op = 'INSERT'
     or old.sales_stage is distinct from new.sales_stage
  then
    new.sales_stage_updated_at := now();
  end if;

  return new;
end;
$function$;

CREATE OR REPLACE FUNCTION orcaly_private.touch_affiliate_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'pg_catalog', 'public', 'orcaly_private'
AS $function$
begin
  new.updated_at = now();
  return new;
end;
$function$;

CREATE OR REPLACE FUNCTION public.cancel_affiliate_payout_admin(p_payout_id uuid, p_reason text)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'orcaly_private'
AS $function$
declare
  payout_row public.affiliate_payouts%rowtype;
begin
  select * into payout_row
  from public.affiliate_payouts
  where id = p_payout_id
  for update;

  if not found or payout_row.status not in ('requested','approved') then
    return false;
  end if;

  update public.affiliate_payouts
  set status = 'cancelled',
      failure_reason = left(coalesce(p_reason, 'Pagamento cancelado.'), 500),
      cancelled_at = now(),
      updated_at = now()
  where id = p_payout_id;

  update public.affiliate_commissions
  set status = 'available',
      payout_id = null,
      updated_at = now()
  where payout_id = p_payout_id
    and status = 'processing';

  if payout_row.debt_offset > 0 then
    update public.affiliate_profiles
    set debt_balance = debt_balance + payout_row.debt_offset,
        updated_at = now()
    where id = payout_row.affiliate_id;
  end if;

  return true;
end;
$function$;

CREATE OR REPLACE FUNCTION public.change_signup_lead_sales_stage(p_lead_id uuid, p_actor_admin_id uuid, p_stage text, p_note text DEFAULT NULL::text, p_lost_reason text DEFAULT NULL::text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
declare
  v_actor_role text; v_actor_email text; v_assigned_to uuid; v_old_stage text; v_new_stage text := lower(btrim(coalesce(p_stage, '')));
begin
  if v_new_stage not in ('novo','contatado','interessado','demonstracao','convite_fundador','conta_ativada','cliente','perdido') then raise exception 'INVALID_SALES_STAGE'; end if;
  if v_new_stage='perdido' and nullif(btrim(coalesce(p_lost_reason,'')),'') is null then raise exception 'LOST_REASON_REQUIRED'; end if;
  select lower(role),lower(email) into v_actor_role,v_actor_email from public.platform_admins where id=p_actor_admin_id and is_active=true;
  if v_actor_role not in ('owner','prospector') then raise exception 'SALES_ACTOR_NOT_ALLOWED'; end if;
  if v_actor_role='prospector' and v_new_stage in ('conta_ativada','cliente') then raise exception 'SYSTEM_STAGE_ONLY'; end if;
  select assigned_to_admin_id,sales_stage into v_assigned_to,v_old_stage from public.signup_leads where id=p_lead_id for update;
  if not found then raise exception 'LEAD_NOT_FOUND'; end if;
  if v_actor_role='prospector' and v_assigned_to is distinct from p_actor_admin_id then raise exception 'LEAD_NOT_OWNED'; end if;
  update public.signup_leads set sales_stage=v_new_stage,sales_lost_reason=case when v_new_stage='perdido' then nullif(btrim(p_lost_reason),'') else null end,sales_stage_updated_at=now(),updated_at=now() where id=p_lead_id;
  if v_old_stage is distinct from v_new_stage then
    insert into public.signup_lead_followups(lead_id,channel,status,message,scheduled_for,sent_at,admin_email,created_by_admin_id,sales_event_type,raw_data)
    values(p_lead_id,'system','registrado',coalesce(nullif(btrim(p_note),''),'Etapa comercial alterada de '||coalesce(v_old_stage,'sem etapa')||' para '||v_new_stage),now(),now(),v_actor_email,p_actor_admin_id,'stage_change',jsonb_build_object('from_stage',v_old_stage,'to_stage',v_new_stage,'lost_reason',nullif(btrim(p_lost_reason),'')));
  end if;
end;
$function$;

CREATE OR REPLACE FUNCTION public.claim_background_jobs(p_worker text, p_limit integer DEFAULT 10)
 RETURNS SETOF background_jobs
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$ begin return query with picked as (select id from public.background_jobs where status in ('queued','retrying') and run_after<=now() order by run_after,created_at for update skip locked limit greatest(1,least(coalesce(p_limit,10),50))) update public.background_jobs j set status='running',attempts=j.attempts+1,locked_at=now(),locked_by=left(coalesce(p_worker,'worker'),120),started_at=coalesce(j.started_at,now()) from picked where j.id=picked.id returning j.*; end; $function$;

CREATE OR REPLACE FUNCTION public.claim_company_subscription_trial(p_company_id uuid)
 RETURNS SETOF companies
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_now timestamptz := now();
  v_trial_end timestamptz := now() + interval '7 days';
begin
  return query
  update public.companies
     set trial_started_at = v_now,
         trial_ends_at = v_trial_end,
         trial_used_at = v_now,
         assinatura_status = 'trialing',
         access_until = v_trial_end,
         cancel_at_period_end = false,
         updated_at = v_now
   where id = p_company_id
     and trial_used_at is null
  returning *;
end;
$function$;

CREATE OR REPLACE FUNCTION public.claim_due_founder_price_conversions(p_limit integer DEFAULT 20)
 RETURNS TABLE(company_id uuid, claim_id uuid, provider_subscription_id text, plan_key text, founder_price_cents integer, normal_price_cents integer, founder_price_ends_at timestamp with time zone)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
begin
  update public.companies c
  set founder_price_conversion_claim_id=null, founder_price_conversion_claimed_at=null,
      founder_price_conversion_last_error='STALE_PRICE_CONVERSION_CLAIM_RECOVERED',updated_at=now()
  where c.founder_price_conversion_claim_id is not null
    and c.founder_price_conversion_claimed_at < now() - interval '15 minutes';

  return query
  with candidates as (
    select c.id from public.companies c
    where c.is_founder=true and c.founder_price_ends_at is not null
      and c.founder_price_ends_at <= now() and c.founder_price_converted_at is null
      and c.founder_price_conversion_claim_id is null
      and coalesce(c.provider_subscription_id,c.mercado_pago_subscription_id) is not null
    order by c.founder_price_ends_at,c.id
    limit greatest(1,least(coalesce(p_limit,20),50)) for update skip locked
  )
  update public.companies c
  set founder_price_conversion_claim_id=gen_random_uuid(),
      founder_price_conversion_claimed_at=now(),
      founder_price_conversion_attempts=c.founder_price_conversion_attempts+1,
      founder_price_conversion_last_error=null,updated_at=now()
  from candidates x where c.id=x.id
  returning c.id,c.founder_price_conversion_claim_id,
    coalesce(c.provider_subscription_id,c.mercado_pago_subscription_id),
    lower(coalesce(c.assinatura_plano,c.plano,'')),c.founder_price_cents,
    case lower(coalesce(c.assinatura_plano,c.plano,''))
      when 'basico' then 4990 when 'básico' then 4990 when 'essencial' then 4990
      when 'profissional' then 9990 when 'intermediario' then 9990 when 'intermediário' then 9990
      when 'premium' then 14990 else null end,
    c.founder_price_ends_at;
end;
$function$;

CREATE OR REPLACE FUNCTION public.claim_founder_activation(p_token_hash text, p_email text, p_claim_id uuid)
 RETURNS TABLE(invite_id uuid, email text, founder_number integer, plan_key text, founder_price_cents integer, sales_lead_id uuid)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
declare v_invite public.founder_invites%rowtype; v_email text:=lower(btrim(coalesce(p_email,'')));
begin
  if p_claim_id is null then raise exception 'FOUNDER_ACTIVATION_CLAIM_REQUIRED'; end if;
  if p_token_hash is null or p_token_hash !~ '^[0-9a-f]{64}$' then raise exception 'FOUNDER_ACTIVATION_INVALID_TOKEN'; end if;
  if v_email='' or position('@' in v_email)<=1 then raise exception 'FOUNDER_ACTIVATION_INVALID_EMAIL'; end if;
  perform pg_advisory_xact_lock(hashtextextended(p_token_hash,0));
  update public.founder_invites set status='pending',activation_claim_id=null,activation_claimed_at=null,activation_last_error='STALE_ACTIVATION_CLAIM_RECOVERED',updated_at=now() where token_hash=p_token_hash and status='activating' and activation_claimed_at<now()-interval '10 minutes';
  select * into v_invite from public.founder_invites where token_hash=p_token_hash for update;
  if not found then raise exception 'FOUNDER_ACTIVATION_INVALID_TOKEN'; end if;
  if v_invite.status='activating' then raise exception 'FOUNDER_ACTIVATION_IN_PROGRESS'; end if;
  if v_invite.status<>'pending' then raise exception 'FOUNDER_ACTIVATION_NOT_PENDING'; end if;
  if v_invite.token_expires_at is not null and v_invite.token_expires_at<=now() then raise exception 'FOUNDER_ACTIVATION_EXPIRED'; end if;
  if v_invite.email_normalized<>v_email then raise exception 'FOUNDER_ACTIVATION_EMAIL_MISMATCH'; end if;
  update public.founder_invites set status='activating',activation_claim_id=p_claim_id,activation_claimed_at=now(),activation_attempts=activation_attempts+1,activation_last_error=null,updated_at=now() where id=v_invite.id;
  return query select v_invite.id,v_invite.email,v_invite.founder_number,v_invite.plan_key,v_invite.founder_price_cents,v_invite.sales_lead_id;
end; $function$;

CREATE OR REPLACE FUNCTION public.claim_founder_billing_setup(p_company_id uuid, p_claim_id uuid)
 RETURNS TABLE(company_id uuid, plan_payment_id uuid, plan_key text, payer_email text, effective_price_cents integer, founder_price_cents integer, normal_price_cents integer, billing_start_at timestamp with time zone, provider_subscription_id text, checkout_url text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
declare
  v_company public.companies%rowtype;
  v_payment public.plan_payments%rowtype;
  v_normal integer;
  v_effective integer;
  v_payment_id uuid;
begin
  if p_company_id is null or p_claim_id is null then
    raise exception 'FOUNDER_BILLING_INVALID_CLAIM';
  end if;

  update public.companies c
  set founder_billing_claim_id = null,
      founder_billing_claimed_at = null,
      founder_billing_last_error = 'STALE_BILLING_CLAIM_RECOVERED',
      updated_at = now()
  where c.id = p_company_id
    and c.founder_billing_claim_id is not null
    and c.founder_billing_claimed_at < now() - interval '10 minutes';

  select c.* into v_company
  from public.companies c
  where c.id = p_company_id
  for update;

  if not found then
    raise exception 'FOUNDER_BILLING_COMPANY_NOT_FOUND';
  end if;

  if v_company.is_founder is not true then
    raise exception 'FOUNDER_BILLING_NOT_FOUNDER';
  end if;

  if v_company.founder_billing_claim_id is not null then
    raise exception 'FOUNDER_BILLING_IN_PROGRESS';
  end if;

  if v_company.founder_trial_ends_at is null
     or v_company.founder_price_ends_at is null
     or v_company.founder_price_cents is null
  then
    raise exception 'FOUNDER_BILLING_TIMELINE_MISSING';
  end if;

  v_normal := case lower(coalesce(v_company.assinatura_plano, v_company.plano, ''))
    when 'basico' then 4990
    when 'básico' then 4990
    when 'essencial' then 4990
    when 'profissional' then 9990
    when 'intermediario' then 9990
    when 'intermediário' then 9990
    when 'premium' then 14990
    else null
  end;

  if v_normal is null then
    raise exception 'FOUNDER_BILLING_INVALID_PLAN';
  end if;

  v_effective := case
    when now() < v_company.founder_price_ends_at
      then v_company.founder_price_cents
    else v_normal
  end;

  select pp.* into v_payment
  from public.plan_payments pp
  where pp.company_id = p_company_id
    and pp.idempotency_key = 'founder-recurring-v1'
  order by pp.created_at desc
  limit 1
  for update;

  if not found then
    v_payment_id := gen_random_uuid();

    insert into public.plan_payments (
      id, company_id, plano, valor, status, tipo, email, nome_empresa,
      payment_method, provider, billing_type, external_reference,
      idempotency_key, created_at, updated_at
    ) values (
      v_payment_id, p_company_id,
      lower(coalesce(v_company.assinatura_plano, v_company.plano, 'profissional')),
      v_effective / 100.0, 'subscription_pending', 'subscription',
      lower(coalesce(v_company.email, v_company.mercado_pago_customer_email, '')),
      v_company.nome, 'card_recurring', 'mercado_pago', 'founder_recurring',
      v_payment_id::text, 'founder-recurring-v1', now(), now()
    ) returning * into v_payment;
  else
    update public.plan_payments pp
    set plano = lower(coalesce(v_company.assinatura_plano, v_company.plano, 'profissional')),
        valor = case
          when coalesce(pp.provider_subscription_id, pp.mercado_pago_preapproval_id) is null
            then v_effective / 100.0
          else pp.valor
        end,
        email = lower(coalesce(v_company.email, pp.email, '')),
        provider = 'mercado_pago',
        billing_type = 'founder_recurring',
        external_reference = coalesce(nullif(pp.external_reference, ''), pp.id::text),
        updated_at = now()
    where pp.id = v_payment.id
    returning * into v_payment;
  end if;

  update public.companies c
  set founder_billing_claim_id = p_claim_id,
      founder_billing_claimed_at = now(),
      founder_billing_attempts = c.founder_billing_attempts + 1,
      founder_billing_last_error = null,
      updated_at = now()
  where c.id = p_company_id
  returning c.* into v_company;

  return query
  select v_company.id, v_payment.id,
    lower(coalesce(v_company.assinatura_plano, v_company.plano, 'profissional')),
    lower(coalesce(v_company.email, v_company.mercado_pago_customer_email, v_payment.email, '')),
    v_effective, v_company.founder_price_cents, v_normal,
    v_company.founder_trial_ends_at,
    coalesce(v_company.provider_subscription_id, v_company.mercado_pago_subscription_id,
             v_payment.provider_subscription_id, v_payment.mercado_pago_preapproval_id),
    coalesce(v_payment.checkout_url, v_company.assinatura_checkout_url);
end;
$function$;

CREATE OR REPLACE FUNCTION public.claim_platform_admin_invite(p_token_hash text, p_claim_id uuid)
 RETURNS SETOF platform_admin_invites
 LANGUAGE plpgsql
 SET search_path TO 'pg_catalog', 'public'
AS $function$
begin
  if p_claim_id is null then return; end if;
  update public.platform_admin_invites
  set status = case when expires_at <= now() then 'expired' else 'pending' end, claimed_at = null, activation_claim_id = null
  where status = 'activating' and claimed_at < now() - interval '10 minutes';
  update public.platform_admin_invites set status = 'expired' where status = 'pending' and expires_at <= now();
  return query
  update public.platform_admin_invites
  set status = 'activating', claimed_at = now(), activation_claim_id = p_claim_id
  where token_hash = lower(p_token_hash) and status = 'pending' and expires_at > now()
  returning *;
end;
$function$;

CREATE OR REPLACE FUNCTION public.company_member_touch()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
begin
  new.updated_at = now();
  return new;
end;
$function$;

CREATE OR REPLACE FUNCTION public.complete_founder_activation(p_claim_id uuid, p_user_id uuid, p_company_name text, p_slug text, p_business_type text, p_whatsapp text DEFAULT NULL::text, p_cidade text DEFAULT NULL::text, p_estado text DEFAULT NULL::text, p_onboarding_goal text DEFAULT NULL::text, p_default_setup jsonb DEFAULT '{}'::jsonb)
 RETURNS companies
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'auth'
AS $function$
declare
  v_invite public.founder_invites%rowtype; v_lead public.signup_leads%rowtype; v_company public.companies%rowtype; v_user_email text;
  v_company_name text:=btrim(coalesce(p_company_name,'')); v_slug text:=lower(btrim(coalesce(p_slug,''))); v_business_type text:=lower(btrim(coalesce(p_business_type,'services')));
  v_whatsapp text:=nullif(btrim(coalesce(p_whatsapp,'')),''); v_cidade text:=nullif(btrim(coalesce(p_cidade,'')),''); v_estado text:=upper(nullif(btrim(coalesce(p_estado,'')),'')); v_onboarding_goal text:=nullif(btrim(coalesce(p_onboarding_goal,'')),'');
  v_started timestamptz:=now(); v_trial_ends timestamptz; v_price_ends timestamptz; v_payment_methods text[]; v_delivery_options text[];
begin
  if p_claim_id is null or p_user_id is null then raise exception 'FOUNDER_ACTIVATION_INVALID_FINALIZE'; end if;
  select lower(email) into v_user_email from auth.users where id=p_user_id;
  if v_user_email is null then raise exception 'FOUNDER_ACTIVATION_AUTH_USER_NOT_FOUND'; end if;
  select * into v_invite from public.founder_invites where activation_claim_id=p_claim_id and status='activating' for update;
  if not found then raise exception 'FOUNDER_ACTIVATION_CLAIM_NOT_FOUND'; end if;
  if v_invite.token_expires_at is not null and v_invite.token_expires_at<=now() then raise exception 'FOUNDER_ACTIVATION_EXPIRED'; end if;
  if lower(v_invite.email)<>v_user_email then raise exception 'FOUNDER_ACTIVATION_AUTH_EMAIL_MISMATCH'; end if;
  if exists(select 1 from public.companies c where c.owner_id=p_user_id or lower(coalesce(c.email,''))=v_user_email) then raise exception 'FOUNDER_ACTIVATION_COMPANY_ALREADY_EXISTS'; end if;
  if length(v_company_name)<2 or length(v_company_name)>80 then raise exception 'FOUNDER_ACTIVATION_INVALID_COMPANY_NAME'; end if;
  if v_slug !~ '^[a-z0-9][a-z0-9-]{1,40}[a-z0-9]$' or v_slug like '%--%' then raise exception 'FOUNDER_ACTIVATION_INVALID_SLUG'; end if;
  if v_business_type not in ('services','graphic','food','beauty','barber','technical_assistance','auto','store','events','custom_products') then v_business_type:='services'; end if;
  perform pg_advisory_xact_lock(hashtextextended('orcaly-founder-company:'||v_slug,0));
  if exists(select 1 from public.companies c where c.slug=v_slug or lower(c.subdomain_slug)=regexp_replace(v_slug,'[^a-z0-9]','','g')) then raise exception 'FOUNDER_ACTIVATION_SLUG_TAKEN'; end if;
  if v_invite.sales_lead_id is not null then select * into v_lead from public.signup_leads where id=v_invite.sales_lead_id for update; end if;
  v_trial_ends:=v_started+interval '30 days'; v_price_ends:=v_trial_ends+interval '6 months';
  if jsonb_typeof(p_default_setup->'site_payment_methods')='array' then select array_agg(value) into v_payment_methods from jsonb_array_elements_text(p_default_setup->'site_payment_methods') as t(value); end if;
  if jsonb_typeof(p_default_setup->'site_delivery_options')='array' then select array_agg(value) into v_delivery_options from jsonb_array_elements_text(p_default_setup->'site_delivery_options') as t(value); end if;
  insert into public.companies(nome,slug,subdomain_slug,owner_id,email,whatsapp,telefone,cidade,estado,segmento,modelo_negocio,business_type,onboarding_goal,plano,assinatura_plano,assinatura_status,assinatura_inicio,assinatura_expira_em,assinatura_auto_recorrente,trial_started_at,trial_ends_at,trial_used_at,access_until,cancel_at_period_end,is_founder,founder_number,founder_price_cents,founder_started_at,founder_trial_ends_at,founder_price_ends_at,site_template,site_layout,site_cta_text,site_marketplace_title,site_marketplace_subtitle,site_cart_button_text,site_checkout_button_text,site_empty_catalog_text,site_headline,site_subheadline,site_about_title,site_about_text,site_benefits,site_faq,site_features,site_payment_methods,site_delivery_options)
  values(v_company_name,v_slug,v_slug,p_user_id,v_user_email,v_whatsapp,v_whatsapp,v_cidade,v_estado,coalesce(nullif(btrim(v_lead.segmento),''),v_business_type),coalesce(nullif(btrim(v_lead.modelo_negocio),''),v_business_type),v_business_type,v_onboarding_goal,v_invite.plan_key,v_invite.plan_key,'trialing',v_started,v_trial_ends,false,v_started,v_trial_ends,v_started,v_trial_ends,false,true,v_invite.founder_number,v_invite.founder_price_cents,v_started,v_trial_ends,v_price_ends,coalesce(nullif(p_default_setup->>'site_template',''),v_business_type),coalesce(nullif(p_default_setup->>'site_layout',''),'premium'),nullif(p_default_setup->>'site_cta_text',''),nullif(p_default_setup->>'site_marketplace_title',''),nullif(p_default_setup->>'site_marketplace_subtitle',''),nullif(p_default_setup->>'site_cart_button_text',''),nullif(p_default_setup->>'site_checkout_button_text',''),nullif(p_default_setup->>'site_empty_catalog_text',''),nullif(p_default_setup->>'site_headline',''),nullif(p_default_setup->>'site_subheadline',''),nullif(p_default_setup->>'site_about_title',''),nullif(p_default_setup->>'site_about_text',''),coalesce(p_default_setup->'site_benefits','[]'::jsonb),coalesce(p_default_setup->'site_faq','[]'::jsonb),coalesce(p_default_setup->'site_features','[]'::jsonb),v_payment_methods,v_delivery_options) returning * into v_company;
  update public.founder_invites set status='activated',activated_at=v_started,user_id=p_user_id,company_id=v_company.id,activation_claim_id=null,activation_claimed_at=null,activation_last_error=null,updated_at=now() where id=v_invite.id;
  if v_invite.sales_lead_id is not null then
    update public.signup_leads set converted_user_id=p_user_id,converted_company_id=v_company.id,sales_stage='conta_ativada',sales_stage_updated_at=now(),sales_lost_reason=null,raw_data=coalesce(raw_data,'{}'::jsonb)||jsonb_build_object('founder_invite_id',v_invite.id,'founder_number',v_invite.founder_number,'founder_activated',true,'founder_company_id',v_company.id),updated_at=now() where id=v_invite.sales_lead_id;
    insert into public.signup_lead_followups(lead_id,channel,status,message,scheduled_for,sent_at,admin_email,created_by_admin_id,sales_event_type,raw_data) values(v_invite.sales_lead_id,'system','registrado','Conta Founder #'||lpad(v_invite.founder_number::text,2,'0')||' ativada.',now(),now(),v_invite.created_by_email,v_invite.created_by_admin_id,'system',jsonb_build_object('source','founder_program','event','account_activated','founder_invite_id',v_invite.id,'founder_number',v_invite.founder_number,'company_id',v_company.id,'user_id',p_user_id,'trial_ends_at',v_trial_ends,'founder_price_ends_at',v_price_ends));
  end if;
  return v_company;
end; $function$;

CREATE OR REPLACE FUNCTION public.complete_founder_billing_setup(p_company_id uuid, p_claim_id uuid, p_plan_payment_id uuid, p_subscription_id text, p_provider_status text, p_checkout_url text, p_next_payment_date timestamp with time zone, p_provider_payload jsonb)
 RETURNS companies
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
declare
  v_company public.companies%rowtype;
  v_status text := lower(btrim(coalesce(p_provider_status, 'pending')));
begin
  if nullif(btrim(coalesce(p_subscription_id, '')), '') is null then
    raise exception 'FOUNDER_BILLING_SUBSCRIPTION_REQUIRED';
  end if;

  select c.* into v_company
  from public.companies c
  where c.id = p_company_id and c.founder_billing_claim_id = p_claim_id and c.is_founder = true
  for update;

  if not found then raise exception 'FOUNDER_BILLING_CLAIM_NOT_FOUND'; end if;

  if not exists (
    select 1 from public.plan_payments pp
    where pp.id = p_plan_payment_id and pp.company_id = p_company_id
      and pp.idempotency_key = 'founder-recurring-v1'
  ) then
    raise exception 'FOUNDER_BILLING_PAYMENT_ROW_MISMATCH';
  end if;

  update public.plan_payments pp
  set provider = 'mercado_pago', provider_subscription_id = p_subscription_id,
      mercado_pago_preapproval_id = p_subscription_id, checkout_url = p_checkout_url,
      raw_subscription = coalesce(p_provider_payload, '{}'::jsonb),
      next_payment_date = p_next_payment_date, status = 'subscription_' || v_status,
      updated_at = now()
  where pp.id = p_plan_payment_id;

  update public.companies c
  set subscription_provider = 'mercado_pago', provider_subscription_id = p_subscription_id,
      mercado_pago_subscription_id = p_subscription_id,
      mercado_pago_subscription_status = v_status,
      mercado_pago_customer_email = coalesce(c.mercado_pago_customer_email, c.email),
      assinatura_checkout_url = p_checkout_url,
      assinatura_mp_payload = coalesce(p_provider_payload, '{}'::jsonb),
      assinatura_proxima_cobranca = p_next_payment_date,
      next_billing_at = p_next_payment_date,
      assinatura_auto_recorrente = (v_status = 'authorized'),
      assinatura_status = case
        when c.assinatura_status = 'ativa' then 'ativa'
        when c.founder_trial_ends_at > now() then 'trialing'
        else 'pendente'
      end,
      founder_billing_setup_at = coalesce(c.founder_billing_setup_at, now()),
      founder_billing_authorized_at = case
        when v_status = 'authorized' then coalesce(c.founder_billing_authorized_at, now())
        else c.founder_billing_authorized_at end,
      founder_billing_last_sync_at = now(), founder_billing_claim_id = null,
      founder_billing_claimed_at = null, founder_billing_last_error = null,
      updated_at = now()
  where c.id = p_company_id
  returning c.* into v_company;

  insert into public.subscription_events (
    company_id,event_type,old_status,new_status,provider,provider_reference,
    provider_object_id,metadata,processing_status,processed_at
  ) values (
    p_company_id,'founder_billing_setup',null,v_status,'mercado_pago',
    p_subscription_id,p_subscription_id,
    jsonb_build_object('plan_payment_id',p_plan_payment_id,'founder_number',v_company.founder_number,
      'founder_price_cents',v_company.founder_price_cents,'trial_ends_at',v_company.founder_trial_ends_at),
    'processed',now()
  ) on conflict do nothing;

  return v_company;
end;
$function$;

CREATE OR REPLACE FUNCTION public.complete_founder_price_conversion(p_company_id uuid, p_claim_id uuid, p_provider_status text, p_provider_payload jsonb, p_action text)
 RETURNS companies
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
declare
  v_company public.companies%rowtype;
  v_normal integer;
  v_amount numeric;
  v_action text := lower(btrim(coalesce(p_action,'updated')));
begin
  select c.* into v_company from public.companies c
  where c.id=p_company_id and c.is_founder=true
    and c.founder_price_conversion_claim_id=p_claim_id
    and c.founder_price_converted_at is null for update;
  if not found then raise exception 'FOUNDER_PRICE_CONVERSION_CLAIM_NOT_FOUND'; end if;
  if v_company.founder_price_ends_at > now() then raise exception 'FOUNDER_PRICE_CONVERSION_TOO_EARLY'; end if;

  v_normal := case lower(coalesce(v_company.assinatura_plano,v_company.plano,''))
    when 'basico' then 4990 when 'básico' then 4990 when 'essencial' then 4990
    when 'profissional' then 9990 when 'intermediario' then 9990 when 'intermediário' then 9990
    when 'premium' then 14990 else null end;
  if v_normal is null then raise exception 'FOUNDER_PRICE_CONVERSION_INVALID_PLAN'; end if;

  if v_action not in ('inactive','cancelled') then
    begin
      v_amount := nullif(p_provider_payload #>> '{auto_recurring,transaction_amount}','')::numeric;
    exception when others then v_amount := null; end;
    if v_amount is null or round(v_amount*100)::integer <> v_normal then
      raise exception 'FOUNDER_STANDARD_PRICE_PROVIDER_MISMATCH';
    end if;
  end if;

  update public.companies c
  set founder_price_converted_at=now(),founder_price_conversion_claim_id=null,
      founder_price_conversion_claimed_at=null,founder_price_conversion_last_error=null,
      founder_billing_last_sync_at=now(),
      mercado_pago_subscription_status=coalesce(nullif(btrim(coalesce(p_provider_status,'')),''),c.mercado_pago_subscription_status),
      assinatura_mp_payload=coalesce(p_provider_payload,c.assinatura_mp_payload),updated_at=now()
  where c.id=p_company_id returning c.* into v_company;

  update public.plan_payments pp
  set valor=v_normal/100.0,raw_subscription=coalesce(p_provider_payload,pp.raw_subscription),
      status=case when v_action in ('inactive','cancelled') then pp.status
                  else 'subscription_'||lower(coalesce(p_provider_status,'authorized')) end,
      updated_at=now()
  where pp.company_id=p_company_id and pp.idempotency_key='founder-recurring-v1';

  insert into public.subscription_events (
    company_id,event_type,old_status,new_status,provider,provider_reference,
    provider_object_id,metadata,processing_status,processed_at
  ) values (
    p_company_id,'founder_converted_to_standard_price',v_company.founder_price_cents::text,
    v_normal::text,'mercado_pago',coalesce(v_company.provider_subscription_id,v_company.mercado_pago_subscription_id),
    coalesce(v_company.provider_subscription_id,v_company.mercado_pago_subscription_id),
    jsonb_build_object('action',v_action,'plan_key',coalesce(v_company.assinatura_plano,v_company.plano),
      'founder_price_cents',v_company.founder_price_cents,'normal_price_cents',v_normal,
      'founder_price_ends_at',v_company.founder_price_ends_at,'provider_status',p_provider_status),
    'processed',now()
  ) on conflict do nothing;
  return v_company;
end;
$function$;

CREATE OR REPLACE FUNCTION public.complete_platform_admin_invite(p_claim_id uuid, p_user_id uuid)
 RETURNS SETOF platform_admins
 LANGUAGE plpgsql
 SET search_path TO 'pg_catalog', 'public', 'auth'
AS $function$
declare
  v_invite public.platform_admin_invites%rowtype;
  v_admin public.platform_admins%rowtype;
  v_role text;
begin
  if p_claim_id is null or p_user_id is null then raise exception 'invalid_activation_input'; end if;
  select * into v_invite from public.platform_admin_invites where status = 'activating' and activation_claim_id = p_claim_id and expires_at > now() for update;
  if not found then raise exception 'invite_not_claimed'; end if;
  v_role := lower(v_invite.role);
  if v_role not in ('admin','platform_admin','finance','support','security','operations','viewer','prospector') then raise exception 'invalid_invite_role'; end if;
  if exists (select 1 from public.platform_admins p where lower(p.email) = v_invite.email_normalized) then raise exception 'platform_admin_email_exists'; end if;
  insert into public.platform_admins (user_id,email,nome,role,is_active,permissions,area,observacoes,created_by,must_change_password,updated_at)
  values (p_user_id,v_invite.email_normalized,btrim(v_invite.nome),v_role,true,v_invite.permissions,coalesce(nullif(btrim(v_invite.area), ''), 'Plataforma'),v_invite.observacoes,v_invite.created_by_email,false,now()) returning * into v_admin;
  update public.platform_admin_invites set status = 'activated', activated_at = now(), claimed_at = null, activation_claim_id = null, user_id = p_user_id, platform_admin_id = v_admin.id
  where id = v_invite.id and status = 'activating' and activation_claim_id = p_claim_id;
  if not found then raise exception 'invite_activation_race'; end if;
  return next v_admin;
  return;
end;
$function$;

CREATE OR REPLACE FUNCTION public.consume_marketplace_coupon(p_company_id uuid, p_order_id uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare
  v_coupon_id uuid;
begin
  update public.orders
  set coupon_consumed_at = now(),
      updated_at = now()
  where id = p_order_id
    and company_id = p_company_id
    and coupon_id is not null
    and coupon_consumed_at is null
  returning coupon_id into v_coupon_id;

  if v_coupon_id is null then
    return false;
  end if;

  update public.marketplace_coupons
  set used_count = coalesce(used_count, 0) + 1,
      updated_at = now()
  where id = v_coupon_id
    and company_id = p_company_id;

  return found;
end;
$function$;

CREATE OR REPLACE FUNCTION public.create_affiliate_payout_admin(p_affiliate_id uuid)
 RETURNS TABLE(payout_id uuid, payout_amount numeric, gross_amount numeric, debt_applied numeric)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'orcaly_private'
AS $function$
declare
  profile_row public.affiliate_profiles%rowtype;
  account_row orcaly_private.affiliate_payout_accounts%rowtype;
  settings_row public.affiliate_program_settings%rowtype;
  gross numeric(14,2);
  debt numeric(14,2);
  offset_value numeric(14,2);
  net_value numeric(14,2);
  new_payout_id uuid;
begin
  perform public.release_affiliate_commissions_admin();

  select * into profile_row
  from public.affiliate_profiles
  where id = p_affiliate_id
  for update;

  if not found or profile_row.status <> 'active' then
    raise exception 'Indicador inativo ou não encontrado.';
  end if;

  select * into account_row
  from orcaly_private.affiliate_payout_accounts
  where affiliate_id = p_affiliate_id
  for update;

  if not found or not account_row.is_verified then
    raise exception 'Conta Pix ainda não verificada.';
  end if;

  select * into settings_row
  from public.affiliate_program_settings
  where id = 1;

  if not settings_row.payouts_enabled then
    raise exception 'Pagamentos de comissão estão temporariamente desativados.';
  end if;

  if exists (
    select 1 from public.affiliate_payouts
    where affiliate_id = p_affiliate_id
      and status in ('requested','approved','processing')
  ) then
    raise exception 'Já existe um pagamento em andamento.';
  end if;

  select coalesce(sum(locked.commission_amount), 0)
  into gross
  from (
    select c.id, c.commission_amount
    from public.affiliate_commissions c
    where c.affiliate_id = p_affiliate_id
      and c.status = 'available'
    order by c.created_at, c.id
    for update
  ) locked;

  debt := coalesce(profile_row.debt_balance, 0);
  offset_value := least(gross, debt);
  net_value := round(gross - offset_value, 2);

  if net_value < settings_row.minimum_payout_amount then
    raise exception 'Saldo disponível abaixo do mínimo de pagamento.';
  end if;

  insert into public.affiliate_payouts (
    affiliate_id,
    gross_commissions,
    debt_offset,
    amount,
    status,
    provider,
    external_reference,
    pix_key_type,
    pix_key_masked,
    holder_name
  ) values (
    p_affiliate_id,
    gross,
    offset_value,
    net_value,
    'requested',
    'manual',
    'affiliate_payout:' || gen_random_uuid()::text,
    account_row.pix_key_type,
    account_row.pix_key_masked,
    account_row.holder_name
  ) returning id into new_payout_id;

  insert into public.affiliate_payout_items (payout_id, commission_id, amount)
  select new_payout_id, id, commission_amount
  from public.affiliate_commissions
  where affiliate_id = p_affiliate_id
    and status = 'available';

  update public.affiliate_commissions
  set status = 'processing',
      payout_id = new_payout_id,
      updated_at = now()
  where affiliate_id = p_affiliate_id
    and status = 'available';

  update public.affiliate_profiles
  set debt_balance = greatest(0, debt - offset_value),
      updated_at = now()
  where id = p_affiliate_id;

  return query select new_payout_id, net_value, gross, offset_value;
end;
$function$;

CREATE OR REPLACE FUNCTION public.create_founder_invite_for_sales_lead(p_actor_admin_id uuid, p_lead_id uuid, p_plan_key text, p_token_hash text, p_token_expires_at timestamp with time zone, p_requested_founder_number integer DEFAULT NULL::integer)
 RETURNS founder_invites
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
declare
  v_actor_role text;
  v_actor_email text;
  v_lead public.signup_leads%rowtype;
  v_plan text := lower(btrim(coalesce(p_plan_key,'')));
  v_price integer;
  v_number integer;
  v_invite public.founder_invites%rowtype;
begin
  if p_token_hash is null or p_token_hash !~ '^[0-9a-f]{64}$' then
    raise exception 'INVALID_FOUNDER_TOKEN_HASH';
  end if;

  if p_token_expires_at is null
     or p_token_expires_at <= now()
     or p_token_expires_at > now() + interval '30 days'
  then
    raise exception 'INVALID_FOUNDER_TOKEN_EXPIRY';
  end if;

  if v_plan = 'basico' then
    v_price := 3490;
  elsif v_plan = 'profissional' then
    v_price := 6990;
  elsif v_plan = 'premium' then
    v_price := 9990;
  else
    raise exception 'INVALID_FOUNDER_PLAN';
  end if;

  select lower(role), lower(email)
    into v_actor_role, v_actor_email
  from public.platform_admins
  where id = p_actor_admin_id
    and is_active = true;

  if v_actor_role = 'owner'
     and v_actor_email <> 'viniciusadm@orcaly.com'
  then
    raise exception 'FOUNDER_ACTOR_NOT_ALLOWED';
  end if;

  if v_actor_role not in ('owner','prospector') then
    raise exception 'FOUNDER_ACTOR_NOT_ALLOWED';
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended('orcaly-founder-slot-allocation-v1', 0)
  );

  select *
    into v_lead
  from public.signup_leads
  where id = p_lead_id
  for update;

  if not found then
    raise exception 'FOUNDER_LEAD_NOT_FOUND';
  end if;

  if v_actor_role = 'prospector'
     and v_lead.assigned_to_admin_id is distinct from p_actor_admin_id
  then
    raise exception 'FOUNDER_LEAD_NOT_OWNED';
  end if;

  if v_lead.converted_company_id is not null
     or v_lead.sales_stage in ('conta_ativada','cliente','perdido')
  then
    raise exception 'FOUNDER_LEAD_NOT_ELIGIBLE';
  end if;

  if exists (
    select 1
    from public.founder_invites fi
    where fi.status in ('pending','activated')
      and (
        fi.sales_lead_id = p_lead_id
        or fi.email_normalized = lower(btrim(v_lead.email))
      )
  ) then
    raise exception 'FOUNDER_INVITE_ALREADY_EXISTS';
  end if;

  if p_requested_founder_number is not null then
    if p_requested_founder_number < 1
       or p_requested_founder_number > 10
    then
      raise exception 'INVALID_FOUNDER_NUMBER';
    end if;

    if exists (
      select 1
      from public.founder_invites fi
      where fi.founder_number = p_requested_founder_number
        and fi.status in ('pending','activated')
    ) then
      raise exception 'FOUNDER_NUMBER_TAKEN';
    end if;

    v_number := p_requested_founder_number;
  else
    select slot
      into v_number
    from generate_series(1,10) as slot
    where not exists (
      select 1
      from public.founder_invites fi
      where fi.founder_number = slot
        and fi.status in ('pending','activated')
    )
    order by slot
    limit 1;

    if v_number is null then
      raise exception 'FOUNDER_SLOTS_EXHAUSTED';
    end if;
  end if;

  insert into public.founder_invites (
    email,
    founder_number,
    plan_key,
    founder_price_cents,
    status,
    token_hash,
    token_expires_at,
    invited_at,
    sales_lead_id,
    created_by_admin_id,
    created_by_email
  )
  values (
    lower(btrim(v_lead.email)),
    v_number,
    v_plan,
    v_price,
    'pending',
    p_token_hash,
    p_token_expires_at,
    now(),
    p_lead_id,
    p_actor_admin_id,
    v_actor_email
  )
  returning * into v_invite;

  update public.signup_leads
  set sales_stage = 'convite_fundador',
      sales_lost_reason = null,
      sales_stage_updated_at = now(),
      updated_at = now()
  where id = p_lead_id;

  insert into public.signup_lead_followups (
    lead_id,
    channel,
    status,
    message,
    scheduled_for,
    sent_at,
    admin_email,
    created_by_admin_id,
    sales_event_type,
    raw_data
  )
  values (
    p_lead_id,
    'system',
    'registrado',
    'Convite Founder #' || lpad(v_number::text,2,'0') || ' criado.',
    now(),
    now(),
    v_actor_email,
    p_actor_admin_id,
    'system',
    jsonb_build_object(
      'source','founder_program',
      'event','invite_created',
      'founder_invite_id',v_invite.id,
      'founder_number',v_number,
      'plan_key',v_plan,
      'founder_price_cents',v_price
    )
  );

  return v_invite;
end;
$function$;

CREATE OR REPLACE FUNCTION public.create_founder_test_invite(p_actor_admin_id uuid, p_email text, p_plan_key text, p_token_hash text, p_token_expires_at timestamp with time zone)
 RETURNS founder_invites
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
declare
  v_actor_role text;
  v_actor_email text;
  v_email text := lower(btrim(coalesce(p_email,'')));
  v_plan text := lower(btrim(coalesce(p_plan_key,'')));
  v_price integer;
  v_invite public.founder_invites%rowtype;
begin
  if v_email = '' or position('@' in v_email) <= 1 then
    raise exception 'INVALID_FOUNDER_EMAIL';
  end if;

  if p_token_hash is null or p_token_hash !~ '^[0-9a-f]{64}$' then
    raise exception 'INVALID_FOUNDER_TOKEN_HASH';
  end if;

  if p_token_expires_at is null
     or p_token_expires_at <= now()
     or p_token_expires_at > now() + interval '30 days'
  then
    raise exception 'INVALID_FOUNDER_TOKEN_EXPIRY';
  end if;

  if v_plan = 'basico' then
    v_price := 3490;
  elsif v_plan = 'profissional' then
    v_price := 6990;
  elsif v_plan = 'premium' then
    v_price := 9990;
  else
    raise exception 'INVALID_FOUNDER_PLAN';
  end if;

  select lower(role), lower(email)
    into v_actor_role, v_actor_email
  from public.platform_admins
  where id = p_actor_admin_id
    and is_active = true;

  if v_actor_role <> 'owner'
     or v_actor_email <> 'viniciusadm@orcaly.com'
  then
    raise exception 'FOUNDER_TEST_OWNER_ONLY';
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended('orcaly-founder-slot-allocation-v1', 0)
  );

  if exists (
    select 1
    from public.founder_invites fi
    where fi.founder_number = 0
      and fi.status in ('pending','activated')
  ) then
    raise exception 'FOUNDER_TEST_SLOT_TAKEN';
  end if;

  if exists (
    select 1
    from public.founder_invites fi
    where fi.email_normalized = v_email
      and fi.status in ('pending','activated')
  ) then
    raise exception 'FOUNDER_INVITE_ALREADY_EXISTS';
  end if;

  insert into public.founder_invites (
    email,
    founder_number,
    plan_key,
    founder_price_cents,
    status,
    token_hash,
    token_expires_at,
    invited_at,
    sales_lead_id,
    created_by_admin_id,
    created_by_email
  )
  values (
    v_email,
    0,
    v_plan,
    v_price,
    'pending',
    p_token_hash,
    p_token_expires_at,
    now(),
    null,
    p_actor_admin_id,
    v_actor_email
  )
  returning * into v_invite;

  return v_invite;
end;
$function$;

CREATE OR REPLACE FUNCTION public.create_or_claim_sales_prospect(p_actor_admin_id uuid, p_assigned_admin_id uuid, p_email text, p_empresa_nome text, p_nome_responsavel text DEFAULT NULL::text, p_whatsapp text DEFAULT NULL::text, p_segmento text DEFAULT NULL::text, p_cidade text DEFAULT NULL::text, p_estado text DEFAULT NULL::text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
declare
  v_actor_role text;
  v_target_id uuid;
  v_target_role text;
  v_email text := lower(btrim(coalesce(p_email, '')));
  v_lead public.signup_leads%rowtype;
begin
  select lower(role) into v_actor_role from public.platform_admins where id = p_actor_admin_id and is_active = true;
  if v_actor_role not in ('owner','prospector') then raise exception 'SALES_ACTOR_NOT_ALLOWED'; end if;
  if v_email = '' or position('@' in v_email) <= 1 then raise exception 'INVALID_EMAIL'; end if;
  if nullif(btrim(coalesce(p_empresa_nome, '')), '') is null then raise exception 'COMPANY_NAME_REQUIRED'; end if;
  v_target_id := coalesce(p_assigned_admin_id, p_actor_admin_id);
  select lower(role) into v_target_role from public.platform_admins where id = v_target_id and is_active = true;
  if v_target_role not in ('owner','prospector') then raise exception 'INVALID_ASSIGNEE'; end if;
  if v_actor_role = 'prospector' and v_target_id <> p_actor_admin_id then raise exception 'PROSPECTOR_CANNOT_REASSIGN'; end if;
  perform pg_advisory_xact_lock(hashtextextended(v_email, 0));
  select * into v_lead from public.signup_leads where lower(btrim(email)) = v_email order by created_at desc nulls last, id limit 1 for update;
  if found then
    if v_actor_role = 'prospector' and (v_lead.converted_company_id is not null or v_lead.sales_stage = 'cliente') then raise exception 'PROSPECT_ALREADY_CUSTOMER'; end if;
    if v_lead.assigned_to_admin_id is not null and v_lead.assigned_to_admin_id <> v_target_id then raise exception 'PROSPECT_ALREADY_ASSIGNED'; end if;
    update public.signup_leads set assigned_to_admin_id = coalesce(assigned_to_admin_id, v_target_id), created_by_admin_id = coalesce(created_by_admin_id, p_actor_admin_id), nome_responsavel = coalesce(nullif(btrim(p_nome_responsavel), ''), nome_responsavel), empresa_nome = coalesce(nullif(btrim(p_empresa_nome), ''), empresa_nome), whatsapp = coalesce(nullif(btrim(p_whatsapp), ''), whatsapp), segmento = coalesce(nullif(btrim(p_segmento), ''), segmento), cidade = coalesce(nullif(btrim(p_cidade), ''), cidade), estado = coalesce(nullif(btrim(p_estado), ''), estado), sales_stage = case when converted_company_id is not null then 'cliente' else sales_stage end, updated_at = now() where id = v_lead.id;
    return v_lead.id;
  end if;
  insert into public.signup_leads(nome_responsavel,email,whatsapp,empresa_nome,segmento,cidade,estado,status,lead_source,marketing_opt_in,sales_stage,assigned_to_admin_id,created_by_admin_id,sales_stage_updated_at,raw_data)
  values(nullif(btrim(p_nome_responsavel),''),v_email,nullif(btrim(p_whatsapp),''),btrim(p_empresa_nome),nullif(btrim(p_segmento),''),nullif(btrim(p_cidade),''),nullif(btrim(p_estado),''),'lead','prospeccao',false,'novo',v_target_id,p_actor_admin_id,now(),jsonb_build_object('sales_created',true,'sales_created_by_admin_id',p_actor_admin_id)) returning id into v_lead.id;
  return v_lead.id;
end;
$function$;

CREATE OR REPLACE FUNCTION public.expire_due_founder_trials()
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
declare v_company public.companies%rowtype; v_count integer := 0;
begin
  for v_company in
    select c.* from public.companies c
    where c.is_founder = true and c.assinatura_status = 'trialing'
      and c.trial_ends_at is not null and c.trial_ends_at <= now()
    order by c.id for update skip locked
  loop
    update public.companies c
    set assinatura_status='pendente', access_until=c.trial_ends_at,
        assinatura_expira_em=c.trial_ends_at, updated_at=now()
    where c.id=v_company.id;

    insert into public.subscription_events (
      company_id,event_type,old_status,new_status,provider,provider_reference,
      metadata,processing_status,processed_at
    ) values (
      v_company.id,'founder_trial_ended','trialing','pendente','mercado_pago',
      'founder-trial-v1',jsonb_build_object('trial_ends_at',v_company.trial_ends_at),
      'processed',now()
    ) on conflict do nothing;
    v_count := v_count + 1;
  end loop;
  return v_count;
end;
$function$;

CREATE OR REPLACE FUNCTION public.expire_marketplace_stock_reservations(p_limit integer DEFAULT 500)
 RETURNS integer
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare
  v_payment record;
  v_processed integer := 0;
begin
  for v_payment in
    select r.company_id, r.marketplace_payment_id
    from public.marketplace_stock_reservations r
    where r.status = 'reserved'
      and r.expires_at <= now()
    group by r.company_id, r.marketplace_payment_id
    order by min(r.expires_at)
    limit greatest(1, least(coalesce(p_limit, 500), 5000))
  loop
    perform public.settle_marketplace_stock(
      v_payment.company_id,
      v_payment.marketplace_payment_id,
      'expired',
      'Reserva expirada automaticamente'
    );

    v_processed := v_processed + 1;
  end loop;

  return v_processed;
end;
$function$;

CREATE OR REPLACE FUNCTION public.expire_pending_founder_invites()
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
declare v_invite public.founder_invites%rowtype; v_count integer:=0;
begin
  update public.founder_invites set status='pending',activation_claim_id=null,activation_claimed_at=null,activation_last_error='STALE_ACTIVATION_CLAIM_RECOVERED',updated_at=now() where status='activating' and activation_claimed_at < now()-interval '10 minutes';
  for v_invite in select * from public.founder_invites where status='pending' and token_expires_at is not null and token_expires_at<=now() order by id for update loop
    update public.founder_invites set status='expired',updated_at=now() where id=v_invite.id;
    if v_invite.sales_lead_id is not null then
      update public.signup_leads set sales_stage=case when sales_stage='convite_fundador' then 'demonstracao' else sales_stage end,sales_stage_updated_at=case when sales_stage='convite_fundador' then now() else sales_stage_updated_at end,updated_at=now() where id=v_invite.sales_lead_id;
      insert into public.signup_lead_followups(lead_id,channel,status,message,scheduled_for,sent_at,admin_email,created_by_admin_id,sales_event_type,raw_data) values(v_invite.sales_lead_id,'system','registrado','Convite Founder #'||lpad(v_invite.founder_number::text,2,'0')||' expirou.',now(),now(),v_invite.created_by_email,v_invite.created_by_admin_id,'system',jsonb_build_object('source','founder_program','event','invite_expired','founder_invite_id',v_invite.id,'founder_number',v_invite.founder_number));
    end if;
    v_count:=v_count+1;
  end loop;
  return v_count;
end; $function$;

CREATE OR REPLACE FUNCTION public.fail_affiliate_payout_admin(p_payout_id uuid, p_reason text)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'orcaly_private'
AS $function$
declare
  payout_row public.affiliate_payouts%rowtype;
begin
  select * into payout_row
  from public.affiliate_payouts
  where id = p_payout_id
  for update;

  if not found or payout_row.status not in ('requested','approved','processing') then
    return false;
  end if;

  update public.affiliate_payouts
  set status = 'failed',
      failure_reason = left(coalesce(p_reason, 'Falha no pagamento.'), 500),
      failed_at = now(),
      updated_at = now()
  where id = p_payout_id;

  update public.affiliate_commissions
  set status = 'available',
      payout_id = null,
      updated_at = now()
  where payout_id = p_payout_id
    and status = 'processing';

  if payout_row.debt_offset > 0 then
    update public.affiliate_profiles
    set debt_balance = debt_balance + payout_row.debt_offset,
        updated_at = now()
    where id = payout_row.affiliate_id;
  end if;

  return true;
end;
$function$;

CREATE OR REPLACE FUNCTION public.finance_touch_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
begin
  new.updated_at = now();
  return new;
end;
$function$;

CREATE OR REPLACE FUNCTION public.get_affiliate_payout_account_admin(p_affiliate_id uuid)
 RETURNS TABLE(affiliate_id uuid, pix_key_type text, pix_key_encrypted text, pix_key_masked text, holder_name text, holder_document_hash text, holder_document_last4 text, bank_name text, provider_validation jsonb, is_verified boolean, verified_at timestamp with time zone, updated_at timestamp with time zone)
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'orcaly_private'
AS $function$
  select
    a.affiliate_id,
    a.pix_key_type,
    a.pix_key_encrypted,
    a.pix_key_masked,
    a.holder_name,
    a.holder_document_hash,
    a.holder_document_last4,
    a.bank_name,
    a.provider_validation,
    a.is_verified,
    a.verified_at,
    a.updated_at
  from orcaly_private.affiliate_payout_accounts a
  where a.affiliate_id = p_affiliate_id;
$function$;

CREATE OR REPLACE FUNCTION public.get_my_platform_admin_access()
 RETURNS TABLE(admin_id uuid, admin_email text, admin_role text, admin_is_active boolean, must_change_password boolean, permissions jsonb)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
  select
    p.id,
    lower(p.email),
    case
      when lower(p.role) in ('owner', 'super_admin') then 'owner'
      when lower(p.role) in ('support', 'suporte') then 'support'
      when lower(p.role) = 'finance' then 'finance'
      when lower(p.role) = 'prospector' then 'prospector'
      when lower(p.role) = 'admin' then 'admin'
      else null
    end,
    p.is_active,
    p.must_change_password,
    coalesce(p.permissions, '{}'::jsonb)
  from public.platform_admins p
  where p.user_id = auth.uid()
    and p.is_active = true
    and lower(p.role) in ('owner','super_admin','admin','finance','support','suporte','prospector')
  order by
    case
      when lower(p.role) in ('owner', 'super_admin') then 0
      when lower(p.role) = 'admin' then 1
      when lower(p.role) = 'finance' then 2
      when lower(p.role) in ('support','suporte') then 3
      when lower(p.role) = 'prospector' then 4
      else 9
    end,
    p.created_at
  limit 1;
$function$;

CREATE OR REPLACE FUNCTION public.get_platform_qa_vercel_share()
 RETURNS text
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'vault', 'pg_catalog'
AS $function$
  select decrypted_secret
  from vault.decrypted_secrets
  where name = 'orcaly.platform_evolution.qa_vercel_share'
  order by updated_at desc
  limit 1
$function$;

CREATE OR REPLACE FUNCTION public.integration_credentials_delete(p_company_id uuid, p_connection_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog'
AS $function$
declare v_secret_id uuid;
begin
  select c.credentials_reference into v_secret_id from public.integration_connections c where c.id = p_connection_id and c.company_id = p_company_id for update;
  if not found then raise exception 'integration connection not found'; end if;
  if v_secret_id is not null then
    delete from vault.secrets where id = v_secret_id;
    update public.integration_connections set credentials_reference = null, updated_at = now() where id = p_connection_id and company_id = p_company_id;
  end if;
end; $function$;

CREATE OR REPLACE FUNCTION public.integration_credentials_read(p_company_id uuid, p_connection_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog'
AS $function$
declare v_secret jsonb;
begin
  select ds.decrypted_secret::jsonb into v_secret from public.integration_connections c join vault.decrypted_secrets ds on ds.id = c.credentials_reference where c.id = p_connection_id and c.company_id = p_company_id;
  return v_secret;
end; $function$;

CREATE OR REPLACE FUNCTION public.integration_credentials_store(p_company_id uuid, p_connection_id uuid, p_secret text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog'
AS $function$
declare v_secret_id uuid;
begin
  if p_secret is null or length(p_secret) = 0 then raise exception 'empty integration credential'; end if;
  select c.credentials_reference into v_secret_id from public.integration_connections c where c.id = p_connection_id and c.company_id = p_company_id for update;
  if not found then raise exception 'integration connection not found'; end if;
  if v_secret_id is null then
    select vault.create_secret(p_secret,'orcaly.integration.' || p_connection_id::text,'Orçaly integration credential bundle') into v_secret_id;
    update public.integration_connections set credentials_reference = v_secret_id, updated_at = now() where id = p_connection_id and company_id = p_company_id;
  else
    perform vault.update_secret(v_secret_id, p_secret);
  end if;
  return v_secret_id;
end; $function$;

CREATE OR REPLACE FUNCTION public.integration_oauth_pkce_store(p_company_id uuid, p_state_id uuid, p_verifier text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog'
AS $function$
declare
  v_secret_id uuid;
begin
  if p_verifier is null or length(p_verifier) < 43 then
    raise exception 'invalid PKCE verifier';
  end if;

  perform 1
  from public.integration_oauth_states s
  where s.id = p_state_id
    and s.company_id = p_company_id
    and s.consumed_at is null
    and s.expires_at > now()
  for update;

  if not found then
    raise exception 'oauth state not available';
  end if;

  select vault.create_secret(
    p_verifier,
    'orcaly.oauth.pkce.' || p_state_id::text,
    'Orçaly integration OAuth PKCE verifier'
  ) into v_secret_id;

  update public.integration_oauth_states
  set pkce_reference = v_secret_id
  where id = p_state_id and company_id = p_company_id;

  return v_secret_id;
end;
$function$;

CREATE OR REPLACE FUNCTION public.integration_oauth_state_consume(p_company_id uuid, p_user_id uuid, p_provider text, p_nonce_hash text)
 RETURNS TABLE(state_id uuid, requested_scopes text[], pkce_verifier text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog'
AS $function$
declare
  v_state public.integration_oauth_states%rowtype;
  v_verifier text;
begin
  select s.* into v_state
  from public.integration_oauth_states s
  where s.company_id = p_company_id
    and s.user_id = p_user_id
    and s.provider = p_provider
    and s.nonce_hash = p_nonce_hash
    and s.consumed_at is null
    and s.expires_at > now()
  for update;

  if not found then
    return;
  end if;

  if v_state.pkce_reference is null then
    raise exception 'oauth PKCE verifier missing';
  end if;

  select ds.decrypted_secret
    into v_verifier
  from vault.decrypted_secrets ds
  where ds.id = v_state.pkce_reference;

  if v_verifier is null then
    raise exception 'oauth PKCE verifier unavailable';
  end if;

  update public.integration_oauth_states
  set consumed_at = now(), pkce_reference = null
  where id = v_state.id;

  delete from vault.secrets where id = v_state.pkce_reference;

  state_id := v_state.id;
  requested_scopes := v_state.requested_scopes;
  pkce_verifier := v_verifier;
  return next;
end;
$function$;

CREATE OR REPLACE FUNCTION public.integration_refresh_lock(p_company_id uuid, p_connection_id uuid, p_lock_id uuid, p_ttl_seconds integer DEFAULT 45)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog'
AS $function$
declare
  v_acquired boolean := false;
  v_ttl interval;
begin
  v_ttl := make_interval(secs => greatest(5, least(coalesce(p_ttl_seconds, 45), 120)));

  update public.integration_connections c
  set refresh_lock_id = p_lock_id,
      refresh_locked_at = now(),
      updated_at = now()
  where c.id = p_connection_id
    and c.company_id = p_company_id
    and (
      c.refresh_lock_id is null
      or c.refresh_locked_at is null
      or c.refresh_locked_at < now() - v_ttl
    );

  v_acquired := found;
  return v_acquired;
end;
$function$;

CREATE OR REPLACE FUNCTION public.integration_refresh_unlock(p_company_id uuid, p_connection_id uuid, p_lock_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog'
AS $function$
begin
  update public.integration_connections c
  set refresh_lock_id = null,
      refresh_locked_at = null,
      updated_at = now()
  where c.id = p_connection_id
    and c.company_id = p_company_id
    and c.refresh_lock_id = p_lock_id;
end;
$function$;

CREATE OR REPLACE FUNCTION public.limit_company_members()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare active_count integer;
begin
  if new.status = 'ativo' then
    select count(*) into active_count
    from public.company_members
    where company_id = new.company_id
      and status = 'ativo'
      and id <> coalesce(new.id, gen_random_uuid());

    if active_count >= 2 then
      raise exception 'Limite de 2 funcionarios ativos por empresa atingido.';
    end if;
  end if;

  return new;
end;
$function$;

CREATE OR REPLACE FUNCTION public.list_affiliate_payout_accounts_admin()
 RETURNS TABLE(affiliate_id uuid, pix_key_type text, pix_key_masked text, holder_name text, holder_document_last4 text, bank_name text, is_verified boolean, verified_at timestamp with time zone, updated_at timestamp with time zone)
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'orcaly_private'
AS $function$
  select
    a.affiliate_id,
    a.pix_key_type,
    a.pix_key_masked,
    a.holder_name,
    a.holder_document_last4,
    a.bank_name,
    a.is_verified,
    a.verified_at,
    a.updated_at
  from orcaly_private.affiliate_payout_accounts a
  order by a.updated_at desc;
$function$;

CREATE OR REPLACE FUNCTION public.mark_affiliate_payout_paid_admin(p_payout_id uuid, p_provider text, p_provider_transfer_id text, p_proof_url text DEFAULT NULL::text)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'orcaly_private'
AS $function$
begin
  update public.affiliate_payouts
  set status = 'paid',
      provider = case when p_provider in ('manual','asaas') then p_provider else provider end,
      provider_transfer_id = nullif(trim(p_provider_transfer_id), ''),
      proof_url = nullif(trim(p_proof_url), ''),
      paid_at = now(),
      updated_at = now()
  where id = p_payout_id
    and status in ('requested','approved','processing');

  if not found then
    return false;
  end if;

  update public.affiliate_commissions
  set status = 'paid',
      updated_at = now()
  where payout_id = p_payout_id
    and status = 'processing';

  return true;
end;
$function$;

CREATE OR REPLACE FUNCTION public.merge_customer_profiles(p_company_id uuid, p_primary uuid, p_duplicate uuid, p_actor uuid DEFAULT NULL::uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$ declare a public.customer_profiles%rowtype; b public.customer_profiles%rowtype; begin if p_primary=p_duplicate then raise exception 'SAME_CUSTOMER' using errcode='22023'; end if; select * into a from public.customer_profiles where id=p_primary and company_id=p_company_id and archived=false for update; select * into b from public.customer_profiles where id=p_duplicate and company_id=p_company_id and archived=false for update; if a.id is null or b.id is null then raise exception 'CUSTOMER_NOT_FOUND_OR_TENANT_MISMATCH' using errcode='42501'; end if; update public.orders set customer_profile_id=p_primary where company_id=p_company_id and customer_profile_id=p_duplicate; update public.proposals set customer_profile_id=p_primary where company_id=p_company_id and customer_profile_id=p_duplicate; update public.crm_leads set customer_profile_id=p_primary where company_id=p_company_id and customer_profile_id=p_duplicate; update public.customer_notes set customer_profile_id=p_primary where company_id=p_company_id and customer_profile_id=p_duplicate; update public.customer_followups set customer_profile_id=p_primary where company_id=p_company_id and customer_profile_id=p_duplicate; update public.financial_transactions set customer_profile_id=p_primary where company_id=p_company_id and customer_profile_id=p_duplicate; update public.timeline_events set customer_profile_id=p_primary where company_id=p_company_id and customer_profile_id=p_duplicate; update public.customer_profiles set display_name=coalesce(a.display_name,b.display_name),normalized_name=coalesce(a.normalized_name,b.normalized_name),phone_raw=coalesce(a.phone_raw,b.phone_raw),phone_normalized=coalesce(a.phone_normalized,b.phone_normalized),email_raw=coalesce(a.email_raw,b.email_raw),email_normalized=coalesce(a.email_normalized,b.email_normalized),last_activity_at=greatest(coalesce(a.last_activity_at,'epoch'::timestamptz),coalesce(b.last_activity_at,'epoch'::timestamptz)),updated_by=p_actor,updated_at=now(),metadata=a.metadata||b.metadata where id=p_primary; update public.customer_profiles set archived=true,merged_into_id=p_primary,updated_by=p_actor,updated_at=now() where id=p_duplicate; update public.customer_duplicate_candidates set status='merged',reviewed_by=p_actor,reviewed_at=now(),updated_at=now() where company_id=p_company_id and status='needs_review' and ((left_customer_id=p_primary and right_customer_id=p_duplicate) or (left_customer_id=p_duplicate and right_customer_id=p_primary)); insert into public.timeline_events(company_id,customer_profile_id,aggregate_type,aggregate_id,event_type,title,source,actor_id,metadata) values(p_company_id,p_primary,'customer',p_primary,'customer.merged','Perfis de cliente mesclados','manual',p_actor,jsonb_build_object('merged_customer_id',p_duplicate)); return jsonb_build_object('ok',true,'primary',p_primary,'merged',p_duplicate); end; $function$;

CREATE OR REPLACE FUNCTION public.orcaly_consume_rate_limit(p_key text, p_limit integer, p_window_seconds integer)
 RETURNS TABLE(allowed boolean, remaining integer, reset_at timestamp with time zone)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_now timestamptz := clock_timestamp();
  v_window_started timestamptz;
  v_count integer;
begin
  if p_key is null or length(p_key) < 16 or length(p_key) > 128 then
    raise exception 'invalid rate limit key';
  end if;

  if p_limit < 1 or p_limit > 100000 then
    raise exception 'invalid rate limit';
  end if;

  if p_window_seconds < 1 or p_window_seconds > 604800 then
    raise exception 'invalid rate limit window';
  end if;

  insert into orcaly_private.api_rate_limits (
    key,
    window_started_at,
    request_count,
    updated_at
  )
  values (p_key, v_now, 0, v_now)
  on conflict (key) do nothing;

  select window_started_at, request_count
    into v_window_started, v_count
  from orcaly_private.api_rate_limits
  where key = p_key
  for update;

  if v_window_started + make_interval(secs => p_window_seconds) <= v_now then
    v_window_started := v_now;
    v_count := 1;

    update orcaly_private.api_rate_limits
    set window_started_at = v_window_started,
        request_count = v_count,
        updated_at = v_now
    where key = p_key;

    return query
      select true, greatest(0, p_limit - v_count),
        v_window_started + make_interval(secs => p_window_seconds);
    return;
  end if;

  if v_count >= p_limit then
    return query
      select false, 0,
        v_window_started + make_interval(secs => p_window_seconds);
    return;
  end if;

  v_count := v_count + 1;

  update orcaly_private.api_rate_limits
  set request_count = v_count,
      updated_at = v_now
  where key = p_key;

  return query
    select true, greatest(0, p_limit - v_count),
      v_window_started + make_interval(secs => p_window_seconds);
end;
$function$;

CREATE OR REPLACE FUNCTION public.orcaly_mirror_payment_webhook_event()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$ begin insert into public.event_idempotency(provider,event_id,company_id,event_type,payload_hash,received_at,processed_at,status,attempt,last_error,metadata) values(new.provider,new.provider_event_id,new.company_id,new.event_type,new.payload_hash,coalesce(new.received_at,now()),new.processed_at,case when new.processing_status in ('processed','success','completed','done') then 'processed' when new.processing_status in ('failed','error') then 'failed' else 'received' end,greatest(coalesce(new.attempts,1),1),new.error_message,jsonb_build_object('provider_object_id',new.provider_object_id)) on conflict(provider,event_id) do update set company_id=coalesce(excluded.company_id,public.event_idempotency.company_id),event_type=excluded.event_type,payload_hash=coalesce(excluded.payload_hash,public.event_idempotency.payload_hash),processed_at=coalesce(excluded.processed_at,public.event_idempotency.processed_at),status=excluded.status,attempt=greatest(public.event_idempotency.attempt,excluded.attempt),last_error=excluded.last_error,metadata=public.event_idempotency.metadata||excluded.metadata; return new; end; $function$;

CREATE OR REPLACE FUNCTION public.orcaly_mirror_whatsapp_webhook_event()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$ begin insert into public.event_idempotency(provider,event_id,company_id,event_type,payload_hash,received_at,processed_at,status,attempt,last_error) values('whatsapp',new.event_key,new.company_id,new.event_type,new.payload_hash,coalesce(new.received_at,now()),new.processed_at,case when new.processing_status='processed' then 'processed' when new.processing_status='ignored' then 'ignored' when new.processing_status='failed' then 'failed' else 'processing' end,1,new.error_message) on conflict(provider,event_id) do update set company_id=coalesce(excluded.company_id,public.event_idempotency.company_id),event_type=excluded.event_type,payload_hash=coalesce(excluded.payload_hash,public.event_idempotency.payload_hash),processed_at=coalesce(excluded.processed_at,public.event_idempotency.processed_at),status=excluded.status,last_error=excluded.last_error; return new; end; $function$;

CREATE OR REPLACE FUNCTION public.orcaly_normalize_email(p_value text)
 RETURNS text
 LANGUAGE sql
 IMMUTABLE STRICT
 SET search_path TO ''
AS $function$ select nullif(lower(btrim(p_value)), '') $function$;

CREATE OR REPLACE FUNCTION public.orcaly_normalize_name(p_value text)
 RETURNS text
 LANGUAGE sql
 IMMUTABLE STRICT
 SET search_path TO ''
AS $function$ select nullif(regexp_replace(lower(btrim(p_value)), '[^a-z0-9áàâãéèêíïóôõöúçñ ]', '', 'g'), '') $function$;

CREATE OR REPLACE FUNCTION public.orcaly_normalize_phone_br(p_value text)
 RETURNS text
 LANGUAGE plpgsql
 IMMUTABLE STRICT
 SET search_path TO ''
AS $function$ declare digits text; begin digits := regexp_replace(p_value, '[^0-9]', '', 'g'); if digits = '' then return null; end if; if length(digits) in (10,11) then return '+55' || digits; end if; if length(digits) in (12,13) and left(digits,2) = '55' then return '+' || digits; end if; return null; end; $function$;

CREATE OR REPLACE FUNCTION public.orcaly_record_business_event()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$ declare v_event_type text; v_title text; v_company_id uuid; v_source text; v_status text; v_old_status text; begin v_company_id:=new.company_id; if v_company_id is null then return new; end if; v_source:=case when lower(coalesce(to_jsonb(new)->>'source',to_jsonb(new)->>'origem',to_jsonb(new)->>'canal_origem','')) in ('manual') then 'manual' when lower(coalesce(to_jsonb(new)->>'source',to_jsonb(new)->>'origem',to_jsonb(new)->>'canal_origem','')) in ('whatsapp') then 'whatsapp' when lower(coalesce(to_jsonb(new)->>'source',to_jsonb(new)->>'origem',to_jsonb(new)->>'canal_origem','')) in ('api') then 'api' when lower(coalesce(to_jsonb(new)->>'source',to_jsonb(new)->>'origem',to_jsonb(new)->>'canal_origem','')) in ('automation','automacao') then 'automation' when lower(coalesce(to_jsonb(new)->>'source',to_jsonb(new)->>'origem',to_jsonb(new)->>'canal_origem','')) in ('ai','ia') then 'ai' when lower(coalesce(to_jsonb(new)->>'source',to_jsonb(new)->>'origem',to_jsonb(new)->>'canal_origem','')) in ('portal','customer_portal') then 'portal' else 'public_site' end; if tg_table_name='orders' then if tg_op='INSERT' then v_event_type:='order.created'; v_title:='Pedido criado'; insert into public.transactional_outbox(company_id,event_type,aggregate_type,aggregate_id,payload) values(v_company_id,v_event_type,'order',new.id,jsonb_build_object('order_id',new.id,'source',v_source)); insert into public.timeline_events(company_id,aggregate_type,aggregate_id,event_type,title,source,metadata) values(v_company_id,'order',new.id,v_event_type,v_title,v_source,jsonb_build_object('status',new.status)); elsif tg_op='UPDATE' then v_status:=lower(coalesce(new.status,'')); v_old_status:=lower(coalesce(old.status,'')); if v_status is distinct from v_old_status then insert into public.timeline_events(company_id,aggregate_type,aggregate_id,event_type,title,source,metadata) values(v_company_id,'order',new.id,'order.status_changed','Status do pedido alterado',v_source,jsonb_build_object('from',old.status,'to',new.status)); if v_status in ('pronto','ready','pronto_para_entrega','pronto para entrega') then insert into public.transactional_outbox(company_id,event_type,aggregate_type,aggregate_id,payload) values(v_company_id,'order.ready','order',new.id,jsonb_build_object('order_id',new.id,'status',new.status)); end if; end if; if lower(coalesce(new.payment_status,'')) is distinct from lower(coalesce(old.payment_status,'')) and lower(coalesce(new.payment_status,'')) in ('paid','approved','pago','aprovado','authorized') then insert into public.transactional_outbox(company_id,event_type,aggregate_type,aggregate_id,payload) values(v_company_id,'payment.confirmed','order',new.id,jsonb_build_object('order_id',new.id,'payment_status',new.payment_status)); insert into public.timeline_events(company_id,aggregate_type,aggregate_id,event_type,title,source,metadata) values(v_company_id,'order',new.id,'payment.confirmed','Pagamento confirmado','provider',jsonb_build_object('payment_status',new.payment_status,'payment_provider',new.payment_provider)); end if; end if; elsif tg_table_name='proposals' then if tg_op='INSERT' then insert into public.timeline_events(company_id,aggregate_type,aggregate_id,event_type,title,source,metadata) values(v_company_id,'proposal',new.id,'proposal.created','Proposta criada',v_source,jsonb_build_object('status',new.status)); elsif tg_op='UPDATE' then v_status:=lower(coalesce(new.status,'')); v_old_status:=lower(coalesce(old.status,'')); if v_status is distinct from v_old_status then insert into public.timeline_events(company_id,aggregate_type,aggregate_id,event_type,title,source,metadata) values(v_company_id,'proposal',new.id,'proposal.status_changed','Status da proposta alterado',v_source,jsonb_build_object('from',old.status,'to',new.status)); if v_status in ('approved','aprovado','aprovada') then insert into public.transactional_outbox(company_id,event_type,aggregate_type,aggregate_id,payload) values(v_company_id,'proposal.accepted','proposal',new.id,jsonb_build_object('proposal_id',new.id,'status',new.status)); end if; end if; end if; end if; return new; end; $function$;

CREATE OR REPLACE FUNCTION public.preview_founder_activation(p_token_hash text)
 RETURNS TABLE(invite_id uuid, email text, founder_number integer, plan_key text, founder_price_cents integer, token_expires_at timestamp with time zone, sales_lead_id uuid, empresa_nome text, nome_responsavel text, whatsapp text, segmento text, modelo_negocio text, cidade text, estado text, slug_sugerido text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
begin
  perform public.expire_pending_founder_invites();
  if p_token_hash is null or p_token_hash !~ '^[0-9a-f]{64}$' then return; end if;
  return query select fi.id,fi.email,fi.founder_number,fi.plan_key,fi.founder_price_cents,fi.token_expires_at,fi.sales_lead_id,sl.empresa_nome,sl.nome_responsavel,sl.whatsapp,sl.segmento,sl.modelo_negocio,sl.cidade,sl.estado,sl.slug_sugerido from public.founder_invites fi left join public.signup_leads sl on sl.id=fi.sales_lead_id where fi.token_hash=p_token_hash and fi.status='pending' and (fi.token_expires_at is null or fi.token_expires_at>now()) limit 1;
end; $function$;

CREATE OR REPLACE FUNCTION public.protect_company_trial_used_at()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
begin
  if old.trial_used_at is not null and new.trial_used_at is null then
    new.trial_used_at := old.trial_used_at;
  end if;
  return new;
end;
$function$;

CREATE OR REPLACE FUNCTION public.record_founder_payment_approved(p_company_id uuid, p_subscription_id text, p_payment_id text, p_next_payment_date timestamp with time zone, p_provider_payload jsonb)
 RETURNS companies
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
declare
  v_company public.companies%rowtype;
  v_access_until timestamptz;
  v_lead_id uuid;
begin
  select c.* into v_company from public.companies c
  where c.id=p_company_id and c.is_founder=true for update;
  if not found then raise exception 'FOUNDER_PAYMENT_COMPANY_NOT_FOUND'; end if;
  if nullif(btrim(coalesce(p_subscription_id,'')),'') is null then
    raise exception 'FOUNDER_PAYMENT_SUBSCRIPTION_REQUIRED';
  end if;

  v_access_until := case
    when p_next_payment_date is not null and p_next_payment_date > now() then p_next_payment_date
    else now() + interval '1 month' end;

  update public.companies c
  set ativo=true, assinatura_status='ativa', assinatura_auto_recorrente=true,
      assinatura_inicio=coalesce(c.assinatura_inicio,now()),
      assinatura_expira_em=v_access_until, access_until=v_access_until,
      assinatura_ultimo_pagamento=now(), assinatura_proxima_cobranca=p_next_payment_date,
      next_billing_at=p_next_payment_date, subscription_provider='mercado_pago',
      provider_subscription_id=p_subscription_id, mercado_pago_subscription_id=p_subscription_id,
      mercado_pago_subscription_status='authorized',
      assinatura_mp_payload=coalesce(p_provider_payload,'{}'::jsonb),
      founder_billing_authorized_at=coalesce(c.founder_billing_authorized_at,now()),
      founder_billing_last_sync_at=now(), updated_at=now()
  where c.id=p_company_id returning c.* into v_company;

  update public.plan_payments pp
  set provider='mercado_pago', provider_subscription_id=p_subscription_id,
      mercado_pago_preapproval_id=p_subscription_id,
      provider_payment_id=nullif(btrim(coalesce(p_payment_id,'')),''),
      mercado_pago_payment_id=nullif(btrim(coalesce(p_payment_id,'')),''),
      paid_at=coalesce(pp.paid_at,now()), next_payment_date=p_next_payment_date,
      raw_subscription=coalesce(p_provider_payload,pp.raw_subscription),
      status='approved', updated_at=now()
  where pp.company_id=p_company_id and pp.idempotency_key='founder-recurring-v1';

  insert into public.subscription_events (
    company_id,event_type,old_status,new_status,provider,provider_reference,
    provider_object_id,metadata,processing_status,processed_at
  ) values (
    p_company_id,'founder_subscription_started',null,'ativa','mercado_pago',p_subscription_id,
    nullif(btrim(coalesce(p_payment_id,'')),''),
    jsonb_build_object('founder_number',v_company.founder_number,'payment_id',p_payment_id,
      'next_payment_date',p_next_payment_date),'processed',now()
  ) on conflict do nothing;

  update public.signup_leads sl
  set sales_stage='cliente',sales_stage_updated_at=now(),updated_at=now()
  where sl.converted_company_id=p_company_id and sl.sales_stage='conta_ativada'
  returning sl.id into v_lead_id;

  if v_lead_id is not null then
    insert into public.signup_lead_followups (
      lead_id,channel,status,message,scheduled_for,sent_at,admin_email,
      created_by_admin_id,sales_event_type,raw_data
    )
    select v_lead_id,'system','registrado',
      'Primeira cobrança do Cliente Founder confirmada; etapa alterada para cliente.',
      now(),now(),fi.created_by_email,fi.created_by_admin_id,'system',
      jsonb_build_object('source','founder_program','event','first_payment_approved','payment_id',p_payment_id)
    from public.founder_invites fi
    where fi.company_id=p_company_id and fi.status='activated'
    order by fi.activated_at desc limit 1;
  end if;

  return v_company;
end;
$function$;

CREATE OR REPLACE FUNCTION public.record_signup_lead_sales_followup(p_lead_id uuid, p_actor_admin_id uuid, p_channel text, p_message text, p_next_action_at timestamp with time zone DEFAULT NULL::timestamp with time zone)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
declare
  v_actor_role text;
  v_actor_email text;
  v_assigned_to uuid;
  v_channel text := lower(btrim(coalesce(p_channel, '')));
  v_followup_id uuid;
begin
  if v_channel not in ('whatsapp','telefone','email','reuniao','nota') then
    raise exception 'INVALID_CONTACT_CHANNEL';
  end if;

  if nullif(btrim(coalesce(p_message, '')), '') is null then
    raise exception 'MESSAGE_REQUIRED';
  end if;

  select lower(role), lower(email)
    into v_actor_role, v_actor_email
  from public.platform_admins
  where id = p_actor_admin_id
    and is_active = true;

  if v_actor_role not in ('owner','prospector') then
    raise exception 'SALES_ACTOR_NOT_ALLOWED';
  end if;

  select assigned_to_admin_id
    into v_assigned_to
  from public.signup_leads
  where id = p_lead_id
  for update;

  if not found then
    raise exception 'LEAD_NOT_FOUND';
  end if;

  if v_actor_role = 'prospector'
     and v_assigned_to is distinct from p_actor_admin_id
  then
    raise exception 'LEAD_NOT_OWNED';
  end if;

  insert into public.signup_lead_followups (
    lead_id, channel, status, message, scheduled_for, sent_at,
    admin_email, created_by_admin_id, sales_event_type, raw_data
  )
  values (
    p_lead_id,
    v_channel,
    'registrado',
    btrim(p_message),
    now(), now(), v_actor_email, p_actor_admin_id,
    case when v_channel = 'nota' then 'note' else 'contact' end,
    jsonb_build_object('source', 'sales_crm', 'next_action_at', p_next_action_at)
  )
  returning id into v_followup_id;

  update public.signup_leads
  set followup_count = followup_count + 1,
      last_followup_at = now(),
      sales_last_contact_at = now(),
      next_followup_at = p_next_action_at,
      sales_next_action_at = p_next_action_at,
      updated_at = now()
  where id = p_lead_id;

  return v_followup_id;
end;
$function$;

CREATE OR REPLACE FUNCTION public.recover_stale_background_jobs(p_stale_seconds integer DEFAULT 300, p_limit integer DEFAULT 25)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog'
AS $function$
declare
  v_count integer := 0;
  v_stale_seconds integer := greatest(60, least(coalesce(p_stale_seconds, 300), 3600));
  v_limit integer := greatest(1, least(coalesce(p_limit, 25), 50));
begin
  with picked as (
    select j.id
    from public.background_jobs j
    where j.status = 'running'
      and j.locked_at is not null
      and j.locked_at <= now() - make_interval(secs => v_stale_seconds)
    order by j.locked_at asc
    for update skip locked
    limit v_limit
  )
  update public.background_jobs j
  set status = case when j.attempts >= j.max_attempts then 'needs_attention' else 'retrying' end,
      run_after = case when j.attempts >= j.max_attempts then j.run_after else now() + interval '30 seconds' end,
      locked_at = null,
      locked_by = null,
      completed_at = case when j.attempts >= j.max_attempts then now() else null end,
      last_error = 'stale_worker_lock_recovered',
      metadata = coalesce(j.metadata, '{}'::jsonb) || jsonb_build_object('stale_recovered_at', now())
  from picked
  where j.id = picked.id;

  get diagnostics v_count = row_count;
  return v_count;
end;
$function$;

CREATE OR REPLACE FUNCTION public.refresh_company_data_quality(p_company_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
declare
  v_open integer;
  v_score integer;
begin
  perform public.refresh_company_data_quality_v1(p_company_id);

  insert into public.data_quality_issues(
    company_id,fingerprint,rule_key,severity,entity_type,entity_id,title,detail,
    recommended_action,auto_fixable,status,last_seen_at,resolved_at
  )
  select p_company_id,md5('finance_missing_amount:'||f.id::text),'finance_missing_amount','HIGH',
    'financial_transaction',f.id::text,'Lançamento financeiro sem valor',
    'Transação financeira não possui valor efetivo em nenhum dos campos canônicos/legados.',
    'Revise o lançamento manualmente; não preencha valores automaticamente.',false,'open',now(),null
  from public.financial_transactions f
  where f.company_id=p_company_id
    and coalesce(f.amount,0)=0
    and coalesce(f.valor,0)=0
  on conflict(company_id,fingerprint) do update
    set status='open',last_seen_at=now(),resolved_at=null,detail=excluded.detail;

  insert into public.data_quality_issues(
    company_id,fingerprint,rule_key,severity,entity_type,entity_id,title,detail,
    recommended_action,auto_fixable,status,last_seen_at,resolved_at
  )
  select p_company_id,md5('art_missing_object_reference:'||a.id::text),'art_missing_object_reference','HIGH',
    'art_approval',a.id::text,'Arte sem referência de arquivo',
    'Solicitação ativa de aprovação não possui URL de arte.',
    'Reenvie a arte e confirme o objeto no Storage.',false,'open',now(),null
  from public.art_approval_requests a
  where a.company_id=p_company_id
    and lower(btrim(coalesce(a.status,''))) in (
      'pending','pendente','aguardando','sent','enviado',
      'aguardando aprovação da arte','aguardando aprovacao da arte'
    )
    and nullif(btrim(a.artwork_url),'') is null
  on conflict(company_id,fingerprint) do update
    set status='open',last_seen_at=now(),resolved_at=null,detail=excluded.detail;

  select count(*) into v_open
  from public.data_quality_issues
  where company_id=p_company_id and status='open';

  select greatest(0,100-coalesce(sum(
    case severity
      when 'CRITICAL' then 25
      when 'HIGH' then 10
      when 'MEDIUM' then 4
      when 'LOW' then 1
      else 0
    end
  ),0))::integer
  into v_score
  from public.data_quality_issues
  where company_id=p_company_id and status='open';

  return jsonb_build_object(
    'score',v_score,
    'open',v_open,
    'critical',(select count(*) from public.data_quality_issues where company_id=p_company_id and status='open' and severity='CRITICAL'),
    'high',(select count(*) from public.data_quality_issues where company_id=p_company_id and status='open' and severity='HIGH'),
    'medium',(select count(*) from public.data_quality_issues where company_id=p_company_id and status='open' and severity='MEDIUM'),
    'low',(select count(*) from public.data_quality_issues where company_id=p_company_id and status='open' and severity='LOW'),
    'info',(select count(*) from public.data_quality_issues where company_id=p_company_id and status='open' and severity='INFO')
  );
end;
$function$;

CREATE OR REPLACE FUNCTION public.refresh_company_data_quality_v1(p_company_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$ declare v_open integer; v_score integer; begin if p_company_id is null or not exists(select 1 from public.companies where id=p_company_id) then raise exception 'COMPANY_NOT_FOUND' using errcode='22023'; end if; perform public.refresh_customer_directory(p_company_id); update public.data_quality_issues set status='resolved',resolved_at=now() where company_id=p_company_id and status='open';
insert into public.data_quality_issues(company_id,fingerprint,rule_key,severity,entity_type,entity_id,title,detail,recommended_action,auto_fixable,status,last_seen_at,resolved_at) select p_company_id,md5('customer_missing_contact:'||c.id::text),'customer_missing_contact','MEDIUM','customer',c.id::text,'Cliente sem contato','Não há telefone nem e-mail normalizado para este cliente.','Adicione ao menos um meio de contato válido.',false,'open',now(),null from public.customer_profiles c where c.company_id=p_company_id and c.archived=false and c.phone_normalized is null and c.email_normalized is null on conflict(company_id,fingerprint) do update set status='open',last_seen_at=now(),resolved_at=null,detail=excluded.detail;
insert into public.data_quality_issues(company_id,fingerprint,rule_key,severity,entity_type,entity_id,title,detail,recommended_action,auto_fixable,status,last_seen_at,resolved_at) select p_company_id,md5('customer_invalid_phone:'||c.id::text),'customer_invalid_phone','HIGH','customer',c.id::text,'Telefone inválido','O telefone informado não pôde ser normalizado com segurança para E.164 Brasil.','Revise DDD, quantidade de dígitos e código do país.',false,'open',now(),null from public.customer_profiles c where c.company_id=p_company_id and c.archived=false and nullif(btrim(c.phone_raw),'') is not null and c.phone_normalized is null on conflict(company_id,fingerprint) do update set status='open',last_seen_at=now(),resolved_at=null,detail=excluded.detail;
insert into public.data_quality_issues(company_id,fingerprint,rule_key,severity,entity_type,entity_id,title,detail,recommended_action,auto_fixable,status,last_seen_at,resolved_at) select p_company_id,md5('customer_invalid_email:'||c.id::text),'customer_invalid_email','HIGH','customer',c.id::text,'E-mail inválido','O e-mail informado não possui uma estrutura válida.','Corrija o endereço de e-mail antes de utilizá-lo em comunicação.',false,'open',now(),null from public.customer_profiles c where c.company_id=p_company_id and c.archived=false and nullif(btrim(c.email_raw),'') is not null and c.email_normalized !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' on conflict(company_id,fingerprint) do update set status='open',last_seen_at=now(),resolved_at=null,detail=excluded.detail;
insert into public.data_quality_issues(company_id,fingerprint,rule_key,severity,entity_type,entity_id,title,detail,recommended_action,auto_fixable,status,metadata,last_seen_at,resolved_at) select p_company_id,md5('customer_duplicate:'||d.id::text),'customer_duplicate_candidate','MEDIUM','customer_duplicate',d.id::text,'Possível cliente duplicado','Dois perfis apresentam sinais determinísticos de duplicidade.','Revise as diferenças antes de mesclar. Nenhum merge automático será executado.',false,'open',jsonb_build_object('confidence',d.confidence,'reasons',d.reasons),now(),null from public.customer_duplicate_candidates d where d.company_id=p_company_id and d.status='needs_review' on conflict(company_id,fingerprint) do update set status='open',last_seen_at=now(),resolved_at=null,metadata=excluded.metadata;
insert into public.data_quality_issues(company_id,fingerprint,rule_key,severity,entity_type,entity_id,title,detail,recommended_action,auto_fixable,status,last_seen_at,resolved_at) select p_company_id,md5('order_no_items:'||o.id::text),'order_no_items','HIGH','order',o.id::text,'Pedido sem itens','O pedido não possui item relacional, snapshot nem produto legado identificável.','Revise o pedido e associe pelo menos um item real.',false,'open',now(),null from public.orders o where o.company_id=p_company_id and not exists(select 1 from public.order_items i where i.order_id=o.id) and (o.items_snapshot is null or o.items_snapshot='[]'::jsonb or o.items_snapshot='{}'::jsonb) and nullif(btrim(o.produto),'') is null on conflict(company_id,fingerprint) do update set status='open',last_seen_at=now(),resolved_at=null;
insert into public.data_quality_issues(company_id,fingerprint,rule_key,severity,entity_type,entity_id,title,detail,recommended_action,auto_fixable,status,last_seen_at,resolved_at) select p_company_id,md5('order_negative_total:'||o.id::text),'order_negative_total','CRITICAL','order',o.id::text,'Total de pedido impossível','O valor total efetivo do pedido é negativo.','Revise itens, desconto e total. Não há auto-fix financeiro.',false,'open',now(),null from public.orders o where o.company_id=p_company_id and coalesce(o.total_amount,o.total,o.valor_total,o.preco_estimado,0)<0 on conflict(company_id,fingerprint) do update set status='open',last_seen_at=now(),resolved_at=null;
with item_totals as (select i.order_id,sum(coalesce(i.total,i.subtotal,(coalesce(i.quantity,0)::numeric*coalesce(i.unit_price,0)),(coalesce(i.quantidade,0)*coalesce(i.preco_unitario,0)),0)) as items_total from public.order_items i where i.company_id=p_company_id group by i.order_id) insert into public.data_quality_issues(company_id,fingerprint,rule_key,severity,entity_type,entity_id,title,detail,recommended_action,auto_fixable,status,metadata,last_seen_at,resolved_at) select p_company_id,md5('order_total_mismatch:'||o.id::text),'order_total_mismatch','HIGH','order',o.id::text,'Total do pedido diverge dos itens','A soma dos itens diverge do total armazenado em mais de R$ 0,05.','Revise os cálculos antes de cobrar ou conciliar.',false,'open',jsonb_build_object('order_total',coalesce(o.total_amount,o.total,o.valor_total,o.preco_estimado,0),'items_total',t.items_total),now(),null from public.orders o join item_totals t on t.order_id=o.id where o.company_id=p_company_id and abs(coalesce(o.total_amount,o.total,o.valor_total,o.preco_estimado,0)-t.items_total)>0.05 on conflict(company_id,fingerprint) do update set status='open',last_seen_at=now(),resolved_at=null,metadata=excluded.metadata;
insert into public.data_quality_issues(company_id,fingerprint,rule_key,severity,entity_type,entity_id,title,detail,recommended_action,auto_fixable,status,last_seen_at,resolved_at) select p_company_id,md5('order_item_tenant_mismatch:'||i.id::text),'order_item_tenant_mismatch','CRITICAL','order_item',i.id::text,'Item associado ao tenant errado','O company_id do item diverge do company_id do pedido relacionado.','Corrija a relação após investigação; não altere ownership automaticamente.',false,'open',now(),null from public.order_items i join public.orders o on o.id=i.order_id where (i.company_id=p_company_id or o.company_id=p_company_id) and i.company_id is distinct from o.company_id on conflict(company_id,fingerprint) do update set status='open',last_seen_at=now(),resolved_at=null;
insert into public.data_quality_issues(company_id,fingerprint,rule_key,severity,entity_type,entity_id,title,detail,recommended_action,auto_fixable,status,last_seen_at,resolved_at) select p_company_id,md5('product_invalid_price:'||p.id::text),'product_invalid_price','HIGH','product',p.id::text,'Preço de produto inválido','Produto ativo possui preço negativo ou não possui preço quando não está marcado sob consulta.','Defina preço válido ou marque explicitamente como preço sob consulta.',false,'open',now(),null from public.products p where p.company_id=p_company_id and coalesce(p.archived,p.arquivado,false)=false and coalesce(p.ativo,p.available,p.is_active,true)=true and coalesce(p.preco_sob_consulta,false)=false and (coalesce(p.preco,p.preco_sugerido)<0 or coalesce(p.preco,p.preco_sugerido) is null) on conflict(company_id,fingerprint) do update set status='open',last_seen_at=now(),resolved_at=null;
insert into public.data_quality_issues(company_id,fingerprint,rule_key,severity,entity_type,entity_id,title,detail,recommended_action,auto_fixable,status,last_seen_at,resolved_at) select p_company_id,md5('product_missing_category:'||p.id::text),'product_missing_category','LOW','product',p.id::text,'Produto sem categoria','Produto ativo não possui categoria definida.','Classifique o produto para melhorar catálogo e relatórios.',false,'open',now(),null from public.products p where p.company_id=p_company_id and coalesce(p.archived,p.arquivado,false)=false and coalesce(p.ativo,p.available,p.is_active,true)=true and nullif(btrim(p.categoria),'') is null on conflict(company_id,fingerprint) do update set status='open',last_seen_at=now(),resolved_at=null;
insert into public.data_quality_issues(company_id,fingerprint,rule_key,severity,entity_type,entity_id,title,detail,recommended_action,auto_fixable,status,last_seen_at,resolved_at) select p_company_id,md5('invalid_order_status:'||o.id::text),'invalid_order_status','MEDIUM','order',o.id::text,'Status de pedido não canônico','O status atual não está entre os aliases conhecidos da máquina de estados.','Revise o status antes da próxima transição.',false,'open',now(),null from public.orders o where o.company_id=p_company_id and lower(btrim(coalesce(o.status,''))) not in ('recebido','novo','pendente','pending','aguardando pagamento','pending_payment','em análise','em analise','orçamento enviado','orcamento enviado','proposta enviada','aprovado','em produção','em producao','pronto','ready','pronto_para_entrega','pronto para entrega','out_for_delivery','saiu para entrega','entregue','cancelado','canceled','cancelled') on conflict(company_id,fingerprint) do update set status='open',last_seen_at=now(),resolved_at=null;
insert into public.data_quality_issues(company_id,fingerprint,rule_key,severity,entity_type,entity_id,title,detail,recommended_action,auto_fixable,status,last_seen_at,resolved_at) select p_company_id,md5('order_impossible_date:'||o.id::text),'order_impossible_date','HIGH','order',o.id::text,'Data de pedido impossível','Uma data de conclusão/cancelamento é anterior à criação do pedido.','Revise a origem e o timestamp; não há auto-fix seguro.',false,'open',now(),null from public.orders o where o.company_id=p_company_id and ((o.entregue_em is not null and o.entregue_em<o.created_at) or (o.cancelado_em is not null and o.cancelado_em<o.created_at) or (o.aprovado_em is not null and o.aprovado_em<o.created_at)) on conflict(company_id,fingerprint) do update set status='open',last_seen_at=now(),resolved_at=null;
insert into public.data_quality_issues(company_id,fingerprint,rule_key,severity,entity_type,entity_id,title,detail,recommended_action,auto_fixable,status,last_seen_at,resolved_at) select p_company_id,md5('paid_without_timestamp:'||o.id::text),'paid_without_timestamp','MEDIUM','order',o.id::text,'Pagamento sem timestamp','Pedido está marcado como pago/aprovado sem paid_at.','Confirme o provider e registre a confirmação real; não invente timestamp.',false,'open',now(),null from public.orders o where o.company_id=p_company_id and lower(coalesce(o.payment_status,'')) in ('paid','approved','pago','aprovado','authorized') and o.paid_at is null on conflict(company_id,fingerprint) do update set status='open',last_seen_at=now(),resolved_at=null;
insert into public.data_quality_issues(company_id,fingerprint,rule_key,severity,entity_type,entity_id,title,detail,recommended_action,auto_fixable,status,last_seen_at,resolved_at) select p_company_id,md5('order_payment_impossible:'||p.id::text),'order_payment_impossible','HIGH','order_payment',p.id::text,'Valor de pagamento inconsistente','Pagamento possui valor negativo, pago acima do total ou saldo negativo.','Revise provider e conciliação. Auto-fix financeiro é proibido.',false,'open',now(),null from public.order_payments p where p.company_id=p_company_id and (coalesce(p.amount,0)<0 or coalesce(p.paid_amount,0)<0 or coalesce(p.remaining_amount,0)<0 or coalesce(p.paid_amount,0)>coalesce(p.amount,0)+0.01) on conflict(company_id,fingerprint) do update set status='open',last_seen_at=now(),resolved_at=null;
insert into public.data_quality_issues(company_id,fingerprint,rule_key,severity,entity_type,entity_id,title,detail,recommended_action,auto_fixable,status,last_seen_at,resolved_at) select p_company_id,md5('order_payment_tenant_mismatch:'||p.id::text),'order_payment_tenant_mismatch','CRITICAL','order_payment',p.id::text,'Pagamento associado ao tenant errado','O company_id do pagamento diverge do pedido associado.','Bloqueie processamento e investigue ownership antes de qualquer correção.',false,'open',now(),null from public.order_payments p join public.orders o on o.id=p.order_id where (p.company_id=p_company_id or o.company_id=p_company_id) and p.company_id is distinct from o.company_id on conflict(company_id,fingerprint) do update set status='open',last_seen_at=now(),resolved_at=null;
insert into public.data_quality_issues(company_id,fingerprint,rule_key,severity,entity_type,entity_id,title,detail,recommended_action,auto_fixable,status,last_seen_at,resolved_at) select p_company_id,md5('finance_missing_amount:'||f.id::text),'finance_missing_amount','HIGH','financial_transaction',f.id::text,'Lançamento financeiro sem valor','Transação financeira não possui valor em nenhum dos campos canônicos/legados.','Revise o lançamento manualmente; não preencha valores automaticamente.',false,'open',now(),null from public.financial_transactions f where f.company_id=p_company_id and f.valor is null and f.amount is null on conflict(company_id,fingerprint) do update set status='open',last_seen_at=now(),resolved_at=null;
insert into public.data_quality_issues(company_id,fingerprint,rule_key,severity,entity_type,entity_id,title,detail,recommended_action,auto_fixable,status,last_seen_at,resolved_at) select p_company_id,md5('art_missing_object_reference:'||a.id::text),'art_missing_object_reference','HIGH','art_approval',a.id::text,'Arte sem referência de arquivo','Solicitação ativa de aprovação não possui URL de arte.','Reenvie a arte e confirme o objeto no Storage.',false,'open',now(),null from public.art_approval_requests a where a.company_id=p_company_id and lower(coalesce(a.status,'')) in ('pending','pendente','aguardando','sent','enviado') and nullif(btrim(a.artwork_url),'') is null on conflict(company_id,fingerprint) do update set status='open',last_seen_at=now(),resolved_at=null;
select count(*) into v_open from public.data_quality_issues where company_id=p_company_id and status='open'; select greatest(0,100-coalesce(sum(case severity when 'CRITICAL' then 25 when 'HIGH' then 10 when 'MEDIUM' then 4 when 'LOW' then 1 else 0 end),0))::integer into v_score from public.data_quality_issues where company_id=p_company_id and status='open'; return jsonb_build_object('score',v_score,'open',v_open,'critical',(select count(*) from public.data_quality_issues where company_id=p_company_id and status='open' and severity='CRITICAL'),'high',(select count(*) from public.data_quality_issues where company_id=p_company_id and status='open' and severity='HIGH'),'medium',(select count(*) from public.data_quality_issues where company_id=p_company_id and status='open' and severity='MEDIUM'),'low',(select count(*) from public.data_quality_issues where company_id=p_company_id and status='open' and severity='LOW'),'info',(select count(*) from public.data_quality_issues where company_id=p_company_id and status='open' and severity='INFO')); end; $function$;

CREATE OR REPLACE FUNCTION public.refresh_customer_directory(p_company_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$ declare v_profiles integer:=0; v_candidates integer:=0; begin if p_company_id is null or not exists(select 1 from public.companies where id=p_company_id) then raise exception 'COMPANY_NOT_FOUND' using errcode='22023'; end if;
insert into public.customer_profiles(company_id,contact_key,display_name,normalized_name,phone_raw,phone_normalized,email_raw,email_normalized,source,source_id,last_activity_at,metadata)
select l.company_id,coalesce('phone:'||public.orcaly_normalize_phone_br(l.telefone),'email:'||public.orcaly_normalize_email(l.email),'crm:'||l.id::text),nullif(btrim(l.nome),''),public.orcaly_normalize_name(l.nome),nullif(btrim(l.telefone),''),public.orcaly_normalize_phone_br(l.telefone),nullif(btrim(l.email),''),public.orcaly_normalize_email(l.email),case when lower(coalesce(l.origem,''))='whatsapp' then 'whatsapp' when lower(coalesce(l.origem,''))='api' then 'api' else 'manual' end,'crm:'||l.id::text,coalesce(l.updated_at,l.created_at),jsonb_build_object('crm_lead_id',l.id) from public.crm_leads l where l.company_id=p_company_id and (nullif(btrim(l.nome),'') is not null or nullif(btrim(l.telefone),'') is not null or nullif(btrim(l.email),'') is not null)
on conflict(company_id,contact_key) do update set display_name=coalesce(excluded.display_name,public.customer_profiles.display_name),normalized_name=coalesce(excluded.normalized_name,public.customer_profiles.normalized_name),phone_raw=coalesce(excluded.phone_raw,public.customer_profiles.phone_raw),phone_normalized=coalesce(excluded.phone_normalized,public.customer_profiles.phone_normalized),email_raw=coalesce(excluded.email_raw,public.customer_profiles.email_raw),email_normalized=coalesce(excluded.email_normalized,public.customer_profiles.email_normalized),last_activity_at=greatest(coalesce(public.customer_profiles.last_activity_at,'epoch'::timestamptz),coalesce(excluded.last_activity_at,'epoch'::timestamptz)),updated_at=now(),metadata=public.customer_profiles.metadata||excluded.metadata;
insert into public.customer_profiles(company_id,contact_key,display_name,normalized_name,phone_raw,phone_normalized,email_raw,email_normalized,source,source_id,last_activity_at,metadata)
select distinct on (o.company_id,coalesce(public.orcaly_normalize_phone_br(coalesce(o.customer_phone,o.telefone)),public.orcaly_normalize_email(o.customer_email),o.id::text)) o.company_id,coalesce('phone:'||public.orcaly_normalize_phone_br(coalesce(o.customer_phone,o.telefone)),'email:'||public.orcaly_normalize_email(o.customer_email),'order:'||o.id::text),nullif(btrim(coalesce(o.customer_name,o.nome)),''),public.orcaly_normalize_name(coalesce(o.customer_name,o.nome)),nullif(btrim(coalesce(o.customer_phone,o.telefone)),''),public.orcaly_normalize_phone_br(coalesce(o.customer_phone,o.telefone)),nullif(btrim(o.customer_email),''),public.orcaly_normalize_email(o.customer_email),case when lower(coalesce(o.source,o.canal_origem,''))='whatsapp' then 'whatsapp' when lower(coalesce(o.source,o.canal_origem,''))='api' then 'api' else 'public_site' end,'order:'||o.id::text,coalesce(o.updated_at,o.created_at),jsonb_build_object('latest_order_id',o.id) from public.orders o where o.company_id=p_company_id and (nullif(btrim(coalesce(o.customer_name,o.nome)),'') is not null or nullif(btrim(coalesce(o.customer_phone,o.telefone)),'') is not null or nullif(btrim(o.customer_email),'') is not null) order by o.company_id,coalesce(public.orcaly_normalize_phone_br(coalesce(o.customer_phone,o.telefone)),public.orcaly_normalize_email(o.customer_email),o.id::text),coalesce(o.updated_at,o.created_at) desc
on conflict(company_id,contact_key) do update set display_name=coalesce(excluded.display_name,public.customer_profiles.display_name),normalized_name=coalesce(excluded.normalized_name,public.customer_profiles.normalized_name),phone_raw=coalesce(excluded.phone_raw,public.customer_profiles.phone_raw),phone_normalized=coalesce(excluded.phone_normalized,public.customer_profiles.phone_normalized),email_raw=coalesce(excluded.email_raw,public.customer_profiles.email_raw),email_normalized=coalesce(excluded.email_normalized,public.customer_profiles.email_normalized),last_activity_at=greatest(coalesce(public.customer_profiles.last_activity_at,'epoch'::timestamptz),coalesce(excluded.last_activity_at,'epoch'::timestamptz)),updated_at=now(),metadata=public.customer_profiles.metadata||excluded.metadata;
insert into public.customer_profiles(company_id,contact_key,display_name,normalized_name,phone_raw,phone_normalized,email_raw,email_normalized,source,source_id,last_activity_at,metadata)
select distinct on (p.company_id,coalesce(public.orcaly_normalize_phone_br(p.cliente_whatsapp),public.orcaly_normalize_email(p.cliente_email),p.id::text)) p.company_id,coalesce('phone:'||public.orcaly_normalize_phone_br(p.cliente_whatsapp),'email:'||public.orcaly_normalize_email(p.cliente_email),'proposal:'||p.id::text),nullif(btrim(p.cliente_nome),''),public.orcaly_normalize_name(p.cliente_nome),nullif(btrim(p.cliente_whatsapp),''),public.orcaly_normalize_phone_br(p.cliente_whatsapp),nullif(btrim(p.cliente_email),''),public.orcaly_normalize_email(p.cliente_email),case when lower(coalesce(p.origem,''))='whatsapp' then 'whatsapp' when lower(coalesce(p.origem,''))='api' then 'api' else 'manual' end,'proposal:'||p.id::text,coalesce(p.updated_at,p.created_at),jsonb_build_object('latest_proposal_id',p.id) from public.proposals p where p.company_id=p_company_id and (nullif(btrim(p.cliente_nome),'') is not null or nullif(btrim(p.cliente_whatsapp),'') is not null or nullif(btrim(p.cliente_email),'') is not null) order by p.company_id,coalesce(public.orcaly_normalize_phone_br(p.cliente_whatsapp),public.orcaly_normalize_email(p.cliente_email),p.id::text),coalesce(p.updated_at,p.created_at) desc
on conflict(company_id,contact_key) do update set display_name=coalesce(excluded.display_name,public.customer_profiles.display_name),normalized_name=coalesce(excluded.normalized_name,public.customer_profiles.normalized_name),phone_raw=coalesce(excluded.phone_raw,public.customer_profiles.phone_raw),phone_normalized=coalesce(excluded.phone_normalized,public.customer_profiles.phone_normalized),email_raw=coalesce(excluded.email_raw,public.customer_profiles.email_raw),email_normalized=coalesce(excluded.email_normalized,public.customer_profiles.email_normalized),last_activity_at=greatest(coalesce(public.customer_profiles.last_activity_at,'epoch'::timestamptz),coalesce(excluded.last_activity_at,'epoch'::timestamptz)),updated_at=now(),metadata=public.customer_profiles.metadata||excluded.metadata;
update public.crm_leads l set customer_profile_id=c.id from public.customer_profiles c where l.company_id=p_company_id and c.company_id=p_company_id and c.archived=false and c.contact_key=coalesce('phone:'||public.orcaly_normalize_phone_br(l.telefone),'email:'||public.orcaly_normalize_email(l.email),'crm:'||l.id::text) and l.customer_profile_id is distinct from c.id;
update public.orders o set customer_profile_id=c.id from public.customer_profiles c where o.company_id=p_company_id and c.company_id=p_company_id and c.archived=false and c.contact_key=coalesce('phone:'||public.orcaly_normalize_phone_br(coalesce(o.customer_phone,o.telefone)),'email:'||public.orcaly_normalize_email(o.customer_email),'order:'||o.id::text) and o.customer_profile_id is distinct from c.id;
update public.proposals p set customer_profile_id=c.id from public.customer_profiles c where p.company_id=p_company_id and c.company_id=p_company_id and c.archived=false and c.contact_key=coalesce('phone:'||public.orcaly_normalize_phone_br(p.cliente_whatsapp),'email:'||public.orcaly_normalize_email(p.cliente_email),'proposal:'||p.id::text) and p.customer_profile_id is distinct from c.id;
update public.customer_notes n set customer_profile_id=c.id from public.customer_profiles c where n.company_id=p_company_id and c.company_id=p_company_id and c.archived=false and c.phone_normalized=public.orcaly_normalize_phone_br(n.cliente_telefone) and n.customer_profile_id is distinct from c.id;
update public.customer_followups f set customer_profile_id=c.id from public.customer_profiles c where f.company_id=p_company_id and c.company_id=p_company_id and c.archived=false and c.phone_normalized=public.orcaly_normalize_phone_br(f.cliente_telefone) and f.customer_profile_id is distinct from c.id;
insert into public.customer_duplicate_candidates(company_id,left_customer_id,right_customer_id,reasons,confidence) select p_company_id,a.id,b.id,jsonb_build_array('same_normalized_email'),95 from public.customer_profiles a join public.customer_profiles b on b.company_id=a.company_id and b.id::text>a.id::text where a.company_id=p_company_id and a.archived=false and b.archived=false and a.email_normalized is not null and a.email_normalized=b.email_normalized and a.contact_key<>b.contact_key on conflict(company_id,left_customer_id,right_customer_id) do update set reasons=excluded.reasons,confidence=greatest(public.customer_duplicate_candidates.confidence,excluded.confidence),updated_at=now();
insert into public.customer_duplicate_candidates(company_id,left_customer_id,right_customer_id,reasons,confidence) select p_company_id,a.id,b.id,jsonb_build_array('same_normalized_name'),60 from public.customer_profiles a join public.customer_profiles b on b.company_id=a.company_id and b.id::text>a.id::text where a.company_id=p_company_id and a.archived=false and b.archived=false and length(coalesce(a.normalized_name,''))>=5 and a.normalized_name=b.normalized_name and a.contact_key<>b.contact_key and coalesce(a.email_normalized,'')<>coalesce(b.email_normalized,'') and coalesce(a.phone_normalized,'')<>coalesce(b.phone_normalized,'') on conflict(company_id,left_customer_id,right_customer_id) do update set reasons=(public.customer_duplicate_candidates.reasons||excluded.reasons),confidence=greatest(public.customer_duplicate_candidates.confidence,excluded.confidence),updated_at=now();
select count(*) into v_profiles from public.customer_profiles where company_id=p_company_id and archived=false; select count(*) into v_candidates from public.customer_duplicate_candidates where company_id=p_company_id and status='needs_review'; return jsonb_build_object('profiles',v_profiles,'duplicate_candidates',v_candidates); end; $function$;

CREATE OR REPLACE FUNCTION public.release_affiliate_commissions_admin()
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'orcaly_private'
AS $function$
declare
  changed integer;
begin
  update public.affiliate_commissions c
  set status = 'available',
      available_at = coalesce(c.available_at, now()),
      updated_at = now()
  from public.affiliate_profiles p,
       public.affiliate_referrals r
  where p.id = c.affiliate_id
    and r.id = c.referral_id
    and p.status = 'active'
    and r.review_status = 'approved'
    and c.status = 'hold'
    and c.hold_until is not null
    and c.hold_until <= now();

  get diagnostics changed = row_count;
  return changed;
end;
$function$;

CREATE OR REPLACE FUNCTION public.release_founder_activation_claim(p_claim_id uuid, p_error text DEFAULT NULL::text)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
declare v_invite public.founder_invites%rowtype; v_new_status text;
begin
  select * into v_invite from public.founder_invites where activation_claim_id=p_claim_id and status='activating' for update;
  if not found then return false; end if;
  v_new_status:=case when v_invite.token_expires_at is not null and v_invite.token_expires_at<=now() then 'expired' else 'pending' end;
  update public.founder_invites set status=v_new_status,activation_claim_id=null,activation_claimed_at=null,activation_last_error=left(nullif(btrim(coalesce(p_error,'')),''),1000),updated_at=now() where id=v_invite.id;
  if v_new_status='expired' and v_invite.sales_lead_id is not null then update public.signup_leads set sales_stage=case when sales_stage='convite_fundador' then 'demonstracao' else sales_stage end,sales_stage_updated_at=case when sales_stage='convite_fundador' then now() else sales_stage_updated_at end,updated_at=now() where id=v_invite.sales_lead_id; end if;
  return true;
end; $function$;

CREATE OR REPLACE FUNCTION public.release_founder_billing_claim(p_company_id uuid, p_claim_id uuid, p_error text DEFAULT NULL::text)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
begin
  update public.companies c
  set founder_billing_claim_id = null,
      founder_billing_claimed_at = null,
      founder_billing_last_error = left(nullif(btrim(coalesce(p_error, '')), ''), 1000),
      updated_at = now()
  where c.id = p_company_id and c.founder_billing_claim_id = p_claim_id;
  return found;
end;
$function$;

CREATE OR REPLACE FUNCTION public.release_founder_price_conversion_claim(p_company_id uuid, p_claim_id uuid, p_error text DEFAULT NULL::text)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
begin
  update public.companies c
  set founder_price_conversion_claim_id=null,founder_price_conversion_claimed_at=null,
      founder_price_conversion_last_error=left(nullif(btrim(coalesce(p_error,'')),''),1000),updated_at=now()
  where c.id=p_company_id and c.founder_price_conversion_claim_id=p_claim_id;
  return found;
end;
$function$;

CREATE OR REPLACE FUNCTION public.release_platform_admin_invite_claim(p_claim_id uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 SET search_path TO 'pg_catalog', 'public'
AS $function$
declare v_updated integer := 0;
begin
  update public.platform_admin_invites
  set status = case when expires_at <= now() then 'expired' else 'pending' end, claimed_at = null, activation_claim_id = null
  where status = 'activating' and activation_claim_id = p_claim_id;
  get diagnostics v_updated = row_count;
  return v_updated = 1;
end;
$function$;

CREATE OR REPLACE FUNCTION public.reserve_marketplace_stock(p_company_id uuid, p_order_id uuid, p_marketplace_payment_id uuid, p_expires_at timestamp with time zone, p_items jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare
  v_item record;
  v_product public.products%rowtype;
  v_extras jsonb;
  v_raw_stock text;
  v_controlled boolean;
  v_stock integer;
  v_after integer;
  v_reservation_id uuid;
  v_reserved_count integer := 0;
  v_existing_count integer := 0;
begin
  if p_company_id is null
     or p_order_id is null
     or p_marketplace_payment_id is null then
    raise exception 'Empresa, pedido e pagamento sao obrigatorios.';
  end if;

  if p_expires_at is null or p_expires_at <= now() then
    raise exception 'A expiracao da reserva precisa estar no futuro.';
  end if;

  if jsonb_typeof(coalesce(p_items, 'null'::jsonb)) <> 'array'
     or jsonb_array_length(p_items) = 0 then
    raise exception 'A reserva precisa conter produtos.';
  end if;

  perform 1
  from public.marketplace_payments mp
  where mp.id = p_marketplace_payment_id
    and mp.company_id = p_company_id
    and mp.order_id = p_order_id
  for update;

  if not found then
    raise exception 'Pagamento nao pertence ao pedido informado.';
  end if;

  select count(*)
    into v_existing_count
  from public.marketplace_stock_reservations r
  where r.company_id = p_company_id
    and r.marketplace_payment_id = p_marketplace_payment_id;

  if v_existing_count > 0 then
    if exists (
      select 1
      from public.marketplace_stock_reservations r
      where r.company_id = p_company_id
        and r.marketplace_payment_id = p_marketplace_payment_id
        and r.status not in ('reserved', 'confirmed')
    ) then
      raise exception 'A reserva deste pagamento ja foi encerrada.';
    end if;

    return jsonb_build_object(
      'status', 'already_reserved',
      'reservations', v_existing_count
    );
  end if;

  for v_item in
    select parsed.product_id, sum(parsed.quantity)::integer as quantity
    from jsonb_to_recordset(p_items)
      as parsed(product_id uuid, quantity integer)
    group by parsed.product_id
    order by parsed.product_id
  loop
    if v_item.product_id is null or coalesce(v_item.quantity, 0) <= 0 then
      raise exception 'Produto e quantidade da reserva sao invalidos.';
    end if;

    select *
      into v_product
    from public.products p
    where p.id = v_item.product_id
      and p.company_id = p_company_id
      and coalesce(p.ativo, true) = true
      and coalesce(p.arquivado, false) = false
      and coalesce(p.archived, false) = false
    for update;

    if not found then
      raise exception 'Um produto nao esta mais disponivel.';
    end if;

    v_extras := coalesce(v_product.extras, '{}'::jsonb);
    v_controlled :=
      lower(coalesce(v_extras ->> 'controle_estoque', 'false')) in ('true', '1', 'yes', 'sim')
      or lower(coalesce(v_extras ->> 'stock_control', 'false')) in ('true', '1', 'yes', 'sim')
      or v_product.estoque is not null;

    if not v_controlled then
      continue;
    end if;

    v_raw_stock := coalesce(
      v_extras ->> 'estoque',
      v_extras ->> 'stock',
      ''
    );

    if v_raw_stock ~ '^[0-9]+$' then
      v_stock := greatest(0, v_raw_stock::integer);
    elsif v_product.estoque is not null then
      v_stock := greatest(0, v_product.estoque);
    else
      v_stock := 0;
    end if;

    if v_stock < v_item.quantity then
      raise exception 'Estoque insuficiente para %. Disponivel: %.',
        coalesce(v_product.nome, 'produto'),
        v_stock;
    end if;

    v_after := v_stock - v_item.quantity;
    v_extras := jsonb_set(v_extras, '{estoque}', to_jsonb(v_after), true);
    v_extras := jsonb_set(v_extras, '{stock}', to_jsonb(v_after), true);

    update public.products
    set estoque = v_after,
        extras = v_extras,
        available = case
          when v_after <= 0 then false
          else coalesce(available, true)
        end,
        updated_at = now()
    where id = v_product.id
      and company_id = p_company_id;

    insert into public.marketplace_stock_reservations (
      company_id,
      order_id,
      marketplace_payment_id,
      product_id,
      quantity,
      status,
      stock_before,
      stock_after,
      expires_at
    )
    values (
      p_company_id,
      p_order_id,
      p_marketplace_payment_id,
      v_product.id,
      v_item.quantity,
      'reserved',
      v_stock,
      v_after,
      p_expires_at
    )
    returning id into v_reservation_id;

    insert into public.product_stock_movements (
      company_id,
      product_id,
      order_id,
      marketplace_payment_id,
      reservation_id,
      movement_type,
      quantity_delta,
      stock_before,
      stock_after,
      reason,
      metadata,
      idempotency_key
    )
    values (
      p_company_id,
      v_product.id,
      p_order_id,
      p_marketplace_payment_id,
      v_reservation_id,
      'reserve',
      -v_item.quantity,
      v_stock,
      v_after,
      'Reserva temporaria para pagamento',
      jsonb_build_object('expires_at', p_expires_at),
      'reserve:' || v_reservation_id::text
    )
    on conflict (idempotency_key) do nothing;

    v_reserved_count := v_reserved_count + 1;
  end loop;

  update public.marketplace_payments
  set stock_reservation_status = case
        when v_reserved_count > 0 then 'reserved'
        else null
      end,
      stock_reserved_at = case
        when v_reserved_count > 0 then now()
        else stock_reserved_at
      end,
      updated_at = now()
  where id = p_marketplace_payment_id
    and company_id = p_company_id;

  return jsonb_build_object(
    'status', case when v_reserved_count > 0 then 'reserved' else 'not_controlled' end,
    'reservations', v_reserved_count
  );
end;
$function$;

CREATE OR REPLACE FUNCTION public.reverse_affiliate_commission_admin(p_provider_payment_id text, p_reason text)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'orcaly_private'
AS $function$
declare
  commission_row public.affiliate_commissions%rowtype;
begin
  select * into commission_row
  from public.affiliate_commissions
  where provider_payment_id = p_provider_payment_id
  for update;

  if not found or commission_row.status in ('reversed','rejected') then
    return false;
  end if;

  if commission_row.status = 'paid' then
    update public.affiliate_profiles
    set debt_balance = debt_balance + commission_row.commission_amount,
        updated_at = now()
    where id = commission_row.affiliate_id;
  end if;

  update public.affiliate_commissions
  set status = 'reversed',
      reversed_at = now(),
      reversal_reason = left(coalesce(p_reason, 'Pagamento estornado.'), 500),
      updated_at = now()
  where id = commission_row.id;

  update public.affiliate_referrals
  set status = 'reversed',
      updated_at = now()
  where id = commission_row.referral_id;

  return true;
end;
$function$;

CREATE OR REPLACE FUNCTION public.review_affiliate_referral_admin(p_referral_id uuid, p_decision text, p_actor_email text, p_note text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'orcaly_private'
AS $function$
declare
  referral_row public.affiliate_referrals%rowtype;
  commission_row public.affiliate_commissions%rowtype;
  next_status text;
begin
  if p_decision not in ('approved', 'rejected', 'flagged') then
    raise exception 'Decisão de indicação inválida.';
  end if;

  select *
  into referral_row
  from public.affiliate_referrals
  where id = p_referral_id
  for update;

  if not found then
    raise exception 'Indicação não encontrada.';
  end if;

  select *
  into commission_row
  from public.affiliate_commissions
  where referral_id = p_referral_id
  for update;

  if p_decision = 'approved' then
    next_status := referral_row.status;

    if referral_row.status = 'rejected' then
      if referral_row.first_payment_reference is not null then
        next_status := 'qualified';
      elsif referral_row.trial_ends_at is not null
        and referral_row.trial_ends_at > now() then
        next_status := 'trial';
      else
        next_status := 'payment_pending';
      end if;
    end if;

    update public.affiliate_referrals
    set review_status = 'approved',
        status = next_status,
        reviewed_at = now(),
        reviewed_by = lower(trim(p_actor_email)),
        review_note = nullif(left(trim(coalesce(p_note, '')), 500), ''),
        rejected_at = null,
        rejection_reason = null,
        updated_at = now()
    where id = p_referral_id;

    if commission_row.id is not null
      and commission_row.status = 'hold'
      and commission_row.hold_until is not null
      and commission_row.hold_until <= now() then
      update public.affiliate_commissions
      set status = 'available',
          available_at = coalesce(available_at, now()),
          updated_at = now()
      where id = commission_row.id;
    end if;

    return jsonb_build_object(
      'ok', true,
      'decision', 'approved',
      'referral_id', p_referral_id
    );
  end if;

  if p_decision = 'flagged' then
    update public.affiliate_referrals
    set review_status = 'flagged',
        reviewed_at = now(),
        reviewed_by = lower(trim(p_actor_email)),
        review_note = nullif(left(trim(coalesce(p_note, '')), 500), ''),
        updated_at = now()
    where id = p_referral_id;

    return jsonb_build_object(
      'ok', true,
      'decision', 'flagged',
      'referral_id', p_referral_id
    );
  end if;

  if commission_row.id is not null
    and commission_row.status = 'processing' then
    raise exception 'A indicação possui pagamento em processamento.';
  end if;

  if commission_row.id is not null
    and commission_row.status = 'paid' then
    update public.affiliate_profiles
    set debt_balance =
          debt_balance + commission_row.commission_amount,
        updated_at = now()
    where id = commission_row.affiliate_id;
  end if;

  if commission_row.id is not null
    and commission_row.status not in ('reversed', 'rejected') then
    update public.affiliate_commissions
    set status = 'reversed',
        reversed_at = now(),
        reversal_reason =
          coalesce(
            nullif(left(trim(coalesce(p_note, '')), 500), ''),
            'Indicação recusada pela administração.'
          ),
        updated_at = now()
    where id = commission_row.id;
  end if;

  update public.affiliate_referrals
  set review_status = 'rejected',
      status = 'rejected',
      reviewed_at = now(),
      reviewed_by = lower(trim(p_actor_email)),
      review_note = nullif(left(trim(coalesce(p_note, '')), 500), ''),
      rejected_at = now(),
      rejection_reason =
        coalesce(
          nullif(left(trim(coalesce(p_note, '')), 500), ''),
          'Indicação recusada pela administração.'
        ),
      updated_at = now()
  where id = p_referral_id;

  return jsonb_build_object(
    'ok', true,
    'decision', 'rejected',
    'referral_id', p_referral_id,
    'commission_reversed', commission_row.id is not null
  );
end;
$function$;

CREATE OR REPLACE FUNCTION public.revoke_founder_invite(p_actor_admin_id uuid, p_invite_id uuid, p_reason text DEFAULT NULL::text)
 RETURNS founder_invites
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
declare
  v_actor_role text;
  v_actor_email text;
  v_invite public.founder_invites%rowtype;
  v_current_assignee uuid;
  v_reason text := nullif(btrim(coalesce(p_reason,'')),'');
begin
  select lower(role), lower(email)
    into v_actor_role, v_actor_email
  from public.platform_admins
  where id = p_actor_admin_id
    and is_active = true;

  if v_actor_role = 'owner'
     and v_actor_email <> 'viniciusadm@orcaly.com'
  then
    raise exception 'FOUNDER_ACTOR_NOT_ALLOWED';
  end if;

  if v_actor_role not in ('owner','prospector') then
    raise exception 'FOUNDER_ACTOR_NOT_ALLOWED';
  end if;

  select *
    into v_invite
  from public.founder_invites
  where id = p_invite_id
  for update;

  if not found then
    raise exception 'FOUNDER_INVITE_NOT_FOUND';
  end if;

  if v_invite.status <> 'pending' then
    raise exception 'FOUNDER_INVITE_NOT_PENDING';
  end if;

  if v_actor_role = 'prospector' then
    if v_invite.created_by_admin_id is distinct from p_actor_admin_id then
      raise exception 'FOUNDER_INVITE_NOT_OWNED';
    end if;

    if v_invite.sales_lead_id is null then
      raise exception 'FOUNDER_INVITE_NOT_OWNED';
    end if;

    select assigned_to_admin_id
      into v_current_assignee
    from public.signup_leads
    where id = v_invite.sales_lead_id;

    if v_current_assignee is distinct from p_actor_admin_id then
      raise exception 'FOUNDER_INVITE_NOT_OWNED';
    end if;
  end if;

  update public.founder_invites
  set status = 'revoked',
      revoked_at = now(),
      revoked_by_admin_id = p_actor_admin_id,
      revocation_reason = left(v_reason,500),
      updated_at = now()
  where id = p_invite_id
  returning * into v_invite;

  if v_invite.sales_lead_id is not null then
    update public.signup_leads
    set sales_stage = case
          when sales_stage = 'convite_fundador' then 'demonstracao'
          else sales_stage
        end,
        sales_stage_updated_at = case
          when sales_stage = 'convite_fundador' then now()
          else sales_stage_updated_at
        end,
        updated_at = now()
    where id = v_invite.sales_lead_id;

    insert into public.signup_lead_followups (
      lead_id, channel, status, message, scheduled_for, sent_at,
      admin_email, created_by_admin_id, sales_event_type, raw_data
    )
    values (
      v_invite.sales_lead_id,
      'system',
      'registrado',
      'Convite Founder #' || lpad(v_invite.founder_number::text,2,'0') || ' revogado.',
      now(),
      now(),
      v_actor_email,
      p_actor_admin_id,
      'system',
      jsonb_build_object(
        'source','founder_program',
        'event','invite_revoked',
        'founder_invite_id',v_invite.id,
        'founder_number',v_invite.founder_number,
        'reason',v_reason
      )
    );
  end if;

  return v_invite;
end;
$function$;

CREATE OR REPLACE FUNCTION public.rotate_founder_invite_token(p_actor_admin_id uuid, p_invite_id uuid, p_token_hash text, p_token_expires_at timestamp with time zone)
 RETURNS founder_invites
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
declare
  v_actor_role text;
  v_actor_email text;
  v_invite public.founder_invites%rowtype;
  v_current_assignee uuid;
begin
  if p_token_hash is null or p_token_hash !~ '^[0-9a-f]{64}$' then
    raise exception 'INVALID_FOUNDER_TOKEN_HASH';
  end if;

  if p_token_expires_at is null
     or p_token_expires_at <= now()
     or p_token_expires_at > now() + interval '30 days'
  then
    raise exception 'INVALID_FOUNDER_TOKEN_EXPIRY';
  end if;

  select lower(role), lower(email)
    into v_actor_role, v_actor_email
  from public.platform_admins
  where id = p_actor_admin_id
    and is_active = true;

  if v_actor_role = 'owner'
     and v_actor_email <> 'viniciusadm@orcaly.com'
  then
    raise exception 'FOUNDER_ACTOR_NOT_ALLOWED';
  end if;

  if v_actor_role not in ('owner','prospector') then
    raise exception 'FOUNDER_ACTOR_NOT_ALLOWED';
  end if;

  select *
    into v_invite
  from public.founder_invites
  where id = p_invite_id
  for update;

  if not found then
    raise exception 'FOUNDER_INVITE_NOT_FOUND';
  end if;

  if v_invite.status <> 'pending' then
    raise exception 'FOUNDER_INVITE_NOT_PENDING';
  end if;

  if v_actor_role = 'prospector' then
    if v_invite.created_by_admin_id is distinct from p_actor_admin_id then
      raise exception 'FOUNDER_INVITE_NOT_OWNED';
    end if;

    if v_invite.sales_lead_id is null then
      raise exception 'FOUNDER_INVITE_NOT_OWNED';
    end if;

    select assigned_to_admin_id
      into v_current_assignee
    from public.signup_leads
    where id = v_invite.sales_lead_id;

    if v_current_assignee is distinct from p_actor_admin_id then
      raise exception 'FOUNDER_INVITE_NOT_OWNED';
    end if;
  end if;

  update public.founder_invites
  set token_hash = p_token_hash,
      token_expires_at = p_token_expires_at,
      token_rotated_at = now(),
      updated_at = now()
  where id = p_invite_id
  returning * into v_invite;

  if v_invite.sales_lead_id is not null then
    insert into public.signup_lead_followups (
      lead_id, channel, status, message, scheduled_for, sent_at,
      admin_email, created_by_admin_id, sales_event_type, raw_data
    )
    values (
      v_invite.sales_lead_id,
      'system',
      'registrado',
      'Link do convite Founder #' || lpad(v_invite.founder_number::text,2,'0') || ' foi renovado.',
      now(),
      now(),
      v_actor_email,
      p_actor_admin_id,
      'system',
      jsonb_build_object(
        'source','founder_program',
        'event','invite_rotated',
        'founder_invite_id',v_invite.id,
        'founder_number',v_invite.founder_number
      )
    );
  end if;

  return v_invite;
end;
$function$;

CREATE OR REPLACE FUNCTION public.save_affiliate_payout_account_admin(p_affiliate_id uuid, p_pix_key_type text, p_pix_key_encrypted text, p_pix_key_masked text, p_holder_name text, p_holder_document_hash text, p_holder_document_last4 text, p_bank_name text, p_provider_validation jsonb, p_is_verified boolean, p_verified_by text)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'orcaly_private'
AS $function$
begin
  if p_pix_key_type not in ('CPF','CNPJ','EMAIL','PHONE','EVP') then
    raise exception 'Tipo de chave Pix inválido.';
  end if;

  if not exists (
    select 1 from public.affiliate_profiles
    where id = p_affiliate_id
      and status in ('pending','active')
  ) then
    raise exception 'Indicador não encontrado ou bloqueado.';
  end if;

  insert into orcaly_private.affiliate_payout_accounts (
    affiliate_id,
    pix_key_type,
    pix_key_encrypted,
    pix_key_masked,
    holder_name,
    holder_document_hash,
    holder_document_last4,
    bank_name,
    provider_validation,
    is_verified,
    verified_at,
    verified_by
  ) values (
    p_affiliate_id,
    p_pix_key_type,
    p_pix_key_encrypted,
    p_pix_key_masked,
    p_holder_name,
    p_holder_document_hash,
    p_holder_document_last4,
    nullif(trim(p_bank_name), ''),
    coalesce(p_provider_validation, '{}'::jsonb),
    p_is_verified,
    case when p_is_verified then now() else null end,
    nullif(trim(p_verified_by), '')
  )
  on conflict (affiliate_id) do update
  set pix_key_type = excluded.pix_key_type,
      pix_key_encrypted = excluded.pix_key_encrypted,
      pix_key_masked = excluded.pix_key_masked,
      holder_name = excluded.holder_name,
      holder_document_hash = excluded.holder_document_hash,
      holder_document_last4 = excluded.holder_document_last4,
      bank_name = excluded.bank_name,
      provider_validation = excluded.provider_validation,
      is_verified = excluded.is_verified,
      verified_at = excluded.verified_at,
      verified_by = excluded.verified_by,
      updated_at = now();

  update public.affiliate_profiles
  set payout_status = case when p_is_verified then 'verified' else 'pending_verification' end,
      updated_at = now()
  where id = p_affiliate_id;

  return true;
end;
$function$;

CREATE OR REPLACE FUNCTION public.set_affiliate_payout_account_verification_admin(p_affiliate_id uuid, p_verified boolean, p_verified_by text, p_note text DEFAULT NULL::text)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'orcaly_private'
AS $function$
begin
  update orcaly_private.affiliate_payout_accounts
  set is_verified = p_verified,
      verified_at = case when p_verified then now() else null end,
      verified_by = nullif(trim(p_verified_by), ''),
      provider_validation = provider_validation || jsonb_build_object(
        'manual_note', nullif(trim(p_note), ''),
        'manual_verified', p_verified,
        'manual_verified_at', now()
      ),
      updated_at = now()
  where affiliate_id = p_affiliate_id;

  if not found then
    return false;
  end if;

  update public.affiliate_profiles
  set payout_status = case when p_verified then 'verified' else 'pending_verification' end,
      updated_at = now()
  where id = p_affiliate_id;

  return true;
end;
$function$;

CREATE OR REPLACE FUNCTION public.set_company_subdomain_slug()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
begin
  if new.subdomain_slug is null or trim(new.subdomain_slug) = '' then
    new.subdomain_slug := regexp_replace(lower(coalesce(new.slug, new.nome)), '[^a-z0-9]', '', 'g');
  else
    new.subdomain_slug := regexp_replace(lower(new.subdomain_slug), '[^a-z0-9]', '', 'g');
  end if;

  return new;
end;
$function$;

CREATE OR REPLACE FUNCTION public.set_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
begin
  new.updated_at = now();
  return new;
end;
$function$;

CREATE OR REPLACE FUNCTION public.settle_background_job(p_job_id uuid, p_worker text, p_status text, p_run_after timestamp with time zone DEFAULT NULL::timestamp with time zone, p_error text DEFAULT NULL::text, p_metadata_patch jsonb DEFAULT '{}'::jsonb)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog'
AS $function$
declare
  v_updated integer := 0;
  v_worker text := left(coalesce(p_worker, ''), 120);
begin
  if p_status not in ('completed', 'failed', 'retrying', 'needs_attention') then
    raise exception 'invalid background job settlement status';
  end if;

  if v_worker = '' then
    raise exception 'worker id is required';
  end if;

  update public.background_jobs j
  set status = p_status,
      run_after = case
        when p_status = 'retrying' then coalesce(p_run_after, now() + interval '1 minute')
        else j.run_after
      end,
      locked_at = null,
      locked_by = null,
      completed_at = case
        when p_status in ('completed', 'failed', 'needs_attention') then now()
        else null
      end,
      last_error = case
        when p_status = 'completed' then null
        else left(coalesce(nullif(p_error, ''), 'job_failed'), 2000)
      end,
      metadata = coalesce(j.metadata, '{}'::jsonb) || coalesce(p_metadata_patch, '{}'::jsonb)
  where j.id = p_job_id
    and j.status = 'running'
    and j.locked_by = v_worker;

  get diagnostics v_updated = row_count;
  return v_updated = 1;
end;
$function$;

CREATE OR REPLACE FUNCTION public.settle_marketplace_stock(p_company_id uuid, p_marketplace_payment_id uuid, p_payment_status text, p_reason text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare
  v_status text := lower(trim(coalesce(p_payment_status, '')));
  v_res public.marketplace_stock_reservations%rowtype;
  v_product public.products%rowtype;
  v_extras jsonb;
  v_raw_stock text;
  v_stock integer;
  v_after integer;
  v_confirmed integer := 0;
  v_released integer := 0;
  v_review integer := 0;
  v_target_status text;
  v_movement_type text;
begin
  if v_status not in (
    'paid',
    'failed',
    'canceled',
    'expired',
    'refunded',
    'charged_back'
  ) then
    return jsonb_build_object(
      'status', 'pending',
      'confirmed', 0,
      'released', 0,
      'review_required', 0
    );
  end if;

  perform 1
  from public.marketplace_payments mp
  where mp.id = p_marketplace_payment_id
    and mp.company_id = p_company_id
  for update;

  if not found then
    raise exception 'Pagamento nao encontrado para liquidar estoque.';
  end if;

  for v_res in
    select *
    from public.marketplace_stock_reservations r
    where r.company_id = p_company_id
      and r.marketplace_payment_id = p_marketplace_payment_id
    order by r.product_id
    for update
  loop
    if v_status = 'paid' then
      if v_res.status = 'reserved' then
        update public.marketplace_stock_reservations
        set status = 'confirmed',
            confirmed_at = now(),
            updated_at = now()
        where id = v_res.id;

        insert into public.product_stock_movements (
          company_id,
          product_id,
          order_id,
          marketplace_payment_id,
          reservation_id,
          movement_type,
          quantity_delta,
          stock_before,
          stock_after,
          reason,
          idempotency_key
        )
        values (
          v_res.company_id,
          v_res.product_id,
          v_res.order_id,
          v_res.marketplace_payment_id,
          v_res.id,
          'confirm',
          0,
          v_res.stock_after,
          v_res.stock_after,
          coalesce(p_reason, 'Pagamento aprovado'),
          'confirm:' || v_res.id::text
        )
        on conflict (idempotency_key) do nothing;

        v_confirmed := v_confirmed + 1;
      end if;

      continue;
    end if;

    if v_status in ('refunded', 'charged_back')
       and v_res.status = 'confirmed' then
      update public.marketplace_stock_reservations
      set status = 'review_required',
          release_reason = coalesce(p_reason, v_status),
          updated_at = now()
      where id = v_res.id;

      insert into public.product_stock_movements (
        company_id,
        product_id,
        order_id,
        marketplace_payment_id,
        reservation_id,
        movement_type,
        quantity_delta,
        stock_before,
        stock_after,
        reason,
        idempotency_key
      )
      values (
        v_res.company_id,
        v_res.product_id,
        v_res.order_id,
        v_res.marketplace_payment_id,
        v_res.id,
        'review_required',
        0,
        v_res.stock_after,
        v_res.stock_after,
        coalesce(p_reason, v_status),
        'review:' || v_res.id::text
      )
      on conflict (idempotency_key) do nothing;

      v_review := v_review + 1;
      continue;
    end if;

    if v_res.status <> 'reserved' then
      continue;
    end if;

    select *
      into v_product
    from public.products p
    where p.id = v_res.product_id
      and p.company_id = p_company_id
    for update;

    if not found then
      raise exception 'Produto da reserva nao foi encontrado.';
    end if;

    v_extras := coalesce(v_product.extras, '{}'::jsonb);
    v_raw_stock := coalesce(
      v_extras ->> 'estoque',
      v_extras ->> 'stock',
      ''
    );

    if v_raw_stock ~ '^[0-9]+$' then
      v_stock := greatest(0, v_raw_stock::integer);
    elsif v_product.estoque is not null then
      v_stock := greatest(0, v_product.estoque);
    else
      v_stock := 0;
    end if;

    v_after := v_stock + v_res.quantity;
    v_extras := jsonb_set(v_extras, '{estoque}', to_jsonb(v_after), true);
    v_extras := jsonb_set(v_extras, '{stock}', to_jsonb(v_after), true);

    update public.products
    set estoque = v_after,
        extras = v_extras,
        available = case
          when coalesce(ativo, true) = false
            or coalesce(arquivado, false) = true
            or coalesce(archived, false) = true
          then false
          else v_after > 0
        end,
        updated_at = now()
    where id = v_product.id
      and company_id = p_company_id;

    v_target_status := case
      when v_status = 'expired' then 'expired'
      else 'released'
    end;
    v_movement_type := case
      when v_status = 'expired' then 'expire'
      else 'release'
    end;

    update public.marketplace_stock_reservations
    set status = v_target_status,
        released_at = now(),
        release_reason = coalesce(p_reason, v_status),
        updated_at = now()
    where id = v_res.id;

    insert into public.product_stock_movements (
      company_id,
      product_id,
      order_id,
      marketplace_payment_id,
      reservation_id,
      movement_type,
      quantity_delta,
      stock_before,
      stock_after,
      reason,
      idempotency_key
    )
    values (
      v_res.company_id,
      v_res.product_id,
      v_res.order_id,
      v_res.marketplace_payment_id,
      v_res.id,
      v_movement_type,
      v_res.quantity,
      v_stock,
      v_after,
      coalesce(p_reason, v_status),
      v_movement_type || ':' || v_res.id::text
    )
    on conflict (idempotency_key) do nothing;

    v_released := v_released + 1;
  end loop;

  update public.marketplace_payments
  set stock_reservation_status = case
        when v_status = 'paid' then 'confirmed'
        when v_status = 'expired' then 'expired'
        when v_review > 0 then 'review_required'
        else 'released'
      end,
      stock_confirmed_at = case
        when v_status = 'paid' then coalesce(stock_confirmed_at, now())
        else stock_confirmed_at
      end,
      stock_released_at = case
        when v_status <> 'paid' and v_review = 0
        then coalesce(stock_released_at, now())
        else stock_released_at
      end,
      updated_at = now()
  where id = p_marketplace_payment_id
    and company_id = p_company_id;

  return jsonb_build_object(
    'status', case
      when v_status = 'paid' then 'confirmed'
      when v_status = 'expired' then 'expired'
      when v_review > 0 then 'review_required'
      else 'released'
    end,
    'confirmed', v_confirmed,
    'released', v_released,
    'review_required', v_review
  );
end;
$function$;

CREATE OR REPLACE FUNCTION public.touch_signup_lead_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
begin
  new.updated_at = now();
  return new;
end;
$function$;

alter table "orcaly_private"."affiliate_payout_accounts" alter column "id" set default gen_random_uuid();

alter table "orcaly_private"."affiliate_payout_accounts" alter column "provider_validation" set default '{}'::jsonb;

alter table "orcaly_private"."affiliate_payout_accounts" alter column "is_verified" set default false;

alter table "orcaly_private"."affiliate_payout_accounts" alter column "created_at" set default now();

alter table "orcaly_private"."affiliate_payout_accounts" alter column "updated_at" set default now();

alter table "orcaly_private"."api_rate_limits" alter column "window_started_at" set default clock_timestamp();

alter table "orcaly_private"."api_rate_limits" alter column "request_count" set default 0;

alter table "orcaly_private"."api_rate_limits" alter column "updated_at" set default clock_timestamp();

alter table "public"."admin_audit_logs" alter column "id" set default gen_random_uuid();

alter table "public"."admin_audit_logs" alter column "metadata" set default '{}'::jsonb;

alter table "public"."admin_audit_logs" alter column "created_at" set default now();

alter table "public"."admin_audit_logs" alter column "payload" set default '{}'::jsonb;

alter table "public"."admin_bug_reports" alter column "id" set default gen_random_uuid();

alter table "public"."admin_bug_reports" alter column "status" set default 'aberto'::text;

alter table "public"."admin_bug_reports" alter column "metadata" set default '{}'::jsonb;

alter table "public"."admin_bug_reports" alter column "first_seen_at" set default now();

alter table "public"."admin_bug_reports" alter column "last_seen_at" set default now();

alter table "public"."admin_bug_reports" alter column "area" set default 'sistema'::text;

alter table "public"."admin_bug_reports" alter column "occurrences" set default 1;

alter table "public"."admin_bug_reports" alter column "fix_steps" set default '[]'::jsonb;

alter table "public"."admin_bug_reports" alter column "auto_fixable" set default false;

alter table "public"."admin_scan_runs" alter column "id" set default gen_random_uuid();

alter table "public"."admin_scan_runs" alter column "started_at" set default now();

alter table "public"."admin_scan_runs" alter column "status" set default 'rodando'::text;

alter table "public"."admin_scan_runs" alter column "total_issues" set default 0;

alter table "public"."admin_scan_runs" alter column "critical_count" set default 0;

alter table "public"."admin_scan_runs" alter column "high_count" set default 0;

alter table "public"."admin_scan_runs" alter column "medium_count" set default 0;

alter table "public"."admin_scan_runs" alter column "low_count" set default 0;

alter table "public"."admin_scan_runs" alter column "summary" set default '{}'::jsonb;

alter table "public"."admin_system_snapshots" alter column "id" set default gen_random_uuid();

alter table "public"."admin_system_snapshots" alter column "companies_total" set default 0;

alter table "public"."admin_system_snapshots" alter column "companies_active" set default 0;

alter table "public"."admin_system_snapshots" alter column "companies_overdue" set default 0;

alter table "public"."admin_system_snapshots" alter column "bugs_green" set default 0;

alter table "public"."admin_system_snapshots" alter column "bugs_yellow" set default 0;

alter table "public"."admin_system_snapshots" alter column "bugs_red" set default 0;

alter table "public"."admin_system_snapshots" alter column "metadata" set default '{}'::jsonb;

alter table "public"."admin_system_snapshots" alter column "created_at" set default now();

alter table "public"."admin_users" alter column "id" set default gen_random_uuid();

alter table "public"."admin_users" alter column "role" set default 'admin'::text;

alter table "public"."admin_users" alter column "ativo" set default true;

alter table "public"."admin_users" alter column "created_at" set default now();

alter table "public"."admin_users" alter column "permissions" set default '{}'::jsonb;

alter table "public"."admin_users" alter column "updated_at" set default now();

alter table "public"."affiliate_achievements" alter column "id" set default gen_random_uuid();

alter table "public"."affiliate_achievements" alter column "metadata" set default '{}'::jsonb;

alter table "public"."affiliate_achievements" alter column "unlocked_at" set default now();

alter table "public"."affiliate_activity_events" alter column "id" set default gen_random_uuid();

alter table "public"."affiliate_activity_events" alter column "xp" set default 0;

alter table "public"."affiliate_activity_events" alter column "metadata" set default '{}'::jsonb;

alter table "public"."affiliate_activity_events" alter column "created_at" set default now();

alter table "public"."affiliate_announcements" alter column "id" set default gen_random_uuid();

alter table "public"."affiliate_announcements" alter column "kind" set default 'news'::text;

alter table "public"."affiliate_announcements" alter column "is_active" set default true;

alter table "public"."affiliate_announcements" alter column "published_at" set default now();

alter table "public"."affiliate_announcements" alter column "created_at" set default now();

alter table "public"."affiliate_audit_logs" alter column "id" set default gen_random_uuid();

alter table "public"."affiliate_audit_logs" alter column "metadata" set default '{}'::jsonb;

alter table "public"."affiliate_audit_logs" alter column "created_at" set default now();

alter table "public"."affiliate_certifications" alter column "id" set default gen_random_uuid();

alter table "public"."affiliate_certifications" alter column "status" set default 'issued'::text;

alter table "public"."affiliate_certifications" alter column "issued_at" set default now();

alter table "public"."affiliate_certifications" alter column "metadata" set default '{}'::jsonb;

alter table "public"."affiliate_clicks" alter column "id" set default gen_random_uuid();

alter table "public"."affiliate_clicks" alter column "created_at" set default now();

alter table "public"."affiliate_commissions" alter column "id" set default gen_random_uuid();

alter table "public"."affiliate_commissions" alter column "status" set default 'hold'::text;

alter table "public"."affiliate_commissions" alter column "created_at" set default now();

alter table "public"."affiliate_commissions" alter column "updated_at" set default now();

alter table "public"."affiliate_course_progress" alter column "id" set default gen_random_uuid();

alter table "public"."affiliate_course_progress" alter column "completed_at" set default now();

alter table "public"."affiliate_course_progress" alter column "created_at" set default now();

alter table "public"."affiliate_goals" alter column "id" set default gen_random_uuid();

alter table "public"."affiliate_goals" alter column "contacts_target" set default 30;

alter table "public"."affiliate_goals" alter column "demos_target" set default 10;

alter table "public"."affiliate_goals" alter column "trials_target" set default 5;

alter table "public"."affiliate_goals" alter column "customers_target" set default 3;

alter table "public"."affiliate_goals" alter column "content_target" set default 4;

alter table "public"."affiliate_goals" alter column "study_target" set default 4;

alter table "public"."affiliate_goals" alter column "created_at" set default now();

alter table "public"."affiliate_goals" alter column "updated_at" set default now();

alter table "public"."affiliate_leads" alter column "id" set default gen_random_uuid();

alter table "public"."affiliate_leads" alter column "segment" set default 'services'::text;

alter table "public"."affiliate_leads" alter column "status" set default 'new'::text;

alter table "public"."affiliate_leads" alter column "source" set default 'manual'::text;

alter table "public"."affiliate_leads" alter column "estimated_value" set default 0;

alter table "public"."affiliate_leads" alter column "created_at" set default now();

alter table "public"."affiliate_leads" alter column "updated_at" set default now();

alter table "public"."affiliate_payout_items" alter column "created_at" set default now();

alter table "public"."affiliate_payouts" alter column "id" set default gen_random_uuid();

alter table "public"."affiliate_payouts" alter column "gross_commissions" set default 0;

alter table "public"."affiliate_payouts" alter column "debt_offset" set default 0;

alter table "public"."affiliate_payouts" alter column "status" set default 'requested'::text;

alter table "public"."affiliate_payouts" alter column "provider" set default 'manual'::text;

alter table "public"."affiliate_payouts" alter column "requested_at" set default now();

alter table "public"."affiliate_payouts" alter column "created_at" set default now();

alter table "public"."affiliate_payouts" alter column "updated_at" set default now();

alter table "public"."affiliate_profiles" alter column "id" set default gen_random_uuid();

alter table "public"."affiliate_profiles" alter column "status" set default 'active'::text;

alter table "public"."affiliate_profiles" alter column "payout_status" set default 'pending_verification'::text;

alter table "public"."affiliate_profiles" alter column "commission_rate" set default 0.6000;

alter table "public"."affiliate_profiles" alter column "debt_balance" set default 0;

alter table "public"."affiliate_profiles" alter column "marketing_opt_in" set default false;

alter table "public"."affiliate_profiles" alter column "created_at" set default now();

alter table "public"."affiliate_profiles" alter column "updated_at" set default now();

alter table "public"."affiliate_program_settings" alter column "id" set default 1;

alter table "public"."affiliate_program_settings" alter column "commission_rate" set default 0.6000;

alter table "public"."affiliate_program_settings" alter column "hold_days" set default 14;

alter table "public"."affiliate_program_settings" alter column "minimum_payout_amount" set default 50.00;

alter table "public"."affiliate_program_settings" alter column "attribution_days" set default 60;

alter table "public"."affiliate_program_settings" alter column "payouts_enabled" set default true;

alter table "public"."affiliate_program_settings" alter column "automatic_payout_enabled" set default false;

alter table "public"."affiliate_program_settings" alter column "terms_version" set default '2026-07-29'::text;

alter table "public"."affiliate_program_settings" alter column "updated_at" set default now();

alter table "public"."affiliate_referrals" alter column "id" set default gen_random_uuid();

alter table "public"."affiliate_referrals" alter column "status" set default 'registered'::text;

alter table "public"."affiliate_referrals" alter column "source" set default 'link'::text;

alter table "public"."affiliate_referrals" alter column "registered_at" set default now();

alter table "public"."affiliate_referrals" alter column "commission_expected" set default 0;

alter table "public"."affiliate_referrals" alter column "created_at" set default now();

alter table "public"."affiliate_referrals" alter column "updated_at" set default now();

alter table "public"."affiliate_referrals" alter column "review_status" set default 'pending'::text;

alter table "public"."affiliate_tasks" alter column "id" set default gen_random_uuid();

alter table "public"."affiliate_tasks" alter column "task_type" set default 'follow_up'::text;

alter table "public"."affiliate_tasks" alter column "priority" set default 'normal'::text;

alter table "public"."affiliate_tasks" alter column "created_at" set default now();

alter table "public"."affiliate_tasks" alter column "updated_at" set default now();

alter table "public"."affiliate_training_sessions" alter column "id" set default gen_random_uuid();

alter table "public"."affiliate_training_sessions" alter column "total_score" set default 0;

alter table "public"."affiliate_training_sessions" alter column "score_json" set default '{}'::jsonb;

alter table "public"."affiliate_training_sessions" alter column "completed_at" set default now();

alter table "public"."affiliate_training_sessions" alter column "created_at" set default now();

alter table "public"."app_notifications" alter column "id" set default gen_random_uuid();

alter table "public"."app_notifications" alter column "tipo" set default 'info'::text;

alter table "public"."app_notifications" alter column "status" set default 'unread'::text;

alter table "public"."app_notifications" alter column "payload" set default '{}'::jsonb;

alter table "public"."app_notifications" alter column "created_at" set default now();

alter table "public"."application_error_events" alter column "id" set default gen_random_uuid();

alter table "public"."application_error_events" alter column "created_at" set default now();

alter table "public"."application_error_events" alter column "environment" set default 'unknown'::text;

alter table "public"."application_error_events" alter column "metadata" set default '{}'::jsonb;

alter table "public"."art_approval_requests" alter column "id" set default gen_random_uuid();

alter table "public"."art_approval_requests" alter column "token" set default encode(gen_random_bytes(18), 'hex'::text);

alter table "public"."art_approval_requests" alter column "status" set default 'Aguardando aprovação da arte'::text;

alter table "public"."art_approval_requests" alter column "created_at" set default now();

alter table "public"."art_approval_requests" alter column "updated_at" set default now();

alter table "public"."art_approval_requests" alter column "expires_at" set default (clock_timestamp() + '7 days'::interval);

alter table "public"."assistant_events" alter column "id" set default gen_random_uuid();

alter table "public"."assistant_events" alter column "metadata" set default '{}'::jsonb;

alter table "public"."assistant_events" alter column "created_at" set default now();

alter table "public"."automation_rules" alter column "id" set default gen_random_uuid();

alter table "public"."automation_rules" alter column "enabled" set default true;

alter table "public"."automation_rules" alter column "conditions" set default '[]'::jsonb;

alter table "public"."automation_rules" alter column "actions" set default '[]'::jsonb;

alter table "public"."automation_rules" alter column "created_at" set default now();

alter table "public"."automation_rules" alter column "updated_at" set default now();

alter table "public"."automation_runs" alter column "id" set default gen_random_uuid();

alter table "public"."automation_runs" alter column "status" set default 'queued'::text;

alter table "public"."automation_runs" alter column "attempts" set default 0;

alter table "public"."automation_runs" alter column "max_attempts" set default 5;

alter table "public"."automation_runs" alter column "input" set default '{}'::jsonb;

alter table "public"."automation_runs" alter column "result" set default '{}'::jsonb;

alter table "public"."automation_runs" alter column "created_at" set default now();

alter table "public"."background_jobs" alter column "id" set default gen_random_uuid();

alter table "public"."background_jobs" alter column "payload" set default '{}'::jsonb;

alter table "public"."background_jobs" alter column "status" set default 'queued'::text;

alter table "public"."background_jobs" alter column "attempts" set default 0;

alter table "public"."background_jobs" alter column "max_attempts" set default 5;

alter table "public"."background_jobs" alter column "run_after" set default now();

alter table "public"."background_jobs" alter column "created_at" set default now();

alter table "public"."background_jobs" alter column "metadata" set default '{}'::jsonb;

alter table "public"."business_hours" alter column "id" set default gen_random_uuid();

alter table "public"."business_hours" alter column "active" set default true;

alter table "public"."business_hours" alter column "created_at" set default now();

alter table "public"."business_hours" alter column "updated_at" set default now();

alter table "public"."business_hours" alter column "is_active" set default true;

alter table "public"."business_hours" alter column "is_open" set default true;

alter table "public"."companies" alter column "id" set default gen_random_uuid();

alter table "public"."companies" alter column "cor_principal" set default '#fb923c'::text;

alter table "public"."companies" alter column "plano" set default 'basico'::text;

alter table "public"."companies" alter column "ativo" set default true;

alter table "public"."companies" alter column "created_at" set default now();

alter table "public"."companies" alter column "aceita_pix" set default true;

alter table "public"."companies" alter column "aceita_cartao" set default false;

alter table "public"."companies" alter column "cobrar_sinal" set default false;

alter table "public"."companies" alter column "percentual_sinal" set default 0;

alter table "public"."companies" alter column "assinatura_status" set default 'pendente'::text;

alter table "public"."companies" alter column "modelo_perguntas" set default '[]'::jsonb;

alter table "public"."companies" alter column "site_template" set default 'auto'::text;

alter table "public"."companies" alter column "site_status" set default 'publicado'::text;

alter table "public"."companies" alter column "site_primary_color" set default '#05245c'::text;

alter table "public"."companies" alter column "site_accent_color" set default '#22c55e'::text;

alter table "public"."companies" alter column "site_config" set default '{}'::jsonb;

alter table "public"."companies" alter column "site_updated_at" set default now();

alter table "public"."companies" alter column "pix_tipo" set default 'telefone'::text;

alter table "public"."companies" alter column "marketplace_ativo" set default true;

alter table "public"."companies" alter column "marketplace_texto_botao" set default 'Comprar agora'::text;

alter table "public"."companies" alter column "marketplace_config" set default '{}'::jsonb;

alter table "public"."companies" alter column "site_publico_ativo" set default true;

alter table "public"."companies" alter column "site_background_color" set default '#f5f8ff'::text;

alter table "public"."companies" alter column "site_cta_text" set default 'Ver loja'::text;

alter table "public"."companies" alter column "site_show_store" set default true;

alter table "public"."companies" alter column "site_show_about" set default true;

alter table "public"."companies" alter column "site_show_contact" set default true;

alter table "public"."companies" alter column "site_show_featured" set default true;

alter table "public"."companies" alter column "site_features" set default '[]'::jsonb;

alter table "public"."companies" alter column "site_faq" set default '[]'::jsonb;

alter table "public"."companies" alter column "site_testimonials" set default '[]'::jsonb;

alter table "public"."companies" alter column "site_custom_sections" set default '[]'::jsonb;

alter table "public"."companies" alter column "updated_at" set default now();

alter table "public"."companies" alter column "assinatura_auto_recorrente" set default false;

alter table "public"."companies" alter column "modelo_mensagens" set default '[]'::jsonb;

alter table "public"."companies" alter column "modelo_proposta" set default '{}'::jsonb;

alter table "public"."companies" alter column "site_layout" set default 'moderno'::text;

alter table "public"."companies" alter column "site_art_style" set default 'profissional'::text;

alter table "public"."companies" alter column "site_font_style" set default 'inter'::text;

alter table "public"."companies" alter column "site_button_style" set default 'arredondado'::text;

alter table "public"."companies" alter column "site_hero_alignment" set default 'esquerda'::text;

alter table "public"."companies" alter column "site_text_color" set default '#071b3a'::text;

alter table "public"."companies" alter column "site_card_color" set default '#ffffff'::text;

alter table "public"."companies" alter column "site_secondary_cta_text" set default 'Ver catálogo'::text;

alter table "public"."companies" alter column "site_show_faq" set default true;

alter table "public"."companies" alter column "site_show_testimonials" set default true;

alter table "public"."companies" alter column "site_show_gallery" set default true;

alter table "public"."companies" alter column "site_show_benefits" set default true;

alter table "public"."companies" alter column "site_gallery" set default '[]'::jsonb;

alter table "public"."companies" alter column "site_benefits" set default '[]'::jsonb;

alter table "public"."companies" alter column "site_promo_active" set default false;

alter table "public"."companies" alter column "site_promo_button_text" set default 'Aproveitar oferta'::text;

alter table "public"."companies" alter column "site_business_hours" set default '{}'::jsonb;

alter table "public"."companies" alter column "site_hero_style" set default 'premium-showcase'::text;

alter table "public"."companies" alter column "site_art_variant" set default 'auto'::text;

alter table "public"."companies" alter column "site_section_style" set default 'soft-premium'::text;

alter table "public"."companies" alter column "site_product_card_style" set default 'premium'::text;

alter table "public"."companies" alter column "site_nav_variant" set default 'clean'::text;

alter table "public"."companies" alter column "site_corner_style" set default 'rounded'::text;

alter table "public"."companies" alter column "site_density" set default 'comfortable'::text;

alter table "public"."companies" alter column "site_show_marketplace" set default true;

alter table "public"."companies" alter column "site_enable_cart" set default true;

alter table "public"."companies" alter column "site_enable_coupons" set default true;

alter table "public"."companies" alter column "site_show_prices" set default true;

alter table "public"."companies" alter column "site_checkout_mode" set default 'cart'::text;

alter table "public"."companies" alter column "site_marketplace_title" set default 'Catálogo online'::text;

alter table "public"."companies" alter column "site_marketplace_subtitle" set default 'Escolha produtos, monte seu pedido e envie tudo organizado para atendimento.'::text;

alter table "public"."companies" alter column "site_cart_button_text" set default 'Adicionar'::text;

alter table "public"."companies" alter column "site_checkout_button_text" set default 'Finalizar pedido'::text;

alter table "public"."companies" alter column "site_empty_catalog_text" set default 'A empresa ainda está preparando o catálogo.'::text;

alter table "public"."companies" alter column "site_trust_title" set default 'Por que escolher a gente?'::text;

alter table "public"."companies" alter column "site_hero_highlights" set default '[]'::jsonb;

alter table "public"."companies" alter column "whatsapp_enabled" set default false;

alter table "public"."companies" alter column "whatsapp_auto_reply_enabled" set default false;

alter table "public"."companies" alter column "whatsapp_order_notifications" set default false;

alter table "public"."companies" alter column "whatsapp_status_notifications" set default false;

alter table "public"."companies" alter column "whatsapp_ai_enabled" set default false;

alter table "public"."companies" alter column "onboarding_current_step" set default 1;

alter table "public"."companies" alter column "onboarding_completed" set default false;

alter table "public"."companies" alter column "onboarding_dismissed" set default false;

alter table "public"."companies" alter column "onboarding_updated_at" set default now();

alter table "public"."companies" alter column "business_type" set default 'services'::text;

alter table "public"."companies" alter column "site_sections" set default '[]'::jsonb;

alter table "public"."companies" alter column "cancel_at_period_end" set default false;

alter table "public"."companies" alter column "is_founder" set default false;

alter table "public"."companies" alter column "founder_billing_attempts" set default 0;

alter table "public"."companies" alter column "founder_price_conversion_attempts" set default 0;

alter table "public"."company_health_snapshots" alter column "reasons" set default '[]'::jsonb;

alter table "public"."company_health_snapshots" alter column "metrics" set default '{}'::jsonb;

alter table "public"."company_health_snapshots" alter column "calculated_at" set default now();

alter table "public"."company_members" alter column "id" set default gen_random_uuid();

alter table "public"."company_members" alter column "cargo" set default 'atendente'::text;

alter table "public"."company_members" alter column "status" set default 'ativo'::text;

alter table "public"."company_members" alter column "permissions" set default '{}'::jsonb;

alter table "public"."company_members" alter column "created_at" set default now();

alter table "public"."company_members" alter column "updated_at" set default now();

alter table "public"."company_niche_templates" alter column "id" set default gen_random_uuid();

alter table "public"."company_niche_templates" alter column "categories" set default '{}'::text[];

alter table "public"."company_niche_templates" alter column "questions" set default '{}'::text[];

alter table "public"."company_niche_templates" alter column "statuses" set default '{}'::text[];

alter table "public"."company_niche_templates" alter column "ready_messages" set default '[]'::jsonb;

alter table "public"."company_niche_templates" alter column "proposal_model" set default '{}'::jsonb;

alter table "public"."company_niche_templates" alter column "recommended_fields" set default '{}'::text[];

alter table "public"."company_niche_templates" alter column "applied_at" set default now();

alter table "public"."company_niche_templates" alter column "updated_at" set default now();

alter table "public"."company_proposal_settings" alter column "id" set default gen_random_uuid();

alter table "public"."company_proposal_settings" alter column "default_validity_days" set default 7;

alter table "public"."company_proposal_settings" alter column "require_document" set default false;

alter table "public"."company_proposal_settings" alter column "require_signature_name" set default true;

alter table "public"."company_proposal_settings" alter column "auto_generate_pix" set default true;

alter table "public"."company_proposal_settings" alter column "created_at" set default now();

alter table "public"."company_proposal_settings" alter column "updated_at" set default now();

alter table "public"."company_whatsapp_settings" alter column "enabled" set default false;

alter table "public"."company_whatsapp_settings" alter column "ai_enabled" set default false;

alter table "public"."company_whatsapp_settings" alter column "notify_owner_new_order" set default true;

alter table "public"."company_whatsapp_settings" alter column "notify_client_new_order" set default true;

alter table "public"."company_whatsapp_settings" alter column "notify_client_order_status" set default true;

alter table "public"."company_whatsapp_settings" alter column "notify_client_proposal" set default true;

alter table "public"."company_whatsapp_settings" alter column "notify_owner_proposal" set default true;

alter table "public"."company_whatsapp_settings" alter column "fallback_message" set default 'No momento não consegui responder automaticamente. Nossa equipe vai continuar seu atendimento.'::text;

alter table "public"."company_whatsapp_settings" alter column "template_language" set default 'pt_BR'::text;

alter table "public"."company_whatsapp_settings" alter column "metadata" set default '{}'::jsonb;

alter table "public"."company_whatsapp_settings" alter column "created_at" set default now();

alter table "public"."company_whatsapp_settings" alter column "updated_at" set default now();

alter table "public"."crm_leads" alter column "id" set default gen_random_uuid();

alter table "public"."crm_leads" alter column "origem" set default 'manual'::text;

alter table "public"."crm_leads" alter column "etapa" set default 'novo_lead'::text;

alter table "public"."crm_leads" alter column "status" set default 'ativo'::text;

alter table "public"."crm_leads" alter column "valor_estimado" set default 0;

alter table "public"."crm_leads" alter column "created_at" set default now();

alter table "public"."crm_leads" alter column "updated_at" set default now();

alter table "public"."customer_duplicate_candidates" alter column "id" set default gen_random_uuid();

alter table "public"."customer_duplicate_candidates" alter column "reasons" set default '[]'::jsonb;

alter table "public"."customer_duplicate_candidates" alter column "confidence" set default 0;

alter table "public"."customer_duplicate_candidates" alter column "status" set default 'needs_review'::text;

alter table "public"."customer_duplicate_candidates" alter column "created_at" set default now();

alter table "public"."customer_duplicate_candidates" alter column "updated_at" set default now();

alter table "public"."customer_followups" alter column "id" set default gen_random_uuid();

alter table "public"."customer_followups" alter column "status" set default 'pendente'::text;

alter table "public"."customer_followups" alter column "prioridade" set default 'media'::text;

alter table "public"."customer_followups" alter column "created_at" set default now();

alter table "public"."customer_internal_notes" alter column "id" set default gen_random_uuid();

alter table "public"."customer_internal_notes" alter column "created_at" set default now();

alter table "public"."customer_magic_links" alter column "id" set default gen_random_uuid();

alter table "public"."customer_magic_links" alter column "token" set default encode(gen_random_bytes(18), 'hex'::text);

alter table "public"."customer_magic_links" alter column "status" set default 'ativo'::text;

alter table "public"."customer_magic_links" alter column "created_at" set default now();

alter table "public"."customer_notes" alter column "id" set default gen_random_uuid();

alter table "public"."customer_notes" alter column "tipo" set default 'nota'::text;

alter table "public"."customer_notes" alter column "created_at" set default now();

alter table "public"."customer_portal_events" alter column "id" set default gen_random_uuid();

alter table "public"."customer_portal_events" alter column "metadata" set default '{}'::jsonb;

alter table "public"."customer_portal_events" alter column "created_at" set default now();

alter table "public"."customer_profiles" alter column "id" set default gen_random_uuid();

alter table "public"."customer_profiles" alter column "source" set default 'manual'::text;

alter table "public"."customer_profiles" alter column "created_at" set default now();

alter table "public"."customer_profiles" alter column "updated_at" set default now();

alter table "public"."customer_profiles" alter column "archived" set default false;

alter table "public"."customer_profiles" alter column "metadata" set default '{}'::jsonb;

alter table "public"."data_quality_issues" alter column "id" set default gen_random_uuid();

alter table "public"."data_quality_issues" alter column "auto_fixable" set default false;

alter table "public"."data_quality_issues" alter column "status" set default 'open'::text;

alter table "public"."data_quality_issues" alter column "metadata" set default '{}'::jsonb;

alter table "public"."data_quality_issues" alter column "first_seen_at" set default now();

alter table "public"."data_quality_issues" alter column "last_seen_at" set default now();

alter table "public"."deliveries" alter column "id" set default gen_random_uuid();

alter table "public"."deliveries" alter column "delivery_fee" set default 0;

alter table "public"."deliveries" alter column "status" set default 'waiting_preparation'::text;

alter table "public"."deliveries" alter column "created_at" set default now();

alter table "public"."deliveries" alter column "updated_at" set default now();

alter table "public"."delivery_assignments" alter column "id" set default gen_random_uuid();

alter table "public"."delivery_assignments" alter column "order_total" set default 0;

alter table "public"."delivery_assignments" alter column "delivery_fee" set default 0;

alter table "public"."delivery_assignments" alter column "status" set default 'assigned'::text;

alter table "public"."delivery_assignments" alter column "assigned_at" set default now();

alter table "public"."delivery_assignments" alter column "settlement_status" set default 'pending'::text;

alter table "public"."delivery_assignments" alter column "created_at" set default now();

alter table "public"."delivery_assignments" alter column "updated_at" set default now();

alter table "public"."delivery_drivers" alter column "id" set default gen_random_uuid();

alter table "public"."delivery_drivers" alter column "is_active" set default true;

alter table "public"."delivery_drivers" alter column "created_at" set default now();

alter table "public"."delivery_drivers" alter column "updated_at" set default now();

alter table "public"."delivery_zones" alter column "id" set default gen_random_uuid();

alter table "public"."delivery_zones" alter column "fee" set default 0;

alter table "public"."delivery_zones" alter column "active" set default true;

alter table "public"."delivery_zones" alter column "created_at" set default now();

alter table "public"."delivery_zones" alter column "updated_at" set default now();

alter table "public"."delivery_zones" alter column "is_active" set default true;

alter table "public"."delivery_zones" alter column "minimum_order" set default 0;

alter table "public"."demo_data_registry" alter column "created_at" set default now();

alter table "public"."event_idempotency" alter column "id" set default gen_random_uuid();

alter table "public"."event_idempotency" alter column "received_at" set default now();

alter table "public"."event_idempotency" alter column "status" set default 'received'::text;

alter table "public"."event_idempotency" alter column "attempt" set default 1;

alter table "public"."event_idempotency" alter column "metadata" set default '{}'::jsonb;

alter table "public"."finance_accounts" alter column "id" set default gen_random_uuid();

alter table "public"."finance_accounts" alter column "tipo" set default 'caixa'::text;

alter table "public"."finance_accounts" alter column "saldo_inicial" set default 0;

alter table "public"."finance_accounts" alter column "ativo" set default true;

alter table "public"."finance_accounts" alter column "created_at" set default now();

alter table "public"."finance_accounts" alter column "updated_at" set default now();

alter table "public"."financial_categories" alter column "id" set default gen_random_uuid();

alter table "public"."financial_categories" alter column "created_at" set default now();

alter table "public"."financial_material_entries" alter column "id" set default gen_random_uuid();

alter table "public"."financial_material_entries" alter column "quantidade" set default 1;

alter table "public"."financial_material_entries" alter column "unidade" set default 'un'::text;

alter table "public"."financial_material_entries" alter column "valor_unitario" set default 0;

alter table "public"."financial_material_entries" alter column "valor_total" set default 0;

alter table "public"."financial_material_entries" alter column "created_at" set default now();

alter table "public"."financial_transactions" alter column "id" set default gen_random_uuid();

alter table "public"."financial_transactions" alter column "tipo" set default 'saida'::text;

alter table "public"."financial_transactions" alter column "categoria" set default 'outros'::text;

alter table "public"."financial_transactions" alter column "valor" set default 0;

alter table "public"."financial_transactions" alter column "data_competencia" set default CURRENT_DATE;

alter table "public"."financial_transactions" alter column "status" set default 'pago'::text;

alter table "public"."financial_transactions" alter column "origem" set default 'manual'::text;

alter table "public"."financial_transactions" alter column "raw_data" set default '{}'::jsonb;

alter table "public"."financial_transactions" alter column "created_at" set default now();

alter table "public"."financial_transactions" alter column "updated_at" set default now();

alter table "public"."financial_transactions" alter column "tags" set default '{}'::text[];

alter table "public"."financial_transactions" alter column "recorrente" set default false;

alter table "public"."founder_invites" alter column "id" set default gen_random_uuid();

alter table "public"."founder_invites" alter column "status" set default 'pending'::text;

alter table "public"."founder_invites" alter column "invited_at" set default now();

alter table "public"."founder_invites" alter column "created_at" set default now();

alter table "public"."founder_invites" alter column "updated_at" set default now();

alter table "public"."founder_invites" alter column "activation_attempts" set default 0;

alter table "public"."integration_connections" alter column "id" set default gen_random_uuid();

alter table "public"."integration_connections" alter column "status" set default 'NOT_CONFIGURED'::text;

alter table "public"."integration_connections" alter column "capabilities" set default '{}'::text[];

alter table "public"."integration_connections" alter column "config" set default '{}'::jsonb;

alter table "public"."integration_connections" alter column "created_at" set default now();

alter table "public"."integration_connections" alter column "updated_at" set default now();

alter table "public"."integration_mappings" alter column "id" set default gen_random_uuid();

alter table "public"."integration_mappings" alter column "metadata" set default '{}'::jsonb;

alter table "public"."integration_mappings" alter column "created_at" set default now();

alter table "public"."integration_mappings" alter column "updated_at" set default now();

alter table "public"."integration_oauth_states" alter column "id" set default gen_random_uuid();

alter table "public"."integration_oauth_states" alter column "created_at" set default now();

alter table "public"."integration_oauth_states" alter column "requested_scopes" set default '{}'::text[];

alter table "public"."integration_push_channels" alter column "id" set default gen_random_uuid();

alter table "public"."integration_push_channels" alter column "state" set default 'active'::text;

alter table "public"."integration_push_channels" alter column "metadata" set default '{}'::jsonb;

alter table "public"."integration_push_channels" alter column "created_at" set default now();

alter table "public"."integration_push_channels" alter column "updated_at" set default now();

alter table "public"."integration_sync_cursors" alter column "cursor_key" set default 'default'::text;

alter table "public"."integration_sync_cursors" alter column "checkpoint" set default '{}'::jsonb;

alter table "public"."integration_sync_cursors" alter column "updated_at" set default now();

alter table "public"."integration_usage_daily" alter column "usage_day" set default CURRENT_DATE;

alter table "public"."integration_usage_daily" alter column "quantity" set default 0;

alter table "public"."integration_usage_daily" alter column "metadata" set default '{}'::jsonb;

alter table "public"."integration_usage_daily" alter column "updated_at" set default now();

alter table "public"."internal_tasks" alter column "id" set default gen_random_uuid();

alter table "public"."internal_tasks" alter column "status" set default 'pendente'::text;

alter table "public"."internal_tasks" alter column "prioridade" set default 'media'::text;

alter table "public"."internal_tasks" alter column "created_at" set default now();

alter table "public"."internal_tasks" alter column "updated_at" set default now();

alter table "public"."marketplace_commission_rules" alter column "id" set default gen_random_uuid();

alter table "public"."marketplace_commission_rules" alter column "commission_percentage" set default 5.00;

alter table "public"."marketplace_commission_rules" alter column "commission_fixed" set default 0;

alter table "public"."marketplace_commission_rules" alter column "is_active" set default true;

alter table "public"."marketplace_commission_rules" alter column "created_at" set default now();

alter table "public"."marketplace_commission_rules" alter column "updated_at" set default now();

alter table "public"."marketplace_commissions" alter column "id" set default gen_random_uuid();

alter table "public"."marketplace_commissions" alter column "provider" set default 'mercado_pago'::text;

alter table "public"."marketplace_commissions" alter column "gross_amount" set default 0;

alter table "public"."marketplace_commissions" alter column "commission_percentage" set default 0;

alter table "public"."marketplace_commissions" alter column "commission_fixed" set default 0;

alter table "public"."marketplace_commissions" alter column "commission_amount" set default 0;

alter table "public"."marketplace_commissions" alter column "status" set default 'pending'::text;

alter table "public"."marketplace_commissions" alter column "created_at" set default now();

alter table "public"."marketplace_commissions" alter column "updated_at" set default now();

alter table "public"."marketplace_coupons" alter column "id" set default gen_random_uuid();

alter table "public"."marketplace_coupons" alter column "tipo" set default 'percentual'::text;

alter table "public"."marketplace_coupons" alter column "valor" set default 0;

alter table "public"."marketplace_coupons" alter column "valor_minimo_pedido" set default 0;

alter table "public"."marketplace_coupons" alter column "used_count" set default 0;

alter table "public"."marketplace_coupons" alter column "ativo" set default true;

alter table "public"."marketplace_coupons" alter column "created_at" set default now();

alter table "public"."marketplace_coupons" alter column "updated_at" set default now();

alter table "public"."marketplace_coupons" alter column "free_delivery" set default false;

alter table "public"."marketplace_coupons" alter column "allowed_product_ids" set default '[]'::jsonb;

alter table "public"."marketplace_coupons" alter column "allowed_categories" set default '[]'::jsonb;

alter table "public"."marketplace_oauth_states" alter column "id" set default gen_random_uuid();

alter table "public"."marketplace_oauth_states" alter column "provider" set default 'mercado_pago'::text;

alter table "public"."marketplace_oauth_states" alter column "created_at" set default now();

alter table "public"."marketplace_payment_settings" alter column "id" set default gen_random_uuid();

alter table "public"."marketplace_payment_settings" alter column "provider" set default 'mercado_pago'::text;

alter table "public"."marketplace_payment_settings" alter column "onboarding_status" set default 'pending'::text;

alter table "public"."marketplace_payment_settings" alter column "is_active" set default false;

alter table "public"."marketplace_payment_settings" alter column "created_at" set default now();

alter table "public"."marketplace_payment_settings" alter column "updated_at" set default now();

alter table "public"."marketplace_payment_settings" alter column "charges_enabled" set default false;

alter table "public"."marketplace_payment_settings" alter column "payouts_enabled" set default false;

alter table "public"."marketplace_payment_settings" alter column "pix_enabled" set default false;

alter table "public"."marketplace_payment_settings" alter column "card_enabled" set default false;

alter table "public"."marketplace_payment_settings" alter column "provider_metadata_sanitized" set default '{}'::jsonb;

alter table "public"."marketplace_payment_settings" alter column "automatic_payout_enabled" set default false;

alter table "public"."marketplace_payment_settings" alter column "minimum_payout_amount" set default 0;

alter table "public"."marketplace_payments" alter column "id" set default gen_random_uuid();

alter table "public"."marketplace_payments" alter column "provider" set default 'mercado_pago'::text;

alter table "public"."marketplace_payments" alter column "status" set default 'pending'::text;

alter table "public"."marketplace_payments" alter column "amount" set default 0;

alter table "public"."marketplace_payments" alter column "subtotal" set default 0;

alter table "public"."marketplace_payments" alter column "delivery_fee" set default 0;

alter table "public"."marketplace_payments" alter column "discount_amount" set default 0;

alter table "public"."marketplace_payments" alter column "commission_amount" set default 0;

alter table "public"."marketplace_payments" alter column "commission_percentage" set default 0;

alter table "public"."marketplace_payments" alter column "currency" set default 'BRL'::text;

alter table "public"."marketplace_payments" alter column "raw_payload" set default '{}'::jsonb;

alter table "public"."marketplace_payments" alter column "created_at" set default now();

alter table "public"."marketplace_payments" alter column "updated_at" set default now();

alter table "public"."marketplace_stock_reservations" alter column "id" set default gen_random_uuid();

alter table "public"."marketplace_stock_reservations" alter column "status" set default 'reserved'::text;

alter table "public"."marketplace_stock_reservations" alter column "created_at" set default now();

alter table "public"."marketplace_stock_reservations" alter column "updated_at" set default now();

alter table "public"."notifications" alter column "id" set default gen_random_uuid();

alter table "public"."notifications" alter column "priority" set default 'normal'::text;

alter table "public"."notifications" alter column "metadata" set default '{}'::jsonb;

alter table "public"."notifications" alter column "created_at" set default now();

alter table "public"."order_internal_comments" alter column "id" set default gen_random_uuid();

alter table "public"."order_internal_comments" alter column "created_at" set default now();

alter table "public"."order_items" alter column "id" set default gen_random_uuid();

alter table "public"."order_items" alter column "quantidade" set default 1;

alter table "public"."order_items" alter column "preco_unitario" set default 0;

alter table "public"."order_items" alter column "subtotal" set default 0;

alter table "public"."order_items" alter column "created_at" set default now();

alter table "public"."order_items" alter column "respostas" set default '{}'::jsonb;

alter table "public"."order_items" alter column "quantity" set default 1;

alter table "public"."order_items" alter column "unit_price" set default 0;

alter table "public"."order_items" alter column "addons" set default '[]'::jsonb;

alter table "public"."order_items" alter column "variation" set default '{}'::jsonb;

alter table "public"."order_items" alter column "total" set default 0;

alter table "public"."order_payments" alter column "id" set default gen_random_uuid();

alter table "public"."order_payments" alter column "type" set default 'full'::text;

alter table "public"."order_payments" alter column "status" set default 'pending'::text;

alter table "public"."order_payments" alter column "amount" set default 0;

alter table "public"."order_payments" alter column "paid_amount" set default 0;

alter table "public"."order_payments" alter column "remaining_amount" set default 0;

alter table "public"."order_payments" alter column "created_at" set default now();

alter table "public"."order_payments" alter column "updated_at" set default now();

alter table "public"."order_status_history" alter column "id" set default gen_random_uuid();

alter table "public"."order_status_history" alter column "created_at" set default now();

alter table "public"."orders" alter column "id" set default gen_random_uuid();

alter table "public"."orders" alter column "quantidade" set default 1;

alter table "public"."orders" alter column "status" set default 'Recebido'::text;

alter table "public"."orders" alter column "created_at" set default now();

alter table "public"."orders" alter column "dados_inteligentes" set default '{}'::jsonb;

alter table "public"."orders" alter column "marketplace_origem" set default 'orcamento'::text;

alter table "public"."orders" alter column "priority" set default 'normal'::text;

alter table "public"."orders" alter column "files" set default '[]'::jsonb;

alter table "public"."orders" alter column "valor_desconto" set default 0;

alter table "public"."orders" alter column "prioridade" set default 'normal'::text;

alter table "public"."orders" alter column "canal_origem" set default 'site'::text;

alter table "public"."orders" alter column "updated_at" set default now();

alter table "public"."orders" alter column "delivery_fee" set default 0;

alter table "public"."orders" alter column "subtotal" set default 0;

alter table "public"."orders" alter column "total_amount" set default 0;

alter table "public"."orders" alter column "payment_status" set default 'pending'::text;

alter table "public"."orders" alter column "items_snapshot" set default '[]'::jsonb;

alter table "public"."orders" alter column "discount_amount" set default 0;

alter table "public"."orders" alter column "total" set default 0;

alter table "public"."payment_methods" alter column "id" set default gen_random_uuid();

alter table "public"."payment_methods" alter column "is_active" set default true;

alter table "public"."payment_methods" alter column "requires_change" set default false;

alter table "public"."payment_methods" alter column "allow_delivery_payment" set default true;

alter table "public"."payment_methods" alter column "allow_online_payment" set default false;

alter table "public"."payment_methods" alter column "created_at" set default now();

alter table "public"."payment_methods" alter column "updated_at" set default now();

alter table "public"."payment_payouts" alter column "id" set default gen_random_uuid();

alter table "public"."payment_payouts" alter column "amount" set default 0;

alter table "public"."payment_payouts" alter column "status" set default 'pending'::text;

alter table "public"."payment_payouts" alter column "created_at" set default now();

alter table "public"."payment_payouts" alter column "updated_at" set default now();

alter table "public"."payment_payouts" alter column "attempts" set default 0;

alter table "public"."payment_webhook_events" alter column "id" set default gen_random_uuid();

alter table "public"."payment_webhook_events" alter column "payload_sanitized" set default '{}'::jsonb;

alter table "public"."payment_webhook_events" alter column "processing_status" set default 'received'::text;

alter table "public"."payment_webhook_events" alter column "attempts" set default 1;

alter table "public"."payment_webhook_events" alter column "received_at" set default now();

alter table "public"."plan_payments" alter column "id" set default gen_random_uuid();

alter table "public"."plan_payments" alter column "status" set default 'pendente'::text;

alter table "public"."plan_payments" alter column "created_at" set default now();

alter table "public"."plan_payments" alter column "tipo" set default 'checkout'::text;

alter table "public"."plan_payments" alter column "updated_at" set default now();

alter table "public"."platform_admin_invites" alter column "id" set default gen_random_uuid();

alter table "public"."platform_admin_invites" alter column "role" set default 'prospector'::text;

alter table "public"."platform_admin_invites" alter column "area" set default 'Comercial'::text;

alter table "public"."platform_admin_invites" alter column "permissions" set default '{}'::jsonb;

alter table "public"."platform_admin_invites" alter column "status" set default 'pending'::text;

alter table "public"."platform_admin_invites" alter column "invited_at" set default now();

alter table "public"."platform_admin_invites" alter column "created_at" set default now();

alter table "public"."platform_admin_invites" alter column "updated_at" set default now();

alter table "public"."platform_admins" alter column "id" set default gen_random_uuid();

alter table "public"."platform_admins" alter column "role" set default 'admin'::text;

alter table "public"."platform_admins" alter column "is_active" set default true;

alter table "public"."platform_admins" alter column "created_at" set default now();

alter table "public"."platform_admins" alter column "updated_at" set default now();

alter table "public"."platform_admins" alter column "permissions" set default '{}'::jsonb;

alter table "public"."platform_admins" alter column "area" set default 'Plataforma'::text;

alter table "public"."platform_admins" alter column "must_change_password" set default false;

alter table "public"."platform_feature_flags" alter column "id" set default gen_random_uuid();

alter table "public"."platform_feature_flags" alter column "enabled" set default false;

alter table "public"."platform_feature_flags" alter column "scope" set default 'global'::text;

alter table "public"."platform_feature_flags" alter column "scope_value" set default '*'::text;

alter table "public"."platform_feature_flags" alter column "config" set default '{}'::jsonb;

alter table "public"."platform_feature_flags" alter column "created_at" set default now();

alter table "public"."platform_feature_flags" alter column "updated_at" set default now();

alter table "public"."platform_support_ticket_events" alter column "id" set default gen_random_uuid();

alter table "public"."platform_support_ticket_events" alter column "metadata" set default '{}'::jsonb;

alter table "public"."platform_support_ticket_events" alter column "created_at" set default now();

alter table "public"."platform_support_tickets" alter column "id" set default gen_random_uuid();

alter table "public"."platform_support_tickets" alter column "category" set default 'geral'::text;

alter table "public"."platform_support_tickets" alter column "priority" set default 'medium'::text;

alter table "public"."platform_support_tickets" alter column "attachments" set default '[]'::jsonb;

alter table "public"."platform_support_tickets" alter column "status" set default 'new'::text;

alter table "public"."platform_support_tickets" alter column "metadata" set default '{}'::jsonb;

alter table "public"."platform_support_tickets" alter column "created_at" set default now();

alter table "public"."platform_support_tickets" alter column "updated_at" set default now();

alter table "public"."product_analytics_events" alter column "source" set default 'app'::text;

alter table "public"."product_analytics_events" alter column "occurred_at" set default now();

alter table "public"."product_analytics_events" alter column "metadata" set default '{}'::jsonb;

alter table "public"."product_stock_movements" alter column "id" set default gen_random_uuid();

alter table "public"."product_stock_movements" alter column "metadata" set default '{}'::jsonb;

alter table "public"."product_stock_movements" alter column "created_at" set default now();

alter table "public"."production_orders" alter column "id" set default gen_random_uuid();

alter table "public"."production_orders" alter column "total_value" set default 0;

alter table "public"."production_orders" alter column "signal_value" set default 0;

alter table "public"."production_orders" alter column "status" set default 'aguardando_sinal'::text;

alter table "public"."production_orders" alter column "priority" set default 'normal'::text;

alter table "public"."production_orders" alter column "metadata" set default '{}'::jsonb;

alter table "public"."production_orders" alter column "created_at" set default now();

alter table "public"."production_orders" alter column "updated_at" set default now();

alter table "public"."production_orders" alter column "files" set default '[]'::jsonb;

alter table "public"."production_steps" alter column "id" set default gen_random_uuid();

alter table "public"."production_steps" alter column "status" set default 'pendente'::text;

alter table "public"."production_steps" alter column "sort_order" set default 0;

alter table "public"."production_steps" alter column "metadata" set default '{}'::jsonb;

alter table "public"."production_steps" alter column "created_at" set default now();

alter table "public"."production_steps" alter column "updated_at" set default now();

alter table "public"."products" alter column "id" set default gen_random_uuid();

alter table "public"."products" alter column "ativo" set default true;

alter table "public"."products" alter column "created_at" set default now();

alter table "public"."products" alter column "tipo" set default 'produto'::text;

alter table "public"."products" alter column "unidade" set default 'unidade'::text;

alter table "public"."products" alter column "destaque" set default false;

alter table "public"."products" alter column "precificacao" set default 'unidade'::text;

alter table "public"."products" alter column "unidade_label" set default 'unidade'::text;

alter table "public"."products" alter column "permite_largura" set default false;

alter table "public"."products" alter column "permite_altura" set default false;

alter table "public"."products" alter column "permite_comprimento" set default false;

alter table "public"."products" alter column "permite_quantidade" set default true;

alter table "public"."products" alter column "valor_minimo" set default 0;

alter table "public"."products" alter column "cobrar_sinal_personalizado" set default false;

alter table "public"."products" alter column "configuracoes" set default '{}'::jsonb;

alter table "public"."products" alter column "image_urls" set default '{}'::text[];

alter table "public"."products" alter column "arquivado" set default false;

alter table "public"."products" alter column "updated_at" set default now();

alter table "public"."products" alter column "custo_material" set default 0;

alter table "public"."products" alter column "custo_mao_obra" set default 0;

alter table "public"."products" alter column "custo_taxas" set default 0;

alter table "public"."products" alter column "custo_entrega" set default 0;

alter table "public"."products" alter column "margem_desejada" set default 30;

alter table "public"."products" alter column "archived" set default false;

alter table "public"."products" alter column "preco_sob_consulta" set default false;

alter table "public"."products" alter column "promocao_ativa" set default false;

alter table "public"."products" alter column "campos_orcamento" set default '[]'::jsonb;

alter table "public"."products" alter column "unidade_preco" set default 'unidade'::text;

alter table "public"."products" alter column "oculto" set default false;

alter table "public"."products" alter column "adicionais" set default '[]'::jsonb;

alter table "public"."products" alter column "extras" set default '{}'::jsonb;

alter table "public"."products" alter column "variations" set default '[]'::jsonb;

alter table "public"."products" alter column "addons" set default '[]'::jsonb;

alter table "public"."products" alter column "available" set default true;

alter table "public"."products" alter column "is_active" set default true;

alter table "public"."proposal_events" alter column "id" set default gen_random_uuid();

alter table "public"."proposal_events" alter column "actor_type" set default 'system'::text;

alter table "public"."proposal_events" alter column "metadata" set default '{}'::jsonb;

alter table "public"."proposal_events" alter column "created_at" set default now();

alter table "public"."proposals" alter column "id" set default gen_random_uuid();

alter table "public"."proposals" alter column "token" set default replace((gen_random_uuid())::text, '-'::text, ''::text);

alter table "public"."proposals" alter column "itens" set default '[]'::jsonb;

alter table "public"."proposals" alter column "valor_total" set default 0;

alter table "public"."proposals" alter column "valor_sinal" set default 0;

alter table "public"."proposals" alter column "status" set default 'enviado'::text;

alter table "public"."proposals" alter column "raw_data" set default '{}'::jsonb;

alter table "public"."proposals" alter column "created_at" set default now();

alter table "public"."proposals" alter column "valor_desconto" set default 0;

alter table "public"."proposals" alter column "percentual_sinal" set default 0;

alter table "public"."proposals" alter column "validade_dias" set default 7;

alter table "public"."proposals" alter column "accepted_terms" set default false;

alter table "public"."proposals" alter column "version" set default 1;

alter table "public"."proposals" alter column "updated_at" set default now();

alter table "public"."proposals" alter column "sinal_pago" set default false;

alter table "public"."proposals" alter column "view_count" set default 0;

alter table "public"."provider_customers" alter column "id" set default gen_random_uuid();

alter table "public"."provider_customers" alter column "created_at" set default now();

alter table "public"."provider_customers" alter column "updated_at" set default now();

alter table "public"."quote_templates" alter column "id" set default gen_random_uuid();

alter table "public"."quote_templates" alter column "perguntas" set default '[]'::jsonb;

alter table "public"."quote_templates" alter column "ativo" set default true;

alter table "public"."quote_templates" alter column "created_at" set default now();

alter table "public"."quote_templates" alter column "updated_at" set default now();

alter table "public"."recurring_orders" alter column "id" set default gen_random_uuid();

alter table "public"."recurring_orders" alter column "status" set default 'ativo'::text;

alter table "public"."recurring_orders" alter column "created_at" set default now();

alter table "public"."security_blocklist" alter column "id" set default gen_random_uuid();

alter table "public"."security_blocklist" alter column "active" set default true;

alter table "public"."security_blocklist" alter column "created_at" set default now();

alter table "public"."security_events" alter column "id" set default gen_random_uuid();

alter table "public"."security_events" alter column "event_type" set default 'security_event'::text;

alter table "public"."security_events" alter column "metadata" set default '{}'::jsonb;

alter table "public"."security_events" alter column "created_at" set default now();

alter table "public"."security_events" alter column "severity" set default 'baixa'::text;

alter table "public"."security_events" alter column "source" set default 'site'::text;

alter table "public"."security_events" alter column "resolved" set default false;

alter table "public"."signup_lead_followups" alter column "id" set default gen_random_uuid();

alter table "public"."signup_lead_followups" alter column "channel" set default 'whatsapp'::text;

alter table "public"."signup_lead_followups" alter column "status" set default 'pendente'::text;

alter table "public"."signup_lead_followups" alter column "scheduled_for" set default now();

alter table "public"."signup_lead_followups" alter column "raw_data" set default '{}'::jsonb;

alter table "public"."signup_lead_followups" alter column "created_at" set default now();

alter table "public"."signup_lead_followups" alter column "sales_event_type" set default 'contact'::text;

alter table "public"."signup_leads" alter column "id" set default gen_random_uuid();

alter table "public"."signup_leads" alter column "plano" set default 'profissional'::text;

alter table "public"."signup_leads" alter column "status" set default 'lead'::text;

alter table "public"."signup_leads" alter column "marketing_opt_in" set default false;

alter table "public"."signup_leads" alter column "lead_source" set default 'cadastro'::text;

alter table "public"."signup_leads" alter column "followup_count" set default 0;

alter table "public"."signup_leads" alter column "next_followup_at" set default (now() + '2 days'::interval);

alter table "public"."signup_leads" alter column "raw_data" set default '{}'::jsonb;

alter table "public"."signup_leads" alter column "created_at" set default now();

alter table "public"."signup_leads" alter column "updated_at" set default now();

alter table "public"."signup_leads" alter column "sales_stage" set default 'novo'::text;

alter table "public"."signup_leads" alter column "sales_stage_updated_at" set default now();

alter table "public"."site_sections" alter column "id" set default gen_random_uuid();

alter table "public"."site_sections" alter column "type" set default 'custom'::text;

alter table "public"."site_sections" alter column "sort_order" set default 0;

alter table "public"."site_sections" alter column "active" set default true;

alter table "public"."site_sections" alter column "locked" set default false;

alter table "public"."site_sections" alter column "config" set default '{}'::jsonb;

alter table "public"."site_sections" alter column "created_at" set default now();

alter table "public"."site_sections" alter column "updated_at" set default now();

alter table "public"."site_template_presets" alter column "payload" set default '{}'::jsonb;

alter table "public"."site_template_presets" alter column "is_active" set default true;

alter table "public"."site_template_presets" alter column "created_at" set default now();

alter table "public"."smart_notification_events" alter column "id" set default gen_random_uuid();

alter table "public"."smart_notification_events" alter column "created_at" set default now();

alter table "public"."smart_notification_settings" alter column "new_order_enabled" set default true;

alter table "public"."smart_notification_settings" alter column "order_stuck_enabled" set default true;

alter table "public"."smart_notification_settings" alter column "order_stuck_days" set default 3;

alter table "public"."smart_notification_settings" alter column "task_due_today_enabled" set default true;

alter table "public"."smart_notification_settings" alter column "lead_idle_enabled" set default true;

alter table "public"."smart_notification_settings" alter column "lead_idle_days" set default 3;

alter table "public"."smart_notification_settings" alter column "proposal_idle_enabled" set default true;

alter table "public"."smart_notification_settings" alter column "proposal_idle_days" set default 3;

alter table "public"."smart_notification_settings" alter column "coupon_expiring_enabled" set default true;

alter table "public"."smart_notification_settings" alter column "coupon_expiring_days" set default 3;

alter table "public"."smart_notification_settings" alter column "product_without_image_enabled" set default true;

alter table "public"."smart_notification_settings" alter column "site_without_logo_enabled" set default true;

alter table "public"."smart_notification_settings" alter column "subscription_expiring_enabled" set default true;

alter table "public"."smart_notification_settings" alter column "subscription_expiring_days" set default 7;

alter table "public"."smart_notification_settings" alter column "created_at" set default now();

alter table "public"."smart_notification_settings" alter column "updated_at" set default now();

alter table "public"."subscription_events" alter column "id" set default gen_random_uuid();

alter table "public"."subscription_events" alter column "provider" set default 'mercado_pago'::text;

alter table "public"."subscription_events" alter column "metadata" set default '{}'::jsonb;

alter table "public"."subscription_events" alter column "created_at" set default now();

alter table "public"."system_audit_logs" alter column "id" set default gen_random_uuid();

alter table "public"."system_audit_logs" alter column "details" set default '{}'::jsonb;

alter table "public"."system_audit_logs" alter column "created_at" set default now();

alter table "public"."timeline_events" alter column "id" set default gen_random_uuid();

alter table "public"."timeline_events" alter column "source" set default 'system'::text;

alter table "public"."timeline_events" alter column "occurred_at" set default now();

alter table "public"."timeline_events" alter column "metadata" set default '{}'::jsonb;

alter table "public"."transactional_outbox" alter column "id" set default gen_random_uuid();

alter table "public"."transactional_outbox" alter column "payload" set default '{}'::jsonb;

alter table "public"."transactional_outbox" alter column "status" set default 'queued'::text;

alter table "public"."transactional_outbox" alter column "attempts" set default 0;

alter table "public"."transactional_outbox" alter column "max_attempts" set default 5;

alter table "public"."transactional_outbox" alter column "available_at" set default now();

alter table "public"."transactional_outbox" alter column "created_at" set default now();

alter table "public"."whatsapp_connections" alter column "id" set default gen_random_uuid();

alter table "public"."whatsapp_connections" alter column "provider" set default 'meta_cloud_api'::text;

alter table "public"."whatsapp_connections" alter column "status" set default 'disconnected'::text;

alter table "public"."whatsapp_connections" alter column "metadata" set default '{}'::jsonb;

alter table "public"."whatsapp_connections" alter column "created_at" set default now();

alter table "public"."whatsapp_connections" alter column "updated_at" set default now();

alter table "public"."whatsapp_conversations" alter column "id" set default gen_random_uuid();

alter table "public"."whatsapp_conversations" alter column "ai_enabled" set default true;

alter table "public"."whatsapp_conversations" alter column "metadata" set default '{}'::jsonb;

alter table "public"."whatsapp_conversations" alter column "created_at" set default now();

alter table "public"."whatsapp_conversations" alter column "updated_at" set default now();

alter table "public"."whatsapp_message_logs" alter column "id" set default gen_random_uuid();

alter table "public"."whatsapp_message_logs" alter column "direction" set default 'outbound'::text;

alter table "public"."whatsapp_message_logs" alter column "message_type" set default 'text'::text;

alter table "public"."whatsapp_message_logs" alter column "status" set default 'pending'::text;

alter table "public"."whatsapp_message_logs" alter column "created_at" set default now();

alter table "public"."whatsapp_message_logs" alter column "updated_at" set default now();

alter table "public"."whatsapp_webhook_events" alter column "id" set default gen_random_uuid();

alter table "public"."whatsapp_webhook_events" alter column "processing_status" set default 'processing'::text;

alter table "public"."whatsapp_webhook_events" alter column "received_at" set default now();

alter table "orcaly_private"."affiliate_payout_accounts" add constraint "affiliate_payout_accounts_pkey" PRIMARY KEY (id);

alter table "orcaly_private"."api_rate_limits" add constraint "api_rate_limits_pkey" PRIMARY KEY (key);

alter table "public"."admin_audit_logs" add constraint "admin_audit_logs_pkey" PRIMARY KEY (id);

alter table "public"."admin_bug_reports" add constraint "admin_bug_reports_pkey" PRIMARY KEY (id);

alter table "public"."admin_scan_runs" add constraint "admin_scan_runs_pkey" PRIMARY KEY (id);

alter table "public"."admin_system_snapshots" add constraint "admin_system_snapshots_pkey" PRIMARY KEY (id);

alter table "public"."admin_users" add constraint "admin_users_pkey" PRIMARY KEY (id);

alter table "public"."affiliate_achievements" add constraint "affiliate_achievements_pkey" PRIMARY KEY (id);

alter table "public"."affiliate_activity_events" add constraint "affiliate_activity_events_pkey" PRIMARY KEY (id);

alter table "public"."affiliate_announcements" add constraint "affiliate_announcements_pkey" PRIMARY KEY (id);

alter table "public"."affiliate_audit_logs" add constraint "affiliate_audit_logs_pkey" PRIMARY KEY (id);

alter table "public"."affiliate_certifications" add constraint "affiliate_certifications_pkey" PRIMARY KEY (id);

alter table "public"."affiliate_clicks" add constraint "affiliate_clicks_pkey" PRIMARY KEY (id);

alter table "public"."affiliate_commissions" add constraint "affiliate_commissions_pkey" PRIMARY KEY (id);

alter table "public"."affiliate_course_progress" add constraint "affiliate_course_progress_pkey" PRIMARY KEY (id);

alter table "public"."affiliate_goals" add constraint "affiliate_goals_pkey" PRIMARY KEY (id);

alter table "public"."affiliate_leads" add constraint "affiliate_leads_pkey" PRIMARY KEY (id);

alter table "public"."affiliate_payout_items" add constraint "affiliate_payout_items_pkey" PRIMARY KEY (payout_id, commission_id);

alter table "public"."affiliate_payouts" add constraint "affiliate_payouts_pkey" PRIMARY KEY (id);

alter table "public"."affiliate_profiles" add constraint "affiliate_profiles_pkey" PRIMARY KEY (id);

alter table "public"."affiliate_program_settings" add constraint "affiliate_program_settings_pkey" PRIMARY KEY (id);

alter table "public"."affiliate_referrals" add constraint "affiliate_referrals_pkey" PRIMARY KEY (id);

alter table "public"."affiliate_tasks" add constraint "affiliate_tasks_pkey" PRIMARY KEY (id);

alter table "public"."affiliate_training_sessions" add constraint "affiliate_training_sessions_pkey" PRIMARY KEY (id);

alter table "public"."app_notifications" add constraint "app_notifications_pkey" PRIMARY KEY (id);

alter table "public"."application_error_events" add constraint "application_error_events_pkey" PRIMARY KEY (id);

alter table "public"."art_approval_requests" add constraint "art_approval_requests_pkey" PRIMARY KEY (id);

alter table "public"."assistant_events" add constraint "assistant_events_pkey" PRIMARY KEY (id);

alter table "public"."automation_rules" add constraint "automation_rules_pkey" PRIMARY KEY (id);

alter table "public"."automation_runs" add constraint "automation_runs_pkey" PRIMARY KEY (id);

alter table "public"."background_jobs" add constraint "background_jobs_pkey" PRIMARY KEY (id);

alter table "public"."business_hours" add constraint "business_hours_pkey" PRIMARY KEY (id);

alter table "public"."companies" add constraint "companies_pkey" PRIMARY KEY (id);

alter table "public"."company_health_snapshots" add constraint "company_health_snapshots_pkey" PRIMARY KEY (id);

alter table "public"."company_members" add constraint "company_members_pkey" PRIMARY KEY (id);

alter table "public"."company_niche_templates" add constraint "company_niche_templates_pkey" PRIMARY KEY (id);

alter table "public"."company_proposal_settings" add constraint "company_proposal_settings_pkey" PRIMARY KEY (id);

alter table "public"."company_whatsapp_settings" add constraint "company_whatsapp_settings_pkey" PRIMARY KEY (company_id);

alter table "public"."crm_leads" add constraint "crm_leads_pkey" PRIMARY KEY (id);

alter table "public"."customer_duplicate_candidates" add constraint "customer_duplicate_candidates_pkey" PRIMARY KEY (id);

alter table "public"."customer_followups" add constraint "customer_followups_pkey" PRIMARY KEY (id);

alter table "public"."customer_internal_notes" add constraint "customer_internal_notes_pkey" PRIMARY KEY (id);

alter table "public"."customer_magic_links" add constraint "customer_magic_links_pkey" PRIMARY KEY (id);

alter table "public"."customer_notes" add constraint "customer_notes_pkey" PRIMARY KEY (id);

alter table "public"."customer_portal_events" add constraint "customer_portal_events_pkey" PRIMARY KEY (id);

alter table "public"."customer_profiles" add constraint "customer_profiles_pkey" PRIMARY KEY (id);

alter table "public"."data_quality_issues" add constraint "data_quality_issues_pkey" PRIMARY KEY (id);

alter table "public"."deliveries" add constraint "deliveries_pkey" PRIMARY KEY (id);

alter table "public"."delivery_assignments" add constraint "delivery_assignments_pkey" PRIMARY KEY (id);

alter table "public"."delivery_drivers" add constraint "delivery_drivers_pkey" PRIMARY KEY (id);

alter table "public"."delivery_zones" add constraint "delivery_zones_pkey" PRIMARY KEY (id);

alter table "public"."demo_data_registry" add constraint "demo_data_registry_pkey" PRIMARY KEY (id);

alter table "public"."event_idempotency" add constraint "event_idempotency_pkey" PRIMARY KEY (id);

alter table "public"."finance_accounts" add constraint "finance_accounts_pkey" PRIMARY KEY (id);

alter table "public"."financial_categories" add constraint "financial_categories_pkey" PRIMARY KEY (id);

alter table "public"."financial_material_entries" add constraint "financial_material_entries_pkey" PRIMARY KEY (id);

alter table "public"."financial_transactions" add constraint "financial_transactions_pkey" PRIMARY KEY (id);

alter table "public"."founder_invites" add constraint "founder_invites_pkey" PRIMARY KEY (id);

alter table "public"."integration_connections" add constraint "integration_connections_pkey" PRIMARY KEY (id);

alter table "public"."integration_mappings" add constraint "integration_mappings_pkey" PRIMARY KEY (id);

alter table "public"."integration_oauth_states" add constraint "integration_oauth_states_pkey" PRIMARY KEY (id);

alter table "public"."integration_push_channels" add constraint "integration_push_channels_pkey" PRIMARY KEY (id);

alter table "public"."integration_sync_cursors" add constraint "integration_sync_cursors_pkey" PRIMARY KEY (connection_id, cursor_key);

alter table "public"."integration_usage_daily" add constraint "integration_usage_daily_pkey" PRIMARY KEY (company_id, provider, metric, usage_day);

alter table "public"."internal_tasks" add constraint "internal_tasks_pkey" PRIMARY KEY (id);

alter table "public"."marketplace_commission_rules" add constraint "marketplace_commission_rules_pkey" PRIMARY KEY (id);

alter table "public"."marketplace_commissions" add constraint "marketplace_commissions_pkey" PRIMARY KEY (id);

alter table "public"."marketplace_coupons" add constraint "marketplace_coupons_pkey" PRIMARY KEY (id);

alter table "public"."marketplace_oauth_states" add constraint "marketplace_oauth_states_pkey" PRIMARY KEY (id);

alter table "public"."marketplace_payment_settings" add constraint "marketplace_payment_settings_pkey" PRIMARY KEY (id);

alter table "public"."marketplace_payments" add constraint "marketplace_payments_pkey" PRIMARY KEY (id);

alter table "public"."marketplace_stock_reservations" add constraint "marketplace_stock_reservations_pkey" PRIMARY KEY (id);

alter table "public"."notifications" add constraint "notifications_pkey" PRIMARY KEY (id);

alter table "public"."order_internal_comments" add constraint "order_internal_comments_pkey" PRIMARY KEY (id);

alter table "public"."order_items" add constraint "order_items_pkey" PRIMARY KEY (id);

alter table "public"."order_payments" add constraint "order_payments_pkey" PRIMARY KEY (id);

alter table "public"."order_status_history" add constraint "order_status_history_pkey" PRIMARY KEY (id);

alter table "public"."orders" add constraint "orders_pkey" PRIMARY KEY (id);

alter table "public"."payment_methods" add constraint "payment_methods_pkey" PRIMARY KEY (id);

alter table "public"."payment_payouts" add constraint "payment_payouts_pkey" PRIMARY KEY (id);

alter table "public"."payment_webhook_events" add constraint "payment_webhook_events_pkey" PRIMARY KEY (id);

alter table "public"."plan_payments" add constraint "plan_payments_pkey" PRIMARY KEY (id);

alter table "public"."platform_admin_invites" add constraint "platform_admin_invites_pkey" PRIMARY KEY (id);

alter table "public"."platform_admins" add constraint "platform_admins_pkey" PRIMARY KEY (id);

alter table "public"."platform_feature_flags" add constraint "platform_feature_flags_pkey" PRIMARY KEY (id);

alter table "public"."platform_support_ticket_events" add constraint "platform_support_ticket_events_pkey" PRIMARY KEY (id);

alter table "public"."platform_support_tickets" add constraint "platform_support_tickets_pkey" PRIMARY KEY (id);

alter table "public"."product_analytics_events" add constraint "product_analytics_events_pkey" PRIMARY KEY (id);

alter table "public"."product_stock_movements" add constraint "product_stock_movements_pkey" PRIMARY KEY (id);

alter table "public"."production_orders" add constraint "production_orders_pkey" PRIMARY KEY (id);

alter table "public"."production_steps" add constraint "production_steps_pkey" PRIMARY KEY (id);

alter table "public"."products" add constraint "products_pkey" PRIMARY KEY (id);

alter table "public"."proposal_events" add constraint "proposal_events_pkey" PRIMARY KEY (id);

alter table "public"."proposals" add constraint "proposals_pkey" PRIMARY KEY (id);

alter table "public"."provider_customers" add constraint "provider_customers_pkey" PRIMARY KEY (id);

alter table "public"."quote_templates" add constraint "quote_templates_pkey" PRIMARY KEY (id);

alter table "public"."recurring_orders" add constraint "recurring_orders_pkey" PRIMARY KEY (id);

alter table "public"."security_blocklist" add constraint "security_blocklist_pkey" PRIMARY KEY (id);

alter table "public"."security_events" add constraint "security_events_pkey" PRIMARY KEY (id);

alter table "public"."signup_lead_followups" add constraint "signup_lead_followups_pkey" PRIMARY KEY (id);

alter table "public"."signup_leads" add constraint "signup_leads_pkey" PRIMARY KEY (id);

alter table "public"."site_sections" add constraint "site_sections_pkey" PRIMARY KEY (id);

alter table "public"."site_template_presets" add constraint "site_template_presets_pkey" PRIMARY KEY (id);

alter table "public"."smart_notification_events" add constraint "smart_notification_events_pkey" PRIMARY KEY (id);

alter table "public"."smart_notification_settings" add constraint "smart_notification_settings_pkey" PRIMARY KEY (company_id);

alter table "public"."subscription_events" add constraint "subscription_events_pkey" PRIMARY KEY (id);

alter table "public"."system_audit_logs" add constraint "system_audit_logs_pkey" PRIMARY KEY (id);

alter table "public"."timeline_events" add constraint "timeline_events_pkey" PRIMARY KEY (id);

alter table "public"."transactional_outbox" add constraint "transactional_outbox_pkey" PRIMARY KEY (id);

alter table "public"."whatsapp_connections" add constraint "whatsapp_connections_pkey" PRIMARY KEY (id);

alter table "public"."whatsapp_conversations" add constraint "whatsapp_conversations_pkey" PRIMARY KEY (id);

alter table "public"."whatsapp_message_logs" add constraint "whatsapp_message_logs_pkey" PRIMARY KEY (id);

alter table "public"."whatsapp_webhook_events" add constraint "whatsapp_webhook_events_pkey" PRIMARY KEY (id);

alter table "orcaly_private"."affiliate_payout_accounts" add constraint "affiliate_payout_accounts_affiliate_id_key" UNIQUE (affiliate_id);

alter table "public"."admin_bug_reports" add constraint "admin_bug_reports_fingerprint_key" UNIQUE (fingerprint);

alter table "public"."admin_users" add constraint "admin_users_email_key" UNIQUE (email);

alter table "public"."affiliate_achievements" add constraint "affiliate_achievements_affiliate_id_achievement_id_key" UNIQUE (affiliate_id, achievement_id);

alter table "public"."affiliate_certifications" add constraint "affiliate_certifications_affiliate_id_certification_id_key" UNIQUE (affiliate_id, certification_id);

alter table "public"."affiliate_commissions" add constraint "affiliate_commissions_provider_payment_id_key" UNIQUE (provider_payment_id);

alter table "public"."affiliate_commissions" add constraint "affiliate_commissions_referral_id_key" UNIQUE (referral_id);

alter table "public"."affiliate_course_progress" add constraint "affiliate_course_progress_affiliate_id_course_id_lesson_id_key" UNIQUE (affiliate_id, course_id, lesson_id);

alter table "public"."affiliate_goals" add constraint "affiliate_goals_affiliate_id_period_start_key" UNIQUE (affiliate_id, period_start);

alter table "public"."affiliate_payout_items" add constraint "affiliate_payout_items_commission_id_key" UNIQUE (commission_id);

alter table "public"."affiliate_payouts" add constraint "affiliate_payouts_external_reference_key" UNIQUE (external_reference);

alter table "public"."affiliate_profiles" add constraint "affiliate_profiles_user_id_key" UNIQUE (user_id);

alter table "public"."affiliate_referrals" add constraint "affiliate_referrals_company_id_key" UNIQUE (company_id);

alter table "public"."affiliate_referrals" add constraint "affiliate_referrals_signup_lead_id_key" UNIQUE (signup_lead_id);

alter table "public"."application_error_events" add constraint "application_error_events_error_id_key" UNIQUE (error_id);

alter table "public"."art_approval_requests" add constraint "art_approval_requests_token_key" UNIQUE (token);

alter table "public"."automation_runs" add constraint "automation_runs_rule_id_run_key_key" UNIQUE (rule_id, run_key);

alter table "public"."business_hours" add constraint "business_hours_company_weekday_unique" UNIQUE (company_id, weekday);

alter table "public"."companies" add constraint "companies_slug_key" UNIQUE (slug);

alter table "public"."company_niche_templates" add constraint "company_niche_templates_company_id_key" UNIQUE (company_id);

alter table "public"."company_proposal_settings" add constraint "company_proposal_settings_company_id_key" UNIQUE (company_id);

alter table "public"."customer_duplicate_candidates" add constraint "customer_duplicate_candidates_company_id_left_customer_id_r_key" UNIQUE (company_id, left_customer_id, right_customer_id);

alter table "public"."customer_magic_links" add constraint "customer_magic_links_token_key" UNIQUE (token);

alter table "public"."customer_profiles" add constraint "customer_profiles_company_id_contact_key_key" UNIQUE (company_id, contact_key);

alter table "public"."data_quality_issues" add constraint "data_quality_issues_company_id_fingerprint_key" UNIQUE (company_id, fingerprint);

alter table "public"."demo_data_registry" add constraint "demo_data_registry_company_id_entity_type_entity_id_key" UNIQUE (company_id, entity_type, entity_id);

alter table "public"."event_idempotency" add constraint "event_idempotency_provider_event_id_key" UNIQUE (provider, event_id);

alter table "public"."integration_connections" add constraint "integration_connections_company_id_provider_key" UNIQUE (company_id, provider);

alter table "public"."integration_mappings" add constraint "integration_mappings_connection_id_entity_type_external_id_key" UNIQUE (connection_id, entity_type, external_id);

alter table "public"."integration_oauth_states" add constraint "integration_oauth_states_nonce_hash_key" UNIQUE (nonce_hash);

alter table "public"."integration_push_channels" add constraint "integration_push_channels_channel_id_key" UNIQUE (channel_id);

alter table "public"."marketplace_oauth_states" add constraint "marketplace_oauth_states_state_hash_key" UNIQUE (state_hash);

alter table "public"."marketplace_payment_settings" add constraint "marketplace_payment_settings_company_id_provider_key" UNIQUE (company_id, provider);

alter table "public"."marketplace_stock_reservations" add constraint "marketplace_stock_reservation_marketplace_payment_id_produc_key" UNIQUE (marketplace_payment_id, product_id);

alter table "public"."payment_webhook_events" add constraint "payment_webhook_events_provider_provider_event_id_key" UNIQUE (provider, provider_event_id);

alter table "public"."platform_admins" add constraint "platform_admins_email_key" UNIQUE (email);

alter table "public"."platform_feature_flags" add constraint "platform_feature_flags_key_scope_scope_value_key" UNIQUE (key, scope, scope_value);

alter table "public"."product_stock_movements" add constraint "product_stock_movements_idempotency_key_key" UNIQUE (idempotency_key);

alter table "public"."proposals" add constraint "proposals_token_key" UNIQUE (token);

alter table "public"."provider_customers" add constraint "provider_customers_company_id_provider_customer_id_key" UNIQUE (company_id, provider, customer_id);

alter table "public"."smart_notification_events" add constraint "smart_notification_events_company_id_event_key_key" UNIQUE (company_id, event_key);

alter table "public"."whatsapp_connections" add constraint "whatsapp_connections_company_id_key" UNIQUE (company_id);

alter table "public"."whatsapp_connections" add constraint "whatsapp_connections_phone_number_id_key" UNIQUE (phone_number_id);

alter table "public"."whatsapp_conversations" add constraint "whatsapp_conversations_company_id_phone_key" UNIQUE (company_id, phone);

alter table "public"."whatsapp_webhook_events" add constraint "whatsapp_webhook_events_event_key_key" UNIQUE (event_key);

alter table "orcaly_private"."affiliate_payout_accounts" add constraint "affiliate_payout_accounts_pix_key_type_check" CHECK (pix_key_type = ANY (ARRAY['CPF'::text, 'CNPJ'::text, 'EMAIL'::text, 'PHONE'::text, 'EVP'::text]));

alter table "orcaly_private"."api_rate_limits" add constraint "api_rate_limits_request_count_check" CHECK (request_count >= 0);

alter table "public"."admin_bug_reports" add constraint "admin_bug_reports_severity_check" CHECK (severity = ANY (ARRAY['verde'::text, 'amarelo'::text, 'vermelho'::text]));

alter table "public"."admin_bug_reports" add constraint "admin_bug_severity_check" CHECK (severity = ANY (ARRAY['baixa'::text, 'media'::text, 'alta'::text, 'critica'::text]));

alter table "public"."admin_bug_reports" add constraint "admin_bug_status_check" CHECK (status = ANY (ARRAY['aberto'::text, 'em_analise'::text, 'resolvido'::text, 'ignorado'::text]));

alter table "public"."admin_scan_runs" add constraint "admin_scan_status_check" CHECK (status = ANY (ARRAY['rodando'::text, 'concluido'::text, 'falhou'::text]));

alter table "public"."admin_users" add constraint "admin_users_role_check" CHECK (role = ANY (ARRAY['super_admin'::text, 'admin'::text, 'suporte'::text]));

alter table "public"."affiliate_activity_events" add constraint "affiliate_activity_events_kind_check" CHECK (kind = ANY (ARRAY['contact'::text, 'demo'::text, 'trial'::text, 'converted'::text, 'content'::text, 'lesson'::text, 'quiz'::text, 'practice'::text, 'follow_up'::text, 'task'::text, 'manual'::text]));

alter table "public"."affiliate_activity_events" add constraint "affiliate_activity_events_xp_check" CHECK (xp >= 0 AND xp <= 500);

alter table "public"."affiliate_announcements" add constraint "affiliate_announcements_kind_check" CHECK (kind = ANY (ARRAY['news'::text, 'training'::text, 'product'::text, 'community'::text]));

alter table "public"."affiliate_certifications" add constraint "affiliate_certifications_score_check" CHECK (score >= 0::numeric AND score <= 100::numeric);

alter table "public"."affiliate_certifications" add constraint "affiliate_certifications_status_check" CHECK (status = ANY (ARRAY['issued'::text, 'expired'::text, 'revoked'::text]));

alter table "public"."affiliate_commissions" add constraint "affiliate_commissions_commission_amount_check" CHECK (commission_amount >= 0::numeric);

alter table "public"."affiliate_commissions" add constraint "affiliate_commissions_commission_rate_check" CHECK (commission_rate >= 0::numeric AND commission_rate <= 0.6000);

alter table "public"."affiliate_commissions" add constraint "affiliate_commissions_eligible_amount_check" CHECK (eligible_amount >= 0::numeric);

alter table "public"."affiliate_commissions" add constraint "affiliate_commissions_gross_amount_check" CHECK (gross_amount >= 0::numeric);

alter table "public"."affiliate_commissions" add constraint "affiliate_commissions_status_check" CHECK (status = ANY (ARRAY['future'::text, 'hold'::text, 'available'::text, 'processing'::text, 'paid'::text, 'reversed'::text, 'rejected'::text]));

alter table "public"."affiliate_goals" add constraint "affiliate_goals_contacts_target_check" CHECK (contacts_target >= 0);

alter table "public"."affiliate_goals" add constraint "affiliate_goals_content_target_check" CHECK (content_target >= 0);

alter table "public"."affiliate_goals" add constraint "affiliate_goals_customers_target_check" CHECK (customers_target >= 0);

alter table "public"."affiliate_goals" add constraint "affiliate_goals_demos_target_check" CHECK (demos_target >= 0);

alter table "public"."affiliate_goals" add constraint "affiliate_goals_study_target_check" CHECK (study_target >= 0);

alter table "public"."affiliate_goals" add constraint "affiliate_goals_trials_target_check" CHECK (trials_target >= 0);

alter table "public"."affiliate_leads" add constraint "affiliate_leads_estimated_value_check" CHECK (estimated_value >= 0::numeric);

alter table "public"."affiliate_leads" add constraint "affiliate_leads_name_check" CHECK (char_length(name) >= 2 AND char_length(name) <= 120);

alter table "public"."affiliate_leads" add constraint "affiliate_leads_status_check" CHECK (status = ANY (ARRAY['new'::text, 'contacted'::text, 'demo'::text, 'trial'::text, 'converted'::text, 'lost'::text]));

alter table "public"."affiliate_payout_items" add constraint "affiliate_payout_items_amount_check" CHECK (amount >= 0::numeric);

alter table "public"."affiliate_payouts" add constraint "affiliate_payouts_amount_check" CHECK (amount >= 0::numeric);

alter table "public"."affiliate_payouts" add constraint "affiliate_payouts_debt_offset_check" CHECK (debt_offset >= 0::numeric);

alter table "public"."affiliate_payouts" add constraint "affiliate_payouts_gross_commissions_check" CHECK (gross_commissions >= 0::numeric);

alter table "public"."affiliate_payouts" add constraint "affiliate_payouts_provider_check" CHECK (provider = ANY (ARRAY['manual'::text, 'asaas'::text]));

alter table "public"."affiliate_payouts" add constraint "affiliate_payouts_status_check" CHECK (status = ANY (ARRAY['requested'::text, 'approved'::text, 'processing'::text, 'paid'::text, 'failed'::text, 'cancelled'::text]));

alter table "public"."affiliate_profiles" add constraint "affiliate_profiles_code_check" CHECK (code ~ '^[A-Z0-9][A-Z0-9_-]{3,31}$'::text);

alter table "public"."affiliate_profiles" add constraint "affiliate_profiles_commission_rate_check" CHECK (commission_rate >= 0::numeric AND commission_rate <= 0.6000);

alter table "public"."affiliate_profiles" add constraint "affiliate_profiles_debt_balance_check" CHECK (debt_balance >= 0::numeric);

alter table "public"."affiliate_profiles" add constraint "affiliate_profiles_document_type_check" CHECK (document_type = ANY (ARRAY['CPF'::text, 'CNPJ'::text]));

alter table "public"."affiliate_profiles" add constraint "affiliate_profiles_name_check" CHECK (char_length(TRIM(BOTH FROM name)) >= 2 AND char_length(TRIM(BOTH FROM name)) <= 100);

alter table "public"."affiliate_profiles" add constraint "affiliate_profiles_payout_status_check" CHECK (payout_status = ANY (ARRAY['pending_verification'::text, 'verified'::text, 'blocked'::text]));

alter table "public"."affiliate_profiles" add constraint "affiliate_profiles_status_check" CHECK (status = ANY (ARRAY['pending'::text, 'active'::text, 'suspended'::text, 'rejected'::text, 'closed'::text]));

alter table "public"."affiliate_profiles" add constraint "affiliate_profiles_whatsapp_check" CHECK (char_length(regexp_replace(whatsapp, '[^0-9]'::text, ''::text, 'g'::text)) >= 10 AND char_length(regexp_replace(whatsapp, '[^0-9]'::text, ''::text, 'g'::text)) <= 13);

alter table "public"."affiliate_program_settings" add constraint "affiliate_program_settings_attribution_days_check" CHECK (attribution_days >= 1 AND attribution_days <= 180);

alter table "public"."affiliate_program_settings" add constraint "affiliate_program_settings_commission_rate_check" CHECK (commission_rate >= 0::numeric AND commission_rate <= 0.6000);

alter table "public"."affiliate_program_settings" add constraint "affiliate_program_settings_hold_days_check" CHECK (hold_days >= 7 AND hold_days <= 60);

alter table "public"."affiliate_program_settings" add constraint "affiliate_program_settings_id_check" CHECK (id = 1);

alter table "public"."affiliate_program_settings" add constraint "affiliate_program_settings_minimum_payout_amount_check" CHECK (minimum_payout_amount >= 1::numeric);

alter table "public"."affiliate_referrals" add constraint "affiliate_referrals_review_status_check" CHECK (review_status = ANY (ARRAY['pending'::text, 'approved'::text, 'rejected'::text, 'flagged'::text]));

alter table "public"."affiliate_referrals" add constraint "affiliate_referrals_status_check" CHECK (status = ANY (ARRAY['registered'::text, 'trial'::text, 'payment_pending'::text, 'qualified'::text, 'rejected'::text, 'reversed'::text, 'customer_active'::text, 'customer_cancelled'::text]));

alter table "public"."affiliate_tasks" add constraint "affiliate_tasks_priority_check" CHECK (priority = ANY (ARRAY['low'::text, 'normal'::text, 'high'::text]));

alter table "public"."affiliate_tasks" add constraint "affiliate_tasks_task_type_check" CHECK (task_type = ANY (ARRAY['follow_up'::text, 'demo'::text, 'prospecting'::text, 'content'::text, 'study'::text, 'other'::text]));

alter table "public"."affiliate_tasks" add constraint "affiliate_tasks_title_check" CHECK (char_length(title) >= 2 AND char_length(title) <= 180);

alter table "public"."affiliate_training_sessions" add constraint "affiliate_training_sessions_mode_check" CHECK (mode = ANY (ARRAY['sales'::text, 'objection'::text, 'demo'::text, 'quiz'::text]));

alter table "public"."affiliate_training_sessions" add constraint "affiliate_training_sessions_total_score_check" CHECK (total_score >= 0::numeric AND total_score <= 100::numeric);

alter table "public"."application_error_events" add constraint "application_error_events_error_id_check" CHECK (error_id ~ '^ORC-[A-Z0-9]{8,16}$'::text);

alter table "public"."application_error_events" add constraint "application_error_events_http_status_check" CHECK (http_status IS NULL OR http_status >= 100 AND http_status <= 599);

alter table "public"."assistant_events" add constraint "assistant_events_completion_tokens_check" CHECK (completion_tokens IS NULL OR completion_tokens >= 0);

alter table "public"."assistant_events" add constraint "assistant_events_event_name_check" CHECK (event_name = ANY (ARRAY['assistant_open'::text, 'assistant_message_sent'::text, 'assistant_quick_action'::text, 'assistant_plan_recommended'::text, 'assistant_demo_opened'::text, 'assistant_signup_clicked'::text, 'assistant_whatsapp_clicked'::text, 'assistant_lead_created'::text, 'assistant_feedback'::text, 'assistant_unanswered'::text, 'assistant_fallback'::text, 'assistant_provider_error'::text]));

alter table "public"."assistant_events" add constraint "assistant_events_latency_ms_check" CHECK (latency_ms IS NULL OR latency_ms >= 0);

alter table "public"."assistant_events" add constraint "assistant_events_prompt_tokens_check" CHECK (prompt_tokens IS NULL OR prompt_tokens >= 0);

alter table "public"."automation_runs" add constraint "automation_runs_attempts_check" CHECK (attempts >= 0);

alter table "public"."automation_runs" add constraint "automation_runs_max_attempts_check" CHECK (max_attempts >= 1 AND max_attempts <= 25);

alter table "public"."automation_runs" add constraint "automation_runs_status_check" CHECK (status = ANY (ARRAY['queued'::text, 'running'::text, 'completed'::text, 'failed'::text, 'retrying'::text, 'needs_attention'::text, 'skipped'::text]));

alter table "public"."background_jobs" add constraint "background_jobs_attempts_check" CHECK (attempts >= 0);

alter table "public"."background_jobs" add constraint "background_jobs_max_attempts_check" CHECK (max_attempts >= 1 AND max_attempts <= 25);

alter table "public"."background_jobs" add constraint "background_jobs_status_check" CHECK (status = ANY (ARRAY['queued'::text, 'running'::text, 'completed'::text, 'failed'::text, 'retrying'::text, 'needs_attention'::text]));

alter table "public"."companies" add constraint "companies_founder_billing_attempts_check" CHECK (founder_billing_attempts >= 0);

alter table "public"."companies" add constraint "companies_founder_billing_claim_pair_check" CHECK ((founder_billing_claim_id IS NULL) = (founder_billing_claimed_at IS NULL));

alter table "public"."companies" add constraint "companies_founder_conversion_attempts_check" CHECK (founder_price_conversion_attempts >= 0);

alter table "public"."companies" add constraint "companies_founder_conversion_claim_pair_check" CHECK ((founder_price_conversion_claim_id IS NULL) = (founder_price_conversion_claimed_at IS NULL));

alter table "public"."companies" add constraint "companies_founder_conversion_timeline_check" CHECK (founder_price_converted_at IS NULL OR founder_price_ends_at IS NULL OR founder_price_converted_at >= founder_price_ends_at);

alter table "public"."companies" add constraint "companies_founder_number_check" CHECK (founder_number IS NULL OR founder_number >= 0 AND founder_number <= 10);

alter table "public"."companies" add constraint "companies_founder_plan_price_check" CHECK (NOT is_founder OR
CASE lower(COALESCE(assinatura_plano, plano, ''::text))
    WHEN 'basico'::text THEN founder_price_cents = 3490
    WHEN 'básico'::text THEN founder_price_cents = 3490
    WHEN 'essencial'::text THEN founder_price_cents = 3490
    WHEN 'profissional'::text THEN founder_price_cents = 6990
    WHEN 'intermediario'::text THEN founder_price_cents = 6990
    WHEN 'intermediário'::text THEN founder_price_cents = 6990
    WHEN 'premium'::text THEN founder_price_cents = 9990
    ELSE false
END);

alter table "public"."companies" add constraint "companies_founder_price_check" CHECK (founder_price_cents IS NULL OR (founder_price_cents = ANY (ARRAY[3490, 6990, 9990])));

alter table "public"."companies" add constraint "companies_founder_required_fields_check" CHECK (NOT is_founder OR founder_number IS NOT NULL AND founder_price_cents IS NOT NULL AND founder_started_at IS NOT NULL AND founder_trial_ends_at IS NOT NULL AND founder_price_ends_at IS NOT NULL);

alter table "public"."companies" add constraint "companies_founder_timeline_check" CHECK (NOT is_founder OR founder_trial_ends_at = (founder_started_at + '30 days'::interval) AND founder_price_ends_at = (founder_trial_ends_at + '6 mons'::interval));

alter table "public"."companies" add constraint "companies_nome_security_check" CHECK (length(TRIM(BOTH FROM nome)) >= 2 AND length(TRIM(BOTH FROM nome)) <= 80 AND (lower(TRIM(BOTH FROM nome)) <> ALL (ARRAY['admin'::text, 'administrador'::text, 'orcaly'::text, 'orçaly'::text, 'root'::text, 'system'::text, 'sistema'::text])) AND lower(TRIM(BOTH FROM nome)) !~~ '%orcaly%'::text AND lower(TRIM(BOTH FROM nome)) !~~ '%orçaly%'::text);

alter table "public"."companies" add constraint "companies_slug_security_check" CHECK (slug ~ '^[a-z0-9][a-z0-9-]{1,40}[a-z0-9]$'::text AND slug !~~ '%--%'::text AND (lower(slug) <> ALL (ARRAY['admin'::text, 'administrador'::text, 'orcaly'::text, 'suporte'::text, 'support'::text, 'api'::text, 'painel'::text, 'dashboard'::text, 'login'::text, 'cadastro'::text, 'checkout'::text, 'assinatura'::text, 'proposta'::text, 'propostas'::text, 'root'::text, 'system'::text, 'sistema'::text, 'mercado-pago'::text, 'mercadopago'::text, 'www'::text, 'app'::text, 'assets'::text, 'static'::text, 'public'::text, 'private'::text, 'config'::text, 'settings'::text, 'security'::text, 'auth'::text, 'null'::text, 'undefined'::text])));

alter table "public"."companies" add constraint "companies_subdomain_slug_security_check" CHECK (subdomain_slug IS NULL OR length(subdomain_slug) >= 3 AND length(subdomain_slug) <= 42 AND subdomain_slug ~ '^[a-z0-9]+$'::text AND (lower(subdomain_slug) <> ALL (ARRAY['admin'::text, 'administrador'::text, 'orcaly'::text, 'suporte'::text, 'support'::text, 'api'::text, 'painel'::text, 'dashboard'::text, 'login'::text, 'cadastro'::text, 'checkout'::text, 'assinatura'::text, 'proposta'::text, 'propostas'::text, 'root'::text, 'system'::text, 'sistema'::text, 'mercadopago'::text, 'www'::text, 'app'::text, 'assets'::text, 'static'::text, 'public'::text, 'private'::text, 'config'::text, 'settings'::text, 'security'::text, 'auth'::text, 'null'::text, 'undefined'::text])));

alter table "public"."companies" add constraint "companies_timezone_shape_check" CHECK (timezone IS NULL OR timezone = btrim(timezone) AND char_length(timezone) >= 1 AND char_length(timezone) <= 100);

alter table "public"."company_health_snapshots" add constraint "company_health_snapshots_score_check" CHECK (score >= 0 AND score <= 100);

alter table "public"."company_members" add constraint "company_members_cargo_check" CHECK (cargo = ANY (ARRAY['gerente'::text, 'atendente'::text, 'producao'::text]));

alter table "public"."company_members" add constraint "company_members_status_check" CHECK (status = ANY (ARRAY['ativo'::text, 'bloqueado'::text, 'removido'::text]));

alter table "public"."customer_duplicate_candidates" add constraint "customer_duplicate_candidates_check" CHECK (left_customer_id <> right_customer_id);

alter table "public"."customer_duplicate_candidates" add constraint "customer_duplicate_candidates_confidence_check" CHECK (confidence >= 0 AND confidence <= 100);

alter table "public"."customer_duplicate_candidates" add constraint "customer_duplicate_candidates_status_check" CHECK (status = ANY (ARRAY['needs_review'::text, 'dismissed'::text, 'merged'::text]));

alter table "public"."customer_followups" add constraint "customer_followups_prioridade_check" CHECK (prioridade = ANY (ARRAY['baixa'::text, 'media'::text, 'alta'::text]));

alter table "public"."customer_followups" add constraint "customer_followups_status_check" CHECK (status = ANY (ARRAY['pendente'::text, 'concluido'::text, 'cancelado'::text]));

alter table "public"."customer_notes" add constraint "customer_notes_tipo_check" CHECK (tipo = ANY (ARRAY['nota'::text, 'whatsapp'::text, 'ligacao'::text, 'feedback'::text, 'financeiro'::text, 'proposta'::text]));

alter table "public"."customer_profiles" add constraint "customer_profiles_source_check" CHECK (source = ANY (ARRAY['manual'::text, 'public_site'::text, 'whatsapp'::text, 'api'::text, 'import'::text, 'automation'::text, 'ai'::text, 'portal'::text, 'system'::text]));

alter table "public"."data_quality_issues" add constraint "data_quality_issues_severity_check" CHECK (severity = ANY (ARRAY['CRITICAL'::text, 'HIGH'::text, 'MEDIUM'::text, 'LOW'::text, 'INFO'::text]));

alter table "public"."data_quality_issues" add constraint "data_quality_issues_status_check" CHECK (status = ANY (ARRAY['open'::text, 'resolved'::text, 'ignored'::text]));

alter table "public"."delivery_assignments" add constraint "delivery_assignments_amounts_check" CHECK (order_total >= 0::numeric AND delivery_fee >= 0::numeric);

alter table "public"."delivery_assignments" add constraint "delivery_assignments_settlement_check" CHECK (settlement_status = ANY (ARRAY['pending'::text, 'settled'::text, 'waived'::text]));

alter table "public"."delivery_assignments" add constraint "delivery_assignments_status_check" CHECK (status = ANY (ARRAY['assigned'::text, 'out_for_delivery'::text, 'delivered'::text, 'canceled'::text, 'reassigned'::text]));

alter table "public"."delivery_drivers" add constraint "delivery_drivers_name_check" CHECK (char_length(TRIM(BOTH FROM name)) >= 2 AND char_length(TRIM(BOTH FROM name)) <= 80);

alter table "public"."delivery_drivers" add constraint "delivery_drivers_plate_check" CHECK (vehicle_plate IS NULL OR char_length(TRIM(BOTH FROM vehicle_plate)) >= 5 AND char_length(TRIM(BOTH FROM vehicle_plate)) <= 10);

alter table "public"."delivery_drivers" add constraint "delivery_drivers_whatsapp_check" CHECK (char_length(regexp_replace(whatsapp, '[^0-9]'::text, ''::text, 'g'::text)) >= 10 AND char_length(regexp_replace(whatsapp, '[^0-9]'::text, ''::text, 'g'::text)) <= 13);

alter table "public"."event_idempotency" add constraint "event_idempotency_attempt_check" CHECK (attempt >= 1);

alter table "public"."event_idempotency" add constraint "event_idempotency_status_check" CHECK (status = ANY (ARRAY['received'::text, 'processing'::text, 'processed'::text, 'ignored'::text, 'failed'::text, 'retrying'::text, 'needs_attention'::text]));

alter table "public"."finance_accounts" add constraint "finance_accounts_tipo_check" CHECK (tipo = ANY (ARRAY['caixa'::text, 'banco'::text, 'cartao'::text, 'digital'::text, 'outro'::text]));

alter table "public"."financial_transactions" add constraint "financial_transactions_status_check" CHECK (status = ANY (ARRAY['pago'::text, 'pendente'::text, 'cancelado'::text]));

alter table "public"."financial_transactions" add constraint "financial_transactions_tipo_check" CHECK (tipo = ANY (ARRAY['entrada'::text, 'saida'::text]));

alter table "public"."founder_invites" add constraint "founder_invites_activation_attempts_check" CHECK (activation_attempts >= 0);

alter table "public"."founder_invites" add constraint "founder_invites_activation_claim_pair_check" CHECK (activation_claim_id IS NULL AND activation_claimed_at IS NULL OR activation_claim_id IS NOT NULL AND activation_claimed_at IS NOT NULL);

alter table "public"."founder_invites" add constraint "founder_invites_email_check" CHECK (length(email_normalized) >= 3 AND POSITION(('@'::text) IN (email_normalized)) > 1);

alter table "public"."founder_invites" add constraint "founder_invites_number_check" CHECK (founder_number >= 0 AND founder_number <= 10);

alter table "public"."founder_invites" add constraint "founder_invites_plan_check" CHECK (plan_key = ANY (ARRAY['basico'::text, 'profissional'::text, 'premium'::text]));

alter table "public"."founder_invites" add constraint "founder_invites_price_check" CHECK (plan_key = 'basico'::text AND founder_price_cents = 3490 OR plan_key = 'profissional'::text AND founder_price_cents = 6990 OR plan_key = 'premium'::text AND founder_price_cents = 9990);

alter table "public"."founder_invites" add constraint "founder_invites_state_check" CHECK (status = 'pending'::text AND activated_at IS NULL AND revoked_at IS NULL AND user_id IS NULL AND company_id IS NULL AND activation_claim_id IS NULL AND activation_claimed_at IS NULL OR status = 'activating'::text AND activated_at IS NULL AND revoked_at IS NULL AND user_id IS NULL AND company_id IS NULL AND activation_claim_id IS NOT NULL AND activation_claimed_at IS NOT NULL OR status = 'activated'::text AND activated_at IS NOT NULL AND revoked_at IS NULL AND user_id IS NOT NULL AND company_id IS NOT NULL AND activation_claim_id IS NULL AND activation_claimed_at IS NULL OR status = 'revoked'::text AND activated_at IS NULL AND revoked_at IS NOT NULL AND user_id IS NULL AND company_id IS NULL AND activation_claim_id IS NULL AND activation_claimed_at IS NULL OR status = 'expired'::text AND activated_at IS NULL AND user_id IS NULL AND company_id IS NULL AND activation_claim_id IS NULL AND activation_claimed_at IS NULL);

alter table "public"."founder_invites" add constraint "founder_invites_status_check" CHECK (status = ANY (ARRAY['pending'::text, 'activating'::text, 'activated'::text, 'revoked'::text, 'expired'::text]));

alter table "public"."founder_invites" add constraint "founder_invites_token_hash_check" CHECK (token_hash ~ '^[0-9a-f]{64}$'::text);

alter table "public"."integration_connections" add constraint "integration_connections_provider_check" CHECK (provider ~ '^[a-z0-9_]{2,80}$'::text);

alter table "public"."integration_connections" add constraint "integration_connections_status_check" CHECK (status = ANY (ARRAY['NOT_CONFIGURED'::text, 'CONNECTING'::text, 'CONNECTED'::text, 'DEGRADED'::text, 'ERROR'::text, 'REAUTH_REQUIRED'::text, 'ACCESS_REQUIRED'::text, 'DISCONNECTED'::text]));

alter table "public"."integration_oauth_states" add constraint "integration_oauth_states_check" CHECK (expires_at > created_at);

alter table "public"."integration_push_channels" add constraint "integration_push_channels_state_check" CHECK (state = ANY (ARRAY['active'::text, 'stopped'::text, 'expired'::text]));

alter table "public"."integration_usage_daily" add constraint "integration_usage_daily_quantity_check" CHECK (quantity >= 0);

alter table "public"."marketplace_coupons" add constraint "marketplace_coupons_tipo_check" CHECK (tipo = ANY (ARRAY['percentual'::text, 'fixo'::text]));

alter table "public"."marketplace_payments" add constraint "marketplace_payments_stock_reservation_status_check" CHECK (stock_reservation_status IS NULL OR (stock_reservation_status = ANY (ARRAY['reserved'::text, 'confirmed'::text, 'released'::text, 'expired'::text, 'review_required'::text])));

alter table "public"."marketplace_stock_reservations" add constraint "marketplace_stock_reservations_quantity_check" CHECK (quantity > 0);

alter table "public"."marketplace_stock_reservations" add constraint "marketplace_stock_reservations_status_check" CHECK (status = ANY (ARRAY['reserved'::text, 'confirmed'::text, 'released'::text, 'expired'::text, 'review_required'::text]));

alter table "public"."marketplace_stock_reservations" add constraint "marketplace_stock_reservations_stock_after_check" CHECK (stock_after >= 0);

alter table "public"."marketplace_stock_reservations" add constraint "marketplace_stock_reservations_stock_before_check" CHECK (stock_before >= 0);

alter table "public"."platform_admin_invites" add constraint "platform_admin_invites_area_check" CHECK (length(btrim(area)) >= 2 AND length(btrim(area)) <= 80);

alter table "public"."platform_admin_invites" add constraint "platform_admin_invites_email_check" CHECK (length(btrim(email)) >= 5 AND length(btrim(email)) <= 320 AND POSITION(('@'::text) IN (btrim(email))) > 1);

alter table "public"."platform_admin_invites" add constraint "platform_admin_invites_expiry_check" CHECK (expires_at > invited_at);

alter table "public"."platform_admin_invites" add constraint "platform_admin_invites_nome_check" CHECK (length(btrim(nome)) >= 2 AND length(btrim(nome)) <= 160);

alter table "public"."platform_admin_invites" add constraint "platform_admin_invites_observacoes_check" CHECK (observacoes IS NULL OR length(observacoes) <= 500);

alter table "public"."platform_admin_invites" add constraint "platform_admin_invites_permissions_object_check" CHECK (jsonb_typeof(permissions) = 'object'::text);

alter table "public"."platform_admin_invites" add constraint "platform_admin_invites_role_check_v2" CHECK (lower(role) = ANY (ARRAY['admin'::text, 'platform_admin'::text, 'finance'::text, 'support'::text, 'security'::text, 'operations'::text, 'viewer'::text, 'prospector'::text]));

alter table "public"."platform_admin_invites" add constraint "platform_admin_invites_state_check" CHECK (status = 'pending'::text AND claimed_at IS NULL AND activation_claim_id IS NULL AND activated_at IS NULL AND revoked_at IS NULL AND user_id IS NULL AND platform_admin_id IS NULL OR status = 'activating'::text AND claimed_at IS NOT NULL AND activation_claim_id IS NOT NULL AND activated_at IS NULL AND revoked_at IS NULL AND user_id IS NULL AND platform_admin_id IS NULL OR status = 'activated'::text AND claimed_at IS NULL AND activation_claim_id IS NULL AND activated_at IS NOT NULL AND revoked_at IS NULL AND user_id IS NOT NULL AND platform_admin_id IS NOT NULL OR status = 'revoked'::text AND claimed_at IS NULL AND activation_claim_id IS NULL AND activated_at IS NULL AND revoked_at IS NOT NULL AND user_id IS NULL AND platform_admin_id IS NULL OR status = 'expired'::text AND claimed_at IS NULL AND activation_claim_id IS NULL AND activated_at IS NULL AND revoked_at IS NULL AND user_id IS NULL AND platform_admin_id IS NULL);

alter table "public"."platform_admin_invites" add constraint "platform_admin_invites_status_check" CHECK (status = ANY (ARRAY['pending'::text, 'activating'::text, 'activated'::text, 'revoked'::text, 'expired'::text]));

alter table "public"."platform_admin_invites" add constraint "platform_admin_invites_token_hash_check" CHECK (token_hash ~ '^[0-9a-f]{64}$'::text);

alter table "public"."platform_admins" add constraint "platform_admins_role_check_v3" CHECK (lower(role) = ANY (ARRAY['owner'::text, 'super_admin'::text, 'admin'::text, 'platform_admin'::text, 'finance'::text, 'support'::text, 'suporte'::text, 'security'::text, 'seguranca'::text, 'operations'::text, 'operacoes'::text, 'viewer'::text, 'visualizador'::text, 'prospector'::text]));

alter table "public"."platform_feature_flags" add constraint "platform_feature_flags_key_check" CHECK (key ~ '^[a-z0-9][a-z0-9._-]{1,79}$'::text);

alter table "public"."platform_feature_flags" add constraint "platform_feature_flags_scope_check" CHECK (scope = ANY (ARRAY['global'::text, 'plan'::text, 'segment'::text, 'company'::text]));

alter table "public"."platform_support_tickets" add constraint "platform_support_tickets_priority_check" CHECK (priority = ANY (ARRAY['low'::text, 'medium'::text, 'high'::text, 'urgent'::text]));

alter table "public"."platform_support_tickets" add constraint "platform_support_tickets_status_check" CHECK (status = ANY (ARRAY['new'::text, 'in_progress'::text, 'waiting_customer'::text, 'resolved'::text, 'closed'::text]));

alter table "public"."product_stock_movements" add constraint "product_stock_movements_movement_type_check" CHECK (movement_type = ANY (ARRAY['reserve'::text, 'confirm'::text, 'release'::text, 'expire'::text, 'review_required'::text]));

alter table "public"."product_stock_movements" add constraint "product_stock_movements_stock_after_check" CHECK (stock_after >= 0);

alter table "public"."product_stock_movements" add constraint "product_stock_movements_stock_before_check" CHECK (stock_before >= 0);

alter table "public"."production_orders" add constraint "production_orders_status_check" CHECK (status = ANY (ARRAY['aguardando_sinal'::text, 'aprovado'::text, 'em_producao'::text, 'pronto'::text, 'entregue'::text, 'cancelado'::text]));

alter table "public"."production_steps" add constraint "production_steps_status_check" CHECK (status = ANY (ARRAY['pendente'::text, 'em_andamento'::text, 'concluido'::text, 'pulada'::text]));

alter table "public"."proposals" add constraint "proposals_status_check" CHECK (status = ANY (ARRAY['rascunho'::text, 'enviado'::text, 'visto'::text, 'aprovado'::text, 'alteracao_solicitada'::text, 'recusado'::text, 'expirado'::text, 'cancelado'::text, 'pago_sinal'::text, 'convertido'::text]));

alter table "public"."security_blocklist" add constraint "security_blocklist_type_check" CHECK (type = ANY (ARRAY['ip'::text, 'email'::text, 'domain'::text, 'slug'::text, 'subdomain'::text, 'keyword'::text]));

alter table "public"."security_events" add constraint "security_events_severity_check" CHECK (severity = ANY (ARRAY['baixa'::text, 'media'::text, 'alta'::text, 'critica'::text]));

alter table "public"."signup_lead_followups" add constraint "signup_lead_followups_sales_event_type_check" CHECK (sales_event_type = ANY (ARRAY['legacy'::text, 'contact'::text, 'note'::text, 'stage_change'::text, 'system'::text]));

alter table "public"."signup_leads" add constraint "signup_leads_sales_lost_reason_check" CHECK (sales_stage <> 'perdido'::text OR NULLIF(btrim(sales_lost_reason), ''::text) IS NOT NULL);

alter table "public"."signup_leads" add constraint "signup_leads_sales_stage_check" CHECK (sales_stage = ANY (ARRAY['novo'::text, 'contatado'::text, 'interessado'::text, 'demonstracao'::text, 'convite_fundador'::text, 'conta_ativada'::text, 'cliente'::text, 'perdido'::text]));

alter table "public"."timeline_events" add constraint "timeline_events_source_check" CHECK (source = ANY (ARRAY['manual'::text, 'public_site'::text, 'whatsapp'::text, 'api'::text, 'import'::text, 'automation'::text, 'ai'::text, 'portal'::text, 'system'::text, 'provider'::text]));

alter table "public"."transactional_outbox" add constraint "transactional_outbox_attempts_check" CHECK (attempts >= 0);

alter table "public"."transactional_outbox" add constraint "transactional_outbox_max_attempts_check" CHECK (max_attempts >= 1 AND max_attempts <= 25);

alter table "public"."transactional_outbox" add constraint "transactional_outbox_status_check" CHECK (status = ANY (ARRAY['queued'::text, 'processing'::text, 'completed'::text, 'failed'::text, 'retrying'::text, 'needs_attention'::text]));

alter table "public"."whatsapp_connections" add constraint "whatsapp_connections_status_check" CHECK (status = ANY (ARRAY['disconnected'::text, 'pending'::text, 'connected'::text, 'error'::text]));

alter table "public"."whatsapp_webhook_events" add constraint "whatsapp_webhook_events_processing_status_check" CHECK (processing_status = ANY (ARRAY['processing'::text, 'processed'::text, 'ignored'::text, 'failed'::text]));

alter table "orcaly_private"."affiliate_payout_accounts" add constraint "affiliate_payout_accounts_affiliate_id_fkey" FOREIGN KEY (affiliate_id) REFERENCES affiliate_profiles(id) ON DELETE CASCADE;

alter table "public"."affiliate_achievements" add constraint "affiliate_achievements_affiliate_id_fkey" FOREIGN KEY (affiliate_id) REFERENCES affiliate_profiles(id) ON DELETE CASCADE;

alter table "public"."affiliate_activity_events" add constraint "affiliate_activity_events_affiliate_id_fkey" FOREIGN KEY (affiliate_id) REFERENCES affiliate_profiles(id) ON DELETE CASCADE;

alter table "public"."affiliate_activity_events" add constraint "affiliate_activity_events_lead_id_fkey" FOREIGN KEY (lead_id) REFERENCES affiliate_leads(id) ON DELETE SET NULL;

alter table "public"."affiliate_audit_logs" add constraint "affiliate_audit_logs_actor_user_id_fkey" FOREIGN KEY (actor_user_id) REFERENCES auth.users(id) ON DELETE SET NULL;

alter table "public"."affiliate_audit_logs" add constraint "affiliate_audit_logs_affiliate_id_fkey" FOREIGN KEY (affiliate_id) REFERENCES affiliate_profiles(id) ON DELETE SET NULL;

alter table "public"."affiliate_certifications" add constraint "affiliate_certifications_affiliate_id_fkey" FOREIGN KEY (affiliate_id) REFERENCES affiliate_profiles(id) ON DELETE CASCADE;

alter table "public"."affiliate_clicks" add constraint "affiliate_clicks_affiliate_id_fkey" FOREIGN KEY (affiliate_id) REFERENCES affiliate_profiles(id) ON DELETE CASCADE;

alter table "public"."affiliate_commissions" add constraint "affiliate_commissions_affiliate_id_fkey" FOREIGN KEY (affiliate_id) REFERENCES affiliate_profiles(id) ON DELETE RESTRICT;

alter table "public"."affiliate_commissions" add constraint "affiliate_commissions_company_id_fkey" FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE RESTRICT;

alter table "public"."affiliate_commissions" add constraint "affiliate_commissions_payout_id_fkey" FOREIGN KEY (payout_id) REFERENCES affiliate_payouts(id) ON DELETE SET NULL;

alter table "public"."affiliate_commissions" add constraint "affiliate_commissions_plan_payment_id_fkey" FOREIGN KEY (plan_payment_id) REFERENCES plan_payments(id) ON DELETE SET NULL;

alter table "public"."affiliate_commissions" add constraint "affiliate_commissions_referral_id_fkey" FOREIGN KEY (referral_id) REFERENCES affiliate_referrals(id) ON DELETE RESTRICT;

alter table "public"."affiliate_course_progress" add constraint "affiliate_course_progress_affiliate_id_fkey" FOREIGN KEY (affiliate_id) REFERENCES affiliate_profiles(id) ON DELETE CASCADE;

alter table "public"."affiliate_goals" add constraint "affiliate_goals_affiliate_id_fkey" FOREIGN KEY (affiliate_id) REFERENCES affiliate_profiles(id) ON DELETE CASCADE;

alter table "public"."affiliate_leads" add constraint "affiliate_leads_affiliate_id_fkey" FOREIGN KEY (affiliate_id) REFERENCES affiliate_profiles(id) ON DELETE CASCADE;

alter table "public"."affiliate_payout_items" add constraint "affiliate_payout_items_commission_id_fkey" FOREIGN KEY (commission_id) REFERENCES affiliate_commissions(id) ON DELETE RESTRICT;

alter table "public"."affiliate_payout_items" add constraint "affiliate_payout_items_payout_id_fkey" FOREIGN KEY (payout_id) REFERENCES affiliate_payouts(id) ON DELETE CASCADE;

alter table "public"."affiliate_payouts" add constraint "affiliate_payouts_affiliate_id_fkey" FOREIGN KEY (affiliate_id) REFERENCES affiliate_profiles(id) ON DELETE RESTRICT;

alter table "public"."affiliate_profiles" add constraint "affiliate_profiles_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

alter table "public"."affiliate_referrals" add constraint "affiliate_referrals_affiliate_id_fkey" FOREIGN KEY (affiliate_id) REFERENCES affiliate_profiles(id) ON DELETE RESTRICT;

alter table "public"."affiliate_referrals" add constraint "affiliate_referrals_company_id_fkey" FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE SET NULL;

alter table "public"."affiliate_referrals" add constraint "affiliate_referrals_signup_lead_id_fkey" FOREIGN KEY (signup_lead_id) REFERENCES signup_leads(id) ON DELETE SET NULL;

alter table "public"."affiliate_tasks" add constraint "affiliate_tasks_affiliate_id_fkey" FOREIGN KEY (affiliate_id) REFERENCES affiliate_profiles(id) ON DELETE CASCADE;

alter table "public"."affiliate_tasks" add constraint "affiliate_tasks_lead_id_fkey" FOREIGN KEY (lead_id) REFERENCES affiliate_leads(id) ON DELETE SET NULL;

alter table "public"."affiliate_training_sessions" add constraint "affiliate_training_sessions_affiliate_id_fkey" FOREIGN KEY (affiliate_id) REFERENCES affiliate_profiles(id) ON DELETE CASCADE;

alter table "public"."art_approval_requests" add constraint "art_approval_requests_company_id_fkey" FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE;

alter table "public"."art_approval_requests" add constraint "art_approval_requests_order_id_fkey" FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE SET NULL;

alter table "public"."art_approval_requests" add constraint "art_approval_requests_proposal_id_fkey" FOREIGN KEY (proposal_id) REFERENCES proposals(id) ON DELETE SET NULL;

alter table "public"."automation_rules" add constraint "automation_rules_company_id_fkey" FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE;

alter table "public"."automation_runs" add constraint "automation_runs_company_id_fkey" FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE;

alter table "public"."automation_runs" add constraint "automation_runs_outbox_event_id_fkey" FOREIGN KEY (outbox_event_id) REFERENCES transactional_outbox(id) ON DELETE SET NULL;

alter table "public"."automation_runs" add constraint "automation_runs_rule_id_fkey" FOREIGN KEY (rule_id) REFERENCES automation_rules(id) ON DELETE CASCADE;

alter table "public"."background_jobs" add constraint "background_jobs_company_id_fkey" FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE;

alter table "public"."business_hours" add constraint "business_hours_company_id_fkey" FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE;

alter table "public"."companies" add constraint "companies_tester_id_fkey" FOREIGN KEY (tester_id) REFERENCES auth.users(id);

alter table "public"."company_health_snapshots" add constraint "company_health_snapshots_company_id_fkey" FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE;

alter table "public"."company_members" add constraint "company_members_company_id_fkey" FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE;

alter table "public"."company_members" add constraint "company_members_created_by_fkey" FOREIGN KEY (created_by) REFERENCES auth.users(id);

alter table "public"."company_members" add constraint "company_members_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

alter table "public"."company_niche_templates" add constraint "company_niche_templates_company_id_fkey" FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE;

alter table "public"."company_proposal_settings" add constraint "company_proposal_settings_company_id_fkey" FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE;

alter table "public"."company_whatsapp_settings" add constraint "company_whatsapp_settings_company_id_fkey" FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE;

alter table "public"."crm_leads" add constraint "crm_leads_customer_profile_id_fkey" FOREIGN KEY (customer_profile_id) REFERENCES customer_profiles(id) ON DELETE SET NULL;

alter table "public"."customer_duplicate_candidates" add constraint "customer_duplicate_candidates_company_id_fkey" FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE;

alter table "public"."customer_duplicate_candidates" add constraint "customer_duplicate_candidates_left_customer_id_fkey" FOREIGN KEY (left_customer_id) REFERENCES customer_profiles(id) ON DELETE CASCADE;

alter table "public"."customer_duplicate_candidates" add constraint "customer_duplicate_candidates_right_customer_id_fkey" FOREIGN KEY (right_customer_id) REFERENCES customer_profiles(id) ON DELETE CASCADE;

alter table "public"."customer_followups" add constraint "customer_followups_company_id_fkey" FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE;

alter table "public"."customer_followups" add constraint "customer_followups_created_by_fkey" FOREIGN KEY (created_by) REFERENCES auth.users(id);

alter table "public"."customer_followups" add constraint "customer_followups_customer_profile_id_fkey" FOREIGN KEY (customer_profile_id) REFERENCES customer_profiles(id) ON DELETE SET NULL;

alter table "public"."customer_internal_notes" add constraint "customer_internal_notes_company_id_fkey" FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE;

alter table "public"."customer_magic_links" add constraint "customer_magic_links_company_id_fkey" FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE;

alter table "public"."customer_notes" add constraint "customer_notes_company_id_fkey" FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE;

alter table "public"."customer_notes" add constraint "customer_notes_created_by_fkey" FOREIGN KEY (created_by) REFERENCES auth.users(id);

alter table "public"."customer_notes" add constraint "customer_notes_customer_profile_id_fkey" FOREIGN KEY (customer_profile_id) REFERENCES customer_profiles(id) ON DELETE SET NULL;

alter table "public"."customer_portal_events" add constraint "customer_portal_events_company_id_fkey" FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE;

alter table "public"."customer_portal_events" add constraint "customer_portal_events_customer_magic_link_id_fkey" FOREIGN KEY (customer_magic_link_id) REFERENCES customer_magic_links(id) ON DELETE CASCADE;

alter table "public"."customer_profiles" add constraint "customer_profiles_company_id_fkey" FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE;

alter table "public"."customer_profiles" add constraint "customer_profiles_merged_into_id_fkey" FOREIGN KEY (merged_into_id) REFERENCES customer_profiles(id) ON DELETE SET NULL;

alter table "public"."data_quality_issues" add constraint "data_quality_issues_company_id_fkey" FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE;

alter table "public"."deliveries" add constraint "deliveries_assigned_driver_id_fkey" FOREIGN KEY (assigned_driver_id) REFERENCES delivery_drivers(id) ON DELETE SET NULL;

alter table "public"."deliveries" add constraint "deliveries_company_id_fkey" FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE;

alter table "public"."deliveries" add constraint "deliveries_delivery_zone_id_fkey" FOREIGN KEY (delivery_zone_id) REFERENCES delivery_zones(id) ON DELETE SET NULL;

alter table "public"."deliveries" add constraint "deliveries_order_id_fkey" FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE SET NULL;

alter table "public"."deliveries" add constraint "deliveries_payment_method_id_fkey" FOREIGN KEY (payment_method_id) REFERENCES payment_methods(id) ON DELETE SET NULL;

alter table "public"."delivery_assignments" add constraint "delivery_assignments_company_id_fkey" FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE;

alter table "public"."delivery_assignments" add constraint "delivery_assignments_created_by_fkey" FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;

alter table "public"."delivery_assignments" add constraint "delivery_assignments_delivery_id_fkey" FOREIGN KEY (delivery_id) REFERENCES deliveries(id) ON DELETE SET NULL;

alter table "public"."delivery_assignments" add constraint "delivery_assignments_driver_id_fkey" FOREIGN KEY (driver_id) REFERENCES delivery_drivers(id) ON DELETE SET NULL;

alter table "public"."delivery_assignments" add constraint "delivery_assignments_order_id_fkey" FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE SET NULL;

alter table "public"."delivery_drivers" add constraint "delivery_drivers_company_id_fkey" FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE;

alter table "public"."delivery_zones" add constraint "delivery_zones_company_id_fkey" FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE;

alter table "public"."demo_data_registry" add constraint "demo_data_registry_company_id_fkey" FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE;

alter table "public"."event_idempotency" add constraint "event_idempotency_company_id_fkey" FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE;

alter table "public"."finance_accounts" add constraint "finance_accounts_company_id_fkey" FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE;

alter table "public"."financial_categories" add constraint "financial_categories_company_id_fkey" FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE;

alter table "public"."financial_material_entries" add constraint "financial_material_entries_company_id_fkey" FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE;

alter table "public"."financial_material_entries" add constraint "financial_material_entries_transaction_id_fkey" FOREIGN KEY (transaction_id) REFERENCES financial_transactions(id) ON DELETE CASCADE;

alter table "public"."financial_transactions" add constraint "financial_transactions_account_id_fkey" FOREIGN KEY (account_id) REFERENCES finance_accounts(id) ON DELETE SET NULL;

alter table "public"."financial_transactions" add constraint "financial_transactions_category_id_fkey" FOREIGN KEY (category_id) REFERENCES financial_categories(id) ON DELETE SET NULL;

alter table "public"."financial_transactions" add constraint "financial_transactions_company_id_fkey" FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE;

alter table "public"."financial_transactions" add constraint "financial_transactions_created_by_fkey" FOREIGN KEY (created_by) REFERENCES auth.users(id);

alter table "public"."financial_transactions" add constraint "financial_transactions_customer_profile_id_fkey" FOREIGN KEY (customer_profile_id) REFERENCES customer_profiles(id) ON DELETE SET NULL;

alter table "public"."founder_invites" add constraint "founder_invites_company_id_fkey" FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE SET NULL;

alter table "public"."founder_invites" add constraint "founder_invites_created_by_admin_id_fkey" FOREIGN KEY (created_by_admin_id) REFERENCES platform_admins(id) ON DELETE SET NULL;

alter table "public"."founder_invites" add constraint "founder_invites_revoked_by_admin_id_fkey" FOREIGN KEY (revoked_by_admin_id) REFERENCES platform_admins(id) ON DELETE SET NULL;

alter table "public"."founder_invites" add constraint "founder_invites_sales_lead_id_fkey" FOREIGN KEY (sales_lead_id) REFERENCES signup_leads(id) ON DELETE SET NULL;

alter table "public"."founder_invites" add constraint "founder_invites_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE SET NULL;

alter table "public"."integration_connections" add constraint "integration_connections_company_id_fkey" FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE;

alter table "public"."integration_mappings" add constraint "integration_mappings_company_id_fkey" FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE;

alter table "public"."integration_mappings" add constraint "integration_mappings_connection_id_fkey" FOREIGN KEY (connection_id) REFERENCES integration_connections(id) ON DELETE CASCADE;

alter table "public"."integration_oauth_states" add constraint "integration_oauth_states_company_id_fkey" FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE;

alter table "public"."integration_push_channels" add constraint "integration_push_channels_company_id_fkey" FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE;

alter table "public"."integration_push_channels" add constraint "integration_push_channels_connection_id_fkey" FOREIGN KEY (connection_id) REFERENCES integration_connections(id) ON DELETE CASCADE;

alter table "public"."integration_sync_cursors" add constraint "integration_sync_cursors_connection_id_fkey" FOREIGN KEY (connection_id) REFERENCES integration_connections(id) ON DELETE CASCADE;

alter table "public"."integration_usage_daily" add constraint "integration_usage_daily_company_id_fkey" FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE;

alter table "public"."marketplace_commission_rules" add constraint "marketplace_commission_rules_company_id_fkey" FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE;

alter table "public"."marketplace_commissions" add constraint "marketplace_commissions_company_id_fkey" FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE;

alter table "public"."marketplace_commissions" add constraint "marketplace_commissions_marketplace_payment_id_fkey" FOREIGN KEY (marketplace_payment_id) REFERENCES marketplace_payments(id) ON DELETE SET NULL;

alter table "public"."marketplace_commissions" add constraint "marketplace_commissions_order_id_fkey" FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE SET NULL;

alter table "public"."marketplace_oauth_states" add constraint "marketplace_oauth_states_company_id_fkey" FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE;

alter table "public"."marketplace_oauth_states" add constraint "marketplace_oauth_states_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

alter table "public"."marketplace_payment_settings" add constraint "marketplace_payment_settings_company_id_fkey" FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE;

alter table "public"."marketplace_payments" add constraint "marketplace_payments_company_id_fkey" FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE;

alter table "public"."marketplace_payments" add constraint "marketplace_payments_order_id_fkey" FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE SET NULL;

alter table "public"."marketplace_stock_reservations" add constraint "marketplace_stock_reservations_company_id_fkey" FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE;

alter table "public"."marketplace_stock_reservations" add constraint "marketplace_stock_reservations_marketplace_payment_id_fkey" FOREIGN KEY (marketplace_payment_id) REFERENCES marketplace_payments(id) ON DELETE CASCADE;

alter table "public"."marketplace_stock_reservations" add constraint "marketplace_stock_reservations_order_id_fkey" FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE;

alter table "public"."marketplace_stock_reservations" add constraint "marketplace_stock_reservations_product_id_fkey" FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE RESTRICT;

alter table "public"."notifications" add constraint "notifications_company_id_fkey" FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE;

alter table "public"."notifications" add constraint "notifications_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

alter table "public"."order_items" add constraint "order_items_company_id_fkey" FOREIGN KEY (company_id) REFERENCES companies(id);

alter table "public"."order_items" add constraint "order_items_order_id_fkey" FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE;

alter table "public"."order_items" add constraint "order_items_product_id_fkey" FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE SET NULL;

alter table "public"."order_payments" add constraint "order_payments_company_id_fkey" FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE;

alter table "public"."order_payments" add constraint "order_payments_order_id_fkey" FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE;

alter table "public"."order_payments" add constraint "order_payments_payment_method_id_fkey" FOREIGN KEY (payment_method_id) REFERENCES payment_methods(id) ON DELETE SET NULL;

alter table "public"."orders" add constraint "orders_company_id_fkey" FOREIGN KEY (company_id) REFERENCES companies(id);

alter table "public"."orders" add constraint "orders_customer_profile_id_fkey" FOREIGN KEY (customer_profile_id) REFERENCES customer_profiles(id) ON DELETE SET NULL;

alter table "public"."orders" add constraint "orders_delivery_zone_id_fkey" FOREIGN KEY (delivery_zone_id) REFERENCES delivery_zones(id) ON DELETE SET NULL;

alter table "public"."orders" add constraint "orders_marketplace_payment_id_fkey" FOREIGN KEY (marketplace_payment_id) REFERENCES marketplace_payments(id) ON DELETE SET NULL;

alter table "public"."orders" add constraint "orders_original_order_id_fkey" FOREIGN KEY (original_order_id) REFERENCES orders(id) ON DELETE SET NULL;

alter table "public"."orders" add constraint "orders_payment_method_id_fkey" FOREIGN KEY (payment_method_id) REFERENCES payment_methods(id) ON DELETE SET NULL;

alter table "public"."payment_methods" add constraint "payment_methods_company_id_fkey" FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE;

alter table "public"."plan_payments" add constraint "plan_payments_company_id_fkey" FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE SET NULL;

alter table "public"."platform_admin_invites" add constraint "platform_admin_invites_created_by_admin_id_fkey" FOREIGN KEY (created_by_admin_id) REFERENCES platform_admins(id) ON DELETE SET NULL;

alter table "public"."platform_admin_invites" add constraint "platform_admin_invites_platform_admin_id_fkey" FOREIGN KEY (platform_admin_id) REFERENCES platform_admins(id) ON DELETE SET NULL;

alter table "public"."platform_admin_invites" add constraint "platform_admin_invites_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE SET NULL;

alter table "public"."platform_admins" add constraint "platform_admins_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

alter table "public"."platform_support_ticket_events" add constraint "platform_support_ticket_events_admin_id_fkey" FOREIGN KEY (admin_id) REFERENCES platform_admins(id) ON DELETE SET NULL;

alter table "public"."platform_support_ticket_events" add constraint "platform_support_ticket_events_ticket_id_fkey" FOREIGN KEY (ticket_id) REFERENCES platform_support_tickets(id) ON DELETE CASCADE;

alter table "public"."platform_support_tickets" add constraint "platform_support_tickets_assignee_admin_id_fkey" FOREIGN KEY (assignee_admin_id) REFERENCES platform_admins(id) ON DELETE SET NULL;

alter table "public"."platform_support_tickets" add constraint "platform_support_tickets_company_id_fkey" FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE SET NULL;

alter table "public"."product_analytics_events" add constraint "product_analytics_events_company_id_fkey" FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE;

alter table "public"."product_stock_movements" add constraint "product_stock_movements_company_id_fkey" FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE;

alter table "public"."product_stock_movements" add constraint "product_stock_movements_marketplace_payment_id_fkey" FOREIGN KEY (marketplace_payment_id) REFERENCES marketplace_payments(id) ON DELETE SET NULL;

alter table "public"."product_stock_movements" add constraint "product_stock_movements_order_id_fkey" FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE SET NULL;

alter table "public"."product_stock_movements" add constraint "product_stock_movements_product_id_fkey" FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE RESTRICT;

alter table "public"."product_stock_movements" add constraint "product_stock_movements_reservation_id_fkey" FOREIGN KEY (reservation_id) REFERENCES marketplace_stock_reservations(id) ON DELETE SET NULL;

alter table "public"."production_orders" add constraint "production_orders_company_id_fkey" FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE;

alter table "public"."production_orders" add constraint "production_orders_order_id_fkey" FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE SET NULL;

alter table "public"."production_orders" add constraint "production_orders_proposal_id_fkey" FOREIGN KEY (proposal_id) REFERENCES proposals(id) ON DELETE SET NULL;

alter table "public"."production_steps" add constraint "production_steps_assigned_to_fkey" FOREIGN KEY (assigned_to) REFERENCES auth.users(id);

alter table "public"."production_steps" add constraint "production_steps_company_id_fkey" FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE;

alter table "public"."production_steps" add constraint "production_steps_completed_by_fkey" FOREIGN KEY (completed_by) REFERENCES auth.users(id);

alter table "public"."production_steps" add constraint "production_steps_production_order_id_fkey" FOREIGN KEY (production_order_id) REFERENCES production_orders(id) ON DELETE CASCADE;

alter table "public"."products" add constraint "products_company_id_fkey" FOREIGN KEY (company_id) REFERENCES companies(id);

alter table "public"."proposal_events" add constraint "proposal_events_company_id_fkey" FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE;

alter table "public"."proposal_events" add constraint "proposal_events_proposal_id_fkey" FOREIGN KEY (proposal_id) REFERENCES proposals(id) ON DELETE CASCADE;

alter table "public"."proposals" add constraint "proposals_company_id_fkey" FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE;

alter table "public"."proposals" add constraint "proposals_customer_profile_id_fkey" FOREIGN KEY (customer_profile_id) REFERENCES customer_profiles(id) ON DELETE SET NULL;

alter table "public"."proposals" add constraint "proposals_order_id_fkey" FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE SET NULL;

alter table "public"."quote_templates" add constraint "quote_templates_company_id_fkey" FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE;

alter table "public"."recurring_orders" add constraint "recurring_orders_company_id_fkey" FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE;

alter table "public"."recurring_orders" add constraint "recurring_orders_original_order_id_fkey" FOREIGN KEY (original_order_id) REFERENCES orders(id) ON DELETE SET NULL;

alter table "public"."security_events" add constraint "security_events_actor_user_id_fkey" FOREIGN KEY (actor_user_id) REFERENCES auth.users(id) ON DELETE SET NULL;

alter table "public"."security_events" add constraint "security_events_company_id_fkey" FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE SET NULL;

alter table "public"."signup_lead_followups" add constraint "signup_lead_followups_created_by_admin_id_fkey" FOREIGN KEY (created_by_admin_id) REFERENCES platform_admins(id) ON DELETE SET NULL;

alter table "public"."signup_lead_followups" add constraint "signup_lead_followups_lead_id_fkey" FOREIGN KEY (lead_id) REFERENCES signup_leads(id) ON DELETE CASCADE;

alter table "public"."signup_leads" add constraint "signup_leads_affiliate_referral_id_fkey" FOREIGN KEY (affiliate_referral_id) REFERENCES affiliate_referrals(id) ON DELETE SET NULL;

alter table "public"."signup_leads" add constraint "signup_leads_assigned_to_admin_id_fkey" FOREIGN KEY (assigned_to_admin_id) REFERENCES platform_admins(id) ON DELETE SET NULL;

alter table "public"."signup_leads" add constraint "signup_leads_created_by_admin_id_fkey" FOREIGN KEY (created_by_admin_id) REFERENCES platform_admins(id) ON DELETE SET NULL;

alter table "public"."site_sections" add constraint "site_sections_company_id_fkey" FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE;

alter table "public"."subscription_events" add constraint "subscription_events_company_id_fkey" FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE;

alter table "public"."timeline_events" add constraint "timeline_events_company_id_fkey" FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE;

alter table "public"."timeline_events" add constraint "timeline_events_customer_profile_id_fkey" FOREIGN KEY (customer_profile_id) REFERENCES customer_profiles(id) ON DELETE SET NULL;

alter table "public"."transactional_outbox" add constraint "transactional_outbox_company_id_fkey" FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE;

alter table "public"."whatsapp_connections" add constraint "whatsapp_connections_company_id_fkey" FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE;

alter table "public"."whatsapp_conversations" add constraint "whatsapp_conversations_company_id_fkey" FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE;

alter table "public"."whatsapp_message_logs" add constraint "whatsapp_message_logs_company_id_fkey" FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE SET NULL;

alter table "public"."whatsapp_message_logs" add constraint "whatsapp_message_logs_conversation_id_fkey" FOREIGN KEY (conversation_id) REFERENCES whatsapp_conversations(id) ON DELETE SET NULL;

alter table "public"."whatsapp_message_logs" add constraint "whatsapp_message_logs_order_id_fkey" FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE SET NULL;

alter table "public"."whatsapp_message_logs" add constraint "whatsapp_message_logs_proposal_id_fkey" FOREIGN KEY (proposal_id) REFERENCES proposals(id) ON DELETE SET NULL;

alter table "public"."whatsapp_webhook_events" add constraint "whatsapp_webhook_events_company_id_fkey" FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE;

CREATE INDEX affiliate_activity_events_kind_idx ON public.affiliate_activity_events USING btree (affiliate_id, kind, created_at DESC);

CREATE INDEX affiliate_activity_events_lead_idx ON public.affiliate_activity_events USING btree (lead_id) WHERE (lead_id IS NOT NULL);

CREATE INDEX affiliate_activity_events_period_idx ON public.affiliate_activity_events USING btree (affiliate_id, created_at DESC);

CREATE INDEX affiliate_audit_logs_affiliate_idx ON public.affiliate_audit_logs USING btree (affiliate_id, created_at DESC);

CREATE INDEX affiliate_clicks_affiliate_created_idx ON public.affiliate_clicks USING btree (affiliate_id, created_at DESC);

CREATE INDEX affiliate_clicks_session_idx ON public.affiliate_clicks USING btree (session_hash, created_at DESC);

CREATE INDEX affiliate_commissions_affiliate_status_idx ON public.affiliate_commissions USING btree (affiliate_id, status, hold_until);

CREATE INDEX affiliate_commissions_company_idx ON public.affiliate_commissions USING btree (company_id, created_at DESC);

CREATE INDEX affiliate_course_progress_affiliate_idx ON public.affiliate_course_progress USING btree (affiliate_id, completed_at DESC);

CREATE INDEX affiliate_leads_affiliate_status_idx ON public.affiliate_leads USING btree (affiliate_id, status);

CREATE INDEX affiliate_leads_follow_up_idx ON public.affiliate_leads USING btree (affiliate_id, next_follow_up_at) WHERE (next_follow_up_at IS NOT NULL);

CREATE INDEX affiliate_payouts_affiliate_created_idx ON public.affiliate_payouts USING btree (affiliate_id, created_at DESC);

CREATE UNIQUE INDEX affiliate_payouts_provider_transfer_uidx ON public.affiliate_payouts USING btree (provider_transfer_id) WHERE (provider_transfer_id IS NOT NULL);

CREATE INDEX affiliate_payouts_status_idx ON public.affiliate_payouts USING btree (status, created_at DESC);

CREATE UNIQUE INDEX affiliate_profiles_code_uidx ON public.affiliate_profiles USING btree (upper(code));

CREATE UNIQUE INDEX affiliate_profiles_document_uidx ON public.affiliate_profiles USING btree (document_hash);

CREATE UNIQUE INDEX affiliate_profiles_email_uidx ON public.affiliate_profiles USING btree (lower(email));

CREATE INDEX affiliate_profiles_status_idx ON public.affiliate_profiles USING btree (status, created_at DESC);

CREATE INDEX affiliate_referrals_affiliate_created_idx ON public.affiliate_referrals USING btree (affiliate_id, created_at DESC);

CREATE INDEX affiliate_referrals_company_idx ON public.affiliate_referrals USING btree (company_id);

CREATE INDEX affiliate_referrals_review_idx ON public.affiliate_referrals USING btree (review_status, status, created_at DESC);

CREATE INDEX affiliate_referrals_status_idx ON public.affiliate_referrals USING btree (status, created_at DESC);

CREATE INDEX affiliate_tasks_due_idx ON public.affiliate_tasks USING btree (affiliate_id, completed_at, due_at);

CREATE INDEX affiliate_tasks_lead_idx ON public.affiliate_tasks USING btree (lead_id) WHERE (lead_id IS NOT NULL);

CREATE INDEX affiliate_training_sessions_idx ON public.affiliate_training_sessions USING btree (affiliate_id, completed_at DESC);

CREATE INDEX application_error_events_company_created_at_idx ON public.application_error_events USING btree (company_id, created_at DESC) WHERE (company_id IS NOT NULL);

CREATE INDEX application_error_events_created_at_idx ON public.application_error_events USING btree (created_at DESC);

CREATE INDEX application_error_events_route_created_at_idx ON public.application_error_events USING btree (route, created_at DESC);

CREATE INDEX art_approval_requests_active_token_idx ON public.art_approval_requests USING btree (token, expires_at) WHERE (revoked_at IS NULL);

CREATE INDEX assistant_events_created_at_idx ON public.assistant_events USING btree (created_at DESC);

CREATE INDEX assistant_events_name_created_idx ON public.assistant_events USING btree (event_name, created_at DESC);

CREATE INDEX assistant_events_plan_created_idx ON public.assistant_events USING btree (recommended_plan, created_at DESC) WHERE (recommended_plan IS NOT NULL);

CREATE INDEX assistant_events_session_created_idx ON public.assistant_events USING btree (session_hash, created_at DESC);

CREATE INDEX automation_rules_company_enabled_idx ON public.automation_rules USING btree (company_id, enabled, trigger_key);

CREATE INDEX automation_runs_company_created_idx ON public.automation_runs USING btree (company_id, created_at DESC);

CREATE INDEX automation_runs_outbox_event_id_idx ON public.automation_runs USING btree (outbox_event_id);

CREATE INDEX automation_runs_status_created_idx ON public.automation_runs USING btree (status, created_at) WHERE (status = ANY (ARRAY['queued'::text, 'retrying'::text, 'needs_attention'::text]));

CREATE INDEX background_jobs_claim_idx ON public.background_jobs USING btree (status, run_after, created_at) WHERE (status = ANY (ARRAY['queued'::text, 'retrying'::text]));

CREATE INDEX background_jobs_company_created_idx ON public.background_jobs USING btree (company_id, created_at DESC);

CREATE INDEX business_hours_company_idx ON public.business_hours USING btree (company_id);

CREATE INDEX companies_business_type_idx ON public.companies USING btree (business_type);

CREATE UNIQUE INDEX companies_founder_number_uq ON public.companies USING btree (founder_number) WHERE ((is_founder = true) AND (founder_number IS NOT NULL));

CREATE INDEX companies_subdomain_slug_idx ON public.companies USING btree (subdomain_slug);

CREATE UNIQUE INDEX companies_subdomain_slug_unique ON public.companies USING btree (lower(subdomain_slug)) WHERE (subdomain_slug IS NOT NULL);

CREATE INDEX company_health_snapshots_company_time_idx ON public.company_health_snapshots USING btree (company_id, calculated_at DESC);

CREATE UNIQUE INDEX company_members_company_email_unique ON public.company_members USING btree (company_id, lower(email)) WHERE (status <> 'removido'::text);

CREATE UNIQUE INDEX company_members_company_user_unique ON public.company_members USING btree (company_id, user_id) WHERE (status <> 'removido'::text);

CREATE INDEX crm_leads_customer_profile_id_idx ON public.crm_leads USING btree (customer_profile_id);

CREATE INDEX customer_duplicate_candidates_left_idx ON public.customer_duplicate_candidates USING btree (left_customer_id);

CREATE INDEX customer_duplicate_candidates_review_idx ON public.customer_duplicate_candidates USING btree (company_id, status, confidence DESC, created_at DESC);

CREATE INDEX customer_duplicate_candidates_right_idx ON public.customer_duplicate_candidates USING btree (right_customer_id);

CREATE INDEX customer_followups_customer_profile_id_idx ON public.customer_followups USING btree (customer_profile_id);

CREATE INDEX customer_notes_customer_profile_id_idx ON public.customer_notes USING btree (customer_profile_id);

CREATE INDEX customer_profiles_company_email_idx ON public.customer_profiles USING btree (company_id, email_normalized) WHERE ((email_normalized IS NOT NULL) AND (archived = false));

CREATE INDEX customer_profiles_company_name_idx ON public.customer_profiles USING btree (company_id, normalized_name) WHERE ((normalized_name IS NOT NULL) AND (archived = false));

CREATE INDEX customer_profiles_company_phone_idx ON public.customer_profiles USING btree (company_id, phone_normalized) WHERE ((phone_normalized IS NOT NULL) AND (archived = false));

CREATE INDEX customer_profiles_merged_into_idx ON public.customer_profiles USING btree (merged_into_id) WHERE (merged_into_id IS NOT NULL);

CREATE INDEX data_quality_issues_company_status_idx ON public.data_quality_issues USING btree (company_id, status, severity, last_seen_at DESC);

CREATE INDEX deliveries_company_driver_idx ON public.deliveries USING btree (company_id, assigned_driver_id, status);

CREATE INDEX delivery_assignments_company_assigned_idx ON public.delivery_assignments USING btree (company_id, assigned_at DESC);

CREATE INDEX delivery_assignments_delivery_idx ON public.delivery_assignments USING btree (delivery_id, assigned_at DESC);

CREATE INDEX delivery_assignments_driver_idx ON public.delivery_assignments USING btree (company_id, driver_id, assigned_at DESC);

CREATE INDEX delivery_assignments_settlement_idx ON public.delivery_assignments USING btree (company_id, settlement_status, assigned_at DESC);

CREATE INDEX delivery_drivers_company_active_idx ON public.delivery_drivers USING btree (company_id, is_active, name);

CREATE UNIQUE INDEX delivery_drivers_company_plate_uidx ON public.delivery_drivers USING btree (company_id, upper(TRIM(BOTH FROM vehicle_plate))) WHERE ((vehicle_plate IS NOT NULL) AND (TRIM(BOTH FROM vehicle_plate) <> ''::text));

CREATE INDEX delivery_zones_company_idx ON public.delivery_zones USING btree (company_id);

CREATE INDEX demo_data_registry_company_idx ON public.demo_data_registry USING btree (company_id, created_at DESC);

CREATE INDEX event_idempotency_company_received_idx ON public.event_idempotency USING btree (company_id, received_at DESC);

CREATE INDEX event_idempotency_status_received_idx ON public.event_idempotency USING btree (status, received_at DESC);

CREATE INDEX financial_transactions_customer_profile_id_idx ON public.financial_transactions USING btree (customer_profile_id);

CREATE UNIQUE INDEX founder_invites_activated_company_uq ON public.founder_invites USING btree (company_id) WHERE ((status = 'activated'::text) AND (company_id IS NOT NULL));

CREATE UNIQUE INDEX founder_invites_activated_user_uq ON public.founder_invites USING btree (user_id) WHERE ((status = 'activated'::text) AND (user_id IS NOT NULL));

CREATE INDEX founder_invites_activation_claim_idx ON public.founder_invites USING btree (activation_claim_id) WHERE (status = 'activating'::text);

CREATE INDEX founder_invites_created_by_idx ON public.founder_invites USING btree (created_by_admin_id, invited_at DESC);

CREATE INDEX founder_invites_expiry_idx ON public.founder_invites USING btree (token_expires_at) WHERE ((status = 'pending'::text) AND (token_expires_at IS NOT NULL));

CREATE UNIQUE INDEX founder_invites_live_email_uq ON public.founder_invites USING btree (email_normalized) WHERE (status = ANY (ARRAY['pending'::text, 'activating'::text, 'activated'::text]));

CREATE UNIQUE INDEX founder_invites_live_number_uq ON public.founder_invites USING btree (founder_number) WHERE (status = ANY (ARRAY['pending'::text, 'activating'::text, 'activated'::text]));

CREATE UNIQUE INDEX founder_invites_live_sales_lead_uq ON public.founder_invites USING btree (sales_lead_id) WHERE ((sales_lead_id IS NOT NULL) AND (status = ANY (ARRAY['pending'::text, 'activating'::text, 'activated'::text])));

CREATE INDEX founder_invites_revoked_by_admin_idx ON public.founder_invites USING btree (revoked_by_admin_id, revoked_at DESC) WHERE (revoked_by_admin_id IS NOT NULL);

CREATE INDEX founder_invites_sales_lead_idx ON public.founder_invites USING btree (sales_lead_id, invited_at DESC) WHERE (sales_lead_id IS NOT NULL);

CREATE INDEX founder_invites_status_idx ON public.founder_invites USING btree (status, invited_at DESC);

CREATE UNIQUE INDEX founder_invites_token_hash_uq ON public.founder_invites USING btree (token_hash);

CREATE INDEX idx_admin_audit_logs_admin_email ON public.admin_audit_logs USING btree (lower(admin_email), created_at DESC);

CREATE INDEX idx_admin_audit_logs_created ON public.admin_audit_logs USING btree (created_at DESC);

CREATE INDEX idx_admin_audit_target_created ON public.admin_audit_logs USING btree (target_id, created_at DESC);

CREATE INDEX idx_admin_bug_reports_area_status ON public.admin_bug_reports USING btree (area, status, severity);

CREATE UNIQUE INDEX idx_admin_bug_reports_code_unique ON public.admin_bug_reports USING btree (code);

CREATE INDEX idx_admin_bug_reports_entity ON public.admin_bug_reports USING btree (entity_type, entity_id);

CREATE INDEX idx_admin_bug_reports_last_seen ON public.admin_bug_reports USING btree (last_seen_at DESC);

CREATE INDEX idx_admin_bug_reports_severity ON public.admin_bug_reports USING btree (severity);

CREATE INDEX idx_admin_bug_reports_status ON public.admin_bug_reports USING btree (status);

CREATE INDEX idx_admin_bug_reports_status_severity ON public.admin_bug_reports USING btree (status, severity);

CREATE INDEX idx_admin_scan_runs_started ON public.admin_scan_runs USING btree (started_at DESC);

CREATE INDEX idx_admin_snapshots_created ON public.admin_system_snapshots USING btree (created_at DESC);

CREATE INDEX idx_affiliate_audit_logs_actor_user_id ON public.affiliate_audit_logs USING btree (actor_user_id);

CREATE INDEX idx_affiliate_commissions_payout_id ON public.affiliate_commissions USING btree (payout_id);

CREATE INDEX idx_affiliate_commissions_plan_payment_id ON public.affiliate_commissions USING btree (plan_payment_id);

CREATE INDEX idx_app_notifications_company_id ON public.app_notifications USING btree (company_id);

CREATE INDEX idx_app_notifications_created ON public.app_notifications USING btree (company_id, created_at DESC);

CREATE INDEX idx_app_notifications_status ON public.app_notifications USING btree (company_id, status);

CREATE INDEX idx_art_approval_requests_order_id ON public.art_approval_requests USING btree (order_id);

CREATE INDEX idx_art_approval_requests_proposal_id ON public.art_approval_requests USING btree (proposal_id);

CREATE INDEX idx_art_approvals_company_status ON public.art_approval_requests USING btree (company_id, status, created_at DESC);

CREATE INDEX idx_art_approvals_token ON public.art_approval_requests USING btree (token);

CREATE UNIQUE INDEX idx_background_jobs_one_active_google_calendar_full_resync ON public.background_jobs USING btree (company_id, ((payload ->> 'connection_id'::text))) WHERE ((job_type = 'google.calendar.full_resync'::text) AND (status = ANY (ARRAY['queued'::text, 'running'::text, 'retrying'::text])) AND (payload ? 'connection_id'::text));

CREATE UNIQUE INDEX idx_background_jobs_one_active_integration_sync ON public.background_jobs USING btree (company_id, ((payload ->> 'connection_id'::text))) WHERE ((job_type = 'integration.sync'::text) AND (status = ANY (ARRAY['queued'::text, 'running'::text, 'retrying'::text])) AND (payload ? 'connection_id'::text));

CREATE INDEX idx_background_jobs_running_lock ON public.background_jobs USING btree (locked_at) WHERE ((status = 'running'::text) AND (locked_at IS NOT NULL));

CREATE INDEX idx_business_hours_company_weekday ON public.business_hours USING btree (company_id, weekday);

CREATE INDEX idx_companies_access_until ON public.companies USING btree (access_until);

CREATE INDEX idx_companies_admin_created ON public.companies USING btree (created_at DESC);

CREATE INDEX idx_companies_admin_subscription_status ON public.companies USING btree (assinatura_status, created_at DESC);

CREATE INDEX idx_companies_assinatura_status ON public.companies USING btree (assinatura_status, assinatura_expira_em);

CREATE INDEX idx_companies_mp_subscription ON public.companies USING btree (mercado_pago_subscription_id);

CREATE INDEX idx_companies_owner_id ON public.companies USING btree (owner_id);

CREATE INDEX idx_companies_slug ON public.companies USING btree (slug);

CREATE INDEX idx_companies_slug_subdomain ON public.companies USING btree (slug, subdomain_slug);

CREATE INDEX idx_companies_subscription_payment_mode ON public.companies USING btree (assinatura_forma_pagamento_preferida);

CREATE INDEX idx_companies_subscription_status ON public.companies USING btree (assinatura_status);

CREATE INDEX idx_companies_tester_id ON public.companies USING btree (tester_id);

CREATE INDEX idx_companies_trial_used_at ON public.companies USING btree (trial_used_at);

CREATE UNIQUE INDEX idx_company_members_company_email_unique ON public.company_members USING btree (company_id, lower(email));

CREATE INDEX idx_company_members_company_status ON public.company_members USING btree (company_id, status);

CREATE UNIQUE INDEX idx_company_members_company_user_unique ON public.company_members USING btree (company_id, user_id);

CREATE INDEX idx_company_members_created_by ON public.company_members USING btree (created_by);

CREATE INDEX idx_company_members_email_company ON public.company_members USING btree (lower(email), company_id);

CREATE INDEX idx_company_members_user_status ON public.company_members USING btree (user_id, status);

CREATE INDEX idx_company_niche_templates_company ON public.company_niche_templates USING btree (company_id);

CREATE INDEX idx_crm_leads_company_id ON public.crm_leads USING btree (company_id);

CREATE INDEX idx_crm_leads_etapa ON public.crm_leads USING btree (company_id, etapa);

CREATE INDEX idx_crm_leads_next_contact ON public.crm_leads USING btree (company_id, proximo_contato_em);

CREATE INDEX idx_customer_followups_company_phone ON public.customer_followups USING btree (company_id, cliente_telefone, status, due_at);

CREATE INDEX idx_customer_followups_created_by ON public.customer_followups USING btree (created_by);

CREATE INDEX idx_customer_internal_notes_company_id ON public.customer_internal_notes USING btree (company_id);

CREATE INDEX idx_customer_magic_links_company_phone ON public.customer_magic_links USING btree (company_id, customer_phone);

CREATE INDEX idx_customer_magic_links_token ON public.customer_magic_links USING btree (token);

CREATE INDEX idx_customer_notes_company_phone ON public.customer_notes USING btree (company_id, cliente_telefone, created_at DESC);

CREATE INDEX idx_customer_notes_created_by ON public.customer_notes USING btree (created_by);

CREATE INDEX idx_customer_portal_events_company_id ON public.customer_portal_events USING btree (company_id);

CREATE INDEX idx_customer_portal_events_magic_link_id ON public.customer_portal_events USING btree (customer_magic_link_id);

CREATE INDEX idx_deliveries_assigned_driver_id ON public.deliveries USING btree (assigned_driver_id);

CREATE INDEX idx_deliveries_company_created_at ON public.deliveries USING btree (company_id, created_at DESC);

CREATE INDEX idx_deliveries_company_id ON public.deliveries USING btree (company_id);

CREATE INDEX idx_deliveries_company_status ON public.deliveries USING btree (company_id, status);

CREATE INDEX idx_deliveries_delivery_zone_id ON public.deliveries USING btree (delivery_zone_id);

CREATE INDEX idx_deliveries_order_id ON public.deliveries USING btree (order_id);

CREATE INDEX idx_deliveries_payment_method_id ON public.deliveries USING btree (payment_method_id);

CREATE INDEX idx_delivery_assignments_created_by ON public.delivery_assignments USING btree (created_by);

CREATE INDEX idx_delivery_assignments_driver_id_fk ON public.delivery_assignments USING btree (driver_id);

CREATE INDEX idx_delivery_assignments_order_id_fk ON public.delivery_assignments USING btree (order_id);

CREATE INDEX idx_delivery_zones_company_active ON public.delivery_zones USING btree (company_id, is_active);

CREATE INDEX idx_finance_accounts_company ON public.finance_accounts USING btree (company_id, ativo);

CREATE INDEX idx_finance_accounts_company_id ON public.finance_accounts USING btree (company_id);

CREATE INDEX idx_financial_categories_company_id ON public.financial_categories USING btree (company_id);

CREATE INDEX idx_financial_material_company ON public.financial_material_entries USING btree (company_id, created_at DESC);

CREATE INDEX idx_financial_material_entries_company_id ON public.financial_material_entries USING btree (company_id);

CREATE INDEX idx_financial_material_entries_transaction_id ON public.financial_material_entries USING btree (transaction_id);

CREATE INDEX idx_financial_transactions_account_id ON public.financial_transactions USING btree (account_id);

CREATE INDEX idx_financial_transactions_category_id ON public.financial_transactions USING btree (category_id);

CREATE INDEX idx_financial_transactions_company_date ON public.financial_transactions USING btree (company_id, data_competencia DESC);

CREATE INDEX idx_financial_transactions_company_id ON public.financial_transactions USING btree (company_id);

CREATE INDEX idx_financial_transactions_company_type ON public.financial_transactions USING btree (company_id, tipo, status);

CREATE INDEX idx_financial_transactions_created_by ON public.financial_transactions USING btree (created_by);

CREATE INDEX idx_financial_transactions_status ON public.financial_transactions USING btree (company_id, status);

CREATE INDEX idx_financial_transactions_vencimento ON public.financial_transactions USING btree (company_id, vencimento);

CREATE INDEX idx_integration_connections_company_status ON public.integration_connections USING btree (company_id, status);

CREATE INDEX idx_integration_connections_last_sync ON public.integration_connections USING btree (last_sync_at DESC) WHERE (last_sync_at IS NOT NULL);

CREATE INDEX idx_integration_connections_provider_status ON public.integration_connections USING btree (provider, status);

CREATE UNIQUE INDEX idx_integration_mappings_local_entity_unique ON public.integration_mappings USING btree (connection_id, entity_type, orcaly_entity_id) WHERE (orcaly_entity_id IS NOT NULL);

CREATE INDEX idx_integration_mappings_orcaly_entity ON public.integration_mappings USING btree (company_id, entity_type, orcaly_entity_id) WHERE (orcaly_entity_id IS NOT NULL);

CREATE INDEX idx_integration_oauth_states_lookup ON public.integration_oauth_states USING btree (company_id, user_id, provider, expires_at DESC);

CREATE INDEX idx_integration_oauth_states_unconsumed ON public.integration_oauth_states USING btree (expires_at) WHERE (consumed_at IS NULL);

CREATE INDEX idx_integration_push_channels_connection ON public.integration_push_channels USING btree (company_id, connection_id, provider, state);

CREATE INDEX idx_integration_push_channels_expiry ON public.integration_push_channels USING btree (expires_at) WHERE ((state = 'active'::text) AND (expires_at IS NOT NULL));

CREATE INDEX idx_internal_tasks_company_id ON public.internal_tasks USING btree (company_id);

CREATE INDEX idx_internal_tasks_due ON public.internal_tasks USING btree (company_id, due_at);

CREATE INDEX idx_internal_tasks_status ON public.internal_tasks USING btree (company_id, status);

CREATE INDEX idx_marketplace_commission_rules_company ON public.marketplace_commission_rules USING btree (company_id);

CREATE INDEX idx_marketplace_commission_rules_plan ON public.marketplace_commission_rules USING btree (plan_key);

CREATE INDEX idx_marketplace_commissions_company ON public.marketplace_commissions USING btree (company_id);

CREATE INDEX idx_marketplace_commissions_order_id ON public.marketplace_commissions USING btree (order_id);

CREATE INDEX idx_marketplace_commissions_payment ON public.marketplace_commissions USING btree (marketplace_payment_id);

CREATE INDEX idx_marketplace_coupons_active ON public.marketplace_coupons USING btree (company_id, ativo);

CREATE UNIQUE INDEX idx_marketplace_coupons_company_code ON public.marketplace_coupons USING btree (company_id, codigo_normalizado);

CREATE INDEX idx_marketplace_coupons_company_id ON public.marketplace_coupons USING btree (company_id);

CREATE INDEX idx_marketplace_oauth_states_company_id ON public.marketplace_oauth_states USING btree (company_id);

CREATE INDEX idx_marketplace_oauth_states_hash ON public.marketplace_oauth_states USING btree (state_hash);

CREATE INDEX idx_marketplace_oauth_states_user_id ON public.marketplace_oauth_states USING btree (user_id);

CREATE INDEX idx_marketplace_payment_settings_company ON public.marketplace_payment_settings USING btree (company_id);

CREATE INDEX idx_marketplace_payments_company ON public.marketplace_payments USING btree (company_id);

CREATE INDEX idx_marketplace_payments_provider_payment ON public.marketplace_payments USING btree (provider_payment_id);

CREATE INDEX idx_notifications_company_created ON public.notifications USING btree (company_id, created_at DESC);

CREATE INDEX idx_notifications_user_read_created ON public.notifications USING btree (user_id, read_at, created_at DESC);

CREATE INDEX idx_order_internal_comments_company_id ON public.order_internal_comments USING btree (company_id);

CREATE INDEX idx_order_internal_comments_created_at ON public.order_internal_comments USING btree (order_id, created_at DESC);

CREATE INDEX idx_order_internal_comments_order_id ON public.order_internal_comments USING btree (order_id);

CREATE INDEX idx_order_items_company_id ON public.order_items USING btree (company_id);

CREATE INDEX idx_order_items_company_order ON public.order_items USING btree (company_id, order_id);

CREATE INDEX idx_order_items_order ON public.order_items USING btree (order_id);

CREATE INDEX idx_order_items_product_id ON public.order_items USING btree (product_id);

CREATE INDEX idx_order_items_respostas ON public.order_items USING gin (respostas);

CREATE INDEX idx_order_payments_company_id ON public.order_payments USING btree (company_id);

CREATE INDEX idx_order_payments_company_order ON public.order_payments USING btree (company_id, order_id);

CREATE INDEX idx_order_payments_company_status ON public.order_payments USING btree (company_id, status);

CREATE INDEX idx_order_payments_order_id ON public.order_payments USING btree (order_id);

CREATE INDEX idx_order_payments_payment_method_id ON public.order_payments USING btree (payment_method_id);

CREATE INDEX idx_order_status_history_company_id ON public.order_status_history USING btree (company_id);

CREATE INDEX idx_order_status_history_created_at ON public.order_status_history USING btree (order_id, created_at DESC);

CREATE INDEX idx_order_status_history_order_id ON public.order_status_history USING btree (order_id);

CREATE INDEX idx_orders_cliente_empresa ON public.orders USING btree (cliente_empresa);

CREATE INDEX idx_orders_company_created ON public.orders USING btree (company_id, created_at DESC);

CREATE INDEX idx_orders_company_delivery_type ON public.orders USING btree (company_id, delivery_type);

CREATE INDEX idx_orders_company_id ON public.orders USING btree (company_id);

CREATE INDEX idx_orders_company_payment_status ON public.orders USING btree (company_id, payment_status);

CREATE INDEX idx_orders_company_status_created ON public.orders USING btree (company_id, status, created_at DESC);

CREATE INDEX idx_orders_created_at ON public.orders USING btree (created_at);

CREATE INDEX idx_orders_dados_inteligentes ON public.orders USING gin (dados_inteligentes);

CREATE INDEX idx_orders_delivery_zone_id ON public.orders USING btree (delivery_zone_id);

CREATE INDEX idx_orders_marketplace_payment_id ON public.orders USING btree (marketplace_payment_id);

CREATE INDEX idx_orders_original_order_id ON public.orders USING btree (original_order_id);

CREATE INDEX idx_orders_payment_method_id ON public.orders USING btree (payment_method_id);

CREATE INDEX idx_orders_status ON public.orders USING btree (status);

CREATE INDEX idx_orders_telefone ON public.orders USING btree (telefone);

CREATE INDEX idx_payment_methods_company_active ON public.payment_methods USING btree (company_id, is_active);

CREATE INDEX idx_payment_methods_company_id ON public.payment_methods USING btree (company_id);

CREATE INDEX idx_plan_payments_admin_status_paid ON public.plan_payments USING btree (status, paid_at DESC);

CREATE INDEX idx_plan_payments_company_id ON public.plan_payments USING btree (company_id);

CREATE INDEX idx_plan_payments_company_status ON public.plan_payments USING btree (company_id, status);

CREATE INDEX idx_plan_payments_payment_id ON public.plan_payments USING btree (mercado_pago_payment_id);

CREATE INDEX idx_plan_payments_preapproval ON public.plan_payments USING btree (mercado_pago_preapproval_id);

CREATE INDEX idx_plan_payments_preference_id ON public.plan_payments USING btree (mercado_pago_preference_id);

CREATE INDEX idx_platform_admins_email ON public.platform_admins USING btree (lower(email));

CREATE INDEX idx_platform_admins_user ON public.platform_admins USING btree (user_id);

CREATE INDEX idx_platform_feature_flags_key_scope ON public.platform_feature_flags USING btree (key, scope, scope_value);

CREATE INDEX idx_platform_support_events_ticket_created ON public.platform_support_ticket_events USING btree (ticket_id, created_at DESC);

CREATE INDEX idx_platform_support_ticket_events_admin_id ON public.platform_support_ticket_events USING btree (admin_id);

CREATE INDEX idx_platform_support_tickets_assignee_admin_id ON public.platform_support_tickets USING btree (assignee_admin_id);

CREATE INDEX idx_platform_support_tickets_company_created ON public.platform_support_tickets USING btree (company_id, created_at DESC);

CREATE INDEX idx_platform_support_tickets_status_priority_created ON public.platform_support_tickets USING btree (status, priority, created_at DESC);

CREATE INDEX idx_production_orders_company_status ON public.production_orders USING btree (company_id, status, due_date);

CREATE INDEX idx_production_orders_company_status_created ON public.production_orders USING btree (company_id, status, created_at DESC);

CREATE INDEX idx_production_orders_order_id ON public.production_orders USING btree (order_id);

CREATE UNIQUE INDEX idx_production_orders_proposal_unique ON public.production_orders USING btree (proposal_id) WHERE (proposal_id IS NOT NULL);

CREATE INDEX idx_production_steps_assigned_to ON public.production_steps USING btree (assigned_to);

CREATE INDEX idx_production_steps_company_id ON public.production_steps USING btree (company_id);

CREATE INDEX idx_production_steps_completed_by ON public.production_steps USING btree (completed_by);

CREATE INDEX idx_production_steps_order_sort ON public.production_steps USING btree (production_order_id, sort_order);

CREATE INDEX idx_products_categoria ON public.products USING btree (categoria);

CREATE INDEX idx_products_company_active_category ON public.products USING btree (company_id, ativo, categoria);

CREATE INDEX idx_products_company_active_created ON public.products USING btree (company_id, ativo, created_at DESC);

CREATE INDEX idx_products_company_ativo ON public.products USING btree (company_id, ativo);

CREATE INDEX idx_products_company_ativo_arquivado ON public.products USING btree (company_id, ativo, arquivado);

CREATE INDEX idx_products_company_categoria ON public.products USING btree (company_id, categoria);

CREATE INDEX idx_products_company_destaque ON public.products USING btree (company_id, destaque);

CREATE INDEX idx_products_company_id ON public.products USING btree (company_id);

CREATE INDEX idx_products_company_margin ON public.products USING btree (company_id, ativo, margem_desejada);

CREATE INDEX idx_products_company_oculto ON public.products USING btree (company_id, oculto);

CREATE INDEX idx_products_created_at ON public.products USING btree (created_at);

CREATE INDEX idx_products_marketplace_company ON public.products USING btree (company_id, ativo, destaque);

CREATE INDEX idx_proposal_events_company_created ON public.proposal_events USING btree (company_id, created_at DESC);

CREATE INDEX idx_proposal_events_proposal_created ON public.proposal_events USING btree (proposal_id, created_at DESC);

CREATE INDEX idx_proposals_company_id ON public.proposals USING btree (company_id);

CREATE INDEX idx_proposals_company_status_created ON public.proposals USING btree (company_id, status, created_at DESC);

CREATE INDEX idx_proposals_order ON public.proposals USING btree (order_id);

CREATE INDEX idx_proposals_token ON public.proposals USING btree (token);

CREATE UNIQUE INDEX idx_quote_templates_company_nome ON public.quote_templates USING btree (company_id, nome);

CREATE UNIQUE INDEX idx_quote_templates_company_tipo_unique ON public.quote_templates USING btree (company_id, tipo);

CREATE INDEX idx_recurring_orders_company_next ON public.recurring_orders USING btree (company_id, next_due_at);

CREATE INDEX idx_recurring_orders_original_order_id ON public.recurring_orders USING btree (original_order_id);

CREATE INDEX idx_security_admin_open_created ON public.security_events USING btree (resolved, severity, created_at DESC);

CREATE UNIQUE INDEX idx_security_blocklist_type_value ON public.security_blocklist USING btree (type, lower(value));

CREATE INDEX idx_security_events_actor_user_id ON public.security_events USING btree (actor_user_id);

CREATE INDEX idx_security_events_company_created ON public.security_events USING btree (company_id, created_at DESC);

CREATE INDEX idx_security_events_created ON public.security_events USING btree (created_at DESC);

CREATE INDEX idx_security_events_path ON public.security_events USING btree (path);

CREATE INDEX idx_security_events_type_severity ON public.security_events USING btree (event_type, severity, resolved);

CREATE INDEX idx_signup_lead_followups_lead ON public.signup_lead_followups USING btree (lead_id, created_at DESC);

CREATE INDEX idx_signup_lead_followups_sales_admin ON public.signup_lead_followups USING btree (created_by_admin_id, created_at DESC) WHERE (created_by_admin_id IS NOT NULL);

CREATE INDEX idx_signup_leads_affiliate_referral_id ON public.signup_leads USING btree (affiliate_referral_id);

CREATE INDEX idx_signup_leads_email ON public.signup_leads USING btree (lower(email));

CREATE INDEX idx_signup_leads_sales_assignee_stage ON public.signup_leads USING btree (assigned_to_admin_id, sales_stage, updated_at DESC);

CREATE INDEX idx_signup_leads_sales_creator ON public.signup_leads USING btree (created_by_admin_id, created_at DESC);

CREATE INDEX idx_signup_leads_sales_next_action ON public.signup_leads USING btree (sales_next_action_at) WHERE ((sales_next_action_at IS NOT NULL) AND (sales_stage <> ALL (ARRAY['cliente'::text, 'perdido'::text])));

CREATE INDEX idx_signup_leads_sales_stage ON public.signup_leads USING btree (sales_stage, updated_at DESC);

CREATE INDEX idx_signup_leads_status_next_followup ON public.signup_leads USING btree (status, next_followup_at);

CREATE INDEX idx_signup_leads_whatsapp ON public.signup_leads USING btree (whatsapp);

CREATE INDEX idx_site_sections_company_order ON public.site_sections USING btree (company_id, active, sort_order);

CREATE INDEX idx_smart_notification_events_company_id ON public.smart_notification_events USING btree (company_id);

CREATE INDEX idx_smart_notification_events_type ON public.smart_notification_events USING btree (company_id, event_type);

CREATE INDEX idx_subscription_events_company_created ON public.subscription_events USING btree (company_id, created_at DESC);

CREATE INDEX idx_system_audit_logs_company_id ON public.system_audit_logs USING btree (company_id);

CREATE INDEX idx_system_audit_logs_created ON public.system_audit_logs USING btree (company_id, created_at DESC);

CREATE INDEX idx_webhook_admin_status_received ON public.payment_webhook_events USING btree (processing_status, received_at DESC);

CREATE INDEX idx_whatsapp_connections_phone_number_id ON public.whatsapp_connections USING btree (phone_number_id) WHERE (phone_number_id IS NOT NULL);

CREATE INDEX idx_whatsapp_conversations_company_updated ON public.whatsapp_conversations USING btree (company_id, updated_at DESC);

CREATE INDEX idx_whatsapp_logs_company_created ON public.whatsapp_message_logs USING btree (company_id, created_at DESC);

CREATE INDEX idx_whatsapp_logs_order ON public.whatsapp_message_logs USING btree (order_id, created_at DESC);

CREATE INDEX idx_whatsapp_logs_proposal ON public.whatsapp_message_logs USING btree (proposal_id, created_at DESC);

CREATE INDEX idx_whatsapp_message_logs_conversation ON public.whatsapp_message_logs USING btree (conversation_id, created_at) WHERE (conversation_id IS NOT NULL);

CREATE INDEX idx_whatsapp_settings_phone_number ON public.company_whatsapp_settings USING btree (phone_number_id);

CREATE INDEX idx_whatsapp_webhook_events_company_received ON public.whatsapp_webhook_events USING btree (company_id, received_at DESC);

CREATE INDEX marketplace_payment_settings_active_idx ON public.marketplace_payment_settings USING btree (company_id, is_active, provider);

CREATE UNIQUE INDEX marketplace_payment_settings_company_provider_uidx ON public.marketplace_payment_settings USING btree (company_id, provider) WHERE ((company_id IS NOT NULL) AND (provider IS NOT NULL));

CREATE INDEX marketplace_payments_company_created_idx ON public.marketplace_payments USING btree (company_id, created_at DESC);

CREATE UNIQUE INDEX marketplace_payments_company_idempotency_uidx ON public.marketplace_payments USING btree (company_id, idempotency_key) WHERE ((company_id IS NOT NULL) AND (idempotency_key IS NOT NULL));

CREATE INDEX marketplace_payments_order_idx ON public.marketplace_payments USING btree (order_id);

CREATE UNIQUE INDEX marketplace_payments_provider_payment_uidx ON public.marketplace_payments USING btree (provider, provider_payment_id) WHERE ((provider IS NOT NULL) AND (provider_payment_id IS NOT NULL));

CREATE INDEX marketplace_stock_reservations_active_product_idx ON public.marketplace_stock_reservations USING btree (company_id, product_id, expires_at) WHERE (status = 'reserved'::text);

CREATE INDEX marketplace_stock_reservations_expiry_idx ON public.marketplace_stock_reservations USING btree (expires_at) WHERE (status = 'reserved'::text);

CREATE INDEX marketplace_stock_reservations_order_idx ON public.marketplace_stock_reservations USING btree (order_id);

CREATE INDEX marketplace_stock_reservations_payment_idx ON public.marketplace_stock_reservations USING btree (company_id, marketplace_payment_id);

CREATE INDEX marketplace_stock_reservations_product_idx ON public.marketplace_stock_reservations USING btree (product_id);

CREATE UNIQUE INDEX order_payments_company_idempotency_uidx ON public.order_payments USING btree (company_id, idempotency_key) WHERE ((company_id IS NOT NULL) AND (idempotency_key IS NOT NULL));

CREATE UNIQUE INDEX order_payments_provider_payment_uidx ON public.order_payments USING btree (provider, provider_payment_id) WHERE ((provider IS NOT NULL) AND (provider_payment_id IS NOT NULL));

CREATE UNIQUE INDEX orders_checkout_idempotency_uidx ON public.orders USING btree (company_id, checkout_idempotency_key) WHERE ((company_id IS NOT NULL) AND (checkout_idempotency_key IS NOT NULL));

CREATE INDEX orders_customer_profile_id_idx ON public.orders USING btree (customer_profile_id);

CREATE INDEX payment_payouts_company_idx ON public.payment_payouts USING btree (company_id, created_at DESC);

CREATE UNIQUE INDEX payment_payouts_marketplace_payment_id_uidx ON public.payment_payouts USING btree (marketplace_payment_id);

CREATE INDEX payment_payouts_provider_id_idx ON public.payment_payouts USING btree (provider, provider_payout_id);

CREATE INDEX payment_webhook_events_company_idx ON public.payment_webhook_events USING btree (company_id, received_at DESC);

CREATE INDEX payment_webhook_events_object_idx ON public.payment_webhook_events USING btree (provider, provider_object_id);

CREATE INDEX plan_payments_company_created_idx ON public.plan_payments USING btree (company_id, created_at DESC);

CREATE UNIQUE INDEX plan_payments_company_idempotency_uidx ON public.plan_payments USING btree (company_id, idempotency_key) WHERE ((company_id IS NOT NULL) AND (idempotency_key IS NOT NULL));

CREATE INDEX plan_payments_provider_payment_idx ON public.plan_payments USING btree (provider, provider_payment_id) WHERE (provider_payment_id IS NOT NULL);

CREATE UNIQUE INDEX plan_payments_provider_payment_uidx ON public.plan_payments USING btree (provider, provider_payment_id) WHERE ((provider IS NOT NULL) AND (provider_payment_id IS NOT NULL));

CREATE INDEX plan_payments_provider_subscription_idx ON public.plan_payments USING btree (provider, provider_subscription_id) WHERE (provider_subscription_id IS NOT NULL);

CREATE UNIQUE INDEX plan_payments_provider_subscription_uidx ON public.plan_payments USING btree (provider, provider_subscription_id) WHERE ((provider IS NOT NULL) AND (provider_subscription_id IS NOT NULL));

CREATE UNIQUE INDEX platform_admin_invites_activated_admin_uq ON public.platform_admin_invites USING btree (platform_admin_id) WHERE ((status = 'activated'::text) AND (platform_admin_id IS NOT NULL));

CREATE UNIQUE INDEX platform_admin_invites_activated_user_uq ON public.platform_admin_invites USING btree (user_id) WHERE ((status = 'activated'::text) AND (user_id IS NOT NULL));

CREATE INDEX platform_admin_invites_created_by_idx ON public.platform_admin_invites USING btree (created_by_admin_id, created_at DESC);

CREATE UNIQUE INDEX platform_admin_invites_live_email_uq ON public.platform_admin_invites USING btree (email_normalized) WHERE (status = ANY (ARRAY['pending'::text, 'activating'::text]));

CREATE INDEX platform_admin_invites_status_expires_idx ON public.platform_admin_invites USING btree (status, expires_at);

CREATE UNIQUE INDEX platform_admin_invites_token_hash_uq ON public.platform_admin_invites USING btree (token_hash);

CREATE INDEX platform_admins_role_active_idx ON public.platform_admins USING btree (role, is_active, created_at DESC);

CREATE UNIQUE INDEX platform_admins_single_active_owner_uidx ON public.platform_admins USING btree ((1)) WHERE ((is_active = true) AND (lower(role) = 'owner'::text));

CREATE INDEX product_analytics_events_company_time_idx ON public.product_analytics_events USING btree (company_id, occurred_at DESC);

CREATE INDEX product_analytics_events_event_time_idx ON public.product_analytics_events USING btree (event_name, occurred_at DESC);

CREATE INDEX product_stock_movements_order_fk_idx ON public.product_stock_movements USING btree (order_id);

CREATE INDEX product_stock_movements_order_idx ON public.product_stock_movements USING btree (company_id, order_id) WHERE (order_id IS NOT NULL);

CREATE INDEX product_stock_movements_payment_idx ON public.product_stock_movements USING btree (marketplace_payment_id);

CREATE INDEX product_stock_movements_product_created_idx ON public.product_stock_movements USING btree (company_id, product_id, created_at DESC);

CREATE INDEX product_stock_movements_product_idx ON public.product_stock_movements USING btree (product_id);

CREATE INDEX product_stock_movements_reservation_idx ON public.product_stock_movements USING btree (reservation_id);

CREATE INDEX products_company_business_type_idx ON public.products USING btree (company_id, business_type);

CREATE INDEX proposals_customer_profile_id_idx ON public.proposals USING btree (customer_profile_id);

CREATE INDEX provider_customers_provider_id_idx ON public.provider_customers USING btree (provider, provider_customer_id);

CREATE INDEX signup_leads_referral_code_idx ON public.signup_leads USING btree (referral_code);

CREATE UNIQUE INDEX subscription_events_provider_event_uidx ON public.subscription_events USING btree (provider, provider_event_id) WHERE ((provider IS NOT NULL) AND (provider_event_id IS NOT NULL));

CREATE INDEX timeline_events_aggregate_idx ON public.timeline_events USING btree (company_id, aggregate_type, aggregate_id, occurred_at DESC);

CREATE INDEX timeline_events_company_occurred_idx ON public.timeline_events USING btree (company_id, occurred_at DESC);

CREATE INDEX timeline_events_customer_profile_id_idx ON public.timeline_events USING btree (customer_profile_id);

CREATE INDEX transactional_outbox_claim_idx ON public.transactional_outbox USING btree (status, available_at, created_at) WHERE (status = ANY (ARRAY['queued'::text, 'retrying'::text]));

CREATE INDEX transactional_outbox_company_created_idx ON public.transactional_outbox USING btree (company_id, created_at DESC);

CREATE UNIQUE INDEX ux_subscription_events_idempotency ON public.subscription_events USING btree (company_id, event_type, provider_reference);

CREATE UNIQUE INDEX ux_whatsapp_conversations_company_phone ON public.whatsapp_conversations USING btree (company_id, phone) WHERE (company_id IS NOT NULL);

CREATE UNIQUE INDEX ux_whatsapp_message_logs_inbound_meta_id ON public.whatsapp_message_logs USING btree (company_id, meta_message_id) WHERE ((direction = 'inbound'::text) AND (meta_message_id IS NOT NULL));

create view "public"."admin_signup_leads_overview" with (security_invoker=true) as SELECT id,
    nome_responsavel,
    email,
    whatsapp,
    empresa_nome,
    slug_sugerido,
    segmento,
    modelo_negocio,
    cidade,
    estado,
    plano,
    status,
    marketing_opt_in,
    marketing_opt_in_text,
    lead_source,
    checkout_url,
    mercado_pago_preference_id,
    mercado_pago_payment_id,
    payment_status,
    paid_at,
    followup_count,
    last_followup_at,
    next_followup_at,
    converted_user_id,
    converted_company_id,
    raw_data,
    created_at,
    updated_at,
        CASE
            WHEN (status = ANY (ARRAY['checkout_criado'::text, 'lead'::text])) AND next_followup_at <= now() AND marketing_opt_in = true THEN true
            ELSE false
        END AS followup_due,
        CASE
            WHEN status = ANY (ARRAY['checkout_criado'::text, 'lead'::text]) THEN EXTRACT(day FROM now() - created_at)::integer
            ELSE 0
        END AS dias_sem_converter
   FROM signup_leads l
  ORDER BY created_at DESC;

create view "public"."company_members_public" with (security_invoker=true) as SELECT id,
    company_id,
    user_id,
    cargo,
    status,
    created_at,
    email::character varying AS email,
    nome
   FROM company_members cm;

create view "public"."orcaly_company_health" with (security_invoker=true) as SELECT id AS company_id,
    nome,
    slug,
    assinatura_status,
    site_publico_ativo,
    site_template,
    logo_url,
    whatsapp,
    whatsapp_enabled,
    ( SELECT count(*) AS count
           FROM products p
          WHERE p.company_id = c.id AND COALESCE(p.arquivado, false) = false) AS products_count,
    ( SELECT count(*) AS count
           FROM orders o
          WHERE o.company_id = c.id) AS orders_count,
    ( SELECT count(*) AS count
           FROM crm_leads l
          WHERE l.company_id = c.id AND l.status = 'ativo'::text) AS leads_count,
    ( SELECT count(*) AS count
           FROM internal_tasks t
          WHERE t.company_id = c.id AND t.status <> 'concluida'::text) AS open_tasks_count,
    ( SELECT count(*) AS count
           FROM app_notifications n
          WHERE n.company_id = c.id AND n.status = 'unread'::text) AS unread_notifications_count
   FROM companies c;

create view "public"."production_dashboard" with (security_invoker=true) as SELECT po.id,
    po.company_id,
    po.proposal_id,
    po.order_id,
    po.title,
    po.customer_name,
    po.customer_whatsapp,
    po.total_value,
    po.signal_value,
    po.status,
    po.priority,
    po.due_date,
    po.started_at,
    po.completed_at,
    po.created_at,
    count(ps.id) AS total_steps,
    count(ps.id) FILTER (WHERE ps.status = 'concluido'::text) AS completed_steps
   FROM production_orders po
     LEFT JOIN production_steps ps ON ps.production_order_id = po.id
  GROUP BY po.id;

create view "public"."proposals_dashboard" with (security_invoker=true) as SELECT p.id,
    p.company_id,
    p.order_id,
    p.token,
    p.proposta_numero,
    p.titulo,
    p.cliente_nome,
    p.cliente_whatsapp,
    p.valor_total,
    p.valor_sinal,
    p.status,
    p.sent_at,
    p.viewed_at,
    p.approved_at,
    p.rejected_at,
    p.change_requested_at,
    p.valid_until,
    p.created_at,
    o.produto AS pedido_produto,
    o.status AS pedido_status,
    p.production_order_id,
    p.signature_signed_at
   FROM proposals p
     LEFT JOIN orders o ON o.id = p.order_id;

create view "public"."public_company_profiles" with (security_invoker=true) as SELECT id,
    nome,
    slug,
    logo_url,
    whatsapp,
    cor_principal,
    cidade,
    estado,
    segmento,
    modelo_negocio,
    modelo_nome,
    modelo_perguntas,
    ativo,
    subdomain_slug,
    site_template,
    site_status,
    site_primary_color,
    site_accent_color,
    site_config
   FROM orcaly_private.public_companies_data() c(id, nome, slug, logo_url, whatsapp, cor_principal, ativo, segmento, cidade, estado, aceita_pix, cobrar_sinal, percentual_sinal, modelo_negocio, modelo_nome, modelo_perguntas, subdomain_slug, site_template, site_status, site_primary_color, site_accent_color, site_config, atendimento_horario, atendimento_observacao, instagram, marketplace_ativo, marketplace_titulo, marketplace_subtitulo, marketplace_texto_botao, marketplace_endereco, marketplace_mapa_url, site_publico_ativo, site_background_color, site_headline, site_subheadline, site_cta_text, site_banner_url, site_about_title, site_about_text, site_services_title, site_contact_title, site_show_store, site_show_about, site_show_contact, site_show_featured, site_features, site_faq, site_testimonials, site_custom_sections, site_layout, site_art_style, site_font_style, site_button_style, site_hero_alignment, site_text_color, site_card_color, site_badge_text, site_secondary_cta_text, site_whatsapp_message, site_show_faq, site_show_testimonials, site_show_gallery, site_show_benefits, site_gallery, site_benefits, site_seo_title, site_seo_description, site_keywords, site_promo_title, site_promo_text, site_promo_active, site_promo_button_text, site_business_hours, site_payment_methods, site_delivery_options)
  WHERE ativo = true;

create view "public"."public_marketplace_companies" with (security_invoker=true) as SELECT id,
    nome,
    slug,
    subdomain_slug,
    logo_url,
    whatsapp,
    cor_principal,
    modelo_negocio,
    modelo_nome,
    modelo_perguntas,
    atendimento_horario,
    atendimento_observacao,
    instagram,
    aceita_pix,
    cobrar_sinal,
    percentual_sinal,
    site_primary_color,
    site_accent_color,
    ativo
   FROM orcaly_private.public_companies_data() c(id, nome, slug, logo_url, whatsapp, cor_principal, ativo, segmento, cidade, estado, aceita_pix, cobrar_sinal, percentual_sinal, modelo_negocio, modelo_nome, modelo_perguntas, subdomain_slug, site_template, site_status, site_primary_color, site_accent_color, site_config, atendimento_horario, atendimento_observacao, instagram, marketplace_ativo, marketplace_titulo, marketplace_subtitulo, marketplace_texto_botao, marketplace_endereco, marketplace_mapa_url, site_publico_ativo, site_background_color, site_headline, site_subheadline, site_cta_text, site_banner_url, site_about_title, site_about_text, site_services_title, site_contact_title, site_show_store, site_show_about, site_show_contact, site_show_featured, site_features, site_faq, site_testimonials, site_custom_sections, site_layout, site_art_style, site_font_style, site_button_style, site_hero_alignment, site_text_color, site_card_color, site_badge_text, site_secondary_cta_text, site_whatsapp_message, site_show_faq, site_show_testimonials, site_show_gallery, site_show_benefits, site_gallery, site_benefits, site_seo_title, site_seo_description, site_keywords, site_promo_title, site_promo_text, site_promo_active, site_promo_button_text, site_business_hours, site_payment_methods, site_delivery_options)
  WHERE COALESCE(ativo, true) = true;

create view "public"."public_marketplace_products" with (security_invoker=true) as SELECT id,
    company_id,
    nome,
    preco,
    ativo,
    descricao,
    categoria,
    tipo,
    unidade,
    imagem_url,
    image_urls,
    destaque,
    precificacao,
    unidade_label,
    permite_largura,
    permite_altura,
    permite_comprimento,
    permite_quantidade,
    valor_minimo,
    configuracoes,
    prazo_medio,
    created_at
   FROM orcaly_private.public_products_data() p(id, company_id, nome, preco, ativo, descricao, categoria, tipo, unidade, imagem_url, image_urls, destaque, precificacao, unidade_label, permite_largura, permite_altura, permite_comprimento, permite_quantidade, valor_minimo, configuracoes, prazo_medio, created_at, variacoes)
  WHERE COALESCE(ativo, true) = true;

create view "public"."public_site_companies" with (security_invoker=true) as SELECT id,
    nome,
    slug,
    subdomain_slug,
    logo_url,
    whatsapp,
    instagram,
    cidade,
    estado,
    segmento,
    modelo_negocio,
    modelo_nome,
    atendimento_horario,
    atendimento_observacao,
    marketplace_endereco,
    marketplace_mapa_url,
    marketplace_ativo,
    marketplace_titulo,
    marketplace_subtitulo,
    marketplace_texto_botao,
    site_publico_ativo,
    site_template,
    site_layout,
    site_art_style,
    site_font_style,
    site_button_style,
    site_hero_alignment,
    site_primary_color,
    site_accent_color,
    site_background_color,
    site_text_color,
    site_card_color,
    site_badge_text,
    site_headline,
    site_subheadline,
    site_cta_text,
    site_secondary_cta_text,
    site_banner_url,
    site_whatsapp_message,
    site_about_title,
    site_about_text,
    site_services_title,
    site_contact_title,
    site_show_store,
    site_show_about,
    site_show_contact,
    site_show_featured,
    site_show_faq,
    site_show_testimonials,
    site_show_gallery,
    site_show_benefits,
    site_features,
    site_faq,
    site_testimonials,
    site_gallery,
    site_benefits,
    site_custom_sections,
    site_seo_title,
    site_seo_description,
    site_keywords,
    site_promo_title,
    site_promo_text,
    site_promo_active,
    site_promo_button_text,
    site_business_hours,
    site_payment_methods,
    site_delivery_options
   FROM orcaly_private.public_companies_data() c(id, nome, slug, logo_url, whatsapp, cor_principal, ativo, segmento, cidade, estado, aceita_pix, cobrar_sinal, percentual_sinal, modelo_negocio, modelo_nome, modelo_perguntas, subdomain_slug, site_template, site_status, site_primary_color, site_accent_color, site_config, atendimento_horario, atendimento_observacao, instagram, marketplace_ativo, marketplace_titulo, marketplace_subtitulo, marketplace_texto_botao, marketplace_endereco, marketplace_mapa_url, site_publico_ativo, site_background_color, site_headline, site_subheadline, site_cta_text, site_banner_url, site_about_title, site_about_text, site_services_title, site_contact_title, site_show_store, site_show_about, site_show_contact, site_show_featured, site_features, site_faq, site_testimonials, site_custom_sections, site_layout, site_art_style, site_font_style, site_button_style, site_hero_alignment, site_text_color, site_card_color, site_badge_text, site_secondary_cta_text, site_whatsapp_message, site_show_faq, site_show_testimonials, site_show_gallery, site_show_benefits, site_gallery, site_benefits, site_seo_title, site_seo_description, site_keywords, site_promo_title, site_promo_text, site_promo_active, site_promo_button_text, site_business_hours, site_payment_methods, site_delivery_options)
  WHERE COALESCE(site_publico_ativo, true) = true AND COALESCE(ativo, true) = true;

create view "public"."public_site_sections" with (security_invoker=true) as SELECT s.id,
    s.company_id,
    s.type,
    s.title,
    s.subtitle,
    s.content,
    s.image_url,
    s.button_label,
    s.button_url,
    s.sort_order,
    s.config,
    s.updated_at
   FROM orcaly_private.public_site_sections_data() s(id, company_id, type, title, subtitle, content, image_url, button_label, button_url, sort_order, active, config, updated_at)
     JOIN orcaly_private.public_companies_data() c(id, nome, slug, logo_url, whatsapp, cor_principal, ativo, segmento, cidade, estado, aceita_pix, cobrar_sinal, percentual_sinal, modelo_negocio, modelo_nome, modelo_perguntas, subdomain_slug, site_template, site_status, site_primary_color, site_accent_color, site_config, atendimento_horario, atendimento_observacao, instagram, marketplace_ativo, marketplace_titulo, marketplace_subtitulo, marketplace_texto_botao, marketplace_endereco, marketplace_mapa_url, site_publico_ativo, site_background_color, site_headline, site_subheadline, site_cta_text, site_banner_url, site_about_title, site_about_text, site_services_title, site_contact_title, site_show_store, site_show_about, site_show_contact, site_show_featured, site_features, site_faq, site_testimonials, site_custom_sections, site_layout, site_art_style, site_font_style, site_button_style, site_hero_alignment, site_text_color, site_card_color, site_badge_text, site_secondary_cta_text, site_whatsapp_message, site_show_faq, site_show_testimonials, site_show_gallery, site_show_benefits, site_gallery, site_benefits, site_seo_title, site_seo_description, site_keywords, site_promo_title, site_promo_text, site_promo_active, site_promo_button_text, site_business_hours, site_payment_methods, site_delivery_options) ON c.id = s.company_id
  WHERE s.active = true AND c.ativo = true AND COALESCE(c.site_status, 'publicado'::text) = 'publicado'::text;

create view "public"."public_store_products" with (security_invoker=true) as SELECT p.id,
    p.company_id,
    p.nome,
    p.preco,
    p.categoria,
    p.descricao,
    p.imagem_url,
    p.image_urls,
    p.variacoes,
    p.prazo_medio,
    p.destaque,
    p.ativo
   FROM orcaly_private.public_products_data() p(id, company_id, nome, preco, ativo, descricao, categoria, tipo, unidade, imagem_url, image_urls, destaque, precificacao, unidade_label, permite_largura, permite_altura, permite_comprimento, permite_quantidade, valor_minimo, configuracoes, prazo_medio, created_at, variacoes)
     JOIN orcaly_private.public_companies_data() c(id, nome, slug, logo_url, whatsapp, cor_principal, ativo, segmento, cidade, estado, aceita_pix, cobrar_sinal, percentual_sinal, modelo_negocio, modelo_nome, modelo_perguntas, subdomain_slug, site_template, site_status, site_primary_color, site_accent_color, site_config, atendimento_horario, atendimento_observacao, instagram, marketplace_ativo, marketplace_titulo, marketplace_subtitulo, marketplace_texto_botao, marketplace_endereco, marketplace_mapa_url, site_publico_ativo, site_background_color, site_headline, site_subheadline, site_cta_text, site_banner_url, site_about_title, site_about_text, site_services_title, site_contact_title, site_show_store, site_show_about, site_show_contact, site_show_featured, site_features, site_faq, site_testimonials, site_custom_sections, site_layout, site_art_style, site_font_style, site_button_style, site_hero_alignment, site_text_color, site_card_color, site_badge_text, site_secondary_cta_text, site_whatsapp_message, site_show_faq, site_show_testimonials, site_show_gallery, site_show_benefits, site_gallery, site_benefits, site_seo_title, site_seo_description, site_keywords, site_promo_title, site_promo_text, site_promo_active, site_promo_button_text, site_business_hours, site_payment_methods, site_delivery_options) ON c.id = p.company_id
  WHERE p.ativo = true AND c.ativo = true;

alter table "public"."admin_audit_logs" enable row level security;

alter table "public"."admin_bug_reports" enable row level security;

alter table "public"."admin_scan_runs" enable row level security;

alter table "public"."admin_system_snapshots" enable row level security;

alter table "public"."admin_users" enable row level security;

alter table "public"."affiliate_achievements" enable row level security;

alter table "public"."affiliate_activity_events" enable row level security;

alter table "public"."affiliate_announcements" enable row level security;

alter table "public"."affiliate_audit_logs" enable row level security;

alter table "public"."affiliate_certifications" enable row level security;

alter table "public"."affiliate_clicks" enable row level security;

alter table "public"."affiliate_commissions" enable row level security;

alter table "public"."affiliate_course_progress" enable row level security;

alter table "public"."affiliate_goals" enable row level security;

alter table "public"."affiliate_leads" enable row level security;

alter table "public"."affiliate_payout_items" enable row level security;

alter table "public"."affiliate_payouts" enable row level security;

alter table "public"."affiliate_profiles" enable row level security;

alter table "public"."affiliate_program_settings" enable row level security;

alter table "public"."affiliate_referrals" enable row level security;

alter table "public"."affiliate_tasks" enable row level security;

alter table "public"."affiliate_training_sessions" enable row level security;

alter table "public"."app_notifications" enable row level security;

alter table "public"."application_error_events" enable row level security;

alter table "public"."art_approval_requests" enable row level security;

alter table "public"."assistant_events" enable row level security;

alter table "public"."automation_rules" enable row level security;

alter table "public"."automation_runs" enable row level security;

alter table "public"."background_jobs" enable row level security;

alter table "public"."business_hours" enable row level security;

alter table "public"."companies" enable row level security;

alter table "public"."company_health_snapshots" enable row level security;

alter table "public"."company_members" enable row level security;

alter table "public"."company_niche_templates" enable row level security;

alter table "public"."company_proposal_settings" enable row level security;

alter table "public"."company_whatsapp_settings" enable row level security;

alter table "public"."crm_leads" enable row level security;

alter table "public"."customer_duplicate_candidates" enable row level security;

alter table "public"."customer_followups" enable row level security;

alter table "public"."customer_internal_notes" enable row level security;

alter table "public"."customer_magic_links" enable row level security;

alter table "public"."customer_notes" enable row level security;

alter table "public"."customer_portal_events" enable row level security;

alter table "public"."customer_profiles" enable row level security;

alter table "public"."data_quality_issues" enable row level security;

alter table "public"."deliveries" enable row level security;

alter table "public"."delivery_assignments" enable row level security;

alter table "public"."delivery_drivers" enable row level security;

alter table "public"."delivery_zones" enable row level security;

alter table "public"."demo_data_registry" enable row level security;

alter table "public"."event_idempotency" enable row level security;

alter table "public"."finance_accounts" enable row level security;

alter table "public"."financial_categories" enable row level security;

alter table "public"."financial_material_entries" enable row level security;

alter table "public"."financial_transactions" enable row level security;

alter table "public"."founder_invites" enable row level security;

alter table "public"."integration_connections" enable row level security;

alter table "public"."integration_mappings" enable row level security;

alter table "public"."integration_oauth_states" enable row level security;

alter table "public"."integration_push_channels" enable row level security;

alter table "public"."integration_sync_cursors" enable row level security;

alter table "public"."integration_usage_daily" enable row level security;

alter table "public"."internal_tasks" enable row level security;

alter table "public"."marketplace_commission_rules" enable row level security;

alter table "public"."marketplace_commissions" enable row level security;

alter table "public"."marketplace_coupons" enable row level security;

alter table "public"."marketplace_oauth_states" enable row level security;

alter table "public"."marketplace_payment_settings" enable row level security;

alter table "public"."marketplace_payments" enable row level security;

alter table "public"."marketplace_stock_reservations" enable row level security;

alter table "public"."notifications" enable row level security;

alter table "public"."order_internal_comments" enable row level security;

alter table "public"."order_items" enable row level security;

alter table "public"."order_payments" enable row level security;

alter table "public"."order_status_history" enable row level security;

alter table "public"."orders" enable row level security;

alter table "public"."payment_methods" enable row level security;

alter table "public"."payment_payouts" enable row level security;

alter table "public"."payment_webhook_events" enable row level security;

alter table "public"."plan_payments" enable row level security;

alter table "public"."platform_admin_invites" enable row level security;

alter table "public"."platform_admins" enable row level security;

alter table "public"."platform_feature_flags" enable row level security;

alter table "public"."platform_support_ticket_events" enable row level security;

alter table "public"."platform_support_tickets" enable row level security;

alter table "public"."product_analytics_events" enable row level security;

alter table "public"."product_stock_movements" enable row level security;

alter table "public"."production_orders" enable row level security;

alter table "public"."production_steps" enable row level security;

alter table "public"."products" enable row level security;

alter table "public"."proposal_events" enable row level security;

alter table "public"."proposals" enable row level security;

alter table "public"."provider_customers" enable row level security;

alter table "public"."quote_templates" enable row level security;

alter table "public"."recurring_orders" enable row level security;

alter table "public"."security_blocklist" enable row level security;

alter table "public"."security_events" enable row level security;

alter table "public"."signup_lead_followups" enable row level security;

alter table "public"."signup_leads" enable row level security;

alter table "public"."site_sections" enable row level security;

alter table "public"."site_template_presets" enable row level security;

alter table "public"."smart_notification_events" enable row level security;

alter table "public"."smart_notification_settings" enable row level security;

alter table "public"."subscription_events" enable row level security;

alter table "public"."system_audit_logs" enable row level security;

alter table "public"."timeline_events" enable row level security;

alter table "public"."transactional_outbox" enable row level security;

alter table "public"."whatsapp_connections" enable row level security;

alter table "public"."whatsapp_conversations" enable row level security;

alter table "public"."whatsapp_message_logs" enable row level security;

alter table "public"."whatsapp_webhook_events" enable row level security;

create policy "Admin vê auditoria" on "public"."admin_audit_logs" as PERMISSIVE for SELECT to "authenticated" using ((EXISTS ( SELECT 1
   FROM admin_users au
  WHERE ((au.ativo = true) AND (lower(au.email) = lower((auth.jwt() ->> 'email'::text)))))));

create policy "Admins inserem audit logs" on "public"."admin_audit_logs" as PERMISSIVE for INSERT to "authenticated" with check ((EXISTS ( SELECT 1
   FROM admin_users au
  WHERE ((au.ativo = true) AND (lower(au.email) = lower((auth.jwt() ->> 'email'::text)))))));

create policy "Admins inserem logs administrativos" on "public"."admin_audit_logs" as PERMISSIVE for INSERT to "authenticated" with check ((EXISTS ( SELECT 1
   FROM admin_users au
  WHERE ((au.ativo = true) AND (lower(au.email) = lower((auth.jwt() ->> 'email'::text)))))));

create policy "Admins veem audit logs" on "public"."admin_audit_logs" as PERMISSIVE for SELECT to "authenticated" using ((EXISTS ( SELECT 1
   FROM admin_users au
  WHERE ((au.ativo = true) AND (lower(au.email) = lower((auth.jwt() ->> 'email'::text)))))));

create policy "Admins veem logs administrativos" on "public"."admin_audit_logs" as PERMISSIVE for SELECT to "authenticated" using ((EXISTS ( SELECT 1
   FROM admin_users au
  WHERE ((au.ativo = true) AND (lower(au.email) = lower((auth.jwt() ->> 'email'::text)))))));

create policy "Admin vê bugs" on "public"."admin_bug_reports" as PERMISSIVE for SELECT to "authenticated" using ((EXISTS ( SELECT 1
   FROM admin_users au
  WHERE ((au.ativo = true) AND (lower(au.email) = lower((auth.jwt() ->> 'email'::text)))))));

create policy "Admins gerenciam bugs" on "public"."admin_bug_reports" as PERMISSIVE for ALL to "authenticated" using ((EXISTS ( SELECT 1
   FROM admin_users au
  WHERE ((au.ativo = true) AND (lower(au.email) = lower((auth.jwt() ->> 'email'::text))))))) with check ((EXISTS ( SELECT 1
   FROM admin_users au
  WHERE ((au.ativo = true) AND (lower(au.email) = lower((auth.jwt() ->> 'email'::text)))))));

create policy "Admins veem bugs" on "public"."admin_bug_reports" as PERMISSIVE for SELECT to "authenticated" using ((EXISTS ( SELECT 1
   FROM admin_users au
  WHERE ((au.ativo = true) AND (lower(au.email) = lower((auth.jwt() ->> 'email'::text)))))));

create policy "Admins gerenciam scans" on "public"."admin_scan_runs" as PERMISSIVE for ALL to "authenticated" using ((EXISTS ( SELECT 1
   FROM admin_users au
  WHERE ((au.ativo = true) AND (lower(au.email) = lower((auth.jwt() ->> 'email'::text))))))) with check ((EXISTS ( SELECT 1
   FROM admin_users au
  WHERE ((au.ativo = true) AND (lower(au.email) = lower((auth.jwt() ->> 'email'::text)))))));

create policy "Admins veem scans" on "public"."admin_scan_runs" as PERMISSIVE for SELECT to "authenticated" using ((EXISTS ( SELECT 1
   FROM admin_users au
  WHERE ((au.ativo = true) AND (lower(au.email) = lower((auth.jwt() ->> 'email'::text)))))));

create policy "Admin vê snapshots" on "public"."admin_system_snapshots" as PERMISSIVE for SELECT to "authenticated" using ((EXISTS ( SELECT 1
   FROM admin_users au
  WHERE ((au.ativo = true) AND (lower(au.email) = lower((auth.jwt() ->> 'email'::text)))))));

create policy "Admin vê próprio cadastro admin" on "public"."admin_users" as PERMISSIVE for SELECT to "authenticated" using (((ativo = true) AND (lower(email) = lower((auth.jwt() ->> 'email'::text)))));

create policy "Admins veem admin users" on "public"."admin_users" as PERMISSIVE for SELECT to "authenticated" using (orcaly_private.is_orcaly_admin());

create policy "Super admin gerencia admin users" on "public"."admin_users" as PERMISSIVE for ALL to "authenticated" using (orcaly_private.is_orcaly_super_admin()) with check (orcaly_private.is_orcaly_super_admin());

create policy "affiliate_achievements_delete_own" on "public"."affiliate_achievements" as PERMISSIVE for DELETE to "authenticated" using ((EXISTS ( SELECT 1
   FROM affiliate_profiles p
  WHERE ((p.id = affiliate_achievements.affiliate_id) AND (p.user_id = ( SELECT auth.uid() AS uid))))));

create policy "affiliate_achievements_insert_own" on "public"."affiliate_achievements" as PERMISSIVE for INSERT to "authenticated" with check ((EXISTS ( SELECT 1
   FROM affiliate_profiles p
  WHERE ((p.id = affiliate_achievements.affiliate_id) AND (p.user_id = ( SELECT auth.uid() AS uid))))));

create policy "affiliate_achievements_select_own" on "public"."affiliate_achievements" as PERMISSIVE for SELECT to "authenticated" using ((EXISTS ( SELECT 1
   FROM affiliate_profiles p
  WHERE ((p.id = affiliate_achievements.affiliate_id) AND (p.user_id = ( SELECT auth.uid() AS uid))))));

create policy "affiliate_achievements_update_own" on "public"."affiliate_achievements" as PERMISSIVE for UPDATE to "authenticated" using ((EXISTS ( SELECT 1
   FROM affiliate_profiles p
  WHERE ((p.id = affiliate_achievements.affiliate_id) AND (p.user_id = ( SELECT auth.uid() AS uid)))))) with check ((EXISTS ( SELECT 1
   FROM affiliate_profiles p
  WHERE ((p.id = affiliate_achievements.affiliate_id) AND (p.user_id = ( SELECT auth.uid() AS uid))))));

create policy "affiliate_events_delete_own" on "public"."affiliate_activity_events" as PERMISSIVE for DELETE to "authenticated" using ((EXISTS ( SELECT 1
   FROM affiliate_profiles p
  WHERE ((p.id = affiliate_activity_events.affiliate_id) AND (p.user_id = ( SELECT auth.uid() AS uid))))));

create policy "affiliate_events_insert_own" on "public"."affiliate_activity_events" as PERMISSIVE for INSERT to "authenticated" with check ((EXISTS ( SELECT 1
   FROM affiliate_profiles p
  WHERE ((p.id = affiliate_activity_events.affiliate_id) AND (p.user_id = ( SELECT auth.uid() AS uid))))));

create policy "affiliate_events_select_own" on "public"."affiliate_activity_events" as PERMISSIVE for SELECT to "authenticated" using ((EXISTS ( SELECT 1
   FROM affiliate_profiles p
  WHERE ((p.id = affiliate_activity_events.affiliate_id) AND (p.user_id = ( SELECT auth.uid() AS uid))))));

create policy "affiliate_events_update_own" on "public"."affiliate_activity_events" as PERMISSIVE for UPDATE to "authenticated" using ((EXISTS ( SELECT 1
   FROM affiliate_profiles p
  WHERE ((p.id = affiliate_activity_events.affiliate_id) AND (p.user_id = ( SELECT auth.uid() AS uid)))))) with check ((EXISTS ( SELECT 1
   FROM affiliate_profiles p
  WHERE ((p.id = affiliate_activity_events.affiliate_id) AND (p.user_id = ( SELECT auth.uid() AS uid))))));

create policy "affiliate_announcements_read" on "public"."affiliate_announcements" as PERMISSIVE for SELECT to "authenticated" using (((is_active = true) AND (published_at <= now())));

create policy "affiliate_audit_logs_deny_client" on "public"."affiliate_audit_logs" as PERMISSIVE for ALL to "authenticated" using (false) with check (false);

create policy "affiliate_cert_delete_own" on "public"."affiliate_certifications" as PERMISSIVE for DELETE to "authenticated" using ((EXISTS ( SELECT 1
   FROM affiliate_profiles p
  WHERE ((p.id = affiliate_certifications.affiliate_id) AND (p.user_id = ( SELECT auth.uid() AS uid))))));

create policy "affiliate_cert_insert_own" on "public"."affiliate_certifications" as PERMISSIVE for INSERT to "authenticated" with check ((EXISTS ( SELECT 1
   FROM affiliate_profiles p
  WHERE ((p.id = affiliate_certifications.affiliate_id) AND (p.user_id = ( SELECT auth.uid() AS uid))))));

create policy "affiliate_cert_select_own" on "public"."affiliate_certifications" as PERMISSIVE for SELECT to "authenticated" using ((EXISTS ( SELECT 1
   FROM affiliate_profiles p
  WHERE ((p.id = affiliate_certifications.affiliate_id) AND (p.user_id = ( SELECT auth.uid() AS uid))))));

create policy "affiliate_cert_update_own" on "public"."affiliate_certifications" as PERMISSIVE for UPDATE to "authenticated" using ((EXISTS ( SELECT 1
   FROM affiliate_profiles p
  WHERE ((p.id = affiliate_certifications.affiliate_id) AND (p.user_id = ( SELECT auth.uid() AS uid)))))) with check ((EXISTS ( SELECT 1
   FROM affiliate_profiles p
  WHERE ((p.id = affiliate_certifications.affiliate_id) AND (p.user_id = ( SELECT auth.uid() AS uid))))));

create policy "affiliate_clicks_deny_client" on "public"."affiliate_clicks" as PERMISSIVE for ALL to "authenticated" using (false) with check (false);

create policy "affiliate_commissions_select_own" on "public"."affiliate_commissions" as PERMISSIVE for SELECT to "authenticated" using ((EXISTS ( SELECT 1
   FROM affiliate_profiles p
  WHERE ((p.id = affiliate_commissions.affiliate_id) AND (p.user_id = ( SELECT auth.uid() AS uid))))));

create policy "affiliate_course_delete_own" on "public"."affiliate_course_progress" as PERMISSIVE for DELETE to "authenticated" using ((EXISTS ( SELECT 1
   FROM affiliate_profiles p
  WHERE ((p.id = affiliate_course_progress.affiliate_id) AND (p.user_id = ( SELECT auth.uid() AS uid))))));

create policy "affiliate_course_insert_own" on "public"."affiliate_course_progress" as PERMISSIVE for INSERT to "authenticated" with check ((EXISTS ( SELECT 1
   FROM affiliate_profiles p
  WHERE ((p.id = affiliate_course_progress.affiliate_id) AND (p.user_id = ( SELECT auth.uid() AS uid))))));

create policy "affiliate_course_select_own" on "public"."affiliate_course_progress" as PERMISSIVE for SELECT to "authenticated" using ((EXISTS ( SELECT 1
   FROM affiliate_profiles p
  WHERE ((p.id = affiliate_course_progress.affiliate_id) AND (p.user_id = ( SELECT auth.uid() AS uid))))));

create policy "affiliate_course_update_own" on "public"."affiliate_course_progress" as PERMISSIVE for UPDATE to "authenticated" using ((EXISTS ( SELECT 1
   FROM affiliate_profiles p
  WHERE ((p.id = affiliate_course_progress.affiliate_id) AND (p.user_id = ( SELECT auth.uid() AS uid)))))) with check ((EXISTS ( SELECT 1
   FROM affiliate_profiles p
  WHERE ((p.id = affiliate_course_progress.affiliate_id) AND (p.user_id = ( SELECT auth.uid() AS uid))))));

create policy "affiliate_goals_delete_own" on "public"."affiliate_goals" as PERMISSIVE for DELETE to "authenticated" using ((EXISTS ( SELECT 1
   FROM affiliate_profiles p
  WHERE ((p.id = affiliate_goals.affiliate_id) AND (p.user_id = ( SELECT auth.uid() AS uid))))));

create policy "affiliate_goals_insert_own" on "public"."affiliate_goals" as PERMISSIVE for INSERT to "authenticated" with check ((EXISTS ( SELECT 1
   FROM affiliate_profiles p
  WHERE ((p.id = affiliate_goals.affiliate_id) AND (p.user_id = ( SELECT auth.uid() AS uid))))));

create policy "affiliate_goals_select_own" on "public"."affiliate_goals" as PERMISSIVE for SELECT to "authenticated" using ((EXISTS ( SELECT 1
   FROM affiliate_profiles p
  WHERE ((p.id = affiliate_goals.affiliate_id) AND (p.user_id = ( SELECT auth.uid() AS uid))))));

create policy "affiliate_goals_update_own" on "public"."affiliate_goals" as PERMISSIVE for UPDATE to "authenticated" using ((EXISTS ( SELECT 1
   FROM affiliate_profiles p
  WHERE ((p.id = affiliate_goals.affiliate_id) AND (p.user_id = ( SELECT auth.uid() AS uid)))))) with check ((EXISTS ( SELECT 1
   FROM affiliate_profiles p
  WHERE ((p.id = affiliate_goals.affiliate_id) AND (p.user_id = ( SELECT auth.uid() AS uid))))));

create policy "affiliate_leads_delete_own" on "public"."affiliate_leads" as PERMISSIVE for DELETE to "authenticated" using ((EXISTS ( SELECT 1
   FROM affiliate_profiles p
  WHERE ((p.id = affiliate_leads.affiliate_id) AND (p.user_id = ( SELECT auth.uid() AS uid))))));

create policy "affiliate_leads_insert_own" on "public"."affiliate_leads" as PERMISSIVE for INSERT to "authenticated" with check ((EXISTS ( SELECT 1
   FROM affiliate_profiles p
  WHERE ((p.id = affiliate_leads.affiliate_id) AND (p.user_id = ( SELECT auth.uid() AS uid))))));

create policy "affiliate_leads_select_own" on "public"."affiliate_leads" as PERMISSIVE for SELECT to "authenticated" using ((EXISTS ( SELECT 1
   FROM affiliate_profiles p
  WHERE ((p.id = affiliate_leads.affiliate_id) AND (p.user_id = ( SELECT auth.uid() AS uid))))));

create policy "affiliate_leads_update_own" on "public"."affiliate_leads" as PERMISSIVE for UPDATE to "authenticated" using ((EXISTS ( SELECT 1
   FROM affiliate_profiles p
  WHERE ((p.id = affiliate_leads.affiliate_id) AND (p.user_id = ( SELECT auth.uid() AS uid)))))) with check ((EXISTS ( SELECT 1
   FROM affiliate_profiles p
  WHERE ((p.id = affiliate_leads.affiliate_id) AND (p.user_id = ( SELECT auth.uid() AS uid))))));

create policy "affiliate_payout_items_deny_client" on "public"."affiliate_payout_items" as PERMISSIVE for ALL to "authenticated" using (false) with check (false);

create policy "affiliate_payouts_select_own" on "public"."affiliate_payouts" as PERMISSIVE for SELECT to "authenticated" using ((EXISTS ( SELECT 1
   FROM affiliate_profiles p
  WHERE ((p.id = affiliate_payouts.affiliate_id) AND (p.user_id = ( SELECT auth.uid() AS uid))))));

create policy "affiliate_profiles_select_own" on "public"."affiliate_profiles" as PERMISSIVE for SELECT to "authenticated" using ((( SELECT auth.uid() AS uid) = user_id));

create policy "affiliate_settings_deny_client" on "public"."affiliate_program_settings" as PERMISSIVE for ALL to "authenticated" using (false) with check (false);

create policy "affiliate_referrals_select_own" on "public"."affiliate_referrals" as PERMISSIVE for SELECT to "authenticated" using ((EXISTS ( SELECT 1
   FROM affiliate_profiles p
  WHERE ((p.id = affiliate_referrals.affiliate_id) AND (p.user_id = ( SELECT auth.uid() AS uid))))));

create policy "affiliate_tasks_delete_own" on "public"."affiliate_tasks" as PERMISSIVE for DELETE to "authenticated" using ((EXISTS ( SELECT 1
   FROM affiliate_profiles p
  WHERE ((p.id = affiliate_tasks.affiliate_id) AND (p.user_id = ( SELECT auth.uid() AS uid))))));

create policy "affiliate_tasks_insert_own" on "public"."affiliate_tasks" as PERMISSIVE for INSERT to "authenticated" with check ((EXISTS ( SELECT 1
   FROM affiliate_profiles p
  WHERE ((p.id = affiliate_tasks.affiliate_id) AND (p.user_id = ( SELECT auth.uid() AS uid))))));

create policy "affiliate_tasks_select_own" on "public"."affiliate_tasks" as PERMISSIVE for SELECT to "authenticated" using ((EXISTS ( SELECT 1
   FROM affiliate_profiles p
  WHERE ((p.id = affiliate_tasks.affiliate_id) AND (p.user_id = ( SELECT auth.uid() AS uid))))));

create policy "affiliate_tasks_update_own" on "public"."affiliate_tasks" as PERMISSIVE for UPDATE to "authenticated" using ((EXISTS ( SELECT 1
   FROM affiliate_profiles p
  WHERE ((p.id = affiliate_tasks.affiliate_id) AND (p.user_id = ( SELECT auth.uid() AS uid)))))) with check ((EXISTS ( SELECT 1
   FROM affiliate_profiles p
  WHERE ((p.id = affiliate_tasks.affiliate_id) AND (p.user_id = ( SELECT auth.uid() AS uid))))));

create policy "affiliate_training_delete_own" on "public"."affiliate_training_sessions" as PERMISSIVE for DELETE to "authenticated" using ((EXISTS ( SELECT 1
   FROM affiliate_profiles p
  WHERE ((p.id = affiliate_training_sessions.affiliate_id) AND (p.user_id = ( SELECT auth.uid() AS uid))))));

create policy "affiliate_training_insert_own" on "public"."affiliate_training_sessions" as PERMISSIVE for INSERT to "authenticated" with check ((EXISTS ( SELECT 1
   FROM affiliate_profiles p
  WHERE ((p.id = affiliate_training_sessions.affiliate_id) AND (p.user_id = ( SELECT auth.uid() AS uid))))));

create policy "affiliate_training_select_own" on "public"."affiliate_training_sessions" as PERMISSIVE for SELECT to "authenticated" using ((EXISTS ( SELECT 1
   FROM affiliate_profiles p
  WHERE ((p.id = affiliate_training_sessions.affiliate_id) AND (p.user_id = ( SELECT auth.uid() AS uid))))));

create policy "affiliate_training_update_own" on "public"."affiliate_training_sessions" as PERMISSIVE for UPDATE to "authenticated" using ((EXISTS ( SELECT 1
   FROM affiliate_profiles p
  WHERE ((p.id = affiliate_training_sessions.affiliate_id) AND (p.user_id = ( SELECT auth.uid() AS uid)))))) with check ((EXISTS ( SELECT 1
   FROM affiliate_profiles p
  WHERE ((p.id = affiliate_training_sessions.affiliate_id) AND (p.user_id = ( SELECT auth.uid() AS uid))))));

create policy "Empresa gerencia aprovacoes de arte" on "public"."art_approval_requests" as PERMISSIVE for ALL to "authenticated" using (((EXISTS ( SELECT 1
   FROM companies c
  WHERE ((c.id = art_approval_requests.company_id) AND ((c.owner_id = auth.uid()) OR (c.tester_id = auth.uid()))))) OR (EXISTS ( SELECT 1
   FROM company_members cm
  WHERE ((cm.company_id = art_approval_requests.company_id) AND (cm.user_id = auth.uid()) AND (cm.status = 'ativo'::text) AND (cm.cargo = ANY (ARRAY['gerente'::text, 'producao'::text]))))) OR (EXISTS ( SELECT 1
   FROM admin_users au
  WHERE ((au.ativo = true) AND (lower(au.email) = lower((auth.jwt() ->> 'email'::text)))))))) with check (((EXISTS ( SELECT 1
   FROM companies c
  WHERE ((c.id = art_approval_requests.company_id) AND ((c.owner_id = auth.uid()) OR (c.tester_id = auth.uid()))))) OR (EXISTS ( SELECT 1
   FROM company_members cm
  WHERE ((cm.company_id = art_approval_requests.company_id) AND (cm.user_id = auth.uid()) AND (cm.status = 'ativo'::text) AND (cm.cargo = ANY (ARRAY['gerente'::text, 'producao'::text]))))) OR (EXISTS ( SELECT 1
   FROM admin_users au
  WHERE ((au.ativo = true) AND (lower(au.email) = lower((auth.jwt() ->> 'email'::text))))))));

create policy "Empresa ve aprovacoes de arte" on "public"."art_approval_requests" as PERMISSIVE for SELECT to "authenticated" using (((EXISTS ( SELECT 1
   FROM companies c
  WHERE ((c.id = art_approval_requests.company_id) AND ((c.owner_id = auth.uid()) OR (c.tester_id = auth.uid()))))) OR (EXISTS ( SELECT 1
   FROM company_members cm
  WHERE ((cm.company_id = art_approval_requests.company_id) AND (cm.user_id = auth.uid()) AND (cm.status = 'ativo'::text)))) OR (EXISTS ( SELECT 1
   FROM admin_users au
  WHERE ((au.ativo = true) AND (lower(au.email) = lower((auth.jwt() ->> 'email'::text))))))));

create policy "business_hours_company_access" on "public"."business_hours" as PERMISSIVE for ALL to PUBLIC using ((EXISTS ( SELECT 1
   FROM companies c
  WHERE ((c.id = business_hours.company_id) AND ((c.owner_id = auth.uid()) OR (c.tester_id = auth.uid()) OR (EXISTS ( SELECT 1
           FROM company_members m
          WHERE ((m.company_id = c.id) AND (m.user_id = auth.uid()) AND (m.status = 'ativo'::text))))))))) with check ((EXISTS ( SELECT 1
   FROM companies c
  WHERE ((c.id = business_hours.company_id) AND ((c.owner_id = auth.uid()) OR (c.tester_id = auth.uid()) OR (EXISTS ( SELECT 1
           FROM company_members m
          WHERE ((m.company_id = c.id) AND (m.user_id = auth.uid()) AND (m.status = 'ativo'::text)))))))));

create policy "Dono e gerente editam empresa" on "public"."companies" as PERMISSIVE for UPDATE to "authenticated" using (orcaly_private.can_manage_company(id)) with check (orcaly_private.can_manage_company(id));

create policy "Dono ou tester atualiza empresa" on "public"."companies" as PERMISSIVE for UPDATE to "authenticated" using (((owner_id = auth.uid()) OR (tester_id = auth.uid()))) with check (((owner_id = auth.uid()) OR (tester_id = auth.uid())));

create policy "Dono ou tester vê empresa" on "public"."companies" as PERMISSIVE for SELECT to "authenticated" using (((owner_id = auth.uid()) OR (tester_id = auth.uid())));

create policy "Funcionario ve empresa vinculada" on "public"."companies" as PERMISSIVE for SELECT to "authenticated" using (orcaly_private.is_company_member(id));

create policy "Funcionarios acessam empresa" on "public"."companies" as PERMISSIVE for SELECT to "authenticated" using (orcaly_private.can_manage_company(id));

create policy "Usuário cria própria empresa" on "public"."companies" as PERMISSIVE for INSERT to "authenticated" with check (((owner_id = auth.uid()) AND (lower(slug) <> ALL (ARRAY['admin'::text, 'administrador'::text, 'orcaly'::text, 'suporte'::text, 'support'::text, 'api'::text, 'painel'::text, 'dashboard'::text, 'login'::text, 'cadastro'::text, 'checkout'::text, 'assinatura'::text, 'proposta'::text, 'propostas'::text, 'root'::text, 'system'::text, 'sistema'::text, 'mercado-pago'::text, 'mercadopago'::text, 'www'::text, 'app'::text, 'assets'::text, 'static'::text, 'public'::text, 'private'::text, 'config'::text, 'settings'::text, 'security'::text, 'auth'::text, 'null'::text, 'undefined'::text]))));

create policy "Dono gerencia funcionarios" on "public"."company_members" as PERMISSIVE for ALL to "authenticated" using (orcaly_private.is_company_owner(company_id)) with check (orcaly_private.is_company_owner(company_id));

create policy "Dono gerencia membros" on "public"."company_members" as PERMISSIVE for ALL to "authenticated" using ((orcaly_private.is_company_owner(company_id) OR orcaly_private.is_orcaly_admin())) with check ((orcaly_private.is_company_owner(company_id) OR orcaly_private.is_orcaly_admin()));

create policy "Dono gerente e admin veem membros" on "public"."company_members" as PERMISSIVE for SELECT to "authenticated" using ((orcaly_private.is_company_owner(company_id) OR orcaly_private.is_company_member(company_id) OR orcaly_private.is_orcaly_admin()));

create policy "Funcionario ve proprio cadastro" on "public"."company_members" as PERMISSIVE for SELECT to "authenticated" using (((user_id = auth.uid()) AND (status = 'ativo'::text)));

create policy "Empresa gerencia modelos por nicho" on "public"."company_niche_templates" as PERMISSIVE for ALL to "authenticated" using (((EXISTS ( SELECT 1
   FROM companies c
  WHERE ((c.id = company_niche_templates.company_id) AND ((c.owner_id = auth.uid()) OR (c.tester_id = auth.uid()))))) OR (EXISTS ( SELECT 1
   FROM company_members cm
  WHERE ((cm.company_id = company_niche_templates.company_id) AND (cm.user_id = auth.uid()) AND (cm.status = 'ativo'::text) AND (cm.cargo = 'gerente'::text)))))) with check (((EXISTS ( SELECT 1
   FROM companies c
  WHERE ((c.id = company_niche_templates.company_id) AND ((c.owner_id = auth.uid()) OR (c.tester_id = auth.uid()))))) OR (EXISTS ( SELECT 1
   FROM company_members cm
  WHERE ((cm.company_id = company_niche_templates.company_id) AND (cm.user_id = auth.uid()) AND (cm.status = 'ativo'::text) AND (cm.cargo = 'gerente'::text))))));

create policy "Empresa gerencia config propostas" on "public"."company_proposal_settings" as PERMISSIVE for ALL to "authenticated" using (orcaly_private.can_manage_company(company_id)) with check (orcaly_private.can_manage_company(company_id));

create policy "Empresa gerencia whatsapp settings" on "public"."company_whatsapp_settings" as PERMISSIVE for ALL to "authenticated" using (((EXISTS ( SELECT 1
   FROM companies c
  WHERE ((c.id = company_whatsapp_settings.company_id) AND ((c.owner_id = auth.uid()) OR (c.tester_id = auth.uid()))))) OR (EXISTS ( SELECT 1
   FROM company_members cm
  WHERE ((cm.company_id = company_whatsapp_settings.company_id) AND (cm.user_id = auth.uid()) AND (cm.status = 'ativo'::text) AND (cm.cargo = 'gerente'::text)))) OR (EXISTS ( SELECT 1
   FROM admin_users au
  WHERE ((au.ativo = true) AND (lower(au.email) = lower((auth.jwt() ->> 'email'::text)))))))) with check (((EXISTS ( SELECT 1
   FROM companies c
  WHERE ((c.id = company_whatsapp_settings.company_id) AND ((c.owner_id = auth.uid()) OR (c.tester_id = auth.uid()))))) OR (EXISTS ( SELECT 1
   FROM company_members cm
  WHERE ((cm.company_id = company_whatsapp_settings.company_id) AND (cm.user_id = auth.uid()) AND (cm.status = 'ativo'::text) AND (cm.cargo = 'gerente'::text)))) OR (EXISTS ( SELECT 1
   FROM admin_users au
  WHERE ((au.ativo = true) AND (lower(au.email) = lower((auth.jwt() ->> 'email'::text))))))));

create policy "Equipe gerencia followups de clientes" on "public"."customer_followups" as PERMISSIVE for ALL to "authenticated" using ((orcaly_private.is_company_owner(company_id) OR orcaly_private.is_company_member(company_id))) with check ((orcaly_private.is_company_owner(company_id) OR orcaly_private.is_company_member(company_id)));

create policy "Empresa ve notas internas de clientes" on "public"."customer_internal_notes" as PERMISSIVE for SELECT to "authenticated" using (((EXISTS ( SELECT 1
   FROM companies c
  WHERE ((c.id = customer_internal_notes.company_id) AND ((c.owner_id = auth.uid()) OR (c.tester_id = auth.uid()))))) OR (EXISTS ( SELECT 1
   FROM company_members cm
  WHERE ((cm.company_id = customer_internal_notes.company_id) AND (cm.user_id = auth.uid()) AND (cm.status = 'ativo'::text))))));

create policy "Empresa gerencia links cliente" on "public"."customer_magic_links" as PERMISSIVE for ALL to "authenticated" using (((EXISTS ( SELECT 1
   FROM companies c
  WHERE ((c.id = customer_magic_links.company_id) AND ((c.owner_id = auth.uid()) OR (c.tester_id = auth.uid()))))) OR (EXISTS ( SELECT 1
   FROM company_members cm
  WHERE ((cm.company_id = customer_magic_links.company_id) AND (cm.user_id = auth.uid()) AND (cm.status = 'ativo'::text)))))) with check (((EXISTS ( SELECT 1
   FROM companies c
  WHERE ((c.id = customer_magic_links.company_id) AND ((c.owner_id = auth.uid()) OR (c.tester_id = auth.uid()))))) OR (EXISTS ( SELECT 1
   FROM company_members cm
  WHERE ((cm.company_id = customer_magic_links.company_id) AND (cm.user_id = auth.uid()) AND (cm.status = 'ativo'::text))))));

create policy "Equipe gerencia notas de clientes" on "public"."customer_notes" as PERMISSIVE for ALL to "authenticated" using ((orcaly_private.is_company_owner(company_id) OR orcaly_private.is_company_member(company_id))) with check ((orcaly_private.is_company_owner(company_id) OR orcaly_private.is_company_member(company_id)));

create policy "deliveries_company_access" on "public"."deliveries" as PERMISSIVE for ALL to PUBLIC using ((EXISTS ( SELECT 1
   FROM companies c
  WHERE ((c.id = deliveries.company_id) AND ((c.owner_id = auth.uid()) OR (c.tester_id = auth.uid()) OR (EXISTS ( SELECT 1
           FROM company_members m
          WHERE ((m.company_id = c.id) AND (m.user_id = auth.uid()) AND (m.status = 'ativo'::text))))))))) with check ((EXISTS ( SELECT 1
   FROM companies c
  WHERE ((c.id = deliveries.company_id) AND ((c.owner_id = auth.uid()) OR (c.tester_id = auth.uid()) OR (EXISTS ( SELECT 1
           FROM company_members m
          WHERE ((m.company_id = c.id) AND (m.user_id = auth.uid()) AND (m.status = 'ativo'::text)))))))));

create policy "delivery_assignments_company_access" on "public"."delivery_assignments" as PERMISSIVE for ALL to "authenticated" using (orcaly_private.can_manage_company(company_id)) with check (orcaly_private.can_manage_company(company_id));

create policy "delivery_drivers_company_access" on "public"."delivery_drivers" as PERMISSIVE for ALL to "authenticated" using (orcaly_private.can_manage_company(company_id)) with check (orcaly_private.can_manage_company(company_id));

create policy "delivery_zones_company_access" on "public"."delivery_zones" as PERMISSIVE for ALL to PUBLIC using ((EXISTS ( SELECT 1
   FROM companies c
  WHERE ((c.id = delivery_zones.company_id) AND ((c.owner_id = auth.uid()) OR (c.tester_id = auth.uid()) OR (EXISTS ( SELECT 1
           FROM company_members m
          WHERE ((m.company_id = c.id) AND (m.user_id = auth.uid()) AND (m.status = 'ativo'::text))))))))) with check ((EXISTS ( SELECT 1
   FROM companies c
  WHERE ((c.id = delivery_zones.company_id) AND ((c.owner_id = auth.uid()) OR (c.tester_id = auth.uid()) OR (EXISTS ( SELECT 1
           FROM company_members m
          WHERE ((m.company_id = c.id) AND (m.user_id = auth.uid()) AND (m.status = 'ativo'::text)))))))));

create policy "Dono e gerente gerenciam contas financeiras" on "public"."finance_accounts" as PERMISSIVE for ALL to "authenticated" using ((orcaly_private.is_company_owner(company_id) OR (orcaly_private.is_company_member(company_id) AND (orcaly_private.my_company_role(company_id) = 'gerente'::text)))) with check ((orcaly_private.is_company_owner(company_id) OR (orcaly_private.is_company_member(company_id) AND (orcaly_private.my_company_role(company_id) = 'gerente'::text))));

create policy "Dono e gerente veem contas financeiras" on "public"."finance_accounts" as PERMISSIVE for SELECT to "authenticated" using ((orcaly_private.is_company_owner(company_id) OR (orcaly_private.is_company_member(company_id) AND (orcaly_private.my_company_role(company_id) = 'gerente'::text))));

create policy "finance_accounts_company_access" on "public"."finance_accounts" as PERMISSIVE for ALL to PUBLIC using ((EXISTS ( SELECT 1
   FROM companies c
  WHERE ((c.id = finance_accounts.company_id) AND ((c.owner_id = auth.uid()) OR (c.tester_id = auth.uid()) OR (EXISTS ( SELECT 1
           FROM company_members m
          WHERE ((m.company_id = c.id) AND (m.user_id = auth.uid()) AND (m.status = 'ativo'::text))))))))) with check ((EXISTS ( SELECT 1
   FROM companies c
  WHERE ((c.id = finance_accounts.company_id) AND ((c.owner_id = auth.uid()) OR (c.tester_id = auth.uid()) OR (EXISTS ( SELECT 1
           FROM company_members m
          WHERE ((m.company_id = c.id) AND (m.user_id = auth.uid()) AND (m.status = 'ativo'::text)))))))));

create policy "financial_categories_company_access" on "public"."financial_categories" as PERMISSIVE for ALL to PUBLIC using ((EXISTS ( SELECT 1
   FROM companies c
  WHERE ((c.id = financial_categories.company_id) AND ((c.owner_id = auth.uid()) OR (c.tester_id = auth.uid()) OR (EXISTS ( SELECT 1
           FROM company_members m
          WHERE ((m.company_id = c.id) AND (m.user_id = auth.uid()) AND (m.status = 'ativo'::text))))))))) with check ((EXISTS ( SELECT 1
   FROM companies c
  WHERE ((c.id = financial_categories.company_id) AND ((c.owner_id = auth.uid()) OR (c.tester_id = auth.uid()) OR (EXISTS ( SELECT 1
           FROM company_members m
          WHERE ((m.company_id = c.id) AND (m.user_id = auth.uid()) AND (m.status = 'ativo'::text)))))))));

create policy "Dono e gerente gerenciam materiais financeiros" on "public"."financial_material_entries" as PERMISSIVE for ALL to "authenticated" using ((orcaly_private.is_company_owner(company_id) OR (orcaly_private.is_company_member(company_id) AND (orcaly_private.my_company_role(company_id) = 'gerente'::text)))) with check ((orcaly_private.is_company_owner(company_id) OR (orcaly_private.is_company_member(company_id) AND (orcaly_private.my_company_role(company_id) = 'gerente'::text))));

create policy "Equipe ve materiais financeiros" on "public"."financial_material_entries" as PERMISSIVE for SELECT to "authenticated" using ((orcaly_private.is_company_owner(company_id) OR (orcaly_private.is_company_member(company_id) AND (orcaly_private.my_company_role(company_id) = ANY (ARRAY['gerente'::text, 'producao'::text])))));

create policy "financial_material_entries_company_access" on "public"."financial_material_entries" as PERMISSIVE for ALL to PUBLIC using ((EXISTS ( SELECT 1
   FROM companies c
  WHERE ((c.id = financial_material_entries.company_id) AND ((c.owner_id = auth.uid()) OR (c.tester_id = auth.uid()) OR (EXISTS ( SELECT 1
           FROM company_members m
          WHERE ((m.company_id = c.id) AND (m.user_id = auth.uid()) AND (m.status = 'ativo'::text))))))))) with check ((EXISTS ( SELECT 1
   FROM companies c
  WHERE ((c.id = financial_material_entries.company_id) AND ((c.owner_id = auth.uid()) OR (c.tester_id = auth.uid()) OR (EXISTS ( SELECT 1
           FROM company_members m
          WHERE ((m.company_id = c.id) AND (m.user_id = auth.uid()) AND (m.status = 'ativo'::text)))))))));

create policy "Dono e gerente gerenciam financeiro" on "public"."financial_transactions" as PERMISSIVE for ALL to "authenticated" using ((orcaly_private.is_company_owner(company_id) OR (orcaly_private.is_company_member(company_id) AND (orcaly_private.my_company_role(company_id) = 'gerente'::text)))) with check ((orcaly_private.is_company_owner(company_id) OR (orcaly_private.is_company_member(company_id) AND (orcaly_private.my_company_role(company_id) = 'gerente'::text))));

create policy "Equipe ve financeiro" on "public"."financial_transactions" as PERMISSIVE for SELECT to "authenticated" using ((orcaly_private.is_company_owner(company_id) OR (orcaly_private.is_company_member(company_id) AND (orcaly_private.my_company_role(company_id) = 'gerente'::text))));

create policy "financial_transactions_company_access" on "public"."financial_transactions" as PERMISSIVE for ALL to PUBLIC using ((EXISTS ( SELECT 1
   FROM companies c
  WHERE ((c.id = financial_transactions.company_id) AND ((c.owner_id = auth.uid()) OR (c.tester_id = auth.uid()) OR (EXISTS ( SELECT 1
           FROM company_members m
          WHERE ((m.company_id = c.id) AND (m.user_id = auth.uid()) AND (m.status = 'ativo'::text))))))))) with check ((EXISTS ( SELECT 1
   FROM companies c
  WHERE ((c.id = financial_transactions.company_id) AND ((c.owner_id = auth.uid()) OR (c.tester_id = auth.uid()) OR (EXISTS ( SELECT 1
           FROM company_members m
          WHERE ((m.company_id = c.id) AND (m.user_id = auth.uid()) AND (m.status = 'ativo'::text)))))))));

create policy "founder_invites_no_direct_access" on "public"."founder_invites" as PERMISSIVE for ALL to "anon", "authenticated" using (false) with check (false);

create policy "Empresa atualiza notificacoes" on "public"."notifications" as PERMISSIVE for UPDATE to "authenticated" using (((user_id = auth.uid()) OR (EXISTS ( SELECT 1
   FROM companies c
  WHERE ((c.id = notifications.company_id) AND ((c.owner_id = auth.uid()) OR (c.tester_id = auth.uid()))))) OR (EXISTS ( SELECT 1
   FROM company_members cm
  WHERE ((cm.company_id = notifications.company_id) AND (cm.user_id = auth.uid()) AND (cm.status = 'ativo'::text)))) OR (EXISTS ( SELECT 1
   FROM admin_users au
  WHERE ((au.ativo = true) AND (lower(au.email) = lower((auth.jwt() ->> 'email'::text)))))))) with check (((user_id = auth.uid()) OR (EXISTS ( SELECT 1
   FROM companies c
  WHERE ((c.id = notifications.company_id) AND ((c.owner_id = auth.uid()) OR (c.tester_id = auth.uid()))))) OR (EXISTS ( SELECT 1
   FROM company_members cm
  WHERE ((cm.company_id = notifications.company_id) AND (cm.user_id = auth.uid()) AND (cm.status = 'ativo'::text)))) OR (EXISTS ( SELECT 1
   FROM admin_users au
  WHERE ((au.ativo = true) AND (lower(au.email) = lower((auth.jwt() ->> 'email'::text))))))));

create policy "Empresa ve notificacoes" on "public"."notifications" as PERMISSIVE for SELECT to "authenticated" using (((user_id = auth.uid()) OR (EXISTS ( SELECT 1
   FROM companies c
  WHERE ((c.id = notifications.company_id) AND ((c.owner_id = auth.uid()) OR (c.tester_id = auth.uid()))))) OR (EXISTS ( SELECT 1
   FROM company_members cm
  WHERE ((cm.company_id = notifications.company_id) AND (cm.user_id = auth.uid()) AND (cm.status = 'ativo'::text)))) OR (EXISTS ( SELECT 1
   FROM admin_users au
  WHERE ((au.ativo = true) AND (lower(au.email) = lower((auth.jwt() ->> 'email'::text))))))));

create policy "Dono ou tester atualiza itens" on "public"."order_items" as PERMISSIVE for UPDATE to "authenticated" using ((EXISTS ( SELECT 1
   FROM companies c
  WHERE ((c.id = order_items.company_id) AND ((c.owner_id = auth.uid()) OR (c.tester_id = auth.uid())))))) with check ((EXISTS ( SELECT 1
   FROM companies c
  WHERE ((c.id = order_items.company_id) AND ((c.owner_id = auth.uid()) OR (c.tester_id = auth.uid()))))));

create policy "Dono ou tester vê itens" on "public"."order_items" as PERMISSIVE for SELECT to "authenticated" using ((EXISTS ( SELECT 1
   FROM companies c
  WHERE ((c.id = order_items.company_id) AND ((c.owner_id = auth.uid()) OR (c.tester_id = auth.uid()))))));

create policy "Funcionarios acessam itens pedidos" on "public"."order_items" as PERMISSIVE for ALL to "authenticated" using (orcaly_private.can_manage_company(company_id)) with check (orcaly_private.can_manage_company(company_id));

create policy "order_items_company_access" on "public"."order_items" as PERMISSIVE for ALL to PUBLIC using ((EXISTS ( SELECT 1
   FROM companies c
  WHERE ((c.id = order_items.company_id) AND ((c.owner_id = auth.uid()) OR (c.tester_id = auth.uid()) OR (EXISTS ( SELECT 1
           FROM company_members m
          WHERE ((m.company_id = c.id) AND (m.user_id = auth.uid()) AND (m.status = 'ativo'::text))))))))) with check ((EXISTS ( SELECT 1
   FROM companies c
  WHERE ((c.id = order_items.company_id) AND ((c.owner_id = auth.uid()) OR (c.tester_id = auth.uid()) OR (EXISTS ( SELECT 1
           FROM company_members m
          WHERE ((m.company_id = c.id) AND (m.user_id = auth.uid()) AND (m.status = 'ativo'::text)))))))));

create policy "order_payments_company_access" on "public"."order_payments" as PERMISSIVE for ALL to PUBLIC using ((EXISTS ( SELECT 1
   FROM companies c
  WHERE ((c.id = order_payments.company_id) AND ((c.owner_id = auth.uid()) OR (c.tester_id = auth.uid()) OR (EXISTS ( SELECT 1
           FROM company_members m
          WHERE ((m.company_id = c.id) AND (m.user_id = auth.uid()) AND (m.status = 'ativo'::text))))))))) with check ((EXISTS ( SELECT 1
   FROM companies c
  WHERE ((c.id = order_payments.company_id) AND ((c.owner_id = auth.uid()) OR (c.tester_id = auth.uid()) OR (EXISTS ( SELECT 1
           FROM company_members m
          WHERE ((m.company_id = c.id) AND (m.user_id = auth.uid()) AND (m.status = 'ativo'::text)))))))));

create policy "Dono ou tester atualiza pedidos" on "public"."orders" as PERMISSIVE for UPDATE to "authenticated" using ((EXISTS ( SELECT 1
   FROM companies c
  WHERE ((c.id = orders.company_id) AND ((c.owner_id = auth.uid()) OR (c.tester_id = auth.uid())))))) with check ((EXISTS ( SELECT 1
   FROM companies c
  WHERE ((c.id = orders.company_id) AND ((c.owner_id = auth.uid()) OR (c.tester_id = auth.uid()))))));

create policy "Dono ou tester vê pedidos" on "public"."orders" as PERMISSIVE for SELECT to "authenticated" using ((EXISTS ( SELECT 1
   FROM companies c
  WHERE ((c.id = orders.company_id) AND ((c.owner_id = auth.uid()) OR (c.tester_id = auth.uid()))))));

create policy "Funcionarios acessam pedidos" on "public"."orders" as PERMISSIVE for ALL to "authenticated" using (orcaly_private.can_manage_company(company_id)) with check (orcaly_private.can_manage_company(company_id));

create policy "Funcionarios atualizam pedidos" on "public"."orders" as PERMISSIVE for UPDATE to "authenticated" using (orcaly_private.is_company_member(company_id)) with check (orcaly_private.is_company_member(company_id));

create policy "Funcionarios veem pedidos" on "public"."orders" as PERMISSIVE for SELECT to "authenticated" using (orcaly_private.is_company_member(company_id));

create policy "payment_methods_company_access" on "public"."payment_methods" as PERMISSIVE for ALL to PUBLIC using ((EXISTS ( SELECT 1
   FROM companies c
  WHERE ((c.id = payment_methods.company_id) AND ((c.owner_id = auth.uid()) OR (c.tester_id = auth.uid()) OR (EXISTS ( SELECT 1
           FROM company_members m
          WHERE ((m.company_id = c.id) AND (m.user_id = auth.uid()) AND (m.status = 'ativo'::text))))))))) with check ((EXISTS ( SELECT 1
   FROM companies c
  WHERE ((c.id = payment_methods.company_id) AND ((c.owner_id = auth.uid()) OR (c.tester_id = auth.uid()) OR (EXISTS ( SELECT 1
           FROM company_members m
          WHERE ((m.company_id = c.id) AND (m.user_id = auth.uid()) AND (m.status = 'ativo'::text)))))))));

create policy "payment_payouts_company_select" on "public"."payment_payouts" as PERMISSIVE for SELECT to "authenticated" using (orcaly_private.orcaly_user_has_company_access(company_id));

create policy "payment_webhook_events_company_select" on "public"."payment_webhook_events" as PERMISSIVE for SELECT to "authenticated" using (((company_id IS NOT NULL) AND orcaly_private.orcaly_user_has_company_access(company_id)));

create policy "Dono pode criar pagamento da propria empresa" on "public"."plan_payments" as PERMISSIVE for INSERT to "authenticated" with check ((EXISTS ( SELECT 1
   FROM companies c
  WHERE ((c.id = plan_payments.company_id) AND (c.owner_id = auth.uid())))));

create policy "Dono pode ver pagamentos da propria empresa" on "public"."plan_payments" as PERMISSIVE for SELECT to "authenticated" using ((EXISTS ( SELECT 1
   FROM companies c
  WHERE ((c.id = plan_payments.company_id) AND (c.owner_id = auth.uid())))));

create policy "platform admin invites deny direct client access" on "public"."platform_admin_invites" as PERMISSIVE for ALL to "anon", "authenticated" using (false) with check (false);

create policy "Empresa gerencia producao" on "public"."production_orders" as PERMISSIVE for ALL to "authenticated" using (((EXISTS ( SELECT 1
   FROM companies c
  WHERE ((c.id = production_orders.company_id) AND ((c.owner_id = auth.uid()) OR (c.tester_id = auth.uid()))))) OR (EXISTS ( SELECT 1
   FROM company_members cm
  WHERE ((cm.company_id = production_orders.company_id) AND (cm.user_id = auth.uid()) AND (cm.status = 'ativo'::text)))) OR (EXISTS ( SELECT 1
   FROM admin_users au
  WHERE ((au.ativo = true) AND (lower(au.email) = lower((auth.jwt() ->> 'email'::text)))))))) with check (((EXISTS ( SELECT 1
   FROM companies c
  WHERE ((c.id = production_orders.company_id) AND ((c.owner_id = auth.uid()) OR (c.tester_id = auth.uid()))))) OR (EXISTS ( SELECT 1
   FROM company_members cm
  WHERE ((cm.company_id = production_orders.company_id) AND (cm.user_id = auth.uid()) AND (cm.status = 'ativo'::text)))) OR (EXISTS ( SELECT 1
   FROM admin_users au
  WHERE ((au.ativo = true) AND (lower(au.email) = lower((auth.jwt() ->> 'email'::text))))))));

create policy "Empresa gerencia producao plus" on "public"."production_orders" as PERMISSIVE for ALL to "authenticated" using (((EXISTS ( SELECT 1
   FROM companies c
  WHERE ((c.id = production_orders.company_id) AND ((c.owner_id = auth.uid()) OR (c.tester_id = auth.uid()))))) OR (EXISTS ( SELECT 1
   FROM company_members cm
  WHERE ((cm.company_id = production_orders.company_id) AND (cm.user_id = auth.uid()) AND (cm.status = 'ativo'::text)))))) with check (((EXISTS ( SELECT 1
   FROM companies c
  WHERE ((c.id = production_orders.company_id) AND ((c.owner_id = auth.uid()) OR (c.tester_id = auth.uid()))))) OR (EXISTS ( SELECT 1
   FROM company_members cm
  WHERE ((cm.company_id = production_orders.company_id) AND (cm.user_id = auth.uid()) AND (cm.status = 'ativo'::text))))));

create policy "Empresa gerencia etapas producao" on "public"."production_steps" as PERMISSIVE for ALL to "authenticated" using (((EXISTS ( SELECT 1
   FROM companies c
  WHERE ((c.id = production_steps.company_id) AND ((c.owner_id = auth.uid()) OR (c.tester_id = auth.uid()))))) OR (EXISTS ( SELECT 1
   FROM company_members cm
  WHERE ((cm.company_id = production_steps.company_id) AND (cm.user_id = auth.uid()) AND (cm.status = 'ativo'::text)))) OR (EXISTS ( SELECT 1
   FROM admin_users au
  WHERE ((au.ativo = true) AND (lower(au.email) = lower((auth.jwt() ->> 'email'::text)))))))) with check (((EXISTS ( SELECT 1
   FROM companies c
  WHERE ((c.id = production_steps.company_id) AND ((c.owner_id = auth.uid()) OR (c.tester_id = auth.uid()))))) OR (EXISTS ( SELECT 1
   FROM company_members cm
  WHERE ((cm.company_id = production_steps.company_id) AND (cm.user_id = auth.uid()) AND (cm.status = 'ativo'::text)))) OR (EXISTS ( SELECT 1
   FROM admin_users au
  WHERE ((au.ativo = true) AND (lower(au.email) = lower((auth.jwt() ->> 'email'::text))))))));

create policy "Dono ou tester apaga produtos" on "public"."products" as PERMISSIVE for DELETE to "authenticated" using ((EXISTS ( SELECT 1
   FROM companies c
  WHERE ((c.id = products.company_id) AND ((c.owner_id = auth.uid()) OR (c.tester_id = auth.uid()))))));

create policy "Dono ou tester atualiza produtos" on "public"."products" as PERMISSIVE for UPDATE to "authenticated" using ((EXISTS ( SELECT 1
   FROM companies c
  WHERE ((c.id = products.company_id) AND ((c.owner_id = auth.uid()) OR (c.tester_id = auth.uid())))))) with check ((EXISTS ( SELECT 1
   FROM companies c
  WHERE ((c.id = products.company_id) AND ((c.owner_id = auth.uid()) OR (c.tester_id = auth.uid()))))));

create policy "Dono ou tester cria produtos" on "public"."products" as PERMISSIVE for INSERT to "authenticated" with check ((EXISTS ( SELECT 1
   FROM companies c
  WHERE ((c.id = products.company_id) AND ((c.owner_id = auth.uid()) OR (c.tester_id = auth.uid()))))));

create policy "Dono ou tester vê produtos" on "public"."products" as PERMISSIVE for SELECT to "authenticated" using ((EXISTS ( SELECT 1
   FROM companies c
  WHERE ((c.id = products.company_id) AND ((c.owner_id = auth.uid()) OR (c.tester_id = auth.uid()))))));

create policy "Funcionarios acessam produtos" on "public"."products" as PERMISSIVE for ALL to "authenticated" using (orcaly_private.can_manage_company(company_id)) with check (orcaly_private.can_manage_company(company_id));

create policy "Funcionarios veem produtos" on "public"."products" as PERMISSIVE for SELECT to "authenticated" using (orcaly_private.is_company_member(company_id));

create policy "Gerente gerencia produtos" on "public"."products" as PERMISSIVE for ALL to "authenticated" using ((orcaly_private.is_company_member(company_id) AND (orcaly_private.my_company_role(company_id) = 'gerente'::text))) with check ((orcaly_private.is_company_member(company_id) AND (orcaly_private.my_company_role(company_id) = 'gerente'::text)));

create policy "Empresa insere eventos propostas" on "public"."proposal_events" as PERMISSIVE for INSERT to "authenticated" with check (orcaly_private.can_manage_company(company_id));

create policy "Empresa ve eventos propostas" on "public"."proposal_events" as PERMISSIVE for SELECT to "authenticated" using (orcaly_private.can_manage_company(company_id));

create policy "Funcionarios acessam eventos propostas" on "public"."proposal_events" as PERMISSIVE for ALL to "authenticated" using (orcaly_private.can_manage_company(company_id)) with check (orcaly_private.can_manage_company(company_id));

create policy "Dono ou tester gerencia propostas" on "public"."proposals" as PERMISSIVE for ALL to "authenticated" using ((EXISTS ( SELECT 1
   FROM companies c
  WHERE ((c.id = proposals.company_id) AND ((c.owner_id = auth.uid()) OR (c.tester_id = auth.uid())))))) with check ((EXISTS ( SELECT 1
   FROM companies c
  WHERE ((c.id = proposals.company_id) AND ((c.owner_id = auth.uid()) OR (c.tester_id = auth.uid()))))));

create policy "Empresa gerencia propostas" on "public"."proposals" as PERMISSIVE for ALL to "authenticated" using (orcaly_private.can_manage_company(company_id)) with check (orcaly_private.can_manage_company(company_id));

create policy "Equipe comercial gerencia propostas" on "public"."proposals" as PERMISSIVE for ALL to "authenticated" using ((orcaly_private.is_company_member(company_id) AND (orcaly_private.my_company_role(company_id) = ANY (ARRAY['gerente'::text, 'atendente'::text])))) with check ((orcaly_private.is_company_member(company_id) AND (orcaly_private.my_company_role(company_id) = ANY (ARRAY['gerente'::text, 'atendente'::text]))));

create policy "Equipe comercial ve propostas" on "public"."proposals" as PERMISSIVE for SELECT to "authenticated" using ((orcaly_private.is_company_member(company_id) AND (orcaly_private.my_company_role(company_id) = ANY (ARRAY['gerente'::text, 'atendente'::text]))));

create policy "Funcionarios acessam propostas" on "public"."proposals" as PERMISSIVE for ALL to "authenticated" using (orcaly_private.can_manage_company(company_id)) with check (orcaly_private.can_manage_company(company_id));

create policy "provider_customers_company_select" on "public"."provider_customers" as PERMISSIVE for SELECT to "authenticated" using (orcaly_private.orcaly_user_has_company_access(company_id));

create policy "Dono ou tester gerencia modelos" on "public"."quote_templates" as PERMISSIVE for ALL to "authenticated" using ((EXISTS ( SELECT 1
   FROM companies c
  WHERE ((c.id = quote_templates.company_id) AND ((c.owner_id = auth.uid()) OR (c.tester_id = auth.uid())))))) with check ((EXISTS ( SELECT 1
   FROM companies c
  WHERE ((c.id = quote_templates.company_id) AND ((c.owner_id = auth.uid()) OR (c.tester_id = auth.uid()))))));

create policy "Funcionarios acessam modelos orcamento" on "public"."quote_templates" as PERMISSIVE for ALL to "authenticated" using (orcaly_private.can_manage_company(company_id)) with check (orcaly_private.can_manage_company(company_id));

create policy "Empresa gerencia recorrentes" on "public"."recurring_orders" as PERMISSIVE for ALL to "authenticated" using (((EXISTS ( SELECT 1
   FROM companies c
  WHERE ((c.id = recurring_orders.company_id) AND ((c.owner_id = auth.uid()) OR (c.tester_id = auth.uid()))))) OR (EXISTS ( SELECT 1
   FROM company_members cm
  WHERE ((cm.company_id = recurring_orders.company_id) AND (cm.user_id = auth.uid()) AND (cm.status = 'ativo'::text)))))) with check (((EXISTS ( SELECT 1
   FROM companies c
  WHERE ((c.id = recurring_orders.company_id) AND ((c.owner_id = auth.uid()) OR (c.tester_id = auth.uid()))))) OR (EXISTS ( SELECT 1
   FROM company_members cm
  WHERE ((cm.company_id = recurring_orders.company_id) AND (cm.user_id = auth.uid()) AND (cm.status = 'ativo'::text))))));

create policy "Admins veem blocklist" on "public"."security_blocklist" as PERMISSIVE for SELECT to "authenticated" using ((EXISTS ( SELECT 1
   FROM admin_users au
  WHERE ((au.ativo = true) AND (lower(au.email) = lower((auth.jwt() ->> 'email'::text)))))));

create policy "Super admin gerencia blocklist" on "public"."security_blocklist" as PERMISSIVE for ALL to "authenticated" using ((EXISTS ( SELECT 1
   FROM admin_users au
  WHERE ((au.ativo = true) AND (au.role = 'super_admin'::text) AND (lower(au.email) = lower((auth.jwt() ->> 'email'::text))))))) with check ((EXISTS ( SELECT 1
   FROM admin_users au
  WHERE ((au.ativo = true) AND (au.role = 'super_admin'::text) AND (lower(au.email) = lower((auth.jwt() ->> 'email'::text)))))));

create policy "Admins gerenciam eventos de seguranca" on "public"."security_events" as PERMISSIVE for UPDATE to "authenticated" using ((EXISTS ( SELECT 1
   FROM admin_users au
  WHERE ((au.ativo = true) AND (lower(au.email) = lower((auth.jwt() ->> 'email'::text))))))) with check ((EXISTS ( SELECT 1
   FROM admin_users au
  WHERE ((au.ativo = true) AND (lower(au.email) = lower((auth.jwt() ->> 'email'::text)))))));

create policy "Admins inserem eventos de seguranca" on "public"."security_events" as PERMISSIVE for INSERT to "authenticated" with check ((EXISTS ( SELECT 1
   FROM admin_users au
  WHERE ((au.ativo = true) AND (lower(au.email) = lower((auth.jwt() ->> 'email'::text)))))));

create policy "Admins veem eventos de seguranca" on "public"."security_events" as PERMISSIVE for SELECT to "authenticated" using ((EXISTS ( SELECT 1
   FROM admin_users au
  WHERE ((au.ativo = true) AND (lower(au.email) = lower((auth.jwt() ->> 'email'::text)))))));

create policy "Dono ou tester vê eventos de segurança" on "public"."security_events" as PERMISSIVE for SELECT to "authenticated" using ((EXISTS ( SELECT 1
   FROM companies c
  WHERE ((c.id = security_events.company_id) AND ((c.owner_id = auth.uid()) OR (c.tester_id = auth.uid()))))));

create policy "Admin gerencia followups de leads" on "public"."signup_lead_followups" as PERMISSIVE for ALL to "authenticated" using ((EXISTS ( SELECT 1
   FROM admin_users au
  WHERE ((au.ativo = true) AND (lower(au.email) = lower((auth.jwt() ->> 'email'::text))))))) with check ((EXISTS ( SELECT 1
   FROM admin_users au
  WHERE ((au.ativo = true) AND (lower(au.email) = lower((auth.jwt() ->> 'email'::text)))))));

create policy "Admin gerencia leads" on "public"."signup_leads" as PERMISSIVE for ALL to "authenticated" using ((EXISTS ( SELECT 1
   FROM admin_users au
  WHERE ((au.ativo = true) AND (lower(au.email) = lower((auth.jwt() ->> 'email'::text))))))) with check ((EXISTS ( SELECT 1
   FROM admin_users au
  WHERE ((au.ativo = true) AND (lower(au.email) = lower((auth.jwt() ->> 'email'::text)))))));

create policy "Admin gerencia secoes do site" on "public"."site_sections" as PERMISSIVE for ALL to "authenticated" using ((EXISTS ( SELECT 1
   FROM admin_users au
  WHERE ((au.ativo = true) AND (lower(au.email) = lower((auth.jwt() ->> 'email'::text))))))) with check ((EXISTS ( SELECT 1
   FROM admin_users au
  WHERE ((au.ativo = true) AND (lower(au.email) = lower((auth.jwt() ->> 'email'::text)))))));

create policy "Empresa gerencia secoes do site" on "public"."site_sections" as PERMISSIVE for ALL to "authenticated" using ((EXISTS ( SELECT 1
   FROM companies c
  WHERE ((c.id = site_sections.company_id) AND ((c.owner_id = auth.uid()) OR (c.tester_id = auth.uid())))))) with check ((EXISTS ( SELECT 1
   FROM companies c
  WHERE ((c.id = site_sections.company_id) AND ((c.owner_id = auth.uid()) OR (c.tester_id = auth.uid()))))));

create policy "subscription_events_select_company" on "public"."subscription_events" as PERMISSIVE for SELECT to "authenticated" using (((EXISTS ( SELECT 1
   FROM companies c
  WHERE ((c.id = subscription_events.company_id) AND ((c.owner_id = auth.uid()) OR (c.tester_id = auth.uid()))))) OR (EXISTS ( SELECT 1
   FROM company_members cm
  WHERE ((cm.company_id = subscription_events.company_id) AND (cm.user_id = auth.uid()) AND (cm.status = 'ativo'::text))))));

create policy "Empresa ve whatsapp conversations" on "public"."whatsapp_conversations" as PERMISSIVE for SELECT to "authenticated" using (((EXISTS ( SELECT 1
   FROM companies c
  WHERE ((c.id = whatsapp_conversations.company_id) AND ((c.owner_id = auth.uid()) OR (c.tester_id = auth.uid()))))) OR (EXISTS ( SELECT 1
   FROM company_members cm
  WHERE ((cm.company_id = whatsapp_conversations.company_id) AND (cm.user_id = auth.uid()) AND (cm.status = 'ativo'::text)))) OR (EXISTS ( SELECT 1
   FROM admin_users au
  WHERE ((au.ativo = true) AND (lower(au.email) = lower((auth.jwt() ->> 'email'::text))))))));

create policy "Empresa ve whatsapp logs" on "public"."whatsapp_message_logs" as PERMISSIVE for SELECT to "authenticated" using (((EXISTS ( SELECT 1
   FROM companies c
  WHERE ((c.id = whatsapp_message_logs.company_id) AND ((c.owner_id = auth.uid()) OR (c.tester_id = auth.uid()))))) OR (EXISTS ( SELECT 1
   FROM company_members cm
  WHERE ((cm.company_id = whatsapp_message_logs.company_id) AND (cm.user_id = auth.uid()) AND (cm.status = 'ativo'::text)))) OR (EXISTS ( SELECT 1
   FROM admin_users au
  WHERE ((au.ativo = true) AND (lower(au.email) = lower((auth.jwt() ->> 'email'::text))))))));

create policy "Equipe atualiza arquivos da propria empresa" on "storage"."objects" as PERMISSIVE for UPDATE to "authenticated" using (((bucket_id = ANY (ARRAY['financeiro'::text, 'logos'::text, 'product-images'::text, 'produtos'::text, 'site-assets'::text])) AND orcaly_private.can_manage_storage_path(name))) with check (((bucket_id = ANY (ARRAY['financeiro'::text, 'logos'::text, 'product-images'::text, 'produtos'::text, 'site-assets'::text])) AND orcaly_private.can_manage_storage_path(name)));

create policy "Equipe envia arquivos da propria empresa" on "storage"."objects" as PERMISSIVE for INSERT to "authenticated" with check (((bucket_id = ANY (ARRAY['financeiro'::text, 'logos'::text, 'product-images'::text, 'produtos'::text, 'site-assets'::text])) AND orcaly_private.can_manage_storage_path(name)));

create policy "Equipe lista arquivos da propria empresa" on "storage"."objects" as PERMISSIVE for SELECT to "authenticated" using (((bucket_id = ANY (ARRAY['financeiro'::text, 'logos'::text, 'product-images'::text, 'produtos'::text, 'site-assets'::text])) AND orcaly_private.can_manage_storage_path(name)));

create policy "Equipe remove arquivos da propria empresa" on "storage"."objects" as PERMISSIVE for DELETE to "authenticated" using (((bucket_id = ANY (ARRAY['financeiro'::text, 'logos'::text, 'product-images'::text, 'produtos'::text, 'site-assets'::text])) AND orcaly_private.can_manage_storage_path(name)));

CREATE TRIGGER affiliate_payout_accounts_updated_at BEFORE UPDATE ON orcaly_private.affiliate_payout_accounts FOR EACH ROW EXECUTE FUNCTION orcaly_private.touch_affiliate_updated_at();

CREATE TRIGGER affiliate_commissions_updated_at BEFORE UPDATE ON affiliate_commissions FOR EACH ROW EXECUTE FUNCTION orcaly_private.touch_affiliate_updated_at();

CREATE TRIGGER affiliate_payouts_updated_at BEFORE UPDATE ON affiliate_payouts FOR EACH ROW EXECUTE FUNCTION orcaly_private.touch_affiliate_updated_at();

CREATE TRIGGER affiliate_profiles_updated_at BEFORE UPDATE ON affiliate_profiles FOR EACH ROW EXECUTE FUNCTION orcaly_private.touch_affiliate_updated_at();

CREATE TRIGGER affiliate_program_settings_updated_at BEFORE UPDATE ON affiliate_program_settings FOR EACH ROW EXECUTE FUNCTION orcaly_private.touch_affiliate_updated_at();

CREATE TRIGGER affiliate_referrals_updated_at BEFORE UPDATE ON affiliate_referrals FOR EACH ROW EXECUTE FUNCTION orcaly_private.touch_affiliate_updated_at();

CREATE TRIGGER set_business_hours_updated_at BEFORE UPDATE ON business_hours FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_protect_company_trial_used_at BEFORE UPDATE ON companies FOR EACH ROW EXECUTE FUNCTION protect_company_trial_used_at();

CREATE TRIGGER trg_set_company_subdomain_slug BEFORE INSERT OR UPDATE OF nome, slug, subdomain_slug ON companies FOR EACH ROW EXECUTE FUNCTION set_company_subdomain_slug();

CREATE TRIGGER trg_company_member_limit BEFORE INSERT OR UPDATE ON company_members FOR EACH ROW EXECUTE FUNCTION orcaly_private.check_company_member_limit();

CREATE TRIGGER trg_company_member_touch BEFORE UPDATE ON company_members FOR EACH ROW EXECUTE FUNCTION company_member_touch();

CREATE TRIGGER trg_limit_company_members BEFORE INSERT OR UPDATE OF status, company_id ON company_members FOR EACH ROW EXECUTE FUNCTION limit_company_members();

CREATE TRIGGER set_deliveries_updated_at BEFORE UPDATE ON deliveries FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER set_delivery_zones_updated_at BEFORE UPDATE ON delivery_zones FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_finance_touch_updated_at BEFORE UPDATE ON financial_transactions FOR EACH ROW EXECUTE FUNCTION finance_touch_updated_at();

CREATE TRIGGER founder_invites_set_updated_at BEFORE UPDATE ON founder_invites FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_marketplace_commission_rules_updated_at BEFORE UPDATE ON marketplace_commission_rules FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_marketplace_commissions_updated_at BEFORE UPDATE ON marketplace_commissions FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_marketplace_payment_settings_updated_at BEFORE UPDATE ON marketplace_payment_settings FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_marketplace_payments_updated_at BEFORE UPDATE ON marketplace_payments FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER set_order_payments_updated_at BEFORE UPDATE ON order_payments FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER set_orders_updated_at BEFORE UPDATE ON orders FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_orcaly_orders_business_event AFTER INSERT OR UPDATE OF status, payment_status ON orders FOR EACH ROW EXECUTE FUNCTION orcaly_record_business_event();

CREATE TRIGGER set_payment_methods_updated_at BEFORE UPDATE ON payment_methods FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_orcaly_mirror_payment_webhook_event AFTER INSERT OR UPDATE OF processing_status, processed_at, error_message ON payment_webhook_events FOR EACH ROW EXECUTE FUNCTION orcaly_mirror_payment_webhook_event();

CREATE TRIGGER platform_admin_invites_set_updated_at BEFORE UPDATE ON platform_admin_invites FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_platform_admins_updated_at BEFORE UPDATE ON platform_admins FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_orcaly_proposals_business_event AFTER INSERT OR UPDATE OF status ON proposals FOR EACH ROW EXECUTE FUNCTION orcaly_record_business_event();

CREATE TRIGGER trg_sync_signup_lead_sales_stage BEFORE INSERT OR UPDATE ON signup_leads FOR EACH ROW EXECUTE FUNCTION orcaly_private.sync_signup_lead_sales_stage();

CREATE TRIGGER trg_touch_signup_lead_updated_at BEFORE UPDATE ON signup_leads FOR EACH ROW EXECUTE FUNCTION touch_signup_lead_updated_at();

CREATE TRIGGER trg_orcaly_mirror_whatsapp_webhook_event AFTER INSERT OR UPDATE OF processing_status, processed_at, error_message ON whatsapp_webhook_events FOR EACH ROW EXECUTE FUNCTION orcaly_mirror_whatsapp_webhook_event();

revoke all privileges on SCHEMA "api" from PUBLIC, "anon", "authenticated", "service_role", "postgres";

grant USAGE on SCHEMA "api" to "postgres";

grant CREATE on SCHEMA "api" to "postgres";

grant USAGE on SCHEMA "api" to "anon";

grant USAGE on SCHEMA "api" to "authenticated";

revoke all privileges on SCHEMA "orcaly_private" from PUBLIC, "anon", "authenticated", "service_role", "postgres";

grant USAGE on SCHEMA "orcaly_private" to "postgres";

grant CREATE on SCHEMA "orcaly_private" to "postgres";

grant USAGE on SCHEMA "orcaly_private" to "service_role";

grant USAGE on SCHEMA "orcaly_private" to "authenticated";

revoke all privileges on SCHEMA "public" from PUBLIC, "anon", "authenticated", "service_role", "pg_database_owner", "postgres";

grant USAGE on SCHEMA "public" to "pg_database_owner";

grant CREATE on SCHEMA "public" to "pg_database_owner";

grant USAGE on SCHEMA "public" to PUBLIC;

grant USAGE on SCHEMA "public" to "postgres";

grant USAGE on SCHEMA "public" to "anon";

grant USAGE on SCHEMA "public" to "authenticated";

grant USAGE on SCHEMA "public" to "service_role";

revoke all privileges on TABLE "orcaly_private"."affiliate_payout_accounts" from PUBLIC, "anon", "authenticated", "service_role", "postgres";

grant INSERT on TABLE "orcaly_private"."affiliate_payout_accounts" to "postgres";

grant SELECT on TABLE "orcaly_private"."affiliate_payout_accounts" to "postgres";

grant UPDATE on TABLE "orcaly_private"."affiliate_payout_accounts" to "postgres";

grant DELETE on TABLE "orcaly_private"."affiliate_payout_accounts" to "postgres";

grant TRUNCATE on TABLE "orcaly_private"."affiliate_payout_accounts" to "postgres";

grant REFERENCES on TABLE "orcaly_private"."affiliate_payout_accounts" to "postgres";

grant TRIGGER on TABLE "orcaly_private"."affiliate_payout_accounts" to "postgres";

grant MAINTAIN on TABLE "orcaly_private"."affiliate_payout_accounts" to "postgres";

revoke all privileges on TABLE "orcaly_private"."api_rate_limits" from PUBLIC, "anon", "authenticated", "service_role", "postgres";

grant INSERT on TABLE "orcaly_private"."api_rate_limits" to "postgres";

grant SELECT on TABLE "orcaly_private"."api_rate_limits" to "postgres";

grant UPDATE on TABLE "orcaly_private"."api_rate_limits" to "postgres";

grant DELETE on TABLE "orcaly_private"."api_rate_limits" to "postgres";

grant TRUNCATE on TABLE "orcaly_private"."api_rate_limits" to "postgres";

grant REFERENCES on TABLE "orcaly_private"."api_rate_limits" to "postgres";

grant TRIGGER on TABLE "orcaly_private"."api_rate_limits" to "postgres";

grant MAINTAIN on TABLE "orcaly_private"."api_rate_limits" to "postgres";

revoke all privileges on TABLE "public"."admin_audit_logs" from PUBLIC, "anon", "authenticated", "service_role", "postgres";

grant INSERT on TABLE "public"."admin_audit_logs" to "postgres";

grant SELECT on TABLE "public"."admin_audit_logs" to "postgres";

grant UPDATE on TABLE "public"."admin_audit_logs" to "postgres";

grant DELETE on TABLE "public"."admin_audit_logs" to "postgres";

grant TRUNCATE on TABLE "public"."admin_audit_logs" to "postgres";

grant REFERENCES on TABLE "public"."admin_audit_logs" to "postgres";

grant TRIGGER on TABLE "public"."admin_audit_logs" to "postgres";

grant MAINTAIN on TABLE "public"."admin_audit_logs" to "postgres";

grant INSERT on TABLE "public"."admin_audit_logs" to "authenticated";

grant SELECT on TABLE "public"."admin_audit_logs" to "authenticated";

grant UPDATE on TABLE "public"."admin_audit_logs" to "authenticated";

grant DELETE on TABLE "public"."admin_audit_logs" to "authenticated";

grant MAINTAIN on TABLE "public"."admin_audit_logs" to "authenticated";

grant INSERT on TABLE "public"."admin_audit_logs" to "service_role";

grant SELECT on TABLE "public"."admin_audit_logs" to "service_role";

grant UPDATE on TABLE "public"."admin_audit_logs" to "service_role";

grant DELETE on TABLE "public"."admin_audit_logs" to "service_role";

grant TRUNCATE on TABLE "public"."admin_audit_logs" to "service_role";

grant REFERENCES on TABLE "public"."admin_audit_logs" to "service_role";

grant TRIGGER on TABLE "public"."admin_audit_logs" to "service_role";

grant MAINTAIN on TABLE "public"."admin_audit_logs" to "service_role";

revoke all privileges on TABLE "public"."admin_bug_reports" from PUBLIC, "anon", "authenticated", "service_role", "postgres";

grant INSERT on TABLE "public"."admin_bug_reports" to "postgres";

grant SELECT on TABLE "public"."admin_bug_reports" to "postgres";

grant UPDATE on TABLE "public"."admin_bug_reports" to "postgres";

grant DELETE on TABLE "public"."admin_bug_reports" to "postgres";

grant TRUNCATE on TABLE "public"."admin_bug_reports" to "postgres";

grant REFERENCES on TABLE "public"."admin_bug_reports" to "postgres";

grant TRIGGER on TABLE "public"."admin_bug_reports" to "postgres";

grant MAINTAIN on TABLE "public"."admin_bug_reports" to "postgres";

grant INSERT on TABLE "public"."admin_bug_reports" to "authenticated";

grant SELECT on TABLE "public"."admin_bug_reports" to "authenticated";

grant UPDATE on TABLE "public"."admin_bug_reports" to "authenticated";

grant DELETE on TABLE "public"."admin_bug_reports" to "authenticated";

grant MAINTAIN on TABLE "public"."admin_bug_reports" to "authenticated";

grant INSERT on TABLE "public"."admin_bug_reports" to "service_role";

grant SELECT on TABLE "public"."admin_bug_reports" to "service_role";

grant UPDATE on TABLE "public"."admin_bug_reports" to "service_role";

grant DELETE on TABLE "public"."admin_bug_reports" to "service_role";

grant TRUNCATE on TABLE "public"."admin_bug_reports" to "service_role";

grant REFERENCES on TABLE "public"."admin_bug_reports" to "service_role";

grant TRIGGER on TABLE "public"."admin_bug_reports" to "service_role";

grant MAINTAIN on TABLE "public"."admin_bug_reports" to "service_role";

revoke all privileges on TABLE "public"."admin_scan_runs" from PUBLIC, "anon", "authenticated", "service_role", "postgres";

grant INSERT on TABLE "public"."admin_scan_runs" to "postgres";

grant SELECT on TABLE "public"."admin_scan_runs" to "postgres";

grant UPDATE on TABLE "public"."admin_scan_runs" to "postgres";

grant DELETE on TABLE "public"."admin_scan_runs" to "postgres";

grant TRUNCATE on TABLE "public"."admin_scan_runs" to "postgres";

grant REFERENCES on TABLE "public"."admin_scan_runs" to "postgres";

grant TRIGGER on TABLE "public"."admin_scan_runs" to "postgres";

grant MAINTAIN on TABLE "public"."admin_scan_runs" to "postgres";

grant INSERT on TABLE "public"."admin_scan_runs" to "authenticated";

grant SELECT on TABLE "public"."admin_scan_runs" to "authenticated";

grant UPDATE on TABLE "public"."admin_scan_runs" to "authenticated";

grant DELETE on TABLE "public"."admin_scan_runs" to "authenticated";

grant MAINTAIN on TABLE "public"."admin_scan_runs" to "authenticated";

grant INSERT on TABLE "public"."admin_scan_runs" to "service_role";

grant SELECT on TABLE "public"."admin_scan_runs" to "service_role";

grant UPDATE on TABLE "public"."admin_scan_runs" to "service_role";

grant DELETE on TABLE "public"."admin_scan_runs" to "service_role";

grant TRUNCATE on TABLE "public"."admin_scan_runs" to "service_role";

grant REFERENCES on TABLE "public"."admin_scan_runs" to "service_role";

grant TRIGGER on TABLE "public"."admin_scan_runs" to "service_role";

grant MAINTAIN on TABLE "public"."admin_scan_runs" to "service_role";

revoke all privileges on TABLE "public"."admin_signup_leads_overview" from PUBLIC, "anon", "authenticated", "service_role", "postgres";

grant INSERT on TABLE "public"."admin_signup_leads_overview" to "postgres";

grant SELECT on TABLE "public"."admin_signup_leads_overview" to "postgres";

grant UPDATE on TABLE "public"."admin_signup_leads_overview" to "postgres";

grant DELETE on TABLE "public"."admin_signup_leads_overview" to "postgres";

grant TRUNCATE on TABLE "public"."admin_signup_leads_overview" to "postgres";

grant REFERENCES on TABLE "public"."admin_signup_leads_overview" to "postgres";

grant TRIGGER on TABLE "public"."admin_signup_leads_overview" to "postgres";

grant MAINTAIN on TABLE "public"."admin_signup_leads_overview" to "postgres";

grant SELECT on TABLE "public"."admin_signup_leads_overview" to "authenticated";

grant SELECT on TABLE "public"."admin_signup_leads_overview" to "service_role";

revoke all privileges on TABLE "public"."admin_system_snapshots" from PUBLIC, "anon", "authenticated", "service_role", "postgres";

grant INSERT on TABLE "public"."admin_system_snapshots" to "postgres";

grant SELECT on TABLE "public"."admin_system_snapshots" to "postgres";

grant UPDATE on TABLE "public"."admin_system_snapshots" to "postgres";

grant DELETE on TABLE "public"."admin_system_snapshots" to "postgres";

grant TRUNCATE on TABLE "public"."admin_system_snapshots" to "postgres";

grant REFERENCES on TABLE "public"."admin_system_snapshots" to "postgres";

grant TRIGGER on TABLE "public"."admin_system_snapshots" to "postgres";

grant MAINTAIN on TABLE "public"."admin_system_snapshots" to "postgres";

grant INSERT on TABLE "public"."admin_system_snapshots" to "authenticated";

grant SELECT on TABLE "public"."admin_system_snapshots" to "authenticated";

grant UPDATE on TABLE "public"."admin_system_snapshots" to "authenticated";

grant DELETE on TABLE "public"."admin_system_snapshots" to "authenticated";

grant MAINTAIN on TABLE "public"."admin_system_snapshots" to "authenticated";

grant INSERT on TABLE "public"."admin_system_snapshots" to "service_role";

grant SELECT on TABLE "public"."admin_system_snapshots" to "service_role";

grant UPDATE on TABLE "public"."admin_system_snapshots" to "service_role";

grant DELETE on TABLE "public"."admin_system_snapshots" to "service_role";

grant TRUNCATE on TABLE "public"."admin_system_snapshots" to "service_role";

grant REFERENCES on TABLE "public"."admin_system_snapshots" to "service_role";

grant TRIGGER on TABLE "public"."admin_system_snapshots" to "service_role";

grant MAINTAIN on TABLE "public"."admin_system_snapshots" to "service_role";

revoke all privileges on TABLE "public"."admin_users" from PUBLIC, "anon", "authenticated", "service_role", "postgres";

grant INSERT on TABLE "public"."admin_users" to "postgres";

grant SELECT on TABLE "public"."admin_users" to "postgres";

grant UPDATE on TABLE "public"."admin_users" to "postgres";

grant DELETE on TABLE "public"."admin_users" to "postgres";

grant TRUNCATE on TABLE "public"."admin_users" to "postgres";

grant REFERENCES on TABLE "public"."admin_users" to "postgres";

grant TRIGGER on TABLE "public"."admin_users" to "postgres";

grant MAINTAIN on TABLE "public"."admin_users" to "postgres";

grant INSERT on TABLE "public"."admin_users" to "authenticated";

grant SELECT on TABLE "public"."admin_users" to "authenticated";

grant UPDATE on TABLE "public"."admin_users" to "authenticated";

grant DELETE on TABLE "public"."admin_users" to "authenticated";

grant MAINTAIN on TABLE "public"."admin_users" to "authenticated";

grant INSERT on TABLE "public"."admin_users" to "service_role";

grant SELECT on TABLE "public"."admin_users" to "service_role";

grant UPDATE on TABLE "public"."admin_users" to "service_role";

grant DELETE on TABLE "public"."admin_users" to "service_role";

grant TRUNCATE on TABLE "public"."admin_users" to "service_role";

grant REFERENCES on TABLE "public"."admin_users" to "service_role";

grant TRIGGER on TABLE "public"."admin_users" to "service_role";

grant MAINTAIN on TABLE "public"."admin_users" to "service_role";

revoke all privileges on TABLE "public"."affiliate_achievements" from PUBLIC, "anon", "authenticated", "service_role", "postgres";

grant INSERT on TABLE "public"."affiliate_achievements" to "postgres";

grant SELECT on TABLE "public"."affiliate_achievements" to "postgres";

grant UPDATE on TABLE "public"."affiliate_achievements" to "postgres";

grant DELETE on TABLE "public"."affiliate_achievements" to "postgres";

grant TRUNCATE on TABLE "public"."affiliate_achievements" to "postgres";

grant REFERENCES on TABLE "public"."affiliate_achievements" to "postgres";

grant TRIGGER on TABLE "public"."affiliate_achievements" to "postgres";

grant MAINTAIN on TABLE "public"."affiliate_achievements" to "postgres";

grant INSERT on TABLE "public"."affiliate_achievements" to "anon";

grant SELECT on TABLE "public"."affiliate_achievements" to "anon";

grant UPDATE on TABLE "public"."affiliate_achievements" to "anon";

grant DELETE on TABLE "public"."affiliate_achievements" to "anon";

grant TRUNCATE on TABLE "public"."affiliate_achievements" to "anon";

grant REFERENCES on TABLE "public"."affiliate_achievements" to "anon";

grant TRIGGER on TABLE "public"."affiliate_achievements" to "anon";

grant MAINTAIN on TABLE "public"."affiliate_achievements" to "anon";

grant INSERT on TABLE "public"."affiliate_achievements" to "authenticated";

grant SELECT on TABLE "public"."affiliate_achievements" to "authenticated";

grant UPDATE on TABLE "public"."affiliate_achievements" to "authenticated";

grant DELETE on TABLE "public"."affiliate_achievements" to "authenticated";

grant TRUNCATE on TABLE "public"."affiliate_achievements" to "authenticated";

grant REFERENCES on TABLE "public"."affiliate_achievements" to "authenticated";

grant TRIGGER on TABLE "public"."affiliate_achievements" to "authenticated";

grant MAINTAIN on TABLE "public"."affiliate_achievements" to "authenticated";

grant INSERT on TABLE "public"."affiliate_achievements" to "service_role";

grant SELECT on TABLE "public"."affiliate_achievements" to "service_role";

grant UPDATE on TABLE "public"."affiliate_achievements" to "service_role";

grant DELETE on TABLE "public"."affiliate_achievements" to "service_role";

grant TRUNCATE on TABLE "public"."affiliate_achievements" to "service_role";

grant REFERENCES on TABLE "public"."affiliate_achievements" to "service_role";

grant TRIGGER on TABLE "public"."affiliate_achievements" to "service_role";

grant MAINTAIN on TABLE "public"."affiliate_achievements" to "service_role";

revoke all privileges on TABLE "public"."affiliate_activity_events" from PUBLIC, "anon", "authenticated", "service_role", "postgres";

grant INSERT on TABLE "public"."affiliate_activity_events" to "postgres";

grant SELECT on TABLE "public"."affiliate_activity_events" to "postgres";

grant UPDATE on TABLE "public"."affiliate_activity_events" to "postgres";

grant DELETE on TABLE "public"."affiliate_activity_events" to "postgres";

grant TRUNCATE on TABLE "public"."affiliate_activity_events" to "postgres";

grant REFERENCES on TABLE "public"."affiliate_activity_events" to "postgres";

grant TRIGGER on TABLE "public"."affiliate_activity_events" to "postgres";

grant MAINTAIN on TABLE "public"."affiliate_activity_events" to "postgres";

grant INSERT on TABLE "public"."affiliate_activity_events" to "anon";

grant SELECT on TABLE "public"."affiliate_activity_events" to "anon";

grant UPDATE on TABLE "public"."affiliate_activity_events" to "anon";

grant DELETE on TABLE "public"."affiliate_activity_events" to "anon";

grant TRUNCATE on TABLE "public"."affiliate_activity_events" to "anon";

grant REFERENCES on TABLE "public"."affiliate_activity_events" to "anon";

grant TRIGGER on TABLE "public"."affiliate_activity_events" to "anon";

grant MAINTAIN on TABLE "public"."affiliate_activity_events" to "anon";

grant INSERT on TABLE "public"."affiliate_activity_events" to "authenticated";

grant SELECT on TABLE "public"."affiliate_activity_events" to "authenticated";

grant UPDATE on TABLE "public"."affiliate_activity_events" to "authenticated";

grant DELETE on TABLE "public"."affiliate_activity_events" to "authenticated";

grant TRUNCATE on TABLE "public"."affiliate_activity_events" to "authenticated";

grant REFERENCES on TABLE "public"."affiliate_activity_events" to "authenticated";

grant TRIGGER on TABLE "public"."affiliate_activity_events" to "authenticated";

grant MAINTAIN on TABLE "public"."affiliate_activity_events" to "authenticated";

grant INSERT on TABLE "public"."affiliate_activity_events" to "service_role";

grant SELECT on TABLE "public"."affiliate_activity_events" to "service_role";

grant UPDATE on TABLE "public"."affiliate_activity_events" to "service_role";

grant DELETE on TABLE "public"."affiliate_activity_events" to "service_role";

grant TRUNCATE on TABLE "public"."affiliate_activity_events" to "service_role";

grant REFERENCES on TABLE "public"."affiliate_activity_events" to "service_role";

grant TRIGGER on TABLE "public"."affiliate_activity_events" to "service_role";

grant MAINTAIN on TABLE "public"."affiliate_activity_events" to "service_role";

revoke all privileges on TABLE "public"."affiliate_announcements" from PUBLIC, "anon", "authenticated", "service_role", "postgres";

grant INSERT on TABLE "public"."affiliate_announcements" to "postgres";

grant SELECT on TABLE "public"."affiliate_announcements" to "postgres";

grant UPDATE on TABLE "public"."affiliate_announcements" to "postgres";

grant DELETE on TABLE "public"."affiliate_announcements" to "postgres";

grant TRUNCATE on TABLE "public"."affiliate_announcements" to "postgres";

grant REFERENCES on TABLE "public"."affiliate_announcements" to "postgres";

grant TRIGGER on TABLE "public"."affiliate_announcements" to "postgres";

grant MAINTAIN on TABLE "public"."affiliate_announcements" to "postgres";

grant INSERT on TABLE "public"."affiliate_announcements" to "anon";

grant SELECT on TABLE "public"."affiliate_announcements" to "anon";

grant UPDATE on TABLE "public"."affiliate_announcements" to "anon";

grant DELETE on TABLE "public"."affiliate_announcements" to "anon";

grant TRUNCATE on TABLE "public"."affiliate_announcements" to "anon";

grant REFERENCES on TABLE "public"."affiliate_announcements" to "anon";

grant TRIGGER on TABLE "public"."affiliate_announcements" to "anon";

grant MAINTAIN on TABLE "public"."affiliate_announcements" to "anon";

grant INSERT on TABLE "public"."affiliate_announcements" to "authenticated";

grant SELECT on TABLE "public"."affiliate_announcements" to "authenticated";

grant UPDATE on TABLE "public"."affiliate_announcements" to "authenticated";

grant DELETE on TABLE "public"."affiliate_announcements" to "authenticated";

grant TRUNCATE on TABLE "public"."affiliate_announcements" to "authenticated";

grant REFERENCES on TABLE "public"."affiliate_announcements" to "authenticated";

grant TRIGGER on TABLE "public"."affiliate_announcements" to "authenticated";

grant MAINTAIN on TABLE "public"."affiliate_announcements" to "authenticated";

grant INSERT on TABLE "public"."affiliate_announcements" to "service_role";

grant SELECT on TABLE "public"."affiliate_announcements" to "service_role";

grant UPDATE on TABLE "public"."affiliate_announcements" to "service_role";

grant DELETE on TABLE "public"."affiliate_announcements" to "service_role";

grant TRUNCATE on TABLE "public"."affiliate_announcements" to "service_role";

grant REFERENCES on TABLE "public"."affiliate_announcements" to "service_role";

grant TRIGGER on TABLE "public"."affiliate_announcements" to "service_role";

grant MAINTAIN on TABLE "public"."affiliate_announcements" to "service_role";

revoke all privileges on TABLE "public"."affiliate_audit_logs" from PUBLIC, "anon", "authenticated", "service_role", "postgres";

grant INSERT on TABLE "public"."affiliate_audit_logs" to "postgres";

grant SELECT on TABLE "public"."affiliate_audit_logs" to "postgres";

grant UPDATE on TABLE "public"."affiliate_audit_logs" to "postgres";

grant DELETE on TABLE "public"."affiliate_audit_logs" to "postgres";

grant TRUNCATE on TABLE "public"."affiliate_audit_logs" to "postgres";

grant REFERENCES on TABLE "public"."affiliate_audit_logs" to "postgres";

grant TRIGGER on TABLE "public"."affiliate_audit_logs" to "postgres";

grant MAINTAIN on TABLE "public"."affiliate_audit_logs" to "postgres";

grant INSERT on TABLE "public"."affiliate_audit_logs" to "service_role";

grant SELECT on TABLE "public"."affiliate_audit_logs" to "service_role";

grant UPDATE on TABLE "public"."affiliate_audit_logs" to "service_role";

grant DELETE on TABLE "public"."affiliate_audit_logs" to "service_role";

grant TRUNCATE on TABLE "public"."affiliate_audit_logs" to "service_role";

grant REFERENCES on TABLE "public"."affiliate_audit_logs" to "service_role";

grant TRIGGER on TABLE "public"."affiliate_audit_logs" to "service_role";

grant MAINTAIN on TABLE "public"."affiliate_audit_logs" to "service_role";

revoke all privileges on TABLE "public"."affiliate_certifications" from PUBLIC, "anon", "authenticated", "service_role", "postgres";

grant INSERT on TABLE "public"."affiliate_certifications" to "postgres";

grant SELECT on TABLE "public"."affiliate_certifications" to "postgres";

grant UPDATE on TABLE "public"."affiliate_certifications" to "postgres";

grant DELETE on TABLE "public"."affiliate_certifications" to "postgres";

grant TRUNCATE on TABLE "public"."affiliate_certifications" to "postgres";

grant REFERENCES on TABLE "public"."affiliate_certifications" to "postgres";

grant TRIGGER on TABLE "public"."affiliate_certifications" to "postgres";

grant MAINTAIN on TABLE "public"."affiliate_certifications" to "postgres";

grant INSERT on TABLE "public"."affiliate_certifications" to "anon";

grant SELECT on TABLE "public"."affiliate_certifications" to "anon";

grant UPDATE on TABLE "public"."affiliate_certifications" to "anon";

grant DELETE on TABLE "public"."affiliate_certifications" to "anon";

grant TRUNCATE on TABLE "public"."affiliate_certifications" to "anon";

grant REFERENCES on TABLE "public"."affiliate_certifications" to "anon";

grant TRIGGER on TABLE "public"."affiliate_certifications" to "anon";

grant MAINTAIN on TABLE "public"."affiliate_certifications" to "anon";

grant INSERT on TABLE "public"."affiliate_certifications" to "authenticated";

grant SELECT on TABLE "public"."affiliate_certifications" to "authenticated";

grant UPDATE on TABLE "public"."affiliate_certifications" to "authenticated";

grant DELETE on TABLE "public"."affiliate_certifications" to "authenticated";

grant TRUNCATE on TABLE "public"."affiliate_certifications" to "authenticated";

grant REFERENCES on TABLE "public"."affiliate_certifications" to "authenticated";

grant TRIGGER on TABLE "public"."affiliate_certifications" to "authenticated";

grant MAINTAIN on TABLE "public"."affiliate_certifications" to "authenticated";

grant INSERT on TABLE "public"."affiliate_certifications" to "service_role";

grant SELECT on TABLE "public"."affiliate_certifications" to "service_role";

grant UPDATE on TABLE "public"."affiliate_certifications" to "service_role";

grant DELETE on TABLE "public"."affiliate_certifications" to "service_role";

grant TRUNCATE on TABLE "public"."affiliate_certifications" to "service_role";

grant REFERENCES on TABLE "public"."affiliate_certifications" to "service_role";

grant TRIGGER on TABLE "public"."affiliate_certifications" to "service_role";

grant MAINTAIN on TABLE "public"."affiliate_certifications" to "service_role";

revoke all privileges on TABLE "public"."affiliate_clicks" from PUBLIC, "anon", "authenticated", "service_role", "postgres";

grant INSERT on TABLE "public"."affiliate_clicks" to "postgres";

grant SELECT on TABLE "public"."affiliate_clicks" to "postgres";

grant UPDATE on TABLE "public"."affiliate_clicks" to "postgres";

grant DELETE on TABLE "public"."affiliate_clicks" to "postgres";

grant TRUNCATE on TABLE "public"."affiliate_clicks" to "postgres";

grant REFERENCES on TABLE "public"."affiliate_clicks" to "postgres";

grant TRIGGER on TABLE "public"."affiliate_clicks" to "postgres";

grant MAINTAIN on TABLE "public"."affiliate_clicks" to "postgres";

grant INSERT on TABLE "public"."affiliate_clicks" to "service_role";

grant SELECT on TABLE "public"."affiliate_clicks" to "service_role";

grant UPDATE on TABLE "public"."affiliate_clicks" to "service_role";

grant DELETE on TABLE "public"."affiliate_clicks" to "service_role";

grant TRUNCATE on TABLE "public"."affiliate_clicks" to "service_role";

grant REFERENCES on TABLE "public"."affiliate_clicks" to "service_role";

grant TRIGGER on TABLE "public"."affiliate_clicks" to "service_role";

grant MAINTAIN on TABLE "public"."affiliate_clicks" to "service_role";

revoke all privileges on TABLE "public"."affiliate_commissions" from PUBLIC, "anon", "authenticated", "service_role", "postgres";

grant INSERT on TABLE "public"."affiliate_commissions" to "postgres";

grant SELECT on TABLE "public"."affiliate_commissions" to "postgres";

grant UPDATE on TABLE "public"."affiliate_commissions" to "postgres";

grant DELETE on TABLE "public"."affiliate_commissions" to "postgres";

grant TRUNCATE on TABLE "public"."affiliate_commissions" to "postgres";

grant REFERENCES on TABLE "public"."affiliate_commissions" to "postgres";

grant TRIGGER on TABLE "public"."affiliate_commissions" to "postgres";

grant MAINTAIN on TABLE "public"."affiliate_commissions" to "postgres";

grant INSERT on TABLE "public"."affiliate_commissions" to "service_role";

grant SELECT on TABLE "public"."affiliate_commissions" to "service_role";

grant UPDATE on TABLE "public"."affiliate_commissions" to "service_role";

grant DELETE on TABLE "public"."affiliate_commissions" to "service_role";

grant TRUNCATE on TABLE "public"."affiliate_commissions" to "service_role";

grant REFERENCES on TABLE "public"."affiliate_commissions" to "service_role";

grant TRIGGER on TABLE "public"."affiliate_commissions" to "service_role";

grant MAINTAIN on TABLE "public"."affiliate_commissions" to "service_role";

grant SELECT on TABLE "public"."affiliate_commissions" to "authenticated";

revoke all privileges on TABLE "public"."affiliate_course_progress" from PUBLIC, "anon", "authenticated", "service_role", "postgres";

grant INSERT on TABLE "public"."affiliate_course_progress" to "postgres";

grant SELECT on TABLE "public"."affiliate_course_progress" to "postgres";

grant UPDATE on TABLE "public"."affiliate_course_progress" to "postgres";

grant DELETE on TABLE "public"."affiliate_course_progress" to "postgres";

grant TRUNCATE on TABLE "public"."affiliate_course_progress" to "postgres";

grant REFERENCES on TABLE "public"."affiliate_course_progress" to "postgres";

grant TRIGGER on TABLE "public"."affiliate_course_progress" to "postgres";

grant MAINTAIN on TABLE "public"."affiliate_course_progress" to "postgres";

grant INSERT on TABLE "public"."affiliate_course_progress" to "anon";

grant SELECT on TABLE "public"."affiliate_course_progress" to "anon";

grant UPDATE on TABLE "public"."affiliate_course_progress" to "anon";

grant DELETE on TABLE "public"."affiliate_course_progress" to "anon";

grant TRUNCATE on TABLE "public"."affiliate_course_progress" to "anon";

grant REFERENCES on TABLE "public"."affiliate_course_progress" to "anon";

grant TRIGGER on TABLE "public"."affiliate_course_progress" to "anon";

grant MAINTAIN on TABLE "public"."affiliate_course_progress" to "anon";

grant INSERT on TABLE "public"."affiliate_course_progress" to "authenticated";

grant SELECT on TABLE "public"."affiliate_course_progress" to "authenticated";

grant UPDATE on TABLE "public"."affiliate_course_progress" to "authenticated";

grant DELETE on TABLE "public"."affiliate_course_progress" to "authenticated";

grant TRUNCATE on TABLE "public"."affiliate_course_progress" to "authenticated";

grant REFERENCES on TABLE "public"."affiliate_course_progress" to "authenticated";

grant TRIGGER on TABLE "public"."affiliate_course_progress" to "authenticated";

grant MAINTAIN on TABLE "public"."affiliate_course_progress" to "authenticated";

grant INSERT on TABLE "public"."affiliate_course_progress" to "service_role";

grant SELECT on TABLE "public"."affiliate_course_progress" to "service_role";

grant UPDATE on TABLE "public"."affiliate_course_progress" to "service_role";

grant DELETE on TABLE "public"."affiliate_course_progress" to "service_role";

grant TRUNCATE on TABLE "public"."affiliate_course_progress" to "service_role";

grant REFERENCES on TABLE "public"."affiliate_course_progress" to "service_role";

grant TRIGGER on TABLE "public"."affiliate_course_progress" to "service_role";

grant MAINTAIN on TABLE "public"."affiliate_course_progress" to "service_role";

revoke all privileges on TABLE "public"."affiliate_goals" from PUBLIC, "anon", "authenticated", "service_role", "postgres";

grant INSERT on TABLE "public"."affiliate_goals" to "postgres";

grant SELECT on TABLE "public"."affiliate_goals" to "postgres";

grant UPDATE on TABLE "public"."affiliate_goals" to "postgres";

grant DELETE on TABLE "public"."affiliate_goals" to "postgres";

grant TRUNCATE on TABLE "public"."affiliate_goals" to "postgres";

grant REFERENCES on TABLE "public"."affiliate_goals" to "postgres";

grant TRIGGER on TABLE "public"."affiliate_goals" to "postgres";

grant MAINTAIN on TABLE "public"."affiliate_goals" to "postgres";

grant INSERT on TABLE "public"."affiliate_goals" to "anon";

grant SELECT on TABLE "public"."affiliate_goals" to "anon";

grant UPDATE on TABLE "public"."affiliate_goals" to "anon";

grant DELETE on TABLE "public"."affiliate_goals" to "anon";

grant TRUNCATE on TABLE "public"."affiliate_goals" to "anon";

grant REFERENCES on TABLE "public"."affiliate_goals" to "anon";

grant TRIGGER on TABLE "public"."affiliate_goals" to "anon";

grant MAINTAIN on TABLE "public"."affiliate_goals" to "anon";

grant INSERT on TABLE "public"."affiliate_goals" to "authenticated";

grant SELECT on TABLE "public"."affiliate_goals" to "authenticated";

grant UPDATE on TABLE "public"."affiliate_goals" to "authenticated";

grant DELETE on TABLE "public"."affiliate_goals" to "authenticated";

grant TRUNCATE on TABLE "public"."affiliate_goals" to "authenticated";

grant REFERENCES on TABLE "public"."affiliate_goals" to "authenticated";

grant TRIGGER on TABLE "public"."affiliate_goals" to "authenticated";

grant MAINTAIN on TABLE "public"."affiliate_goals" to "authenticated";

grant INSERT on TABLE "public"."affiliate_goals" to "service_role";

grant SELECT on TABLE "public"."affiliate_goals" to "service_role";

grant UPDATE on TABLE "public"."affiliate_goals" to "service_role";

grant DELETE on TABLE "public"."affiliate_goals" to "service_role";

grant TRUNCATE on TABLE "public"."affiliate_goals" to "service_role";

grant REFERENCES on TABLE "public"."affiliate_goals" to "service_role";

grant TRIGGER on TABLE "public"."affiliate_goals" to "service_role";

grant MAINTAIN on TABLE "public"."affiliate_goals" to "service_role";

revoke all privileges on TABLE "public"."affiliate_leads" from PUBLIC, "anon", "authenticated", "service_role", "postgres";

grant INSERT on TABLE "public"."affiliate_leads" to "postgres";

grant SELECT on TABLE "public"."affiliate_leads" to "postgres";

grant UPDATE on TABLE "public"."affiliate_leads" to "postgres";

grant DELETE on TABLE "public"."affiliate_leads" to "postgres";

grant TRUNCATE on TABLE "public"."affiliate_leads" to "postgres";

grant REFERENCES on TABLE "public"."affiliate_leads" to "postgres";

grant TRIGGER on TABLE "public"."affiliate_leads" to "postgres";

grant MAINTAIN on TABLE "public"."affiliate_leads" to "postgres";

grant INSERT on TABLE "public"."affiliate_leads" to "anon";

grant SELECT on TABLE "public"."affiliate_leads" to "anon";

grant UPDATE on TABLE "public"."affiliate_leads" to "anon";

grant DELETE on TABLE "public"."affiliate_leads" to "anon";

grant TRUNCATE on TABLE "public"."affiliate_leads" to "anon";

grant REFERENCES on TABLE "public"."affiliate_leads" to "anon";

grant TRIGGER on TABLE "public"."affiliate_leads" to "anon";

grant MAINTAIN on TABLE "public"."affiliate_leads" to "anon";

grant INSERT on TABLE "public"."affiliate_leads" to "authenticated";

grant SELECT on TABLE "public"."affiliate_leads" to "authenticated";

grant UPDATE on TABLE "public"."affiliate_leads" to "authenticated";

grant DELETE on TABLE "public"."affiliate_leads" to "authenticated";

grant TRUNCATE on TABLE "public"."affiliate_leads" to "authenticated";

grant REFERENCES on TABLE "public"."affiliate_leads" to "authenticated";

grant TRIGGER on TABLE "public"."affiliate_leads" to "authenticated";

grant MAINTAIN on TABLE "public"."affiliate_leads" to "authenticated";

grant INSERT on TABLE "public"."affiliate_leads" to "service_role";

grant SELECT on TABLE "public"."affiliate_leads" to "service_role";

grant UPDATE on TABLE "public"."affiliate_leads" to "service_role";

grant DELETE on TABLE "public"."affiliate_leads" to "service_role";

grant TRUNCATE on TABLE "public"."affiliate_leads" to "service_role";

grant REFERENCES on TABLE "public"."affiliate_leads" to "service_role";

grant TRIGGER on TABLE "public"."affiliate_leads" to "service_role";

grant MAINTAIN on TABLE "public"."affiliate_leads" to "service_role";

revoke all privileges on TABLE "public"."affiliate_payout_items" from PUBLIC, "anon", "authenticated", "service_role", "postgres";

grant INSERT on TABLE "public"."affiliate_payout_items" to "postgres";

grant SELECT on TABLE "public"."affiliate_payout_items" to "postgres";

grant UPDATE on TABLE "public"."affiliate_payout_items" to "postgres";

grant DELETE on TABLE "public"."affiliate_payout_items" to "postgres";

grant TRUNCATE on TABLE "public"."affiliate_payout_items" to "postgres";

grant REFERENCES on TABLE "public"."affiliate_payout_items" to "postgres";

grant TRIGGER on TABLE "public"."affiliate_payout_items" to "postgres";

grant MAINTAIN on TABLE "public"."affiliate_payout_items" to "postgres";

grant INSERT on TABLE "public"."affiliate_payout_items" to "service_role";

grant SELECT on TABLE "public"."affiliate_payout_items" to "service_role";

grant UPDATE on TABLE "public"."affiliate_payout_items" to "service_role";

grant DELETE on TABLE "public"."affiliate_payout_items" to "service_role";

grant TRUNCATE on TABLE "public"."affiliate_payout_items" to "service_role";

grant REFERENCES on TABLE "public"."affiliate_payout_items" to "service_role";

grant TRIGGER on TABLE "public"."affiliate_payout_items" to "service_role";

grant MAINTAIN on TABLE "public"."affiliate_payout_items" to "service_role";

revoke all privileges on TABLE "public"."affiliate_payouts" from PUBLIC, "anon", "authenticated", "service_role", "postgres";

grant INSERT on TABLE "public"."affiliate_payouts" to "postgres";

grant SELECT on TABLE "public"."affiliate_payouts" to "postgres";

grant UPDATE on TABLE "public"."affiliate_payouts" to "postgres";

grant DELETE on TABLE "public"."affiliate_payouts" to "postgres";

grant TRUNCATE on TABLE "public"."affiliate_payouts" to "postgres";

grant REFERENCES on TABLE "public"."affiliate_payouts" to "postgres";

grant TRIGGER on TABLE "public"."affiliate_payouts" to "postgres";

grant MAINTAIN on TABLE "public"."affiliate_payouts" to "postgres";

grant INSERT on TABLE "public"."affiliate_payouts" to "service_role";

grant SELECT on TABLE "public"."affiliate_payouts" to "service_role";

grant UPDATE on TABLE "public"."affiliate_payouts" to "service_role";

grant DELETE on TABLE "public"."affiliate_payouts" to "service_role";

grant TRUNCATE on TABLE "public"."affiliate_payouts" to "service_role";

grant REFERENCES on TABLE "public"."affiliate_payouts" to "service_role";

grant TRIGGER on TABLE "public"."affiliate_payouts" to "service_role";

grant MAINTAIN on TABLE "public"."affiliate_payouts" to "service_role";

grant SELECT on TABLE "public"."affiliate_payouts" to "authenticated";

revoke all privileges on TABLE "public"."affiliate_profiles" from PUBLIC, "anon", "authenticated", "service_role", "postgres";

grant INSERT on TABLE "public"."affiliate_profiles" to "postgres";

grant SELECT on TABLE "public"."affiliate_profiles" to "postgres";

grant UPDATE on TABLE "public"."affiliate_profiles" to "postgres";

grant DELETE on TABLE "public"."affiliate_profiles" to "postgres";

grant TRUNCATE on TABLE "public"."affiliate_profiles" to "postgres";

grant REFERENCES on TABLE "public"."affiliate_profiles" to "postgres";

grant TRIGGER on TABLE "public"."affiliate_profiles" to "postgres";

grant MAINTAIN on TABLE "public"."affiliate_profiles" to "postgres";

grant INSERT on TABLE "public"."affiliate_profiles" to "service_role";

grant SELECT on TABLE "public"."affiliate_profiles" to "service_role";

grant UPDATE on TABLE "public"."affiliate_profiles" to "service_role";

grant DELETE on TABLE "public"."affiliate_profiles" to "service_role";

grant TRUNCATE on TABLE "public"."affiliate_profiles" to "service_role";

grant REFERENCES on TABLE "public"."affiliate_profiles" to "service_role";

grant TRIGGER on TABLE "public"."affiliate_profiles" to "service_role";

grant MAINTAIN on TABLE "public"."affiliate_profiles" to "service_role";

grant SELECT on TABLE "public"."affiliate_profiles" to "authenticated";

revoke all privileges on TABLE "public"."affiliate_program_settings" from PUBLIC, "anon", "authenticated", "service_role", "postgres";

grant INSERT on TABLE "public"."affiliate_program_settings" to "postgres";

grant SELECT on TABLE "public"."affiliate_program_settings" to "postgres";

grant UPDATE on TABLE "public"."affiliate_program_settings" to "postgres";

grant DELETE on TABLE "public"."affiliate_program_settings" to "postgres";

grant TRUNCATE on TABLE "public"."affiliate_program_settings" to "postgres";

grant REFERENCES on TABLE "public"."affiliate_program_settings" to "postgres";

grant TRIGGER on TABLE "public"."affiliate_program_settings" to "postgres";

grant MAINTAIN on TABLE "public"."affiliate_program_settings" to "postgres";

grant INSERT on TABLE "public"."affiliate_program_settings" to "service_role";

grant SELECT on TABLE "public"."affiliate_program_settings" to "service_role";

grant UPDATE on TABLE "public"."affiliate_program_settings" to "service_role";

grant DELETE on TABLE "public"."affiliate_program_settings" to "service_role";

grant TRUNCATE on TABLE "public"."affiliate_program_settings" to "service_role";

grant REFERENCES on TABLE "public"."affiliate_program_settings" to "service_role";

grant TRIGGER on TABLE "public"."affiliate_program_settings" to "service_role";

grant MAINTAIN on TABLE "public"."affiliate_program_settings" to "service_role";

revoke all privileges on TABLE "public"."affiliate_referrals" from PUBLIC, "anon", "authenticated", "service_role", "postgres";

grant INSERT on TABLE "public"."affiliate_referrals" to "postgres";

grant SELECT on TABLE "public"."affiliate_referrals" to "postgres";

grant UPDATE on TABLE "public"."affiliate_referrals" to "postgres";

grant DELETE on TABLE "public"."affiliate_referrals" to "postgres";

grant TRUNCATE on TABLE "public"."affiliate_referrals" to "postgres";

grant REFERENCES on TABLE "public"."affiliate_referrals" to "postgres";

grant TRIGGER on TABLE "public"."affiliate_referrals" to "postgres";

grant MAINTAIN on TABLE "public"."affiliate_referrals" to "postgres";

grant INSERT on TABLE "public"."affiliate_referrals" to "service_role";

grant SELECT on TABLE "public"."affiliate_referrals" to "service_role";

grant UPDATE on TABLE "public"."affiliate_referrals" to "service_role";

grant DELETE on TABLE "public"."affiliate_referrals" to "service_role";

grant TRUNCATE on TABLE "public"."affiliate_referrals" to "service_role";

grant REFERENCES on TABLE "public"."affiliate_referrals" to "service_role";

grant TRIGGER on TABLE "public"."affiliate_referrals" to "service_role";

grant MAINTAIN on TABLE "public"."affiliate_referrals" to "service_role";

grant SELECT on TABLE "public"."affiliate_referrals" to "authenticated";

revoke all privileges on TABLE "public"."affiliate_tasks" from PUBLIC, "anon", "authenticated", "service_role", "postgres";

grant INSERT on TABLE "public"."affiliate_tasks" to "postgres";

grant SELECT on TABLE "public"."affiliate_tasks" to "postgres";

grant UPDATE on TABLE "public"."affiliate_tasks" to "postgres";

grant DELETE on TABLE "public"."affiliate_tasks" to "postgres";

grant TRUNCATE on TABLE "public"."affiliate_tasks" to "postgres";

grant REFERENCES on TABLE "public"."affiliate_tasks" to "postgres";

grant TRIGGER on TABLE "public"."affiliate_tasks" to "postgres";

grant MAINTAIN on TABLE "public"."affiliate_tasks" to "postgres";

grant INSERT on TABLE "public"."affiliate_tasks" to "anon";

grant SELECT on TABLE "public"."affiliate_tasks" to "anon";

grant UPDATE on TABLE "public"."affiliate_tasks" to "anon";

grant DELETE on TABLE "public"."affiliate_tasks" to "anon";

grant TRUNCATE on TABLE "public"."affiliate_tasks" to "anon";

grant REFERENCES on TABLE "public"."affiliate_tasks" to "anon";

grant TRIGGER on TABLE "public"."affiliate_tasks" to "anon";

grant MAINTAIN on TABLE "public"."affiliate_tasks" to "anon";

grant INSERT on TABLE "public"."affiliate_tasks" to "authenticated";

grant SELECT on TABLE "public"."affiliate_tasks" to "authenticated";

grant UPDATE on TABLE "public"."affiliate_tasks" to "authenticated";

grant DELETE on TABLE "public"."affiliate_tasks" to "authenticated";

grant TRUNCATE on TABLE "public"."affiliate_tasks" to "authenticated";

grant REFERENCES on TABLE "public"."affiliate_tasks" to "authenticated";

grant TRIGGER on TABLE "public"."affiliate_tasks" to "authenticated";

grant MAINTAIN on TABLE "public"."affiliate_tasks" to "authenticated";

grant INSERT on TABLE "public"."affiliate_tasks" to "service_role";

grant SELECT on TABLE "public"."affiliate_tasks" to "service_role";

grant UPDATE on TABLE "public"."affiliate_tasks" to "service_role";

grant DELETE on TABLE "public"."affiliate_tasks" to "service_role";

grant TRUNCATE on TABLE "public"."affiliate_tasks" to "service_role";

grant REFERENCES on TABLE "public"."affiliate_tasks" to "service_role";

grant TRIGGER on TABLE "public"."affiliate_tasks" to "service_role";

grant MAINTAIN on TABLE "public"."affiliate_tasks" to "service_role";

revoke all privileges on TABLE "public"."affiliate_training_sessions" from PUBLIC, "anon", "authenticated", "service_role", "postgres";

grant INSERT on TABLE "public"."affiliate_training_sessions" to "postgres";

grant SELECT on TABLE "public"."affiliate_training_sessions" to "postgres";

grant UPDATE on TABLE "public"."affiliate_training_sessions" to "postgres";

grant DELETE on TABLE "public"."affiliate_training_sessions" to "postgres";

grant TRUNCATE on TABLE "public"."affiliate_training_sessions" to "postgres";

grant REFERENCES on TABLE "public"."affiliate_training_sessions" to "postgres";

grant TRIGGER on TABLE "public"."affiliate_training_sessions" to "postgres";

grant MAINTAIN on TABLE "public"."affiliate_training_sessions" to "postgres";

grant INSERT on TABLE "public"."affiliate_training_sessions" to "anon";

grant SELECT on TABLE "public"."affiliate_training_sessions" to "anon";

grant UPDATE on TABLE "public"."affiliate_training_sessions" to "anon";

grant DELETE on TABLE "public"."affiliate_training_sessions" to "anon";

grant TRUNCATE on TABLE "public"."affiliate_training_sessions" to "anon";

grant REFERENCES on TABLE "public"."affiliate_training_sessions" to "anon";

grant TRIGGER on TABLE "public"."affiliate_training_sessions" to "anon";

grant MAINTAIN on TABLE "public"."affiliate_training_sessions" to "anon";

grant INSERT on TABLE "public"."affiliate_training_sessions" to "authenticated";

grant SELECT on TABLE "public"."affiliate_training_sessions" to "authenticated";

grant UPDATE on TABLE "public"."affiliate_training_sessions" to "authenticated";

grant DELETE on TABLE "public"."affiliate_training_sessions" to "authenticated";

grant TRUNCATE on TABLE "public"."affiliate_training_sessions" to "authenticated";

grant REFERENCES on TABLE "public"."affiliate_training_sessions" to "authenticated";

grant TRIGGER on TABLE "public"."affiliate_training_sessions" to "authenticated";

grant MAINTAIN on TABLE "public"."affiliate_training_sessions" to "authenticated";

grant INSERT on TABLE "public"."affiliate_training_sessions" to "service_role";

grant SELECT on TABLE "public"."affiliate_training_sessions" to "service_role";

grant UPDATE on TABLE "public"."affiliate_training_sessions" to "service_role";

grant DELETE on TABLE "public"."affiliate_training_sessions" to "service_role";

grant TRUNCATE on TABLE "public"."affiliate_training_sessions" to "service_role";

grant REFERENCES on TABLE "public"."affiliate_training_sessions" to "service_role";

grant TRIGGER on TABLE "public"."affiliate_training_sessions" to "service_role";

grant MAINTAIN on TABLE "public"."affiliate_training_sessions" to "service_role";

revoke all privileges on TABLE "public"."app_notifications" from PUBLIC, "anon", "authenticated", "service_role", "postgres";

grant INSERT on TABLE "public"."app_notifications" to "postgres";

grant SELECT on TABLE "public"."app_notifications" to "postgres";

grant UPDATE on TABLE "public"."app_notifications" to "postgres";

grant DELETE on TABLE "public"."app_notifications" to "postgres";

grant TRUNCATE on TABLE "public"."app_notifications" to "postgres";

grant REFERENCES on TABLE "public"."app_notifications" to "postgres";

grant TRIGGER on TABLE "public"."app_notifications" to "postgres";

grant MAINTAIN on TABLE "public"."app_notifications" to "postgres";

grant INSERT on TABLE "public"."app_notifications" to "authenticated";

grant SELECT on TABLE "public"."app_notifications" to "authenticated";

grant UPDATE on TABLE "public"."app_notifications" to "authenticated";

grant DELETE on TABLE "public"."app_notifications" to "authenticated";

grant MAINTAIN on TABLE "public"."app_notifications" to "authenticated";

grant INSERT on TABLE "public"."app_notifications" to "service_role";

grant SELECT on TABLE "public"."app_notifications" to "service_role";

grant UPDATE on TABLE "public"."app_notifications" to "service_role";

grant DELETE on TABLE "public"."app_notifications" to "service_role";

grant TRUNCATE on TABLE "public"."app_notifications" to "service_role";

grant REFERENCES on TABLE "public"."app_notifications" to "service_role";

grant TRIGGER on TABLE "public"."app_notifications" to "service_role";

grant MAINTAIN on TABLE "public"."app_notifications" to "service_role";

revoke all privileges on TABLE "public"."application_error_events" from PUBLIC, "anon", "authenticated", "service_role", "postgres";

grant INSERT on TABLE "public"."application_error_events" to "postgres";

grant SELECT on TABLE "public"."application_error_events" to "postgres";

grant UPDATE on TABLE "public"."application_error_events" to "postgres";

grant DELETE on TABLE "public"."application_error_events" to "postgres";

grant TRUNCATE on TABLE "public"."application_error_events" to "postgres";

grant REFERENCES on TABLE "public"."application_error_events" to "postgres";

grant TRIGGER on TABLE "public"."application_error_events" to "postgres";

grant MAINTAIN on TABLE "public"."application_error_events" to "postgres";

grant INSERT on TABLE "public"."application_error_events" to "service_role";

grant SELECT on TABLE "public"."application_error_events" to "service_role";

grant UPDATE on TABLE "public"."application_error_events" to "service_role";

grant DELETE on TABLE "public"."application_error_events" to "service_role";

grant TRUNCATE on TABLE "public"."application_error_events" to "service_role";

grant REFERENCES on TABLE "public"."application_error_events" to "service_role";

grant TRIGGER on TABLE "public"."application_error_events" to "service_role";

grant MAINTAIN on TABLE "public"."application_error_events" to "service_role";

revoke all privileges on TABLE "public"."art_approval_requests" from PUBLIC, "anon", "authenticated", "service_role", "postgres";

grant INSERT on TABLE "public"."art_approval_requests" to "postgres";

grant SELECT on TABLE "public"."art_approval_requests" to "postgres";

grant UPDATE on TABLE "public"."art_approval_requests" to "postgres";

grant DELETE on TABLE "public"."art_approval_requests" to "postgres";

grant TRUNCATE on TABLE "public"."art_approval_requests" to "postgres";

grant REFERENCES on TABLE "public"."art_approval_requests" to "postgres";

grant TRIGGER on TABLE "public"."art_approval_requests" to "postgres";

grant MAINTAIN on TABLE "public"."art_approval_requests" to "postgres";

grant INSERT on TABLE "public"."art_approval_requests" to "authenticated";

grant SELECT on TABLE "public"."art_approval_requests" to "authenticated";

grant UPDATE on TABLE "public"."art_approval_requests" to "authenticated";

grant DELETE on TABLE "public"."art_approval_requests" to "authenticated";

grant MAINTAIN on TABLE "public"."art_approval_requests" to "authenticated";

grant INSERT on TABLE "public"."art_approval_requests" to "service_role";

grant SELECT on TABLE "public"."art_approval_requests" to "service_role";

grant UPDATE on TABLE "public"."art_approval_requests" to "service_role";

grant DELETE on TABLE "public"."art_approval_requests" to "service_role";

grant TRUNCATE on TABLE "public"."art_approval_requests" to "service_role";

grant REFERENCES on TABLE "public"."art_approval_requests" to "service_role";

grant TRIGGER on TABLE "public"."art_approval_requests" to "service_role";

grant MAINTAIN on TABLE "public"."art_approval_requests" to "service_role";

revoke all privileges on TABLE "public"."assistant_events" from PUBLIC, "anon", "authenticated", "service_role", "postgres";

grant INSERT on TABLE "public"."assistant_events" to "postgres";

grant SELECT on TABLE "public"."assistant_events" to "postgres";

grant UPDATE on TABLE "public"."assistant_events" to "postgres";

grant DELETE on TABLE "public"."assistant_events" to "postgres";

grant TRUNCATE on TABLE "public"."assistant_events" to "postgres";

grant REFERENCES on TABLE "public"."assistant_events" to "postgres";

grant TRIGGER on TABLE "public"."assistant_events" to "postgres";

grant MAINTAIN on TABLE "public"."assistant_events" to "postgres";

grant INSERT on TABLE "public"."assistant_events" to "service_role";

grant SELECT on TABLE "public"."assistant_events" to "service_role";

grant UPDATE on TABLE "public"."assistant_events" to "service_role";

grant DELETE on TABLE "public"."assistant_events" to "service_role";

grant TRUNCATE on TABLE "public"."assistant_events" to "service_role";

grant REFERENCES on TABLE "public"."assistant_events" to "service_role";

grant TRIGGER on TABLE "public"."assistant_events" to "service_role";

grant MAINTAIN on TABLE "public"."assistant_events" to "service_role";

revoke all privileges on TABLE "public"."automation_rules" from PUBLIC, "anon", "authenticated", "service_role", "postgres";

grant INSERT on TABLE "public"."automation_rules" to "postgres";

grant SELECT on TABLE "public"."automation_rules" to "postgres";

grant UPDATE on TABLE "public"."automation_rules" to "postgres";

grant DELETE on TABLE "public"."automation_rules" to "postgres";

grant TRUNCATE on TABLE "public"."automation_rules" to "postgres";

grant REFERENCES on TABLE "public"."automation_rules" to "postgres";

grant TRIGGER on TABLE "public"."automation_rules" to "postgres";

grant MAINTAIN on TABLE "public"."automation_rules" to "postgres";

grant INSERT on TABLE "public"."automation_rules" to "service_role";

grant SELECT on TABLE "public"."automation_rules" to "service_role";

grant UPDATE on TABLE "public"."automation_rules" to "service_role";

grant DELETE on TABLE "public"."automation_rules" to "service_role";

grant TRUNCATE on TABLE "public"."automation_rules" to "service_role";

grant REFERENCES on TABLE "public"."automation_rules" to "service_role";

grant TRIGGER on TABLE "public"."automation_rules" to "service_role";

grant MAINTAIN on TABLE "public"."automation_rules" to "service_role";

revoke all privileges on TABLE "public"."automation_runs" from PUBLIC, "anon", "authenticated", "service_role", "postgres";

grant INSERT on TABLE "public"."automation_runs" to "postgres";

grant SELECT on TABLE "public"."automation_runs" to "postgres";

grant UPDATE on TABLE "public"."automation_runs" to "postgres";

grant DELETE on TABLE "public"."automation_runs" to "postgres";

grant TRUNCATE on TABLE "public"."automation_runs" to "postgres";

grant REFERENCES on TABLE "public"."automation_runs" to "postgres";

grant TRIGGER on TABLE "public"."automation_runs" to "postgres";

grant MAINTAIN on TABLE "public"."automation_runs" to "postgres";

grant INSERT on TABLE "public"."automation_runs" to "service_role";

grant SELECT on TABLE "public"."automation_runs" to "service_role";

grant UPDATE on TABLE "public"."automation_runs" to "service_role";

grant DELETE on TABLE "public"."automation_runs" to "service_role";

grant TRUNCATE on TABLE "public"."automation_runs" to "service_role";

grant REFERENCES on TABLE "public"."automation_runs" to "service_role";

grant TRIGGER on TABLE "public"."automation_runs" to "service_role";

grant MAINTAIN on TABLE "public"."automation_runs" to "service_role";

revoke all privileges on TABLE "public"."background_jobs" from PUBLIC, "anon", "authenticated", "service_role", "postgres";

grant INSERT on TABLE "public"."background_jobs" to "postgres";

grant SELECT on TABLE "public"."background_jobs" to "postgres";

grant UPDATE on TABLE "public"."background_jobs" to "postgres";

grant DELETE on TABLE "public"."background_jobs" to "postgres";

grant TRUNCATE on TABLE "public"."background_jobs" to "postgres";

grant REFERENCES on TABLE "public"."background_jobs" to "postgres";

grant TRIGGER on TABLE "public"."background_jobs" to "postgres";

grant MAINTAIN on TABLE "public"."background_jobs" to "postgres";

grant INSERT on TABLE "public"."background_jobs" to "service_role";

grant SELECT on TABLE "public"."background_jobs" to "service_role";

grant UPDATE on TABLE "public"."background_jobs" to "service_role";

grant DELETE on TABLE "public"."background_jobs" to "service_role";

grant TRUNCATE on TABLE "public"."background_jobs" to "service_role";

grant REFERENCES on TABLE "public"."background_jobs" to "service_role";

grant TRIGGER on TABLE "public"."background_jobs" to "service_role";

grant MAINTAIN on TABLE "public"."background_jobs" to "service_role";

revoke all privileges on TABLE "public"."business_hours" from PUBLIC, "anon", "authenticated", "service_role", "postgres";

grant INSERT on TABLE "public"."business_hours" to "postgres";

grant SELECT on TABLE "public"."business_hours" to "postgres";

grant UPDATE on TABLE "public"."business_hours" to "postgres";

grant DELETE on TABLE "public"."business_hours" to "postgres";

grant TRUNCATE on TABLE "public"."business_hours" to "postgres";

grant REFERENCES on TABLE "public"."business_hours" to "postgres";

grant TRIGGER on TABLE "public"."business_hours" to "postgres";

grant MAINTAIN on TABLE "public"."business_hours" to "postgres";

grant INSERT on TABLE "public"."business_hours" to "authenticated";

grant SELECT on TABLE "public"."business_hours" to "authenticated";

grant UPDATE on TABLE "public"."business_hours" to "authenticated";

grant DELETE on TABLE "public"."business_hours" to "authenticated";

grant MAINTAIN on TABLE "public"."business_hours" to "authenticated";

grant INSERT on TABLE "public"."business_hours" to "service_role";

grant SELECT on TABLE "public"."business_hours" to "service_role";

grant UPDATE on TABLE "public"."business_hours" to "service_role";

grant DELETE on TABLE "public"."business_hours" to "service_role";

grant TRUNCATE on TABLE "public"."business_hours" to "service_role";

grant REFERENCES on TABLE "public"."business_hours" to "service_role";

grant TRIGGER on TABLE "public"."business_hours" to "service_role";

grant MAINTAIN on TABLE "public"."business_hours" to "service_role";

revoke all privileges on TABLE "public"."companies" from PUBLIC, "anon", "authenticated", "service_role", "postgres";

grant INSERT on TABLE "public"."companies" to "postgres";

grant SELECT on TABLE "public"."companies" to "postgres";

grant UPDATE on TABLE "public"."companies" to "postgres";

grant DELETE on TABLE "public"."companies" to "postgres";

grant TRUNCATE on TABLE "public"."companies" to "postgres";

grant REFERENCES on TABLE "public"."companies" to "postgres";

grant TRIGGER on TABLE "public"."companies" to "postgres";

grant MAINTAIN on TABLE "public"."companies" to "postgres";

grant INSERT on TABLE "public"."companies" to "authenticated";

grant SELECT on TABLE "public"."companies" to "authenticated";

grant UPDATE on TABLE "public"."companies" to "authenticated";

grant DELETE on TABLE "public"."companies" to "authenticated";

grant MAINTAIN on TABLE "public"."companies" to "authenticated";

grant INSERT on TABLE "public"."companies" to "service_role";

grant SELECT on TABLE "public"."companies" to "service_role";

grant UPDATE on TABLE "public"."companies" to "service_role";

grant DELETE on TABLE "public"."companies" to "service_role";

grant TRUNCATE on TABLE "public"."companies" to "service_role";

grant REFERENCES on TABLE "public"."companies" to "service_role";

grant TRIGGER on TABLE "public"."companies" to "service_role";

grant MAINTAIN on TABLE "public"."companies" to "service_role";

revoke all privileges on TABLE "public"."company_health_snapshots" from PUBLIC, "anon", "authenticated", "service_role", "postgres";

grant INSERT on TABLE "public"."company_health_snapshots" to "postgres";

grant SELECT on TABLE "public"."company_health_snapshots" to "postgres";

grant UPDATE on TABLE "public"."company_health_snapshots" to "postgres";

grant DELETE on TABLE "public"."company_health_snapshots" to "postgres";

grant TRUNCATE on TABLE "public"."company_health_snapshots" to "postgres";

grant REFERENCES on TABLE "public"."company_health_snapshots" to "postgres";

grant TRIGGER on TABLE "public"."company_health_snapshots" to "postgres";

grant MAINTAIN on TABLE "public"."company_health_snapshots" to "postgres";

grant INSERT on TABLE "public"."company_health_snapshots" to "service_role";

grant SELECT on TABLE "public"."company_health_snapshots" to "service_role";

grant UPDATE on TABLE "public"."company_health_snapshots" to "service_role";

grant DELETE on TABLE "public"."company_health_snapshots" to "service_role";

grant TRUNCATE on TABLE "public"."company_health_snapshots" to "service_role";

grant REFERENCES on TABLE "public"."company_health_snapshots" to "service_role";

grant TRIGGER on TABLE "public"."company_health_snapshots" to "service_role";

grant MAINTAIN on TABLE "public"."company_health_snapshots" to "service_role";

revoke all privileges on SEQUENCE "public"."company_health_snapshots_id_seq" from PUBLIC, "anon", "authenticated", "service_role", "postgres";

grant SELECT on SEQUENCE "public"."company_health_snapshots_id_seq" to "postgres";

grant UPDATE on SEQUENCE "public"."company_health_snapshots_id_seq" to "postgres";

grant USAGE on SEQUENCE "public"."company_health_snapshots_id_seq" to "postgres";

grant SELECT on SEQUENCE "public"."company_health_snapshots_id_seq" to "anon";

grant UPDATE on SEQUENCE "public"."company_health_snapshots_id_seq" to "anon";

grant USAGE on SEQUENCE "public"."company_health_snapshots_id_seq" to "anon";

grant SELECT on SEQUENCE "public"."company_health_snapshots_id_seq" to "authenticated";

grant UPDATE on SEQUENCE "public"."company_health_snapshots_id_seq" to "authenticated";

grant USAGE on SEQUENCE "public"."company_health_snapshots_id_seq" to "authenticated";

grant SELECT on SEQUENCE "public"."company_health_snapshots_id_seq" to "service_role";

grant UPDATE on SEQUENCE "public"."company_health_snapshots_id_seq" to "service_role";

grant USAGE on SEQUENCE "public"."company_health_snapshots_id_seq" to "service_role";

revoke all privileges on TABLE "public"."company_members" from PUBLIC, "anon", "authenticated", "service_role", "postgres";

grant INSERT on TABLE "public"."company_members" to "postgres";

grant SELECT on TABLE "public"."company_members" to "postgres";

grant UPDATE on TABLE "public"."company_members" to "postgres";

grant DELETE on TABLE "public"."company_members" to "postgres";

grant TRUNCATE on TABLE "public"."company_members" to "postgres";

grant REFERENCES on TABLE "public"."company_members" to "postgres";

grant TRIGGER on TABLE "public"."company_members" to "postgres";

grant MAINTAIN on TABLE "public"."company_members" to "postgres";

grant INSERT on TABLE "public"."company_members" to "authenticated";

grant SELECT on TABLE "public"."company_members" to "authenticated";

grant UPDATE on TABLE "public"."company_members" to "authenticated";

grant DELETE on TABLE "public"."company_members" to "authenticated";

grant MAINTAIN on TABLE "public"."company_members" to "authenticated";

grant INSERT on TABLE "public"."company_members" to "service_role";

grant SELECT on TABLE "public"."company_members" to "service_role";

grant UPDATE on TABLE "public"."company_members" to "service_role";

grant DELETE on TABLE "public"."company_members" to "service_role";

grant TRUNCATE on TABLE "public"."company_members" to "service_role";

grant REFERENCES on TABLE "public"."company_members" to "service_role";

grant TRIGGER on TABLE "public"."company_members" to "service_role";

grant MAINTAIN on TABLE "public"."company_members" to "service_role";

revoke all privileges on TABLE "public"."company_members_public" from PUBLIC, "anon", "authenticated", "service_role", "postgres";

grant INSERT on TABLE "public"."company_members_public" to "postgres";

grant SELECT on TABLE "public"."company_members_public" to "postgres";

grant UPDATE on TABLE "public"."company_members_public" to "postgres";

grant DELETE on TABLE "public"."company_members_public" to "postgres";

grant TRUNCATE on TABLE "public"."company_members_public" to "postgres";

grant REFERENCES on TABLE "public"."company_members_public" to "postgres";

grant TRIGGER on TABLE "public"."company_members_public" to "postgres";

grant MAINTAIN on TABLE "public"."company_members_public" to "postgres";

grant SELECT on TABLE "public"."company_members_public" to "authenticated";

grant SELECT on TABLE "public"."company_members_public" to "service_role";

revoke all privileges on TABLE "public"."company_niche_templates" from PUBLIC, "anon", "authenticated", "service_role", "postgres";

grant INSERT on TABLE "public"."company_niche_templates" to "postgres";

grant SELECT on TABLE "public"."company_niche_templates" to "postgres";

grant UPDATE on TABLE "public"."company_niche_templates" to "postgres";

grant DELETE on TABLE "public"."company_niche_templates" to "postgres";

grant TRUNCATE on TABLE "public"."company_niche_templates" to "postgres";

grant REFERENCES on TABLE "public"."company_niche_templates" to "postgres";

grant TRIGGER on TABLE "public"."company_niche_templates" to "postgres";

grant MAINTAIN on TABLE "public"."company_niche_templates" to "postgres";

grant INSERT on TABLE "public"."company_niche_templates" to "authenticated";

grant SELECT on TABLE "public"."company_niche_templates" to "authenticated";

grant UPDATE on TABLE "public"."company_niche_templates" to "authenticated";

grant DELETE on TABLE "public"."company_niche_templates" to "authenticated";

grant MAINTAIN on TABLE "public"."company_niche_templates" to "authenticated";

grant INSERT on TABLE "public"."company_niche_templates" to "service_role";

grant SELECT on TABLE "public"."company_niche_templates" to "service_role";

grant UPDATE on TABLE "public"."company_niche_templates" to "service_role";

grant DELETE on TABLE "public"."company_niche_templates" to "service_role";

grant TRUNCATE on TABLE "public"."company_niche_templates" to "service_role";

grant REFERENCES on TABLE "public"."company_niche_templates" to "service_role";

grant TRIGGER on TABLE "public"."company_niche_templates" to "service_role";

grant MAINTAIN on TABLE "public"."company_niche_templates" to "service_role";

revoke all privileges on TABLE "public"."company_proposal_settings" from PUBLIC, "anon", "authenticated", "service_role", "postgres";

grant INSERT on TABLE "public"."company_proposal_settings" to "postgres";

grant SELECT on TABLE "public"."company_proposal_settings" to "postgres";

grant UPDATE on TABLE "public"."company_proposal_settings" to "postgres";

grant DELETE on TABLE "public"."company_proposal_settings" to "postgres";

grant TRUNCATE on TABLE "public"."company_proposal_settings" to "postgres";

grant REFERENCES on TABLE "public"."company_proposal_settings" to "postgres";

grant TRIGGER on TABLE "public"."company_proposal_settings" to "postgres";

grant MAINTAIN on TABLE "public"."company_proposal_settings" to "postgres";

grant INSERT on TABLE "public"."company_proposal_settings" to "authenticated";

grant SELECT on TABLE "public"."company_proposal_settings" to "authenticated";

grant UPDATE on TABLE "public"."company_proposal_settings" to "authenticated";

grant DELETE on TABLE "public"."company_proposal_settings" to "authenticated";

grant MAINTAIN on TABLE "public"."company_proposal_settings" to "authenticated";

grant INSERT on TABLE "public"."company_proposal_settings" to "service_role";

grant SELECT on TABLE "public"."company_proposal_settings" to "service_role";

grant UPDATE on TABLE "public"."company_proposal_settings" to "service_role";

grant DELETE on TABLE "public"."company_proposal_settings" to "service_role";

grant TRUNCATE on TABLE "public"."company_proposal_settings" to "service_role";

grant REFERENCES on TABLE "public"."company_proposal_settings" to "service_role";

grant TRIGGER on TABLE "public"."company_proposal_settings" to "service_role";

grant MAINTAIN on TABLE "public"."company_proposal_settings" to "service_role";

revoke all privileges on TABLE "public"."company_whatsapp_settings" from PUBLIC, "anon", "authenticated", "service_role", "postgres";

grant INSERT on TABLE "public"."company_whatsapp_settings" to "postgres";

grant SELECT on TABLE "public"."company_whatsapp_settings" to "postgres";

grant UPDATE on TABLE "public"."company_whatsapp_settings" to "postgres";

grant DELETE on TABLE "public"."company_whatsapp_settings" to "postgres";

grant TRUNCATE on TABLE "public"."company_whatsapp_settings" to "postgres";

grant REFERENCES on TABLE "public"."company_whatsapp_settings" to "postgres";

grant TRIGGER on TABLE "public"."company_whatsapp_settings" to "postgres";

grant MAINTAIN on TABLE "public"."company_whatsapp_settings" to "postgres";

grant INSERT on TABLE "public"."company_whatsapp_settings" to "authenticated";

grant SELECT on TABLE "public"."company_whatsapp_settings" to "authenticated";

grant UPDATE on TABLE "public"."company_whatsapp_settings" to "authenticated";

grant DELETE on TABLE "public"."company_whatsapp_settings" to "authenticated";

grant MAINTAIN on TABLE "public"."company_whatsapp_settings" to "authenticated";

grant INSERT on TABLE "public"."company_whatsapp_settings" to "service_role";

grant SELECT on TABLE "public"."company_whatsapp_settings" to "service_role";

grant UPDATE on TABLE "public"."company_whatsapp_settings" to "service_role";

grant DELETE on TABLE "public"."company_whatsapp_settings" to "service_role";

grant TRUNCATE on TABLE "public"."company_whatsapp_settings" to "service_role";

grant REFERENCES on TABLE "public"."company_whatsapp_settings" to "service_role";

grant TRIGGER on TABLE "public"."company_whatsapp_settings" to "service_role";

grant MAINTAIN on TABLE "public"."company_whatsapp_settings" to "service_role";

revoke all privileges on TABLE "public"."crm_leads" from PUBLIC, "anon", "authenticated", "service_role", "postgres";

grant INSERT on TABLE "public"."crm_leads" to "postgres";

grant SELECT on TABLE "public"."crm_leads" to "postgres";

grant UPDATE on TABLE "public"."crm_leads" to "postgres";

grant DELETE on TABLE "public"."crm_leads" to "postgres";

grant TRUNCATE on TABLE "public"."crm_leads" to "postgres";

grant REFERENCES on TABLE "public"."crm_leads" to "postgres";

grant TRIGGER on TABLE "public"."crm_leads" to "postgres";

grant MAINTAIN on TABLE "public"."crm_leads" to "postgres";

grant INSERT on TABLE "public"."crm_leads" to "authenticated";

grant SELECT on TABLE "public"."crm_leads" to "authenticated";

grant UPDATE on TABLE "public"."crm_leads" to "authenticated";

grant DELETE on TABLE "public"."crm_leads" to "authenticated";

grant MAINTAIN on TABLE "public"."crm_leads" to "authenticated";

grant INSERT on TABLE "public"."crm_leads" to "service_role";

grant SELECT on TABLE "public"."crm_leads" to "service_role";

grant UPDATE on TABLE "public"."crm_leads" to "service_role";

grant DELETE on TABLE "public"."crm_leads" to "service_role";

grant TRUNCATE on TABLE "public"."crm_leads" to "service_role";

grant REFERENCES on TABLE "public"."crm_leads" to "service_role";

grant TRIGGER on TABLE "public"."crm_leads" to "service_role";

grant MAINTAIN on TABLE "public"."crm_leads" to "service_role";

revoke all privileges on TABLE "public"."customer_duplicate_candidates" from PUBLIC, "anon", "authenticated", "service_role", "postgres";

grant INSERT on TABLE "public"."customer_duplicate_candidates" to "postgres";

grant SELECT on TABLE "public"."customer_duplicate_candidates" to "postgres";

grant UPDATE on TABLE "public"."customer_duplicate_candidates" to "postgres";

grant DELETE on TABLE "public"."customer_duplicate_candidates" to "postgres";

grant TRUNCATE on TABLE "public"."customer_duplicate_candidates" to "postgres";

grant REFERENCES on TABLE "public"."customer_duplicate_candidates" to "postgres";

grant TRIGGER on TABLE "public"."customer_duplicate_candidates" to "postgres";

grant MAINTAIN on TABLE "public"."customer_duplicate_candidates" to "postgres";

grant INSERT on TABLE "public"."customer_duplicate_candidates" to "service_role";

grant SELECT on TABLE "public"."customer_duplicate_candidates" to "service_role";

grant UPDATE on TABLE "public"."customer_duplicate_candidates" to "service_role";

grant DELETE on TABLE "public"."customer_duplicate_candidates" to "service_role";

grant TRUNCATE on TABLE "public"."customer_duplicate_candidates" to "service_role";

grant REFERENCES on TABLE "public"."customer_duplicate_candidates" to "service_role";

grant TRIGGER on TABLE "public"."customer_duplicate_candidates" to "service_role";

grant MAINTAIN on TABLE "public"."customer_duplicate_candidates" to "service_role";

revoke all privileges on TABLE "public"."customer_followups" from PUBLIC, "anon", "authenticated", "service_role", "postgres";

grant INSERT on TABLE "public"."customer_followups" to "postgres";

grant SELECT on TABLE "public"."customer_followups" to "postgres";

grant UPDATE on TABLE "public"."customer_followups" to "postgres";

grant DELETE on TABLE "public"."customer_followups" to "postgres";

grant TRUNCATE on TABLE "public"."customer_followups" to "postgres";

grant REFERENCES on TABLE "public"."customer_followups" to "postgres";

grant TRIGGER on TABLE "public"."customer_followups" to "postgres";

grant MAINTAIN on TABLE "public"."customer_followups" to "postgres";

grant INSERT on TABLE "public"."customer_followups" to "authenticated";

grant SELECT on TABLE "public"."customer_followups" to "authenticated";

grant UPDATE on TABLE "public"."customer_followups" to "authenticated";

grant DELETE on TABLE "public"."customer_followups" to "authenticated";

grant MAINTAIN on TABLE "public"."customer_followups" to "authenticated";

grant INSERT on TABLE "public"."customer_followups" to "service_role";

grant SELECT on TABLE "public"."customer_followups" to "service_role";

grant UPDATE on TABLE "public"."customer_followups" to "service_role";

grant DELETE on TABLE "public"."customer_followups" to "service_role";

grant TRUNCATE on TABLE "public"."customer_followups" to "service_role";

grant REFERENCES on TABLE "public"."customer_followups" to "service_role";

grant TRIGGER on TABLE "public"."customer_followups" to "service_role";

grant MAINTAIN on TABLE "public"."customer_followups" to "service_role";

revoke all privileges on TABLE "public"."customer_internal_notes" from PUBLIC, "anon", "authenticated", "service_role", "postgres";

grant INSERT on TABLE "public"."customer_internal_notes" to "postgres";

grant SELECT on TABLE "public"."customer_internal_notes" to "postgres";

grant UPDATE on TABLE "public"."customer_internal_notes" to "postgres";

grant DELETE on TABLE "public"."customer_internal_notes" to "postgres";

grant TRUNCATE on TABLE "public"."customer_internal_notes" to "postgres";

grant REFERENCES on TABLE "public"."customer_internal_notes" to "postgres";

grant TRIGGER on TABLE "public"."customer_internal_notes" to "postgres";

grant MAINTAIN on TABLE "public"."customer_internal_notes" to "postgres";

grant INSERT on TABLE "public"."customer_internal_notes" to "authenticated";

grant SELECT on TABLE "public"."customer_internal_notes" to "authenticated";

grant UPDATE on TABLE "public"."customer_internal_notes" to "authenticated";

grant DELETE on TABLE "public"."customer_internal_notes" to "authenticated";

grant MAINTAIN on TABLE "public"."customer_internal_notes" to "authenticated";

grant INSERT on TABLE "public"."customer_internal_notes" to "service_role";

grant SELECT on TABLE "public"."customer_internal_notes" to "service_role";

grant UPDATE on TABLE "public"."customer_internal_notes" to "service_role";

grant DELETE on TABLE "public"."customer_internal_notes" to "service_role";

grant TRUNCATE on TABLE "public"."customer_internal_notes" to "service_role";

grant REFERENCES on TABLE "public"."customer_internal_notes" to "service_role";

grant TRIGGER on TABLE "public"."customer_internal_notes" to "service_role";

grant MAINTAIN on TABLE "public"."customer_internal_notes" to "service_role";

revoke all privileges on TABLE "public"."customer_magic_links" from PUBLIC, "anon", "authenticated", "service_role", "postgres";

grant INSERT on TABLE "public"."customer_magic_links" to "postgres";

grant SELECT on TABLE "public"."customer_magic_links" to "postgres";

grant UPDATE on TABLE "public"."customer_magic_links" to "postgres";

grant DELETE on TABLE "public"."customer_magic_links" to "postgres";

grant TRUNCATE on TABLE "public"."customer_magic_links" to "postgres";

grant REFERENCES on TABLE "public"."customer_magic_links" to "postgres";

grant TRIGGER on TABLE "public"."customer_magic_links" to "postgres";

grant MAINTAIN on TABLE "public"."customer_magic_links" to "postgres";

grant INSERT on TABLE "public"."customer_magic_links" to "authenticated";

grant SELECT on TABLE "public"."customer_magic_links" to "authenticated";

grant UPDATE on TABLE "public"."customer_magic_links" to "authenticated";

grant DELETE on TABLE "public"."customer_magic_links" to "authenticated";

grant MAINTAIN on TABLE "public"."customer_magic_links" to "authenticated";

grant INSERT on TABLE "public"."customer_magic_links" to "service_role";

grant SELECT on TABLE "public"."customer_magic_links" to "service_role";

grant UPDATE on TABLE "public"."customer_magic_links" to "service_role";

grant DELETE on TABLE "public"."customer_magic_links" to "service_role";

grant TRUNCATE on TABLE "public"."customer_magic_links" to "service_role";

grant REFERENCES on TABLE "public"."customer_magic_links" to "service_role";

grant TRIGGER on TABLE "public"."customer_magic_links" to "service_role";

grant MAINTAIN on TABLE "public"."customer_magic_links" to "service_role";

revoke all privileges on TABLE "public"."customer_notes" from PUBLIC, "anon", "authenticated", "service_role", "postgres";

grant INSERT on TABLE "public"."customer_notes" to "postgres";

grant SELECT on TABLE "public"."customer_notes" to "postgres";

grant UPDATE on TABLE "public"."customer_notes" to "postgres";

grant DELETE on TABLE "public"."customer_notes" to "postgres";

grant TRUNCATE on TABLE "public"."customer_notes" to "postgres";

grant REFERENCES on TABLE "public"."customer_notes" to "postgres";

grant TRIGGER on TABLE "public"."customer_notes" to "postgres";

grant MAINTAIN on TABLE "public"."customer_notes" to "postgres";

grant INSERT on TABLE "public"."customer_notes" to "authenticated";

grant SELECT on TABLE "public"."customer_notes" to "authenticated";

grant UPDATE on TABLE "public"."customer_notes" to "authenticated";

grant DELETE on TABLE "public"."customer_notes" to "authenticated";

grant MAINTAIN on TABLE "public"."customer_notes" to "authenticated";

grant INSERT on TABLE "public"."customer_notes" to "service_role";

grant SELECT on TABLE "public"."customer_notes" to "service_role";

grant UPDATE on TABLE "public"."customer_notes" to "service_role";

grant DELETE on TABLE "public"."customer_notes" to "service_role";

grant TRUNCATE on TABLE "public"."customer_notes" to "service_role";

grant REFERENCES on TABLE "public"."customer_notes" to "service_role";

grant TRIGGER on TABLE "public"."customer_notes" to "service_role";

grant MAINTAIN on TABLE "public"."customer_notes" to "service_role";

revoke all privileges on TABLE "public"."customer_portal_events" from PUBLIC, "anon", "authenticated", "service_role", "postgres";

grant INSERT on TABLE "public"."customer_portal_events" to "postgres";

grant SELECT on TABLE "public"."customer_portal_events" to "postgres";

grant UPDATE on TABLE "public"."customer_portal_events" to "postgres";

grant DELETE on TABLE "public"."customer_portal_events" to "postgres";

grant TRUNCATE on TABLE "public"."customer_portal_events" to "postgres";

grant REFERENCES on TABLE "public"."customer_portal_events" to "postgres";

grant TRIGGER on TABLE "public"."customer_portal_events" to "postgres";

grant MAINTAIN on TABLE "public"."customer_portal_events" to "postgres";

grant INSERT on TABLE "public"."customer_portal_events" to "authenticated";

grant SELECT on TABLE "public"."customer_portal_events" to "authenticated";

grant UPDATE on TABLE "public"."customer_portal_events" to "authenticated";

grant DELETE on TABLE "public"."customer_portal_events" to "authenticated";

grant MAINTAIN on TABLE "public"."customer_portal_events" to "authenticated";

grant INSERT on TABLE "public"."customer_portal_events" to "service_role";

grant SELECT on TABLE "public"."customer_portal_events" to "service_role";

grant UPDATE on TABLE "public"."customer_portal_events" to "service_role";

grant DELETE on TABLE "public"."customer_portal_events" to "service_role";

grant TRUNCATE on TABLE "public"."customer_portal_events" to "service_role";

grant REFERENCES on TABLE "public"."customer_portal_events" to "service_role";

grant TRIGGER on TABLE "public"."customer_portal_events" to "service_role";

grant MAINTAIN on TABLE "public"."customer_portal_events" to "service_role";

revoke all privileges on TABLE "public"."customer_profiles" from PUBLIC, "anon", "authenticated", "service_role", "postgres";

grant INSERT on TABLE "public"."customer_profiles" to "postgres";

grant SELECT on TABLE "public"."customer_profiles" to "postgres";

grant UPDATE on TABLE "public"."customer_profiles" to "postgres";

grant DELETE on TABLE "public"."customer_profiles" to "postgres";

grant TRUNCATE on TABLE "public"."customer_profiles" to "postgres";

grant REFERENCES on TABLE "public"."customer_profiles" to "postgres";

grant TRIGGER on TABLE "public"."customer_profiles" to "postgres";

grant MAINTAIN on TABLE "public"."customer_profiles" to "postgres";

grant INSERT on TABLE "public"."customer_profiles" to "service_role";

grant SELECT on TABLE "public"."customer_profiles" to "service_role";

grant UPDATE on TABLE "public"."customer_profiles" to "service_role";

grant DELETE on TABLE "public"."customer_profiles" to "service_role";

grant TRUNCATE on TABLE "public"."customer_profiles" to "service_role";

grant REFERENCES on TABLE "public"."customer_profiles" to "service_role";

grant TRIGGER on TABLE "public"."customer_profiles" to "service_role";

grant MAINTAIN on TABLE "public"."customer_profiles" to "service_role";

revoke all privileges on TABLE "public"."data_quality_issues" from PUBLIC, "anon", "authenticated", "service_role", "postgres";

grant INSERT on TABLE "public"."data_quality_issues" to "postgres";

grant SELECT on TABLE "public"."data_quality_issues" to "postgres";

grant UPDATE on TABLE "public"."data_quality_issues" to "postgres";

grant DELETE on TABLE "public"."data_quality_issues" to "postgres";

grant TRUNCATE on TABLE "public"."data_quality_issues" to "postgres";

grant REFERENCES on TABLE "public"."data_quality_issues" to "postgres";

grant TRIGGER on TABLE "public"."data_quality_issues" to "postgres";

grant MAINTAIN on TABLE "public"."data_quality_issues" to "postgres";

grant INSERT on TABLE "public"."data_quality_issues" to "service_role";

grant SELECT on TABLE "public"."data_quality_issues" to "service_role";

grant UPDATE on TABLE "public"."data_quality_issues" to "service_role";

grant DELETE on TABLE "public"."data_quality_issues" to "service_role";

grant TRUNCATE on TABLE "public"."data_quality_issues" to "service_role";

grant REFERENCES on TABLE "public"."data_quality_issues" to "service_role";

grant TRIGGER on TABLE "public"."data_quality_issues" to "service_role";

grant MAINTAIN on TABLE "public"."data_quality_issues" to "service_role";

revoke all privileges on TABLE "public"."deliveries" from PUBLIC, "anon", "authenticated", "service_role", "postgres";

grant INSERT on TABLE "public"."deliveries" to "postgres";

grant SELECT on TABLE "public"."deliveries" to "postgres";

grant UPDATE on TABLE "public"."deliveries" to "postgres";

grant DELETE on TABLE "public"."deliveries" to "postgres";

grant TRUNCATE on TABLE "public"."deliveries" to "postgres";

grant REFERENCES on TABLE "public"."deliveries" to "postgres";

grant TRIGGER on TABLE "public"."deliveries" to "postgres";

grant MAINTAIN on TABLE "public"."deliveries" to "postgres";

grant INSERT on TABLE "public"."deliveries" to "authenticated";

grant SELECT on TABLE "public"."deliveries" to "authenticated";

grant UPDATE on TABLE "public"."deliveries" to "authenticated";

grant DELETE on TABLE "public"."deliveries" to "authenticated";

grant MAINTAIN on TABLE "public"."deliveries" to "authenticated";

grant INSERT on TABLE "public"."deliveries" to "service_role";

grant SELECT on TABLE "public"."deliveries" to "service_role";

grant UPDATE on TABLE "public"."deliveries" to "service_role";

grant DELETE on TABLE "public"."deliveries" to "service_role";

grant TRUNCATE on TABLE "public"."deliveries" to "service_role";

grant REFERENCES on TABLE "public"."deliveries" to "service_role";

grant TRIGGER on TABLE "public"."deliveries" to "service_role";

grant MAINTAIN on TABLE "public"."deliveries" to "service_role";

revoke all privileges on TABLE "public"."delivery_assignments" from PUBLIC, "anon", "authenticated", "service_role", "postgres";

grant INSERT on TABLE "public"."delivery_assignments" to "postgres";

grant SELECT on TABLE "public"."delivery_assignments" to "postgres";

grant UPDATE on TABLE "public"."delivery_assignments" to "postgres";

grant DELETE on TABLE "public"."delivery_assignments" to "postgres";

grant TRUNCATE on TABLE "public"."delivery_assignments" to "postgres";

grant REFERENCES on TABLE "public"."delivery_assignments" to "postgres";

grant TRIGGER on TABLE "public"."delivery_assignments" to "postgres";

grant MAINTAIN on TABLE "public"."delivery_assignments" to "postgres";

grant INSERT on TABLE "public"."delivery_assignments" to "authenticated";

grant SELECT on TABLE "public"."delivery_assignments" to "authenticated";

grant UPDATE on TABLE "public"."delivery_assignments" to "authenticated";

grant DELETE on TABLE "public"."delivery_assignments" to "authenticated";

grant TRUNCATE on TABLE "public"."delivery_assignments" to "authenticated";

grant REFERENCES on TABLE "public"."delivery_assignments" to "authenticated";

grant TRIGGER on TABLE "public"."delivery_assignments" to "authenticated";

grant MAINTAIN on TABLE "public"."delivery_assignments" to "authenticated";

grant INSERT on TABLE "public"."delivery_assignments" to "service_role";

grant SELECT on TABLE "public"."delivery_assignments" to "service_role";

grant UPDATE on TABLE "public"."delivery_assignments" to "service_role";

grant DELETE on TABLE "public"."delivery_assignments" to "service_role";

grant TRUNCATE on TABLE "public"."delivery_assignments" to "service_role";

grant REFERENCES on TABLE "public"."delivery_assignments" to "service_role";

grant TRIGGER on TABLE "public"."delivery_assignments" to "service_role";

grant MAINTAIN on TABLE "public"."delivery_assignments" to "service_role";

revoke all privileges on TABLE "public"."delivery_drivers" from PUBLIC, "anon", "authenticated", "service_role", "postgres";

grant INSERT on TABLE "public"."delivery_drivers" to "postgres";

grant SELECT on TABLE "public"."delivery_drivers" to "postgres";

grant UPDATE on TABLE "public"."delivery_drivers" to "postgres";

grant DELETE on TABLE "public"."delivery_drivers" to "postgres";

grant TRUNCATE on TABLE "public"."delivery_drivers" to "postgres";

grant REFERENCES on TABLE "public"."delivery_drivers" to "postgres";

grant TRIGGER on TABLE "public"."delivery_drivers" to "postgres";

grant MAINTAIN on TABLE "public"."delivery_drivers" to "postgres";

grant INSERT on TABLE "public"."delivery_drivers" to "authenticated";

grant SELECT on TABLE "public"."delivery_drivers" to "authenticated";

grant UPDATE on TABLE "public"."delivery_drivers" to "authenticated";

grant DELETE on TABLE "public"."delivery_drivers" to "authenticated";

grant TRUNCATE on TABLE "public"."delivery_drivers" to "authenticated";

grant REFERENCES on TABLE "public"."delivery_drivers" to "authenticated";

grant TRIGGER on TABLE "public"."delivery_drivers" to "authenticated";

grant MAINTAIN on TABLE "public"."delivery_drivers" to "authenticated";

grant INSERT on TABLE "public"."delivery_drivers" to "service_role";

grant SELECT on TABLE "public"."delivery_drivers" to "service_role";

grant UPDATE on TABLE "public"."delivery_drivers" to "service_role";

grant DELETE on TABLE "public"."delivery_drivers" to "service_role";

grant TRUNCATE on TABLE "public"."delivery_drivers" to "service_role";

grant REFERENCES on TABLE "public"."delivery_drivers" to "service_role";

grant TRIGGER on TABLE "public"."delivery_drivers" to "service_role";

grant MAINTAIN on TABLE "public"."delivery_drivers" to "service_role";

revoke all privileges on TABLE "public"."delivery_zones" from PUBLIC, "anon", "authenticated", "service_role", "postgres";

grant INSERT on TABLE "public"."delivery_zones" to "postgres";

grant SELECT on TABLE "public"."delivery_zones" to "postgres";

grant UPDATE on TABLE "public"."delivery_zones" to "postgres";

grant DELETE on TABLE "public"."delivery_zones" to "postgres";

grant TRUNCATE on TABLE "public"."delivery_zones" to "postgres";

grant REFERENCES on TABLE "public"."delivery_zones" to "postgres";

grant TRIGGER on TABLE "public"."delivery_zones" to "postgres";

grant MAINTAIN on TABLE "public"."delivery_zones" to "postgres";

grant INSERT on TABLE "public"."delivery_zones" to "authenticated";

grant SELECT on TABLE "public"."delivery_zones" to "authenticated";

grant UPDATE on TABLE "public"."delivery_zones" to "authenticated";

grant DELETE on TABLE "public"."delivery_zones" to "authenticated";

grant MAINTAIN on TABLE "public"."delivery_zones" to "authenticated";

grant INSERT on TABLE "public"."delivery_zones" to "service_role";

grant SELECT on TABLE "public"."delivery_zones" to "service_role";

grant UPDATE on TABLE "public"."delivery_zones" to "service_role";

grant DELETE on TABLE "public"."delivery_zones" to "service_role";

grant TRUNCATE on TABLE "public"."delivery_zones" to "service_role";

grant REFERENCES on TABLE "public"."delivery_zones" to "service_role";

grant TRIGGER on TABLE "public"."delivery_zones" to "service_role";

grant MAINTAIN on TABLE "public"."delivery_zones" to "service_role";

revoke all privileges on TABLE "public"."demo_data_registry" from PUBLIC, "anon", "authenticated", "service_role", "postgres";

grant INSERT on TABLE "public"."demo_data_registry" to "postgres";

grant SELECT on TABLE "public"."demo_data_registry" to "postgres";

grant UPDATE on TABLE "public"."demo_data_registry" to "postgres";

grant DELETE on TABLE "public"."demo_data_registry" to "postgres";

grant TRUNCATE on TABLE "public"."demo_data_registry" to "postgres";

grant REFERENCES on TABLE "public"."demo_data_registry" to "postgres";

grant TRIGGER on TABLE "public"."demo_data_registry" to "postgres";

grant MAINTAIN on TABLE "public"."demo_data_registry" to "postgres";

grant INSERT on TABLE "public"."demo_data_registry" to "service_role";

grant SELECT on TABLE "public"."demo_data_registry" to "service_role";

grant UPDATE on TABLE "public"."demo_data_registry" to "service_role";

grant DELETE on TABLE "public"."demo_data_registry" to "service_role";

grant TRUNCATE on TABLE "public"."demo_data_registry" to "service_role";

grant REFERENCES on TABLE "public"."demo_data_registry" to "service_role";

grant TRIGGER on TABLE "public"."demo_data_registry" to "service_role";

grant MAINTAIN on TABLE "public"."demo_data_registry" to "service_role";

revoke all privileges on SEQUENCE "public"."demo_data_registry_id_seq" from PUBLIC, "anon", "authenticated", "service_role", "postgres";

grant SELECT on SEQUENCE "public"."demo_data_registry_id_seq" to "postgres";

grant UPDATE on SEQUENCE "public"."demo_data_registry_id_seq" to "postgres";

grant USAGE on SEQUENCE "public"."demo_data_registry_id_seq" to "postgres";

grant SELECT on SEQUENCE "public"."demo_data_registry_id_seq" to "anon";

grant UPDATE on SEQUENCE "public"."demo_data_registry_id_seq" to "anon";

grant USAGE on SEQUENCE "public"."demo_data_registry_id_seq" to "anon";

grant SELECT on SEQUENCE "public"."demo_data_registry_id_seq" to "authenticated";

grant UPDATE on SEQUENCE "public"."demo_data_registry_id_seq" to "authenticated";

grant USAGE on SEQUENCE "public"."demo_data_registry_id_seq" to "authenticated";

grant SELECT on SEQUENCE "public"."demo_data_registry_id_seq" to "service_role";

grant UPDATE on SEQUENCE "public"."demo_data_registry_id_seq" to "service_role";

grant USAGE on SEQUENCE "public"."demo_data_registry_id_seq" to "service_role";

revoke all privileges on TABLE "public"."event_idempotency" from PUBLIC, "anon", "authenticated", "service_role", "postgres";

grant INSERT on TABLE "public"."event_idempotency" to "postgres";

grant SELECT on TABLE "public"."event_idempotency" to "postgres";

grant UPDATE on TABLE "public"."event_idempotency" to "postgres";

grant DELETE on TABLE "public"."event_idempotency" to "postgres";

grant TRUNCATE on TABLE "public"."event_idempotency" to "postgres";

grant REFERENCES on TABLE "public"."event_idempotency" to "postgres";

grant TRIGGER on TABLE "public"."event_idempotency" to "postgres";

grant MAINTAIN on TABLE "public"."event_idempotency" to "postgres";

grant INSERT on TABLE "public"."event_idempotency" to "service_role";

grant SELECT on TABLE "public"."event_idempotency" to "service_role";

grant UPDATE on TABLE "public"."event_idempotency" to "service_role";

grant DELETE on TABLE "public"."event_idempotency" to "service_role";

grant TRUNCATE on TABLE "public"."event_idempotency" to "service_role";

grant REFERENCES on TABLE "public"."event_idempotency" to "service_role";

grant TRIGGER on TABLE "public"."event_idempotency" to "service_role";

grant MAINTAIN on TABLE "public"."event_idempotency" to "service_role";

revoke all privileges on TABLE "public"."finance_accounts" from PUBLIC, "anon", "authenticated", "service_role", "postgres";

grant INSERT on TABLE "public"."finance_accounts" to "postgres";

grant SELECT on TABLE "public"."finance_accounts" to "postgres";

grant UPDATE on TABLE "public"."finance_accounts" to "postgres";

grant DELETE on TABLE "public"."finance_accounts" to "postgres";

grant TRUNCATE on TABLE "public"."finance_accounts" to "postgres";

grant REFERENCES on TABLE "public"."finance_accounts" to "postgres";

grant TRIGGER on TABLE "public"."finance_accounts" to "postgres";

grant MAINTAIN on TABLE "public"."finance_accounts" to "postgres";

grant INSERT on TABLE "public"."finance_accounts" to "authenticated";

grant SELECT on TABLE "public"."finance_accounts" to "authenticated";

grant UPDATE on TABLE "public"."finance_accounts" to "authenticated";

grant DELETE on TABLE "public"."finance_accounts" to "authenticated";

grant MAINTAIN on TABLE "public"."finance_accounts" to "authenticated";

grant INSERT on TABLE "public"."finance_accounts" to "service_role";

grant SELECT on TABLE "public"."finance_accounts" to "service_role";

grant UPDATE on TABLE "public"."finance_accounts" to "service_role";

grant DELETE on TABLE "public"."finance_accounts" to "service_role";

grant TRUNCATE on TABLE "public"."finance_accounts" to "service_role";

grant REFERENCES on TABLE "public"."finance_accounts" to "service_role";

grant TRIGGER on TABLE "public"."finance_accounts" to "service_role";

grant MAINTAIN on TABLE "public"."finance_accounts" to "service_role";

revoke all privileges on TABLE "public"."financial_categories" from PUBLIC, "anon", "authenticated", "service_role", "postgres";

grant INSERT on TABLE "public"."financial_categories" to "postgres";

grant SELECT on TABLE "public"."financial_categories" to "postgres";

grant UPDATE on TABLE "public"."financial_categories" to "postgres";

grant DELETE on TABLE "public"."financial_categories" to "postgres";

grant TRUNCATE on TABLE "public"."financial_categories" to "postgres";

grant REFERENCES on TABLE "public"."financial_categories" to "postgres";

grant TRIGGER on TABLE "public"."financial_categories" to "postgres";

grant MAINTAIN on TABLE "public"."financial_categories" to "postgres";

grant INSERT on TABLE "public"."financial_categories" to "authenticated";

grant SELECT on TABLE "public"."financial_categories" to "authenticated";

grant UPDATE on TABLE "public"."financial_categories" to "authenticated";

grant DELETE on TABLE "public"."financial_categories" to "authenticated";

grant MAINTAIN on TABLE "public"."financial_categories" to "authenticated";

grant INSERT on TABLE "public"."financial_categories" to "service_role";

grant SELECT on TABLE "public"."financial_categories" to "service_role";

grant UPDATE on TABLE "public"."financial_categories" to "service_role";

grant DELETE on TABLE "public"."financial_categories" to "service_role";

grant TRUNCATE on TABLE "public"."financial_categories" to "service_role";

grant REFERENCES on TABLE "public"."financial_categories" to "service_role";

grant TRIGGER on TABLE "public"."financial_categories" to "service_role";

grant MAINTAIN on TABLE "public"."financial_categories" to "service_role";

revoke all privileges on TABLE "public"."financial_material_entries" from PUBLIC, "anon", "authenticated", "service_role", "postgres";

grant INSERT on TABLE "public"."financial_material_entries" to "postgres";

grant SELECT on TABLE "public"."financial_material_entries" to "postgres";

grant UPDATE on TABLE "public"."financial_material_entries" to "postgres";

grant DELETE on TABLE "public"."financial_material_entries" to "postgres";

grant TRUNCATE on TABLE "public"."financial_material_entries" to "postgres";

grant REFERENCES on TABLE "public"."financial_material_entries" to "postgres";

grant TRIGGER on TABLE "public"."financial_material_entries" to "postgres";

grant MAINTAIN on TABLE "public"."financial_material_entries" to "postgres";

grant INSERT on TABLE "public"."financial_material_entries" to "authenticated";

grant SELECT on TABLE "public"."financial_material_entries" to "authenticated";

grant UPDATE on TABLE "public"."financial_material_entries" to "authenticated";

grant DELETE on TABLE "public"."financial_material_entries" to "authenticated";

grant MAINTAIN on TABLE "public"."financial_material_entries" to "authenticated";

grant INSERT on TABLE "public"."financial_material_entries" to "service_role";

grant SELECT on TABLE "public"."financial_material_entries" to "service_role";

grant UPDATE on TABLE "public"."financial_material_entries" to "service_role";

grant DELETE on TABLE "public"."financial_material_entries" to "service_role";

grant TRUNCATE on TABLE "public"."financial_material_entries" to "service_role";

grant REFERENCES on TABLE "public"."financial_material_entries" to "service_role";

grant TRIGGER on TABLE "public"."financial_material_entries" to "service_role";

grant MAINTAIN on TABLE "public"."financial_material_entries" to "service_role";

revoke all privileges on TABLE "public"."financial_transactions" from PUBLIC, "anon", "authenticated", "service_role", "postgres";

grant INSERT on TABLE "public"."financial_transactions" to "postgres";

grant SELECT on TABLE "public"."financial_transactions" to "postgres";

grant UPDATE on TABLE "public"."financial_transactions" to "postgres";

grant DELETE on TABLE "public"."financial_transactions" to "postgres";

grant TRUNCATE on TABLE "public"."financial_transactions" to "postgres";

grant REFERENCES on TABLE "public"."financial_transactions" to "postgres";

grant TRIGGER on TABLE "public"."financial_transactions" to "postgres";

grant MAINTAIN on TABLE "public"."financial_transactions" to "postgres";

grant INSERT on TABLE "public"."financial_transactions" to "authenticated";

grant SELECT on TABLE "public"."financial_transactions" to "authenticated";

grant UPDATE on TABLE "public"."financial_transactions" to "authenticated";

grant DELETE on TABLE "public"."financial_transactions" to "authenticated";

grant MAINTAIN on TABLE "public"."financial_transactions" to "authenticated";

grant INSERT on TABLE "public"."financial_transactions" to "service_role";

grant SELECT on TABLE "public"."financial_transactions" to "service_role";

grant UPDATE on TABLE "public"."financial_transactions" to "service_role";

grant DELETE on TABLE "public"."financial_transactions" to "service_role";

grant TRUNCATE on TABLE "public"."financial_transactions" to "service_role";

grant REFERENCES on TABLE "public"."financial_transactions" to "service_role";

grant TRIGGER on TABLE "public"."financial_transactions" to "service_role";

grant MAINTAIN on TABLE "public"."financial_transactions" to "service_role";

revoke all privileges on TABLE "public"."founder_invites" from PUBLIC, "anon", "authenticated", "service_role", "postgres";

grant INSERT on TABLE "public"."founder_invites" to "postgres";

grant SELECT on TABLE "public"."founder_invites" to "postgres";

grant UPDATE on TABLE "public"."founder_invites" to "postgres";

grant DELETE on TABLE "public"."founder_invites" to "postgres";

grant TRUNCATE on TABLE "public"."founder_invites" to "postgres";

grant REFERENCES on TABLE "public"."founder_invites" to "postgres";

grant TRIGGER on TABLE "public"."founder_invites" to "postgres";

grant MAINTAIN on TABLE "public"."founder_invites" to "postgres";

grant INSERT on TABLE "public"."founder_invites" to "service_role";

grant SELECT on TABLE "public"."founder_invites" to "service_role";

grant UPDATE on TABLE "public"."founder_invites" to "service_role";

revoke all privileges on TABLE "public"."integration_connections" from PUBLIC, "anon", "authenticated", "service_role", "postgres";

grant INSERT on TABLE "public"."integration_connections" to "postgres";

grant SELECT on TABLE "public"."integration_connections" to "postgres";

grant UPDATE on TABLE "public"."integration_connections" to "postgres";

grant DELETE on TABLE "public"."integration_connections" to "postgres";

grant TRUNCATE on TABLE "public"."integration_connections" to "postgres";

grant REFERENCES on TABLE "public"."integration_connections" to "postgres";

grant TRIGGER on TABLE "public"."integration_connections" to "postgres";

grant MAINTAIN on TABLE "public"."integration_connections" to "postgres";

grant INSERT on TABLE "public"."integration_connections" to "service_role";

grant SELECT on TABLE "public"."integration_connections" to "service_role";

grant UPDATE on TABLE "public"."integration_connections" to "service_role";

grant DELETE on TABLE "public"."integration_connections" to "service_role";

grant TRUNCATE on TABLE "public"."integration_connections" to "service_role";

grant REFERENCES on TABLE "public"."integration_connections" to "service_role";

grant TRIGGER on TABLE "public"."integration_connections" to "service_role";

grant MAINTAIN on TABLE "public"."integration_connections" to "service_role";

revoke all privileges on TABLE "public"."integration_mappings" from PUBLIC, "anon", "authenticated", "service_role", "postgres";

grant INSERT on TABLE "public"."integration_mappings" to "postgres";

grant SELECT on TABLE "public"."integration_mappings" to "postgres";

grant UPDATE on TABLE "public"."integration_mappings" to "postgres";

grant DELETE on TABLE "public"."integration_mappings" to "postgres";

grant TRUNCATE on TABLE "public"."integration_mappings" to "postgres";

grant REFERENCES on TABLE "public"."integration_mappings" to "postgres";

grant TRIGGER on TABLE "public"."integration_mappings" to "postgres";

grant MAINTAIN on TABLE "public"."integration_mappings" to "postgres";

grant INSERT on TABLE "public"."integration_mappings" to "service_role";

grant SELECT on TABLE "public"."integration_mappings" to "service_role";

grant UPDATE on TABLE "public"."integration_mappings" to "service_role";

grant DELETE on TABLE "public"."integration_mappings" to "service_role";

grant TRUNCATE on TABLE "public"."integration_mappings" to "service_role";

grant REFERENCES on TABLE "public"."integration_mappings" to "service_role";

grant TRIGGER on TABLE "public"."integration_mappings" to "service_role";

grant MAINTAIN on TABLE "public"."integration_mappings" to "service_role";

revoke all privileges on TABLE "public"."integration_oauth_states" from PUBLIC, "anon", "authenticated", "service_role", "postgres";

grant INSERT on TABLE "public"."integration_oauth_states" to "postgres";

grant SELECT on TABLE "public"."integration_oauth_states" to "postgres";

grant UPDATE on TABLE "public"."integration_oauth_states" to "postgres";

grant DELETE on TABLE "public"."integration_oauth_states" to "postgres";

grant TRUNCATE on TABLE "public"."integration_oauth_states" to "postgres";

grant REFERENCES on TABLE "public"."integration_oauth_states" to "postgres";

grant TRIGGER on TABLE "public"."integration_oauth_states" to "postgres";

grant MAINTAIN on TABLE "public"."integration_oauth_states" to "postgres";

grant INSERT on TABLE "public"."integration_oauth_states" to "service_role";

grant SELECT on TABLE "public"."integration_oauth_states" to "service_role";

grant UPDATE on TABLE "public"."integration_oauth_states" to "service_role";

grant DELETE on TABLE "public"."integration_oauth_states" to "service_role";

grant TRUNCATE on TABLE "public"."integration_oauth_states" to "service_role";

grant REFERENCES on TABLE "public"."integration_oauth_states" to "service_role";

grant TRIGGER on TABLE "public"."integration_oauth_states" to "service_role";

grant MAINTAIN on TABLE "public"."integration_oauth_states" to "service_role";

revoke all privileges on TABLE "public"."integration_push_channels" from PUBLIC, "anon", "authenticated", "service_role", "postgres";

grant INSERT on TABLE "public"."integration_push_channels" to "postgres";

grant SELECT on TABLE "public"."integration_push_channels" to "postgres";

grant UPDATE on TABLE "public"."integration_push_channels" to "postgres";

grant DELETE on TABLE "public"."integration_push_channels" to "postgres";

grant TRUNCATE on TABLE "public"."integration_push_channels" to "postgres";

grant REFERENCES on TABLE "public"."integration_push_channels" to "postgres";

grant TRIGGER on TABLE "public"."integration_push_channels" to "postgres";

grant MAINTAIN on TABLE "public"."integration_push_channels" to "postgres";

grant INSERT on TABLE "public"."integration_push_channels" to "service_role";

grant SELECT on TABLE "public"."integration_push_channels" to "service_role";

grant UPDATE on TABLE "public"."integration_push_channels" to "service_role";

grant DELETE on TABLE "public"."integration_push_channels" to "service_role";

grant TRUNCATE on TABLE "public"."integration_push_channels" to "service_role";

grant REFERENCES on TABLE "public"."integration_push_channels" to "service_role";

grant TRIGGER on TABLE "public"."integration_push_channels" to "service_role";

grant MAINTAIN on TABLE "public"."integration_push_channels" to "service_role";

revoke all privileges on TABLE "public"."integration_sync_cursors" from PUBLIC, "anon", "authenticated", "service_role", "postgres";

grant INSERT on TABLE "public"."integration_sync_cursors" to "postgres";

grant SELECT on TABLE "public"."integration_sync_cursors" to "postgres";

grant UPDATE on TABLE "public"."integration_sync_cursors" to "postgres";

grant DELETE on TABLE "public"."integration_sync_cursors" to "postgres";

grant TRUNCATE on TABLE "public"."integration_sync_cursors" to "postgres";

grant REFERENCES on TABLE "public"."integration_sync_cursors" to "postgres";

grant TRIGGER on TABLE "public"."integration_sync_cursors" to "postgres";

grant MAINTAIN on TABLE "public"."integration_sync_cursors" to "postgres";

grant INSERT on TABLE "public"."integration_sync_cursors" to "service_role";

grant SELECT on TABLE "public"."integration_sync_cursors" to "service_role";

grant UPDATE on TABLE "public"."integration_sync_cursors" to "service_role";

grant DELETE on TABLE "public"."integration_sync_cursors" to "service_role";

grant TRUNCATE on TABLE "public"."integration_sync_cursors" to "service_role";

grant REFERENCES on TABLE "public"."integration_sync_cursors" to "service_role";

grant TRIGGER on TABLE "public"."integration_sync_cursors" to "service_role";

grant MAINTAIN on TABLE "public"."integration_sync_cursors" to "service_role";

revoke all privileges on TABLE "public"."integration_usage_daily" from PUBLIC, "anon", "authenticated", "service_role", "postgres";

grant INSERT on TABLE "public"."integration_usage_daily" to "postgres";

grant SELECT on TABLE "public"."integration_usage_daily" to "postgres";

grant UPDATE on TABLE "public"."integration_usage_daily" to "postgres";

grant DELETE on TABLE "public"."integration_usage_daily" to "postgres";

grant TRUNCATE on TABLE "public"."integration_usage_daily" to "postgres";

grant REFERENCES on TABLE "public"."integration_usage_daily" to "postgres";

grant TRIGGER on TABLE "public"."integration_usage_daily" to "postgres";

grant MAINTAIN on TABLE "public"."integration_usage_daily" to "postgres";

grant INSERT on TABLE "public"."integration_usage_daily" to "service_role";

grant SELECT on TABLE "public"."integration_usage_daily" to "service_role";

grant UPDATE on TABLE "public"."integration_usage_daily" to "service_role";

grant DELETE on TABLE "public"."integration_usage_daily" to "service_role";

grant TRUNCATE on TABLE "public"."integration_usage_daily" to "service_role";

grant REFERENCES on TABLE "public"."integration_usage_daily" to "service_role";

grant TRIGGER on TABLE "public"."integration_usage_daily" to "service_role";

grant MAINTAIN on TABLE "public"."integration_usage_daily" to "service_role";

revoke all privileges on TABLE "public"."internal_tasks" from PUBLIC, "anon", "authenticated", "service_role", "postgres";

grant INSERT on TABLE "public"."internal_tasks" to "postgres";

grant SELECT on TABLE "public"."internal_tasks" to "postgres";

grant UPDATE on TABLE "public"."internal_tasks" to "postgres";

grant DELETE on TABLE "public"."internal_tasks" to "postgres";

grant TRUNCATE on TABLE "public"."internal_tasks" to "postgres";

grant REFERENCES on TABLE "public"."internal_tasks" to "postgres";

grant TRIGGER on TABLE "public"."internal_tasks" to "postgres";

grant MAINTAIN on TABLE "public"."internal_tasks" to "postgres";

grant INSERT on TABLE "public"."internal_tasks" to "authenticated";

grant SELECT on TABLE "public"."internal_tasks" to "authenticated";

grant UPDATE on TABLE "public"."internal_tasks" to "authenticated";

grant DELETE on TABLE "public"."internal_tasks" to "authenticated";

grant MAINTAIN on TABLE "public"."internal_tasks" to "authenticated";

grant INSERT on TABLE "public"."internal_tasks" to "service_role";

grant SELECT on TABLE "public"."internal_tasks" to "service_role";

grant UPDATE on TABLE "public"."internal_tasks" to "service_role";

grant DELETE on TABLE "public"."internal_tasks" to "service_role";

grant TRUNCATE on TABLE "public"."internal_tasks" to "service_role";

grant REFERENCES on TABLE "public"."internal_tasks" to "service_role";

grant TRIGGER on TABLE "public"."internal_tasks" to "service_role";

grant MAINTAIN on TABLE "public"."internal_tasks" to "service_role";

revoke all privileges on TABLE "public"."marketplace_commission_rules" from PUBLIC, "anon", "authenticated", "service_role", "postgres";

grant INSERT on TABLE "public"."marketplace_commission_rules" to "postgres";

grant SELECT on TABLE "public"."marketplace_commission_rules" to "postgres";

grant UPDATE on TABLE "public"."marketplace_commission_rules" to "postgres";

grant DELETE on TABLE "public"."marketplace_commission_rules" to "postgres";

grant TRUNCATE on TABLE "public"."marketplace_commission_rules" to "postgres";

grant REFERENCES on TABLE "public"."marketplace_commission_rules" to "postgres";

grant TRIGGER on TABLE "public"."marketplace_commission_rules" to "postgres";

grant MAINTAIN on TABLE "public"."marketplace_commission_rules" to "postgres";

grant INSERT on TABLE "public"."marketplace_commission_rules" to "authenticated";

grant SELECT on TABLE "public"."marketplace_commission_rules" to "authenticated";

grant UPDATE on TABLE "public"."marketplace_commission_rules" to "authenticated";

grant DELETE on TABLE "public"."marketplace_commission_rules" to "authenticated";

grant MAINTAIN on TABLE "public"."marketplace_commission_rules" to "authenticated";

grant INSERT on TABLE "public"."marketplace_commission_rules" to "service_role";

grant SELECT on TABLE "public"."marketplace_commission_rules" to "service_role";

grant UPDATE on TABLE "public"."marketplace_commission_rules" to "service_role";

grant DELETE on TABLE "public"."marketplace_commission_rules" to "service_role";

grant TRUNCATE on TABLE "public"."marketplace_commission_rules" to "service_role";

grant REFERENCES on TABLE "public"."marketplace_commission_rules" to "service_role";

grant TRIGGER on TABLE "public"."marketplace_commission_rules" to "service_role";

grant MAINTAIN on TABLE "public"."marketplace_commission_rules" to "service_role";

revoke all privileges on TABLE "public"."marketplace_commissions" from PUBLIC, "anon", "authenticated", "service_role", "postgres";

grant INSERT on TABLE "public"."marketplace_commissions" to "postgres";

grant SELECT on TABLE "public"."marketplace_commissions" to "postgres";

grant UPDATE on TABLE "public"."marketplace_commissions" to "postgres";

grant DELETE on TABLE "public"."marketplace_commissions" to "postgres";

grant TRUNCATE on TABLE "public"."marketplace_commissions" to "postgres";

grant REFERENCES on TABLE "public"."marketplace_commissions" to "postgres";

grant TRIGGER on TABLE "public"."marketplace_commissions" to "postgres";

grant MAINTAIN on TABLE "public"."marketplace_commissions" to "postgres";

grant INSERT on TABLE "public"."marketplace_commissions" to "authenticated";

grant SELECT on TABLE "public"."marketplace_commissions" to "authenticated";

grant UPDATE on TABLE "public"."marketplace_commissions" to "authenticated";

grant DELETE on TABLE "public"."marketplace_commissions" to "authenticated";

grant MAINTAIN on TABLE "public"."marketplace_commissions" to "authenticated";

grant INSERT on TABLE "public"."marketplace_commissions" to "service_role";

grant SELECT on TABLE "public"."marketplace_commissions" to "service_role";

grant UPDATE on TABLE "public"."marketplace_commissions" to "service_role";

grant DELETE on TABLE "public"."marketplace_commissions" to "service_role";

grant TRUNCATE on TABLE "public"."marketplace_commissions" to "service_role";

grant REFERENCES on TABLE "public"."marketplace_commissions" to "service_role";

grant TRIGGER on TABLE "public"."marketplace_commissions" to "service_role";

grant MAINTAIN on TABLE "public"."marketplace_commissions" to "service_role";

revoke all privileges on TABLE "public"."marketplace_coupons" from PUBLIC, "anon", "authenticated", "service_role", "postgres";

grant INSERT on TABLE "public"."marketplace_coupons" to "postgres";

grant SELECT on TABLE "public"."marketplace_coupons" to "postgres";

grant UPDATE on TABLE "public"."marketplace_coupons" to "postgres";

grant DELETE on TABLE "public"."marketplace_coupons" to "postgres";

grant TRUNCATE on TABLE "public"."marketplace_coupons" to "postgres";

grant REFERENCES on TABLE "public"."marketplace_coupons" to "postgres";

grant TRIGGER on TABLE "public"."marketplace_coupons" to "postgres";

grant MAINTAIN on TABLE "public"."marketplace_coupons" to "postgres";

grant INSERT on TABLE "public"."marketplace_coupons" to "authenticated";

grant SELECT on TABLE "public"."marketplace_coupons" to "authenticated";

grant UPDATE on TABLE "public"."marketplace_coupons" to "authenticated";

grant DELETE on TABLE "public"."marketplace_coupons" to "authenticated";

grant MAINTAIN on TABLE "public"."marketplace_coupons" to "authenticated";

grant INSERT on TABLE "public"."marketplace_coupons" to "service_role";

grant SELECT on TABLE "public"."marketplace_coupons" to "service_role";

grant UPDATE on TABLE "public"."marketplace_coupons" to "service_role";

grant DELETE on TABLE "public"."marketplace_coupons" to "service_role";

grant TRUNCATE on TABLE "public"."marketplace_coupons" to "service_role";

grant REFERENCES on TABLE "public"."marketplace_coupons" to "service_role";

grant TRIGGER on TABLE "public"."marketplace_coupons" to "service_role";

grant MAINTAIN on TABLE "public"."marketplace_coupons" to "service_role";

revoke all privileges on TABLE "public"."marketplace_oauth_states" from PUBLIC, "anon", "authenticated", "service_role", "postgres";

grant INSERT on TABLE "public"."marketplace_oauth_states" to "postgres";

grant SELECT on TABLE "public"."marketplace_oauth_states" to "postgres";

grant UPDATE on TABLE "public"."marketplace_oauth_states" to "postgres";

grant DELETE on TABLE "public"."marketplace_oauth_states" to "postgres";

grant TRUNCATE on TABLE "public"."marketplace_oauth_states" to "postgres";

grant REFERENCES on TABLE "public"."marketplace_oauth_states" to "postgres";

grant TRIGGER on TABLE "public"."marketplace_oauth_states" to "postgres";

grant MAINTAIN on TABLE "public"."marketplace_oauth_states" to "postgres";

grant INSERT on TABLE "public"."marketplace_oauth_states" to "authenticated";

grant SELECT on TABLE "public"."marketplace_oauth_states" to "authenticated";

grant UPDATE on TABLE "public"."marketplace_oauth_states" to "authenticated";

grant DELETE on TABLE "public"."marketplace_oauth_states" to "authenticated";

grant MAINTAIN on TABLE "public"."marketplace_oauth_states" to "authenticated";

grant INSERT on TABLE "public"."marketplace_oauth_states" to "service_role";

grant SELECT on TABLE "public"."marketplace_oauth_states" to "service_role";

grant UPDATE on TABLE "public"."marketplace_oauth_states" to "service_role";

grant DELETE on TABLE "public"."marketplace_oauth_states" to "service_role";

grant TRUNCATE on TABLE "public"."marketplace_oauth_states" to "service_role";

grant REFERENCES on TABLE "public"."marketplace_oauth_states" to "service_role";

grant TRIGGER on TABLE "public"."marketplace_oauth_states" to "service_role";

grant MAINTAIN on TABLE "public"."marketplace_oauth_states" to "service_role";

revoke all privileges on TABLE "public"."marketplace_payment_settings" from PUBLIC, "anon", "authenticated", "service_role", "postgres";

grant INSERT on TABLE "public"."marketplace_payment_settings" to "postgres";

grant SELECT on TABLE "public"."marketplace_payment_settings" to "postgres";

grant UPDATE on TABLE "public"."marketplace_payment_settings" to "postgres";

grant DELETE on TABLE "public"."marketplace_payment_settings" to "postgres";

grant TRUNCATE on TABLE "public"."marketplace_payment_settings" to "postgres";

grant REFERENCES on TABLE "public"."marketplace_payment_settings" to "postgres";

grant TRIGGER on TABLE "public"."marketplace_payment_settings" to "postgres";

grant MAINTAIN on TABLE "public"."marketplace_payment_settings" to "postgres";

grant INSERT on TABLE "public"."marketplace_payment_settings" to "authenticated";

grant SELECT on TABLE "public"."marketplace_payment_settings" to "authenticated";

grant UPDATE on TABLE "public"."marketplace_payment_settings" to "authenticated";

grant DELETE on TABLE "public"."marketplace_payment_settings" to "authenticated";

grant MAINTAIN on TABLE "public"."marketplace_payment_settings" to "authenticated";

grant INSERT on TABLE "public"."marketplace_payment_settings" to "service_role";

grant SELECT on TABLE "public"."marketplace_payment_settings" to "service_role";

grant UPDATE on TABLE "public"."marketplace_payment_settings" to "service_role";

grant DELETE on TABLE "public"."marketplace_payment_settings" to "service_role";

grant TRUNCATE on TABLE "public"."marketplace_payment_settings" to "service_role";

grant REFERENCES on TABLE "public"."marketplace_payment_settings" to "service_role";

grant TRIGGER on TABLE "public"."marketplace_payment_settings" to "service_role";

grant MAINTAIN on TABLE "public"."marketplace_payment_settings" to "service_role";

revoke all privileges on TABLE "public"."marketplace_payments" from PUBLIC, "anon", "authenticated", "service_role", "postgres";

grant INSERT on TABLE "public"."marketplace_payments" to "postgres";

grant SELECT on TABLE "public"."marketplace_payments" to "postgres";

grant UPDATE on TABLE "public"."marketplace_payments" to "postgres";

grant DELETE on TABLE "public"."marketplace_payments" to "postgres";

grant TRUNCATE on TABLE "public"."marketplace_payments" to "postgres";

grant REFERENCES on TABLE "public"."marketplace_payments" to "postgres";

grant TRIGGER on TABLE "public"."marketplace_payments" to "postgres";

grant MAINTAIN on TABLE "public"."marketplace_payments" to "postgres";

grant INSERT on TABLE "public"."marketplace_payments" to "authenticated";

grant SELECT on TABLE "public"."marketplace_payments" to "authenticated";

grant UPDATE on TABLE "public"."marketplace_payments" to "authenticated";

grant DELETE on TABLE "public"."marketplace_payments" to "authenticated";

grant MAINTAIN on TABLE "public"."marketplace_payments" to "authenticated";

grant INSERT on TABLE "public"."marketplace_payments" to "service_role";

grant SELECT on TABLE "public"."marketplace_payments" to "service_role";

grant UPDATE on TABLE "public"."marketplace_payments" to "service_role";

grant DELETE on TABLE "public"."marketplace_payments" to "service_role";

grant TRUNCATE on TABLE "public"."marketplace_payments" to "service_role";

grant REFERENCES on TABLE "public"."marketplace_payments" to "service_role";

grant TRIGGER on TABLE "public"."marketplace_payments" to "service_role";

grant MAINTAIN on TABLE "public"."marketplace_payments" to "service_role";

revoke all privileges on TABLE "public"."marketplace_stock_reservations" from PUBLIC, "anon", "authenticated", "service_role", "postgres";

grant INSERT on TABLE "public"."marketplace_stock_reservations" to "postgres";

grant SELECT on TABLE "public"."marketplace_stock_reservations" to "postgres";

grant UPDATE on TABLE "public"."marketplace_stock_reservations" to "postgres";

grant DELETE on TABLE "public"."marketplace_stock_reservations" to "postgres";

grant TRUNCATE on TABLE "public"."marketplace_stock_reservations" to "postgres";

grant REFERENCES on TABLE "public"."marketplace_stock_reservations" to "postgres";

grant TRIGGER on TABLE "public"."marketplace_stock_reservations" to "postgres";

grant MAINTAIN on TABLE "public"."marketplace_stock_reservations" to "postgres";

grant INSERT on TABLE "public"."marketplace_stock_reservations" to "service_role";

grant SELECT on TABLE "public"."marketplace_stock_reservations" to "service_role";

grant UPDATE on TABLE "public"."marketplace_stock_reservations" to "service_role";

grant DELETE on TABLE "public"."marketplace_stock_reservations" to "service_role";

grant TRUNCATE on TABLE "public"."marketplace_stock_reservations" to "service_role";

grant REFERENCES on TABLE "public"."marketplace_stock_reservations" to "service_role";

grant TRIGGER on TABLE "public"."marketplace_stock_reservations" to "service_role";

grant MAINTAIN on TABLE "public"."marketplace_stock_reservations" to "service_role";

revoke all privileges on TABLE "public"."notifications" from PUBLIC, "anon", "authenticated", "service_role", "postgres";

grant INSERT on TABLE "public"."notifications" to "postgres";

grant SELECT on TABLE "public"."notifications" to "postgres";

grant UPDATE on TABLE "public"."notifications" to "postgres";

grant DELETE on TABLE "public"."notifications" to "postgres";

grant TRUNCATE on TABLE "public"."notifications" to "postgres";

grant REFERENCES on TABLE "public"."notifications" to "postgres";

grant TRIGGER on TABLE "public"."notifications" to "postgres";

grant MAINTAIN on TABLE "public"."notifications" to "postgres";

grant INSERT on TABLE "public"."notifications" to "authenticated";

grant SELECT on TABLE "public"."notifications" to "authenticated";

grant UPDATE on TABLE "public"."notifications" to "authenticated";

grant DELETE on TABLE "public"."notifications" to "authenticated";

grant MAINTAIN on TABLE "public"."notifications" to "authenticated";

grant INSERT on TABLE "public"."notifications" to "service_role";

grant SELECT on TABLE "public"."notifications" to "service_role";

grant UPDATE on TABLE "public"."notifications" to "service_role";

grant DELETE on TABLE "public"."notifications" to "service_role";

grant TRUNCATE on TABLE "public"."notifications" to "service_role";

grant REFERENCES on TABLE "public"."notifications" to "service_role";

grant TRIGGER on TABLE "public"."notifications" to "service_role";

grant MAINTAIN on TABLE "public"."notifications" to "service_role";

revoke all privileges on TABLE "public"."orcaly_company_health" from PUBLIC, "anon", "authenticated", "service_role", "postgres";

grant INSERT on TABLE "public"."orcaly_company_health" to "postgres";

grant SELECT on TABLE "public"."orcaly_company_health" to "postgres";

grant UPDATE on TABLE "public"."orcaly_company_health" to "postgres";

grant DELETE on TABLE "public"."orcaly_company_health" to "postgres";

grant TRUNCATE on TABLE "public"."orcaly_company_health" to "postgres";

grant REFERENCES on TABLE "public"."orcaly_company_health" to "postgres";

grant TRIGGER on TABLE "public"."orcaly_company_health" to "postgres";

grant MAINTAIN on TABLE "public"."orcaly_company_health" to "postgres";

grant SELECT on TABLE "public"."orcaly_company_health" to "service_role";

revoke all privileges on TABLE "public"."order_internal_comments" from PUBLIC, "anon", "authenticated", "service_role", "postgres";

grant INSERT on TABLE "public"."order_internal_comments" to "postgres";

grant SELECT on TABLE "public"."order_internal_comments" to "postgres";

grant UPDATE on TABLE "public"."order_internal_comments" to "postgres";

grant DELETE on TABLE "public"."order_internal_comments" to "postgres";

grant TRUNCATE on TABLE "public"."order_internal_comments" to "postgres";

grant REFERENCES on TABLE "public"."order_internal_comments" to "postgres";

grant TRIGGER on TABLE "public"."order_internal_comments" to "postgres";

grant MAINTAIN on TABLE "public"."order_internal_comments" to "postgres";

grant INSERT on TABLE "public"."order_internal_comments" to "authenticated";

grant SELECT on TABLE "public"."order_internal_comments" to "authenticated";

grant UPDATE on TABLE "public"."order_internal_comments" to "authenticated";

grant DELETE on TABLE "public"."order_internal_comments" to "authenticated";

grant MAINTAIN on TABLE "public"."order_internal_comments" to "authenticated";

grant INSERT on TABLE "public"."order_internal_comments" to "service_role";

grant SELECT on TABLE "public"."order_internal_comments" to "service_role";

grant UPDATE on TABLE "public"."order_internal_comments" to "service_role";

grant DELETE on TABLE "public"."order_internal_comments" to "service_role";

grant TRUNCATE on TABLE "public"."order_internal_comments" to "service_role";

grant REFERENCES on TABLE "public"."order_internal_comments" to "service_role";

grant TRIGGER on TABLE "public"."order_internal_comments" to "service_role";

grant MAINTAIN on TABLE "public"."order_internal_comments" to "service_role";

revoke all privileges on TABLE "public"."order_items" from PUBLIC, "anon", "authenticated", "service_role", "postgres";

grant INSERT on TABLE "public"."order_items" to "postgres";

grant SELECT on TABLE "public"."order_items" to "postgres";

grant UPDATE on TABLE "public"."order_items" to "postgres";

grant DELETE on TABLE "public"."order_items" to "postgres";

grant TRUNCATE on TABLE "public"."order_items" to "postgres";

grant REFERENCES on TABLE "public"."order_items" to "postgres";

grant TRIGGER on TABLE "public"."order_items" to "postgres";

grant MAINTAIN on TABLE "public"."order_items" to "postgres";

grant INSERT on TABLE "public"."order_items" to "authenticated";

grant SELECT on TABLE "public"."order_items" to "authenticated";

grant UPDATE on TABLE "public"."order_items" to "authenticated";

grant DELETE on TABLE "public"."order_items" to "authenticated";

grant MAINTAIN on TABLE "public"."order_items" to "authenticated";

grant INSERT on TABLE "public"."order_items" to "service_role";

grant SELECT on TABLE "public"."order_items" to "service_role";

grant UPDATE on TABLE "public"."order_items" to "service_role";

grant DELETE on TABLE "public"."order_items" to "service_role";

grant TRUNCATE on TABLE "public"."order_items" to "service_role";

grant REFERENCES on TABLE "public"."order_items" to "service_role";

grant TRIGGER on TABLE "public"."order_items" to "service_role";

grant MAINTAIN on TABLE "public"."order_items" to "service_role";

revoke all privileges on TABLE "public"."order_payments" from PUBLIC, "anon", "authenticated", "service_role", "postgres";

grant INSERT on TABLE "public"."order_payments" to "postgres";

grant SELECT on TABLE "public"."order_payments" to "postgres";

grant UPDATE on TABLE "public"."order_payments" to "postgres";

grant DELETE on TABLE "public"."order_payments" to "postgres";

grant TRUNCATE on TABLE "public"."order_payments" to "postgres";

grant REFERENCES on TABLE "public"."order_payments" to "postgres";

grant TRIGGER on TABLE "public"."order_payments" to "postgres";

grant MAINTAIN on TABLE "public"."order_payments" to "postgres";

grant INSERT on TABLE "public"."order_payments" to "authenticated";

grant SELECT on TABLE "public"."order_payments" to "authenticated";

grant UPDATE on TABLE "public"."order_payments" to "authenticated";

grant DELETE on TABLE "public"."order_payments" to "authenticated";

grant MAINTAIN on TABLE "public"."order_payments" to "authenticated";

grant INSERT on TABLE "public"."order_payments" to "service_role";

grant SELECT on TABLE "public"."order_payments" to "service_role";

grant UPDATE on TABLE "public"."order_payments" to "service_role";

grant DELETE on TABLE "public"."order_payments" to "service_role";

grant TRUNCATE on TABLE "public"."order_payments" to "service_role";

grant REFERENCES on TABLE "public"."order_payments" to "service_role";

grant TRIGGER on TABLE "public"."order_payments" to "service_role";

grant MAINTAIN on TABLE "public"."order_payments" to "service_role";

revoke all privileges on TABLE "public"."order_status_history" from PUBLIC, "anon", "authenticated", "service_role", "postgres";

grant INSERT on TABLE "public"."order_status_history" to "postgres";

grant SELECT on TABLE "public"."order_status_history" to "postgres";

grant UPDATE on TABLE "public"."order_status_history" to "postgres";

grant DELETE on TABLE "public"."order_status_history" to "postgres";

grant TRUNCATE on TABLE "public"."order_status_history" to "postgres";

grant REFERENCES on TABLE "public"."order_status_history" to "postgres";

grant TRIGGER on TABLE "public"."order_status_history" to "postgres";

grant MAINTAIN on TABLE "public"."order_status_history" to "postgres";

grant INSERT on TABLE "public"."order_status_history" to "authenticated";

grant SELECT on TABLE "public"."order_status_history" to "authenticated";

grant UPDATE on TABLE "public"."order_status_history" to "authenticated";

grant DELETE on TABLE "public"."order_status_history" to "authenticated";

grant MAINTAIN on TABLE "public"."order_status_history" to "authenticated";

grant INSERT on TABLE "public"."order_status_history" to "service_role";

grant SELECT on TABLE "public"."order_status_history" to "service_role";

grant UPDATE on TABLE "public"."order_status_history" to "service_role";

grant DELETE on TABLE "public"."order_status_history" to "service_role";

grant TRUNCATE on TABLE "public"."order_status_history" to "service_role";

grant REFERENCES on TABLE "public"."order_status_history" to "service_role";

grant TRIGGER on TABLE "public"."order_status_history" to "service_role";

grant MAINTAIN on TABLE "public"."order_status_history" to "service_role";

revoke all privileges on TABLE "public"."orders" from PUBLIC, "anon", "authenticated", "service_role", "postgres";

grant INSERT on TABLE "public"."orders" to "postgres";

grant SELECT on TABLE "public"."orders" to "postgres";

grant UPDATE on TABLE "public"."orders" to "postgres";

grant DELETE on TABLE "public"."orders" to "postgres";

grant TRUNCATE on TABLE "public"."orders" to "postgres";

grant REFERENCES on TABLE "public"."orders" to "postgres";

grant TRIGGER on TABLE "public"."orders" to "postgres";

grant MAINTAIN on TABLE "public"."orders" to "postgres";

grant SELECT on TABLE "public"."orders" to "authenticated";

grant DELETE on TABLE "public"."orders" to "authenticated";

grant MAINTAIN on TABLE "public"."orders" to "authenticated";

grant INSERT on TABLE "public"."orders" to "service_role";

grant SELECT on TABLE "public"."orders" to "service_role";

grant UPDATE on TABLE "public"."orders" to "service_role";

grant DELETE on TABLE "public"."orders" to "service_role";

grant TRUNCATE on TABLE "public"."orders" to "service_role";

grant REFERENCES on TABLE "public"."orders" to "service_role";

grant TRIGGER on TABLE "public"."orders" to "service_role";

grant MAINTAIN on TABLE "public"."orders" to "service_role";

revoke all privileges on TABLE "public"."payment_methods" from PUBLIC, "anon", "authenticated", "service_role", "postgres";

grant INSERT on TABLE "public"."payment_methods" to "postgres";

grant SELECT on TABLE "public"."payment_methods" to "postgres";

grant UPDATE on TABLE "public"."payment_methods" to "postgres";

grant DELETE on TABLE "public"."payment_methods" to "postgres";

grant TRUNCATE on TABLE "public"."payment_methods" to "postgres";

grant REFERENCES on TABLE "public"."payment_methods" to "postgres";

grant TRIGGER on TABLE "public"."payment_methods" to "postgres";

grant MAINTAIN on TABLE "public"."payment_methods" to "postgres";

grant INSERT on TABLE "public"."payment_methods" to "authenticated";

grant SELECT on TABLE "public"."payment_methods" to "authenticated";

grant UPDATE on TABLE "public"."payment_methods" to "authenticated";

grant DELETE on TABLE "public"."payment_methods" to "authenticated";

grant MAINTAIN on TABLE "public"."payment_methods" to "authenticated";

grant INSERT on TABLE "public"."payment_methods" to "service_role";

grant SELECT on TABLE "public"."payment_methods" to "service_role";

grant UPDATE on TABLE "public"."payment_methods" to "service_role";

grant DELETE on TABLE "public"."payment_methods" to "service_role";

grant TRUNCATE on TABLE "public"."payment_methods" to "service_role";

grant REFERENCES on TABLE "public"."payment_methods" to "service_role";

grant TRIGGER on TABLE "public"."payment_methods" to "service_role";

grant MAINTAIN on TABLE "public"."payment_methods" to "service_role";

revoke all privileges on TABLE "public"."payment_payouts" from PUBLIC, "anon", "authenticated", "service_role", "postgres";

grant INSERT on TABLE "public"."payment_payouts" to "postgres";

grant SELECT on TABLE "public"."payment_payouts" to "postgres";

grant UPDATE on TABLE "public"."payment_payouts" to "postgres";

grant DELETE on TABLE "public"."payment_payouts" to "postgres";

grant TRUNCATE on TABLE "public"."payment_payouts" to "postgres";

grant REFERENCES on TABLE "public"."payment_payouts" to "postgres";

grant TRIGGER on TABLE "public"."payment_payouts" to "postgres";

grant MAINTAIN on TABLE "public"."payment_payouts" to "postgres";

grant INSERT on TABLE "public"."payment_payouts" to "authenticated";

grant SELECT on TABLE "public"."payment_payouts" to "authenticated";

grant UPDATE on TABLE "public"."payment_payouts" to "authenticated";

grant DELETE on TABLE "public"."payment_payouts" to "authenticated";

grant MAINTAIN on TABLE "public"."payment_payouts" to "authenticated";

grant INSERT on TABLE "public"."payment_payouts" to "service_role";

grant SELECT on TABLE "public"."payment_payouts" to "service_role";

grant UPDATE on TABLE "public"."payment_payouts" to "service_role";

grant DELETE on TABLE "public"."payment_payouts" to "service_role";

grant TRUNCATE on TABLE "public"."payment_payouts" to "service_role";

grant REFERENCES on TABLE "public"."payment_payouts" to "service_role";

grant TRIGGER on TABLE "public"."payment_payouts" to "service_role";

grant MAINTAIN on TABLE "public"."payment_payouts" to "service_role";

revoke all privileges on TABLE "public"."payment_webhook_events" from PUBLIC, "anon", "authenticated", "service_role", "postgres";

grant INSERT on TABLE "public"."payment_webhook_events" to "postgres";

grant SELECT on TABLE "public"."payment_webhook_events" to "postgres";

grant UPDATE on TABLE "public"."payment_webhook_events" to "postgres";

grant DELETE on TABLE "public"."payment_webhook_events" to "postgres";

grant TRUNCATE on TABLE "public"."payment_webhook_events" to "postgres";

grant REFERENCES on TABLE "public"."payment_webhook_events" to "postgres";

grant TRIGGER on TABLE "public"."payment_webhook_events" to "postgres";

grant MAINTAIN on TABLE "public"."payment_webhook_events" to "postgres";

grant INSERT on TABLE "public"."payment_webhook_events" to "authenticated";

grant SELECT on TABLE "public"."payment_webhook_events" to "authenticated";

grant UPDATE on TABLE "public"."payment_webhook_events" to "authenticated";

grant DELETE on TABLE "public"."payment_webhook_events" to "authenticated";

grant MAINTAIN on TABLE "public"."payment_webhook_events" to "authenticated";

grant INSERT on TABLE "public"."payment_webhook_events" to "service_role";

grant SELECT on TABLE "public"."payment_webhook_events" to "service_role";

grant UPDATE on TABLE "public"."payment_webhook_events" to "service_role";

grant DELETE on TABLE "public"."payment_webhook_events" to "service_role";

grant TRUNCATE on TABLE "public"."payment_webhook_events" to "service_role";

grant REFERENCES on TABLE "public"."payment_webhook_events" to "service_role";

grant TRIGGER on TABLE "public"."payment_webhook_events" to "service_role";

grant MAINTAIN on TABLE "public"."payment_webhook_events" to "service_role";

revoke all privileges on TABLE "public"."plan_payments" from PUBLIC, "anon", "authenticated", "service_role", "postgres";

grant INSERT on TABLE "public"."plan_payments" to "postgres";

grant SELECT on TABLE "public"."plan_payments" to "postgres";

grant UPDATE on TABLE "public"."plan_payments" to "postgres";

grant DELETE on TABLE "public"."plan_payments" to "postgres";

grant TRUNCATE on TABLE "public"."plan_payments" to "postgres";

grant REFERENCES on TABLE "public"."plan_payments" to "postgres";

grant TRIGGER on TABLE "public"."plan_payments" to "postgres";

grant MAINTAIN on TABLE "public"."plan_payments" to "postgres";

grant INSERT on TABLE "public"."plan_payments" to "authenticated";

grant SELECT on TABLE "public"."plan_payments" to "authenticated";

grant UPDATE on TABLE "public"."plan_payments" to "authenticated";

grant DELETE on TABLE "public"."plan_payments" to "authenticated";

grant MAINTAIN on TABLE "public"."plan_payments" to "authenticated";

grant INSERT on TABLE "public"."plan_payments" to "service_role";

grant SELECT on TABLE "public"."plan_payments" to "service_role";

grant UPDATE on TABLE "public"."plan_payments" to "service_role";

grant DELETE on TABLE "public"."plan_payments" to "service_role";

grant TRUNCATE on TABLE "public"."plan_payments" to "service_role";

grant REFERENCES on TABLE "public"."plan_payments" to "service_role";

grant TRIGGER on TABLE "public"."plan_payments" to "service_role";

grant MAINTAIN on TABLE "public"."plan_payments" to "service_role";

revoke all privileges on TABLE "public"."platform_admin_invites" from PUBLIC, "anon", "authenticated", "service_role", "postgres";

grant INSERT on TABLE "public"."platform_admin_invites" to "postgres";

grant SELECT on TABLE "public"."platform_admin_invites" to "postgres";

grant UPDATE on TABLE "public"."platform_admin_invites" to "postgres";

grant DELETE on TABLE "public"."platform_admin_invites" to "postgres";

grant TRUNCATE on TABLE "public"."platform_admin_invites" to "postgres";

grant REFERENCES on TABLE "public"."platform_admin_invites" to "postgres";

grant TRIGGER on TABLE "public"."platform_admin_invites" to "postgres";

grant MAINTAIN on TABLE "public"."platform_admin_invites" to "postgres";

grant INSERT on TABLE "public"."platform_admin_invites" to "service_role";

grant SELECT on TABLE "public"."platform_admin_invites" to "service_role";

grant UPDATE on TABLE "public"."platform_admin_invites" to "service_role";

revoke all privileges on TABLE "public"."platform_admins" from PUBLIC, "anon", "authenticated", "service_role", "postgres";

grant INSERT on TABLE "public"."platform_admins" to "postgres";

grant SELECT on TABLE "public"."platform_admins" to "postgres";

grant UPDATE on TABLE "public"."platform_admins" to "postgres";

grant DELETE on TABLE "public"."platform_admins" to "postgres";

grant TRUNCATE on TABLE "public"."platform_admins" to "postgres";

grant REFERENCES on TABLE "public"."platform_admins" to "postgres";

grant TRIGGER on TABLE "public"."platform_admins" to "postgres";

grant MAINTAIN on TABLE "public"."platform_admins" to "postgres";

grant INSERT on TABLE "public"."platform_admins" to "service_role";

grant SELECT on TABLE "public"."platform_admins" to "service_role";

grant UPDATE on TABLE "public"."platform_admins" to "service_role";

grant DELETE on TABLE "public"."platform_admins" to "service_role";

grant TRUNCATE on TABLE "public"."platform_admins" to "service_role";

grant REFERENCES on TABLE "public"."platform_admins" to "service_role";

grant TRIGGER on TABLE "public"."platform_admins" to "service_role";

grant MAINTAIN on TABLE "public"."platform_admins" to "service_role";

revoke all privileges on TABLE "public"."platform_feature_flags" from PUBLIC, "anon", "authenticated", "service_role", "postgres";

grant INSERT on TABLE "public"."platform_feature_flags" to "postgres";

grant SELECT on TABLE "public"."platform_feature_flags" to "postgres";

grant UPDATE on TABLE "public"."platform_feature_flags" to "postgres";

grant DELETE on TABLE "public"."platform_feature_flags" to "postgres";

grant TRUNCATE on TABLE "public"."platform_feature_flags" to "postgres";

grant REFERENCES on TABLE "public"."platform_feature_flags" to "postgres";

grant TRIGGER on TABLE "public"."platform_feature_flags" to "postgres";

grant MAINTAIN on TABLE "public"."platform_feature_flags" to "postgres";

grant INSERT on TABLE "public"."platform_feature_flags" to "service_role";

grant SELECT on TABLE "public"."platform_feature_flags" to "service_role";

grant UPDATE on TABLE "public"."platform_feature_flags" to "service_role";

grant DELETE on TABLE "public"."platform_feature_flags" to "service_role";

grant TRUNCATE on TABLE "public"."platform_feature_flags" to "service_role";

grant REFERENCES on TABLE "public"."platform_feature_flags" to "service_role";

grant TRIGGER on TABLE "public"."platform_feature_flags" to "service_role";

grant MAINTAIN on TABLE "public"."platform_feature_flags" to "service_role";

revoke all privileges on TABLE "public"."platform_support_ticket_events" from PUBLIC, "anon", "authenticated", "service_role", "postgres";

grant INSERT on TABLE "public"."platform_support_ticket_events" to "postgres";

grant SELECT on TABLE "public"."platform_support_ticket_events" to "postgres";

grant UPDATE on TABLE "public"."platform_support_ticket_events" to "postgres";

grant DELETE on TABLE "public"."platform_support_ticket_events" to "postgres";

grant TRUNCATE on TABLE "public"."platform_support_ticket_events" to "postgres";

grant REFERENCES on TABLE "public"."platform_support_ticket_events" to "postgres";

grant TRIGGER on TABLE "public"."platform_support_ticket_events" to "postgres";

grant MAINTAIN on TABLE "public"."platform_support_ticket_events" to "postgres";

grant INSERT on TABLE "public"."platform_support_ticket_events" to "service_role";

grant SELECT on TABLE "public"."platform_support_ticket_events" to "service_role";

grant UPDATE on TABLE "public"."platform_support_ticket_events" to "service_role";

grant DELETE on TABLE "public"."platform_support_ticket_events" to "service_role";

grant TRUNCATE on TABLE "public"."platform_support_ticket_events" to "service_role";

grant REFERENCES on TABLE "public"."platform_support_ticket_events" to "service_role";

grant TRIGGER on TABLE "public"."platform_support_ticket_events" to "service_role";

grant MAINTAIN on TABLE "public"."platform_support_ticket_events" to "service_role";

revoke all privileges on TABLE "public"."platform_support_tickets" from PUBLIC, "anon", "authenticated", "service_role", "postgres";

grant INSERT on TABLE "public"."platform_support_tickets" to "postgres";

grant SELECT on TABLE "public"."platform_support_tickets" to "postgres";

grant UPDATE on TABLE "public"."platform_support_tickets" to "postgres";

grant DELETE on TABLE "public"."platform_support_tickets" to "postgres";

grant TRUNCATE on TABLE "public"."platform_support_tickets" to "postgres";

grant REFERENCES on TABLE "public"."platform_support_tickets" to "postgres";

grant TRIGGER on TABLE "public"."platform_support_tickets" to "postgres";

grant MAINTAIN on TABLE "public"."platform_support_tickets" to "postgres";

grant INSERT on TABLE "public"."platform_support_tickets" to "service_role";

grant SELECT on TABLE "public"."platform_support_tickets" to "service_role";

grant UPDATE on TABLE "public"."platform_support_tickets" to "service_role";

grant DELETE on TABLE "public"."platform_support_tickets" to "service_role";

grant TRUNCATE on TABLE "public"."platform_support_tickets" to "service_role";

grant REFERENCES on TABLE "public"."platform_support_tickets" to "service_role";

grant TRIGGER on TABLE "public"."platform_support_tickets" to "service_role";

grant MAINTAIN on TABLE "public"."platform_support_tickets" to "service_role";

revoke all privileges on TABLE "public"."product_analytics_events" from PUBLIC, "anon", "authenticated", "service_role", "postgres";

grant INSERT on TABLE "public"."product_analytics_events" to "postgres";

grant SELECT on TABLE "public"."product_analytics_events" to "postgres";

grant UPDATE on TABLE "public"."product_analytics_events" to "postgres";

grant DELETE on TABLE "public"."product_analytics_events" to "postgres";

grant TRUNCATE on TABLE "public"."product_analytics_events" to "postgres";

grant REFERENCES on TABLE "public"."product_analytics_events" to "postgres";

grant TRIGGER on TABLE "public"."product_analytics_events" to "postgres";

grant MAINTAIN on TABLE "public"."product_analytics_events" to "postgres";

grant INSERT on TABLE "public"."product_analytics_events" to "service_role";

grant SELECT on TABLE "public"."product_analytics_events" to "service_role";

grant UPDATE on TABLE "public"."product_analytics_events" to "service_role";

grant DELETE on TABLE "public"."product_analytics_events" to "service_role";

grant TRUNCATE on TABLE "public"."product_analytics_events" to "service_role";

grant REFERENCES on TABLE "public"."product_analytics_events" to "service_role";

grant TRIGGER on TABLE "public"."product_analytics_events" to "service_role";

grant MAINTAIN on TABLE "public"."product_analytics_events" to "service_role";

revoke all privileges on SEQUENCE "public"."product_analytics_events_id_seq" from PUBLIC, "anon", "authenticated", "service_role", "postgres";

grant SELECT on SEQUENCE "public"."product_analytics_events_id_seq" to "postgres";

grant UPDATE on SEQUENCE "public"."product_analytics_events_id_seq" to "postgres";

grant USAGE on SEQUENCE "public"."product_analytics_events_id_seq" to "postgres";

grant SELECT on SEQUENCE "public"."product_analytics_events_id_seq" to "anon";

grant UPDATE on SEQUENCE "public"."product_analytics_events_id_seq" to "anon";

grant USAGE on SEQUENCE "public"."product_analytics_events_id_seq" to "anon";

grant SELECT on SEQUENCE "public"."product_analytics_events_id_seq" to "authenticated";

grant UPDATE on SEQUENCE "public"."product_analytics_events_id_seq" to "authenticated";

grant USAGE on SEQUENCE "public"."product_analytics_events_id_seq" to "authenticated";

grant SELECT on SEQUENCE "public"."product_analytics_events_id_seq" to "service_role";

grant UPDATE on SEQUENCE "public"."product_analytics_events_id_seq" to "service_role";

grant USAGE on SEQUENCE "public"."product_analytics_events_id_seq" to "service_role";

revoke all privileges on TABLE "public"."product_stock_movements" from PUBLIC, "anon", "authenticated", "service_role", "postgres";

grant INSERT on TABLE "public"."product_stock_movements" to "postgres";

grant SELECT on TABLE "public"."product_stock_movements" to "postgres";

grant UPDATE on TABLE "public"."product_stock_movements" to "postgres";

grant DELETE on TABLE "public"."product_stock_movements" to "postgres";

grant TRUNCATE on TABLE "public"."product_stock_movements" to "postgres";

grant REFERENCES on TABLE "public"."product_stock_movements" to "postgres";

grant TRIGGER on TABLE "public"."product_stock_movements" to "postgres";

grant MAINTAIN on TABLE "public"."product_stock_movements" to "postgres";

grant INSERT on TABLE "public"."product_stock_movements" to "service_role";

grant SELECT on TABLE "public"."product_stock_movements" to "service_role";

grant UPDATE on TABLE "public"."product_stock_movements" to "service_role";

grant DELETE on TABLE "public"."product_stock_movements" to "service_role";

grant TRUNCATE on TABLE "public"."product_stock_movements" to "service_role";

grant REFERENCES on TABLE "public"."product_stock_movements" to "service_role";

grant TRIGGER on TABLE "public"."product_stock_movements" to "service_role";

grant MAINTAIN on TABLE "public"."product_stock_movements" to "service_role";

revoke all privileges on TABLE "public"."production_dashboard" from PUBLIC, "anon", "authenticated", "service_role", "postgres";

grant INSERT on TABLE "public"."production_dashboard" to "postgres";

grant SELECT on TABLE "public"."production_dashboard" to "postgres";

grant UPDATE on TABLE "public"."production_dashboard" to "postgres";

grant DELETE on TABLE "public"."production_dashboard" to "postgres";

grant TRUNCATE on TABLE "public"."production_dashboard" to "postgres";

grant REFERENCES on TABLE "public"."production_dashboard" to "postgres";

grant TRIGGER on TABLE "public"."production_dashboard" to "postgres";

grant MAINTAIN on TABLE "public"."production_dashboard" to "postgres";

grant SELECT on TABLE "public"."production_dashboard" to "authenticated";

grant SELECT on TABLE "public"."production_dashboard" to "service_role";

revoke all privileges on TABLE "public"."production_orders" from PUBLIC, "anon", "authenticated", "service_role", "postgres";

grant INSERT on TABLE "public"."production_orders" to "postgres";

grant SELECT on TABLE "public"."production_orders" to "postgres";

grant UPDATE on TABLE "public"."production_orders" to "postgres";

grant DELETE on TABLE "public"."production_orders" to "postgres";

grant TRUNCATE on TABLE "public"."production_orders" to "postgres";

grant REFERENCES on TABLE "public"."production_orders" to "postgres";

grant TRIGGER on TABLE "public"."production_orders" to "postgres";

grant MAINTAIN on TABLE "public"."production_orders" to "postgres";

grant INSERT on TABLE "public"."production_orders" to "authenticated";

grant SELECT on TABLE "public"."production_orders" to "authenticated";

grant UPDATE on TABLE "public"."production_orders" to "authenticated";

grant DELETE on TABLE "public"."production_orders" to "authenticated";

grant MAINTAIN on TABLE "public"."production_orders" to "authenticated";

grant INSERT on TABLE "public"."production_orders" to "service_role";

grant SELECT on TABLE "public"."production_orders" to "service_role";

grant UPDATE on TABLE "public"."production_orders" to "service_role";

grant DELETE on TABLE "public"."production_orders" to "service_role";

grant TRUNCATE on TABLE "public"."production_orders" to "service_role";

grant REFERENCES on TABLE "public"."production_orders" to "service_role";

grant TRIGGER on TABLE "public"."production_orders" to "service_role";

grant MAINTAIN on TABLE "public"."production_orders" to "service_role";

revoke all privileges on TABLE "public"."production_steps" from PUBLIC, "anon", "authenticated", "service_role", "postgres";

grant INSERT on TABLE "public"."production_steps" to "postgres";

grant SELECT on TABLE "public"."production_steps" to "postgres";

grant UPDATE on TABLE "public"."production_steps" to "postgres";

grant DELETE on TABLE "public"."production_steps" to "postgres";

grant TRUNCATE on TABLE "public"."production_steps" to "postgres";

grant REFERENCES on TABLE "public"."production_steps" to "postgres";

grant TRIGGER on TABLE "public"."production_steps" to "postgres";

grant MAINTAIN on TABLE "public"."production_steps" to "postgres";

grant INSERT on TABLE "public"."production_steps" to "authenticated";

grant SELECT on TABLE "public"."production_steps" to "authenticated";

grant UPDATE on TABLE "public"."production_steps" to "authenticated";

grant DELETE on TABLE "public"."production_steps" to "authenticated";

grant MAINTAIN on TABLE "public"."production_steps" to "authenticated";

grant INSERT on TABLE "public"."production_steps" to "service_role";

grant SELECT on TABLE "public"."production_steps" to "service_role";

grant UPDATE on TABLE "public"."production_steps" to "service_role";

grant DELETE on TABLE "public"."production_steps" to "service_role";

grant TRUNCATE on TABLE "public"."production_steps" to "service_role";

grant REFERENCES on TABLE "public"."production_steps" to "service_role";

grant TRIGGER on TABLE "public"."production_steps" to "service_role";

grant MAINTAIN on TABLE "public"."production_steps" to "service_role";

revoke all privileges on TABLE "public"."products" from PUBLIC, "anon", "authenticated", "service_role", "postgres";

grant INSERT on TABLE "public"."products" to "postgres";

grant SELECT on TABLE "public"."products" to "postgres";

grant UPDATE on TABLE "public"."products" to "postgres";

grant DELETE on TABLE "public"."products" to "postgres";

grant TRUNCATE on TABLE "public"."products" to "postgres";

grant REFERENCES on TABLE "public"."products" to "postgres";

grant TRIGGER on TABLE "public"."products" to "postgres";

grant MAINTAIN on TABLE "public"."products" to "postgres";

grant INSERT on TABLE "public"."products" to "authenticated";

grant SELECT on TABLE "public"."products" to "authenticated";

grant UPDATE on TABLE "public"."products" to "authenticated";

grant DELETE on TABLE "public"."products" to "authenticated";

grant MAINTAIN on TABLE "public"."products" to "authenticated";

grant INSERT on TABLE "public"."products" to "service_role";

grant SELECT on TABLE "public"."products" to "service_role";

grant UPDATE on TABLE "public"."products" to "service_role";

grant DELETE on TABLE "public"."products" to "service_role";

grant TRUNCATE on TABLE "public"."products" to "service_role";

grant REFERENCES on TABLE "public"."products" to "service_role";

grant TRIGGER on TABLE "public"."products" to "service_role";

grant MAINTAIN on TABLE "public"."products" to "service_role";

revoke all privileges on TABLE "public"."proposal_events" from PUBLIC, "anon", "authenticated", "service_role", "postgres";

grant INSERT on TABLE "public"."proposal_events" to "postgres";

grant SELECT on TABLE "public"."proposal_events" to "postgres";

grant UPDATE on TABLE "public"."proposal_events" to "postgres";

grant DELETE on TABLE "public"."proposal_events" to "postgres";

grant TRUNCATE on TABLE "public"."proposal_events" to "postgres";

grant REFERENCES on TABLE "public"."proposal_events" to "postgres";

grant TRIGGER on TABLE "public"."proposal_events" to "postgres";

grant MAINTAIN on TABLE "public"."proposal_events" to "postgres";

grant INSERT on TABLE "public"."proposal_events" to "authenticated";

grant SELECT on TABLE "public"."proposal_events" to "authenticated";

grant UPDATE on TABLE "public"."proposal_events" to "authenticated";

grant DELETE on TABLE "public"."proposal_events" to "authenticated";

grant MAINTAIN on TABLE "public"."proposal_events" to "authenticated";

grant INSERT on TABLE "public"."proposal_events" to "service_role";

grant SELECT on TABLE "public"."proposal_events" to "service_role";

grant UPDATE on TABLE "public"."proposal_events" to "service_role";

grant DELETE on TABLE "public"."proposal_events" to "service_role";

grant TRUNCATE on TABLE "public"."proposal_events" to "service_role";

grant REFERENCES on TABLE "public"."proposal_events" to "service_role";

grant TRIGGER on TABLE "public"."proposal_events" to "service_role";

grant MAINTAIN on TABLE "public"."proposal_events" to "service_role";

revoke all privileges on TABLE "public"."proposals" from PUBLIC, "anon", "authenticated", "service_role", "postgres";

grant INSERT on TABLE "public"."proposals" to "postgres";

grant SELECT on TABLE "public"."proposals" to "postgres";

grant UPDATE on TABLE "public"."proposals" to "postgres";

grant DELETE on TABLE "public"."proposals" to "postgres";

grant TRUNCATE on TABLE "public"."proposals" to "postgres";

grant REFERENCES on TABLE "public"."proposals" to "postgres";

grant TRIGGER on TABLE "public"."proposals" to "postgres";

grant MAINTAIN on TABLE "public"."proposals" to "postgres";

grant INSERT on TABLE "public"."proposals" to "authenticated";

grant SELECT on TABLE "public"."proposals" to "authenticated";

grant UPDATE on TABLE "public"."proposals" to "authenticated";

grant DELETE on TABLE "public"."proposals" to "authenticated";

grant MAINTAIN on TABLE "public"."proposals" to "authenticated";

grant INSERT on TABLE "public"."proposals" to "service_role";

grant SELECT on TABLE "public"."proposals" to "service_role";

grant UPDATE on TABLE "public"."proposals" to "service_role";

grant DELETE on TABLE "public"."proposals" to "service_role";

grant TRUNCATE on TABLE "public"."proposals" to "service_role";

grant REFERENCES on TABLE "public"."proposals" to "service_role";

grant TRIGGER on TABLE "public"."proposals" to "service_role";

grant MAINTAIN on TABLE "public"."proposals" to "service_role";

revoke all privileges on TABLE "public"."proposals_dashboard" from PUBLIC, "anon", "authenticated", "service_role", "postgres";

grant INSERT on TABLE "public"."proposals_dashboard" to "postgres";

grant SELECT on TABLE "public"."proposals_dashboard" to "postgres";

grant UPDATE on TABLE "public"."proposals_dashboard" to "postgres";

grant DELETE on TABLE "public"."proposals_dashboard" to "postgres";

grant TRUNCATE on TABLE "public"."proposals_dashboard" to "postgres";

grant REFERENCES on TABLE "public"."proposals_dashboard" to "postgres";

grant TRIGGER on TABLE "public"."proposals_dashboard" to "postgres";

grant MAINTAIN on TABLE "public"."proposals_dashboard" to "postgres";

grant SELECT on TABLE "public"."proposals_dashboard" to "authenticated";

grant SELECT on TABLE "public"."proposals_dashboard" to "service_role";

revoke all privileges on TABLE "public"."provider_customers" from PUBLIC, "anon", "authenticated", "service_role", "postgres";

grant INSERT on TABLE "public"."provider_customers" to "postgres";

grant SELECT on TABLE "public"."provider_customers" to "postgres";

grant UPDATE on TABLE "public"."provider_customers" to "postgres";

grant DELETE on TABLE "public"."provider_customers" to "postgres";

grant TRUNCATE on TABLE "public"."provider_customers" to "postgres";

grant REFERENCES on TABLE "public"."provider_customers" to "postgres";

grant TRIGGER on TABLE "public"."provider_customers" to "postgres";

grant MAINTAIN on TABLE "public"."provider_customers" to "postgres";

grant INSERT on TABLE "public"."provider_customers" to "authenticated";

grant SELECT on TABLE "public"."provider_customers" to "authenticated";

grant UPDATE on TABLE "public"."provider_customers" to "authenticated";

grant DELETE on TABLE "public"."provider_customers" to "authenticated";

grant MAINTAIN on TABLE "public"."provider_customers" to "authenticated";

grant INSERT on TABLE "public"."provider_customers" to "service_role";

grant SELECT on TABLE "public"."provider_customers" to "service_role";

grant UPDATE on TABLE "public"."provider_customers" to "service_role";

grant DELETE on TABLE "public"."provider_customers" to "service_role";

grant TRUNCATE on TABLE "public"."provider_customers" to "service_role";

grant REFERENCES on TABLE "public"."provider_customers" to "service_role";

grant TRIGGER on TABLE "public"."provider_customers" to "service_role";

grant MAINTAIN on TABLE "public"."provider_customers" to "service_role";

revoke all privileges on TABLE "public"."public_company_profiles" from PUBLIC, "anon", "authenticated", "service_role", "postgres";

grant INSERT on TABLE "public"."public_company_profiles" to "postgres";

grant SELECT on TABLE "public"."public_company_profiles" to "postgres";

grant UPDATE on TABLE "public"."public_company_profiles" to "postgres";

grant DELETE on TABLE "public"."public_company_profiles" to "postgres";

grant TRUNCATE on TABLE "public"."public_company_profiles" to "postgres";

grant REFERENCES on TABLE "public"."public_company_profiles" to "postgres";

grant TRIGGER on TABLE "public"."public_company_profiles" to "postgres";

grant MAINTAIN on TABLE "public"."public_company_profiles" to "postgres";

grant SELECT on TABLE "public"."public_company_profiles" to "anon";

grant SELECT on TABLE "public"."public_company_profiles" to "authenticated";

grant SELECT on TABLE "public"."public_company_profiles" to "service_role";

revoke all privileges on TABLE "public"."public_marketplace_companies" from PUBLIC, "anon", "authenticated", "service_role", "postgres";

grant INSERT on TABLE "public"."public_marketplace_companies" to "postgres";

grant SELECT on TABLE "public"."public_marketplace_companies" to "postgres";

grant UPDATE on TABLE "public"."public_marketplace_companies" to "postgres";

grant DELETE on TABLE "public"."public_marketplace_companies" to "postgres";

grant TRUNCATE on TABLE "public"."public_marketplace_companies" to "postgres";

grant REFERENCES on TABLE "public"."public_marketplace_companies" to "postgres";

grant TRIGGER on TABLE "public"."public_marketplace_companies" to "postgres";

grant MAINTAIN on TABLE "public"."public_marketplace_companies" to "postgres";

grant SELECT on TABLE "public"."public_marketplace_companies" to "anon";

grant SELECT on TABLE "public"."public_marketplace_companies" to "authenticated";

grant SELECT on TABLE "public"."public_marketplace_companies" to "service_role";

revoke all privileges on TABLE "public"."public_marketplace_products" from PUBLIC, "anon", "authenticated", "service_role", "postgres";

grant INSERT on TABLE "public"."public_marketplace_products" to "postgres";

grant SELECT on TABLE "public"."public_marketplace_products" to "postgres";

grant UPDATE on TABLE "public"."public_marketplace_products" to "postgres";

grant DELETE on TABLE "public"."public_marketplace_products" to "postgres";

grant TRUNCATE on TABLE "public"."public_marketplace_products" to "postgres";

grant REFERENCES on TABLE "public"."public_marketplace_products" to "postgres";

grant TRIGGER on TABLE "public"."public_marketplace_products" to "postgres";

grant MAINTAIN on TABLE "public"."public_marketplace_products" to "postgres";

grant SELECT on TABLE "public"."public_marketplace_products" to "anon";

grant SELECT on TABLE "public"."public_marketplace_products" to "authenticated";

grant SELECT on TABLE "public"."public_marketplace_products" to "service_role";

revoke all privileges on TABLE "public"."public_site_companies" from PUBLIC, "anon", "authenticated", "service_role", "postgres";

grant INSERT on TABLE "public"."public_site_companies" to "postgres";

grant SELECT on TABLE "public"."public_site_companies" to "postgres";

grant UPDATE on TABLE "public"."public_site_companies" to "postgres";

grant DELETE on TABLE "public"."public_site_companies" to "postgres";

grant TRUNCATE on TABLE "public"."public_site_companies" to "postgres";

grant REFERENCES on TABLE "public"."public_site_companies" to "postgres";

grant TRIGGER on TABLE "public"."public_site_companies" to "postgres";

grant MAINTAIN on TABLE "public"."public_site_companies" to "postgres";

grant SELECT on TABLE "public"."public_site_companies" to "anon";

grant SELECT on TABLE "public"."public_site_companies" to "authenticated";

grant SELECT on TABLE "public"."public_site_companies" to "service_role";

revoke all privileges on TABLE "public"."public_site_sections" from PUBLIC, "anon", "authenticated", "service_role", "postgres";

grant INSERT on TABLE "public"."public_site_sections" to "postgres";

grant SELECT on TABLE "public"."public_site_sections" to "postgres";

grant UPDATE on TABLE "public"."public_site_sections" to "postgres";

grant DELETE on TABLE "public"."public_site_sections" to "postgres";

grant TRUNCATE on TABLE "public"."public_site_sections" to "postgres";

grant REFERENCES on TABLE "public"."public_site_sections" to "postgres";

grant TRIGGER on TABLE "public"."public_site_sections" to "postgres";

grant MAINTAIN on TABLE "public"."public_site_sections" to "postgres";

grant SELECT on TABLE "public"."public_site_sections" to "anon";

grant SELECT on TABLE "public"."public_site_sections" to "authenticated";

grant SELECT on TABLE "public"."public_site_sections" to "service_role";

revoke all privileges on TABLE "public"."public_store_products" from PUBLIC, "anon", "authenticated", "service_role", "postgres";

grant INSERT on TABLE "public"."public_store_products" to "postgres";

grant SELECT on TABLE "public"."public_store_products" to "postgres";

grant UPDATE on TABLE "public"."public_store_products" to "postgres";

grant DELETE on TABLE "public"."public_store_products" to "postgres";

grant TRUNCATE on TABLE "public"."public_store_products" to "postgres";

grant REFERENCES on TABLE "public"."public_store_products" to "postgres";

grant TRIGGER on TABLE "public"."public_store_products" to "postgres";

grant MAINTAIN on TABLE "public"."public_store_products" to "postgres";

grant SELECT on TABLE "public"."public_store_products" to "anon";

grant SELECT on TABLE "public"."public_store_products" to "authenticated";

grant SELECT on TABLE "public"."public_store_products" to "service_role";

revoke all privileges on TABLE "public"."quote_templates" from PUBLIC, "anon", "authenticated", "service_role", "postgres";

grant INSERT on TABLE "public"."quote_templates" to "postgres";

grant SELECT on TABLE "public"."quote_templates" to "postgres";

grant UPDATE on TABLE "public"."quote_templates" to "postgres";

grant DELETE on TABLE "public"."quote_templates" to "postgres";

grant TRUNCATE on TABLE "public"."quote_templates" to "postgres";

grant REFERENCES on TABLE "public"."quote_templates" to "postgres";

grant TRIGGER on TABLE "public"."quote_templates" to "postgres";

grant MAINTAIN on TABLE "public"."quote_templates" to "postgres";

grant INSERT on TABLE "public"."quote_templates" to "authenticated";

grant SELECT on TABLE "public"."quote_templates" to "authenticated";

grant UPDATE on TABLE "public"."quote_templates" to "authenticated";

grant DELETE on TABLE "public"."quote_templates" to "authenticated";

grant MAINTAIN on TABLE "public"."quote_templates" to "authenticated";

grant INSERT on TABLE "public"."quote_templates" to "service_role";

grant SELECT on TABLE "public"."quote_templates" to "service_role";

grant UPDATE on TABLE "public"."quote_templates" to "service_role";

grant DELETE on TABLE "public"."quote_templates" to "service_role";

grant TRUNCATE on TABLE "public"."quote_templates" to "service_role";

grant REFERENCES on TABLE "public"."quote_templates" to "service_role";

grant TRIGGER on TABLE "public"."quote_templates" to "service_role";

grant MAINTAIN on TABLE "public"."quote_templates" to "service_role";

revoke all privileges on TABLE "public"."recurring_orders" from PUBLIC, "anon", "authenticated", "service_role", "postgres";

grant INSERT on TABLE "public"."recurring_orders" to "postgres";

grant SELECT on TABLE "public"."recurring_orders" to "postgres";

grant UPDATE on TABLE "public"."recurring_orders" to "postgres";

grant DELETE on TABLE "public"."recurring_orders" to "postgres";

grant TRUNCATE on TABLE "public"."recurring_orders" to "postgres";

grant REFERENCES on TABLE "public"."recurring_orders" to "postgres";

grant TRIGGER on TABLE "public"."recurring_orders" to "postgres";

grant MAINTAIN on TABLE "public"."recurring_orders" to "postgres";

grant INSERT on TABLE "public"."recurring_orders" to "authenticated";

grant SELECT on TABLE "public"."recurring_orders" to "authenticated";

grant UPDATE on TABLE "public"."recurring_orders" to "authenticated";

grant DELETE on TABLE "public"."recurring_orders" to "authenticated";

grant MAINTAIN on TABLE "public"."recurring_orders" to "authenticated";

grant INSERT on TABLE "public"."recurring_orders" to "service_role";

grant SELECT on TABLE "public"."recurring_orders" to "service_role";

grant UPDATE on TABLE "public"."recurring_orders" to "service_role";

grant DELETE on TABLE "public"."recurring_orders" to "service_role";

grant TRUNCATE on TABLE "public"."recurring_orders" to "service_role";

grant REFERENCES on TABLE "public"."recurring_orders" to "service_role";

grant TRIGGER on TABLE "public"."recurring_orders" to "service_role";

grant MAINTAIN on TABLE "public"."recurring_orders" to "service_role";

revoke all privileges on TABLE "public"."security_blocklist" from PUBLIC, "anon", "authenticated", "service_role", "postgres";

grant INSERT on TABLE "public"."security_blocklist" to "postgres";

grant SELECT on TABLE "public"."security_blocklist" to "postgres";

grant UPDATE on TABLE "public"."security_blocklist" to "postgres";

grant DELETE on TABLE "public"."security_blocklist" to "postgres";

grant TRUNCATE on TABLE "public"."security_blocklist" to "postgres";

grant REFERENCES on TABLE "public"."security_blocklist" to "postgres";

grant TRIGGER on TABLE "public"."security_blocklist" to "postgres";

grant MAINTAIN on TABLE "public"."security_blocklist" to "postgres";

grant INSERT on TABLE "public"."security_blocklist" to "authenticated";

grant SELECT on TABLE "public"."security_blocklist" to "authenticated";

grant UPDATE on TABLE "public"."security_blocklist" to "authenticated";

grant DELETE on TABLE "public"."security_blocklist" to "authenticated";

grant MAINTAIN on TABLE "public"."security_blocklist" to "authenticated";

grant INSERT on TABLE "public"."security_blocklist" to "service_role";

grant SELECT on TABLE "public"."security_blocklist" to "service_role";

grant UPDATE on TABLE "public"."security_blocklist" to "service_role";

grant DELETE on TABLE "public"."security_blocklist" to "service_role";

grant TRUNCATE on TABLE "public"."security_blocklist" to "service_role";

grant REFERENCES on TABLE "public"."security_blocklist" to "service_role";

grant TRIGGER on TABLE "public"."security_blocklist" to "service_role";

grant MAINTAIN on TABLE "public"."security_blocklist" to "service_role";

revoke all privileges on TABLE "public"."security_events" from PUBLIC, "anon", "authenticated", "service_role", "postgres";

grant INSERT on TABLE "public"."security_events" to "postgres";

grant SELECT on TABLE "public"."security_events" to "postgres";

grant UPDATE on TABLE "public"."security_events" to "postgres";

grant DELETE on TABLE "public"."security_events" to "postgres";

grant TRUNCATE on TABLE "public"."security_events" to "postgres";

grant REFERENCES on TABLE "public"."security_events" to "postgres";

grant TRIGGER on TABLE "public"."security_events" to "postgres";

grant MAINTAIN on TABLE "public"."security_events" to "postgres";

grant INSERT on TABLE "public"."security_events" to "authenticated";

grant SELECT on TABLE "public"."security_events" to "authenticated";

grant UPDATE on TABLE "public"."security_events" to "authenticated";

grant DELETE on TABLE "public"."security_events" to "authenticated";

grant MAINTAIN on TABLE "public"."security_events" to "authenticated";

grant INSERT on TABLE "public"."security_events" to "service_role";

grant SELECT on TABLE "public"."security_events" to "service_role";

grant UPDATE on TABLE "public"."security_events" to "service_role";

grant DELETE on TABLE "public"."security_events" to "service_role";

grant TRUNCATE on TABLE "public"."security_events" to "service_role";

grant REFERENCES on TABLE "public"."security_events" to "service_role";

grant TRIGGER on TABLE "public"."security_events" to "service_role";

grant MAINTAIN on TABLE "public"."security_events" to "service_role";

revoke all privileges on TABLE "public"."signup_lead_followups" from PUBLIC, "anon", "authenticated", "service_role", "postgres";

grant INSERT on TABLE "public"."signup_lead_followups" to "postgres";

grant SELECT on TABLE "public"."signup_lead_followups" to "postgres";

grant UPDATE on TABLE "public"."signup_lead_followups" to "postgres";

grant DELETE on TABLE "public"."signup_lead_followups" to "postgres";

grant TRUNCATE on TABLE "public"."signup_lead_followups" to "postgres";

grant REFERENCES on TABLE "public"."signup_lead_followups" to "postgres";

grant TRIGGER on TABLE "public"."signup_lead_followups" to "postgres";

grant MAINTAIN on TABLE "public"."signup_lead_followups" to "postgres";

grant INSERT on TABLE "public"."signup_lead_followups" to "authenticated";

grant SELECT on TABLE "public"."signup_lead_followups" to "authenticated";

grant UPDATE on TABLE "public"."signup_lead_followups" to "authenticated";

grant DELETE on TABLE "public"."signup_lead_followups" to "authenticated";

grant MAINTAIN on TABLE "public"."signup_lead_followups" to "authenticated";

grant INSERT on TABLE "public"."signup_lead_followups" to "service_role";

grant SELECT on TABLE "public"."signup_lead_followups" to "service_role";

grant UPDATE on TABLE "public"."signup_lead_followups" to "service_role";

grant DELETE on TABLE "public"."signup_lead_followups" to "service_role";

grant TRUNCATE on TABLE "public"."signup_lead_followups" to "service_role";

grant REFERENCES on TABLE "public"."signup_lead_followups" to "service_role";

grant TRIGGER on TABLE "public"."signup_lead_followups" to "service_role";

grant MAINTAIN on TABLE "public"."signup_lead_followups" to "service_role";

revoke all privileges on TABLE "public"."signup_leads" from PUBLIC, "anon", "authenticated", "service_role", "postgres";

grant INSERT on TABLE "public"."signup_leads" to "postgres";

grant SELECT on TABLE "public"."signup_leads" to "postgres";

grant UPDATE on TABLE "public"."signup_leads" to "postgres";

grant DELETE on TABLE "public"."signup_leads" to "postgres";

grant TRUNCATE on TABLE "public"."signup_leads" to "postgres";

grant REFERENCES on TABLE "public"."signup_leads" to "postgres";

grant TRIGGER on TABLE "public"."signup_leads" to "postgres";

grant MAINTAIN on TABLE "public"."signup_leads" to "postgres";

grant INSERT on TABLE "public"."signup_leads" to "authenticated";

grant SELECT on TABLE "public"."signup_leads" to "authenticated";

grant UPDATE on TABLE "public"."signup_leads" to "authenticated";

grant DELETE on TABLE "public"."signup_leads" to "authenticated";

grant MAINTAIN on TABLE "public"."signup_leads" to "authenticated";

grant INSERT on TABLE "public"."signup_leads" to "service_role";

grant SELECT on TABLE "public"."signup_leads" to "service_role";

grant UPDATE on TABLE "public"."signup_leads" to "service_role";

grant DELETE on TABLE "public"."signup_leads" to "service_role";

grant TRUNCATE on TABLE "public"."signup_leads" to "service_role";

grant REFERENCES on TABLE "public"."signup_leads" to "service_role";

grant TRIGGER on TABLE "public"."signup_leads" to "service_role";

grant MAINTAIN on TABLE "public"."signup_leads" to "service_role";

revoke all privileges on TABLE "public"."site_sections" from PUBLIC, "anon", "authenticated", "service_role", "postgres";

grant INSERT on TABLE "public"."site_sections" to "postgres";

grant SELECT on TABLE "public"."site_sections" to "postgres";

grant UPDATE on TABLE "public"."site_sections" to "postgres";

grant DELETE on TABLE "public"."site_sections" to "postgres";

grant TRUNCATE on TABLE "public"."site_sections" to "postgres";

grant REFERENCES on TABLE "public"."site_sections" to "postgres";

grant TRIGGER on TABLE "public"."site_sections" to "postgres";

grant MAINTAIN on TABLE "public"."site_sections" to "postgres";

grant INSERT on TABLE "public"."site_sections" to "authenticated";

grant SELECT on TABLE "public"."site_sections" to "authenticated";

grant UPDATE on TABLE "public"."site_sections" to "authenticated";

grant DELETE on TABLE "public"."site_sections" to "authenticated";

grant MAINTAIN on TABLE "public"."site_sections" to "authenticated";

grant INSERT on TABLE "public"."site_sections" to "service_role";

grant SELECT on TABLE "public"."site_sections" to "service_role";

grant UPDATE on TABLE "public"."site_sections" to "service_role";

grant DELETE on TABLE "public"."site_sections" to "service_role";

grant TRUNCATE on TABLE "public"."site_sections" to "service_role";

grant REFERENCES on TABLE "public"."site_sections" to "service_role";

grant TRIGGER on TABLE "public"."site_sections" to "service_role";

grant MAINTAIN on TABLE "public"."site_sections" to "service_role";

revoke all privileges on TABLE "public"."site_template_presets" from PUBLIC, "anon", "authenticated", "service_role", "postgres";

grant INSERT on TABLE "public"."site_template_presets" to "postgres";

grant SELECT on TABLE "public"."site_template_presets" to "postgres";

grant UPDATE on TABLE "public"."site_template_presets" to "postgres";

grant DELETE on TABLE "public"."site_template_presets" to "postgres";

grant TRUNCATE on TABLE "public"."site_template_presets" to "postgres";

grant REFERENCES on TABLE "public"."site_template_presets" to "postgres";

grant TRIGGER on TABLE "public"."site_template_presets" to "postgres";

grant MAINTAIN on TABLE "public"."site_template_presets" to "postgres";

grant INSERT on TABLE "public"."site_template_presets" to "authenticated";

grant SELECT on TABLE "public"."site_template_presets" to "authenticated";

grant UPDATE on TABLE "public"."site_template_presets" to "authenticated";

grant DELETE on TABLE "public"."site_template_presets" to "authenticated";

grant MAINTAIN on TABLE "public"."site_template_presets" to "authenticated";

grant INSERT on TABLE "public"."site_template_presets" to "service_role";

grant SELECT on TABLE "public"."site_template_presets" to "service_role";

grant UPDATE on TABLE "public"."site_template_presets" to "service_role";

grant DELETE on TABLE "public"."site_template_presets" to "service_role";

grant TRUNCATE on TABLE "public"."site_template_presets" to "service_role";

grant REFERENCES on TABLE "public"."site_template_presets" to "service_role";

grant TRIGGER on TABLE "public"."site_template_presets" to "service_role";

grant MAINTAIN on TABLE "public"."site_template_presets" to "service_role";

revoke all privileges on TABLE "public"."smart_notification_events" from PUBLIC, "anon", "authenticated", "service_role", "postgres";

grant INSERT on TABLE "public"."smart_notification_events" to "postgres";

grant SELECT on TABLE "public"."smart_notification_events" to "postgres";

grant UPDATE on TABLE "public"."smart_notification_events" to "postgres";

grant DELETE on TABLE "public"."smart_notification_events" to "postgres";

grant TRUNCATE on TABLE "public"."smart_notification_events" to "postgres";

grant REFERENCES on TABLE "public"."smart_notification_events" to "postgres";

grant TRIGGER on TABLE "public"."smart_notification_events" to "postgres";

grant MAINTAIN on TABLE "public"."smart_notification_events" to "postgres";

grant INSERT on TABLE "public"."smart_notification_events" to "authenticated";

grant SELECT on TABLE "public"."smart_notification_events" to "authenticated";

grant UPDATE on TABLE "public"."smart_notification_events" to "authenticated";

grant DELETE on TABLE "public"."smart_notification_events" to "authenticated";

grant MAINTAIN on TABLE "public"."smart_notification_events" to "authenticated";

grant INSERT on TABLE "public"."smart_notification_events" to "service_role";

grant SELECT on TABLE "public"."smart_notification_events" to "service_role";

grant UPDATE on TABLE "public"."smart_notification_events" to "service_role";

grant DELETE on TABLE "public"."smart_notification_events" to "service_role";

grant TRUNCATE on TABLE "public"."smart_notification_events" to "service_role";

grant REFERENCES on TABLE "public"."smart_notification_events" to "service_role";

grant TRIGGER on TABLE "public"."smart_notification_events" to "service_role";

grant MAINTAIN on TABLE "public"."smart_notification_events" to "service_role";

revoke all privileges on TABLE "public"."smart_notification_settings" from PUBLIC, "anon", "authenticated", "service_role", "postgres";

grant INSERT on TABLE "public"."smart_notification_settings" to "postgres";

grant SELECT on TABLE "public"."smart_notification_settings" to "postgres";

grant UPDATE on TABLE "public"."smart_notification_settings" to "postgres";

grant DELETE on TABLE "public"."smart_notification_settings" to "postgres";

grant TRUNCATE on TABLE "public"."smart_notification_settings" to "postgres";

grant REFERENCES on TABLE "public"."smart_notification_settings" to "postgres";

grant TRIGGER on TABLE "public"."smart_notification_settings" to "postgres";

grant MAINTAIN on TABLE "public"."smart_notification_settings" to "postgres";

grant INSERT on TABLE "public"."smart_notification_settings" to "authenticated";

grant SELECT on TABLE "public"."smart_notification_settings" to "authenticated";

grant UPDATE on TABLE "public"."smart_notification_settings" to "authenticated";

grant DELETE on TABLE "public"."smart_notification_settings" to "authenticated";

grant MAINTAIN on TABLE "public"."smart_notification_settings" to "authenticated";

grant INSERT on TABLE "public"."smart_notification_settings" to "service_role";

grant SELECT on TABLE "public"."smart_notification_settings" to "service_role";

grant UPDATE on TABLE "public"."smart_notification_settings" to "service_role";

grant DELETE on TABLE "public"."smart_notification_settings" to "service_role";

grant TRUNCATE on TABLE "public"."smart_notification_settings" to "service_role";

grant REFERENCES on TABLE "public"."smart_notification_settings" to "service_role";

grant TRIGGER on TABLE "public"."smart_notification_settings" to "service_role";

grant MAINTAIN on TABLE "public"."smart_notification_settings" to "service_role";

revoke all privileges on TABLE "public"."subscription_events" from PUBLIC, "anon", "authenticated", "service_role", "postgres";

grant INSERT on TABLE "public"."subscription_events" to "postgres";

grant SELECT on TABLE "public"."subscription_events" to "postgres";

grant UPDATE on TABLE "public"."subscription_events" to "postgres";

grant DELETE on TABLE "public"."subscription_events" to "postgres";

grant TRUNCATE on TABLE "public"."subscription_events" to "postgres";

grant REFERENCES on TABLE "public"."subscription_events" to "postgres";

grant TRIGGER on TABLE "public"."subscription_events" to "postgres";

grant MAINTAIN on TABLE "public"."subscription_events" to "postgres";

grant INSERT on TABLE "public"."subscription_events" to "authenticated";

grant SELECT on TABLE "public"."subscription_events" to "authenticated";

grant UPDATE on TABLE "public"."subscription_events" to "authenticated";

grant DELETE on TABLE "public"."subscription_events" to "authenticated";

grant MAINTAIN on TABLE "public"."subscription_events" to "authenticated";

grant INSERT on TABLE "public"."subscription_events" to "service_role";

grant SELECT on TABLE "public"."subscription_events" to "service_role";

grant UPDATE on TABLE "public"."subscription_events" to "service_role";

grant DELETE on TABLE "public"."subscription_events" to "service_role";

grant TRUNCATE on TABLE "public"."subscription_events" to "service_role";

grant REFERENCES on TABLE "public"."subscription_events" to "service_role";

grant TRIGGER on TABLE "public"."subscription_events" to "service_role";

grant MAINTAIN on TABLE "public"."subscription_events" to "service_role";

revoke all privileges on TABLE "public"."system_audit_logs" from PUBLIC, "anon", "authenticated", "service_role", "postgres";

grant INSERT on TABLE "public"."system_audit_logs" to "postgres";

grant SELECT on TABLE "public"."system_audit_logs" to "postgres";

grant UPDATE on TABLE "public"."system_audit_logs" to "postgres";

grant DELETE on TABLE "public"."system_audit_logs" to "postgres";

grant TRUNCATE on TABLE "public"."system_audit_logs" to "postgres";

grant REFERENCES on TABLE "public"."system_audit_logs" to "postgres";

grant TRIGGER on TABLE "public"."system_audit_logs" to "postgres";

grant MAINTAIN on TABLE "public"."system_audit_logs" to "postgres";

grant INSERT on TABLE "public"."system_audit_logs" to "authenticated";

grant SELECT on TABLE "public"."system_audit_logs" to "authenticated";

grant UPDATE on TABLE "public"."system_audit_logs" to "authenticated";

grant DELETE on TABLE "public"."system_audit_logs" to "authenticated";

grant MAINTAIN on TABLE "public"."system_audit_logs" to "authenticated";

grant INSERT on TABLE "public"."system_audit_logs" to "service_role";

grant SELECT on TABLE "public"."system_audit_logs" to "service_role";

grant UPDATE on TABLE "public"."system_audit_logs" to "service_role";

grant DELETE on TABLE "public"."system_audit_logs" to "service_role";

grant TRUNCATE on TABLE "public"."system_audit_logs" to "service_role";

grant REFERENCES on TABLE "public"."system_audit_logs" to "service_role";

grant TRIGGER on TABLE "public"."system_audit_logs" to "service_role";

grant MAINTAIN on TABLE "public"."system_audit_logs" to "service_role";

revoke all privileges on TABLE "public"."timeline_events" from PUBLIC, "anon", "authenticated", "service_role", "postgres";

grant INSERT on TABLE "public"."timeline_events" to "postgres";

grant SELECT on TABLE "public"."timeline_events" to "postgres";

grant UPDATE on TABLE "public"."timeline_events" to "postgres";

grant DELETE on TABLE "public"."timeline_events" to "postgres";

grant TRUNCATE on TABLE "public"."timeline_events" to "postgres";

grant REFERENCES on TABLE "public"."timeline_events" to "postgres";

grant TRIGGER on TABLE "public"."timeline_events" to "postgres";

grant MAINTAIN on TABLE "public"."timeline_events" to "postgres";

grant INSERT on TABLE "public"."timeline_events" to "service_role";

grant SELECT on TABLE "public"."timeline_events" to "service_role";

grant UPDATE on TABLE "public"."timeline_events" to "service_role";

grant DELETE on TABLE "public"."timeline_events" to "service_role";

grant TRUNCATE on TABLE "public"."timeline_events" to "service_role";

grant REFERENCES on TABLE "public"."timeline_events" to "service_role";

grant TRIGGER on TABLE "public"."timeline_events" to "service_role";

grant MAINTAIN on TABLE "public"."timeline_events" to "service_role";

revoke all privileges on TABLE "public"."transactional_outbox" from PUBLIC, "anon", "authenticated", "service_role", "postgres";

grant INSERT on TABLE "public"."transactional_outbox" to "postgres";

grant SELECT on TABLE "public"."transactional_outbox" to "postgres";

grant UPDATE on TABLE "public"."transactional_outbox" to "postgres";

grant DELETE on TABLE "public"."transactional_outbox" to "postgres";

grant TRUNCATE on TABLE "public"."transactional_outbox" to "postgres";

grant REFERENCES on TABLE "public"."transactional_outbox" to "postgres";

grant TRIGGER on TABLE "public"."transactional_outbox" to "postgres";

grant MAINTAIN on TABLE "public"."transactional_outbox" to "postgres";

grant INSERT on TABLE "public"."transactional_outbox" to "service_role";

grant SELECT on TABLE "public"."transactional_outbox" to "service_role";

grant UPDATE on TABLE "public"."transactional_outbox" to "service_role";

grant DELETE on TABLE "public"."transactional_outbox" to "service_role";

grant TRUNCATE on TABLE "public"."transactional_outbox" to "service_role";

grant REFERENCES on TABLE "public"."transactional_outbox" to "service_role";

grant TRIGGER on TABLE "public"."transactional_outbox" to "service_role";

grant MAINTAIN on TABLE "public"."transactional_outbox" to "service_role";

revoke all privileges on TABLE "public"."whatsapp_connections" from PUBLIC, "anon", "authenticated", "service_role", "postgres";

grant INSERT on TABLE "public"."whatsapp_connections" to "postgres";

grant SELECT on TABLE "public"."whatsapp_connections" to "postgres";

grant UPDATE on TABLE "public"."whatsapp_connections" to "postgres";

grant DELETE on TABLE "public"."whatsapp_connections" to "postgres";

grant TRUNCATE on TABLE "public"."whatsapp_connections" to "postgres";

grant REFERENCES on TABLE "public"."whatsapp_connections" to "postgres";

grant TRIGGER on TABLE "public"."whatsapp_connections" to "postgres";

grant MAINTAIN on TABLE "public"."whatsapp_connections" to "postgres";

grant INSERT on TABLE "public"."whatsapp_connections" to "service_role";

grant SELECT on TABLE "public"."whatsapp_connections" to "service_role";

grant UPDATE on TABLE "public"."whatsapp_connections" to "service_role";

grant DELETE on TABLE "public"."whatsapp_connections" to "service_role";

grant TRUNCATE on TABLE "public"."whatsapp_connections" to "service_role";

grant REFERENCES on TABLE "public"."whatsapp_connections" to "service_role";

grant TRIGGER on TABLE "public"."whatsapp_connections" to "service_role";

grant MAINTAIN on TABLE "public"."whatsapp_connections" to "service_role";

revoke all privileges on TABLE "public"."whatsapp_conversations" from PUBLIC, "anon", "authenticated", "service_role", "postgres";

grant INSERT on TABLE "public"."whatsapp_conversations" to "postgres";

grant SELECT on TABLE "public"."whatsapp_conversations" to "postgres";

grant UPDATE on TABLE "public"."whatsapp_conversations" to "postgres";

grant DELETE on TABLE "public"."whatsapp_conversations" to "postgres";

grant TRUNCATE on TABLE "public"."whatsapp_conversations" to "postgres";

grant REFERENCES on TABLE "public"."whatsapp_conversations" to "postgres";

grant TRIGGER on TABLE "public"."whatsapp_conversations" to "postgres";

grant MAINTAIN on TABLE "public"."whatsapp_conversations" to "postgres";

grant INSERT on TABLE "public"."whatsapp_conversations" to "authenticated";

grant SELECT on TABLE "public"."whatsapp_conversations" to "authenticated";

grant UPDATE on TABLE "public"."whatsapp_conversations" to "authenticated";

grant DELETE on TABLE "public"."whatsapp_conversations" to "authenticated";

grant MAINTAIN on TABLE "public"."whatsapp_conversations" to "authenticated";

grant INSERT on TABLE "public"."whatsapp_conversations" to "service_role";

grant SELECT on TABLE "public"."whatsapp_conversations" to "service_role";

grant UPDATE on TABLE "public"."whatsapp_conversations" to "service_role";

grant DELETE on TABLE "public"."whatsapp_conversations" to "service_role";

grant TRUNCATE on TABLE "public"."whatsapp_conversations" to "service_role";

grant REFERENCES on TABLE "public"."whatsapp_conversations" to "service_role";

grant TRIGGER on TABLE "public"."whatsapp_conversations" to "service_role";

grant MAINTAIN on TABLE "public"."whatsapp_conversations" to "service_role";

revoke all privileges on TABLE "public"."whatsapp_message_logs" from PUBLIC, "anon", "authenticated", "service_role", "postgres";

grant INSERT on TABLE "public"."whatsapp_message_logs" to "postgres";

grant SELECT on TABLE "public"."whatsapp_message_logs" to "postgres";

grant UPDATE on TABLE "public"."whatsapp_message_logs" to "postgres";

grant DELETE on TABLE "public"."whatsapp_message_logs" to "postgres";

grant TRUNCATE on TABLE "public"."whatsapp_message_logs" to "postgres";

grant REFERENCES on TABLE "public"."whatsapp_message_logs" to "postgres";

grant TRIGGER on TABLE "public"."whatsapp_message_logs" to "postgres";

grant MAINTAIN on TABLE "public"."whatsapp_message_logs" to "postgres";

grant SELECT on TABLE "public"."whatsapp_message_logs" to "authenticated";

grant MAINTAIN on TABLE "public"."whatsapp_message_logs" to "authenticated";

grant INSERT on TABLE "public"."whatsapp_message_logs" to "service_role";

grant SELECT on TABLE "public"."whatsapp_message_logs" to "service_role";

grant UPDATE on TABLE "public"."whatsapp_message_logs" to "service_role";

grant DELETE on TABLE "public"."whatsapp_message_logs" to "service_role";

grant TRUNCATE on TABLE "public"."whatsapp_message_logs" to "service_role";

grant REFERENCES on TABLE "public"."whatsapp_message_logs" to "service_role";

grant TRIGGER on TABLE "public"."whatsapp_message_logs" to "service_role";

grant MAINTAIN on TABLE "public"."whatsapp_message_logs" to "service_role";

revoke all privileges on TABLE "public"."whatsapp_webhook_events" from PUBLIC, "anon", "authenticated", "service_role", "postgres";

grant INSERT on TABLE "public"."whatsapp_webhook_events" to "postgres";

grant SELECT on TABLE "public"."whatsapp_webhook_events" to "postgres";

grant UPDATE on TABLE "public"."whatsapp_webhook_events" to "postgres";

grant DELETE on TABLE "public"."whatsapp_webhook_events" to "postgres";

grant TRUNCATE on TABLE "public"."whatsapp_webhook_events" to "postgres";

grant REFERENCES on TABLE "public"."whatsapp_webhook_events" to "postgres";

grant TRIGGER on TABLE "public"."whatsapp_webhook_events" to "postgres";

grant MAINTAIN on TABLE "public"."whatsapp_webhook_events" to "postgres";

grant INSERT on TABLE "public"."whatsapp_webhook_events" to "service_role";

grant SELECT on TABLE "public"."whatsapp_webhook_events" to "service_role";

grant UPDATE on TABLE "public"."whatsapp_webhook_events" to "service_role";

grant DELETE on TABLE "public"."whatsapp_webhook_events" to "service_role";

grant TRUNCATE on TABLE "public"."whatsapp_webhook_events" to "service_role";

grant REFERENCES on TABLE "public"."whatsapp_webhook_events" to "service_role";

grant TRIGGER on TABLE "public"."whatsapp_webhook_events" to "service_role";

grant MAINTAIN on TABLE "public"."whatsapp_webhook_events" to "service_role";

revoke all privileges on FUNCTION "orcaly_private"."can_manage_company"(p_company_id uuid) from PUBLIC, "anon", "authenticated", "service_role", "postgres";

grant EXECUTE on FUNCTION "orcaly_private"."can_manage_company"(p_company_id uuid) to "postgres";

grant EXECUTE on FUNCTION "orcaly_private"."can_manage_company"(p_company_id uuid) to "authenticated";

grant EXECUTE on FUNCTION "orcaly_private"."can_manage_company"(p_company_id uuid) to "service_role";

revoke all privileges on FUNCTION "orcaly_private"."can_manage_storage_path"(p_name text) from PUBLIC, "anon", "authenticated", "service_role", "postgres";

grant EXECUTE on FUNCTION "orcaly_private"."can_manage_storage_path"(p_name text) to "postgres";

grant EXECUTE on FUNCTION "orcaly_private"."can_manage_storage_path"(p_name text) to "authenticated";

grant EXECUTE on FUNCTION "orcaly_private"."can_manage_storage_path"(p_name text) to "service_role";

revoke all privileges on FUNCTION "orcaly_private"."check_company_member_limit"() from PUBLIC, "anon", "authenticated", "service_role", "postgres";

grant EXECUTE on FUNCTION "orcaly_private"."check_company_member_limit"() to "postgres";

grant EXECUTE on FUNCTION "orcaly_private"."check_company_member_limit"() to "authenticated";

grant EXECUTE on FUNCTION "orcaly_private"."check_company_member_limit"() to "service_role";

revoke all privileges on FUNCTION "orcaly_private"."create_default_site_for_company"(p_company_id uuid) from PUBLIC, "anon", "authenticated", "service_role", "postgres";

grant EXECUTE on FUNCTION "orcaly_private"."create_default_site_for_company"(p_company_id uuid) to "postgres";

grant EXECUTE on FUNCTION "orcaly_private"."create_default_site_for_company"(p_company_id uuid) to "service_role";

revoke all privileges on FUNCTION "orcaly_private"."is_company_member"(p_company_id uuid) from PUBLIC, "anon", "authenticated", "service_role", "postgres";

grant EXECUTE on FUNCTION "orcaly_private"."is_company_member"(p_company_id uuid) to "postgres";

grant EXECUTE on FUNCTION "orcaly_private"."is_company_member"(p_company_id uuid) to "authenticated";

grant EXECUTE on FUNCTION "orcaly_private"."is_company_member"(p_company_id uuid) to "service_role";

revoke all privileges on FUNCTION "orcaly_private"."is_company_owner"(p_company_id uuid) from PUBLIC, "anon", "authenticated", "service_role", "postgres";

grant EXECUTE on FUNCTION "orcaly_private"."is_company_owner"(p_company_id uuid) to "postgres";

grant EXECUTE on FUNCTION "orcaly_private"."is_company_owner"(p_company_id uuid) to "authenticated";

grant EXECUTE on FUNCTION "orcaly_private"."is_company_owner"(p_company_id uuid) to "service_role";

revoke all privileges on FUNCTION "orcaly_private"."is_orcaly_admin"() from PUBLIC, "anon", "authenticated", "service_role", "postgres";

grant EXECUTE on FUNCTION "orcaly_private"."is_orcaly_admin"() to "postgres";

grant EXECUTE on FUNCTION "orcaly_private"."is_orcaly_admin"() to "authenticated";

grant EXECUTE on FUNCTION "orcaly_private"."is_orcaly_admin"() to "service_role";

revoke all privileges on FUNCTION "orcaly_private"."is_orcaly_super_admin"() from PUBLIC, "anon", "authenticated", "service_role", "postgres";

grant EXECUTE on FUNCTION "orcaly_private"."is_orcaly_super_admin"() to "postgres";

grant EXECUTE on FUNCTION "orcaly_private"."is_orcaly_super_admin"() to "authenticated";

revoke all privileges on FUNCTION "orcaly_private"."my_company_role"(p_company_id uuid) from PUBLIC, "anon", "authenticated", "service_role", "postgres";

grant EXECUTE on FUNCTION "orcaly_private"."my_company_role"(p_company_id uuid) to "postgres";

grant EXECUTE on FUNCTION "orcaly_private"."my_company_role"(p_company_id uuid) to "authenticated";

grant EXECUTE on FUNCTION "orcaly_private"."my_company_role"(p_company_id uuid) to "service_role";

revoke all privileges on FUNCTION "orcaly_private"."orcaly_user_has_company_access"(target_company uuid) from PUBLIC, "anon", "authenticated", "service_role", "postgres";

grant EXECUTE on FUNCTION "orcaly_private"."orcaly_user_has_company_access"(target_company uuid) to "postgres";

grant EXECUTE on FUNCTION "orcaly_private"."orcaly_user_has_company_access"(target_company uuid) to "authenticated";

grant EXECUTE on FUNCTION "orcaly_private"."orcaly_user_has_company_access"(target_company uuid) to "service_role";

revoke all privileges on FUNCTION "orcaly_private"."public_companies_data"() from PUBLIC, "anon", "authenticated", "service_role", "postgres";

grant EXECUTE on FUNCTION "orcaly_private"."public_companies_data"() to "postgres";

grant EXECUTE on FUNCTION "orcaly_private"."public_companies_data"() to "anon";

grant EXECUTE on FUNCTION "orcaly_private"."public_companies_data"() to "authenticated";

grant EXECUTE on FUNCTION "orcaly_private"."public_companies_data"() to "service_role";

revoke all privileges on FUNCTION "orcaly_private"."public_products_data"() from PUBLIC, "anon", "authenticated", "service_role", "postgres";

grant EXECUTE on FUNCTION "orcaly_private"."public_products_data"() to "postgres";

grant EXECUTE on FUNCTION "orcaly_private"."public_products_data"() to "anon";

grant EXECUTE on FUNCTION "orcaly_private"."public_products_data"() to "authenticated";

grant EXECUTE on FUNCTION "orcaly_private"."public_products_data"() to "service_role";

revoke all privileges on FUNCTION "orcaly_private"."public_site_sections_data"() from PUBLIC, "anon", "authenticated", "service_role", "postgres";

grant EXECUTE on FUNCTION "orcaly_private"."public_site_sections_data"() to "postgres";

grant EXECUTE on FUNCTION "orcaly_private"."public_site_sections_data"() to "anon";

grant EXECUTE on FUNCTION "orcaly_private"."public_site_sections_data"() to "authenticated";

grant EXECUTE on FUNCTION "orcaly_private"."public_site_sections_data"() to "service_role";

revoke all privileges on FUNCTION "orcaly_private"."storage_path_company_id"(p_name text) from PUBLIC, "anon", "authenticated", "service_role", "postgres";

grant EXECUTE on FUNCTION "orcaly_private"."storage_path_company_id"(p_name text) to "postgres";

grant EXECUTE on FUNCTION "orcaly_private"."storage_path_company_id"(p_name text) to "authenticated";

grant EXECUTE on FUNCTION "orcaly_private"."storage_path_company_id"(p_name text) to "service_role";

revoke all privileges on FUNCTION "orcaly_private"."sync_signup_lead_sales_stage"() from PUBLIC, "anon", "authenticated", "service_role", "postgres";

grant EXECUTE on FUNCTION "orcaly_private"."sync_signup_lead_sales_stage"() to "postgres";

grant EXECUTE on FUNCTION "orcaly_private"."sync_signup_lead_sales_stage"() to PUBLIC;

revoke all privileges on FUNCTION "orcaly_private"."touch_affiliate_updated_at"() from PUBLIC, "anon", "authenticated", "service_role", "postgres";

grant EXECUTE on FUNCTION "orcaly_private"."touch_affiliate_updated_at"() to "postgres";

revoke all privileges on FUNCTION "public"."cancel_affiliate_payout_admin"(p_payout_id uuid, p_reason text) from PUBLIC, "anon", "authenticated", "service_role", "postgres";

grant EXECUTE on FUNCTION "public"."cancel_affiliate_payout_admin"(p_payout_id uuid, p_reason text) to "postgres";

grant EXECUTE on FUNCTION "public"."cancel_affiliate_payout_admin"(p_payout_id uuid, p_reason text) to "service_role";

revoke all privileges on FUNCTION "public"."change_signup_lead_sales_stage"(p_lead_id uuid, p_actor_admin_id uuid, p_stage text, p_note text, p_lost_reason text) from PUBLIC, "anon", "authenticated", "service_role", "postgres";

grant EXECUTE on FUNCTION "public"."change_signup_lead_sales_stage"(p_lead_id uuid, p_actor_admin_id uuid, p_stage text, p_note text, p_lost_reason text) to "postgres";

grant EXECUTE on FUNCTION "public"."change_signup_lead_sales_stage"(p_lead_id uuid, p_actor_admin_id uuid, p_stage text, p_note text, p_lost_reason text) to "service_role";

revoke all privileges on FUNCTION "public"."claim_background_jobs"(p_worker text, p_limit integer) from PUBLIC, "anon", "authenticated", "service_role", "postgres";

grant EXECUTE on FUNCTION "public"."claim_background_jobs"(p_worker text, p_limit integer) to "postgres";

grant EXECUTE on FUNCTION "public"."claim_background_jobs"(p_worker text, p_limit integer) to "service_role";

revoke all privileges on FUNCTION "public"."claim_company_subscription_trial"(p_company_id uuid) from PUBLIC, "anon", "authenticated", "service_role", "postgres";

grant EXECUTE on FUNCTION "public"."claim_company_subscription_trial"(p_company_id uuid) to "postgres";

grant EXECUTE on FUNCTION "public"."claim_company_subscription_trial"(p_company_id uuid) to "service_role";

revoke all privileges on FUNCTION "public"."claim_due_founder_price_conversions"(p_limit integer) from PUBLIC, "anon", "authenticated", "service_role", "postgres";

grant EXECUTE on FUNCTION "public"."claim_due_founder_price_conversions"(p_limit integer) to "postgres";

grant EXECUTE on FUNCTION "public"."claim_due_founder_price_conversions"(p_limit integer) to "service_role";

revoke all privileges on FUNCTION "public"."claim_founder_activation"(p_token_hash text, p_email text, p_claim_id uuid) from PUBLIC, "anon", "authenticated", "service_role", "postgres";

grant EXECUTE on FUNCTION "public"."claim_founder_activation"(p_token_hash text, p_email text, p_claim_id uuid) to "postgres";

grant EXECUTE on FUNCTION "public"."claim_founder_activation"(p_token_hash text, p_email text, p_claim_id uuid) to "service_role";

revoke all privileges on FUNCTION "public"."claim_founder_billing_setup"(p_company_id uuid, p_claim_id uuid) from PUBLIC, "anon", "authenticated", "service_role", "postgres";

grant EXECUTE on FUNCTION "public"."claim_founder_billing_setup"(p_company_id uuid, p_claim_id uuid) to "postgres";

grant EXECUTE on FUNCTION "public"."claim_founder_billing_setup"(p_company_id uuid, p_claim_id uuid) to "service_role";

revoke all privileges on FUNCTION "public"."claim_platform_admin_invite"(p_token_hash text, p_claim_id uuid) from PUBLIC, "anon", "authenticated", "service_role", "postgres";

grant EXECUTE on FUNCTION "public"."claim_platform_admin_invite"(p_token_hash text, p_claim_id uuid) to "postgres";

grant EXECUTE on FUNCTION "public"."claim_platform_admin_invite"(p_token_hash text, p_claim_id uuid) to "service_role";

revoke all privileges on FUNCTION "public"."company_member_touch"() from PUBLIC, "anon", "authenticated", "service_role", "postgres";

grant EXECUTE on FUNCTION "public"."company_member_touch"() to "postgres";

grant EXECUTE on FUNCTION "public"."company_member_touch"() to "service_role";

revoke all privileges on FUNCTION "public"."complete_founder_activation"(p_claim_id uuid, p_user_id uuid, p_company_name text, p_slug text, p_business_type text, p_whatsapp text, p_cidade text, p_estado text, p_onboarding_goal text, p_default_setup jsonb) from PUBLIC, "anon", "authenticated", "service_role", "postgres";

grant EXECUTE on FUNCTION "public"."complete_founder_activation"(p_claim_id uuid, p_user_id uuid, p_company_name text, p_slug text, p_business_type text, p_whatsapp text, p_cidade text, p_estado text, p_onboarding_goal text, p_default_setup jsonb) to "postgres";

grant EXECUTE on FUNCTION "public"."complete_founder_activation"(p_claim_id uuid, p_user_id uuid, p_company_name text, p_slug text, p_business_type text, p_whatsapp text, p_cidade text, p_estado text, p_onboarding_goal text, p_default_setup jsonb) to "service_role";

revoke all privileges on FUNCTION "public"."complete_founder_billing_setup"(p_company_id uuid, p_claim_id uuid, p_plan_payment_id uuid, p_subscription_id text, p_provider_status text, p_checkout_url text, p_next_payment_date timestamp with time zone, p_provider_payload jsonb) from PUBLIC, "anon", "authenticated", "service_role", "postgres";

grant EXECUTE on FUNCTION "public"."complete_founder_billing_setup"(p_company_id uuid, p_claim_id uuid, p_plan_payment_id uuid, p_subscription_id text, p_provider_status text, p_checkout_url text, p_next_payment_date timestamp with time zone, p_provider_payload jsonb) to "postgres";

grant EXECUTE on FUNCTION "public"."complete_founder_billing_setup"(p_company_id uuid, p_claim_id uuid, p_plan_payment_id uuid, p_subscription_id text, p_provider_status text, p_checkout_url text, p_next_payment_date timestamp with time zone, p_provider_payload jsonb) to "service_role";

revoke all privileges on FUNCTION "public"."complete_founder_price_conversion"(p_company_id uuid, p_claim_id uuid, p_provider_status text, p_provider_payload jsonb, p_action text) from PUBLIC, "anon", "authenticated", "service_role", "postgres";

grant EXECUTE on FUNCTION "public"."complete_founder_price_conversion"(p_company_id uuid, p_claim_id uuid, p_provider_status text, p_provider_payload jsonb, p_action text) to "postgres";

grant EXECUTE on FUNCTION "public"."complete_founder_price_conversion"(p_company_id uuid, p_claim_id uuid, p_provider_status text, p_provider_payload jsonb, p_action text) to "service_role";

revoke all privileges on FUNCTION "public"."complete_platform_admin_invite"(p_claim_id uuid, p_user_id uuid) from PUBLIC, "anon", "authenticated", "service_role", "postgres";

grant EXECUTE on FUNCTION "public"."complete_platform_admin_invite"(p_claim_id uuid, p_user_id uuid) to "postgres";

grant EXECUTE on FUNCTION "public"."complete_platform_admin_invite"(p_claim_id uuid, p_user_id uuid) to "service_role";

revoke all privileges on FUNCTION "public"."consume_marketplace_coupon"(p_company_id uuid, p_order_id uuid) from PUBLIC, "anon", "authenticated", "service_role", "postgres";

grant EXECUTE on FUNCTION "public"."consume_marketplace_coupon"(p_company_id uuid, p_order_id uuid) to "postgres";

grant EXECUTE on FUNCTION "public"."consume_marketplace_coupon"(p_company_id uuid, p_order_id uuid) to "service_role";

revoke all privileges on FUNCTION "public"."create_affiliate_payout_admin"(p_affiliate_id uuid) from PUBLIC, "anon", "authenticated", "service_role", "postgres";

grant EXECUTE on FUNCTION "public"."create_affiliate_payout_admin"(p_affiliate_id uuid) to "postgres";

grant EXECUTE on FUNCTION "public"."create_affiliate_payout_admin"(p_affiliate_id uuid) to "service_role";

revoke all privileges on FUNCTION "public"."create_founder_invite_for_sales_lead"(p_actor_admin_id uuid, p_lead_id uuid, p_plan_key text, p_token_hash text, p_token_expires_at timestamp with time zone, p_requested_founder_number integer) from PUBLIC, "anon", "authenticated", "service_role", "postgres";

grant EXECUTE on FUNCTION "public"."create_founder_invite_for_sales_lead"(p_actor_admin_id uuid, p_lead_id uuid, p_plan_key text, p_token_hash text, p_token_expires_at timestamp with time zone, p_requested_founder_number integer) to "postgres";

grant EXECUTE on FUNCTION "public"."create_founder_invite_for_sales_lead"(p_actor_admin_id uuid, p_lead_id uuid, p_plan_key text, p_token_hash text, p_token_expires_at timestamp with time zone, p_requested_founder_number integer) to "service_role";

revoke all privileges on FUNCTION "public"."create_founder_test_invite"(p_actor_admin_id uuid, p_email text, p_plan_key text, p_token_hash text, p_token_expires_at timestamp with time zone) from PUBLIC, "anon", "authenticated", "service_role", "postgres";

grant EXECUTE on FUNCTION "public"."create_founder_test_invite"(p_actor_admin_id uuid, p_email text, p_plan_key text, p_token_hash text, p_token_expires_at timestamp with time zone) to "postgres";

grant EXECUTE on FUNCTION "public"."create_founder_test_invite"(p_actor_admin_id uuid, p_email text, p_plan_key text, p_token_hash text, p_token_expires_at timestamp with time zone) to "service_role";

revoke all privileges on FUNCTION "public"."create_or_claim_sales_prospect"(p_actor_admin_id uuid, p_assigned_admin_id uuid, p_email text, p_empresa_nome text, p_nome_responsavel text, p_whatsapp text, p_segmento text, p_cidade text, p_estado text) from PUBLIC, "anon", "authenticated", "service_role", "postgres";

grant EXECUTE on FUNCTION "public"."create_or_claim_sales_prospect"(p_actor_admin_id uuid, p_assigned_admin_id uuid, p_email text, p_empresa_nome text, p_nome_responsavel text, p_whatsapp text, p_segmento text, p_cidade text, p_estado text) to "postgres";

grant EXECUTE on FUNCTION "public"."create_or_claim_sales_prospect"(p_actor_admin_id uuid, p_assigned_admin_id uuid, p_email text, p_empresa_nome text, p_nome_responsavel text, p_whatsapp text, p_segmento text, p_cidade text, p_estado text) to "service_role";

revoke all privileges on FUNCTION "public"."expire_due_founder_trials"() from PUBLIC, "anon", "authenticated", "service_role", "postgres";

grant EXECUTE on FUNCTION "public"."expire_due_founder_trials"() to "postgres";

grant EXECUTE on FUNCTION "public"."expire_due_founder_trials"() to "service_role";

revoke all privileges on FUNCTION "public"."expire_marketplace_stock_reservations"(p_limit integer) from PUBLIC, "anon", "authenticated", "service_role", "postgres";

grant EXECUTE on FUNCTION "public"."expire_marketplace_stock_reservations"(p_limit integer) to "postgres";

grant EXECUTE on FUNCTION "public"."expire_marketplace_stock_reservations"(p_limit integer) to "service_role";

revoke all privileges on FUNCTION "public"."expire_pending_founder_invites"() from PUBLIC, "anon", "authenticated", "service_role", "postgres";

grant EXECUTE on FUNCTION "public"."expire_pending_founder_invites"() to "postgres";

grant EXECUTE on FUNCTION "public"."expire_pending_founder_invites"() to "service_role";

revoke all privileges on FUNCTION "public"."fail_affiliate_payout_admin"(p_payout_id uuid, p_reason text) from PUBLIC, "anon", "authenticated", "service_role", "postgres";

grant EXECUTE on FUNCTION "public"."fail_affiliate_payout_admin"(p_payout_id uuid, p_reason text) to "postgres";

grant EXECUTE on FUNCTION "public"."fail_affiliate_payout_admin"(p_payout_id uuid, p_reason text) to "service_role";

revoke all privileges on FUNCTION "public"."finance_touch_updated_at"() from PUBLIC, "anon", "authenticated", "service_role", "postgres";

grant EXECUTE on FUNCTION "public"."finance_touch_updated_at"() to "postgres";

grant EXECUTE on FUNCTION "public"."finance_touch_updated_at"() to "service_role";

revoke all privileges on FUNCTION "public"."get_affiliate_payout_account_admin"(p_affiliate_id uuid) from PUBLIC, "anon", "authenticated", "service_role", "postgres";

grant EXECUTE on FUNCTION "public"."get_affiliate_payout_account_admin"(p_affiliate_id uuid) to "postgres";

grant EXECUTE on FUNCTION "public"."get_affiliate_payout_account_admin"(p_affiliate_id uuid) to "service_role";

revoke all privileges on FUNCTION "public"."get_my_platform_admin_access"() from PUBLIC, "anon", "authenticated", "service_role", "postgres";

grant EXECUTE on FUNCTION "public"."get_my_platform_admin_access"() to "postgres";

grant EXECUTE on FUNCTION "public"."get_my_platform_admin_access"() to "authenticated";

grant EXECUTE on FUNCTION "public"."get_my_platform_admin_access"() to "service_role";

revoke all privileges on FUNCTION "public"."get_platform_qa_vercel_share"() from PUBLIC, "anon", "authenticated", "service_role", "postgres";

grant EXECUTE on FUNCTION "public"."get_platform_qa_vercel_share"() to "postgres";

grant EXECUTE on FUNCTION "public"."get_platform_qa_vercel_share"() to "service_role";

revoke all privileges on FUNCTION "public"."integration_credentials_delete"(p_company_id uuid, p_connection_id uuid) from PUBLIC, "anon", "authenticated", "service_role", "postgres";

grant EXECUTE on FUNCTION "public"."integration_credentials_delete"(p_company_id uuid, p_connection_id uuid) to "postgres";

grant EXECUTE on FUNCTION "public"."integration_credentials_delete"(p_company_id uuid, p_connection_id uuid) to "service_role";

revoke all privileges on FUNCTION "public"."integration_credentials_read"(p_company_id uuid, p_connection_id uuid) from PUBLIC, "anon", "authenticated", "service_role", "postgres";

grant EXECUTE on FUNCTION "public"."integration_credentials_read"(p_company_id uuid, p_connection_id uuid) to "postgres";

grant EXECUTE on FUNCTION "public"."integration_credentials_read"(p_company_id uuid, p_connection_id uuid) to "service_role";

revoke all privileges on FUNCTION "public"."integration_credentials_store"(p_company_id uuid, p_connection_id uuid, p_secret text) from PUBLIC, "anon", "authenticated", "service_role", "postgres";

grant EXECUTE on FUNCTION "public"."integration_credentials_store"(p_company_id uuid, p_connection_id uuid, p_secret text) to "postgres";

grant EXECUTE on FUNCTION "public"."integration_credentials_store"(p_company_id uuid, p_connection_id uuid, p_secret text) to "service_role";

revoke all privileges on FUNCTION "public"."integration_oauth_pkce_store"(p_company_id uuid, p_state_id uuid, p_verifier text) from PUBLIC, "anon", "authenticated", "service_role", "postgres";

grant EXECUTE on FUNCTION "public"."integration_oauth_pkce_store"(p_company_id uuid, p_state_id uuid, p_verifier text) to "postgres";

grant EXECUTE on FUNCTION "public"."integration_oauth_pkce_store"(p_company_id uuid, p_state_id uuid, p_verifier text) to "service_role";

revoke all privileges on FUNCTION "public"."integration_oauth_state_consume"(p_company_id uuid, p_user_id uuid, p_provider text, p_nonce_hash text) from PUBLIC, "anon", "authenticated", "service_role", "postgres";

grant EXECUTE on FUNCTION "public"."integration_oauth_state_consume"(p_company_id uuid, p_user_id uuid, p_provider text, p_nonce_hash text) to "postgres";

grant EXECUTE on FUNCTION "public"."integration_oauth_state_consume"(p_company_id uuid, p_user_id uuid, p_provider text, p_nonce_hash text) to "service_role";

revoke all privileges on FUNCTION "public"."integration_refresh_lock"(p_company_id uuid, p_connection_id uuid, p_lock_id uuid, p_ttl_seconds integer) from PUBLIC, "anon", "authenticated", "service_role", "postgres";

grant EXECUTE on FUNCTION "public"."integration_refresh_lock"(p_company_id uuid, p_connection_id uuid, p_lock_id uuid, p_ttl_seconds integer) to "postgres";

grant EXECUTE on FUNCTION "public"."integration_refresh_lock"(p_company_id uuid, p_connection_id uuid, p_lock_id uuid, p_ttl_seconds integer) to "service_role";

revoke all privileges on FUNCTION "public"."integration_refresh_unlock"(p_company_id uuid, p_connection_id uuid, p_lock_id uuid) from PUBLIC, "anon", "authenticated", "service_role", "postgres";

grant EXECUTE on FUNCTION "public"."integration_refresh_unlock"(p_company_id uuid, p_connection_id uuid, p_lock_id uuid) to "postgres";

grant EXECUTE on FUNCTION "public"."integration_refresh_unlock"(p_company_id uuid, p_connection_id uuid, p_lock_id uuid) to "service_role";

revoke all privileges on FUNCTION "public"."limit_company_members"() from PUBLIC, "anon", "authenticated", "service_role", "postgres";

grant EXECUTE on FUNCTION "public"."limit_company_members"() to "postgres";

grant EXECUTE on FUNCTION "public"."limit_company_members"() to "service_role";

revoke all privileges on FUNCTION "public"."list_affiliate_payout_accounts_admin"() from PUBLIC, "anon", "authenticated", "service_role", "postgres";

grant EXECUTE on FUNCTION "public"."list_affiliate_payout_accounts_admin"() to "postgres";

grant EXECUTE on FUNCTION "public"."list_affiliate_payout_accounts_admin"() to "service_role";

revoke all privileges on FUNCTION "public"."mark_affiliate_payout_paid_admin"(p_payout_id uuid, p_provider text, p_provider_transfer_id text, p_proof_url text) from PUBLIC, "anon", "authenticated", "service_role", "postgres";

grant EXECUTE on FUNCTION "public"."mark_affiliate_payout_paid_admin"(p_payout_id uuid, p_provider text, p_provider_transfer_id text, p_proof_url text) to "postgres";

grant EXECUTE on FUNCTION "public"."mark_affiliate_payout_paid_admin"(p_payout_id uuid, p_provider text, p_provider_transfer_id text, p_proof_url text) to "service_role";

revoke all privileges on FUNCTION "public"."merge_customer_profiles"(p_company_id uuid, p_primary uuid, p_duplicate uuid, p_actor uuid) from PUBLIC, "anon", "authenticated", "service_role", "postgres";

grant EXECUTE on FUNCTION "public"."merge_customer_profiles"(p_company_id uuid, p_primary uuid, p_duplicate uuid, p_actor uuid) to "postgres";

grant EXECUTE on FUNCTION "public"."merge_customer_profiles"(p_company_id uuid, p_primary uuid, p_duplicate uuid, p_actor uuid) to "service_role";

revoke all privileges on FUNCTION "public"."orcaly_consume_rate_limit"(p_key text, p_limit integer, p_window_seconds integer) from PUBLIC, "anon", "authenticated", "service_role", "postgres";

grant EXECUTE on FUNCTION "public"."orcaly_consume_rate_limit"(p_key text, p_limit integer, p_window_seconds integer) to "postgres";

grant EXECUTE on FUNCTION "public"."orcaly_consume_rate_limit"(p_key text, p_limit integer, p_window_seconds integer) to "service_role";

revoke all privileges on FUNCTION "public"."orcaly_mirror_payment_webhook_event"() from PUBLIC, "anon", "authenticated", "service_role", "postgres";

grant EXECUTE on FUNCTION "public"."orcaly_mirror_payment_webhook_event"() to "postgres";

grant EXECUTE on FUNCTION "public"."orcaly_mirror_payment_webhook_event"() to "service_role";

revoke all privileges on FUNCTION "public"."orcaly_mirror_whatsapp_webhook_event"() from PUBLIC, "anon", "authenticated", "service_role", "postgres";

grant EXECUTE on FUNCTION "public"."orcaly_mirror_whatsapp_webhook_event"() to "postgres";

grant EXECUTE on FUNCTION "public"."orcaly_mirror_whatsapp_webhook_event"() to "service_role";

revoke all privileges on FUNCTION "public"."orcaly_normalize_email"(p_value text) from PUBLIC, "anon", "authenticated", "service_role", "postgres";

grant EXECUTE on FUNCTION "public"."orcaly_normalize_email"(p_value text) to "postgres";

grant EXECUTE on FUNCTION "public"."orcaly_normalize_email"(p_value text) to "service_role";

revoke all privileges on FUNCTION "public"."orcaly_normalize_name"(p_value text) from PUBLIC, "anon", "authenticated", "service_role", "postgres";

grant EXECUTE on FUNCTION "public"."orcaly_normalize_name"(p_value text) to "postgres";

grant EXECUTE on FUNCTION "public"."orcaly_normalize_name"(p_value text) to "service_role";

revoke all privileges on FUNCTION "public"."orcaly_normalize_phone_br"(p_value text) from PUBLIC, "anon", "authenticated", "service_role", "postgres";

grant EXECUTE on FUNCTION "public"."orcaly_normalize_phone_br"(p_value text) to "postgres";

grant EXECUTE on FUNCTION "public"."orcaly_normalize_phone_br"(p_value text) to "service_role";

revoke all privileges on FUNCTION "public"."orcaly_record_business_event"() from PUBLIC, "anon", "authenticated", "service_role", "postgres";

grant EXECUTE on FUNCTION "public"."orcaly_record_business_event"() to "postgres";

grant EXECUTE on FUNCTION "public"."orcaly_record_business_event"() to "service_role";

revoke all privileges on FUNCTION "public"."preview_founder_activation"(p_token_hash text) from PUBLIC, "anon", "authenticated", "service_role", "postgres";

grant EXECUTE on FUNCTION "public"."preview_founder_activation"(p_token_hash text) to "postgres";

grant EXECUTE on FUNCTION "public"."preview_founder_activation"(p_token_hash text) to "service_role";

revoke all privileges on FUNCTION "public"."protect_company_trial_used_at"() from PUBLIC, "anon", "authenticated", "service_role", "postgres";

grant EXECUTE on FUNCTION "public"."protect_company_trial_used_at"() to "postgres";

grant EXECUTE on FUNCTION "public"."protect_company_trial_used_at"() to "service_role";

revoke all privileges on FUNCTION "public"."record_founder_payment_approved"(p_company_id uuid, p_subscription_id text, p_payment_id text, p_next_payment_date timestamp with time zone, p_provider_payload jsonb) from PUBLIC, "anon", "authenticated", "service_role", "postgres";

grant EXECUTE on FUNCTION "public"."record_founder_payment_approved"(p_company_id uuid, p_subscription_id text, p_payment_id text, p_next_payment_date timestamp with time zone, p_provider_payload jsonb) to "postgres";

grant EXECUTE on FUNCTION "public"."record_founder_payment_approved"(p_company_id uuid, p_subscription_id text, p_payment_id text, p_next_payment_date timestamp with time zone, p_provider_payload jsonb) to "service_role";

revoke all privileges on FUNCTION "public"."record_signup_lead_sales_followup"(p_lead_id uuid, p_actor_admin_id uuid, p_channel text, p_message text, p_next_action_at timestamp with time zone) from PUBLIC, "anon", "authenticated", "service_role", "postgres";

grant EXECUTE on FUNCTION "public"."record_signup_lead_sales_followup"(p_lead_id uuid, p_actor_admin_id uuid, p_channel text, p_message text, p_next_action_at timestamp with time zone) to "postgres";

grant EXECUTE on FUNCTION "public"."record_signup_lead_sales_followup"(p_lead_id uuid, p_actor_admin_id uuid, p_channel text, p_message text, p_next_action_at timestamp with time zone) to "service_role";

revoke all privileges on FUNCTION "public"."recover_stale_background_jobs"(p_stale_seconds integer, p_limit integer) from PUBLIC, "anon", "authenticated", "service_role", "postgres";

grant EXECUTE on FUNCTION "public"."recover_stale_background_jobs"(p_stale_seconds integer, p_limit integer) to "postgres";

grant EXECUTE on FUNCTION "public"."recover_stale_background_jobs"(p_stale_seconds integer, p_limit integer) to "service_role";

revoke all privileges on FUNCTION "public"."refresh_company_data_quality"(p_company_id uuid) from PUBLIC, "anon", "authenticated", "service_role", "postgres";

grant EXECUTE on FUNCTION "public"."refresh_company_data_quality"(p_company_id uuid) to "postgres";

grant EXECUTE on FUNCTION "public"."refresh_company_data_quality"(p_company_id uuid) to "service_role";

revoke all privileges on FUNCTION "public"."refresh_company_data_quality_v1"(p_company_id uuid) from PUBLIC, "anon", "authenticated", "service_role", "postgres";

grant EXECUTE on FUNCTION "public"."refresh_company_data_quality_v1"(p_company_id uuid) to "postgres";

grant EXECUTE on FUNCTION "public"."refresh_company_data_quality_v1"(p_company_id uuid) to "service_role";

revoke all privileges on FUNCTION "public"."refresh_customer_directory"(p_company_id uuid) from PUBLIC, "anon", "authenticated", "service_role", "postgres";

grant EXECUTE on FUNCTION "public"."refresh_customer_directory"(p_company_id uuid) to "postgres";

grant EXECUTE on FUNCTION "public"."refresh_customer_directory"(p_company_id uuid) to "service_role";

revoke all privileges on FUNCTION "public"."release_affiliate_commissions_admin"() from PUBLIC, "anon", "authenticated", "service_role", "postgres";

grant EXECUTE on FUNCTION "public"."release_affiliate_commissions_admin"() to "postgres";

grant EXECUTE on FUNCTION "public"."release_affiliate_commissions_admin"() to "service_role";

revoke all privileges on FUNCTION "public"."release_founder_activation_claim"(p_claim_id uuid, p_error text) from PUBLIC, "anon", "authenticated", "service_role", "postgres";

grant EXECUTE on FUNCTION "public"."release_founder_activation_claim"(p_claim_id uuid, p_error text) to "postgres";

grant EXECUTE on FUNCTION "public"."release_founder_activation_claim"(p_claim_id uuid, p_error text) to "service_role";

revoke all privileges on FUNCTION "public"."release_founder_billing_claim"(p_company_id uuid, p_claim_id uuid, p_error text) from PUBLIC, "anon", "authenticated", "service_role", "postgres";

grant EXECUTE on FUNCTION "public"."release_founder_billing_claim"(p_company_id uuid, p_claim_id uuid, p_error text) to "postgres";

grant EXECUTE on FUNCTION "public"."release_founder_billing_claim"(p_company_id uuid, p_claim_id uuid, p_error text) to "service_role";

revoke all privileges on FUNCTION "public"."release_founder_price_conversion_claim"(p_company_id uuid, p_claim_id uuid, p_error text) from PUBLIC, "anon", "authenticated", "service_role", "postgres";

grant EXECUTE on FUNCTION "public"."release_founder_price_conversion_claim"(p_company_id uuid, p_claim_id uuid, p_error text) to "postgres";

grant EXECUTE on FUNCTION "public"."release_founder_price_conversion_claim"(p_company_id uuid, p_claim_id uuid, p_error text) to "service_role";

revoke all privileges on FUNCTION "public"."release_platform_admin_invite_claim"(p_claim_id uuid) from PUBLIC, "anon", "authenticated", "service_role", "postgres";

grant EXECUTE on FUNCTION "public"."release_platform_admin_invite_claim"(p_claim_id uuid) to "postgres";

grant EXECUTE on FUNCTION "public"."release_platform_admin_invite_claim"(p_claim_id uuid) to "service_role";

revoke all privileges on FUNCTION "public"."reserve_marketplace_stock"(p_company_id uuid, p_order_id uuid, p_marketplace_payment_id uuid, p_expires_at timestamp with time zone, p_items jsonb) from PUBLIC, "anon", "authenticated", "service_role", "postgres";

grant EXECUTE on FUNCTION "public"."reserve_marketplace_stock"(p_company_id uuid, p_order_id uuid, p_marketplace_payment_id uuid, p_expires_at timestamp with time zone, p_items jsonb) to "postgres";

grant EXECUTE on FUNCTION "public"."reserve_marketplace_stock"(p_company_id uuid, p_order_id uuid, p_marketplace_payment_id uuid, p_expires_at timestamp with time zone, p_items jsonb) to "service_role";

revoke all privileges on FUNCTION "public"."reverse_affiliate_commission_admin"(p_provider_payment_id text, p_reason text) from PUBLIC, "anon", "authenticated", "service_role", "postgres";

grant EXECUTE on FUNCTION "public"."reverse_affiliate_commission_admin"(p_provider_payment_id text, p_reason text) to "postgres";

grant EXECUTE on FUNCTION "public"."reverse_affiliate_commission_admin"(p_provider_payment_id text, p_reason text) to "service_role";

revoke all privileges on FUNCTION "public"."review_affiliate_referral_admin"(p_referral_id uuid, p_decision text, p_actor_email text, p_note text) from PUBLIC, "anon", "authenticated", "service_role", "postgres";

grant EXECUTE on FUNCTION "public"."review_affiliate_referral_admin"(p_referral_id uuid, p_decision text, p_actor_email text, p_note text) to "postgres";

grant EXECUTE on FUNCTION "public"."review_affiliate_referral_admin"(p_referral_id uuid, p_decision text, p_actor_email text, p_note text) to "service_role";

revoke all privileges on FUNCTION "public"."revoke_founder_invite"(p_actor_admin_id uuid, p_invite_id uuid, p_reason text) from PUBLIC, "anon", "authenticated", "service_role", "postgres";

grant EXECUTE on FUNCTION "public"."revoke_founder_invite"(p_actor_admin_id uuid, p_invite_id uuid, p_reason text) to "postgres";

grant EXECUTE on FUNCTION "public"."revoke_founder_invite"(p_actor_admin_id uuid, p_invite_id uuid, p_reason text) to "service_role";

revoke all privileges on FUNCTION "public"."rotate_founder_invite_token"(p_actor_admin_id uuid, p_invite_id uuid, p_token_hash text, p_token_expires_at timestamp with time zone) from PUBLIC, "anon", "authenticated", "service_role", "postgres";

grant EXECUTE on FUNCTION "public"."rotate_founder_invite_token"(p_actor_admin_id uuid, p_invite_id uuid, p_token_hash text, p_token_expires_at timestamp with time zone) to "postgres";

grant EXECUTE on FUNCTION "public"."rotate_founder_invite_token"(p_actor_admin_id uuid, p_invite_id uuid, p_token_hash text, p_token_expires_at timestamp with time zone) to "service_role";

revoke all privileges on FUNCTION "public"."save_affiliate_payout_account_admin"(p_affiliate_id uuid, p_pix_key_type text, p_pix_key_encrypted text, p_pix_key_masked text, p_holder_name text, p_holder_document_hash text, p_holder_document_last4 text, p_bank_name text, p_provider_validation jsonb, p_is_verified boolean, p_verified_by text) from PUBLIC, "anon", "authenticated", "service_role", "postgres";

grant EXECUTE on FUNCTION "public"."save_affiliate_payout_account_admin"(p_affiliate_id uuid, p_pix_key_type text, p_pix_key_encrypted text, p_pix_key_masked text, p_holder_name text, p_holder_document_hash text, p_holder_document_last4 text, p_bank_name text, p_provider_validation jsonb, p_is_verified boolean, p_verified_by text) to "postgres";

grant EXECUTE on FUNCTION "public"."save_affiliate_payout_account_admin"(p_affiliate_id uuid, p_pix_key_type text, p_pix_key_encrypted text, p_pix_key_masked text, p_holder_name text, p_holder_document_hash text, p_holder_document_last4 text, p_bank_name text, p_provider_validation jsonb, p_is_verified boolean, p_verified_by text) to "service_role";

revoke all privileges on FUNCTION "public"."set_affiliate_payout_account_verification_admin"(p_affiliate_id uuid, p_verified boolean, p_verified_by text, p_note text) from PUBLIC, "anon", "authenticated", "service_role", "postgres";

grant EXECUTE on FUNCTION "public"."set_affiliate_payout_account_verification_admin"(p_affiliate_id uuid, p_verified boolean, p_verified_by text, p_note text) to "postgres";

grant EXECUTE on FUNCTION "public"."set_affiliate_payout_account_verification_admin"(p_affiliate_id uuid, p_verified boolean, p_verified_by text, p_note text) to "service_role";

revoke all privileges on FUNCTION "public"."set_company_subdomain_slug"() from PUBLIC, "anon", "authenticated", "service_role", "postgres";

grant EXECUTE on FUNCTION "public"."set_company_subdomain_slug"() to "postgres";

grant EXECUTE on FUNCTION "public"."set_company_subdomain_slug"() to "service_role";

revoke all privileges on FUNCTION "public"."set_updated_at"() from PUBLIC, "anon", "authenticated", "service_role", "postgres";

grant EXECUTE on FUNCTION "public"."set_updated_at"() to "postgres";

grant EXECUTE on FUNCTION "public"."set_updated_at"() to "service_role";

revoke all privileges on FUNCTION "public"."settle_background_job"(p_job_id uuid, p_worker text, p_status text, p_run_after timestamp with time zone, p_error text, p_metadata_patch jsonb) from PUBLIC, "anon", "authenticated", "service_role", "postgres";

grant EXECUTE on FUNCTION "public"."settle_background_job"(p_job_id uuid, p_worker text, p_status text, p_run_after timestamp with time zone, p_error text, p_metadata_patch jsonb) to "postgres";

grant EXECUTE on FUNCTION "public"."settle_background_job"(p_job_id uuid, p_worker text, p_status text, p_run_after timestamp with time zone, p_error text, p_metadata_patch jsonb) to "service_role";

revoke all privileges on FUNCTION "public"."settle_marketplace_stock"(p_company_id uuid, p_marketplace_payment_id uuid, p_payment_status text, p_reason text) from PUBLIC, "anon", "authenticated", "service_role", "postgres";

grant EXECUTE on FUNCTION "public"."settle_marketplace_stock"(p_company_id uuid, p_marketplace_payment_id uuid, p_payment_status text, p_reason text) to "postgres";

grant EXECUTE on FUNCTION "public"."settle_marketplace_stock"(p_company_id uuid, p_marketplace_payment_id uuid, p_payment_status text, p_reason text) to "service_role";

revoke all privileges on FUNCTION "public"."touch_signup_lead_updated_at"() from PUBLIC, "anon", "authenticated", "service_role", "postgres";

grant EXECUTE on FUNCTION "public"."touch_signup_lead_updated_at"() to "postgres";

grant EXECUTE on FUNCTION "public"."touch_signup_lead_updated_at"() to "service_role";

revoke all privileges ("nome") on table "public"."orders" from PUBLIC, "anon", "authenticated", "service_role";

grant INSERT ("nome") on table "public"."orders" to "authenticated";

grant UPDATE ("nome") on table "public"."orders" to "authenticated";

revoke all privileges ("telefone") on table "public"."orders" from PUBLIC, "anon", "authenticated", "service_role";

grant INSERT ("telefone") on table "public"."orders" to "authenticated";

grant UPDATE ("telefone") on table "public"."orders" to "authenticated";

revoke all privileges ("produto") on table "public"."orders" from PUBLIC, "anon", "authenticated", "service_role";

grant INSERT ("produto") on table "public"."orders" to "authenticated";

grant UPDATE ("produto") on table "public"."orders" to "authenticated";

revoke all privileges ("largura") on table "public"."orders" from PUBLIC, "anon", "authenticated", "service_role";

grant INSERT ("largura") on table "public"."orders" to "authenticated";

grant UPDATE ("largura") on table "public"."orders" to "authenticated";

revoke all privileges ("altura") on table "public"."orders" from PUBLIC, "anon", "authenticated", "service_role";

grant INSERT ("altura") on table "public"."orders" to "authenticated";

grant UPDATE ("altura") on table "public"."orders" to "authenticated";

revoke all privileges ("quantidade") on table "public"."orders" from PUBLIC, "anon", "authenticated", "service_role";

grant INSERT ("quantidade") on table "public"."orders" to "authenticated";

grant UPDATE ("quantidade") on table "public"."orders" to "authenticated";

revoke all privileges ("observacoes") on table "public"."orders" from PUBLIC, "anon", "authenticated", "service_role";

grant INSERT ("observacoes") on table "public"."orders" to "authenticated";

grant UPDATE ("observacoes") on table "public"."orders" to "authenticated";

revoke all privileges ("status") on table "public"."orders" from PUBLIC, "anon", "authenticated", "service_role";

grant INSERT ("status") on table "public"."orders" to "authenticated";

grant UPDATE ("status") on table "public"."orders" to "authenticated";

revoke all privileges ("preco_estimado") on table "public"."orders" from PUBLIC, "anon", "authenticated", "service_role";

grant INSERT ("preco_estimado") on table "public"."orders" to "authenticated";

grant UPDATE ("preco_estimado") on table "public"."orders" to "authenticated";

revoke all privileges ("arquivo_url") on table "public"."orders" from PUBLIC, "anon", "authenticated", "service_role";

grant INSERT ("arquivo_url") on table "public"."orders" to "authenticated";

grant UPDATE ("arquivo_url") on table "public"."orders" to "authenticated";

revoke all privileges ("company_id") on table "public"."orders" from PUBLIC, "anon", "authenticated", "service_role";

grant INSERT ("company_id") on table "public"."orders" to "authenticated";

revoke all privileges ("valor_total") on table "public"."orders" from PUBLIC, "anon", "authenticated", "service_role";

grant INSERT ("valor_total") on table "public"."orders" to "authenticated";

grant UPDATE ("valor_total") on table "public"."orders" to "authenticated";

revoke all privileges ("valor_sinal") on table "public"."orders" from PUBLIC, "anon", "authenticated", "service_role";

grant INSERT ("valor_sinal") on table "public"."orders" to "authenticated";

grant UPDATE ("valor_sinal") on table "public"."orders" to "authenticated";

revoke all privileges ("percentual_sinal") on table "public"."orders" from PUBLIC, "anon", "authenticated", "service_role";

grant INSERT ("percentual_sinal") on table "public"."orders" to "authenticated";

grant UPDATE ("percentual_sinal") on table "public"."orders" to "authenticated";

revoke all privileges ("forma_pagamento") on table "public"."orders" from PUBLIC, "anon", "authenticated", "service_role";

grant INSERT ("forma_pagamento") on table "public"."orders" to "authenticated";

grant UPDATE ("forma_pagamento") on table "public"."orders" to "authenticated";

revoke all privileges ("parcelas") on table "public"."orders" from PUBLIC, "anon", "authenticated", "service_role";

grant INSERT ("parcelas") on table "public"."orders" to "authenticated";

grant UPDATE ("parcelas") on table "public"."orders" to "authenticated";

revoke all privileges ("itens_resumo") on table "public"."orders" from PUBLIC, "anon", "authenticated", "service_role";

grant INSERT ("itens_resumo") on table "public"."orders" to "authenticated";

grant UPDATE ("itens_resumo") on table "public"."orders" to "authenticated";

revoke all privileges ("cliente_empresa") on table "public"."orders" from PUBLIC, "anon", "authenticated", "service_role";

grant INSERT ("cliente_empresa") on table "public"."orders" to "authenticated";

grant UPDATE ("cliente_empresa") on table "public"."orders" to "authenticated";

revoke all privileges ("dados_inteligentes") on table "public"."orders" from PUBLIC, "anon", "authenticated", "service_role";

grant INSERT ("dados_inteligentes") on table "public"."orders" to "authenticated";

grant UPDATE ("dados_inteligentes") on table "public"."orders" to "authenticated";

revoke all privileges ("marketplace_origem") on table "public"."orders" from PUBLIC, "anon", "authenticated", "service_role";

grant INSERT ("marketplace_origem") on table "public"."orders" to "authenticated";

grant UPDATE ("marketplace_origem") on table "public"."orders" to "authenticated";

revoke all privileges ("prazo") on table "public"."orders" from PUBLIC, "anon", "authenticated", "service_role";

grant INSERT ("prazo") on table "public"."orders" to "authenticated";

grant UPDATE ("prazo") on table "public"."orders" to "authenticated";

revoke all privileges ("priority") on table "public"."orders" from PUBLIC, "anon", "authenticated", "service_role";

grant INSERT ("priority") on table "public"."orders" to "authenticated";

grant UPDATE ("priority") on table "public"."orders" to "authenticated";

revoke all privileges ("internal_notes") on table "public"."orders" from PUBLIC, "anon", "authenticated", "service_role";

grant INSERT ("internal_notes") on table "public"."orders" to "authenticated";

grant UPDATE ("internal_notes") on table "public"."orders" to "authenticated";

revoke all privileges ("files") on table "public"."orders" from PUBLIC, "anon", "authenticated", "service_role";

grant INSERT ("files") on table "public"."orders" to "authenticated";

grant UPDATE ("files") on table "public"."orders" to "authenticated";

revoke all privileges ("source") on table "public"."orders" from PUBLIC, "anon", "authenticated", "service_role";

grant INSERT ("source") on table "public"."orders" to "authenticated";

grant UPDATE ("source") on table "public"."orders" to "authenticated";

revoke all privileges ("original_order_id") on table "public"."orders" from PUBLIC, "anon", "authenticated", "service_role";

grant INSERT ("original_order_id") on table "public"."orders" to "authenticated";

grant UPDATE ("original_order_id") on table "public"."orders" to "authenticated";

revoke all privileges ("cupom_id") on table "public"."orders" from PUBLIC, "anon", "authenticated", "service_role";

grant INSERT ("cupom_id") on table "public"."orders" to "authenticated";

grant UPDATE ("cupom_id") on table "public"."orders" to "authenticated";

revoke all privileges ("cupom_codigo") on table "public"."orders" from PUBLIC, "anon", "authenticated", "service_role";

grant INSERT ("cupom_codigo") on table "public"."orders" to "authenticated";

grant UPDATE ("cupom_codigo") on table "public"."orders" to "authenticated";

revoke all privileges ("valor_desconto") on table "public"."orders" from PUBLIC, "anon", "authenticated", "service_role";

grant INSERT ("valor_desconto") on table "public"."orders" to "authenticated";

grant UPDATE ("valor_desconto") on table "public"."orders" to "authenticated";

revoke all privileges ("valor_total_original") on table "public"."orders" from PUBLIC, "anon", "authenticated", "service_role";

grant INSERT ("valor_total_original") on table "public"."orders" to "authenticated";

grant UPDATE ("valor_total_original") on table "public"."orders" to "authenticated";

revoke all privileges ("prioridade") on table "public"."orders" from PUBLIC, "anon", "authenticated", "service_role";

grant INSERT ("prioridade") on table "public"."orders" to "authenticated";

grant UPDATE ("prioridade") on table "public"."orders" to "authenticated";

revoke all privileges ("prazo_entrega") on table "public"."orders" from PUBLIC, "anon", "authenticated", "service_role";

grant INSERT ("prazo_entrega") on table "public"."orders" to "authenticated";

grant UPDATE ("prazo_entrega") on table "public"."orders" to "authenticated";

revoke all privileges ("responsavel_id") on table "public"."orders" from PUBLIC, "anon", "authenticated", "service_role";

grant INSERT ("responsavel_id") on table "public"."orders" to "authenticated";

grant UPDATE ("responsavel_id") on table "public"."orders" to "authenticated";

revoke all privileges ("canal_origem") on table "public"."orders" from PUBLIC, "anon", "authenticated", "service_role";

grant INSERT ("canal_origem") on table "public"."orders" to "authenticated";

grant UPDATE ("canal_origem") on table "public"."orders" to "authenticated";

revoke all privileges ("endereco_entrega") on table "public"."orders" from PUBLIC, "anon", "authenticated", "service_role";

grant INSERT ("endereco_entrega") on table "public"."orders" to "authenticated";

grant UPDATE ("endereco_entrega") on table "public"."orders" to "authenticated";

revoke all privileges ("observacoes_internas") on table "public"."orders" from PUBLIC, "anon", "authenticated", "service_role";

grant INSERT ("observacoes_internas") on table "public"."orders" to "authenticated";

grant UPDATE ("observacoes_internas") on table "public"."orders" to "authenticated";

revoke all privileges ("aprovado_em") on table "public"."orders" from PUBLIC, "anon", "authenticated", "service_role";

grant UPDATE ("aprovado_em") on table "public"."orders" to "authenticated";

revoke all privileges ("entregue_em") on table "public"."orders" from PUBLIC, "anon", "authenticated", "service_role";

grant UPDATE ("entregue_em") on table "public"."orders" to "authenticated";

revoke all privileges ("cancelado_em") on table "public"."orders" from PUBLIC, "anon", "authenticated", "service_role";

grant UPDATE ("cancelado_em") on table "public"."orders" to "authenticated";

revoke all privileges ("updated_at") on table "public"."orders" from PUBLIC, "anon", "authenticated", "service_role";

grant UPDATE ("updated_at") on table "public"."orders" to "authenticated";

revoke all privileges ("responsavel_nome") on table "public"."orders" from PUBLIC, "anon", "authenticated", "service_role";

grant INSERT ("responsavel_nome") on table "public"."orders" to "authenticated";

grant UPDATE ("responsavel_nome") on table "public"."orders" to "authenticated";

revoke all privileges ("visualizado_em") on table "public"."orders" from PUBLIC, "anon", "authenticated", "service_role";

grant UPDATE ("visualizado_em") on table "public"."orders" to "authenticated";

revoke all privileges ("notificado_em") on table "public"."orders" from PUBLIC, "anon", "authenticated", "service_role";

grant UPDATE ("notificado_em") on table "public"."orders" to "authenticated";

revoke all privileges ("delivery_type") on table "public"."orders" from PUBLIC, "anon", "authenticated", "service_role";

grant INSERT ("delivery_type") on table "public"."orders" to "authenticated";

grant UPDATE ("delivery_type") on table "public"."orders" to "authenticated";

revoke all privileges ("delivery_fee") on table "public"."orders" from PUBLIC, "anon", "authenticated", "service_role";

grant INSERT ("delivery_fee") on table "public"."orders" to "authenticated";

grant UPDATE ("delivery_fee") on table "public"."orders" to "authenticated";

revoke all privileges ("subtotal") on table "public"."orders" from PUBLIC, "anon", "authenticated", "service_role";

grant INSERT ("subtotal") on table "public"."orders" to "authenticated";

grant UPDATE ("subtotal") on table "public"."orders" to "authenticated";

revoke all privileges ("total_amount") on table "public"."orders" from PUBLIC, "anon", "authenticated", "service_role";

grant INSERT ("total_amount") on table "public"."orders" to "authenticated";

grant UPDATE ("total_amount") on table "public"."orders" to "authenticated";

revoke all privileges ("payment_method_id") on table "public"."orders" from PUBLIC, "anon", "authenticated", "service_role";

grant INSERT ("payment_method_id") on table "public"."orders" to "authenticated";

grant UPDATE ("payment_method_id") on table "public"."orders" to "authenticated";

revoke all privileges ("delivery_zone_id") on table "public"."orders" from PUBLIC, "anon", "authenticated", "service_role";

grant INSERT ("delivery_zone_id") on table "public"."orders" to "authenticated";

grant UPDATE ("delivery_zone_id") on table "public"."orders" to "authenticated";

revoke all privileges ("address") on table "public"."orders" from PUBLIC, "anon", "authenticated", "service_role";

grant INSERT ("address") on table "public"."orders" to "authenticated";

grant UPDATE ("address") on table "public"."orders" to "authenticated";

revoke all privileges ("neighborhood") on table "public"."orders" from PUBLIC, "anon", "authenticated", "service_role";

grant INSERT ("neighborhood") on table "public"."orders" to "authenticated";

grant UPDATE ("neighborhood") on table "public"."orders" to "authenticated";

revoke all privileges ("complement") on table "public"."orders" from PUBLIC, "anon", "authenticated", "service_role";

grant INSERT ("complement") on table "public"."orders" to "authenticated";

grant UPDATE ("complement") on table "public"."orders" to "authenticated";

revoke all privileges ("reference_point") on table "public"."orders" from PUBLIC, "anon", "authenticated", "service_role";

grant INSERT ("reference_point") on table "public"."orders" to "authenticated";

grant UPDATE ("reference_point") on table "public"."orders" to "authenticated";

revoke all privileges ("change_for") on table "public"."orders" from PUBLIC, "anon", "authenticated", "service_role";

grant INSERT ("change_for") on table "public"."orders" to "authenticated";

grant UPDATE ("change_for") on table "public"."orders" to "authenticated";

revoke all privileges ("items_snapshot") on table "public"."orders" from PUBLIC, "anon", "authenticated", "service_role";

grant INSERT ("items_snapshot") on table "public"."orders" to "authenticated";

grant UPDATE ("items_snapshot") on table "public"."orders" to "authenticated";

revoke all privileges ("discount_amount") on table "public"."orders" from PUBLIC, "anon", "authenticated", "service_role";

grant INSERT ("discount_amount") on table "public"."orders" to "authenticated";

grant UPDATE ("discount_amount") on table "public"."orders" to "authenticated";

revoke all privileges ("coupon_code") on table "public"."orders" from PUBLIC, "anon", "authenticated", "service_role";

grant INSERT ("coupon_code") on table "public"."orders" to "authenticated";

grant UPDATE ("coupon_code") on table "public"."orders" to "authenticated";

revoke all privileges ("customer_name") on table "public"."orders" from PUBLIC, "anon", "authenticated", "service_role";

grant INSERT ("customer_name") on table "public"."orders" to "authenticated";

grant UPDATE ("customer_name") on table "public"."orders" to "authenticated";

revoke all privileges ("customer_email") on table "public"."orders" from PUBLIC, "anon", "authenticated", "service_role";

grant INSERT ("customer_email") on table "public"."orders" to "authenticated";

grant UPDATE ("customer_email") on table "public"."orders" to "authenticated";

revoke all privileges ("customer_phone") on table "public"."orders" from PUBLIC, "anon", "authenticated", "service_role";

grant INSERT ("customer_phone") on table "public"."orders" to "authenticated";

grant UPDATE ("customer_phone") on table "public"."orders" to "authenticated";

revoke all privileges ("total") on table "public"."orders" from PUBLIC, "anon", "authenticated", "service_role";

grant INSERT ("total") on table "public"."orders" to "authenticated";

grant UPDATE ("total") on table "public"."orders" to "authenticated";

revoke all privileges ("payment_method") on table "public"."orders" from PUBLIC, "anon", "authenticated", "service_role";

grant INSERT ("payment_method") on table "public"."orders" to "authenticated";

grant UPDATE ("payment_method") on table "public"."orders" to "authenticated";

revoke all privileges ("coupon_id") on table "public"."orders" from PUBLIC, "anon", "authenticated", "service_role";

grant INSERT ("coupon_id") on table "public"."orders" to "authenticated";

grant UPDATE ("coupon_id") on table "public"."orders" to "authenticated";

comment on function "public"."claim_platform_admin_invite"(p_token_hash text, p_claim_id uuid) is 'Reivindica atomicamente um convite pendente para evitar ativacoes concorrentes.';

comment on function "public"."complete_platform_admin_invite"(p_claim_id uuid, p_user_id uuid) is 'Conclui atomicamente no banco a criacao de um Prospector ja criado no Supabase Auth.';

comment on function "public"."get_my_platform_admin_access"() is 'Retorna somente o acesso administrativo ativo do usuario autenticado; usada pelo proxy antes de renderizar /admin.';

comment on function "public"."get_platform_qa_vercel_share"() is 'Platform Evolution Auth QA only. Returns the encrypted-at-rest temporary Vercel Preview share credential to service_role callers.';

comment on column "public"."affiliate_referrals"."review_status" is 'Revisao administrativa da elegibilidade da indicacao antes da liberacao financeira.';

comment on table "public"."application_error_events" is 'PII-minimized application error telemetry. Business audit and analytics events belong in separate domains.';

comment on column "public"."companies"."founder_price_ends_at" is 'Fim dos 6 meses-calendário de preço fundador, contado após o trial de 30 dias.';

comment on column "public"."companies"."timezone" is 'Canonical company IANA timezone. Nullable until explicitly configured; operational scheduling must not infer browser timezone.';

comment on column "public"."delivery_assignments"."settlement_status" is 'Status da prestacao de contas do entregador: pending, settled ou waived.';

comment on table "public"."delivery_assignments" is 'Historico imutavel por snapshot de cada alocacao de entrega e prestacao de contas.';

comment on table "public"."delivery_drivers" is 'Entregadores cadastrados por empresa para alocacao de entregas.';

comment on column "public"."founder_invites"."founder_number" is '0 reservado para teste; 1 a 10 são vagas reais do Programa Fundadores.';

comment on table "public"."founder_invites" is 'Convites do Programa Clientes Fundadores Orçaly. Tokens persistidos somente como SHA-256 hexadecimal.';

comment on column "public"."order_status_history"."changed_by_email" is 'E-mail do usuário que alterou o status, quando a mudança é feita pelo painel.';

comment on table "public"."payment_payouts" is 'Registro de repasses informados pelo provider. Nao representa saldo ficticio.';

comment on table "public"."payment_webhook_events" is 'Eventos financeiros idempotentes e sanitizados. Escrita exclusiva do backend com service role.';

comment on column "public"."platform_admin_invites"."token_hash" is 'SHA-256 hexadecimal do token de ativacao. O token em claro existe apenas no link devolvido ao Owner.';

comment on table "public"."platform_admin_invites" is 'Convites internos seguros para membros da plataforma. Tokens em claro nunca sao persistidos.';

comment on column "public"."platform_admins"."permissions" is 'Permissoes administrativas granulares. Senhas nunca sao armazenadas nesta tabela.';

comment on table "public"."platform_admins" is 'Equipe interna do Orcaly. Owner possui controle total; support usa permissoes granulares.';

comment on table "public"."provider_customers" is 'Mapeamento de clientes internos para identificadores do provider.';

comment on column "public"."signup_leads"."assigned_to_admin_id" is 'Responsavel comercial atual em platform_admins.';

comment on column "public"."signup_leads"."created_by_admin_id" is 'Usuario interno que originou a oportunidade comercial, quando aplicavel.';

comment on column "public"."signup_leads"."sales_stage" is 'Etapa comercial independente do status de checkout/pagamento.';

do $guard$ begin if exists(select 1 from cron.job) then raise exception 'STAGING_CRON_MUST_REMAIN_EMPTY'; end if; end $guard$;

commit;
