"use client"

import {
  useEffect,
  useState,
} from "react"
import { supabase } from "@/lib/supabase"
import {
  PERFORMANCE_PERIOD_LABELS,
  PERFORMANCE_PERIODS,
  PERFORMANCE_STAGE_LABELS,
  PERFORMANCE_STAGES,
  type PerformancePeriod,
  type PerformanceStage,
} from "@/lib/sales-performance"

type Activity = {
  prospects_created: number
  contacts: number
  interested: number
  demonstrations: number
  founder_invites: number
  founder_activations: number
  customers: number
  lost: number
  invite_activation_rate: number
}

type Health = {
  portfolio: number
  active_portfolio: number
  overdue_actions: number
  upcoming_actions_7d: number
  never_contacted: number
  closing_rate: number
}

type TeamRow = Activity &
  Health & {
    id: string
    nome: string
    email: string
  }

type PerformancePayload = {
  period: PerformancePeriod
  period_start: string | null
  generated_at: string
  viewer: {
    id: string
    nome: string
    role: string
    can_view_all: boolean
  }
  pipeline: Record<PerformanceStage, number>
  activity: Activity
  health: Health
  owner: {
    unassigned_leads: number
    active_prospectors: number
  } | null
  team: TeamRow[]
  error?: string
}

async function accessToken() {
  const { data } = await supabase.auth.getSession()
  return data.session?.access_token || ""
}

async function fetchPerformance(
  period: PerformancePeriod,
) {
  const token = await accessToken()

  if (!token) {
    return {
      kind: "unauthenticated" as const,
    }
  }

  const response = await fetch(
    `/api/admin/performance?period=${encodeURIComponent(period)}`,
    {
      cache: "no-store",
      headers: {
        Authorization: `Bearer ${token}`,
      },
    },
  )

  const payload = (await response
    .json()
    .catch(() => ({}))) as Partial<PerformancePayload>

  return {
    kind: "response" as const,
    ok: response.ok,
    payload,
  }
}

function percent(value: number) {
  return `${Number(value || 0).toLocaleString("pt-BR", {
    minimumFractionDigits: value % 1 ? 1 : 0,
    maximumFractionDigits: 1,
  })}%`
}

function number(value: number) {
  return Number(value || 0).toLocaleString("pt-BR")
}

function stageTone(stage: PerformanceStage) {
  const tones: Record<PerformanceStage, string> = {
    novo: "bg-slate-100 text-slate-700",
    contatado: "bg-blue-50 text-blue-700",
    interessado: "bg-cyan-50 text-cyan-700",
    demonstracao: "bg-violet-50 text-violet-700",
    convite_fundador: "bg-amber-50 text-amber-700",
    conta_ativada: "bg-indigo-50 text-indigo-700",
    cliente: "bg-emerald-50 text-emerald-700",
    perdido: "bg-red-50 text-red-700",
  }

  return tones[stage]
}

function MetricCard({
  label,
  value,
  helper,
}: {
  label: string
  value: string
  helper: string
}) {
  return (
    <article className="rounded-3xl border border-slate-100 bg-white p-5 shadow-sm">
      <p className="text-[10px] font-black uppercase tracking-[0.15em] text-slate-400">
        {label}
      </p>
      <p className="mt-3 text-3xl font-black tracking-[-0.04em] text-slate-950">
        {value}
      </p>
      <p className="mt-2 text-xs font-semibold leading-5 text-slate-500">
        {helper}
      </p>
    </article>
  )
}

