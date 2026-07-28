/* eslint-disable @typescript-eslint/no-explicit-any, @next/next/no-img-element */
"use client";

import Script from "next/script";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

type Option = {
  id: string;
  name: string;
  priceDelta?: number;
  price?: number;
};

type Product = {
  id: string;
  name: string;
  description: string;
  price: number;
  imageUrl: string;
  variations: Option[];
  addons: Option[];
};

type CartItem = {
  productId: string;
  quantity: number;
  variationId?: string;
  addonIds: string[];
  observation: string;
};

type CheckoutData = {
  company: {
    name: string;
    logoUrl: string;
    primaryColor: string;
    slug: string;
  };
  products: Product[];
  deliveryZones: Array<{
    id: string;
    name: string;
    fee: number;
    minimumOrder: number;
  }>;
  payment: {
    provider: "mercado_pago";
    configured: boolean;
    chargesEnabled: boolean;
    pixEnabled: boolean;
    cardEnabled: boolean;
    lastError?: string | null;
  };
};

type PixResult = {
  encodedImage?: string;
  payload?: string;
  ticketUrl?: string;
  expirationDate?: string;
};

function currency(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
}

function dateBR(value?: string | null) {
  if (!value) return "";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "";

  return date.toLocaleString("pt-BR");
}

function idempotencyKey() {
  return `${Date.now()}-${crypto.randomUUID()}`;
}

function friendlyStatus(value: string) {
  const normalized = String(value || "pending").toLowerCase();

  if (normalized === "paid") return "Pagamento aprovado";
  if (normalized === "failed") return "Pagamento recusado";
  if (normalized === "canceled") return "Pagamento cancelado";
  if (normalized === "refunded") return "Pagamento estornado";
  if (normalized === "charged_back") return "Pagamento contestado";

  return "Aguardando pagamento";
}

function safeRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  return value as Record<string, unknown>;
}

function normalizePaymentMethod(
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
    return "PIX" as const;
  }

  if (
    type === "debit_card" ||
    selected.includes("debit")
  ) {
    return "DEBIT_CARD" as const;
  }

  if (
    type === "credit_card" ||
    selected.includes("credit") ||
    selected.includes("card") ||
    formData.token
  ) {
    return "CREDIT_CARD" as const;
  }

  return null;
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

function BagIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      className="h-6 w-6"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <path d="M6 8h12l1 12H5L6 8Z" />
      <path d="M9 9V6a3 3 0 0 1 6 0v3" />
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

