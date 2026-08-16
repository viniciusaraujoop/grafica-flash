// ORCALY_AFFILIATE_INTEGRATION_V1
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
import {
  createSignupCheckoutToken,
} from "@/lib/signup-checkout";
import {
  recordAffiliateReferral,
  requestIp,
} from "@/lib/affiliates/server";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const siteUrl = (
  process.env.ORCALY_APP_URL ||
  process.env.NEXT_PUBLIC_APP_URL ||
  process.env.NEXT_PUBLIC_SITE_URL ||
  "https://orcaly.com.br"
).replace(/\/$/, "");

const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    persistSession: false,
  },
});

function telefoneLimpo(valor: string) {
  return valor.replace(/\D/g, "");
}

function documentoLimpo(valor: unknown) {
  return String(valor || "").replace(/\D/g, "");
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

function safeRaw(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  return value as Record<string, unknown>;
}

export async function POST(request: NextRequest) {
  try {
    if (!supabaseUrl || !serviceRoleKey) {
      return erro("Supabase service role não configurada.", 500);
    }

    const body = await request.json();

    const nome_responsavel = String(body.nome_responsavel || "").trim();
    const email = String(body.email || "").trim().toLowerCase();
    const cpf_cnpj = documentoLimpo(
      body.cpf_cnpj || body.documento || body.document,
    );
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
    const estado = String(body.estado || "").trim().toUpperCase();
    const plano = String(body.plano || "profissional").trim().toLowerCase();
    const marketing_opt_in = Boolean(body.marketing_opt_in);
    const referral_code = String(
      body.referral_code || body.ref || "",
    )
      .trim()
      .toUpperCase()
      .replace(/[^A-Z0-9_-]/g, "")
      .slice(0, 32);

    const requestedSubdomain = String(
      body.subdomain_slug || empresa_nome,
    ).trim();
    const validation = validateSubdomainSlug(requestedSubdomain);

    if (!nome_responsavel) return erro("Informe seu nome.");
    if (!email || !email.includes("@")) {
      return erro("Informe um e-mail válido.");
    }
    if (![11, 14].includes(cpf_cnpj.length)) {
      return erro("Informe um CPF ou CNPJ válido.");
    }
    if (!whatsapp || whatsapp.length < 10) {
      return erro("Informe um WhatsApp válido.");
    }
    if (!empresa_nome || empresa_nome.length < 2) {
      return erro("Informe o nome da empresa.");
    }
    if (!cidade) return erro("Escolha a cidade da empresa.");
    if (!business_type) return erro("Escolha o tipo de negócio.");
    if (!onboarding_goal) {
      return erro("Escolha o principal objetivo da empresa.");
    }
    if (!validation.ok) {
      return erro(validation.reason || "Escolha um link público válido.");
    }
    if (!marketing_opt_in) {
      return erro(
        "Para receber informações sobre o cadastro, confirme a autorização.",
      );
    }

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

    const rawData = {
      ...body,
      cpf_cnpj,
      signup_document: cpf_cnpj,
      signup_document_type:
        cpf_cnpj.length === 14 ? "CNPJ" : "CPF",
      business_type,
      onboarding_goal,
      subdomain_slug: validation.slug,
      slug_sugerido: validation.slug,
      segmento,
      modelo_negocio,
      default_setup: defaultSetup,
      signup_offer: {
        card_trial_days: 7,
        pix_bonus_days: 7,
      },
      signup_checkout_version: 2,
      referral_code: referral_code || null,
    };

    const { data: leadExistente } = await supabaseAdmin
      .from("signup_leads")
      .select("*")
      .eq("email", email)
      .in("status", [
        "lead",
        "checkout_criado",
        "trial_ready",
        "pago",
      ])
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
          slug_sugerido: validation.slug,
          segmento,
          modelo_negocio,
          cidade,
          estado,
          plano,
          status: ["pago", "trial_ready"].includes(leadExistente.status)
            ? leadExistente.status
            : "checkout_criado",
          marketing_opt_in,
          marketing_opt_in_text:
            "Autorizo o Orçaly a entrar em contato pelo WhatsApp sobre minha assinatura e meu cadastro.",
          next_followup_at: new Date(
            Date.now() + 2 * 24 * 60 * 60 * 1000,
          ).toISOString(),
          raw_data: {
            ...safeRaw(leadExistente.raw_data),
            ...rawData,
          },
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
          slug_sugerido: validation.slug,
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

    if (!leadId) {
      return erro("Não foi possível preparar o checkout.", 500);
    }

    if (referral_code) {
      try {
        await recordAffiliateReferral({
          code: referral_code,
          leadId,
          customerName: empresa_nome || nome_responsavel,
          customerEmail: email,
          customerDocument: cpf_cnpj,
          customerWhatsapp: whatsapp,
          plan: plano,
          ip: requestIp(request),
          userAgent: request.headers.get("user-agent"),
        });
      } catch (affiliateError) {
        console.error(
          "orcaly_affiliate_referral_error",
          affiliateError instanceof Error
            ? affiliateError.message
            : affiliateError,
        );
      }
    }

    const checkout = createSignupCheckoutToken(leadId);

    const checkoutUrl =
      `${siteUrl}/checkout/cadastro` +
      `?lead_id=${encodeURIComponent(leadId)}` +
      `&expires=${encodeURIComponent(String(checkout.expires))}` +
      `&token=${encodeURIComponent(checkout.token)}`;

    await supabaseAdmin
      .from("signup_leads")
      .update({ checkout_url: checkoutUrl })
      .eq("id", leadId);

    return NextResponse.json({
      ok: true,
      lead_id: leadId,
      checkout_url: checkoutUrl,
      subdomain_slug: validation.slug,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Erro ao iniciar o cadastro.",
      },
      { status: 500 },
    );
  }
}
