// ORCALY_ASAAS_MIGRATION_V2
import { NextRequest } from "next/server";
import { POST as asaasPost } from "@/app/api/assinatura/asaas/route";
import { POST as mercadoPagoPost } from "./route.mercado-pago";
import {
  canUseAsaasSubscriptions,
  getDefaultPaymentProvider,
} from "@/lib/payments/asaas-config";

export async function POST(request: NextRequest) {
  const useAsaas =
    getDefaultPaymentProvider() === "asaas" &&
    canUseAsaasSubscriptions();

  if (!useAsaas) {
    return mercadoPagoPost(request);
  }

  const body = await request.clone().json().catch(() => ({}));
  const method = String(
    body.paymentMethod ||
      body.metodo ||
      body.formaPagamento ||
      body.payment_method ||
      "PIX",
  ).toUpperCase();

  const normalized = new NextRequest(request.url, {
    method: "POST",
    headers: request.headers,
    body: JSON.stringify({
      ...body,
      planKey:
        body.planKey ||
        body.plano ||
        body.plan ||
        body.planoKey,
      paymentMethod:
        method.includes("CARD") || method.includes("CART")
          ? "CREDIT_CARD"
          : "PIX",
    }),
  });

  return asaasPost(normalized);
}
