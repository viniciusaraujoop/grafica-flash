'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { getAccessTokenClient } from '@/lib/current-company-client'
import { canonicalOrderStatus, orderStageForStatus, orderWorkflowFor } from '@/lib/operations-experience'
import { getOrderStatusVisual, isOrderPaid } from '@/lib/order-status'
import { buildOrderWhatsAppLink, hasOrderWhatsAppPhone } from '@/lib/order-whatsapp'

type ViewMode = 'list' | 'kanban' | 'calendar'
type Order = {
  id: string
  nome?: string | null
  telefone?: string | null
  customer_name?: string | null
  customer_phone?: string | null
  customer_email?: string | null
  produto?: string | null
  status?: string | null
  payment_status?: string | null
  paid_at?: string | null
  total?: number | null
  total_amount?: number | null
  valor_total?: number | null
  preco_estimado?: number | null
  created_at?: string | null
  updated_at?: string | null
  prioridade?: string | null
  priority?: string | null
  prazo_entrega?: string | null
  responsavel_id?: string | null
  responsavel_nome?: string | null
  canal_origem?: string | null
  delivery_type?: string | null
  observacoes?: string | null
  next_action?: { id: string; titulo?: string | null; due_at?: string | null; prioridade?: string | null } | null
}

type Payload = {
  orders: Order[]
  pagination: { page: number; limit: number; total: number; pages: number }
  company: { id: string; business_type: string }
}

