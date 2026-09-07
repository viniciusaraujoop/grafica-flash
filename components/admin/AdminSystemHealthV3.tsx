'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

type Status = 'Operational' | 'Degraded' | 'Down' | 'Unknown'
type Service = {
  key: string
  name: string
  status: Status
  detail: string
  observedAt?: string | null
}
type RecentError = {
  errorId: string | null
  route: string
  operation: string
  type: string
  code: string | null
  httpStatus: number | null
  createdAt: string | null
}
type Payload = {
  generatedAt: string
  requestId: string
  services: Service[]
  metrics: {
    webhookFailures24h: number | null
    whatsappFailures24h: number | null
    securityOpen: number | null
    applicationErrors24h: number | null
    application5xx24h: number | null
    latestScan?: Record<string, unknown> | null
  }
  recentErrors: RecentError[]
  schema: {
    applicationErrorsReady: boolean
    applicationErrorsReadable: boolean
  }
}

function tone(status: Status) {
  if (status === 'Operational') return 'bg-emerald-50 text-emerald-700 ring-emerald-100'
  if (status === 'Degraded') return 'bg-amber-50 text-amber-700 ring-amber-100'
  if (status === 'Down') return 'bg-red-50 text-red-700 ring-red-100'
  return 'bg-slate-100 text-slate-500 ring-slate-200'
}

function metric(value: number | null) {
  return value == null ? '—' : String(value)
}

function time(value?: string | null) {
  if (!value) return 'Sem evidência recente'
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return 'Data indisponível'
  return parsed.toLocaleString('pt-BR', { timeZone: 'America/Maceio' })
}

