// ORCALY_ASAAS_MIGRATION_V2
"use client";

import { useEffect, useMemo, useState } from "react";

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
    configured: boolean;
    chargesEnabled: boolean;
    pixEnabled: boolean;
    cardEnabled: boolean;
  };
};

function currency(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
}

function idempotencyKey() {
  return `${Date.now()}-${crypto.randomUUID()}`;
}

export default function CheckoutClient({ slug }: { slug: string }) {
  const [data, setData] = useState<CheckoutData | null>(null);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState("");
  const [paymentId, setPaymentId] = useState("");
  const [paymentStatus, setPaymentStatus] = useState("");
  const [pix, setPix] = useState<{
    encodedImage?: string;
    payload?: string;
    expirationDate?: string;
  } | null>(null);
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
  const [paymentMethod, setPaymentMethod] =
    useState<"PIX" | "CREDIT_CARD">("PIX");
  const [card, setCard] = useState({
    holderName: "",
    number: "",
    expiryMonth: "",
    expiryYear: "",
    ccv: "",
  });

  useEffect(() => {
    let active = true;

    fetch(`/api/checkout/${encodeURIComponent(slug)}`, {
      cache: "no-store",
    })
      .then(async (response) => {
        const payload = await response.json();
        if (!response.ok) {
          throw new Error(
            payload.error || "Nao foi possivel carregar o checkout.",
          );
        }
        return payload as CheckoutData;
      })
      .then((payload) => {
        if (active) setData(payload);
      })
      .catch((cause) => {
        if (active) {
          setError(
            cause instanceof Error
              ? cause.message
              : "Nao foi possivel carregar o checkout.",
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

  // ORCALY_MARKETPLACE_HANDOFF_V1
  useEffect(() => {
    if (!data) return;

    const key = `orcaly-checkout:${slug}`;
    const raw = window.sessionStorage.getItem(key);
    if (!raw) return;

    try {
      const parsed = JSON.parse(raw) as {
        items?: CartItem[];
        customer?: Partial<{
          name: string;
          email: string;
          phone: string;
          cpfCnpj: string;
          postalCode: string;
          addressNumber: string;
          addressComplement: string;
        }>;
        delivery?: Partial<{
          type: "pickup" | "delivery";
          zoneId: string;
          address: string;
          complement: string;
          reference: string;
        }>;
        couponCode?: string;
      };

      const allowed = new Set(data.products.map((item) => item.id));
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
      if (parsed.couponCode) setCouponCode(parsed.couponCode);

      window.sessionStorage.removeItem(key);
    } catch {
      window.sessionStorage.removeItem(key);
    }
  }, [data, slug]);

  useEffect(() => {
    if (!paymentId) return;

    const timer = window.setInterval(async () => {
      const response = await fetch(
        `/api/checkout/${encodeURIComponent(slug)}/pix/${encodeURIComponent(paymentId)}`,
        { cache: "no-store" },
      );

      if (!response.ok) return;

      const payload = await response.json();
      const nextStatus = String(payload.payment?.status || "");
      setPaymentStatus(nextStatus);

      if (
        ["RECEIVED", "CONFIRMED", "PAID", "REFUNDED", "CANCELLED"].includes(
          nextStatus,
        )
      ) {
        window.clearInterval(timer);
      }
    }, 5000);

    return () => window.clearInterval(timer);
  }, [paymentId, slug]);

  const productMap = useMemo(
    () => new Map((data?.products || []).map((item) => [item.id, item])),
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

  function addProduct(productId: string) {
    setCart((current) => {
      const existing = current.find(
        (item) => item.productId === productId,
      );

      if (existing) {
        return current.map((item) =>
          item.productId === productId
            ? { ...item, quantity: item.quantity + 1 }
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
          item.productId === productId
            ? { ...item, ...patch }
            : item,
        )
        .filter((item) => item.quantity > 0),
    );
  }

  async function submit() {
    if (processing) return;
    setProcessing(true);
    setError("");
    setPix(null);

    try {
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
            customer,
            delivery,
            couponCode,
            paymentMethod,
            card:
              paymentMethod === "CREDIT_CARD"
                ? card
                : undefined,
          }),
        },
      );

      const payload = await response.json();

      if (!response.ok) {
        throw new Error(
          payload.error || "Nao foi possivel criar o pagamento.",
        );
      }

      setPaymentStatus(String(payload.status || "PENDING"));
      setPaymentId(String(payload.paymentId || ""));
      setPix(payload.pix || null);
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Nao foi possivel criar o pagamento.",
      );
    } finally {
      setProcessing(false);
    }
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
          {error || "Checkout indisponivel."}
        </div>
      </main>
    );
  }

  return (
    <main
      className="min-h-screen bg-slate-50 text-slate-950"
      style={{
        ["--checkout-color" as string]:
          data.company.primaryColor || "#6d28d9",
      }}
    >
      <div className="mx-auto grid max-w-6xl gap-6 p-4 md:grid-cols-[minmax(0,1fr)_380px] md:p-8">
        <section className="min-w-0 space-y-6">
          <header className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex min-w-0 items-center gap-4">
              {data.company.logoUrl ? (
                <img
                  src={data.company.logoUrl}
                  alt=""
                  className="h-14 w-14 rounded-2xl border border-slate-200 object-cover"
                />
              ) : (
                <div className="grid h-14 w-14 place-items-center rounded-2xl bg-violet-100 font-black text-violet-700">
                  {data.company.name.slice(0, 1)}
                </div>
              )}
              <div className="min-w-0">
                <p className="text-sm font-bold text-slate-500">
                  Checkout seguro
                </p>
                <h1 className="break-words text-2xl font-black">
                  {data.company.name}
                </h1>
              </div>
            </div>
          </header>

          <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-lg font-black">Produtos</h2>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {data.products.map((product) => (
                <button
                  key={product.id}
                  type="button"
                  onClick={() => addProduct(product.id)}
                  className="min-w-0 rounded-2xl border border-slate-200 p-4 text-left transition hover:border-violet-300 hover:bg-violet-50 active:scale-[0.99]"
                >
                  <div className="font-black">{product.name}</div>
                  <div className="mt-1 line-clamp-2 text-sm text-slate-500">
                    {product.description}
                  </div>
                  <div className="mt-3 font-black text-violet-700">
                    {currency(product.price)}
                  </div>
                </button>
              ))}
            </div>
          </section>

          {cart.length > 0 && (
            <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="text-lg font-black">Revisao do carrinho</h2>
              <div className="mt-4 space-y-4">
                {cart.map((item) => {
                  const product = productMap.get(item.productId);
                  if (!product) return null;

                  return (
                    <article
                      key={item.productId}
                      className="rounded-2xl border border-slate-200 p-4"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div className="font-black">{product.name}</div>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            aria-label="Diminuir quantidade"
                            onClick={() =>
                              updateCart(item.productId, {
                                quantity: item.quantity - 1,
                              })
                            }
                            className="h-10 w-10 rounded-xl border border-slate-200"
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
                            className="h-10 w-10 rounded-xl border border-slate-200"
                          >
                            +
                          </button>
                        </div>
                      </div>

                      {product.variations.length > 0 && (
                        <label className="mt-4 block text-sm font-bold">
                          Variacao
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
                            <option value="">Padrao</option>
                            {product.variations.map((option) => (
                              <option key={option.id} value={option.id}>
                                {option.name}
                                {option.priceDelta
                                  ? ` (+${currency(option.priceDelta)})`
                                  : ""}
                              </option>
                            ))}
                          </select>
                        </label>
                      )}

                      {product.addons.length > 0 && (
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
                      )}

                      <textarea
                        value={item.observation}
                        onChange={(event) =>
                          updateCart(item.productId, {
                            observation: event.target.value,
                          })
                        }
                        placeholder="Observacao do item"
                        className="mt-4 min-h-20 w-full rounded-xl border border-slate-300 p-3"
                      />
                    </article>
                  );
                })}
              </div>
            </section>
          )}

          <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-lg font-black">Identificacao</h2>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {[
                ["name", "Nome", "text"],
                ["email", "E-mail", "email"],
                ["phone", "Telefone", "tel"],
                ["cpfCnpj", "CPF ou CNPJ", "text"],
                ["postalCode", "CEP", "text"],
                ["addressNumber", "Numero", "text"],
              ].map(([key, label, type]) => (
                <label key={key} className="text-sm font-bold">
                  {label}
                  <input
                    type={type}
                    value={customer[key as keyof typeof customer]}
                    onChange={(event) =>
                      setCustomer((current) => ({
                        ...current,
                        [key]: event.target.value,
                      }))
                    }
                    className="mt-2 w-full rounded-xl border border-slate-300 p-3"
                  />
                </label>
              ))}
            </div>
          </section>

          <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-lg font-black">Entrega</h2>
            <div className="mt-4 flex flex-wrap gap-2">
              {(["pickup", "delivery"] as const).map((type) => (
                <button
                  key={type}
                  type="button"
                  onClick={() =>
                    setDelivery((current) => ({
                      ...current,
                      type,
                    }))
                  }
                  className={`rounded-xl border px-4 py-3 font-bold ${
                    delivery.type === type
                      ? "border-violet-600 bg-violet-50 text-violet-700"
                      : "border-slate-200"
                  }`}
                >
                  {type === "pickup" ? "Retirada" : "Entrega"}
                </button>
              ))}
            </div>

            {delivery.type === "delivery" && (
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <label className="text-sm font-bold sm:col-span-2">
                  Regiao
                  <select
                    value={delivery.zoneId}
                    onChange={(event) =>
                      setDelivery((current) => ({
                        ...current,
                        zoneId: event.target.value,
                      }))
                    }
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
                  ["address", "Endereco"],
                  ["complement", "Complemento"],
                  ["reference", "Referencia"],
                ].map(([key, label]) => (
                  <label key={key} className="text-sm font-bold">
                    {label}
                    <input
                      value={delivery[key as keyof typeof delivery]}
                      onChange={(event) =>
                        setDelivery((current) => ({
                          ...current,
                          [key]: event.target.value,
                        }))
                      }
                      className="mt-2 w-full rounded-xl border border-slate-300 p-3"
                    />
                  </label>
                ))}
              </div>
            )}
          </section>

          <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-lg font-black">Pagamento</h2>
            <div className="mt-4 flex flex-wrap gap-2">
              {data.payment.pixEnabled && (
                <button
                  type="button"
                  onClick={() => setPaymentMethod("PIX")}
                  className={`rounded-xl border px-4 py-3 font-bold ${
                    paymentMethod === "PIX"
                      ? "border-violet-600 bg-violet-50 text-violet-700"
                      : "border-slate-200"
                  }`}
                >
                  Pix
                </button>
              )}
              {data.payment.cardEnabled && (
                <button
                  type="button"
                  onClick={() => setPaymentMethod("CREDIT_CARD")}
                  className={`rounded-xl border px-4 py-3 font-bold ${
                    paymentMethod === "CREDIT_CARD"
                      ? "border-violet-600 bg-violet-50 text-violet-700"
                      : "border-slate-200"
                  }`}
                >
                  Cartao
                </button>
              )}
            </div>

            {paymentMethod === "CREDIT_CARD" &&
              data.payment.cardEnabled && (
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  {[
                    ["holderName", "Nome no cartao", "text"],
                    ["number", "Numero do cartao", "text"],
                    ["expiryMonth", "Mes", "text"],
                    ["expiryYear", "Ano", "text"],
                    ["ccv", "CVV", "password"],
                  ].map(([key, label, type]) => (
                    <label key={key} className="text-sm font-bold">
                      {label}
                      <input
                        type={type}
                        autoComplete={
                          key === "number"
                            ? "cc-number"
                            : key === "ccv"
                              ? "cc-csc"
                              : "off"
                        }
                        inputMode={
                          key === "holderName" ? "text" : "numeric"
                        }
                        value={card[key as keyof typeof card]}
                        onChange={(event) =>
                          setCard((current) => ({
                            ...current,
                            [key]: event.target.value,
                          }))
                        }
                        className="mt-2 w-full rounded-xl border border-slate-300 p-3"
                      />
                    </label>
                  ))}
                </div>
              )}

            {!data.payment.cardEnabled && (
              <p className="mt-4 text-sm text-slate-500">
                O cartao sera exibido quando a tokenizacao estiver
                habilitada. O Pix continua disponivel.
              </p>
            )}
          </section>

          {error && (
            <div
              role="alert"
              className="rounded-2xl border border-red-200 bg-red-50 p-4 text-red-800"
            >
              {error}
            </div>
          )}

          {pix && (
            <section
              aria-live="polite"
              className="rounded-3xl border border-emerald-200 bg-emerald-50 p-5"
            >
              <h2 className="text-lg font-black">Pague com Pix</h2>
              {pix.encodedImage && (
                <img
                  src={`data:image/png;base64,${pix.encodedImage}`}
                  alt="QR Code Pix"
                  className="mx-auto mt-4 h-64 w-64 rounded-2xl bg-white p-3"
                />
              )}
              {pix.payload && (
                <div className="mt-4">
                  <textarea
                    readOnly
                    value={pix.payload}
                    className="min-h-28 w-full rounded-xl border border-emerald-300 bg-white p-3 text-xs"
                  />
                  <button
                    type="button"
                    onClick={() =>
                      navigator.clipboard.writeText(
                        pix.payload || "",
                      )
                    }
                    className="mt-2 rounded-xl bg-emerald-700 px-4 py-3 font-bold text-white"
                  >
                    Copiar Pix
                  </button>
                </div>
              )}
              <p className="mt-3 text-sm font-bold">
                Status: {paymentStatus || "Aguardando pagamento"}
              </p>
            </section>
          )}
        </section>

        <aside className="min-w-0">
          <div className="sticky top-6 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-lg font-black">Resumo do pedido</h2>
            <div className="mt-4 space-y-3">
              {cart.map((item) => {
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
              })}
            </div>

            <label className="mt-5 block text-sm font-bold">
              Cupom
              <input
                value={couponCode}
                onChange={(event) =>
                  setCouponCode(event.target.value)
                }
                className="mt-2 w-full rounded-xl border border-slate-300 p-3"
              />
            </label>

            <div className="mt-5 border-t border-slate-200 pt-4">
              <div className="flex justify-between text-sm">
                <span>Subtotal estimado</span>
                <span>{currency(subtotal)}</span>
              </div>
              {delivery.type === "delivery" && (
                <div className="mt-2 flex justify-between text-sm">
                  <span>Entrega</span>
                  <span>{currency(Number(selectedZone?.fee || 0))}</span>
                </div>
              )}
              <div className="mt-4 flex justify-between text-lg font-black">
                <span>Total estimado</span>
                <span>{currency(estimatedTotal)}</span>
              </div>
              <p className="mt-3 text-xs text-slate-500">
                O valor final e recalculado com seguranca no servidor.
              </p>
            </div>

            <button
              type="button"
              onClick={submit}
              disabled={
                processing ||
                cart.length === 0 ||
                !data.payment.chargesEnabled
              }
              className="mt-5 w-full rounded-2xl bg-violet-700 px-5 py-4 font-black text-white transition hover:bg-violet-800 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {processing
                ? "Processando..."
                : paymentMethod === "PIX"
                  ? "Gerar Pix"
                  : "Pagar com cartao"}
            </button>

            {!data.payment.chargesEnabled && (
              <p className="mt-3 text-sm text-amber-700">
                A conta de recebimento desta empresa ainda nao esta
                aprovada.
              </p>
            )}

            <p className="mt-4 text-center text-xs text-slate-500">
              Pagamento processado com seguranca pelo Asaas.
            </p>
          </div>
        </aside>
      </div>
    </main>
  );
}

