'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { getAccessTokenClient } from '@/lib/current-company-client'
import { orderStageForStatus, orderWorkflowFor } from '@/lib/operations-experience'

type Order = {
  id: string
  nome?: string | null
  customer_name?: string | null
  produto?: string | null
  status?: string | null
  prazo_entrega?: string | null
  prioridade?: string | null
  responsavel_nome?: string | null
  total?: number | null
  total_amount?: number | null
  valor_total?: number | null
  preco_estimado?: number | null
  next_action?: { titulo?: string | null; due_at?: string | null } | null
}

type QueueKind = 'production' | 'diagnosis' | 'maintenance'

const queueCopy: Record<QueueKind, { eyebrow: string; title: string; description: string }> = {
  production: { eyebrow: 'Operação', title: 'Fila de produção', description: 'Pedidos aprovados que precisam avançar até ficarem prontos.' },
  diagnosis: { eyebrow: 'Assistência técnica', title: 'Diagnóstico', description: 'Equipamentos recebidos ou em análise antes da aprovação do cliente.' },
  maintenance: { eyebrow: 'Assistência técnica', title: 'Manutenção', description: 'Serviços aprovados em reparo, testes ou preparação para entrega.' },
}

function money(value: unknown) {
  return Number(value || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function value(order: Order) {
  return Number(order.total_amount || order.total || order.valor_total || order.preco_estimado || 0)
}

function date(value?: string | null) {
  if (!value) return 'Sem prazo'
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return 'Sem prazo'
  return new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }).format(parsed)
}

export default function SegmentOperationQueue({ kind }: { kind: QueueKind }) {
  const [orders, setOrders] = useState<Order[]>([])
  const [businessType, setBusinessType] = useState('services')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  async function load() {
    setLoading(true); setError('')
    try {
      const token = await getAccessTokenClient()
      const response = await fetch('/api/orders?limit=80&sort=deadline', { headers: { Authorization: `Bearer ${token}` }, cache: 'no-store' })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(payload.error || 'Erro ao carregar operação.')
      setOrders(payload.orders || [])
      setBusinessType(payload.company?.business_type || 'services')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar operação.')
    } finally { setLoading(false) }
  }

  useEffect(() => { void load() }, [])

  const visible = useMemo(() => {
    const workflow = orderWorkflowFor(businessType)
    const stageIndex = new Map(workflow.map((stage, index) => [stage.id, index]))
    return orders.filter((order) => {
      const stage = orderStageForStatus(order.status, businessType)
      const index = stageIndex.get(stage.id) ?? 0
      if (stage.terminal) return false
      if (kind === 'diagnosis') return ['received', 'diagnosis', 'analysis'].includes(stage.id)
      if (kind === 'maintenance') return ['approval', 'repair', 'tests', 'ready'].includes(stage.id)
      return index >= Math.max(1, Math.floor(workflow.length / 2) - 1)
    })
  }, [orders, businessType, kind])

  const copy = queueCopy[kind]

  return (
    <main className="grid gap-4 text-[#10233f]">
      <section className="rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-[0_12px_36px_rgba(10,40,82,.055)] sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"><div><span className="text-[11px] font-extrabold uppercase tracking-[.16em] text-[#4776ad]">{copy.eyebrow}</span><h2 className="mt-1 text-2xl font-bold tracking-[-.04em] sm:text-3xl">{copy.title}</h2><p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500">{copy.description}</p></div><Link href="/painel/pedidos" className="rounded-xl bg-[#0b3b78] px-4 py-2.5 text-center text-xs font-bold text-white">Abrir Pedidos 2.0</Link></div>
      </section>

      {error ? <div role="alert" className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm font-bold text-red-700">{error}</div> : null}
      {loading ? <div className="grid gap-2.5 md:grid-cols-2 xl:grid-cols-3">{Array.from({ length: 6 }).map((_, index) => <div key={index} className="h-40 animate-pulse rounded-[1.2rem] bg-slate-100" />)}</div> : (
        <section className="grid gap-2.5 md:grid-cols-2 xl:grid-cols-3">
          {visible.map((order) => {
            const stage = orderStageForStatus(order.status, businessType)
            return <Link key={order.id} href={`/painel/pedidos/${order.id}`} className="rounded-[1.2rem] border border-slate-200 bg-white p-4 shadow-[0_8px_24px_rgba(10,40,82,.045)] transition duration-200 hover:-translate-y-px hover:border-blue-200 hover:shadow-md"><div className="flex items-start justify-between gap-2"><span className="rounded-full bg-blue-50 px-2.5 py-1 text-[10px] font-extrabold text-blue-700">{stage.label}</span><span className="text-[10px] font-bold text-slate-400">{date(order.prazo_entrega)}</span></div><h3 className="mt-3 truncate text-sm font-extrabold text-slate-800">{order.nome || order.customer_name || 'Cliente'}</h3><p className="mt-1 truncate text-xs font-medium text-slate-500">{order.produto || 'Pedido'}</p><div className="mt-3 flex items-center justify-between gap-2"><strong className="text-sm text-[#174e93]">{money(value(order))}</strong><span className="text-[10px] font-bold text-slate-400">{order.responsavel_nome || 'Não atribuído'}</span></div>{order.next_action?.titulo ? <div className="mt-2 rounded-lg bg-slate-50 px-2.5 py-2 text-[10px] font-semibold text-slate-500">Próxima: <strong className="text-slate-700">{order.next_action.titulo}</strong></div> : null}</Link>
          })}
          {!visible.length ? <div className="grid min-h-48 place-items-center rounded-[1.2rem] border border-dashed border-slate-200 bg-white p-6 text-center md:col-span-2 xl:col-span-3"><div><span className="mx-auto grid h-11 w-11 place-items-center rounded-xl bg-emerald-50 font-black text-emerald-700">✓</span><strong className="mt-3 block text-sm text-slate-700">Nada aguardando nesta fila.</strong><p className="mt-1 text-xs text-slate-400">Pedidos aparecerão aqui quando entrarem nas etapas correspondentes.</p></div></div> : null}
        </section>
      )}
    </main>
  )
}
