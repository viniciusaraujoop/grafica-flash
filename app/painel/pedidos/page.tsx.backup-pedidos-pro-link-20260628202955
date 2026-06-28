'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'

type Order = {
  id: string
  nome?: string | null
  telefone?: string | null
  produto?: string | null
  status?: string | null
  quantidade?: number | null
  largura?: number | null
  altura?: number | null
  observacoes?: string | null
  preco_estimado?: number | null
  valor_total?: number | null
  cupom_codigo?: string | null
  arquivo_url?: string | null
  file_url?: string | null
  created_at?: string | null
}

const statusOptions = [
  'Recebido',
  'Pendente',
  'Em análise',
  'Aguardando aprovação',
  'Aprovado',
  'Em produção',
  'Pronto',
  'Entregue',
  'Cancelado',
]

function moeda(value: number | null | undefined) {
  return Number(value || 0).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  })
}

function dataCurta(value?: string | null) {
  if (!value) return 'Sem data'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Data inválida'
  return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(date)
}

function phoneOnly(value?: string | null) {
  return String(value || '').replace(/\D/g, '')
}

function whatsappLink(phone?: string | null, text?: string) {
  const clean = phoneOnly(phone)
  if (!clean) return '#'
  const finalPhone = clean.startsWith('55') ? clean : `55${clean}`
  return `https://wa.me/${finalPhone}?text=${encodeURIComponent(text || 'Olá! Vim falar sobre meu pedido.')}`
}

function statusClass(status?: string | null) {
  const value = String(status || '').toLowerCase()

  if (value.includes('entregue') || value.includes('pronto') || value.includes('aprovado')) {
    return 'bg-emerald-50 text-emerald-700 border-emerald-100'
  }

  if (value.includes('cancel')) return 'bg-red-50 text-red-700 border-red-100'
  if (value.includes('produção') || value.includes('producao')) return 'bg-amber-50 text-amber-700 border-amber-100'

  return 'bg-blue-50 text-[#05245c] border-blue-100'
}

