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

export default function AdminSegurancaPage() {
  const [events, setEvents] = useState<any[]>([])
  const [blocklist, setBlocklist] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [erro, setErro] = useState('')
  const [filter, setFilter] = useState('todos')

  async function carregar() {
    setLoading(true)
    setErro('')

    const [eventsRes, blockRes] = await Promise.all([
      supabase
        .from('security_events')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(200),
      supabase
        .from('security_blocklist')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(200),
    ])

    if (eventsRes.error) {
      setErro(eventsRes.error.message)
    } else {
      setEvents(eventsRes.data || [])
    }

    if (!blockRes.error) {
      setBlocklist(blockRes.data || [])
    }

    setLoading(false)
  }

  useEffect(() => {
    carregar()
  }, [])

  const filteredEvents = useMemo(() => {
    if (filter === 'todos') return events
    if (filter === 'abertos') return events.filter((event) => !event.resolved)
    return events.filter((event) => event.severity === filter)
  }, [events, filter])

  const resumo = useMemo(() => {
    return {
      total: events.length,
      abertos: events.filter((event) => !event.resolved).length,
      media: events.filter((event) => event.severity === 'media').length,
      alta: events.filter((event) => ['alta', 'critica'].includes(event.severity)).length,
    }
  }, [events])

  async function resolver(id: string) {
    const { error } = await supabase
      .from('security_events')
      .update({
        resolved: true,
        resolved_at: new Date().toISOString(),
      })
      .eq('id', id)

    if (error) {
      setErro(error.message)
      return
    }

    await carregar()
  }

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#f5f8ff]">
        <div className="rounded-[2rem] bg-white p-8 font-black shadow-xl">Carregando segurança...</div>
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
                  Central de Segurança
                </h1>
                <p className="mt-3 max-w-2xl font-bold leading-7 text-slate-500">
                  Eventos de segurança, relatórios CSP, headers, áreas sensíveis e bloqueios internos.
                </p>
              </div>

              <button onClick={carregar} className="rounded-2xl bg-[#05245c] px-6 py-5 font-black text-white shadow-xl shadow-[#05245c]/20">
                Atualizar
              </button>
            </div>
          </div>
        </header>

        {erro && <div className="mb-5 rounded-2xl border border-red-100 bg-red-50 p-4 font-bold text-red-700">{erro}</div>}

        <div className="mb-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {[
            ['Eventos', resumo.total, 'registrados'],
            ['Abertos', resumo.abertos, 'não resolvidos'],
            ['Médios', resumo.media, 'atenção'],
            ['Altos/críticos', resumo.alta, 'prioridade'],
          ].map(([label, value, detail]) => (
            <div key={String(label)} className="rounded-[1.75rem] border border-blue-100 bg-white p-5 shadow-xl shadow-blue-950/5">
              <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">{label}</p>
              <p className="mt-3 text-3xl font-black tracking-[-0.04em] text-[#071b3a]">{value}</p>
              <p className="mt-2 text-sm font-bold text-slate-500">{detail}</p>
            </div>
          ))}
        </div>

        <div className="mb-5 grid gap-4 xl:grid-cols-[1fr_420px]">
          <section className="rounded-[2rem] border border-blue-100 bg-white p-5 shadow-xl shadow-blue-950/5">
            <p className="text-sm font-black uppercase tracking-[0.2em] text-[#05245c]">Proteções aplicadas</p>
            <h2 className="mt-1 text-2xl font-black">Checklist ativo</h2>

            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              {[
                ['Headers de segurança', 'X-Frame-Options, nosniff, HSTS, Referrer Policy e Permissions Policy.'],
                ['CSP em modo relatório', 'Detecta scripts, frames e conexões suspeitas sem quebrar produção.'],
                ['Cache bloqueado em áreas sensíveis', '/admin, /painel e /api/admin com no-store.'],
                ['Subdomínios reservados', 'admin, api, login, painel, www e outras rotas internas bloqueadas.'],
                ['Eventos de segurança', 'Relatórios CSP são salvos em security_events.'],
                ['Centro admin', 'Só admins ativos conseguem ver eventos e blocklist.'],
              ].map(([title, desc]) => (
                <div key={title} className="rounded-2xl bg-[#f5f8ff] p-4">
                  <p className="font-black text-[#071b3a]">{title}</p>
                  <p className="mt-2 text-sm font-bold leading-6 text-slate-500">{desc}</p>
                </div>
              ))}
            </div>
          </section>

          <aside className="rounded-[2rem] border border-blue-100 bg-white p-5 shadow-xl shadow-blue-950/5">
            <p className="text-sm font-black uppercase tracking-[0.2em] text-[#05245c]">Blocklist</p>
            <h2 className="mt-1 text-2xl font-black">Reservados</h2>

            <div className="mt-5 grid max-h-[360px] gap-2 overflow-auto">
              {blocklist.map((item) => (
                <div key={item.id} className="rounded-2xl bg-[#f5f8ff] p-3">
                  <div className="flex items-center justify-between gap-3">
                    <p className="font-black">{item.value}</p>
                    <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-black text-[#05245c]">{item.type}</span>
                  </div>
                  <p className="mt-1 text-xs font-bold text-slate-500">{item.reason || 'Sem motivo'}</p>
                </div>
              ))}
            </div>
          </aside>
        </div>

        <section className="rounded-[2rem] border border-blue-100 bg-white p-5 shadow-xl shadow-blue-950/5">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-black uppercase tracking-[0.2em] text-[#05245c]">Eventos</p>
              <h2 className="mt-1 text-2xl font-black">Relatórios de segurança</h2>
            </div>

            <select value={filter} onChange={(e) => setFilter(e.target.value)} className="rounded-2xl border border-blue-100 bg-white px-4 py-3 font-bold outline-none">
              <option value="todos">Todos</option>
              <option value="abertos">Abertos</option>
              <option value="baixa">Baixa</option>
              <option value="media">Média</option>
              <option value="alta">Alta</option>
              <option value="critica">Crítica</option>
            </select>
          </div>

          <div className="mt-5 grid gap-3">
            {filteredEvents.map((event) => (
              <article key={event.id} className="rounded-[1.5rem] border border-slate-200 bg-white p-4">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-black">{event.description || event.event_type}</p>
                      <span className={`rounded-full px-3 py-1 text-xs font-black ${badgeSeverity(event.severity)}`}>{event.severity}</span>
                      <span className={`rounded-full px-3 py-1 text-xs font-black ${event.resolved ? 'bg-emerald-100 text-emerald-700' : 'bg-red-50 text-red-700'}`}>
                        {event.resolved ? 'resolvido' : 'aberto'}
                      </span>
                    </div>
                    <p className="mt-2 break-all text-sm font-bold text-slate-500">{event.path || 'Sem caminho'} • {event.source} • {dataBR(event.created_at)}</p>
                    {event.metadata?.blocked_uri && (
                      <p className="mt-2 break-all rounded-xl bg-[#f5f8ff] p-3 text-xs font-bold text-slate-600">
                        Bloqueado/reportado: {event.metadata.blocked_uri}
                      </p>
                    )}
                  </div>

                  {!event.resolved && (
                    <button onClick={() => resolver(event.id)} className="rounded-xl bg-emerald-50 px-3 py-2 text-xs font-black text-emerald-700">
                      Resolver
                    </button>
                  )}
                </div>
              </article>
            ))}

            {filteredEvents.length === 0 && (
              <div className="rounded-[2rem] border border-dashed border-slate-300 p-10 text-center">
                <p className="text-2xl font-black">Nenhum evento neste filtro.</p>
              </div>
            )}
          </div>
        </section>
      </section>
    </main>
  )
}
