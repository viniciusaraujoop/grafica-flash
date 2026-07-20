/* eslint-disable @typescript-eslint/no-explicit-any */
import { createClient } from "@supabase/supabase-js";
import { NextRequest } from "next/server";
import { getCompanySubscriptionAccess } from "@/lib/subscription-access";

export type PlanKey = "basico" | "profissional" | "premium";
export type SubscriptionAction =
  | "create"
  | "renew"
  | "sync"
  | "cancel"
  | "create_pix"
  | "history";

export const ORCALY_PLANS: Record<
  PlanKey,
  { key: PlanKey; name: string; price: number; description: string; benefits: string[] }
> = {
  basico: {
    key: "basico",
    name: "Básico",
    price: 49.9,
    description: "Estrutura essencial para organizar pedidos e presença digital.",
    benefits: ["Página pública", "Pedidos e clientes", "Catálogo essencial"],
  },
  profissional: {
    key: "profissional",
    name: "Profissional",
    price: 99.9,
    description: "Mais controle comercial, propostas e recursos de operação.",
    benefits: ["Catálogo completo", "Propostas e follow-up", "Relatórios operacionais"],
  },
  premium: {
    key: "premium",
    name: "Premium",
    price: 149.9,
    description: "Automação e recursos avançados para operações em crescimento.",
    benefits: ["Automações", "Recuperação de oportunidades", "Recursos avançados"],
  },
};

const DAY_MS = 86_400_000;

export function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    throw new Error("Configuração segura do Supabase ausente no servidor.");
  }

  return createClient(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export function getPlatformAccessToken() {
  const token =
    process.env.MERCADO_PAGO_PLATFORM_ACCESS_TOKEN ||
    process.env.MERCADO_PAGO_ACCESS_TOKEN ||
    "";

  if (!token) {
    throw new Error("Credencial Mercado Pago da plataforma não configurada.");
  }

  return token;
}

export function getAppUrl() {
  const fallback = "https://orcaly.com.br";
  const raw = String(
    process.env.ORCALY_APP_URL ||
      process.env.NEXT_PUBLIC_APP_URL ||
      process.env.NEXT_PUBLIC_SITE_URL ||
      fallback,
  )
    .trim()
    .replace(/\/$/, "");

  try {
    const url = new URL(raw);
    if (url.protocol !== "https:") return fallback;
    if (["localhost", "127.0.0.1"].includes(url.hostname)) return fallback;
    return url.origin;
  } catch {
    return fallback;
  }
}

export async function mercadoPagoPlatformRequest(
  path: string,
  options: RequestInit = {},
) {
  const response = await fetch(`https://api.mercadopago.com${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${getPlatformAccessToken()}`,
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
    cache: "no-store",
  });

  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    const safeMessage =
      typeof payload?.message === "string"
        ? payload.message
        : typeof payload?.error === "string"
          ? payload.error
          : `Mercado Pago retornou HTTP ${response.status}.`;
    throw new Error(safeMessage);
  }

  return payload;
}

function isUuid(value: unknown) {
  return (
    typeof value === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
  );
}

function normalizePlan(value: unknown): PlanKey {
  if (value === "basico" || value === "profissional" || value === "premium") {
    return value;
  }
  return "profissional";
}

function normalizeAction(value: unknown): SubscriptionAction {
  if (
    value === "renew" ||
    value === "sync" ||
    value === "cancel" ||
    value === "create_pix" ||
    value === "history"
  ) {
    return value;
  }
  return "create";
}

function addDays(date: Date, days: number) {
  return new Date(date.getTime() + DAY_MS * days);
}

function addMonth(date: Date) {
  const result = new Date(date);
  result.setUTCMonth(result.getUTCMonth() + 1);
  return result;
}

function validDate(value: unknown) {
  if (!value) return null;
  const date = new Date(String(value));
  return Number.isNaN(date.getTime()) ? null : date;
}

