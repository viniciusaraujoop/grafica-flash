'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'

type Alert = { id: string; severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'INFO'; title: string; context: string; entity: string; date: string | null; href: string }
type Payload = {
  generatedAt: string
  admin: { nome: string; email: string; role: string; area: string }
  quality: { companiesCapped: boolean; paymentsCapped: boolean; mrrCoverage: number; churn: { value: null; reason: string }; tickets: { value: null; reason: string } }
  metrics: Record<string, number>
  alerts: Alert[]
  recentAudit: Array<{ id: string; admin_email: string; action: string; target_label?: string | null; created_at?: string | null }>
}

function money(value: unknown) { return Number(value || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) }
function dateTime(value: unknown) { if (!value) return 'Sem data'; const parsed = new Date(String(value)); return Number.isNaN(parsed.getTime()) ? 'Sem data' : new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(parsed) }
function severityClass(value: string) { if (value === 'CRITICAL') return 'bg-red-50 text-red-700 ring-red-100'; if (value === 'HIGH') return 'bg-orange-50 text-orange-700 ring-orange-100'; if (value === 'MEDIUM') return 'bg-amber-50 text-amber-700 ring-amber-100'; return 'bg-blue-50 text-blue-700 ring-blue-100' }

function Metric({ label, value, detail, unavailable }: { label: string; value: string; detail: string; unavailable?: boolean }) {
  return <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-[0_8px_24px_rgba(15,23,42,.035)]"><div className="flex items-start justify-between gap-2"><span className="text-[10px] font-semibold uppercase tracking-[.1em] text-slate-400">{label}</span>{unavailable ? <span className="rounded-md bg-slate-100 px-2 py-1 text-[9px] font-semibold text-slate-500">indisponível</span> : null}</div><strong className={`mt-3 block text-2xl font-semibold tracking-[-.035em] ${unavailable ? 'text-slate-300' : 'text-[#0b2e63]'}`}>{value}</strong><small className="mt-1.5 block min-h-8 text-[11px] leading-4 text-slate-400">{detail}</small></article>
}

