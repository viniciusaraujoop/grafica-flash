"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";

type Partner = {
  id: string;
  name: string;
  status: string;
  code: string;
  createdAt?: string | null;
  lastActivity?: string | null;
  health: { score: number; label: string };
  clicks30d: number;
  referrals: number;
  customers: number;
  conversion: number;
  revenue: number;
  commission: number;
  paidOut: number;
  reviewSignals: number;
};

type Payload = {
  generatedAt: string;
  summary: {
    partners: number;
    active: number;
    cooling: number;
    inactive: number;
    clicks30d: number;
    referrals: number;
    customers: number;
    revenue: number;
    commission: number;
    payouts: number;
    reviewSignals: number;
  };
  partners: Partner[];
};

function money(value: unknown) {
  return Number(value || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function dateTime(value?: string | null) {
  if (!value) return "Sem atividade recente";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "—";
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(parsed);
}

function healthTone(label: string) {
  if (label === "Ativo") return "bg-emerald-50 text-emerald-700";
  if (label === "Esfriando") return "bg-amber-50 text-amber-700";
  return "bg-slate-100 text-slate-500";
}

function Metric({ label, value, detail }: { label: string; value: string | number; detail: string }) {
  return (
    <article className="rounded-[1.2rem] border border-slate-200 bg-white p-4 shadow-[0_8px_25px_rgba(8,39,86,.04)]">
      <span className="text-[9px] font-extrabold uppercase tracking-[.12em] text-slate-400">{label}</span>
      <strong className="mt-2 block truncate text-2xl font-bold tracking-[-.04em] text-[#08295b]">{value}</strong>
      <small className="mt-1 block text-[10px] font-semibold text-slate-400">{detail}</small>
    </article>
  );
}

export default function PartnerGrowthAdminPage() {
  const router = useRouter();
  const [data, setData] = useState<Payload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("all");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    const { data: auth } = await supabase.auth.getSession();
    const token = auth.session?.access_token || "";
    if (!token) {
      router.replace("/admin/login");
      return;
    }
    const response = await fetch("/api/admin/affiliates/growth", {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      if ([401, 403].includes(response.status)) router.replace("/admin");
      else setError(payload.error || "Não foi possível carregar Growth de parceiros.");
      setLoading(false);
      return;
    }
    setData(payload as Payload);
    setLoading(false);
  }, [router]);

  useEffect(() => { void load(); }, [load]);

  const rows = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return (data?.partners || []).filter((partner) => {
      if (filter !== "all" && partner.health.label.toLowerCase() !== filter) return false;
      if (!needle) return true;
      return `${partner.name} ${partner.code} ${partner.status}`.toLowerCase().includes(needle);
    });
  }, [data, query, filter]);

  if (loading && !data) {
    return <main className="grid min-h-[70vh] place-items-center"><div className="text-center"><div className="mx-auto h-10 w-10 animate-spin rounded-full border-4 border-blue-100 border-t-[#08295b]"/><p className="mt-3 text-sm font-bold text-slate-500">Lendo a operação de parceiros...</p></div></main>;
  }

  if (!data) {
    return <main className="grid min-h-[70vh] place-items-center p-4"><div className="max-w-md rounded-3xl border border-red-100 bg-white p-6 text-center"><strong className="text-red-700">{error || "Growth indisponível."}</strong><button type="button" onClick={() => void load()} className="mt-4 rounded-xl bg-[#08295b] px-4 py-3 text-sm font-bold text-white">Tentar novamente</button></div></main>;
  }

  return (
    <main className="space-y-4 text-[#10233f]">
      <section className="relative overflow-hidden rounded-[1.5rem] bg-gradient-to-br from-[#061b3e] via-[#0a3470] to-[#0d518f] p-5 text-white shadow-xl sm:p-7">
        <div className="absolute -right-20 -top-24 h-64 w-64 rounded-full bg-cyan-300/15 blur-3xl"/>
        <div className="relative flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
          <div><span className="text-[10px] font-extrabold uppercase tracking-[.15em] text-blue-200">Partner Growth</span><h1 className="mt-2 text-3xl font-bold tracking-[-.045em] sm:text-4xl">Quem está crescendo, quem esfriou e onde agir.</h1><p className="mt-3 max-w-3xl text-sm leading-6 text-white/65">Health Score é diagnóstico, não punição. Decisões financeiras e revisão de fraude continuam na central operacional existente.</p></div>
          <div className="flex flex-wrap gap-2"><Link href="/admin/indicacoes" className="rounded-xl bg-white px-4 py-3 text-xs font-bold text-[#08295b]">Abrir gestão financeira</Link><button type="button" onClick={() => void load()} className="rounded-xl border border-white/15 bg-white/10 px-4 py-3 text-xs font-bold">Atualizar</button></div>
        </div>
      </section>

      {error ? <div className="rounded-xl border border-red-100 bg-red-50 p-3 text-xs font-bold text-red-700">{error}</div> : null}

      <section className="grid grid-cols-2 gap-2.5 xl:grid-cols-6">
        <Metric label="Parceiros" value={data.summary.partners} detail={`${data.summary.active} ativos`}/>
        <Metric label="Cliques 30d" value={data.summary.clicks30d} detail="tráfego atribuído"/>
        <Metric label="Indicações" value={data.summary.referrals} detail="histórico atribuído"/>
        <Metric label="Clientes pagos" value={data.summary.customers} detail="conversões qualificadas"/>
        <Metric label="Receita" value={money(data.summary.revenue)} detail="primeiros pagamentos"/>
        <Metric label="Comissões" value={money(data.summary.commission)} detail={`${data.summary.reviewSignals} sinal(is) de revisão`}/>
      </section>

      <section className="rounded-[1.4rem] border border-slate-200 bg-white p-4 shadow-sm">
        <div className="grid gap-2 md:grid-cols-[1fr_190px_auto]">
          <label><span className="sr-only">Buscar parceiro</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar parceiro, código ou status..." className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm font-semibold outline-none focus:border-blue-300"/></label>
          <select value={filter} onChange={(event) => setFilter(event.target.value)} className="h-11 rounded-xl border border-slate-200 px-3 text-sm font-bold"><option value="all">Todos os health scores</option><option value="ativo">Ativos</option><option value="esfriando">Esfriando</option><option value="inativo">Inativos</option></select>
          <div className="grid grid-cols-3 overflow-hidden rounded-xl border border-slate-200 text-center text-[10px] font-bold"><span className="p-2 text-emerald-700">{data.summary.active}<br/>ativos</span><span className="border-x border-slate-200 p-2 text-amber-700">{data.summary.cooling}<br/>esfriando</span><span className="p-2 text-slate-500">{data.summary.inactive}<br/>inativos</span></div>
        </div>
      </section>

      <section className="overflow-hidden rounded-[1.4rem] border border-slate-200 bg-white shadow-sm">
        <div className="hidden grid-cols-[minmax(180px,1.4fr)_100px_repeat(6,minmax(90px,1fr))] gap-2 border-b border-slate-100 bg-slate-50 px-4 py-3 text-[9px] font-extrabold uppercase tracking-[.08em] text-slate-400 xl:grid">
          <span>Parceiro</span><span>Health</span><span>Cliques</span><span>Indicações</span><span>Pagos</span><span>Conversão</span><span>Receita</span><span>Comissão</span>
        </div>
        <div className="divide-y divide-slate-100">
          {rows.length ? rows.map((partner) => (
            <article key={partner.id} className="grid gap-3 p-4 transition hover:bg-slate-50/70 xl:grid-cols-[minmax(180px,1.4fr)_100px_repeat(6,minmax(90px,1fr))] xl:items-center xl:gap-2">
              <div className="min-w-0"><strong className="block truncate text-sm text-slate-800">{partner.name}</strong><p className="mt-1 truncate text-[10px] text-slate-400">{partner.code} · {partner.status}</p><p className="mt-1 text-[9px] text-slate-300">Última atividade: {dateTime(partner.lastActivity)}</p></div>
              <div><span className={`inline-flex rounded-full px-2 py-1 text-[9px] font-bold ${healthTone(partner.health.label)}`}>{partner.health.score}/100 · {partner.health.label}</span></div>
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-6 xl:contents">
                <div><small className="text-[8px] font-bold uppercase text-slate-300 xl:hidden">Cliques</small><strong className="block text-xs">{partner.clicks30d}</strong></div>
                <div><small className="text-[8px] font-bold uppercase text-slate-300 xl:hidden">Indicações</small><strong className="block text-xs">{partner.referrals}</strong></div>
                <div><small className="text-[8px] font-bold uppercase text-slate-300 xl:hidden">Pagos</small><strong className="block text-xs">{partner.customers}</strong></div>
                <div><small className="text-[8px] font-bold uppercase text-slate-300 xl:hidden">Conversão</small><strong className="block text-xs">{partner.conversion}%</strong></div>
                <div><small className="text-[8px] font-bold uppercase text-slate-300 xl:hidden">Receita</small><strong className="block truncate text-xs">{money(partner.revenue)}</strong></div>
                <div><small className="text-[8px] font-bold uppercase text-slate-300 xl:hidden">Comissão</small><strong className="block truncate text-xs">{money(partner.commission)}</strong>{partner.reviewSignals ? <span className="mt-1 block text-[8px] font-bold text-amber-600">{partner.reviewSignals} revisão(ões)</span> : null}</div>
              </div>
            </article>
          )) : <div className="p-10 text-center text-sm font-semibold text-slate-400">Nenhum parceiro corresponde aos filtros.</div>}
        </div>
      </section>

      <footer className="rounded-xl border border-slate-200 bg-white p-4 text-[10px] leading-5 text-slate-400">Atualizado {dateTime(data.generatedAt)}. Health Score combina atividade, cliques, indicações e clientes pagos; ele não bloqueia nem altera comissão automaticamente.</footer>
    </main>
  );
}
