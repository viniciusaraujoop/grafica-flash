import type { Metadata } from "next";
import PartnerDemoHub from "@/components/parceiros/PartnerDemoHub";

export const metadata: Metadata = {
  title: "Demonstração Orçaly",
  description: "Ambiente demonstrativo sintético e somente leitura do Orçaly para apresentações comerciais.",
  robots: { index: false, follow: false },
};

export default async function ParceirosDemoPage({ searchParams }: { searchParams: Promise<{ preview?: string }> }) {
  const params = await searchParams;
  return <PartnerDemoHub previewOnly={params.preview === "1"} />;
}
