// ORCALY_AFFILIATE_INTEGRATION_V1
import { NextRequest, NextResponse } from "next/server";
import { mapMercadoPagoStatus } from "@/lib/mercado-pago";
import {
  applyApprovedSubscriptionPayment,
  findCompanyForProviderReference,
  getSupabaseAdmin,
  mercadoPagoPlatformRequest,
  parseOrcalySubscriptionReference,
  recordSubscriptionEvent,
} from "@/lib/subscription-service";
import {
  getSubscriptionWebhookSecret,
} from "@/lib/payments/subscription/mercado-pago";
import {
  verifyMercadoPagoWebhookSignature,
} from "@/lib/mercado-pago";
import {
  reverseAffiliateCommissionForPayment,
} from "@/lib/affiliates/server";

type JsonRecord = Record<string, unknown>;

function text(value: unknown) {
  return String(value || "").trim();
}

function record(value: unknown): JsonRecord {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  return value as JsonRecord;
}

function positiveNumberOrNull(value: unknown) {
  const parsed = Number(value || 0);

  return Number.isFinite(parsed) && parsed > 0
    ? parsed
    : null;
}

function extractResourceId(body: JsonRecord, url: URL) {
  const data = record(body.data);

  return text(
    data.id ||
      body.id ||
      body.resource ||
      url.searchParams.get("data.id") ||
      url.searchParams.get("id") ||
      url.searchParams.get("preapproval_id"),
  );
}

function extractTopic(body: JsonRecord, url: URL) {
  return text(
    body.type ||
      body.topic ||
      url.searchParams.get("type") ||
      url.searchParams.get("topic"),
  ).toLowerCase();
}

function validWebhookSignature(
  request: NextRequest,
  resourceId: string,
) {
  return verifyMercadoPagoWebhookSignature({
    xSignature: request.headers.get("x-signature"),
    xRequestId: request.headers.get("x-request-id"),
    dataId: resourceId || null,
    secret: getSubscriptionWebhookSecret(),
  });
}

async function processPreapproval(resourceId: string) {
  const admin = getSupabaseAdmin();
  const subscription = record(
    await mercadoPagoPlatformRequest(
      `/preapproval/${encodeURIComponent(resourceId)}`,
    ),
  );
  const subscriptionId =
    text(subscription.id) || resourceId;
  const found = await findCompanyForProviderReference(
    admin,
    subscription.external_reference,
    subscriptionId,
  );

  if (!found.company?.id) {
    return {
      received: true,
      ignored: true,
      reason: "Assinatura sem empresa vinculada.",
    };
  }

  const company = found.company;
  const remoteStatus = (
    text(subscription.status) || "pending"
  ).toLowerCase();
  const now = new Date();
  const accessUntil =
    company.access_until ||
    company.assinatura_expira_em ||
    null;
  const hasFutureAccess = accessUntil
    ? new Date(accessUntil) > now
    : false;
  let internalStatus =
    company.assinatura_status || "pendente";

  if (
    company.trial_ends_at &&
    new Date(company.trial_ends_at) > now
  ) {
    internalStatus = "trialing";
  } else if (
    company.cancel_at_period_end &&
    hasFutureAccess
  ) {
    internalStatus = "cancel_at_period_end";
  } else if (remoteStatus === "authorized") {
    internalStatus = "ativa";
  } else if (
    ["canceled", "cancelled"].includes(remoteStatus)
  ) {
    internalStatus = hasFutureAccess
      ? "cancel_at_period_end"
      : "cancelada";
  } else if (remoteStatus === "paused") {
    internalStatus = "past_due";
  } else if (
    remoteStatus === "pending" &&
    !hasFutureAccess
  ) {
    internalStatus = "pendente";
  }

  const checkoutUrl =
    text(subscription.init_point) ||
    text(subscription.sandbox_init_point) ||
    text(company.assinatura_checkout_url) ||
    null;
  const nextPaymentDate =
    text(subscription.next_payment_date) || null;
  const payerEmail =
    text(subscription.payer_email) ||
    text(company.mercado_pago_customer_email) ||
    null;

  await admin
    .from("companies")
    .update({
      assinatura_status: internalStatus,
      assinatura_auto_recorrente:
        remoteStatus === "authorized" &&
        !company.cancel_at_period_end,
      assinatura_checkout_url: checkoutUrl,
      assinatura_proxima_cobranca: nextPaymentDate,
      mercado_pago_subscription_id: subscriptionId,
      mercado_pago_subscription_status: remoteStatus,
      mercado_pago_customer_email: payerEmail,
      assinatura_mp_payload: subscription,
      updated_at: now.toISOString(),
    })
    .eq("id", company.id);

  await recordSubscriptionEvent(admin, {
    companyId: String(company.id),
    eventType: "subscription_status_updated",
    oldStatus:
      company.assinatura_status || null,
    newStatus: internalStatus,
    providerReference:
      `${subscriptionId}:${remoteStatus}`,
    metadata: {
      provider_status: remoteStatus,
    },
  });

  return {
    received: true,
    kind: "subscription_preapproval",
    status: remoteStatus,
  };
}

