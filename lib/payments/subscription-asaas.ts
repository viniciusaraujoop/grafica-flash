// ORCALY_SUBSCRIPTION_WEBHOOK_V1
import "server-only";
import { createHash } from "node:crypto";
import type { NextRequest } from "next/server";
import {
  canUseAsaasSubscriptions,
  getAsaasCapabilities,
  requireAsaasMasterApiKey,
} from "@/lib/payments/asaas-config";
import { AsaasProvider } from "@/lib/payments/providers/asaas";
import { getRequestIp, requireUserCompany } from "@/lib/payments/server-context";
import { getPlanConfig } from "@/lib/plans/plan-config";

type JsonRecord = Record<string, unknown>;
const text = (value: unknown) => String(value || "").trim();
const obj = (value: unknown): JsonRecord =>
  value && typeof value === "object" ? (value as JsonRecord) : {};

function customerData(body: JsonRecord, context: Awaited<ReturnType<typeof requireUserCompany>>) {
  const customer = obj(body.customer);
  return {
    name: text(customer.name || body.name || context.company.nome),
    email: text(customer.email || body.email || context.company.email || context.user.email),
    cpfCnpj: text(customer.cpfCnpj || body.cpfCnpj).replace(/\D/g, ""),
    phone: text(customer.phone || body.phone || context.company.whatsapp || context.company.telefone).replace(/\D/g, ""),
    postalCode: text(customer.postalCode || body.postalCode).replace(/\D/g, ""),
    addressNumber: text(customer.addressNumber || body.addressNumber),
    addressComplement: text(customer.addressComplement || body.addressComplement),
  };
}

async function rootCustomer(
  provider: AsaasProvider,
  context: Awaited<ReturnType<typeof requireUserCompany>>,
  customer: ReturnType<typeof customerData>,
) {
  const companyId = text(context.company.id);
  const { data: existing } = await context.supabase
    .from("provider_customers")
    .select("provider_customer_id")
    .eq("company_id", companyId)
    .eq("provider", "asaas_root")
    .eq("customer_id", companyId)
    .maybeSingle();

  if (existing?.provider_customer_id) return String(existing.provider_customer_id);

  const created = await provider.createCustomer({
    name: customer.name,
    email: customer.email,
    cpfCnpj: customer.cpfCnpj,
    mobilePhone: customer.phone,
    externalReference: `company:${companyId}`,
    notificationDisabled: true,
  });

  await context.supabase.from("provider_customers").upsert(
    {
      company_id: companyId,
      customer_id: companyId,
      provider: "asaas_root",
      provider_customer_id: created.id,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "company_id,provider,customer_id" },
  );
  return created.id;
}

async function claimTrial(context: Awaited<ReturnType<typeof requireUserCompany>>) {
  const { data, error } = await context.supabase.rpc("claim_company_subscription_trial", {
    p_company_id: text(context.company.id),
  });
  if (error) {
    throw Object.assign(new Error("Nao foi possivel iniciar ou recuperar o periodo gratuito."), { status: 409 });
  }
  const row = Array.isArray(data) ? data[0] : data;
  const record = obj(row);
  return text(record.trial_ends_at || context.company.trial_ends_at) ||
    new Date(Date.now() + 7 * 86400000).toISOString();
}

