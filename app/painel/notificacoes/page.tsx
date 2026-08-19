'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { getAccessTokenClient } from '@/lib/current-company-client'

type Notification = {
  id: string
  tipo?: string | null
  titulo: string
  mensagem?: string | null
  status?: string | null
  link_url?: string | null
  created_at: string
  read_at?: string | null
}

function formatDate(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(date)
}

function tone(type?: string | null) {
  const value = String(type || '').toLowerCase()
  if (value.includes('pag')) return 'bg-emerald-50 text-emerald-700'
  if (value.includes('prazo') || value.includes('tarefa')) return 'bg-amber-50 text-amber-700'
  if (value.includes('erro') || value.includes('cancel')) return 'bg-red-50 text-red-700'
  return 'bg-blue-50 text-blue-700'
}

export default function NotificacoesPage() {
  const [token, setToken] = useState('')
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [unread, setUnread] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [filter, setFilter] = useState<'all' | 'unread'>('all')

  async function load() {
    setLoading(true); setError('')
    try {
      const accessToken = await getAccessTokenClient()
      setToken(accessToken)
      const response = await fetch('/api/notifications', { headers: { Authorization: `Bearer ${accessToken}` }, cache: 'no-store' })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(payload.error || 'Erro ao carregar notificações.')
      setNotifications(payload.notifications || [])
      setUnread(payload.unread || 0)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar notificações.')
    } finally { setLoading(false) }
  }

  useEffect(() => { void load() }, [])

  async function markRead(ids?: string[]) {
    const response = await fetch('/api/notifications', {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(ids ? { ids } : { all: true }),
    })
    if (response.ok) await load()
  }

  const visible = useMemo(() => filter === 'unread' ? notifications.filter((item) => item.status === 'unread') : notifications, [filter, notifications])

  if (loading) return <div className="grid gap-3" aria-label="Carregando notificações">{Array.from({ length: 4 }).map((_, index) => <div key={index} className="h-28 animate-pulse rounded-[1.3rem] bg-slate-100" />)}</div>

  return (
    <main className="grid gap-4 text-[#10233f]">
      <section className="rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-[0_12px_36px_rgba(10,40,82,.055)] sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div><span className="text-[11px] font-extrabold uppercase tracking-[.16em] text-[#4776ad]">Central de notificações</span><h2 className="mt-1 text-2xl font-bold tracking-[-.04em] sm:text-3xl">Eventos que merecem atenção, não uma parede de alertas.</h2><p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500">Pedidos, pagamentos, propostas, prazos, tarefas, clientes, artes e entregas apontam para a entidade que precisa ser resolvida.</p></div>
          <button type="button" disabled={!unread} onClick={() => void markRead()} className="rounded-xl bg-[#0b3b78] px-4 py-2.5 text-sm font-bold text-white disabled:opacity-40">Marcar tudo como lido</button>
        </div>
        <div className="mt-4 flex items-center gap-2"><button type="button" onClick={() => setFilter('all')} className={`rounded-lg px-3 py-2 text-xs font-bold ${filter === 'all' ? 'bg-blue-50 text-blue-700' : 'bg-slate-50 text-slate-500'}`}>Todas · {notifications.length}</button><button type="button" onClick={() => setFilter('unread')} className={`rounded-lg px-3 py-2 text-xs font-bold ${filter === 'unread' ? 'bg-blue-50 text-blue-700' : 'bg-slate-50 text-slate-500'}`}>Não lidas · {unread}</button></div>
      </section>

      {error ? <div role="alert" className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm font-bold text-red-700">{error}</div> : null}

      <section className="grid gap-2.5">
        {visible.map((item) => {
          const unreadItem = item.status === 'unread'
          const content = <><span className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl text-[10px] font-black uppercase ${tone(item.tipo)}`}>{String(item.tipo || 'info').slice(0, 2)}</span><span className="min-w-0 flex-1"><span className="flex flex-wrap items-center gap-2"><strong className="text-sm text-slate-800">{item.titulo}</strong>{unreadItem ? <span className="h-2 w-2 rounded-full bg-blue-600" aria-label="Não lida" /> : null}</span>{item.mensagem ? <span className="mt-1 block text-xs leading-5 text-slate-500">{item.mensagem}</span> : null}<span className="mt-1.5 block text-[10px] font-semibold text-slate-400">{formatDate(item.created_at)}</span></span><span className="shrink-0 text-slate-300" aria-hidden="true">→</span></>
          return <article key={item.id} className={`rounded-[1.15rem] border bg-white transition duration-200 hover:-translate-y-px hover:shadow-md ${unreadItem ? 'border-blue-200 shadow-[0_8px_24px_rgba(11,59,120,.06)]' : 'border-slate-200'}`}>
            {item.link_url ? <Link href={item.link_url} onClick={() => { if (unreadItem) void markRead([item.id]) }} className="flex items-center gap-3 p-4">{content}</Link> : <button type="button" onClick={() => { if (unreadItem) void markRead([item.id]) }} className="flex w-full items-center gap-3 p-4 text-left">{content}</button>}
          </article>
        })}
        {!visible.length ? <div className="grid min-h-48 place-items-center rounded-[1.3rem] border border-dashed border-slate-200 bg-white p-6 text-center"><div><span className="mx-auto grid h-11 w-11 place-items-center rounded-xl bg-emerald-50 font-black text-emerald-700">✓</span><strong className="mt-3 block text-sm text-slate-700">{filter === 'unread' ? 'Tudo lido.' : 'Nenhuma notificação ainda.'}</strong><p className="mt-1 text-xs text-slate-400">Quando algo exigir atenção, aparecerá aqui e na Central do Dia quando aplicável.</p></div></div> : null}
      </section>
    </main>
  )
}
