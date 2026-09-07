"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import PartnerSystemDemo from "@/components/parceiros/PartnerSystemDemo";
import { supabase } from "@/lib/supabase";

type Session = {
  id: string;
  companyName: string;
  segment: string;
  url: string;
  createdAt: string;
  count: number;
  lastOpenedAt?: string | null;
};

const segments = [
  ["graphic", "Gráfica"], ["custom_products", "Personalizados"], ["food", "Food"],
  ["technical_assistance", "Assistência técnica"], ["store", "Loja"], ["services", "Serviços"],
  ["events", "Eventos"], ["beauty", "Beleza"], ["barber", "Barbearia"], ["auto", "Automotivo"],
];

function date(value?: string | null) {
  if (!value) return "Nunca aberta";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "—";
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(parsed);
}

export default function PartnerDemoHub({ previewOnly = false }: { previewOnly?: boolean }) {
  const [checking, setChecking] = useState(!previewOnly);
  const [partner, setPartner] = useState(false);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  async function token() {
    const { data } = await supabase.auth.getSession();
    return data.session?.access_token || "";
  }

  const load = useCallback(async () => {
    if (previewOnly) {
      setChecking(false);
      return;
    }
    const accessToken = await token();
    if (!accessToken) {
      setPartner(false);
      setChecking(false);
      return;
    }
    const response = await fetch("/api/parceiros/demos", { headers: { Authorization: `Bearer ${accessToken}` }, cache: "no-store" });
    const payload = await response.json().catch(() => ({}));
    if (response.ok) {
      setPartner(true);
      setSessions(payload.sessions || []);
    } else {
      setPartner(false);
    }
    setChecking(false);
  }, [previewOnly]);

  useEffect(() => { void load(); }, [load]);

  async function createDemo(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const accessToken = await token();
    setBusy(true); setError(""); setMessage("");
    const response = await fetch("/api/parceiros/demos", {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
      body: JSON.stringify(Object.fromEntries(data.entries())),
    });
    const payload = await response.json().catch(() => ({}));
    setBusy(false);
    if (!response.ok) { setError(payload.error || "Não foi possível criar a demonstração."); return; }
    form.reset();
    setMessage("Demonstração criada. O link usa somente dados sintéticos.");
    await load();
  }

  async function copy(value: string) {
    try { await navigator.clipboard.writeText(value); setMessage("Link copiado."); } catch { setError("Não foi possível copiar automaticamente."); }
  }

  if (previewOnly) return <PartnerSystemDemo />;

  if (checking) {
    return <main className="grid min-h-screen place-items-center bg-[#f4f7fb]"><div className="h-10 w-10 animate-spin rounded-full border-4 border-blue-100 border-t-[#08295b]"/></main>;
  }

  if (!partner) return <PartnerSystemDemo />;

  return (
    <main className="min-h-screen bg-[#f4f7fb] p-3 text-[#10233f] sm:p-6">
      <div className="mx-auto max-w-6xl space-y-4">
        <header className="flex flex-wrap items-center justify-between gap-3 rounded-[1.4rem] border border-slate-200 bg-white p-4 shadow-sm">
          <div><span className="text-[10px] font-extrabold uppercase tracking-[.12em] text-[#4776ad]">Estúdio de demonstrações</span><h1 className="mt-1 text-2xl font-bold">Mostre o Orçaly sem mostrar dados de ninguém.</h1></div>
          <div className="flex gap-2"><Link href="/parceiros/painel" className="rounded-xl border border-slate-200 px-4 py-2.5 text-xs font-bold">Voltar ao portal</Link><Link href="/parceiros/demo?preview=1" target="_blank" className="rounded-xl bg-[#08295b] px-4 py-2.5 text-xs font-bold text-white">Prévia genérica</Link></div>
        </header>

        {message ? <div className="rounded-xl border border-emerald-100 bg-emerald-50 p-3 text-xs font-bold text-emerald-700">{message}</div> : null}
        {error ? <div className="rounded-xl border border-red-100 bg-red-50 p-3 text-xs font-bold text-red-700">{error}</div> : null}

        <section className="grid gap-4 xl:grid-cols-[.8fr_1.2fr]">
          <form onSubmit={createDemo} className="rounded-[1.4rem] border border-slate-200 bg-white p-5 shadow-sm">
            <span className="text-[10px] font-extrabold uppercase tracking-[.12em] text-[#4776ad]">Nova demonstração</span>
            <h2 className="mt-1 text-xl font-bold">Personalize o contexto, não os dados.</h2>
            <p className="mt-2 text-xs leading-5 text-slate-500">O nome e segmento servem apenas para contextualizar a apresentação. Pedidos, clientes, valores e gráficos continuam sintéticos.</p>
            <div className="mt-4 grid gap-2"><input name="companyName" required placeholder="Nome da empresa prospect" className="h-11 rounded-xl border border-slate-200 px-3 text-sm"/><select name="segment" className="h-11 rounded-xl border border-slate-200 px-3 text-sm font-bold">{segments.map(([value,label])=><option key={value} value={value}>{label}</option>)}</select><button disabled={busy} className="rounded-xl bg-[#08295b] px-4 py-3 text-sm font-bold text-white disabled:opacity-50">{busy?"Criando...":"Criar link seguro"}</button></div>
          </form>

          <section className="rounded-[1.4rem] border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-end justify-between gap-3"><div><span className="text-[10px] font-extrabold uppercase tracking-[.12em] text-[#4776ad]">Histórico</span><h2 className="mt-1 text-xl font-bold">Demonstrações rastreadas</h2></div><span className="text-[10px] font-bold text-slate-400">{sessions.length} criada(s)</span></div>
            <div className="mt-4 grid max-h-[500px] gap-2 overflow-y-auto">
              {sessions.length ? sessions.map((session) => <article key={session.id} className="rounded-xl border border-slate-100 p-3"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><strong className="block truncate text-sm">{session.companyName}</strong><p className="mt-1 text-[10px] text-slate-400">{session.segment} · criada {date(session.createdAt)}</p></div><span className="rounded-full bg-blue-50 px-2 py-1 text-[9px] font-bold text-blue-700">{session.count || 0} abertura(s)</span></div><code className="mt-2 block break-all rounded-lg bg-slate-50 p-2 text-[9px] text-slate-500">{session.url}</code><div className="mt-2 flex flex-wrap items-center gap-2"><button type="button" onClick={()=>void copy(session.url)} className="rounded-lg bg-[#08295b] px-3 py-2 text-[10px] font-bold text-white">Copiar link</button><a href={session.url} target="_blank" rel="noreferrer" className="rounded-lg border border-slate-200 px-3 py-2 text-[10px] font-bold">Abrir</a><span className="ml-auto text-[9px] text-slate-400">Última abertura: {date(session.lastOpenedAt)}</span></div></article>) : <div className="rounded-xl border border-dashed border-slate-200 p-6 text-center text-xs text-slate-400">Nenhuma demonstração personalizada ainda.</div>}
            </div>
          </section>
        </section>

        <section className="rounded-[1.4rem] border border-slate-200 bg-white p-5"><h2 className="text-lg font-bold">Prévia do produto</h2><p className="mt-1 text-xs text-slate-500">Abaixo está o mesmo ambiente sintético que o prospect verá pelo link.</p><div className="mt-4 overflow-hidden rounded-2xl border border-slate-200"><PartnerSystemDemo /></div></section>
      </div>
    </main>
  );
}
