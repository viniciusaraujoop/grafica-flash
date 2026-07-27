/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import Script from "next/script";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { supabase } from "@/lib/supabase";

type PlanKey = "basico" | "profissional" | "premium";
type CheckoutMode = "one_time" | "recurring";

type Snapshot = {
  company?: {
    plano?: string;
    assinatura_status?: string;
    assinatura_proxima_cobranca?: string | null;
    mercado_pago_subscription_status?: string | null;
    cancel_at_period_end?: boolean;
    access_until?: string | null;
    email?: string | null;
  };
  can_manage?: boolean;
};

type PixResult = {
  paymentId: string;
  qrCode: string;
  qrCodeBase64: string;
  ticketUrl: string;
  expirationDate: string;
};

const plans: Array<{
  key: PlanKey;
  name: string;
  price: number;
  description: string;
}> = [
  {
    key: "basico",
    name: "Básico",
    price: 49.9,
    description: "Site, catálogo e pedidos.",
  },
  {
    key: "profissional",
    name: "Intermediário",
    price: 99.9,
    description: "Mais recursos para organizar e vender.",
  },
  {
    key: "premium",
    name: "Premium",
    price: 149.9,
    description: "Recursos avançados para operações em crescimento.",
  },
];

function money(value: number) {
  return value.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

function dateBR(value?: string | null) {
  if (!value) return "Não definida";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "Não definida";

  return date.toLocaleDateString("pt-BR");
}

function normalizedPlan(value?: string): PlanKey {
  const plan = String(value || "").toLowerCase();

  if (plan === "premium") return "premium";

  if (
    plan === "profissional" ||
    plan === "intermediario" ||
    plan === "intermediário"
  ) {
    return "profissional";
  }

  return "basico";
}

function statusLabel(value?: string | null) {
  const status = String(value || "pendente").toLowerCase();

  if (status === "ativa" || status === "authorized") return "Ativa";
  if (status === "trialing") return "Período inicial";
  if (status === "past_due" || status === "paused") {
    return "Pagamento pendente";
  }
  if (
    status === "cancelada" ||
    status === "canceled" ||
    status === "cancelled"
  ) {
    return "Cancelada";
  }
  if (status === "cancel_at_period_end") {
    return "Cancelamento agendado";
  }

  return "Pendente";
}

function ShieldIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      className="h-5 w-5"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <path d="M12 3 5 6v5c0 4.6 2.8 8.4 7 10 4.2-1.6 7-5.4 7-10V6l-7-3Z" />
      <path d="m9 12 2 2 4-4" />
    </svg>
  );
}

function CardIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      className="h-6 w-6"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="M3 10h18" />
    </svg>
  );
}

function PixIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      className="h-6 w-6"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
    >
      <path d="m8.5 4.5 3.5 3.5 3.5-3.5" />
      <path d="m15.5 19.5-3.5-3.5-3.5 3.5" />
      <path d="M4.5 8.5 8 12l-3.5 3.5" />
      <path d="M19.5 8.5 16 12l3.5 3.5" />
      <path d="m8 12 4-4 4 4-4 4-4-4Z" />
    </svg>
  );
}

