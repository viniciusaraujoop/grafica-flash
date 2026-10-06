-- R10 ENGINEERED PRE-LEDGER FRONTIER / NOT HISTORICAL / NOT LEDGERED.
-- FRESH EMPTY DISPOSABLE ENVIRONMENT ONLY. NEVER PRODUCTION OR STAGING.
-- CANDIDATE_NOT_RUNTIME_CERTIFIED. Agent 4 review and fixed-point replay required.
BEGIN;
SET LOCAL search_path = pg_catalog, public;

CREATE SCHEMA api AUTHORIZATION postgres;
REVOKE ALL ON SCHEMA api FROM PUBLIC, anon, authenticated, service_role;
GRANT USAGE ON SCHEMA api TO anon, authenticated;

CREATE TABLE "public"."admin_audit_logs" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "admin_email" text NOT NULL,
  "action" text NOT NULL,
  "metadata" jsonb DEFAULT '{}'::jsonb,
  "created_at" timestamp with time zone DEFAULT now(),
  "target_type" text,
  "target_id" text,
  "target_label" text,
  "payload" jsonb DEFAULT '{}'::jsonb NOT NULL
);
ALTER TABLE "public"."admin_audit_logs" OWNER TO postgres;

CREATE TABLE "public"."admin_bug_reports" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "severity" text NOT NULL,
  "category" text NOT NULL,
  "title" text NOT NULL,
  "description" text,
  "table_name" text,
  "record_id" text,
  "fingerprint" text NOT NULL,
  "status" text DEFAULT 'aberto'::text NOT NULL,
  "metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "first_seen_at" timestamp with time zone DEFAULT now(),
  "last_seen_at" timestamp with time zone DEFAULT now(),
  "resolved_at" timestamp with time zone,
  "resolved_by" text,
  "resolution_note" text,
  "code" text NOT NULL,
  "area" text DEFAULT 'sistema'::text NOT NULL,
  "entity_type" text,
  "entity_id" text,
  "entity_label" text,
  "suggested_action" text,
  "occurrences" integer DEFAULT 1 NOT NULL,
  "fix_steps" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "fix_sql" text,
  "fix_route" text,
  "auto_fixable" boolean DEFAULT false NOT NULL,
  "affected_table" text,
  "affected_field" text
);
ALTER TABLE "public"."admin_bug_reports" OWNER TO postgres;

CREATE TABLE "public"."admin_scan_runs" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "started_at" timestamp with time zone DEFAULT now(),
  "finished_at" timestamp with time zone,
  "status" text DEFAULT 'rodando'::text NOT NULL,
  "total_issues" integer DEFAULT 0 NOT NULL,
  "critical_count" integer DEFAULT 0 NOT NULL,
  "high_count" integer DEFAULT 0 NOT NULL,
  "medium_count" integer DEFAULT 0 NOT NULL,
  "low_count" integer DEFAULT 0 NOT NULL,
  "created_by" text,
  "summary" jsonb DEFAULT '{}'::jsonb NOT NULL
);
ALTER TABLE "public"."admin_scan_runs" OWNER TO postgres;

CREATE TABLE "public"."admin_system_snapshots" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "companies_total" integer DEFAULT 0,
  "companies_active" integer DEFAULT 0,
  "companies_overdue" integer DEFAULT 0,
  "bugs_green" integer DEFAULT 0,
  "bugs_yellow" integer DEFAULT 0,
  "bugs_red" integer DEFAULT 0,
  "metadata" jsonb DEFAULT '{}'::jsonb,
  "created_at" timestamp with time zone DEFAULT now()
);
ALTER TABLE "public"."admin_system_snapshots" OWNER TO postgres;

CREATE TABLE "public"."admin_users" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "email" text NOT NULL,
  "nome" text,
  "role" text DEFAULT 'admin'::text NOT NULL,
  "ativo" boolean DEFAULT true NOT NULL,
  "created_at" timestamp with time zone DEFAULT now(),
  "permissions" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "area" text,
  "observacoes" text,
  "created_by" text,
  "updated_at" timestamp with time zone DEFAULT now()
);
ALTER TABLE "public"."admin_users" OWNER TO postgres;

CREATE TABLE "public"."app_notifications" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "company_id" uuid NOT NULL,
  "user_id" uuid,
  "tipo" text DEFAULT 'info'::text NOT NULL,
  "titulo" text NOT NULL,
  "mensagem" text,
  "link_url" text,
  "status" text DEFAULT 'unread'::text NOT NULL,
  "payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "read_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
ALTER TABLE "public"."app_notifications" OWNER TO postgres;

CREATE TABLE "public"."art_approval_requests" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "company_id" uuid NOT NULL,
  "order_id" uuid,
  "proposal_id" uuid,
  "token" text DEFAULT encode(gen_random_bytes(18), 'hex'::text) NOT NULL,
  "title" text,
  "produto_nome" text,
  "cliente_nome" text,
  "cliente_whatsapp" text,
  "artwork_url" text,
  "preview_url" text,
  "instructions" text,
  "status" text DEFAULT 'Aguardando aprovação da arte'::text NOT NULL,
  "comentario_cliente" text,
  "internal_notes" text,
  "approved_at" timestamp with time zone,
  "requested_changes_at" timestamp with time zone,
  "created_by" uuid,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
ALTER TABLE "public"."art_approval_requests" OWNER TO postgres;

CREATE TABLE "public"."business_hours" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "company_id" uuid,
  "weekday" integer NOT NULL,
  "opens_at" time without time zone,
  "closes_at" time without time zone,
  "active" boolean DEFAULT true,
  "created_at" timestamp with time zone DEFAULT now(),
  "updated_at" timestamp with time zone DEFAULT now(),
  "is_active" boolean DEFAULT true NOT NULL,
  "is_open" boolean DEFAULT true,
  "open_time" time without time zone,
  "close_time" time without time zone,
  "break_start" time without time zone,
  "break_end" time without time zone,
  "closed_message" text
);
ALTER TABLE "public"."business_hours" OWNER TO postgres;

CREATE TABLE "public"."companies" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "nome" text NOT NULL,
  "slug" text NOT NULL,
  "logo_url" text,
  "whatsapp" text,
  "cor_principal" text DEFAULT '#fb923c'::text,
  "plano" text DEFAULT 'basico'::text,
  "ativo" boolean DEFAULT true,
  "created_at" timestamp with time zone DEFAULT now(),
  "owner_id" uuid,
  "email" text,
  "segmento" text,
  "telefone" text,
  "cidade" text,
  "estado" text,
  "pix_key" text,
  "pix_nome" text,
  "pix_cidade" text,
  "aceita_pix" boolean DEFAULT true,
  "aceita_cartao" boolean DEFAULT false,
  "cobrar_sinal" boolean DEFAULT false,
  "percentual_sinal" numeric DEFAULT 0,
  "assinatura_status" text DEFAULT 'pendente'::text,
  "assinatura_plano" text,
  "assinatura_inicio" timestamp with time zone,
  "assinatura_expira_em" timestamp with time zone,
  "assinatura_ultimo_pagamento" timestamp with time zone,
  "mercado_pago_customer_email" text,
  "tester_id" uuid,
  "modelo_negocio" text,
  "modelo_nome" text,
  "modelo_perguntas" jsonb DEFAULT '[]'::jsonb,
  "subdomain_slug" text,
  "site_template" text DEFAULT 'auto'::text,
  "site_status" text DEFAULT 'publicado'::text,
  "site_primary_color" text DEFAULT '#05245c'::text,
  "site_accent_color" text DEFAULT '#22c55e'::text,
  "site_config" jsonb DEFAULT '{}'::jsonb,
  "site_updated_at" timestamp with time zone DEFAULT now(),
  "pix_tipo" text DEFAULT 'telefone'::text,
  "atendimento_horario" text,
  "atendimento_observacao" text,
  "instagram" text,
  "marketplace_ativo" boolean DEFAULT true,
  "marketplace_titulo" text,
  "marketplace_subtitulo" text,
  "marketplace_banner_url" text,
  "marketplace_texto_botao" text DEFAULT 'Comprar agora'::text,
  "marketplace_sobre" text,
  "marketplace_endereco" text,
  "marketplace_mapa_url" text,
  "marketplace_termos" text,
  "marketplace_config" jsonb DEFAULT '{}'::jsonb,
  "site_publico_ativo" boolean DEFAULT true,
  "site_background_color" text DEFAULT '#f5f8ff'::text,
  "site_headline" text,
  "site_subheadline" text,
  "site_cta_text" text DEFAULT 'Ver loja'::text,
  "site_banner_url" text,
  "site_about_title" text,
  "site_about_text" text,
  "site_services_title" text,
  "site_contact_title" text,
  "site_show_store" boolean DEFAULT true,
  "site_show_about" boolean DEFAULT true,
  "site_show_contact" boolean DEFAULT true,
  "site_show_featured" boolean DEFAULT true,
  "site_features" jsonb DEFAULT '[]'::jsonb,
  "site_faq" jsonb DEFAULT '[]'::jsonb,
  "site_testimonials" jsonb DEFAULT '[]'::jsonb,
  "site_custom_sections" jsonb DEFAULT '[]'::jsonb,
  "updated_at" timestamp with time zone DEFAULT now(),
  "assinatura_auto_recorrente" boolean DEFAULT false,
  "assinatura_cancelada_em" timestamp with time zone,
  "assinatura_checkout_url" text,
  "assinatura_mp_payload" jsonb,
  "assinatura_proxima_cobranca" timestamp with time zone,
  "mercado_pago_subscription_id" text,
  "mercado_pago_subscription_status" text,
  "modelo_status" text[],
  "modelo_mensagens" jsonb DEFAULT '[]'::jsonb,
  "modelo_proposta" jsonb DEFAULT '{}'::jsonb,
  "modelo_campos_recomendados" text[],
  "site_layout" text DEFAULT 'moderno'::text,
  "site_art_style" text DEFAULT 'profissional'::text,
  "site_font_style" text DEFAULT 'inter'::text,
  "site_button_style" text DEFAULT 'arredondado'::text,
  "site_hero_alignment" text DEFAULT 'esquerda'::text,
  "site_text_color" text DEFAULT '#071b3a'::text,
  "site_card_color" text DEFAULT '#ffffff'::text,
  "site_badge_text" text,
  "site_secondary_cta_text" text DEFAULT 'Ver catálogo'::text,
  "site_whatsapp_message" text,
  "site_show_faq" boolean DEFAULT true,
  "site_show_testimonials" boolean DEFAULT true,
  "site_show_gallery" boolean DEFAULT true,
  "site_show_benefits" boolean DEFAULT true,
  "site_gallery" jsonb DEFAULT '[]'::jsonb,
  "site_benefits" jsonb DEFAULT '[]'::jsonb,
  "site_seo_title" text,
  "site_seo_description" text,
  "site_keywords" text[],
  "site_promo_title" text,
  "site_promo_text" text,
  "site_promo_active" boolean DEFAULT false,
  "site_promo_button_text" text DEFAULT 'Aproveitar oferta'::text,
  "site_business_hours" jsonb DEFAULT '{}'::jsonb,
  "site_payment_methods" text[],
  "site_delivery_options" text[],
  "site_hero_style" text DEFAULT 'premium-showcase'::text,
  "site_art_variant" text DEFAULT 'auto'::text,
  "site_section_style" text DEFAULT 'soft-premium'::text,
  "site_product_card_style" text DEFAULT 'premium'::text,
  "site_nav_variant" text DEFAULT 'clean'::text,
  "site_corner_style" text DEFAULT 'rounded'::text,
  "site_density" text DEFAULT 'comfortable'::text,
  "site_show_marketplace" boolean DEFAULT true,
  "site_enable_cart" boolean DEFAULT true,
  "site_enable_coupons" boolean DEFAULT true,
  "site_show_prices" boolean DEFAULT true,
  "site_checkout_mode" text DEFAULT 'cart'::text,
  "site_marketplace_title" text DEFAULT 'Catálogo online'::text,
  "site_marketplace_subtitle" text DEFAULT 'Escolha produtos, monte seu pedido e envie tudo organizado para atendimento.'::text,
  "site_cart_button_text" text DEFAULT 'Adicionar'::text,
  "site_checkout_button_text" text DEFAULT 'Finalizar pedido'::text,
  "site_empty_catalog_text" text DEFAULT 'A empresa ainda está preparando o catálogo.'::text,
  "site_trust_title" text DEFAULT 'Por que escolher a gente?'::text,
  "site_hero_highlights" jsonb DEFAULT '[]'::jsonb,
  "site_brand_words" text[],
  "site_footer_text" text,
  "whatsapp_enabled" boolean DEFAULT false,
  "whatsapp_phone_number_id" text,
  "whatsapp_access_token" text,
  "whatsapp_verify_token" text,
  "whatsapp_business_account_id" text,
  "whatsapp_auto_reply_enabled" boolean DEFAULT false,
  "whatsapp_order_notifications" boolean DEFAULT false,
  "whatsapp_status_notifications" boolean DEFAULT false,
  "whatsapp_ai_enabled" boolean DEFAULT false,
  "whatsapp_ai_prompt" text,
  "banner_url" text,
  "onboarding_current_step" integer DEFAULT 1,
  "onboarding_completed" boolean DEFAULT false,
  "onboarding_completed_at" timestamp with time zone,
  "onboarding_dismissed" boolean DEFAULT false,
  "onboarding_updated_at" timestamp with time zone DEFAULT now(),
  "business_type" text DEFAULT 'services'::text,
  "onboarding_goal" text,
  "site_theme" text,
  "site_cta_label" text,
  "site_sections" jsonb DEFAULT '[]'::jsonb,
  "assinatura_forma_pagamento_preferida" text,
  "assinatura_pix_avulso_status" text,
  "assinatura_pix_avulso_ultimo_pagamento" timestamp with time zone,
  "trial_started_at" timestamp with time zone,
  "trial_ends_at" timestamp with time zone,
  "trial_used_at" timestamp with time zone,
  "cancel_at_period_end" boolean DEFAULT false NOT NULL,
  "access_until" timestamp with time zone,
  "subscription_provider" text,
  "provider_customer_id" text,
  "provider_subscription_id" text,
  "next_billing_at" timestamp with time zone
);
ALTER TABLE "public"."companies" OWNER TO postgres;

CREATE TABLE "public"."company_members" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "company_id" uuid NOT NULL,
  "user_id" uuid NOT NULL,
  "nome" text NOT NULL,
  "email" text NOT NULL,
  "cargo" text DEFAULT 'atendente'::text NOT NULL,
  "status" text DEFAULT 'ativo'::text NOT NULL,
  "permissions" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "created_by" uuid,
  "created_at" timestamp with time zone DEFAULT now(),
  "updated_at" timestamp with time zone DEFAULT now()
);
ALTER TABLE "public"."company_members" OWNER TO postgres;

CREATE TABLE "public"."company_niche_templates" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "company_id" uuid NOT NULL,
  "niche_id" text NOT NULL,
  "niche_name" text NOT NULL,
  "categories" text[] DEFAULT '{}'::text[] NOT NULL,
  "questions" text[] DEFAULT '{}'::text[] NOT NULL,
  "statuses" text[] DEFAULT '{}'::text[] NOT NULL,
  "ready_messages" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "proposal_model" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "recommended_fields" text[] DEFAULT '{}'::text[] NOT NULL,
  "applied_by" uuid,
  "applied_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
ALTER TABLE "public"."company_niche_templates" OWNER TO postgres;

CREATE TABLE "public"."company_proposal_settings" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "company_id" uuid NOT NULL,
  "default_validity_days" integer DEFAULT 7,
  "default_terms" text,
  "default_intro" text,
  "default_approval_message" text,
  "default_rejection_message" text,
  "require_document" boolean DEFAULT false,
  "require_signature_name" boolean DEFAULT true,
  "auto_generate_pix" boolean DEFAULT true,
  "created_at" timestamp with time zone DEFAULT now(),
  "updated_at" timestamp with time zone DEFAULT now()
);
ALTER TABLE "public"."company_proposal_settings" OWNER TO postgres;

CREATE TABLE "public"."company_whatsapp_settings" (
  "company_id" uuid NOT NULL,
  "enabled" boolean DEFAULT false NOT NULL,
  "ai_enabled" boolean DEFAULT false NOT NULL,
  "notify_owner_new_order" boolean DEFAULT true NOT NULL,
  "notify_client_new_order" boolean DEFAULT true NOT NULL,
  "notify_client_order_status" boolean DEFAULT true NOT NULL,
  "notify_client_proposal" boolean DEFAULT true NOT NULL,
  "notify_owner_proposal" boolean DEFAULT true NOT NULL,
  "owner_phone" text,
  "phone_number_id" text,
  "business_account_id" text,
  "ai_prompt" text,
  "fallback_message" text DEFAULT 'No momento não consegui responder automaticamente. Nossa equipe vai continuar seu atendimento.'::text,
  "template_order_created" text,
  "template_order_status" text,
  "template_proposal_update" text,
  "template_payment_update" text,
  "template_language" text DEFAULT 'pt_BR'::text NOT NULL,
  "metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
ALTER TABLE "public"."company_whatsapp_settings" OWNER TO postgres;

CREATE TABLE "public"."crm_leads" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "company_id" uuid NOT NULL,
  "nome" text NOT NULL,
  "telefone" text,
  "email" text,
  "origem" text DEFAULT 'manual'::text,
  "etapa" text DEFAULT 'novo_lead'::text NOT NULL,
  "status" text DEFAULT 'ativo'::text NOT NULL,
  "valor_estimado" numeric DEFAULT 0,
  "proximo_contato_em" timestamp with time zone,
  "observacoes" text,
  "tags" text[],
  "order_id" uuid,
  "proposal_id" uuid,
  "created_by" uuid,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
ALTER TABLE "public"."crm_leads" OWNER TO postgres;

CREATE TABLE "public"."customer_followups" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "company_id" uuid NOT NULL,
  "cliente_nome" text,
  "cliente_telefone" text NOT NULL,
  "titulo" text NOT NULL,
  "descricao" text,
  "status" text DEFAULT 'pendente'::text NOT NULL,
  "prioridade" text DEFAULT 'media'::text NOT NULL,
  "due_at" timestamp with time zone,
  "completed_at" timestamp with time zone,
  "created_by" uuid,
  "created_at" timestamp with time zone DEFAULT now()
);
ALTER TABLE "public"."customer_followups" OWNER TO postgres;

CREATE TABLE "public"."customer_internal_notes" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "company_id" uuid NOT NULL,
  "customer_phone" text,
  "customer_name" text,
  "note" text NOT NULL,
  "created_by" uuid,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
ALTER TABLE "public"."customer_internal_notes" OWNER TO postgres;

CREATE TABLE "public"."customer_magic_links" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "company_id" uuid NOT NULL,
  "customer_name" text,
  "customer_phone" text NOT NULL,
  "token" text DEFAULT encode(gen_random_bytes(18), 'hex'::text) NOT NULL,
  "status" text DEFAULT 'ativo'::text NOT NULL,
  "last_access_at" timestamp with time zone,
  "created_by" uuid,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
ALTER TABLE "public"."customer_magic_links" OWNER TO postgres;

CREATE TABLE "public"."customer_notes" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "company_id" uuid NOT NULL,
  "cliente_nome" text,
  "cliente_telefone" text NOT NULL,
  "tipo" text DEFAULT 'nota'::text NOT NULL,
  "conteudo" text NOT NULL,
  "created_by" uuid,
  "created_at" timestamp with time zone DEFAULT now()
);
ALTER TABLE "public"."customer_notes" OWNER TO postgres;

CREATE TABLE "public"."customer_portal_events" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "company_id" uuid,
  "customer_magic_link_id" uuid,
  "event_type" text NOT NULL,
  "metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
ALTER TABLE "public"."customer_portal_events" OWNER TO postgres;

CREATE TABLE "public"."deliveries" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "company_id" uuid,
  "order_id" uuid,
  "customer_name" text,
  "customer_phone" text,
  "address" text,
  "neighborhood" text,
  "delivery_zone_id" uuid,
  "delivery_fee" numeric(12,2) DEFAULT 0,
  "payment_method_id" uuid,
  "status" text DEFAULT 'waiting_preparation'::text,
  "notes" text,
  "estimated_delivery_at" timestamp with time zone,
  "delivered_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now(),
  "updated_at" timestamp with time zone DEFAULT now()
);
ALTER TABLE "public"."deliveries" OWNER TO postgres;

CREATE TABLE "public"."delivery_zones" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "company_id" uuid,
  "name" text NOT NULL,
  "fee" numeric(10,2) DEFAULT 0,
  "min_order" numeric(10,2),
  "active" boolean DEFAULT true,
  "created_at" timestamp with time zone DEFAULT now(),
  "updated_at" timestamp with time zone DEFAULT now(),
  "is_active" boolean DEFAULT true NOT NULL,
  "minimum_order" numeric(12,2) DEFAULT 0,
  "estimated_time_min" integer,
  "estimated_time_max" integer,
  "notes" text
);
ALTER TABLE "public"."delivery_zones" OWNER TO postgres;

CREATE TABLE "public"."finance_accounts" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "company_id" uuid NOT NULL,
  "nome" text NOT NULL,
  "tipo" text DEFAULT 'caixa'::text NOT NULL,
  "saldo_inicial" numeric DEFAULT 0 NOT NULL,
  "ativo" boolean DEFAULT true NOT NULL,
  "created_at" timestamp with time zone DEFAULT now(),
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
ALTER TABLE "public"."finance_accounts" OWNER TO postgres;

CREATE TABLE "public"."financial_categories" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "company_id" uuid NOT NULL,
  "name" text NOT NULL,
  "type" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
ALTER TABLE "public"."financial_categories" OWNER TO postgres;

CREATE TABLE "public"."financial_material_entries" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "company_id" uuid NOT NULL,
  "transaction_id" uuid,
  "nome" text NOT NULL,
  "quantidade" numeric DEFAULT 1 NOT NULL,
  "unidade" text DEFAULT 'un'::text,
  "valor_unitario" numeric DEFAULT 0,
  "valor_total" numeric DEFAULT 0,
  "codigo" text,
  "categoria" text,
  "fornecedor" text,
  "created_at" timestamp with time zone DEFAULT now()
);
ALTER TABLE "public"."financial_material_entries" OWNER TO postgres;

CREATE TABLE "public"."financial_transactions" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "company_id" uuid NOT NULL,
  "tipo" text DEFAULT 'saida'::text NOT NULL,
  "categoria" text DEFAULT 'outros'::text NOT NULL,
  "descricao" text NOT NULL,
  "valor" numeric DEFAULT 0 NOT NULL,
  "data_competencia" date DEFAULT CURRENT_DATE NOT NULL,
  "status" text DEFAULT 'pago'::text NOT NULL,
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
  "origem" text DEFAULT 'manual'::text NOT NULL,
  "raw_data" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "created_by" uuid,
  "created_at" timestamp with time zone DEFAULT now(),
  "updated_at" timestamp with time zone DEFAULT now(),
  "vencimento" date,
  "observacoes" text,
  "centro_custo" text,
  "tags" text[] DEFAULT '{}'::text[],
  "recorrente" boolean DEFAULT false,
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
  "notes" text
);
ALTER TABLE "public"."financial_transactions" OWNER TO postgres;

CREATE TABLE "public"."internal_tasks" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "company_id" uuid NOT NULL,
  "titulo" text NOT NULL,
  "descricao" text,
  "status" text DEFAULT 'pendente'::text NOT NULL,
  "prioridade" text DEFAULT 'media'::text NOT NULL,
  "due_at" timestamp with time zone,
  "responsavel_id" uuid,
  "created_by" uuid,
  "crm_lead_id" uuid,
  "order_id" uuid,
  "proposal_id" uuid,
  "completed_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
ALTER TABLE "public"."internal_tasks" OWNER TO postgres;

