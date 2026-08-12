"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";

export type FounderBillingCompany = {
  id?: string | null;
  nome?: string | null;
  email?: string | null;
  plano?: string | null;
  assinatura_plano?: string | null;
  assinatura_status?: string | null;
  is_founder?: boolean | null;
  founder_number?: number | null;
  founder_price_cents?: number | null;
  normal_price_cents?: number | null;
  effective_price_cents?: number | null;
  founder_trial_ends_at?: string | null;
  founder_price_ends_at?: string | null;
  founder_price_converted_at?: string | null;
  founder_billing_setup_at?: string | null;
  founder_billing_authorized_at?: string | null;
  provider_subscription_id?: string | null;
  mercado_pago_subscription_id?: string | null;
  provider_status?: string | null;
  mercado_pago_subscription_status?: string | null;
  checkout_url?: string | null;
  assinatura_checkout_url?: string | null;
  next_billing_at?: string | null;
  assinatura_proxima_cobranca?: string | null;
};

function moneyFromCents(value?: number | null) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(Number(value || 0) / 100);
}

function dateBR(value?: string | null) {
  if (!value) return "Não definida";

  const parsed = new Date(value);

  if (Number.isNaN(parsed.getTime())) {
    return "Não definida";
  }

  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "long",
  }).format(parsed);
}

function normalPrice(plan?: string | null) {
  const value = String(plan || "").toLowerCase();

  if (value === "premium") return 14990;
  if (
    value === "profissional" ||
    value === "intermediario" ||
    value === "intermediário"
  ) {
    return 9990;
  }

  return 4990;
}

function numberLabel(value?: number | null) {
  if (typeof value !== "number") return "Founder";
  return `Founder #${String(value).padStart(2, "0")}`;
}

export default function FounderSubscriptionPanel({
  initialCompany,
}: {
  initialCompany: FounderBillingCompany;
}) {
  const [company, setCompany] =
    useState<FounderBillingCompany>(
      initialCompany,
    );
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const founderPrice =
    Number(company.founder_price_cents) || 0;
  const standardPrice =
    Number(company.normal_price_cents) ||
    normalPrice(
      company.assinatura_plano || company.plano,
    );
  const providerStatus = String(
    company.provider_status ||
      company.mercado_pago_subscription_status ||
      "",
  ).toLowerCase();
  const configured =
    providerStatus === "authorized";

  async function configureBilling() {
    setBusy(true);
    setError("");
    setMessage("");

    try {
      const { data } =
        await supabase.auth.getSession();
      const token =
        data.session?.access_token || "";

      if (!token) {
        window.location.assign("/login");
        return;
      }

      const response = await fetch(
        "/api/founders/billing",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            action: "setup",
          }),
        },
      );

      const payload = await response
        .json()
        .catch(() => ({}));

      if (!response.ok) {
        throw new Error(
          payload.error ||
            "Não foi possível configurar a cobrança.",
        );
      }

      if (payload.company) {
        setCompany((current) => ({
          ...current,
          ...payload.company,
        }));
      }

      if (
        payload.checkout_url &&
        payload.provider_status !== "authorized"
      ) {
        window.location.assign(
          payload.checkout_url,
        );
        return;
      }

      setMessage(
        payload.message ||
          "Cobrança Founder sincronizada.",
      );
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Não foi possível configurar a cobrança.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#f8fbff] px-4 py-8 text-[#071b3a] sm:px-6">
      <div className="mx-auto max-w-6xl">
        <header className="rounded-[2rem] bg-[#071b3a] p-6 text-white shadow-2xl sm:p-8">
          <p className="text-xs font-black uppercase tracking-[0.18em] text-amber-200">
            Programa Founder
          </p>
          <h1 className="mt-3 text-4xl font-black tracking-[-0.05em]">
            {numberLabel(
              company.founder_number,
            )}
          </h1>
          <p className="mt-4 max-w-3xl text-sm font-semibold leading-7 text-white/65">
            Sua cobrança Founder usa uma única assinatura
            do Mercado Pago. Autorize uma vez e o Orçaly
            mantém o preço especial até o fim do benefício.
          </p>
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

        <section className="mt-5 grid gap-4 md:grid-cols-3">
          <article className="rounded-3xl bg-white p-5 shadow-sm">
            <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-400">
              Gratuito até
            </p>
            <p className="mt-3 text-xl font-black">
              {dateBR(
                company.founder_trial_ends_at,
              )}
            </p>
          </article>

          <article className="rounded-3xl bg-white p-5 shadow-sm">
            <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-400">
              Preço Founder
            </p>
            <p className="mt-3 text-3xl font-black text-amber-700">
              {moneyFromCents(founderPrice)}
              <span className="text-sm text-slate-400">
                /mês
              </span>
            </p>
          </article>

          <article className="rounded-3xl bg-white p-5 shadow-sm">
            <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-400">
              Depois do benefício
            </p>
            <p className="mt-3 text-3xl font-black">
              {moneyFromCents(standardPrice)}
              <span className="text-sm text-slate-400">
                /mês
              </span>
            </p>
          </article>
        </section>

        <section className="mt-5 rounded-[2rem] bg-white p-6 shadow-xl shadow-blue-950/5 sm:p-8">
          <div className="grid gap-6 lg:grid-cols-[1fr_auto] lg:items-center">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.15em] text-blue-700">
                Cobrança recorrente
              </p>
              <h2 className="mt-2 text-2xl font-black">
                {configured
                  ? "Mercado Pago autorizado"
                  : "Prepare a cobrança para depois do trial"}
              </h2>
              <p className="mt-3 max-w-3xl text-sm font-semibold leading-7 text-slate-600">
                Nenhum novo trial é criado aqui. Durante
                seu período gratuito, a primeira cobrança
                fica programada para o fim do trial. O
                preço Founder termina em{" "}
                <strong>
                  {dateBR(
                    company.founder_price_ends_at,
                  )}
                </strong>
                . Depois disso, a mesma assinatura passa
                para o preço normal do plano.
              </p>

              <div className="mt-4 flex flex-wrap gap-2 text-xs font-black">
                <span className="rounded-full bg-slate-100 px-3 py-2 text-slate-600">
                  Status MP:{" "}
                  {providerStatus || "não configurado"}
                </span>
                {company.next_billing_at ||
                company.assinatura_proxima_cobranca ? (
                  <span className="rounded-full bg-blue-50 px-3 py-2 text-blue-700">
                    Próxima cobrança:{" "}
                    {dateBR(
                      company.next_billing_at ||
                        company.assinatura_proxima_cobranca,
                    )}
                  </span>
                ) : null}
              </div>
            </div>

            <button
              type="button"
              onClick={() =>
                void configureBilling()
              }
              disabled={busy}
              className="rounded-2xl bg-[#05245c] px-6 py-4 font-black text-white shadow-lg shadow-blue-950/15 disabled:opacity-50"
            >
              {busy
                ? "Verificando..."
                : configured
                  ? "Sincronizar cobrança"
                  : company.provider_subscription_id ||
                      company.mercado_pago_subscription_id
                    ? "Continuar autorização"
                    : "Configurar cobrança"}
            </button>
          </div>

          <div className="mt-6 rounded-2xl border border-amber-100 bg-amber-50 p-4 text-sm font-semibold leading-6 text-amber-900">
            O Orçaly não cria uma segunda assinatura se
            esta página for aberta novamente. A referência
            e a assinatura do Mercado Pago são recuperadas
            antes de qualquer nova criação.
          </div>
        </section>
      </div>
    </main>
  );
}
