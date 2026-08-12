"use client"

import {
  FormEvent,
  useEffect,
  useState,
} from "react"
import { supabase } from "@/lib/supabase"
import {
  businessTypes,
  normalizeBusinessType,
} from "@/lib/business-types"
import {
  normalizeSubdomainSlug,
} from "@/lib/slug"
import {
  founderNumberLabel,
  moneyFromCents,
} from "@/lib/founder-program"

type PreviewPayload = {
  invite?: {
    id: string
    founder_number: number
    plan_key: string
    founder_price_cents: number
    token_expires_at: string | null
    email_hint: string
  }
  prefill?: {
    empresa_nome: string
    nome_responsavel: string
    whatsapp: string
    cidade: string
    estado: string
    business_type: string
    subdomain_slug: string
  }
  error?: string
}

async function fetchPreview(token: string) {
  const response = await fetch(
    `/api/founders/activate?token=${encodeURIComponent(token)}`,
    {
      cache: "no-store",
    },
  )

  const payload = (await response
    .json()
    .catch(() => ({}))) as PreviewPayload

  return {
    ok: response.ok,
    payload,
  }
}

function formatDate(value?: string | null) {
  if (!value) return "prazo não informado"

  const parsed = new Date(value)

  if (Number.isNaN(parsed.getTime())) {
    return "prazo não informado"
  }

  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(parsed)
}