function maxDate(...values: Array<string | Date | null | undefined>) {
  const dates = values
    .map((value) => (value instanceof Date ? value : validDate(value)))
    .filter((value): value is Date => Boolean(value));
  if (!dates.length) return null;
  return new Date(Math.max(...dates.map((date) => date.getTime())));
}

async function getRequester(request: NextRequest, admin: ReturnType<typeof getSupabaseAdmin>) {
  const token = String(request.headers.get("authorization") || "")
    .replace(/^Bearer\s+/i, "")
    .trim();

  if (!token) return null;
  const { data, error } = await admin.auth.getUser(token);
  if (error || !data.user) return null;
  return data.user;
}

function canManage(role: unknown) {
  return ["dono", "owner", "gerente", "admin", "super_admin"].includes(
    String(role || "").toLowerCase(),
  );
}

export async function resolveSubscriptionContext(request: NextRequest) {
  const admin = getSupabaseAdmin();
  const user = await getRequester(request, admin);

  if (!user) {
    return { admin, user: null, company: null, role: null, canManage: false };
  }

  const { data: ownerCompany, error: ownerError } = await admin
    .from("companies")
    .select("*")
    .or(`owner_id.eq.${user.id},tester_id.eq.${user.id}`)
    .limit(1)
    .maybeSingle();

  if (ownerError) throw ownerError;

  if (ownerCompany?.id) {
    return { admin, user, company: ownerCompany, role: "dono", canManage: true };
  }

  const { data: member, error: memberError } = await admin
    .from("company_members")
    .select("company_id,cargo,status")
    .eq("user_id", user.id)
    .eq("status", "ativo")
    .limit(1)
    .maybeSingle();

  if (memberError) throw memberError;

  if (member?.company_id && isUuid(member.company_id)) {
    const { data: company, error: companyError } = await admin
      .from("companies")
      .select("*")
      .eq("id", member.company_id)
      .maybeSingle();

    if (companyError) throw companyError;
    return {
      admin,
      user,
      company,
      role: member.cargo || "funcionario",
      canManage: canManage(member.cargo),
    };
  }

  return { admin, user, company: null, role: null, canManage: false };
}

export async function recordSubscriptionEvent(
  admin: ReturnType<typeof getSupabaseAdmin>,
  event: {
    companyId: string;
    eventType: string;
    oldStatus?: string | null;
    newStatus?: string | null;
    providerReference?: string | null;
    metadata?: Record<string, unknown>;
  },
) {
  const row = {
    company_id: event.companyId,
    event_type: event.eventType,
    old_status: event.oldStatus || null,
    new_status: event.newStatus || null,
    provider: "mercado_pago",
    provider_reference: event.providerReference || null,
    metadata: event.metadata || {},
  };

  const { error } = await admin.from("subscription_events").upsert(row, {
    onConflict: "company_id,event_type,provider_reference",
    ignoreDuplicates: true,
  });

  if (error && !String(error.message || "").toLowerCase().includes("subscription_events")) {
    console.error("subscription_event_error", error.message);
  }
}

async function claimTrial(
  admin: ReturnType<typeof getSupabaseAdmin>,
  companyId: string,
) {
  const { data: rpcRows, error: rpcError } = await admin.rpc(
    "claim_company_subscription_trial",
    { p_company_id: companyId },
  );

  if (!rpcError) {
    const row = Array.isArray(rpcRows) ? rpcRows[0] : rpcRows;
    return row || null;
  }

  const now = new Date();
  const trialEndsAt = addDays(now, 7);
  const { data, error } = await admin
    .from("companies")
    .update({
      trial_started_at: now.toISOString(),
      trial_ends_at: trialEndsAt.toISOString(),
      trial_used_at: now.toISOString(),
      assinatura_status: "trialing",
      access_until: trialEndsAt.toISOString(),
      cancel_at_period_end: false,
      updated_at: now.toISOString(),
    })
    .eq("id", companyId)
    .is("trial_used_at", null)
    .select("*")
    .maybeSingle();

  if (error) {
    throw new Error(
      "Não foi possível iniciar o teste gratuito. Aplique a migration gerada pelo patcher no Supabase.",
    );
  }

  return data || null;
}

