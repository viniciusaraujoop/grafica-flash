import { randomUUID } from "node:crypto";
import {
  NextRequest,
  NextResponse,
} from "next/server";
import {
  createFounderProviderSubscription,
  findRecoverableFounderSubscription,
  FOUNDER_BILLING_PLANS,
  getFounderProviderSubscription,
  isClosedSubscription,
  normalizeFounderBillingPlan,
  providerAmountCents,
  providerCheckoutUrl,
  providerNextPaymentDate,
  providerStatus,
  record,
  text,
} from "@/lib/founder-billing";
import {
  resolveSubscriptionContext,
} from "@/lib/subscription-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function databaseMessage(message: string) {
  const cases: Array<[string, string]> = [
    [
      "FOUNDER_BILLING_IN_PROGRESS",
      "A cobrança Founder já está sendo configurada. Tente novamente em alguns instantes.",
    ],
    [
      "FOUNDER_BILLING_NOT_FOUNDER",
      "Esta empresa não faz parte do Programa Founder.",
    ],
    [
      "FOUNDER_BILLING_TIMELINE_MISSING",
      "A linha do tempo Founder desta empresa está incompleta.",
    ],
    [
      "FOUNDER_BILLING_INVALID_PLAN",
      "O plano Founder desta empresa é inválido.",
    ],
    [
      "FOUNDER_BILLING_DUPLICATE_PROVIDER_SUBSCRIPTIONS",
      "Foram encontradas múltiplas assinaturas do Mercado Pago para a mesma referência. Nenhuma nova assinatura foi criada.",
    ],
  ];

  for (const [code, friendly] of cases) {
    if (message.includes(code)) return friendly;
  }

  return message;
}

function founderSnapshot(company: Record<string, unknown>) {
  const plan = normalizeFounderBillingPlan(
    company.assinatura_plano || company.plano,
  );
  const config = FOUNDER_BILLING_PLANS[plan];
  const founderPriceCents =
    Number(company.founder_price_cents) ||
    config.founderPriceCents;
  const priceEndsAt = text(
    company.founder_price_ends_at,
  );
  const effectivePriceCents =
    priceEndsAt &&
    new Date(priceEndsAt).getTime() <= Date.now()
      ? config.normalPriceCents
      : founderPriceCents;

  return {
    id: text(company.id),
    nome: text(company.nome),
    email: text(company.email),
    plano: plan,
    assinatura_status:
      text(company.assinatura_status) || "pendente",
    is_founder: company.is_founder === true,
    founder_number:
      typeof company.founder_number === "number"
        ? company.founder_number
        : Number(company.founder_number),
    founder_price_cents: founderPriceCents,
    normal_price_cents: config.normalPriceCents,
    effective_price_cents: effectivePriceCents,
    founder_trial_ends_at:
      text(company.founder_trial_ends_at) || null,
    founder_price_ends_at:
      priceEndsAt || null,
    founder_price_converted_at:
      text(company.founder_price_converted_at) || null,
    founder_billing_setup_at:
      text(company.founder_billing_setup_at) || null,
    founder_billing_authorized_at:
      text(company.founder_billing_authorized_at) || null,
    provider_subscription_id:
      text(
        company.provider_subscription_id ||
          company.mercado_pago_subscription_id,
      ) || null,
    provider_status:
      text(
        company.mercado_pago_subscription_status,
      ) || null,
    checkout_url:
      text(company.assinatura_checkout_url) || null,
    next_billing_at:
      text(
        company.next_billing_at ||
          company.assinatura_proxima_cobranca,
      ) || null,
  };
}

