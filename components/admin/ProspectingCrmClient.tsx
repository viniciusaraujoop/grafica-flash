"use client"

/* eslint-disable react-hooks/set-state-in-effect */

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react"
import { supabase } from "@/lib/supabase"
import {
  CONTACT_CHANNELS,
  MANUAL_SALES_STAGES,
  SALES_STAGE_LABELS,
  SALES_STAGES,
  type ContactChannel,
  type SalesStage,
} from "@/lib/prospecting"

type Assignee = {
  id: string
  nome: string
  email: string
  role: string
}

type Prospect = {
  id: string
  nome_responsavel: string | null
  email: string
  whatsapp: string | null
  empresa_nome: string
  segmento: string | null
  cidade: string | null
  estado: string | null
  plano: string
  status: string
  lead_source: string
  payment_status: string | null
  converted_company_id: string | null
  followup_count: number
  last_followup_at: string | null
  sales_stage: SalesStage
  assigned_to_admin_id: string | null
  created_by_admin_id: string | null
  sales_notes?: string | null
  sales_stage_updated_at: string
  sales_last_contact_at: string | null
  sales_next_action_at: string | null
  sales_lost_reason: string | null
  created_at: string | null
  updated_at: string | null
  assignee?: Assignee | null
}

type Followup = {
  id: string
  channel: string
  status: string
  message: string | null
  admin_email: string | null
  sales_event_type: string
  created_at: string | null
}

type Viewer = {
  id: string
  role: string
  canViewAll: boolean
  canCreate: boolean
  canEditOwn: boolean
}

type ListPayload = {
  prospects?: Prospect[]
  assignees?: Assignee[]
  viewer?: Viewer
  error?: string
}

const emptyCreate = {
  empresa_nome: "",
  nome_responsavel: "",
  email: "",
  whatsapp: "",
  segmento: "",
  cidade: "",
  estado: "",
  assigned_to_admin_id: "",
}

async function accessToken() {
  const { data } = await supabase.auth.getSession()
  return data.session?.access_token || ""
}

function shortDate(value: string | null | undefined) {
  if (!value) return "Sem registro"

  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return "Sem registro"

  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(parsed)
}

function toLocalInput(value: string | null | undefined) {
  if (!value) return ""

  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return ""

  const local = new Date(
    parsed.getTime() - parsed.getTimezoneOffset() * 60_000,
  )

  return local.toISOString().slice(0, 16)
}