async function processAuthorizedPayment(
  resourceId: string,
) {
  const admin = getSupabaseAdmin();
  const authorizedPayment = record(
    await mercadoPagoPlatformRequest(
      `/authorized_payments/${encodeURIComponent(
        resourceId,
      )}`,
    ),
  );
  const payment = record(authorizedPayment.payment);
  const preapprovalId =
    text(authorizedPayment.preapproval_id) || null;
  const subscription = preapprovalId
    ? record(
        await mercadoPagoPlatformRequest(
          `/preapproval/${encodeURIComponent(
            preapprovalId,
          )}`,
        ),
      )
    : null;
  const reference =
    text(authorizedPayment.external_reference) ||
    text(subscription?.external_reference) ||
    null;
  const found = await findCompanyForProviderReference(
    admin,
    reference,
    preapprovalId,
  );

  if (!found.company?.id) {
    return {
      received: true,
      ignored: true,
      reason:
        "Pagamento recorrente sem empresa vinculada.",
    };
  }

  const paymentStatus = (
    text(payment.status) ||
    text(authorizedPayment.status) ||
    "pending"
  ).toLowerCase();
  const providerReference =
    text(payment.id) || resourceId;
  const nextPaymentDate =
    text(subscription?.next_payment_date) || null;

  if (paymentStatus === "approved") {
    await applyApprovedSubscriptionPayment(
      admin,
      found.company,
      {
        plan: found.parsed?.plan,
        providerReference,
        preapprovalId,
        nextPaymentDate,
        paymentType: "card_recurring",
        amount: positiveNumberOrNull(
          payment.transaction_amount,
        ),
      },
    );
  } else {
    if (
      ["refunded", "charged_back", "cancelled", "canceled"].includes(
        paymentStatus,
      )
    ) {
      await reverseAffiliateCommissionForPayment(
        admin,
        providerReference,
        `Pagamento recorrente ${paymentStatus}.`,
      );
    }

    await recordSubscriptionEvent(admin, {
      companyId: String(found.company.id),
      eventType: "payment_pending",
      oldStatus:
        found.company.assinatura_status || null,
      newStatus:
        found.company.assinatura_status || null,
      providerReference,
      metadata: {
        provider_status: paymentStatus,
      },
    });
  }

  return {
    received: true,
    kind: "subscription_authorized_payment",
    status: paymentStatus,
  };
}

async function processPayment(
  resourceId: string,
  body: JsonRecord,
) {
  const admin = getSupabaseAdmin();
  const payment = record(
    await mercadoPagoPlatformRequest(
      `/v1/payments/${encodeURIComponent(resourceId)}`,
    ),
  );
  const reference =
    text(payment.external_reference) || null;
  const parsed =
    parseOrcalySubscriptionReference(reference);

  if (
    !parsed &&
    text(reference).startsWith("orcaly_marketplace")
  ) {
    return {
      received: true,
      ignored: true,
      reason: "Webhook pertencente ao marketplace.",
    };
  }

  const found = await findCompanyForProviderReference(
    admin,
    reference,
    null,
  );

  if (!found.company?.id) {
    return {
      received: true,
      ignored: true,
      reason:
        "Pagamento sem assinatura Orçaly vinculada.",
    };
  }

  const status = (
    text(payment.status) || "pending"
  ).toLowerCase();
  const paymentRowId =
    parsed?.paymentRowId ||
    (reference && /^[0-9a-f-]{36}$/i.test(reference)
      ? reference
      : null);
  const providerReference =
    text(payment.id) || resourceId;

  if (paymentRowId) {
    await admin
      .from("plan_payments")
      .update({
        status: mapMercadoPagoStatus(status),
        mercado_pago_payment_id:
          providerReference,
        payment_method:
          text(payment.payment_method_id) || "pix",
        raw_webhook: body,
        raw_payment: payment,
        paid_at:
          status === "approved"
            ? new Date().toISOString()
            : null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", paymentRowId);
  }

  if (status === "approved") {
    await applyApprovedSubscriptionPayment(
      admin,
      found.company,
      {
        plan: parsed?.plan,
        providerReference,
        paymentType: "pix",
        amount: positiveNumberOrNull(
          payment.transaction_amount,
        ),
      },
    );
  } else {
    if (
      ["refunded", "charged_back", "cancelled", "canceled"].includes(
        status,
      )
    ) {
      await reverseAffiliateCommissionForPayment(
        admin,
        providerReference,
        `Pagamento Pix ${status}.`,
      );
    }

    await recordSubscriptionEvent(admin, {
      companyId: String(found.company.id),
      eventType:
        status === "rejected"
          ? "payment_failed"
          : "payment_pending",
      oldStatus:
        found.company.assinatura_status || null,
      newStatus:
        found.company.assinatura_status || null,
      providerReference,
      metadata: {
        provider_status: status,
        payment_type: "pix",
      },
    });
  }

  return {
    received: true,
    kind: "subscription_pix_payment",
    status,
  };
}

export async function POST(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const body = record(
      await request.json().catch(() => ({})),
    );
    const topic = extractTopic(body, url);
    const resourceId = extractResourceId(body, url);

    if (!resourceId) {
      return NextResponse.json({
        received: true,
        ignored: true,
        reason: "Recurso ausente.",
      });
    }

    if (
      !validWebhookSignature(request, resourceId)
    ) {
      return NextResponse.json(
        { error: "Assinatura inválida." },
        { status: 401 },
      );
    }

    if (
      topic.includes(
        "subscription_preapproval",
      )
    ) {
      return NextResponse.json(
        await processPreapproval(resourceId),
      );
    }

    if (
      topic.includes(
        "subscription_authorized_payment",
      )
    ) {
      return NextResponse.json(
        await processAuthorizedPayment(resourceId),
      );
    }

    return NextResponse.json(
      await processPayment(resourceId, body),
    );
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Erro no webhook de assinatura.";

    console.error(
      "orcaly_subscription_webhook_error",
      message,
    );

    return NextResponse.json(
      {
        error:
          "Não foi possível processar o webhook.",
      },
      { status: 500 },
    );
  }
}

export async function GET() {
  return NextResponse.json({
    ok: true,
    route: "mercado-pago-subscription-webhook",
    supports: [
      "payment",
      "subscription_preapproval",
      "subscription_authorized_payment",
    ],
  });
}