export default function AdminControlCenterV2() {
  const [data, setData] = useState<Payload | null>(null)
  const [error, setError] = useState('')
  const [refresh, setRefresh] = useState(0)

  useEffect(() => {
    let active = true
    void supabase.auth.getSession().then(async ({ data: auth }) => {
      const token = auth.session?.access_token || ''
      const response = await fetch('/api/admin/control-center-v2', { headers: { Authorization: `Bearer ${token}` }, cache: 'no-store' })
      const payload = await response.json().catch(() => ({}))
      if (!active) return
      if (!response.ok) { setError(payload.error || 'Não foi possível carregar o Control Center.'); return }
      setData(payload as Payload); setError('')
    })
    return () => { active = false }
  }, [refresh])

  const attention = useMemo(() => data?.alerts || [], [data])
  if (!data && !error) return <div className="space-y-4"><div className="h-52 animate-pulse rounded-3xl bg-slate-200 motion-reduce:animate-none"/><div className="grid grid-cols-2 gap-3 xl:grid-cols-5">{Array.from({ length: 10 }).map((_, index) => <div key={index} className="h-32 animate-pulse rounded-2xl bg-white motion-reduce:animate-none"/>)}</div></div>
  if (!data) return <section className="rounded-2xl border border-red-100 bg-white p-8 text-center"><strong className="text-red-700">{error}</strong><button type="button" onClick={() => setRefresh((v) => v + 1)} className="mt-4 block w-full rounded-xl bg-[#0b2e63] px-4 py-3 text-sm font-semibold text-white">Tentar novamente</button></section>

  const m = data.metrics
  return <div className="space-y-5">
    <section className="relative overflow-hidden rounded-3xl border border-[#0b2e63]/10 bg-gradient-to-br from-[#071d42] via-[#0b2e63] to-[#0a4d83] p-5 text-white shadow-[0_16px_50px_rgba(7,29,66,.16)] sm:p-7">
      <div className="pointer-events-none absolute -right-24 -top-28 h-72 w-72 rounded-full bg-cyan-300/15 blur-3xl"/><div className="relative flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between"><div><p className="text-[10px] font-semibold uppercase tracking-[.15em] text-blue-200">Control Center</p><h1 className="mt-2 max-w-4xl text-3xl font-semibold tracking-[-.045em] sm:text-4xl">Como está o Orçaly agora, o que mudou e onde agir.</h1><p className="mt-3 max-w-3xl text-sm leading-6 text-white/65">Métricas financeiras vêm de pagamentos observados. Alertas têm entidade e caminho de resolução. Dados não confiáveis aparecem como indisponíveis, não como números decorativos.</p></div><div className="flex flex-wrap gap-2"><button type="button" onClick={() => setRefresh((v) => v + 1)} className="rounded-xl bg-white px-4 py-3 text-xs font-semibold text-[#0b2e63]">Atualizar</button><span className="rounded-xl border border-white/15 bg-white/10 px-4 py-3 text-xs text-white/70">Atualizado {dateTime(data.generatedAt)}</span></div></div>
    </section>

    {error ? <div className="rounded-xl border border-amber-100 bg-amber-50 p-3 text-xs font-semibold text-amber-700">{error}</div> : null}

    <section className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
      <Metric label="MRR observado" value={money(m.mrr)} detail={`${data.quality.mrrCoverage}% dos pagantes com pagamento-base observado`} />
      <Metric label="ARR" value={money(m.arr)} detail="MRR observado × 12" />
      <Metric label="Empresas pagantes" value={String(m.payingCompanies)} detail={`${m.trials || 0} trials ativos`} />
      <Metric label="Novas empresas" value={String(m.newCompanies)} detail="cadastros no mês atual" />
      <Metric label="Churn" value="—" detail={data.quality.churn.reason} unavailable />
      <Metric label="Receita do mês" value={money(m.revenueMonth)} detail={`mês anterior: ${money(m.revenuePrevious)}`} />
      <Metric label="Pagamentos pendentes" value={String(m.paymentPending)} detail="registros recentes no período consultado" />
      <Metric label="Pagamentos falhos" value={String(m.paymentFailed)} detail="falhas/rejeições observadas" />
      <Metric label="Parceiros ativos" value={String(m.partnersActive)} detail={`${m.referrals || 0} indicações na janela carregada`} />
      <Metric label="Comissões pendentes" value={money(m.commissionsPending)} detail="hold + disponível + processamento" />
    </section>

    <section className="grid gap-5 xl:grid-cols-[minmax(0,1.45fr)_minmax(300px,.55fr)]">
      <div className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5"><div className="flex items-center justify-between gap-3"><div><p className="text-[10px] font-semibold uppercase tracking-[.12em] text-slate-400">Precisa da sua atenção</p><h2 className="mt-1 text-xl font-semibold tracking-[-.03em]">Problemas com contexto e próxima ação</h2></div><span className="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-500">{attention.length}</span></div><div className="mt-4 space-y-2">{attention.map((alert) => <Link href={alert.href} key={alert.id} className="group flex flex-col gap-3 rounded-xl border border-slate-100 p-3 transition hover:border-slate-200 hover:bg-slate-50 motion-reduce:transition-none sm:flex-row sm:items-center"><span className={`w-fit rounded-lg px-2 py-1 text-[9px] font-bold ring-1 ${severityClass(alert.severity)}`}>{alert.severity}</span><span className="min-w-0 flex-1"><strong className="block truncate text-sm font-semibold">{alert.title}</strong><small className="mt-0.5 block truncate text-xs text-slate-400">{alert.entity} · {alert.context}</small></span><span className="shrink-0 text-[10px] text-slate-400">{dateTime(alert.date)} <b className="ml-1 text-[#0b2e63]">Abrir ›</b></span></Link>)}{attention.length === 0 ? <div className="rounded-xl border border-dashed border-slate-200 p-8 text-center"><strong className="text-sm font-semibold">Nenhum alerta operacional nas fontes consultadas.</strong><p className="mt-1 text-xs text-slate-400">Isso não é equivalente a “todos os serviços estão saudáveis”.</p></div> : null}</div></div>
      <aside className="space-y-5"><section className="rounded-2xl border border-slate-200 bg-white p-5"><p className="text-[10px] font-semibold uppercase tracking-[.12em] text-slate-400">Leitura rápida</p><div className="mt-4 grid gap-3"><div className="flex items-center justify-between"><span className="text-sm text-slate-500">Empresas totais</span><strong>{m.companiesTotal}</strong></div><div className="flex items-center justify-between"><span className="text-sm text-slate-500">Em atraso</span><strong className="text-red-600">{m.overdue}</strong></div><div className="flex items-center justify-between"><span className="text-sm text-slate-500">Cancelando</span><strong className="text-amber-600">{m.canceling}</strong></div><div className="flex items-center justify-between"><span className="text-sm text-slate-500">Alertas críticos</span><strong className="text-red-600">{m.criticalAlerts}</strong></div><div className="flex items-center justify-between"><span className="text-sm text-slate-500">Alertas altos</span><strong className="text-orange-600">{m.highAlerts}</strong></div></div></section><section className="rounded-2xl border border-slate-200 bg-white p-5"><p className="text-[10px] font-semibold uppercase tracking-[.12em] text-slate-400">Auditoria recente</p><div className="mt-3 space-y-2">{data.recentAudit.slice(0, 6).map((row) => <div key={row.id} className="rounded-xl bg-slate-50 p-3"><strong className="block truncate text-xs">{row.action}</strong><span className="mt-1 block truncate text-[10px] text-slate-400">{row.target_label || 'Plataforma'} · {dateTime(row.created_at)}</span></div>)}</div><Link href="/admin/auditoria" className="mt-3 inline-flex text-xs font-semibold text-[#0b2e63]">Abrir auditoria completa ›</Link></section></aside>
    </section>
  </div>
}
