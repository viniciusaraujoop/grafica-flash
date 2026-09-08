'use client'

import Link from 'next/link'
import { useCallback, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

type Customer = { id: string; display_name?: string | null; phone_normalized?: string | null; email_normalized?: string | null; phone_raw?: string | null; email_raw?: string | null }
type Candidate = { id: string; reasons: string[]; confidence: number; left_customer_id: string; right_customer_id: string; left?: Customer; right?: Customer }

async function authHeaders(): Promise<Record<string, string>> {
  const { data } = await supabase.auth.getSession()
  const token = data.session?.access_token
  return token ? { Authorization: `Bearer ${token}` } : {}
}

export default function DuplicateReviewPage() {
  const [rows, setRows] = useState<Candidate[]>([])
  const [loading, setLoading] = useState(true)
  const [working, setWorking] = useState('')
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    const headers = await authHeaders()
    const response = await fetch('/api/customer-duplicates', { headers, cache: 'no-store' })
    const data = await response.json().catch(() => null)
    if (!response.ok) setError(data?.error || 'Não foi possível carregar candidatos.')
    else setRows(data.candidates || [])
    setLoading(false)
  }, [])

  useEffect(() => { void load() }, [load])

  async function act(candidate: Candidate, action: 'dismiss' | 'merge', keepId?: string, mergeId?: string) {
    setWorking(candidate.id)
    setError('')
    setMessage('')
    const headers = await authHeaders()
    const response = await fetch('/api/customer-duplicates', {
      method: 'POST', headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, candidateId: candidate.id, keepId, mergeId }),
    })
    const data = await response.json().catch(() => null)
    if (!response.ok) setError(data?.error || 'A revisão falhou.')
    else { setMessage(action === 'merge' ? 'Perfis mesclados e referências preservadas.' : 'Candidato marcado como não duplicado.'); await load() }
    setWorking('')
  }

  return (
    <main className="min-h-screen bg-[#f5f8ff] px-4 py-6 text-slate-950">
      <section className="mx-auto max-w-6xl">
        <header className="rounded-[2rem] border border-blue-100 bg-white p-6 shadow-xl shadow-blue-950/5 sm:p-8">
          <Link href="/painel/clientes-360" className="text-sm font-black text-[#0b3b78]">← Customer 360</Link>
          <h1 className="mt-3 text-3xl font-black tracking-[-.035em] text-[#071b3a] sm:text-4xl">Revisão de duplicidades</h1>
          <p className="mt-2 max-w-2xl font-semibold leading-7 text-slate-500">Sinais normalizados ajudam a encontrar candidatos. A decisão continua humana; merge automático de identidade ambígua continua proibido.</p>
        </header>

        {message ? <div role="status" className="mt-4 rounded-2xl border border-emerald-100 bg-emerald-50 p-4 font-bold text-emerald-800">{message}</div> : null}
        {error ? <div role="alert" className="mt-4 rounded-2xl border border-red-100 bg-red-50 p-4 font-bold text-red-800">{error}</div> : null}

        <section className="mt-5 grid gap-4">
          {loading ? <div className="rounded-[2rem] bg-white p-8 text-center font-black shadow-xl">Carregando candidatos…</div> : null}
          {!loading && rows.length === 0 ? <div className="rounded-[2rem] border border-dashed border-slate-200 bg-white p-10 text-center"><h2 className="text-xl font-black text-[#071b3a]">Fila limpa</h2><p className="mt-2 font-semibold text-slate-500">Nenhuma possível duplicidade aguardando revisão.</p></div> : null}
          {rows.map((row) => <article key={row.id} className="rounded-[2rem] border border-blue-100 bg-white p-5 shadow-xl shadow-blue-950/5">
            <div className="flex flex-wrap items-center justify-between gap-3"><div><span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-black text-amber-800">Confiança {row.confidence}%</span><p className="mt-2 text-sm font-bold text-slate-500">Sinais: {(row.reasons || []).join(', ') || 'similaridade detectada'}</p></div><button type="button" disabled={working === row.id} onClick={() => void act(row, 'dismiss')} className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-black text-slate-700 disabled:opacity-50">Não são duplicados</button></div>
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <CustomerCard label="Perfil A" customer={row.left} onKeep={() => row.left && row.right && void act(row, 'merge', row.left.id, row.right.id)} disabled={working === row.id} />
              <CustomerCard label="Perfil B" customer={row.right} onKeep={() => row.left && row.right && void act(row, 'merge', row.right.id, row.left.id)} disabled={working === row.id} />
            </div>
          </article>)}
        </section>
      </section>
    </main>
  )
}

function CustomerCard({ label, customer, onKeep, disabled }: { label: string; customer?: Customer; onKeep: () => void; disabled: boolean }) {
  return <div className="rounded-2xl border border-slate-200 bg-[#f8fbff] p-4"><p className="text-[10px] font-black uppercase tracking-[.15em] text-slate-400">{label}</p><h2 className="mt-2 text-lg font-black text-[#071b3a]">{customer?.display_name || 'Cliente sem nome'}</h2><p className="mt-1 text-sm font-semibold text-slate-500">{customer?.phone_normalized || customer?.phone_raw || 'Sem telefone'}</p><p className="text-sm font-semibold text-slate-500">{customer?.email_normalized || customer?.email_raw || 'Sem e-mail'}</p>{customer ? <div className="mt-4 flex gap-2"><Link href={`/painel/clientes-360/${customer.id}`} className="rounded-xl border border-blue-100 bg-white px-3 py-2 text-sm font-black text-[#0b3b78]">Revisar</Link><button type="button" disabled={disabled} onClick={onKeep} className="rounded-xl bg-[#0b3b78] px-3 py-2 text-sm font-black text-white disabled:opacity-50">Manter este e mesclar outro</button></div> : null}</div>
}
