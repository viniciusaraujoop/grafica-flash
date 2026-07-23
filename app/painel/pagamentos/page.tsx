// ORCALY_ASAAS_MIGRATION_V2
import PaymentsHub from "@/components/payments/PaymentsHub";
import PagamentosLegacy from "./PagamentosLegacy";
import { getPaymentFlags } from "@/lib/payments/asaas-config";

export default function PagamentosPage() {
  const flags = getPaymentFlags();

  return (
    <PaymentsHub
      useAsaas={
        flags.asaasEnabled &&
        flags.marketplaceEnabled &&
        flags.checkoutV2Enabled
      }
      legacy={<PagamentosLegacy />}
    />
  );
}
