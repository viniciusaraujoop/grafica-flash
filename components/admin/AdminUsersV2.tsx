'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

type UserRow = { id: string; company_id: string; user_id: string; nome: string; email: string; cargo: string; status: string; created_at?: string; companyName: string }
type Payload = { rows: UserRow[]; hasMore: boolean; nextCursor: string | null }

export default function AdminUsersV2() {
  const [rows, setRows] = useState<UserRow[]>([])
  const [query, setQuery] = useState('')
  const [committed, setCommitted] = useState('')
  const [cursor, setCursor] = useState<string | null>(null)
  const [hasMore, setHasMore] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [version, setVersion] = useState(0)

  useEffect(() => {
    let active = true; setLoading(true)
    void supabase.auth.getSession().then(async ({ data }) => {
      const params = new URLSearchParams({ limit: '30' }); if (committed) params.set('q', committed); if (cursor) params.set('before', cursor)
      const response = await fetch(`/api/admin/users-v2?${params}`, { headers: { Authorization: `Bearer ${data.session?.access_token || ''}` }, cache: 'no-store' })
      const payload = await response.json().catch(() => ({}))
      if (!active) return
      if (!response.ok) { setError(payload.error || 'Não foi possível carregar usuários.'); setLoading(false); return }
      const next = payload as Payload; setRows((current) => cursor ? [...current, ...next.rows] : next.rows); setHasMore(next.hasMore); setCursor(next.nextCursor); setError(''); setLoading(false)
    })
    return () => { active = false }
  }, [committed, version])

  return <div className="space-y-4"><section className="rounded-3xl border border-slate-200 bg-white p-5 sm:p-6"><div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between"><div><p className="text-[10px] font-semibold uppercase tracking-[.12em] text-slate-400">Usuários</p><h1 className="mt-1 text-3xl font-semibold tracking-[-.04em] text-[#0b2e63]">Identidades e memberships.</h1><p className="mt-2 text-sm text-slate-500">Nenhuma senha é consultada ou exibida. Esta visão lista memberships existentes com paginação.</p></div><form onSubmit={(event) => { event.preventDefault(); setRows([]); setCursor(null); setCommitted(query.trim()); setVersion((v) => v + 1) }} className="flex w-full max-w-xl gap-2"><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Nome, e-mail ou cargo" className="min-w-0 flex-1 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-[#0b2e63]"/><button className="rounded-xl bg-[#0b2e63] px-4 py-3 text-sm font-semibold text-white">Buscar</button></form></div></section>{error ? <div className="rounded-xl border border-red-100 bg-red-50 p-3 text-sm font-semibold text-red-700">{error}</div> : null}<section className="overflow-hidden rounded-2xl border border-slate-200 bg-white">{rows.map((row) => <article key={row.id} className="grid gap-2 border-b border-slate-100 p-4 last:border-0 md:grid-cols-[minmax(180px,1fr)_minmax(180px,1fr)_140px_120px] md:items-center"><div><strong className="text-sm font-semibold">{row.nome || row.email}</strong><span className="mt-1 block text-xs text-slate-400">{row.email}</span></div><div><strong className="text-xs font-semibold">{row.companyName}</strong><span className="mt-1 block text-[11px] text-slate-400">{row.company_id}</span></div><span className="text-xs font-semibold text-slate-500">{row.cargo}</span><span className={`w-fit rounded-lg px-2.5 py-1.5 text-[10px] font-semibold ${row.status === 'ativo' ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>{row.status}</span></article>)}{loading ? <div className="p-6 text-center text-sm text-slate-400">Carregando…</div> : null}{!loading && !rows.length ? <div className="p-10 text-center text-sm text-slate-400">Nenhum usuário corresponde à busca.</div> : null}</section>{hasMore && !loading ? <button onClick={() => setVersion((v) => v + 1)} className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-[#0b2e63]">Carregar mais</button> : null}</div>
}
