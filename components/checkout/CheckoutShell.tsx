// ORCALY_ASAAS_MIGRATION_V2
import CheckoutClient from "@/components/checkout/CheckoutClient";

export default function CheckoutShell({ slug }: { slug: string }) {
  return <CheckoutClient slug={slug} />;
}