CREATE TABLE "public"."marketplace_commission_rules" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "company_id" uuid,
  "plan_key" text,
  "commission_percentage" numeric(5,2) DEFAULT 5.00 NOT NULL,
  "commission_fixed" numeric(12,2) DEFAULT 0 NOT NULL,
  "is_active" boolean DEFAULT true NOT NULL,
  "created_at" timestamp with time zone DEFAULT now(),
  "updated_at" timestamp with time zone DEFAULT now()
);
ALTER TABLE "public"."marketplace_commission_rules" OWNER TO postgres;

CREATE TABLE "public"."marketplace_commissions" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "company_id" uuid NOT NULL,
  "order_id" uuid,
  "marketplace_payment_id" uuid,
  "provider" text DEFAULT 'mercado_pago'::text NOT NULL,
  "gross_amount" numeric(12,2) DEFAULT 0 NOT NULL,
  "commission_percentage" numeric(5,2) DEFAULT 0 NOT NULL,
  "commission_fixed" numeric(12,2) DEFAULT 0 NOT NULL,
  "commission_amount" numeric(12,2) DEFAULT 0 NOT NULL,
  "status" text DEFAULT 'pending'::text NOT NULL,
  "confirmed_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now(),
  "updated_at" timestamp with time zone DEFAULT now(),
  "provider_split_id" text,
  "calculation_base" text,
  "fee_percent" numeric(8,4),
  "estimated_amount" numeric(14,2),
  "confirmed_amount" numeric(14,2),
  "refusal_reason" text,
  "external_reference" text
);
ALTER TABLE "public"."marketplace_commissions" OWNER TO postgres;

CREATE TABLE "public"."marketplace_coupons" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "company_id" uuid NOT NULL,
  "codigo" text NOT NULL,
  "codigo_normalizado" text NOT NULL,
  "descricao" text,
  "tipo" text DEFAULT 'percentual'::text NOT NULL,
  "valor" numeric DEFAULT 0 NOT NULL,
  "valor_minimo_pedido" numeric DEFAULT 0 NOT NULL,
  "valor_maximo_desconto" numeric,
  "starts_at" timestamp with time zone,
  "ends_at" timestamp with time zone,
  "usage_limit" integer,
  "used_count" integer DEFAULT 0 NOT NULL,
  "ativo" boolean DEFAULT true NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  "coupon_type" text,
  "free_delivery" boolean DEFAULT false NOT NULL,
  "allowed_product_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "allowed_categories" jsonb DEFAULT '[]'::jsonb NOT NULL
);
ALTER TABLE "public"."marketplace_coupons" OWNER TO postgres;

CREATE TABLE "public"."marketplace_oauth_states" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "company_id" uuid NOT NULL,
  "user_id" uuid,
  "provider" text DEFAULT 'mercado_pago'::text NOT NULL,
  "state_hash" text NOT NULL,
  "expires_at" timestamp with time zone NOT NULL,
  "consumed_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now()
);
ALTER TABLE "public"."marketplace_oauth_states" OWNER TO postgres;

CREATE TABLE "public"."marketplace_payment_settings" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "company_id" uuid NOT NULL,
  "provider" text DEFAULT 'mercado_pago'::text NOT NULL,
  "provider_user_id" text,
  "provider_account_id" text,
  "access_token" text,
  "refresh_token" text,
  "public_key" text,
  "token_expires_at" timestamp with time zone,
  "onboarding_status" text DEFAULT 'pending'::text NOT NULL,
  "is_active" boolean DEFAULT false NOT NULL,
  "last_error" text,
  "created_at" timestamp with time zone DEFAULT now(),
  "updated_at" timestamp with time zone DEFAULT now(),
  "provider_wallet_id" text,
  "encrypted_provider_api_key" text,
  "encrypted_webhook_auth_token" text,
  "account_status" text,
  "charges_enabled" boolean DEFAULT false,
  "payouts_enabled" boolean DEFAULT false,
  "pix_enabled" boolean DEFAULT false,
  "card_enabled" boolean DEFAULT false,
  "onboarding_url" text,
  "last_status_check_at" timestamp with time zone,
  "provider_metadata_sanitized" jsonb DEFAULT '{}'::jsonb,
  "legal_name" text,
  "document_last4" text,
  "bank_name" text,
  "bank_account_last4" text,
  "bank_account_type" text
);
ALTER TABLE "public"."marketplace_payment_settings" OWNER TO postgres;

CREATE TABLE "public"."marketplace_payments" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "company_id" uuid NOT NULL,
  "order_id" uuid,
  "provider" text DEFAULT 'mercado_pago'::text NOT NULL,
  "provider_preference_id" text,
  "provider_payment_id" text,
  "provider_status" text,
  "status" text DEFAULT 'pending'::text NOT NULL,
  "checkout_url" text,
  "sandbox_checkout_url" text,
  "amount" numeric(12,2) DEFAULT 0 NOT NULL,
  "subtotal" numeric(12,2) DEFAULT 0 NOT NULL,
  "delivery_fee" numeric(12,2) DEFAULT 0 NOT NULL,
  "discount_amount" numeric(12,2) DEFAULT 0 NOT NULL,
  "commission_amount" numeric(12,2) DEFAULT 0 NOT NULL,
  "commission_percentage" numeric(5,2) DEFAULT 0 NOT NULL,
  "currency" text DEFAULT 'BRL'::text NOT NULL,
  "payer_name" text,
  "payer_email" text,
  "payer_phone" text,
  "last_error" text,
  "raw_payload" jsonb DEFAULT '{}'::jsonb,
  "paid_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now(),
  "updated_at" timestamp with time zone DEFAULT now(),
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
  "error_message" text
);
ALTER TABLE "public"."marketplace_payments" OWNER TO postgres;

CREATE TABLE "public"."notifications" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "company_id" uuid,
  "user_id" uuid,
  "type" text NOT NULL,
  "title" text NOT NULL,
  "message" text,
  "link" text,
  "priority" text DEFAULT 'normal'::text,
  "read_at" timestamp with time zone,
  "metadata" jsonb DEFAULT '{}'::jsonb,
  "created_at" timestamp with time zone DEFAULT now()
);
ALTER TABLE "public"."notifications" OWNER TO postgres;

CREATE TABLE "public"."order_internal_comments" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "company_id" uuid NOT NULL,
  "order_id" uuid NOT NULL,
  "user_id" uuid,
  "comentario" text NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
ALTER TABLE "public"."order_internal_comments" OWNER TO postgres;

CREATE TABLE "public"."order_items" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "order_id" uuid,
  "company_id" uuid,
  "product_id" uuid,
  "nome" text NOT NULL,
  "tipo" text,
  "unidade" text,
  "quantidade" numeric DEFAULT 1,
  "preco_unitario" numeric DEFAULT 0,
  "subtotal" numeric DEFAULT 0,
  "created_at" timestamp with time zone DEFAULT now(),
  "largura" numeric,
  "altura" numeric,
  "comprimento" numeric,
  "area_m2" numeric,
  "precificacao" text,
  "detalhes_calculo" text,
  "respostas" jsonb DEFAULT '{}'::jsonb,
  "product_name" text,
  "quantity" integer DEFAULT 1,
  "unit_price" numeric(12,2) DEFAULT 0,
  "addons" jsonb DEFAULT '[]'::jsonb,
  "variation" jsonb DEFAULT '{}'::jsonb,
  "notes" text,
  "total" numeric(14,2) DEFAULT 0,
  "variation_json" jsonb,
  "addons_json" jsonb,
  "observation" text
);
ALTER TABLE "public"."order_items" OWNER TO postgres;

CREATE TABLE "public"."order_payments" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "company_id" uuid,
  "order_id" uuid,
  "payment_method_id" uuid,
  "type" text DEFAULT 'full'::text,
  "status" text DEFAULT 'pending'::text,
  "amount" numeric(12,2) DEFAULT 0 NOT NULL,
  "paid_amount" numeric(12,2) DEFAULT 0,
  "remaining_amount" numeric(12,2) DEFAULT 0,
  "provider" text,
  "provider_payment_id" text,
  "proof_url" text,
  "notes" text,
  "created_at" timestamp with time zone DEFAULT now(),
  "updated_at" timestamp with time zone DEFAULT now(),
  "provider_status" text,
  "idempotency_key" text,
  "external_reference" text,
  "paid_at" timestamp with time zone
);
ALTER TABLE "public"."order_payments" OWNER TO postgres;

CREATE TABLE "public"."order_status_history" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "company_id" uuid NOT NULL,
  "order_id" uuid NOT NULL,
  "old_status" text,
  "new_status" text NOT NULL,
  "changed_by" uuid,
  "note" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
ALTER TABLE "public"."order_status_history" OWNER TO postgres;

CREATE TABLE "public"."orders" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "nome" text NOT NULL,
  "telefone" text NOT NULL,
  "produto" text NOT NULL,
  "largura" numeric,
  "altura" numeric,
  "quantidade" integer DEFAULT 1,
  "observacoes" text,
  "status" text DEFAULT 'Recebido'::text,
  "preco_estimado" numeric,
  "created_at" timestamp with time zone DEFAULT now(),
  "arquivo_url" text,
  "company_id" uuid,
  "valor_total" numeric,
  "valor_sinal" numeric,
  "percentual_sinal" numeric,
  "forma_pagamento" text,
  "parcelas" integer,
  "itens_resumo" text,
  "cliente_empresa" text,
  "dados_inteligentes" jsonb DEFAULT '{}'::jsonb,
  "marketplace_origem" text DEFAULT 'orcamento'::text,
  "prazo" text,
  "priority" text DEFAULT 'normal'::text,
  "internal_notes" text,
  "files" jsonb DEFAULT '[]'::jsonb,
  "source" text,
  "original_order_id" uuid,
  "customer_portal_token" text,
  "cupom_id" uuid,
  "cupom_codigo" text,
  "valor_desconto" numeric DEFAULT 0,
  "valor_total_original" numeric,
  "prioridade" text DEFAULT 'normal'::text,
  "prazo_entrega" timestamp with time zone,
  "responsavel_id" uuid,
  "canal_origem" text DEFAULT 'site'::text,
  "endereco_entrega" text,
  "observacoes_internas" text,
  "aprovado_em" timestamp with time zone,
  "entregue_em" timestamp with time zone,
  "cancelado_em" timestamp with time zone,
  "updated_at" timestamp with time zone DEFAULT now(),
  "responsavel_nome" text,
  "whatsapp_owner_notified_at" timestamp with time zone,
  "whatsapp_client_created_notified_at" timestamp with time zone,
  "whatsapp_last_status_notified" text,
  "whatsapp_last_status_notified_at" timestamp with time zone,
  "visualizado_em" timestamp with time zone,
  "notificado_em" timestamp with time zone,
  "delivery_type" text,
  "delivery_fee" numeric(12,2) DEFAULT 0,
  "subtotal" numeric(12,2) DEFAULT 0,
  "total_amount" numeric(12,2) DEFAULT 0,
  "payment_method_id" uuid,
  "payment_status" text DEFAULT 'pending'::text,
  "delivery_zone_id" uuid,
  "address" text,
  "neighborhood" text,
  "complement" text,
  "reference_point" text,
  "change_for" numeric(12,2),
  "items_snapshot" jsonb DEFAULT '[]'::jsonb,
  "discount_amount" numeric(12,2) DEFAULT 0,
  "coupon_code" text,
  "payment_provider" text,
  "marketplace_payment_id" uuid,
  "paid_at" timestamp with time zone,
  "customer_name" text,
  "customer_email" text,
  "customer_phone" text,
  "total" numeric(14,2) DEFAULT 0,
  "payment_method" text,
  "coupon_id" uuid,
  "checkout_idempotency_key" text
);
ALTER TABLE "public"."orders" OWNER TO postgres;

CREATE TABLE "public"."payment_methods" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "company_id" uuid,
  "name" text NOT NULL,
  "type" text NOT NULL,
  "is_active" boolean DEFAULT true,
  "requires_change" boolean DEFAULT false,
  "allow_delivery_payment" boolean DEFAULT true,
  "allow_online_payment" boolean DEFAULT false,
  "instructions" text,
  "created_at" timestamp with time zone DEFAULT now(),
  "updated_at" timestamp with time zone DEFAULT now()
);
ALTER TABLE "public"."payment_methods" OWNER TO postgres;

CREATE TABLE "public"."payment_payouts" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "company_id" uuid NOT NULL,
  "marketplace_payment_id" uuid,
  "provider" text NOT NULL,
  "provider_payout_id" text,
  "amount" numeric(14,2) DEFAULT 0 NOT NULL,
  "status" text DEFAULT 'pending'::text NOT NULL,
  "expected_at" timestamp with time zone,
  "paid_at" timestamp with time zone,
  "failure_reason" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
ALTER TABLE "public"."payment_payouts" OWNER TO postgres;

CREATE TABLE "public"."payment_webhook_events" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "provider" text NOT NULL,
  "provider_event_id" text NOT NULL,
  "event_type" text NOT NULL,
  "provider_object_id" text,
  "company_id" uuid,
  "payload_hash" text NOT NULL,
  "payload_sanitized" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "processing_status" text DEFAULT 'received'::text NOT NULL,
  "attempts" integer DEFAULT 1 NOT NULL,
  "received_at" timestamp with time zone DEFAULT now() NOT NULL,
  "processed_at" timestamp with time zone,
  "error_message" text
);
ALTER TABLE "public"."payment_webhook_events" OWNER TO postgres;

CREATE TABLE "public"."plan_payments" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "company_id" uuid,
  "plano" text NOT NULL,
  "valor" numeric NOT NULL,
  "status" text DEFAULT 'pendente'::text,
  "email" text,
  "nome_empresa" text,
  "mercado_pago_preference_id" text,
  "mercado_pago_payment_id" text,
  "checkout_url" text,
  "raw_webhook" jsonb,
  "raw_payment" jsonb,
  "created_at" timestamp with time zone DEFAULT now(),
  "paid_at" timestamp with time zone,
  "tipo" text DEFAULT 'checkout'::text,
  "mercado_pago_preapproval_id" text,
  "mercado_pago_authorized_payment_id" text,
  "raw_subscription" jsonb,
  "raw_authorized_payment" jsonb,
  "next_payment_date" timestamp with time zone,
  "cancelled_at" timestamp with time zone,
  "updated_at" timestamp with time zone DEFAULT now(),
  "payment_method" text,
  "provider" text,
  "provider_customer_id" text,
  "provider_payment_id" text,
  "provider_subscription_id" text,
  "billing_type" text,
  "external_reference" text,
  "idempotency_key" text
);
ALTER TABLE "public"."plan_payments" OWNER TO postgres;

CREATE TABLE "public"."platform_admins" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid,
  "email" text NOT NULL,
  "role" text DEFAULT 'admin'::text NOT NULL,
  "is_active" boolean DEFAULT true,
  "created_at" timestamp with time zone DEFAULT now(),
  "updated_at" timestamp with time zone DEFAULT now()
);
ALTER TABLE "public"."platform_admins" OWNER TO postgres;

CREATE TABLE "public"."production_orders" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "company_id" uuid NOT NULL,
  "proposal_id" uuid,
  "order_id" uuid,
  "title" text NOT NULL,
  "customer_name" text,
  "customer_whatsapp" text,
  "total_value" numeric DEFAULT 0,
  "signal_value" numeric DEFAULT 0,
  "status" text DEFAULT 'aguardando_sinal'::text,
  "priority" text DEFAULT 'normal'::text,
  "due_date" timestamp with time zone,
  "started_at" timestamp with time zone,
  "completed_at" timestamp with time zone,
  "metadata" jsonb DEFAULT '{}'::jsonb,
  "created_at" timestamp with time zone DEFAULT now(),
  "updated_at" timestamp with time zone DEFAULT now(),
  "responsible_user_id" uuid,
  "responsible_name" text,
  "files" jsonb DEFAULT '[]'::jsonb,
  "internal_notes" text,
  "created_by" uuid
);
ALTER TABLE "public"."production_orders" OWNER TO postgres;

CREATE TABLE "public"."production_steps" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "production_order_id" uuid NOT NULL,
  "company_id" uuid NOT NULL,
  "title" text NOT NULL,
  "description" text,
  "status" text DEFAULT 'pendente'::text,
  "sort_order" integer DEFAULT 0,
  "assigned_to" uuid,
  "due_date" timestamp with time zone,
  "started_at" timestamp with time zone,
  "completed_at" timestamp with time zone,
  "completed_by" uuid,
  "metadata" jsonb DEFAULT '{}'::jsonb,
  "created_at" timestamp with time zone DEFAULT now(),
  "updated_at" timestamp with time zone DEFAULT now()
);
ALTER TABLE "public"."production_steps" OWNER TO postgres;

CREATE TABLE "public"."products" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "nome" text NOT NULL,
  "preco" numeric NOT NULL,
  "ativo" boolean DEFAULT true,
  "created_at" timestamp with time zone DEFAULT now(),
  "imagem_url" text,
  "company_id" uuid,
  "descricao" text,
  "categoria" text,
  "tipo" text DEFAULT 'produto'::text,
  "unidade" text DEFAULT 'unidade'::text,
  "destaque" boolean DEFAULT false,
  "precificacao" text DEFAULT 'unidade'::text,
  "unidade_label" text DEFAULT 'unidade'::text,
  "permite_largura" boolean DEFAULT false,
  "permite_altura" boolean DEFAULT false,
  "permite_comprimento" boolean DEFAULT false,
  "permite_quantidade" boolean DEFAULT true,
  "valor_minimo" numeric DEFAULT 0,
  "cobrar_sinal_personalizado" boolean DEFAULT false,
  "percentual_sinal_produto" numeric,
  "configuracoes" jsonb DEFAULT '{}'::jsonb,
  "image_urls" text[] DEFAULT '{}'::text[],
  "variacoes" text,
  "prazo_medio" text,
  "arquivado" boolean DEFAULT false,
  "deleted_at" timestamp with time zone,
  "updated_at" timestamp with time zone DEFAULT now(),
  "custo_material" numeric DEFAULT 0,
  "custo_mao_obra" numeric DEFAULT 0,
  "custo_taxas" numeric DEFAULT 0,
  "custo_entrega" numeric DEFAULT 0,
  "margem_desejada" numeric DEFAULT 30,
  "preco_minimo" numeric,
  "preco_sugerido" numeric,
  "margem_estimada" numeric,
  "archived" boolean DEFAULT false,
  "video_url" text,
  "subcategoria" text,
  "preco_sob_consulta" boolean DEFAULT false,
  "estoque" integer,
  "promocao_ativa" boolean DEFAULT false,
  "preco_promocional" numeric,
  "campos_orcamento" jsonb DEFAULT '[]'::jsonb,
  "descricao_curta" text,
  "descricao_detalhada" text,
  "unidade_preco" text DEFAULT 'unidade'::text,
  "sku" text,
  "oculto" boolean DEFAULT false,
  "adicionais" jsonb DEFAULT '[]'::jsonb,
  "foto_url" text,
  "business_type" text,
  "extras" jsonb DEFAULT '{}'::jsonb,
  "variations" jsonb DEFAULT '[]'::jsonb,
  "addons" jsonb DEFAULT '[]'::jsonb,
  "available" boolean DEFAULT true,
  "is_active" boolean DEFAULT true NOT NULL
);
ALTER TABLE "public"."products" OWNER TO postgres;

CREATE TABLE "public"."proposal_events" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "proposal_id" uuid,
  "company_id" uuid,
  "event_type" text NOT NULL,
  "actor_type" text DEFAULT 'system'::text,
  "actor_name" text,
  "actor_email" text,
  "note" text,
  "metadata" jsonb DEFAULT '{}'::jsonb,
  "ip" text,
  "user_agent" text,
  "created_at" timestamp with time zone DEFAULT now()
);
ALTER TABLE "public"."proposal_events" OWNER TO postgres;

CREATE TABLE "public"."proposals" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "company_id" uuid,
  "order_id" uuid,
  "token" text DEFAULT replace((gen_random_uuid())::text, '-'::text, ''::text) NOT NULL,
  "titulo" text,
  "cliente_nome" text,
  "cliente_whatsapp" text,
  "itens" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "valor_total" numeric DEFAULT 0,
  "valor_sinal" numeric DEFAULT 0,
  "prazo" text,
  "condicoes" text,
  "status" text DEFAULT 'enviado'::text,
  "payment_url" text,
  "raw_data" jsonb DEFAULT '{}'::jsonb,
  "created_at" timestamp with time zone DEFAULT now(),
  "approved_at" timestamp with time zone,
  "cliente_email" text,
  "valor_desconto" numeric DEFAULT 0,
  "percentual_sinal" numeric DEFAULT 0,
  "introducao" text,
  "validade_dias" integer DEFAULT 7,
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
  "accepted_terms" boolean DEFAULT false,
  "approval_hash" text,
  "proposta_numero" text,
  "version" integer DEFAULT 1,
  "updated_at" timestamp with time zone DEFAULT now(),
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
  "sinal_pago" boolean DEFAULT false,
  "view_count" integer DEFAULT 0,
  "last_viewed_at" timestamp with time zone,
  "origem" text
);
ALTER TABLE "public"."proposals" OWNER TO postgres;

CREATE TABLE "public"."provider_customers" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "company_id" uuid NOT NULL,
  "customer_id" text,
  "provider" text NOT NULL,
  "provider_customer_id" text NOT NULL,
  "document_hash" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
ALTER TABLE "public"."provider_customers" OWNER TO postgres;

CREATE TABLE "public"."quote_templates" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "company_id" uuid,
  "nome" text NOT NULL,
  "tipo" text NOT NULL,
  "perguntas" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "ativo" boolean DEFAULT true,
  "created_at" timestamp with time zone DEFAULT now(),
  "updated_at" timestamp with time zone DEFAULT now()
);
ALTER TABLE "public"."quote_templates" OWNER TO postgres;

CREATE TABLE "public"."recurring_orders" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "company_id" uuid NOT NULL,
  "original_order_id" uuid,
  "customer_name" text,
  "customer_phone" text,
  "title" text,
  "frequency" text,
  "next_due_at" timestamp with time zone,
  "last_repeated_at" timestamp with time zone,
  "status" text DEFAULT 'ativo'::text NOT NULL,
  "notes" text,
  "created_by" uuid,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
ALTER TABLE "public"."recurring_orders" OWNER TO postgres;

CREATE TABLE "public"."security_blocklist" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "type" text NOT NULL,
  "value" text NOT NULL,
  "reason" text,
  "active" boolean DEFAULT true NOT NULL,
  "created_by" text,
  "created_at" timestamp with time zone DEFAULT now()
);
ALTER TABLE "public"."security_blocklist" OWNER TO postgres;

CREATE TABLE "public"."security_events" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "company_id" uuid,
  "actor_user_id" uuid,
  "event_type" text DEFAULT 'security_event'::text NOT NULL,
  "metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "created_at" timestamp with time zone DEFAULT now(),
  "severity" text DEFAULT 'baixa'::text NOT NULL,
  "source" text DEFAULT 'site'::text NOT NULL,
  "path" text,
  "method" text,
  "ip" text,
  "user_agent" text,
  "user_email" text,
  "description" text,
  "resolved" boolean DEFAULT false NOT NULL,
  "resolved_at" timestamp with time zone,
  "resolved_by" text
);
ALTER TABLE "public"."security_events" OWNER TO postgres;

CREATE TABLE "public"."signup_lead_followups" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "lead_id" uuid NOT NULL,
  "channel" text DEFAULT 'whatsapp'::text NOT NULL,
  "status" text DEFAULT 'pendente'::text NOT NULL,
  "message" text,
  "scheduled_for" timestamp with time zone DEFAULT now(),
  "sent_at" timestamp with time zone,
  "admin_email" text,
  "raw_data" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "created_at" timestamp with time zone DEFAULT now()
);
ALTER TABLE "public"."signup_lead_followups" OWNER TO postgres;

