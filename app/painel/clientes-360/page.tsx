'use client'

import Link from 'next/link'
import { useCallback, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

type Customer = {
  id: string
  display_name?: string | null
  phone_raw?: string | null
  phone_normalized?: string | null
  email_raw?: string | null
  email_normalized?: string | null
  source: string
  last_activity_at?: string | null
  duplicateSignals: number
}

async function authHeaders() {
  const { data } = await supabase.auth.getSession()
  const token = data.session?.access_token
  return token ? { Authorization: `Bearer ${token}` } : {}
}

export default function CustomerDirectoryPage() {
  const [customers, setCustomers] = useState<Customer[]>([])
  const [duplicates, setDuplicates] = useState(0)
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(true)
  const [working, setWorking] = useState(false)
  const [error, setError] = useState('')

  const load = useCallback(async (q = query) => {
    setLoading(true)
    setError('')
    const headers = await authHeaders()
    const params = new URLSearchParams()
    if (q.trim()) params.set('q', q.trim())
    const response = await fetch(`/api/customer-directory?${params}`, { headers, cache: 'no-store' })
    const data = await response.json().catch(() => null)
    if (!response.ok) setError(data?.error || 'Não foi possível carregar clientes.')
    else {
      setCustomers(data.customers || [])
      setDuplicates(Number(data.duplicateCandidates || 0))
    }
    setLoading(false)
  }, [query])

  useEffect(() => { void load('') }, [])

  async function refresh() {
    setWorking(true)
    setError('')
    const headers = await authHeaders()
    const response = await fetch('/api/customer-directory', { method: 'POST', headers: { ...headers, 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'refresh' }) })
    const data = await response.json().catch(() => null)
    if (!response.ok) setError(data?.error || 'Não foi possível atualizar o diretório.')
    else await load(query)
    setWorking(false)
  }

  return (
    <main className="min-h-screen bg-[#f5f8ff] px-4 py-6 text-slate-950">
      <section className="mx-auto max-w-7xl">
        <header className="rounded-[2rem] border border-blue-100 bg-white p-6 shadow-xl shadow-blue-950/5 sm:p-8">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-[.18em] text-[#0b3b78]">Customer 360</p>
              <h1 className="mt-2 text-3xl font-black tracking-[-.035em] text-[#071b3a] sm:text-4xl">Diretório canônico de clientes</h1>
              <p className="mt-2 max-w-2xl font-semibold leading-7 text-slate-500">Identidade normalizada ligada a pedidos, CRM, propostas, notas, financeiro permitido e timeline, sem quebrar o Mini-CRM histórico.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Link href="/painel/clientes" className="rounded-2xl border border-slate-200 bg-white px-4 py-3 font-black text-slate-700">Mini-CRM</Link>
              <Link href="/painel/duplicidades" className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 font-black text-amber-800">Duplicidades {duplicates ? `(${duplicates})` : ''}</Link>
              <button type="button" disabled={working} onClick={() => void refresh()} className="rounded-2xl bg-[#0b3b78] px-4 py-3 font-black text-white disabled:opacity-60">{working ? 'Atualizando…' : 'Atualizar diretório'}</button>
            </div>
          </div>
        </header>

        {error ? <div role="alert" className="mt-4 rounded-2xl border border-red-100 bg-red-50 p-4 font-bold text-red-800">{error}</div> : null}

        <section className="mt-5 rounded-[2rem] border border-blue-100 bg-white p-5 shadow-xl shadow-blue-950/5">
          <form className="flex flex-col gap-3 sm:flex-row" onSubmit={(event) => { event.preventDefault(); void load(query) }}>
            <label className="sr-only" htmlFor="customer-search">Buscar cliente</label>
            <input id="customer-search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Nome, telefone ou e-mail" className="min-w-0 flex-1 rounded-2xl border border-slate-200 px-4 py-3 font-semibold outline-none focus:border-[#0b3b78]" />
            <button className="rounded-2xl bg-slate-900 px-5 py-3 font-black text-white">Buscar</button>
          </form>

          <div className="mt-5 grid gap-3">
            {loading ? <div className="rounded-2xl bg-slate-50 p-8 text-center font-bold text-slate-500">Carregando diretório…</div> : null}
            {!loading && customers.length === 0 ? <div className="rounded-2xl border border-dashed border-slate-200 p-8 text-center"><p className="font-black text-[#071b3a]">Nenhum perfil encontrado</p><p className="mt-1 text-sm font-semibold text-slate-500">Atualize o diretório para sintetizar as fontes operacionais atuais.</p></div> : null}
            {customers.map((customer) => (
              <Link key={customer.id} href={`/painel/clientes-360/${customer.id}`} className="group rounded-2xl border border-slate-200 p-4 transition hover:-translate-y-0.5 hover:border-blue-200 hover:shadow-lg hover:shadow-blue-950/5 focus:outline-none focus:ring-2 focus:ring-blue-300">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="truncate text-lg font-black text-[#071b3a]">{customer.display_name || 'Cliente sem nome'}</h2>
                      <span className="rounded-full bg-blue-50 px-2.5 py-1 text-xs font-black text-[#0b3b78]">{customer.source}</span>
                      {customer.duplicateSignals ? <span className="rounded-full bg-amber-50 px-2.5 py-1 text-xs font-black text-amber-800">{customer.duplicateSignals} sinal(is)</span> : null}
                    </div>
                    <p className="mt-1 truncate text-sm font-semibold text-slate-500">{customer.phone_normalized || customer.phone_raw || 'Sem telefone'} · {customer.email_normalized || customer.email_raw || 'Sem e-mail'}</p>
                  </div>
                  <div className="shrink-0 text-sm font-bold text-slate-400">{customer.last_activity_at ? `Atividade ${new Date(customer.last_activity_at).toLocaleDateString('pt-BR')}` : 'Sem atividade'} <span className="ml-2 text-slate-300 group-hover:text-[#0b3b78]">→</span></div>
                </div>
              </Link>
            ))}
          </div>
        </section>
      </section>
    </main>
  )
}
