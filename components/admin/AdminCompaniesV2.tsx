'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

type Company = { id: string; nome?: string; email?: string; slug?: string; segmento?: string; assinatura_plano?: string; plano?: string; state: string; created_at?: string; onboarding_completed?: boolean; is_founder?: boolean; founder_number?: number }
type Payload = { rows: Company[]; hasMore: boolean; nextCursor: string | null }

function badge(state: string) { if (state === 'active') return 'bg-emerald-50 text-emerald-700'; if (state === 'trial') return 'bg-blue-50 text-blue-700'; if (state === 'overdue') return 'bg-red-50 text-red-700'; if (state === 'canceling') return 'bg-amber-50 text-amber-700'; return 'bg-slate-100 text-slate-600' }
function label(state: string) { return ({ active: 'Ativa', trial: 'Trial', overdue: 'Em atraso', canceling: 'Cancelando', inactive: 'Inativa', pending: 'Pendente' } as Record<string, string>)[state] || state }

export default function AdminCompaniesV2() {
  const [rows, setRows] = useState<Company[]>([])
  const [query, setQuery] = useState('')
  const [committed, setCommitted] = useState('')
  const [status, setStatus] = useState('all')
  const [cursor, setCursor] = useState<string | null>(null)
  const [hasMore, setHasMore] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [version, setVersion] = useState(0)

  useEffect(() => {
    let active = true
    setLoading(true)
    void supabase.auth.getSession().then(async ({ data }) => {
      const params = new URLSearchParams({ limit: '30', status })
      if (committed) params.set('q', committed)
      if (cursor) params.set('before', cursor)
      const response = await fetch(`/api/admin/companies-v2?${params}`, { headers: { Authorization: `Bearer ${data.session?.access_token || ''}` }, cache: 'no-store' })
      const payload = await response.json().catch(() => ({}))
      if (!active) return
      if (!response.ok) { setError(payload.error || 'Não foi possível carregar empresas.'); setLoading(false); return }
      const next = payload as Payload
      setRows((current) => cursor ? [...current, ...next.rows] : next.rows)
      setHasMore(next.hasMore); setCursor(next.nextCursor); setError(''); setLoading(false)
    })
    return () => { active = false }
  }, [committed, status, version])

  function reset(nextStatus = status, nextQuery = committed) {
    setRows([]); setCursor(null); setStatus(nextStatus); setCommitted(nextQuery); setVersion((value) => value + 1)
  }

  return <div className="space-y-4"><section className="rounded-3xl border border-slate-200 bg-white p-5 sm:p-6"><div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between"><div><p className="text-[10px] font-semibold uppercase tracking-[.12em] text-slate-400">Empresas</p><h1 className="mt-1 text-3xl font-semibold tracking-[-.04em] text-[#0b2e63]">Empresa 360 começa pela busca.</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">Lista paginada no servidor. Abra uma empresa para assinatura, uso, usuários, pagamentos, integrações, segurança e auditoria.</p></div><form onSubmit={(event) => { event.preventDefault(); reset(status, query.trim()) }} className="flex w-full max-w-xl gap-2"><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Nome, e-mail ou slug" className="min-w-0 flex-1 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-[#0b2e63]"/><button className="rounded-xl bg-[#0b2e63] px-4 py-3 text-sm font-semibold text-white">Buscar</button></form></div><div className="mt-5 flex flex-wrap gap-2">{[['all','Todas'],['trial','Trials'],['overdue','Em atraso'],['canceling','Cancelando'],['inactive','Inativas']].map(([key, text]) => <button type="button" key={key} onClick={() => reset(key, committed)} className={`rounded-xl px-3 py-2 text-xs font-semibold ${status === key ? 'bg-[#0b2e63] text-white' : 'bg-slate-100 text-slate-600'}`}>{text}</button>)}</div></section>
  {error ? <div className="rounded-xl border border-red-100 bg-red-50 p-3 text-sm font-semibold text-red-700">{error}</div> : null}
  <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white"><div className="hidden grid-cols-[minmax(220px,1.5fr)_1fr_120px_130px_90px] gap-3 border-b border-slate-100 bg-slate-50 px-4 py-3 text-[9px] font-semibold uppercase tracking-[.1em] text-slate-400 md:grid"><span>Empresa</span><span>Plano / segmento</span><span>Status</span><span>Onboarding</span><span/></div>{rows.map((company) => <article key={company.id} className="grid gap-3 border-b border-slate-100 p-4 last:border-0 md:grid-cols-[minmax(220px,1.5fr)_1fr_120px_130px_90px] md:items-center"><div className="min-w-0"><div className="flex items-center gap-2"><strong className="truncate text-sm font-semibold">{company.nome || company.email || 'Empresa'}</strong>{company.is_founder ? <span className="rounded-md bg-violet-50 px-2 py-1 text-[9px] font-semibold text-violet-700">Founder {company.founder_number || ''}</span> : null}</div><span className="mt-1 block truncate text-xs text-slate-400">{company.email || 'sem e-mail'} · /{company.slug || 'sem-slug'}</span></div><div><strong className="block text-xs font-semibold">{company.assinatura_plano || company.plano || 'Sem plano'}</strong><span className="text-[11px] text-slate-400">{company.segmento || 'segmento não informado'}</span></div><div><span className={`inline-flex rounded-lg px-2.5 py-1.5 text-[10px] font-semibold ${badge(company.state)}`}>{label(company.state)}</span></div><div><span className={`text-xs font-semibold ${company.onboarding_completed ? 'text-emerald-600' : 'text-amber-600'}`}>{company.onboarding_completed ? 'Concluído' : 'Incompleto'}</span></div><Link href={`/admin/empresas/${company.id}`} className="rounded-xl border border-slate-200 px-3 py-2 text-center text-xs font-semibold text-[#0b2e63] hover:bg-slate-50">Abrir</Link></article>)}{loading ? <div className="p-6 text-center text-sm text-slate-400">Carregando…</div> : null}{!loading && !rows.length ? <div className="p-10 text-center"><strong className="text-sm font-semibold">Nenhuma empresa corresponde aos filtros.</strong></div> : null}</section>
  {hasMore && !loading ? <button type="button" onClick={() => setVersion((value) => value + 1)} className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-[#0b2e63]">Carregar mais</button> : null}</div>
}
