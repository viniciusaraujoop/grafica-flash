import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import {
  getBusinessTypeConfig,
  getDefaultSetupForBusiness,
  normalizeBusinessType,
} from "@/lib/business-types";
import {
  getSubdomainSuggestions,
  validateSubdomainSlug,
} from "@/lib/slug";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const mercadoPagoToken =
  process.env.MERCADO_PAGO_PLATFORM_ACCESS_TOKEN ||
  process.env.MERCADO_PAGO_ACCESS_TOKEN ||
  "";
const siteUrl = (
  process.env.ORCALY_APP_URL ||
  process.env.NEXT_PUBLIC_SITE_URL ||
  "https://orcaly.com.br"
).replace(/\/$/, "");

const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    persistSession: false,
  },
});

const planos: Record<string, { nome: string; valor: number }> = {
  essencial: { nome: "Essencial", valor: 49.9 },
  basico: { nome: "Essencial", valor: 49.9 },
  profissional: { nome: "Profissional", valor: 99.9 },
  premium: { nome: "Premium", valor: 149.9 },
};

function validateMercadoPagoPayerEnvironment(
  accessToken: string,
  payerEmail: string,
) {
  const isTestToken = accessToken.startsWith("TEST-");
  const isTestPayer = payerEmail.toLowerCase().includes("test_user");

  if (isTestToken && !isTestPayer) {
    return "Credenciais Mercado Pago em ambiente de teste exigem pagador de teste.";
  }

  if (!isTestToken && isTestPayer) {
    return "Credenciais Mercado Pago reais não podem usar pagador de teste.";
  }

  return "";
}

function telefoneLimpo(valor: string) {
  return valor.replace(/\D/g, "");
}

function normalizarPaymentMode(value: unknown) {
  const normalized = String(value || "")
    .trim()
    .toLowerCase();

  if (
    normalized === "pix" ||
    normalized === "pix_avulso" ||
    normalized === "pix_mensal" ||
    normalized === "avulso"
  ) {
    return "pix_avulso";
  }

  return "checkout_pro";
}

function getPreferencePaymentMethods(paymentMode: string) {
  if (paymentMode !== "pix_avulso") return undefined;

  // Cadastro/primeira mensalidade no Pix também é pagamento único via Checkout Pro.
  // Evita default_payment_method_id para não cair no erro de método padrão excluído.
  return {
    excluded_payment_types: [
      { id: "credit_card" },
      { id: "debit_card" },
      { id: "ticket" },
    ],
    installments: 1,
  };
}

