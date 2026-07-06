import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

type EmpresaAssinatura = {
  id: string;
  assinatura_expira_em: string | null;
  assinatura_plano: string | null;
  plano: string | null;
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
  const token = process.env.MERCADO_PAGO_ACCESS_TOKEN;

  if (!token) {
    throw new Error("MERCADO_PAGO_ACCESS_TOKEN não configurado.");
  }

  return token;
}

async function mercadoPagoRequest(path: string) {
  const response = await fetch(`https://api.mercadopago.com${path}`, {
    headers: {
      Authorization: `Bearer ${getMercadoPagoToken()}`,
      "Content-Type": "application/json",
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

function isUuid(value: unknown) {
  return (
    typeof value === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      value,
    )
  );
}

function normalizarPlano(value: unknown) {
  if (value === "basico" || value === "profissional" || value === "premium")
    return value;
  return "profissional";
}

function somarMes(data: Date) {
  const next = new Date(data);
  next.setMonth(next.getMonth() + 1);
  return next;
}

function calcularNovaExpiracao(
  expiracaoAtual: string | null,
  nextPaymentDate?: string | null,
) {
  if (nextPaymentDate) {
    const next = new Date(nextPaymentDate);

    if (!Number.isNaN(next.getTime())) return next;
  }

  const agora = new Date();

  if (!expiracaoAtual) return somarMes(agora);

  const atual = new Date(expiracaoAtual);

  if (Number.isNaN(atual.getTime())) return somarMes(agora);

  if (atual > agora) return somarMes(atual);

  return somarMes(agora);
}

function extractResourceId(body: any, url: URL) {
  return (
    body?.data?.id ||
    body?.id ||
    body?.resource ||
    url.searchParams.get("id") ||
    url.searchParams.get("data.id") ||
    url.searchParams.get("preapproval_id")
  );
}

function extractTopic(body: any, url: URL) {
  return String(
    body?.type ||
      body?.topic ||
      url.searchParams.get("topic") ||
      url.searchParams.get("type") ||
      "",
  );
}

async function updateCompanyBySubscription(
  supabaseAdmin: ReturnType<typeof getSupabaseAdmin>,
  subscription: any,
  body: any,
) {
  const externalReference = subscription?.external_reference;
  const subscriptionId = subscription?.id;
  const status = subscription?.status || "desconhecido";

  let paymentRow: any = null;

  if (isUuid(externalReference)) {
    const { data } = await supabaseAdmin
      .from("plan_payments")
      .select("id, company_id, plano, valor")
      .eq("id", externalReference)
      .maybeSingle();

    paymentRow = data;
  }

  if (!paymentRow && subscriptionId) {
    const { data } = await supabaseAdmin
      .from("plan_payments")
      .select("id, company_id, plano, valor")
      .eq("mercado_pago_preapproval_id", subscriptionId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    paymentRow = data;
  }

  let companyId = paymentRow?.company_id;

  if (!companyId && subscriptionId) {
    const { data: companyBySub } = await supabaseAdmin
      .from("companies")
      .select("id")
      .eq("mercado_pago_subscription_id", subscriptionId)
      .maybeSingle();

    companyId = companyBySub?.id;
  }

  if (!companyId) {
    return { ignored: true, reason: "Assinatura sem empresa vinculada." };
  }

  const { data: empresaAtual } = await supabaseAdmin
    .from("companies")
    .select("id, assinatura_expira_em, assinatura_plano, plano")
    .eq("id", companyId)
    .maybeSingle();

  const empresa = empresaAtual as EmpresaAssinatura | null;
  const plano = normalizarPlano(
    paymentRow?.plano || empresa?.assinatura_plano || empresa?.plano,
  );
  const novaExpiracao = calcularNovaExpiracao(
    empresa?.assinatura_expira_em || null,
    subscription?.next_payment_date || null,
  );

  const companyUpdate: Record<string, unknown> = {
    mercado_pago_subscription_id: subscriptionId || null,
    mercado_pago_subscription_status: status,
    assinatura_mp_payload: subscription,
    assinatura_checkout_url:
      subscription?.init_point || subscription?.sandbox_init_point || null,
    assinatura_proxima_cobranca: subscription?.next_payment_date || null,
    mercado_pago_customer_email: subscription?.payer_email || null,
    updated_at: new Date().toISOString(),
  };

  if (status === "authorized") {
    companyUpdate.ativo = true;
    companyUpdate.assinatura_status = "ativa";
    companyUpdate.assinatura_plano = plano;
    companyUpdate.plano = plano;
    companyUpdate.assinatura_auto_recorrente = true;
    companyUpdate.assinatura_inicio = new Date().toISOString();
    companyUpdate.assinatura_expira_em = novaExpiracao.toISOString();
    companyUpdate.assinatura_ultimo_pagamento = new Date().toISOString();
  } else if (status === "pending") {
    companyUpdate.assinatura_status = "pendente";
    companyUpdate.assinatura_auto_recorrente = false;
  } else if (status === "cancelled") {
    companyUpdate.assinatura_status = "cancelada";
    companyUpdate.assinatura_auto_recorrente = false;
    companyUpdate.assinatura_cancelada_em = new Date().toISOString();
  } else if (status === "paused") {
    companyUpdate.assinatura_status = "pausada";
    companyUpdate.assinatura_auto_recorrente = false;
  }

  await supabaseAdmin
    .from("companies")
    .update(companyUpdate)
    .eq("id", companyId);

  if (paymentRow?.id) {
    await supabaseAdmin
      .from("plan_payments")
      .update({
        mercado_pago_preapproval_id: subscriptionId || null,
        status: status ? `subscription_${status}` : "subscription_updated",
        checkout_url:
          subscription?.init_point || subscription?.sandbox_init_point || null,
        raw_webhook: body,
        raw_subscription: subscription,
        next_payment_date: subscription?.next_payment_date || null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", paymentRow.id);
  }

  return { companyId, status, subscriptionId };
}

async function processSubscriptionWebhook(body: any, resourceId: string) {
  const supabaseAdmin = getSupabaseAdmin();
  const subscription = await mercadoPagoRequest(`/preapproval/${resourceId}`);
  const result = await updateCompanyBySubscription(
    supabaseAdmin,
    subscription,
    body,
  );

  return {
    received: true,
    kind: "subscription_preapproval",
    resourceId,
    result,
  };
}

async function processAuthorizedPaymentWebhook(body: any, resourceId: string) {
  const supabaseAdmin = getSupabaseAdmin();
  const authorizedPayment = await mercadoPagoRequest(
    `/authorized_payments/${resourceId}`,
  );
  const subscriptionId = authorizedPayment?.preapproval_id;
  const paymentStatus =
    authorizedPayment?.payment?.status || authorizedPayment?.status;
  const paymentId = authorizedPayment?.payment?.id;
  const externalReference = authorizedPayment?.external_reference;

  let paymentRow: any = null;

  if (isUuid(externalReference)) {
    const { data } = await supabaseAdmin
      .from("plan_payments")
      .select("id, company_id, plano")
      .eq("id", externalReference)
      .maybeSingle();

    paymentRow = data;
  }

  if (!paymentRow && subscriptionId) {
    const { data } = await supabaseAdmin
      .from("plan_payments")
      .select("id, company_id, plano")
      .eq("mercado_pago_preapproval_id", subscriptionId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    paymentRow = data;
  }

  let subscription: any = null;

  if (subscriptionId) {
    subscription = await mercadoPagoRequest(`/preapproval/${subscriptionId}`);
  }

  const companyId = paymentRow?.company_id;

  if (paymentRow?.id) {
    await supabaseAdmin
      .from("plan_payments")
      .update({
        status: paymentStatus || "authorized_payment_updated",
        mercado_pago_authorized_payment_id: String(resourceId),
        mercado_pago_payment_id: paymentId ? String(paymentId) : null,
        raw_webhook: body,
        raw_authorized_payment: authorizedPayment,
        raw_subscription: subscription,
        paid_at: paymentStatus === "approved" ? new Date().toISOString() : null,
        next_payment_date: subscription?.next_payment_date || null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", paymentRow.id);
  }

  if (companyId && paymentStatus === "approved") {
    const { data: empresaAtual } = await supabaseAdmin
      .from("companies")
      .select("id, assinatura_expira_em, assinatura_plano, plano")
      .eq("id", companyId)
      .maybeSingle();

    const empresa = empresaAtual as EmpresaAssinatura | null;
    const plano = normalizarPlano(
      paymentRow?.plano || empresa?.assinatura_plano || empresa?.plano,
    );
    const novaExpiracao = calcularNovaExpiracao(
      empresa?.assinatura_expira_em || null,
      subscription?.next_payment_date || null,
    );

    await supabaseAdmin
      .from("companies")
      .update({
        ativo: true,
        assinatura_status: "ativa",
        assinatura_plano: plano,
        plano,
        assinatura_auto_recorrente: true,
        assinatura_inicio: new Date().toISOString(),
        assinatura_expira_em: novaExpiracao.toISOString(),
        assinatura_ultimo_pagamento: new Date().toISOString(),
        assinatura_proxima_cobranca: subscription?.next_payment_date || null,
        mercado_pago_subscription_id: subscriptionId || null,
        mercado_pago_subscription_status: subscription?.status || null,
        mercado_pago_customer_email: subscription?.payer_email || null,
        assinatura_mp_payload: subscription,
        updated_at: new Date().toISOString(),
      })
      .eq("id", companyId);
  }

  return {
    received: true,
    kind: "subscription_authorized_payment",
    resourceId,
    paymentStatus,
    subscriptionId,
    companyId,
  };
}

async function processLegacyPaymentWebhook(body: any, paymentId: string) {
  const supabaseAdmin = getSupabaseAdmin();
  const paymentData = await mercadoPagoRequest(`/v1/payments/${paymentId}`);

  const paymentRowId = paymentData.external_reference;
  const status = paymentData.status;
  const companyId = paymentData.metadata?.company_id;
  const plano = normalizarPlano(paymentData.metadata?.plano);
  const paymentMode = String(
    paymentData.metadata?.payment_mode ||
      paymentData.metadata?.payment_method ||
      "",
  );
  const isPixAvulso =
    paymentMode === "pix_avulso" || paymentData.payment_method_id === "pix";
  const payerEmail = paymentData.payer?.email;

  if (!paymentRowId) {
    return {
      received: true,
      ignored: true,
      reason: "Pagamento sem external_reference.",
      paymentId,
      status,
    };
  }

  await supabaseAdmin
    .from("plan_payments")
    .update({
      status: status || "desconhecido",
      mercado_pago_payment_id: String(paymentId),
      payment_method: isPixAvulso
        ? "pix"
        : paymentData.payment_method_id || null,
      raw_webhook: body,
      raw_payment: paymentData,
      paid_at: status === "approved" ? new Date().toISOString() : null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", paymentRowId);

  if (status === "approved" && companyId) {
    const { data: empresaAtual } = await supabaseAdmin
      .from("companies")
      .select("id, assinatura_expira_em")
      .eq("id", companyId)
      .maybeSingle();

    const novaExpiracao = calcularNovaExpiracao(
      (empresaAtual as EmpresaAssinatura | null)?.assinatura_expira_em || null,
    );

    await supabaseAdmin
      .from("companies")
      .update({
        ativo: true,
        assinatura_status: "ativa",
        assinatura_plano: plano,
        plano,
        assinatura_inicio: new Date().toISOString(),
        assinatura_expira_em: novaExpiracao.toISOString(),
        assinatura_ultimo_pagamento: new Date().toISOString(),
        assinatura_auto_recorrente: false,
        assinatura_forma_pagamento_preferida: isPixAvulso
          ? "pix_avulso"
          : "checkout_pro",
        assinatura_pix_avulso_status: isPixAvulso ? "paid" : null,
        assinatura_pix_avulso_ultimo_pagamento: isPixAvulso
          ? new Date().toISOString()
          : null,
        mercado_pago_customer_email: payerEmail || null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", companyId);
  }

  return {
    received: true,
    kind: "legacy_payment",
    paymentId,
    status,
  };
}

export async function POST(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const body = await request.json().catch(() => ({}));
    const topic = extractTopic(body, url);
    const resourceId = extractResourceId(body, url);

    if (!resourceId) {
      return NextResponse.json({
        received: true,
        ignored: true,
        reason: "Nenhum recurso recebido.",
        topic,
      });
    }

    if (topic.includes("subscription_preapproval")) {
      const result = await processSubscriptionWebhook(body, String(resourceId));
      return NextResponse.json(result);
    }

    if (topic.includes("subscription_authorized_payment")) {
      const result = await processAuthorizedPaymentWebhook(
        body,
        String(resourceId),
      );
      return NextResponse.json(result);
    }

    const result = await processLegacyPaymentWebhook(body, String(resourceId));

    return NextResponse.json(result);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Erro desconhecido no webhook.";

    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({
    ok: true,
    route: "mercado-pago-webhook",
    supports: [
      "payment",
      "subscription_preapproval",
      "subscription_authorized_payment",
    ],
  });
}
