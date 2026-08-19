'use client'

import { useEffect, useState } from 'react'
import { getAccessTokenClient } from '@/lib/current-company-client'

type Opportunity = {
  id: string
  orderId: string
  customerName: string
  customerPhone: string
  product: string
  lastPurchaseAt: string | null
  daysSince: number
  previousPurchases: number
  previousValue: number
  score: number
  suggestion: string
}

function money(value: number) {
  return Number(value || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function wa(phone: string, customerName: string, product: string) {
  const digits = phone.replace(/\D/g, '')
  const normalized = digits.startsWith('55') ? digits : `55${digits}`
  const message = `Olá, ${customerName}! Tudo bem? Vi aqui que você já pediu ${product} com a gente. Posso preparar uma nova proposta para você?`
  return `https://wa.me/${normalized}?text=${encodeURIComponent(message)}`
}

export default function RepurchaseOpportunitiesPanel({ compact = false }: { compact?: boolean }) {
  const [items, setItems] = useState<Opportunity[]>([])
  const [token, setToken] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  async function load() {
    setLoading(true)
    try {
      const accessToken = await getAccessTokenClient()
      setToken(accessToken)
      const response = await fetch('/api/opportunities/repurchase', {
        headers: { Authorization: `Bearer ${accessToken}` }, cache: 'no-store',
      })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(payload.error || 'Não foi possível analisar recompra.')
      setItems(payload.opportunities || [])
      setError('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível analisar recompra.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { void load() }, [])

  async function ignore(orderId: string) {
    const response = await fetch('/api/opportunities/repurchase', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'ignore', order_id: orderId }),
    })
    if (response.ok) setItems((current) => current.filter((item) => item.orderId !== orderId))
  }

  if (loading) return <div className="h-32 animate-pulse rounded-[1.35rem] bg-slate-100" aria-label="Analisando oportunidades de recompra" />
  if (error || !items.length) return null

  const visible = items.slice(0, compact ? 3 : 5)

  return (
    <section className="rounded-[1.35rem] border border-slate-200 bg-white p-4 shadow-[0_10px_30px_rgba(10,40,82,.05)] sm:p-5" aria-labelledby={compact ? 'crm-repurchase-title' : 'today-repurchase-title'}>
      <div className="flex items-end justify-between gap-3">
        <div>
          <span className="text-[10px] font-extrabold uppercase tracking-[.14em] text-[#4776ad]">Oportunidades de recompra</span>
          <h3 id={compact ? 'crm-repurchase-title' : 'today-repurchase-title'} className="mt-1 text-lg font-bold tracking-[-.03em] text-[#10233f]">Clientes que podem estar prontos para comprar de novo</h3>
        </div>
        <span className="shrink-0 rounded-full bg-blue-50 px-2.5 py-1 text-[10px] font-extrabold text-blue-700">{items.length} sugestão(ões)</span>
      </div>

      <div className="mt-3 grid gap-2">
        {visible.map((item) => (
          <article key={item.id} className="grid gap-3 rounded-xl border border-slate-100 bg-slate-50/70 p-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <strong className="truncate text-sm text-slate-800">{item.customerName}</strong>
                <span className="rounded-full bg-white px-2 py-0.5 text-[9px] font-black text-[#174e93] ring-1 ring-slate-200">score {item.score}</span>
              </div>
              <p className="mt-1 text-xs font-semibold text-slate-500">{item.product} · há {item.daysSince} dias · última compra {money(item.previousValue)}</p>
              <p className="mt-1 text-[11px] leading-5 text-slate-400">{item.suggestion}</p>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {item.customerPhone ? <a href={wa(item.customerPhone, item.customerName, item.product)} target="_blank" rel="noreferrer" className="rounded-lg bg-emerald-50 px-3 py-2 text-[10px] font-extrabold text-emerald-700">WhatsApp</a> : null}
              <a href={`/painel/pedidos/${item.orderId}`} className="rounded-lg bg-blue-50 px-3 py-2 text-[10px] font-extrabold text-blue-700">Ver pedido</a>
              <button type="button" onClick={() => void ignore(item.orderId)} className="rounded-lg px-2 py-2 text-[10px] font-bold text-slate-400 hover:bg-white hover:text-slate-600">Ignorar</button>
            </div>
          </article>
        ))}
      </div>
    </section>
  )
}