function erro(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

async function linkDisponivel(slug: string) {
  const { data, error } = await supabaseAdmin
    .from("companies")
    .select("id")
    .or(`subdomain_slug.eq.${slug},slug.eq.${slug}`)
    .limit(1);

  if (error) throw error;

  return !data || data.length === 0;
}

export async function POST(request: NextRequest) {
  try {
    if (!supabaseUrl || !serviceRoleKey) {
      return erro("Supabase service role não configurada.", 500);
    }

    if (!mercadoPagoToken) {
      return erro("MERCADO_PAGO_ACCESS_TOKEN não configurado.", 500);
    }

    const body = await request.json();

    const nome_responsavel = String(body.nome_responsavel || "").trim();
    const email = String(body.email || "")
      .trim()
      .toLowerCase();

    const environmentError = validateMercadoPagoPayerEnvironment(
      mercadoPagoToken,
      email,
    );

    if (environmentError) return erro(environmentError, 400);
    const whatsapp = telefoneLimpo(String(body.whatsapp || ""));
    const empresa_nome = String(body.empresa_nome || "").trim();
    const business_type = normalizeBusinessType(
      body.business_type || body.modelo_negocio || body.segmento,
    );
    const businessConfig = getBusinessTypeConfig(business_type);
    const defaultSetup = getDefaultSetupForBusiness(business_type);
    const segmento = String(body.segmento || businessConfig.label).trim();
    const modelo_negocio = String(body.modelo_negocio || business_type).trim();
    const onboarding_goal = String(body.onboarding_goal || "").trim();
    const cidade = String(body.cidade || "").trim();
    const estado = String(body.estado || "")
      .trim()
      .toUpperCase();
    const plano = String(body.plano || "profissional")
      .trim()
      .toLowerCase();
    const marketing_opt_in = Boolean(body.marketing_opt_in);
    const payment_mode = normalizarPaymentMode(
      body.payment_mode || body.paymentMode || body.metodoPagamento,
    );

    const requestedSubdomain = String(
      body.subdomain_slug || empresa_nome,
    ).trim();
    const validation = validateSubdomainSlug(requestedSubdomain);

    if (!nome_responsavel) return erro("Informe seu nome.");
    if (!email || !email.includes("@"))
      return erro("Informe um e-mail válido.");
    if (!whatsapp || whatsapp.length < 10)
      return erro("Informe um WhatsApp válido.");
    if (!empresa_nome || empresa_nome.length < 2)
      return erro("Informe o nome da empresa.");
    if (!cidade) return erro("Escolha a cidade da empresa.");
    if (!business_type) return erro("Escolha o tipo de negócio.");
    if (!onboarding_goal)
      return erro("Escolha o principal objetivo da empresa.");
    if (!validation.ok)
      return erro(validation.reason || "Escolha um link público válido.");
    if (!marketing_opt_in)
      return erro(
        "Para receber lembretes pelo WhatsApp, confirme a autorização.",
      );

    const available = await linkDisponivel(validation.slug);

    if (!available) {
      return NextResponse.json(
        {
          error: "Esse link já está em uso. Tente outro nome.",
          suggestions: getSubdomainSuggestions(empresa_nome, cidade),
        },
        { status: 409 },
      );
    }

    const planoSelecionado = planos[plano] || planos.profissional;
    const slug_sugerido = validation.slug;

    const rawData = {
      ...body,
      business_type,
      onboarding_goal,
      subdomain_slug: validation.slug,
      slug_sugerido,
      segmento,
      modelo_negocio,
      default_setup: defaultSetup,
      payment_mode,
      payment_method: payment_mode === "pix_avulso" ? "pix" : "checkout_pro",
    };

    const { data: leadExistente } = await supabaseAdmin
      .from("signup_leads")
      .select("*")
      .eq("email", email)
      .in("status", ["lead", "checkout_criado", "pago"])
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    let leadId = leadExistente?.id as string | undefined;

    if (leadId) {
      const { error: updateError } = await supabaseAdmin
        .from("signup_leads")
        .update({
          nome_responsavel,
          whatsapp,
          empresa_nome,
          slug_sugerido,
          segmento,
          modelo_negocio,
          cidade,
          estado,
          plano,
          status: leadExistente.status === "pago" ? "pago" : "checkout_criado",
          marketing_opt_in,
          marketing_opt_in_text:
            "Autorizo o Orçaly a entrar em contato pelo WhatsApp sobre minha assinatura e meu cadastro.",
          next_followup_at: new Date(
            Date.now() + 2 * 24 * 60 * 60 * 1000,
          ).toISOString(),
          raw_data: rawData,
        })
        .eq("id", leadId);

      if (updateError) throw updateError;
    } else {
      const { data: lead, error: insertError } = await supabaseAdmin
        .from("signup_leads")
        .insert({
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
          status: "checkout_criado",
          marketing_opt_in,
          marketing_opt_in_text:
            "Autorizo o Orçaly a entrar em contato pelo WhatsApp sobre minha assinatura e meu cadastro.",
          next_followup_at: new Date(
            Date.now() + 2 * 24 * 60 * 60 * 1000,
          ).toISOString(),
          raw_data: rawData,
        })
        .select("id")
        .single();

      if (insertError) throw insertError;
      leadId = lead.id;
    }

    const preferencePayload = {
      items: [
        {
          title: `Orçaly - Plano ${planoSelecionado.nome}`,
          quantity: 1,
          currency_id: "BRL",
          unit_price: planoSelecionado.valor,
        },
      ],
      payer: {
        name: nome_responsavel,
        email,
      },
      back_urls: {
        success: `${siteUrl}/checkout/sucesso?lead_id=${leadId}`,
        failure: `${siteUrl}/checkout/falha?lead_id=${leadId}`,
        pending: `${siteUrl}/checkout/pendente?lead_id=${leadId}`,
      },
      notification_url: `${siteUrl}/api/mercado-pago/webhook-leads`,
      external_reference: `lead:${leadId}`,
      metadata: {
        lead_id: leadId,
        plano,
        email,
        empresa_nome,
        business_type,
        subdomain_slug: validation.slug,
        payment_mode,
        payment_method: payment_mode === "pix_avulso" ? "pix" : "checkout_pro",
      },
      payment_methods: getPreferencePaymentMethods(payment_mode),
    };

    const mpResponse = await fetch(
      "https://api.mercadopago.com/checkout/preferences",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${mercadoPagoToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(preferencePayload),
      },
    );

    const mpData = await mpResponse.json();

    if (!mpResponse.ok) {
      await supabaseAdmin
        .from("signup_leads")
        .update({
          status: "lead",
          raw_data: {
            ...rawData,
            mercado_pago_error: mpData,
          },
        })
        .eq("id", leadId);

      return NextResponse.json(
        { error: "Erro ao criar checkout.", details: mpData },
        { status: 500 },
      );
    }

    await supabaseAdmin
      .from("signup_leads")
      .update({
        checkout_url: mpData.init_point || mpData.sandbox_init_point,
        mercado_pago_preference_id: mpData.id,
      })
      .eq("id", leadId);

    return NextResponse.json({
      ok: true,
      lead_id: leadId,
      checkout_url: mpData.init_point || mpData.sandbox_init_point,
      subdomain_slug: validation.slug,
      payment_mode,
      payment_method: payment_mode === "pix_avulso" ? "pix" : "checkout_pro",
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Erro ao iniciar assinatura.",
      },
      { status: 500 },
    );
  }
}
