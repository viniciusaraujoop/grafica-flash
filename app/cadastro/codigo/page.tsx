"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

export default function PartnerCodeSignupPage() {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const normalized = code.trim().toUpperCase().replace(/[^A-Z0-9_-]/g, "").slice(0, 32);
    if (!normalized) { setError("Informe o código do parceiro."); return; }
    setLoading(true); setError("");
    const response = await fetch(`/api/public/partner-code/${encodeURIComponent(normalized)}`, { cache: "no-store" });
    setLoading(false);
    if (!response.ok) { setError("Código não encontrado ou parceiro indisponível."); return; }
    try { localStorage.setItem("orcaly_referral_code", normalized); localStorage.setItem("orcaly_referral_saved_at", String(Date.now())); } catch {}
    router.replace(`/cadastro?ref=${encodeURIComponent(normalized)}`);
  }

  return (
    <main className="grid min-h-screen place-items-center bg-[#f3f6fb] p-4 text-[#10233f]">
      <section className="w-full max-w-md rounded-[1.6rem] border border-slate-200 bg-white p-6 shadow-[0_24px_70px_rgba(8,39,86,.09)] sm:p-8">
        <Link href="/cadastro" className="text-xs font-bold text-slate-400">← Cadastro sem código</Link>
        <span className="mt-8 block text-[10px] font-extrabold uppercase tracking-[.14em] text-[#4776ad]">Código de parceiro</span>
        <h1 className="mt-2 text-3xl font-bold tracking-[-.045em]">Quem te apresentou o Orçaly?</h1>
        <p className="mt-3 text-sm leading-6 text-slate-500">Use o código informado pelo parceiro. Ele serve para atribuição da indicação e não altera automaticamente preço, plano ou condição comercial.</p>
        <form onSubmit={submit} className="mt-6 grid gap-3">
          <label><span className="mb-1 block text-xs font-bold text-slate-600">Código</span><input autoFocus value={code} onChange={(event)=>setCode(event.target.value.toUpperCase())} placeholder="Ex.: JOAOORCALY" maxLength={32} className="h-12 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 font-mono text-sm font-bold uppercase outline-none focus:border-blue-300 focus:bg-white"/></label>
          {error ? <div role="alert" className="rounded-xl border border-red-100 bg-red-50 p-3 text-xs font-bold text-red-700">{error}</div> : null}
          <button disabled={loading} className="rounded-xl bg-[#08295b] px-4 py-3.5 text-sm font-bold text-white disabled:opacity-50">{loading?"Validando...":"Continuar cadastro"}</button>
        </form>
        <p className="mt-4 text-[10px] leading-5 text-slate-400">O código é validado antes de continuar. A atribuição final ainda respeita regras antifraude, autoindicação e claims anteriores.</p>
      </section>
    </main>
  );
}