function trialDaysRemaining(company: any) {
  const trialEnd = validDate(company?.trial_ends_at);
  if (!trialEnd || trialEnd <= new Date()) return 0;
  return Math.max(1, Math.ceil((trialEnd.getTime() - Date.now()) / DAY_MS));
}

function safeCompany(company: any) {
  if (!company) return null;
  const access = getCompanySubscriptionAccess(company);
  return {
    id: company.id,
    nome: company.nome || null,
    email: company.email || null,
    plano: normalizePlan(company.assinatura_plano || company.plano),
    assinatura_status: access.status,
    assinatura_expira_em: company.assinatura_expira_em || null,
    assinatura_inicio: company.assinatura_inicio || null,
    assinatura_ultimo_pagamento: company.assinatura_ultimo_pagamento || null,
    assinatura_proxima_cobranca:
      company.assinatura_proxima_cobranca || company.next_billing_at || null,
    assinatura_forma_pagamento_preferida:
      company.assinatura_forma_pagamento_preferida || null,
    mercado_pago_subscription_status:
      company.mercado_pago_subscription_status || null,
    trial_started_at: company.trial_started_at || null,
    trial_ends_at: company.trial_ends_at || null,
    trial_used_at: company.trial_used_at || null,
    cancel_at_period_end: Boolean(company.cancel_at_period_end),
    access_until: access.accessUntil,
    access,
  };
}

async function getHistory(admin: ReturnType<typeof getSupabaseAdmin>, companyId: string) {
  const { data: events } = await admin
    .from("subscription_events")
    .select("id,event_type,old_status,new_status,provider,provider_reference,metadata,created_at")
    .eq("company_id", companyId)
    .order("created_at", { ascending: false })
    .limit(50);

  const { data: payments } = await admin
    .from("plan_payments")
    .select("id,plano,valor,status,tipo,payment_method,paid_at,created_at")
    .eq("company_id", companyId)
    .order("created_at", { ascending: false })
    .limit(30);

  return { events: events || [], payments: payments || [] };
}

export async function getSubscriptionSnapshot(request: NextRequest) {
  const context = await resolveSubscriptionContext(request);
  if (!context.user) throw new Error("Não autorizado.");
  if (!context.company?.id) throw new Error("Empresa não encontrada.");

  const history = await getHistory(context.admin, context.company.id);
  return {
    company: safeCompany(context.company),
    role: context.role,
    can_manage: context.canManage,
    plans: ORCALY_PLANS,
    history,
  };
}

