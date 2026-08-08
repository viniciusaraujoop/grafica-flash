import type { Metadata } from "next";
import PartnerSystemDemo from "@/components/parceiros/PartnerSystemDemo";

export const metadata: Metadata = {
  title: "DemonstraÃ§Ã£o OrÃ§aly",
  description:
    "Ambiente demonstrativo e somente leitura do OrÃ§aly para apresentaÃ§Ãµes comerciais.",
  robots: {
    index: false,
    follow: false,
  },
};

export default function ParceirosDemoPage() {
  return <PartnerSystemDemo />;
}
