import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import {
  getSignupAccessToken,
  getSignupWebhookSecret,
} from "@/lib/payments/signup/mercado-pago";
import { verifyMercadoPagoWebhookSignature } from "@/lib/mercado-pago";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    persistSession: false,
  },
});

function getPaymentIdFromUrl(request: NextRequest) {
  const url = new URL(request.url);

  return (
    url.searchParams.get("data.id") ||
    url.searchParams.get("id") ||
    url.searchParams.get("payment_id") ||
    ""
  );
}

function safeRaw(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  return value as Record<string, unknown>;
}

async function processPayment(paymentId: string) {
  if (!paymentId) {
    return { ok: false, reason: "payment_id ausente" };
  }
const mercadoPagoToken = getSignupAccessToken();

  const response = await fetch(
    `https://api.mercadopago.com/v1/payments/${paymentId}`,
    {
      headers: {
        Authorization: `Bearer ${mercadoPagoToken}`,
      },
      cache: "no-store",
    },
  );

  const payment = await response.json();

  if (!response.ok) {
    return { ok: false, reason: "erro mercado pago", payment };
  }

  const metadata = payment.metadata || {};
  const externalReference = String(payment.external_reference || "");
  const leadId =
    metadata.lead_id ||
    externalReference.replace(/^signup_pix:/, "").replace(/^lead:/, "");

  if (!leadId) {
    return { ok: false, reason: "lead_id ausente", payment };
  }

  const { data: lead } = await supabaseAdmin
    .from("signup_leads")
    .select("raw_data")
    .eq("id", leadId)
    .maybeSingle();

  const status = String(payment.status || "");
  const paid = status === "approved";
  const point = payment.point_of_interaction || {};
  const transaction = point.transaction_data || {};

  const updatePayload: Record<string, unknown> = {
    mercado_pago_payment_id: String(payment.id || paymentId),
    payment_status: status,
    raw_data: {
      ...safeRaw(lead?.raw_data),
      signup_payment_method: "pix",
      signup_payment_status: status,
      signup_bonus_days: 7,
      signup_pix: {
        payment_id: String(payment.id || paymentId),
        status,
        qr_code: String(transaction.qr_code || ""),
        qr_code_base64: String(transaction.qr_code_base64 || ""),
        ticket_url: String(transaction.ticket_url || ""),
        expiration_date: String(payment.date_of_expiration || ""),
      },
      mercado_pago_payment: payment,
    },
  };

  if (paid) {
    updatePayload.status = "pago";
    updatePayload.paid_at = new Date().toISOString();
    updatePayload.next_followup_at = new Date(
      Date.now() + 24 * 60 * 60 * 1000,
    ).toISOString();
  }

  await supabaseAdmin
    .from("signup_leads")
    .update(updatePayload)
    .eq("id", leadId);

  return { ok: true, lead_id: leadId, status };
}

export async function GET() {
  return NextResponse.json({
    ok: true,
    route: "mercado-pago-signup-webhook",
    accepts: ["POST"],
  });
}

export async function POST(request: NextRequest) {
  let paymentId = getPaymentIdFromUrl(request);

  if (!paymentId) {
    try {
      const body = await request.json();
      paymentId =
        body?.data?.id ||
        body?.id ||
        body?.payment_id ||
        "";
    } catch {
      paymentId = "";
    }
  }

  const valid = verifyMercadoPagoWebhookSignature({
    xSignature: request.headers.get("x-signature"),
    xRequestId: request.headers.get("x-request-id"),
    dataId: String(paymentId || "") || null,
    secret: getSignupWebhookSecret(),
  });

  if (!valid) {
    return NextResponse.json(
      { error: "Assinatura inválida." },
      { status: 401 },
    );
  }

  return NextResponse.json(
    await processPayment(String(paymentId || "")),
  );
}