async function createRecurringSubscription(
  context: Awaited<ReturnType<typeof resolveSubscriptionContext>>,
  body: any,
) {
  const { admin, company, user } = context;
  const planKey = normalizePlan(body?.plan || body?.plano || company.assinatura_plano || company.plano);
  const plan = ORCALY_PLANS[planKey];
  const email = String(company.email || user?.email || "").trim().toLowerCase();

  if (!email || !email.includes("@")) {
    throw new Error("Cadastre um e-mail válido na empresa antes de assinar.");
  }

  const currentProviderStatus = String(company.mercado_pago_subscription_status || "").toLowerCase();
  const currentPreapprovalId =
    company.mercado_pago_subscription_id || company.mercado_pago_preapproval_id || null;

  if (
    currentPreapprovalId &&
    ["authorized", "pending", "paused"].includes(currentProviderStatus) &&
    !company.cancel_at_period_end
  ) {
    return {
      message: "Já existe uma assinatura recorrente vinculada a esta empresa.",
      checkout_url: company.assinatura_checkout_url || null,
      company: safeCompany(company),
    };
  }

  let workingCompany = company;
  let freeTrialDays = 0;

  if (!company.trial_used_at) {
    const claimed = await claimTrial(admin, company.id);
    if (claimed) {
      workingCompany = claimed;
      freeTrialDays = 7;
      await recordSubscriptionEvent(admin, {
        companyId: company.id,
        eventType: "trial_started",
        oldStatus: company.assinatura_status,
        newStatus: "trialing",
        providerReference: `trial:${company.id}`,
        metadata: { plan: planKey, days: 7 },
      });
    }
  } else {
    freeTrialDays = trialDaysRemaining(company);
  }

  const { data: paymentRow, error: paymentError } = await admin
    .from("plan_payments")
    .insert({
      company_id: company.id,
      plano: planKey,
      valor: plan.price,
      status: "subscription_pending",
      tipo: "subscription",
      payment_method: "card_recurring",
      email,
      nome_empresa: company.nome || "Empresa",
    })
    .select("id")
    .single();

  if (paymentError) throw paymentError;

  const externalReference = `orcaly_subscription:${company.id}:${planKey}:${paymentRow.id}`;
  const autoRecurring: Record<string, unknown> = {
    frequency: 1,
    frequency_type: "months",
    transaction_amount: plan.price,
    currency_id: "BRL",
  };

  if (freeTrialDays > 0) {
    autoRecurring.free_trial = {
      frequency: freeTrialDays,
      frequency_type: "days",
    };
  }

  let subscription: any;
  try {
    subscription = await mercadoPagoPlatformRequest("/preapproval", {
      method: "POST",
      body: JSON.stringify({
        reason: `Plano ${plan.name} - Orçaly`,
        external_reference: externalReference,
        payer_email: email,
        back_url: `${getAppUrl()}/assinatura/retorno`,
        notification_url: `${getAppUrl()}/api/mercado-pago/webhook`,
        auto_recurring: autoRecurring,
        status: "pending",
      }),
    });
  } catch (error) {
    await admin
      .from("plan_payments")
      .update({
        status: "subscription_error",
        updated_at: new Date().toISOString(),
      })
      .eq("id", paymentRow.id);
    throw error;
  }

  const checkoutUrl = subscription.init_point || subscription.sandbox_init_point || null;
  const now = new Date().toISOString();

  await admin
    .from("plan_payments")
    .update({
      mercado_pago_preapproval_id: subscription.id || null,
      checkout_url: checkoutUrl,
      status: subscription.status ? `subscription_${subscription.status}` : "subscription_pending",
      raw_subscription: subscription,
      next_payment_date: subscription.next_payment_date || null,
      updated_at: now,
    })
    .eq("id", paymentRow.id);

  const internalStatus = freeTrialDays > 0 ? "trialing" : "pendente";
  const { data: updatedCompany, error: companyError } = await admin
    .from("companies")
    .update({
      plano: planKey,
      assinatura_plano: planKey,
      assinatura_status: internalStatus,
      assinatura_forma_pagamento_preferida: "cartao_recorrente",
      assinatura_auto_recorrente: false,
      assinatura_checkout_url: checkoutUrl,
      mercado_pago_subscription_id: subscription.id || null,
      mercado_pago_subscription_status: subscription.status || "pending",
      mercado_pago_customer_email: email,
      assinatura_mp_payload: subscription,
      assinatura_proxima_cobranca: subscription.next_payment_date || workingCompany.trial_ends_at || null,
      cancel_at_period_end: false,
      updated_at: now,
    })
    .eq("id", company.id)
    .select("*")
    .single();

  if (companyError) throw companyError;

  await recordSubscriptionEvent(admin, {
    companyId: company.id,
    eventType: "subscription_created",
    oldStatus: company.assinatura_status,
    newStatus: internalStatus,
    providerReference: subscription.id || paymentRow.id,
    metadata: { plan: planKey, payment_type: "card_recurring", trial_days: freeTrialDays },
  });

  return {
    message:
      freeTrialDays > 0
        ? "Teste gratuito iniciado. Conclua o cadastro do cartão para a cobrança após o período gratuito."
        : "Assinatura criada. Conclua o cadastro no Mercado Pago.",
    checkout_url: checkoutUrl,
    subscription_status: subscription.status || "pending",
    company: safeCompany(updatedCompany),
  };
}

