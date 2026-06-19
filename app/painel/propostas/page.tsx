'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'

type Proposal = {
  id: string
  company_id: string
  order_id: string | null
  token: string
  proposta_numero: string | null
  titulo: string | null
  cliente_nome: string | null
  cliente_whatsapp: string | null
  valor_total: number | null
  valor_sinal: number | null
  status: string | null
  sent_at: string | null
  viewed_at: string | null
  approved_at: string | null
  rejected_at: string | null
  change_requested_at: string | null
  valid_until: string | null
  created_at: string | null
  pedido_produto?: string | null
  pedido_status?: string | null
}

function moeda(valor: number) {
  return Number(valor || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function dataBR(data?: string | null) {
  if (!data) return 'Sem data'
  return new Date(data).toLocaleDateString('pt-BR')
}

function statusLabel(status?: string | null) {
  const labels: Record<string, string> = {
    rascunho: 'Rascunho',
    enviado: 'Enviado',
    visto: 'Visualizado',
    aprovado: 'Aprovado',
    alteracao_solicitada: 'Alteração solicitada',
    recusado: 'Recusado',
    expirado: 'Expirado',
    cancelado: 'Cancelado',
    pago_sinal: 'Sinal pago',
    convertido: 'Convertido',
  }

  return labels[status || ''] || status || 'Sem status'
}

export default function PropostasPage() {
  const [company, setCompany] = useState<any>(null)
  const [propostas, setPropostas] = useState<Proposal[]>([])
  const [loading, setLoading] = useState(true)
  const [erro, setErro] = useState('')
  const [filtro, setFiltro] = useState('todas')
  const [busca, setBusca] = useState('')

  async function carregar() {
    setLoading(true)
    setErro('')

    try {
      const { data: sessionData } = await supabase.auth.getSession()
      const usuario = sessionData.session?.user

      if (!usuario) {
        window.location.href = '/login'
        return
      }

      const { data: empresaData, error: empresaError } = await supabase
        .from('companies')
        .select('id,nome,slug')
        .or(`owner_id.eq.${usuario.id},tester_id.eq.${usuario.id}`)
        .maybeSingle()

      if (empresaError) throw empresaError
      if (!empresaData) throw new Error('Empresa não encontrada.')

      setCompany(empresaData)

      const { data, error } = await supabase
        .from('proposals_dashboard')
        .select('*')
        .eq('company_id', empresaData.id)
        .order('created_at', { ascending: false })

      if (error) throw error

      setPropostas((data || []) as Proposal[])
    } catch (error) {
      setErro(error instanceof Error ? error.message : 'Erro ao carregar propostas.')
    }

    setLoading(false)
  }

  useEffect(() => {
    carregar()
  }, [])

  const filtradas = useMemo(() => {
    let list = [...propostas]

    if (filtro !== 'todas') list = list.filter((p) => p.status === filtro)

    const q = busca.trim().toLowerCase()
    if (q) {
      list = list.filter((p) =>
        String(p.titulo || '').toLowerCase().includes(q) ||
        String(p.cliente_nome || '').toLowerCase().includes(q) ||
        String(p.proposta_numero || '').toLowerCase().includes(q) ||
        String(p.pedido_produto || '').toLowerCase().includes(q)
      )
    }

    return list
  }, [propostas, filtro, busca])

  const indicadores = useMemo(() => {
    return {
      total: propostas.length,
      aprovadas: propostas.filter((p) => p.status === 'aprovado').length,
      vistas: propostas.filter((p) => p.status === 'visto').length,
      alteracao: propostas.filter((p) => p.status === 'alteracao_solicitada').length,
      valorAprovado: propostas.filter((p) => p.status === 'aprovado').reduce((acc, p) => acc + Number(p.valor_total || 0), 0),
    }
  }, [propostas])

  async function copiar(url: string) {
    await navigator.clipboard.writeText(url)
  }

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#f5f8ff]">
        <div className="rounded-[2rem] bg-white p-8 font-black shadow-xl">Carregando propostas...</div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-[#f5f8ff] px-4 py-6 text-slate-950">
      <section className="mx-auto max-w-7xl">
        <header className="mb-6 overflow-hidden rounded-[2.5rem] border border-blue-100 bg-white p-6 shadow-2xl shadow-blue-950/8 sm:p-8">
          <Link href="/painel" className="text-sm font-black text-[#05245c]">← Voltar ao painel</Link>
          <h1 className="mt-4 text-4xl font-black tracking-[-0.05em] text-[#071b3a] sm:text-5xl">Central de propostas</h1>
          <p className="mt-3 max-w-2xl font-bold leading-7 text-slate-500">
            Acompanhe propostas enviadas, visualizadas, aprovadas, recusadas e pedidos de alteração.
          </p>
        </header>

        {erro && <div className="mb-5 rounded-2xl border border-red-100 bg-red-50 p-4 font-bold text-red-700">{erro}</div>}

        <div className="mb-5 grid gap-3 md:grid-cols-5">
          <div className="rounded-2xl bg-white p-4 shadow-lg shadow-blue-950/5">
            <p className="text-sm font-bold text-slate-500">Total</p>
            <p className="text-3xl font-black text-[#071b3a]">{indicadores.total}</p>
          </div>
          <div className="rounded-2xl bg-white p-4 shadow-lg shadow-blue-950/5">
            <p className="text-sm font-bold text-slate-500">Visualizadas</p>
            <p className="text-3xl font-black text-[#05245c]">{indicadores.vistas}</p>
          </div>
          <div className="rounded-2xl bg-white p-4 shadow-lg shadow-blue-950/5">
            <p className="text-sm font-bold text-slate-500">Aprovadas</p>
            <p className="text-3xl font-black text-emerald-700">{indicadores.aprovadas}</p>
          </div>
          <div className="rounded-2xl bg-white p-4 shadow-lg shadow-blue-950/5">
            <p className="text-sm font-bold text-slate-500">Alterações</p>
            <p className="text-3xl font-black text-amber-600">{indicadores.alteracao}</p>
          </div>
          <div className="rounded-2xl bg-white p-4 shadow-lg shadow-blue-950/5">
            <p className="text-sm font-bold text-slate-500">Aprovado</p>
            <p className="text-3xl font-black text-emerald-700">{moeda(indicadores.valorAprovado)}</p>
          </div>
        </div>

        <section className="rounded-[2rem] border border-blue-100 bg-white p-5 shadow-xl shadow-blue-950/5">
          <div className="grid gap-3 md:grid-cols-[1fr_240px]">
            <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar por cliente, número ou título" className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 font-bold outline-none" />
            <select value={filtro} onChange={(e) => setFiltro(e.target.value)} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 font-bold outline-none">
              <option value="todas">Todas</option>
              <option value="enviado">Enviadas</option>
              <option value="visto">Visualizadas</option>
              <option value="aprovado">Aprovadas</option>
              <option value="alteracao_solicitada">Alteração solicitada</option>
              <option value="recusado">Recusadas</option>
              <option value="expirado">Expiradas</option>
            </select>
          </div>

          <div className="mt-5 grid gap-3">
            {filtradas.length === 0 && <p className="rounded-2xl bg-[#f5f8ff] p-6 text-center font-bold text-slate-500">Nenhuma proposta encontrada.</p>}

            {filtradas.map((proposta) => {
              const url = typeof window !== 'undefined' ? `${window.location.origin}/proposta/${proposta.token}` : `/proposta/${proposta.token}`

              return (
                <article key={proposta.id} className="rounded-[1.5rem] border border-slate-200 bg-white p-4">
                  <div className="grid gap-4 lg:grid-cols-[1fr_190px_220px] lg:items-center">
                    <div>
                      <div className="flex flex-wrap gap-2">
                        <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-black text-[#05245c]">{statusLabel(proposta.status)}</span>
                        {proposta.proposta_numero && <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-black text-slate-600">{proposta.proposta_numero}</span>}
                      </div>
                      <h3 className="mt-3 text-xl font-black text-[#071b3a]">{proposta.titulo || 'Proposta'}</h3>
                      <p className="mt-1 text-sm font-bold text-slate-500">{proposta.cliente_nome || 'Cliente'} • {proposta.pedido_produto || 'Pedido'}</p>
                      <p className="mt-1 text-xs font-bold text-slate-400">Criada em {dataBR(proposta.created_at)} {proposta.valid_until ? `• válida até ${dataBR(proposta.valid_until)}` : ''}</p>
                    </div>

                    <div>
                      <p className="text-sm font-bold text-slate-500">Valor</p>
                      <p className="text-2xl font-black text-[#05245c]">{moeda(Number(proposta.valor_total || 0))}</p>
                      {Number(proposta.valor_sinal || 0) > 0 && <p className="text-xs font-bold text-emerald-700">Sinal: {moeda(Number(proposta.valor_sinal))}</p>}
                    </div>

                    <div className="grid gap-2 sm:grid-cols-3 lg:grid-cols-1">
                      <a href={url} target="_blank" rel="noreferrer" className="rounded-xl bg-[#05245c] px-3 py-3 text-center text-sm font-black text-white">Abrir</a>
                      <button onClick={() => copiar(url)} className="rounded-xl bg-blue-50 px-3 py-3 text-sm font-black text-[#05245c]">Copiar link</button>
                      {proposta.order_id && <Link href={`/painel/proposta/${proposta.order_id}`} className="rounded-xl bg-slate-100 px-3 py-3 text-center text-sm font-black text-slate-600">Pedido</Link>}
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