export default function PedidosPage() {
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [query, setQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('todos')
  const [companyId, setCompanyId] = useState('')
  const [updatingId, setUpdatingId] = useState('')

  async function loadOrders() {
    setLoading(true)
    setError('')
    setMessage('')

    try {
      const { data: sessionData } = await supabase.auth.getSession()
      const token = sessionData.session?.access_token

      if (!token) {
        window.location.href = '/login'
        return
      }

      const companyResponse = await fetch('/api/company/current', {
        headers: { Authorization: `Bearer ${token}` },
      })

      const companyPayload = await companyResponse.json().catch(() => ({}))

      if (!companyResponse.ok) {
        throw new Error(companyPayload.error || 'Erro ao carregar empresa atual.')
      }

      const currentCompanyId = companyPayload.company?.id

      if (!currentCompanyId) throw new Error('Empresa não encontrada.')

      setCompanyId(currentCompanyId)

      const { data, error: ordersError } = await supabase
        .from('orders')
        .select('*')
        .eq('company_id', currentCompanyId)
        .order('created_at', { ascending: false })
        .limit(300)

      if (ordersError) throw ordersError

      setOrders((data || []) as Order[])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar pedidos.')
    }

    setLoading(false)
  }

  useEffect(() => {
    loadOrders()
  }, [])

  const filteredOrders = useMemo(() => {
    const search = query.trim().toLowerCase()

    return orders.filter((order) => {
      const matchesStatus = statusFilter === 'todos' || order.status === statusFilter
      if (!search) return matchesStatus

      const haystack = [
        order.nome,
        order.telefone,
        order.produto,
        order.status,
        order.observacoes,
        order.cupom_codigo,
      ].join(' ').toLowerCase()

      return matchesStatus && haystack.includes(search)
    })
  }, [orders, query, statusFilter])

  const metrics = useMemo(() => {
    const total = orders.length
    const pendentes = orders.filter((order) => ['Recebido', 'Pendente', 'Em análise', 'Aguardando aprovação'].includes(order.status || '')).length
    const producao = orders.filter((order) => order.status === 'Em produção').length
    const faturamento = orders.reduce((acc, order) => acc + Number(order.valor_total || order.preco_estimado || 0), 0)

    return { total, pendentes, producao, faturamento }
  }, [orders])

  async function updateStatus(orderId: string, status: string) {
    setUpdatingId(orderId)
    setError('')
    setMessage('')

    try {
      const { error: updateError } = await supabase
        .from('orders')
        .update({ status })
        .eq('id', orderId)
        .eq('company_id', companyId)

      if (updateError) throw updateError

      setOrders((current) => current.map((order) => order.id === orderId ? { ...order, status } : order))
      setMessage('Status atualizado.')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao atualizar status.')
    }

    setUpdatingId('')
  }

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#f5f8ff] px-4">
        <div className="rounded-[2rem] bg-white p-8 text-center font-black text-[#071b3a] shadow-xl shadow-blue-950/5">
          Carregando pedidos...
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-[#f5f8ff] px-4 py-6 text-[#071b3a]">
      <section className="mx-auto max-w-7xl space-y-6">
        <header className="rounded-[2rem] border border-blue-100 bg-white p-6 shadow-xl shadow-blue-950/5">
          <Link href="/painel" className="text-sm font-black text-[#05245c]">← Voltar ao painel</Link>

          <div className="mt-5 flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.22em] text-[#05245c]">Vendas</p>
              <h1 className="mt-2 text-4xl font-black tracking-[-0.05em] sm:text-5xl">Pedidos</h1>
              <p className="mt-3 max-w-3xl font-bold leading-7 text-slate-500">
                Veja pedidos recebidos, filtre por status, fale com o cliente e acompanhe o andamento.
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <Link href="/orcamento" className="rounded-2xl border border-blue-100 bg-white px-5 py-3 text-sm font-black text-[#05245c]">
                Abrir formulário público
              </Link>
              <button onClick={loadOrders} className="rounded-2xl bg-[#05245c] px-5 py-3 text-sm font-black text-white">
                Atualizar
              </button>
            </div>
          </div>
        </header>

        {message ? <div className="rounded-2xl bg-emerald-50 p-4 font-bold text-emerald-700">{message}</div> : null}
        {error ? <div className="rounded-2xl bg-red-50 p-4 font-bold text-red-700">{error}</div> : null}

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <article className="rounded-[1.6rem] border border-blue-100 bg-white p-5 shadow-xl shadow-blue-950/5">
            <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">Total</p>
            <p className="mt-3 text-3xl font-black">{metrics.total}</p>
            <p className="mt-2 text-sm font-bold text-slate-500">Pedidos carregados.</p>
          </article>
          <article className="rounded-[1.6rem] border border-blue-100 bg-white p-5 shadow-xl shadow-blue-950/5">
            <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">Pendentes</p>
            <p className="mt-3 text-3xl font-black">{metrics.pendentes}</p>
            <p className="mt-2 text-sm font-bold text-slate-500">Precisam de atenção.</p>
          </article>
          <article className="rounded-[1.6rem] border border-blue-100 bg-white p-5 shadow-xl shadow-blue-950/5">
            <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">Em produção</p>
            <p className="mt-3 text-3xl font-black">{metrics.producao}</p>
            <p className="mt-2 text-sm font-bold text-slate-500">Execução em andamento.</p>
          </article>
          <article className="rounded-[1.6rem] border border-blue-100 bg-white p-5 shadow-xl shadow-blue-950/5">
            <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">Estimado</p>
            <p className="mt-3 text-3xl font-black">{moeda(metrics.faturamento)}</p>
            <p className="mt-2 text-sm font-bold text-slate-500">Soma dos valores informados.</p>
          </article>
        </div>

        <section className="rounded-[2rem] border border-blue-100 bg-white p-5 shadow-xl shadow-blue-950/5">
          <div className="grid gap-3 lg:grid-cols-[1fr_260px]">
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Buscar por cliente, telefone, produto, observação ou cupom..."
              className="rounded-2xl border border-slate-200 px-4 py-4 font-bold outline-none transition focus:border-[#05245c]"
            />

            <select
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value)}
              className="rounded-2xl border border-slate-200 px-4 py-4 font-bold outline-none transition focus:border-[#05245c]"
            >
              <option value="todos">Todos os status</option>
              {statusOptions.map((status) => (
                <option key={status} value={status}>{status}</option>
              ))}
            </select>
          </div>
        </section>

        <section className="grid gap-4">
          {filteredOrders.map((order) => {
            const value = Number(order.valor_total || order.preco_estimado || 0)
            const fileUrl = order.arquivo_url || order.file_url

            return (
              <article key={order.id} className="rounded-[1.8rem] border border-blue-100 bg-white p-5 shadow-xl shadow-blue-950/5">
                <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`rounded-full border px-3 py-1 text-xs font-black ${statusClass(order.status)}`}>
                        {order.status || 'Recebido'}
                      </span>
                      <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-black text-slate-500">
                        {dataCurta(order.created_at)}
                      </span>
                      {order.cupom_codigo ? (
                        <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-black text-emerald-700">
                          Cupom: {order.cupom_codigo}
                        </span>
                      ) : null}
                    </div>

                    <h2 className="mt-4 text-2xl font-black tracking-[-0.04em]">
                      {order.nome || 'Cliente sem nome'}
                    </h2>

                    <p className="mt-2 font-bold leading-7 text-slate-500">
                      {order.produto || 'Pedido sem produto informado'}
                    </p>

                    <div className="mt-4 grid gap-3 text-sm font-bold text-slate-500 sm:grid-cols-2 xl:grid-cols-4">
                      <p><span className="text-slate-400">Telefone:</span> {order.telefone || 'Não informado'}</p>
                      <p><span className="text-slate-400">Quantidade:</span> {order.quantidade || 1}</p>
                      <p><span className="text-slate-400">Medida:</span> {order.largura || '-'} x {order.altura || '-'}</p>
                      <p><span className="text-slate-400">Valor:</span> {moeda(value)}</p>
                    </div>

                    {order.observacoes ? (
                      <p className="mt-4 rounded-2xl bg-[#f5f8ff] p-4 text-sm font-bold leading-7 text-slate-600">
                        {order.observacoes}
                      </p>
                    ) : null}
                  </div>

                  <div className="grid min-w-[230px] gap-2">
                    <select
                      value={order.status || 'Recebido'}
                      disabled={updatingId === order.id}
                      onChange={(event) => updateStatus(order.id, event.target.value)}
                      className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-black outline-none"
                    >
                      {statusOptions.map((status) => (
                        <option key={status} value={status}>{status}</option>
                      ))}
                    </select>

                    <a
                      href={whatsappLink(order.telefone, `Olá, ${order.nome || ''}! Vim falar sobre seu pedido: ${order.produto || ''}.`)}
                      target="_blank"
                      rel="noreferrer"
                      className={`rounded-2xl px-4 py-3 text-center text-sm font-black text-white ${phoneOnly(order.telefone) ? 'bg-[#05245c]' : 'pointer-events-none bg-slate-300'}`}
                    >
                      Chamar no WhatsApp
                    </a>

                    <Link href={`/painel/orcamento/${order.id}`} className="rounded-2xl border border-blue-100 bg-white px-4 py-3 text-center text-sm font-black text-[#05245c]">
                      Ver detalhes
                    </Link>

                    {fileUrl ? (
                      <a href={fileUrl} target="_blank" rel="noreferrer" className="rounded-2xl border border-blue-100 bg-white px-4 py-3 text-center text-sm font-black text-[#05245c]">
                        Abrir arquivo
                      </a>
                    ) : null}
                  </div>
                </div>
              </article>
            )
          })}

          {filteredOrders.length === 0 ? (
            <div className="rounded-[2rem] border border-dashed border-blue-100 bg-white p-10 text-center shadow-xl shadow-blue-950/5">
              <h2 className="text-2xl font-black">Nenhum pedido encontrado</h2>
              <p className="mt-2 font-bold text-slate-500">
                Ajuste os filtros ou aguarde os clientes começarem a usar o formulário.
              </p>
            </div>
          ) : null}
        </section>
      </section>
    </main>
  )
}