export async function handleAsaasSubscriptionCheckout(request: NextRequest) {
  if (!canUseAsaasSubscriptions()) {
    throw Object.assign(new Error("As assinaturas pelo novo sistema ainda nao foram habilitadas."), { status: 409 });
  }

  const context = await requireUserCompany(request);
  const body = (await request.json()) as JsonRecord;
  const customer = customerData(body, context);
  const plan = getPlanConfig(body.planKey || body.plan || context.company.assinatura_plano);
  const method = text(body.paymentMethod || body.payment_method || "PIX").toUpperCase();

  if (!["PIX", "CREDIT_CARD"].includes(method)) {
    throw Object.assign(new Error("Escolha Pix ou cartao."), { status: 400 });
  }
  if (!customer.name || !customer.email || !customer.cpfCnpj) {
    throw Object.assign(new Error("Informe nome, e-mail e CPF ou CNPJ."), { status: 400 });
  }

  const companyId = text(context.company.id);
  const key = createHash("sha256")
    .update(`${companyId}:${plan.key}:${method}:${Math.floor(Date.now() / 300000)}`)
    .digest("hex");

  const { data: repeated } = await context.supabase
    .from("plan_payments")
    .select("*")
    .eq("company_id", companyId)
    .eq("idempotency_key", key)
    .maybeSingle();
  if (repeated?.provider_subscription_id) {
    return { ok: true, repeated: true, status: repeated.status, subscriptionId: repeated.provider_subscription_id };
  }

  const provider = new AsaasProvider(requireAsaasMasterApiKey());
  const providerCustomerId = await rootCustomer(provider, context, customer);
  const trialEndsAt = await claimTrial(context);
  const nextDueDate = new Date(trialEndsAt).toISOString().slice(0, 10);
  const externalReference = `subscription:${companyId}:${plan.key}:${Date.now()}`;
  const common = {
    customer: providerCustomerId,
    billingType: method as "PIX" | "CREDIT_CARD",
    value: plan.monthlyPrice,
    nextDueDate,
    cycle: "MONTHLY" as const,
    description: `Assinatura Orcaly - ${plan.label}`,
    externalReference,
  };

  let subscription;
  if (method === "PIX") {
    subscription = await provider.createSubscription(common);
  } else {
    if (!getAsaasCapabilities().cardTokenizationEnabled) {
      throw Object.assign(new Error("O cartao recorrente ainda nao foi habilitado. Utilize Pix."), { status: 409 });
    }
    const card = obj(body.card);
    const tokenized = await provider.tokenizeCreditCard({
      customer: providerCustomerId,
      creditCard: {
        holderName: text(card.holderName),
        number: text(card.number),
        expiryMonth: text(card.expiryMonth),
        expiryYear: text(card.expiryYear),
        ccv: text(card.ccv),
      },
      creditCardHolderInfo: {
        name: customer.name,
        email: customer.email,
        cpfCnpj: customer.cpfCnpj,
        postalCode: customer.postalCode,
        addressNumber: customer.addressNumber,
        addressComplement: customer.addressComplement,
        mobilePhone: customer.phone,
      },
      remoteIp: getRequestIp(request),
    });
    subscription = await provider.createSubscription({
      ...common,
      creditCardToken: text(tokenized.creditCardToken),
      remoteIp: getRequestIp(request),
    });
  }

  const now = new Date().toISOString();
  const { error: insertError } = await context.supabase.from("plan_payments").insert({
    company_id: companyId,
    plano: plan.key,
    valor: plan.monthlyPrice,
    status: subscription.status || "PENDING",
    email: customer.email,
    nome_empresa: text(context.company.nome),
    tipo: "subscription",
    payment_method: method,
    provider: "asaas",
    provider_customer_id: providerCustomerId,
    provider_subscription_id: subscription.id,
    billing_type: method,
    external_reference: externalReference,
    idempotency_key: key,
    next_payment_date: subscription.dueDate || nextDueDate,
    updated_at: now,
  });

  if (insertError) {
    await provider.cancelSubscription(subscription.id).catch(() => undefined);
    throw Object.assign(new Error("A assinatura foi criada, mas nao foi registrada no Orcaly."), { status: 500 });
  }

  await context.supabase.from("companies").update({
    assinatura_plano: plan.key,
    assinatura_status: "trialing",
    assinatura_inicio: now,
    assinatura_forma_pagamento_preferida: method.toLowerCase(),
    assinatura_auto_recorrente: true,
    assinatura_proxima_cobranca: subscription.dueDate || nextDueDate,
    subscription_provider: "asaas",
    provider_customer_id: providerCustomerId,
    provider_subscription_id: subscription.id,
    next_billing_at: subscription.dueDate || nextDueDate,
    cancel_at_period_end: false,
    updated_at: now,
  }).eq("id", companyId);

  return {
    ok: true,
    subscriptionId: subscription.id,
    status: subscription.status,
    plan: plan.key,
    trialEndsAt,
    nextDueDate: subscription.dueDate || nextDueDate,
    message: method === "PIX"
      ? "Assinatura preparada. A cobranca Pix sera disponibilizada no vencimento."
      : "Assinatura recorrente configurada.",
  };
}

export async function handleAsaasSubscriptionCancel(request: NextRequest) {
  const context = await requireUserCompany(request);
  const companyId = text(context.company.id);
  const { data: record } = await context.supabase
    .from("plan_payments")
    .select("*")
    .eq("company_id", companyId)
    .eq("provider", "asaas")
    .is("cancelled_at", null)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const subscriptionId = text(record?.provider_subscription_id || context.company.provider_subscription_id);
  if (!subscriptionId) throw Object.assign(new Error("Assinatura ativa nao encontrada."), { status: 404 });

  const provider = new AsaasProvider(requireAsaasMasterApiKey());
  await provider.cancelSubscription(subscriptionId);
  const now = new Date().toISOString();
  const accessUntil = text(context.company.access_until || context.company.trial_ends_at || context.company.assinatura_expira_em) || now;

  await context.supabase.from("plan_payments").update({
    status: "cancelled",
    cancelled_at: now,
    updated_at: now,
  }).eq("company_id", companyId).eq("provider_subscription_id", subscriptionId);

  await context.supabase.from("companies").update({
    assinatura_status: "cancelled",
    assinatura_cancelada_em: now,
    cancel_at_period_end: true,
    access_until: accessUntil,
    updated_at: now,
  }).eq("id", companyId);

  return { ok: true, status: "cancelled", accessUntil, message: "A renovacao foi cancelada." };
}
