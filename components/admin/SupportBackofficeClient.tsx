/* eslint-disable @typescript-eslint/no-explicit-any */
// ORCALY_OWNER_BACKOFFICE_V2
'use client'

import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'

function dateBR(value: unknown) {
  if (!value) return '—'
  const d = new Date(String(value))
  return Number.isNaN(d.getTime()) ? '—' : new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short' }).format(d)
}
async function token() { const { data } = await supabase.auth.getSession(); return data.session?.access_token || '' }

export default function SupportBackofficeClient() {
  const router = useRouter()
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')

  const load = useCallback(async () => {
    setLoading(true); setError('')
    const access = await token()
    if (!access) { router.replace('/parceiros/login'); return }
    const response = await fetch('/api/admin/support-center', { headers: { Authorization: `Bearer ${access}` }, cache: 'no-store' })
    const payload = await response.json().catch(() => ({}))
    if (!response.ok) { if ([401,403].includes(response.status)) { router.replace('/parceiros/login'); return }; setError(payload.error || 'Não foi possível carregar o suporte.'); setLoading(false); return }
    setData(payload); setLoading(false)
  }, [router])
  useEffect(() => { void load() }, [load])
  async function logout() { await supabase.auth.signOut(); router.replace('/parceiros/login') }

  const subscribers = data?.subscribers || []
  const partners = data?.partners || []
  const referrals = data?.referrals || []
  const metrics = data?.metrics || {}
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return !q ? subscribers : subscribers.filter((r: any) => [r.nome, r.email, r.slug, r.segmento, r.plan].some((v) => String(v || '').toLowerCase().includes(q)))
  }, [subscribers, search])

  if (loading) return <main className="grid min-h-screen place-items-center bg-[#eef3f9]"><p className="font-black">Carregando área de suporte...</p></main>
  if (!data) return <main className="grid min-h-screen place-items-center bg-[#eef3f9]"><p className="font-black text-red-700">{error || 'Acesso indisponível.'}</p></main>

  return <main className="min-h-screen bg-[#eef3f9] text-[#071b3a]"><header className="border-b border-blue-100 bg-white"><div className="mx-auto flex min-h-20 max-w-[1500px] items-center justify-between gap-4 px-4 sm:px-6"><div><p className="text-xl font-black text-[#05245c]">Orçaly Suporte</p><p className="text-xs font-bold text-slate-400">{data.admin?.nome} · {data.admin?.email}</p></div><div className="flex gap-2"><button onClick={() => void load()} className="rounded-2xl border border-blue-100 px-4 py-3 text-xs font-black text-[#05245c]">Atualizar</button><button onClick={() => void logout()} className="rounded-2xl bg-[#071b3a] px-4 py-3 text-xs font-black text-white">Sair</button></div></div></header><div className="mx-auto max-w-[1500px] px-4 py-6 sm:px-6"><section className="rounded-[2rem] bg-[#071b3a] p-6 text-white shadow-xl"><p className="text-xs font-black uppercase tracking-[0.16em] text-cyan-200/70">Acesso limitado</p><h1 className="mt-3 text-4xl font-black">Central operacional de suporte</h1><p className="mt-4 max-w-3xl text-sm font-semibold leading-7 text-white/55">Situação de assinantes e indicadores sem valores financeiros, chaves Pix, repasses, auditoria ou gestão de equipe.</p></section><div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">{[['Assinantes',metrics.subscribersTotal||0],['Ativos',metrics.active||0],['Teste',metrics.trial||0],['Atrasados',metrics.overdue||0],['Indicações pendentes',metrics.referralsPending||0]].map(([l,v]) => <article key={String(l)} className="rounded-[1.5rem] bg-white p-5 shadow-sm"><p className="text-[10px] font-black uppercase text-slate-400">{l}</p><p className="mt-2 text-3xl font-black text-[#05245c]">{String(v)}</p></article>)}</div><section className="mt-5 rounded-[1.8rem] bg-white p-5 shadow-sm"><div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between"><div><h2 className="text-2xl font-black">Assinantes</h2><p className="mt-1 text-sm font-semibold text-slate-400">Informações operacionais permitidas.</p></div><input value={search} onChange={(e)=>setSearch(e.target.value)} placeholder="Buscar assinante..." className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold"/></div><div className="mt-4 overflow-x-auto"><table className="min-w-[850px] w-full text-left text-sm"><thead className="bg-[#f8faff] text-[10px] font-black uppercase text-slate-400"><tr><th className="px-4 py-4">Empresa</th><th className="px-4 py-4">Plano</th><th className="px-4 py-4">Situação</th><th className="px-4 py-4">Próxima cobrança</th><th className="px-4 py-4">Integração</th><th className="px-4 py-4">Contato</th></tr></thead><tbody className="divide-y divide-slate-100">{filtered.map((r:any)=><tr key={r.id}><td className="px-4 py-4"><p className="font-black">{r.nome||r.id}</p><p className="mt-1 text-xs font-bold text-slate-400">{r.segmento||'—'}</p></td><td className="px-4 py-4 font-bold">{r.plan||'—'}</td><td className="px-4 py-4 font-black">{r.state}</td><td className="px-4 py-4 font-bold text-slate-500">{dateBR(r.nextBillingAt)}</td><td className="px-4 py-4 font-bold text-slate-500">{r.marketplace?.status||'—'}</td><td className="px-4 py-4"><p className="font-bold">{r.email||'Protegido'}</p><p className="mt-1 text-xs font-bold text-slate-400">{r.telefone||'—'}</p></td></tr>)}</tbody></table></div></section>{partners.length ? <section className="mt-5 rounded-[1.8rem] bg-white p-5 shadow-sm"><h2 className="text-2xl font-black">Indicadores</h2><p className="mt-1 text-sm font-semibold text-slate-400">Sem valores de comissão ou dados Pix.</p><div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{partners.slice(0,30).map((p:any)=><article key={p.id} className="rounded-2xl border border-slate-100 p-4"><p className="font-black">{p.name}</p><p className="mt-1 text-xs font-bold text-slate-400">{p.email}</p><p className="mt-2 text-xs font-black uppercase text-[#05245c]">{p.status} · {p.code}</p></article>)}</div></section> : null}{referrals.length ? <section className="mt-5 rounded-[1.8rem] bg-white p-5 shadow-sm"><h2 className="text-2xl font-black">Indicações recentes</h2><div className="mt-4 grid gap-2">{referrals.slice(0,20).map((r:any)=><div key={r.id} className="flex items-center justify-between gap-3 rounded-2xl border border-slate-100 p-4"><div><p className="font-black">{r.code||'Sem código'}</p><p className="mt-1 text-xs font-bold text-slate-400">{r.plan||'—'} · {dateBR(r.createdAt)}</p></div><p className="text-xs font-black uppercase text-[#05245c]">{r.reviewStatus||r.status}</p></div>)}</div></section> : null}</div></main>
}
