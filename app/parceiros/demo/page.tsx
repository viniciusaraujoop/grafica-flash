import type { Metadata } from "next";
import PartnerDemoHub from "@/components/parceiros/PartnerDemoHub";

export const metadata: Metadata = {
  title: "Demonstração Orçaly",
  description: "Ambiente demonstrativo sintético e somente leitura do Orçaly para apresentações comerciais.",
  robots: { index: false, follow: false },
};

export default function ParceirosDemoPage() {
  return <PartnerDemoHub />;
}
