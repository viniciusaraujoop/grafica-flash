import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import {
  getDefaultSetupForBusiness,
  normalizeBusinessType,
} from "@/lib/business-types";
import { normalizeSubdomainSlug } from "@/lib/slug";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    persistSession: false,
  },
});

const DAY_MS = 86_400_000;

function criarSlug(valor: string) {
  return normalizeSubdomainSlug(valor) || `empresa-${Date.now()}`;
}

function criarSubdomain(valor: string) {
  return criarSlug(valor).replace(/[^a-z0-9-]/g, "").slice(0, 42);
}

function erro(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

function safeRawData(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  return value as Record<string, unknown>;
}

function safeRecord(value: unknown): Record<string, unknown> {
  return safeRawData(value);
}

function removeOptionalCompanyFields(payload: Record<string, unknown>) {
  const copy = { ...payload };

  for (const key of [
    "business_type",
    "onboarding_goal",
    "site_template",
    "site_headline",
    "site_subheadline",
    "site_about_title",
    "site_about_text",
    "site_benefits",
    "site_faq",
    "site_features",
    "site_updated_at",
    "trial_started_at",
    "trial_ends_at",
    "trial_used_at",
    "access_until",
    "cancel_at_period_end",
    "subscription_provider",
    "provider_subscription_id",
    "next_billing_at",
    "mercado_pago_subscription_id",
    "mercado_pago_subscription_status",
    "mercado_pago_customer_email",
    "assinatura_auto_recorrente",
    "assinatura_proxima_cobranca",
  ]) {
    delete copy[key];
  }

  return copy;
}

async function insertCompany(payload: Record<string, unknown>) {
  const { data, error } = await supabaseAdmin
    .from("companies")
    .insert(payload)
    .select("id, slug, subdomain_slug")
    .single();

  if (!error) return data;

  const message = String(error.message || "").toLowerCase();

  if (
    message.includes("schema cache") ||
    message.includes("column") ||
    message.includes("business_type") ||
    message.includes("trial_") ||
    message.includes("mercado_pago_")
  ) {
    const retry = await supabaseAdmin
      .from("companies")
      .insert(removeOptionalCompanyFields(payload))
      .select("id, slug, subdomain_slug")
      .single();

    if (retry.error) throw retry.error;
    return retry.data;
  }

  throw error;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const leadId = String(body.lead_id || "").trim();
    const password = String(body.password || "");
    const confirmPassword = String(body.confirm_password || "");

    if (!leadId) return erro("Cadastro ausente.");
    if (password.length < 8) {
      return erro("A senha precisa ter pelo menos 8 caracteres.");
    }
    if (password !== confirmPassword) {
      return erro("As senhas não conferem.");
    }

    const { data: lead, error: leadError } = await supabaseAdmin
      .from("signup_leads")
      .select("*")
      .eq("id", leadId)
      .maybeSingle();

    if (leadError) throw leadError;
    if (!lead) return erro("Cadastro não encontrado.", 404);

    if (!["pago", "trial_ready", "convertido"].includes(lead.status)) {
      return erro("O pagamento ainda não foi confirmado.");
    }

    if (lead.status === "convertido" && lead.converted_company_id) {
      return NextResponse.json({
        ok: true,
        already_converted: true,
        redirect: "/login",
      });
    }

    const rawData = safeRawData(lead.raw_data);
    const businessType = normalizeBusinessType(
      rawData.business_type || lead.modelo_negocio || lead.segmento,
    );
    const defaultSetup = getDefaultSetupForBusiness(businessType);
    const onboardingGoal = String(rawData.onboarding_goal || "").trim();
    const paymentMethod = String(
      rawData.signup_payment_method ||
        (lead.status === "trial_ready" ? "card" : "pix"),
    ).toLowerCase();
    const subscription = safeRecord(rawData.signup_subscription);
    const companyPlan = String(lead.plano || "profissional").toLowerCase() === "essencial"
      ? "basico"
      : String(lead.plano || "profissional").toLowerCase();
    const isCardTrial =
      lead.status === "trial_ready" && paymentMethod === "card";

    const { data: authData, error: authError } =
      await supabaseAdmin.auth.admin.createUser({
        email: lead.email,
        password,
        email_confirm: true,
        user_metadata: {
          nome: lead.nome_responsavel,
          empresa: lead.empresa_nome,
          origem: isCardTrial ? "cadastro_teste_cartao" : "cadastro_pix",
        },
      });

    if (authError) {
      return erro(authError.message, 400);
    }

    const userId = authData.user.id;

    let slug = normalizeSubdomainSlug(
      rawData.subdomain_slug || lead.slug_sugerido || lead.empresa_nome,
    );
    let subdomain = criarSubdomain(slug);

    const { data: slugExistente } = await supabaseAdmin
      .from("companies")
      .select("id")
      .or(`slug.eq.${slug},subdomain_slug.eq.${subdomain}`)
      .maybeSingle();

    if (slugExistente) {
      slug = `${slug}-${String(lead.id).slice(0, 6)}`;
      subdomain = criarSubdomain(slug);
    }

    const now = new Date();
    const trialEndsAt = new Date(now.getTime() + 7 * DAY_MS);
    const pixAccessEndsAt = new Date(now.getTime() + 37 * DAY_MS);
    const accessUntil = isCardTrial ? trialEndsAt : pixAccessEndsAt;
    const subscriptionId = String(subscription.id || "").trim();
    const subscriptionStatus = String(
      subscription.status || (isCardTrial ? "authorized" : ""),
    ).trim();
    const nextPaymentDate = String(
      subscription.next_payment_date || "",
    ).trim();

    const companyPayload: Record<string, unknown> = {
      nome: lead.empresa_nome,
      slug,
      subdomain_slug: subdomain,
      owner_id: userId,
      email: lead.email,
      whatsapp: lead.whatsapp,
      cidade: lead.cidade,
      estado: lead.estado,
      segmento: lead.segmento,
      modelo_negocio: lead.modelo_negocio,
      modelo_nome: lead.segmento,
      plano: companyPlan,
      assinatura_plano: companyPlan,
      assinatura_status: isCardTrial ? "trialing" : "ativa",
      assinatura_inicio: now.toISOString(),
      assinatura_expira_em: accessUntil.toISOString(),
      assinatura_ultimo_pagamento: isCardTrial
        ? null
        : lead.paid_at || now.toISOString(),
      assinatura_forma_pagamento_preferida: isCardTrial
        ? "cartao_recorrente"
        : "pix_avulso",
      assinatura_auto_recorrente: isCardTrial,
      assinatura_proxima_cobranca: nextPaymentDate || null,
      ativo: true,
      trial_started_at: isCardTrial ? now.toISOString() : null,
      trial_ends_at: isCardTrial ? trialEndsAt.toISOString() : null,
      trial_used_at: now.toISOString(),
      access_until: accessUntil.toISOString(),
      cancel_at_period_end: false,
      subscription_provider: "mercado_pago",
      provider_subscription_id: subscriptionId || null,
      next_billing_at: nextPaymentDate || null,
      mercado_pago_subscription_id: subscriptionId || null,
      mercado_pago_subscription_status: subscriptionStatus || null,
      mercado_pago_customer_email: lead.email,
      business_type: businessType,
      onboarding_goal: onboardingGoal || null,
      site_template: defaultSetup.site_template,
      site_headline: defaultSetup.site_headline,
      site_subheadline: defaultSetup.site_subheadline,
      site_about_title: defaultSetup.site_about_title,
      site_about_text: defaultSetup.site_about_text,
      site_benefits: defaultSetup.site_benefits,
      site_faq: defaultSetup.site_faq,
      site_features: defaultSetup.site_features,
      site_updated_at: defaultSetup.site_updated_at,
    };

    const company = await insertCompany(companyPayload);

    try {
      await supabaseAdmin.rpc("create_default_site_for_company", {
        p_company_id: company.id,
      });
    } catch (rpcError) {
      console.error("[Orçaly Cadastro] Falha ao criar site padrão:", rpcError);
    }

    await supabaseAdmin
      .from("signup_leads")
      .update({
        status: "convertido",
        converted_user_id: userId,
        converted_company_id: company.id,
      })
      .eq("id", lead.id);

    return NextResponse.json({
      ok: true,
      redirect: "/login",
      company,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Erro ao finalizar conta.",
      },
      { status: 500 },
    );
  }
}
