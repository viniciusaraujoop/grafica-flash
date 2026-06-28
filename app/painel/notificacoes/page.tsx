'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { getAccessTokenClient } from '@/lib/current-company-client'

function formatDate(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(date)
}

export default function NotificacoesPage() {
  const [token, setToken] = useState('')
  const [notifications, setNotifications] = useState<any[]>([])
  const [unread, setUnread] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  async function load() {
    setLoading(true)
    setError('')

    try {
      const accessToken = await getAccessTokenClient()
      setToken(accessToken)

      const response = await fetch('/api/notifications', {
        headers: { Authorization: `Bearer ${accessToken}` },
      })

      const payload = await response.json().catch(() => ({}))

      if (!response.ok) throw new Error(payload.error || 'Erro ao carregar notificações.')

      setNotifications(payload.notifications || [])
      setUnread(payload.unread || 0)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar notificações.')
    }

    setLoading(false)
  }

  useEffect(() => {
    load()
  }, [])

  async function markAllRead() {
    const response = await fetch('/api/notifications', {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ all: true }),
    })

    if (response.ok) await load()
  }

  if (loading) {
    return <main className="flex min-h-screen items-center justify-center bg-[#f5f8ff]"><div className="rounded-[2rem] bg-white p-8 font-black shadow-xl">Carregando notificações...</div></main>
  }

  return (
    <main className="min-h-screen bg-[#f5f8ff] px-4 py-6 text-[#071b3a]">
      <section className="mx-auto max-w-5xl space-y-6">
        <header className="rounded-[2rem] border border-blue-100 bg-white p-6 shadow-xl shadow-blue-950/5">
          <Link href="/painel" className="text-sm font-black text-[#05245c]">← Voltar ao painel</Link>
          <div className="mt-5 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.22em] text-[#05245c]">Central</p>
              <h1 className="mt-2 text-4xl font-black tracking-[-0.05em] sm:text-5xl">Notificações</h1>
              <p className="mt-3 max-w-3xl font-bold leading-7 text-slate-500">Alertas do sistema, tarefas, CRM, pedidos, cupons e eventos importantes.</p>
            </div>
            <button onClick={markAllRead} className="rounded-2xl bg-[#05245c] px-5 py-4 font-black text-white">Marcar tudo como lido</button>
          </div>
        </header>

        {error && <div className="rounded-2xl bg-red-50 p-4 font-bold text-red-700">{error}</div>}

        <div className="rounded-[2rem] border border-blue-100 bg-white p-5 shadow-xl shadow-blue-950/5">
          <p className="mb-4 text-sm font-black text-slate-500">{unread} não lida(s)</p>

          <div className="grid gap-3">
            {notifications.map((item) => (
              <article key={item.id} className={`rounded-[1.4rem] border p-4 ${item.status === 'unread' ? 'border-[#05245c] bg-blue-50' : 'border-slate-100 bg-white'}`}>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <p className="text-xs font-black uppercase tracking-[0.18em] text-[#05245c]">{item.tipo}</p>
                    <h2 className="mt-1 text-lg font-black">{item.titulo}</h2>
                    {item.mensagem && <p className="mt-2 font-bold leading-6 text-slate-500">{item.mensagem}</p>}
                    <p className="mt-2 text-xs font-bold text-slate-400">{formatDate(item.created_at)}</p>
                  </div>
                  {item.link_url && <Link href={item.link_url} className="rounded-2xl bg-white px-4 py-3 text-sm font-black text-[#05245c]">Abrir</Link>}
                </div>
              </article>
            ))}

            {notifications.length === 0 && (
              <div className="rounded-[1.4rem] border border-dashed border-slate-200 bg-white p-8 text-center font-bold text-slate-400">
                Nenhuma notificação ainda.
              </div>
            )}
          </div>
        </div>
      </section>
    </main>
  )
}
