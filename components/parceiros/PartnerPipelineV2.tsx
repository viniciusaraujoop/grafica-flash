"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

type LeadStatus = "new" | "contacted" | "demo" | "trial" | "converted" | "lost";
type Lead = {
  id: string;
  name: string;
  company_name?: string | null;
  whatsapp?: string | null;
  email?: string | null;
  segment: string;
  status: LeadStatus;
  source: string;
  notes?: string | null;
  next_follow_up_at?: string | null;
  estimated_plan?: string | null;
  estimated_value: number;
  lost_reason?: string | null;
  updated_at?: string | null;
};

type Workspace = { leads: Lead[]; funnel: Record<LeadStatus | "total", number> };

const stages: Array<{ id: LeadStatus; label: string; detail: string }> = [
  { id: "new", label: "Novo contato", detail: "Lead registrado" },
  { id: "contacted", label: "Apresentação", detail: "Conversa iniciada" },
  { id: "demo", label: "Demonstração", detail: "Produto apresentado" },
  { id: "trial", label: "Interessado / teste", detail: "Próximo da decisão" },
  { id: "converted", label: "Cliente", detail: "Conversão registrada" },
  { id: "lost", label: "Perdido", detail: "Sem avanço agora" },
];

function money(value: unknown) {
  return Number(value || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function date(value?: string | null) {
  if (!value) return "Sem próxima ação";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "Sem próxima ação";
  return new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }).format(parsed);
}

async function token() {
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token || "";
}

