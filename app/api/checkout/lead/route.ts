// ORCALY_AFFILIATE_INTEGRATION_V2
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
import { createSignupCheckoutToken } from "@/lib/signup-checkout";
import {
  hashAffiliateValue,
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
  auth: { persistSession: false },
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
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
}

function campaignFromLandingPath(value: unknown) {
  const path = String(value || "").trim();
  if (!path) return "";
  try {
    const url = new URL(path, "https://orcaly.com.br");
    return String(url.searchParams.get("pc") || "")
      .toUpperCase()
      .replace(/[^A-Z0-9_-]/g, "")
      .slice(0, 40);
  } catch {
    return "";
  }
}

async function resolveManualPartnerClaim(whatsapp: string, leadId: string) {
  const phoneHash = hashAffiliateValue(whatsapp, "customer_whatsapp");
  if (!phoneHash) return null;

  const { data: settings } = await supabaseAdmin
    .from("affiliate_program_settings")
    .select("attribution_days")
    .eq("id", 1)
    .maybeSingle();
  const days = Math.max(1, Math.min(180, Number(settings?.attribution_days || 60)));
  const since = new Date(Date.now() - days * 86_400_000).toISOString();

  const { data: claim, error } = await supabaseAdmin
    .from("affiliate_referrals")
    .select("id,affiliate_id,referral_code,signup_lead_id,status,source,registered_at")
    .eq("customer_whatsapp_hash", phoneHash)
    .eq("source", "manual_claim")
    .gte("registered_at", since)
    .not("status", "in", "(rejected,reversed,customer_cancelled)")
    .order("registered_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  if (!claim?.id) return null;

  if (!claim.signup_lead_id) {
    const { error: updateError } = await supabaseAdmin
      .from("affiliate_referrals")
      .update({ signup_lead_id: leadId, updated_at: new Date().toISOString() })
      .eq("id", claim.id)
      .is("signup_lead_id", null);
    if (updateError) throw updateError;
  }

  await supabaseAdmin
    .from("signup_leads")
    .update({
      referral_code: claim.referral_code,
      affiliate_referral_id: claim.id,
    })
    .eq("id", leadId);

  return claim;
}

async function attachCampaignSource(input: {
  affiliateId: string;
  referralId: string;
  ip: string;
}) {
  const ipHash = hashAffiliateValue(input.ip, "ip");
  if (!ipHash) return;

  const { data: settings } = await supabaseAdmin
    .from("affiliate_program_settings")
    .select("attribution_days")
    .eq("id", 1)
    .maybeSingle();
  const days = Math.max(1, Math.min(180, Number(settings?.attribution_days || 60)));
  const since = new Date(Date.now() - days * 86_400_000).toISOString();

  const { data: click } = await supabaseAdmin
    .from("affiliate_clicks")
    .select("landing_path,created_at")
    .eq("affiliate_id", input.affiliateId)
    .eq("ip_hash", ipHash)
    .gte("created_at", since)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const campaign = campaignFromLandingPath(click?.landing_path);
  if (!campaign) return;

  await supabaseAdmin
    .from("affiliate_referrals")
    .update({ source: `campaign:${campaign}`, updated_at: new Date().toISOString() })
    .eq("id", input.referralId)
    .eq("affiliate_id", input.affiliateId);
}

export async function POST(request: NextRequest) {
  try {
    if (!supabaseUrl || !serviceRoleKey) {
      return erro("Supabase service role não configurada.", 500);
    }

    const body = await request.json();
    const nome_responsavel = String(body.nome_responsavel || "").trim();
    const email = String(body.email || "").trim().toLowerCase();
    const cpf_cnpj = documentoLimpo(body.cpf_cnpj || body.documento || body.document);
    const whatsapp = telefoneLimpo(String(body.whatsapp || ""));
    const empresa_nome = String(body.empresa_nome || "").trim();
    const business_type = normalizeBusinessType(body.business_type || body.modelo_negocio || body.segmento);
    const businessConfig = getBusinessTypeConfig(business_type);
    const defaultSetup = getDefaultSetupForBusiness(business_type);
    const segmento = String(body.segmento || businessConfig.label).trim();
    const modelo_negocio = String(body.modelo_negocio || business_type).trim();
    const onboarding_goal = String(body.onboarding_goal || "").trim();
    const cidade = String(body.cidade || "").trim();
    const estado = String(body.estado || "").trim().toUpperCase();
    const plano = String(body.plano || "profissional").trim().toLowerCase();
    const marketing_opt_in = Boolean(body.marketing_opt_in);
    const referral_code = String(body.referral_code || body.ref || "")
      .trim()
      .toUpperCase()
      .replace(/[^A-Z0-9_-]/g, "")
      .slice(0, 32);

    const requestedSubdomain = String(body.subdomain_slug || empresa_nome).trim();
    const validation = validateSubdomainSlug(requestedSubdomain);

    if (!nome_responsavel) return erro("Informe seu nome.");
    if (!email || !email.includes("@")) return erro("Informe um e-mail válido.");
    if (![11, 14].includes(cpf_cnpj.length)) return erro("Informe um CPF ou CNPJ válido.");
    if (!whatsapp || whatsapp.length < 10) return erro("Informe um WhatsApp válido.");
    if (!empresa_nome || empresa_nome.length < 2) return erro("Informe o nome da empresa.");
    if (!cidade) return erro("Escolha a cidade da empresa.");
    if (!business_type) return erro("Escolha o tipo de negócio.");
    if (!onboarding_goal) return erro("Escolha o principal objetivo da empresa.");
    if (!validation.ok) return erro(validation.reason || "Escolha um link público válido.");
    if (!marketing_opt_in) {
      return erro("Para receber informações sobre o cadastro, confirme a autorização.");
    }

    const available = await linkDisponivel(validation.slug);
    if (!available) {
      return NextResponse.json(
        { error: "Esse link já está em uso. Tente outro nome.", suggestions: getSubdomainSuggestions(empresa_nome, cidade) },
        { status: 409 },
      );
    }

    const rawData = {
      ...body,
      cpf_cnpj,
      signup_document: cpf_cnpj,
      signup_document_type: cpf_cnpj.length === 14 ? "CNPJ" : "CPF",
      business_type,
      onboarding_goal,
      subdomain_slug: validation.slug,
      slug_sugerido: validation.slug,
      segmento,
      modelo_negocio,
      default_setup: defaultSetup,
      signup_offer: { card_trial_days: 7, pix_bonus_days: 7 },
      signup_checkout_version: 2,
      referral_code: referral_code || null,
    };

    const { data: leadExistente } = await supabaseAdmin
      .from("signup_leads")
      .select("*")
      .eq("email", email)
      .in("status", ["lead", "checkout_criado", "trial_ready", "pago"])
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
          status: ["pago", "trial_ready"].includes(leadExistente.status) ? leadExistente.status : "checkout_criado",
          marketing_opt_in,
          marketing_opt_in_text: "Autorizo o Orçaly a entrar em contato pelo WhatsApp sobre minha assinatura e meu cadastro.",
          next_followup_at: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString(),
          raw_data: { ...safeRaw(leadExistente.raw_data), ...rawData },
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
          marketing_opt_in_text: "Autorizo o Orçaly a entrar em contato pelo WhatsApp sobre minha assinatura e meu cadastro.",
          next_followup_at: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString(),
          raw_data: rawData,
        })
        .select("id")
        .single();
      if (insertError) throw insertError;
      leadId = lead.id;
    }

    if (!leadId) return erro("Não foi possível preparar o checkout.", 500);

    const ip = requestIp(request);
    let linkedReferral: { id: string; affiliate_id: string; referral_code?: string | null } | null = null;

    try {
      const manualClaim = await resolveManualPartnerClaim(whatsapp, leadId);
      if (manualClaim?.id) {
        linkedReferral = manualClaim;
      } else if (referral_code) {
        const result = await recordAffiliateReferral({
          code: referral_code,
          leadId,
          customerName: empresa_nome || nome_responsavel,
          customerEmail: email,
          customerDocument: cpf_cnpj,
          customerWhatsapp: whatsapp,
          plan: plano,
          ip,
          userAgent: request.headers.get("user-agent"),
        });
        if (result.linked && result.referral?.id) linkedReferral = result.referral;
      }

      if (linkedReferral?.id && linkedReferral.affiliate_id) {
        await attachCampaignSource({ affiliateId: linkedReferral.affiliate_id, referralId: linkedReferral.id, ip });
      }
    } catch (affiliateError) {
      console.error(
        "orcaly_affiliate_referral_error",
        affiliateError instanceof Error ? affiliateError.message : affiliateError,
      );
    }

    const checkout = createSignupCheckoutToken(leadId);
    const checkoutUrl =
      `${siteUrl}/checkout/cadastro` +
      `?lead_id=${encodeURIComponent(leadId)}` +
      `&expires=${encodeURIComponent(String(checkout.expires))}` +
      `&token=${encodeURIComponent(checkout.token)}`;

    await supabaseAdmin.from("signup_leads").update({ checkout_url: checkoutUrl }).eq("id", leadId);

    return NextResponse.json({
      ok: true,
      lead_id: leadId,
      checkout_url: checkoutUrl,
      subdomain_slug: validation.slug,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erro ao iniciar o cadastro." },
      { status: 500 },
    );
  }
}