function money(value: unknown) {
  return Number(value || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function orderValue(order: Order) {
  return Number(order.total_amount || order.total || order.valor_total || order.preco_estimado || 0)
}

function customerName(order: Order) {
  return order.nome || order.customer_name || 'Cliente sem nome'
}

function dateLabel(value?: string | null, withTime = false) {
  if (!value) return 'Sem prazo'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Sem prazo'
  return new Intl.DateTimeFormat('pt-BR', withTime ? { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' } : { day: '2-digit', month: 'short' }).format(date)
}

function priorityLabel(value?: string | null) {
  const priority = String(value || 'normal').toLowerCase()
  if (priority.includes('urgent') || priority.includes('crit')) return 'Crítica'
  if (priority.includes('alta') || priority === 'high') return 'Alta'
  if (priority.includes('baixa') || priority === 'low') return 'Baixa'
  return 'Normal'
}

function priorityClass(value?: string | null) {
  const label = priorityLabel(value)
  if (label === 'Crítica') return 'bg-red-50 text-red-700 ring-red-100'
  if (label === 'Alta') return 'bg-amber-50 text-amber-700 ring-amber-100'
  if (label === 'Baixa') return 'bg-slate-50 text-slate-500 ring-slate-100'
  return 'bg-blue-50 text-blue-700 ring-blue-100'
}

function deadlineClass(value?: string | null) {
  if (!value) return 'text-slate-400'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'text-slate-400'
  if (date.getTime() < Date.now()) return 'text-red-600'
  if (date.getTime() - Date.now() < 24 * 60 * 60 * 1000) return 'text-amber-600'
  return 'text-slate-500'
}

function EmptyOrders({ query }: { query: string }) {
  return (
    <div className="grid min-h-60 place-items-center rounded-[1.35rem] border border-dashed border-slate-200 bg-white px-6 py-10 text-center">
      <div>
        <span className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-blue-50 text-xl text-[#174e93]" aria-hidden="true">＋</span>
        <strong className="mt-4 block text-lg text-[#10233f]">{query ? 'Nenhum pedido encontrado.' : 'Nenhum pedido ainda.'}</strong>
        <p className="mt-1 text-sm text-slate-500">{query ? 'Ajuste a busca ou os filtros.' : 'Quando um pedido entrar, ele aparece aqui e na Central do Dia.'}</p>
        {!query ? <Link href="/orcamento" className="mt-4 inline-flex rounded-xl bg-[#0b3b78] px-4 py-2.5 text-sm font-bold text-white">Abrir formulário de pedido</Link> : null}
      </div>
    </div>
  )
}

export default function OrdersWorkspaceV2() {
  const [orders, setOrders] = useState<Order[]>([])
  const [businessType, setBusinessType] = useState('services')
  const [pagination, setPagination] = useState({ page: 1, limit: 40, total: 0, pages: 1 })
  const [view, setView] = useState<ViewMode>('list')
  const [query, setQuery] = useState('')
  const [committedQuery, setCommittedQuery] = useState('')
  const [status, setStatus] = useState('todos')
  const [sort, setSort] = useState('recent')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [movingId, setMovingId] = useState('')
  const [draggedId, setDraggedId] = useState('')

  const workflow = useMemo(() => orderWorkflowFor(businessType), [businessType])

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setCommittedQuery(query.trim())
      setPagination((current) => ({ ...current, page: 1 }))
    }, 220)
    return () => window.clearTimeout(timer)
  }, [query])

  async function load(page = pagination.page) {
    setLoading(true)
    setError('')
    try {
      const token = await getAccessTokenClient()
      const params = new URLSearchParams({ page: String(page), limit: String(pagination.limit), q: committedQuery, status, sort })
      const response = await fetch(`/api/orders?${params.toString()}`, { headers: { Authorization: `Bearer ${token}` }, cache: 'no-store' })
      const payload = await response.json().catch(() => ({})) as Partial<Payload> & { error?: string }
      if (!response.ok) throw new Error(payload.error || 'Erro ao carregar pedidos.')
      setOrders(payload.orders || [])
      if (payload.company?.business_type) setBusinessType(payload.company.business_type)
      if (payload.pagination) setPagination(payload.pagination)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar pedidos.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load(1)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [committedQuery, status, sort])

  async function moveOrder(orderId: string, stageId: string) {
    const nextStatus = canonicalOrderStatus(stageId, businessType)
    const previous = orders.find((order) => order.id === orderId)
    if (!previous || previous.status === nextStatus) return

    setMovingId(orderId)
    setError('')
    setMessage('')
    setOrders((current) => current.map((order) => order.id === orderId ? { ...order, status: nextStatus } : order))

    try {
      const token = await getAccessTokenClient()
      const response = await fetch(`/api/orders/${orderId}`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: nextStatus, note: `Status atualizado pelo Kanban para ${nextStatus}.` }),
      })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(payload.error || 'Erro ao atualizar status.')
      setOrders((current) => current.map((order) => order.id === orderId ? { ...order, ...(payload.order || {}), status: nextStatus } : order))
      setMessage(payload.whatsapp?.ok ? 'Etapa atualizada e cliente avisado.' : 'Etapa do pedido atualizada.')
    } catch (err) {
      setOrders((current) => current.map((order) => order.id === orderId ? previous : order))
      setError(err instanceof Error ? err.message : 'Erro ao atualizar status.')
    } finally {
      setMovingId('')
    }
  }

  const metrics = useMemo(() => {
    const paid = orders.filter((order) => isOrderPaid(order.payment_status, order.paid_at))
    return {
      loaded: orders.length,
      total: pagination.total,
      paid: paid.length,
      value: paid.reduce((sum, order) => sum + orderValue(order), 0),
      attention: orders.filter((order) => {
        const priority = priorityLabel(order.prioridade || order.priority)
        const late = order.prazo_entrega && new Date(order.prazo_entrega).getTime() < Date.now()
        return priority === 'Crítica' || priority === 'Alta' || late
      }).length,
    }
  }, [orders, pagination.total])

  const calendarGroups = useMemo(() => {
    const groups = new Map<string, Order[]>()
    orders.forEach((order) => {
      const date = order.prazo_entrega ? new Date(order.prazo_entrega) : null
      const key = date && !Number.isNaN(date.getTime()) ? date.toISOString().slice(0, 10) : 'sem-prazo'
      if (!groups.has(key)) groups.set(key, [])
      groups.get(key)!.push(order)
    })
    return [...groups.entries()].sort(([a], [b]) => {
      if (a === 'sem-prazo') return 1
      if (b === 'sem-prazo') return -1
      return a.localeCompare(b)
    })
  }, [orders])

  return (
    <main className="text-[#10233f]">
      <section className="overflow-hidden rounded-[1.5rem] border border-slate-200 bg-white shadow-[0_12px_36px_rgba(10,40,82,0.06)]">
        <div className="flex flex-col gap-5 p-5 sm:p-6 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <span className="text-[11px] font-extrabold uppercase tracking-[0.16em] text-[#4776ad]">Pedidos 2.0</span>
            <h2 className="mt-1 text-2xl font-bold tracking-[-0.04em] sm:text-3xl">Da entrada à entrega, sem perder a próxima ação.</h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500">Alterne entre lista, Kanban e calendário. Mudanças de etapa são persistidas no pedido e registradas no histórico existente.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href="/painel/tarefas" className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-bold text-slate-600 transition hover:bg-slate-50">Próximas ações</Link>
            <button type="button" onClick={() => void load()} className="rounded-xl bg-[#0b3b78] px-4 py-2.5 text-sm font-bold text-white transition hover:bg-[#082f61]">Atualizar</button>
          </div>
        </div>

        <div className="grid grid-cols-2 border-t border-slate-100 sm:grid-cols-4">
          <Metric label="Total" value={metrics.total.toLocaleString('pt-BR')} detail={`${metrics.loaded} nesta página`} />
          <Metric label="Atenção" value={metrics.attention.toLocaleString('pt-BR')} detail="Prazo ou prioridade" />
          <Metric label="Pagos" value={metrics.paid.toLocaleString('pt-BR')} detail="Nesta página" />
          <Metric label="Receita confirmada" value={money(metrics.value)} detail="Pedidos visíveis" />
        </div>
      </section>

      {message ? <div role="status" className="mt-3 rounded-xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-700">{message}</div> : null}
      {error ? <div role="alert" className="mt-3 rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm font-bold text-red-700">{error}</div> : null}

      <section className="mt-4 rounded-[1.3rem] border border-slate-200 bg-white p-3 shadow-[0_10px_28px_rgba(10,40,82,0.045)] sm:p-4">
        <div className="grid gap-2 lg:grid-cols-[minmax(220px,1fr)_200px_170px_auto]">
          <label className="relative">
            <span className="sr-only">Buscar pedidos</span>
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar cliente, telefone, produto..." className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm font-semibold outline-none transition focus:border-blue-300 focus:bg-white focus:ring-2 focus:ring-blue-100" />
          </label>
          <select value={status} onChange={(event) => { setStatus(event.target.value); setPagination((current) => ({ ...current, page: 1 })) }} className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm font-bold outline-none focus:border-blue-300">
            <option value="todos">Todos os status</option>
            {workflow.map((stage) => <option key={stage.id} value={stage.label}>{stage.label}</option>)}
          </select>
          <select value={sort} onChange={(event) => setSort(event.target.value)} className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm font-bold outline-none focus:border-blue-300">
            <option value="recent">Mais recentes</option>
            <option value="deadline">Prazo primeiro</option>
            <option value="value">Maior valor</option>
          </select>
          <div className="grid grid-cols-3 rounded-xl bg-slate-100 p-1" aria-label="Modo de visualização">
            {([['list', 'Lista'], ['kanban', 'Kanban'], ['calendar', 'Calendário']] as const).map(([id, label]) => (
              <button key={id} type="button" onClick={() => setView(id)} aria-pressed={view === id} className={`rounded-lg px-3 py-2 text-xs font-extrabold transition ${view === id ? 'bg-white text-[#0b3b78] shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>{label}</button>
            ))}
          </div>
        </div>
      </section>

      <section className="mt-4">
        {loading ? <OrdersSkeleton view={view} /> : !orders.length ? <EmptyOrders query={committedQuery} /> : view === 'kanban' ? (
          <div className="overflow-x-auto pb-3">
            <div className="grid min-w-max auto-cols-[290px] grid-flow-col gap-3">
              {workflow.map((stage) => {
                const stageOrders = orders.filter((order) => orderStageForStatus(order.status, businessType).id === stage.id)
                return (
                  <section
                    key={stage.id}
                    onDragOver={(event) => event.preventDefault()}
                    onDrop={() => { if (draggedId) void moveOrder(draggedId, stage.id); setDraggedId('') }}
                    className="w-[290px] rounded-[1.25rem] border border-slate-200 bg-[#f7f9fc] p-2.5"
                  >
                    <div className="mb-2 flex items-center justify-between px-1 py-1">
                      <h3 className="text-sm font-extrabold text-slate-700">{stage.label}</h3>
                      <span className="rounded-full bg-white px-2 py-0.5 text-[11px] font-black text-slate-500 ring-1 ring-slate-200">{stageOrders.length}</span>
                    </div>
                    <div className="grid gap-2">
                      {stageOrders.map((order) => (
                        <KanbanCard key={order.id} order={order} disabled={movingId === order.id} onDragStart={() => setDraggedId(order.id)} onMove={(stageId) => void moveOrder(order.id, stageId)} workflow={workflow} />
                      ))}
                      {!stageOrders.length ? <div className="grid min-h-24 place-items-center rounded-xl border border-dashed border-slate-200 bg-white/60 px-3 text-center text-xs font-semibold text-slate-400">Arraste um pedido para esta etapa.</div> : null}
                    </div>
                  </section>
                )
              })}
            </div>
          </div>
        ) : view === 'calendar' ? (
          <div className="grid gap-3">
            {calendarGroups.map(([date, group]) => (
              <section key={date} className="rounded-[1.25rem] border border-slate-200 bg-white p-4 shadow-[0_8px_24px_rgba(10,40,82,0.045)]">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <h3 className="font-extrabold text-slate-800">{date === 'sem-prazo' ? 'Sem prazo definido' : new Intl.DateTimeFormat('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' }).format(new Date(`${date}T12:00:00`))}</h3>
                  <span className="text-xs font-bold text-slate-400">{group.length} pedido(s)</span>
                </div>
                <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
                  {group.map((order) => <CompactOrder key={order.id} order={order} />)}
                </div>
              </section>
            ))}
          </div>
        ) : (
          <div className="grid gap-2.5">
            {orders.map((order) => <ListOrder key={order.id} order={order} businessType={businessType} workflow={workflow} disabled={movingId === order.id} onMove={(stageId) => void moveOrder(order.id, stageId)} />)}
          </div>
        )}
      </section>

      {!loading && pagination.pages > 1 ? (
        <nav className="mt-5 flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-3 py-2" aria-label="Paginação de pedidos">
          <button type="button" disabled={pagination.page <= 1} onClick={() => void load(pagination.page - 1)} className="rounded-lg px-3 py-2 text-sm font-bold text-slate-600 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-35">← Anterior</button>
          <span className="text-xs font-bold text-slate-500">Página {pagination.page} de {pagination.pages}</span>
          <button type="button" disabled={pagination.page >= pagination.pages} onClick={() => void load(pagination.page + 1)} className="rounded-lg px-3 py-2 text-sm font-bold text-slate-600 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-35">Próxima →</button>
        </nav>
      ) : null}
    </main>
  )
}

function Metric({ label, value, detail }: { label: string; value: string; detail: string }) {
  return <div className="border-t border-slate-100 p-4 sm:border-r sm:last:border-r-0"><span className="text-[10px] font-extrabold uppercase tracking-[0.12em] text-slate-400">{label}</span><strong className="mt-1 block truncate text-xl font-bold tracking-[-0.035em] text-[#10233f]">{value}</strong><small className="mt-0.5 block text-[11px] font-semibold text-slate-400">{detail}</small></div>
}

function ListOrder({ order, businessType, workflow, disabled, onMove }: { order: Order; businessType: string; workflow: ReturnType<typeof orderWorkflowFor>; disabled: boolean; onMove: (stageId: string) => void }) {
  const visual = getOrderStatusVisual(order.status, order.payment_status, order.paid_at)
  const stage = orderStageForStatus(order.status, businessType)
  return (
    <article className="rounded-[1.25rem] border border-slate-200 bg-white p-4 shadow-[0_8px_24px_rgba(10,40,82,0.045)] transition duration-200 hover:-translate-y-px hover:border-slate-300 hover:shadow-[0_12px_30px_rgba(10,40,82,0.07)]">
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_170px_170px] xl:items-center">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className={`rounded-full border px-2.5 py-1 text-[10px] font-extrabold ${visual.className}`}>{stage.label}</span>
            <span className={`rounded-full px-2.5 py-1 text-[10px] font-extrabold ring-1 ${priorityClass(order.prioridade || order.priority)}`}>{priorityLabel(order.prioridade || order.priority)}</span>
            {isOrderPaid(order.payment_status, order.paid_at) ? <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[10px] font-extrabold text-emerald-700 ring-1 ring-emerald-100">Pago</span> : null}
          </div>
          <Link href={`/painel/pedidos/${order.id}`} className="mt-2 block truncate text-lg font-bold tracking-[-0.025em] text-[#10233f] hover:text-[#174e93]">{customerName(order)}</Link>
          <p className="mt-0.5 truncate text-sm font-medium text-slate-500">{order.produto || 'Pedido sem descrição'}</p>
          <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs font-semibold text-slate-400">
            <span>{money(orderValue(order))}</span>
            <span className={deadlineClass(order.prazo_entrega)}>Prazo: {dateLabel(order.prazo_entrega, true)}</span>
            <span>Responsável: {order.responsavel_nome || 'Não atribuído'}</span>
            {order.next_action?.titulo ? <span className="text-[#4776ad]">Próxima: {order.next_action.titulo}{order.next_action.due_at ? ` · ${dateLabel(order.next_action.due_at, true)}` : ''}</span> : null}
          </div>
        </div>

        <label className="grid gap-1">
          <span className="text-[10px] font-extrabold uppercase tracking-[0.1em] text-slate-400">Etapa</span>
          <select disabled={disabled} value={stage.id} onChange={(event) => onMove(event.target.value)} className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-xs font-bold text-slate-700 outline-none focus:border-blue-300 disabled:opacity-50">
            {workflow.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}
          </select>
        </label>

        <div className="grid grid-cols-2 gap-2">
          <a href={buildOrderWhatsAppLink(order)} target="_blank" rel="noreferrer" aria-disabled={!hasOrderWhatsAppPhone(order)} className={`rounded-xl px-3 py-2.5 text-center text-xs font-extrabold ${hasOrderWhatsAppPhone(order) ? 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100' : 'pointer-events-none bg-slate-100 text-slate-300'}`}>WhatsApp</a>
          <Link href={`/painel/pedidos/${order.id}`} className="rounded-xl bg-[#0b3b78] px-3 py-2.5 text-center text-xs font-extrabold text-white hover:bg-[#082f61]">Abrir</Link>
        </div>
      </div>
    </article>
  )
}

function KanbanCard({ order, disabled, onDragStart, onMove, workflow }: { order: Order; disabled: boolean; onDragStart: () => void; onMove: (stageId: string) => void; workflow: ReturnType<typeof orderWorkflowFor> }) {
  return (
    <article draggable={!disabled} onDragStart={onDragStart} className={`rounded-xl border border-slate-200 bg-white p-3 shadow-sm transition duration-200 hover:border-slate-300 hover:shadow-md ${disabled ? 'opacity-60' : 'cursor-grab active:cursor-grabbing'}`}>
      <div className="flex items-start justify-between gap-2"><Link href={`/painel/pedidos/${order.id}`} className="min-w-0 truncate text-sm font-extrabold text-slate-800 hover:text-[#174e93]">{customerName(order)}</Link><span className={`shrink-0 rounded-full px-2 py-0.5 text-[9px] font-black ring-1 ${priorityClass(order.prioridade || order.priority)}`}>{priorityLabel(order.prioridade || order.priority)}</span></div>
      <p className="mt-1 line-clamp-2 text-xs font-medium leading-5 text-slate-500">{order.produto || 'Pedido'}</p>
      <div className="mt-3 flex items-center justify-between gap-2"><strong className="text-sm text-[#174e93]">{money(orderValue(order))}</strong><span className={`text-[10px] font-bold ${deadlineClass(order.prazo_entrega)}`}>{dateLabel(order.prazo_entrega)}</span></div>
      {order.next_action?.titulo ? <div className="mt-2 rounded-lg bg-blue-50 px-2.5 py-2 text-[10px] font-bold leading-4 text-blue-700">Próxima: {order.next_action.titulo}</div> : null}
      <select aria-label={`Mover ${customerName(order)}`} disabled={disabled} value={orderStageForStatus(order.status, '').id} onChange={(event) => onMove(event.target.value)} className="mt-2 h-8 w-full rounded-lg border border-slate-200 bg-white px-2 text-[10px] font-bold outline-none md:hidden">
        {workflow.map((stage) => <option key={stage.id} value={stage.id}>{stage.label}</option>)}
      </select>
    </article>
  )
}

function CompactOrder({ order }: { order: Order }) {
  return <Link href={`/painel/pedidos/${order.id}`} className="rounded-xl border border-slate-100 bg-slate-50 p-3 transition hover:border-blue-100 hover:bg-blue-50/50"><div className="flex items-start justify-between gap-2"><strong className="truncate text-sm text-slate-800">{customerName(order)}</strong><span className={`shrink-0 rounded-full px-2 py-0.5 text-[9px] font-black ring-1 ${priorityClass(order.prioridade || order.priority)}`}>{priorityLabel(order.prioridade || order.priority)}</span></div><p className="mt-1 truncate text-xs text-slate-500">{order.produto || 'Pedido'}</p><div className="mt-2 flex justify-between text-[10px] font-bold text-slate-400"><span>{dateLabel(order.prazo_entrega, true)}</span><span>{money(orderValue(order))}</span></div></Link>
}

function OrdersSkeleton({ view }: { view: ViewMode }) {
  return <div className={view === 'kanban' ? 'grid grid-cols-3 gap-3 overflow-hidden' : 'grid gap-2.5'} aria-label="Carregando pedidos">{Array.from({ length: view === 'kanban' ? 6 : 5 }).map((_, index) => <div key={index} className={`animate-pulse rounded-[1.25rem] bg-slate-100 ${view === 'kanban' ? 'h-48' : 'h-28'}`} />)}</div>
}
