import type { Metadata } from "next";
import PartnerSystemDemo from "@/components/parceiros/PartnerSystemDemo";

export const metadata: Metadata = {
  title: "Demonstração Orçaly",
  description:
    "Ambiente demonstrativo e somente leitura do Orçaly para apresentações comerciais.",
  robots: {
    index: false,
    follow: false,
  },
};

export default function ParceirosDemoPage() {
  return <PartnerSystemDemo />;
}