function stageTone(stage: SalesStage) {
  const tones: Record<SalesStage, string> = {
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

export default function ProspectingCrmClient() {
  const [prospects, setProspects] = useState<Prospect[]>([])
  const [assignees, setAssignees] = useState<Assignee[]>([])
  const [viewer, setViewer] = useState<Viewer | null>(null)
  const [selected, setSelected] = useState<Prospect | null>(null)
  const [followups, setFollowups] = useState<Followup[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState("")
  const [error, setError] = useState("")
  const [message, setMessage] = useState("")
  const [search, setSearch] = useState("")
  const [stageFilter, setStageFilter] = useState<"todos" | SalesStage>("todos")
  const [createOpen, setCreateOpen] = useState(false)
  const [createForm, setCreateForm] = useState(emptyCreate)

  const [editForm, setEditForm] = useState({
    empresa_nome: "",
    nome_responsavel: "",
    whatsapp: "",
    segmento: "",
    cidade: "",
    estado: "",
    sales_notes: "",
    sales_next_action_at: "",
  })

  const [stageForm, setStageForm] = useState({
    stage: "novo" as (typeof MANUAL_SALES_STAGES)[number],
    note: "",
    lost_reason: "",
  })

  const [contactForm, setContactForm] = useState({
    channel: "whatsapp" as ContactChannel,
    message: "",
    next_action_at: "",
  })

  const load = useCallback(async () => {
    setLoading(true)
    setError("")

    const token = await accessToken()

    if (!token) {
      window.location.href = "/admin/login"
      return
    }

    const response = await fetch("/api/admin/prospecting", {
      headers: {
        Authorization: `Bearer ${token}`,
      },
      cache: "no-store",
    })

    const payload = (await response.json().catch(() => ({}))) as ListPayload

    if (!response.ok) {
      setError(payload.error || "Não foi possível carregar a prospecção.")
      setLoading(false)
      return
    }

    setProspects(payload.prospects || [])
    setAssignees(payload.assignees || [])
    setViewer(payload.viewer || null)
    setLoading(false)
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  async function openProspect(leadId: string) {
    setBusy(`open:${leadId}`)
    setError("")

    const token = await accessToken()
    const response = await fetch(
      `/api/admin/prospecting?lead_id=${encodeURIComponent(leadId)}`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
        cache: "no-store",
      },
    )

    const payload = (await response.json().catch(() => ({}))) as {
      prospect?: Prospect
      followups?: Followup[]
      error?: string
    }

    setBusy("")

    if (!response.ok || !payload.prospect) {
      setError(payload.error || "Não foi possível abrir o prospect.")
      return
    }

    const prospect = payload.prospect
    setSelected(prospect)
    setFollowups(payload.followups || [])
    setEditForm({
      empresa_nome: prospect.empresa_nome || "",
      nome_responsavel: prospect.nome_responsavel || "",
      whatsapp: prospect.whatsapp || "",
      segmento: prospect.segmento || "",
      cidade: prospect.cidade || "",
      estado: prospect.estado || "",
      sales_notes: prospect.sales_notes || "",
      sales_next_action_at: toLocalInput(
        prospect.sales_next_action_at,
      ),
    })

    const currentManual = MANUAL_SALES_STAGES.includes(
      prospect.sales_stage as (typeof MANUAL_SALES_STAGES)[number],
    )
      ? (prospect.sales_stage as (typeof MANUAL_SALES_STAGES)[number])
      : "novo"

    setStageForm({
      stage: currentManual,
      note: "",
      lost_reason: prospect.sales_lost_reason || "",
    })

    setContactForm({
      channel: "whatsapp",
      message: "",
      next_action_at: toLocalInput(
        prospect.sales_next_action_at,
      ),
    })
  }

  async function action(
    actionName: string,
    body: Record<string, unknown>,
  ) {
    setBusy(actionName)
    setError("")
    setMessage("")

    const token = await accessToken()
    const response = await fetch("/api/admin/prospecting", {
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

    const payload = (await response.json().catch(() => ({}))) as {
      error?: string
      message?: string
      leadId?: string
    }

    setBusy("")

    if (!response.ok) {
      setError(payload.error || "Não foi possível concluir a operação.")
      return null
    }

    setMessage(payload.message || "Alteração salva.")
    await load()

    return payload
  }

  async function createProspect(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const result = await action("create", createForm)

    if (!result) return

    setCreateForm(emptyCreate)
    setCreateOpen(false)

    if (result.leadId) {
      await openProspect(result.leadId)
    }
  }

  async function saveProspect(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!selected) return

    const result = await action("update", {
      lead_id: selected.id,
      ...editForm,
      sales_next_action_at: editForm.sales_next_action_at
        ? new Date(editForm.sales_next_action_at).toISOString()
        : null,
    })

    if (result) {
      await openProspect(selected.id)
    }
  }

  async function saveStage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!selected) return

    const result = await action("stage", {
      lead_id: selected.id,
      ...stageForm,
    })

    if (result) {
      await openProspect(selected.id)
    }
  }

  async function saveContact(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!selected) return

    const result = await action("contact", {
      lead_id: selected.id,
      channel: contactForm.channel,
      message: contactForm.message,
      next_action_at: contactForm.next_action_at
        ? new Date(contactForm.next_action_at).toISOString()
        : null,
    })

    if (result) {
      setContactForm((current) => ({
        ...current,
        message: "",
      }))
      await openProspect(selected.id)
    }
  }

  async function assignProspect(assigneeId: string) {
    if (!selected || !assigneeId) return

    const result = await action("assign", {
      lead_id: selected.id,
      assigned_to_admin_id: assigneeId,
    })

    if (result) {
      await openProspect(selected.id)
    }
  }

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase()

    return prospects.filter((item) => {
      if (
        stageFilter !== "todos" &&
        item.sales_stage !== stageFilter
      ) {
        return false
      }

      if (!term) return true

      return [
        item.empresa_nome,
        item.nome_responsavel,
        item.email,
        item.whatsapp,
        item.segmento,
        item.cidade,
      ].some((value) =>
        String(value || "").toLowerCase().includes(term),
      )
    })
  }, [prospects, search, stageFilter])

  const counts = useMemo(
    () =>
      Object.fromEntries(
        SALES_STAGES.map((stage) => [
          stage,
          prospects.filter((item) => item.sales_stage === stage).length,
        ]),
      ) as Record<SalesStage, number>,
    [prospects],
  )

  if (loading) {
    return (
      <main className="grid min-h-screen place-items-center bg-slate-50 text-slate-950">
        <div className="text-center">
          <div className="mx-auto h-10 w-10 animate-spin rounded-full border-4 border-slate-200 border-t-slate-950" />
          <p className="mt-4 font-black">Carregando carteira comercial...</p>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-slate-50 px-3 py-5 text-slate-950 sm:px-6">
      <div className="mx-auto max-w-[1500px]">
        <header className="overflow-hidden rounded-[2rem] bg-slate-950 p-5 text-white shadow-xl sm:p-7">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.18em] text-cyan-300">
                Orçaly Comercial
              </p>
              <h1 className="mt-3 text-4xl font-black tracking-[-0.055em] sm:text-5xl">
                Prospecção
              </h1>
              <p className="mt-3 max-w-3xl text-sm font-semibold leading-6 text-white/60">
                Pipeline comercial separado do checkout. Cada Prospector enxerga somente a própria carteira; o Owner enxerga e redistribui o conjunto.
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              {viewer?.canCreate ? (
                <button
                  type="button"
                  onClick={() => setCreateOpen(true)}
                  className="rounded-2xl bg-white px-5 py-3 text-sm font-black text-slate-950"
                >
                  + Novo prospect
                </button>
              ) : null}
              <a
                href="/admin/prospeccao/desempenho"
                className="rounded-2xl border border-cyan-300/30 bg-cyan-300/10 px-5 py-3 text-sm font-black text-cyan-100"
              >
                Desempenho
              </a>
              <button
                type="button"
                onClick={() => void load()}
                className="rounded-2xl border border-white/15 px-5 py-3 text-sm font-black"
              >
                Atualizar
              </button>
            </div>
          </div>
        </header>

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

        <section className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-8">
          {SALES_STAGES.map((stage) => (
            <button
              type="button"
              key={stage}
              onClick={() =>
                setStageFilter((current) =>
                  current === stage ? "todos" : stage,
                )
              }
              className={`rounded-2xl border p-4 text-left shadow-sm ${
                stageFilter === stage
                  ? "border-slate-950 bg-slate-950 text-white"
                  : "border-white bg-white"
              }`}
            >
              <p className="text-[10px] font-black uppercase tracking-[0.12em] opacity-60">
                {SALES_STAGE_LABELS[stage]}
              </p>
              <p className="mt-2 text-2xl font-black">{counts[stage]}</p>
            </button>
          ))}
        </section>

        <section className="mt-5 rounded-[1.8rem] border border-white bg-white p-4 shadow-sm sm:p-5">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.15em] text-slate-400">
                Carteira
              </p>
              <h2 className="mt-1 text-2xl font-black">
                {viewer?.canViewAll ? "Todos os prospects" : "Meus prospects"}
              </h2>
            </div>

            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Buscar empresa, pessoa, e-mail..."
              className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 font-semibold outline-none focus:border-slate-950 md:max-w-md"
            />
          </div>

          <div className="mt-4 grid gap-3 lg:grid-cols-2">
            {filtered.map((prospect) => (
              <button
                type="button"
                key={prospect.id}
                onClick={() => void openProspect(prospect.id)}
                className="rounded-[1.5rem] border border-slate-100 bg-slate-50 p-4 text-left transition hover:border-slate-300 hover:bg-white"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="truncate text-lg font-black">
                      {prospect.empresa_nome}
                    </h3>
                    <p className="mt-1 truncate text-sm font-bold text-slate-500">
                      {prospect.nome_responsavel || "Responsável não informado"}
                    </p>
                  </div>
                  <span className={`rounded-full px-3 py-1.5 text-[10px] font-black ${stageTone(prospect.sales_stage)}`}>
                    {SALES_STAGE_LABELS[prospect.sales_stage]}
                  </span>
                </div>

                <p className="mt-3 break-all text-xs font-bold text-slate-500">
                  {prospect.email}
                </p>

                <div className="mt-3 flex flex-wrap gap-2 text-[10px] font-black text-slate-400">
                  <span>{prospect.lead_source === "prospeccao" ? "Manual" : "Inbound"}</span>
                  <span>•</span>
                  <span>{prospect.followup_count || 0} contato(s)</span>
                  <span>•</span>
                  <span>
                    {prospect.assignee?.nome || "Sem responsável"}
                  </span>
                </div>

                {prospect.sales_next_action_at ? (
                  <p className="mt-3 rounded-xl bg-amber-50 px-3 py-2 text-xs font-black text-amber-700">
                    Próxima ação: {shortDate(prospect.sales_next_action_at)}
                  </p>
                ) : null}
              </button>
            ))}
          </div>

          {filtered.length === 0 ? (
            <div className="mt-5 rounded-2xl border border-dashed border-slate-200 p-8 text-center text-sm font-bold text-slate-400">
              Nenhum prospect encontrado nesse filtro.
            </div>
          ) : null}
        </section>
      </div>

      {createOpen ? (
        <div className="fixed inset-0 z-[120] grid place-items-center overflow-y-auto bg-slate-950/70 p-4 backdrop-blur-sm">
          <form
            onSubmit={createProspect}
            className="my-auto w-full max-w-2xl rounded-[1.8rem] bg-white p-5 shadow-2xl sm:p-7"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.16em] text-blue-700">
                  Nova oportunidade
                </p>
                <h2 className="mt-2 text-2xl font-black">Cadastrar prospect</h2>
              </div>
              <button
                type="button"
                onClick={() => setCreateOpen(false)}
                className="grid h-10 w-10 place-items-center rounded-xl bg-slate-100 text-xl font-black"
              >
                ×
              </button>
            </div>

            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <input
                required
                value={createForm.empresa_nome}
                onChange={(event) =>
                  setCreateForm((current) => ({
                    ...current,
                    empresa_nome: event.target.value,
                  }))
                }
                placeholder="Empresa *"
                className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3.5 font-semibold outline-none"
              />
              <input
                required
                type="email"
                value={createForm.email}
                onChange={(event) =>
                  setCreateForm((current) => ({
                    ...current,
                    email: event.target.value,
                  }))
                }
                placeholder="E-mail *"
                className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3.5 font-semibold outline-none"
              />
              <input
                value={createForm.nome_responsavel}
                onChange={(event) =>
                  setCreateForm((current) => ({
                    ...current,
                    nome_responsavel: event.target.value,
                  }))
                }
                placeholder="Pessoa responsável"
                className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3.5 font-semibold outline-none"
              />
              <input
                value={createForm.whatsapp}
                onChange={(event) =>
                  setCreateForm((current) => ({
                    ...current,
                    whatsapp: event.target.value,
                  }))
                }
                placeholder="WhatsApp"
                className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3.5 font-semibold outline-none"
              />
              <input
                value={createForm.segmento}
                onChange={(event) =>
                  setCreateForm((current) => ({
                    ...current,
                    segmento: event.target.value,
                  }))
                }
                placeholder="Segmento"
                className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3.5 font-semibold outline-none"
              />
              <input
                value={createForm.cidade}
                onChange={(event) =>
                  setCreateForm((current) => ({
                    ...current,
                    cidade: event.target.value,
                  }))
                }
                placeholder="Cidade"
                className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3.5 font-semibold outline-none"
              />
              <input
                value={createForm.estado}
                onChange={(event) =>
                  setCreateForm((current) => ({
                    ...current,
                    estado: event.target.value,
                  }))
                }
                placeholder="Estado"
                className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3.5 font-semibold outline-none"
              />

              {viewer?.canViewAll ? (
                <select
                  value={createForm.assigned_to_admin_id}
                  onChange={(event) =>
                    setCreateForm((current) => ({
                      ...current,
                      assigned_to_admin_id: event.target.value,
                    }))
                  }
                  className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3.5 font-semibold outline-none"
                >
                  <option value="">Atribuir a mim</option>
                  {assignees.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.nome} · {item.role}
                    </option>
                  ))}
                </select>
              ) : null}
            </div>

            <button
              type="submit"
              disabled={busy === "create"}
              className="mt-5 w-full rounded-2xl bg-slate-950 px-5 py-4 font-black text-white disabled:opacity-50"
            >
              {busy === "create" ? "Salvando..." : "Salvar prospect"}
            </button>
          </form>
        </div>
      ) : null}

      {selected ? (
        <div className="fixed inset-0 z-[110] overflow-y-auto bg-slate-950/70 p-3 backdrop-blur-sm sm:p-6">
          <div className="mx-auto my-3 max-w-6xl rounded-[2rem] bg-white p-4 shadow-2xl sm:p-6">
            <div className="flex flex-col gap-4 border-b border-slate-100 pb-5 md:flex-row md:items-start md:justify-between">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className={`rounded-full px-3 py-1.5 text-[10px] font-black ${stageTone(selected.sales_stage)}`}>
                    {SALES_STAGE_LABELS[selected.sales_stage]}
                  </span>
                  <span className="rounded-full bg-slate-100 px-3 py-1.5 text-[10px] font-black text-slate-500">
                    {selected.lead_source === "prospeccao" ? "Manual" : "Inbound"}
                  </span>
                </div>
                <h2 className="mt-3 text-3xl font-black tracking-[-0.04em]">
                  {selected.empresa_nome}
                </h2>
                <p className="mt-1 text-sm font-bold text-slate-500">
                  {selected.email}
                </p>
              </div>

              <button
                type="button"
                onClick={() => setSelected(null)}
                className="rounded-2xl bg-slate-100 px-4 py-3 text-sm font-black"
              >
                Fechar
              </button>
            </div>

            <div className="mt-5 grid gap-5 xl:grid-cols-[1fr_1fr]">
              <div className="grid content-start gap-4">
                {viewer?.canViewAll ? (
                  <section className="rounded-[1.5rem] border border-slate-100 p-4">
                    <p className="text-xs font-black uppercase tracking-[0.15em] text-slate-400">
                      Responsável comercial
                    </p>
                    <select
                      value={selected.assigned_to_admin_id || ""}
                      onChange={(event) => void assignProspect(event.target.value)}
                      className="mt-3 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 font-bold outline-none"
                    >
                      <option value="">Sem responsável</option>
                      {assignees.map((item) => (
                        <option key={item.id} value={item.id}>
                          {item.nome} · {item.email}
                        </option>
                      ))}
                    </select>
                  </section>
                ) : null}

                <form
                  onSubmit={saveProspect}
                  className="rounded-[1.5rem] border border-slate-100 p-4"
                >
                  <h3 className="font-black">Dados comerciais</h3>
                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    {(
                      [
                        ["empresa_nome", "Empresa"],
                        ["nome_responsavel", "Responsável"],
                        ["whatsapp", "WhatsApp"],
                        ["segmento", "Segmento"],
                        ["cidade", "Cidade"],
                        ["estado", "Estado"],
                      ] as const
                    ).map(([key, label]) => (
                      <label key={key} className="grid gap-1 text-xs font-black text-slate-500">
                        {label}
                        <input
                          value={editForm[key]}
                          onChange={(event) =>
                            setEditForm((current) => ({
                              ...current,
                              [key]: event.target.value,
                            }))
                          }
                          className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm font-semibold text-slate-950 outline-none"
                        />
                      </label>
                    ))}
                  </div>

                  <label className="mt-3 grid gap-1 text-xs font-black text-slate-500">
                    Observações comerciais
                    <textarea
                      value={editForm.sales_notes}
                      onChange={(event) =>
                        setEditForm((current) => ({
                          ...current,
                          sales_notes: event.target.value,
                        }))
                      }
                      rows={4}
                      className="resize-none rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm font-semibold text-slate-950 outline-none"
                    />
                  </label>

                  <label className="mt-3 grid gap-1 text-xs font-black text-slate-500">
                    Próxima ação
                    <input
                      type="datetime-local"
                      value={editForm.sales_next_action_at}
                      onChange={(event) =>
                        setEditForm((current) => ({
                          ...current,
                          sales_next_action_at: event.target.value,
                        }))
                      }
                      className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm font-semibold text-slate-950 outline-none"
                    />
                  </label>

                  <button
                    type="submit"
                    disabled={busy === "update"}
                    className="mt-4 w-full rounded-xl bg-slate-950 px-4 py-3 font-black text-white disabled:opacity-50"
                  >
                    Salvar dados
                  </button>
                </form>

                <form
                  onSubmit={saveStage}
                  className="rounded-[1.5rem] border border-slate-100 p-4"
                >
                  <h3 className="font-black">Mover no pipeline</h3>

                  <select
                    value={stageForm.stage}
                    onChange={(event) =>
                      setStageForm((current) => ({
                        ...current,
                        stage: event.target.value as (typeof MANUAL_SALES_STAGES)[number],
                      }))
                    }
                    className="mt-3 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 font-bold outline-none"
                  >
                    {MANUAL_SALES_STAGES.map((stage) => (
                      <option key={stage} value={stage}>
                        {SALES_STAGE_LABELS[stage]}
                      </option>
                    ))}
                  </select>

                  {stageForm.stage === "perdido" ? (
                    <input
                      required
                      value={stageForm.lost_reason}
                      onChange={(event) =>
                        setStageForm((current) => ({
                          ...current,
                          lost_reason: event.target.value,
                        }))
                      }
                      placeholder="Motivo da perda *"
                      className="mt-3 w-full rounded-xl border border-red-100 bg-red-50 px-3 py-3 font-semibold outline-none"
                    />
                  ) : null}

                  <input
                    value={stageForm.note}
                    onChange={(event) =>
                      setStageForm((current) => ({
                        ...current,
                        note: event.target.value,
                      }))
                    }
                    placeholder="Observação da mudança (opcional)"
                    className="mt-3 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 font-semibold outline-none"
                  />

                  <button
                    type="submit"
                    disabled={busy === "stage"}
                    className="mt-3 w-full rounded-xl bg-blue-700 px-4 py-3 font-black text-white disabled:opacity-50"
                  >
                    Atualizar etapa
                  </button>

                  {selected.sales_stage !== "perdido" &&
                  selected.sales_stage !== "conta_ativada" &&
                  selected.sales_stage !== "cliente" ? (
                    <a
                      href={`/admin/fundadores?lead=${encodeURIComponent(selected.id)}`}
                      className="mt-3 block rounded-xl border border-amber-200 bg-amber-50 p-3 text-center text-xs font-black text-amber-800"
                    >
                      Criar ou gerenciar convite Founder
                    </a>
                  ) : null}
                </form>
              </div>

              <div className="grid content-start gap-4">
                <form
                  onSubmit={saveContact}
                  className="rounded-[1.5rem] border border-slate-100 p-4"
                >
                  <h3 className="font-black">Registrar contato</h3>

                  <div className="mt-3 grid gap-3 sm:grid-cols-2">
                    <select
                      value={contactForm.channel}
                      onChange={(event) =>
                        setContactForm((current) => ({
                          ...current,
                          channel: event.target.value as ContactChannel,
                        }))
                      }
                      className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 font-bold outline-none"
                    >
                      {CONTACT_CHANNELS.map((channel) => (
                        <option key={channel} value={channel}>
                          {channel}
                        </option>
                      ))}
                    </select>

                    <input
                      type="datetime-local"
                      value={contactForm.next_action_at}
                      onChange={(event) =>
                        setContactForm((current) => ({
                          ...current,
                          next_action_at: event.target.value,
                        }))
                      }
                      className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 font-semibold outline-none"
                    />
                  </div>

                  <textarea
                    required
                    value={contactForm.message}
                    onChange={(event) =>
                      setContactForm((current) => ({
                        ...current,
                        message: event.target.value,
                      }))
                    }
                    rows={4}
                    placeholder="O que aconteceu nesse contato?"
                    className="mt-3 w-full resize-none rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 font-semibold outline-none"
                  />

                  <button
                    type="submit"
                    disabled={busy === "contact"}
                    className="mt-3 w-full rounded-xl bg-emerald-700 px-4 py-3 font-black text-white disabled:opacity-50"
                  >
                    Registrar contato
                  </button>
                </form>

                <section className="rounded-[1.5rem] border border-slate-100 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <h3 className="font-black">Histórico</h3>
                    <span className="text-xs font-black text-slate-400">
                      {followups.length} evento(s)
                    </span>
                  </div>

                  <div className="mt-4 grid gap-3">
                    {followups.map((item) => (
                      <article
                        key={item.id}
                        className="rounded-2xl bg-slate-50 p-4"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <span className="rounded-full bg-white px-2.5 py-1 text-[10px] font-black uppercase text-slate-500">
                            {item.sales_event_type === "stage_change"
                              ? "Etapa"
                              : item.channel}
                          </span>
                          <span className="text-[10px] font-bold text-slate-400">
                            {shortDate(item.created_at)}
                          </span>
                        </div>
                        <p className="mt-3 text-sm font-semibold leading-6 text-slate-600">
                          {item.message || "Evento registrado"}
                        </p>
                        {item.admin_email ? (
                          <p className="mt-2 text-[10px] font-bold text-slate-400">
                            {item.admin_email}
                          </p>
                        ) : null}
                      </article>
                    ))}

                    {followups.length === 0 ? (
                      <div className="rounded-2xl border border-dashed border-slate-200 p-6 text-center text-sm font-bold text-slate-400">
                        Nenhum contato registrado ainda.
                      </div>
                    ) : null}
                  </div>
                </section>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  )
}
