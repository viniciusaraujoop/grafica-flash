// ORCALY_ASAAS_MIGRATION_V2
import AssinaturaLegacy from "./AssinaturaLegacy";
import AsaasSubscriptionPayment from "@/components/subscription/AsaasSubscriptionPayment";
import {
  canUseAsaasSubscriptions,
  getDefaultPaymentProvider,
} from "@/lib/payments/asaas-config";

export default function AssinaturaPage() {
  const useAsaas =
    getDefaultPaymentProvider() === "asaas" &&
    canUseAsaasSubscriptions();

  return (
    <div className="min-w-0 max-w-full space-y-8">
      <AssinaturaLegacy />
      {useAsaas ? <AsaasSubscriptionPayment /> : null}
    </div>
  );
}
