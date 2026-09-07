"use client"

import { useState } from "react"
import { supabase } from "@/lib/supabase"
import {
  founderNumberLabel,
  moneyFromCents,
} from "@/lib/founder-program"
import type {
  PanelPremiumCompany,
} from "@/components/painel/PanelPremiumHeader"

function formatDate(value?: string | null) {
  if (!value) return "sem data definida"

  const parsed = new Date(value)

  if (Number.isNaN(parsed.getTime())) {
    return "sem data definida"
  }

  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "long",
  }).format(parsed)
}

export default function FounderWelcomeModal({
  company,
}: {
  company: PanelPremiumCompany
}) {
  const [visible, setVisible] = useState(
    company.is_founder === true &&
      !company.founder_welcome_seen_at,
  )
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")

  if (!visible) return null

  async function confirm() {
    setBusy(true)
    setError("")

    const { data } = await supabase.auth.getSession()
    const token = data.session?.access_token

    if (!token) {
      setError(
        "Sua sessão expirou. Entre novamente para continuar.",
      )
      setBusy(false)
      return
    }

    const response = await fetch(
      "/api/founders/welcome",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      },
    )

    const payload = await response
      .json()
      .catch(() => ({}))

    if (!response.ok) {
      setError(
        payload.error ||
          "Não foi possível confirmar a mensagem.",
      )
      setBusy(false)
      return
    }

    setVisible(false)
  }

  const number =
    typeof company.founder_number === "number"
      ? founderNumberLabel(company.founder_number)
      : "Founder"

  return (
    <div className="fixed inset-0 z-[200] grid place-items-center overflow-y-auto bg-[#071b3a]/70 p-4 backdrop-blur-sm">
      <section className="my-auto w-full max-w-2xl overflow-hidden rounded-[2rem] bg-white shadow-2xl">
        <div className="bg-[#071b3a] p-6 text-white sm:p-8">
          <p className="text-xs font-black uppercase tracking-[0.18em] text-cyan-200">
            Bem-vindo ao Orçaly
          </p>
          <h2 className="mt-3 text-4xl font-black tracking-[-0.05em]">
            Você é {number}.
          </h2>
          <p className="mt-4 max-w-xl text-sm font-semibold leading-7 text-white/65">
            Sua vaga especial foi ativada e seu período
            gratuito começou. Agora é hora de configurar
            sua operação e usar o sistema de verdade.
          </p>
        </div>

        <div className="grid gap-4 p-6 sm:grid-cols-3 sm:p-8">
          <article className="rounded-2xl border border-blue-100 bg-blue-50 p-4">
            <p className="text-xs font-black uppercase text-blue-700">
              Trial
            </p>
            <p className="mt-2 text-sm font-black">
              Gratuito até
            </p>
            <p className="mt-1 text-xs font-bold text-slate-500">
              {formatDate(company.founder_trial_ends_at)}
            </p>
          </article>

          <article className="rounded-2xl border border-amber-100 bg-amber-50 p-4">
            <p className="text-xs font-black uppercase text-amber-700">
              Preço Founder
            </p>
            <p className="mt-2 text-sm font-black">
              {typeof company.founder_price_cents === "number"
                ? `${moneyFromCents(company.founder_price_cents)}/mês`
                : "Preço especial"}
            </p>
            <p className="mt-1 text-xs font-bold text-slate-500">
              após o trial
            </p>
          </article>

          <article className="rounded-2xl border border-emerald-100 bg-emerald-50 p-4">
            <p className="text-xs font-black uppercase text-emerald-700">
              Benefício
            </p>
            <p className="mt-2 text-sm font-black">
              Até
            </p>
            <p className="mt-1 text-xs font-bold text-slate-500">
              {formatDate(company.founder_price_ends_at)}
            </p>
          </article>
        </div>

        {error ? (
          <div className="mx-6 mb-4 rounded-2xl border border-red-100 bg-red-50 p-4 text-sm font-black text-red-700 sm:mx-8">
            {error}
          </div>
        ) : null}

        <div className="border-t border-slate-100 p-6 sm:p-8">
          <button
            type="button"
            onClick={() => void confirm()}
            disabled={busy}
            className="w-full rounded-2xl bg-[#05245c] px-6 py-4 font-black text-white disabled:opacity-50"
          >
            {busy
              ? "Salvando..."
              : "Entrar no Orçaly"}
          </button>
        </div>
      </section>
    </div>
  )
}
