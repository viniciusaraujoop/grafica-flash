'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'

type Issue = {
  id: string
  rule_key: string
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'INFO'
  entity_type: string
  entity_id?: string | null
  title: string
  detail: string
  recommended_action: string
  auto_fixable: boolean
  status: 'open' | 'resolved' | 'ignored'
  last_seen_at: string
}

type Payload = {
  score: number
  open: number
  counts: { critical: number; high: number; medium: number; low: number; info: number }
  issues: Issue[]
}

const severityLabel: Record<Issue['severity'], string> = {
  CRITICAL: 'Crítica', HIGH: 'Alta', MEDIUM: 'Média', LOW: 'Baixa', INFO: 'Info',
}

function severityClasses(value: Issue['severity']) {
  if (value === 'CRITICAL') return 'border-red-200 bg-red-50 text-red-800'
  if (value === 'HIGH') return 'border-orange-200 bg-orange-50 text-orange-800'
  if (value === 'MEDIUM') return 'border-amber-200 bg-amber-50 text-amber-800'
  if (value === 'LOW') return 'border-blue-200 bg-blue-50 text-blue-800'
  return 'border-slate-200 bg-slate-50 text-slate-700'
}

async function authHeaders(): Promise<Record<string, string>> {
  const { data } = await supabase.auth.getSession()
  const token = data.session?.access_token
  return token ? { Authorization: `Bearer ${token}` } : {}
}

