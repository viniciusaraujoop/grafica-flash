// ORCALY_SUBSCRIPTION_WEBHOOK_V1
import "server-only";
import { cleanSensitivePayload, getSupabaseAdmin } from "@/lib/payments/server-context";

type JsonRecord = Record<string, unknown>;
const text = (value: unknown) => String(value || "").trim();
const obj = (value: unknown): JsonRecord => value && typeof value === "object" ? value as JsonRecord : {};

function addMonth(value: string) {
  const date = value ? new Date(value) : new Date();
  if (Number.isNaN(date.getTime())) return null;
  date.setMonth(date.getMonth() + 1);
  return date.toISOString();
}

function statusFor(event: string, payment: JsonRecord) {
  const status = text(payment.status).toUpperCase();
  if (["PAYMENT_RECEIVED", "PAYMENT_CONFIRMED", "PAYMENT_RECEIVED_IN_CASH"].includes(event)) return "paid";
  if (event === "PAYMENT_OVERDUE") return "past_due";
  if (event.includes("REFUND")) return "refunded";
  if (event === "PAYMENT_DELETED") return "cancelled";
  if (["RECEIVED", "CONFIRMED"].includes(status)) return "paid";
  if (status === "OVERDUE") return "past_due";
  return "pending";
}

export async function handleSubscriptionPaymentEvent(input: {
  payload: JsonRecord;
  eventType: string;
  eventId: string;
  payloadHash: string;
}) {
  const supabase = getSupabaseAdmin();
  const payment = obj(input.payload.payment);
  const paymentId = text(payment.id);
  const subscriptionId = text(payment.subscription || obj(input.payload.subscription).id);
  const externalReference = text(payment.externalReference);
  let planPayment: JsonRecord | null = null;

  if (subscriptionId) {
    const { data } = await supabase.from("plan_payments").select("*")
      .eq("provider", "asaas").eq("provider_subscription_id", subscriptionId)
      .order("created_at", { ascending: false }).limit(1).maybeSingle();
    planPayment = data as JsonRecord | null;
  }
  if (!planPayment?.id && paymentId) {
    const { data } = await supabase.from("plan_payments").select("*")
      .eq("provider", "asaas").eq("provider_payment_id", paymentId)
      .order("created_at", { ascending: false }).limit(1).maybeSingle();
    planPayment = data as JsonRecord | null;
  }
  if (!planPayment?.id && externalReference) {
    const { data } = await supabase.from("plan_payments").select("*")
      .eq("provider", "asaas").eq("external_reference", externalReference)
      .order("created_at", { ascending: false }).limit(1).maybeSingle();
    planPayment = data as JsonRecord | null;
  }
  if (!planPayment?.id || !planPayment.company_id) return { handled: false };

  const companyId = text(planPayment.company_id);
  const status = statusFor(input.eventType, payment);
  const dueDate = text(payment.dueDate || payment.originalDueDate || planPayment.next_payment_date);
  const paidAt = text(payment.paymentDate || payment.clientPaymentDate) || (status === "paid" ? new Date().toISOString() : null);
  const nextBilling = status === "paid" ? addMonth(dueDate) : dueDate || null;
  const now = new Date().toISOString();

  await supabase.from("plan_payments").update({
    provider_payment_id: paymentId || planPayment.provider_payment_id,
    provider_subscription_id: subscriptionId || planPayment.provider_subscription_id,
    status,
    paid_at: paidAt || planPayment.paid_at,
    next_payment_date: nextBilling,
    raw_payment: cleanSensitivePayload(payment),
    updated_at: now,
  }).eq("id", planPayment.id).eq("company_id", companyId);

  const companyStatus = status === "paid" ? "ativa" : status === "past_due" ? "inadimplente" : status;
  const update: JsonRecord = {
    assinatura_status: companyStatus,
    next_billing_at: nextBilling,
    assinatura_proxima_cobranca: nextBilling,
    updated_at: now,
  };
  if (status === "paid") {
    update.assinatura_ultimo_pagamento = paidAt || now;
    update.assinatura_expira_em = nextBilling;
    update.access_until = nextBilling;
    update.cancel_at_period_end = false;
  }
  await supabase.from("companies").update(update).eq("id", companyId);

  await supabase.from("subscription_events").upsert({
    company_id: companyId,
    event_type: input.eventType,
    old_status: text(planPayment.status),
    new_status: companyStatus,
    provider: "asaas",
    provider_reference: subscriptionId || paymentId || externalReference || null,
    provider_event_id: input.eventId,
    provider_object_id: paymentId || subscriptionId || null,
    payload_hash: input.payloadHash,
    processing_status: "processed",
    processed_at: now,
    metadata: cleanSensitivePayload({ payment, nextBilling }),
  }, { onConflict: "provider,provider_event_id" });

  return { handled: true, companyId, status };
}