export default function SalesPerformanceClient() {
  const [period, setPeriod] =
    useState<PerformancePeriod>("30")
  const [data, setData] =
    useState<PerformancePayload | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  useEffect(() => {
    let ignore = false

    void fetchPerformance(period)
      .then((result) => {
        if (ignore) return

        if (result.kind === "unauthenticated") {
          window.location.assign("/admin/login")
          return
        }

        if (!result.ok) {
          setError(
            result.payload.error ||
              "Não foi possível carregar o desempenho.",
          )
          setLoading(false)
          return
        }

        setData(result.payload as PerformancePayload)
        setError("")
        setLoading(false)
      })
      .catch(() => {
        if (ignore) return
        setError(
          "Não foi possível carregar o desempenho comercial.",
        )
        setLoading(false)
      })

    return () => {
      ignore = true
    }
  }, [period])

  async function refresh() {
    setLoading(true)
    setError("")

    const result = await fetchPerformance(period)

    if (result.kind === "unauthenticated") {
      window.location.assign("/admin/login")
      return
    }

    if (!result.ok) {
      setError(
        result.payload.error ||
          "Não foi possível carregar o desempenho.",
      )
      setLoading(false)
      return
    }

    setData(result.payload as PerformancePayload)
    setLoading(false)
  }

  if (loading && !data) {
    return (
      <main className="grid min-h-screen place-items-center bg-slate-50 text-slate-950">
        <div className="text-center">
          <div className="mx-auto h-10 w-10 animate-spin rounded-full border-4 border-slate-200 border-t-slate-950" />
          <p className="mt-4 font-black">
            Calculando desempenho comercial...
          </p>
        </div>
      </main>
    )
  }

  const activity = data?.activity
  const health = data?.health

  return (
    <main className="min-h-screen bg-slate-50 px-3 py-5 text-slate-950 sm:px-6">
      <div className="mx-auto max-w-[1500px]">
        <header className="rounded-[2rem] bg-slate-950 p-5 text-white shadow-xl sm:p-7">
          <div className="flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.18em] text-cyan-300">
                Orçaly Comercial
              </p>
              <h1 className="mt-3 text-4xl font-black tracking-[-0.055em] sm:text-5xl">
                Desempenho
              </h1>
              <p className="mt-3 max-w-3xl text-sm font-semibold leading-6 text-white/60">
                Carteira atual e produção comercial são medidas separadamente. Founder #00 não entra nos indicadores.
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <a
                href="/admin/prospeccao"
                className="rounded-2xl border border-white/15 px-4 py-3 text-sm font-black"
              >
                ← Pipeline
              </a>
              <button
                type="button"
                onClick={() => void refresh()}
                disabled={loading}
                className="rounded-2xl bg-white px-4 py-3 text-sm font-black text-slate-950 disabled:opacity-50"
              >
                {loading ? "Atualizando..." : "Atualizar"}
              </button>
            </div>
          </div>
        </header>

        <section className="mt-4 flex flex-wrap gap-2 rounded-2xl bg-white p-3 shadow-sm">
          {PERFORMANCE_PERIODS.map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => {
                if (item === period) return
                setLoading(true)
                setPeriod(item)
              }}
              className={`rounded-xl px-4 py-2.5 text-xs font-black ${
                item === period
                  ? "bg-slate-950 text-white"
                  : "bg-slate-50 text-slate-600"
              }`}
            >
              {PERFORMANCE_PERIOD_LABELS[item]}
            </button>
          ))}
        </section>

        {error ? (
          <div className="mt-4 rounded-2xl border border-red-100 bg-red-50 p-4 text-sm font-black text-red-700">
            {error}
          </div>
        ) : null}

        {data && activity && health ? (
          <>
            <section className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-8">
              <MetricCard
                label="Carteira"
                value={number(health.portfolio)}
                helper={`${number(health.active_portfolio)} oportunidades abertas`}
              />
              <MetricCard
                label="Contatos"
                value={number(activity.contacts)}
                helper="WhatsApp, telefone, e-mail ou reunião"
              />
              <MetricCard
                label="Demonstrações"
                value={number(activity.demonstrations)}
                helper={`${number(activity.interested)} avanços para interessado`}
              />
              <MetricCard
                label="Convites Founder"
                value={number(activity.founder_invites)}
                helper="#01 a #10; #00 excluído"
              />
              <MetricCard
                label="Contas ativadas"
                value={number(activity.founder_activations)}
                helper="Convites ativados no período"
              />
              <MetricCard
                label="Clientes"
                value={number(activity.customers)}
                helper="Primeiro pagamento Founder aprovado"
              />
              <MetricCard
                label="Ações atrasadas"
                value={number(health.overdue_actions)}
                helper={`${number(health.upcoming_actions_7d)} retornos nos próximos 7 dias`}
              />
              <MetricCard
                label="Fechamento"
                value={percent(health.closing_rate)}
                helper="Clientes entre oportunidades já encerradas"
              />
            </section>

            <section className="mt-5 rounded-[2rem] bg-white p-5 shadow-sm sm:p-6">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.15em] text-slate-400">
                    Fotografia atual
                  </p>
                  <h2 className="mt-1 text-2xl font-black">
                    Pipeline
                  </h2>
                </div>
                <div className="flex flex-wrap gap-2 text-xs font-black">
                  <span className="rounded-full bg-amber-50 px-3 py-2 text-amber-700">
                    {percent(activity.invite_activation_rate)} dos convites do período ativados
                  </span>
                  <span className="rounded-full bg-slate-100 px-3 py-2 text-slate-600">
                    {number(health.never_contacted)} sem contato registrado
                  </span>
                  {data.owner ? (
                    <span className="rounded-full bg-blue-50 px-3 py-2 text-blue-700">
                      {number(data.owner.unassigned_leads)} sem responsável
                    </span>
                  ) : null}
                </div>
              </div>

              <div className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-8">
                {PERFORMANCE_STAGES.map((stage) => (
                  <article
                    key={stage}
                    className={`rounded-2xl p-4 ${stageTone(stage)}`}
                  >
                    <p className="text-[10px] font-black uppercase tracking-[0.12em] opacity-70">
                      {PERFORMANCE_STAGE_LABELS[stage]}
                    </p>
                    <p className="mt-2 text-3xl font-black">
                      {number(data.pipeline[stage] || 0)}
                    </p>
                  </article>
                ))}
              </div>
            </section>

            <section className="mt-5 grid gap-4 lg:grid-cols-4">
              <article className="rounded-3xl bg-white p-5 shadow-sm">
                <p className="text-xs font-black uppercase tracking-[0.15em] text-slate-400">
                  Prospects criados
                </p>
                <p className="mt-3 text-3xl font-black">
                  {number(activity.prospects_created)}
                </p>
                <p className="mt-2 text-xs font-semibold text-slate-500">
                  Criados pelo comercial no período, sem contar inbound não atribuído.
                </p>
              </article>

              <article className="rounded-3xl bg-white p-5 shadow-sm">
                <p className="text-xs font-black uppercase tracking-[0.15em] text-slate-400">
                  Avanços para interessado
                </p>
                <p className="mt-3 text-3xl font-black">
                  {number(activity.interested)}
                </p>
              </article>

              <article className="rounded-3xl bg-white p-5 shadow-sm">
                <p className="text-xs font-black uppercase tracking-[0.15em] text-slate-400">
                  Perdas registradas
                </p>
                <p className="mt-3 text-3xl font-black">
                  {number(activity.lost)}
                </p>
              </article>

              <article className="rounded-3xl bg-white p-5 shadow-sm">
                <p className="text-xs font-black uppercase tracking-[0.15em] text-slate-400">
                  Ativação de convites
                </p>
                <p className="mt-3 text-3xl font-black">
                  {percent(activity.invite_activation_rate)}
                </p>
                <p className="mt-2 text-xs font-semibold text-slate-500">
                  Convites criados no período que já chegaram a activated.
                </p>
              </article>
            </section>

            {data.viewer.can_view_all ? (
              <section className="mt-5 rounded-[2rem] bg-white p-5 shadow-sm sm:p-6">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                  <div>
                    <p className="text-xs font-black uppercase tracking-[0.15em] text-blue-700">
                      Visão Owner
                    </p>
                    <h2 className="mt-1 text-2xl font-black">
                      Equipe comercial
                    </h2>
                  </div>
                  <p className="text-xs font-bold text-slate-500">
                    {number(data.owner?.active_prospectors || 0)} Prospectores ativos
                  </p>
                </div>

                {data.team.length > 0 ? (
                  <div className="mt-5 overflow-x-auto">
                    <table className="min-w-[1100px] w-full text-left text-sm">
                      <thead>
                        <tr className="border-b border-slate-100 text-[10px] font-black uppercase tracking-[0.12em] text-slate-400">
                          <th className="px-3 py-3">Prospector</th>
                          <th className="px-3 py-3">Carteira</th>
                          <th className="px-3 py-3">Contatos</th>
                          <th className="px-3 py-3">Demos</th>
                          <th className="px-3 py-3">Convites</th>
                          <th className="px-3 py-3">Ativações</th>
                          <th className="px-3 py-3">Clientes</th>
                          <th className="px-3 py-3">Perdidos</th>
                          <th className="px-3 py-3">Atrasados</th>
                          <th className="px-3 py-3">Ativação</th>
                          <th className="px-3 py-3">Fechamento</th>
                        </tr>
                      </thead>
                      <tbody>
                        {data.team.map((row) => (
                          <tr
                            key={row.id}
                            className="border-b border-slate-50 last:border-0"
                          >
                            <td className="px-3 py-4">
                              <p className="font-black text-slate-900">
                                {row.nome}
                              </p>
                              <p className="mt-1 text-xs font-semibold text-slate-400">
                                {row.email}
                              </p>
                            </td>
                            <td className="px-3 py-4 font-black">{number(row.portfolio)}</td>
                            <td className="px-3 py-4 font-black">{number(row.contacts)}</td>
                            <td className="px-3 py-4 font-black">{number(row.demonstrations)}</td>
                            <td className="px-3 py-4 font-black">{number(row.founder_invites)}</td>
                            <td className="px-3 py-4 font-black">{number(row.founder_activations)}</td>
                            <td className="px-3 py-4 font-black text-emerald-700">{number(row.customers)}</td>
                            <td className="px-3 py-4 font-black text-red-600">{number(row.lost)}</td>
                            <td className="px-3 py-4 font-black text-amber-700">{number(row.overdue_actions)}</td>
                            <td className="px-3 py-4 font-black">{percent(row.invite_activation_rate)}</td>
                            <td className="px-3 py-4 font-black">{percent(row.closing_rate)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="mt-5 rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-8 text-center">
                    <p className="font-black text-slate-700">
                      Nenhum Prospector ativo ainda.
                    </p>
                    <p className="mt-2 text-sm font-semibold text-slate-500">
                      Quando a equipe comercial for ativada, os indicadores individuais aparecerão aqui.
                    </p>
                  </div>
                )}
              </section>
            ) : (
              <section className="mt-5 rounded-[2rem] border border-blue-100 bg-blue-50 p-5 text-sm font-semibold leading-6 text-blue-900">
                Esta visão contém somente sua carteira e sua produção. Dados de outros Prospectores não são enviados para o navegador.
              </section>
            )}
          </>
        ) : null}
      </div>
    </main>
  )
}
