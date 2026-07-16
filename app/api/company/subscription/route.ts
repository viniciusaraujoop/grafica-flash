/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

type PlanoId = "basico" | "profissional" | "premium";
type Action = "create" | "renew" | "sync" | "cancel";

type CompanyAccess = {
  company: any | null;
  role: string | null;
  canManage: boolean;
};

const planos: Record<
  PlanoId,
  { nome: string; valor: number; descricao: string }
> = {
  basico: {
    nome: "Básico",
    valor: 49.9,
    descricao: "Página pública, formulário de orçamento e painel de pedidos.",
  },
  profissional: {
    nome: "Profissional",
    valor: 99.9,
    descricao:
      "Catálogo completo, propostas profissionais, status e relatórios.",
  },
  premium: {
    nome: "Premium",
    valor: 149.9,
    descricao: "Automações, recuperação de orçamento e recursos inteligentes.",
  },
};

function getSupabaseAdmin() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("Variáveis do Supabase não configuradas no servidor.");
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

function getMercadoPagoToken() {
  const token =
    process.env.MERCADO_PAGO_PLATFORM_ACCESS_TOKEN ||
    process.env.MERCADO_PAGO_ACCESS_TOKEN;

  if (!token) {
    throw new Error(
      "MERCADO_PAGO_PLATFORM_ACCESS_TOKEN ou MERCADO_PAGO_ACCESS_TOKEN não configurado.",
    );
  }

  return token;
}

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

function getOrcalyAppUrl() {
  const raw = (
    process.env.ORCALY_APP_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.NEXT_PUBLIC_SITE_URL ||
    "https://orcaly.com.br"
  ).trim();

  const fallback = "https://orcaly.com.br";

  try {
    const url = new URL(raw);

    if (url.protocol !== "https:") return fallback;
    if (url.hostname === "localhost" || url.hostname === "127.0.0.1") {
      return fallback;
    }

    return url.origin.replace(/\/$/, "");
  } catch {
    return fallback;
  }
}

function isUuid(value: unknown) {
  return (
    typeof value === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      value,
    )
  );
}

function normalizarPlano(value: unknown): PlanoId {
  if (value === "basico" || value === "profissional" || value === "premium")
    return value;
  return "profissional";
}

function normalizarAction(value: unknown): Action {
  if (
    value === "cancel" ||
    value === "sync" ||
    value === "renew" ||
    value === "create"
  )
    return value;
  return "create";
}

function addMonths(date: Date, months: number) {
  const next = new Date(date);
  next.setMonth(next.getMonth() + months);
  return next;
}

function calcularProximaCobranca(value?: string | null) {
  if (!value) return addMonths(new Date(), 1);

  const data = new Date(value);

  if (Number.isNaN(data.getTime())) return addMonths(new Date(), 1);

  return data;
}

function assinaturaEstaAtiva(company: any) {
  if (!company) return false;
  if (company.assinatura_status !== "ativa") return false;
  if (!company.assinatura_expira_em) return true;

  const expiresAt = new Date(company.assinatura_expira_em);
  return expiresAt > new Date();
}

async function getRequester(
  request: NextRequest,
  supabaseAdmin: ReturnType<typeof getSupabaseAdmin>,
) {
  const token = (request.headers.get("authorization") || "")
    .replace("Bearer ", "")
    .trim();

  if (!token) return null;

  const { data, error } = await supabaseAdmin.auth.getUser(token);

  if (error || !data.user) return null;

  return data.user;
}

function canManageByRole(role: string | null, email?: string | null) {
  const normalizedRole = String(role || "").toLowerCase();
  const normalizedEmail = String(email || "").toLowerCase();

  return (
    normalizedRole === "dono" ||
    normalizedRole === "gerente" ||
    normalizedRole === "admin" ||
    normalizedRole === "super_admin" ||
    normalizedEmail === "araujovinicius249@gmail.com"
  );
}

