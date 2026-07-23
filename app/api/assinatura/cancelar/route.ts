// ORCALY_ASAAS_MIGRATION_V2
import { NextRequest } from "next/server";
import { POST as asaasPost } from "@/app/api/assinatura/asaas/cancelar/route";
import { POST as mercadoPagoPost } from "./route.mercado-pago";
import {
  canUseAsaasSubscriptions,
  getDefaultPaymentProvider,
} from "@/lib/payments/asaas-config";

export async function POST(request: NextRequest) {
  const useAsaas =
    getDefaultPaymentProvider() === "asaas" &&
    canUseAsaasSubscriptions();

  return useAsaas
    ? asaasPost(request)
    : mercadoPagoPost(request);
}