CREATE TABLE "public"."signup_leads" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "nome_responsavel" text,
  "email" text NOT NULL,
  "whatsapp" text,
  "empresa_nome" text NOT NULL,
  "slug_sugerido" text,
  "segmento" text,
  "modelo_negocio" text,
  "cidade" text,
  "estado" text,
  "plano" text DEFAULT 'profissional'::text NOT NULL,
  "status" text DEFAULT 'lead'::text NOT NULL,
  "marketing_opt_in" boolean DEFAULT false NOT NULL,
  "marketing_opt_in_text" text,
  "lead_source" text DEFAULT 'cadastro'::text NOT NULL,
  "checkout_url" text,
  "mercado_pago_preference_id" text,
  "mercado_pago_payment_id" text,
  "payment_status" text,
  "paid_at" timestamp with time zone,
  "followup_count" integer DEFAULT 0 NOT NULL,
  "last_followup_at" timestamp with time zone,
  "next_followup_at" timestamp with time zone DEFAULT (now() + '2 days'::interval),
  "converted_user_id" uuid,
  "converted_company_id" uuid,
  "raw_data" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "created_at" timestamp with time zone DEFAULT now(),
  "updated_at" timestamp with time zone DEFAULT now()
);
ALTER TABLE "public"."signup_leads" OWNER TO postgres;

CREATE TABLE "public"."site_sections" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "company_id" uuid NOT NULL,
  "type" text DEFAULT 'custom'::text NOT NULL,
  "title" text,
  "subtitle" text,
  "content" text,
  "image_url" text,
  "button_label" text,
  "button_url" text,
  "sort_order" integer DEFAULT 0 NOT NULL,
  "active" boolean DEFAULT true NOT NULL,
  "locked" boolean DEFAULT false NOT NULL,
  "config" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "created_at" timestamp with time zone DEFAULT now(),
  "updated_at" timestamp with time zone DEFAULT now()
);
ALTER TABLE "public"."site_sections" OWNER TO postgres;

CREATE TABLE "public"."site_template_presets" (
  "id" text NOT NULL,
  "name" text NOT NULL,
  "segment" text NOT NULL,
  "description" text,
  "payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "is_active" boolean DEFAULT true NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
ALTER TABLE "public"."site_template_presets" OWNER TO postgres;

CREATE TABLE "public"."smart_notification_events" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "company_id" uuid NOT NULL,
  "event_key" text NOT NULL,
  "event_type" text NOT NULL,
  "entity" text,
  "entity_id" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "resolved_at" timestamp with time zone
);
ALTER TABLE "public"."smart_notification_events" OWNER TO postgres;

CREATE TABLE "public"."smart_notification_settings" (
  "company_id" uuid NOT NULL,
  "new_order_enabled" boolean DEFAULT true NOT NULL,
  "order_stuck_enabled" boolean DEFAULT true NOT NULL,
  "order_stuck_days" integer DEFAULT 3 NOT NULL,
  "task_due_today_enabled" boolean DEFAULT true NOT NULL,
  "lead_idle_enabled" boolean DEFAULT true NOT NULL,
  "lead_idle_days" integer DEFAULT 3 NOT NULL,
  "proposal_idle_enabled" boolean DEFAULT true NOT NULL,
  "proposal_idle_days" integer DEFAULT 3 NOT NULL,
  "coupon_expiring_enabled" boolean DEFAULT true NOT NULL,
  "coupon_expiring_days" integer DEFAULT 3 NOT NULL,
  "product_without_image_enabled" boolean DEFAULT true NOT NULL,
  "site_without_logo_enabled" boolean DEFAULT true NOT NULL,
  "subscription_expiring_enabled" boolean DEFAULT true NOT NULL,
  "subscription_expiring_days" integer DEFAULT 7 NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
ALTER TABLE "public"."smart_notification_settings" OWNER TO postgres;

CREATE TABLE "public"."subscription_events" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "company_id" uuid NOT NULL,
  "event_type" text NOT NULL,
  "old_status" text,
  "new_status" text,
  "provider" text DEFAULT 'mercado_pago'::text NOT NULL,
  "provider_reference" text,
  "metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "provider_event_id" text,
  "provider_object_id" text,
  "payload_hash" text,
  "processing_status" text,
  "processed_at" timestamp with time zone,
  "error_message" text
);
ALTER TABLE "public"."subscription_events" OWNER TO postgres;

CREATE TABLE "public"."system_audit_logs" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "company_id" uuid,
  "user_id" uuid,
  "action" text NOT NULL,
  "entity" text,
  "entity_id" text,
  "details" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "ip" text,
  "user_agent" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
ALTER TABLE "public"."system_audit_logs" OWNER TO postgres;

CREATE TABLE "public"."whatsapp_conversations" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "company_id" uuid,
  "phone" text NOT NULL,
  "customer_name" text,
  "last_inbound_at" timestamp with time zone,
  "last_outbound_at" timestamp with time zone,
  "last_message" text,
  "ai_enabled" boolean DEFAULT true NOT NULL,
  "metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
ALTER TABLE "public"."whatsapp_conversations" OWNER TO postgres;

CREATE TABLE "public"."whatsapp_message_logs" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "company_id" uuid,
  "order_id" uuid,
  "proposal_id" uuid,
  "direction" text DEFAULT 'outbound'::text NOT NULL,
  "event_type" text,
  "to_phone" text,
  "from_phone" text,
  "message_type" text DEFAULT 'text'::text NOT NULL,
  "content" text,
  "status" text DEFAULT 'pending'::text NOT NULL,
  "meta_message_id" text,
  "raw_payload" jsonb,
  "raw_response" jsonb,
  "error" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
ALTER TABLE "public"."whatsapp_message_logs" OWNER TO postgres;

