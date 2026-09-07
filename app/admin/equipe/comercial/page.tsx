"use client"

/* eslint-disable react-hooks/set-state-in-effect */

import Link from "next/link"
import {
  FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react"
import { useRouter } from "next/navigation"
import { supabase } from "@/lib/supabase"

type Invite = {
  id: string
  email: string
  nome: string
  status: string
  expires_at: string | null
  invited_at: string | null
  activated_at: string | null
  revoked_at: string | null
}

type TeamMember = {
  id: string
  email: string
  nome: string | null
  role: string
  is_active: boolean
  last_login_at: string | null
}

type ApiPayload = {
  error?: string
  message?: string
  activationUrl?: string
  invites?: Invite[]
  team?: TeamMember[]
}

async function currentToken() {
  const { data } = await supabase.auth.getSession()
  return data.session?.access_token || ""
}

function dateTime(value: string | null) {
  if (!value) return "—"
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "—"

  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(date)
}

function statusName(status: string) {
  const names: Record<string, string> = {
    pending: "Pendente",
    activating: "Ativando",
    activated: "Ativado",
    revoked: "Revogado",
    expired: "Expirado",
  }

  return names[status] || status
}

export default function CommercialTeamPage() {
  const router = useRouter()
  const [invites, setInvites] = useState<Invite[]>([])
  const [team, setTeam] = useState<TeamMember[]>([])
  const [nome, setNome] = useState("")
  const [email, setEmail] = useState("")
  const [observacoes, setObservacoes] = useState("")
  const [lastLink, setLastLink] = useState("")
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState("")
  const [message, setMessage] = useState("")
  const [error, setError] = useState("")

  const load = useCallback(async () => {
    setLoading(true)
    setError("")

    const token = await currentToken()

    if (!token) {
      router.replace("/admin/login")
      return
    }

    const headers = {
      Authorization: `Bearer ${token}`,
    }

    const [invitesResponse, teamResponse] =
      await Promise.all([
        fetch("/api/admin/team/prospector-invites", {
          headers,
          cache: "no-store",
        }),
        fetch("/api/admin/team", {
          headers,
          cache: "no-store",
        }),
      ])

    const invitePayload =
      (await invitesResponse
        .json()
        .catch(() => ({}))) as ApiPayload
    const teamPayload =
      (await teamResponse
        .json()
        .catch(() => ({}))) as ApiPayload

    if (
      [401, 403].includes(invitesResponse.status) ||
      [401, 403].includes(teamResponse.status)
    ) {
      router.replace("/admin")
      return
    }

    if (!invitesResponse.ok) {
      setError(
        invitePayload.error ||
          "Não foi possível carregar os convites.",
      )
    } else if (!teamResponse.ok) {
      setError(
        teamPayload.error ||
          "Não foi possível carregar a equipe.",
      )
    } else {
      setInvites(invitePayload.invites || [])
      setTeam(teamPayload.team || [])
    }

    setLoading(false)
  }, [router])

  useEffect(() => {
    void load()
  }, [load])

  const prospectors = useMemo(
    () =>
      team.filter(
        (member) => member.role === "prospector",
      ),
    [team],
  )

  async function inviteAction(
    action: string,
    body: Record<string, unknown>,
  ) {
    setBusy(action)
    setMessage("")
    setError("")
    setLastLink("")

    const token = await currentToken()

    const response = await fetch(
      "/api/admin/team/prospector-invites",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          action,
          ...body,
        }),
      },
    )

    const payload =
      (await response
        .json()
        .catch(() => ({}))) as ApiPayload

    if (!response.ok) {
      setError(
        payload.error ||
          "Não foi possível concluir a operação.",
      )
      setBusy("")
      return false
    }

    if (payload.activationUrl) {
      setLastLink(payload.activationUrl)
    }

    setMessage(
      payload.message || "Alteração salva.",
    )
    setBusy("")
    await load()
    return true
  }

  async function createInvite(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault()

    const saved = await inviteAction("create", {
      nome,
      email,
      observacoes,
    })

    if (saved) {
      setNome("")
      setEmail("")
      setObservacoes("")
    }
  }

  async function setActive(
    member: TeamMember,
  ) {
    setBusy(`member-${member.id}`)
    setMessage("")
    setError("")

    const token = await currentToken()
    const response = await fetch("/api/admin/team", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        action: "set_active",
        id: member.id,
        active: !member.is_active,
      }),
    })

    const payload =
      (await response
        .json()
        .catch(() => ({}))) as ApiPayload

    if (!response.ok) {
      setError(
        payload.error ||
          "Não foi possível alterar o acesso.",
      )
    } else {
      setMessage(
        member.is_active
          ? "Acesso do Prospector desativado."
          : "Acesso do Prospector reativado.",
      )
      await load()
    }

    setBusy("")
  }

  async function copyLink() {
    if (!lastLink) return

    try {
      await navigator.clipboard.writeText(lastLink)
      setMessage("Link copiado.")
    } catch {
      setError(
        "Não foi possível copiar automaticamente. Selecione o link abaixo.",
      )
    }
  }

  return (
    <main className="min-h-screen bg-[#eef3f9] p-3 text-[#071b3a] sm:p-6">
      <div className="mx-auto max-w-[1400px]">
        <header className="rounded-[2rem] bg-[#071b3a] p-5 text-white shadow-xl sm:p-7">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.18em] text-cyan-200">
                Exclusivo do Owner
              </p>
              <h1 className="mt-3 text-4xl font-black tracking-[-0.055em]">
                Equipe comercial
              </h1>
              <p className="mt-3 max-w-3xl text-sm font-semibold leading-6 text-white/60">
                Convide Prospectores sem criar ou conhecer
                a senha deles. Cada link usa token
                criptográfico e pode ser revogado ou
                rotacionado.
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <Link
                href="/admin/equipe"
                className="rounded-2xl border border-white/15 px-4 py-3 text-sm font-black"
              >
                Equipe administrativa
              </Link>
              <Link
                href="/admin"
                className="rounded-2xl bg-white px-4 py-3 text-sm font-black text-[#05245c]"
              >
                Voltar ao controle
              </Link>
            </div>
          </div>
        </header>

        {message ? (
          <div
            role="status"
            className="mt-4 rounded-2xl border border-emerald-100 bg-emerald-50 p-4 text-sm font-black text-emerald-700"
          >
            {message}
          </div>
        ) : null}

        {error ? (
          <div
            role="alert"
            className="mt-4 rounded-2xl border border-red-100 bg-red-50 p-4 text-sm font-black text-red-700"
          >
            {error}
          </div>
        ) : null}

        {lastLink ? (
          <div className="mt-4 rounded-[1.5rem] border border-blue-100 bg-blue-50 p-4">
            <p className="text-xs font-black uppercase tracking-[0.14em] text-blue-700">
              Link de ativação
            </p>
            <p className="mt-2 break-all text-sm font-bold text-[#05245c]">
              {lastLink}
            </p>
            <button
              type="button"
              onClick={() => void copyLink()}
              className="mt-3 rounded-xl bg-[#05245c] px-4 py-2.5 text-xs font-black text-white"
            >
              Copiar link
            </button>
          </div>
        ) : null}

        <div className="mt-5 grid gap-5 xl:grid-cols-[400px_minmax(0,1fr)]">
          <form
            onSubmit={createInvite}
            className="h-fit rounded-[1.8rem] bg-white p-5 shadow-sm xl:sticky xl:top-5"
          >
            <p className="text-xs font-black uppercase tracking-[0.14em] text-blue-700">
              Novo Prospector
            </p>
            <h2 className="mt-2 text-2xl font-black">
              Criar convite
            </h2>
            <p className="mt-2 text-sm font-semibold leading-6 text-slate-500">
              O convite expira em 7 dias. O funcionário
              confirma o próprio e-mail e escolhe a própria
              senha.
            </p>

            <div className="mt-5 grid gap-4">
              <label className="grid gap-2 text-sm font-black">
                Nome
                <input
                  value={nome}
                  onChange={(event) =>
                    setNome(event.target.value)
                  }
                  required
                  minLength={2}
                  maxLength={160}
                  className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3.5 font-semibold outline-none"
                  placeholder="Nome do Prospector"
                />
              </label>

              <label className="grid gap-2 text-sm font-black">
                E-mail de acesso
                <input
                  type="email"
                  value={email}
                  onChange={(event) =>
                    setEmail(event.target.value)
                  }
                  required
                  className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3.5 font-semibold outline-none"
                  placeholder="prospector@email.com"
                />
              </label>

              <label className="grid gap-2 text-sm font-black">
                Observação interna
                <textarea
                  value={observacoes}
                  onChange={(event) =>
                    setObservacoes(event.target.value)
                  }
                  rows={3}
                  maxLength={500}
                  className="resize-none rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3.5 font-semibold outline-none"
                  placeholder="Região, foco comercial ou observação"
                />
              </label>
            </div>

            <button
              type="submit"
              disabled={busy === "create"}
              className="mt-5 w-full rounded-2xl bg-[#05245c] px-5 py-4 font-black text-white disabled:opacity-50"
            >
              {busy === "create"
                ? "Gerando convite..."
                : "Gerar convite seguro"}
            </button>
          </form>

          <section className="min-w-0">
            <div className="grid gap-3 sm:grid-cols-2">
              <article className="rounded-[1.5rem] bg-white p-5 shadow-sm">
                <p className="text-[10px] font-black uppercase tracking-[0.15em] text-slate-400">
                  Prospectores
                </p>
                <p className="mt-2 text-3xl font-black text-[#05245c]">
                  {prospectors.length}
                </p>
                <p className="mt-1 text-xs font-bold text-slate-400">
                  {
                    prospectors.filter(
                      (item) => item.is_active,
                    ).length
                  }{" "}
                  ativos
                </p>
              </article>

              <article className="rounded-[1.5rem] bg-white p-5 shadow-sm">
                <p className="text-[10px] font-black uppercase tracking-[0.15em] text-slate-400">
                  Convites pendentes
                </p>
                <p className="mt-2 text-3xl font-black text-[#05245c]">
                  {
                    invites.filter(
                      (item) =>
                        item.status === "pending" ||
                        item.status === "activating",
                    ).length
                  }
                </p>
                <p className="mt-1 text-xs font-bold text-slate-400">
                  Aguardando ativação
                </p>
              </article>
            </div>

            <div className="mt-4 rounded-[1.6rem] bg-white p-5 shadow-sm">
              <h2 className="text-xl font-black">
                Acessos comerciais
              </h2>

              <div className="mt-4 grid gap-3">
                {loading ? (
                  <p className="text-sm font-bold text-slate-400">
                    Carregando...
                  </p>
                ) : prospectors.length === 0 ? (
                  <p className="text-sm font-bold text-slate-400">
                    Nenhum Prospector ativado ainda.
                  </p>
                ) : (
                  prospectors.map((member) => (
                    <article
                      key={member.id}
                      className="flex flex-col gap-3 rounded-2xl border border-slate-100 p-4 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div>
                        <p className="font-black">
                          {member.nome || member.email}
                        </p>
                        <p className="mt-1 text-sm font-bold text-slate-500">
                          {member.email}
                        </p>
                        <p className="mt-1 text-xs font-semibold text-slate-400">
                          Último acesso:{" "}
                          {dateTime(
                            member.last_login_at,
                          )}
                        </p>
                      </div>

                      <button
                        type="button"
                        disabled={
                          busy ===
                          `member-${member.id}`
                        }
                        onClick={() =>
                          void setActive(member)
                        }
                        className={`rounded-xl border px-3 py-2.5 text-xs font-black ${
                          member.is_active
                            ? "border-red-100 bg-red-50 text-red-700"
                            : "border-emerald-100 bg-emerald-50 text-emerald-700"
                        }`}
                      >
                        {member.is_active
                          ? "Desativar"
                          : "Reativar"}
                      </button>
                    </article>
                  ))
                )}
              </div>
            </div>

            <div className="mt-4 rounded-[1.6rem] bg-white p-5 shadow-sm">
              <h2 className="text-xl font-black">
                Histórico de convites
              </h2>

              <div className="mt-4 grid gap-3">
                {invites.length === 0 ? (
                  <p className="text-sm font-bold text-slate-400">
                    Nenhum convite criado.
                  </p>
                ) : (
                  invites.map((invite) => (
                    <article
                      key={invite.id}
                      className="rounded-2xl border border-slate-100 p-4"
                    >
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="font-black">
                              {invite.nome}
                            </p>
                            <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-black uppercase">
                              {statusName(
                                invite.status,
                              )}
                            </span>
                          </div>
                          <p className="mt-1 text-sm font-bold text-slate-500">
                            {invite.email}
                          </p>
                          <p className="mt-2 text-xs font-semibold text-slate-400">
                            Expira:{" "}
                            {dateTime(
                              invite.expires_at,
                            )}
                          </p>
                        </div>

                        {["pending", "expired"].includes(
                          invite.status,
                        ) ? (
                          <div className="flex flex-wrap gap-2">
                            <button
                              type="button"
                              disabled={
                                busy === "resend"
                              }
                              onClick={() =>
                                void inviteAction(
                                  "resend",
                                  {
                                    id: invite.id,
                                  },
                                )
                              }
                              className="rounded-xl border border-blue-100 bg-blue-50 px-3 py-2.5 text-xs font-black text-[#05245c]"
                            >
                              Novo link
                            </button>
                            <button
                              type="button"
                              disabled={
                                busy === "revoke"
                              }
                              onClick={() =>
                                void inviteAction(
                                  "revoke",
                                  {
                                    id: invite.id,
                                  },
                                )
                              }
                              className="rounded-xl border border-red-100 bg-red-50 px-3 py-2.5 text-xs font-black text-red-700"
                            >
                              Revogar
                            </button>
                          </div>
                        ) : null}
                      </div>
                    </article>
                  ))
                )}
              </div>
            </div>
          </section>
        </div>
      </div>
    </main>
  )
}
