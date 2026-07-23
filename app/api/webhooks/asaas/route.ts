// ORCALY_SUBSCRIPTION_WEBHOOK_V1
import { createHash } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { requireAsaasWebhookToken } from "@/lib/payments/asaas-config";
import { createFinancialEntryOnce } from "@/lib/payments/financial-integration";
import { createAutomaticPayoutForTransaction, updatePayoutFromTransferEvent } from "@/lib/payments/payout-service";
import { cleanSensitivePayload, getSupabaseAdmin } from "@/lib/payments/server-context";
import { handleSubscriptionPaymentEvent } from "@/lib/payments/subscription-event-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
type JsonRecord = Record<string, unknown>;
const text = (value: unknown) => String(value || "").trim();
const PAID = new Set(["PAYMENT_RECEIVED", "PAYMENT_CONFIRMED", "PAYMENT_RECEIVED_IN_CASH"]);
const REFUNDED = new Set(["PAYMENT_REFUNDED", "PAYMENT_PARTIALLY_REFUNDED", "PAYMENT_CHARGEBACK_REQUESTED", "PAYMENT_CHARGEBACK_DISPUTE"]);

function nextStatus(event: string, current: string) {
  if (REFUNDED.has(event)) return "REFUNDED";
  if (PAID.has(event)) return "PAID";
  if (event === "PAYMENT_OVERDUE") return current === "PAID" ? current : "OVERDUE";
  if (event === "PAYMENT_DELETED") return current === "PAID" ? current : "CANCELLED";
  return current || "PENDING";
}

export async function POST(request: NextRequest) {
  try {
    const token = text(request.headers.get("asaas-access-token"));
    if (!token || token !== requireAsaasWebhookToken()) {
      return NextResponse.json({ error: "Webhook nao autorizado." }, { status: 401 });
    }

    const rawText = await request.text();
    const payload = JSON.parse(rawText) as JsonRecord;
    const eventId = text(payload.id);
    const eventType = text(payload.event);
    if (!eventId || !eventType) return NextResponse.json({ error: "Evento invalido." }, { status: 400 });

    const supabase = getSupabaseAdmin();
    const hash = createHash("sha256").update(rawText).digest("hex");
    const { data: already } = await supabase.from("payment_webhook_events")
      .select("id,processing_status").eq("provider", "asaas").eq("provider_event_id", eventId).maybeSingle();
    if (already?.processing_status === "processed") return NextResponse.json({ ok: true, repeated: true });

    if (eventType.startsWith("TRANSFER_")) {
      const transfer = payload.transfer && typeof payload.transfer === "object" ? payload.transfer as JsonRecord : {};
      await supabase.from("payment_webhook_events").upsert({
        provider: "asaas", provider_event_id: eventId, event_type: eventType,
        provider_object_id: text(transfer.id) || null, processing_status: "processing",
        payload_hash: hash, payload_sanitized: cleanSensitivePayload(payload), received_at: new Date().toISOString(),
      }, { onConflict: "provider,provider_event_id" });
      const updated = await updatePayoutFromTransferEvent(transfer, eventType);
      await supabase.from("payment_webhook_events").update({
        processing_status: updated ? "processed" : "ignored", processed_at: new Date().toISOString(),
        error_message: updated ? null : "Repasse nao localizado.",
      }).eq("provider", "asaas").eq("provider_event_id", eventId);
      return NextResponse.json({ ok: true, ignored: !updated });
    }

    const payment = payload.payment && typeof payload.payment === "object" ? payload.payment as JsonRecord : {};
    const paymentId = text(payment.id);
    if (!paymentId) return NextResponse.json({ error: "Pagamento invalido." }, { status: 400 });

    await supabase.from("payment_webhook_events").upsert({
      provider: "asaas", provider_event_id: eventId, event_type: eventType,
      provider_object_id: paymentId, processing_status: "processing",
      payload_hash: hash, payload_sanitized: cleanSensitivePayload(payload), received_at: new Date().toISOString(),
    }, { onConflict: "provider,provider_event_id" });

    const subscription = await handleSubscriptionPaymentEvent({ payload, eventType, eventId, payloadHash: hash });
    if (subscription.handled) {
      await supabase.from("payment_webhook_events").update({
        company_id: subscription.companyId, processing_status: "processed", processed_at: new Date().toISOString(), error_message: null,
      }).eq("provider", "asaas").eq("provider_event_id", eventId);
      return NextResponse.json({ ok: true, type: "subscription" });
    }

    const { data: transaction } = await supabase.from("marketplace_payments")
      .select("*").eq("provider", "asaas").eq("provider_payment_id", paymentId).maybeSingle();
    if (!transaction) {
      await supabase.from("payment_webhook_events").update({
        processing_status: "ignored", processed_at: new Date().toISOString(), error_message: "Pagamento nao localizado.",
      }).eq("provider", "asaas").eq("provider_event_id", eventId);
      return NextResponse.json({ ok: true, ignored: true });
    }

    const status = nextStatus(eventType, text(transaction.status));
    const gross = Number(payment.value || transaction.gross_amount || 0);
    const net = Number(payment.netValue || transaction.provider_net_amount || 0);
    const providerFee = net > 0 ? Math.max(0, gross - net) : null;
    const feePercent = Number(transaction.platform_fee_percent || 0);
    const platformFee = net > 0 ? Math.round(net * (feePercent / 100) * 100) / 100 : null;
    const sellerNet = net > 0 && platformFee !== null ? Math.round((net - platformFee) * 100) / 100 : null;
    const paidAt = text(payment.paymentDate || payment.clientPaymentDate) || (status === "PAID" ? new Date().toISOString() : null);

    await supabase.from("marketplace_payments").update({
      status, provider_status: text(payment.status) || status, provider_fee_amount: providerFee,
      provider_net_amount: net || null, platform_fee_amount: platformFee, seller_net_amount: sellerNet,
      paid_at: paidAt, split_status: eventType.includes("SPLIT") ? eventType.replace("PAYMENT_SPLIT_", "") : transaction.split_status,
      updated_at: new Date().toISOString(),
    }).eq("id", transaction.id).eq("company_id", transaction.company_id);

    if (status === "PAID") {
      await supabase.from("orders").update({ status: "Recebido", payment_status: "paid" })
        .eq("id", transaction.order_id).eq("company_id", transaction.company_id);
      await createFinancialEntryOnce({
        companyId: transaction.company_id, orderId: transaction.order_id, transactionId: transaction.id,
        grossAmount: gross, providerFeeAmount: providerFee || 0, platformFeeAmount: platformFee || 0,
        sellerNetAmount: sellerNet || gross, paymentMethod: text(transaction.payment_method),
      });
      await createAutomaticPayoutForTransaction(String(transaction.id));
    }
    if (status === "REFUNDED") {
      await supabase.from("orders").update({ payment_status: "refunded" })
        .eq("id", transaction.order_id).eq("company_id", transaction.company_id);
    }

    await supabase.from("payment_webhook_events").update({
      company_id: transaction.company_id, processing_status: "processed", processed_at: new Date().toISOString(), error_message: null,
    }).eq("provider", "asaas").eq("provider_event_id", eventId);
    return NextResponse.json({ ok: true, type: "sale" });
  } catch (error) {
    console.error("[Orcaly financeiro] Falha no webhook:", error instanceof Error ? error.message : error);
    return NextResponse.json({ error: "Nao foi possivel processar o evento financeiro." }, { status: 500 });
  }
}