-- DERIVATION EVIDENCE ONLY: selected fragment, not a complete frontier.
-- Not discovered by Supabase migrations; do not execute this file independently.
-- R10 ENGINEERED PREIMAGE / STRUCTURAL / FAIL-CLOSED / NOT HISTORICAL.
-- SUPERSEDED BY LEDGER 20260728182610 on the SAME function OID.
-- Source comment only: no persistent COMMENT ON FUNCTION may survive replay.
CREATE FUNCTION public.can_manage_company(p_company_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY INVOKER
CALLED ON NULL INPUT
SET search_path = ''
AS $r10_preimage$
  SELECT FALSE;
$r10_preimage$;

ALTER FUNCTION public.can_manage_company(uuid) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.can_manage_company(uuid)
  FROM PUBLIC, anon, authenticated, service_role;
-- No GRANT. No private duplicate. Future policies bind to this public identity.


CREATE OR REPLACE FUNCTION public.check_company_member_limit()
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
$function$
;
ALTER FUNCTION public.check_company_member_limit() OWNER TO postgres;
REVOKE ALL ON FUNCTION public.check_company_member_limit() FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.create_default_site_for_company(p_company_id uuid)
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
$function$
;
ALTER FUNCTION public.create_default_site_for_company(p_company_id uuid) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.create_default_site_for_company(p_company_id uuid) FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.is_company_member(p_company_id uuid)
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
$function$
;
ALTER FUNCTION public.is_company_member(p_company_id uuid) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.is_company_member(p_company_id uuid) FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.is_company_owner(p_company_id uuid)
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
$function$
;
ALTER FUNCTION public.is_company_owner(p_company_id uuid) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.is_company_owner(p_company_id uuid) FROM PUBLIC, anon, authenticated, service_role;

-- DERIVATION EVIDENCE ONLY: selected fragment, not independently executable.
-- R10 ENGINEERED PREIMAGE / STRUCTURAL / FAIL-CLOSED / NOT HISTORICAL.
-- BODY SUPERSEDED BY LEDGER 20260811231921 on the SAME function OID.
-- Source comment only; no persistent catalog COMMENT survives the replacement.
CREATE FUNCTION public.is_orcaly_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = ''
AS $r10_admin_preimage$
  SELECT FALSE;
$r10_admin_preimage$;

ALTER FUNCTION public.is_orcaly_admin() OWNER TO postgres;
REVOKE ALL ON FUNCTION public.is_orcaly_admin()
  FROM PUBLIC, anon, authenticated, service_role;
-- No GRANT. No private duplicate. #7 moves this OID; #26 replaces its body.


CREATE OR REPLACE FUNCTION public.my_company_role(p_company_id uuid)
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
$function$
;
ALTER FUNCTION public.my_company_role(p_company_id uuid) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.my_company_role(p_company_id uuid) FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.orcaly_user_has_company_access(target_company uuid)
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
$function$
;
ALTER FUNCTION public.orcaly_user_has_company_access(target_company uuid) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.orcaly_user_has_company_access(target_company uuid) FROM PUBLIC, anon, authenticated, service_role;

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
$function$
;
ALTER FUNCTION public.claim_company_subscription_trial(p_company_id uuid) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.claim_company_subscription_trial(p_company_id uuid) FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.company_member_touch()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
begin
  new.updated_at = now();
  return new;
end;
$function$
;
ALTER FUNCTION public.company_member_touch() OWNER TO postgres;
REVOKE ALL ON FUNCTION public.company_member_touch() FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.finance_touch_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
begin
  new.updated_at = now();
  return new;
end;
$function$
;
ALTER FUNCTION public.finance_touch_updated_at() OWNER TO postgres;
REVOKE ALL ON FUNCTION public.finance_touch_updated_at() FROM PUBLIC, anon, authenticated, service_role;

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
$function$
;
ALTER FUNCTION public.limit_company_members() OWNER TO postgres;
REVOKE ALL ON FUNCTION public.limit_company_members() FROM PUBLIC, anon, authenticated, service_role;

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
$function$
;
ALTER FUNCTION public.protect_company_trial_used_at() OWNER TO postgres;
REVOKE ALL ON FUNCTION public.protect_company_trial_used_at() FROM PUBLIC, anon, authenticated, service_role;

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
$function$
;
ALTER FUNCTION public.set_company_subdomain_slug() OWNER TO postgres;
REVOKE ALL ON FUNCTION public.set_company_subdomain_slug() FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.set_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
begin
  new.updated_at = now();
  return new;
end;
$function$
;
ALTER FUNCTION public.set_updated_at() OWNER TO postgres;
REVOKE ALL ON FUNCTION public.set_updated_at() FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.touch_signup_lead_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
begin
  new.updated_at = now();
  return new;
end;
$function$
;
ALTER FUNCTION public.touch_signup_lead_updated_at() OWNER TO postgres;
REVOKE ALL ON FUNCTION public.touch_signup_lead_updated_at() FROM PUBLIC, anon, authenticated, service_role;

ALTER TABLE public.admin_audit_logs ADD CONSTRAINT "admin_audit_logs_pkey" PRIMARY KEY (id);

ALTER TABLE public.admin_bug_reports ADD CONSTRAINT "admin_bug_reports_fingerprint_key" UNIQUE (fingerprint);

ALTER TABLE public.admin_bug_reports ADD CONSTRAINT "admin_bug_reports_pkey" PRIMARY KEY (id);

ALTER TABLE public.admin_bug_reports ADD CONSTRAINT "admin_bug_reports_severity_check" CHECK ((severity = ANY (ARRAY['verde'::text, 'amarelo'::text, 'vermelho'::text])));

ALTER TABLE public.admin_bug_reports ADD CONSTRAINT "admin_bug_severity_check" CHECK ((severity = ANY (ARRAY['baixa'::text, 'media'::text, 'alta'::text, 'critica'::text])));

ALTER TABLE public.admin_bug_reports ADD CONSTRAINT "admin_bug_status_check" CHECK ((status = ANY (ARRAY['aberto'::text, 'em_analise'::text, 'resolvido'::text, 'ignorado'::text])));

ALTER TABLE public.admin_scan_runs ADD CONSTRAINT "admin_scan_runs_pkey" PRIMARY KEY (id);

ALTER TABLE public.admin_scan_runs ADD CONSTRAINT "admin_scan_status_check" CHECK ((status = ANY (ARRAY['rodando'::text, 'concluido'::text, 'falhou'::text])));

ALTER TABLE public.admin_system_snapshots ADD CONSTRAINT "admin_system_snapshots_pkey" PRIMARY KEY (id);

ALTER TABLE public.admin_users ADD CONSTRAINT "admin_users_email_key" UNIQUE (email);

ALTER TABLE public.admin_users ADD CONSTRAINT "admin_users_pkey" PRIMARY KEY (id);

ALTER TABLE public.admin_users ADD CONSTRAINT "admin_users_role_check" CHECK ((role = ANY (ARRAY['super_admin'::text, 'admin'::text, 'suporte'::text])));

ALTER TABLE public.app_notifications ADD CONSTRAINT "app_notifications_pkey" PRIMARY KEY (id);

ALTER TABLE public.art_approval_requests ADD CONSTRAINT "art_approval_requests_company_id_fkey" FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE;

ALTER TABLE public.art_approval_requests ADD CONSTRAINT "art_approval_requests_order_id_fkey" FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE SET NULL;

ALTER TABLE public.art_approval_requests ADD CONSTRAINT "art_approval_requests_pkey" PRIMARY KEY (id);

ALTER TABLE public.art_approval_requests ADD CONSTRAINT "art_approval_requests_proposal_id_fkey" FOREIGN KEY (proposal_id) REFERENCES proposals(id) ON DELETE SET NULL;

ALTER TABLE public.art_approval_requests ADD CONSTRAINT "art_approval_requests_token_key" UNIQUE (token);

ALTER TABLE public.business_hours ADD CONSTRAINT "business_hours_company_id_fkey" FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE;

ALTER TABLE public.business_hours ADD CONSTRAINT "business_hours_company_weekday_unique" UNIQUE (company_id, weekday);

ALTER TABLE public.business_hours ADD CONSTRAINT "business_hours_pkey" PRIMARY KEY (id);

ALTER TABLE public.companies ADD CONSTRAINT "companies_nome_security_check" CHECK ((((length(TRIM(BOTH FROM nome)) >= 2) AND (length(TRIM(BOTH FROM nome)) <= 80)) AND (lower(TRIM(BOTH FROM nome)) <> ALL (ARRAY['admin'::text, 'administrador'::text, 'orcaly'::text, 'orçaly'::text, 'root'::text, 'system'::text, 'sistema'::text])) AND (lower(TRIM(BOTH FROM nome)) !~~ '%orcaly%'::text) AND (lower(TRIM(BOTH FROM nome)) !~~ '%orçaly%'::text)));

ALTER TABLE public.companies ADD CONSTRAINT "companies_pkey" PRIMARY KEY (id);

ALTER TABLE public.companies ADD CONSTRAINT "companies_slug_key" UNIQUE (slug);

ALTER TABLE public.companies ADD CONSTRAINT "companies_slug_security_check" CHECK (((slug ~ '^[a-z0-9][a-z0-9-]{1,40}[a-z0-9]$'::text) AND (slug !~~ '%--%'::text) AND (lower(slug) <> ALL (ARRAY['admin'::text, 'administrador'::text, 'orcaly'::text, 'suporte'::text, 'support'::text, 'api'::text, 'painel'::text, 'dashboard'::text, 'login'::text, 'cadastro'::text, 'checkout'::text, 'assinatura'::text, 'proposta'::text, 'propostas'::text, 'root'::text, 'system'::text, 'sistema'::text, 'mercado-pago'::text, 'mercadopago'::text, 'www'::text, 'app'::text, 'assets'::text, 'static'::text, 'public'::text, 'private'::text, 'config'::text, 'settings'::text, 'security'::text, 'auth'::text, 'null'::text, 'undefined'::text]))));

ALTER TABLE public.companies ADD CONSTRAINT "companies_subdomain_slug_security_check" CHECK (((subdomain_slug IS NULL) OR (((length(subdomain_slug) >= 3) AND (length(subdomain_slug) <= 42)) AND (subdomain_slug ~ '^[a-z0-9]+$'::text) AND (lower(subdomain_slug) <> ALL (ARRAY['admin'::text, 'administrador'::text, 'orcaly'::text, 'suporte'::text, 'support'::text, 'api'::text, 'painel'::text, 'dashboard'::text, 'login'::text, 'cadastro'::text, 'checkout'::text, 'assinatura'::text, 'proposta'::text, 'propostas'::text, 'root'::text, 'system'::text, 'sistema'::text, 'mercadopago'::text, 'www'::text, 'app'::text, 'assets'::text, 'static'::text, 'public'::text, 'private'::text, 'config'::text, 'settings'::text, 'security'::text, 'auth'::text, 'null'::text, 'undefined'::text])))));

ALTER TABLE public.companies ADD CONSTRAINT "companies_tester_id_fkey" FOREIGN KEY (tester_id) REFERENCES auth.users(id);

ALTER TABLE public.company_members ADD CONSTRAINT "company_members_cargo_check" CHECK ((cargo = ANY (ARRAY['gerente'::text, 'atendente'::text, 'producao'::text])));

ALTER TABLE public.company_members ADD CONSTRAINT "company_members_company_id_fkey" FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE;

ALTER TABLE public.company_members ADD CONSTRAINT "company_members_created_by_fkey" FOREIGN KEY (created_by) REFERENCES auth.users(id);

ALTER TABLE public.company_members ADD CONSTRAINT "company_members_pkey" PRIMARY KEY (id);

ALTER TABLE public.company_members ADD CONSTRAINT "company_members_status_check" CHECK ((status = ANY (ARRAY['ativo'::text, 'bloqueado'::text, 'removido'::text])));

ALTER TABLE public.company_members ADD CONSTRAINT "company_members_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE public.company_niche_templates ADD CONSTRAINT "company_niche_templates_company_id_fkey" FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE;

ALTER TABLE public.company_niche_templates ADD CONSTRAINT "company_niche_templates_company_id_key" UNIQUE (company_id);

ALTER TABLE public.company_niche_templates ADD CONSTRAINT "company_niche_templates_pkey" PRIMARY KEY (id);

ALTER TABLE public.company_proposal_settings ADD CONSTRAINT "company_proposal_settings_company_id_fkey" FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE;

ALTER TABLE public.company_proposal_settings ADD CONSTRAINT "company_proposal_settings_company_id_key" UNIQUE (company_id);

ALTER TABLE public.company_proposal_settings ADD CONSTRAINT "company_proposal_settings_pkey" PRIMARY KEY (id);

ALTER TABLE public.company_whatsapp_settings ADD CONSTRAINT "company_whatsapp_settings_company_id_fkey" FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE;

ALTER TABLE public.company_whatsapp_settings ADD CONSTRAINT "company_whatsapp_settings_pkey" PRIMARY KEY (company_id);

ALTER TABLE public.crm_leads ADD CONSTRAINT "crm_leads_pkey" PRIMARY KEY (id);

ALTER TABLE public.customer_followups ADD CONSTRAINT "customer_followups_company_id_fkey" FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE;

ALTER TABLE public.customer_followups ADD CONSTRAINT "customer_followups_created_by_fkey" FOREIGN KEY (created_by) REFERENCES auth.users(id);

ALTER TABLE public.customer_followups ADD CONSTRAINT "customer_followups_pkey" PRIMARY KEY (id);

ALTER TABLE public.customer_followups ADD CONSTRAINT "customer_followups_prioridade_check" CHECK ((prioridade = ANY (ARRAY['baixa'::text, 'media'::text, 'alta'::text])));

ALTER TABLE public.customer_followups ADD CONSTRAINT "customer_followups_status_check" CHECK ((status = ANY (ARRAY['pendente'::text, 'concluido'::text, 'cancelado'::text])));

ALTER TABLE public.customer_internal_notes ADD CONSTRAINT "customer_internal_notes_company_id_fkey" FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE;

ALTER TABLE public.customer_internal_notes ADD CONSTRAINT "customer_internal_notes_pkey" PRIMARY KEY (id);

ALTER TABLE public.customer_magic_links ADD CONSTRAINT "customer_magic_links_company_id_fkey" FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE;

ALTER TABLE public.customer_magic_links ADD CONSTRAINT "customer_magic_links_pkey" PRIMARY KEY (id);

ALTER TABLE public.customer_magic_links ADD CONSTRAINT "customer_magic_links_token_key" UNIQUE (token);

ALTER TABLE public.customer_notes ADD CONSTRAINT "customer_notes_company_id_fkey" FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE;

ALTER TABLE public.customer_notes ADD CONSTRAINT "customer_notes_created_by_fkey" FOREIGN KEY (created_by) REFERENCES auth.users(id);

ALTER TABLE public.customer_notes ADD CONSTRAINT "customer_notes_pkey" PRIMARY KEY (id);

ALTER TABLE public.customer_notes ADD CONSTRAINT "customer_notes_tipo_check" CHECK ((tipo = ANY (ARRAY['nota'::text, 'whatsapp'::text, 'ligacao'::text, 'feedback'::text, 'financeiro'::text, 'proposta'::text])));

ALTER TABLE public.customer_portal_events ADD CONSTRAINT "customer_portal_events_company_id_fkey" FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE;

ALTER TABLE public.customer_portal_events ADD CONSTRAINT "customer_portal_events_customer_magic_link_id_fkey" FOREIGN KEY (customer_magic_link_id) REFERENCES customer_magic_links(id) ON DELETE CASCADE;

ALTER TABLE public.customer_portal_events ADD CONSTRAINT "customer_portal_events_pkey" PRIMARY KEY (id);

ALTER TABLE public.deliveries ADD CONSTRAINT "deliveries_company_id_fkey" FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE;

ALTER TABLE public.deliveries ADD CONSTRAINT "deliveries_delivery_zone_id_fkey" FOREIGN KEY (delivery_zone_id) REFERENCES delivery_zones(id) ON DELETE SET NULL;

ALTER TABLE public.deliveries ADD CONSTRAINT "deliveries_order_id_fkey" FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE SET NULL;

ALTER TABLE public.deliveries ADD CONSTRAINT "deliveries_payment_method_id_fkey" FOREIGN KEY (payment_method_id) REFERENCES payment_methods(id) ON DELETE SET NULL;

ALTER TABLE public.deliveries ADD CONSTRAINT "deliveries_pkey" PRIMARY KEY (id);

ALTER TABLE public.delivery_zones ADD CONSTRAINT "delivery_zones_company_id_fkey" FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE;

ALTER TABLE public.delivery_zones ADD CONSTRAINT "delivery_zones_pkey" PRIMARY KEY (id);

ALTER TABLE public.finance_accounts ADD CONSTRAINT "finance_accounts_company_id_fkey" FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE;

ALTER TABLE public.finance_accounts ADD CONSTRAINT "finance_accounts_pkey" PRIMARY KEY (id);

ALTER TABLE public.finance_accounts ADD CONSTRAINT "finance_accounts_tipo_check" CHECK ((tipo = ANY (ARRAY['caixa'::text, 'banco'::text, 'cartao'::text, 'digital'::text, 'outro'::text])));

ALTER TABLE public.financial_categories ADD CONSTRAINT "financial_categories_company_id_fkey" FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE;

ALTER TABLE public.financial_categories ADD CONSTRAINT "financial_categories_pkey" PRIMARY KEY (id);

ALTER TABLE public.financial_material_entries ADD CONSTRAINT "financial_material_entries_company_id_fkey" FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE;

ALTER TABLE public.financial_material_entries ADD CONSTRAINT "financial_material_entries_pkey" PRIMARY KEY (id);

ALTER TABLE public.financial_material_entries ADD CONSTRAINT "financial_material_entries_transaction_id_fkey" FOREIGN KEY (transaction_id) REFERENCES financial_transactions(id) ON DELETE CASCADE;

ALTER TABLE public.financial_transactions ADD CONSTRAINT "financial_transactions_account_id_fkey" FOREIGN KEY (account_id) REFERENCES finance_accounts(id) ON DELETE SET NULL;

ALTER TABLE public.financial_transactions ADD CONSTRAINT "financial_transactions_category_id_fkey" FOREIGN KEY (category_id) REFERENCES financial_categories(id) ON DELETE SET NULL;

ALTER TABLE public.financial_transactions ADD CONSTRAINT "financial_transactions_company_id_fkey" FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE;

ALTER TABLE public.financial_transactions ADD CONSTRAINT "financial_transactions_created_by_fkey" FOREIGN KEY (created_by) REFERENCES auth.users(id);

ALTER TABLE public.financial_transactions ADD CONSTRAINT "financial_transactions_pkey" PRIMARY KEY (id);

ALTER TABLE public.financial_transactions ADD CONSTRAINT "financial_transactions_status_check" CHECK ((status = ANY (ARRAY['pago'::text, 'pendente'::text, 'cancelado'::text])));

ALTER TABLE public.financial_transactions ADD CONSTRAINT "financial_transactions_tipo_check" CHECK ((tipo = ANY (ARRAY['entrada'::text, 'saida'::text])));

ALTER TABLE public.internal_tasks ADD CONSTRAINT "internal_tasks_pkey" PRIMARY KEY (id);

ALTER TABLE public.marketplace_commission_rules ADD CONSTRAINT "marketplace_commission_rules_company_id_fkey" FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE;

ALTER TABLE public.marketplace_commission_rules ADD CONSTRAINT "marketplace_commission_rules_pkey" PRIMARY KEY (id);

ALTER TABLE public.marketplace_commissions ADD CONSTRAINT "marketplace_commissions_company_id_fkey" FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE;

ALTER TABLE public.marketplace_commissions ADD CONSTRAINT "marketplace_commissions_marketplace_payment_id_fkey" FOREIGN KEY (marketplace_payment_id) REFERENCES marketplace_payments(id) ON DELETE SET NULL;

ALTER TABLE public.marketplace_commissions ADD CONSTRAINT "marketplace_commissions_order_id_fkey" FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE SET NULL;

ALTER TABLE public.marketplace_commissions ADD CONSTRAINT "marketplace_commissions_pkey" PRIMARY KEY (id);

ALTER TABLE public.marketplace_coupons ADD CONSTRAINT "marketplace_coupons_pkey" PRIMARY KEY (id);

ALTER TABLE public.marketplace_coupons ADD CONSTRAINT "marketplace_coupons_tipo_check" CHECK ((tipo = ANY (ARRAY['percentual'::text, 'fixo'::text])));

ALTER TABLE public.marketplace_oauth_states ADD CONSTRAINT "marketplace_oauth_states_company_id_fkey" FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE;

ALTER TABLE public.marketplace_oauth_states ADD CONSTRAINT "marketplace_oauth_states_pkey" PRIMARY KEY (id);

ALTER TABLE public.marketplace_oauth_states ADD CONSTRAINT "marketplace_oauth_states_state_hash_key" UNIQUE (state_hash);

ALTER TABLE public.marketplace_oauth_states ADD CONSTRAINT "marketplace_oauth_states_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE public.marketplace_payment_settings ADD CONSTRAINT "marketplace_payment_settings_company_id_fkey" FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE;

ALTER TABLE public.marketplace_payment_settings ADD CONSTRAINT "marketplace_payment_settings_company_id_provider_key" UNIQUE (company_id, provider);

ALTER TABLE public.marketplace_payment_settings ADD CONSTRAINT "marketplace_payment_settings_pkey" PRIMARY KEY (id);

ALTER TABLE public.marketplace_payments ADD CONSTRAINT "marketplace_payments_company_id_fkey" FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE;

ALTER TABLE public.marketplace_payments ADD CONSTRAINT "marketplace_payments_order_id_fkey" FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE SET NULL;

ALTER TABLE public.marketplace_payments ADD CONSTRAINT "marketplace_payments_pkey" PRIMARY KEY (id);

ALTER TABLE public.notifications ADD CONSTRAINT "notifications_company_id_fkey" FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE;

ALTER TABLE public.notifications ADD CONSTRAINT "notifications_pkey" PRIMARY KEY (id);

ALTER TABLE public.notifications ADD CONSTRAINT "notifications_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE public.order_internal_comments ADD CONSTRAINT "order_internal_comments_pkey" PRIMARY KEY (id);

ALTER TABLE public.order_items ADD CONSTRAINT "order_items_company_id_fkey" FOREIGN KEY (company_id) REFERENCES companies(id);

ALTER TABLE public.order_items ADD CONSTRAINT "order_items_order_id_fkey" FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE;

ALTER TABLE public.order_items ADD CONSTRAINT "order_items_pkey" PRIMARY KEY (id);

ALTER TABLE public.order_items ADD CONSTRAINT "order_items_product_id_fkey" FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE SET NULL;

ALTER TABLE public.order_payments ADD CONSTRAINT "order_payments_company_id_fkey" FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE;

ALTER TABLE public.order_payments ADD CONSTRAINT "order_payments_order_id_fkey" FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE;

ALTER TABLE public.order_payments ADD CONSTRAINT "order_payments_payment_method_id_fkey" FOREIGN KEY (payment_method_id) REFERENCES payment_methods(id) ON DELETE SET NULL;

ALTER TABLE public.order_payments ADD CONSTRAINT "order_payments_pkey" PRIMARY KEY (id);

ALTER TABLE public.order_status_history ADD CONSTRAINT "order_status_history_pkey" PRIMARY KEY (id);

ALTER TABLE public.orders ADD CONSTRAINT "orders_company_id_fkey" FOREIGN KEY (company_id) REFERENCES companies(id);

ALTER TABLE public.orders ADD CONSTRAINT "orders_delivery_zone_id_fkey" FOREIGN KEY (delivery_zone_id) REFERENCES delivery_zones(id) ON DELETE SET NULL;

ALTER TABLE public.orders ADD CONSTRAINT "orders_marketplace_payment_id_fkey" FOREIGN KEY (marketplace_payment_id) REFERENCES marketplace_payments(id) ON DELETE SET NULL;

ALTER TABLE public.orders ADD CONSTRAINT "orders_original_order_id_fkey" FOREIGN KEY (original_order_id) REFERENCES orders(id) ON DELETE SET NULL;

ALTER TABLE public.orders ADD CONSTRAINT "orders_payment_method_id_fkey" FOREIGN KEY (payment_method_id) REFERENCES payment_methods(id) ON DELETE SET NULL;

ALTER TABLE public.orders ADD CONSTRAINT "orders_pkey" PRIMARY KEY (id);

ALTER TABLE public.payment_methods ADD CONSTRAINT "payment_methods_company_id_fkey" FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE;

ALTER TABLE public.payment_methods ADD CONSTRAINT "payment_methods_pkey" PRIMARY KEY (id);

ALTER TABLE public.payment_payouts ADD CONSTRAINT "payment_payouts_pkey" PRIMARY KEY (id);

ALTER TABLE public.payment_webhook_events ADD CONSTRAINT "payment_webhook_events_pkey" PRIMARY KEY (id);

ALTER TABLE public.payment_webhook_events ADD CONSTRAINT "payment_webhook_events_provider_provider_event_id_key" UNIQUE (provider, provider_event_id);

ALTER TABLE public.plan_payments ADD CONSTRAINT "plan_payments_company_id_fkey" FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE SET NULL;

ALTER TABLE public.plan_payments ADD CONSTRAINT "plan_payments_pkey" PRIMARY KEY (id);

ALTER TABLE public.platform_admins ADD CONSTRAINT "platform_admins_email_key" UNIQUE (email);

ALTER TABLE public.platform_admins ADD CONSTRAINT "platform_admins_pkey" PRIMARY KEY (id);

ALTER TABLE public.platform_admins ADD CONSTRAINT "platform_admins_role_check_v3" CHECK ((lower(role) = ANY (ARRAY['owner'::text, 'super_admin'::text, 'admin'::text, 'platform_admin'::text, 'finance'::text, 'support'::text, 'suporte'::text, 'security'::text, 'seguranca'::text, 'operations'::text, 'operacoes'::text, 'viewer'::text, 'visualizador'::text, 'prospector'::text])));

ALTER TABLE public.platform_admins ADD CONSTRAINT "platform_admins_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE public.production_orders ADD CONSTRAINT "production_orders_company_id_fkey" FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE;

ALTER TABLE public.production_orders ADD CONSTRAINT "production_orders_order_id_fkey" FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE SET NULL;

ALTER TABLE public.production_orders ADD CONSTRAINT "production_orders_pkey" PRIMARY KEY (id);

ALTER TABLE public.production_orders ADD CONSTRAINT "production_orders_proposal_id_fkey" FOREIGN KEY (proposal_id) REFERENCES proposals(id) ON DELETE SET NULL;

ALTER TABLE public.production_orders ADD CONSTRAINT "production_orders_status_check" CHECK ((status = ANY (ARRAY['aguardando_sinal'::text, 'aprovado'::text, 'em_producao'::text, 'pronto'::text, 'entregue'::text, 'cancelado'::text])));

ALTER TABLE public.production_steps ADD CONSTRAINT "production_steps_assigned_to_fkey" FOREIGN KEY (assigned_to) REFERENCES auth.users(id);

ALTER TABLE public.production_steps ADD CONSTRAINT "production_steps_company_id_fkey" FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE;

ALTER TABLE public.production_steps ADD CONSTRAINT "production_steps_completed_by_fkey" FOREIGN KEY (completed_by) REFERENCES auth.users(id);

ALTER TABLE public.production_steps ADD CONSTRAINT "production_steps_pkey" PRIMARY KEY (id);

ALTER TABLE public.production_steps ADD CONSTRAINT "production_steps_production_order_id_fkey" FOREIGN KEY (production_order_id) REFERENCES production_orders(id) ON DELETE CASCADE;

ALTER TABLE public.production_steps ADD CONSTRAINT "production_steps_status_check" CHECK ((status = ANY (ARRAY['pendente'::text, 'em_andamento'::text, 'concluido'::text, 'pulada'::text])));

ALTER TABLE public.products ADD CONSTRAINT "products_company_id_fkey" FOREIGN KEY (company_id) REFERENCES companies(id);

ALTER TABLE public.products ADD CONSTRAINT "products_pkey" PRIMARY KEY (id);

ALTER TABLE public.proposal_events ADD CONSTRAINT "proposal_events_company_id_fkey" FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE;

ALTER TABLE public.proposal_events ADD CONSTRAINT "proposal_events_pkey" PRIMARY KEY (id);

ALTER TABLE public.proposal_events ADD CONSTRAINT "proposal_events_proposal_id_fkey" FOREIGN KEY (proposal_id) REFERENCES proposals(id) ON DELETE CASCADE;

ALTER TABLE public.proposals ADD CONSTRAINT "proposals_company_id_fkey" FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE;

ALTER TABLE public.proposals ADD CONSTRAINT "proposals_order_id_fkey" FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE SET NULL;

ALTER TABLE public.proposals ADD CONSTRAINT "proposals_pkey" PRIMARY KEY (id);

ALTER TABLE public.proposals ADD CONSTRAINT "proposals_status_check" CHECK ((status = ANY (ARRAY['rascunho'::text, 'enviado'::text, 'visto'::text, 'aprovado'::text, 'alteracao_solicitada'::text, 'recusado'::text, 'expirado'::text, 'cancelado'::text, 'pago_sinal'::text, 'convertido'::text])));

ALTER TABLE public.proposals ADD CONSTRAINT "proposals_token_key" UNIQUE (token);

ALTER TABLE public.provider_customers ADD CONSTRAINT "provider_customers_company_id_provider_customer_id_key" UNIQUE (company_id, provider, customer_id);

ALTER TABLE public.provider_customers ADD CONSTRAINT "provider_customers_pkey" PRIMARY KEY (id);

ALTER TABLE public.quote_templates ADD CONSTRAINT "quote_templates_company_id_fkey" FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE;

ALTER TABLE public.quote_templates ADD CONSTRAINT "quote_templates_pkey" PRIMARY KEY (id);

ALTER TABLE public.recurring_orders ADD CONSTRAINT "recurring_orders_company_id_fkey" FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE;

ALTER TABLE public.recurring_orders ADD CONSTRAINT "recurring_orders_original_order_id_fkey" FOREIGN KEY (original_order_id) REFERENCES orders(id) ON DELETE SET NULL;

ALTER TABLE public.recurring_orders ADD CONSTRAINT "recurring_orders_pkey" PRIMARY KEY (id);

ALTER TABLE public.security_blocklist ADD CONSTRAINT "security_blocklist_pkey" PRIMARY KEY (id);

ALTER TABLE public.security_blocklist ADD CONSTRAINT "security_blocklist_type_check" CHECK ((type = ANY (ARRAY['ip'::text, 'email'::text, 'domain'::text, 'slug'::text, 'subdomain'::text, 'keyword'::text])));

ALTER TABLE public.security_events ADD CONSTRAINT "security_events_actor_user_id_fkey" FOREIGN KEY (actor_user_id) REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE public.security_events ADD CONSTRAINT "security_events_company_id_fkey" FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE SET NULL;

ALTER TABLE public.security_events ADD CONSTRAINT "security_events_pkey" PRIMARY KEY (id);

ALTER TABLE public.security_events ADD CONSTRAINT "security_events_severity_check" CHECK ((severity = ANY (ARRAY['baixa'::text, 'media'::text, 'alta'::text, 'critica'::text])));

ALTER TABLE public.signup_lead_followups ADD CONSTRAINT "signup_lead_followups_lead_id_fkey" FOREIGN KEY (lead_id) REFERENCES signup_leads(id) ON DELETE CASCADE;

ALTER TABLE public.signup_lead_followups ADD CONSTRAINT "signup_lead_followups_pkey" PRIMARY KEY (id);

ALTER TABLE public.signup_leads ADD CONSTRAINT "signup_leads_pkey" PRIMARY KEY (id);

ALTER TABLE public.site_sections ADD CONSTRAINT "site_sections_company_id_fkey" FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE;

ALTER TABLE public.site_sections ADD CONSTRAINT "site_sections_pkey" PRIMARY KEY (id);

ALTER TABLE public.site_template_presets ADD CONSTRAINT "site_template_presets_pkey" PRIMARY KEY (id);

ALTER TABLE public.smart_notification_events ADD CONSTRAINT "smart_notification_events_company_id_event_key_key" UNIQUE (company_id, event_key);

ALTER TABLE public.smart_notification_events ADD CONSTRAINT "smart_notification_events_pkey" PRIMARY KEY (id);

ALTER TABLE public.smart_notification_settings ADD CONSTRAINT "smart_notification_settings_pkey" PRIMARY KEY (company_id);

ALTER TABLE public.subscription_events ADD CONSTRAINT "subscription_events_company_id_fkey" FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE;

ALTER TABLE public.subscription_events ADD CONSTRAINT "subscription_events_pkey" PRIMARY KEY (id);

ALTER TABLE public.system_audit_logs ADD CONSTRAINT "system_audit_logs_pkey" PRIMARY KEY (id);

ALTER TABLE public.whatsapp_conversations ADD CONSTRAINT "whatsapp_conversations_company_id_fkey" FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE;

ALTER TABLE public.whatsapp_conversations ADD CONSTRAINT "whatsapp_conversations_company_id_phone_key" UNIQUE (company_id, phone);

ALTER TABLE public.whatsapp_conversations ADD CONSTRAINT "whatsapp_conversations_pkey" PRIMARY KEY (id);

ALTER TABLE public.whatsapp_message_logs ADD CONSTRAINT "whatsapp_message_logs_company_id_fkey" FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE SET NULL;

ALTER TABLE public.whatsapp_message_logs ADD CONSTRAINT "whatsapp_message_logs_order_id_fkey" FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE SET NULL;

ALTER TABLE public.whatsapp_message_logs ADD CONSTRAINT "whatsapp_message_logs_pkey" PRIMARY KEY (id);

ALTER TABLE public.whatsapp_message_logs ADD CONSTRAINT "whatsapp_message_logs_proposal_id_fkey" FOREIGN KEY (proposal_id) REFERENCES proposals(id) ON DELETE SET NULL;

CREATE INDEX idx_admin_audit_logs_admin_email ON public.admin_audit_logs USING btree (lower(admin_email), created_at DESC);

CREATE INDEX idx_admin_audit_logs_created ON public.admin_audit_logs USING btree (created_at DESC);

CREATE INDEX idx_admin_bug_reports_area_status ON public.admin_bug_reports USING btree (area, status, severity);

CREATE UNIQUE INDEX idx_admin_bug_reports_code_unique ON public.admin_bug_reports USING btree (code);

CREATE INDEX idx_admin_bug_reports_entity ON public.admin_bug_reports USING btree (entity_type, entity_id);

CREATE INDEX idx_admin_bug_reports_last_seen ON public.admin_bug_reports USING btree (last_seen_at DESC);

CREATE INDEX idx_admin_bug_reports_severity ON public.admin_bug_reports USING btree (severity);

CREATE INDEX idx_admin_bug_reports_status ON public.admin_bug_reports USING btree (status);

CREATE INDEX idx_admin_bug_reports_status_severity ON public.admin_bug_reports USING btree (status, severity);

CREATE INDEX idx_admin_scan_runs_started ON public.admin_scan_runs USING btree (started_at DESC);

CREATE INDEX idx_admin_snapshots_created ON public.admin_system_snapshots USING btree (created_at DESC);

CREATE INDEX idx_app_notifications_company_id ON public.app_notifications USING btree (company_id);

CREATE INDEX idx_app_notifications_created ON public.app_notifications USING btree (company_id, created_at DESC);

CREATE INDEX idx_app_notifications_status ON public.app_notifications USING btree (company_id, status);

CREATE INDEX idx_art_approvals_company_status ON public.art_approval_requests USING btree (company_id, status, created_at DESC);

CREATE INDEX idx_art_approvals_token ON public.art_approval_requests USING btree (token);

CREATE INDEX business_hours_company_idx ON public.business_hours USING btree (company_id);

CREATE INDEX idx_business_hours_company_weekday ON public.business_hours USING btree (company_id, weekday);

CREATE INDEX companies_business_type_idx ON public.companies USING btree (business_type);

CREATE INDEX companies_subdomain_slug_idx ON public.companies USING btree (subdomain_slug);

CREATE UNIQUE INDEX companies_subdomain_slug_unique ON public.companies USING btree (lower(subdomain_slug)) WHERE (subdomain_slug IS NOT NULL);

CREATE INDEX idx_companies_access_until ON public.companies USING btree (access_until);

CREATE INDEX idx_companies_assinatura_status ON public.companies USING btree (assinatura_status, assinatura_expira_em);

CREATE INDEX idx_companies_mp_subscription ON public.companies USING btree (mercado_pago_subscription_id);

CREATE INDEX idx_companies_owner_id ON public.companies USING btree (owner_id);

CREATE INDEX idx_companies_slug ON public.companies USING btree (slug);

CREATE INDEX idx_companies_slug_subdomain ON public.companies USING btree (slug, subdomain_slug);

CREATE INDEX idx_companies_subscription_payment_mode ON public.companies USING btree (assinatura_forma_pagamento_preferida);

CREATE INDEX idx_companies_subscription_status ON public.companies USING btree (assinatura_status);

CREATE INDEX idx_companies_tester_id ON public.companies USING btree (tester_id);

CREATE INDEX idx_companies_trial_used_at ON public.companies USING btree (trial_used_at);

CREATE UNIQUE INDEX company_members_company_email_unique ON public.company_members USING btree (company_id, lower(email)) WHERE (status <> 'removido'::text);

CREATE UNIQUE INDEX company_members_company_user_unique ON public.company_members USING btree (company_id, user_id) WHERE (status <> 'removido'::text);

CREATE UNIQUE INDEX idx_company_members_company_email_unique ON public.company_members USING btree (company_id, lower(email));

CREATE INDEX idx_company_members_company_status ON public.company_members USING btree (company_id, status);

CREATE UNIQUE INDEX idx_company_members_company_user_unique ON public.company_members USING btree (company_id, user_id);

CREATE INDEX idx_company_members_email_company ON public.company_members USING btree (lower(email), company_id);

CREATE INDEX idx_company_members_user_status ON public.company_members USING btree (user_id, status);

CREATE INDEX idx_company_niche_templates_company ON public.company_niche_templates USING btree (company_id);

CREATE INDEX idx_whatsapp_settings_phone_number ON public.company_whatsapp_settings USING btree (phone_number_id);

CREATE INDEX idx_crm_leads_company_id ON public.crm_leads USING btree (company_id);

CREATE INDEX idx_crm_leads_etapa ON public.crm_leads USING btree (company_id, etapa);

CREATE INDEX idx_crm_leads_next_contact ON public.crm_leads USING btree (company_id, proximo_contato_em);

CREATE INDEX idx_customer_followups_company_phone ON public.customer_followups USING btree (company_id, cliente_telefone, status, due_at);

CREATE INDEX idx_customer_magic_links_company_phone ON public.customer_magic_links USING btree (company_id, customer_phone);

CREATE INDEX idx_customer_magic_links_token ON public.customer_magic_links USING btree (token);

CREATE INDEX idx_customer_notes_company_phone ON public.customer_notes USING btree (company_id, cliente_telefone, created_at DESC);

CREATE INDEX idx_deliveries_company_created_at ON public.deliveries USING btree (company_id, created_at DESC);

CREATE INDEX idx_deliveries_company_id ON public.deliveries USING btree (company_id);

CREATE INDEX idx_deliveries_company_status ON public.deliveries USING btree (company_id, status);

CREATE INDEX idx_deliveries_order_id ON public.deliveries USING btree (order_id);

CREATE INDEX delivery_zones_company_idx ON public.delivery_zones USING btree (company_id);

CREATE INDEX idx_delivery_zones_company_active ON public.delivery_zones USING btree (company_id, is_active);

CREATE INDEX idx_finance_accounts_company ON public.finance_accounts USING btree (company_id, ativo);

CREATE INDEX idx_finance_accounts_company_id ON public.finance_accounts USING btree (company_id);

CREATE INDEX idx_financial_categories_company_id ON public.financial_categories USING btree (company_id);

CREATE INDEX idx_financial_material_company ON public.financial_material_entries USING btree (company_id, created_at DESC);

CREATE INDEX idx_financial_material_entries_company_id ON public.financial_material_entries USING btree (company_id);

CREATE INDEX idx_financial_material_entries_transaction_id ON public.financial_material_entries USING btree (transaction_id);

CREATE INDEX idx_financial_transactions_company_date ON public.financial_transactions USING btree (company_id, data_competencia DESC);

CREATE INDEX idx_financial_transactions_company_id ON public.financial_transactions USING btree (company_id);

CREATE INDEX idx_financial_transactions_company_type ON public.financial_transactions USING btree (company_id, tipo, status);

CREATE INDEX idx_financial_transactions_status ON public.financial_transactions USING btree (company_id, status);

CREATE INDEX idx_financial_transactions_vencimento ON public.financial_transactions USING btree (company_id, vencimento);

CREATE INDEX idx_internal_tasks_company_id ON public.internal_tasks USING btree (company_id);

CREATE INDEX idx_internal_tasks_due ON public.internal_tasks USING btree (company_id, due_at);

CREATE INDEX idx_internal_tasks_status ON public.internal_tasks USING btree (company_id, status);

CREATE INDEX idx_marketplace_commission_rules_company ON public.marketplace_commission_rules USING btree (company_id);

CREATE INDEX idx_marketplace_commission_rules_plan ON public.marketplace_commission_rules USING btree (plan_key);

CREATE INDEX idx_marketplace_commissions_company ON public.marketplace_commissions USING btree (company_id);

CREATE INDEX idx_marketplace_commissions_payment ON public.marketplace_commissions USING btree (marketplace_payment_id);

CREATE INDEX idx_marketplace_coupons_active ON public.marketplace_coupons USING btree (company_id, ativo);

CREATE UNIQUE INDEX idx_marketplace_coupons_company_code ON public.marketplace_coupons USING btree (company_id, codigo_normalizado);

CREATE INDEX idx_marketplace_coupons_company_id ON public.marketplace_coupons USING btree (company_id);

CREATE INDEX idx_marketplace_oauth_states_hash ON public.marketplace_oauth_states USING btree (state_hash);

CREATE INDEX idx_marketplace_payment_settings_company ON public.marketplace_payment_settings USING btree (company_id);

CREATE INDEX idx_marketplace_payments_company ON public.marketplace_payments USING btree (company_id);

CREATE INDEX idx_marketplace_payments_provider_payment ON public.marketplace_payments USING btree (provider_payment_id);

CREATE INDEX marketplace_payments_company_created_idx ON public.marketplace_payments USING btree (company_id, created_at DESC);

CREATE UNIQUE INDEX marketplace_payments_company_idempotency_uidx ON public.marketplace_payments USING btree (company_id, idempotency_key) WHERE ((company_id IS NOT NULL) AND (idempotency_key IS NOT NULL));

CREATE INDEX marketplace_payments_order_idx ON public.marketplace_payments USING btree (order_id);

CREATE UNIQUE INDEX marketplace_payments_provider_payment_uidx ON public.marketplace_payments USING btree (provider, provider_payment_id) WHERE ((provider IS NOT NULL) AND (provider_payment_id IS NOT NULL));

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

CREATE UNIQUE INDEX order_payments_company_idempotency_uidx ON public.order_payments USING btree (company_id, idempotency_key) WHERE ((company_id IS NOT NULL) AND (idempotency_key IS NOT NULL));

CREATE UNIQUE INDEX order_payments_provider_payment_uidx ON public.order_payments USING btree (provider, provider_payment_id) WHERE ((provider IS NOT NULL) AND (provider_payment_id IS NOT NULL));

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

CREATE INDEX idx_orders_status ON public.orders USING btree (status);

CREATE INDEX idx_orders_telefone ON public.orders USING btree (telefone);

CREATE UNIQUE INDEX orders_checkout_idempotency_uidx ON public.orders USING btree (company_id, checkout_idempotency_key) WHERE ((company_id IS NOT NULL) AND (checkout_idempotency_key IS NOT NULL));

CREATE INDEX idx_payment_methods_company_active ON public.payment_methods USING btree (company_id, is_active);

CREATE INDEX idx_payment_methods_company_id ON public.payment_methods USING btree (company_id);

CREATE INDEX payment_payouts_company_idx ON public.payment_payouts USING btree (company_id, created_at DESC);

CREATE INDEX payment_webhook_events_company_idx ON public.payment_webhook_events USING btree (company_id, received_at DESC);

CREATE INDEX payment_webhook_events_object_idx ON public.payment_webhook_events USING btree (provider, provider_object_id);

CREATE INDEX idx_plan_payments_company_id ON public.plan_payments USING btree (company_id);

CREATE INDEX idx_plan_payments_company_status ON public.plan_payments USING btree (company_id, status);

CREATE INDEX idx_plan_payments_payment_id ON public.plan_payments USING btree (mercado_pago_payment_id);

CREATE INDEX idx_plan_payments_preapproval ON public.plan_payments USING btree (mercado_pago_preapproval_id);

CREATE INDEX idx_plan_payments_preference_id ON public.plan_payments USING btree (mercado_pago_preference_id);

CREATE UNIQUE INDEX plan_payments_company_idempotency_uidx ON public.plan_payments USING btree (company_id, idempotency_key) WHERE ((company_id IS NOT NULL) AND (idempotency_key IS NOT NULL));

CREATE UNIQUE INDEX plan_payments_provider_payment_uidx ON public.plan_payments USING btree (provider, provider_payment_id) WHERE ((provider IS NOT NULL) AND (provider_payment_id IS NOT NULL));

CREATE UNIQUE INDEX plan_payments_provider_subscription_uidx ON public.plan_payments USING btree (provider, provider_subscription_id) WHERE ((provider IS NOT NULL) AND (provider_subscription_id IS NOT NULL));

CREATE INDEX idx_platform_admins_email ON public.platform_admins USING btree (lower(email));

CREATE INDEX idx_platform_admins_user ON public.platform_admins USING btree (user_id);

CREATE INDEX idx_production_orders_company_status ON public.production_orders USING btree (company_id, status, due_date);

CREATE INDEX idx_production_orders_company_status_created ON public.production_orders USING btree (company_id, status, created_at DESC);

CREATE UNIQUE INDEX idx_production_orders_proposal_unique ON public.production_orders USING btree (proposal_id) WHERE (proposal_id IS NOT NULL);

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

CREATE INDEX products_company_business_type_idx ON public.products USING btree (company_id, business_type);

CREATE INDEX idx_proposal_events_company_created ON public.proposal_events USING btree (company_id, created_at DESC);

CREATE INDEX idx_proposal_events_proposal_created ON public.proposal_events USING btree (proposal_id, created_at DESC);

CREATE INDEX idx_proposals_company_id ON public.proposals USING btree (company_id);

CREATE INDEX idx_proposals_company_status_created ON public.proposals USING btree (company_id, status, created_at DESC);

CREATE INDEX idx_proposals_order ON public.proposals USING btree (order_id);

CREATE INDEX idx_proposals_token ON public.proposals USING btree (token);

CREATE INDEX provider_customers_provider_id_idx ON public.provider_customers USING btree (provider, provider_customer_id);

CREATE UNIQUE INDEX idx_quote_templates_company_nome ON public.quote_templates USING btree (company_id, nome);

CREATE UNIQUE INDEX idx_quote_templates_company_tipo_unique ON public.quote_templates USING btree (company_id, tipo);

CREATE INDEX idx_recurring_orders_company_next ON public.recurring_orders USING btree (company_id, next_due_at);

CREATE UNIQUE INDEX idx_security_blocklist_type_value ON public.security_blocklist USING btree (type, lower(value));

CREATE INDEX idx_security_events_company_created ON public.security_events USING btree (company_id, created_at DESC);

CREATE INDEX idx_security_events_created ON public.security_events USING btree (created_at DESC);

CREATE INDEX idx_security_events_path ON public.security_events USING btree (path);

CREATE INDEX idx_security_events_type_severity ON public.security_events USING btree (event_type, severity, resolved);

CREATE INDEX idx_signup_lead_followups_lead ON public.signup_lead_followups USING btree (lead_id, created_at DESC);

CREATE INDEX idx_signup_leads_email ON public.signup_leads USING btree (lower(email));

CREATE INDEX idx_signup_leads_status_next_followup ON public.signup_leads USING btree (status, next_followup_at);

CREATE INDEX idx_signup_leads_whatsapp ON public.signup_leads USING btree (whatsapp);

CREATE INDEX idx_site_sections_company_order ON public.site_sections USING btree (company_id, active, sort_order);

CREATE INDEX idx_smart_notification_events_company_id ON public.smart_notification_events USING btree (company_id);

CREATE INDEX idx_smart_notification_events_type ON public.smart_notification_events USING btree (company_id, event_type);

CREATE INDEX idx_subscription_events_company_created ON public.subscription_events USING btree (company_id, created_at DESC);

CREATE UNIQUE INDEX ux_subscription_events_idempotency ON public.subscription_events USING btree (company_id, event_type, provider_reference);

CREATE INDEX idx_system_audit_logs_company_id ON public.system_audit_logs USING btree (company_id);

CREATE INDEX idx_system_audit_logs_created ON public.system_audit_logs USING btree (company_id, created_at DESC);

CREATE INDEX idx_whatsapp_conversations_company_updated ON public.whatsapp_conversations USING btree (company_id, updated_at DESC);

CREATE INDEX idx_whatsapp_logs_company_created ON public.whatsapp_message_logs USING btree (company_id, created_at DESC);

CREATE INDEX idx_whatsapp_logs_order ON public.whatsapp_message_logs USING btree (order_id, created_at DESC);

CREATE INDEX idx_whatsapp_logs_proposal ON public.whatsapp_message_logs USING btree (proposal_id, created_at DESC);

CREATE VIEW public.admin_signup_leads_overview WITH (security_invoker = true) AS
 SELECT id,
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
            WHEN ((status = ANY (ARRAY['checkout_criado'::text, 'lead'::text])) AND (next_followup_at <= now()) AND (marketing_opt_in = true)) THEN true
            ELSE false
        END AS followup_due,
        CASE
            WHEN (status = ANY (ARRAY['checkout_criado'::text, 'lead'::text])) THEN (EXTRACT(day FROM (now() - created_at)))::integer
            ELSE 0
        END AS dias_sem_converter
   FROM signup_leads l
  ORDER BY created_at DESC;

CREATE VIEW public.orcaly_company_health WITH (security_invoker = true) AS
 SELECT id AS company_id,
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
          WHERE ((p.company_id = c.id) AND (COALESCE(p.arquivado, false) = false))) AS products_count,
    ( SELECT count(*) AS count
           FROM orders o
          WHERE (o.company_id = c.id)) AS orders_count,
    ( SELECT count(*) AS count
           FROM crm_leads l
          WHERE ((l.company_id = c.id) AND (l.status = 'ativo'::text))) AS leads_count,
    ( SELECT count(*) AS count
           FROM internal_tasks t
          WHERE ((t.company_id = c.id) AND (t.status <> 'concluida'::text))) AS open_tasks_count,
    ( SELECT count(*) AS count
           FROM app_notifications n
          WHERE ((n.company_id = c.id) AND (n.status = 'unread'::text))) AS unread_notifications_count
   FROM companies c;