async function getCompanyAccess(
  supabaseAdmin: ReturnType<typeof getSupabaseAdmin>,
  userId: string,
  email?: string | null,
): Promise<CompanyAccess> {
  if (!isUuid(userId)) {
    return { company: null, role: null, canManage: false };
  }

  const companyFields = `
    id,
    nome,
    slug,
    email,
    plano,
    ativo,
    assinatura_status,
    assinatura_plano,
    assinatura_inicio,
    assinatura_expira_em,
    assinatura_ultimo_pagamento,
    assinatura_auto_recorrente,
    assinatura_cancelada_em,
    assinatura_checkout_url,
    assinatura_proxima_cobranca,
    mercado_pago_subscription_id,
    mercado_pago_subscription_status,
    mercado_pago_customer_email
  `;

  const { data: ownerCompany, error: ownerError } = await supabaseAdmin
    .from("companies")
    .select(companyFields)
    .or(`owner_id.eq.${userId},tester_id.eq.${userId}`)
    .limit(1)
    .maybeSingle();

  if (ownerError) throw ownerError;

  if (ownerCompany?.id) {
    return {
      company: ownerCompany,
      role: "dono",
      canManage: true,
    };
  }

  const { data: member, error: memberError } = await supabaseAdmin
    .from("company_members")
    .select("company_id,cargo,status")
    .eq("user_id", userId)
    .eq("status", "ativo")
    .limit(1)
    .maybeSingle();

  if (memberError) throw memberError;

  if (member?.company_id && isUuid(member.company_id)) {
    const { data: memberCompany, error: memberCompanyError } =
      await supabaseAdmin
        .from("companies")
        .select(companyFields)
        .eq("id", member.company_id)
        .maybeSingle();

    if (memberCompanyError) throw memberCompanyError;

    return {
      company: memberCompany,
      role: member.cargo || "funcionario",
      canManage: canManageByRole(member.cargo, email),
    };
  }

  const normalizedEmail = String(email || "").toLowerCase();

  if (normalizedEmail === "araujovinicius249@gmail.com") {
    const { data: adminCompany, error: adminCompanyError } = await supabaseAdmin
      .from("companies")
      .select(companyFields)
      .eq("slug", "grafica-flash")
      .maybeSingle();

    if (adminCompanyError) throw adminCompanyError;

    if (adminCompany?.id) {
      return {
        company: adminCompany,
        role: "super_admin",
        canManage: true,
      };
    }
  }

  return { company: null, role: null, canManage: false };
}

