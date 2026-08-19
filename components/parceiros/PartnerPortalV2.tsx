"use client";

import Image from "next/image";
import Link from "next/link";
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import PartnerGrowthHub from "@/components/parceiros/PartnerGrowthHub";
import PartnerPromotionTab from "@/components/parceiros/PartnerPromotionTab";
import PartnerAcademyV3 from "@/components/parceiros/PartnerAcademyV3";
import ChangePasswordCard from "@/components/auth/ChangePasswordCard";

type Section =
  | "overview"
  | "referrals"
  | "pipeline"
  | "campaigns"
  | "promotion"
  | "demos"
  | "academy"
  | "wallet"
  | "ranking"
  | "support"
  | "profile";

type CoreDashboard = {
  profile: {
    id: string;
    name: string;
    email?: string;
    whatsapp?: string;
    code: string;
    referralLink: string;
    debtBalance: number;
  };
  program: {
    commissionRate: number;
    minimumPayout: number;
    holdDays?: number;
    attributionDays?: number;
    payoutsEnabled?: boolean;
  };
  stats: {
    clicks: number;
    referrals: number;
    trials?: number;
    qualified?: number;
    future: number;
    hold: number;
    available: number;
    processing?: number;
    paid: number;
    reversed?: number;
  };
  payoutAccount: null | {
    pixKeyType: string;
    pixKeyMasked: string;
    holderName: string;
    bankName?: string | null;
    isVerified: boolean;
  };
  referrals: Array<{
    id: string;
    status: string;
    plan?: string | null;
    customer_name_masked?: string | null;
    customer_email_masked?: string | null;
    registered_at?: string | null;
    trial_ends_at?: string | null;
    qualified_at?: string | null;
    commission_expected?: number | null;
  }>;
  commissions: Array<{
    id: string;
    referral_id?: string | null;
    plan?: string | null;
    commission_amount: number;
    eligible_amount?: number | null;
    commission_rate?: number | null;
    status: string;
    hold_until?: string | null;
    available_at?: string | null;
    reversal_reason?: string | null;
    created_at?: string | null;
  }>;
  payouts: Array<{
    id: string;
    amount: number;
    status: string;
    pix_key_masked?: string | null;
    requested_at?: string | null;
    paid_at?: string | null;
    failure_reason?: string | null;
    proof_url?: string | null;
  }>;
  ranking: {
    top: Array<{ id: string; position: number; name: string; score: number; conversions: number }>;
    current?: { id: string; position: number; name: string; score: number; conversions: number } | null;
  };
};

type PortalV2 = {
  generatedAt: string;
  profile: { id: string; name: string; code: string; health: { score: number; label: string } };
  program: { minimumPayout: number; attributionDays: number; commissionRate: number; holdDays: number; payoutsEnabled: boolean };
  kpis: {
    clicks: number;
    leads: number;
    paidCustomers: number;
    conversion: number;
    revenue: number;
    commission: number;
    available: number;
    pending: number;
    epc: number;
    avgTicket: number;
    avgConversionDays: number;
  };
  funnel: { clicks: number; leads: number; signups: number; trials: number; paid: number };
  timeline: Array<{ date: string; clicks: number; referrals: number; customers: number }>;
  campaigns: Array<{
    id: string;
    code: string;
    name: string;
    channel: string;
    segment?: string | null;
    description?: string | null;
    status: string;
    link: string;
    clicks: number;
    leads: number;
    customers: number;
    revenue: number;
    commission: number;
    conversion: number;
  }>;
  attention: Array<{ id: string; type: string; title: string; detail: string; priority: string; destination: Section }>;
  notifications: Array<{ id: string; type: string; title: string; detail: string; priority: string; destination: Section; read: boolean }>;
  leads: Array<{ id: string; name: string; company_name?: string | null; whatsapp?: string | null; email?: string | null; segment: string; status: string; next_follow_up_at?: string | null }>;
  searchResults: Array<{ type: string; id: string; title: string; subtitle: string; destination: Section }>;
};

const NAV: Array<{ id: Section; label: string; group: string; icon: string }> = [
  { id: "overview", label: "Visão geral", group: "Principal", icon: "⌂" },
  { id: "referrals", label: "Indicações", group: "Vendas", icon: "↗" },
  { id: "pipeline", label: "Pipeline & CRM", group: "Vendas", icon: "◫" },
  { id: "campaigns", label: "Campanhas", group: "Vendas", icon: "◎" },
  { id: "promotion", label: "Divulgação", group: "Ferramentas", icon: "✦" },
  { id: "demos", label: "Demonstrações", group: "Ferramentas", icon: "▶" },
  { id: "academy", label: "Academia", group: "Crescimento", icon: "◇" },
  { id: "wallet", label: "Comissões", group: "Financeiro", icon: "$" },
  { id: "ranking", label: "Ranking", group: "Crescimento", icon: "#" },
  { id: "support", label: "Suporte", group: "Conta", icon: "?" },
  { id: "profile", label: "Perfil", group: "Conta", icon: "●" },
];

const SEGMENTS = [
  ["graphic", "Gráfica"],
  ["custom_products", "Personalizados"],
  ["food", "Food"],
  ["technical_assistance", "Assistência técnica"],
  ["store", "Loja"],
  ["services", "Serviços"],
  ["events", "Eventos"],
  ["beauty", "Beleza"],
  ["barber", "Barbearia"],
  ["auto", "Automotivo"],
];

