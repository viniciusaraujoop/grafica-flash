// ORCALY_ASAAS_MIGRATION_V2
import "server-only";
import type { NextRequest } from "next/server";
import {
  getAsaasCapabilities,
  requireAsaasMasterApiKey,
} from "@/lib/payments/asaas-config";
import { AsaasProvider } from "@/lib/payments/providers/asaas";
import { getRequestIp, requireUserCompany } from "@/lib/payments/server-context";
import { getPlanConfig } from "@/lib/plans/plan-config";

type JsonRecord = Record<string, unknown>;
const text = (value: unknown) => String(value || "").trim();

function companyDocument(company: JsonRecord) {
  return text(
    company.cpf_cnpj ||
      company.cnpj ||
      company.cpf ||
      company.documento,
  );
}

async function rootCustomer(
  provider: AsaasProvider,
  context: Awaited<ReturnType<typeof requireUserCompany>>,
) {
  const companyId = text(context.company.id);

  const { data: existing } = await context.supabase
    .from("provider_customers")
    .select("provider_customer_id")
    .eq("company_id", companyId)
    .eq("provider", "asaas_root")
    .eq("customer_id", companyId)
    .maybeSingle();

  if (existing?.provider_customer_id) {
    return String(existing.provider_customer_id);
  }

  const created = await provider.createCustomer({
    name: text(context.company.nome || context.company.name),
    email: text(context.company.email || context.user.email),
    cpfCnpj: companyDocument(context.company),
    mobilePhone: text(
      context.company.whatsapp || context.company.telefone,
    ),
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

async function trialEnd(
  context: Awaited<ReturnType<typeof requireUserCompany>>,
) {
  const { data, error } = await context.supabase.rpc(
    "claim_company_subscription_trial",
    { p_company_id: text(context.company.id) },
  );

  if (error) {
    throw Object.assign(
      new Error(
        "Nao foi possivel iniciar o teste gratuito. Aplique as migrations de assinatura e Asaas no Supabase.",
      ),
      { status: 409 },
    );
  }

  const row = Array.isArray(data) ? data[0] : data;
  const record =
    row && typeof row === "object" ? (row as JsonRecord) : {};
  const current = text(
    record.trial_ends_at || context.company.trial_ends_at,
  );

  return current || new Date(Date.now() + 7 * 86400000).toISOString();
}

export async function handleAsaasSubscriptionCheckout(
  request: NextRequest,
) {
  const context = await requireUserCompany(request);
  const body = (await request.json()) as JsonRecord;
  const plan = getPlanConfig(
    body.planKey ||
      body.plan ||
      body.planId ||
      body.plano ||
      context.company.assinatura_plano,
  );
  const method = text(
    body.paymentMethod || body.payment_method || body.metodo,
  ).toUpperCase();

  if (!["PIX", "CREDIT_CARD"].includes(method)) {
    throw Object.assign(new Error("Escolha Pix ou cartao."), {
      status: 400,
    });
  }

  if (!companyDocument(context.company)) {
    throw Object.assign(
      new Error(
        "Cadastre o CPF ou CNPJ da empresa antes de criar a assinatura.",
      ),
      { status: 400 },
    );
  }

  const provider = new AsaasProvider(requireAsaasMasterApiKey());
  const customerId = await rootCustomer(provider, context);
  const trialEndsAt = await trialEnd(context);
  const nextDueDate = new Date(trialEndsAt).toISOString().slice(0, 10);
  const externalReference = `subscription:${context.company.id}:${Date.now()}`;

  const common = {
    customer: customerId,
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
      throw Object.assign(
        new Error(
          "A tokenizacao de cartao ainda nao foi habilitada. Utilize Pix.",
        ),
        { status: 409 },
      );
    }

    const card =
      body.card && typeof body.card === "object"
        ? (body.card as JsonRecord)
        : null;

    if (!card) {
      throw Object.assign(
        new Error("Informe os dados do cartao no checkout seguro."),
        { status: 400 },
      );
    }

    const tokenized = await provider.tokenizeCreditCard({
      customer: customerId,
      creditCard: {
        holderName: text(card.holderName),
        number: text(card.number),
        expiryMonth: text(card.expiryMonth),
        expiryYear: text(card.expiryYear),
        ccv: text(card.ccv),
      },
      creditCardHolderInfo: {
        name: text(body.holderName || context.company.nome),
        email: text(body.email || context.user.email),
        cpfCnpj: text(body.cpfCnpj || companyDocument(context.company)),
        postalCode: text(body.postalCode),
        addressNumber: text(body.addressNumber),
        addressComplement: text(body.addressComplement),
        mobilePhone: text(
          body.phone ||
            context.company.whatsapp ||
            context.company.telefone,
        ),
      },
      remoteIp: getRequestIp(request),
    });

    subscription = await provider.createSubscription({
      ...common,
      creditCardToken: text(tokenized.creditCardToken),
      remoteIp: getRequestIp(request),
    });
  }

  const companyId = text(context.company.id);

  await context.supabase.from("plan_payments").insert({
    company_id: companyId,
    provider: "asaas",
    provider_customer_id: customerId,
    provider_subscription_id: subscription.id,
    billing_type: method,
    plan_key: plan.key,
    amount: plan.monthlyPrice,
    status: subscription.status,
    next_due_date: subscription.dueDate || nextDueDate,
    external_reference: externalReference,
  });

  await context.supabase
    .from("companies")
    .update({
      assinatura_plano: plan.key,
      assinatura_status: "trialing",
      subscription_provider: "asaas",
      provider_customer_id: customerId,
      provider_subscription_id: subscription.id,
      next_billing_at: subscription.dueDate || nextDueDate,
      updated_at: new Date().toISOString(),
    })
    .eq("id", companyId);

  return {
    ok: true,
    provider: "asaas",
    subscriptionId: subscription.id,
    status: subscription.status,
    plan: plan.key,
    trialEndsAt,
    nextDueDate: subscription.dueDate || nextDueDate,
    message:
      method === "PIX"
        ? "Teste gratuito iniciado. A primeira cobranca Pix sera gerada no vencimento."
        : "Teste gratuito e assinatura com cartao configurados.",
  };
}

export async function handleAsaasSubscriptionCancel(
  request: NextRequest,
) {
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

  const subscriptionId = text(
    record?.provider_subscription_id ||
      context.company.provider_subscription_id,
  );

  if (!subscriptionId) {
    throw Object.assign(
      new Error("Assinatura Asaas ativa nao encontrada."),
      { status: 404 },
    );
  }

  const provider = new AsaasProvider(requireAsaasMasterApiKey());
  await provider.cancelSubscription(subscriptionId);

  const now = new Date().toISOString();
  const accessUntil =
    text(
      context.company.access_until ||
        context.company.trial_ends_at ||
        context.company.assinatura_expira_em,
    ) || now;

  await context.supabase
    .from("plan_payments")
    .update({
      status: "cancelled",
      cancelled_at: now,
      updated_at: now,
    })
    .eq("company_id", companyId)
    .eq("provider_subscription_id", subscriptionId);

  await context.supabase
    .from("companies")
    .update({
      assinatura_status: "cancelled",
      subscription_cancelled_at: now,
      cancel_at_period_end: true,
      access_until: accessUntil,
      updated_at: now,
    })
    .eq("id", companyId);

  return {
    ok: true,
    status: "cancelled",
    accessUntil,
    message:
      "A assinatura foi cancelada no Asaas. O acesso sera preservado ate a data valida.",
  };
}
