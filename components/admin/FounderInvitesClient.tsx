"use client"

import {
  FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react"
import { supabase } from "@/lib/supabase"
import {
  FOUNDER_PLAN_CONFIG,
  FOUNDER_STATUS_LABELS,
  founderNumberLabel,
  moneyFromCents,
  type FounderPlanKey,
} from "@/lib/founder-program"

type Prospect = {
  id: string
  email: string
  empresa_nome: string
  nome_responsavel: string | null
  whatsapp: string | null
  segmento: string | null
  cidade: string | null
  estado: string | null
  sales_stage: string
  assigned_to_admin_id: string | null
  plano: string
}

type Invite = {
  id: string
  email: string
  founder_number: number
  plan_key: FounderPlanKey
  founder_price_cents: number
  status: keyof typeof FOUNDER_STATUS_LABELS
  token_expires_at: string | null
  invited_at: string
  activated_at: string | null
  revoked_at: string | null
  token_rotated_at: string | null
  sales_lead_id: string | null
  created_by_admin_id: string | null
  created_by_email: string
  revocation_reason: string | null
  creator: {
    id: string
    nome: string
    email: string
    role: string
  } | null
  prospect: {
    id: string
    empresa_nome: string
    nome_responsavel: string | null
  } | null
}

type Viewer = {
  id: string
  email: string
  role: string
  canViewAll: boolean
  canCreate: boolean
  canRotate: boolean
  canRevoke: boolean
}

type LoadPayload = {
  viewer?: Viewer
  invites?: Invite[]
  prospects?: Prospect[]
  availableNumbers?: number[]
  testSlotAvailable?: boolean
  error?: string
}

async function currentToken() {
  const { data } = await supabase.auth.getSession()
  return data.session?.access_token || ""
}

async function fetchFounderWorkspace() {
  const token = await currentToken()

  if (!token) {
    return {
      kind: "unauthenticated" as const,
    }
  }

  const response = await fetch("/api/admin/founders", {
    headers: {
      Authorization: `Bearer ${token}`,
    },
    cache: "no-store",
  })

  const payload = (await response
    .json()
    .catch(() => ({}))) as LoadPayload

  return {
    kind: "response" as const,
    ok: response.ok,
    payload,
  }
}

function shortDate(value: string | null) {
  if (!value) return "Sem prazo"

  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return "Data inválida"

  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(parsed)
}

function statusTone(status: Invite["status"]) {
  if (status === "activated") return "bg-emerald-50 text-emerald-700"
  if (status === "pending") return "bg-amber-50 text-amber-700"
  if (status === "revoked") return "bg-red-50 text-red-700"
  return "bg-slate-100 text-slate-500"
}

export default function FounderInvitesClient({
  initialLeadId,
}: {
  initialLeadId?: string
}) {
  const [viewer, setViewer] = useState<Viewer | null>(null)
  const [invites, setInvites] = useState<Invite[]>([])
  const [prospects, setProspects] = useState<Prospect[]>([])
  const [availableNumbers, setAvailableNumbers] =
    useState<number[]>([])
  const [testSlotAvailable, setTestSlotAvailable] = useState(false)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState("")
  const [error, setError] = useState("")
  const [message, setMessage] = useState("")
  const [generatedLinks, setGeneratedLinks] = useState<
    Record<string, string>
  >({})
  const [form, setForm] = useState({
    lead_id: initialLeadId || "",
    plan: "profissional" as FounderPlanKey,
    founder_number: "",
  })
  const [testForm, setTestForm] = useState({
    email: "",
    plan: "profissional" as FounderPlanKey,
  })

  const load = useCallback(async () => {
    const result = await fetchFounderWorkspace()

    if (result.kind === "unauthenticated") {
      window.location.href = "/admin/login"
      return
    }

    const payload = result.payload

    if (!result.ok) {
      setError(
        payload.error ||
          "Não foi possível carregar o Programa Founder.",
      )
      setLoading(false)
      return
    }

    setError("")
    setViewer(payload.viewer || null)
    setInvites(payload.invites || [])
    setProspects(payload.prospects || [])
    setAvailableNumbers(payload.availableNumbers || [])
    setTestSlotAvailable(Boolean(payload.testSlotAvailable))

    if (
      initialLeadId &&
      (payload.prospects || []).some(
        (item) => item.id === initialLeadId,
      )
    ) {
      setForm((current) => ({
        ...current,
        lead_id: initialLeadId,
      }))
    }

    setLoading(false)
  }, [initialLeadId])

  useEffect(() => {
    let ignore = false

    void fetchFounderWorkspace()
      .then((result) => {
        if (ignore) return

        if (result.kind === "unauthenticated") {
          window.location.href = "/admin/login"
          return
        }

        const payload = result.payload

        if (!result.ok) {
          setError(
            payload.error ||
              "Não foi possível carregar o Programa Founder.",
          )
          setLoading(false)
          return
        }

        setError("")
        setViewer(payload.viewer || null)
        setInvites(payload.invites || [])
        setProspects(payload.prospects || [])
        setAvailableNumbers(payload.availableNumbers || [])
        setTestSlotAvailable(Boolean(payload.testSlotAvailable))

        if (
          initialLeadId &&
          (payload.prospects || []).some(
            (item) => item.id === initialLeadId,
          )
        ) {
          setForm((current) => ({
            ...current,
            lead_id: initialLeadId,
          }))
        }

        setLoading(false)
      })
      .catch(() => {
        if (ignore) return

        setError(
          "Não foi possível carregar o Programa Founder.",
        )
        setLoading(false)
      })

    return () => {
      ignore = true
    }
  }, [initialLeadId])

  async function action(
    actionName: string,
    body: Record<string, unknown>,
  ) {
    setBusy(actionName)
    setError("")
    setMessage("")

    const token = await currentToken()
    const response = await fetch("/api/admin/founders", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        action: actionName,
        ...body,
      }),
    })

    const payload = (await response
      .json()
      .catch(() => ({}))) as {
      error?: string
      message?: string
      activationPath?: string
      invite?: Invite
    }

    if (!response.ok) {
      setError(
        payload.error ||
          "Não foi possível concluir a operação.",
      )
      setBusy("")
      return null
    }

    if (payload.invite?.id && payload.activationPath) {
      setGeneratedLinks((current) => ({
        ...current,
        [payload.invite!.id]: payload.activationPath!,
      }))
    }

    setMessage(payload.message || "Operação concluída.")
    setBusy("")
    await load()
    return payload
  }

  async function createInvite(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault()

    const saved = await action("create", {
      lead_id: form.lead_id,
      plan: form.plan,
      founder_number: form.founder_number || null,
    })

    if (saved) {
      setForm({
        lead_id: "",
        plan: "profissional",
        founder_number: "",
      })
    }
  }

  async function createTest(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault()

    const saved = await action("create_test", testForm)

    if (saved) {
      setTestForm({
        email: "",
        plan: "profissional",
      })
    }
  }

  async function copyLink(invite: Invite) {
    const path = generatedLinks[invite.id]

    if (!path) {
      setMessage("")
      setError(
        "O token em claro não fica salvo. Gere um novo link para copiá-lo.",
      )
      return
    }

    await navigator.clipboard.writeText(
      `${window.location.origin}${path}`,
    )

    setError("")
    setMessage(
      `Link do Founder ${founderNumberLabel(invite.founder_number)} copiado.`,
    )
  }

  const liveCount = useMemo(
    () =>
      invites.filter(
        (item) =>
          item.status === "pending" ||
          item.status === "activated",
      ).length,
    [invites],
  )

  if (loading) {
    return (
      <main className="grid min-h-screen place-items-center bg-slate-50 text-slate-950">
        <p className="font-black">Carregando Programa Founder...</p>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-8 text-slate-950 sm:px-6">
      <div className="mx-auto max-w-7xl">
        <header className="rounded-[2rem] bg-[#071b3a] p-6 text-white shadow-xl sm:p-8">
          <p className="text-xs font-black uppercase tracking-[0.18em] text-cyan-200">
            Orçaly Comercial
          </p>
          <div className="mt-3 flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <h1 className="text-4xl font-black tracking-[-0.05em]">
                Clientes Fundadores
              </h1>
              <p className="mt-3 max-w-3xl text-sm font-semibold leading-6 text-white/60">
                Reserve os números #01 a #10, gere links descartáveis e acompanhe cada convite.
                O #00 é técnico e exclusivo do Owner.
              </p>
            </div>

            <div className="flex gap-2">
              <a
                href="/admin/prospeccao"
                className="rounded-2xl border border-white/15 px-4 py-3 text-sm font-black"
              >
                Prospecção
              </a>
              <button
                type="button"
                onClick={() => {
                  setLoading(true)
                  void load()
                }}
                className="rounded-2xl bg-white px-4 py-3 text-sm font-black text-[#071b3a]"
              >
                Atualizar
              </button>
            </div>
          </div>
        </header>

        <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-bold text-emerald-800">
          A ativação pública Founder está disponível. O cliente cria a própria senha,
          recebe 30 dias gratuitos e entra no painel sem cobrança imediata.
        </div>

        {message ? (
          <div className="mt-4 rounded-2xl border border-emerald-100 bg-emerald-50 p-4 text-sm font-black text-emerald-700">
            {message}
          </div>
        ) : null}

        {error ? (
          <div className="mt-4 rounded-2xl border border-red-100 bg-red-50 p-4 text-sm font-black text-red-700">
            {error}
          </div>
        ) : null}

        <section className="mt-5 grid gap-3 sm:grid-cols-3">
          <article className="rounded-3xl bg-white p-5 shadow-sm">
            <p className="text-xs font-black uppercase tracking-[0.15em] text-slate-400">
              Vagas reais disponíveis
            </p>
            <p className="mt-2 text-3xl font-black">
              {availableNumbers.length}/10
            </p>
          </article>

          <article className="rounded-3xl bg-white p-5 shadow-sm">
            <p className="text-xs font-black uppercase tracking-[0.15em] text-slate-400">
              Convites visíveis
            </p>
            <p className="mt-2 text-3xl font-black">{invites.length}</p>
          </article>

          <article className="rounded-3xl bg-white p-5 shadow-sm">
            <p className="text-xs font-black uppercase tracking-[0.15em] text-slate-400">
              Reservas ativas
            </p>
            <p className="mt-2 text-3xl font-black">{liveCount}</p>
          </article>
        </section>

        <section className="mt-5 rounded-[1.8rem] bg-white p-5 shadow-sm">
          <div className="flex flex-wrap gap-2">
            {Array.from({ length: 10 }, (_, index) => index + 1).map(
              (number) => {
                const available = availableNumbers.includes(number)

                return (
                  <span
                    key={number}
                    className={`rounded-2xl px-4 py-3 text-sm font-black ${
                      available
                        ? "bg-emerald-50 text-emerald-700"
                        : "bg-slate-900 text-white"
                    }`}
                  >
                    {founderNumberLabel(number)}{" "}
                    {available ? "livre" : "reservado"}
                  </span>
                )
              },
            )}
          </div>
        </section>

        <div className="mt-5 grid gap-5 xl:grid-cols-[420px_minmax(0,1fr)]">
          <div className="grid content-start gap-5">
            {viewer?.canCreate ? (
              <form
                onSubmit={createInvite}
                className="rounded-[1.8rem] bg-white p-5 shadow-sm"
              >
                <p className="text-xs font-black uppercase tracking-[0.15em] text-blue-700">
                  Novo convite
                </p>
                <h2 className="mt-2 text-2xl font-black">
                  Reservar Founder
                </h2>

                <label className="mt-5 grid gap-2 text-sm font-black">
                  Prospect
                  <select
                    required
                    value={form.lead_id}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        lead_id: event.target.value,
                      }))
                    }
                    className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3.5"
                  >
                    <option value="">Selecione</option>
                    {prospects.map((prospect) => (
                      <option key={prospect.id} value={prospect.id}>
                        {prospect.empresa_nome} · {prospect.email}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="mt-4 grid gap-2 text-sm font-black">
                  Plano
                  <select
                    value={form.plan}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        plan: event.target.value as FounderPlanKey,
                      }))
                    }
                    className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3.5"
                  >
                    {Object.entries(FOUNDER_PLAN_CONFIG).map(
                      ([key, config]) => (
                        <option key={key} value={key}>
                          {config.label} ·{" "}
                          {moneyFromCents(config.founderPriceCents)}
                        </option>
                      ),
                    )}
                  </select>
                </label>

                <label className="mt-4 grid gap-2 text-sm font-black">
                  Número
                  <select
                    value={form.founder_number}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        founder_number: event.target.value,
                      }))
                    }
                    className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3.5"
                  >
                    <option value="">Automático: primeiro livre</option>
                    {availableNumbers.map((number) => (
                      <option key={number} value={number}>
                        {founderNumberLabel(number)}
                      </option>
                    ))}
                  </select>
                </label>

                <button
                  type="submit"
                  disabled={busy === "create"}
                  className="mt-5 w-full rounded-2xl bg-blue-700 px-5 py-4 font-black text-white disabled:opacity-50"
                >
                  {busy === "create"
                    ? "Reservando..."
                    : "Criar convite Founder"}
                </button>
              </form>
            ) : null}

            {viewer?.role === "owner" ? (
              <form
                onSubmit={createTest}
                className="rounded-[1.8rem] border border-violet-100 bg-violet-50 p-5"
              >
                <p className="text-xs font-black uppercase tracking-[0.15em] text-violet-700">
                  Ambiente técnico
                </p>
                <h2 className="mt-2 text-xl font-black">
                  Founder #00
                </h2>
                <p className="mt-2 text-xs font-bold leading-5 text-violet-700/70">
                  Não consome uma das 10 vagas reais. Somente o Owner pode criar.
                </p>

                <input
                  required
                  type="email"
                  value={testForm.email}
                  onChange={(event) =>
                    setTestForm((current) => ({
                      ...current,
                      email: event.target.value,
                    }))
                  }
                  placeholder="email-de-teste@exemplo.com"
                  className="mt-4 w-full rounded-2xl border border-violet-100 bg-white px-4 py-3.5 font-semibold"
                />

                <select
                  value={testForm.plan}
                  onChange={(event) =>
                    setTestForm((current) => ({
                      ...current,
                      plan: event.target.value as FounderPlanKey,
                    }))
                  }
                  className="mt-3 w-full rounded-2xl border border-violet-100 bg-white px-4 py-3.5 font-bold"
                >
                  {Object.entries(FOUNDER_PLAN_CONFIG).map(
                    ([key, config]) => (
                      <option key={key} value={key}>
                        {config.label}
                      </option>
                    ),
                  )}
                </select>

                <button
                  type="submit"
                  disabled={
                    !testSlotAvailable ||
                    busy === "create_test"
                  }
                  className="mt-4 w-full rounded-2xl bg-violet-700 px-4 py-3.5 font-black text-white disabled:opacity-40"
                >
                  {testSlotAvailable
                    ? "Criar #00"
                    : "#00 já reservado"}
                </button>
              </form>
            ) : null}
          </div>

          <section className="min-w-0">
            <div className="grid gap-3">
              {invites.map((invite) => (
                <article
                  key={invite.id}
                  className="rounded-[1.7rem] bg-white p-5 shadow-sm"
                >
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded-full bg-[#071b3a] px-3 py-1.5 text-xs font-black text-white">
                          {founderNumberLabel(invite.founder_number)}
                        </span>
                        <span
                          className={`rounded-full px-3 py-1.5 text-[10px] font-black uppercase ${statusTone(invite.status)}`}
                        >
                          {FOUNDER_STATUS_LABELS[invite.status]}
                        </span>
                      </div>

                      <h3 className="mt-3 text-xl font-black">
                        {invite.prospect?.empresa_nome ||
                          (invite.founder_number === 0
                            ? "Convite técnico"
                            : invite.email)}
                      </h3>
                      <p className="mt-1 break-all text-sm font-bold text-slate-500">
                        {invite.email}
                      </p>

                      <div className="mt-3 flex flex-wrap gap-2 text-xs font-bold text-slate-500">
                        <span>
                          {FOUNDER_PLAN_CONFIG[invite.plan_key]?.label ||
                            invite.plan_key}
                        </span>
                        <span>•</span>
                        <span>
                          {moneyFromCents(invite.founder_price_cents)}/mês
                        </span>
                        <span>•</span>
                        <span>
                          expira {shortDate(invite.token_expires_at)}
                        </span>
                      </div>

                      {viewer?.canViewAll && invite.creator ? (
                        <p className="mt-2 text-xs font-semibold text-slate-400">
                          Criado por {invite.creator.nome || invite.creator.email}
                        </p>
                      ) : null}

                      {invite.revocation_reason ? (
                        <p className="mt-3 rounded-xl bg-red-50 p-3 text-xs font-bold text-red-700">
                          Motivo: {invite.revocation_reason}
                        </p>
                      ) : null}
                    </div>

                    {invite.status === "pending" ? (
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => void copyLink(invite)}
                          className="rounded-xl border border-blue-100 bg-blue-50 px-3 py-2.5 text-xs font-black text-blue-700"
                        >
                          Copiar link
                        </button>

                        {viewer?.canRotate ? (
                          <button
                            type="button"
                            onClick={() =>
                              void action("rotate", {
                                id: invite.id,
                              })
                            }
                            disabled={busy === "rotate"}
                            className="rounded-xl border border-amber-100 bg-amber-50 px-3 py-2.5 text-xs font-black text-amber-700 disabled:opacity-50"
                          >
                            Gerar novo link
                          </button>
                        ) : null}

                        {viewer?.canRevoke ? (
                          <button
                            type="button"
                            onClick={() => {
                              const reason =
                                window.prompt(
                                  "Motivo da revogação (opcional):",
                                ) || ""
                              void action("revoke", {
                                id: invite.id,
                                reason,
                              })
                            }}
                            disabled={busy === "revoke"}
                            className="rounded-xl border border-red-100 bg-red-50 px-3 py-2.5 text-xs font-black text-red-700 disabled:opacity-50"
                          >
                            Revogar
                          </button>
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                </article>
              ))}

              {invites.length === 0 ? (
                <div className="rounded-[1.7rem] border border-dashed border-slate-200 bg-white p-10 text-center text-sm font-bold text-slate-400">
                  Nenhum convite Founder nesta visão.
                </div>
              ) : null}
            </div>
          </section>
        </div>
      </div>
    </main>
  )
}
