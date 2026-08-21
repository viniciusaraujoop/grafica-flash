'use client'

import { useCallback, useEffect, useState } from 'react'

type Metric = { key: string; count: number }
type Payload = {
  available: boolean
  days: number
  reason?: string
  message?: string
  summary?: {
    conversations: number
    uniqueUsers: number
    messages: number
    demosOpened: number
    planRecommendations: number
    leadsGenerated: number
    signupClicks: number
    whatsappHandoffs: number
    providerErrors: number
    unanswered: number
    averageLatencyMs: number
    promptTokens: number
    completionTokens: number
  }
  funnel?: Array<{ step: string; value: number }>
  segments?: Metric[]
  plans?: Metric[]
  tools?: Metric[]
  unanswered?: Metric[]
  feedback?: { positive: number; negative: number; total: number }
  leads?: { generated: number; converted: number; bySegment?: Metric[]; byPlan?: Metric[] }
}

function Stat({ label, value, detail }: { label: string; value: number | string; detail?: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <p className="text-xs font-bold uppercase tracking-[.12em] text-slate-400">{label}</p>
      <p className="mt-2 text-2xl font-black tracking-[-.04em] text-[#0b2347]">{value}</p>
      {detail ? <p className="mt-1 text-xs text-slate-500">{detail}</p> : null}
    </div>
  )
}

function Ranking({ title, items }: { title: string; items?: Metric[] }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4">
      <h2 className="text-sm font-black text-[#0b2347]">{title}</h2>
      <div className="mt-3 space-y-2">
        {items?.length ? items.map((item) => (
          <div key={item.key} className="flex items-center justify-between gap-3 rounded-xl bg-slate-50 px-3 py-2 text-xs">
            <span className="min-w-0 truncate font-semibold text-slate-600">{item.key}</span>
            <strong className="text-[#0b3b78]">{item.count}</strong>
          </div>
        )) : <p className="text-xs text-slate-400">Sem dados no período.</p>}
      </div>
    </div>
  )
}

export default function AdminAssistantGrowth() {
  const [days, setDays] = useState(30)
  const [data, setData] = useState<Payload | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const response = await fetch(`/api/admin/assistant?days=${days}`, { cache: 'no-store' })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(payload.error || 'Não foi possível carregar os dados.')
      setData(payload)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar analytics.')
    } finally {
      setLoading(false)
    }
  }, [days])

  useEffect(() => {
    void load()
  }, [load])

  const summary = data?.summary

  return (
    <main className="min-h-screen bg-[#f5f7fb] px-4 py-6 text-slate-800 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs font-black uppercase tracking-[.16em] text-blue-600">Admin · Growth</p>
            <h1 className="mt-2 text-3xl font-black tracking-[-.05em] text-[#0b2347]">Assistente Orçaly</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">Funil, qualidade, custo operacional e discovery do Assistente público. Sem leitura indiscriminada das conversas completas.</p>
          </div>
          <div className="flex gap-2">
            {[7, 30, 90].map((value) => <button key={value} onClick={() => setDays(value)} className={`rounded-xl px-3 py-2 text-xs font-black ${days === value ? 'bg-[#0b3b78] text-white' : 'border border-slate-200 bg-white text-slate-600'}`}>{value} dias</button>)}
          </div>
        </div>

        {loading ? <div className="mt-8 rounded-2xl border border-slate-200 bg-white p-6 text-sm font-semibold text-slate-500">Carregando analytics...</div> : null}
        {error ? <div className="mt-8 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-700">{error}</div> : null}

        {!loading && data && !data.available ? (
          <div className="mt-8 rounded-2xl border border-amber-200 bg-amber-50 p-5">
            <p className="font-black text-amber-900">Analytics ainda não ativado neste banco</p>
            <p className="mt-1 text-sm leading-6 text-amber-800">{data.message || 'A migration de analytics precisa ser aplicada no ambiente de validação.'}</p>
            <p className="mt-3 text-xs font-bold text-amber-700">Leads do Assistente já encontrados: {data.leads?.generated || 0}</p>
          </div>
        ) : null}

        {!loading && data?.available && summary ? (
          <>
            <section className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <Stat label="Conversas abertas" value={summary.conversations} />
              <Stat label="Usuários únicos" value={summary.uniqueUsers} />
              <Stat label="Mensagens" value={summary.messages} />
              <Stat label="Planos recomendados" value={summary.planRecommendations} />
              <Stat label="Leads gerados" value={summary.leadsGenerated} detail={`${data.leads?.converted || 0} convertidos em empresa`} />
              <Stat label="Cliques no cadastro" value={summary.signupClicks} />
              <Stat label="Handoffs WhatsApp" value={summary.whatsappHandoffs} />
              <Stat label="Latência média" value={`${summary.averageLatencyMs} ms`} />
            </section>

            <section className="mt-6 grid gap-4 lg:grid-cols-[1.2fr_.8fr]">
              <div className="rounded-2xl border border-slate-200 bg-white p-4">
                <h2 className="text-sm font-black text-[#0b2347]">Funil</h2>
                <div className="mt-4 grid gap-2">
                  {data.funnel?.map((item, index) => (
                    <div key={item.step} className="flex items-center gap-3 rounded-xl bg-slate-50 p-3">
                      <span className="grid h-7 w-7 place-items-center rounded-lg bg-blue-100 text-xs font-black text-blue-700">{index + 1}</span>
                      <span className="flex-1 text-xs font-semibold text-slate-600">{item.step}</span>
                      <strong className="text-sm text-[#0b3b78]">{item.value}</strong>
                    </div>
                  ))}
                </div>
              </div>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1">
                <Stat label="Falhas do provider" value={summary.providerErrors} />
                <Stat label="Perguntas não respondidas" value={summary.unanswered} />
                <Stat label="Tokens registrados" value={(summary.promptTokens + summary.completionTokens).toLocaleString('pt-BR')} detail={`${summary.promptTokens.toLocaleString('pt-BR')} entrada · ${summary.completionTokens.toLocaleString('pt-BR')} saída`} />
                <Stat label="Feedback" value={`${data.feedback?.positive || 0} 👍 · ${data.feedback?.negative || 0} 👎`} />
              </div>
            </section>

            <section className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <Ranking title="Segmentos mais consultados" items={data.segments} />
              <Ranking title="Planos mais recomendados" items={data.plans} />
              <Ranking title="Ferramentas mais usadas" items={data.tools} />
              <Ranking title="Perguntas sem resposta" items={data.unanswered} />
            </section>
          </>
        ) : null}
      </div>
    </main>
  )
}