async function createPixPayment(
  context: Awaited<ReturnType<typeof resolveSubscriptionContext>>,
  body: any,
) {
  const { admin, company, user } = context;
  const planKey = normalizePlan(body?.plan || body?.plano || company.assinatura_plano || company.plano);
  const plan = ORCALY_PLANS[planKey];
  const email = String(company.email || user?.email || "").trim().toLowerCase();
  const forcePayment = body?.forcePayment === true;

  if (!email || !email.includes("@")) {
    throw new Error("Cadastre um e-mail válido na empresa antes de pagar por Pix.");
  }

  if (!company.trial_used_at) {
    const claimed = await claimTrial(admin, company.id);
    if (!claimed) {
      throw new Error("O teste gratuito já foi utilizado.");
    }

    await admin
      .from("companies")
      .update({
        plano: planKey,
        assinatura_plano: planKey,
        assinatura_forma_pagamento_preferida: "pix_avulso",
        updated_at: new Date().toISOString(),
      })
      .eq("id", company.id);

    await recordSubscriptionEvent(admin, {
      companyId: company.id,
      eventType: "trial_started",
      oldStatus: company.assinatura_status,
      newStatus: "trialing",
      providerReference: `trial:${company.id}`,
      metadata: { plan: planKey, payment_type: "pix_avulso", days: 7 },
    });

    return {
      trial_started: true,
      checkout_url: null,
      message:
        "Seu teste gratuito de sete dias começou. Nenhuma cobrança Pix foi criada agora.",
      company: safeCompany(claimed),
    };
  }

  const access = getCompanySubscriptionAccess(company);
  if (access.isTrial && !forcePayment) {
    return {
      trial_started: false,
      checkout_url: null,
      message: `Seu teste termina em ${access.accessUntil}. Gere o Pix quando desejar pagar o próximo mês.`,
      company: safeCompany(company),
    };
  }

  const { data: paymentRow, error: paymentError } = await admin
    .from("plan_payments")
    .insert({
      company_id: company.id,
      plano: planKey,
      valor: plan.price,
      status: "pending",
      tipo: "pix_avulso",
      payment_method: "pix",
      email,
      nome_empresa: company.nome || "Empresa",
    })
    .select("id")
    .single();

  if (paymentError) throw paymentError;

  const externalReference = `orcaly_subscription_pix:${company.id}:${planKey}:${paymentRow.id}`;
  const preference = await mercadoPagoPlatformRequest("/checkout/preferences", {
    method: "POST",
    body: JSON.stringify({
      items: [
        {
          id: `orcaly-${planKey}`,
          title: `Plano ${plan.name} - Orçaly`,
          description: plan.description,
          quantity: 1,
          currency_id: "BRL",
          unit_price: plan.price,
        },
      ],
      payer: { email },
      external_reference: externalReference,
      notification_url: `${getAppUrl()}/api/mercado-pago/webhook`,
      back_urls: {
        success: `${getAppUrl()}/assinatura/retorno`,
        pending: `${getAppUrl()}/assinatura/retorno`,
        failure: `${getAppUrl()}/painel/assinatura`,
      },
      auto_return: "approved",
      metadata: {
        company_id: company.id,
        plano: planKey,
        payment_mode: "pix_avulso",
        plan_payment_id: paymentRow.id,
      },
      payment_methods: {
        excluded_payment_types: [
          { id: "credit_card" },
          { id: "debit_card" },
          { id: "ticket" },
        ],
        installments: 1,
      },
    }),
  });

  const checkoutUrl = preference.init_point || preference.sandbox_init_point || null;
  await admin
    .from("plan_payments")
    .update({
      mercado_pago_preference_id: preference.id || null,
      checkout_url: checkoutUrl,
      raw_preference: preference,
      updated_at: new Date().toISOString(),
    })
    .eq("id", paymentRow.id);

  await admin
    .from("companies")
    .update({
      plano: planKey,
      assinatura_plano: planKey,
      assinatura_forma_pagamento_preferida: "pix_avulso",
      assinatura_checkout_url: checkoutUrl,
      assinatura_pix_avulso_status: "pending",
      updated_at: new Date().toISOString(),
    })
    .eq("id", company.id);

  await recordSubscriptionEvent(admin, {
    companyId: company.id,
    eventType: "pix_created",
    oldStatus: company.assinatura_status,
    newStatus: company.assinatura_status,
    providerReference: preference.id || paymentRow.id,
    metadata: { plan: planKey, amount: plan.price },
  });

  return {
    checkout_url: checkoutUrl,
    message: "Pagamento Pix criado. O acesso será renovado após a aprovação.",
    company: safeCompany(company),
  };
}