CREATE VIEW public.production_dashboard WITH (security_invoker = true) AS
 SELECT po.id,
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
    count(ps.id) FILTER (WHERE (ps.status = 'concluido'::text)) AS completed_steps
   FROM (production_orders po
     LEFT JOIN production_steps ps ON ((ps.production_order_id = po.id)))
  GROUP BY po.id;

CREATE VIEW public.proposals_dashboard WITH (security_invoker = true) AS
 SELECT p.id,
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
   FROM (proposals p
     LEFT JOIN orders o ON ((o.id = p.order_id)));

CREATE TRIGGER set_business_hours_updated_at BEFORE UPDATE ON public.business_hours FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_protect_company_trial_used_at BEFORE UPDATE ON public.companies FOR EACH ROW EXECUTE FUNCTION protect_company_trial_used_at();

CREATE TRIGGER trg_set_company_subdomain_slug BEFORE INSERT OR UPDATE OF nome, slug, subdomain_slug ON public.companies FOR EACH ROW EXECUTE FUNCTION set_company_subdomain_slug();

CREATE TRIGGER trg_company_member_limit BEFORE INSERT OR UPDATE ON public.company_members FOR EACH ROW EXECUTE FUNCTION public.check_company_member_limit();

CREATE TRIGGER trg_company_member_touch BEFORE UPDATE ON public.company_members FOR EACH ROW EXECUTE FUNCTION company_member_touch();

CREATE TRIGGER trg_limit_company_members BEFORE INSERT OR UPDATE OF status, company_id ON public.company_members FOR EACH ROW EXECUTE FUNCTION limit_company_members();

CREATE TRIGGER set_deliveries_updated_at BEFORE UPDATE ON public.deliveries FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER set_delivery_zones_updated_at BEFORE UPDATE ON public.delivery_zones FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_finance_touch_updated_at BEFORE UPDATE ON public.financial_transactions FOR EACH ROW EXECUTE FUNCTION finance_touch_updated_at();

CREATE TRIGGER trg_marketplace_commission_rules_updated_at BEFORE UPDATE ON public.marketplace_commission_rules FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_marketplace_commissions_updated_at BEFORE UPDATE ON public.marketplace_commissions FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_marketplace_payment_settings_updated_at BEFORE UPDATE ON public.marketplace_payment_settings FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_marketplace_payments_updated_at BEFORE UPDATE ON public.marketplace_payments FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER set_order_payments_updated_at BEFORE UPDATE ON public.order_payments FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER set_orders_updated_at BEFORE UPDATE ON public.orders FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER set_payment_methods_updated_at BEFORE UPDATE ON public.payment_methods FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_platform_admins_updated_at BEFORE UPDATE ON public.platform_admins FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_touch_signup_lead_updated_at BEFORE UPDATE ON public.signup_leads FOR EACH ROW EXECUTE FUNCTION touch_signup_lead_updated_at();
ALTER TABLE public.admin_audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_bug_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_scan_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_system_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.art_approval_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.business_hours ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.company_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.company_niche_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.company_proposal_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.company_whatsapp_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_followups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_internal_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_magic_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_portal_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.deliveries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.delivery_zones ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.finance_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.financial_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.financial_material_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.financial_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.internal_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.marketplace_commission_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.marketplace_commissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.marketplace_coupons ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.marketplace_oauth_states ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.marketplace_payment_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.marketplace_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_internal_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_status_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_methods ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_payouts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_webhook_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.plan_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.platform_admins ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.production_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.production_steps ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.proposal_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.proposals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.provider_customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quote_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recurring_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.security_blocklist ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.security_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.signup_lead_followups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.signup_leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.site_sections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.site_template_presets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.smart_notification_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.smart_notification_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscription_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.system_audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whatsapp_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whatsapp_message_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin vê auditoria" ON public.admin_audit_logs AS PERMISSIVE FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM admin_users au
  WHERE ((au.ativo = true) AND (lower(au.email) = lower((auth.jwt() ->> 'email'::text)))))));

CREATE POLICY "Admins inserem audit logs" ON public.admin_audit_logs AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK ((EXISTS ( SELECT 1
   FROM admin_users au
  WHERE ((au.ativo = true) AND (lower(au.email) = lower((auth.jwt() ->> 'email'::text)))))));

CREATE POLICY "Admins inserem logs administrativos" ON public.admin_audit_logs AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK ((EXISTS ( SELECT 1
   FROM admin_users au
  WHERE ((au.ativo = true) AND (lower(au.email) = lower((auth.jwt() ->> 'email'::text)))))));

CREATE POLICY "Admins veem audit logs" ON public.admin_audit_logs AS PERMISSIVE FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM admin_users au
  WHERE ((au.ativo = true) AND (lower(au.email) = lower((auth.jwt() ->> 'email'::text)))))));

CREATE POLICY "Admins veem logs administrativos" ON public.admin_audit_logs AS PERMISSIVE FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM admin_users au
  WHERE ((au.ativo = true) AND (lower(au.email) = lower((auth.jwt() ->> 'email'::text)))))));

CREATE POLICY "Admin vê bugs" ON public.admin_bug_reports AS PERMISSIVE FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM admin_users au
  WHERE ((au.ativo = true) AND (lower(au.email) = lower((auth.jwt() ->> 'email'::text)))))));

CREATE POLICY "Admins gerenciam bugs" ON public.admin_bug_reports AS PERMISSIVE FOR ALL TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM admin_users au
  WHERE ((au.ativo = true) AND (lower(au.email) = lower((auth.jwt() ->> 'email'::text))))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM admin_users au
  WHERE ((au.ativo = true) AND (lower(au.email) = lower((auth.jwt() ->> 'email'::text)))))));

CREATE POLICY "Admins veem bugs" ON public.admin_bug_reports AS PERMISSIVE FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM admin_users au
  WHERE ((au.ativo = true) AND (lower(au.email) = lower((auth.jwt() ->> 'email'::text)))))));

CREATE POLICY "Admins gerenciam scans" ON public.admin_scan_runs AS PERMISSIVE FOR ALL TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM admin_users au
  WHERE ((au.ativo = true) AND (lower(au.email) = lower((auth.jwt() ->> 'email'::text))))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM admin_users au
  WHERE ((au.ativo = true) AND (lower(au.email) = lower((auth.jwt() ->> 'email'::text)))))));

CREATE POLICY "Admins veem scans" ON public.admin_scan_runs AS PERMISSIVE FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM admin_users au
  WHERE ((au.ativo = true) AND (lower(au.email) = lower((auth.jwt() ->> 'email'::text)))))));

CREATE POLICY "Admin vê snapshots" ON public.admin_system_snapshots AS PERMISSIVE FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM admin_users au
  WHERE ((au.ativo = true) AND (lower(au.email) = lower((auth.jwt() ->> 'email'::text)))))));

CREATE POLICY "Admin vê próprio cadastro admin" ON public.admin_users AS PERMISSIVE FOR SELECT TO "authenticated" USING (((ativo = true) AND (lower(email) = lower((auth.jwt() ->> 'email'::text)))));

CREATE POLICY "Empresa gerencia aprovacoes de arte" ON public.art_approval_requests AS PERMISSIVE FOR ALL TO "authenticated" USING (((EXISTS ( SELECT 1
   FROM companies c
  WHERE ((c.id = art_approval_requests.company_id) AND ((c.owner_id = auth.uid()) OR (c.tester_id = auth.uid()))))) OR (EXISTS ( SELECT 1
   FROM company_members cm
  WHERE ((cm.company_id = art_approval_requests.company_id) AND (cm.user_id = auth.uid()) AND (cm.status = 'ativo'::text) AND (cm.cargo = ANY (ARRAY['gerente'::text, 'producao'::text]))))) OR (EXISTS ( SELECT 1
   FROM admin_users au
  WHERE ((au.ativo = true) AND (lower(au.email) = lower((auth.jwt() ->> 'email'::text)))))))) WITH CHECK (((EXISTS ( SELECT 1
   FROM companies c
  WHERE ((c.id = art_approval_requests.company_id) AND ((c.owner_id = auth.uid()) OR (c.tester_id = auth.uid()))))) OR (EXISTS ( SELECT 1
   FROM company_members cm
  WHERE ((cm.company_id = art_approval_requests.company_id) AND (cm.user_id = auth.uid()) AND (cm.status = 'ativo'::text) AND (cm.cargo = ANY (ARRAY['gerente'::text, 'producao'::text]))))) OR (EXISTS ( SELECT 1
   FROM admin_users au
  WHERE ((au.ativo = true) AND (lower(au.email) = lower((auth.jwt() ->> 'email'::text))))))));

CREATE POLICY "Empresa ve aprovacoes de arte" ON public.art_approval_requests AS PERMISSIVE FOR SELECT TO "authenticated" USING (((EXISTS ( SELECT 1
   FROM companies c
  WHERE ((c.id = art_approval_requests.company_id) AND ((c.owner_id = auth.uid()) OR (c.tester_id = auth.uid()))))) OR (EXISTS ( SELECT 1
   FROM company_members cm
  WHERE ((cm.company_id = art_approval_requests.company_id) AND (cm.user_id = auth.uid()) AND (cm.status = 'ativo'::text)))) OR (EXISTS ( SELECT 1
   FROM admin_users au
  WHERE ((au.ativo = true) AND (lower(au.email) = lower((auth.jwt() ->> 'email'::text))))))));

CREATE POLICY "business_hours_company_access" ON public.business_hours AS PERMISSIVE FOR ALL TO PUBLIC USING ((EXISTS ( SELECT 1
   FROM companies c
  WHERE ((c.id = business_hours.company_id) AND ((c.owner_id = auth.uid()) OR (c.tester_id = auth.uid()) OR (EXISTS ( SELECT 1
           FROM company_members m
          WHERE ((m.company_id = c.id) AND (m.user_id = auth.uid()) AND (m.status = 'ativo'::text))))))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM companies c
  WHERE ((c.id = business_hours.company_id) AND ((c.owner_id = auth.uid()) OR (c.tester_id = auth.uid()) OR (EXISTS ( SELECT 1
           FROM company_members m
          WHERE ((m.company_id = c.id) AND (m.user_id = auth.uid()) AND (m.status = 'ativo'::text)))))))));

CREATE POLICY "Dono e gerente editam empresa" ON public.companies AS PERMISSIVE FOR UPDATE TO "authenticated" USING (public.can_manage_company(id)) WITH CHECK (public.can_manage_company(id));

CREATE POLICY "Dono ou tester atualiza empresa" ON public.companies AS PERMISSIVE FOR UPDATE TO "authenticated" USING (((owner_id = auth.uid()) OR (tester_id = auth.uid()))) WITH CHECK (((owner_id = auth.uid()) OR (tester_id = auth.uid())));

CREATE POLICY "Dono ou tester vê empresa" ON public.companies AS PERMISSIVE FOR SELECT TO "authenticated" USING (((owner_id = auth.uid()) OR (tester_id = auth.uid())));

CREATE POLICY "Funcionario ve empresa vinculada" ON public.companies AS PERMISSIVE FOR SELECT TO "authenticated" USING (public.is_company_member(id));

CREATE POLICY "Funcionarios acessam empresa" ON public.companies AS PERMISSIVE FOR SELECT TO "authenticated" USING (public.can_manage_company(id));

CREATE POLICY "Usuário cria própria empresa" ON public.companies AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK (((owner_id = auth.uid()) AND (lower(slug) <> ALL (ARRAY['admin'::text, 'administrador'::text, 'orcaly'::text, 'suporte'::text, 'support'::text, 'api'::text, 'painel'::text, 'dashboard'::text, 'login'::text, 'cadastro'::text, 'checkout'::text, 'assinatura'::text, 'proposta'::text, 'propostas'::text, 'root'::text, 'system'::text, 'sistema'::text, 'mercado-pago'::text, 'mercadopago'::text, 'www'::text, 'app'::text, 'assets'::text, 'static'::text, 'public'::text, 'private'::text, 'config'::text, 'settings'::text, 'security'::text, 'auth'::text, 'null'::text, 'undefined'::text]))));

CREATE POLICY "Dono gerencia funcionarios" ON public.company_members AS PERMISSIVE FOR ALL TO "authenticated" USING (public.is_company_owner(company_id)) WITH CHECK (public.is_company_owner(company_id));

CREATE POLICY "Dono gerencia membros" ON public.company_members AS PERMISSIVE FOR ALL TO "authenticated" USING ((public.is_company_owner(company_id) OR public.is_orcaly_admin())) WITH CHECK ((public.is_company_owner(company_id) OR public.is_orcaly_admin()));

CREATE POLICY "Dono gerente e admin veem membros" ON public.company_members AS PERMISSIVE FOR SELECT TO "authenticated" USING ((public.is_company_owner(company_id) OR public.is_company_member(company_id) OR public.is_orcaly_admin()));

CREATE POLICY "Funcionario ve proprio cadastro" ON public.company_members AS PERMISSIVE FOR SELECT TO "authenticated" USING (((user_id = auth.uid()) AND (status = 'ativo'::text)));

CREATE POLICY "Empresa gerencia modelos por nicho" ON public.company_niche_templates AS PERMISSIVE FOR ALL TO "authenticated" USING (((EXISTS ( SELECT 1
   FROM companies c
  WHERE ((c.id = company_niche_templates.company_id) AND ((c.owner_id = auth.uid()) OR (c.tester_id = auth.uid()))))) OR (EXISTS ( SELECT 1
   FROM company_members cm
  WHERE ((cm.company_id = company_niche_templates.company_id) AND (cm.user_id = auth.uid()) AND (cm.status = 'ativo'::text) AND (cm.cargo = 'gerente'::text)))))) WITH CHECK (((EXISTS ( SELECT 1
   FROM companies c
  WHERE ((c.id = company_niche_templates.company_id) AND ((c.owner_id = auth.uid()) OR (c.tester_id = auth.uid()))))) OR (EXISTS ( SELECT 1
   FROM company_members cm
  WHERE ((cm.company_id = company_niche_templates.company_id) AND (cm.user_id = auth.uid()) AND (cm.status = 'ativo'::text) AND (cm.cargo = 'gerente'::text))))));

CREATE POLICY "Empresa gerencia config propostas" ON public.company_proposal_settings AS PERMISSIVE FOR ALL TO "authenticated" USING (public.can_manage_company(company_id)) WITH CHECK (public.can_manage_company(company_id));

