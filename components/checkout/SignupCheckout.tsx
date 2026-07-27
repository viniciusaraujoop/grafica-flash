/* eslint-disable @typescript-eslint/no-explicit-any, @next/next/no-img-element */
"use client";

import Script from "next/script";
import {
  FormEvent,
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useSearchParams } from "next/navigation";

type CheckoutPayload = {
  leadId: string;
  responsibleName: string;
  companyName: string;
  email: string;
  phone: string;
  document: string;
  status: string;
  paymentMethod?: string | null;
  paymentStatus?: string | null;
  readyToCreateAccount: boolean;
  converted: boolean;
  plan: {
    key: string;
    name: string;
    price: number;
    description: string;
  };
  pix?: {
    paymentId?: string | null;
    qrCode?: string | null;
    qrCodeBase64?: string | null;
    ticketUrl?: string | null;
    expirationDate?: string | null;
  };
  subscription?: {
    id?: string | null;
    status?: string | null;
    nextPaymentDate?: string | null;
  };
};

function money(value: number) {
  return value.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

function dateBR(value?: string | null) {
  if (!value) return "";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "";

  return date.toLocaleString("pt-BR");
}

function safeRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  return value as Record<string, unknown>;
}

function paymentKind(
  selectedPaymentMethod: unknown,
  formData: Record<string, unknown>,
) {
  const selected = String(selectedPaymentMethod || "").toLowerCase();
  const method = String(formData.payment_method_id || "").toLowerCase();
  const type = String(formData.payment_type_id || "").toLowerCase();

  if (
    method === "pix" ||
    type === "bank_transfer" ||
    selected.includes("pix") ||
    selected.includes("bank_transfer")
  ) {
    return "pix" as const;
  }

  if (
    type === "credit_card" ||
    selected.includes("credit") ||
    selected.includes("card")
  ) {
    return "card" as const;
  }

  return "unsupported" as const;
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

function CheckoutContent() {
  const params = useSearchParams();
  const leadId = params.get("lead_id") || "";
  const expires = params.get("expires") || "";
  const token = params.get("token") || "";
  const publicKey =
    process.env.NEXT_PUBLIC_MERCADO_PAGO_PUBLIC_KEY || "";

  const brickControllerRef = useRef<any>(null);
  const processingRef = useRef(false);

  const [checkout, setCheckout] = useState<CheckoutPayload | null>(null);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [sdkReady, setSdkReady] = useState(false);
  const [brickReady, setBrickReady] = useState(false);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [accountCreated, setAccountCreated] = useState(false);

  const query = useMemo(
    () =>
      new URLSearchParams({
        lead_id: leadId,
        expires,
        token,
      }).toString(),
    [expires, leadId, token],
  );

  const loadCheckout = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const response = await fetch(`/api/checkout/signup?${query}`, {
        cache: "no-store",
      });
      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(
          payload.error || "Não foi possível carregar o pagamento.",
        );
      }

      setCheckout(payload);

      if (payload.pix?.paymentId) {
        setCheckoutOpen(true);
      }
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Não foi possível carregar o pagamento.",
      );
    } finally {
      setLoading(false);
    }
  }, [query]);

  useEffect(() => {
    void loadCheckout();
  }, [loadCheckout]);

  useEffect(() => {
    if (
      !checkout?.pix?.paymentId ||
      checkout.readyToCreateAccount ||
      checkout.converted
    ) {
      return;
    }

    const timer = window.setInterval(async () => {
      const response = await fetch(
        `/api/checkout/signup/status?${query}`,
        { cache: "no-store" },
      );

      if (!response.ok) return;

      const payload = await response.json();

      setCheckout(payload);

      if (payload.readyToCreateAccount) {
        setMessage("Pagamento confirmado. Crie sua senha para entrar.");
        window.clearInterval(timer);
      }
    }, 5000);

    return () => window.clearInterval(timer);
  }, [
    checkout?.converted,
    checkout?.pix?.paymentId,
    checkout?.readyToCreateAccount,
    query,
  ]);

  const submitPayment = useCallback(
    async (
      selectedPaymentMethod: unknown,
      formData: Record<string, unknown>,
    ) => {
      if (processingRef.current) return;

      processingRef.current = true;
      setProcessing(true);
      setError("");
      setMessage("Processando...");

      try {
        const kind = paymentKind(selectedPaymentMethod, formData);
        const payer = safeRecord(formData.payer);
        const identification = safeRecord(payer.identification);

        if (kind === "pix") {
          const response = await fetch("/api/checkout/signup/pix", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
              leadId,
              expires,
              token,
              document:
                identification.number ||
                checkout?.document ||
                "",
            }),
          });
          const payload = await response.json().catch(() => ({}));

          if (!response.ok) {
            throw new Error(
              payload.error || "Não foi possível gerar o Pix.",
            );
          }

          setCheckout(payload);
          setMessage("Pix gerado.");
          return;
        }

        if (kind === "card") {
          const response = await fetch("/api/checkout/signup/card", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
              leadId,
              expires,
              token,
              cardTokenId: formData.token,
              payerEmail: payer.email || checkout?.email || "",
            }),
          });
          const payload = await response.json().catch(() => ({}));

          if (!response.ok) {
            throw new Error(
              payload.error || "Não foi possível cadastrar o cartão.",
            );
          }

          setCheckout(payload);
          setMessage(
            "Cartão confirmado. A primeira cobrança será feita após os 7 dias.",
          );
          return;
        }

        throw new Error(
          "No cadastro, escolha Pix ou cartão de crédito.",
        );
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
    [checkout?.email, expires, leadId, token],
  );

  useEffect(() => {
    if (
      !checkoutOpen ||
      !sdkReady ||
      !publicKey ||
      !checkout ||
      checkout.readyToCreateAccount ||
      checkout.pix?.paymentId
    ) {
      return;
    }

    const currentCheckout = checkout;
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
        "signup_payment_brick",
      );

      if (container) {
        container.innerHTML = "";
      }

      const mercadoPago = new MercadoPagoConstructor(publicKey, {
        locale: "pt-BR",
      });
      const bricksBuilder = mercadoPago.bricks();

      const controller = await bricksBuilder.create(
        "payment",
        "signup_payment_brick",
        {
          initialization: {
            amount: currentCheckout.plan.price,
            payer: {
              email: currentCheckout.email,
              identification: {
                type:
                  currentCheckout.document.length === 14
                    ? "CNPJ"
                    : "CPF",
                number: currentCheckout.document,
              },
            },
          },
          customization: {
            paymentMethods: {
              creditCard: "all",
              bankTransfer: "pix",
            },
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
                void submitPayment(selectedPaymentMethod, formData)
                  .then(() => resolve())
                  .catch(() => reject());
              }),
            onError: (brickError: unknown) => {
              console.error("signup_payment_brick_error", brickError);

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
    checkout,
    checkoutOpen,
    publicKey,
    sdkReady,
    submitPayment,
  ]);

  async function createAccount(event: FormEvent) {
    event.preventDefault();
    setProcessing(true);
    setError("");
    setMessage("Criando sua conta...");

    try {
      const response = await fetch("/api/leads/complete-account", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          lead_id: leadId,
          password,
          confirm_password: confirmPassword,
        }),
      });
      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(
          payload.error || "Não foi possível criar a conta.",
        );
      }

      setAccountCreated(true);
      setMessage("Conta criada. Você já pode entrar no Orçaly.");
    } catch (cause) {
      setMessage("");
      setError(
        cause instanceof Error
          ? cause.message
          : "Não foi possível criar a conta.",
      );
    } finally {
      setProcessing(false);
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

  if (!checkout) {
    return (
      <main className="grid min-h-screen place-items-center bg-[#f5f7fb] p-4">
        <div className="w-full max-w-xl rounded-[2rem] border border-red-100 bg-white p-8 text-center shadow-xl">
          <img src="/logo-orcaly.png" alt="Orçaly" className="mx-auto h-12" />
          <h1 className="mt-6 text-2xl font-black">
            Pagamento indisponível
          </h1>
          <p className="mt-3 font-semibold text-slate-500">
            {error || "Volte ao cadastro e tente novamente."}
          </p>
        </div>
      </main>
    );
  }

  if (checkout.converted || accountCreated) {
    return (
      <main className="grid min-h-screen place-items-center bg-[#f5f7fb] p-4">
        <div className="w-full max-w-xl rounded-[2rem] border border-emerald-100 bg-white p-8 text-center shadow-xl">
          <img src="/logo-orcaly.png" alt="Orçaly" className="mx-auto h-12" />
          <div className="mx-auto mt-6 grid h-16 w-16 place-items-center rounded-full bg-emerald-100 text-3xl">
            ✓
          </div>
          <h1 className="mt-5 text-3xl font-black">Conta criada</h1>
          <p className="mt-3 font-semibold text-slate-500">
            Entre com o e-mail usado no cadastro.
          </p>
          <a
            href="/login"
            className="mt-6 inline-flex rounded-2xl bg-[#061a36] px-7 py-4 font-black text-white"
          >
            Entrar no Orçaly
          </a>
        </div>
      </main>
    );
  }

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
            <div className="flex items-start gap-4">
              <img
                src="/logo-orcaly.png"
                alt="Orçaly"
                className="h-12 w-auto rounded-xl bg-white p-2"
              />
              <div>
                <p className="text-xs font-black uppercase tracking-[0.18em] text-blue-200">
                  Cadastro
                </p>
                <h1 className="mt-3 text-3xl font-black tracking-[-0.04em] sm:text-4xl">
                  Finalize sua assinatura
                </h1>
                <p className="mt-3 max-w-2xl font-semibold text-blue-100">
                  Escolha Pix ou cartão de crédito sem sair do Orçaly.
                </p>
              </div>
            </div>

            <div className="rounded-2xl border border-white/15 bg-white/10 px-5 py-4">
              <p className="text-xs font-black uppercase tracking-[0.14em] text-blue-200">
                Plano
              </p>
              <p className="mt-2 text-xl font-black">
                {checkout.plan.name}
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

        <section className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
          <div className="rounded-[2rem] border border-slate-200 bg-white p-5 shadow-xl shadow-slate-900/5 sm:p-7">
            <div className="flex flex-col gap-5 border-b border-slate-100 pb-6 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="text-sm font-black text-[#009ee3]">
                  {checkout.plan.name}
                </p>
                <h2 className="mt-2 text-2xl font-black">
                  {checkout.readyToCreateAccount
                    ? "Crie sua senha"
                    : checkoutOpen
                      ? "Escolha como pagar"
                      : "Pagamento da assinatura"}
                </h2>
                <p className="mt-2 text-sm font-semibold text-slate-500">
                  Mensalidade de {money(checkout.plan.price)}
                </p>
              </div>

              {checkoutOpen &&
              !checkout.readyToCreateAccount &&
              !checkout.pix?.paymentId ? (
                <button
                  type="button"
                  onClick={() => {
                    setCheckoutOpen(false);
                    setMessage("");
                    setError("");
                  }}
                  className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-black text-slate-600"
                >
                  Fechar
                </button>
              ) : null}
            </div>

            {checkout.readyToCreateAccount ? (
              <form
                onSubmit={createAccount}
                className="mt-6 rounded-[1.75rem] border border-emerald-100 bg-emerald-50/60 p-6"
              >
                <div className="flex items-center gap-3">
                  <div className="grid h-12 w-12 place-items-center rounded-full bg-emerald-100 text-2xl">
                    ✓
                  </div>
                  <div>
                    <h3 className="text-2xl font-black">
                      Pagamento confirmado
                    </h3>
                    <p className="mt-1 text-sm font-semibold text-slate-500">
                      Crie a senha da sua conta.
                    </p>
                  </div>
                </div>

                <div className="mt-5 grid gap-4">
                  <input
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    type="password"
                    placeholder="Crie uma senha"
                    className="rounded-2xl border border-emerald-200 bg-white px-4 py-4 font-bold"
                  />
                  <input
                    value={confirmPassword}
                    onChange={(event) =>
                      setConfirmPassword(event.target.value)
                    }
                    type="password"
                    placeholder="Confirme a senha"
                    className="rounded-2xl border border-emerald-200 bg-white px-4 py-4 font-bold"
                  />
                  <button
                    disabled={processing}
                    className="rounded-2xl bg-[#061a36] px-6 py-4 font-black text-white disabled:opacity-50"
                  >
                    {processing ? "Criando conta..." : "Criar conta"}
                  </button>
                </div>
              </form>
            ) : checkout.pix?.paymentId ? (
              <div className="mt-6 rounded-[1.75rem] border border-emerald-100 bg-emerald-50/60 p-5 text-center sm:p-7">
                <div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-emerald-100 text-emerald-700">
                  <PixIcon />
                </div>
                <h3 className="mt-4 text-2xl font-black">Pix gerado</h3>
                <p className="mt-2 text-sm font-semibold text-slate-500">
                  Escaneie o QR Code ou copie o código.
                </p>

                {checkout.pix.qrCodeBase64 ? (
                  <img
                    src={`data:image/png;base64,${checkout.pix.qrCodeBase64}`}
                    alt="QR Code Pix"
                    className="mx-auto mt-5 h-64 w-64 rounded-3xl bg-white p-3 shadow-lg"
                  />
                ) : null}

                {checkout.pix.qrCode ? (
                  <>
                    <textarea
                      readOnly
                      value={checkout.pix.qrCode}
                      className="mt-5 min-h-24 w-full rounded-2xl border border-emerald-200 bg-white p-4 text-xs"
                    />
                    <button
                      type="button"
                      onClick={() =>
                        navigator.clipboard.writeText(
                          checkout.pix?.qrCode || "",
                        )
                      }
                      className="mt-3 rounded-2xl bg-emerald-600 px-6 py-3 font-black text-white"
                    >
                      Copiar código Pix
                    </button>
                  </>
                ) : null}

                <p className="mt-4 text-sm font-bold text-slate-500">
                  Aguardando confirmação do pagamento
                </p>
                {checkout.pix.expirationDate ? (
                  <p className="mt-1 text-xs font-semibold text-slate-400">
                    Expira em {dateBR(checkout.pix.expirationDate)}
                  </p>
                ) : null}
              </div>
            ) : !checkoutOpen ? (
              <div className="mt-6 grid gap-4 sm:grid-cols-2">
                <button
                  type="button"
                  onClick={() => {
                    setCheckoutOpen(true);
                    setMessage("");
                    setError("");
                  }}
                  className="rounded-[1.5rem] border border-slate-200 p-5 text-left transition hover:border-[#009ee3] hover:bg-[#f7fcff]"
                >
                  <div className="flex items-center justify-between">
                    <span className="grid h-12 w-12 place-items-center rounded-2xl bg-[#eef9fe] text-[#009ee3]">
                      <PixIcon />
                    </span>
                    <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-black text-slate-600">
                      Pix ou crédito
                    </span>
                  </div>
                  <h3 className="mt-5 text-xl font-black">
                    Continuar para pagamento
                  </h3>
                  <p className="mt-2 text-sm font-semibold leading-6 text-slate-500">
                    O Mercado Pago exibirá as opções disponíveis.
                  </p>
                </button>

                <div className="rounded-[1.5rem] border border-slate-200 bg-slate-50 p-5">
                  <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-400">
                    Oferta do cadastro
                  </p>
                  <p className="mt-4 font-black text-[#061a36]">
                    Crédito: R$ 0,00 hoje
                  </p>
                  <p className="mt-2 text-sm font-semibold leading-6 text-slate-500">
                    Primeira cobrança após 7 dias.
                  </p>
                  <p className="mt-4 font-black text-[#061a36]">
                    Pix: {money(checkout.plan.price)} agora
                  </p>
                  <p className="mt-2 text-sm font-semibold leading-6 text-slate-500">
                    Primeiro ciclo com 37 dias.
                  </p>
                </div>
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
                      Os dados do cartão são preenchidos no ambiente seguro
                      do Mercado Pago.
                    </p>
                  </div>
                </div>

                <div className="mb-5 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <p className="font-black">Condições do cadastro</p>
                  <p className="mt-1 text-sm font-semibold leading-6 text-slate-500">
                    Cartão de crédito começa com 7 dias sem cobrança.
                    Pix é pago agora e recebe 7 dias adicionais no primeiro ciclo.
                  </p>
                </div>

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
                      id="signup_payment_brick"
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
                {checkout.plan.name}
              </h2>
              <p className="mt-2 text-sm font-semibold leading-6 text-slate-500">
                {checkout.plan.description}
              </p>

              <div className="mt-5 rounded-2xl bg-[#061a36] p-5 text-white">
                <p className="text-sm font-bold text-blue-200">
                  Mensalidade
                </p>
                <p className="mt-1 text-3xl font-black">
                  {money(checkout.plan.price)}
                </p>
                <p className="mt-1 text-xs font-bold text-blue-200">
                  por mês
                </p>
              </div>

              <div className="mt-5 space-y-4 text-sm">
                <div className="flex justify-between gap-4">
                  <span className="font-semibold text-slate-500">
                    Empresa
                  </span>
                  <span className="text-right font-black">
                    {checkout.companyName}
                  </span>
                </div>
                <div className="flex justify-between gap-4">
                  <span className="font-semibold text-slate-500">
                    Responsável
                  </span>
                  <span className="text-right font-black">
                    {checkout.responsibleName}
                  </span>
                </div>
                <div className="flex justify-between gap-4">
                  <span className="font-semibold text-slate-500">
                    E-mail
                  </span>
                  <span className="break-all text-right font-black">
                    {checkout.email}
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
          </aside>
        </section>
      </div>
    </main>
  );
}

export default function SignupCheckout() {
  return (
    <Suspense
      fallback={
        <main className="grid min-h-screen place-items-center bg-[#f5f7fb] font-black text-[#061a36]">
          Carregando...
        </main>
      }
    >
      <CheckoutContent />
    </Suspense>
  );
}
