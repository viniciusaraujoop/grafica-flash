'use client'

import Link from 'next/link'
import { use, useCallback, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

type Props = { params: Promise<{ id: string }> }
type Entry = Record<string, unknown>
type Payload = {
  customer: Entry
  health: { score: number; reasons: string[]; metrics: { recencyDays: number; frequency: number; monetary: number; overdue: number; issues: number } }
  tags: string[]
  orders: Entry[]
  proposals: Entry[]
  crm: Entry[]
  notes: Entry[]
  followups: Entry[]
  finance: Entry[]
  timeline: Entry[]
  quality: Entry[]
  duplicates: Array<Entry & { counterpart?: Entry | null }>
}

async function authHeaders(): Promise<Record<string, string>> {
  const { data } = await supabase.auth.getSession()
  const token = data.session?.access_token
  return token ? { Authorization: `Bearer ${token}` } : {}
}

function money(value: unknown) {
  return Number(value || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function date(value: unknown) {
  if (!value) return 'Sem data'
  const parsed = new Date(String(value))
  return Number.isNaN(parsed.getTime()) ? 'Data inválida' : parsed.toLocaleString('pt-BR')
}

export default function Customer360Page({ params }: Props) {
  const { id } = use(params)
  const [payload, setPayload] = useState<Payload | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    const headers = await authHeaders()
    const response = await fetch(`/api/customer-directory/${id}`, { headers, cache: 'no-store' })
    const data = await response.json().catch(() => null)
    if (!response.ok) setError(data?.error || 'Não foi possível carregar o Customer 360.')
    else setPayload(data)
    setLoading(false)
  }, [id])

  useEffect(() => { void load() }, [load])

  if (loading) return <main className="min-h-screen bg-[#f5f8ff] p-6"><div className="mx-auto max-w-6xl rounded-[2rem] bg-white p-8 text-center font-black shadow-xl">Montando Customer 360…</div></main>
  if (error || !payload) return <main className="min-h-screen bg-[#f5f8ff] p-6"><div className="mx-auto max-w-4xl rounded-[2rem] border border-red-100 bg-white p-8 text-center shadow-xl"><h1 className="text-2xl font-black text-[#071b3a]">Customer 360 indisponível</h1><p className="mt-2 font-bold text-red-700">{error}</p><Link href="/painel/clientes-360" className="mt-5 inline-flex rounded-xl bg-[#0b3b78] px-4 py-3 font-black text-white">Voltar ao diretório</Link></div></main>

  const c = payload.customer
  return (
    <main className="min-h-screen bg-[#f5f8ff] px-4 py-6 text-slate-950">
      <section className="mx-auto max-w-7xl">
        <header className="rounded-[2rem] border border-blue-100 bg-white p-6 shadow-xl shadow-blue-950/5 sm:p-8">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0">
              <Link href="/painel/clientes-360" className="text-sm font-black text-[#0b3b78]">← Diretório</Link>
              <h1 className="mt-3 truncate text-3xl font-black tracking-[-.035em] text-[#071b3a] sm:text-4xl">{String(c.display_name || 'Cliente sem nome')}</h1>
              <p className="mt-2 font-semibold text-slate-500">{String(c.phone_normalized || c.phone_raw || 'Sem telefone')} · {String(c.email_normalized || c.email_raw || 'Sem e-mail')}</p>
              <div className="mt-3 flex flex-wrap gap-2">{payload.tags.map((tag) => <span key={tag} className="rounded-full bg-blue-50 px-3 py-1 text-xs font-black text-[#0b3b78]">{tag}</span>)}</div>
            </div>
            <div className="min-w-[240px] rounded-2xl bg-[#0b3b78] p-5 text-white">
              <p className="text-xs font-black uppercase tracking-[.15em] text-blue-100">Customer Health</p>
              <p className="mt-1 text-4xl font-black">{payload.health.score}/100</p>
              <ul className="mt-3 space-y-1 text-xs font-semibold text-blue-100">{payload.health.reasons.map((reason) => <li key={reason}>• {reason}</li>)}</ul>
            </div>
          </div>
        </header>

        <div className="mt-5 grid gap-5 xl:grid-cols-[1.4fr_.8fr]">
          <div className="grid gap-5">
            <Card title="Timeline" subtitle="Eventos canônicos ligados a este cliente.">
              <Timeline rows={payload.timeline} />
            </Card>
            <Card title="Pedidos" subtitle={`${payload.orders.length} registro(s)`}><Rows rows={payload.orders} primary="produto" secondary="status" value={(row) => money(row.total_amount || row.total || row.valor_total || row.preco_estimado)} /></Card>
            <Card title="Propostas" subtitle={`${payload.proposals.length} registro(s)`}><Rows rows={payload.proposals} primary="titulo" secondary="status" value={(row) => money(row.valor_total)} /></Card>
            <Card title="CRM" subtitle="Pipeline e sinais comerciais"><Rows rows={payload.crm} primary="nome" secondary="etapa" value={(row) => money(row.valor_estimado)} /></Card>
          </div>

          <aside className="grid content-start gap-5">
            <Card title="Qualidade" subtitle={`${payload.quality.length} issue(s) aberta(s)`}>{payload.quality.length ? <Rows rows={payload.quality} primary="title" secondary="severity" /> : <Empty text="Sem issue ligada diretamente ao perfil." />}</Card>
            <Card title="Duplicidades" subtitle={`${payload.duplicates.length} candidato(s)`}>{payload.duplicates.length ? <div className="grid gap-2">{payload.duplicates.map((row) => <Link key={String(row.id)} href="/painel/duplicidades" className="rounded-xl bg-amber-50 p-3 text-sm font-bold text-amber-900"><span className="block">Possível duplicidade: {String(row.counterpart?.display_name || 'outro perfil')}</span><span className="mt-1 block text-xs text-amber-700">Confiança {String(row.confidence || 0)}%</span></Link>)}</div> : <Empty text="Sem candidato de duplicidade." />}</Card>
            <Card title="Follow-ups" subtitle={`${payload.followups.length} registro(s)`}><Rows rows={payload.followups} primary="titulo" secondary="status" /></Card>
            <Card title="Notas" subtitle={`${payload.notes.length} registro(s)`}><Rows rows={payload.notes} primary="conteudo" secondary="tipo" /></Card>
            <Card title="Financeiro permitido" subtitle={`${payload.finance.length} referência(s)`}>{payload.finance.length ? <Rows rows={payload.finance} primary="descricao" secondary="status" value={(row) => money(row.amount || row.valor)} /> : <Empty text="Sem referências financeiras visíveis para seu papel." />}</Card>
          </aside>
        </div>
      </section>
    </main>
  )
}

function Card({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
  return <section className="rounded-[2rem] border border-blue-100 bg-white p-5 shadow-xl shadow-blue-950/5"><h2 className="text-xl font-black text-[#071b3a]">{title}</h2><p className="mt-1 text-sm font-semibold text-slate-400">{subtitle}</p><div className="mt-4">{children}</div></section>
}

function Empty({ text }: { text: string }) { return <div className="rounded-xl bg-slate-50 p-4 text-sm font-semibold text-slate-500">{text}</div> }

function Rows({ rows, primary, secondary, value }: { rows: Entry[]; primary: string; secondary: string; value?: (row: Entry) => string }) {
  if (!rows.length) return <Empty text="Nenhum registro." />
  return <div className="grid gap-2">{rows.slice(0, 30).map((row, index) => <div key={String(row.id || index)} className="flex items-start justify-between gap-3 rounded-xl border border-slate-100 p-3"><div className="min-w-0"><p className="truncate text-sm font-black text-slate-800">{String(row[primary] || 'Registro')}</p><p className="mt-0.5 truncate text-xs font-semibold text-slate-400">{String(row[secondary] || '')} · {date(row.created_at || row.updated_at || row.due_at)}</p></div>{value ? <span className="shrink-0 text-sm font-black text-[#0b3b78]">{value(row)}</span> : null}</div>)}</div>
}

function Timeline({ rows }: { rows: Entry[] }) {
  if (!rows.length) return <Empty text="A timeline começa a crescer conforme os novos eventos 3.1 forem registrados." />
  return <ol className="grid gap-3">{rows.map((row, index) => <li key={String(row.id || index)} className="grid grid-cols-[12px_1fr] gap-3"><span className="mt-1.5 h-3 w-3 rounded-full bg-[#0b3b78] ring-4 ring-blue-50"/><div className="rounded-xl bg-[#f8fbff] p-3"><div className="flex flex-wrap items-center justify-between gap-2"><strong className="text-sm text-[#071b3a]">{String(row.event_type || 'event')}</strong><time className="text-xs font-semibold text-slate-400">{date(row.occurred_at)}</time></div><p className="mt-1 text-xs font-semibold text-slate-500">Origem: {String(row.source || 'system')}</p></div></li>)}</ol>
}
