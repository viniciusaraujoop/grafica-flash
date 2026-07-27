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

function CheckoutContent() {
  const params = useSearchParams();
  const leadId = params.get("lead_id") || "";
  const expires = params.get("expires") || "";
  const token = params.get("token") || "";
  const publicKey =
    process.env.NEXT_PUBLIC_MERCADO_PAGO_PUBLIC_KEY || "";

  const cardFormRef = useRef<any>(null);
  const processingRef = useRef(false);

  const [checkout, setCheckout] = useState<CheckoutPayload | null>(null);
  const [method, setMethod] = useState<"pix" | "card" | null>(null);
  const [sdkReady, setSdkReady] = useState(false);
  const [cardReady, setCardReady] = useState(false);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [document, setDocument] = useState("");
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

      if (payload.paymentMethod === "pix") setMethod("pix");
      if (payload.paymentMethod === "card") setMethod("card");
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

  async function generatePix() {
    if (processingRef.current) return;

    processingRef.current = true;
    setProcessing(true);
    setError("");
    setMessage("Gerando o Pix...");

    try {
      const response = await fetch("/api/checkout/signup/pix", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          leadId,
          expires,
          token,
          document,
        }),
      });

      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(payload.error || "Não foi possível gerar o Pix.");
      }

      setCheckout(payload);
      setMethod("pix");
      setMessage("Pix gerado. O status será atualizado após o pagamento.");
    } catch (cause) {
      setMessage("");
      setError(
        cause instanceof Error
          ? cause.message
          : "Não foi possível gerar o Pix.",
      );
    } finally {
      processingRef.current = false;
      setProcessing(false);
    }
  }

  const submitCard = useCallback(
    async (cardForm: any) => {
      if (processingRef.current) return;

      processingRef.current = true;
      setProcessing(true);
      setError("");
      setMessage("Validando o cartão...");

      try {
        const formData = cardForm.getCardFormData();
        const cardTokenId = String(formData.token || "").trim();
        const payerEmail = String(
          formData.cardholderEmail || checkout?.email || "",
        ).trim();

        if (!cardTokenId) {
          throw new Error("Não foi possível validar o cartão.");
        }

        const response = await fetch("/api/checkout/signup/card", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            leadId,
            expires,
            token,
            cardTokenId,
            payerEmail,
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
          "Cartão cadastrado. A primeira cobrança será feita após os 7 dias.",
        );
      } catch (cause) {
        setMessage("");
        setError(
          cause instanceof Error
            ? cause.message
            : "Não foi possível cadastrar o cartão.",
        );
      } finally {
        processingRef.current = false;
        setProcessing(false);
      }
    },
    [checkout?.email, expires, leadId, token],
  );

  useEffect(() => {
    if (
      method !== "card" ||
      !sdkReady ||
      !publicKey ||
      !checkout ||
      checkout.readyToCreateAccount
    ) {
      return;
    }

    const MercadoPagoConstructor = (
      window as unknown as {
        MercadoPago?: new (
          key: string,
          options?: Record<string, unknown>,
        ) => any;
      }
    ).MercadoPago;

    if (!MercadoPagoConstructor) return;

    setCardReady(false);

    const mercadoPago = new MercadoPagoConstructor(publicKey, {
      locale: "pt-BR",
    });

    const cardForm = mercadoPago.cardForm({
      amount: checkout.plan.price.toFixed(2),
      iframe: true,
      form: {
        id: "signup-card-form",
        cardNumber: {
          id: "signup-card-number",
          placeholder: "Número do cartão",
        },
        expirationDate: {
          id: "signup-expiration-date",
          placeholder: "MM/AA",
        },
        securityCode: {
          id: "signup-security-code",
          placeholder: "CVV",
        },
        cardholderName: {
          id: "signup-cardholder-name",
          placeholder: "Nome no cartão",
        },
        issuer: {
          id: "signup-issuer",
          placeholder: "Banco emissor",
        },
        installments: {
          id: "signup-installments",
          placeholder: "Parcelas",
        },
        identificationType: {
          id: "signup-identification-type",
          placeholder: "Documento",
        },
        identificationNumber: {
          id: "signup-identification-number",
          placeholder: "CPF ou CNPJ",
        },
        cardholderEmail: {
          id: "signup-cardholder-email",
          placeholder: "E-mail",
        },
      },
      callbacks: {
        onFormMounted: (formError: unknown) => {
          if (formError) {
            setError("Não foi possível carregar os campos do cartão.");
            return;
          }

          setCardReady(true);
        },
        onSubmit: (event: FormEvent) => {
          event.preventDefault();
          void submitCard(cardForm);
        },
        onFetching: () => {
          setMessage("Validando o cartão...");
          return () => undefined;
        },
      },
    });

    cardFormRef.current = cardForm;

    return () => {
      setCardReady(false);

      if (typeof cardFormRef.current?.unmount === "function") {
        cardFormRef.current.unmount();
      }

      cardFormRef.current = null;
    };
  }, [
    checkout,
    method,
    publicKey,
    sdkReady,
    submitCard,
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
        throw new Error(payload.error || "Não foi possível criar a conta.");
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
      <main className="grid min-h-screen place-items-center bg-[#f6f9ff] p-4">
        <div className="w-full max-w-5xl animate-pulse rounded-[2rem] bg-white p-8 shadow-xl">
          <div className="h-10 w-56 rounded bg-slate-100" />
          <div className="mt-8 h-96 rounded-3xl bg-slate-100" />
        </div>
      </main>
    );
  }

  if (!checkout) {
    return (
      <main className="grid min-h-screen place-items-center bg-[#f6f9ff] p-4">
        <div className="w-full max-w-xl rounded-[2rem] border border-red-100 bg-white p-8 text-center shadow-xl">
          <img src="/logo-orcaly.png" alt="Orçaly" className="mx-auto h-12" />
          <h1 className="mt-6 text-2xl font-black">Pagamento indisponível</h1>
          <p className="mt-3 font-semibold text-slate-500">
            {error || "Volte ao cadastro e tente novamente."}
          </p>
        </div>
      </main>
    );
  }

  if (checkout.converted || accountCreated) {
    return (
      <main className="grid min-h-screen place-items-center bg-[#f6f9ff] p-4">
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
            className="mt-6 inline-flex rounded-2xl bg-[#05245c] px-7 py-4 font-black text-white"
          >
            Entrar no Orçaly
          </a>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#f6f9ff] p-4 text-[#061a36] sm:p-6">
      <Script
        src="https://sdk.mercadopago.com/js/v2"
        strategy="afterInteractive"
        onLoad={() => setSdkReady(true)}
        onError={() => setError("Não foi possível carregar o cartão.")}
      />

      <div className="mx-auto max-w-6xl">
        <header className="flex items-center justify-between gap-4 py-3">
          <img src="/logo-orcaly.png" alt="Orçaly" className="h-11 w-auto" />
          <span className="rounded-full border border-blue-100 bg-white px-4 py-2 text-xs font-black text-[#05245c]">
            Pagamento seguro
          </span>
        </header>

        <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
          <section className="rounded-[2.25rem] border border-blue-100 bg-white p-5 shadow-2xl shadow-blue-950/8 sm:p-8">
            <div>
              <p className="text-sm font-black text-[#05245c]">
                Finalize seu cadastro
              </p>
              <h1 className="mt-2 text-3xl font-black tracking-[-0.04em] sm:text-4xl">
                Escolha a forma de pagamento
              </h1>
              <p className="mt-3 font-semibold text-slate-500">
                Os dados só aparecem depois que você escolhe Pix ou cartão.
              </p>
            </div>

            {error ? (
              <div className="mt-5 rounded-2xl bg-red-50 p-4 font-bold text-red-700">
                {error}
              </div>
            ) : null}

            {message ? (
              <div className="mt-5 rounded-2xl bg-blue-50 p-4 font-bold text-[#05245c]">
                {message}
              </div>
            ) : null}

            {!checkout.readyToCreateAccount ? (
              <>
                <div className="mt-7 grid gap-4 sm:grid-cols-2">
                  <button
                    type="button"
                    onClick={() => {
                      setMethod("pix");
                      setError("");
                      setMessage("");
                    }}
                    className={`rounded-[1.5rem] border p-5 text-left transition ${
                      method === "pix"
                        ? "border-emerald-500 bg-emerald-50 ring-4 ring-emerald-100"
                        : "border-slate-200 hover:border-emerald-300"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-2xl">◈</span>
                      <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-black text-emerald-700">
                        Pix
                      </span>
                    </div>
                    <h2 className="mt-4 text-xl font-black">Pagar por Pix</h2>
                    <p className="mt-2 text-sm font-semibold leading-6 text-slate-500">
                      O QR Code aparece somente depois da confirmação.
                    </p>
                    <p className="mt-4 font-black text-emerald-700">
                      {money(checkout.plan.price)} agora
                    </p>
                    <p className="mt-1 text-xs font-bold text-slate-500">
                      Primeiro ciclo com 37 dias
                    </p>
                  </button>

                  <button
                    type="button"
                    disabled={Boolean(checkout.pix?.paymentId)}
                    onClick={() => {
                      setMethod("card");
                      setError("");
                      setMessage("");
                    }}
                    className={`rounded-[1.5rem] border p-5 text-left transition disabled:cursor-not-allowed disabled:opacity-50 ${
                      method === "card"
                        ? "border-[#05245c] bg-blue-50 ring-4 ring-blue-100"
                        : "border-slate-200 hover:border-blue-300"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-2xl">▣</span>
                      <span className="rounded-full bg-blue-100 px-3 py-1 text-xs font-black text-[#05245c]">
                        Cartão
                      </span>
                    </div>
                    <h2 className="mt-4 text-xl font-black">Cadastrar cartão</h2>
                    <p className="mt-2 text-sm font-semibold leading-6 text-slate-500">
                      Nenhuma mensalidade é cobrada hoje.
                    </p>
                    <p className="mt-4 font-black text-[#05245c]">
                      R$ 0,00 hoje
                    </p>
                    <p className="mt-1 text-xs font-bold text-slate-500">
                      Primeira cobrança após 7 dias
                    </p>
                  </button>
                </div>

                {method === "pix" ? (
                  <div className="mt-6 rounded-[1.5rem] border border-emerald-100 bg-emerald-50/60 p-5">
                    {!checkout.pix?.qrCode ? (
                      <>
                        <h2 className="text-lg font-black">Gerar Pix</h2>
                        <p className="mt-2 text-sm font-semibold text-slate-500">
                          Informe o CPF ou CNPJ do pagador.
                        </p>
                        <input
                          value={document}
                          onChange={(event) => setDocument(event.target.value)}
                          placeholder="CPF ou CNPJ"
                          inputMode="numeric"
                          className="mt-4 w-full rounded-2xl border border-emerald-200 bg-white px-4 py-4 font-bold outline-none focus:ring-4 focus:ring-emerald-100"
                        />
                        <button
                          type="button"
                          onClick={generatePix}
                          disabled={processing}
                          className="mt-4 w-full rounded-2xl bg-emerald-600 px-6 py-4 font-black text-white disabled:opacity-50"
                        >
                          {processing
                            ? "Gerando..."
                            : `Gerar Pix de ${money(checkout.plan.price)}`}
                        </button>
                      </>
                    ) : (
                      <div className="text-center">
                        <h2 className="text-2xl font-black">Pix pronto</h2>
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
                    )}
                  </div>
                ) : null}

                {method === "card" ? (
                  <form
                    id="signup-card-form"
                    className="mt-6 rounded-[1.5rem] border border-blue-100 bg-blue-50/60 p-5"
                  >
                    <h2 className="text-lg font-black">Dados do cartão</h2>
                    <p className="mt-2 text-sm font-semibold text-slate-500">
                      A primeira mensalidade será cobrada somente depois dos 7 dias.
                    </p>

                    <div className="mt-5 grid gap-4 sm:grid-cols-2">
                      <label className="text-sm font-black sm:col-span-2">
                        Número do cartão
                        <div
                          id="signup-card-number"
                          className="mt-2 min-h-12 rounded-xl border border-blue-100 bg-white px-3 py-3"
                        />
                      </label>

                      <label className="text-sm font-black">
                        Validade
                        <div
                          id="signup-expiration-date"
                          className="mt-2 min-h-12 rounded-xl border border-blue-100 bg-white px-3 py-3"
                        />
                      </label>

                      <label className="text-sm font-black">
                        CVV
                        <div
                          id="signup-security-code"
                          className="mt-2 min-h-12 rounded-xl border border-blue-100 bg-white px-3 py-3"
                        />
                      </label>

                      <label className="text-sm font-black sm:col-span-2">
                        Nome no cartão
                        <input
                          id="signup-cardholder-name"
                          autoComplete="cc-name"
                          className="mt-2 w-full rounded-xl border border-blue-100 bg-white px-4 py-3"
                        />
                      </label>

                      <label className="text-sm font-black">
                        Documento
                        <select
                          id="signup-identification-type"
                          className="mt-2 w-full rounded-xl border border-blue-100 bg-white px-4 py-3"
                        />
                      </label>

                      <label className="text-sm font-black">
                        CPF ou CNPJ
                        <input
                          id="signup-identification-number"
                          inputMode="numeric"
                          className="mt-2 w-full rounded-xl border border-blue-100 bg-white px-4 py-3"
                        />
                      </label>

                      <label className="text-sm font-black sm:col-span-2">
                        E-mail
                        <input
                          id="signup-cardholder-email"
                          type="email"
                          defaultValue={checkout.email}
                          className="mt-2 w-full rounded-xl border border-blue-100 bg-white px-4 py-3"
                        />
                      </label>
                    </div>

                    <select id="signup-issuer" className="hidden" />
                    <select id="signup-installments" className="hidden" />

                    <button
                      type="submit"
                      disabled={!cardReady || processing}
                      className="mt-5 w-full rounded-2xl bg-[#05245c] px-6 py-4 font-black text-white disabled:opacity-50"
                    >
                      {processing
                        ? "Confirmando..."
                        : cardReady
                          ? "Confirmar cartão e iniciar os 7 dias"
                          : "Carregando cartão..."}
                    </button>
                  </form>
                ) : null}
              </>
            ) : (
              <form
                onSubmit={createAccount}
                className="mt-7 rounded-[1.75rem] border border-emerald-100 bg-emerald-50/60 p-6"
              >
                <div className="flex items-center gap-3">
                  <div className="grid h-12 w-12 place-items-center rounded-full bg-emerald-100 text-2xl">
                    ✓
                  </div>
                  <div>
                    <h2 className="text-2xl font-black">Pagamento confirmado</h2>
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
                    onChange={(event) => setConfirmPassword(event.target.value)}
                    type="password"
                    placeholder="Confirme a senha"
                    className="rounded-2xl border border-emerald-200 bg-white px-4 py-4 font-bold"
                  />
                  <button
                    disabled={processing}
                    className="rounded-2xl bg-[#05245c] px-6 py-4 font-black text-white disabled:opacity-50"
                  >
                    {processing ? "Criando conta..." : "Criar conta"}
                  </button>
                </div>
              </form>
            )}
          </section>

          <aside className="h-fit rounded-[2rem] border border-blue-100 bg-white p-6 shadow-xl shadow-blue-950/5 lg:sticky lg:top-6">
            <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-400">
              Resumo
            </p>
            <h2 className="mt-3 text-2xl font-black">{checkout.plan.name}</h2>
            <p className="mt-2 text-sm font-semibold leading-6 text-slate-500">
              {checkout.plan.description}
            </p>

            <div className="mt-6 rounded-2xl bg-[#05245c] p-5 text-white">
              <p className="text-sm font-bold text-blue-100">Mensalidade</p>
              <p className="mt-1 text-3xl font-black">
                {money(checkout.plan.price)}
              </p>
              <p className="mt-1 text-xs font-bold text-blue-200">por mês</p>
            </div>

            <div className="mt-6 space-y-4 text-sm">
              <div className="flex justify-between gap-4">
                <span className="font-semibold text-slate-500">Empresa</span>
                <span className="text-right font-black">
                  {checkout.companyName}
                </span>
              </div>
              <div className="flex justify-between gap-4">
                <span className="font-semibold text-slate-500">Responsável</span>
                <span className="text-right font-black">
                  {checkout.responsibleName}
                </span>
              </div>
              <div className="flex justify-between gap-4">
                <span className="font-semibold text-slate-500">E-mail</span>
                <span className="break-all text-right font-black">
                  {checkout.email}
                </span>
              </div>
            </div>

            <div className="mt-6 rounded-2xl border border-blue-100 bg-blue-50 p-4">
              <p className="font-black text-[#05245c]">
                Oferta válida no cadastro
              </p>
              <p className="mt-2 text-sm font-semibold leading-6 text-slate-500">
                Cartão: 7 dias sem cobrança. Pix: 30 dias pagos + 7 dias adicionais no primeiro ciclo.
              </p>
            </div>
          </aside>
        </div>
      </div>
    </main>
  );
}

export default function SignupCheckout() {
  return (
    <Suspense
      fallback={
        <main className="grid min-h-screen place-items-center bg-[#f6f9ff] font-black text-[#05245c]">
          Carregando...
        </main>
      }
    >
      <CheckoutContent />
    </Suspense>
  );
}