export default function AdminSystemHealthV3() {
  const [data, setData] = useState<Payload | null>(null)
  const [error, setError] = useState('')
  const [errorId, setErrorId] = useState('')
  const [version, setVersion] = useState(0)

  useEffect(() => {
    let active = true

    void supabase.auth.getSession().then(async ({ data: auth }) => {
      const token = auth.session?.access_token || ''
      const response = await fetch('/api/admin/system-health', {
        headers: { Authorization: `Bearer ${token}` },
        cache: 'no-store',
      })
      const payload = await response.json().catch(() => ({}))
      if (!active) return
      if (!response.ok) {
        setData(null)
        setError(String(payload.error || 'Falha ao carregar a saúde da plataforma.'))
        setErrorId(String(payload.errorId || ''))
        return
      }
      setError('')
      setErrorId('')
      setData(payload as Payload)
    }).catch(() => {
      if (!active) return
      setData(null)
      setError('Falha de rede ao carregar a saúde da plataforma.')
      setErrorId('')
    })

    return () => { active = false }
  }, [version])

  function refresh() {
    setData(null)
    setError('')
    setErrorId('')
    setVersion((value) => value + 1)
  }

  return (
    <div className="space-y-4">
      <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-[0_8px_30px_rgba(15,23,42,.04)] sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[.14em] text-slate-400">Saúde do Orçaly</p>
            <h1 className="mt-1 text-2xl font-semibold tracking-[-.04em] text-[#0b2e63] sm:text-3xl">Evidência primeiro. Sem verde decorativo.</h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500">Cada integração é classificada apenas com sinais observáveis. Credencial configurada, por si só, não significa serviço saudável.</p>
          </div>
          <button type="button" onClick={refresh} className="min-h-11 rounded-xl bg-[#0b2e63] px-4 py-3 text-xs font-semibold text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2">Atualizar checks</button>
        </div>
      </section>

      {error ? (
        <section className="rounded-2xl border border-red-100 bg-red-50 p-4 text-sm text-red-800" role="alert">
          <strong className="block">Não conseguimos carregar esta área.</strong>
          <span className="mt-1 block">{error}</span>
          {errorId ? <code className="mt-2 inline-block rounded-lg bg-white/70 px-2 py-1 text-xs font-bold">{errorId}</code> : null}
          <button type="button" onClick={refresh} className="ml-3 mt-2 rounded-lg border border-red-200 bg-white px-3 py-2 text-xs font-bold">Tentar novamente</button>
        </section>
      ) : null}

      {!data && !error ? (
        <section aria-label="Carregando saúde" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 8 }).map((_, index) => <div key={index} className="h-36 animate-pulse rounded-2xl border border-slate-200 bg-white motion-reduce:animate-none" />)}
        </section>
      ) : null}

      {data ? (
        <>
          <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {data.services.map((service) => (
              <article key={service.key} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-[0_4px_18px_rgba(15,23,42,.03)]">
                <div className="flex items-start justify-between gap-3">
                  <strong className="text-sm text-slate-900">{service.name}</strong>
                  <span className={`rounded-lg px-2 py-1 text-[9px] font-bold ring-1 ${tone(service.status)}`}>{service.status}</span>
                </div>
                <p className="mt-3 min-h-16 text-xs leading-5 text-slate-500">{service.detail}</p>
                <p className="mt-3 border-t border-slate-100 pt-2 text-[10px] font-medium text-slate-400">{time(service.observedAt)}</p>
              </article>
            ))}
          </section>

          <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
            {[
              ['Webhook failures 24h', data.metrics.webhookFailures24h],
              ['WhatsApp failures 24h', data.metrics.whatsappFailures24h],
              ['Security events abertos', data.metrics.securityOpen],
              ['Application errors 24h', data.metrics.applicationErrors24h],
              ['HTTP 5xx registrados', data.metrics.application5xx24h],
            ].map(([label, value]) => (
              <article key={String(label)} className="rounded-2xl border border-slate-200 bg-white p-4">
                <span className="text-xs text-slate-400">{String(label)}</span>
                <strong className="mt-2 block text-2xl text-[#0b2e63]">{metric(value as number | null)}</strong>
              </article>
            ))}
          </section>

          <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
            <div className="flex flex-col gap-1 border-b border-slate-100 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-sm font-bold text-[#0b2e63]">Erros de aplicação recentes</h2>
                <p className="mt-1 text-xs text-slate-500">Business audit e analytics continuam separados desta trilha.</p>
              </div>
              <span className={`mt-2 w-fit rounded-lg px-2 py-1 text-[10px] font-bold sm:mt-0 ${data.schema.applicationErrorsReadable ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                {!data.schema.applicationErrorsReady
                  ? 'Migration pendente'
                  : data.schema.applicationErrorsReadable
                    ? 'Telemetria disponível'
                    : 'Leitura indisponível'}
              </span>
            </div>
            {!data.schema.applicationErrorsReady ? (
              <div className="p-5 text-sm text-slate-500">A migration de observabilidade está versionada, mas ainda não foi aplicada neste ambiente. O Health Center permanece funcional sem inventar telemetria.</div>
            ) : !data.schema.applicationErrorsReadable ? (
              <div className="p-5 text-sm text-slate-500">O schema existe, mas a telemetria não pôde ser lida neste momento. O status permanece Unknown até existir evidência válida.</div>
            ) : data.recentErrors.length ? (
              <div className="overflow-x-auto">
                <table className="min-w-full text-left text-xs">
                  <thead className="bg-slate-50 text-[10px] uppercase tracking-wide text-slate-400">
                    <tr><th className="px-4 py-3">Código</th><th className="px-4 py-3">Rota</th><th className="px-4 py-3">Operação</th><th className="px-4 py-3">Tipo</th><th className="px-4 py-3">HTTP</th><th className="px-4 py-3">Quando</th></tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {data.recentErrors.map((item, index) => (
                      <tr key={`${item.errorId || 'unknown'}:${index}`}>
                        <td className="whitespace-nowrap px-4 py-3 font-mono font-bold text-[#0b2e63]">{item.errorId || '—'}</td>
                        <td className="max-w-72 truncate px-4 py-3 text-slate-700">{item.route}</td>
                        <td className="max-w-56 truncate px-4 py-3 text-slate-500">{item.operation}</td>
                        <td className="px-4 py-3 text-slate-500">{item.type}{item.code ? ` · ${item.code}` : ''}</td>
                        <td className="px-4 py-3 font-semibold text-slate-600">{item.httpStatus || '—'}</td>
                        <td className="whitespace-nowrap px-4 py-3 text-slate-400">{time(item.createdAt)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="p-5 text-sm text-slate-500">Nenhum erro de aplicação registrado nas últimas 24h. Isso é um sinal útil, não uma promessa de “zero bugs”.</div>
            )}
          </section>

          <p className="px-1 text-[10px] text-slate-400">Request ID: <code>{data.requestId}</code> · Gerado em {time(data.generatedAt)}</p>
        </>
      ) : null}
    </div>
  )
}
