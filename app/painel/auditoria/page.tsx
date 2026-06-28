'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { getAccessTokenClient } from '@/lib/current-company-client'

function formatDate(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(date)
}

export default function AuditoriaPage() {
  const [health, setHealth] = useState<any>(null)
  const [logs, setLogs] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  async function load() {
    setLoading(true)
    setError('')

    try {
      const token = await getAccessTokenClient()

      const [healthResponse, logsResponse] = await Promise.all([
        fetch('/api/system/health', { headers: { Authorization: `Bearer ${token}` } }),
        fetch('/api/audit/logs', { headers: { Authorization: `Bearer ${token}` } }),
      ])

      const healthPayload = await healthResponse.json().catch(() => ({}))
      const logsPayload = await logsResponse.json().catch(() => ({}))

      if (!healthResponse.ok) throw new Error(healthPayload.error || 'Erro ao verificar sistema.')
      if (!logsResponse.ok) throw new Error(logsPayload.error || 'Erro ao carregar logs.')

      setHealth(healthPayload)
      setLogs(logsPayload.logs || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar auditoria.')
    }

    setLoading(false)
  }

  useEffect(() => {
    load()
  }, [])

  if (loading) {
    return <main className="flex min-h-screen items-center justify-center bg-[#f5f8ff]"><div className="rounded-[2rem] bg-white p-8 font-black shadow-xl">Verificando sistema...</div></main>
  }

  return (
    <main className="min-h-screen bg-[#f5f8ff] px-4 py-6 text-[#071b3a]">
      <section className="mx-auto max-w-7xl space-y-6">
        <header className="rounded-[2rem] border border-blue-100 bg-white p-6 shadow-xl shadow-blue-950/5">
          <Link href="/painel" className="text-sm font-black text-[#05245c]">← Voltar ao painel</Link>
          <p className="mt-5 text-xs font-black uppercase tracking-[0.22em] text-[#05245c]">Sistema</p>
          <h1 className="mt-2 text-4xl font-black tracking-[-0.05em] sm:text-5xl">Auditoria e saúde</h1>
          <p className="mt-3 max-w-3xl font-bold leading-7 text-slate-500">
            Veja integrações, módulos, logs e sinais de configuração. Porque descobrir erro só quando o cliente reclama é uma tradição que podemos aposentar.
          </p>
        </header>

        {error && <div className="rounded-2xl bg-red-50 p-4 font-bold text-red-700">{error}</div>}

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {(health?.checks || []).map((check: any) => (
            <article key={check.key} className="rounded-[1.6rem] border border-blue-100 bg-white p-5 shadow-xl shadow-blue-950/5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xl font-black">{check.title}</p>
                  <p className="mt-2 text-sm font-bold leading-6 text-slate-500">{check.description}</p>
                </div>
                <span className={`rounded-full px-3 py-1 text-xs font-black ${check.ok ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
                  {check.ok ? 'OK' : 'Ajustar'}
                </span>
              </div>
            </article>
          ))}
        </div>

        <section className="rounded-[2rem] border border-blue-100 bg-white p-5 shadow-xl shadow-blue-950/5">
          <h2 className="text-2xl font-black tracking-[-0.04em]">Módulos</h2>
          <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {Object.entries(health?.modules || {}).map(([key, value]: any) => (
              <div key={key} className="rounded-2xl bg-[#f5f8ff] p-4">
                <p className="text-sm font-black text-slate-500">{key}</p>
                <p className="mt-1 text-2xl font-black text-[#05245c]">{value?.ok ? value.count : 'Erro'}</p>
                {!value?.ok && <p className="mt-1 text-xs font-bold text-red-600">{value?.error}</p>}
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-[2rem] border border-blue-100 bg-white p-5 shadow-xl shadow-blue-950/5">
          <h2 className="text-2xl font-black tracking-[-0.04em]">Últimas ações</h2>
          <div className="mt-5 grid gap-3">
            {logs.map((log) => (
              <article key={log.id} className="rounded-[1.4rem] border border-slate-100 bg-white p-4">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="font-black">{log.action}</p>
                    <p className="mt-1 text-sm font-bold text-slate-500">{log.entity || 'sistema'} {log.entity_id ? `• ${log.entity_id}` : ''}</p>
                  </div>
                  <p className="text-sm font-bold text-slate-400">{formatDate(log.created_at)}</p>
                </div>
              </article>
            ))}

            {logs.length === 0 && (
              <div className="rounded-[1.4rem] border border-dashed border-slate-200 bg-white p-8 text-center font-bold text-slate-400">
                Nenhum log ainda.
              </div>
            )}
          </div>
        </section>
      </section>
    </main>
  )
}
