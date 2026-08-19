"use client";

import { useEffect, useState } from "react";
import PartnerSystemDemo from "@/components/parceiros/PartnerSystemDemo";

type Demo = { companyName: string; segment: string; synthetic: boolean; sessionId: string };

export default function TrackedPartnerDemo({ token }: { token: string }) {
  const [demo, setDemo] = useState<Demo | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    void fetch(`/api/public/partner-demo/${encodeURIComponent(token)}`, { cache: "no-store" })
      .then(async (response) => {
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(payload.error || "Demonstração não encontrada.");
        if (active) setDemo(payload.demo as Demo);
      })
      .catch((reason) => { if (active) setError(reason instanceof Error ? reason.message : "Demonstração indisponível."); });
    return () => { active = false; };
  }, [token]);

  if (error) {
    return <main className="grid min-h-screen place-items-center bg-[#f4f7fb] p-4"><div className="max-w-md rounded-3xl border border-slate-200 bg-white p-7 text-center shadow-xl"><strong className="text-slate-800">{error}</strong><p className="mt-2 text-sm text-slate-500">Solicite um novo link ao parceiro Orçaly.</p></div></main>;
  }

  if (!demo) {
    return <main className="grid min-h-screen place-items-center bg-[#f4f7fb]"><div className="text-center"><div className="mx-auto h-10 w-10 animate-spin rounded-full border-4 border-blue-100 border-t-[#08295b]"/><p className="mt-3 text-sm font-bold text-slate-600">Preparando demonstração segura...</p></div></main>;
  }

  return (
    <div className="bg-[#f4f7fb]">
      <div className="border-b border-blue-100 bg-[#08295b] px-4 py-3 text-white">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-2">
          <div><span className="text-[9px] font-extrabold uppercase tracking-[.14em] text-blue-200">Demonstração sintética Orçaly</span><strong className="ml-2 text-sm">{demo.companyName}</strong></div>
          <span className="rounded-full border border-white/15 bg-white/10 px-3 py-1 text-[10px] font-bold">Nenhum dado real é exibido</span>
        </div>
      </div>
      <PartnerSystemDemo />
    </div>
  );
}