CREATE POLICY "Empresa gerencia whatsapp settings" ON public.company_whatsapp_settings AS PERMISSIVE FOR ALL TO "authenticated" USING (((EXISTS ( SELECT 1
   FROM companies c
  WHERE ((c.id = company_whatsapp_settings.company_id) AND ((c.owner_id = auth.uid()) OR (c.tester_id = auth.uid()))))) OR (EXISTS ( SELECT 1
   FROM company_members cm
  WHERE ((cm.company_id = company_whatsapp_settings.company_id) AND (cm.user_id = auth.uid()) AND (cm.status = 'ativo'::text) AND (cm.cargo = 'gerente'::text)))) OR (EXISTS ( SELECT 1
   FROM admin_users au
  WHERE ((au.ativo = true) AND (lower(au.email) = lower((auth.jwt() ->> 'email'::text)))))))) WITH CHECK (((EXISTS ( SELECT 1
   FROM companies c
  WHERE ((c.id = company_whatsapp_settings.company_id) AND ((c.owner_id = auth.uid()) OR (c.tester_id = auth.uid()))))) OR (EXISTS ( SELECT 1
   FROM company_members cm
  WHERE ((cm.company_id = company_whatsapp_settings.company_id) AND (cm.user_id = auth.uid()) AND (cm.status = 'ativo'::text) AND (cm.cargo = 'gerente'::text)))) OR (EXISTS ( SELECT 1
   FROM admin_users au
  WHERE ((au.ativo = true) AND (lower(au.email) = lower((auth.jwt() ->> 'email'::text))))))));

CREATE POLICY "Equipe gerencia followups de clientes" ON public.customer_followups AS PERMISSIVE FOR ALL TO "authenticated" USING ((public.is_company_owner(company_id) OR public.is_company_member(company_id))) WITH CHECK ((public.is_company_owner(company_id) OR public.is_company_member(company_id)));

CREATE POLICY "Empresa ve notas internas de clientes" ON public.customer_internal_notes AS PERMISSIVE FOR SELECT TO "authenticated" USING (((EXISTS ( SELECT 1
   FROM companies c
  WHERE ((c.id = customer_internal_notes.company_id) AND ((c.owner_id = auth.uid()) OR (c.tester_id = auth.uid()))))) OR (EXISTS ( SELECT 1
   FROM company_members cm
  WHERE ((cm.company_id = customer_internal_notes.company_id) AND (cm.user_id = auth.uid()) AND (cm.status = 'ativo'::text))))));

CREATE POLICY "Empresa gerencia links cliente" ON public.customer_magic_links AS PERMISSIVE FOR ALL TO "authenticated" USING (((EXISTS ( SELECT 1
   FROM companies c
  WHERE ((c.id = customer_magic_links.company_id) AND ((c.owner_id = auth.uid()) OR (c.tester_id = auth.uid()))))) OR (EXISTS ( SELECT 1
   FROM company_members cm
  WHERE ((cm.company_id = customer_magic_links.company_id) AND (cm.user_id = auth.uid()) AND (cm.status = 'ativo'::text)))))) WITH CHECK (((EXISTS ( SELECT 1
   FROM companies c
  WHERE ((c.id = customer_magic_links.company_id) AND ((c.owner_id = auth.uid()) OR (c.tester_id = auth.uid()))))) OR (EXISTS ( SELECT 1
   FROM company_members cm
  WHERE ((cm.company_id = customer_magic_links.company_id) AND (cm.user_id = auth.uid()) AND (cm.status = 'ativo'::text))))));

CREATE POLICY "Equipe gerencia notas de clientes" ON public.customer_notes AS PERMISSIVE FOR ALL TO "authenticated" USING ((public.is_company_owner(company_id) OR public.is_company_member(company_id))) WITH CHECK ((public.is_company_owner(company_id) OR public.is_company_member(company_id)));

CREATE POLICY "deliveries_company_access" ON public.deliveries AS PERMISSIVE FOR ALL TO PUBLIC USING ((EXISTS ( SELECT 1
   FROM companies c
  WHERE ((c.id = deliveries.company_id) AND ((c.owner_id = auth.uid()) OR (c.tester_id = auth.uid()) OR (EXISTS ( SELECT 1
           FROM company_members m
          WHERE ((m.company_id = c.id) AND (m.user_id = auth.uid()) AND (m.status = 'ativo'::text))))))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM companies c
  WHERE ((c.id = deliveries.company_id) AND ((c.owner_id = auth.uid()) OR (c.tester_id = auth.uid()) OR (EXISTS ( SELECT 1
           FROM company_members m
          WHERE ((m.company_id = c.id) AND (m.user_id = auth.uid()) AND (m.status = 'ativo'::text)))))))));

CREATE POLICY "delivery_zones_company_access" ON public.delivery_zones AS PERMISSIVE FOR ALL TO PUBLIC USING ((EXISTS ( SELECT 1
   FROM companies c
  WHERE ((c.id = delivery_zones.company_id) AND ((c.owner_id = auth.uid()) OR (c.tester_id = auth.uid()) OR (EXISTS ( SELECT 1
           FROM company_members m
          WHERE ((m.company_id = c.id) AND (m.user_id = auth.uid()) AND (m.status = 'ativo'::text))))))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM companies c
  WHERE ((c.id = delivery_zones.company_id) AND ((c.owner_id = auth.uid()) OR (c.tester_id = auth.uid()) OR (EXISTS ( SELECT 1
           FROM company_members m
          WHERE ((m.company_id = c.id) AND (m.user_id = auth.uid()) AND (m.status = 'ativo'::text)))))))));

CREATE POLICY "Dono e gerente gerenciam contas financeiras" ON public.finance_accounts AS PERMISSIVE FOR ALL TO "authenticated" USING ((public.is_company_owner(company_id) OR (public.is_company_member(company_id) AND (public.my_company_role(company_id) = 'gerente'::text)))) WITH CHECK ((public.is_company_owner(company_id) OR (public.is_company_member(company_id) AND (public.my_company_role(company_id) = 'gerente'::text))));

CREATE POLICY "Dono e gerente veem contas financeiras" ON public.finance_accounts AS PERMISSIVE FOR SELECT TO "authenticated" USING ((public.is_company_owner(company_id) OR (public.is_company_member(company_id) AND (public.my_company_role(company_id) = 'gerente'::text))));

CREATE POLICY "finance_accounts_company_access" ON public.finance_accounts AS PERMISSIVE FOR ALL TO PUBLIC USING ((EXISTS ( SELECT 1
   FROM companies c
  WHERE ((c.id = finance_accounts.company_id) AND ((c.owner_id = auth.uid()) OR (c.tester_id = auth.uid()) OR (EXISTS ( SELECT 1
           FROM company_members m
          WHERE ((m.company_id = c.id) AND (m.user_id = auth.uid()) AND (m.status = 'ativo'::text))))))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM companies c
  WHERE ((c.id = finance_accounts.company_id) AND ((c.owner_id = auth.uid()) OR (c.tester_id = auth.uid()) OR (EXISTS ( SELECT 1
           FROM company_members m
          WHERE ((m.company_id = c.id) AND (m.user_id = auth.uid()) AND (m.status = 'ativo'::text)))))))));

CREATE POLICY "financial_categories_company_access" ON public.financial_categories AS PERMISSIVE FOR ALL TO PUBLIC USING ((EXISTS ( SELECT 1
   FROM companies c
  WHERE ((c.id = financial_categories.company_id) AND ((c.owner_id = auth.uid()) OR (c.tester_id = auth.uid()) OR (EXISTS ( SELECT 1
           FROM company_members m
          WHERE ((m.company_id = c.id) AND (m.user_id = auth.uid()) AND (m.status = 'ativo'::text))))))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM companies c
  WHERE ((c.id = financial_categories.company_id) AND ((c.owner_id = auth.uid()) OR (c.tester_id = auth.uid()) OR (EXISTS ( SELECT 1
           FROM company_members m
          WHERE ((m.company_id = c.id) AND (m.user_id = auth.uid()) AND (m.status = 'ativo'::text)))))))));

CREATE POLICY "Dono e gerente gerenciam materiais financeiros" ON public.financial_material_entries AS PERMISSIVE FOR ALL TO "authenticated" USING ((public.is_company_owner(company_id) OR (public.is_company_member(company_id) AND (public.my_company_role(company_id) = 'gerente'::text)))) WITH CHECK ((public.is_company_owner(company_id) OR (public.is_company_member(company_id) AND (public.my_company_role(company_id) = 'gerente'::text))));

CREATE POLICY "Equipe ve materiais financeiros" ON public.financial_material_entries AS PERMISSIVE FOR SELECT TO "authenticated" USING ((public.is_company_owner(company_id) OR (public.is_company_member(company_id) AND (public.my_company_role(company_id) = ANY (ARRAY['gerente'::text, 'producao'::text])))));

CREATE POLICY "financial_material_entries_company_access" ON public.financial_material_entries AS PERMISSIVE FOR ALL TO PUBLIC USING ((EXISTS ( SELECT 1
   FROM companies c
  WHERE ((c.id = financial_material_entries.company_id) AND ((c.owner_id = auth.uid()) OR (c.tester_id = auth.uid()) OR (EXISTS ( SELECT 1
           FROM company_members m
          WHERE ((m.company_id = c.id) AND (m.user_id = auth.uid()) AND (m.status = 'ativo'::text))))))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM companies c
  WHERE ((c.id = financial_material_entries.company_id) AND ((c.owner_id = auth.uid()) OR (c.tester_id = auth.uid()) OR (EXISTS ( SELECT 1
           FROM company_members m
          WHERE ((m.company_id = c.id) AND (m.user_id = auth.uid()) AND (m.status = 'ativo'::text)))))))));

CREATE POLICY "Dono e gerente gerenciam financeiro" ON public.financial_transactions AS PERMISSIVE FOR ALL TO "authenticated" USING ((public.is_company_owner(company_id) OR (public.is_company_member(company_id) AND (public.my_company_role(company_id) = 'gerente'::text)))) WITH CHECK ((public.is_company_owner(company_id) OR (public.is_company_member(company_id) AND (public.my_company_role(company_id) = 'gerente'::text))));

CREATE POLICY "Equipe ve financeiro" ON public.financial_transactions AS PERMISSIVE FOR SELECT TO "authenticated" USING ((public.is_company_owner(company_id) OR (public.is_company_member(company_id) AND (public.my_company_role(company_id) = 'gerente'::text))));

CREATE POLICY "financial_transactions_company_access" ON public.financial_transactions AS PERMISSIVE FOR ALL TO PUBLIC USING ((EXISTS ( SELECT 1
   FROM companies c
  WHERE ((c.id = financial_transactions.company_id) AND ((c.owner_id = auth.uid()) OR (c.tester_id = auth.uid()) OR (EXISTS ( SELECT 1
           FROM company_members m
          WHERE ((m.company_id = c.id) AND (m.user_id = auth.uid()) AND (m.status = 'ativo'::text))))))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM companies c
  WHERE ((c.id = financial_transactions.company_id) AND ((c.owner_id = auth.uid()) OR (c.tester_id = auth.uid()) OR (EXISTS ( SELECT 1
           FROM company_members m
          WHERE ((m.company_id = c.id) AND (m.user_id = auth.uid()) AND (m.status = 'ativo'::text)))))))));

CREATE POLICY "Empresa atualiza notificacoes" ON public.notifications AS PERMISSIVE FOR UPDATE TO "authenticated" USING (((user_id = auth.uid()) OR (EXISTS ( SELECT 1
   FROM companies c
  WHERE ((c.id = notifications.company_id) AND ((c.owner_id = auth.uid()) OR (c.tester_id = auth.uid()))))) OR (EXISTS ( SELECT 1
   FROM company_members cm
  WHERE ((cm.company_id = notifications.company_id) AND (cm.user_id = auth.uid()) AND (cm.status = 'ativo'::text)))) OR (EXISTS ( SELECT 1
   FROM admin_users au
  WHERE ((au.ativo = true) AND (lower(au.email) = lower((auth.jwt() ->> 'email'::text)))))))) WITH CHECK (((user_id = auth.uid()) OR (EXISTS ( SELECT 1
   FROM companies c
  WHERE ((c.id = notifications.company_id) AND ((c.owner_id = auth.uid()) OR (c.tester_id = auth.uid()))))) OR (EXISTS ( SELECT 1
   FROM company_members cm
  WHERE ((cm.company_id = notifications.company_id) AND (cm.user_id = auth.uid()) AND (cm.status = 'ativo'::text)))) OR (EXISTS ( SELECT 1
   FROM admin_users au
  WHERE ((au.ativo = true) AND (lower(au.email) = lower((auth.jwt() ->> 'email'::text))))))));

CREATE POLICY "Empresa ve notificacoes" ON public.notifications AS PERMISSIVE FOR SELECT TO "authenticated" USING (((user_id = auth.uid()) OR (EXISTS ( SELECT 1
   FROM companies c
  WHERE ((c.id = notifications.company_id) AND ((c.owner_id = auth.uid()) OR (c.tester_id = auth.uid()))))) OR (EXISTS ( SELECT 1
   FROM company_members cm
  WHERE ((cm.company_id = notifications.company_id) AND (cm.user_id = auth.uid()) AND (cm.status = 'ativo'::text)))) OR (EXISTS ( SELECT 1
   FROM admin_users au
  WHERE ((au.ativo = true) AND (lower(au.email) = lower((auth.jwt() ->> 'email'::text))))))));

CREATE POLICY "Dono ou tester atualiza itens" ON public.order_items AS PERMISSIVE FOR UPDATE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM companies c
  WHERE ((c.id = order_items.company_id) AND ((c.owner_id = auth.uid()) OR (c.tester_id = auth.uid())))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM companies c
  WHERE ((c.id = order_items.company_id) AND ((c.owner_id = auth.uid()) OR (c.tester_id = auth.uid()))))));

CREATE POLICY "Dono ou tester vê itens" ON public.order_items AS PERMISSIVE FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM companies c
  WHERE ((c.id = order_items.company_id) AND ((c.owner_id = auth.uid()) OR (c.tester_id = auth.uid()))))));

CREATE POLICY "Funcionarios acessam itens pedidos" ON public.order_items AS PERMISSIVE FOR ALL TO "authenticated" USING (public.can_manage_company(company_id)) WITH CHECK (public.can_manage_company(company_id));

CREATE POLICY "order_items_company_access" ON public.order_items AS PERMISSIVE FOR ALL TO PUBLIC USING ((EXISTS ( SELECT 1
   FROM companies c
  WHERE ((c.id = order_items.company_id) AND ((c.owner_id = auth.uid()) OR (c.tester_id = auth.uid()) OR (EXISTS ( SELECT 1
           FROM company_members m
          WHERE ((m.company_id = c.id) AND (m.user_id = auth.uid()) AND (m.status = 'ativo'::text))))))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM companies c
  WHERE ((c.id = order_items.company_id) AND ((c.owner_id = auth.uid()) OR (c.tester_id = auth.uid()) OR (EXISTS ( SELECT 1
           FROM company_members m
          WHERE ((m.company_id = c.id) AND (m.user_id = auth.uid()) AND (m.status = 'ativo'::text)))))))));

CREATE POLICY "order_payments_company_access" ON public.order_payments AS PERMISSIVE FOR ALL TO PUBLIC USING ((EXISTS ( SELECT 1
   FROM companies c
  WHERE ((c.id = order_payments.company_id) AND ((c.owner_id = auth.uid()) OR (c.tester_id = auth.uid()) OR (EXISTS ( SELECT 1
           FROM company_members m
          WHERE ((m.company_id = c.id) AND (m.user_id = auth.uid()) AND (m.status = 'ativo'::text))))))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM companies c
  WHERE ((c.id = order_payments.company_id) AND ((c.owner_id = auth.uid()) OR (c.tester_id = auth.uid()) OR (EXISTS ( SELECT 1
           FROM company_members m
          WHERE ((m.company_id = c.id) AND (m.user_id = auth.uid()) AND (m.status = 'ativo'::text)))))))));

CREATE POLICY "Dono ou tester atualiza pedidos" ON public.orders AS PERMISSIVE FOR UPDATE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM companies c
  WHERE ((c.id = orders.company_id) AND ((c.owner_id = auth.uid()) OR (c.tester_id = auth.uid())))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM companies c
  WHERE ((c.id = orders.company_id) AND ((c.owner_id = auth.uid()) OR (c.tester_id = auth.uid()))))));

CREATE POLICY "Dono ou tester vê pedidos" ON public.orders AS PERMISSIVE FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM companies c
  WHERE ((c.id = orders.company_id) AND ((c.owner_id = auth.uid()) OR (c.tester_id = auth.uid()))))));

CREATE POLICY "Funcionarios acessam pedidos" ON public.orders AS PERMISSIVE FOR ALL TO "authenticated" USING (public.can_manage_company(company_id)) WITH CHECK (public.can_manage_company(company_id));

CREATE POLICY "Funcionarios atualizam pedidos" ON public.orders AS PERMISSIVE FOR UPDATE TO "authenticated" USING (public.is_company_member(company_id)) WITH CHECK (public.is_company_member(company_id));

CREATE POLICY "Funcionarios veem pedidos" ON public.orders AS PERMISSIVE FOR SELECT TO "authenticated" USING (public.is_company_member(company_id));

CREATE POLICY "payment_methods_company_access" ON public.payment_methods AS PERMISSIVE FOR ALL TO PUBLIC USING ((EXISTS ( SELECT 1
   FROM companies c
  WHERE ((c.id = payment_methods.company_id) AND ((c.owner_id = auth.uid()) OR (c.tester_id = auth.uid()) OR (EXISTS ( SELECT 1
           FROM company_members m
          WHERE ((m.company_id = c.id) AND (m.user_id = auth.uid()) AND (m.status = 'ativo'::text))))))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM companies c
  WHERE ((c.id = payment_methods.company_id) AND ((c.owner_id = auth.uid()) OR (c.tester_id = auth.uid()) OR (EXISTS ( SELECT 1
           FROM company_members m
          WHERE ((m.company_id = c.id) AND (m.user_id = auth.uid()) AND (m.status = 'ativo'::text)))))))));

CREATE POLICY "payment_payouts_company_select" ON public.payment_payouts AS PERMISSIVE FOR SELECT TO "authenticated" USING (public.orcaly_user_has_company_access(company_id));

CREATE POLICY "payment_webhook_events_company_select" ON public.payment_webhook_events AS PERMISSIVE FOR SELECT TO "authenticated" USING (((company_id IS NOT NULL) AND public.orcaly_user_has_company_access(company_id)));

CREATE POLICY "Dono pode criar pagamento da propria empresa" ON public.plan_payments AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK ((EXISTS ( SELECT 1
   FROM companies c
  WHERE ((c.id = plan_payments.company_id) AND (c.owner_id = auth.uid())))));

CREATE POLICY "Dono pode ver pagamentos da propria empresa" ON public.plan_payments AS PERMISSIVE FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM companies c
  WHERE ((c.id = plan_payments.company_id) AND (c.owner_id = auth.uid())))));

CREATE POLICY "Empresa gerencia producao" ON public.production_orders AS PERMISSIVE FOR ALL TO "authenticated" USING (((EXISTS ( SELECT 1
   FROM companies c
  WHERE ((c.id = production_orders.company_id) AND ((c.owner_id = auth.uid()) OR (c.tester_id = auth.uid()))))) OR (EXISTS ( SELECT 1
   FROM company_members cm
  WHERE ((cm.company_id = production_orders.company_id) AND (cm.user_id = auth.uid()) AND (cm.status = 'ativo'::text)))) OR (EXISTS ( SELECT 1
   FROM admin_users au
  WHERE ((au.ativo = true) AND (lower(au.email) = lower((auth.jwt() ->> 'email'::text)))))))) WITH CHECK (((EXISTS ( SELECT 1
   FROM companies c
  WHERE ((c.id = production_orders.company_id) AND ((c.owner_id = auth.uid()) OR (c.tester_id = auth.uid()))))) OR (EXISTS ( SELECT 1
   FROM company_members cm
  WHERE ((cm.company_id = production_orders.company_id) AND (cm.user_id = auth.uid()) AND (cm.status = 'ativo'::text)))) OR (EXISTS ( SELECT 1
   FROM admin_users au
  WHERE ((au.ativo = true) AND (lower(au.email) = lower((auth.jwt() ->> 'email'::text))))))));

CREATE POLICY "Empresa gerencia producao plus" ON public.production_orders AS PERMISSIVE FOR ALL TO "authenticated" USING (((EXISTS ( SELECT 1
   FROM companies c
  WHERE ((c.id = production_orders.company_id) AND ((c.owner_id = auth.uid()) OR (c.tester_id = auth.uid()))))) OR (EXISTS ( SELECT 1
   FROM company_members cm
  WHERE ((cm.company_id = production_orders.company_id) AND (cm.user_id = auth.uid()) AND (cm.status = 'ativo'::text)))))) WITH CHECK (((EXISTS ( SELECT 1
   FROM companies c
  WHERE ((c.id = production_orders.company_id) AND ((c.owner_id = auth.uid()) OR (c.tester_id = auth.uid()))))) OR (EXISTS ( SELECT 1
   FROM company_members cm
  WHERE ((cm.company_id = production_orders.company_id) AND (cm.user_id = auth.uid()) AND (cm.status = 'ativo'::text))))));

CREATE POLICY "Empresa gerencia etapas producao" ON public.production_steps AS PERMISSIVE FOR ALL TO "authenticated" USING (((EXISTS ( SELECT 1
   FROM companies c
  WHERE ((c.id = production_steps.company_id) AND ((c.owner_id = auth.uid()) OR (c.tester_id = auth.uid()))))) OR (EXISTS ( SELECT 1
   FROM company_members cm
  WHERE ((cm.company_id = production_steps.company_id) AND (cm.user_id = auth.uid()) AND (cm.status = 'ativo'::text)))) OR (EXISTS ( SELECT 1
   FROM admin_users au
  WHERE ((au.ativo = true) AND (lower(au.email) = lower((auth.jwt() ->> 'email'::text)))))))) WITH CHECK (((EXISTS ( SELECT 1
   FROM companies c
  WHERE ((c.id = production_steps.company_id) AND ((c.owner_id = auth.uid()) OR (c.tester_id = auth.uid()))))) OR (EXISTS ( SELECT 1
   FROM company_members cm
  WHERE ((cm.company_id = production_steps.company_id) AND (cm.user_id = auth.uid()) AND (cm.status = 'ativo'::text)))) OR (EXISTS ( SELECT 1
   FROM admin_users au
  WHERE ((au.ativo = true) AND (lower(au.email) = lower((auth.jwt() ->> 'email'::text))))))));

CREATE POLICY "Dono ou tester apaga produtos" ON public.products AS PERMISSIVE FOR DELETE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM companies c
  WHERE ((c.id = products.company_id) AND ((c.owner_id = auth.uid()) OR (c.tester_id = auth.uid()))))));

CREATE POLICY "Dono ou tester atualiza produtos" ON public.products AS PERMISSIVE FOR UPDATE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM companies c
  WHERE ((c.id = products.company_id) AND ((c.owner_id = auth.uid()) OR (c.tester_id = auth.uid())))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM companies c
  WHERE ((c.id = products.company_id) AND ((c.owner_id = auth.uid()) OR (c.tester_id = auth.uid()))))));

CREATE POLICY "Dono ou tester cria produtos" ON public.products AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK ((EXISTS ( SELECT 1
   FROM companies c
  WHERE ((c.id = products.company_id) AND ((c.owner_id = auth.uid()) OR (c.tester_id = auth.uid()))))));

CREATE POLICY "Dono ou tester vê produtos" ON public.products AS PERMISSIVE FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM companies c
  WHERE ((c.id = products.company_id) AND ((c.owner_id = auth.uid()) OR (c.tester_id = auth.uid()))))));

CREATE POLICY "Funcionarios acessam produtos" ON public.products AS PERMISSIVE FOR ALL TO "authenticated" USING (public.can_manage_company(company_id)) WITH CHECK (public.can_manage_company(company_id));

CREATE POLICY "Funcionarios veem produtos" ON public.products AS PERMISSIVE FOR SELECT TO "authenticated" USING (public.is_company_member(company_id));

CREATE POLICY "Gerente gerencia produtos" ON public.products AS PERMISSIVE FOR ALL TO "authenticated" USING ((public.is_company_member(company_id) AND (public.my_company_role(company_id) = 'gerente'::text))) WITH CHECK ((public.is_company_member(company_id) AND (public.my_company_role(company_id) = 'gerente'::text)));

