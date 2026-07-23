// ORCALY_ASAAS_MIGRATION_V2
import "server-only";
import type { PaymentProvider } from "@/lib/payments/provider";

function legacyOnly(): never {
  throw new Error("Esta operacao permanece no adaptador legado do Mercado Pago.");
}

export class MercadoPagoLegacyProvider implements PaymentProvider {
  createProviderAccount = async () => legacyOnly();
  getProviderAccountStatus = async () => legacyOnly();
  createCustomer = async () => legacyOnly();
  createPixPayment = async () => legacyOnly();
  createCardPayment = async () => legacyOnly();
  createSubscription = async () => legacyOnly();
  cancelSubscription = async () => legacyOnly();
  getPayment = async () => legacyOnly();
  refundPayment = async () => legacyOnly();
  parseWebhook = async () => legacyOnly();
}
