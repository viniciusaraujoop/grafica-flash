import Link from "next/link";
import type { ReactNode } from "react";

export default function PartnerPanelLayout({ children }: { children: ReactNode }) {
  return (
    <>
      {children}
      <Link
        href="/parceiros/notificacoes"
        aria-label="Abrir notificações do parceiro"
        className="fixed bottom-20 right-3 z-[60] inline-flex h-11 items-center gap-2 rounded-full border border-blue-100 bg-white px-3 text-xs font-bold text-[#174e93] shadow-xl transition hover:-translate-y-px hover:border-blue-200 lg:bottom-5 lg:right-5"
      >
        <span aria-hidden="true">♢</span><span className="hidden sm:inline">Notificações</span>
      </Link>
    </>
  );
}
