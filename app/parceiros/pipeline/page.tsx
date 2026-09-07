import type { Metadata } from "next";
import PartnerPipelineV2 from "@/components/parceiros/PartnerPipelineV2";

export const metadata: Metadata = {
  title: "Pipeline | Parceiros Orçaly",
  robots: { index: false, follow: false },
};

export default function ParceirosPipelinePage() {
  return <PartnerPipelineV2 />;
}
