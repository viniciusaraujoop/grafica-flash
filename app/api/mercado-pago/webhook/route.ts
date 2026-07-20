/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from "next/server";
import {
  applyApprovedSubscriptionPayment,
  findCompanyForProviderReference,
  getSupabaseAdmin,
  mercadoPagoPlatformRequest,
  parseOrcalySubscriptionReference,
  recordSubscriptionEvent,
} from "@/lib/subscription-service";

function extractResourceId(body: any, url: URL) {
  return String(
    body?.data?.id ||
      body?.id ||
      body?.resource ||
      url.searchParams.get("data.id") ||
      url.searchParams.get("id") ||
      url.searchParams.get("preapproval_id") ||
      "",
  );
}

function extractTopic(body: any, url: URL) {
  return String(
    body?.type || body?.topic || url.searchParams.get("type") || url.searchParams.get("topic") || "",
  ).toLowerCase();
}

async function processPreapproval(resourceId: string, body: any) {
  const admin = getSupabaseAdmin();
  const subscription = await mercadoPagoPlatformRequest(`/preapproval/${encodeURIComponent(resourceId)}`);
  const found = await findCompanyForProviderReference(
    admin,
    subscription.external_reference,
    subscription.id || resourceId,
  );

  if (!found.company?.id) {
    return { received: true, ignored: true, reason: "Assinatura sem empresa vinculada." };
  }

  const company = found.company;
  const remoteStatus = String(subscription.status || "pending").toLowerCase();
  const now = new Date();
  const accessUntil = company.access_until || company.assinatura_expira_em || null;
  const hasFutureAccess = accessUntil ? new Date(accessUntil) > now : false;
  let internalStatus = company.assinatura_status || "pendente";

  if (company.trial_ends_at && new Date(company.trial_ends_at) > now) {
    internalStatus = "trialing";
  } else if (company.cancel_at_period_end && hasFutureAccess) {
    internalStatus = "cancel_at_period_end";
  } else if (remoteStatus === "authorized") {
    internalStatus = "ativa";
  } else if (["canceled", "cancelled"].includes(remoteStatus)) {
    internalStatus = hasFutureAccess ? "cancel_at_period_end" : "cancelada";
  } else if (remoteStatus === "paused") {
    internalStatus = "past_due";
  } else if (remoteStatus === "pending" && !hasFutureAccess) {
    internalStatus = "pendente";
  }

  await admin
    .from("companies")
    .update({
      assinatura_status: internalStatus,
      assinatura_auto_recorrente: remoteStatus === "authorized" && !company.cancel_at_period_end,
      assinatura_checkout_url:
        subscription.init_point || subscription.sandbox_init_point || company.assinatura_checkout_url || null,
      assinatura_proxima_cobranca: subscription.next_payment_date || null,
      mercado_pago_subscription_id: subscription.id || resourceId,
      mercado_pago_subscription_status: remoteStatus,
      mercado_pago_customer_email: subscription.payer_email || company.mercado_pago_customer_email || null,
      assinatura_mp_payload: subscription,
      updated_at: now.toISOString(),
    })
    .eq("id", company.id);

  await recordSubscriptionEvent(admin, {
    companyId: company.id,
    eventType: "subscription_status_updated",
    oldStatus: company.assinatura_status,
    newStatus: internalStatus,
    providerReference: `${subscription.id || resourceId}:${remoteStatus}`,
    metadata: { provider_status: remoteStatus },
  });

  return { received: true, kind: "subscription_preapproval", status: remoteStatus };
}