CREATE POLICY "Empresa insere eventos propostas" ON public.proposal_events AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK (public.can_manage_company(company_id));

CREATE POLICY "Empresa ve eventos propostas" ON public.proposal_events AS PERMISSIVE FOR SELECT TO "authenticated" USING (public.can_manage_company(company_id));

CREATE POLICY "Funcionarios acessam eventos propostas" ON public.proposal_events AS PERMISSIVE FOR ALL TO "authenticated" USING (public.can_manage_company(company_id)) WITH CHECK (public.can_manage_company(company_id));

CREATE POLICY "Dono ou tester gerencia propostas" ON public.proposals AS PERMISSIVE FOR ALL TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM companies c
  WHERE ((c.id = proposals.company_id) AND ((c.owner_id = auth.uid()) OR (c.tester_id = auth.uid())))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM companies c
  WHERE ((c.id = proposals.company_id) AND ((c.owner_id = auth.uid()) OR (c.tester_id = auth.uid()))))));

CREATE POLICY "Empresa gerencia propostas" ON public.proposals AS PERMISSIVE FOR ALL TO "authenticated" USING (public.can_manage_company(company_id)) WITH CHECK (public.can_manage_company(company_id));

CREATE POLICY "Equipe comercial gerencia propostas" ON public.proposals AS PERMISSIVE FOR ALL TO "authenticated" USING ((public.is_company_member(company_id) AND (public.my_company_role(company_id) = ANY (ARRAY['gerente'::text, 'atendente'::text])))) WITH CHECK ((public.is_company_member(company_id) AND (public.my_company_role(company_id) = ANY (ARRAY['gerente'::text, 'atendente'::text]))));

CREATE POLICY "Equipe comercial ve propostas" ON public.proposals AS PERMISSIVE FOR SELECT TO "authenticated" USING ((public.is_company_member(company_id) AND (public.my_company_role(company_id) = ANY (ARRAY['gerente'::text, 'atendente'::text]))));

CREATE POLICY "Funcionarios acessam propostas" ON public.proposals AS PERMISSIVE FOR ALL TO "authenticated" USING (public.can_manage_company(company_id)) WITH CHECK (public.can_manage_company(company_id));

CREATE POLICY "provider_customers_company_select" ON public.provider_customers AS PERMISSIVE FOR SELECT TO "authenticated" USING (public.orcaly_user_has_company_access(company_id));

CREATE POLICY "Dono ou tester gerencia modelos" ON public.quote_templates AS PERMISSIVE FOR ALL TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM companies c
  WHERE ((c.id = quote_templates.company_id) AND ((c.owner_id = auth.uid()) OR (c.tester_id = auth.uid())))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM companies c
  WHERE ((c.id = quote_templates.company_id) AND ((c.owner_id = auth.uid()) OR (c.tester_id = auth.uid()))))));

CREATE POLICY "Funcionarios acessam modelos orcamento" ON public.quote_templates AS PERMISSIVE FOR ALL TO "authenticated" USING (public.can_manage_company(company_id)) WITH CHECK (public.can_manage_company(company_id));

CREATE POLICY "Empresa gerencia recorrentes" ON public.recurring_orders AS PERMISSIVE FOR ALL TO "authenticated" USING (((EXISTS ( SELECT 1
   FROM companies c
  WHERE ((c.id = recurring_orders.company_id) AND ((c.owner_id = auth.uid()) OR (c.tester_id = auth.uid()))))) OR (EXISTS ( SELECT 1
   FROM company_members cm
  WHERE ((cm.company_id = recurring_orders.company_id) AND (cm.user_id = auth.uid()) AND (cm.status = 'ativo'::text)))))) WITH CHECK (((EXISTS ( SELECT 1
   FROM companies c
  WHERE ((c.id = recurring_orders.company_id) AND ((c.owner_id = auth.uid()) OR (c.tester_id = auth.uid()))))) OR (EXISTS ( SELECT 1
   FROM company_members cm
  WHERE ((cm.company_id = recurring_orders.company_id) AND (cm.user_id = auth.uid()) AND (cm.status = 'ativo'::text))))));

CREATE POLICY "Admins veem blocklist" ON public.security_blocklist AS PERMISSIVE FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM admin_users au
  WHERE ((au.ativo = true) AND (lower(au.email) = lower((auth.jwt() ->> 'email'::text)))))));

CREATE POLICY "Super admin gerencia blocklist" ON public.security_blocklist AS PERMISSIVE FOR ALL TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM admin_users au
  WHERE ((au.ativo = true) AND (au.role = 'super_admin'::text) AND (lower(au.email) = lower((auth.jwt() ->> 'email'::text))))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM admin_users au
  WHERE ((au.ativo = true) AND (au.role = 'super_admin'::text) AND (lower(au.email) = lower((auth.jwt() ->> 'email'::text)))))));

CREATE POLICY "Admins gerenciam eventos de seguranca" ON public.security_events AS PERMISSIVE FOR UPDATE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM admin_users au
  WHERE ((au.ativo = true) AND (lower(au.email) = lower((auth.jwt() ->> 'email'::text))))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM admin_users au
  WHERE ((au.ativo = true) AND (lower(au.email) = lower((auth.jwt() ->> 'email'::text)))))));

CREATE POLICY "Admins inserem eventos de seguranca" ON public.security_events AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK ((EXISTS ( SELECT 1
   FROM admin_users au
  WHERE ((au.ativo = true) AND (lower(au.email) = lower((auth.jwt() ->> 'email'::text)))))));

CREATE POLICY "Admins veem eventos de seguranca" ON public.security_events AS PERMISSIVE FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM admin_users au
  WHERE ((au.ativo = true) AND (lower(au.email) = lower((auth.jwt() ->> 'email'::text)))))));

CREATE POLICY "Dono ou tester vê eventos de segurança" ON public.security_events AS PERMISSIVE FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM companies c
  WHERE ((c.id = security_events.company_id) AND ((c.owner_id = auth.uid()) OR (c.tester_id = auth.uid()))))));

CREATE POLICY "Admin gerencia followups de leads" ON public.signup_lead_followups AS PERMISSIVE FOR ALL TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM admin_users au
  WHERE ((au.ativo = true) AND (lower(au.email) = lower((auth.jwt() ->> 'email'::text))))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM admin_users au
  WHERE ((au.ativo = true) AND (lower(au.email) = lower((auth.jwt() ->> 'email'::text)))))));

CREATE POLICY "Admin gerencia leads" ON public.signup_leads AS PERMISSIVE FOR ALL TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM admin_users au
  WHERE ((au.ativo = true) AND (lower(au.email) = lower((auth.jwt() ->> 'email'::text))))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM admin_users au
  WHERE ((au.ativo = true) AND (lower(au.email) = lower((auth.jwt() ->> 'email'::text)))))));

CREATE POLICY "Admin gerencia secoes do site" ON public.site_sections AS PERMISSIVE FOR ALL TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM admin_users au
  WHERE ((au.ativo = true) AND (lower(au.email) = lower((auth.jwt() ->> 'email'::text))))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM admin_users au
  WHERE ((au.ativo = true) AND (lower(au.email) = lower((auth.jwt() ->> 'email'::text)))))));

CREATE POLICY "Empresa gerencia secoes do site" ON public.site_sections AS PERMISSIVE FOR ALL TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM companies c
  WHERE ((c.id = site_sections.company_id) AND ((c.owner_id = auth.uid()) OR (c.tester_id = auth.uid())))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM companies c
  WHERE ((c.id = site_sections.company_id) AND ((c.owner_id = auth.uid()) OR (c.tester_id = auth.uid()))))));

CREATE POLICY "subscription_events_select_company" ON public.subscription_events AS PERMISSIVE FOR SELECT TO "authenticated" USING (((EXISTS ( SELECT 1
   FROM companies c
  WHERE ((c.id = subscription_events.company_id) AND ((c.owner_id = auth.uid()) OR (c.tester_id = auth.uid()))))) OR (EXISTS ( SELECT 1
   FROM company_members cm
  WHERE ((cm.company_id = subscription_events.company_id) AND (cm.user_id = auth.uid()) AND (cm.status = 'ativo'::text))))));

CREATE POLICY "Empresa ve whatsapp conversations" ON public.whatsapp_conversations AS PERMISSIVE FOR SELECT TO "authenticated" USING (((EXISTS ( SELECT 1
   FROM companies c
  WHERE ((c.id = whatsapp_conversations.company_id) AND ((c.owner_id = auth.uid()) OR (c.tester_id = auth.uid()))))) OR (EXISTS ( SELECT 1
   FROM company_members cm
  WHERE ((cm.company_id = whatsapp_conversations.company_id) AND (cm.user_id = auth.uid()) AND (cm.status = 'ativo'::text)))) OR (EXISTS ( SELECT 1
   FROM admin_users au
  WHERE ((au.ativo = true) AND (lower(au.email) = lower((auth.jwt() ->> 'email'::text))))))));

CREATE POLICY "Empresa ve whatsapp logs" ON public.whatsapp_message_logs AS PERMISSIVE FOR SELECT TO "authenticated" USING (((EXISTS ( SELECT 1
   FROM companies c
  WHERE ((c.id = whatsapp_message_logs.company_id) AND ((c.owner_id = auth.uid()) OR (c.tester_id = auth.uid()))))) OR (EXISTS ( SELECT 1
   FROM company_members cm
  WHERE ((cm.company_id = whatsapp_message_logs.company_id) AND (cm.user_id = auth.uid()) AND (cm.status = 'ativo'::text)))) OR (EXISTS ( SELECT 1
   FROM admin_users au
  WHERE ((au.ativo = true) AND (lower(au.email) = lower((auth.jwt() ->> 'email'::text))))))));
