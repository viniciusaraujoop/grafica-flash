'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'

function moeda(valor: number) {
  return Number(valor || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function dataBR(valor?: string | null) {
  if (!valor) return 'Sem data'
  return new Date(valor).toLocaleDateString('pt-BR')
}

export default function ClientePortalPage() {
  const params = useParams<{ token: string }>()
  const token = Array.isArray(params?.token) ? params.token[0] : params?.token

  const [company, setCompany] = useState<any>(null)
  const [orders, setOrders] = useState<any[]>([])
  const [proposals, setProposals] = useState<any[]>([])
  const [link, setLink] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  async function load() {
    setLoading(true)
    setError('')

    const response = await fetch(`/api/cliente/${token}`)
    const payload = await response.json()

    if (!response.ok) {
      setError(payload.error || 'Área do cliente não encontrada.')
      setLoading(false)
      return
    }

    setCompany(payload.company)
    setOrders(payload.orders || [])
    setProposals(payload.proposals || [])
    setLink(payload.link)
    setLoading(false)
  }

  useEffect(() => {
    if (token) load()
  }, [token])

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#f5f8ff] px-4">
        <div className="rounded-[2rem] bg-white p-8 font-black shadow-xl">Carregando sua área...</div>
      </main>
    )
  }

  if (error) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#f5f8ff] px-4">
        <div className="max-w-lg rounded-[2rem] bg-white p-8 text-center shadow-xl">
          <h1 className="text-3xl font-black text-[#071b3a]">Link indisponível</h1>
          <p className="mt-3 font-bold text-red-600">{error}</p>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-[#f5f8ff] px-4 py-8 text-[#071b3a]">
      <section className="mx-auto max-w-6xl space-y-6">
        <header className="rounded-[2rem] border border-blue-100 bg-white p-6 shadow-xl shadow-blue-950/5">
          <p className="text-sm font-black uppercase tracking-[0.2em] text-[#05245c]">Área do cliente</p>
          <h1 className="mt-2 text-4xl font-black tracking-[-0.05em]">{company?.nome || 'Empresa'}</h1>
          <p className="mt-3 font-bold text-slate-500">Olá, {link?.customer_name || 'cliente'}! Aqui ficam seus orçamentos, propostas e pedidos.</p>
        </header>

        <div className="grid gap-6 lg:grid-cols-2">
          <section className="rounded-[2rem] border border-blue-100 bg-white p-5 shadow-xl shadow-blue-950/5">
            <h2 className="text-2xl font-black">Meus pedidos</h2>
            <div className="mt-5 grid gap-3">
              {orders.map((order) => (
                <article key={order.id} className="rounded-[1.4rem] bg-[#f5f8ff] p-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="font-black">{order.produto || 'Pedido'}</p>
                      <p className="mt-1 text-sm font-bold text-slate-500">{dataBR(order.created_at)}</p>
                    </div>
                    <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-black text-[#05245c]">{order.status || 'Recebido'}</span>
                  </div>
                  <p className="mt-3 font-black text-[#05245c]">{moeda(order.valor_total || order.preco_estimado || 0)}</p>
                </article>
              ))}
              {orders.length === 0 && <p className="font-bold text-slate-500">Nenhum pedido encontrado.</p>}
            </div>
          </section>

          <section className="rounded-[2rem] border border-blue-100 bg-white p-5 shadow-xl shadow-blue-950/5">
            <h2 className="text-2xl font-black">Minhas propostas</h2>
            <div className="mt-5 grid gap-3">
              {proposals.map((proposal) => (
                <a key={proposal.id} href={`/proposta/${proposal.token}`} className="rounded-[1.4rem] bg-[#f5f8ff] p-4 transition hover:bg-blue-50">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="font-black">{proposal.titulo || proposal.proposta_numero || 'Proposta'}</p>
                      <p className="mt-1 text-sm font-bold text-slate-500">{dataBR(proposal.created_at)}</p>
                    </div>
                    <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-black text-emerald-700">{proposal.status || 'enviada'}</span>
                  </div>
                  <p className="mt-3 font-black text-[#05245c]">{moeda(proposal.valor_total || 0)}</p>
                </a>
              ))}
              {proposals.length === 0 && <p className="font-bold text-slate-500">Nenhuma proposta encontrada.</p>}
            </div>
          </section>
        </div>
      </section>
    </main>
  )
}
