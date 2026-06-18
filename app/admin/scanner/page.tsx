'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'

function dataBR(value: string | null | undefined) {
  if (!value) return 'Sem data'
  return new Date(value).toLocaleString('pt-BR')
}

function badgeSeverity(severity: string) {
  if (severity === 'critica') return 'bg-red-600 text-white'
  if (severity === 'alta') return 'bg-red-100 text-red-700'
  if (severity === 'media') return 'bg-yellow-100 text-yellow-700'
  return 'bg-slate-100 text-slate-700'
}

function badgeStatus(status: string) {
  if (status === 'resolvido') return 'bg-emerald-100 text-emerald-700'
  if (status === 'em_analise') return 'bg-blue-100 text-blue-700'
  if (status === 'ignorado') return 'bg-slate-200 text-slate-600'
  return 'bg-red-50 text-red-700'
}

export default function AdminScannerPage() {
  const [token, setToken] = useState('')
  const [bugs, setBugs] = useState<any[]>([])
  const [runs, setRuns] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [scanning, setScanning] = useState(false)
  const [erro, setErro] = useState('')
  const [message, setMessage] = useState('')
  const [status, setStatus] = useState('aberto')
  const [severity, setSeverity] = useState('todos')
  const [selected, setSelected] = useState<any | null>(null)

  async function carregar() {
    setErro('')
    const { data: sessionData } = await supabase.auth.getSession()
    const accessToken = sessionData.session?.access_token || ''

    if (!accessToken) {
      setErro('Você precisa estar logado.')
      setLoading(false)
      return
    }

    setToken(accessToken)

    const res = await fetch('/api/admin/scan', {
      headers: { Authorization: `Bearer ${accessToken}` },
    })

    const payload = await res.json()

    if (!res.ok) {
      setErro(payload.error || 'Erro ao carregar scanner.')
      setLoading(false)
      return
    }

    setBugs(payload.bugs || [])
    setRuns(payload.runs || [])
    setLoading(false)
  }

  useEffect(() => {
    carregar()
  }, [])

  async function rodarScanner() {
    setScanning(true)
    setErro('')
    setMessage('')

    const res = await fetch('/api/admin/scan', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    })

    const payload = await res.json()

    if (!res.ok) {
      setErro(payload.error || 'Erro ao rodar scanner.')
    } else {
      setBugs(payload.bugs || [])
      setRuns(payload.runs || [])
      setStatus('aberto')
      setMessage(`Scanner detalhado concluído: ${payload.issues?.length || 0} problemas listados com correção.`)
    }

    setScanning(false)
  }

  async function executar(action: string, bugId: string) {
    const ok = window.confirm('Confirmar ação no bug?')
    if (!ok) return

    const res = await fetch('/api/admin/action', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ action, targetId: bugId }),
    })

    const payload = await res.json()

    if (!res.ok) {
      setErro(payload.error || 'Erro ao atualizar bug.')
      return
    }

    setMessage('Bug atualizado.')
    await carregar()
  }

  async function copiar(text: string) {
    await navigator.clipboard.writeText(text)
    setMessage('Copiado.')
  }

  const filtrados = useMemo(() => {
    return bugs.filter((bug) => {
      const statusOk = status === 'todos' || bug.status === status
      const severityOk = severity === 'todos' || bug.severity === severity
      return statusOk && severityOk
    })
  }, [bugs, status, severity])

  const resumo = useMemo(() => {
    const abertos = bugs.filter((b) => b.status === 'aberto' || b.status === 'em_analise')
    return {
      total: bugs.length,
      abertos: abertos.length,
      criticos: abertos.filter((b) => b.severity === 'critica').length,
      altos: abertos.filter((b) => b.severity === 'alta').length,
      medios: abertos.filter((b) => b.severity === 'media').length,
      baixos: abertos.filter((b) => b.severity === 'baixa').length,
    }
  }, [bugs])

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#f5f8ff]">
        <div className="rounded-[2rem] bg-white p-8 font-black shadow-xl">Carregando scanner...</div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-[#f5f8ff] px-4 py-6 text-[#071b3a]">
      <section className="mx-auto max-w-7xl">
        <header className="mb-6 overflow-hidden rounded-[2.5rem] border border-blue-100 bg-white shadow-2xl shadow-blue-950/8">
          <div className="relative p-6 sm:p-8">
            <div className="absolute right-0 top-0 h-48 w-48 rounded-full bg-blue-100 blur-3xl" />
            <div className="absolute bottom-0 right-36 h-48 w-48 rounded-full bg-emerald-100 blur-3xl" />

            <div className="relative flex flex-col gap-6 xl:flex-row xl:items-center xl:justify-between">
              <div>
                <Link href="/admin" className="text-sm font-black text-[#05245c]">← Voltar ao Admin</Link>
                <h1 className="mt-4 text-4xl font-black tracking-[-0.05em] text-[#071b3a] sm:text-5xl">
                  Scanner detalhado
                </h1>
                <p className="mt-3 max-w-2xl font-bold leading-7 text-slate-500">
                  Cada problema agora aparece com área, tabela, campo afetado, motivo e passo a passo de correção.
                </p>
              </div>

              <button onClick={rodarScanner} disabled={scanning} className="rounded-2xl bg-[#05245c] px-6 py-5 font-black text-white shadow-xl shadow-[#05245c]/20 disabled:opacity-60">
                {scanning ? 'Rodando scanner...' : 'Rodar scanner agora'}
              </button>
            </div>
          </div>
        </header>

        {message && <div className="mb-5 rounded-2xl border border-emerald-100 bg-emerald-50 p-4 font-bold text-emerald-700">{message}</div>}
        {erro && <div className="mb-5 rounded-2xl border border-red-100 bg-red-50 p-4 font-bold text-red-700">{erro}</div>}

        <div className="mb-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-6">
          {[
            ['Total', resumo.total, 'bugs registrados'],
            ['Abertos', resumo.abertos, 'para resolver'],
            ['Críticos', resumo.criticos, 'prioridade máxima'],
            ['Altos', resumo.altos, 'urgentes'],
            ['Médios', resumo.medios, 'atenção'],
            ['Baixos', resumo.baixos, 'melhorias'],
          ].map(([label, value, detail]) => (
            <div key={String(label)} className="rounded-[1.75rem] border border-blue-100 bg-white p-5 shadow-xl shadow-blue-950/5">
              <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">{label}</p>
              <p className="mt-3 text-3xl font-black tracking-[-0.04em] text-[#071b3a]">{value}</p>
              <p className="mt-2 text-sm font-bold text-slate-500">{detail}</p>
            </div>
          ))}
        </div>

        <div className="mb-5 grid gap-4 lg:grid-cols-[1fr_220px_220px]">
          <div className="rounded-2xl border border-blue-100 bg-white p-4 font-bold text-slate-500">
            Última execução: {runs[0] ? `${dataBR(runs[0].started_at)} • ${runs[0].total_issues || 0} problemas` : 'nenhuma'}
          </div>
          <select value={status} onChange={(e) => setStatus(e.target.value)} className="rounded-2xl border border-blue-100 bg-white px-4 py-4 font-bold outline-none">
            <option value="aberto">Abertos</option>
            <option value="em_analise">Em análise</option>
            <option value="resolvido">Resolvidos</option>
            <option value="ignorado">Ignorados</option>
            <option value="todos">Todos</option>
          </select>
          <select value={severity} onChange={(e) => setSeverity(e.target.value)} className="rounded-2xl border border-blue-100 bg-white px-4 py-4 font-bold outline-none">
            <option value="todos">Todas gravidades</option>
            <option value="critica">Crítica</option>
            <option value="alta">Alta</option>
            <option value="media">Média</option>
            <option value="baixa">Baixa</option>
          </select>
        </div>

        <div className="grid gap-5 xl:grid-cols-[1fr_430px]">
          <section className="grid gap-3">
            {filtrados.map((bug) => (
              <button key={bug.id} onClick={() => setSelected(bug)} className={`rounded-[1.5rem] border p-4 text-left transition hover:bg-[#f8fbff] ${selected?.id === bug.id ? 'border-[#05245c] bg-blue-50' : 'border-slate-200 bg-white'}`}>
                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-lg font-black">{bug.title}</p>
                      <span className={`rounded-full px-3 py-1 text-xs font-black ${badgeSeverity(bug.severity)}`}>{bug.severity}</span>
                      <span className={`rounded-full px-3 py-1 text-xs font-black ${badgeStatus(bug.status)}`}>{bug.status}</span>
                    </div>
                    <p className="mt-2 text-sm font-bold text-slate-500">{bug.description}</p>
                    <p className="mt-2 text-xs font-black uppercase tracking-[0.14em] text-slate-400">
                      {bug.area} • {bug.affected_table || bug.entity_type || 'sistema'} {bug.affected_field ? `• ${bug.affected_field}` : ''}
                    </p>
                  </div>
                  <div className="text-sm font-bold text-slate-400">visto {bug.occurrences || 1}x</div>
                </div>
              </button>
            ))}

            {filtrados.length === 0 && (
              <div className="rounded-[2rem] border border-dashed border-slate-300 bg-white p-10 text-center">
                <p className="text-2xl font-black">Nenhum problema neste filtro.</p>
              </div>
            )}
          </section>

          <aside className="rounded-[2rem] border border-blue-100 bg-white p-5 shadow-xl shadow-blue-950/5">
            {!selected ? (
              <div className="rounded-2xl bg-[#f5f8ff] p-6 text-center">
                <p className="font-black">Selecione um problema</p>
                <p className="mt-2 text-sm font-bold text-slate-500">A correção detalhada aparece aqui.</p>
              </div>
            ) : (
              <div className="grid gap-4">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`rounded-full px-3 py-1 text-xs font-black ${badgeSeverity(selected.severity)}`}>{selected.severity}</span>
                    <span className={`rounded-full px-3 py-1 text-xs font-black ${badgeStatus(selected.status)}`}>{selected.status}</span>
                  </div>
                  <h2 className="mt-3 text-2xl font-black">{selected.title}</h2>
                  <p className="mt-2 text-sm font-bold text-slate-500">{selected.description}</p>
                </div>

                <div className="rounded-2xl bg-[#f5f8ff] p-4">
                  <p className="text-sm font-black text-[#05245c]">Onde está o problema</p>
                  <div className="mt-3 grid gap-2 text-sm font-bold text-slate-600">
                    <p>Área: {selected.area || 'sistema'}</p>
                    <p>Tabela: {selected.affected_table || selected.entity_type || 'não informado'}</p>
                    <p>Campo: {selected.affected_field || 'não informado'}</p>
                    <p>Registro: {selected.entity_label || selected.entity_id || selected.code}</p>
                    <p>Código: {selected.code}</p>
                  </div>
                </div>

                {selected.suggested_action && (
                  <div className="rounded-2xl bg-blue-50 p-4">
                    <p className="text-sm font-black text-[#05245c]">Ação recomendada</p>
                    <p className="mt-2 text-sm font-bold text-[#05245c]/80">{selected.suggested_action}</p>
                  </div>
                )}

                <div className="rounded-2xl bg-[#f5f8ff] p-4">
                  <p className="text-sm font-black text-[#05245c]">Passo a passo</p>
                  <ol className="mt-3 grid gap-2">
                    {(selected.fix_steps || []).length > 0 ? selected.fix_steps.map((step: string, index: number) => (
                      <li key={index} className="rounded-xl bg-white p-3 text-sm font-bold text-slate-700">
                        {index + 1}. {step}
                      </li>
                    )) : (
                      <li className="rounded-xl bg-white p-3 text-sm font-bold text-slate-700">
                        Revise o registro indicado e aplique a correção recomendada.
                      </li>
                    )}
                  </ol>
                </div>

                {selected.fix_sql && (
                  <div className="rounded-2xl bg-slate-950 p-4 text-white">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm font-black">SQL sugerido</p>
                      <button onClick={() => copiar(selected.fix_sql)} className="rounded-xl bg-white px-3 py-2 text-xs font-black text-slate-950">Copiar</button>
                    </div>
                    <pre className="mt-3 max-h-56 overflow-auto whitespace-pre-wrap text-xs font-bold leading-5 text-white/80">{selected.fix_sql}</pre>
                  </div>
                )}

                <div className="grid gap-2">
                  <button onClick={() => executar('bug.review', selected.id)} className="rounded-2xl bg-blue-50 px-4 py-3 font-black text-[#05245c]">Marcar em análise</button>
                  <button onClick={() => executar('bug.resolve', selected.id)} className="rounded-2xl bg-emerald-600 px-4 py-3 font-black text-white">Marcar resolvido</button>
                  <button onClick={() => executar('bug.ignore', selected.id)} className="rounded-2xl bg-slate-100 px-4 py-3 font-black text-slate-700">Ignorar</button>
                </div>
              </div>
            )}
          </aside>
        </div>
      </section>
    </main>
  )
}
