import type { Metadata } from "next";
import TrackedPartnerDemo from "@/components/parceiros/TrackedPartnerDemo";

export const metadata: Metadata = {
  title: "Demonstração Orçaly",
  description: "Demonstração sintética e somente leitura do Orçaly.",
  robots: { index: false, follow: false },
};

export default async function PartnerDemoPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return <TrackedPartnerDemo token={token} />;
}
