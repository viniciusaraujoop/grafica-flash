'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'

type ProductionOrder = {
  id: string
  company_id: string
  proposal_id: string | null
  order_id: string | null
  title: string
  customer_name: string | null
  customer_whatsapp: string | null
  total_value: number | null
  signal_value: number | null
  status: string
  priority: string | null
  due_date: string | null
  created_at: string | null
  total_steps?: number
  completed_steps?: number
}

type Step = {
  id: string
  production_order_id: string
  title: string
  description: string | null
  status: string
  sort_order: number
  completed_at: string | null
}

function moeda(valor: number) {
  return Number(valor || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function dataBR(data?: string | null) {
  if (!data) return 'Sem prazo'
  return new Date(data).toLocaleDateString('pt-BR')
}

function statusLabel(status: string) {
  const labels: Record<string, string> = {
    aguardando_sinal: 'Aguardando sinal',
    aprovado: 'Aprovado',
    em_producao: 'Em produção',
    pronto: 'Pronto',
    entregue: 'Entregue',
    cancelado: 'Cancelado',
    pendente: 'Pendente',
    em_andamento: 'Em andamento',
    concluido: 'Concluído',
    pulada: 'Pulada',
  }

  return labels[status] || status
}

export default function ProducaoPage() {
  const [company, setCompany] = useState<any>(null)
  const [orders, setOrders] = useState<ProductionOrder[]>([])
  const [steps, setSteps] = useState<Step[]>([])
  const [loading, setLoading] = useState(true)
  const [erro, setErro] = useState('')
  const [filtro, setFiltro] = useState('todos')
  const [busca, setBusca] = useState('')

  async function carregar() {
    setLoading(true)
    setErro('')

    try {
      const { data: sessionData } = await supabase.auth.getSession()
      const user = sessionData.session?.user

      if (!user) {
        window.location.href = '/login'
        return
      }

      let { data: empresa, error: empresaError } = await supabase
        .from('companies')
        .select('id,nome,slug')
        .or(`owner_id.eq.${user.id},tester_id.eq.${user.id}`)
        .maybeSingle()

      if (empresaError) throw empresaError

      if (!empresa) {
        const { data: member } = await supabase
          .from('company_members')
          .select('company_id')
          .eq('user_id', user.id)
          .eq('status', 'ativo')
          .maybeSingle()

        if (member?.company_id) {
          const result = await supabase.from('companies').select('id,nome,slug').eq('id', member.company_id).maybeSingle()
          empresa = result.data
        }
      }

      if (!empresa) throw new Error('Empresa não encontrada.')

      setCompany(empresa)

      const { data: ordersData, error: ordersError } = await supabase
        .from('production_dashboard')
        .select('*')
        .eq('company_id', empresa.id)
        .order('created_at', { ascending: false })

      if (ordersError) throw ordersError

      const allOrders = (ordersData || []) as ProductionOrder[]
      setOrders(allOrders)

      if (allOrders.length > 0) {
        const { data: stepsData, error: stepsError } = await supabase
          .from('production_steps')
          .select('id,production_order_id,title,description,status,sort_order,completed_at')
          .in('production_order_id', allOrders.map((order) => order.id))
          .order('sort_order', { ascending: true })

        if (stepsError) throw stepsError
        setSteps((stepsData || []) as Step[])
      } else {
        setSteps([])
      }
    } catch (error) {
      setErro(error instanceof Error ? error.message : 'Erro ao carregar produção.')
    }

    setLoading(false)
  }

  useEffect(() => {
    carregar()
  }, [])

  const filtradas = useMemo(() => {
    let list = [...orders]

    if (filtro !== 'todos') list = list.filter((order) => order.status === filtro)

    const q = busca.trim().toLowerCase()
    if (q) {
      list = list.filter((order) =>
        order.title.toLowerCase().includes(q) ||
        String(order.customer_name || '').toLowerCase().includes(q)
      )
    }

    return list
  }, [orders, filtro, busca])

  const metrics = useMemo(() => {
    return {
      total: orders.length,
      andamento: orders.filter((o) => ['aguardando_sinal', 'aprovado', 'em_producao'].includes(o.status)).length,
      pronto: orders.filter((o) => o.status === 'pronto').length,
      entregue: orders.filter((o) => o.status === 'entregue').length,
      valor: orders.reduce((acc, o) => acc + Number(o.total_value || 0), 0),
    }
  }, [orders])

  function stepsByOrder(orderId: string) {
    return steps.filter((step) => step.production_order_id === orderId)
  }

  async function updateOrder(id: string, status: string) {
    const update: Record<string, any> = {
      status,
      updated_at: new Date().toISOString(),
    }

    if (status === 'em_producao') update.started_at = new Date().toISOString()
    if (status === 'entregue') update.completed_at = new Date().toISOString()

    const { error } = await supabase.from('production_orders').update(update).eq('id', id)

    if (error) setErro(error.message)
    else await carregar()
  }

  async function updateStep(step: Step, status: string) {
    const { data: sessionData } = await supabase.auth.getSession()
    const update: Record<string, any> = {
      status,
      updated_at: new Date().toISOString(),
    }

    if (status === 'em_andamento') update.started_at = new Date().toISOString()
    if (status === 'concluido') {
      update.completed_at = new Date().toISOString()
      update.completed_by = sessionData.session?.user?.id || null
    }

    const { error } = await supabase.from('production_steps').update(update).eq('id', step.id)

    if (error) {
      setErro(error.message)
      return
    }

    const orderSteps = stepsByOrder(step.production_order_id).map((s) => s.id === step.id ? { ...s, status } : s)
    const allDone = orderSteps.length > 0 && orderSteps.every((s) => ['concluido', 'pulada'].includes(s.status))

    if (allDone) await supabase.from('production_orders').update({ status: 'pronto', updated_at: new Date().toISOString() }).eq('id', step.production_order_id)
    else await supabase.from('production_orders').update({ status: 'em_producao', updated_at: new Date().toISOString() }).eq('id', step.production_order_id)

    await carregar()
  }

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#f5f8ff]">
        <div className="rounded-[2rem] bg-white p-8 font-black shadow-xl">Carregando produção...</div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-[#f5f8ff] px-4 py-6 text-slate-950">
      <section className="mx-auto max-w-7xl">
        <header className="mb-6 overflow-hidden rounded-[2.5rem] border border-blue-100 bg-white p-6 shadow-2xl shadow-blue-950/8 sm:p-8">
          <Link href="/painel" className="text-sm font-black text-[#05245c]">← Voltar ao painel</Link>
          <h1 className="mt-4 text-4xl font-black tracking-[-0.05em] text-[#071b3a] sm:text-5xl">Produção e execução</h1>
          <p className="mt-3 max-w-2xl font-bold leading-7 text-slate-500">
            Checklist automático criado quando o cliente aprova a proposta.
          </p>
        </header>

        {erro && <div className="mb-5 rounded-2xl border border-red-100 bg-red-50 p-4 font-bold text-red-700">{erro}</div>}

        <div className="mb-5 grid gap-3 md:grid-cols-5">
          <div className="rounded-2xl bg-white p-4 shadow-lg shadow-blue-950/5">
            <p className="text-sm font-bold text-slate-500">Ordens</p>
            <p className="text-3xl font-black text-[#071b3a]">{metrics.total}</p>
          </div>
          <div className="rounded-2xl bg-white p-4 shadow-lg shadow-blue-950/5">
            <p className="text-sm font-bold text-slate-500">Em andamento</p>
            <p className="text-3xl font-black text-[#05245c]">{metrics.andamento}</p>
          </div>
          <div className="rounded-2xl bg-white p-4 shadow-lg shadow-blue-950/5">
            <p className="text-sm font-bold text-slate-500">Prontas</p>
            <p className="text-3xl font-black text-emerald-700">{metrics.pronto}</p>
          </div>
          <div className="rounded-2xl bg-white p-4 shadow-lg shadow-blue-950/5">
            <p className="text-sm font-bold text-slate-500">Entregues</p>
            <p className="text-3xl font-black text-slate-700">{metrics.entregue}</p>
          </div>
          <div className="rounded-2xl bg-white p-4 shadow-lg shadow-blue-950/5">
            <p className="text-sm font-bold text-slate-500">Valor</p>
            <p className="text-3xl font-black text-emerald-700">{moeda(metrics.valor)}</p>
          </div>
        </div>

        <section className="rounded-[2rem] border border-blue-100 bg-white p-5 shadow-xl shadow-blue-950/5">
          <div className="grid gap-3 md:grid-cols-[1fr_240px]">
            <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar por cliente ou título" className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 font-bold outline-none" />
            <select value={filtro} onChange={(e) => setFiltro(e.target.value)} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 font-bold outline-none">
              <option value="todos">Todos</option>
              <option value="aguardando_sinal">Aguardando sinal</option>
              <option value="aprovado">Aprovado</option>
              <option value="em_producao">Em produção</option>
              <option value="pronto">Pronto</option>
              <option value="entregue">Entregue</option>
              <option value="cancelado">Cancelado</option>
            </select>
          </div>

          <div className="mt-5 grid gap-4">
            {filtradas.length === 0 && <p className="rounded-2xl bg-[#f5f8ff] p-6 text-center font-bold text-slate-500">Nenhuma ordem de produção encontrada.</p>}

            {filtradas.map((order) => {
              const orderSteps = stepsByOrder(order.id)
              const progress = orderSteps.length > 0 ? Math.round((orderSteps.filter((s) => s.status === 'concluido').length / orderSteps.length) * 100) : 0

              return (
                <article key={order.id} className="rounded-[1.5rem] border border-slate-200 bg-white p-4">
                  <div className="grid gap-4 lg:grid-cols-[1fr_240px] lg:items-start">
                    <div>
                      <div className="flex flex-wrap gap-2">
                        <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-black text-[#05245c]">{statusLabel(order.status)}</span>
                        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-black text-slate-600">{progress}% concluído</span>
                      </div>
                      <h3 className="mt-3 text-xl font-black text-[#071b3a]">{order.title}</h3>
                      <p className="mt-1 text-sm font-bold text-slate-500">{order.customer_name || 'Cliente'} • prazo: {dataBR(order.due_date)}</p>
                      <p className="mt-1 text-sm font-black text-[#05245c]">{moeda(Number(order.total_value || 0))}</p>

                      <div className="mt-4 h-3 overflow-hidden rounded-full bg-slate-100">
                        <div className="h-full rounded-full bg-emerald-500" style={{ width: `${progress}%` }} />
                      </div>

                      <div className="mt-4 grid gap-2">
                        {orderSteps.map((step) => (
                          <div key={step.id} className="rounded-2xl bg-[#f5f8ff] p-3">
                            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                              <div>
                                <p className="font-black text-[#071b3a]">{step.sort_order}. {step.title}</p>
                                {step.description && <p className="mt-1 text-sm font-bold text-slate-500">{step.description}</p>}
                                <p className="mt-1 text-xs font-black text-slate-400">{statusLabel(step.status)}</p>
                              </div>
                              <div className="grid grid-cols-3 gap-2 md:min-w-[290px]">
                                <button onClick={() => updateStep(step, 'em_andamento')} className="rounded-xl bg-blue-50 px-3 py-2 text-xs font-black text-[#05245c]">Iniciar</button>
                                <button onClick={() => updateStep(step, 'concluido')} className="rounded-xl bg-emerald-50 px-3 py-2 text-xs font-black text-emerald-700">Concluir</button>
                                <button onClick={() => updateStep(step, 'pulada')} className="rounded-xl bg-slate-100 px-3 py-2 text-xs font-black text-slate-600">Pular</button>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="grid gap-2">
                      <button onClick={() => updateOrder(order.id, 'em_producao')} className="rounded-xl bg-blue-50 px-3 py-3 text-sm font-black text-[#05245c]">Marcar em produção</button>
                      <button onClick={() => updateOrder(order.id, 'pronto')} className="rounded-xl bg-emerald-50 px-3 py-3 text-sm font-black text-emerald-700">Marcar pronto</button>
                      <button onClick={() => updateOrder(order.id, 'entregue')} className="rounded-xl bg-[#05245c] px-3 py-3 text-sm font-black text-white">Marcar entregue</button>
                      {order.proposal_id && <Link href="/painel/propostas" className="rounded-xl bg-slate-100 px-3 py-3 text-center text-sm font-black text-slate-600">Ver proposta</Link>}
                    </div>
                  </div>
                </article>
              )
            })}
          </div>
        </section>
      </section>
    </main>
  )
}