export default function MercadoPagoSubscriptionCheckout() {
  const publicKey =
    process.env.NEXT_PUBLIC_MERCADO_PAGO_PUBLIC_KEY || "";

  const brickControllerRef = useRef<any>(null);
  const processingRef = useRef(false);

  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [planKey, setPlanKey] = useState<PlanKey>("profissional");
  const [mode, setMode] = useState<CheckoutMode>("one_time");
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [sdkReady, setSdkReady] = useState(false);
  const [brickReady, setBrickReady] = useState(false);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [pix, setPix] = useState<PixResult | null>(null);
  const [paymentStatus, setPaymentStatus] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const selectedPlan = useMemo(
    () => plans.find((plan) => plan.key === planKey) || plans[1],
    [planKey],
  );

  const getToken = useCallback(async () => {
    const { data } = await supabase.auth.getSession();
    return data.session?.access_token || "";
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const token = await getToken();

      if (!token) {
        throw new Error("Sua sessão expirou. Entre novamente.");
      }

      const response = await fetch("/api/company/subscription", {
        cache: "no-store",
        headers: {
          authorization: `Bearer ${token}`,
        },
      });
      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(
          payload.error || "Não foi possível carregar a assinatura.",
        );
      }

      setSnapshot(payload);
      setPlanKey(normalizedPlan(payload.company?.plano));
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
    void load();
  }, [load]);

  const submitPayment = useCallback(
    async (formData: Record<string, unknown>) => {
      if (processingRef.current) return;

      processingRef.current = true;
      setProcessing(true);
      setError("");
      setMessage(
        mode === "recurring"
          ? "Ativando a renovação..."
          : "Processando o pagamento...",
      );

      try {
        const token = await getToken();

        if (!token) {
          throw new Error("Sua sessão expirou. Entre novamente.");
        }

        if (mode === "recurring") {
          const payer =
            formData.payer &&
            typeof formData.payer === "object" &&
            !Array.isArray(formData.payer)
              ? (formData.payer as Record<string, unknown>)
              : {};

          const response = await fetch(
            "/api/assinatura/mercado-pago",
            {
              method: "POST",
              headers: {
                "content-type": "application/json",
                authorization: `Bearer ${token}`,
              },
              body: JSON.stringify({
                plan: planKey,
                cardTokenId: formData.token,
                payerEmail:
                  payer.email ||
                  snapshot?.company?.email ||
                  "",
              }),
            },
          );
          const payload = await response.json().catch(() => ({}));

          if (!response.ok) {
            throw new Error(
              payload.error ||
                "Não foi possível ativar a renovação.",
            );
          }

          setPaymentStatus("paid");
          setMessage("Renovação automática ativada.");
          setCheckoutOpen(false);
          await load();
          return;
        }

        const response = await fetch("/api/assinatura/checkout", {
          method: "POST",
          headers: {
            "content-type": "application/json",
            authorization: `Bearer ${token}`,
            "idempotency-key": crypto.randomUUID(),
          },
          body: JSON.stringify({
            plan: planKey,
            formData,
          }),
        });
        const payload = await response.json().catch(() => ({}));

        if (!response.ok) {
          throw new Error(
            payload.error || "Não foi possível processar o pagamento.",
          );
        }

        setPaymentStatus(String(payload.status || "pending"));

        if (payload.pix?.paymentId) {
          setPix({
            paymentId: String(payload.pix.paymentId || ""),
            qrCode: String(payload.pix.qrCode || ""),
            qrCodeBase64: String(payload.pix.qrCodeBase64 || ""),
            ticketUrl: String(payload.pix.ticketUrl || ""),
            expirationDate: String(payload.pix.expirationDate || ""),
          });
          setMessage("Pix gerado.");
        } else if (payload.status === "paid") {
          setMessage("Pagamento aprovado.");
          setCheckoutOpen(false);
          await load();
        } else {
          setMessage("Pagamento em análise.");
        }
      } catch (cause) {
        setMessage("");
        setError(
          cause instanceof Error
            ? cause.message
            : "Não foi possível concluir o pagamento.",
        );
        throw cause;
      } finally {
        processingRef.current = false;
        setProcessing(false);
      }
    },
    [getToken, load, mode, planKey, snapshot?.company?.email],
  );

  useEffect(() => {
    if (
      !checkoutOpen ||
      !sdkReady ||
      !publicKey ||
      loading ||
      pix
    ) {
      return;
    }

    let cancelled = false;

    async function renderBrick() {
      const MercadoPagoConstructor = (
        window as unknown as {
          MercadoPago?: new (
            key: string,
            options?: Record<string, unknown>,
          ) => any;
        }
      ).MercadoPago;

      if (!MercadoPagoConstructor) return;

      setBrickReady(false);

      if (typeof brickControllerRef.current?.unmount === "function") {
        await brickControllerRef.current.unmount();
      }

      const container = document.getElementById(
        "subscription_payment_brick",
      );

      if (container) {
        container.innerHTML = "";
      }

      const mercadoPago = new MercadoPagoConstructor(publicKey, {
        locale: "pt-BR",
      });
      const bricksBuilder = mercadoPago.bricks();

      const paymentMethods =
        mode === "recurring"
          ? {
              creditCard: "all",
            }
          : {
              creditCard: "all",
              debitCard: "all",
              bankTransfer: "pix",
            };

      const controller = await bricksBuilder.create(
        "payment",
        "subscription_payment_brick",
        {
          initialization: {
            amount: selectedPlan.price,
          },
          customization: {
            paymentMethods,
            visual: {
              style: {
                theme: "default",
              },
            },
          },
          callbacks: {
            onReady: () => {
              if (!cancelled) setBrickReady(true);
            },
            onSubmit: ({
              selectedPaymentMethod,
              formData,
            }: {
              selectedPaymentMethod?: string;
              formData: Record<string, unknown>;
            }) =>
              new Promise<void>((resolve, reject) => {
                void submitPayment({
                  ...formData,
                  selected_payment_method:
                    selectedPaymentMethod || "",
                })
                  .then(() => resolve())
                  .catch(() => reject());
              }),
            onError: (brickError: unknown) => {
              console.error("mercado_pago_brick_error", brickError);
              if (!cancelled) {
                setError(
                  "Não foi possível carregar o pagamento. Tente novamente.",
                );
              }
            },
          },
        },
      );

      if (cancelled) {
        if (typeof controller?.unmount === "function") {
          await controller.unmount();
        }
        return;
      }

      brickControllerRef.current = controller;
    }

    void renderBrick();

    return () => {
      cancelled = true;
      setBrickReady(false);

      if (typeof brickControllerRef.current?.unmount === "function") {
        void brickControllerRef.current.unmount();
      }

      brickControllerRef.current = null;
    };
  }, [
    checkoutOpen,
    loading,
    mode,
    pix,
    publicKey,
    sdkReady,
    selectedPlan.price,
    submitPayment,
  ]);

  useEffect(() => {
    if (!pix?.paymentId || paymentStatus === "paid") return;

    const timer = window.setInterval(async () => {
      const token = await getToken();

      if (!token) return;

      const response = await fetch(
        `/api/assinatura/checkout/status?paymentId=${encodeURIComponent(
          pix.paymentId,
        )}`,
        {
          cache: "no-store",
          headers: {
            authorization: `Bearer ${token}`,
          },
        },
      );

      if (!response.ok) return;

      const payload = await response.json();
      const nextStatus = String(payload.status || "pending");

      setPaymentStatus(nextStatus);

      if (nextStatus === "paid") {
        setMessage("Pagamento aprovado.");
        window.clearInterval(timer);
        await load();
      }
    }, 5000);

    return () => window.clearInterval(timer);
  }, [getToken, load, paymentStatus, pix?.paymentId]);

  async function cancelSubscription() {
    const confirmed = window.confirm(
      "Cancelar a renovação da assinatura?",
    );

    if (!confirmed) return;

    setProcessing(true);
    setError("");
    setMessage("Cancelando a renovação...");

    try {
      const token = await getToken();

      if (!token) {
        throw new Error("Sua sessão expirou. Entre novamente.");
      }

      const response = await fetch("/api/assinatura/cancelar", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          reason: "Cancelamento solicitado pelo painel",
        }),
      });
      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(
          payload.error || "Não foi possível cancelar.",
        );
      }

      setMessage(payload.message || "Renovação cancelada.");
      await load();
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

  function resetCheckout(nextMode?: CheckoutMode) {
    setPix(null);
    setPaymentStatus("");
    setMessage("");
    setError("");

    if (nextMode) {
      setMode(nextMode);
    }
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-[#f5f7fb] p-4 sm:p-6">
        <div className="mx-auto max-w-6xl animate-pulse rounded-[2rem] bg-white p-8 shadow-xl">
          <div className="h-8 w-56 rounded bg-slate-100" />
          <div className="mt-8 h-72 rounded-3xl bg-slate-100" />
        </div>
      </main>
    );
  }

  const company = snapshot?.company;
  const providerStatus = company?.mercado_pago_subscription_status;
  const recurringActive =
    Boolean(providerStatus) &&
    !["canceled", "cancelled"].includes(
      String(providerStatus).toLowerCase(),
    );
  const cancelled = Boolean(company?.cancel_at_period_end);

  return (
    <main className="min-h-screen bg-[#f5f7fb] p-4 text-[#111827] sm:p-6">
      <Script
        src="https://sdk.mercadopago.com/js/v2"
        strategy="afterInteractive"
        onLoad={() => setSdkReady(true)}
        onError={() =>
          setError("Não foi possível carregar o pagamento.")
        }
      />

      <div className="mx-auto max-w-6xl space-y-6">
        <header className="overflow-hidden rounded-[2rem] bg-[#061a36] p-6 text-white shadow-2xl shadow-blue-950/15 sm:p-8">
          <div className="grid gap-6 lg:grid-cols-[1fr_auto] lg:items-end">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.18em] text-blue-200">
                Assinatura
              </p>
              <h1 className="mt-3 text-3xl font-black tracking-[-0.04em] sm:text-4xl">
                Plano e pagamento
              </h1>
              <p className="mt-3 max-w-2xl font-semibold text-blue-100">
                Consulte o plano atual e escolha como pagar.
              </p>
            </div>

            <div className="rounded-2xl border border-white/15 bg-white/10 px-5 py-4">
              <p className="text-xs font-black uppercase tracking-[0.14em] text-blue-200">
                Status
              </p>
              <p className="mt-2 text-xl font-black">
                {statusLabel(
                  company?.assinatura_status || providerStatus,
                )}
              </p>
            </div>
          </div>
        </header>

        {error ? (
          <div
            role="alert"
            className="rounded-2xl border border-red-100 bg-red-50 p-4 font-bold text-red-700"
          >
            {error}
          </div>
        ) : null}

        {message ? (
          <div
            aria-live="polite"
            className="rounded-2xl border border-emerald-100 bg-emerald-50 p-4 font-bold text-emerald-700"
          >
            {message}
          </div>
        ) : null}

        <section className="grid gap-4 md:grid-cols-3">
          {plans.map((plan) => {
            const selected = plan.key === planKey;

            return (
              <button
                key={plan.key}
                type="button"
                onClick={() => {
                  setPlanKey(plan.key);
                  setCheckoutOpen(false);
                  resetCheckout();
                }}
                className={`rounded-[1.5rem] border p-5 text-left transition ${
                  selected
                    ? "border-[#009ee3] bg-[#eef9fe] ring-4 ring-[#009ee3]/10"
                    : "border-slate-200 bg-white hover:border-[#009ee3]/40"
                }`}
              >
                <div className="flex items-center justify-between gap-3">
                  <p className="text-xl font-black">{plan.name}</p>
                  {selected ? (
                    <span className="rounded-full bg-[#009ee3] px-3 py-1 text-xs font-black text-white">
                      Selecionado
                    </span>
                  ) : null}
                </div>
                <p className="mt-3 text-3xl font-black text-[#061a36]">
                  {money(plan.price)}
                  <span className="ml-1 text-xs font-bold text-slate-500">
                    /mês
                  </span>
                </p>
                <p className="mt-3 text-sm font-semibold text-slate-500">
                  {plan.description}
                </p>
              </button>
            );
          })}
        </section>

        <section className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
          <div className="rounded-[2rem] border border-slate-200 bg-white p-5 shadow-xl shadow-slate-900/5 sm:p-7">
            <div className="flex flex-col gap-5 border-b border-slate-100 pb-6 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="text-sm font-black text-[#009ee3]">
                  {selectedPlan.name}
                </p>
                <h2 className="mt-2 text-2xl font-black">
                  {checkoutOpen
                    ? "Finalize o pagamento"
                    : "Escolha como pagar"}
                </h2>
                <p className="mt-2 text-sm font-semibold text-slate-500">
                  Valor mensal: {money(selectedPlan.price)}
                </p>
              </div>

              {checkoutOpen ? (
                <button
                  type="button"
                  onClick={() => {
                    setCheckoutOpen(false);
                    resetCheckout();
                  }}
                  className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-black text-slate-600"
                >
                  Fechar
                </button>
              ) : null}
            </div>

            {!checkoutOpen ? (
              <div className="mt-6 grid gap-4 sm:grid-cols-2">
                <button
                  type="button"
                  onClick={() => {
                    resetCheckout("one_time");
                    setCheckoutOpen(true);
                  }}
                  disabled={!snapshot?.can_manage}
                  className="rounded-[1.5rem] border border-slate-200 p-5 text-left transition hover:border-[#009ee3] hover:bg-[#f7fcff] disabled:opacity-50"
                >
                  <div className="flex items-center justify-between">
                    <span className="grid h-12 w-12 place-items-center rounded-2xl bg-[#eef9fe] text-[#009ee3]">
                      <PixIcon />
                    </span>
                    <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-black text-slate-600">
                      Pix ou cartão
                    </span>
                  </div>
                  <h3 className="mt-5 text-xl font-black">Pagar agora</h3>
                  <p className="mt-2 text-sm font-semibold leading-6 text-slate-500">
                    Pix, cartão de crédito ou débito.
                  </p>
                  <p className="mt-4 font-black text-[#061a36]">
                    Renova por 30 dias
                  </p>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    resetCheckout("recurring");
                    setCheckoutOpen(true);
                  }}
                  disabled={
                    !snapshot?.can_manage ||
                    (recurringActive && !cancelled)
                  }
                  className="rounded-[1.5rem] border border-slate-200 p-5 text-left transition hover:border-[#009ee3] hover:bg-[#f7fcff] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <div className="flex items-center justify-between">
                    <span className="grid h-12 w-12 place-items-center rounded-2xl bg-[#eef9fe] text-[#009ee3]">
                      <CardIcon />
                    </span>
                    <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-black text-[#05245c]">
                      Crédito
                    </span>
                  </div>
                  <h3 className="mt-5 text-xl font-black">
                    Renovação automática
                  </h3>
                  <p className="mt-2 text-sm font-semibold leading-6 text-slate-500">
                    Cobrança mensal no cartão de crédito.
                  </p>
                  <p className="mt-4 font-black text-[#061a36]">
                    Sem período gratuito
                  </p>
                </button>
              </div>
            ) : pix ? (
              <div className="mt-6 rounded-[1.75rem] border border-emerald-100 bg-emerald-50/60 p-5 text-center sm:p-7">
                <div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-emerald-100 text-emerald-700">
                  <PixIcon />
                </div>
                <h3 className="mt-4 text-2xl font-black">Pix gerado</h3>
                <p className="mt-2 text-sm font-semibold text-slate-500">
                  Escaneie o QR Code ou copie o código.
                </p>

                {pix.qrCodeBase64 ? (
                  <img
                    src={`data:image/png;base64,${pix.qrCodeBase64}`}
                    alt="QR Code Pix"
                    className="mx-auto mt-5 h-64 w-64 rounded-3xl bg-white p-3 shadow-lg"
                  />
                ) : null}

                {pix.qrCode ? (
                  <>
                    <textarea
                      readOnly
                      value={pix.qrCode}
                      className="mt-5 min-h-24 w-full rounded-2xl border border-emerald-200 bg-white p-4 text-xs"
                    />
                    <button
                      type="button"
                      onClick={() =>
                        navigator.clipboard.writeText(pix.qrCode)
                      }
                      className="mt-3 rounded-2xl bg-emerald-600 px-6 py-3 font-black text-white"
                    >
                      Copiar código Pix
                    </button>
                  </>
                ) : null}

                <p className="mt-4 text-sm font-bold text-slate-500">
                  {paymentStatus === "paid"
                    ? "Pagamento aprovado"
                    : "Aguardando pagamento"}
                </p>
                {pix.expirationDate ? (
                  <p className="mt-1 text-xs font-semibold text-slate-400">
                    Expira em {dateBR(pix.expirationDate)}
                  </p>
                ) : null}
              </div>
            ) : (
              <div className="mt-6">
                <div className="mb-5 flex items-start gap-3 rounded-2xl border border-[#009ee3]/15 bg-[#f4fbfe] p-4">
                  <span className="mt-0.5 text-[#009ee3]">
                    <ShieldIcon />
                  </span>
                  <div>
                    <p className="font-black text-[#061a36]">
                      Processado pelo Mercado Pago
                    </p>
                    <p className="mt-1 text-sm font-semibold leading-6 text-slate-500">
                      Os dados do cartão são preenchidos no ambiente seguro do Mercado Pago.
                    </p>
                  </div>
                </div>

                {mode === "recurring" ? (
                  <div className="mb-5 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <p className="font-black">Renovação automática</p>
                    <p className="mt-1 text-sm font-semibold text-slate-500">
                      Disponível para cartão de crédito. A cobrança começa agora.
                    </p>
                  </div>
                ) : null}

                {!publicKey ? (
                  <div className="rounded-2xl bg-amber-50 p-4 font-bold text-amber-800">
                    A chave pública do Mercado Pago não está configurada.
                  </div>
                ) : (
                  <>
                    {!brickReady ? (
                      <div className="mb-4 rounded-2xl bg-slate-50 p-4 text-center font-bold text-slate-500">
                        Carregando pagamento...
                      </div>
                    ) : null}
                    <div
                      id="subscription_payment_brick"
                      className="min-h-[240px]"
                    />
                  </>
                )}

                {processing ? (
                  <div className="mt-4 rounded-2xl bg-blue-50 p-4 text-center font-bold text-[#05245c]">
                    Processando...
                  </div>
                ) : null}
              </div>
            )}
          </div>

          <aside className="space-y-5">
            <div className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-xl shadow-slate-900/5">
              <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-400">
                Resumo
              </p>
              <h2 className="mt-3 text-2xl font-black">
                {selectedPlan.name}
              </h2>

              <div className="mt-5 rounded-2xl bg-[#061a36] p-5 text-white">
                <p className="text-sm font-bold text-blue-200">
                  Valor mensal
                </p>
                <p className="mt-1 text-3xl font-black">
                  {money(selectedPlan.price)}
                </p>
              </div>

              <div className="mt-5 space-y-4 text-sm">
                <div className="flex justify-between gap-4">
                  <span className="font-semibold text-slate-500">
                    Próxima cobrança
                  </span>
                  <span className="text-right font-black">
                    {dateBR(company?.assinatura_proxima_cobranca)}
                  </span>
                </div>
                <div className="flex justify-between gap-4">
                  <span className="font-semibold text-slate-500">
                    Acesso até
                  </span>
                  <span className="text-right font-black">
                    {dateBR(company?.access_until)}
                  </span>
                </div>
              </div>
            </div>

            <div className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-xl shadow-slate-900/5">
              <div className="flex items-center gap-3 text-[#009ee3]">
                <ShieldIcon />
                <p className="font-black">Pagamento protegido</p>
              </div>
              <p className="mt-3 text-sm font-semibold leading-6 text-slate-500">
                O Orçaly não armazena número do cartão nem CVV.
              </p>
            </div>

            {recurringActive ? (
              <div className="rounded-[2rem] border border-red-100 bg-white p-6 shadow-xl shadow-slate-900/5">
                <h2 className="font-black">Renovação automática</h2>
                <p className="mt-2 text-sm font-semibold leading-6 text-slate-500">
                  O acesso já pago permanece até a data indicada.
                </p>
                <button
                  type="button"
                  onClick={cancelSubscription}
                  disabled={
                    processing ||
                    cancelled ||
                    !snapshot?.can_manage
                  }
                  className="mt-5 w-full rounded-2xl border border-red-200 px-4 py-3 font-black text-red-700 disabled:opacity-50"
                >
                  {cancelled
                    ? "Cancelamento agendado"
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