async function releaseClaim(
  admin: Awaited<
    ReturnType<typeof resolveSubscriptionContext>
  >["admin"],
  companyId: string,
  claimId: string,
  reason: string,
) {
  const { error } = await admin.rpc(
    "release_founder_billing_claim",
    {
      p_company_id: companyId,
      p_claim_id: claimId,
      p_error: reason.slice(0, 1000),
    },
  );

  if (error) {
    console.error(
      "orcaly_founder_billing_claim_release_error",
      error.message,
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const context =
      await resolveSubscriptionContext(request);

    if (!context.user) {
      return NextResponse.json(
        { error: "Não autorizado." },
        { status: 401 },
      );
    }

    if (!context.company?.id) {
      return NextResponse.json(
        { error: "Empresa não encontrada." },
        { status: 404 },
      );
    }

    if (context.company.is_founder !== true) {
      return NextResponse.json(
        { error: "Esta empresa não é Founder." },
        { status: 400 },
      );
    }

    return NextResponse.json({
      company: founderSnapshot(
        context.company as Record<string, unknown>,
      ),
      can_manage: context.canManage,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? databaseMessage(error.message)
            : "Não foi possível carregar a cobrança Founder.",
      },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  const context =
    await resolveSubscriptionContext(request);
  let claimId = "";

  if (!context.user) {
    return NextResponse.json(
      { error: "Não autorizado." },
      { status: 401 },
    );
  }

  if (!context.company?.id) {
    return NextResponse.json(
      { error: "Empresa não encontrada." },
      { status: 404 },
    );
  }

  if (!context.canManage) {
    return NextResponse.json(
      {
        error:
          "Você não possui permissão para configurar a cobrança.",
      },
      { status: 403 },
    );
  }

  if (context.company.is_founder !== true) {
    return NextResponse.json(
      { error: "Esta empresa não é Founder." },
      { status: 400 },
    );
  }

  const companyId = String(context.company.id);

  try {
    claimId = randomUUID();

    const { data: claimData, error: claimError } =
      await context.admin.rpc(
        "claim_founder_billing_setup",
        {
          p_company_id: companyId,
          p_claim_id: claimId,
        },
      );

    if (claimError) throw claimError;

    const claim = Array.isArray(claimData)
      ? record(claimData[0])
      : record(claimData);

    const planPaymentId = text(
      claim.plan_payment_id,
    );
    const plan =
      normalizeFounderBillingPlan(claim.plan_key);
    const effectivePriceCents = Number(
      claim.effective_price_cents,
    );
    const payerEmail = text(
      claim.payer_email,
    ).toLowerCase();

    if (
      !planPaymentId ||
      !payerEmail.includes("@") ||
      !Number.isInteger(effectivePriceCents) ||
      effectivePriceCents <= 0
    ) {
      throw new Error(
        "FOUNDER_BILLING_INVALID_CLAIM_RESULT",
      );
    }

    let subscription:
      | Record<string, unknown>
      | null = null;

    const existingId = text(
      claim.provider_subscription_id,
    );

    if (existingId) {
      const existing =
        await getFounderProviderSubscription(existingId);

      if (!isClosedSubscription(existing)) {
        subscription = existing;
      }
    }

    if (!subscription) {
      subscription =
        await findRecoverableFounderSubscription(
          planPaymentId,
        );
    }

    if (!subscription) {
      subscription =
        await createFounderProviderSubscription({
          plan,
          payerEmail,
          planPaymentId,
          effectivePriceCents,
          billingStartAt:
            text(claim.billing_start_at) || null,
        });
    }

    const subscriptionId = text(subscription.id);

    if (!subscriptionId) {
      throw new Error(
        "O Mercado Pago não retornou o ID da assinatura.",
      );
    }

    if (
      text(subscription.external_reference) !==
      planPaymentId
    ) {
      throw new Error(
        "FOUNDER_BILLING_PROVIDER_REFERENCE_MISMATCH",
      );
    }

    if (
      !isClosedSubscription(subscription) &&
      providerAmountCents(subscription) !==
        effectivePriceCents
    ) {
      throw new Error(
        "FOUNDER_BILLING_PROVIDER_AMOUNT_MISMATCH",
      );
    }

    const checkoutUrl =
      providerCheckoutUrl(subscription);
    const status = providerStatus(subscription);

    const { data: company, error: completeError } =
      await context.admin.rpc(
        "complete_founder_billing_setup",
        {
          p_company_id: companyId,
          p_claim_id: claimId,
          p_plan_payment_id: planPaymentId,
          p_subscription_id: subscriptionId,
          p_provider_status: status,
          p_checkout_url: checkoutUrl,
          p_next_payment_date:
            providerNextPaymentDate(subscription),
          p_provider_payload: subscription,
        },
      );

    if (completeError) throw completeError;

    claimId = "";

    return NextResponse.json({
      ok: true,
      company: founderSnapshot(
        record(company),
      ),
      provider_status: status,
      subscription_id: subscriptionId,
      checkout_url: checkoutUrl,
      message:
        status === "authorized"
          ? "Cobrança Founder já está autorizada. Nenhuma nova assinatura foi criada."
          : "Cobrança preparada. Conclua a autorização no Mercado Pago.",
    });
  } catch (error) {
    if (claimId) {
      await releaseClaim(
        context.admin,
        companyId,
        claimId,
        error instanceof Error
          ? error.message
          : "FOUNDER_BILLING_UNKNOWN_ERROR",
      );
    }

    const message =
      error instanceof Error
        ? databaseMessage(error.message)
        : "Não foi possível configurar a cobrança Founder.";

    const conflict =
      message.includes("já") ||
      message.includes("múltiplas") ||
      message.includes("mesma referência");

    return NextResponse.json(
      { error: message },
      { status: conflict ? 409 : 500 },
    );
  }
}
