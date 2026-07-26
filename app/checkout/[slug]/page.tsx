// ORCALY_ASAAS_MIGRATION_V2
import CheckoutShell from "@/components/checkout/CheckoutShell";

type PageProps = {
  params: Promise<{ slug: string }>;
};

export default async function CheckoutPage({ params }: PageProps) {
  const { slug } = await params;
  return <CheckoutShell slug={slug} />;
}
