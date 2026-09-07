"use client"

/* eslint-disable react-hooks/set-state-in-effect */

import {
  FormEvent,
  useEffect,
  useState,
} from "react"

type InvitePreview = {
  nome: string
  emailMasked: string
  role: string
  expiresAt: string
}

export default function TeamInviteActivationPage() {
  const [token, setToken] = useState("")
  const [invite, setInvite] =
    useState<InvitePreview | null>(null)
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] =
    useState("")
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")

  useEffect(() => {
    const currentToken =
      new URLSearchParams(
        window.location.search,
      ).get("token") || ""

    setToken(currentToken)

    if (!currentToken) {
      setError("O link de convite está incompleto.")
      setLoading(false)
      return
    }

    void fetch(
      `/api/team-invites/activate?token=${encodeURIComponent(
        currentToken,
      )}`,
      {
        cache: "no-store",
      },
    )
      .then(async (response) => {
        const payload = await response
          .json()
          .catch(() => ({}))

        if (!response.ok) {
          throw new Error(
            payload.error ||
              "Não foi possível validar o convite.",
          )
        }

        setInvite(payload.invite || null)
      })
      .catch((loadError) => {
        setError(
          loadError instanceof Error
            ? loadError.message
            : "Não foi possível validar o convite.",
        )
      })
      .finally(() => {
        setLoading(false)
      })
  }, [])

  async function activate(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault()
    setError("")

    if (password !== confirmPassword) {
      setError("As duas senhas precisam ser iguais.")
      return
    }

    setBusy(true)

    const response = await fetch(
      "/api/team-invites/activate",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          token,
          email,
          password,
        }),
      },
    )

    const payload = await response
      .json()
      .catch(() => ({}))

    if (!response.ok) {
      setError(
        payload.error ||
          "Não foi possível ativar o acesso.",
      )
      setBusy(false)
      return
    }

    window.location.assign(
      payload.redirectTo ||
        "/admin/login?activated=prospector",
    )
  }

  return (
    <main className="min-h-screen bg-[#eef3f9] px-4 py-10 text-[#071b3a]">
      <div className="mx-auto max-w-xl">
        <div className="rounded-[2rem] bg-[#071b3a] p-6 text-white shadow-xl sm:p-8">
          <p className="text-xs font-black uppercase tracking-[0.18em] text-cyan-200">
            Equipe Orçaly
          </p>
          <h1 className="mt-3 text-3xl font-black tracking-[-0.05em] sm:text-4xl">
            Ative seu acesso
          </h1>
          <p className="mt-3 text-sm font-semibold leading-6 text-white/60">
            Confirme o e-mail do convite e crie sua
            própria senha. O dono da plataforma não
            recebe nem armazena essa senha.
          </p>
        </div>

        <section className="mt-5 rounded-[1.8rem] border border-white bg-white p-5 shadow-sm sm:p-7">
          {loading ? (
            <div className="py-12 text-center">
              <div className="mx-auto h-9 w-9 animate-spin rounded-full border-4 border-blue-100 border-t-[#05245c]" />
              <p className="mt-4 text-sm font-black">
                Validando convite...
              </p>
            </div>
          ) : error && !invite ? (
            <div
              role="alert"
              className="rounded-2xl border border-red-100 bg-red-50 p-5 text-sm font-bold leading-6 text-red-700"
            >
              {error}
            </div>
          ) : invite ? (
            <>
              <div className="rounded-2xl bg-blue-50 p-4">
                <p className="text-xs font-black uppercase tracking-[0.14em] text-blue-700">
                  Convite confirmado
                </p>
                <p className="mt-2 text-xl font-black">
                  {invite.nome}
                </p>
                <p className="mt-1 text-sm font-bold text-slate-500">
                  {invite.role} · {invite.emailMasked}
                </p>
              </div>

              {error ? (
                <div
                  role="alert"
                  className="mt-4 rounded-2xl border border-red-100 bg-red-50 p-4 text-sm font-bold text-red-700"
                >
                  {error}
                </div>
              ) : null}

              <form
                onSubmit={activate}
                className="mt-5 grid gap-4"
              >
                <label className="grid gap-2 text-sm font-black">
                  E-mail que recebeu o convite
                  <input
                    type="email"
                    value={email}
                    onChange={(event) =>
                      setEmail(event.target.value)
                    }
                    autoComplete="email"
                    required
                    className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3.5 font-semibold outline-none focus:border-[#05245c] focus:ring-4 focus:ring-blue-100"
                    placeholder="voce@email.com"
                  />
                </label>

                <label className="grid gap-2 text-sm font-black">
                  Crie sua senha
                  <input
                    type="password"
                    value={password}
                    onChange={(event) =>
                      setPassword(event.target.value)
                    }
                    autoComplete="new-password"
                    minLength={10}
                    maxLength={128}
                    required
                    className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3.5 font-semibold outline-none focus:border-[#05245c] focus:ring-4 focus:ring-blue-100"
                    placeholder="10+ caracteres, letra e número"
                  />
                </label>

                <label className="grid gap-2 text-sm font-black">
                  Repita a senha
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={(event) =>
                      setConfirmPassword(
                        event.target.value,
                      )
                    }
                    autoComplete="new-password"
                    minLength={10}
                    maxLength={128}
                    required
                    className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3.5 font-semibold outline-none focus:border-[#05245c] focus:ring-4 focus:ring-blue-100"
                  />
                </label>

                <button
                  type="submit"
                  disabled={busy}
                  className="mt-1 rounded-2xl bg-[#05245c] px-5 py-4 font-black text-white disabled:opacity-50"
                >
                  {busy
                    ? "Ativando acesso..."
                    : "Ativar minha conta"}
                </button>
              </form>
            </>
          ) : null}
        </section>
      </div>
    </main>
  )
}
