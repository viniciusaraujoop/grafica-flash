"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

type Notification = {
  id: string;
  type: string;
  title: string;
  detail: string;
  priority: string;
  destination: string;
  read: boolean;
};

const destinationHref: Record<string, string> = {
  pipeline: "/parceiros/pipeline",
  referrals: "/parceiros/painel",
  wallet: "/parceiros/painel",
  campaigns: "/parceiros/painel",
};

async function token() {
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token || "";
}

export default function PartnerNotificationsCenter() {
  const router = useRouter();
  const [items, setItems] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [filter, setFilter] = useState<"all" | "unread">("all");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    const accessToken = await token();
    if (!accessToken) {
      router.replace("/parceiros/login");
      return;
    }
    const response = await fetch("/api/parceiros/portal-v2?period=30d", {
      headers: { Authorization: `Bearer ${accessToken}` },
      cache: "no-store",
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      if ([401, 403].includes(response.status)) router.replace("/parceiros/login");
      else setError(payload.error || "Não foi possível carregar notificações.");
      setLoading(false);
      return;
    }
    setItems(payload.notifications || []);
    setLoading(false);
  }, [router]);

  useEffect(() => { void load(); }, [load]);

  async function markRead(id: string) {
    setBusy(id);
    setError("");
    const accessToken = await token();
    const response = await fetch("/api/parceiros/portal-v2", {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({ action: "mark_notification_read", notificationId: id }),
    });
    const payload = await response.json().catch(() => ({}));
    setBusy("");
    if (!response.ok) { setError(payload.error || "Não foi possível marcar a notificação."); return; }
    setItems((current) => current.map((item) => item.id === id ? { ...item, read: true } : item));
  }

  async function markAll() {
    const unread = items.filter((item) => !item.read);
    if (!unread.length) return;
    setBusy("all");
    setError("");
    const accessToken = await token();
    const results = await Promise.all(unread.map((item) => fetch("/api/parceiros/portal-v2", {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({ action: "mark_notification_read", notificationId: item.id }),
    })));
    setBusy("");
    if (results.some((response) => !response.ok)) {
      setError("Parte das notificações não pôde ser atualizada.");
      await load();
      return;
    }
    setItems((current) => current.map((item) => ({ ...item, read: true })));
    setMessage("Notificações marcadas como lidas.");
  }

  const visible = useMemo(() => filter === "unread" ? items.filter((item) => !item.read) : items, [filter, items]);
  const unreadCount = items.filter((item) => !item.read).length;

  return (
    <main className="min-h-screen bg-[#f3f6fb] p-3 text-[#10233f] sm:p-6">
      <div className="mx-auto max-w-4xl space-y-4">
        <header className="flex flex-col gap-4 rounded-[1.45rem] border border-slate-200 bg-white p-5 shadow-sm sm:flex-row sm:items-end sm:justify-between">
          <div><span className="text-[10px] font-extrabold uppercase tracking-[.13em] text-[#4776ad]">Notificações</span><h1 className="mt-1 text-2xl font-bold tracking-[-.04em]">O que mudou e pede ação.</h1><p className="mt-2 text-sm text-slate-500">Derivadas de tarefas, indicações e eventos financeiros reais. Sem push externo nesta versão.</p></div>
          <div className="flex flex-wrap gap-2"><Link href="/parceiros/painel" className="rounded-xl border border-slate-200 px-4 py-2.5 text-xs font-bold">Voltar ao portal</Link><button type="button" disabled={!unreadCount || busy === "all"} onClick={() => void markAll()} className="rounded-xl bg-[#08295b] px-4 py-2.5 text-xs font-bold text-white disabled:opacity-40">Marcar todas lidas</button></div>
        </header>

        {message ? <div className="rounded-xl border border-emerald-100 bg-emerald-50 p-3 text-xs font-bold text-emerald-700">{message}</div> : null}
        {error ? <div className="rounded-xl border border-red-100 bg-red-50 p-3 text-xs font-bold text-red-700">{error}</div> : null}

        <section className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-2"><div className="grid grid-cols-2 rounded-lg bg-slate-100 p-1">{([['all','Todas'],['unread',`Não lidas (${unreadCount})`]] as const).map(([id,label])=><button key={id} type="button" onClick={()=>setFilter(id)} className={`rounded-md px-3 py-2 text-xs font-bold ${filter===id?'bg-white text-[#174e93] shadow-sm':'text-slate-500'}`}>{label}</button>)}</div><button type="button" onClick={() => void load()} className="rounded-lg px-3 py-2 text-xs font-bold text-slate-500">Atualizar</button></section>

        {loading ? <div className="grid gap-2">{Array.from({length:5}).map((_,index)=><div key={index} className="h-24 animate-pulse rounded-2xl bg-slate-200/60"/>)}</div> : visible.length ? <div className="grid gap-2">{visible.map((item)=><article key={item.id} className={`rounded-[1.2rem] border bg-white p-4 shadow-sm transition ${item.read?'border-slate-100 opacity-75':'border-blue-100'}`}><div className="flex items-start gap-3"><span className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl text-xs font-black ${item.priority==='high'?'bg-amber-50 text-amber-700':item.priority==='info'?'bg-emerald-50 text-emerald-700':'bg-blue-50 text-blue-700'}`}>{item.type==='wallet'?'$':'!'}</span><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><strong className="text-sm text-slate-800">{item.title}</strong>{!item.read?<span className="rounded-full bg-blue-50 px-2 py-0.5 text-[8px] font-bold uppercase text-blue-700">Nova</span>:null}</div><p className="mt-1 text-xs leading-5 text-slate-500">{item.detail}</p><div className="mt-3 flex flex-wrap gap-2"><Link href={destinationHref[item.destination] || '/parceiros/painel'} className="rounded-lg bg-[#08295b] px-3 py-2 text-[10px] font-bold text-white">{item.destination === 'pipeline' ? 'Abrir pipeline' : 'Abrir área relacionada'}</Link>{!item.read?<button type="button" disabled={busy===item.id} onClick={()=>void markRead(item.id)} className="rounded-lg border border-slate-200 px-3 py-2 text-[10px] font-bold text-slate-500">Marcar como lida</button>:null}</div></div></div></article>)}</div> : <div className="grid min-h-52 place-items-center rounded-2xl border border-dashed border-slate-200 bg-white p-6 text-center"><div><span className="text-2xl">✓</span><strong className="mt-2 block text-sm">Nada pendente neste filtro.</strong><p className="mt-1 text-xs text-slate-400">Novos eventos relevantes aparecerão aqui.</p></div></div>}
      </div>
    </main>
  );
}