REVOKE ALL ON TABLE public.admin_audit_logs FROM PUBLIC, anon, authenticated, service_role;
GRANT INSERT, SELECT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE public.admin_audit_logs TO "postgres";
GRANT INSERT, SELECT, UPDATE, DELETE, MAINTAIN ON TABLE public.admin_audit_logs TO "authenticated";
GRANT INSERT, SELECT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE public.admin_audit_logs TO "service_role";
REVOKE ALL ON TABLE public.admin_bug_reports FROM PUBLIC, anon, authenticated, service_role;
GRANT INSERT, SELECT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE public.admin_bug_reports TO "postgres";
GRANT INSERT, SELECT, UPDATE, DELETE, MAINTAIN ON TABLE public.admin_bug_reports TO "authenticated";
GRANT INSERT, SELECT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE public.admin_bug_reports TO "service_role";
REVOKE ALL ON TABLE public.admin_scan_runs FROM PUBLIC, anon, authenticated, service_role;
GRANT INSERT, SELECT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE public.admin_scan_runs TO "postgres";
GRANT INSERT, SELECT, UPDATE, DELETE, MAINTAIN ON TABLE public.admin_scan_runs TO "authenticated";
GRANT INSERT, SELECT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE public.admin_scan_runs TO "service_role";
REVOKE ALL ON TABLE public.admin_signup_leads_overview FROM PUBLIC, anon, authenticated, service_role;
GRANT INSERT, SELECT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE public.admin_signup_leads_overview TO "postgres";
GRANT SELECT ON TABLE public.admin_signup_leads_overview TO "authenticated";
GRANT SELECT ON TABLE public.admin_signup_leads_overview TO "service_role";
REVOKE ALL ON TABLE public.admin_system_snapshots FROM PUBLIC, anon, authenticated, service_role;
GRANT INSERT, SELECT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE public.admin_system_snapshots TO "postgres";
GRANT INSERT, SELECT, UPDATE, DELETE, MAINTAIN ON TABLE public.admin_system_snapshots TO "authenticated";
GRANT INSERT, SELECT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE public.admin_system_snapshots TO "service_role";
REVOKE ALL ON TABLE public.admin_users FROM PUBLIC, anon, authenticated, service_role;
GRANT INSERT, SELECT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE public.admin_users TO "postgres";
GRANT INSERT, SELECT, UPDATE, DELETE, MAINTAIN ON TABLE public.admin_users TO "authenticated";
GRANT INSERT, SELECT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE public.admin_users TO "service_role";
REVOKE ALL ON TABLE public.app_notifications FROM PUBLIC, anon, authenticated, service_role;
GRANT INSERT, SELECT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE public.app_notifications TO "postgres";
GRANT INSERT, SELECT, UPDATE, DELETE, MAINTAIN ON TABLE public.app_notifications TO "authenticated";
GRANT INSERT, SELECT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE public.app_notifications TO "service_role";
REVOKE ALL ON TABLE public.art_approval_requests FROM PUBLIC, anon, authenticated, service_role;
GRANT INSERT, SELECT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE public.art_approval_requests TO "postgres";
GRANT INSERT, SELECT, UPDATE, DELETE, MAINTAIN ON TABLE public.art_approval_requests TO "authenticated";
GRANT INSERT, SELECT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE public.art_approval_requests TO "service_role";
REVOKE ALL ON TABLE public.business_hours FROM PUBLIC, anon, authenticated, service_role;
GRANT INSERT, SELECT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE public.business_hours TO "postgres";
GRANT INSERT, SELECT, UPDATE, DELETE, MAINTAIN ON TABLE public.business_hours TO "authenticated";
GRANT INSERT, SELECT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE public.business_hours TO "service_role";
REVOKE ALL ON TABLE public.companies FROM PUBLIC, anon, authenticated, service_role;
GRANT INSERT, SELECT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE public.companies TO "postgres";
GRANT INSERT, SELECT, UPDATE, DELETE, MAINTAIN ON TABLE public.companies TO "authenticated";
GRANT INSERT, SELECT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE public.companies TO "service_role";
REVOKE ALL ON TABLE public.company_members FROM PUBLIC, anon, authenticated, service_role;
GRANT INSERT, SELECT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE public.company_members TO "postgres";
GRANT INSERT, SELECT, UPDATE, DELETE, MAINTAIN ON TABLE public.company_members TO "authenticated";
GRANT INSERT, SELECT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE public.company_members TO "service_role";
REVOKE ALL ON TABLE public.company_niche_templates FROM PUBLIC, anon, authenticated, service_role;
GRANT INSERT, SELECT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE public.company_niche_templates TO "postgres";
GRANT INSERT, SELECT, UPDATE, DELETE, MAINTAIN ON TABLE public.company_niche_templates TO "authenticated";
GRANT INSERT, SELECT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE public.company_niche_templates TO "service_role";
REVOKE ALL ON TABLE public.company_proposal_settings FROM PUBLIC, anon, authenticated, service_role;
GRANT INSERT, SELECT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE public.company_proposal_settings TO "postgres";
GRANT INSERT, SELECT, UPDATE, DELETE, MAINTAIN ON TABLE public.company_proposal_settings TO "authenticated";
GRANT INSERT, SELECT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE public.company_proposal_settings TO "service_role";
REVOKE ALL ON TABLE public.company_whatsapp_settings FROM PUBLIC, anon, authenticated, service_role;
GRANT INSERT, SELECT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE public.company_whatsapp_settings TO "postgres";
GRANT INSERT, SELECT, UPDATE, DELETE, MAINTAIN ON TABLE public.company_whatsapp_settings TO "authenticated";
GRANT INSERT, SELECT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE public.company_whatsapp_settings TO "service_role";
REVOKE ALL ON TABLE public.crm_leads FROM PUBLIC, anon, authenticated, service_role;
GRANT INSERT, SELECT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE public.crm_leads TO "postgres";
GRANT INSERT, SELECT, UPDATE, DELETE, MAINTAIN ON TABLE public.crm_leads TO "authenticated";
GRANT INSERT, SELECT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE public.crm_leads TO "service_role";
REVOKE ALL ON TABLE public.customer_followups FROM PUBLIC, anon, authenticated, service_role;
GRANT INSERT, SELECT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE public.customer_followups TO "postgres";
GRANT INSERT, SELECT, UPDATE, DELETE, MAINTAIN ON TABLE public.customer_followups TO "authenticated";
GRANT INSERT, SELECT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE public.customer_followups TO "service_role";
REVOKE ALL ON TABLE public.customer_internal_notes FROM PUBLIC, anon, authenticated, service_role;
GRANT INSERT, SELECT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE public.customer_internal_notes TO "postgres";
GRANT INSERT, SELECT, UPDATE, DELETE, MAINTAIN ON TABLE public.customer_internal_notes TO "authenticated";
GRANT INSERT, SELECT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE public.customer_internal_notes TO "service_role";
REVOKE ALL ON TABLE public.customer_magic_links FROM PUBLIC, anon, authenticated, service_role;
GRANT INSERT, SELECT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE public.customer_magic_links TO "postgres";
GRANT INSERT, SELECT, UPDATE, DELETE, MAINTAIN ON TABLE public.customer_magic_links TO "authenticated";
GRANT INSERT, SELECT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE public.customer_magic_links TO "service_role";
REVOKE ALL ON TABLE public.customer_notes FROM PUBLIC, anon, authenticated, service_role;
GRANT INSERT, SELECT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE public.customer_notes TO "postgres";
GRANT INSERT, SELECT, UPDATE, DELETE, MAINTAIN ON TABLE public.customer_notes TO "authenticated";
GRANT INSERT, SELECT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE public.customer_notes TO "service_role";
REVOKE ALL ON TABLE public.customer_portal_events FROM PUBLIC, anon, authenticated, service_role;
GRANT INSERT, SELECT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE public.customer_portal_events TO "postgres";
GRANT INSERT, SELECT, UPDATE, DELETE, MAINTAIN ON TABLE public.customer_portal_events TO "authenticated";
GRANT INSERT, SELECT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE public.customer_portal_events TO "service_role";
REVOKE ALL ON TABLE public.deliveries FROM PUBLIC, anon, authenticated, service_role;
GRANT INSERT, SELECT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE public.deliveries TO "postgres";
GRANT INSERT, SELECT, UPDATE, DELETE, MAINTAIN ON TABLE public.deliveries TO "authenticated";
GRANT INSERT, SELECT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE public.deliveries TO "service_role";
REVOKE ALL ON TABLE public.delivery_zones FROM PUBLIC, anon, authenticated, service_role;
GRANT INSERT, SELECT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE public.delivery_zones TO "postgres";
GRANT INSERT, SELECT, UPDATE, DELETE, MAINTAIN ON TABLE public.delivery_zones TO "authenticated";
GRANT INSERT, SELECT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE public.delivery_zones TO "service_role";
REVOKE ALL ON TABLE public.finance_accounts FROM PUBLIC, anon, authenticated, service_role;
GRANT INSERT, SELECT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE public.finance_accounts TO "postgres";
GRANT INSERT, SELECT, UPDATE, DELETE, MAINTAIN ON TABLE public.finance_accounts TO "authenticated";
GRANT INSERT, SELECT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE public.finance_accounts TO "service_role";
REVOKE ALL ON TABLE public.financial_categories FROM PUBLIC, anon, authenticated, service_role;
GRANT INSERT, SELECT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE public.financial_categories TO "postgres";
GRANT INSERT, SELECT, UPDATE, DELETE, MAINTAIN ON TABLE public.financial_categories TO "authenticated";
GRANT INSERT, SELECT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE public.financial_categories TO "service_role";
REVOKE ALL ON TABLE public.financial_material_entries FROM PUBLIC, anon, authenticated, service_role;
GRANT INSERT, SELECT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE public.financial_material_entries TO "postgres";
GRANT INSERT, SELECT, UPDATE, DELETE, MAINTAIN ON TABLE public.financial_material_entries TO "authenticated";
GRANT INSERT, SELECT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE public.financial_material_entries TO "service_role";
REVOKE ALL ON TABLE public.financial_transactions FROM PUBLIC, anon, authenticated, service_role;
GRANT INSERT, SELECT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE public.financial_transactions TO "postgres";
GRANT INSERT, SELECT, UPDATE, DELETE, MAINTAIN ON TABLE public.financial_transactions TO "authenticated";
GRANT INSERT, SELECT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE public.financial_transactions TO "service_role";
REVOKE ALL ON TABLE public.internal_tasks FROM PUBLIC, anon, authenticated, service_role;
GRANT INSERT, SELECT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE public.internal_tasks TO "postgres";
GRANT INSERT, SELECT, UPDATE, DELETE, MAINTAIN ON TABLE public.internal_tasks TO "authenticated";
GRANT INSERT, SELECT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE public.internal_tasks TO "service_role";
REVOKE ALL ON TABLE public.marketplace_commission_rules FROM PUBLIC, anon, authenticated, service_role;
GRANT INSERT, SELECT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE public.marketplace_commission_rules TO "postgres";
GRANT INSERT, SELECT, UPDATE, DELETE, MAINTAIN ON TABLE public.marketplace_commission_rules TO "authenticated";
GRANT INSERT, SELECT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE public.marketplace_commission_rules TO "service_role";
REVOKE ALL ON TABLE public.marketplace_commissions FROM PUBLIC, anon, authenticated, service_role;
GRANT INSERT, SELECT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE public.marketplace_commissions TO "postgres";
GRANT INSERT, SELECT, UPDATE, DELETE, MAINTAIN ON TABLE public.marketplace_commissions TO "authenticated";
GRANT INSERT, SELECT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE public.marketplace_commissions TO "service_role";
REVOKE ALL ON TABLE public.marketplace_coupons FROM PUBLIC, anon, authenticated, service_role;
GRANT INSERT, SELECT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE public.marketplace_coupons TO "postgres";
GRANT INSERT, SELECT, UPDATE, DELETE, MAINTAIN ON TABLE public.marketplace_coupons TO "authenticated";
GRANT INSERT, SELECT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE public.marketplace_coupons TO "service_role";
REVOKE ALL ON TABLE public.marketplace_oauth_states FROM PUBLIC, anon, authenticated, service_role;
GRANT INSERT, SELECT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE public.marketplace_oauth_states TO "postgres";
GRANT INSERT, SELECT, UPDATE, DELETE, MAINTAIN ON TABLE public.marketplace_oauth_states TO "authenticated";
GRANT INSERT, SELECT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE public.marketplace_oauth_states TO "service_role";
REVOKE ALL ON TABLE public.marketplace_payment_settings FROM PUBLIC, anon, authenticated, service_role;
GRANT INSERT, SELECT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE public.marketplace_payment_settings TO "postgres";
GRANT INSERT, SELECT, UPDATE, DELETE, MAINTAIN ON TABLE public.marketplace_payment_settings TO "authenticated";
GRANT INSERT, SELECT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE public.marketplace_payment_settings TO "service_role";
REVOKE ALL ON TABLE public.marketplace_payments FROM PUBLIC, anon, authenticated, service_role;
GRANT INSERT, SELECT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE public.marketplace_payments TO "postgres";
GRANT INSERT, SELECT, UPDATE, DELETE, MAINTAIN ON TABLE public.marketplace_payments TO "authenticated";
GRANT INSERT, SELECT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE public.marketplace_payments TO "service_role";
REVOKE ALL ON TABLE public.notifications FROM PUBLIC, anon, authenticated, service_role;
GRANT INSERT, SELECT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE public.notifications TO "postgres";
GRANT INSERT, SELECT, UPDATE, DELETE, MAINTAIN ON TABLE public.notifications TO "authenticated";
GRANT INSERT, SELECT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE public.notifications TO "service_role";
REVOKE ALL ON TABLE public.orcaly_company_health FROM PUBLIC, anon, authenticated, service_role;
GRANT INSERT, SELECT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE public.orcaly_company_health TO "postgres";
GRANT SELECT ON TABLE public.orcaly_company_health TO "service_role";
REVOKE ALL ON TABLE public.order_internal_comments FROM PUBLIC, anon, authenticated, service_role;
GRANT INSERT, SELECT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE public.order_internal_comments TO "postgres";
GRANT INSERT, SELECT, UPDATE, DELETE, MAINTAIN ON TABLE public.order_internal_comments TO "authenticated";
GRANT INSERT, SELECT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE public.order_internal_comments TO "service_role";
REVOKE ALL ON TABLE public.order_items FROM PUBLIC, anon, authenticated, service_role;
GRANT INSERT, SELECT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE public.order_items TO "postgres";
GRANT INSERT, SELECT, UPDATE, DELETE, MAINTAIN ON TABLE public.order_items TO "authenticated";
GRANT INSERT, SELECT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE public.order_items TO "service_role";
REVOKE ALL ON TABLE public.order_payments FROM PUBLIC, anon, authenticated, service_role;
GRANT INSERT, SELECT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE public.order_payments TO "postgres";
GRANT INSERT, SELECT, UPDATE, DELETE, MAINTAIN ON TABLE public.order_payments TO "authenticated";
GRANT INSERT, SELECT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE public.order_payments TO "service_role";
REVOKE ALL ON TABLE public.order_status_history FROM PUBLIC, anon, authenticated, service_role;
GRANT INSERT, SELECT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE public.order_status_history TO "postgres";
GRANT INSERT, SELECT, UPDATE, DELETE, MAINTAIN ON TABLE public.order_status_history TO "authenticated";
GRANT INSERT, SELECT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE public.order_status_history TO "service_role";
REVOKE ALL ON TABLE public.orders FROM PUBLIC, anon, authenticated, service_role;
GRANT INSERT, SELECT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE public.orders TO "postgres";
GRANT SELECT, DELETE, MAINTAIN ON TABLE public.orders TO "authenticated";
GRANT INSERT, SELECT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE public.orders TO "service_role";
GRANT INSERT ("nome"), UPDATE ("nome") ON TABLE public.orders TO "authenticated";
GRANT INSERT ("telefone"), UPDATE ("telefone") ON TABLE public.orders TO "authenticated";
GRANT INSERT ("produto"), UPDATE ("produto") ON TABLE public.orders TO "authenticated";
GRANT INSERT ("largura"), UPDATE ("largura") ON TABLE public.orders TO "authenticated";
GRANT INSERT ("altura"), UPDATE ("altura") ON TABLE public.orders TO "authenticated";
GRANT INSERT ("quantidade"), UPDATE ("quantidade") ON TABLE public.orders TO "authenticated";
GRANT INSERT ("observacoes"), UPDATE ("observacoes") ON TABLE public.orders TO "authenticated";
GRANT INSERT ("status"), UPDATE ("status") ON TABLE public.orders TO "authenticated";
GRANT INSERT ("preco_estimado"), UPDATE ("preco_estimado") ON TABLE public.orders TO "authenticated";
GRANT INSERT ("arquivo_url"), UPDATE ("arquivo_url") ON TABLE public.orders TO "authenticated";
GRANT INSERT ("company_id") ON TABLE public.orders TO "authenticated";
GRANT INSERT ("valor_total"), UPDATE ("valor_total") ON TABLE public.orders TO "authenticated";
GRANT INSERT ("valor_sinal"), UPDATE ("valor_sinal") ON TABLE public.orders TO "authenticated";
GRANT INSERT ("percentual_sinal"), UPDATE ("percentual_sinal") ON TABLE public.orders TO "authenticated";
GRANT INSERT ("forma_pagamento"), UPDATE ("forma_pagamento") ON TABLE public.orders TO "authenticated";
GRANT INSERT ("parcelas"), UPDATE ("parcelas") ON TABLE public.orders TO "authenticated";
GRANT INSERT ("itens_resumo"), UPDATE ("itens_resumo") ON TABLE public.orders TO "authenticated";
GRANT INSERT ("cliente_empresa"), UPDATE ("cliente_empresa") ON TABLE public.orders TO "authenticated";
GRANT INSERT ("dados_inteligentes"), UPDATE ("dados_inteligentes") ON TABLE public.orders TO "authenticated";
GRANT INSERT ("marketplace_origem"), UPDATE ("marketplace_origem") ON TABLE public.orders TO "authenticated";
GRANT INSERT ("prazo"), UPDATE ("prazo") ON TABLE public.orders TO "authenticated";
GRANT INSERT ("priority"), UPDATE ("priority") ON TABLE public.orders TO "authenticated";
GRANT INSERT ("internal_notes"), UPDATE ("internal_notes") ON TABLE public.orders TO "authenticated";
GRANT INSERT ("files"), UPDATE ("files") ON TABLE public.orders TO "authenticated";
GRANT INSERT ("source"), UPDATE ("source") ON TABLE public.orders TO "authenticated";
GRANT INSERT ("original_order_id"), UPDATE ("original_order_id") ON TABLE public.orders TO "authenticated";
GRANT INSERT ("cupom_id"), UPDATE ("cupom_id") ON TABLE public.orders TO "authenticated";
GRANT INSERT ("cupom_codigo"), UPDATE ("cupom_codigo") ON TABLE public.orders TO "authenticated";
GRANT INSERT ("valor_desconto"), UPDATE ("valor_desconto") ON TABLE public.orders TO "authenticated";
GRANT INSERT ("valor_total_original"), UPDATE ("valor_total_original") ON TABLE public.orders TO "authenticated";
GRANT INSERT ("prioridade"), UPDATE ("prioridade") ON TABLE public.orders TO "authenticated";
GRANT INSERT ("prazo_entrega"), UPDATE ("prazo_entrega") ON TABLE public.orders TO "authenticated";
GRANT INSERT ("responsavel_id"), UPDATE ("responsavel_id") ON TABLE public.orders TO "authenticated";
GRANT INSERT ("canal_origem"), UPDATE ("canal_origem") ON TABLE public.orders TO "authenticated";
GRANT INSERT ("endereco_entrega"), UPDATE ("endereco_entrega") ON TABLE public.orders TO "authenticated";
GRANT INSERT ("observacoes_internas"), UPDATE ("observacoes_internas") ON TABLE public.orders TO "authenticated";
GRANT UPDATE ("aprovado_em") ON TABLE public.orders TO "authenticated";
GRANT UPDATE ("entregue_em") ON TABLE public.orders TO "authenticated";
GRANT UPDATE ("cancelado_em") ON TABLE public.orders TO "authenticated";
GRANT UPDATE ("updated_at") ON TABLE public.orders TO "authenticated";
GRANT INSERT ("responsavel_nome"), UPDATE ("responsavel_nome") ON TABLE public.orders TO "authenticated";
GRANT UPDATE ("visualizado_em") ON TABLE public.orders TO "authenticated";
GRANT UPDATE ("notificado_em") ON TABLE public.orders TO "authenticated";
GRANT INSERT ("delivery_type"), UPDATE ("delivery_type") ON TABLE public.orders TO "authenticated";
GRANT INSERT ("delivery_fee"), UPDATE ("delivery_fee") ON TABLE public.orders TO "authenticated";
GRANT INSERT ("subtotal"), UPDATE ("subtotal") ON TABLE public.orders TO "authenticated";
GRANT INSERT ("total_amount"), UPDATE ("total_amount") ON TABLE public.orders TO "authenticated";
GRANT INSERT ("payment_method_id"), UPDATE ("payment_method_id") ON TABLE public.orders TO "authenticated";
GRANT INSERT ("delivery_zone_id"), UPDATE ("delivery_zone_id") ON TABLE public.orders TO "authenticated";
GRANT INSERT ("address"), UPDATE ("address") ON TABLE public.orders TO "authenticated";
GRANT INSERT ("neighborhood"), UPDATE ("neighborhood") ON TABLE public.orders TO "authenticated";
GRANT INSERT ("complement"), UPDATE ("complement") ON TABLE public.orders TO "authenticated";
GRANT INSERT ("reference_point"), UPDATE ("reference_point") ON TABLE public.orders TO "authenticated";
GRANT INSERT ("change_for"), UPDATE ("change_for") ON TABLE public.orders TO "authenticated";
GRANT INSERT ("items_snapshot"), UPDATE ("items_snapshot") ON TABLE public.orders TO "authenticated";
GRANT INSERT ("discount_amount"), UPDATE ("discount_amount") ON TABLE public.orders TO "authenticated";
GRANT INSERT ("coupon_code"), UPDATE ("coupon_code") ON TABLE public.orders TO "authenticated";
GRANT INSERT ("customer_name"), UPDATE ("customer_name") ON TABLE public.orders TO "authenticated";
GRANT INSERT ("customer_email"), UPDATE ("customer_email") ON TABLE public.orders TO "authenticated";
GRANT INSERT ("customer_phone"), UPDATE ("customer_phone") ON TABLE public.orders TO "authenticated";
GRANT INSERT ("total"), UPDATE ("total") ON TABLE public.orders TO "authenticated";
GRANT INSERT ("payment_method"), UPDATE ("payment_method") ON TABLE public.orders TO "authenticated";
GRANT INSERT ("coupon_id"), UPDATE ("coupon_id") ON TABLE public.orders TO "authenticated";
REVOKE ALL ON TABLE public.payment_methods FROM PUBLIC, anon, authenticated, service_role;
GRANT INSERT, SELECT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE public.payment_methods TO "postgres";
GRANT INSERT, SELECT, UPDATE, DELETE, MAINTAIN ON TABLE public.payment_methods TO "authenticated";
GRANT INSERT, SELECT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE public.payment_methods TO "service_role";
REVOKE ALL ON TABLE public.payment_payouts FROM PUBLIC, anon, authenticated, service_role;
GRANT INSERT, SELECT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE public.payment_payouts TO "postgres";
GRANT INSERT, SELECT, UPDATE, DELETE, MAINTAIN ON TABLE public.payment_payouts TO "authenticated";
GRANT INSERT, SELECT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE public.payment_payouts TO "service_role";
COMMENT ON TABLE public.payment_payouts IS 'Registro de repasses informados pelo provider. Nao representa saldo ficticio.';
REVOKE ALL ON TABLE public.payment_webhook_events FROM PUBLIC, anon, authenticated, service_role;
GRANT INSERT, SELECT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE public.payment_webhook_events TO "postgres";
GRANT INSERT, SELECT, UPDATE, DELETE, MAINTAIN ON TABLE public.payment_webhook_events TO "authenticated";
GRANT INSERT, SELECT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE public.payment_webhook_events TO "service_role";
COMMENT ON TABLE public.payment_webhook_events IS 'Eventos financeiros idempotentes e sanitizados. Escrita exclusiva do backend com service role.';
REVOKE ALL ON TABLE public.plan_payments FROM PUBLIC, anon, authenticated, service_role;
GRANT INSERT, SELECT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE public.plan_payments TO "postgres";
GRANT INSERT, SELECT, UPDATE, DELETE, MAINTAIN ON TABLE public.plan_payments TO "authenticated";
GRANT INSERT, SELECT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE public.plan_payments TO "service_role";
REVOKE ALL ON TABLE public.platform_admins FROM PUBLIC, anon, authenticated, service_role;
GRANT INSERT, SELECT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE public.platform_admins TO "postgres";
GRANT INSERT, SELECT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE public.platform_admins TO "service_role";
COMMENT ON TABLE public.platform_admins IS 'Equipe interna do Orcaly. Owner possui controle total; support usa permissoes granulares.';
REVOKE ALL ON TABLE public.production_dashboard FROM PUBLIC, anon, authenticated, service_role;
GRANT INSERT, SELECT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE public.production_dashboard TO "postgres";
GRANT SELECT ON TABLE public.production_dashboard TO "authenticated";
GRANT SELECT ON TABLE public.production_dashboard TO "service_role";
REVOKE ALL ON TABLE public.production_orders FROM PUBLIC, anon, authenticated, service_role;
GRANT INSERT, SELECT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE public.production_orders TO "postgres";
GRANT INSERT, SELECT, UPDATE, DELETE, MAINTAIN ON TABLE public.production_orders TO "authenticated";
GRANT INSERT, SELECT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE public.production_orders TO "service_role";
REVOKE ALL ON TABLE public.production_steps FROM PUBLIC, anon, authenticated, service_role;
GRANT INSERT, SELECT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE public.production_steps TO "postgres";
GRANT INSERT, SELECT, UPDATE, DELETE, MAINTAIN ON TABLE public.production_steps TO "authenticated";
GRANT INSERT, SELECT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE public.production_steps TO "service_role";
REVOKE ALL ON TABLE public.products FROM PUBLIC, anon, authenticated, service_role;
GRANT INSERT, SELECT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE public.products TO "postgres";
GRANT INSERT, SELECT, UPDATE, DELETE, MAINTAIN ON TABLE public.products TO "authenticated";
GRANT INSERT, SELECT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE public.products TO "service_role";
REVOKE ALL ON TABLE public.proposal_events FROM PUBLIC, anon, authenticated, service_role;
GRANT INSERT, SELECT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE public.proposal_events TO "postgres";
GRANT INSERT, SELECT, UPDATE, DELETE, MAINTAIN ON TABLE public.proposal_events TO "authenticated";
GRANT INSERT, SELECT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE public.proposal_events TO "service_role";
REVOKE ALL ON TABLE public.proposals FROM PUBLIC, anon, authenticated, service_role;
GRANT INSERT, SELECT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE public.proposals TO "postgres";
GRANT INSERT, SELECT, UPDATE, DELETE, MAINTAIN ON TABLE public.proposals TO "authenticated";
GRANT INSERT, SELECT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE public.proposals TO "service_role";
REVOKE ALL ON TABLE public.proposals_dashboard FROM PUBLIC, anon, authenticated, service_role;
GRANT INSERT, SELECT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE public.proposals_dashboard TO "postgres";
GRANT SELECT ON TABLE public.proposals_dashboard TO "authenticated";
GRANT SELECT ON TABLE public.proposals_dashboard TO "service_role";
REVOKE ALL ON TABLE public.provider_customers FROM PUBLIC, anon, authenticated, service_role;
GRANT INSERT, SELECT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE public.provider_customers TO "postgres";
GRANT INSERT, SELECT, UPDATE, DELETE, MAINTAIN ON TABLE public.provider_customers TO "authenticated";
GRANT INSERT, SELECT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE public.provider_customers TO "service_role";
COMMENT ON TABLE public.provider_customers IS 'Mapeamento de clientes internos para identificadores do provider.';
REVOKE ALL ON TABLE public.quote_templates FROM PUBLIC, anon, authenticated, service_role;
GRANT INSERT, SELECT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE public.quote_templates TO "postgres";
GRANT INSERT, SELECT, UPDATE, DELETE, MAINTAIN ON TABLE public.quote_templates TO "authenticated";
GRANT INSERT, SELECT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE public.quote_templates TO "service_role";
REVOKE ALL ON TABLE public.recurring_orders FROM PUBLIC, anon, authenticated, service_role;
GRANT INSERT, SELECT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE public.recurring_orders TO "postgres";
GRANT INSERT, SELECT, UPDATE, DELETE, MAINTAIN ON TABLE public.recurring_orders TO "authenticated";
GRANT INSERT, SELECT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE public.recurring_orders TO "service_role";
REVOKE ALL ON TABLE public.security_blocklist FROM PUBLIC, anon, authenticated, service_role;
GRANT INSERT, SELECT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE public.security_blocklist TO "postgres";
GRANT INSERT, SELECT, UPDATE, DELETE, MAINTAIN ON TABLE public.security_blocklist TO "authenticated";
GRANT INSERT, SELECT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE public.security_blocklist TO "service_role";
REVOKE ALL ON TABLE public.security_events FROM PUBLIC, anon, authenticated, service_role;
GRANT INSERT, SELECT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE public.security_events TO "postgres";
GRANT INSERT, SELECT, UPDATE, DELETE, MAINTAIN ON TABLE public.security_events TO "authenticated";
GRANT INSERT, SELECT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE public.security_events TO "service_role";
REVOKE ALL ON TABLE public.signup_lead_followups FROM PUBLIC, anon, authenticated, service_role;
GRANT INSERT, SELECT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE public.signup_lead_followups TO "postgres";
GRANT INSERT, SELECT, UPDATE, DELETE, MAINTAIN ON TABLE public.signup_lead_followups TO "authenticated";
GRANT INSERT, SELECT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE public.signup_lead_followups TO "service_role";
REVOKE ALL ON TABLE public.signup_leads FROM PUBLIC, anon, authenticated, service_role;
GRANT INSERT, SELECT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE public.signup_leads TO "postgres";
GRANT INSERT, SELECT, UPDATE, DELETE, MAINTAIN ON TABLE public.signup_leads TO "authenticated";
GRANT INSERT, SELECT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE public.signup_leads TO "service_role";
REVOKE ALL ON TABLE public.site_sections FROM PUBLIC, anon, authenticated, service_role;
GRANT INSERT, SELECT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE public.site_sections TO "postgres";
GRANT INSERT, SELECT, UPDATE, DELETE, MAINTAIN ON TABLE public.site_sections TO "authenticated";
GRANT INSERT, SELECT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE public.site_sections TO "service_role";
REVOKE ALL ON TABLE public.site_template_presets FROM PUBLIC, anon, authenticated, service_role;
GRANT INSERT, SELECT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE public.site_template_presets TO "postgres";
GRANT INSERT, SELECT, UPDATE, DELETE, MAINTAIN ON TABLE public.site_template_presets TO "authenticated";
GRANT INSERT, SELECT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE public.site_template_presets TO "service_role";
REVOKE ALL ON TABLE public.smart_notification_events FROM PUBLIC, anon, authenticated, service_role;
GRANT INSERT, SELECT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE public.smart_notification_events TO "postgres";
GRANT INSERT, SELECT, UPDATE, DELETE, MAINTAIN ON TABLE public.smart_notification_events TO "authenticated";
GRANT INSERT, SELECT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE public.smart_notification_events TO "service_role";
REVOKE ALL ON TABLE public.smart_notification_settings FROM PUBLIC, anon, authenticated, service_role;
GRANT INSERT, SELECT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE public.smart_notification_settings TO "postgres";
GRANT INSERT, SELECT, UPDATE, DELETE, MAINTAIN ON TABLE public.smart_notification_settings TO "authenticated";
GRANT INSERT, SELECT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE public.smart_notification_settings TO "service_role";
REVOKE ALL ON TABLE public.subscription_events FROM PUBLIC, anon, authenticated, service_role;
GRANT INSERT, SELECT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE public.subscription_events TO "postgres";
GRANT INSERT, SELECT, UPDATE, DELETE, MAINTAIN ON TABLE public.subscription_events TO "authenticated";
GRANT INSERT, SELECT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE public.subscription_events TO "service_role";
REVOKE ALL ON TABLE public.system_audit_logs FROM PUBLIC, anon, authenticated, service_role;
GRANT INSERT, SELECT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE public.system_audit_logs TO "postgres";
GRANT INSERT, SELECT, UPDATE, DELETE, MAINTAIN ON TABLE public.system_audit_logs TO "authenticated";
GRANT INSERT, SELECT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE public.system_audit_logs TO "service_role";
REVOKE ALL ON TABLE public.whatsapp_conversations FROM PUBLIC, anon, authenticated, service_role;
GRANT INSERT, SELECT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE public.whatsapp_conversations TO "postgres";
GRANT INSERT, SELECT, UPDATE, DELETE, MAINTAIN ON TABLE public.whatsapp_conversations TO "authenticated";
GRANT INSERT, SELECT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE public.whatsapp_conversations TO "service_role";
REVOKE ALL ON TABLE public.whatsapp_message_logs FROM PUBLIC, anon, authenticated, service_role;
GRANT INSERT, SELECT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE public.whatsapp_message_logs TO "postgres";
GRANT SELECT, MAINTAIN ON TABLE public.whatsapp_message_logs TO "authenticated";
GRANT INSERT, SELECT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE public.whatsapp_message_logs TO "service_role";
GRANT EXECUTE ON FUNCTION public.check_company_member_limit() TO "postgres";
GRANT EXECUTE ON FUNCTION public.check_company_member_limit() TO "authenticated";
GRANT EXECUTE ON FUNCTION public.check_company_member_limit() TO "service_role";
GRANT EXECUTE ON FUNCTION public.create_default_site_for_company(p_company_id uuid) TO "postgres";
GRANT EXECUTE ON FUNCTION public.create_default_site_for_company(p_company_id uuid) TO "service_role";
GRANT EXECUTE ON FUNCTION public.is_company_member(p_company_id uuid) TO "postgres";
GRANT EXECUTE ON FUNCTION public.is_company_member(p_company_id uuid) TO "authenticated";
GRANT EXECUTE ON FUNCTION public.is_company_member(p_company_id uuid) TO "service_role";
GRANT EXECUTE ON FUNCTION public.is_company_owner(p_company_id uuid) TO "postgres";
GRANT EXECUTE ON FUNCTION public.is_company_owner(p_company_id uuid) TO "authenticated";
GRANT EXECUTE ON FUNCTION public.is_company_owner(p_company_id uuid) TO "service_role";
GRANT EXECUTE ON FUNCTION public.my_company_role(p_company_id uuid) TO "postgres";
GRANT EXECUTE ON FUNCTION public.my_company_role(p_company_id uuid) TO "authenticated";
GRANT EXECUTE ON FUNCTION public.my_company_role(p_company_id uuid) TO "service_role";
GRANT EXECUTE ON FUNCTION public.orcaly_user_has_company_access(target_company uuid) TO "postgres";
GRANT EXECUTE ON FUNCTION public.orcaly_user_has_company_access(target_company uuid) TO "authenticated";
GRANT EXECUTE ON FUNCTION public.orcaly_user_has_company_access(target_company uuid) TO "service_role";
GRANT EXECUTE ON FUNCTION public.claim_company_subscription_trial(p_company_id uuid) TO "postgres";
GRANT EXECUTE ON FUNCTION public.claim_company_subscription_trial(p_company_id uuid) TO "service_role";
GRANT EXECUTE ON FUNCTION public.company_member_touch() TO "postgres";
GRANT EXECUTE ON FUNCTION public.company_member_touch() TO "service_role";
GRANT EXECUTE ON FUNCTION public.finance_touch_updated_at() TO "postgres";
GRANT EXECUTE ON FUNCTION public.finance_touch_updated_at() TO "service_role";
GRANT EXECUTE ON FUNCTION public.limit_company_members() TO "postgres";
GRANT EXECUTE ON FUNCTION public.limit_company_members() TO "service_role";
GRANT EXECUTE ON FUNCTION public.protect_company_trial_used_at() TO "postgres";
GRANT EXECUTE ON FUNCTION public.protect_company_trial_used_at() TO "service_role";
GRANT EXECUTE ON FUNCTION public.set_company_subdomain_slug() TO "postgres";
GRANT EXECUTE ON FUNCTION public.set_company_subdomain_slug() TO "service_role";
GRANT EXECUTE ON FUNCTION public.set_updated_at() TO "postgres";
GRANT EXECUTE ON FUNCTION public.set_updated_at() TO "service_role";
GRANT EXECUTE ON FUNCTION public.touch_signup_lead_updated_at() TO "postgres";
GRANT EXECUTE ON FUNCTION public.touch_signup_lead_updated_at() TO "service_role";

INSERT INTO storage.buckets (id,name,public,file_size_limit,allowed_mime_types) VALUES ('artes','artes',true,10485760,ARRAY['image/jpeg','image/png','image/webp','application/pdf']::text[]);

INSERT INTO storage.buckets (id,name,public,file_size_limit,allowed_mime_types) VALUES ('financeiro','financeiro',false,26214400,NULL);

INSERT INTO storage.buckets (id,name,public,file_size_limit,allowed_mime_types) VALUES ('logos','logos',true,5242880,NULL);

INSERT INTO storage.buckets (id,name,public,file_size_limit,allowed_mime_types) VALUES ('product-images','product-images',true,26214400,NULL);

INSERT INTO storage.buckets (id,name,public,file_size_limit,allowed_mime_types) VALUES ('produtos','produtos',true,26214400,NULL);

INSERT INTO storage.buckets (id,name,public,file_size_limit,allowed_mime_types) VALUES ('site-assets','site-assets',true,10485760,ARRAY['image/jpeg','image/png','image/webp','image/gif']::text[]);
COMMIT;