export default function DataQualityPage() {
  const [payload, setPayload] = useState<Payload | null>(null)
  const [loading, setLoading] = useState(true)
  const [working, setWorking] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [severity, setSeverity] = useState('')
  const [entity, setEntity] = useState('')
  const [status, setStatus] = useState('open')

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    const headers = await authHeaders()
    const params = new URLSearchParams({ status })
    if (severity) params.set('severity', severity)
    if (entity) params.set('entity', entity)
    const response = await fetch(`/api/data-quality?${params.toString()}`, { headers, cache: 'no-store' })
    const data = await response.json().catch(() => null)
    if (!response.ok) setError(data?.error || 'Não foi possível carregar a qualidade dos dados.')
    else setPayload(data)
    setLoading(false)
  }, [entity, severity, status])

  useEffect(() => { void load() }, [load])

  async function act(action: string, issue?: Issue, reason?: string) {
    setWorking(true)
    setError('')
    setMessage('')
    const headers = await authHeaders()
    const response = await fetch('/api/data-quality', {
      method: 'POST',
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, issueId: issue?.id, reason }),
    })
    const data = await response.json().catch(() => null)
    if (!response.ok) setError(data?.error || 'A operação falhou.')
    else {
      setMessage(action === 'scan' ? 'Scan concluído com dados atuais.' : 'Issue atualizada.')
      await load()
    }
    setWorking(false)
  }

  const entities = useMemo(() => Array.from(new Set((payload?.issues || []).map((issue) => issue.entity_type))).sort(), [payload])
  const score = payload?.score ?? 0

  return (
    <main className="min-h-screen bg-[#f5f8ff] px-4 py-6 text-slate-950">
      <section className="mx-auto max-w-7xl">
        <header className="rounded-[2rem] border border-blue-100 bg-white p-6 shadow-xl shadow-blue-950/5 sm:p-8">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-[.18em] text-[#0b3b78]">Governança de dados</p>
              <h1 className="mt-2 text-3xl font-black tracking-[-.035em] text-[#071b3a] sm:text-4xl">Qualidade dos dados</h1>
              <p className="mt-2 max-w-2xl font-semibold leading-7 text-slate-500">Problemas detectados de forma determinística, com impacto e ação recomendada. Nenhuma correção financeira ou ambígua acontece sozinha.</p>
            </div>
            <button type="button" disabled={working} onClick={() => void act('scan')} className="rounded-2xl bg-[#0b3b78] px-5 py-3 font-black text-white shadow-lg shadow-blue-950/15 transition hover:-translate-y-0.5 disabled:cursor-wait disabled:opacity-60">{working ? 'Executando…' : 'Executar scan'}</button>
          </div>

          <div className="mt-6 grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
            <Stat label="Score" value={`${score}/100`} strong />
            <Stat label="Críticas" value={String(payload?.counts.critical || 0)} />
            <Stat label="Altas" value={String(payload?.counts.high || 0)} />
            <Stat label="Médias" value={String(payload?.counts.medium || 0)} />
            <Stat label="Baixas" value={String(payload?.counts.low || 0)} />
            <Stat label="Abertas" value={String(payload?.open || 0)} />
          </div>
        </header>

        {message ? <div role="status" className="mt-4 rounded-2xl border border-emerald-100 bg-emerald-50 p-4 font-bold text-emerald-800">{message}</div> : null}
        {error ? <div role="alert" className="mt-4 rounded-2xl border border-red-100 bg-red-50 p-4 font-bold text-red-800">{error}</div> : null}

        <section className="mt-5 rounded-[2rem] border border-blue-100 bg-white p-5 shadow-xl shadow-blue-950/5">
          <div className="grid gap-3 md:grid-cols-3">
            <label className="grid gap-1.5 text-sm font-bold text-slate-600">Severidade
              <select value={severity} onChange={(event) => setSeverity(event.target.value)} className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-slate-900 outline-none focus:border-[#0b3b78]">
                <option value="">Todas</option><option>CRITICAL</option><option>HIGH</option><option>MEDIUM</option><option>LOW</option><option>INFO</option>
              </select>
            </label>
            <label className="grid gap-1.5 text-sm font-bold text-slate-600">Entidade
              <select value={entity} onChange={(event) => setEntity(event.target.value)} className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-slate-900 outline-none focus:border-[#0b3b78]">
                <option value="">Todas</option>{entities.map((value) => <option key={value}>{value}</option>)}
              </select>
            </label>
            <label className="grid gap-1.5 text-sm font-bold text-slate-600">Status
              <select value={status} onChange={(event) => setStatus(event.target.value)} className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-slate-900 outline-none focus:border-[#0b3b78]">
                <option value="open">Abertas</option><option value="resolved">Resolvidas</option><option value="ignored">Ignoradas</option>
              </select>
            </label>
          </div>

          <div className="mt-5 grid gap-3">
            {loading ? <div className="rounded-2xl bg-slate-50 p-8 text-center font-bold text-slate-500">Carregando diagnóstico…</div> : null}
            {!loading && !(payload?.issues.length) ? <div className="rounded-2xl border border-dashed border-slate-200 p-8 text-center"><p className="font-black text-[#071b3a]">Nenhuma issue neste filtro</p><p className="mt-1 text-sm font-semibold text-slate-500">O filtro atual não possui ocorrências.</p></div> : null}
            {(payload?.issues || []).map((issue) => (
              <article key={issue.id} className="rounded-2xl border border-slate-200 p-4 sm:p-5">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`rounded-full border px-2.5 py-1 text-xs font-black ${severityClasses(issue.severity)}`}>{severityLabel[issue.severity]}</span>
                      <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-black text-slate-600">{issue.entity_type}</span>
                      <span className="text-xs font-bold text-slate-400">{issue.rule_key}</span>
                    </div>
                    <h2 className="mt-3 text-lg font-black text-[#071b3a]">{issue.title}</h2>
                    <p className="mt-1 leading-6 text-slate-600">{issue.detail}</p>
                    <p className="mt-3 rounded-xl bg-[#f5f8ff] p-3 text-sm font-semibold text-slate-600"><strong className="text-[#071b3a]">Ação recomendada:</strong> {issue.recommended_action}</p>
                    <p className="mt-2 text-xs font-semibold text-slate-400">Última detecção: {new Date(issue.last_seen_at).toLocaleString('pt-BR')}</p>
                  </div>
                  {issue.status === 'open' ? <div className="flex shrink-0 flex-wrap gap-2">
                    <button type="button" disabled={working} onClick={() => void act('resolve', issue)} className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-black text-emerald-800">Resolver</button>
                    <button type="button" disabled={working} onClick={() => { const reason = window.prompt('Motivo para ignorar esta issue:') || ''; if (reason) void act('ignore', issue, reason) }} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-black text-slate-700">Ignorar</button>
                    {issue.auto_fixable ? <button type="button" disabled={working} onClick={() => void act('fix', issue)} className="rounded-xl bg-[#0b3b78] px-3 py-2 text-sm font-black text-white">Corrigir</button> : null}
                  </div> : null}
                </div>
              </article>
            ))}
          </div>
        </section>
      </section>
    </main>
  )
}

function Stat({ label, value, strong = false }: { label: string; value: string; strong?: boolean }) {
  return <div className={`rounded-2xl p-4 ${strong ? 'bg-[#0b3b78] text-white' : 'bg-[#f5f8ff]'}`}><p className={`text-[10px] font-black uppercase tracking-[.14em] ${strong ? 'text-blue-100' : 'text-slate-400'}`}>{label}</p><p className="mt-1 text-2xl font-black">{value}</p></div>
}
