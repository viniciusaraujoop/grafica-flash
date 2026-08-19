'use client'

import { useEffect, useState } from 'react'
import { getAccessTokenClient } from '@/lib/current-company-client'

type Payload = {
  periodDays: number
  generatedAt: string
  metrics: {
    revenue: number
    averageTicket: number
    orders: number
    paidOrders: number
    proposalConversion: number
    proposals: number
    approvedProposals: number
    leads: number
    closedLeads: number
    recurringCustomers: number
    avgCompletionHours: number | null
  }
  topProducts: Array<{ name: string; orders: number; value: number }>
  partial?: boolean
}

function money(value: number) {
  return Number(value || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function duration(hours: number | null) {
  if (hours === null) return 'Sem dados'
  if (hours < 24) return `${hours.toFixed(1)}h`
  return `${(hours / 24).toFixed(1)} dias`
}

export default function RelatoriosPage() {
  const [days, setDays] = useState(30)
  const [data, setData] = useState<Payload | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  async function load(period = days) {
    setLoading(true); setError('')
    try {
      const token = await getAccessTokenClient()
      const response = await fetch(`/api/reports/decision?days=${period}`, { headers: { Authorization: `Bearer ${token}` }, cache: 'no-store' })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(payload.error || 'Erro ao gerar relatório.')
      setData(payload)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao gerar relatório.')
    } finally { setLoading(false) }
  }

  useEffect(() => { void load(days) }, [days])

  const metrics = data?.metrics
  const cards = metrics ? [
    ['Vendas confirmadas', money(metrics.revenue), `${metrics.paidOrders} pedido(s) pago(s)`],
    ['Ticket médio', money(metrics.averageTicket), 'Pedidos pagos no período'],
    ['Pedidos', String(metrics.orders), 'Volume recebido'],
    ['Conversão de propostas', `${metrics.proposalConversion.toFixed(1)}%`, `${metrics.approvedProposals}/${metrics.proposals} aprovadas`],
    ['Leads', String(metrics.leads), `${metrics.closedLeads} fechado(s)`],
    ['Clientes recorrentes', String(metrics.recurringCustomers), 'Compraram mais de uma vez'],
    ['Tempo médio de conclusão', duration(metrics.avgCompletionHours), 'Com base no histórico de status'],
  ] : []

  return (
    <main className="grid gap-4 text-[#10233f]">
      <section className="rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-[0_12px_36px_rgba(10,40,82,.055)] sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div><span className="text-[11px] font-extrabold uppercase tracking-[.16em] text-[#4776ad]">Relatórios</span><h2 className="mt-1 text-2xl font-bold tracking-[-.04em] sm:text-3xl">Números que ajudam a decidir.</h2><p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500">Sem gráfico ornamental: vendas, conversão, recorrência, produtos e velocidade de execução a partir dos dados reais da empresa.</p></div>
          <div className="grid grid-cols-3 rounded-xl bg-slate-100 p-1" aria-label="Período do relatório">{[7, 30, 90].map((period) => <button key={period} type="button" onClick={() => setDays(period)} aria-pressed={days === period} className={`rounded-lg px-3 py-2 text-xs font-extrabold ${days === period ? 'bg-white text-[#0b3b78] shadow-sm' : 'text-slate-500'}`}>{period} dias</button>)}</div>
        </div>
      </section>

      {error ? <div role="alert" className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm font-bold text-red-700">{error}</div> : null}
      {data?.partial ? <div className="rounded-xl border border-amber-100 bg-amber-50 px-4 py-3 text-xs font-bold text-amber-700">Uma fonte complementar não respondeu. Os indicadores exibidos usam somente dados confirmados.</div> : null}

      {loading ? <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{Array.from({ length: 7 }).map((_, index) => <div key={index} className="h-28 animate-pulse rounded-[1.2rem] bg-slate-100" />)}</div> : metrics ? (
        <>
          <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {cards.map(([label, value, detail], index) => <article key={label} className="rounded-[1.2rem] border border-slate-200 bg-white p-4 shadow-[0_8px_24px_rgba(10,40,82,.045)] motion-safe:animate-[orcaly-report-in_180ms_ease-out_both]" style={{ animationDelay: `${index * 25}ms` }}><span className="text-[10px] font-extrabold uppercase tracking-[.1em] text-slate-400">{label}</span><strong className="mt-1.5 block truncate text-2xl font-bold tracking-[-.035em] text-[#10233f]">{value}</strong><small className="mt-1 block text-[11px] font-semibold text-slate-400">{detail}</small></article>)}
          </section>

          <section className="rounded-[1.4rem] border border-slate-200 bg-white p-5 shadow-[0_10px_30px_rgba(10,40,82,.05)]">
            <div><span className="text-[10px] font-extrabold uppercase tracking-[.14em] text-[#4776ad]">Produtos/serviços</span><h3 className="mt-1 text-lg font-bold tracking-[-.03em]">O que mais movimentou pedidos</h3></div>
            <div className="mt-4 grid gap-2">{data.topProducts.map((product, index) => <div key={`${product.name}-${index}`} className="grid grid-cols-[32px_minmax(0,1fr)_auto] items-center gap-3 rounded-xl bg-slate-50 px-3 py-2.5"><span className="grid h-8 w-8 place-items-center rounded-lg bg-white text-xs font-black text-[#174e93] ring-1 ring-slate-200">{index + 1}</span><span className="min-w-0"><strong className="block truncate text-sm text-slate-700">{product.name}</strong><small className="text-[10px] font-semibold text-slate-400">{product.orders} pedido(s)</small></span><strong className="text-xs text-slate-600">{money(product.value)}</strong></div>)}{!data.topProducts.length ? <p className="rounded-xl border border-dashed border-slate-200 p-6 text-center text-sm font-semibold text-slate-400">Ainda não há volume suficiente neste período.</p> : null}</div>
          </section>
        </>
      ) : null}
      <style jsx global>{`@keyframes orcaly-report-in { from { opacity:0; transform:translateY(4px) } to { opacity:1; transform:none } } @media (prefers-reduced-motion: reduce) { [class*='orcaly-report-in'] { animation:none !important } }`}</style>
    </main>
  )
}