export async function cancelCompanySubscription(request: NextRequest, reason?: unknown) {
  const context = await resolveSubscriptionContext(request);
  const { admin, company } = context;

  if (!context.user) throw new Error("Não autorizado.");
  if (!company?.id) throw new Error("Empresa não encontrada.");
  if (!context.canManage) throw new Error("Você não possui permissão para cancelar a assinatura.");

  const access = getCompanySubscriptionAccess(company);
  const preapprovalId =
    company.mercado_pago_subscription_id || company.mercado_pago_preapproval_id || null;
  const paymentType = String(
    company.assinatura_forma_pagamento_preferida ||
      (preapprovalId ? "cartao_recorrente" : "pix_avulso"),
  ).toLowerCase();

  if (company.cancel_at_period_end || access.status === "cancel_at_period_end") {
    return {
      already_cancelled: true,
      message: "Sua assinatura já possui cancelamento agendado.",
      company: safeCompany(company),
    };
  }

  let remoteSubscription: any = null;
  if (paymentType.includes("cartao") || paymentType.includes("recorrente")) {
    if (!preapprovalId) {
      throw new Error("Não encontramos uma assinatura recorrente ativa.");
    }

    remoteSubscription = await mercadoPagoPlatformRequest(
      `/preapproval/${encodeURIComponent(preapprovalId)}`,
      {
        method: "PUT",
        body: JSON.stringify({ status: "canceled" }),
      },
    );

    const remoteStatus = String(remoteSubscription?.status || "").toLowerCase();
    if (!["canceled", "cancelled"].includes(remoteStatus)) {
      throw new Error(
        "O Mercado Pago não confirmou o cancelamento. Nenhuma alteração local foi aplicada.",
      );
    }
  }

  const now = new Date();
  const accessUntil = access.isTrial
    ? validDate(company.trial_ends_at)
    : maxDate(company.access_until, company.assinatura_expira_em, now);
  const finalAccess = accessUntil && accessUntil > now ? accessUntil : now;
  const previousStatus = company.assinatura_status || null;

  const { data: updatedCompany, error } = await admin
    .from("companies")
    .update({
      assinatura_status: "cancel_at_period_end",
      assinatura_auto_recorrente: false,
      assinatura_cancelada_em: now.toISOString(),
      cancel_at_period_end: true,
      access_until: finalAccess.toISOString(),
      mercado_pago_subscription_status:
        remoteSubscription?.status || company.mercado_pago_subscription_status || "canceled",
      assinatura_mp_payload: remoteSubscription || company.assinatura_mp_payload || null,
      updated_at: now.toISOString(),
    })
    .eq("id", company.id)
    .select("*")
    .single();

  if (error) throw error;

  await recordSubscriptionEvent(admin, {
    companyId: company.id,
    eventType: "cancellation_requested",
    oldStatus: previousStatus,
    newStatus: "cancel_at_period_end",
    providerReference: preapprovalId || `pix:${company.id}:${now.toISOString()}`,
    metadata: {
      payment_type: paymentType,
      reason: typeof reason === "string" ? reason.slice(0, 160) : null,
      access_until: finalAccess.toISOString(),
    },
  });

  return {
    message: access.isTrial
      ? `Seu teste foi cancelado. Você poderá utilizar o Orçaly até ${finalAccess.toISOString()} e nenhuma cobrança será realizada.`
      : `Sua assinatura foi cancelada. Você continuará com acesso até ${finalAccess.toISOString()}.`,
    company: safeCompany(updatedCompany),
  };
}