async function mercadoPagoRequest(path: string, options: RequestInit = {}) {
  const token = getMercadoPagoToken();

  const response = await fetch(`https://api.mercadopago.com${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(
      data?.message ||
        data?.error ||
        `Erro Mercado Pago ${response.status} em ${path}`,
    );
  }

  return data;
}

async function syncSubscriptionData(
  supabaseAdmin: ReturnType<typeof getSupabaseAdmin>,
  company: any,
  subscriptionId?: string | null,
) {
  const currentSubscriptionId =
    subscriptionId || company?.mercado_pago_subscription_id;

  if (!currentSubscriptionId) {
    return { company, subscription: null };
  }

  const subscription = await mercadoPagoRequest(
    `/preapproval/${currentSubscriptionId}`,
  );

  const status = subscription?.status || "desconhecido";
  const nextPaymentDate = calcularProximaCobranca(
    subscription?.next_payment_date || null,
  );
  const plano = normalizarPlano(
    company?.assinatura_plano || company?.plano || "profissional",
  );
  const update: Record<string, unknown> = {
    mercado_pago_subscription_id: subscription.id || currentSubscriptionId,
    mercado_pago_subscription_status: status,
    assinatura_mp_payload: subscription,
    assinatura_checkout_url:
      subscription.init_point ||
      subscription.sandbox_init_point ||
      company.assinatura_checkout_url ||
      null,
    assinatura_proxima_cobranca: subscription.next_payment_date || null,
    mercado_pago_customer_email:
      subscription.payer_email || company.mercado_pago_customer_email || null,
    updated_at: new Date().toISOString(),
  };

  if (status === "authorized") {
    update.ativo = true;
    update.assinatura_status = "ativa";
    update.assinatura_auto_recorrente = true;
    update.assinatura_plano = plano;
    update.plano = plano;
    update.assinatura_expira_em = nextPaymentDate.toISOString();
    update.assinatura_inicio =
      company.assinatura_inicio || new Date().toISOString();
  } else if (status === "cancelled") {
    update.assinatura_status = "cancelada";
    update.assinatura_auto_recorrente = false;
    update.assinatura_cancelada_em = new Date().toISOString();
  } else if (status === "paused") {
    update.assinatura_status = "pausada";
    update.assinatura_auto_recorrente = false;
  } else if (status === "pending") {
    update.assinatura_status = assinaturaEstaAtiva(company)
      ? "ativa"
      : "pendente";
    update.assinatura_auto_recorrente = false;
  }

  const { data: updatedCompany, error } = await supabaseAdmin
    .from("companies")
    .update(update)
    .eq("id", company.id)
    .select(
      `
      id,
      nome,
      slug,
      email,
      plano,
      ativo,
      assinatura_status,
      assinatura_plano,
      assinatura_inicio,
      assinatura_expira_em,
      assinatura_ultimo_pagamento,
      assinatura_auto_recorrente,
      assinatura_cancelada_em,
      assinatura_checkout_url,
      assinatura_proxima_cobranca,
      mercado_pago_subscription_id,
      mercado_pago_subscription_status,
      mercado_pago_customer_email
    `,
    )
    .single();

  if (error) throw error;

  return { company: updatedCompany, subscription };
}

export async function GET(request: NextRequest) {
  try {
    const supabaseAdmin = getSupabaseAdmin();
    const requester = await getRequester(request, supabaseAdmin);

    if (!requester) {
      return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
    }

    const access = await getCompanyAccess(
      supabaseAdmin,
      requester.id,
      requester.email,
    );

    if (!access.company?.id) {
      return NextResponse.json(
        { error: "Empresa não encontrada." },
        { status: 404 },
      );
    }

    return NextResponse.json({
      company: access.company,
      role: access.role,
      can_manage: access.canManage,
      assinatura_ativa: assinaturaEstaAtiva(access.company),
      plans: planos,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Erro ao carregar assinatura.";

    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabaseAdmin = getSupabaseAdmin();
    const requester = await getRequester(request, supabaseAdmin);

    if (!requester) {
      return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
    }

    const access = await getCompanyAccess(
      supabaseAdmin,
      requester.id,
      requester.email,
    );

    if (!access.company?.id || !isUuid(access.company.id)) {
      return NextResponse.json(
        { error: "Empresa não encontrada." },
        { status: 404 },
      );
    }

    if (!access.canManage) {
      return NextResponse.json(
        {
          error:
            "Apenas o dono da empresa ou gerente pode gerenciar a assinatura.",
        },
        { status: 403 },
      );
    }

    const body = await request.json().catch(() => ({}));
    const action = normalizarAction(body.action);
    const requestedCompanyId = body.companyId;

    if (requestedCompanyId && requestedCompanyId !== access.company.id) {
      return NextResponse.json(
        { error: "Empresa inválida para este usuário." },
        { status: 403 },
      );
    }

    if (action === "sync") {
      const synced = await syncSubscriptionData(supabaseAdmin, access.company);

      return NextResponse.json({
        ok: true,
        action,
        company: synced.company,
        subscription: synced.subscription,
      });
    }

    if (action === "cancel") {
      const subscriptionId = access.company.mercado_pago_subscription_id;

      if (!subscriptionId) {
        return NextResponse.json(
          { error: "Nenhuma assinatura automática encontrada para cancelar." },
          { status: 400 },
        );
      }

      const subscription = await mercadoPagoRequest(
        `/preapproval/${subscriptionId}`,
        {
          method: "PUT",
          body: JSON.stringify({
            status: "cancelled",
          }),
        },
      );

      const { data: updatedCompany, error: companyError } = await supabaseAdmin
        .from("companies")
        .update({
          assinatura_status: "cancelada",
          assinatura_auto_recorrente: false,
          assinatura_cancelada_em: new Date().toISOString(),
          mercado_pago_subscription_status: subscription.status || "cancelled",
          assinatura_mp_payload: subscription,
          updated_at: new Date().toISOString(),
        })
        .eq("id", access.company.id)
        .select(
          `
          id,
          nome,
          slug,
          email,
          plano,
          ativo,
          assinatura_status,
          assinatura_plano,
          assinatura_inicio,
          assinatura_expira_em,
          assinatura_ultimo_pagamento,
          assinatura_auto_recorrente,
          assinatura_cancelada_em,
          assinatura_checkout_url,
          assinatura_proxima_cobranca,
          mercado_pago_subscription_id,
          mercado_pago_subscription_status,
          mercado_pago_customer_email
        `,
        )
        .single();

      if (companyError) throw companyError;

      await supabaseAdmin
        .from("plan_payments")
        .update({
          status: "cancelled",
          cancelled_at: new Date().toISOString(),
          raw_subscription: subscription,
          updated_at: new Date().toISOString(),
        })
        .eq("mercado_pago_preapproval_id", subscriptionId);

      return NextResponse.json({
        ok: true,
        action,
        company: updatedCompany,
        subscription,
      });
    }

    const planoId = normalizarPlano(
      body.plano ||
        access.company.assinatura_plano ||
        access.company.plano ||
        "profissional",
    );
    const plano = planos[planoId];
    const appUrl = getOrcalyAppUrl();
    const email = String(
      body.email || access.company.email || requester.email || "",
    )
      .trim()
      .toLowerCase();

    if (!email || !email.includes("@")) {
      return NextResponse.json(
        { error: "E-mail válido é obrigatório para criar a assinatura." },
        { status: 400 },
      );
    }

    const environmentError = validateMercadoPagoPayerEnvironment(
      getMercadoPagoToken(),
      email,
    );

    if (environmentError) {
      return NextResponse.json({ error: environmentError }, { status: 400 });
    }

    const { data: paymentRow, error: paymentError } = await supabaseAdmin
      .from("plan_payments")
      .insert({
        company_id: access.company.id,
        plano: planoId,
        valor: plano.valor,
        status: "subscription_pending",
        tipo: "subscription",
        email,
        nome_empresa: access.company.nome || body.nomeEmpresa || "Empresa",
      })
      .select("id")
      .single();

    if (paymentError) throw paymentError;

    const preapprovalPayload = {
      reason: `Plano ${plano.nome} - Orçaly`,
      external_reference: paymentRow.id,
      payer_email: email,
      back_url: `${appUrl}/assinatura/retorno`,
      notification_url: `${appUrl}/api/mercado-pago/webhook`,
      auto_recurring: {
        frequency: 1,
        frequency_type: "months",
        transaction_amount: plano.valor,
        currency_id: "BRL",
      },
      status: "pending",
    };

    const subscription = await mercadoPagoRequest("/preapproval", {
      method: "POST",
      body: JSON.stringify(preapprovalPayload),
    });

    const checkoutUrl =
      subscription.init_point || subscription.sandbox_init_point || null;

    await supabaseAdmin
      .from("plan_payments")
      .update({
        mercado_pago_preapproval_id: subscription.id || null,
        checkout_url: checkoutUrl,
        raw_subscription: subscription,
        status: subscription.status
          ? `subscription_${subscription.status}`
          : "subscription_pending",
        updated_at: new Date().toISOString(),
      })
      .eq("id", paymentRow.id);

    const { data: updatedCompany, error: companyError } = await supabaseAdmin
      .from("companies")
      .update({
        plano: planoId,
        assinatura_plano: planoId,
        assinatura_status: assinaturaEstaAtiva(access.company)
          ? "ativa"
          : "pendente",
        assinatura_auto_recorrente: subscription.status === "authorized",
        assinatura_forma_pagamento_preferida: "cartao_recorrente",
        assinatura_checkout_url: checkoutUrl,
        mercado_pago_subscription_id: subscription.id || null,
        mercado_pago_subscription_status: subscription.status || "pending",
        mercado_pago_customer_email: email,
        assinatura_mp_payload: subscription,
        assinatura_proxima_cobranca: subscription.next_payment_date || null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", access.company.id)
      .select(
        `
        id,
        nome,
        slug,
        email,
        plano,
        ativo,
        assinatura_status,
        assinatura_plano,
        assinatura_inicio,
        assinatura_expira_em,
        assinatura_ultimo_pagamento,
        assinatura_auto_recorrente,
        assinatura_cancelada_em,
        assinatura_checkout_url,
        assinatura_proxima_cobranca,
        mercado_pago_subscription_id,
        mercado_pago_subscription_status,
        mercado_pago_customer_email
      `,
      )
      .single();

    if (companyError) throw companyError;

    return NextResponse.json({
      ok: true,
      action,
      company: updatedCompany,
      subscription,
      checkout_url: checkoutUrl,
      checkoutUrl,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Erro ao gerenciar assinatura.";

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
