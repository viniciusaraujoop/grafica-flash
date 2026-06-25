'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { getAccessTokenClient, getCurrentCompanyClient } from '@/lib/current-company-client'
import { supabase } from '@/lib/supabase'

const statuses = ['Aguardando arte', 'Aguardando pagamento', 'Em produção', 'Aguardando retirada', 'Saiu para entrega', 'Entregue']
const priorities = ['baixa', 'normal', 'alta', 'urgente']

function dataBR(value?: string | null) {
  if (!value) return 'Sem prazo'
  return new Date(value).toLocaleDateString('pt-BR')
}

function statusTone(status: string) {
  if (status === 'Entregue') return 'bg-emerald-50 text-emerald-700'
  if (status.includes('pagamento')) return 'bg-yellow-50 text-yellow-700'
  if (status.includes('produção')) return 'bg-orange-50 text-orange-700'
  return 'bg-blue-50 text-[#05245c]'
}

export default function ProducaoPage() {
  const [company, setCompany] = useState<any>(null)
  const [orders, setOrders] = useState<any[]>([])
  const [members, setMembers] = useState<any[]>([])
  const [token, setToken] = useState('')
  const [loading, setLoading] = useState(true)
  const [erro, setErro] = useState('')
  const [filtro, setFiltro] = useState('todos')

  async function carregar() {
    setLoading(true)
    setErro('')

    try {
      const accessToken = await getAccessTokenClient()
      setToken(accessToken)

      const current = await getCurrentCompanyClient()
      setCompany(current.company)

      const [productionRes, membersRes] = await Promise.all([
        supabase
          .from('production_orders')
          .select('*')
          .eq('company_id', current.company.id)
          .order('due_date', { ascending: true }),
        supabase
          .from('company_members_public')
          .select('*')
          .eq('company_id', current.company.id)
          .order('created_at', { ascending: true }),
      ])

      if (productionRes.error) throw productionRes.error
      setOrders(productionRes.data || [])
      setMembers(membersRes.data || [])
    } catch (error) {
      setErro(error instanceof Error ? error.message : 'Erro ao carregar produção.')
    }

    setLoading(false)
  }

  useEffect(() => {
    carregar()
  }, [])

  async function updateOrder(id: string, patch: Record<string, any>) {
    setErro('')

    const response = await fetch('/api/producao/update', {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ id, ...patch }),
    })

    const payload = await response.json()

    if (!response.ok) {
      setErro(payload.error || 'Erro ao atualizar produção.')
      return
    }

    setOrders((current) => current.map((item) => item.id === id ? payload.order : item))
  }

  const filtradas = useMemo(() => {
    if (filtro === 'todos') return orders
    return orders.filter((order) => order.status === filtro)
  }, [orders, filtro])

  if (loading) {
    return <main className="flex min-h-screen items-center justify-center bg-[#f5f8ff]"><div className="rounded-[2rem] bg-white p-8 font-black shadow-xl">Carregando produção...</div></main>
  }

  return (
    <main className="min-h-screen bg-[#f5f8ff] px-4 py-6 text-[#071b3a]">
      <section className="mx-auto max-w-7xl space-y-6">
        <header className="rounded-[2rem] border border-blue-100 bg-white p-6 shadow-xl shadow-blue-950/5">
          <Link href="/painel" className="text-sm font-black text-[#05245c]">← Voltar ao painel</Link>
          <h1 className="mt-4 text-4xl font-black tracking-[-0.05em]">Gestão de produção</h1>
          <p className="mt-3 max-w-3xl font-bold leading-7 text-slate-500">
            Fila de produção com responsável, prazo, prioridade, status, arquivos e observações internas.
          </p>
        </header>

        {erro && <div className="rounded-2xl border border-red-100 bg-red-50 p-4 font-bold text-red-700">{erro}</div>}

        <div className="flex gap-2 overflow-x-auto rounded-[1.6rem] border border-blue-100 bg-white p-3 shadow-xl shadow-blue-950/5">
          {['todos', ...statuses].map((status) => (
            <button
              key={status}
              type="button"
              onClick={() => setFiltro(status)}
              className={`whitespace-nowrap rounded-2xl px-4 py-3 text-sm font-black ${filtro === status ? 'bg-[#05245c] text-white' : 'bg-[#f5f8ff] text-[#05245c]'}`}
            >
              {status === 'todos' ? 'Todos' : status}
            </button>
          ))}
        </div>

        <div className="grid gap-4">
          {filtradas.map((order) => (
            <article key={order.id} className="rounded-[2rem] border border-blue-100 bg-white p-5 shadow-xl shadow-blue-950/5">
              <div className="grid gap-4 lg:grid-cols-[1fr_240px_220px] lg:items-start">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`rounded-full px-3 py-1 text-xs font-black ${statusTone(order.status || '')}`}>{order.status || 'Aguardando arte'}</span>
                    <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-black text-slate-600">{order.priority || 'normal'}</span>
                  </div>
                  <h2 className="mt-3 text-2xl font-black">{order.title || 'Ordem de produção'}</h2>
                  <p className="mt-2 font-bold text-slate-500">{order.customer_name || 'Cliente'} • {order.customer_whatsapp || 'Sem WhatsApp'} • Prazo: {dataBR(order.due_date)}</p>

                  <textarea
                    defaultValue={order.internal_notes || ''}
                    onBlur={(event) => updateOrder(order.id, { internal_notes: event.target.value })}
                    placeholder="Observações internas"
                    rows={3}
                    className="mt-4 w-full resize-none rounded-2xl border border-slate-200 bg-[#f8fbff] px-4 py-3 font-bold outline-none"
                  />
                </div>

                <div className="grid gap-3">
                  <label className="grid gap-1 text-sm font-black text-slate-500">
                    Status
                    <select value={order.status || 'Aguardando arte'} onChange={(event) => updateOrder(order.id, { status: event.target.value })} className="rounded-2xl border border-slate-200 px-4 py-3 font-bold text-[#071b3a]">
                      {statuses.map((status) => <option key={status}>{status}</option>)}
                    </select>
                  </label>

                  <label className="grid gap-1 text-sm font-black text-slate-500">
                    Prioridade
                    <select value={order.priority || 'normal'} onChange={(event) => updateOrder(order.id, { priority: event.target.value })} className="rounded-2xl border border-slate-200 px-4 py-3 font-bold text-[#071b3a]">
                      {priorities.map((priority) => <option key={priority}>{priority}</option>)}
                    </select>
                  </label>
                </div>

                <div className="grid gap-3">
                  <label className="grid gap-1 text-sm font-black text-slate-500">
                    Responsável
                    <input defaultValue={order.responsible_name || ''} onBlur={(event) => updateOrder(order.id, { responsible_name: event.target.value })} placeholder="Nome" className="rounded-2xl border border-slate-200 px-4 py-3 font-bold text-[#071b3a] outline-none" />
                  </label>

                  <label className="grid gap-1 text-sm font-black text-slate-500">
                    Prazo
                    <input type="date" defaultValue={order.due_date ? new Date(order.due_date).toISOString().slice(0, 10) : ''} onBlur={(event) => updateOrder(order.id, { due_date: event.target.value ? new Date(event.target.value).toISOString() : null })} className="rounded-2xl border border-slate-200 px-4 py-3 font-bold text-[#071b3a] outline-none" />
                  </label>
                </div>
              </div>
            </article>
          ))}

          {filtradas.length === 0 && (
            <div className="rounded-[2rem] border border-dashed border-slate-300 bg-white p-10 text-center">
              <p className="font-black text-[#071b3a]">Nenhuma ordem nessa fila.</p>
              <p className="mt-2 font-bold text-slate-500">Quando orçamento virar pedido/produção, aparece aqui.</p>
            </div>
          )}
        </div>
      </section>
    </main>
  )
}