export async function syncCompanySubscription(request: NextRequest) {
  const context = await resolveSubscriptionContext(request);
  const { admin, company } = context;

  if (!context.user) throw new Error("Não autorizado.");
  if (!company?.id) throw new Error("Empresa não encontrada.");

  const preapprovalId =
    company.mercado_pago_subscription_id || company.mercado_pago_preapproval_id || null;

  if (!preapprovalId) {
    return { message: "Nenhuma assinatura recorrente para sincronizar.", company: safeCompany(company) };
  }

  const subscription = await mercadoPagoPlatformRequest(
    `/preapproval/${encodeURIComponent(preapprovalId)}`,
  );
  const remoteStatus = String(subscription.status || "pending").toLowerCase();
  const access = getCompanySubscriptionAccess(company);
  let internalStatus = company.assinatura_status || "pendente";

  if (access.isTrial) internalStatus = "trialing";
  else if (company.cancel_at_period_end && access.hasAccess) internalStatus = "cancel_at_period_end";
  else if (remoteStatus === "authorized") internalStatus = "ativa";
  else if (["canceled", "cancelled"].includes(remoteStatus)) {
    internalStatus = access.hasAccess ? "cancel_at_period_end" : "cancelada";
  } else if (remoteStatus === "paused") internalStatus = "past_due";
  else if (remoteStatus === "pending") internalStatus = access.hasAccess ? internalStatus : "pendente";

  const { data: updatedCompany, error } = await admin
    .from("companies")
    .update({
      assinatura_status: internalStatus,
      assinatura_auto_recorrente: remoteStatus === "authorized" && !company.cancel_at_period_end,
      assinatura_checkout_url:
        subscription.init_point || subscription.sandbox_init_point || company.assinatura_checkout_url || null,
      assinatura_proxima_cobranca: subscription.next_payment_date || null,
      mercado_pago_subscription_status: remoteStatus,
      mercado_pago_customer_email: subscription.payer_email || company.mercado_pago_customer_email || null,
      assinatura_mp_payload: subscription,
      updated_at: new Date().toISOString(),
    })
    .eq("id", company.id)
    .select("*")
    .single();

  if (error) throw error;

  return { message: "Assinatura sincronizada.", company: safeCompany(updatedCompany) };
}

export async function manageCompanySubscription(request: NextRequest, body: any) {
  const action = normalizeAction(body?.action);

  if (action === "cancel") {
    return cancelCompanySubscription(request, body?.reason);
  }

  if (action === "sync") {
    return syncCompanySubscription(request);
  }

  const context = await resolveSubscriptionContext(request);
  if (!context.user) throw new Error("Não autorizado.");
  if (!context.company?.id) throw new Error("Empresa não encontrada.");
  if (!context.canManage) throw new Error("Você não possui permissão para gerenciar a assinatura.");

  if (action === "history") {
    return getHistory(context.admin, context.company.id);
  }

  const paymentType = String(body?.paymentType || body?.payment_type || "card").toLowerCase();
  if (action === "create_pix" || paymentType === "pix") {
    return createPixPayment(context, body);
  }

  return createRecurringSubscription(context, body);
}

export function parseOrcalySubscriptionReference(value: unknown) {
  const raw = String(value || "").trim();
  const parts = raw.split(":");

  if (parts[0] === "orcaly_subscription" && isUuid(parts[1])) {
    return { kind: "recurring" as const, companyId: parts[1], plan: normalizePlan(parts[2]), paymentRowId: parts[3] || null };
  }

  if (parts[0] === "orcaly_subscription_pix" && isUuid(parts[1])) {
    return { kind: "pix" as const, companyId: parts[1], plan: normalizePlan(parts[2]), paymentRowId: parts[3] || null };
  }

  return null;
}

