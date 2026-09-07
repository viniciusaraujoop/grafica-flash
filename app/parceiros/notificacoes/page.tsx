import type { Metadata } from "next";
import PartnerNotificationsCenter from "@/components/parceiros/PartnerNotificationsCenter";

export const metadata: Metadata = {
  title: "Notificações | Parceiros Orçaly",
  robots: { index: false, follow: false },
};

export default function ParceirosNotificacoesPage() {
  return <PartnerNotificationsCenter />;
}