async function processAuthorizedPayment(resourceId: string, body: any) {
  const admin = getSupabaseAdmin();
  const authorizedPayment = await mercadoPagoPlatformRequest(
    `/authorized_payments/${encodeURIComponent(resourceId)}`,
  );
  const preapprovalId = authorizedPayment.preapproval_id || null;
  const subscription = preapprovalId
    ? await mercadoPagoPlatformRequest(`/preapproval/${encodeURIComponent(preapprovalId)}`)
    : null;
  const reference = authorizedPayment.external_reference || subscription?.external_reference;
  const found = await findCompanyForProviderReference(admin, reference, preapprovalId);

  if (!found.company?.id) {
    return { received: true, ignored: true, reason: "Pagamento recorrente sem empresa vinculada." };
  }

  const paymentStatus = String(
    authorizedPayment?.payment?.status || authorizedPayment?.status || "pending",
  ).toLowerCase();

  if (paymentStatus === "approved") {
    await applyApprovedSubscriptionPayment(admin, found.company, {
      plan: found.parsed?.plan,
      providerReference: String(authorizedPayment?.payment?.id || resourceId),
      preapprovalId,
      nextPaymentDate: subscription?.next_payment_date || null,
      paymentType: "card_recurring",
      amount: Number(authorizedPayment?.payment?.transaction_amount || 0) || null,
    });
  } else {
    await recordSubscriptionEvent(admin, {
      companyId: found.company.id,
      eventType: "payment_pending",
      oldStatus: found.company.assinatura_status,
      newStatus: found.company.assinatura_status,
      providerReference: String(authorizedPayment?.payment?.id || resourceId),
      metadata: { provider_status: paymentStatus },
    });
  }

  return { received: true, kind: "subscription_authorized_payment", status: paymentStatus };
}

async function processPayment(resourceId: string, body: any) {
  const admin = getSupabaseAdmin();
  const payment = await mercadoPagoPlatformRequest(`/v1/payments/${encodeURIComponent(resourceId)}`);
  const reference = payment.external_reference;
  const parsed = parseOrcalySubscriptionReference(reference);

  if (!parsed && String(reference || "").startsWith("orcaly_marketplace")) {
    return { received: true, ignored: true, reason: "Webhook pertencente ao marketplace." };
  }

  const found = await findCompanyForProviderReference(admin, reference, null);
  if (!found.company?.id) {
    return { received: true, ignored: true, reason: "Pagamento sem assinatura Orçaly vinculada." };
  }

  const status = String(payment.status || "pending").toLowerCase();
  const paymentRowId = parsed?.paymentRowId || (typeof reference === "string" ? reference : null);

  if (paymentRowId) {
    await admin
      .from("plan_payments")
      .update({
        status,
        mercado_pago_payment_id: String(payment.id || resourceId),
        payment_method: payment.payment_method_id || "pix",
        raw_webhook: body,
        raw_payment: payment,
        paid_at: status === "approved" ? new Date().toISOString() : null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", paymentRowId);
  }

  if (status === "approved") {
    await applyApprovedSubscriptionPayment(admin, found.company, {
      plan: parsed?.plan,
      providerReference: String(payment.id || resourceId),
      paymentType: "pix",
      amount: Number(payment.transaction_amount || 0) || null,
    });
  } else {
    await recordSubscriptionEvent(admin, {
      companyId: found.company.id,
      eventType: status === "rejected" ? "payment_failed" : "payment_pending",
      oldStatus: found.company.assinatura_status,
      newStatus: found.company.assinatura_status,
      providerReference: String(payment.id || resourceId),
      metadata: { provider_status: status, payment_type: "pix" },
    });
  }

  return { received: true, kind: "subscription_pix_payment", status };
}

export async function POST(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const body = await request.json().catch(() => ({}));
    const topic = extractTopic(body, url);
    const resourceId = extractResourceId(body, url);

    if (!resourceId) {
      return NextResponse.json({ received: true, ignored: true, reason: "Recurso ausente." });
    }

    if (topic.includes("subscription_preapproval")) {
      return NextResponse.json(await processPreapproval(resourceId, body));
    }

    if (topic.includes("subscription_authorized_payment")) {
      return NextResponse.json(await processAuthorizedPayment(resourceId, body));
    }

    return NextResponse.json(await processPayment(resourceId, body));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro no webhook de assinatura.";
    console.error("orcaly_subscription_webhook_error", message);
    return NextResponse.json({ error: "Não foi possível processar o webhook." }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({
    ok: true,
    route: "mercado-pago-subscription-webhook",
    supports: ["payment", "subscription_preapproval", "subscription_authorized_payment"],
  });
}