function money(value: unknown) {
  return Number(value || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function date(value: unknown, withTime = false) {
  if (!value) return "—";
  const parsed = new Date(String(value));
  if (Number.isNaN(parsed.getTime())) return "—";
  return new Intl.DateTimeFormat("pt-BR", withTime ? { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" } : { day: "2-digit", month: "short", year: "numeric" }).format(parsed);
}

function referralStatus(value: unknown) {
  const status = String(value || "");
  const labels: Record<string, string> = {
    registered: "Lead registrado",
    trial: "Ativação / teste",
    payment_pending: "Aguardando pagamento",
    qualified: "Cliente pago",
    customer_active: "Cliente ativo",
    customer_cancelled: "Cancelado",
    rejected: "Não elegível",
    reversed: "Estornado",
  };
  return labels[status] || status || "—";
}

function commissionStatus(value: unknown) {
  const labels: Record<string, string> = {
    hold: "Carência",
    available: "Disponível",
    processing: "Saque solicitado",
    paid: "Pago",
    reversed: "Estornado",
    cancelled: "Cancelado",
  };
  return labels[String(value || "")] || String(value || "—");
}

async function accessToken() {
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token || "";
}

function Metric({ label, value, detail }: { label: string; value: string | number; detail: string }) {
  return (
    <article data-partner-card className="rounded-[1.35rem] border border-slate-200 bg-white p-4 shadow-[0_10px_28px_rgba(8,39,86,.045)]">
      <span className="text-[10px] font-extrabold uppercase tracking-[.12em] text-slate-400">{label}</span>
      <strong className="mt-2 block truncate text-2xl font-bold tracking-[-.04em] text-[#08295b]">{value}</strong>
      <small className="mt-1 block text-[11px] font-semibold leading-5 text-slate-400">{detail}</small>
    </article>
  );
}

function Empty({ title, detail }: { title: string; detail: string }) {
  return (
    <div className="grid min-h-40 place-items-center rounded-[1.25rem] border border-dashed border-slate-200 bg-slate-50/70 p-6 text-center">
      <div><span className="text-2xl">◇</span><strong className="mt-2 block text-sm text-slate-700">{title}</strong><p className="mt-1 text-xs leading-5 text-slate-400">{detail}</p></div>
    </div>
  );
}

export default function PartnerPortalV2() {
  const router = useRouter();
  const [core, setCore] = useState<CoreDashboard | null>(null);
  const [portal, setPortal] = useState<PortalV2 | null>(null);
  const [section, setSection] = useState<Section>("overview");
  const [period, setPeriod] = useState("30d");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [mobileMenu, setMobileMenu] = useState(false);
  const [pix, setPix] = useState({ pixKeyType: "CPF", pixKey: "", holderName: "", holderDocument: "" });
  const [aiResult, setAiResult] = useState("");

  const load = useCallback(async (selectedPeriod = period, q = "") => {
    const token = await accessToken();
    if (!token) {
      router.replace("/parceiros/login");
      return;
    }
    setLoading(true);
    setError("");
    const params = new URLSearchParams({ period: selectedPeriod });
    if (q.trim()) params.set("q", q.trim());
    const [coreResponse, portalResponse] = await Promise.all([
      fetch("/api/parceiros", { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" }),
      fetch(`/api/parceiros/portal-v2?${params.toString()}`, { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" }),
    ]);
    const [corePayload, portalPayload] = await Promise.all([
      coreResponse.json().catch(() => ({})),
      portalResponse.json().catch(() => ({})),
    ]);
    if ([401, 403].includes(coreResponse.status) || [401, 403].includes(portalResponse.status)) {
      await supabase.auth.signOut();
      router.replace("/parceiros/login");
      return;
    }
    if (!coreResponse.ok || !portalResponse.ok) {
      setError(corePayload.error || portalPayload.error || "Não foi possível carregar o portal.");
      setLoading(false);
      return;
    }
    setCore(corePayload as CoreDashboard);
    setPortal(portalPayload as PortalV2);
    setLoading(false);
  }, [period, router]);

  useEffect(() => { void load(period); }, [period, load]);

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setSearchOpen(true);
      }
      if (event.key === "Escape") setSearchOpen(false);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  useEffect(() => {
    if (!searchOpen) return;
    const timer = window.setTimeout(() => void load(period, search), 220);
    return () => window.clearTimeout(timer);
  }, [search, searchOpen, period, load]);

  async function postPortal(action: string, body: Record<string, unknown> = {}) {
    setBusy(action); setError(""); setNotice("");
    const token = await accessToken();
    const response = await fetch("/api/parceiros/portal-v2", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ action, ...body }),
    });
    const payload = await response.json().catch(() => ({}));
    setBusy("");
    if (!response.ok) { setError(payload.error || "Não foi possível concluir a ação."); return null; }
    setNotice(payload.message || "Ação concluída.");
    await load(period);
    return payload;
  }

  async function postCore(action: string, body: Record<string, unknown> = {}) {
    setBusy(action); setError(""); setNotice("");
    const token = await accessToken();
    const response = await fetch("/api/parceiros", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ action, ...body }),
    });
    const payload = await response.json().catch(() => ({}));
    setBusy("");
    if (!response.ok) { setError(payload.error || "Não foi possível concluir a ação."); return null; }
    setNotice(payload.message || "Ação concluída.");
    await load(period);
    return payload;
  }

  async function copy(value: string, message = "Copiado para a área de transferência.") {
    try { await navigator.clipboard.writeText(value); setNotice(message); } catch { setError("Não foi possível copiar automaticamente."); }
  }

  async function qr(link: string, name = "orcaly-parceiro") {
    try {
      const QRCode = (await import("qrcode")).default;
      const url = await QRCode.toDataURL(link, { width: 900, margin: 2, errorCorrectionLevel: "H" });
      const anchor = document.createElement("a"); anchor.href = url; anchor.download = `${name}.png`; anchor.click();
      setNotice("QR Code gerado.");
    } catch { setError("Não foi possível gerar o QR Code."); }
  }

  async function ai(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    setBusy("ai"); setAiResult(""); setError("");
    const token = await accessToken();
    const response = await fetch("/api/parceiros/ai", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify(Object.fromEntries(data.entries())),
    });
    const payload = await response.json().catch(() => ({}));
    setBusy("");
    if (!response.ok) { setError(payload.error || "IA indisponível."); return; }
    setAiResult(payload.answer || "");
  }

  async function logout() {
    await supabase.auth.signOut();
    router.replace("/parceiros/login");
  }

  const groups = useMemo(() => [...new Set(NAV.map((item) => item.group))], []);
  const maxChart = useMemo(() => Math.max(1, ...(portal?.timeline || []).map((row) => Math.max(row.clicks, row.referrals, row.customers))), [portal]);

  if (loading && !core) {
    return <main className="grid min-h-screen place-items-center bg-[#f3f6fb] text-[#071b3a]"><div className="text-center"><div className="mx-auto h-10 w-10 animate-spin rounded-full border-4 border-blue-100 border-t-[#08295b]"/><p className="mt-4 text-sm font-bold">Preparando seu cockpit comercial...</p></div></main>;
  }

  if (!core || !portal) {
    return <main className="grid min-h-screen place-items-center bg-[#f3f6fb] p-4"><div className="max-w-md rounded-3xl border border-red-100 bg-white p-7 text-center shadow-xl"><strong className="text-red-700">{error || "Portal indisponível."}</strong><button type="button" onClick={() => void load(period)} className="mt-5 rounded-xl bg-[#08295b] px-5 py-3 text-sm font-bold text-white">Tentar novamente</button></div></main>;
  }

  const activeNav = NAV.find((item) => item.id === section);
  const unread = portal.notifications.filter((item) => !item.read).length;

  return (
    <main data-partner-portal className="min-h-screen bg-[#f3f6fb] pb-20 text-[#10233f] lg:pb-0">
      <header className="sticky top-0 z-50 border-b border-slate-200/80 bg-white/94 backdrop-blur-xl">
        <div className="mx-auto flex h-[72px] max-w-[1600px] items-center gap-3 px-3 sm:px-5">
          <Link href="/parceiros" className="shrink-0"><Image src="/logo-orcaly.png" alt="Orçaly" width={150} height={44} priority className="h-9 w-auto"/></Link>
          <button type="button" onClick={() => setSearchOpen(true)} className="ml-auto hidden min-w-[260px] items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-left text-xs font-semibold text-slate-400 transition hover:border-blue-200 hover:bg-white md:flex"><span>Buscar lead, indicação, campanha...</span><kbd className="rounded-md border bg-white px-1.5 py-0.5 text-[9px]">Ctrl K</kbd></button>
          <button type="button" onClick={() => setSearchOpen(true)} className="ml-auto grid h-10 w-10 place-items-center rounded-xl border border-slate-200 bg-white md:hidden" aria-label="Buscar">⌕</button>
          <button type="button" onClick={() => setSection("wallet")} className="relative grid h-10 w-10 place-items-center rounded-xl border border-slate-200 bg-white" aria-label={`${unread} notificações pendentes`}>♢{unread ? <span className="absolute -right-1 -top-1 min-w-4 rounded-full bg-[#174e93] px-1 text-[9px] font-black text-white">{unread}</span> : null}</button>
          <div className="hidden min-w-0 text-right sm:block"><strong className="block truncate text-xs">{core.profile.name}</strong><span className="text-[10px] font-semibold text-slate-400">{core.profile.code} · {portal.profile.health.label}</span></div>
          <button type="button" onClick={() => void logout()} className="rounded-xl border border-slate-200 px-3 py-2.5 text-xs font-bold text-slate-500">Sair</button>
        </div>
      </header>

      <div className="mx-auto grid max-w-[1600px] gap-4 px-3 py-4 sm:px-5 lg:grid-cols-[245px_minmax(0,1fr)]">
        <aside className="hidden h-[calc(100vh-104px)] overflow-y-auto rounded-[1.45rem] border border-slate-200 bg-white p-2 shadow-[0_12px_35px_rgba(8,39,86,.05)] lg:sticky lg:top-[88px] lg:block">
          <div className="rounded-[1.15rem] bg-[#08295b] p-4 text-white">
            <span className="text-[9px] font-extrabold uppercase tracking-[.14em] text-blue-200">Programa Orçaly</span>
            <strong className="mt-2 block text-2xl font-bold">{money(core.stats.available)}</strong>
            <small className="text-[10px] font-semibold text-white/55">disponível · {core.program.commissionRate}% de comissão</small>
          </div>
          <nav className="mt-2 grid gap-3">
            {groups.map((group) => <div key={group}><span className="px-3 text-[9px] font-extrabold uppercase tracking-[.12em] text-slate-300">{group}</span><div className="mt-1 grid gap-0.5">{NAV.filter((item) => item.group === group).map((item) => <button key={item.id} type="button" onClick={() => setSection(item.id)} className={`flex items-center gap-2 rounded-xl px-3 py-2.5 text-left text-xs font-bold transition ${section === item.id ? "bg-blue-50 text-[#0b407c]" : "text-slate-500 hover:bg-slate-50 hover:text-slate-700"}`}><span className="grid h-7 w-7 place-items-center rounded-lg bg-current/5 text-[11px]">{item.icon}</span>{item.label}</button>)}</div></div>)}
          </nav>
        </aside>

        <section className="min-w-0">
          <div className="mb-3 flex items-center justify-between gap-3 lg:hidden"><div><span className="text-[9px] font-extrabold uppercase tracking-[.12em] text-slate-400">Portal de parceiros</span><h1 className="text-lg font-bold">{activeNav?.label}</h1></div><button type="button" onClick={() => setMobileMenu(true)} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold">Menu</button></div>
          {notice ? <div role="status" className="mb-3 rounded-xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-xs font-bold text-emerald-700">{notice}</div> : null}
          {error ? <div role="alert" className="mb-3 rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-xs font-bold text-red-700">{error}</div> : null}

          {section === "overview" ? (
            <div className="space-y-4">
              <section className="partner-fade-up relative overflow-hidden rounded-[1.6rem] bg-gradient-to-br from-[#061b3e] via-[#0a3470] to-[#0d518f] p-5 text-white shadow-xl sm:p-7">
                <div className="absolute -right-20 -top-24 h-64 w-64 rounded-full bg-cyan-300/15 blur-3xl"/>
                <div className="relative grid gap-5 xl:grid-cols-[1fr_330px] xl:items-end"><div><span className="text-[10px] font-extrabold uppercase tracking-[.16em] text-blue-200">Cockpit comercial</span><h1 className="mt-2 max-w-3xl text-3xl font-bold tracking-[-.045em] sm:text-4xl">{portal.attention.length ? `${portal.attention.length} ponto(s) merecem sua atenção.` : "Sua operação comercial está em dia."}</h1><p className="mt-3 max-w-2xl text-sm leading-6 text-white/65">Quanto ganhou, quanto converteu e qual ação vem agora. O link continua sendo seu, mas o portal finalmente virou uma ferramenta de venda.</p></div><div className="rounded-[1.25rem] border border-white/10 bg-white/8 p-4"><div className="flex justify-between"><span className="text-[10px] font-bold uppercase tracking-[.1em] text-white/50">Health score</span><strong>{portal.profile.health.score}/100</strong></div><div className="mt-3 h-2 overflow-hidden rounded-full bg-white/10"><div className="h-full rounded-full bg-cyan-300 transition-all duration-300" style={{ width: `${portal.profile.health.score}%` }}/></div><p className="mt-2 text-xs font-semibold text-white/55">{portal.profile.health.label} · indicador, nunca punição automática.</p></div></div>
                <div className="relative mt-5 flex flex-col gap-2 rounded-xl border border-white/10 bg-white/8 p-3 sm:flex-row sm:items-center"><code className="min-w-0 flex-1 break-all text-xs font-semibold text-blue-100">{core.profile.referralLink}</code><div className="flex gap-2"><button type="button" onClick={() => void copy(core.profile.referralLink, "Link principal copiado.")} className="rounded-lg bg-white px-3 py-2 text-xs font-bold text-[#08295b]">Copiar</button><button type="button" onClick={() => void qr(core.profile.referralLink)} className="rounded-lg border border-white/15 px-3 py-2 text-xs font-bold">QR</button></div></div>
              </section>

              <div className="grid grid-cols-2 gap-2.5 xl:grid-cols-6"><Metric label="Comissões" value={money(portal.kpis.commission)} detail="histórico visível"/><Metric label="Disponível" value={money(portal.kpis.available)} detail="pronto para saque"/><Metric label="Pendente" value={money(portal.kpis.pending)} detail="hold/processamento"/><Metric label="Clientes pagos" value={portal.kpis.paidCustomers} detail="conversões válidas"/><Metric label="Indicações" value={portal.kpis.leads} detail="atribuídas"/><Metric label="Conversão" value={`${portal.kpis.conversion}%`} detail={`${portal.kpis.clicks} cliques`}/></div>

              <div className="grid gap-4 xl:grid-cols-[1.08fr_.92fr]">
                <section className="rounded-[1.4rem] border border-slate-200 bg-white p-4 shadow-sm sm:p-5"><div className="flex items-end justify-between"><div><span className="text-[10px] font-extrabold uppercase tracking-[.12em] text-[#4776ad]">Funil</span><h2 className="mt-1 text-xl font-bold">Do clique à comissão</h2></div><select value={period} onChange={(event) => setPeriod(event.target.value)} className="rounded-lg border border-slate-200 px-2.5 py-2 text-xs font-bold"><option value="7d">7 dias</option><option value="30d">30 dias</option><option value="90d">90 dias</option><option value="365d">12 meses</option></select></div><div className="mt-4 grid gap-2 sm:grid-cols-5">{([['Cliques',portal.funnel.clicks],['Leads',portal.funnel.leads],['Cadastros',portal.funnel.signups],['Testes',portal.funnel.trials],['Pagos',portal.funnel.paid]] as Array<[string,number]>).map(([label,value], index) => <div key={label} className="rounded-xl bg-slate-50 p-3"><span className="text-[10px] font-bold text-slate-400">{index+1}. {label}</span><strong className="mt-1 block text-xl text-[#08295b]">{value}</strong></div>)}</div><div className="mt-5 flex h-28 items-end gap-1 overflow-hidden rounded-xl bg-slate-50 p-2" aria-label="Desempenho no período">{portal.timeline.map((row) => <div key={row.date} className="flex h-full min-w-1 flex-1 items-end gap-px" title={`${row.date}: ${row.clicks} cliques, ${row.referrals} leads, ${row.customers} pagos`}><span className="w-full rounded-t bg-blue-200" style={{ height: `${Math.max(3,(row.clicks/maxChart)*100)}%` }}/><span className="w-full rounded-t bg-blue-500" style={{ height: `${Math.max(2,(row.referrals/maxChart)*100)}%` }}/><span className="w-full rounded-t bg-emerald-500" style={{ height: `${Math.max(1,(row.customers/maxChart)*100)}%` }}/></div>)}</div><div className="mt-3 flex flex-wrap gap-4 text-[10px] font-bold text-slate-400"><span>EPC {money(portal.kpis.epc)}</span><span>Ticket {money(portal.kpis.avgTicket)}</span><span>Conversão média {portal.kpis.avgConversionDays} dia(s)</span><span>Receita gerada {money(portal.kpis.revenue)}</span></div></section>

                <section className="rounded-[1.4rem] border border-slate-200 bg-white p-4 shadow-sm sm:p-5"><span className="text-[10px] font-extrabold uppercase tracking-[.12em] text-amber-600">Precisa da sua atenção</span><h2 className="mt-1 text-xl font-bold">Próximas ações</h2><div className="mt-4 grid gap-2">{portal.attention.length ? portal.attention.map((item) => <button key={item.id} type="button" onClick={() => setSection(item.destination)} className="flex items-center gap-3 rounded-xl border border-slate-100 p-3 text-left transition hover:border-blue-200 hover:bg-blue-50/30"><span className={`grid h-9 w-9 place-items-center rounded-xl text-xs font-black ${item.priority==='high'?'bg-amber-50 text-amber-700':'bg-blue-50 text-blue-700'}`}>!</span><span className="min-w-0 flex-1"><strong className="block truncate text-xs text-slate-700">{item.title}</strong><small className="mt-0.5 block text-[10px] text-slate-400">{item.detail}</small></span><span>→</span></button>) : <Empty title="Nada crítico agora" detail="Novos follow-ups, indicações e eventos financeiros aparecerão aqui."/>}</div></section>
              </div>
            </div>
          ) : null}

          {section === "referrals" ? (
            <div className="space-y-4"><section className="rounded-[1.4rem] border border-slate-200 bg-white p-5"><span className="text-[10px] font-extrabold uppercase tracking-[.12em] text-[#4776ad]">Minhas indicações</span><h1 className="mt-1 text-2xl font-bold">Pipeline verificável de aquisição</h1><p className="mt-2 text-sm text-slate-500">Etapas como pagamento são derivadas do evento real. O parceiro acompanha, mas não consegue fabricar uma assinatura.</p></section><div className="grid gap-2.5">{core.referrals.length ? core.referrals.map((row) => <article key={row.id} className="rounded-[1.25rem] border border-slate-200 bg-white p-4 shadow-sm"><div className="flex flex-wrap items-start justify-between gap-3"><div><span className="rounded-full bg-blue-50 px-2.5 py-1 text-[10px] font-extrabold text-blue-700">{referralStatus(row.status)}</span><h3 className="mt-2 font-bold">{row.customer_name_masked || "Empresa indicada"}</h3><p className="mt-1 text-xs text-slate-400">{row.customer_email_masked || "Contato protegido"} · {row.plan || "plano a definir"}</p></div><div className="text-right"><strong className="text-[#174e93]">{money(row.commission_expected)}</strong><small className="mt-1 block text-[10px] text-slate-400">registrada {date(row.registered_at)}</small></div></div></article>) : <Empty title="Nenhuma indicação ainda" detail="Use seu link, uma campanha ou registre um prospect manualmente."/>}</div></div>
          ) : null}

          {section === "pipeline" ? (
            <div className="space-y-4"><section className="rounded-[1.4rem] border border-slate-200 bg-white p-5"><div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between"><div><span className="text-[10px] font-extrabold uppercase tracking-[.12em] text-[#4776ad]">Claim manual</span><h1 className="mt-1 text-2xl font-bold">Registre o prospect antes da conversa avançar</h1><p className="mt-2 max-w-2xl text-sm text-slate-500">O Orçaly verifica telefone/e-mail e a janela de atribuição antes de reservar. Se outro parceiro já possui um claim válido, a operação é recusada sem revelar quem é.</p></div></div><form onSubmit={(event) => { event.preventDefault(); const data=new FormData(event.currentTarget); void postPortal('register_referral',Object.fromEntries(data.entries())).then((result)=>{if(result) event.currentTarget.reset();}); }} className="mt-4 grid gap-2 md:grid-cols-2 xl:grid-cols-5"><input name="companyName" required placeholder="Empresa" className="h-11 rounded-xl border border-slate-200 px-3 text-sm"/><input name="contactName" required placeholder="Responsável" className="h-11 rounded-xl border border-slate-200 px-3 text-sm"/><input name="whatsapp" required inputMode="tel" placeholder="WhatsApp" className="h-11 rounded-xl border border-slate-200 px-3 text-sm"/><input name="email" type="email" placeholder="E-mail opcional" className="h-11 rounded-xl border border-slate-200 px-3 text-sm"/><select name="segment" className="h-11 rounded-xl border border-slate-200 px-3 text-sm font-bold">{SEGMENTS.map(([value,label])=><option key={value} value={value}>{label}</option>)}</select><textarea name="notes" placeholder="Observação" className="min-h-20 rounded-xl border border-slate-200 p-3 text-sm md:col-span-2 xl:col-span-4"/><button disabled={busy==='register_referral'} className="rounded-xl bg-[#08295b] px-4 py-3 text-sm font-bold text-white disabled:opacity-50">{busy==='register_referral'?'Registrando...':'+ Registrar indicação'}</button></form></section><PartnerGrowthHub partnerName={core.profile.name} referralLink={core.profile.referralLink} commissionRate={core.program.commissionRate}/></div>
          ) : null}

          {section === "campaigns" ? (
            <div className="space-y-4"><section className="rounded-[1.4rem] border border-slate-200 bg-white p-5"><span className="text-[10px] font-extrabold uppercase tracking-[.12em] text-[#4776ad]">Links inteligentes</span><h1 className="mt-1 text-2xl font-bold">Campanhas com atribuição e UTM</h1><form onSubmit={(event)=>{event.preventDefault();const form=event.currentTarget;const data=new FormData(form);void postPortal('create_campaign',Object.fromEntries(data.entries())).then((result)=>{if(result)form.reset();});}} className="mt-4 grid gap-2 md:grid-cols-2 xl:grid-cols-5"><input name="name" required placeholder="Ex.: Instagram Agosto" className="h-11 rounded-xl border border-slate-200 px-3 text-sm md:col-span-2"/><select name="channel" className="h-11 rounded-xl border border-slate-200 px-3 text-sm"><option value="instagram">Instagram</option><option value="whatsapp">WhatsApp</option><option value="qrcode">QR Code</option><option value="presencial">Presencial</option><option value="email">E-mail</option><option value="direct">Direto</option></select><select name="segment" className="h-11 rounded-xl border border-slate-200 px-3 text-sm"><option value="">Todos os segmentos</option>{SEGMENTS.map(([value,label])=><option key={value} value={value}>{label}</option>)}</select><button disabled={busy==='create_campaign'} className="rounded-xl bg-[#08295b] px-4 py-3 text-sm font-bold text-white">Criar campanha</button><input name="description" placeholder="Descrição opcional" className="h-11 rounded-xl border border-slate-200 px-3 text-sm md:col-span-2 xl:col-span-5"/></form></section><div className="grid gap-3 xl:grid-cols-2">{portal.campaigns.length ? portal.campaigns.map((campaign)=><article key={campaign.id} className="rounded-[1.35rem] border border-slate-200 bg-white p-4 shadow-sm"><div className="flex items-start justify-between gap-3"><div><span className="text-[9px] font-extrabold uppercase tracking-[.1em] text-[#4776ad]">{campaign.channel} · {campaign.code}</span><h3 className="mt-1 font-bold">{campaign.name}</h3><p className="mt-1 text-xs text-slate-400">{campaign.segment || 'Todos os segmentos'}</p></div><button type="button" onClick={()=>void postPortal('archive_campaign',{campaignId:campaign.id})} className="text-[10px] font-bold text-slate-400">Arquivar</button></div><div className="mt-4 grid grid-cols-3 gap-2 sm:grid-cols-6">{[['Cliques',campaign.clicks],['Leads',campaign.leads],['Pagos',campaign.customers],['Conv.',`${campaign.conversion}%`],['Receita',money(campaign.revenue)],['Comissão',money(campaign.commission)]].map(([label,value])=><div key={String(label)} className="rounded-lg bg-slate-50 p-2"><span className="text-[8px] font-bold uppercase text-slate-400">{label}</span><strong className="mt-1 block truncate text-xs">{value}</strong></div>)}</div><code className="mt-3 block break-all rounded-lg bg-slate-50 p-2 text-[10px] text-slate-500">{campaign.link}</code><div className="mt-3 flex gap-2"><button type="button" onClick={()=>void copy(campaign.link,'Link da campanha copiado.')} className="rounded-lg bg-[#08295b] px-3 py-2 text-[10px] font-bold text-white">Copiar link</button><button type="button" onClick={()=>void qr(campaign.link,`orcaly-${campaign.code}`)} className="rounded-lg border border-slate-200 px-3 py-2 text-[10px] font-bold">Baixar QR</button></div></article>) : <Empty title="Nenhuma campanha criada" detail="Crie links separados para saber de onde vêm cliques e clientes."/>}</div></div>
          ) : null}

          {section === "promotion" ? (
            <div className="space-y-4"><section className="rounded-[1.4rem] border border-slate-200 bg-white p-5"><span className="text-[10px] font-extrabold uppercase tracking-[.12em] text-[#4776ad]">Copiloto comercial</span><h1 className="mt-1 text-2xl font-bold">IA para vender, não para decorar o portal</h1><form onSubmit={ai} className="mt-4 grid gap-2 md:grid-cols-2 xl:grid-cols-5"><select name="mode" className="h-11 rounded-xl border border-slate-200 px-3 text-sm"><option value="message">Mensagem</option><option value="objection">Objeção</option><option value="followup">Follow-up</option><option value="post">Post / Story</option></select><select name="segment" className="h-11 rounded-xl border border-slate-200 px-3 text-sm">{SEGMENTS.map(([value,label])=><option key={value} value={value}>{label}</option>)}</select><select name="channel" className="h-11 rounded-xl border border-slate-200 px-3 text-sm"><option>WhatsApp</option><option>Instagram</option><option>E-mail</option><option>Presencial</option></select><input name="tone" placeholder="Tom: direto, consultivo..." className="h-11 rounded-xl border border-slate-200 px-3 text-sm"/><button disabled={busy==='ai'} className="rounded-xl bg-[#08295b] px-4 py-3 text-sm font-bold text-white">{busy==='ai'?'Gerando...':'Gerar sugestão'}</button><input name="name" placeholder="Nome do prospect (opcional)" className="h-11 rounded-xl border border-slate-200 px-3 text-sm md:col-span-2"/><input name="objective" placeholder="Objetivo" className="h-11 rounded-xl border border-slate-200 px-3 text-sm md:col-span-3"/><textarea name="objection" placeholder="Objeção do prospect" className="min-h-20 rounded-xl border border-slate-200 p-3 text-sm md:col-span-2"/><textarea name="context" placeholder="Contexto confirmado da conversa" className="min-h-20 rounded-xl border border-slate-200 p-3 text-sm md:col-span-3"/></form>{aiResult?<div className="mt-4 rounded-xl border border-blue-100 bg-blue-50/50 p-4"><div className="flex justify-between gap-2"><strong className="text-xs text-[#174e93]">Sugestão para revisão</strong><button type="button" onClick={()=>void copy(aiResult)} className="text-[10px] font-bold text-[#174e93]">Copiar</button></div><p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-600">{aiResult}</p></div>:null}</section><PartnerPromotionTab referralLink={core.profile.referralLink} partnerName={core.profile.name}/></div>
          ) : null}

          {section === "demos" ? (
            <div className="space-y-4"><section className="overflow-hidden rounded-[1.5rem] bg-[#08295b] p-5 text-white sm:p-7"><span className="text-[10px] font-extrabold uppercase tracking-[.14em] text-blue-200">Demonstrações</span><h1 className="mt-2 text-3xl font-bold tracking-[-.04em]">Mostre o produto sem expor dados reais.</h1><p className="mt-3 max-w-2xl text-sm leading-6 text-white/65">A demonstração existente continua sintética e somente leitura. Use campanhas para separar origem e depois registre o próximo contato no CRM.</p><Link href="/parceiros/demo" target="_blank" className="mt-5 inline-flex rounded-xl bg-white px-4 py-3 text-sm font-bold text-[#08295b]">Abrir demonstração segura ↗</Link></section><section className="rounded-[1.4rem] border border-slate-200 bg-white p-5"><h2 className="text-lg font-bold">Fluxo recomendado</h2><div className="mt-4 grid gap-2 sm:grid-cols-4">{['1. Crie uma campanha','2. Envie o link/QR','3. Faça a demonstração','4. Agende o follow-up'].map((item)=><div key={item} className="rounded-xl bg-slate-50 p-3 text-xs font-bold text-slate-600">{item}</div>)}</div></section></div>
          ) : null}

          {section === "academy" ? <PartnerAcademyV3 partnerName={core.profile.name}/> : null}

          {section === "wallet" ? (
            <div className="space-y-4"><section className="rounded-[1.5rem] bg-[#08295b] p-5 text-white sm:p-7"><span className="text-[10px] font-extrabold uppercase tracking-[.14em] text-blue-200">Carteira</span><div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4"><div><small className="text-white/50">Disponível</small><strong className="mt-1 block text-2xl">{money(core.stats.available)}</strong></div><div><small className="text-white/50">Pendente</small><strong className="mt-1 block text-2xl">{money(Number(core.stats.hold||0)+Number(core.stats.processing||0))}</strong></div><div><small className="text-white/50">Pago</small><strong className="mt-1 block text-2xl">{money(core.stats.paid)}</strong></div><div><small className="text-white/50">Histórico</small><strong className="mt-1 block text-2xl">{money(portal.kpis.commission)}</strong></div></div></section><div className="grid gap-4 xl:grid-cols-[.85fr_1.15fr]"><section className="rounded-[1.4rem] border border-slate-200 bg-white p-5"><h2 className="text-lg font-bold">Conta Pix</h2>{core.payoutAccount?<div className="mt-3 rounded-xl bg-slate-50 p-4 text-sm"><strong>{core.payoutAccount.pixKeyMasked}</strong><p className="mt-1 text-xs text-slate-400">{core.payoutAccount.pixKeyType} · {core.payoutAccount.holderName}</p><span className={`mt-2 inline-block rounded-full px-2 py-1 text-[9px] font-bold ${core.payoutAccount.isVerified?'bg-emerald-50 text-emerald-700':'bg-amber-50 text-amber-700'}`}>{core.payoutAccount.isVerified?'Verificada':'Em verificação'}</span></div>:null}<form onSubmit={(event)=>{event.preventDefault();void postCore('save_payout_account',pix);}} className="mt-4 grid gap-2"><select value={pix.pixKeyType} onChange={(e)=>setPix({...pix,pixKeyType:e.target.value})} className="h-11 rounded-xl border border-slate-200 px-3 text-sm"><option>CPF</option><option>CNPJ</option><option>EMAIL</option><option>PHONE</option><option>EVP</option></select><input value={pix.pixKey} onChange={(e)=>setPix({...pix,pixKey:e.target.value})} placeholder="Chave Pix" className="h-11 rounded-xl border border-slate-200 px-3 text-sm"/><input value={pix.holderName} onChange={(e)=>setPix({...pix,holderName:e.target.value})} placeholder="Nome do titular" className="h-11 rounded-xl border border-slate-200 px-3 text-sm"/><input value={pix.holderDocument} onChange={(e)=>setPix({...pix,holderDocument:e.target.value})} placeholder="CPF/CNPJ do titular" className="h-11 rounded-xl border border-slate-200 px-3 text-sm"/><button disabled={busy==='save_payout_account'} className="rounded-xl border border-slate-200 px-4 py-3 text-sm font-bold">Salvar / validar Pix</button></form><button type="button" disabled={busy==='request_payout'||core.stats.available<core.program.minimumPayout||!core.program.payoutsEnabled} onClick={()=>void postCore('request_payout')} className="mt-3 w-full rounded-xl bg-[#08295b] px-4 py-3 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-40">Solicitar saque · mínimo {money(core.program.minimumPayout)}</button></section><section className="rounded-[1.4rem] border border-slate-200 bg-white p-5"><h2 className="text-lg font-bold">Extrato de comissões</h2><div className="mt-3 grid max-h-[580px] gap-2 overflow-y-auto">{core.commissions.length?core.commissions.map((row)=><div key={row.id} className="rounded-xl border border-slate-100 p-3"><div className="flex justify-between gap-3"><div><strong className="text-sm">{row.plan||'Plano Orçaly'}</strong><p className="mt-1 text-[10px] text-slate-400">{commissionStatus(row.status)} · {date(row.created_at)}</p></div><strong className={row.status==='reversed'?'text-red-600':'text-[#174e93]'}>{money(row.commission_amount)}</strong></div>{row.reversal_reason?<p className="mt-2 text-[10px] text-red-500">{row.reversal_reason}</p>:null}</div>):<Empty title="Sem comissões ainda" detail="Comissões válidas aparecerão após o pagamento elegível e a carência."/>}</div></section></div><section className="rounded-[1.4rem] border border-slate-200 bg-white p-5"><h2 className="text-lg font-bold">Saques</h2><div className="mt-3 grid gap-2 sm:grid-cols-2">{core.payouts.map((row)=><div key={row.id} className="rounded-xl bg-slate-50 p-3"><div className="flex justify-between"><strong>{money(row.amount)}</strong><span className="text-[10px] font-bold text-slate-500">{row.status}</span></div><p className="mt-1 text-[10px] text-slate-400">Solicitado {date(row.requested_at)}</p>{row.failure_reason?<p className="mt-2 text-[10px] text-red-500">{row.failure_reason}</p>:null}{row.proof_url?<a href={row.proof_url} target="_blank" rel="noreferrer" className="mt-2 block text-[10px] font-bold text-[#174e93]">Abrir comprovante ↗</a>:null}</div>)}</div></section></div>
          ) : null}

          {section === "ranking" ? (
            <div className="space-y-4"><section className="rounded-[1.4rem] border border-slate-200 bg-white p-5"><span className="text-[10px] font-extrabold uppercase tracking-[.12em] text-[#4776ad]">Ranking</span><h1 className="mt-1 text-2xl font-bold">Performance difícil de manipular</h1><p className="mt-2 text-sm text-slate-500">A classificação existente privilegia clientes pagos válidos e maturidade da indicação. Saldo, e-mail e telefone de outros parceiros não aparecem.</p></section><div className="grid gap-2">{core.ranking.top.map((row)=><article key={row.id} className={`flex items-center gap-4 rounded-xl border p-4 ${row.id===core.profile.id?'border-blue-200 bg-blue-50/50':'border-slate-200 bg-white'}`}><span className="grid h-10 w-10 place-items-center rounded-xl bg-[#08295b] text-sm font-black text-white">#{row.position}</span><div className="min-w-0 flex-1"><strong className="truncate text-sm">{row.name}</strong><p className="mt-1 text-[10px] text-slate-400">{row.conversions} cliente(s) pago(s)</p></div><strong className="text-sm text-[#174e93]">{row.score} pts</strong></article>)}</div></div>
          ) : null}

          {section === "support" ? <div className="grid gap-4 md:grid-cols-2"><section className="rounded-[1.4rem] border border-slate-200 bg-white p-5"><span className="text-[10px] font-extrabold uppercase tracking-[.12em] text-[#4776ad]">Suporte</span><h1 className="mt-1 text-2xl font-bold">Venda com regra clara</h1><p className="mt-3 text-sm leading-6 text-slate-500">Consulte primeiro as regras do programa. Atribuição, carência, estorno e saque ficam explícitos para reduzir disputa e promessa errada.</p><Link href="/parceiros/termos" className="mt-4 inline-flex rounded-xl bg-[#08295b] px-4 py-3 text-sm font-bold text-white">Regras do programa</Link></section><section className="rounded-[1.4rem] border border-slate-200 bg-white p-5"><h2 className="text-lg font-bold">Dados do programa</h2><div className="mt-3 grid gap-2 text-sm"><p>Janela de atribuição: <strong>{portal.program.attributionDays} dias</strong></p><p>Carência de comissão: <strong>{portal.program.holdDays} dias</strong></p><p>Saque mínimo: <strong>{money(portal.program.minimumPayout)}</strong></p><p>Comissão atual: <strong>{portal.program.commissionRate}%</strong></p></div></section></div> : null}

          {section === "profile" ? <div className="grid gap-4 xl:grid-cols-2"><section className="rounded-[1.4rem] border border-slate-200 bg-white p-5"><span className="text-[10px] font-extrabold uppercase tracking-[.12em] text-[#4776ad]">Perfil</span><h1 className="mt-1 text-2xl font-bold">{core.profile.name}</h1><div className="mt-4 grid gap-2 text-sm text-slate-500"><p>Código: <strong className="text-slate-700">{core.profile.code}</strong></p><p>E-mail: <strong className="text-slate-700">{core.profile.email||'Conta autenticada'}</strong></p><p>Health score: <strong className="text-slate-700">{portal.profile.health.score}/100 · {portal.profile.health.label}</strong></p></div></section><ChangePasswordCard/></div> : null}
        </section>
      </div>

      <nav className="fixed inset-x-2 bottom-2 z-50 grid grid-cols-5 rounded-[1.25rem] border border-slate-200 bg-white/96 p-1.5 shadow-2xl backdrop-blur-xl lg:hidden" aria-label="Navegação rápida do Portal de Parceiros"><button type="button" onClick={()=>setSection('overview')} className={`rounded-xl py-2 text-[10px] font-bold ${section==='overview'?'bg-blue-50 text-[#174e93]':'text-slate-500'}`}>Hoje</button><button type="button" onClick={()=>setSection('pipeline')} className={`rounded-xl py-2 text-[10px] font-bold ${section==='pipeline'?'bg-blue-50 text-[#174e93]':'text-slate-500'}`}>Pipeline</button><button type="button" onClick={()=>setSection('campaigns')} className="mx-auto grid h-10 w-10 place-items-center rounded-xl bg-[#08295b] text-lg font-light text-white">+</button><button type="button" onClick={()=>setSection('wallet')} className={`rounded-xl py-2 text-[10px] font-bold ${section==='wallet'?'bg-blue-50 text-[#174e93]':'text-slate-500'}`}>Saldo</button><button type="button" onClick={()=>setMobileMenu(true)} className="rounded-xl py-2 text-[10px] font-bold text-slate-500">Mais</button></nav>

      {mobileMenu ? <div className="fixed inset-0 z-[70] bg-slate-950/35 p-3 backdrop-blur-sm lg:hidden" onClick={()=>setMobileMenu(false)}><div role="dialog" aria-modal="true" aria-label="Menu do Portal de Parceiros" onClick={(event)=>event.stopPropagation()} className="absolute inset-x-3 bottom-3 max-h-[82vh] overflow-y-auto rounded-[1.5rem] bg-white p-3 shadow-2xl"><div className="mb-2 flex items-center justify-between p-2"><strong>Portal de Parceiros</strong><button onClick={()=>setMobileMenu(false)} className="rounded-lg bg-slate-100 px-3 py-2 text-xs font-bold">Fechar</button></div><div className="grid grid-cols-2 gap-2">{NAV.map((item)=><button key={item.id} type="button" onClick={()=>{setSection(item.id);setMobileMenu(false);}} className={`rounded-xl border p-3 text-left text-xs font-bold ${section===item.id?'border-blue-200 bg-blue-50 text-[#174e93]':'border-slate-100 text-slate-600'}`}><span className="mr-2">{item.icon}</span>{item.label}</button>)}</div></div></div> : null}

      {searchOpen ? <div className="fixed inset-0 z-[80] bg-slate-950/35 p-3 pt-[8vh] backdrop-blur-sm" onClick={()=>setSearchOpen(false)}><div role="dialog" aria-modal="true" aria-label="Busca no Portal de Parceiros" onClick={(event)=>event.stopPropagation()} className="mx-auto max-w-2xl rounded-[1.4rem] border border-slate-200 bg-white p-3 shadow-2xl"><input autoFocus value={search} onChange={(e)=>setSearch(e.target.value)} placeholder="Buscar lead, indicação ou campanha..." className="h-12 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm font-semibold outline-none focus:border-blue-300"/><div className="mt-2 grid max-h-[55vh] gap-1 overflow-y-auto">{portal.searchResults.length?portal.searchResults.map((result)=><button key={`${result.type}-${result.id}`} type="button" onClick={()=>{setSection(result.destination);setSearchOpen(false);setSearch('');}} className="rounded-xl p-3 text-left hover:bg-slate-50"><strong className="block text-sm text-slate-700">{result.title}</strong><small className="mt-1 block text-[10px] text-slate-400">{result.type} · {result.subtitle}</small></button>):<p className="p-4 text-center text-xs text-slate-400">{search.trim()?'Nenhum resultado encontrado.':'Digite para buscar.'}</p>}</div></div></div> : null}
    </main>
  );
}
