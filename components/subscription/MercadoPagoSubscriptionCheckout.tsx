/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import Script from "next/script";
import {
  FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { supabase } from "@/lib/supabase";

type PlanKey =
  | "basico"
  | "profissional"
  | "premium";

type Snapshot = {
  company?: {
    plano?: PlanKey;
    assinatura_status?: string;
    trial_ends_at?: string | null;
    access_until?: string | null;
    cancel_at_period_end?: boolean;
    assinatura_proxima_cobranca?: string | null;
    mercado_pago_subscription_status?: string | null;
    access?: {
      hasAccess?: boolean;
      isTrial?: boolean;
      status?: string;
    };
  };
  can_manage?: boolean;
};

const plans: Array<{
  key: PlanKey;
  name: string;
  price: number;
  description: string;
  highlight?: boolean;
}> = [
  {
    key: "basico",
    name: "Básico",
    price: 49.9,
    description:
      "Estrutura essencial para catálogo, pedidos e presença digital.",
  },
  {
    key: "profissional",
    name: "Intermediário",
    price: 99.9,
    description:
      "Mais controle, propostas, relatórios e recursos comerciais.",
    highlight: true,
  },
  {
    key: "premium",
    name: "Premium",
    price: 149.9,
    description:
      "Automações e recursos avançados para operações em crescimento.",
  },
];

function currency(value: number) {
  return value.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

function dateBR(value?: string | null) {
  if (!value) return "Ainda não definida";

  const parsed = new Date(value);

  if (Number.isNaN(parsed.getTime())) {
    return "Ainda não definida";
  }

  return parsed.toLocaleString("pt-BR");
}

function friendlyStatus(value?: string | null) {
  const normalized = String(
    value || "pendente",
  ).toLowerCase();

  if (normalized === "trialing") {
    return "Período gratuito";
  }

  if (normalized === "ativa") {
    return "Ativa";
  }

  if (
    normalized === "cancel_at_period_end" ||
    normalized === "cancelled" ||
    normalized === "canceled" ||
    normalized === "cancelada"
  ) {
    return "Cancelada";
  }

  if (normalized === "past_due") {
    return "Pagamento pendente";
  }

  return "Pendente";
}

export default function MercadoPagoSubscriptionCheckout() {
  const publicKey =
    process.env.NEXT_PUBLIC_MERCADO_PAGO_PUBLIC_KEY ||
    "";

  const cardFormRef = useRef<any>(null);
  const processingRef = useRef(false);
  const [snapshot, setSnapshot] =
    useState<Snapshot | null>(null);
  const [planKey, setPlanKey] =
    useState<PlanKey>("profissional");
  const [sdkReady, setSdkReady] =
    useState(false);
  const [cardReady, setCardReady] =
    useState(false);
  const [loading, setLoading] =
    useState(true);
  const [processing, setProcessing] =
    useState(false);
  const [message, setMessage] =
    useState("");
  const [error, setError] =
    useState("");

  const selectedPlan = useMemo(
    () =>
      plans.find((plan) => plan.key === planKey) ||
      plans[1],
    [planKey],
  );

  const getToken = useCallback(async () => {
    const { data } =
      await supabase.auth.getSession();

    return data.session?.access_token || "";
  }, []);

  const loadSnapshot = useCallback(async () => {
    setLoading(true);

    try {
      const token = await getToken();

      if (!token) {
        throw new Error(
          "Sua sessão expirou. Entre novamente.",
        );
      }

      const response = await fetch(
        "/api/company/subscription",
        {
          cache: "no-store",
          headers: {
            authorization: `Bearer ${token}`,
          },
        },
      );

      const payload = await response
        .json()
        .catch(() => ({}));

      if (!response.ok) {
        throw new Error(
          payload.error ||
            "Não foi possível carregar a assinatura.",
        );
      }

      setSnapshot(payload);

      const currentPlan =
        payload.company?.plano;

      if (
        currentPlan === "basico" ||
        currentPlan === "profissional" ||
        currentPlan === "premium"
      ) {
        setPlanKey(currentPlan);
      }
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Não foi possível carregar a assinatura.",
      );
    } finally {
      setLoading(false);
    }
  }, [getToken]);

  useEffect(() => {
    void loadSnapshot();
  }, [loadSnapshot]);

  const submitSubscription =
    useCallback(
      async (cardForm: any) => {
        if (processingRef.current) return;

        processingRef.current = true;
        setProcessing(true);
        setError("");
        setMessage(
          "Validando o cartão e configurando a assinatura...",
        );

        try {
          const formData =
            cardForm.getCardFormData();

          const cardTokenId = String(
            formData.token || "",
          ).trim();

          const payerEmail = String(
            formData.cardholderEmail || "",
          ).trim();

          if (!cardTokenId) {
            throw new Error(
              "Não foi possível gerar o token seguro do cartão.",
            );
          }

          const token = await getToken();

          if (!token) {
            throw new Error(
              "Sua sessão expirou. Entre novamente.",
            );
          }

          const response = await fetch(
            "/api/assinatura/mercado-pago",
            {
              method: "POST",
              headers: {
                "content-type":
                  "application/json",
                authorization:
                  `Bearer ${token}`,
              },
              body: JSON.stringify({
                plan: planKey,
                cardTokenId,
                payerEmail,
              }),
            },
          );

          const payload = await response
            .json()
            .catch(() => ({}));

          if (!response.ok) {
            throw new Error(
              payload.error ||
                "Não foi possível configurar a assinatura.",
            );
          }

          setMessage(
            payload.message ||
              "Assinatura configurada.",
          );

          await loadSnapshot();
        } catch (cause) {
          setMessage("");
          setError(
            cause instanceof Error
              ? cause.message
              : "Não foi possível configurar a assinatura.",
          );
        } finally {
          processingRef.current = false;
          setProcessing(false);
        }
      },
      [
        getToken,
        loadSnapshot,
        planKey,
      ],
    );

  useEffect(() => {
    if (
      !sdkReady ||
      !publicKey ||
      loading ||
      snapshot?.company
        ?.mercado_pago_subscription_status ===
        "authorized"
    ) {
      return;
    }

    const MercadoPagoConstructor = (
      window as unknown as {
        MercadoPago?: new (
          publicKey: string,
          options?: Record<string, unknown>,
        ) => any;
      }
    ).MercadoPago;

    if (!MercadoPagoConstructor) return;

    setCardReady(false);

    const mercadoPago =
      new MercadoPagoConstructor(
        publicKey,
        { locale: "pt-BR" },
      );

    const cardForm = mercadoPago.cardForm({
      amount:
        selectedPlan.price.toFixed(2),
      iframe: true,
      form: {
        id: "orcaly-subscription-form",
        cardNumber: {
          id: "orcaly-card-number",
          placeholder: "Número do cartão",
        },
        expirationDate: {
          id: "orcaly-expiration-date",
          placeholder: "MM/AA",
        },
        securityCode: {
          id: "orcaly-security-code",
          placeholder: "CVV",
        },
        cardholderName: {
          id: "orcaly-cardholder-name",
          placeholder: "Nome no cartao",
        },
        issuer: {
          id: "orcaly-issuer",
          placeholder: "Banco emissor",
        },
        installments: {
          id: "orcaly-installments",
          placeholder: "Parcelas",
        },
        identificationType: {
          id: "orcaly-identification-type",
          placeholder:
            "Tipo de documento",
        },
        identificationNumber: {
          id: "orcaly-identification-number",
          placeholder:
            "CPF ou CNPJ do titular",
        },
        cardholderEmail: {
          id: "orcaly-cardholder-email",
          placeholder: "E-mail",
        },
      },
      callbacks: {
        onFormMounted: (formError: any) => {
          if (formError) {
            setError(
              "Não foi possível carregar os campos seguros do cartão.",
            );
            return;
          }

          setCardReady(true);
        },
        onSubmit: (event: FormEvent) => {
          event.preventDefault();
          void submitSubscription(cardForm);
        },
        onFetching: () => {
          setMessage(
            "Validando os dados seguros do cartão...",
          );

          return () => undefined;
        },
      },
    });

    cardFormRef.current = cardForm;

    return () => {
      setCardReady(false);

      if (
        typeof cardFormRef.current
          ?.unmount === "function"
      ) {
        cardFormRef.current.unmount();
      }

      cardFormRef.current = null;
    };
  }, [
    loading,
    publicKey,
    sdkReady,
    selectedPlan.price,
    snapshot?.company
      ?.mercado_pago_subscription_status,
    submitSubscription,
  ]);

  async function cancelSubscription() {
    const confirmed = window.confirm(
      "Cancelar a renovacao? Durante o periodo gratuito, nenhuma mensalidade sera cobrada e o acesso permanecera ate o fim dos sete dias.",
    );

    if (!confirmed) return;

    setProcessing(true);
    setError("");
    setMessage(
      "Cancelando a renovação...",
    );

    try {
      const token = await getToken();

      if (!token) {
        throw new Error(
          "Sua sessão expirou. Entre novamente.",
        );
      }

      const response = await fetch(
        "/api/assinatura/cancelar",
        {
          method: "POST",
          headers: {
            "content-type":
              "application/json",
            authorization:
              `Bearer ${token}`,
          },
          body: JSON.stringify({
            reason:
              "Cancelamento solicitado pelo painel",
          }),
        },
      );

      const payload = await response
        .json()
        .catch(() => ({}));

      if (!response.ok) {
        throw new Error(
          payload.error ||
            "Não foi possível cancelar.",
        );
      }

      setMessage(
        payload.message ||
          "Renovacao cancelada.",
      );

      await loadSnapshot();
    } catch (cause) {
      setMessage("");
      setError(
        cause instanceof Error
          ? cause.message
          : "Não foi possível cancelar.",
      );
    } finally {
      setProcessing(false);
    }
  }

  const company = snapshot?.company;
  const providerStatus =
    company?.mercado_pago_subscription_status;
  const hasRemoteSubscription =
    Boolean(providerStatus) &&
    ![
      "canceled",
      "cancelled",
    ].includes(
      String(providerStatus).toLowerCase(),
    );
  const cancelled =
    Boolean(
      company?.cancel_at_period_end,
    );

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-50 p-4 sm:p-6">
        <div className="mx-auto max-w-6xl animate-pulse rounded-[2rem] border border-slate-200 bg-white p-8 shadow-sm">
          <div className="h-8 w-64 rounded bg-slate-100" />
          <div className="mt-4 h-4 w-full max-w-xl rounded bg-slate-100" />
          <div className="mt-8 h-80 rounded-3xl bg-slate-100" />
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#f7f9fc] p-4 text-slate-950 sm:p-6">
      <Script
        src="https://sdk.mercadopago.com/js/v2"
        strategy="afterInteractive"
        onLoad={() => setSdkReady(true)}
        onError={() =>
          setError(
            "Não foi possível carregar a segurança do pagamento.",
          )
        }
      />

      <div className="mx-auto max-w-7xl space-y-6">
        <header className="overflow-hidden rounded-[2rem] bg-[#071b3a] p-6 text-white shadow-2xl shadow-blue-950/15 sm:p-8">
          <div className="grid gap-6 lg:grid-cols-[1fr_auto] lg:items-end">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.2em] text-blue-200">
                Assinatura do Orcaly
              </p>
              <h1 className="mt-3 text-3xl font-black tracking-[-0.04em] sm:text-4xl">
                Comece com 7 dias gratuitos
              </h1>
              <p className="mt-3 max-w-2xl font-semibold leading-7 text-blue-100">
                Escolha seu plano, cadastre o cartão com segurança e cancele antes do fim do período gratuito sem pagar a mensalidade.
              </p>
            </div>

            <div className="rounded-2xl border border-white/15 bg-white/10 px-5 py-4 backdrop-blur">
              <p className="text-xs font-black uppercase tracking-[0.16em] text-blue-200">
                Status
              </p>
              <p className="mt-2 text-xl font-black">
                {friendlyStatus(
                  company?.assinatura_status,
                )}
              </p>
            </div>
          </div>
        </header>

        {error ? (
          <div
            role="alert"
            className="rounded-2xl border border-red-200 bg-red-50 p-4 font-bold text-red-700"
          >
            {error}
          </div>
        ) : null}

        {message ? (
          <div
            aria-live="polite"
            className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 font-bold text-emerald-700"
          >
            {message}
          </div>
        ) : null}

        <section className="grid gap-4 md:grid-cols-3">
          {plans.map((plan) => {
            const selected =
              plan.key === planKey;

            return (
              <button
                key={plan.key}
                type="button"
                disabled={
                  hasRemoteSubscription &&
                  !cancelled
                }
                onClick={() =>
                  setPlanKey(plan.key)
                }
                className={`relative rounded-[1.75rem] border p-6 text-left shadow-sm transition ${
                  selected
                    ? "border-violet-500 bg-violet-50 ring-4 ring-violet-100"
                    : "border-slate-200 bg-white hover:-translate-y-0.5 hover:border-slate-300"
                } disabled:cursor-not-allowed disabled:opacity-70`}
              >
                {plan.highlight ? (
                  <span className="absolute right-4 top-4 rounded-full bg-violet-600 px-3 py-1 text-xs font-black text-white">
                    Recomendado
                  </span>
                ) : null}

                <p className="text-xl font-black">
                  {plan.name}
                </p>
                <p className="mt-4 text-3xl font-black tracking-[-0.04em]">
                  {currency(plan.price)}
                  <span className="ml-1 text-sm font-bold text-slate-500">
                    /mes
                  </span>
                </p>
                <p className="mt-4 text-sm font-semibold leading-6 text-slate-500">
                  {plan.description}
                </p>
              </button>
            );
          })}
        </section>

        <section className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
          <div className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="text-sm font-black text-violet-600">
                  Checkout transparente
                </p>
                <h2 className="mt-2 text-2xl font-black">
                  Cartao para renovacao mensal
                </h2>
                <p className="mt-2 max-w-2xl text-sm font-semibold leading-6 text-slate-500">
                  Os campos sensíveis são protegidos pelo Mercado Pago. O Orçaly recebe somente um token temporário, nunca o número completo nem o CVV.
                </p>
              </div>
            </div>

            {!publicKey ? (
              <div className="mt-6 rounded-2xl bg-amber-50 p-4 font-bold text-amber-800">
                A Public Key do Mercado Pago não foi configurada na produção.
              </div>
            ) : hasRemoteSubscription &&
              !cancelled ? (
              <div className="mt-6 rounded-3xl border border-emerald-200 bg-emerald-50 p-6">
                <h3 className="text-xl font-black text-emerald-900">
                  Renovacao configurada
                </h3>
                <p className="mt-2 font-semibold leading-6 text-emerald-800">
                  Sua assinatura já está vinculada ao Mercado Pago. O cartão não é exibido novamente para evitar cadastros duplicados.
                </p>
              </div>
            ) : (
              <form
                id="orcaly-subscription-form"
                key={planKey}
                className="mt-7 space-y-5"
              >
                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="text-sm font-black text-slate-700 sm:col-span-2">
                    Numero do cartao
                    <div
                      id="orcaly-card-number"
                      className="mt-2 min-h-12 rounded-xl border border-slate-300 bg-white px-3 py-3"
                    />
                  </label>

                  <label className="text-sm font-black text-slate-700">
                    Validade
                    <div
                      id="orcaly-expiration-date"
                      className="mt-2 min-h-12 rounded-xl border border-slate-300 bg-white px-3 py-3"
                    />
                  </label>

                  <label className="text-sm font-black text-slate-700">
                    CVV
                    <div
                      id="orcaly-security-code"
                      className="mt-2 min-h-12 rounded-xl border border-slate-300 bg-white px-3 py-3"
                    />
                  </label>

                  <label className="text-sm font-black text-slate-700 sm:col-span-2">
                    Nome como aparece no cartao
                    <input
                      id="orcaly-cardholder-name"
                      type="text"
                      autoComplete="cc-name"
                      className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-violet-500 focus:ring-4 focus:ring-violet-100"
                    />
                  </label>

                  <label className="text-sm font-black text-slate-700">
                    Tipo de documento
                    <select
                      id="orcaly-identification-type"
                      className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-4 py-3"
                    />
                  </label>

                  <label className="text-sm font-black text-slate-700">
                    CPF ou CNPJ do titular
                    <input
                      id="orcaly-identification-number"
                      inputMode="numeric"
                      className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-violet-500 focus:ring-4 focus:ring-violet-100"
                    />
                  </label>

                  <label className="text-sm font-black text-slate-700 sm:col-span-2">
                    E-mail do titular
                    <input
                      id="orcaly-cardholder-email"
                      type="email"
                      autoComplete="email"
                      className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-violet-500 focus:ring-4 focus:ring-violet-100"
                    />
                  </label>
                </div>

                <select
                  id="orcaly-issuer"
                  aria-label="Banco emissor"
                  className="hidden"
                />

                <select
                  id="orcaly-installments"
                  aria-label="Parcelas"
                  className="hidden"
                />

                <button
                  id="orcaly-subscription-submit"
                  type="submit"
                  disabled={
                    !cardReady ||
                    processing ||
                    !snapshot?.can_manage
                  }
                  className="inline-flex min-h-12 w-full items-center justify-center rounded-2xl bg-violet-600 px-6 py-4 font-black text-white transition hover:bg-violet-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {processing
                    ? "Configurando..."
                    : cardReady
                      ? `Iniciar 7 dias gratis no ${selectedPlan.name}`
                      : "Carregando campos seguros..."}
                </button>

                <p className="text-xs font-semibold leading-5 text-slate-500">
                  A mensalidade não é cobrada agora. O Mercado Pago pode realizar uma validação temporária de valor mínimo no cartão e estorná-la automaticamente.
                </p>
              </form>
            )}
          </div>

          <aside className="space-y-5">
            <div className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
              <h2 className="text-lg font-black">
                Resumo
              </h2>

              <div className="mt-5 space-y-4 text-sm">
                <div className="flex justify-between gap-4">
                  <span className="font-semibold text-slate-500">
                    Plano
                  </span>
                  <span className="text-right font-black">
                    {selectedPlan.name}
                  </span>
                </div>

                <div className="flex justify-between gap-4">
                  <span className="font-semibold text-slate-500">
                    Hoje
                  </span>
                  <span className="font-black text-emerald-700">
                    R$ 0,00
                  </span>
                </div>

                <div className="flex justify-between gap-4">
                  <span className="font-semibold text-slate-500">
                    Depois do teste
                  </span>
                  <span className="font-black">
                    {currency(
                      selectedPlan.price,
                    )}/mes
                  </span>
                </div>

                <div className="border-t border-slate-200 pt-4">
                  <p className="font-semibold text-slate-500">
                    Fim do acesso atual
                  </p>
                  <p className="mt-1 font-black">
                    {dateBR(
                      company?.access_until ||
                        company?.trial_ends_at,
                    )}
                  </p>
                </div>

                <div>
                  <p className="font-semibold text-slate-500">
                    Proxima cobranca
                  </p>
                  <p className="mt-1 font-black">
                    {dateBR(
                      company?.assinatura_proxima_cobranca,
                    )}
                  </p>
                </div>
              </div>
            </div>

            {hasRemoteSubscription ? (
              <div className="rounded-[2rem] border border-red-100 bg-white p-6 shadow-sm">
                <h2 className="font-black">
                  Cancelamento
                </h2>
                <p className="mt-2 text-sm font-semibold leading-6 text-slate-500">
                  Cancelando durante os sete dias gratuitos, nenhuma mensalidade será cobrada. O acesso permanece até o final do período.
                </p>

                <button
                  type="button"
                  onClick={cancelSubscription}
                  disabled={
                    processing ||
                    cancelled ||
                    !snapshot?.can_manage
                  }
                  className="mt-5 w-full rounded-2xl border border-red-200 px-4 py-3 font-black text-red-700 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {cancelled
                    ? "Renovação cancelada"
                    : "Cancelar renovação"}
                </button>
              </div>
            ) : null}
          </aside>
        </section>
      </div>
    </main>
  );
}
