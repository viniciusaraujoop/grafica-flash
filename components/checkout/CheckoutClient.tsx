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

function currency(value: number) {
  return new Intl.NumberFormat(
    "pt-BR",
    {
      style: "currency",
      currency: "BRL",
    },
  ).format(value);
}

function idempotencyKey() {
  return `${Date.now()}-${crypto.randomUUID()}`;
}

function friendlyStatus(value: string) {
  const normalized = String(
    value || "pending",
  ).toLowerCase();

  if (normalized === "paid") {
    return "Pagamento aprovado";
  }

  if (normalized === "failed") {
    return "Pagamento recusado";
  }

  if (normalized === "canceled") {
    return "Pagamento cancelado";
  }

  if (normalized === "refunded") {
    return "Pagamento estornado";
  }

  if (normalized === "charged_back") {
    return "Pagamento contestado";
  }

  return "Aguardando pagamento";
}

export default function CheckoutClient({
  slug,
}: {
  slug: string;
}) {
  const publicKey =
    process.env
      .NEXT_PUBLIC_MERCADO_PAGO_PUBLIC_KEY ||
    "";
  const cardFormRef =
    useRef<any>(null);
  const createPaymentRef =
    useRef<
      | ((
          cardPayment?: Record<
            string,
            unknown
          >,
        ) => Promise<void>)
      | null
    >(null);
  const processingRef =
    useRef(false);
  const [data, setData] =
    useState<CheckoutData | null>(null);
  const [cart, setCart] =
    useState<CartItem[]>([]);
  const [loading, setLoading] =
    useState(true);
  const [processing, setProcessing] =
    useState(false);
  const [sdkReady, setSdkReady] =
    useState(false);
  const [cardReady, setCardReady] =
    useState(false);
  const [error, setError] =
    useState("");
  const [notice, setNotice] =
    useState("");
  const [paymentId, setPaymentId] =
    useState("");
  const [
    paymentStatus,
    setPaymentStatus,
  ] = useState("");
  const [preparedTotal, setPreparedTotal] =
    useState<number | null>(null);
  const [pix, setPix] = useState<{
    encodedImage?: string;
    payload?: string;
    ticketUrl?: string;
    expirationDate?: string;
  } | null>(null);
  const [customer, setCustomer] =
    useState({
      name: "",
      email: "",
      phone: "",
      cpfCnpj: "",
      postalCode: "",
      addressNumber: "",
      addressComplement: "",
    });
  const [delivery, setDelivery] =
    useState({
      type: "pickup" as
        | "pickup"
        | "delivery",
      zoneId: "",
      address: "",
      complement: "",
      reference: "",
    });
  const [
    couponCode,
    setCouponCode,
  ] = useState("");
  const [
    paymentMethod,
    setPaymentMethod,
  ] = useState<
    "PIX" | "CREDIT_CARD"
  >("PIX");

  useEffect(() => {
    let active = true;

    fetch(
      `/api/checkout/${encodeURIComponent(slug)}`,
      { cache: "no-store" },
    )
      .then(async (response) => {
        const payload =
          await response.json();

        if (!response.ok) {
          throw new Error(
            payload.error ||
              "Não foi possível carregar o checkout.",
          );
        }

        return payload as CheckoutData;
      })
      .then((payload) => {
        if (!active) return;

        setData(payload);

        if (
          !payload.payment.pixEnabled &&
          payload.payment.cardEnabled
        ) {
          setPaymentMethod(
            "CREDIT_CARD",
          );
        }
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

    const key =
      `orcaly-checkout:${slug}`;
    const raw =
      window.sessionStorage.getItem(
        key,
      );

    if (!raw) return;

    try {
      const parsed = JSON.parse(
        raw,
      ) as {
        items?: CartItem[];
        customer?: Partial<
          typeof customer
        >;
        delivery?: Partial<
          typeof delivery
        >;
        couponCode?: string;
      };

      const allowed = new Set(
        data.products.map(
          (item) => item.id,
        ),
      );

      const imported = (
        parsed.items || []
      )
        .filter((item) =>
          allowed.has(
            item.productId,
          ),
        )
        .map((item) => ({
          productId:
            item.productId,
          quantity: Math.max(
            1,
            Number(
              item.quantity || 1,
            ),
          ),
          variationId:
            item.variationId ||
            undefined,
          addonIds:
            Array.isArray(
              item.addonIds,
            )
              ? item.addonIds
              : [],
          observation: String(
            item.observation || "",
          ),
        }));

      if (imported.length) {
        setCart(imported);
      }

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
        setCouponCode(
          parsed.couponCode,
        );
      }

      window.sessionStorage.removeItem(
        key,
      );
    } catch {
      window.sessionStorage.removeItem(
        key,
      );
    }
  }, [data, slug]);

  useEffect(() => {
    if (!paymentId) return;

    const timer =
      window.setInterval(
        async () => {
          const response = await fetch(
            `/api/checkout/${encodeURIComponent(slug)}/status?paymentId=${encodeURIComponent(paymentId)}`,
            { cache: "no-store" },
          );

          if (!response.ok) return;

          const payload =
            await response.json();
          const nextStatus = String(
            payload.status ||
              payload.providerStatus ||
              "",
          ).toLowerCase();

          setPaymentStatus(
            nextStatus,
          );

          if (
            [
              "paid",
              "failed",
              "canceled",
              "refunded",
              "charged_back",
            ].includes(nextStatus)
          ) {
            window.clearInterval(
              timer,
            );
          }
        },
        5000,
      );

    return () =>
      window.clearInterval(timer);
  }, [paymentId, slug]);

  const productMap = useMemo(
    () =>
      new Map(
        (data?.products || []).map(
          (item) => [
            item.id,
            item,
          ],
        ),
      ),
    [data],
  );

  const subtotal = useMemo(() => {
    return cart.reduce(
      (total, item) => {
        const product =
          productMap.get(
            item.productId,
          );

        if (!product) return total;

        const variation =
          product.variations.find(
            (option) =>
              option.id ===
              item.variationId,
          );

        const addons =
          product.addons.filter(
            (option) =>
              item.addonIds.includes(
                option.id,
              ),
          );

        const unit =
          product.price +
          Number(
            variation?.priceDelta ||
              0,
          ) +
          addons.reduce(
            (sum, option) =>
              sum +
              Number(
                option.price || 0,
              ),
            0,
          );

        return (
          total +
          unit * item.quantity
        );
      },
      0,
    );
  }, [cart, productMap]);

  const selectedZone =
    data?.deliveryZones.find(
      (zone) =>
        zone.id ===
        delivery.zoneId,
    );

  const estimatedTotal =
    subtotal +
    (delivery.type === "delivery"
      ? Number(
          selectedZone?.fee || 0,
        )
      : 0);

  useEffect(() => {
    if (
      !data ||
      cart.length === 0
    ) {
      setPreparedTotal(null);
      return;
    }

    const controller =
      new AbortController();

    const timer = window.setTimeout(
      async () => {
        try {
          const response = await fetch(
            `/api/checkout/${encodeURIComponent(slug)}/prepare`,
            {
              method: "POST",
              headers: {
                "content-type":
                  "application/json",
              },
              body: JSON.stringify({
                items: cart,
                delivery,
                couponCode,
              }),
              signal:
                controller.signal,
            },
          );

          const payload =
            await response
              .json()
              .catch(() => ({}));

          if (!response.ok) {
            throw new Error(
              payload.error ||
                "Não foi possível calcular o total.",
            );
          }

          setPreparedTotal(
            Number(
              payload.total || 0,
            ),
          );
          setError("");
        } catch (cause) {
          if (
            cause instanceof DOMException &&
            cause.name ===
              "AbortError"
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
      },
      350,
    );

    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [
    cart,
    couponCode,
    data,
    delivery,
    slug,
  ]);

  const finalPreviewTotal =
    preparedTotal ??
    estimatedTotal;

  const createPayment = useCallback(
    async (
      cardPayment?: Record<
        string,
        unknown
      >,
    ) => {
      if (
        processingRef.current
      ) {
        return;
      }

      processingRef.current = true;
      setProcessing(true);
      setError("");
      setNotice(
        paymentMethod === "PIX"
          ? "Gerando seu Pix..."
          : "Processando o cartão com segurança...",
      );
      setPix(null);

      try {
        const response = await fetch(
          `/api/checkout/${encodeURIComponent(slug)}`,
          {
            method: "POST",
            headers: {
              "content-type":
                "application/json",
              "idempotency-key":
                idempotencyKey(),
            },
            body: JSON.stringify({
              items: cart,
              customer,
              delivery,
              couponCode,
              paymentMethod,
              cardPayment,
            }),
          },
        );

        const payload =
          await response
            .json()
            .catch(() => ({}));

        if (!response.ok) {
          throw new Error(
            payload.error ||
              "Não foi possível criar o pagamento.",
          );
        }

        const nextStatus =
          String(
            payload.status ||
              "pending",
          ).toLowerCase();

        setPaymentStatus(
          nextStatus,
        );
        setPaymentId(
          String(
            payload.paymentId || "",
          ),
        );
        setPix(payload.pix || null);
        setNotice(
          nextStatus === "paid"
            ? "Pagamento aprovado. O pedido já foi enviado para a empresa."
            : paymentMethod === "PIX"
              ? "Pix gerado. O status será atualizado automaticamente."
              : "Pagamento enviado para análise.",
        );
      } catch (cause) {
        setNotice("");
        setError(
          cause instanceof Error
            ? cause.message
            : "Não foi possível criar o pagamento.",
        );
      } finally {
        processingRef.current =
          false;
        setProcessing(false);
      }
    },
    [
      cart,
      couponCode,
      customer,
      delivery,
      paymentMethod,
      slug,
    ],
  );

  useEffect(() => {
    createPaymentRef.current =
      createPayment;
  }, [createPayment]);

  useEffect(() => {
    if (
      !sdkReady ||
      !publicKey ||
      !data?.payment.cardEnabled ||
      paymentMethod !==
        "CREDIT_CARD" ||
      cart.length === 0 ||
      finalPreviewTotal <= 0
    ) {
      return;
    }

    const MercadoPagoConstructor = (
      window as unknown as {
        MercadoPago?: new (
          key: string,
          options?: Record<
            string,
            unknown
          >,
        ) => any;
      }
    ).MercadoPago;

    if (
      !MercadoPagoConstructor
    ) {
      return;
    }

    setCardReady(false);

    const mercadoPago =
      new MercadoPagoConstructor(
        publicKey,
        { locale: "pt-BR" },
      );

    const cardForm =
      mercadoPago.cardForm({
        amount:
          finalPreviewTotal.toFixed(
            2,
          ),
        iframe: true,
        form: {
          id: "orcaly-marketplace-card-form",
          cardNumber: {
            id: "orcaly-marketplace-card-number",
            placeholder:
              "Número do cartão",
          },
          expirationDate: {
            id: "orcaly-marketplace-expiration-date",
            placeholder: "MM/AA",
          },
          securityCode: {
            id: "orcaly-marketplace-security-code",
            placeholder: "CVV",
          },
          cardholderName: {
            id: "orcaly-marketplace-cardholder-name",
            placeholder:
              "Nome no cartão",
          },
          issuer: {
            id: "orcaly-marketplace-issuer",
            placeholder:
              "Banco emissor",
          },
          installments: {
            id: "orcaly-marketplace-installments",
            placeholder: "Parcelas",
          },
          identificationType: {
            id: "orcaly-marketplace-identification-type",
            placeholder:
              "Tipo de documento",
          },
          identificationNumber: {
            id: "orcaly-marketplace-identification-number",
            placeholder:
              "CPF ou CNPJ",
          },
          cardholderEmail: {
            id: "orcaly-marketplace-cardholder-email",
            placeholder: "E-mail",
          },
        },
        callbacks: {
          onFormMounted: (
            formError: unknown,
          ) => {
            if (formError) {
              setError(
                "Não foi possível carregar os campos seguros do cartão.",
              );
              return;
            }

            setCardReady(true);
          },
          onSubmit: (
            event: Event,
          ) => {
            event.preventDefault();

            const formData =
              cardForm.getCardFormData();

            void createPaymentRef.current?.({
              token:
                formData.token,
              paymentMethodId:
                formData.paymentMethodId,
              issuerId:
                formData.issuerId,
              installments:
                Number(
                  formData.installments ||
                    1,
                ),
              identificationType:
                formData.identificationType,
              identificationNumber:
                formData.identificationNumber,
            });
          },
          onFetching: () => {
            setNotice(
              "Validando os dados do cartão...",
            );

            return () => undefined;
          },
        },
      });

    cardFormRef.current =
      cardForm;

    return () => {
      setCardReady(false);

      if (
        typeof cardFormRef.current
          ?.unmount === "function"
      ) {
        cardFormRef.current.unmount();
      }

      cardFormRef.current =
        null;
    };
  }, [
    cart.length,
    data?.payment.cardEnabled,
    finalPreviewTotal,
    paymentMethod,
    publicKey,
    sdkReady,
  ]);

  function addProduct(
    productId: string,
  ) {
    setCart((current) => {
      const existing =
        current.find(
          (item) =>
            item.productId ===
            productId,
        );

      if (existing) {
        return current.map(
          (item) =>
            item.productId ===
            productId
              ? {
                  ...item,
                  quantity:
                    item.quantity + 1,
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
    setCart((current) =>
      current
        .map((item) =>
          item.productId ===
          productId
            ? {
                ...item,
                ...patch,
              }
            : item,
        )
        .filter(
          (item) =>
            item.quantity > 0,
        ),
    );
  }

  if (loading) {
    return (
      <div className="mx-auto grid min-h-screen max-w-6xl animate-pulse gap-6 p-4 md:grid-cols-[1fr_380px] md:p-8">
        <div className="h-[720px] rounded-3xl bg-slate-100" />
        <div className="h-[520px] rounded-3xl bg-slate-100" />
      </div>
    );
  }

  if (!data) {
    return (
      <main className="mx-auto max-w-xl p-6">
        <div className="rounded-3xl border border-red-200 bg-red-50 p-6 text-red-800">
          {error ||
            "Checkout indisponível."}
        </div>
      </main>
    );
  }

  return (
    <main
      className="min-h-screen bg-slate-50 text-slate-950"
      style={{
        ["--checkout-color" as string]:
          data.company
            .primaryColor ||
          "#6d28d9",
      }}
    >
      <Script
        src="https://sdk.mercadopago.com/js/v2"
        strategy="afterInteractive"
        onLoad={() =>
          setSdkReady(true)
        }
        onError={() =>
          setError(
            "Não foi possível carregar a segurança do pagamento.",
          )
        }
      />

      <div className="mx-auto grid max-w-6xl gap-6 p-4 md:grid-cols-[minmax(0,1fr)_380px] md:p-8">
        <section className="min-w-0 space-y-6">
          <header className="overflow-hidden rounded-3xl bg-[#071b3a] p-6 text-white shadow-xl">
            <div className="flex min-w-0 items-center gap-4">
              {data.company.logoUrl ? (
                <img
                  src={
                    data.company
                      .logoUrl
                  }
                  alt=""
                  className="h-14 w-14 rounded-2xl border border-white/20 object-cover"
                />
              ) : (
                <div className="grid h-14 w-14 place-items-center rounded-2xl bg-white/10 font-black">
                  {data.company.name.slice(
                    0,
                    1,
                  )}
                </div>
              )}

              <div className="min-w-0">
                <p className="text-sm font-bold text-blue-200">
                  Checkout seguro
                </p>
                <h1 className="break-words text-2xl font-black">
                  {data.company.name}
                </h1>
                <p className="mt-1 text-xs font-semibold text-blue-100">
                  Pix e cartão sem sair desta página
                </p>
              </div>
            </div>
          </header>

          <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-lg font-black">
              Produtos
            </h2>

            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {data.products.map(
                (product) => (
                  <button
                    key={product.id}
                    type="button"
                    onClick={() =>
                      addProduct(
                        product.id,
                      )
                    }
                    className="min-w-0 rounded-2xl border border-slate-200 p-4 text-left transition hover:border-violet-300 hover:bg-violet-50 active:scale-[0.99]"
                  >
                    <div className="font-black">
                      {product.name}
                    </div>
                    <div className="mt-1 line-clamp-2 text-sm text-slate-500">
                      {
                        product.description
                      }
                    </div>
                    <div className="mt-3 font-black text-violet-700">
                      {currency(
                        product.price,
                      )}
                    </div>
                  </button>
                ),
              )}
            </div>
          </section>

          {cart.length > 0 ? (
            <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="text-lg font-black">
                Revisão do carrinho
              </h2>

              <div className="mt-4 space-y-4">
                {cart.map((item) => {
                  const product =
                    productMap.get(
                      item.productId,
                    );

                  if (!product) {
                    return null;
                  }

                  return (
                    <article
                      key={
                        item.productId
                      }
                      className="rounded-2xl border border-slate-200 p-4"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div className="font-black">
                          {
                            product.name
                          }
                        </div>

                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            aria-label="Diminuir quantidade"
                            onClick={() =>
                              updateCart(
                                item.productId,
                                {
                                  quantity:
                                    item.quantity -
                                    1,
                                },
                              )
                            }
                            className="h-10 w-10 rounded-xl border border-slate-200"
                          >
                            -
                          </button>
                          <span className="min-w-8 text-center font-black">
                            {
                              item.quantity
                            }
                          </span>
                          <button
                            type="button"
                            aria-label="Aumentar quantidade"
                            onClick={() =>
                              updateCart(
                                item.productId,
                                {
                                  quantity:
                                    item.quantity +
                                    1,
                                },
                              )
                            }
                            className="h-10 w-10 rounded-xl border border-slate-200"
                          >
                            +
                          </button>
                        </div>
                      </div>

                      {product
                        .variations
                        .length > 0 ? (
                        <label className="mt-4 block text-sm font-bold">
                          Variação
                          <select
                            value={
                              item.variationId ||
                              ""
                            }
                            onChange={(
                              event,
                            ) =>
                              updateCart(
                                item.productId,
                                {
                                  variationId:
                                    event
                                      .target
                                      .value ||
                                    undefined,
                                },
                              )
                            }
                            className="mt-2 w-full rounded-xl border border-slate-300 p-3"
                          >
                            <option value="">
                              Padrão
                            </option>
                            {product.variations.map(
                              (
                                option,
                              ) => (
                                <option
                                  key={
                                    option.id
                                  }
                                  value={
                                    option.id
                                  }
                                >
                                  {
                                    option.name
                                  }
                                  {option.priceDelta
                                    ? ` (+${currency(option.priceDelta)})`
                                    : ""}
                                </option>
                              ),
                            )}
                          </select>
                        </label>
                      ) : null}

                      {product.addons
                        .length > 0 ? (
                        <fieldset className="mt-4">
                          <legend className="text-sm font-bold">
                            Adicionais
                          </legend>
                          <div className="mt-2 grid gap-2 sm:grid-cols-2">
                            {product.addons.map(
                              (
                                option,
                              ) => (
                                <label
                                  key={
                                    option.id
                                  }
                                  className="flex items-center gap-2 rounded-xl border border-slate-200 p-3 text-sm"
                                >
                                  <input
                                    type="checkbox"
                                    checked={item.addonIds.includes(
                                      option.id,
                                    )}
                                    onChange={(
                                      event,
                                    ) => {
                                      const next =
                                        event
                                          .target
                                          .checked
                                          ? [
                                              ...item.addonIds,
                                              option.id,
                                            ]
                                          : item.addonIds.filter(
                                              (
                                                id,
                                              ) =>
                                                id !==
                                                option.id,
                                            );

                                      updateCart(
                                        item.productId,
                                        {
                                          addonIds:
                                            next,
                                        },
                                      );
                                    }}
                                  />
                                  <span className="min-w-0 break-words">
                                    {
                                      option.name
                                    }{" "}
                                    {option.price
                                      ? `(+${currency(option.price)})`
                                      : ""}
                                  </span>
                                </label>
                              ),
                            )}
                          </div>
                        </fieldset>
                      ) : null}

                      <textarea
                        value={
                          item.observation
                        }
                        onChange={(
                          event,
                        ) =>
                          updateCart(
                            item.productId,
                            {
                              observation:
                                event
                                  .target
                                  .value,
                            },
                          )
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

          <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-lg font-black">
              Identificação
            </h2>

            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {[
                [
                  "name",
                  "Nome",
                  "text",
                ],
                [
                  "email",
                  "E-mail",
                  "email",
                ],
                [
                  "phone",
                  "Telefone",
                  "tel",
                ],
                [
                  "cpfCnpj",
                  "CPF ou CNPJ",
                  "text",
                ],
                [
                  "postalCode",
                  "CEP",
                  "text",
                ],
                [
                  "addressNumber",
                  "Número",
                  "text",
                ],
              ].map(
                ([
                  key,
                  label,
                  type,
                ]) => (
                  <label
                    key={key}
                    className="text-sm font-bold"
                  >
                    {label}
                    <input
                      type={type}
                      value={
                        customer[
                          key as keyof typeof customer
                        ]
                      }
                      onChange={(
                        event,
                      ) =>
                        setCustomer(
                          (
                            current,
                          ) => ({
                            ...current,
                            [key]:
                              event
                                .target
                                .value,
                          }),
                        )
                      }
                      className="mt-2 w-full rounded-xl border border-slate-300 p-3"
                    />
                  </label>
                ),
              )}
            </div>
          </section>

          <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-lg font-black">
              Entrega
            </h2>

            <div className="mt-4 flex flex-wrap gap-2">
              {(
                [
                  "pickup",
                  "delivery",
                ] as const
              ).map((type) => (
                <button
                  key={type}
                  type="button"
                  onClick={() =>
                    setDelivery(
                      (current) => ({
                        ...current,
                        type,
                      }),
                    )
                  }
                  className={`rounded-xl border px-4 py-3 font-bold ${
                    delivery.type ===
                    type
                      ? "border-violet-600 bg-violet-50 text-violet-700"
                      : "border-slate-200"
                  }`}
                >
                  {type ===
                  "pickup"
                    ? "Retirada"
                    : "Entrega"}
                </button>
              ))}
            </div>

            {delivery.type ===
            "delivery" ? (
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <label className="text-sm font-bold sm:col-span-2">
                  Região
                  <select
                    value={
                      delivery.zoneId
                    }
                    onChange={(
                      event,
                    ) =>
                      setDelivery(
                        (
                          current,
                        ) => ({
                          ...current,
                          zoneId:
                            event
                              .target
                              .value,
                        }),
                      )
                    }
                    className="mt-2 w-full rounded-xl border border-slate-300 p-3"
                  >
                    <option value="">
                      Selecione
                    </option>
                    {data.deliveryZones.map(
                      (zone) => (
                        <option
                          key={
                            zone.id
                          }
                          value={
                            zone.id
                          }
                        >
                          {
                            zone.name
                          }{" "}
                          -{" "}
                          {currency(
                            zone.fee,
                          )}
                        </option>
                      ),
                    )}
                  </select>
                </label>

                {[
                  [
                    "address",
                    "Endereço",
                  ],
                  [
                    "complement",
                    "Complemento",
                  ],
                  [
                    "reference",
                    "Referência",
                  ],
                ].map(
                  ([
                    key,
                    label,
                  ]) => (
                    <label
                      key={key}
                      className="text-sm font-bold"
                    >
                      {label}
                      <input
                        value={
                          delivery[
                            key as keyof typeof delivery
                          ]
                        }
                        onChange={(
                          event,
                        ) =>
                          setDelivery(
                            (
                              current,
                            ) => ({
                              ...current,
                              [key]:
                                event
                                  .target
                                  .value,
                            }),
                          )
                        }
                        className="mt-2 w-full rounded-xl border border-slate-300 p-3"
                      />
                    </label>
                  ),
                )}
              </div>
            ) : null}
          </section>

          <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-lg font-black">
              Pagamento
            </h2>

            <div className="mt-4 flex flex-wrap gap-2">
              {data.payment
                .pixEnabled ? (
                <button
                  type="button"
                  onClick={() =>
                    setPaymentMethod(
                      "PIX",
                    )
                  }
                  className={`rounded-xl border px-4 py-3 font-bold ${
                    paymentMethod ===
                    "PIX"
                      ? "border-violet-600 bg-violet-50 text-violet-700"
                      : "border-slate-200"
                  }`}
                >
                  Pix
                </button>
              ) : null}

              {data.payment
                .cardEnabled ? (
                <button
                  type="button"
                  onClick={() =>
                    setPaymentMethod(
                      "CREDIT_CARD",
                    )
                  }
                  className={`rounded-xl border px-4 py-3 font-bold ${
                    paymentMethod ===
                    "CREDIT_CARD"
                      ? "border-violet-600 bg-violet-50 text-violet-700"
                      : "border-slate-200"
                  }`}
                >
                  Cartão
                </button>
              ) : null}
            </div>

            {paymentMethod ===
              "CREDIT_CARD" &&
            data.payment
              .cardEnabled ? (
              <form
                id="orcaly-marketplace-card-form"
                key={Math.round(
                  finalPreviewTotal *
                    100,
                )}
                className="mt-5 space-y-4 rounded-2xl border border-slate-200 bg-slate-50 p-5"
              >
                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="text-sm font-bold sm:col-span-2">
                    Número do cartão
                    <div
                      id="orcaly-marketplace-card-number"
                      className="mt-2 min-h-12 rounded-xl border border-slate-300 bg-white px-3 py-3"
                    />
                  </label>

                  <label className="text-sm font-bold">
                    Validade
                    <div
                      id="orcaly-marketplace-expiration-date"
                      className="mt-2 min-h-12 rounded-xl border border-slate-300 bg-white px-3 py-3"
                    />
                  </label>

                  <label className="text-sm font-bold">
                    CVV
                    <div
                      id="orcaly-marketplace-security-code"
                      className="mt-2 min-h-12 rounded-xl border border-slate-300 bg-white px-3 py-3"
                    />
                  </label>

                  <label className="text-sm font-bold sm:col-span-2">
                    Nome no cartão
                    <input
                      id="orcaly-marketplace-cardholder-name"
                      autoComplete="cc-name"
                      className="mt-2 w-full rounded-xl border border-slate-300 bg-white p-3"
                    />
                  </label>

                  <label className="text-sm font-bold">
                    Tipo de documento
                    <select
                      id="orcaly-marketplace-identification-type"
                      className="mt-2 w-full rounded-xl border border-slate-300 bg-white p-3"
                    />
                  </label>

                  <label className="text-sm font-bold">
                    CPF ou CNPJ
                    <input
                      id="orcaly-marketplace-identification-number"
                      inputMode="numeric"
                      className="mt-2 w-full rounded-xl border border-slate-300 bg-white p-3"
                    />
                  </label>

                  <label className="text-sm font-bold sm:col-span-2">
                    E-mail do titular
                    <input
                      id="orcaly-marketplace-cardholder-email"
                      type="email"
                      defaultValue={
                        customer.email
                      }
                      className="mt-2 w-full rounded-xl border border-slate-300 bg-white p-3"
                    />
                  </label>

                  <label className="text-sm font-bold sm:col-span-2">
                    Parcelas
                    <select
                      id="orcaly-marketplace-installments"
                      className="mt-2 w-full rounded-xl border border-slate-300 bg-white p-3"
                    />
                  </label>
                </div>

                <select
                  id="orcaly-marketplace-issuer"
                  aria-label="Banco emissor"
                  className="hidden"
                />

                <button
                  type="submit"
                  disabled={
                    processing ||
                    !cardReady ||
                    cart.length ===
                      0
                  }
                  className="w-full rounded-2xl bg-violet-700 px-5 py-4 font-black text-white transition hover:bg-violet-800 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {processing
                    ? "Processando..."
                    : cardReady
                      ? `Pagar ${currency(finalPreviewTotal)}`
                      : "Carregando campos seguros..."}
                </button>
              </form>
            ) : null}

            {!data.payment
              .chargesEnabled ? (
              <p className="mt-4 rounded-xl bg-amber-50 p-4 text-sm font-bold text-amber-800">
                Esta empresa ainda precisa conectar uma conta Mercado Pago.
              </p>
            ) : null}
          </section>

          {error ? (
            <div
              role="alert"
              className="rounded-2xl border border-red-200 bg-red-50 p-4 font-bold text-red-800"
            >
              {error}
            </div>
          ) : null}

          {notice ? (
            <div
              aria-live="polite"
              className="rounded-2xl border border-blue-200 bg-blue-50 p-4 font-bold text-blue-800"
            >
              {notice}
            </div>
          ) : null}

          {pix ? (
            <section
              aria-live="polite"
              className="rounded-3xl border border-emerald-200 bg-emerald-50 p-5"
            >
              <h2 className="text-lg font-black">
                Pague com Pix
              </h2>

              {pix.encodedImage ? (
                <img
                  src={`data:image/png;base64,${pix.encodedImage}`}
                  alt="QR Code Pix"
                  className="mx-auto mt-4 h-64 w-64 rounded-2xl bg-white p-3"
                />
              ) : null}

              {pix.payload ? (
                <div className="mt-4">
                  <textarea
                    readOnly
                    value={
                      pix.payload
                    }
                    className="min-h-28 w-full rounded-xl border border-emerald-300 bg-white p-3 text-xs"
                  />

                  <button
                    type="button"
                    onClick={() =>
                      navigator.clipboard.writeText(
                        pix.payload ||
                          "",
                      )
                    }
                    className="mt-2 rounded-xl bg-emerald-700 px-4 py-3 font-bold text-white"
                  >
                    Copiar código Pix
                  </button>
                </div>
              ) : null}

              <p className="mt-3 text-sm font-bold">
                {friendlyStatus(
                  paymentStatus,
                )}
              </p>
            </section>
          ) : null}
        </section>

        <aside className="min-w-0">
          <div className="sticky top-6 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-lg font-black">
              Resumo do pedido
            </h2>

            <div className="mt-4 space-y-3">
              {cart.map((item) => {
                const product =
                  productMap.get(
                    item.productId,
                  );

                if (!product) {
                  return null;
                }

                return (
                  <div
                    key={
                      item.productId
                    }
                    className="flex min-w-0 justify-between gap-3 text-sm"
                  >
                    <span className="min-w-0 break-words">
                      {item.quantity}x{" "}
                      {product.name}
                    </span>
                    <span className="shrink-0 font-bold">
                      {currency(
                        product.price *
                          item.quantity,
                      )}
                    </span>
                  </div>
                );
              })}
            </div>

            <label className="mt-5 block text-sm font-bold">
              Cupom
              <input
                value={couponCode}
                onChange={(event) =>
                  setCouponCode(
                    event.target.value,
                  )
                }
                className="mt-2 w-full rounded-xl border border-slate-300 p-3"
              />
            </label>

            <div className="mt-5 border-t border-slate-200 pt-4">
              <div className="flex justify-between text-sm">
                <span>
                  Subtotal estimado
                </span>
                <span>
                  {currency(subtotal)}
                </span>
              </div>

              {delivery.type ===
              "delivery" ? (
                <div className="mt-2 flex justify-between text-sm">
                  <span>Entrega</span>
                  <span>
                    {currency(
                      Number(
                        selectedZone?.fee ||
                          0,
                      ),
                    )}
                  </span>
                </div>
              ) : null}

              <div className="mt-4 flex justify-between text-lg font-black">
                <span>Total</span>
                <span>
                  {currency(
                    finalPreviewTotal,
                  )}
                </span>
              </div>

              <p className="mt-3 text-xs text-slate-500">
                O valor final é recalculado com segurança no servidor.
              </p>
            </div>

            {paymentMethod ===
              "PIX" ? (
              <button
                type="button"
                onClick={() =>
                  void createPayment()
                }
                disabled={
                  processing ||
                  cart.length === 0 ||
                  !data.payment
                    .chargesEnabled
                }
                className="mt-5 w-full rounded-2xl bg-violet-700 px-5 py-4 font-black text-white transition hover:bg-violet-800 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {processing
                  ? "Gerando..."
                  : `Gerar Pix de ${currency(finalPreviewTotal)}`}
              </button>
            ) : null}

            <p className="mt-4 text-center text-xs font-semibold text-slate-500">
              Pagamento processado com segurança pelo Mercado Pago.
            </p>
          </div>
        </aside>
      </div>
    </main>
  );
}
