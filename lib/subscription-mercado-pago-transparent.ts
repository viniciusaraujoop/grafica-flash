import "server-only";
import type { NextRequest } from "next/server";
import {
  getAppUrl,
  mercadoPagoPlatformRequest,
  ORCALY_PLANS,
  recordSubscriptionEvent,
  resolveSubscriptionContext,
  type PlanKey,
} from "@/lib/subscription-service";

type JsonRecord = Record<string, unknown>;

const DAY_MS = 86_400_000;

function text(value: unknown) {
  return String(value || "").trim();
}

function normalizePlan(value: unknown): PlanKey {
  const normalized = text(value).toLowerCase();

  if (
    normalized === "basico" ||
    normalized === "básico" ||
    normalized === "essencial"
  ) {
    return "basico";
  }

  if (
    normalized === "profissional" ||
    normalized === "intermediario" ||
    normalized === "intermediário"
  ) {
    return "profissional";
  }

  if (normalized === "premium") {
    return "premium";
  }

  return "profissional";
}

function validDate(value: unknown) {
  if (!value) return null;

  const date = new Date(String(value));

  return Number.isNaN(date.getTime()) ? null : date;
}

function remainingTrialDays(company: JsonRecord) {
  if (!company.trial_used_at) return 7;

  const end = validDate(company.trial_ends_at);

  if (!end || end.getTime() <= Date.now()) return 0;

  return Math.max(
    1,
    Math.ceil((end.getTime() - Date.now()) / DAY_MS),
  );
}

async function claimTrial(
  admin: Awaited<
    ReturnType<typeof resolveSubscriptionContext>
  >["admin"],
  companyId: string,
) {
  const { data, error } = await admin.rpc(
    "claim_company_subscription_trial",
    { p_company_id: companyId },
  );

  if (error) {
    throw new Error(
      "Nao foi possivel registrar os sete dias gratuitos.",
    );
  }

  const row = Array.isArray(data) ? data[0] : data;

  if (!row) {
    throw new Error(
      "O periodo gratuito desta empresa ja foi utilizado.",
    );
  }

  return row as JsonRecord;
}

async function cancelRemoteSubscription(
  subscriptionId: string,
) {
  await mercadoPagoPlatformRequest(
    `/preapproval/${encodeURIComponent(subscriptionId)}`,
    {
      method: "PUT",
      body: JSON.stringify({ status: "canceled" }),
    },
  ).catch(() => undefined);
}

