// ORCALY_ASAAS_MIGRATION_V2
import "server-only";
import {
  canUseAsaasMarketplace,
  getDefaultPaymentProvider,
  requireAsaasMasterApiKey,
} from "@/lib/payments/asaas-config";
import { AsaasProvider } from "@/lib/payments/providers/asaas";
import { MercadoPagoLegacyProvider } from "@/lib/payments/providers/mercado-pago";
import type { PaymentProviderName } from "@/lib/payments/types";

export function normalizePaymentProvider(
  value: unknown,
): PaymentProviderName {
  return String(value || "").trim().toLowerCase() === "asaas"
    ? "asaas"
    : "mercado_pago";
}

export function resolveCompanyPaymentProvider(
  companyProvider: unknown,
): PaymentProviderName {
  const requested = normalizePaymentProvider(
    companyProvider || getDefaultPaymentProvider(),
  );

  if (requested === "asaas" && canUseAsaasMarketplace()) {
    return "asaas";
  }

  return "mercado_pago";
}

export function createPaymentProvider(
  name: PaymentProviderName = getDefaultPaymentProvider(),
  apiKey?: string,
) {
  if (name === "asaas") {
    return new AsaasProvider(apiKey || requireAsaasMasterApiKey());
  }

  return new MercadoPagoLegacyProvider();
}