export default function PartnerPipelineV2() {
  const router = useRouter();
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [moving, setMoving] = useState("");
  const [dragged, setDragged] = useState("");
  const [query, setQuery] = useState("");
  const [view, setView] = useState<"kanban" | "list">("kanban");

  const load = useCallback(async () => {
    setLoading(true); setError("");
    const accessToken = await token();
    if (!accessToken) { router.replace("/parceiros/login"); return; }
    const response = await fetch("/api/parceiros/workspace", { headers: { Authorization: `Bearer ${accessToken}` }, cache: "no-store" });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      if ([401,403].includes(response.status)) router.replace("/parceiros/login");
      else setError(payload.error || "Não foi possível carregar o pipeline.");
      setLoading(false); return;
    }
    setWorkspace(payload as Workspace); setLoading(false);
  }, [router]);

  useEffect(() => { void load(); }, [load]);

  async function move(leadId: string, status: LeadStatus) {
    if (!workspace) return;
    const previous = workspace.leads.find((lead) => lead.id === leadId);
    if (!previous || previous.status === status) return;
    setMoving(leadId); setError(""); setNotice("");
    setWorkspace({ ...workspace, leads: workspace.leads.map((lead) => lead.id === leadId ? { ...lead, status } : lead) });
    const accessToken = await token();
    const response = await fetch("/api/parceiros/workspace", {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({ action: "update_lead", leadId, status }),
    });
    const payload = await response.json().catch(() => ({}));
    setMoving("");
    if (!response.ok) {
      setWorkspace((current) => current ? { ...current, leads: current.leads.map((lead) => lead.id === leadId ? previous : lead) } : current);
      setError(payload.error || "Não foi possível mover o lead.");
      return;
    }
    setNotice(`Lead movido para ${stages.find((stage) => stage.id === status)?.label || status}.`);
    await load();
  }

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return workspace?.leads || [];
    return (workspace?.leads || []).filter((lead) => `${lead.name} ${lead.company_name || ""} ${lead.whatsapp || ""} ${lead.email || ""} ${lead.segment}`.toLowerCase().includes(needle));
  }, [workspace, query]);

  return (
    <main className="min-h-screen bg-[#f3f6fb] p-3 pb-8 text-[#10233f] sm:p-6">
      <div className="mx-auto max-w-[1500px] space-y-4">
        <header className="flex flex-col gap-4 rounded-[1.45rem] border border-slate-200 bg-white p-5 shadow-sm xl:flex-row xl:items-end xl:justify-between">
          <div><span className="text-[10px] font-extrabold uppercase tracking-[.13em] text-[#4776ad]">Pipeline de indicações</span><h1 className="mt-1 text-3xl font-bold tracking-[-.045em]">Do primeiro contato à conversão.</h1><p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500">O movimento comercial persiste no CRM do parceiro. Etapas financeiras como comissão liberada continuam derivadas do pagamento real e não podem ser falsificadas aqui.</p></div>
          <div className="flex flex-wrap gap-2"><Link href="/parceiros/painel" className="rounded-xl border border-slate-200 px-4 py-2.5 text-xs font-bold">Voltar ao portal</Link><button onClick={() => void load()} className="rounded-xl bg-[#08295b] px-4 py-2.5 text-xs font-bold text-white">Atualizar</button></div>
        </header>
        {notice ? <div className="rounded-xl border border-emerald-100 bg-emerald-50 p-3 text-xs font-bold text-emerald-700">{notice}</div> : null}
        {error ? <div className="rounded-xl border border-red-100 bg-red-50 p-3 text-xs font-bold text-red-700">{error}</div> : null}
        <section className="grid gap-2 rounded-[1.2rem] border border-slate-200 bg-white p-3 md:grid-cols-[1fr_auto]">
          <input value={query} onChange={(event)=>setQuery(event.target.value)} placeholder="Buscar empresa, contato, telefone..." className="h-11 rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm font-semibold outline-none focus:border-blue-300"/>
          <div className="grid grid-cols-2 rounded-xl bg-slate-100 p-1"><button onClick={()=>setView('kanban')} className={`rounded-lg px-4 py-2 text-xs font-bold ${view==='kanban'?'bg-white text-[#174e93] shadow-sm':'text-slate-500'}`}>Kanban</button><button onClick={()=>setView('list')} className={`rounded-lg px-4 py-2 text-xs font-bold ${view==='list'?'bg-white text-[#174e93] shadow-sm':'text-slate-500'}`}>Lista</button></div>
        </section>
        {loading ? <div className="grid grid-cols-2 gap-3 xl:grid-cols-6">{stages.map((stage)=><div key={stage.id} className="h-64 animate-pulse rounded-2xl bg-slate-200/60"/>)}</div> : view === "kanban" ? (
          <div className="overflow-x-auto pb-3"><div className="grid min-w-max auto-cols-[270px] grid-flow-col gap-3">{stages.map((stage)=>{const leads=visible.filter((lead)=>lead.status===stage.id);return <section key={stage.id} onDragOver={(event)=>event.preventDefault()} onDrop={()=>{if(dragged)void move(dragged,stage.id);setDragged('');}} className="w-[270px] rounded-[1.25rem] border border-slate-200 bg-[#f8fafc] p-2.5"><div className="mb-2 flex items-start justify-between gap-2 px-1"><div><h2 className="text-sm font-bold text-slate-700">{stage.label}</h2><p className="mt-0.5 text-[9px] text-slate-400">{stage.detail}</p></div><span className="rounded-full bg-white px-2 py-1 text-[9px] font-bold text-slate-500 ring-1 ring-slate-200">{leads.length}</span></div><div className="grid gap-2">{leads.map((lead)=><article key={lead.id} draggable={moving!==lead.id} onDragStart={()=>setDragged(lead.id)} className={`rounded-xl border border-slate-200 bg-white p-3 shadow-sm transition hover:border-blue-200 hover:shadow-md ${moving===lead.id?'opacity-50':'cursor-grab'}`}><div className="flex justify-between gap-2"><strong className="min-w-0 truncate text-sm">{lead.company_name||lead.name}</strong><span className="shrink-0 rounded-full bg-blue-50 px-2 py-0.5 text-[8px] font-bold text-blue-700">{lead.segment}</span></div><p className="mt-1 truncate text-[10px] text-slate-400">{lead.name}{lead.whatsapp?` · ${lead.whatsapp}`:''}</p><div className="mt-3 flex items-center justify-between gap-2"><strong className="text-xs text-[#174e93]">{money(lead.estimated_value)}</strong><span className="text-[9px] font-bold text-slate-400">{date(lead.next_follow_up_at)}</span></div><select disabled={moving===lead.id} value={lead.status} onChange={(event)=>void move(lead.id,event.target.value as LeadStatus)} className="mt-2 h-8 w-full rounded-lg border border-slate-200 px-2 text-[9px] font-bold outline-none md:hidden">{stages.map((option)=><option key={option.id} value={option.id}>{option.label}</option>)}</select></article>)}{!leads.length?<div className="grid min-h-24 place-items-center rounded-xl border border-dashed border-slate-200 bg-white/60 p-3 text-center text-[10px] font-semibold text-slate-400">Arraste um lead para esta etapa.</div>:null}</div></section>})}</div></div>
        ) : (
          <div className="grid gap-2">{visible.map((lead)=><article key={lead.id} className="grid gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm md:grid-cols-[minmax(0,1fr)_170px_170px] md:items-center"><div className="min-w-0"><strong className="block truncate text-sm">{lead.company_name||lead.name}</strong><p className="mt-1 truncate text-xs text-slate-400">{lead.name} · {lead.segment} · {lead.source}</p><p className="mt-2 text-[10px] font-semibold text-slate-400">Próxima ação: {date(lead.next_follow_up_at)} · Valor {money(lead.estimated_value)}</p></div><select disabled={moving===lead.id} value={lead.status} onChange={(event)=>void move(lead.id,event.target.value as LeadStatus)} className="h-10 rounded-xl border border-slate-200 px-3 text-xs font-bold">{stages.map((option)=><option key={option.id} value={option.id}>{option.label}</option>)}</select>{lead.whatsapp?<a href={`https://wa.me/${String(lead.whatsapp).replace(/\D/g,'')}`} target="_blank" rel="noreferrer" className="rounded-xl bg-emerald-50 px-3 py-2.5 text-center text-xs font-bold text-emerald-700">WhatsApp</a>:<span className="rounded-xl bg-slate-100 px-3 py-2.5 text-center text-xs font-bold text-slate-300">Sem WhatsApp</span>}</article>)}{!visible.length?<div className="rounded-2xl border border-dashed border-slate-200 bg-white p-10 text-center text-sm font-semibold text-slate-400">Nenhum lead encontrado.</div>:null}</div>
        )}
      </div>
    </main>
  );
}