export default function CheckoutClient({
  slug,
}: {
  slug: string;
}) {
  const publicKey =
    process.env.NEXT_PUBLIC_MP_MARKETPLACE_PUBLIC_KEY || "";

  const brickControllerRef = useRef<any>(null);
  const processingRef = useRef(false);

  const [data, setData] = useState<CheckoutData | null>(null);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [sdkReady, setSdkReady] = useState(false);
  const [brickReady, setBrickReady] = useState(false);
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [paymentId, setPaymentId] = useState("");
  const [orderId, setOrderId] = useState("");
  const [paymentStatus, setPaymentStatus] = useState("");
  const [preparedTotal, setPreparedTotal] = useState<number | null>(null);
  const [pix, setPix] = useState<PixResult | null>(null);
  const [customer, setCustomer] = useState({
    name: "",
    email: "",
    phone: "",
    cpfCnpj: "",
    postalCode: "",
    addressNumber: "",
    addressComplement: "",
  });
  const [delivery, setDelivery] = useState({
    type: "pickup" as "pickup" | "delivery",
    zoneId: "",
    address: "",
    complement: "",
    reference: "",
  });
  const [couponCode, setCouponCode] = useState("");

  useEffect(() => {
    let active = true;

    fetch(`/api/checkout/${encodeURIComponent(slug)}`, {
      cache: "no-store",
    })
      .then(async (response) => {
        const payload = await response.json();

        if (!response.ok) {
          throw new Error(
            payload.error || "Não foi possível carregar o checkout.",
          );
        }

        return payload as CheckoutData;
      })
      .then((payload) => {
        if (!active) return;
        setData(payload);
      })
      .catch((cause) => {
        if (active) {
          setError(
            cause instanceof Error
              ? cause.message
              : "Não foi possível carregar o checkout.",
          );
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [slug]);

  useEffect(() => {
    if (!data) return;

    const key = `orcaly-checkout:${slug}`;
    const raw = window.sessionStorage.getItem(key);

    if (!raw) return;

    try {
      const parsed = JSON.parse(raw) as {
        items?: CartItem[];
        customer?: Partial<typeof customer>;
        delivery?: Partial<typeof delivery>;
        couponCode?: string;
      };

      const allowed = new Set(
        data.products.map((item) => item.id),
      );

      const imported = (parsed.items || [])
        .filter((item) => allowed.has(item.productId))
        .map((item) => ({
          productId: item.productId,
          quantity: Math.max(1, Number(item.quantity || 1)),
          variationId: item.variationId || undefined,
          addonIds: Array.isArray(item.addonIds)
            ? item.addonIds
            : [],
          observation: String(item.observation || ""),
        }));

      if (imported.length) setCart(imported);

      if (parsed.customer) {
        setCustomer((current) => ({
          ...current,
          ...parsed.customer,
        }));
      }

      if (parsed.delivery) {
        setDelivery((current) => ({
          ...current,
          ...parsed.delivery,
        }));
      }

      if (parsed.couponCode) {
        setCouponCode(parsed.couponCode);
      }

      window.sessionStorage.removeItem(key);
    } catch {
      window.sessionStorage.removeItem(key);
    }
  }, [data, slug]);

  useEffect(() => {
    if (!paymentId) return;

    const timer = window.setInterval(async () => {
      const response = await fetch(
        `/api/checkout/${encodeURIComponent(
          slug,
        )}/status?paymentId=${encodeURIComponent(paymentId)}`,
        { cache: "no-store" },
      );

      if (!response.ok) return;

      const payload = await response.json();
      const nextStatus = String(
        payload.status || payload.providerStatus || "",
      ).toLowerCase();

      setPaymentStatus(nextStatus);

      if (
        [
          "paid",
          "failed",
          "canceled",
          "refunded",
          "charged_back",
        ].includes(nextStatus)
      ) {
        window.clearInterval(timer);
      }
    }, 5000);

    return () => window.clearInterval(timer);
  }, [paymentId, slug]);

  const productMap = useMemo(
    () =>
      new Map(
        (data?.products || []).map((item) => [item.id, item]),
      ),
    [data],
  );

  const subtotal = useMemo(() => {
    return cart.reduce((total, item) => {
      const product = productMap.get(item.productId);

      if (!product) return total;

      const variation = product.variations.find(
        (option) => option.id === item.variationId,
      );
      const addons = product.addons.filter((option) =>
        item.addonIds.includes(option.id),
      );

      const unit =
        product.price +
        Number(variation?.priceDelta || 0) +
        addons.reduce(
          (sum, option) => sum + Number(option.price || 0),
          0,
        );

      return total + unit * item.quantity;
    }, 0);
  }, [cart, productMap]);

  const selectedZone = data?.deliveryZones.find(
    (zone) => zone.id === delivery.zoneId,
  );
  const estimatedTotal =
    subtotal +
    (delivery.type === "delivery"
      ? Number(selectedZone?.fee || 0)
      : 0);

  useEffect(() => {
    if (!data || cart.length === 0) {
      setPreparedTotal(null);
      return;
    }

    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      try {
        const response = await fetch(
          `/api/checkout/${encodeURIComponent(slug)}/prepare`,
          {
            method: "POST",
            headers: {
              "content-type": "application/json",
            },
            body: JSON.stringify({
              items: cart,
              delivery,
              couponCode,
            }),
            signal: controller.signal,
          },
        );
        const payload = await response.json().catch(() => ({}));

        if (!response.ok) {
          throw new Error(
            payload.error || "Não foi possível calcular o total.",
          );
        }

        setPreparedTotal(Number(payload.total || 0));
        setError("");
      } catch (cause) {
        if (
          cause instanceof DOMException &&
          cause.name === "AbortError"
        ) {
          return;
        }

        setPreparedTotal(null);
        setError(
          cause instanceof Error
            ? cause.message
            : "Não foi possível calcular o total.",
        );
      }
    }, 350);

    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [cart, couponCode, data, delivery, slug]);

  const finalPreviewTotal = preparedTotal ?? estimatedTotal;

  const submitPayment = useCallback(
    async (
      selectedPaymentMethod: unknown,
      formData: Record<string, unknown>,
    ) => {
      if (processingRef.current) return;

      processingRef.current = true;
      setProcessing(true);
      setError("");
      setNotice("Processando pagamento...");
      setPix(null);

      try {
        const paymentMethod = normalizePaymentMethod(
          selectedPaymentMethod,
          formData,
        );

        if (!paymentMethod) {
          throw new Error(
            "Escolha Pix, cartão de crédito ou débito.",
          );
        }

        const payer = safeRecord(formData.payer);
        const identification = safeRecord(payer.identification);
        const customerPayload = {
          ...customer,
          email: String(
            payer.email || customer.email || "",
          ).trim(),
          cpfCnpj: String(
            identification.number || customer.cpfCnpj || "",
          ).trim(),
        };

        const response = await fetch(
          `/api/checkout/${encodeURIComponent(slug)}`,
          {
            method: "POST",
            headers: {
              "content-type": "application/json",
              "idempotency-key": idempotencyKey(),
            },
            body: JSON.stringify({
              items: cart,
              customer: customerPayload,
              delivery,
              couponCode,
              paymentMethod,
              paymentFormData: {
                ...formData,
                selected_payment_method:
                  selectedPaymentMethod || "",
              },
            }),
          },
        );
        const payload = await response.json().catch(() => ({}));

        if (!response.ok) {
          throw new Error(
            payload.error || "Não foi possível criar o pagamento.",
          );
        }

        const nextStatus = String(
          payload.status || "pending",
        ).toLowerCase();

        setPaymentStatus(nextStatus);
        setPaymentId(String(payload.paymentId || ""));
        setOrderId(String(payload.orderId || ""));
        setPix(payload.pix || null);
        setNotice(
          nextStatus === "paid"
            ? "Pagamento aprovado. O pedido foi enviado."
            : paymentMethod === "PIX"
              ? "Pix gerado."
              : "Pagamento enviado para análise.",
        );
      } catch (cause) {
        setNotice("");
        setError(
          cause instanceof Error
            ? cause.message
            : "Não foi possível criar o pagamento.",
        );
        throw cause;
      } finally {
        processingRef.current = false;
        setProcessing(false);
      }
    },
    [
      cart,
      couponCode,
      customer,
      delivery,
      slug,
    ],
  );

  useEffect(() => {
    if (
      !paymentOpen ||
      !sdkReady ||
      !publicKey ||
      !data?.payment.chargesEnabled ||
      cart.length === 0 ||
      finalPreviewTotal <= 0 ||
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
        "marketplace_payment_brick",
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
        "marketplace_payment_brick",
        {
          initialization: {
            amount: finalPreviewTotal,
            payer: {
              email: customer.email,
            },
          },
          customization: {
            paymentMethods: {
              creditCard: "all",
              debitCard: "all",
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
              console.error(
                "marketplace_payment_brick_error",
                brickError,
              );

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
    cart.length,
    customer.email,
    data?.payment.chargesEnabled,
    finalPreviewTotal,
    paymentOpen,
    pix,
    publicKey,
    sdkReady,
    submitPayment,
  ]);

  function validateBeforePayment() {
    if (!cart.length) {
      setError("Adicione pelo menos um produto ao carrinho.");
      return false;
    }

    if (
      !customer.name.trim() ||
      !customer.email.trim() ||
      !customer.phone.trim() ||
      !customer.cpfCnpj.trim()
    ) {
      setError(
        "Preencha nome, e-mail, telefone e CPF ou CNPJ.",
      );
      return false;
    }

    if (!customer.email.includes("@")) {
      setError("Informe um e-mail válido.");
      return false;
    }

    if (
      delivery.type === "delivery" &&
      (!delivery.zoneId || !delivery.address.trim())
    ) {
      setError("Escolha a região e informe o endereço.");
      return false;
    }

    if (!data?.payment.chargesEnabled) {
      setError(
        "Esta empresa ainda não ativou os pagamentos online.",
      );
      return false;
    }

    setError("");
    return true;
  }

  function openPayment() {
    if (!validateBeforePayment()) return;

    setNotice("");
    setPix(null);
    setPaymentStatus("");
    setPaymentId("");
    setOrderId("");
    setPaymentOpen(true);
  }

  function addProduct(productId: string) {
    setPaymentOpen(false);
    setPix(null);

    setCart((current) => {
      const existing = current.find(
        (item) => item.productId === productId,
      );

      if (existing) {
        return current.map((item) =>
          item.productId === productId
            ? {
                ...item,
                quantity: item.quantity + 1,
              }
            : item,
        );
      }

      return [
        ...current,
        {
          productId,
          quantity: 1,
          addonIds: [],
          observation: "",
        },
      ];
    });
  }

  function updateCart(
    productId: string,
    patch: Partial<CartItem>,
  ) {
    setPaymentOpen(false);
    setPix(null);

    setCart((current) =>
      current
        .map((item) =>
          item.productId === productId
            ? {
                ...item,
                ...patch,
              }
            : item,
        )
        .filter((item) => item.quantity > 0),
    );
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-[#f5f7fb] p-4 sm:p-6">
        <div className="mx-auto grid max-w-6xl animate-pulse gap-6 lg:grid-cols-[1fr_360px]">
          <div className="h-[720px] rounded-[2rem] bg-white" />
          <div className="h-[520px] rounded-[2rem] bg-white" />
        </div>
      </main>
    );
  }

  if (!data) {
    return (
      <main className="grid min-h-screen place-items-center bg-[#f5f7fb] p-4">
        <div className="w-full max-w-xl rounded-[2rem] border border-red-100 bg-white p-8 text-center shadow-xl">
          <h1 className="text-2xl font-black">
            Checkout indisponível
          </h1>
          <p className="mt-3 font-semibold text-slate-500">
            {error || "Tente novamente em alguns minutos."}
          </p>
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
          <div className="flex min-w-0 items-center gap-4">
            {data.company.logoUrl ? (
              <img
                src={data.company.logoUrl}
                alt={data.company.name}
                className="h-14 w-14 rounded-2xl border border-white/20 bg-white object-cover"
              />
            ) : (
              <div className="grid h-14 w-14 place-items-center rounded-2xl bg-white/10 text-xl font-black">
                {data.company.name.slice(0, 1)}
              </div>
            )}

            <div className="min-w-0">
              <p className="text-xs font-black uppercase tracking-[0.18em] text-blue-200">
                Checkout seguro
              </p>
              <h1 className="mt-2 break-words text-3xl font-black tracking-[-0.04em]">
                {data.company.name}
              </h1>
              <p className="mt-2 text-sm font-semibold text-blue-100">
                Revise o pedido e pague sem sair desta página.
              </p>
            </div>
          </div>
        </header>

        {!data.payment.chargesEnabled ? (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-amber-900">
            <p className="font-black">Pagamentos ainda não disponíveis</p>
            <p className="mt-2 text-sm font-semibold leading-6">
              Esta loja precisa conectar uma conta Mercado Pago antes de receber pedidos pelo marketplace.
            </p>
          </div>
        ) : null}

        {error ? (
          <div
            role="alert"
            className="rounded-2xl border border-red-100 bg-red-50 p-4 font-bold text-red-700"
          >
            {error}
          </div>
        ) : null}

        {notice ? (
          <div
            aria-live="polite"
            className="rounded-2xl border border-emerald-100 bg-emerald-50 p-4 font-bold text-emerald-700"
          >
            {notice}
          </div>
        ) : null}

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
          <section className="min-w-0 space-y-6">
            <section className="rounded-[2rem] border border-slate-200 bg-white p-5 shadow-xl shadow-slate-900/5 sm:p-7">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-sm font-black text-[#009ee3]">
                    Catálogo
                  </p>
                  <h2 className="mt-1 text-2xl font-black">
                    Escolha seus produtos
                  </h2>
                </div>
                <span className="grid h-12 w-12 place-items-center rounded-2xl bg-[#eef9fe] text-[#009ee3]">
                  <BagIcon />
                </span>
              </div>

              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                {data.products.map((product) => (
                  <button
                    key={product.id}
                    type="button"
                    onClick={() => addProduct(product.id)}
                    className="min-w-0 rounded-2xl border border-slate-200 p-4 text-left transition hover:border-[#009ee3] hover:bg-[#f7fcff] active:scale-[0.99]"
                  >
                    <div className="flex gap-3">
                      {product.imageUrl ? (
                        <img
                          src={product.imageUrl}
                          alt=""
                          className="h-16 w-16 shrink-0 rounded-xl object-cover"
                        />
                      ) : null}
                      <div className="min-w-0">
                        <div className="break-words font-black">
                          {product.name}
                        </div>
                        <div className="mt-1 line-clamp-2 text-sm font-semibold text-slate-500">
                          {product.description}
                        </div>
                        <div className="mt-3 font-black text-[#009ee3]">
                          {currency(product.price)}
                        </div>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </section>

            {cart.length > 0 ? (
              <section className="rounded-[2rem] border border-slate-200 bg-white p-5 shadow-xl shadow-slate-900/5 sm:p-7">
                <p className="text-sm font-black text-[#009ee3]">
                  Carrinho
                </p>
                <h2 className="mt-1 text-2xl font-black">
                  Revise os itens
                </h2>

                <div className="mt-5 space-y-4">
                  {cart.map((item) => {
                    const product = productMap.get(item.productId);

                    if (!product) return null;

                    return (
                      <article
                        key={item.productId}
                        className="rounded-2xl border border-slate-200 p-4"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <div className="font-black">
                            {product.name}
                          </div>

                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              aria-label="Diminuir quantidade"
                              onClick={() =>
                                updateCart(item.productId, {
                                  quantity: item.quantity - 1,
                                })
                              }
                              className="h-10 w-10 rounded-xl border border-slate-200 font-black"
                            >
                              -
                            </button>
                            <span className="min-w-8 text-center font-black">
                              {item.quantity}
                            </span>
                            <button
                              type="button"
                              aria-label="Aumentar quantidade"
                              onClick={() =>
                                updateCart(item.productId, {
                                  quantity: item.quantity + 1,
                                })
                              }
                              className="h-10 w-10 rounded-xl border border-slate-200 font-black"
                            >
                              +
                            </button>
                          </div>
                        </div>

                        {product.variations.length > 0 ? (
                          <label className="mt-4 block text-sm font-bold">
                            Variação
                            <select
                              value={item.variationId || ""}
                              onChange={(event) =>
                                updateCart(item.productId, {
                                  variationId:
                                    event.target.value || undefined,
                                })
                              }
                              className="mt-2 w-full rounded-xl border border-slate-300 p-3"
                            >
                              <option value="">Padrão</option>
                              {product.variations.map((option) => (
                                <option
                                  key={option.id}
                                  value={option.id}
                                >
                                  {option.name}
                                  {option.priceDelta
                                    ? ` (+${currency(
                                        option.priceDelta,
                                      )})`
                                    : ""}
                                </option>
                              ))}
                            </select>
                          </label>
                        ) : null}

                        {product.addons.length > 0 ? (
                          <fieldset className="mt-4">
                            <legend className="text-sm font-bold">
                              Adicionais
                            </legend>
                            <div className="mt-2 grid gap-2 sm:grid-cols-2">
                              {product.addons.map((option) => (
                                <label
                                  key={option.id}
                                  className="flex items-center gap-2 rounded-xl border border-slate-200 p-3 text-sm"
                                >
                                  <input
                                    type="checkbox"
                                    checked={item.addonIds.includes(
                                      option.id,
                                    )}
                                    onChange={(event) => {
                                      const next = event.target.checked
                                        ? [...item.addonIds, option.id]
                                        : item.addonIds.filter(
                                            (id) => id !== option.id,
                                          );

                                      updateCart(item.productId, {
                                        addonIds: next,
                                      });
                                    }}
                                  />
                                  <span className="min-w-0 break-words">
                                    {option.name}{" "}
                                    {option.price
                                      ? `(+${currency(option.price)})`
                                      : ""}
                                  </span>
                                </label>
                              ))}
                            </div>
                          </fieldset>
                        ) : null}

                        <textarea
                          value={item.observation}
                          onChange={(event) =>
                            updateCart(item.productId, {
                              observation: event.target.value,
                            })
                          }
                          placeholder="Observação do item"
                          className="mt-4 min-h-20 w-full rounded-xl border border-slate-300 p-3"
                        />
                      </article>
                    );
                  })}
                </div>
              </section>
            ) : null}

            <section className="rounded-[2rem] border border-slate-200 bg-white p-5 shadow-xl shadow-slate-900/5 sm:p-7">
              <p className="text-sm font-black text-[#009ee3]">
                Seus dados
              </p>
              <h2 className="mt-1 text-2xl font-black">
                Identificação
              </h2>

              <div className="mt-5 grid gap-4 sm:grid-cols-2">
                {[
                  ["name", "Nome", "text"],
                  ["email", "E-mail", "email"],
                  ["phone", "Telefone", "tel"],
                  ["cpfCnpj", "CPF ou CNPJ", "text"],
                  ["postalCode", "CEP", "text"],
                  ["addressNumber", "Número", "text"],
                ].map(([key, label, type]) => (
                  <label key={key} className="text-sm font-bold">
                    {label}
                    <input
                      type={type}
                      value={
                        customer[
                          key as keyof typeof customer
                        ]
                      }
                      onChange={(event) => {
                        setPaymentOpen(false);
                        setPix(null);
                        setCustomer((current) => ({
                          ...current,
                          [key]: event.target.value,
                        }));
                      }}
                      className="mt-2 w-full rounded-xl border border-slate-300 p-3 outline-none focus:border-[#009ee3] focus:ring-4 focus:ring-[#009ee3]/10"
                    />
                  </label>
                ))}
              </div>
            </section>

            <section className="rounded-[2rem] border border-slate-200 bg-white p-5 shadow-xl shadow-slate-900/5 sm:p-7">
              <p className="text-sm font-black text-[#009ee3]">
                Recebimento
              </p>
              <h2 className="mt-1 text-2xl font-black">
                Entrega ou retirada
              </h2>

              <div className="mt-5 flex flex-wrap gap-2">
                {(["pickup", "delivery"] as const).map((type) => (
                  <button
                    key={type}
                    type="button"
                    onClick={() => {
                      setPaymentOpen(false);
                      setPix(null);
                      setDelivery((current) => ({
                        ...current,
                        type,
                      }));
                    }}
                    className={`rounded-xl border px-4 py-3 font-bold ${
                      delivery.type === type
                        ? "border-[#009ee3] bg-[#eef9fe] text-[#007eb5]"
                        : "border-slate-200"
                    }`}
                  >
                    {type === "pickup" ? "Retirada" : "Entrega"}
                  </button>
                ))}
              </div>

              {delivery.type === "delivery" ? (
                <div className="mt-4 grid gap-4 sm:grid-cols-2">
                  <label className="text-sm font-bold sm:col-span-2">
                    Região
                    <select
                      value={delivery.zoneId}
                      onChange={(event) => {
                        setPaymentOpen(false);
                        setPix(null);
                        setDelivery((current) => ({
                          ...current,
                          zoneId: event.target.value,
                        }));
                      }}
                      className="mt-2 w-full rounded-xl border border-slate-300 p-3"
                    >
                      <option value="">Selecione</option>
                      {data.deliveryZones.map((zone) => (
                        <option key={zone.id} value={zone.id}>
                          {zone.name} - {currency(zone.fee)}
                        </option>
                      ))}
                    </select>
                  </label>

                  {[
                    ["address", "Endereço"],
                    ["complement", "Complemento"],
                    ["reference", "Referência"],
                  ].map(([key, label]) => (
                    <label key={key} className="text-sm font-bold">
                      {label}
                      <input
                        value={
                          delivery[
                            key as keyof typeof delivery
                          ]
                        }
                        onChange={(event) => {
                          setPaymentOpen(false);
                          setPix(null);
                          setDelivery((current) => ({
                            ...current,
                            [key]: event.target.value,
                          }));
                        }}
                        className="mt-2 w-full rounded-xl border border-slate-300 p-3"
                      />
                    </label>
                  ))}
                </div>
              ) : null}
            </section>

            <section className="rounded-[2rem] border border-slate-200 bg-white p-5 shadow-xl shadow-slate-900/5 sm:p-7">
              <div className="flex flex-col gap-4 border-b border-slate-100 pb-5 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="text-sm font-black text-[#009ee3]">
                    Pagamento
                  </p>
                  <h2 className="mt-1 text-2xl font-black">
                    {pix
                      ? "Pix gerado"
                      : paymentOpen
                        ? "Escolha como pagar"
                        : "Finalize o pedido"}
                  </h2>
                </div>

                {paymentOpen && !pix ? (
                  <button
                    type="button"
                    onClick={() => {
                      setPaymentOpen(false);
                      setNotice("");
                      setError("");
                    }}
                    className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-black text-slate-600"
                  >
                    Fechar
                  </button>
                ) : null}
              </div>

              {pix ? (
                <div className="mt-6 rounded-[1.75rem] border border-emerald-100 bg-emerald-50/60 p-5 text-center sm:p-7">
                  <div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-emerald-100 text-emerald-700">
                    <PixIcon />
                  </div>
                  <h3 className="mt-4 text-2xl font-black">
                    Pix pronto
                  </h3>
                  <p className="mt-2 text-sm font-semibold text-slate-500">
                    Escaneie o QR Code ou copie o código.
                  </p>

                  {pix.encodedImage ? (
                    <img
                      src={`data:image/png;base64,${pix.encodedImage}`}
                      alt="QR Code Pix"
                      className="mx-auto mt-5 h-64 w-64 rounded-3xl bg-white p-3 shadow-lg"
                    />
                  ) : null}

                  {pix.payload ? (
                    <>
                      <textarea
                        readOnly
                        value={pix.payload}
                        className="mt-5 min-h-24 w-full rounded-2xl border border-emerald-200 bg-white p-4 text-xs"
                      />
                      <button
                        type="button"
                        onClick={() =>
                          navigator.clipboard.writeText(
                            pix.payload || "",
                          )
                        }
                        className="mt-3 rounded-2xl bg-emerald-600 px-6 py-3 font-black text-white"
                      >
                        Copiar código Pix
                      </button>
                    </>
                  ) : null}

                  <p className="mt-4 text-sm font-bold text-slate-500">
                    {friendlyStatus(paymentStatus)}
                  </p>

                  {pix.expirationDate ? (
                    <p className="mt-1 text-xs font-semibold text-slate-400">
                      Expira em {dateBR(pix.expirationDate)}
                    </p>
                  ) : null}
                </div>
              ) : !paymentOpen ? (
                <div className="mt-6 grid gap-4 sm:grid-cols-2">
                  <button
                    type="button"
                    onClick={openPayment}
                    disabled={!data.payment.chargesEnabled}
                    className="rounded-[1.5rem] border border-slate-200 p-5 text-left transition hover:border-[#009ee3] hover:bg-[#f7fcff] disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <div className="flex items-center justify-between">
                      <span className="grid h-12 w-12 place-items-center rounded-2xl bg-[#eef9fe] text-[#009ee3]">
                        <PixIcon />
                      </span>
                      <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-black text-slate-600">
                        Pix e cartões
                      </span>
                    </div>
                    <h3 className="mt-5 text-xl font-black">
                      Ir para o pagamento
                    </h3>
                    <p className="mt-2 text-sm font-semibold leading-6 text-slate-500">
                      Pix, crédito ou débito pelo Mercado Pago.
                    </p>
                  </button>

                  <div className="rounded-[1.5rem] border border-slate-200 bg-slate-50 p-5">
                    <div className="flex items-center gap-3 text-[#009ee3]">
                      <ShieldIcon />
                      <p className="font-black">Pagamento protegido</p>
                    </div>
                    <p className="mt-3 text-sm font-semibold leading-6 text-slate-500">
                      Os dados do cartão não são armazenados pelo Orçaly.
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

                  {!publicKey ? (
                    <div className="rounded-2xl bg-amber-50 p-4 font-bold text-amber-800">
                      A chave pública do Mercado Pago não está configurada.
                    </div>
                  ) : !data.payment.chargesEnabled ? (
                    <div className="rounded-2xl bg-amber-50 p-4 font-bold text-amber-800">
                      Esta empresa ainda não ativou os pagamentos online.
                    </div>
                  ) : (
                    <>
                      {!brickReady ? (
                        <div className="mb-4 rounded-2xl bg-slate-50 p-4 text-center font-bold text-slate-500">
                          Carregando pagamento...
                        </div>
                      ) : null}
                      <div
                        id="marketplace_payment_brick"
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
            </section>
          </section>

          <aside className="min-w-0 space-y-5 lg:sticky lg:top-6 lg:h-fit">
            <div className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-xl shadow-slate-900/5">
              <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-400">
                Resumo do pedido
              </p>

              <div className="mt-5 space-y-3">
                {cart.length === 0 ? (
                  <p className="rounded-2xl bg-slate-50 p-4 text-sm font-semibold text-slate-500">
                    Seu carrinho está vazio.
                  </p>
                ) : (
                  cart.map((item) => {
                    const product = productMap.get(item.productId);

                    if (!product) return null;

                    return (
                      <div
                        key={item.productId}
                        className="flex min-w-0 justify-between gap-3 text-sm"
                      >
                        <span className="min-w-0 break-words">
                          {item.quantity}x {product.name}
                        </span>
                        <span className="shrink-0 font-bold">
                          {currency(product.price * item.quantity)}
                        </span>
                      </div>
                    );
                  })
                )}
              </div>

              <label className="mt-5 block text-sm font-bold">
                Cupom
                <input
                  value={couponCode}
                  onChange={(event) => {
                    setPaymentOpen(false);
                    setPix(null);
                    setCouponCode(event.target.value);
                  }}
                  className="mt-2 w-full rounded-xl border border-slate-300 p-3"
                />
              </label>

              <div className="mt-5 border-t border-slate-200 pt-4">
                <div className="flex justify-between text-sm">
                  <span>Subtotal estimado</span>
                  <span>{currency(subtotal)}</span>
                </div>

                {delivery.type === "delivery" ? (
                  <div className="mt-2 flex justify-between text-sm">
                    <span>Entrega</span>
                    <span>
                      {currency(Number(selectedZone?.fee || 0))}
                    </span>
                  </div>
                ) : null}

                <div className="mt-4 flex justify-between text-lg font-black">
                  <span>Total</span>
                  <span>{currency(finalPreviewTotal)}</span>
                </div>

                <p className="mt-3 text-xs font-semibold text-slate-500">
                  O valor final é recalculado no servidor.
                </p>
              </div>

              {!paymentOpen && !pix ? (
                <button
                  type="button"
                  onClick={openPayment}
                  disabled={
                    cart.length === 0 ||
                    !data.payment.chargesEnabled
                  }
                  className="mt-5 w-full rounded-2xl bg-[#009ee3] px-5 py-4 font-black text-white transition hover:bg-[#008bc8] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {data.payment.chargesEnabled
                    ? "Pagar " + currency(finalPreviewTotal)
                    : "Pagamento indisponível"}
                </button>
              ) : null}

              {orderId ? (
                <p className="mt-4 text-center text-xs font-semibold text-slate-500">
                  Pedido {orderId}
                </p>
              ) : null}
            </div>

            <div className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-xl shadow-slate-900/5">
              <div className="flex items-center gap-3 text-[#009ee3]">
                <ShieldIcon />
                <p className="font-black">Compra segura</p>
              </div>
              <p className="mt-3 text-sm font-semibold leading-6 text-slate-500">
                Pagamento processado pelo Mercado Pago.
              </p>
            </div>
          </aside>
        </div>
      </div>
    </main>
  );
}