export default function FounderActivationClient({
  token,
}: {
  token: string
}) {
  const [preview, setPreview] =
    useState<PreviewPayload | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState("")
  const [form, setForm] = useState({
    email: "",
    nome_responsavel: "",
    empresa_nome: "",
    whatsapp: "",
    cidade: "",
    estado: "",
    business_type: "services",
    onboarding_goal: "",
    subdomain_slug: "",
    password: "",
    confirm_password: "",
  })

  useEffect(() => {
    let ignore = false

    void fetchPreview(token)
      .then(({ ok, payload }) => {
        if (ignore) return

        if (!ok) {
          setError(
            payload.error ||
              "Não foi possível validar o convite.",
          )
          setLoading(false)
          return
        }

        const prefill = payload.prefill

        setPreview(payload)
        setForm((current) => ({
          ...current,
          nome_responsavel:
            prefill?.nome_responsavel || "",
          empresa_nome:
            prefill?.empresa_nome || "",
          whatsapp: prefill?.whatsapp || "",
          cidade: prefill?.cidade || "",
          estado: prefill?.estado || "",
          business_type: normalizeBusinessType(
            prefill?.business_type,
          ),
          subdomain_slug:
            prefill?.subdomain_slug || "",
        }))
        setLoading(false)
      })
      .catch(() => {
        if (ignore) return
        setError(
          "Não foi possível validar o convite Founder.",
        )
        setLoading(false)
      })

    return () => {
      ignore = true
    }
  }, [token])

  async function activate(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault()
    setBusy(true)
    setError("")
    setSuccess("")

    if (form.password !== form.confirm_password) {
      setError("As senhas não coincidem.")
      setBusy(false)
      return
    }

    const response = await fetch(
      "/api/founders/activate",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          token,
          ...form,
        }),
      },
    )

    const payload = (await response
      .json()
      .catch(() => ({}))) as {
      error?: string
      message?: string
      email?: string
    }

    if (!response.ok) {
      setError(
        payload.error ||
          "Não foi possível ativar sua conta.",
      )
      setBusy(false)
      return
    }

    setSuccess(
      payload.message ||
        "Conta Founder ativada.",
    )

    const login = await supabase.auth.signInWithPassword({
      email: payload.email || form.email,
      password: form.password,
    })

    if (login.error) {
      window.location.assign(
        `/login?founder=activated&email=${encodeURIComponent(
          payload.email || form.email,
        )}`,
      )
      return
    }

    window.location.assign("/painel")
  }

  if (loading) {
    return (
      <main className="grid min-h-screen place-items-center bg-[#f6f8fc] px-4 text-[#071b3a]">
        <div className="rounded-[2rem] bg-white p-8 text-center shadow-xl shadow-blue-950/5">
          <p className="font-black">
            Validando seu convite Founder...
          </p>
        </div>
      </main>
    )
  }

  if (error && !preview?.invite) {
    return (
      <main className="grid min-h-screen place-items-center bg-[#f6f8fc] px-4 text-[#071b3a]">
        <section className="w-full max-w-xl rounded-[2rem] border border-red-100 bg-white p-8 text-center shadow-xl">
          <p className="text-xs font-black uppercase tracking-[0.18em] text-red-500">
            Programa Founder
          </p>
          <h1 className="mt-3 text-3xl font-black">
            Este convite não pode ser usado
          </h1>
          <p className="mt-4 leading-7 text-slate-600">
            {error}
          </p>
        </section>
      </main>
    )
  }

  const invite = preview?.invite

  return (
    <main className="min-h-screen bg-[#f6f8fc] px-4 py-8 text-[#071b3a] sm:px-6">
      <div className="mx-auto max-w-5xl">
        <header className="overflow-hidden rounded-[2rem] bg-[#071b3a] p-6 text-white shadow-2xl sm:p-9">
          <p className="text-xs font-black uppercase tracking-[0.2em] text-cyan-200">
            Programa Founder Orçaly
          </p>
          <h1 className="mt-4 text-4xl font-black tracking-[-0.055em] sm:text-5xl">
            Você está ativando a vaga{" "}
            {invite
              ? founderNumberLabel(
                  invite.founder_number,
                )
              : "Founder"}
          </h1>
          <p className="mt-4 max-w-3xl text-sm font-semibold leading-7 text-white/65">
            Sua conta começa com 30 dias gratuitos.
            Depois do trial, o preço especial Founder
            permanece por 6 meses antes da transição
            para o preço normal do plano.
          </p>

          {invite ? (
            <div className="mt-6 flex flex-wrap gap-3">
              <span className="rounded-full bg-white/10 px-4 py-2 text-sm font-black">
                {moneyFromCents(
                  invite.founder_price_cents,
                )}/mês após o trial
              </span>
              <span className="rounded-full bg-white/10 px-4 py-2 text-sm font-black">
                Expira {formatDate(invite.token_expires_at)}
              </span>
              <span className="rounded-full bg-white/10 px-4 py-2 text-sm font-black">
                E-mail: {invite.email_hint}
              </span>
            </div>
          ) : null}
        </header>

        {success ? (
          <div className="mt-4 rounded-2xl border border-emerald-100 bg-emerald-50 p-4 font-black text-emerald-700">
            {success}
          </div>
        ) : null}

        {error ? (
          <div className="mt-4 rounded-2xl border border-red-100 bg-red-50 p-4 font-black text-red-700">
            {error}
          </div>
        ) : null}

        <form
          onSubmit={activate}
          className="mt-5 grid gap-5 rounded-[2rem] bg-white p-5 shadow-xl shadow-blue-950/5 sm:p-8"
        >
          <div>
            <p className="text-xs font-black uppercase tracking-[0.16em] text-blue-700">
              Confirme seus dados
            </p>
            <h2 className="mt-2 text-2xl font-black">
              Criar sua conta Orçaly
            </h2>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <label className="grid gap-2 text-sm font-black">
              E-mail do convite
              <input
                required
                type="email"
                autoComplete="email"
                value={form.email}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    email: event.target.value,
                  }))
                }
                className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3.5 font-semibold"
                placeholder="Digite o e-mail que recebeu o convite"
              />
            </label>

            <label className="grid gap-2 text-sm font-black">
              Seu nome
              <input
                required
                value={form.nome_responsavel}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    nome_responsavel:
                      event.target.value,
                  }))
                }
                className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3.5 font-semibold"
              />
            </label>

            <label className="grid gap-2 text-sm font-black">
              Nome da empresa
              <input
                required
                value={form.empresa_nome}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    empresa_nome: event.target.value,
                    subdomain_slug:
                      current.subdomain_slug ||
                      normalizeSubdomainSlug(
                        event.target.value,
                      ),
                  }))
                }
                className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3.5 font-semibold"
              />
            </label>

            <label className="grid gap-2 text-sm font-black">
              WhatsApp
              <input
                required
                inputMode="tel"
                value={form.whatsapp}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    whatsapp: event.target.value,
                  }))
                }
                className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3.5 font-semibold"
                placeholder="82999999999"
              />
            </label>

            <label className="grid gap-2 text-sm font-black">
              Cidade
              <input
                required
                value={form.cidade}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    cidade: event.target.value,
                  }))
                }
                className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3.5 font-semibold"
              />
            </label>

            <label className="grid gap-2 text-sm font-black">
              Estado
              <input
                maxLength={2}
                value={form.estado}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    estado:
                      event.target.value.toUpperCase(),
                  }))
                }
                className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3.5 font-semibold uppercase"
                placeholder="AL"
              />
            </label>

            <label className="grid gap-2 text-sm font-black">
              Tipo de negócio
              <select
                value={form.business_type}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    business_type: event.target.value,
                  }))
                }
                className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3.5 font-semibold"
              >
                {businessTypes.map((item) => (
                  <option
                    key={item.id}
                    value={item.id}
                  >
                    {item.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="grid gap-2 text-sm font-black">
              Principal objetivo
              <select
                required
                value={form.onboarding_goal}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    onboarding_goal:
                      event.target.value,
                  }))
                }
                className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3.5 font-semibold"
              >
                <option value="">Selecione</option>
                <option value="organizar_pedidos">
                  Organizar pedidos e atendimentos
                </option>
                <option value="vender_online">
                  Vender mais pela internet
                </option>
                <option value="criar_vitrine">
                  Criar minha vitrine digital
                </option>
                <option value="automatizar_operacao">
                  Automatizar minha operação
                </option>
              </select>
            </label>
          </div>

          <label className="grid gap-2 text-sm font-black">
            Seu link público
            <div className="flex rounded-2xl border border-slate-200 bg-slate-50">
              <span className="hidden items-center border-r border-slate-200 px-4 text-sm font-bold text-slate-400 sm:flex">
                orcaly.com.br/
              </span>
              <input
                required
                value={form.subdomain_slug}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    subdomain_slug:
                      normalizeSubdomainSlug(
                        event.target.value,
                      ),
                  }))
                }
                className="min-w-0 flex-1 bg-transparent px-4 py-3.5 font-semibold outline-none"
              />
            </div>
          </label>

          <div className="grid gap-4 md:grid-cols-2">
            <label className="grid gap-2 text-sm font-black">
              Crie sua senha
              <input
                required
                type="password"
                minLength={8}
                maxLength={128}
                autoComplete="new-password"
                value={form.password}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    password: event.target.value,
                  }))
                }
                className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3.5 font-semibold"
                placeholder="8+ caracteres, letra e número"
              />
            </label>

            <label className="grid gap-2 text-sm font-black">
              Confirme a senha
              <input
                required
                type="password"
                minLength={8}
                maxLength={128}
                autoComplete="new-password"
                value={form.confirm_password}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    confirm_password:
                      event.target.value,
                  }))
                }
                className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3.5 font-semibold"
              />
            </label>
          </div>

          <div className="rounded-2xl border border-blue-100 bg-blue-50 p-4 text-sm font-semibold leading-6 text-blue-900">
            Nenhuma cobrança é criada nesta ativação.
            Os primeiros 30 dias são gratuitos.
          </div>

          <button
            type="submit"
            disabled={busy}
            className="rounded-2xl bg-[#05245c] px-6 py-4 font-black text-white shadow-lg shadow-blue-950/15 disabled:opacity-50"
          >
            {busy
              ? "Ativando sua vaga Founder..."
              : "Ativar minha conta Founder"}
          </button>
        </form>
      </div>
    </main>
  )
}