export async function findCompanyForProviderReference(
  admin: ReturnType<typeof getSupabaseAdmin>,
  reference: unknown,
  preapprovalId?: string | null,
) {
  const parsed = parseOrcalySubscriptionReference(reference);
  if (parsed?.companyId) {
    const { data } = await admin.from("companies").select("*").eq("id", parsed.companyId).maybeSingle();
    return { company: data, parsed };
  }

  if (preapprovalId) {
    const { data } = await admin
      .from("companies")
      .select("*")
      .or(`mercado_pago_subscription_id.eq.${preapprovalId},mercado_pago_preapproval_id.eq.${preapprovalId}`)
      .limit(1)
      .maybeSingle();
    if (data?.id) return { company: data, parsed: null };
  }

  if (isUuid(reference)) {
    const { data: payment } = await admin
      .from("plan_payments")
      .select("company_id,plano,id")
      .eq("id", reference)
      .maybeSingle();
    if (payment?.company_id) {
      const { data: company } = await admin
        .from("companies")
        .select("*")
        .eq("id", payment.company_id)
        .maybeSingle();
      return {
        company,
        parsed: { kind: "legacy" as const, companyId: payment.company_id, plan: normalizePlan(payment.plano), paymentRowId: payment.id },
      };
    }
  }

  return { company: null, parsed: null };
}

export async function applyApprovedSubscriptionPayment(
  admin: ReturnType<typeof getSupabaseAdmin>,
  company: any,
  options: {
    plan?: unknown;
    providerReference: string;
    preapprovalId?: string | null;
    nextPaymentDate?: string | null;
    paymentType: "pix" | "card_recurring";
    amount?: number | null;
  },
) {
  const now = new Date();
  const planKey = normalizePlan(options.plan || company.assinatura_plano || company.plano);
  const currentEnd = maxDate(company.access_until, company.assinatura_expira_em);
  const providerNext = validDate(options.nextPaymentDate);
  const newAccessUntil = providerNext && providerNext > now
    ? providerNext
    : addMonth(currentEnd && currentEnd > now ? currentEnd : now);

  const { data: updatedCompany, error } = await admin
    .from("companies")
    .update({
      ativo: true,
      plano: planKey,
      assinatura_plano: planKey,
      assinatura_status: "ativa",
      assinatura_inicio: company.assinatura_inicio || now.toISOString(),
      assinatura_expira_em: newAccessUntil.toISOString(),
      access_until: newAccessUntil.toISOString(),
      assinatura_ultimo_pagamento: now.toISOString(),
      assinatura_proxima_cobranca: options.nextPaymentDate || null,
      assinatura_auto_recorrente: options.paymentType === "card_recurring",
      assinatura_forma_pagamento_preferida:
        options.paymentType === "card_recurring" ? "cartao_recorrente" : "pix_avulso",
      assinatura_pix_avulso_status: options.paymentType === "pix" ? "paid" : company.assinatura_pix_avulso_status || null,
      assinatura_pix_avulso_ultimo_pagamento: options.paymentType === "pix" ? now.toISOString() : company.assinatura_pix_avulso_ultimo_pagamento || null,
      mercado_pago_subscription_id: options.preapprovalId || company.mercado_pago_subscription_id || null,
      mercado_pago_subscription_status:
        options.paymentType === "card_recurring" ? "authorized" : company.mercado_pago_subscription_status || null,
      cancel_at_period_end: false,
      updated_at: now.toISOString(),
    })
    .eq("id", company.id)
    .select("*")
    .single();

  if (error) throw error;

  await recordSubscriptionEvent(admin, {
    companyId: company.id,
    eventType: "payment_approved",
    oldStatus: company.assinatura_status,
    newStatus: "ativa",
    providerReference: options.providerReference,
    metadata: {
      plan: planKey,
      payment_type: options.paymentType,
      amount: options.amount || null,
      access_until: newAccessUntil.toISOString(),
    },
  });

  return updatedCompany;
}