export async function createTransparentSubscription(
  request: NextRequest,
) {
  const context = await resolveSubscriptionContext(request);

  if (!context.user) {
    throw Object.assign(new Error("Nao autorizado."), {
      status: 401,
    });
  }

  if (!context.company?.id) {
    throw Object.assign(
      new Error("Empresa nao encontrada."),
      { status: 404 },
    );
  }

  if (!context.canManage) {
    throw Object.assign(
      new Error(
        "Voce nao possui permissao para gerenciar a assinatura.",
      ),
      { status: 403 },
    );
  }

  const body = (await request
    .json()
    .catch(() => ({}))) as JsonRecord;

  const cardTokenId = text(
    body.cardTokenId ||
      body.card_token_id ||
      body.token,
  );

  if (!cardTokenId) {
    throw Object.assign(
      new Error(
        "Não foi possível gerar o token seguro do cartão.",
      ),
      { status: 400 },
    );
  }

  const company = context.company as JsonRecord;
  const companyId = text(company.id);
  const planKey = normalizePlan(
    body.plan ||
      body.planKey ||
      company.assinatura_plano ||
      company.plano,
  );
  const plan = ORCALY_PLANS[planKey];
  const payerEmail = text(
    body.payerEmail ||
      body.payer_email ||
      company.email ||
      context.user.email,
  ).toLowerCase();

  if (!payerEmail || !payerEmail.includes("@")) {
    throw Object.assign(
      new Error("Informe um e-mail valido."),
      { status: 400 },
    );
  }

  const currentSubscriptionId = text(
    company.mercado_pago_subscription_id ||
      company.mercado_pago_preapproval_id ||
      company.provider_subscription_id,
  );
  const currentProviderStatus = text(
    company.mercado_pago_subscription_status,
  ).toLowerCase();

  if (
    currentSubscriptionId &&
    ["authorized", "pending", "paused"].includes(
      currentProviderStatus,
    ) &&
    !Boolean(company.cancel_at_period_end)
  ) {
    throw Object.assign(
      new Error(
        "Esta empresa ja possui uma assinatura recorrente.",
      ),
      { status: 409 },
    );
  }

  const trialDays = remainingTrialDays(company);

  const { data: paymentRow, error: paymentError } =
    await context.admin
      .from("plan_payments")
      .insert({
        company_id: companyId,
        plano: planKey,
        valor: plan.price,
        status: "subscription_creating",
        tipo: "subscription",
        payment_method: "card_recurring",
        provider: "mercado_pago",
        email: payerEmail,
        nome_empresa: text(company.nome) || "Empresa",
      })
      .select("id")
      .single();

  if (paymentError || !paymentRow?.id) {
    throw Object.assign(
      new Error(
        paymentError?.message ||
          "Nao foi possivel preparar a assinatura.",
      ),
      { status: 500 },
    );
  }

  const externalReference =
    `orcaly_subscription:${companyId}:${planKey}:${paymentRow.id}`;

  const autoRecurring: JsonRecord = {
    frequency: 1,
    frequency_type: "months",
    transaction_amount: plan.price,
    currency_id: "BRL",
  };

  if (trialDays > 0) {
    autoRecurring.free_trial = {
      frequency: trialDays,
      frequency_type: "days",
    };
  }

  let subscription: JsonRecord;

  try {
    subscription =
      (await mercadoPagoPlatformRequest(
        "/preapproval",
        {
          method: "POST",
          body: JSON.stringify({
            reason: `Plano ${plan.name} - Orcaly`,
            external_reference: externalReference,
            payer_email: payerEmail,
            card_token_id: cardTokenId,
            auto_recurring: autoRecurring,
            back_url: `${getAppUrl()}/painel/assinatura`,
            status: "authorized",
          }),
        },
      )) as JsonRecord;
  } catch (error) {
    await context.admin
      .from("plan_payments")
      .update({
        status: "subscription_error",
        updated_at: new Date().toISOString(),
      })
      .eq("id", paymentRow.id);

    throw error;
  }

  const subscriptionId = text(subscription.id);

  if (!subscriptionId) {
    await context.admin
      .from("plan_payments")
      .update({
        status: "subscription_error",
        raw_subscription: subscription,
        updated_at: new Date().toISOString(),
      })
      .eq("id", paymentRow.id);

    throw Object.assign(
      new Error(
        "O Mercado Pago nao retornou o identificador da assinatura.",
      ),
      { status: 502 },
    );
  }

  let trialCompany: JsonRecord | null = null;

  if (!company.trial_used_at && trialDays > 0) {
    try {
      trialCompany = await claimTrial(
        context.admin,
        companyId,
      );
    } catch (error) {
      await cancelRemoteSubscription(subscriptionId);
      throw error;
    }
  }

  const trialEndsAt = text(
    trialCompany?.trial_ends_at ||
      company.trial_ends_at,
  );
  const providerStatus =
    text(subscription.status) || "authorized";
  const nextBillingAt = text(
    subscription.next_payment_date ||
      trialEndsAt,
  );
  const internalStatus =
    trialDays > 0 ? "trialing" : "pendente";
  const now = new Date().toISOString();

  const { error: paymentUpdateError } =
    await context.admin
      .from("plan_payments")
      .update({
        status: `subscription_${providerStatus}`,
        provider: "mercado_pago",
        provider_subscription_id: subscriptionId,
        mercado_pago_preapproval_id:
          subscriptionId,
        next_payment_date:
          nextBillingAt || null,
        raw_subscription: subscription,
        updated_at: now,
      })
      .eq("id", paymentRow.id);

  if (paymentUpdateError) {
    await cancelRemoteSubscription(subscriptionId);

    throw Object.assign(
      new Error(
        "A assinatura foi criada, mas nao foi registrada no Orcaly.",
      ),
      { status: 500 },
    );
  }

  const companyUpdate: JsonRecord = {
    plano: planKey,
    assinatura_plano: planKey,
    assinatura_status: internalStatus,
    assinatura_inicio:
      company.assinatura_inicio || now,
    assinatura_forma_pagamento_preferida:
      "cartao_recorrente",
    assinatura_auto_recorrente:
      providerStatus === "authorized",
    mercado_pago_subscription_id:
      subscriptionId,
    mercado_pago_subscription_status:
      providerStatus,
    mercado_pago_customer_email:
      payerEmail,
    assinatura_mp_payload: subscription,
    assinatura_proxima_cobranca:
      nextBillingAt || null,
    cancel_at_period_end: false,
    updated_at: now,
  };

  if (trialEndsAt) {
    companyUpdate.access_until = trialEndsAt;
  }

  const { data: updatedCompany, error: companyError } =
    await context.admin
      .from("companies")
      .update(companyUpdate)
      .eq("id", companyId)
      .select("*")
      .single();

  if (companyError) {
    await cancelRemoteSubscription(subscriptionId);

    throw Object.assign(
      new Error(
        "A assinatura foi criada, mas a empresa nao foi atualizada.",
      ),
      { status: 500 },
    );
  }

  await recordSubscriptionEvent(context.admin, {
    companyId,
    eventType: "subscription_created_transparent",
    oldStatus: text(company.assinatura_status),
    newStatus: internalStatus,
    providerReference: subscriptionId,
    metadata: {
      plan: planKey,
      trial_days: trialDays,
      provider_status: providerStatus,
      payment_method: "card_recurring",
    },
  });

  return {
    ok: true,
    subscriptionId,
    providerStatus,
    plan: planKey,
    trialDays,
    trialEndsAt: trialEndsAt || null,
    nextBillingAt: nextBillingAt || null,
    company: updatedCompany,
    message:
      trialDays > 0
        ? "Assinatura configurada. Seus sete dias gratuitos comecaram e a primeira mensalidade sera cobrada somente ao final do periodo."
        : "Assinatura configurada. A ativacao sera concluida apos a confirmacao da primeira cobranca.",
  };
}
