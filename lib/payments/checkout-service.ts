// ORCALY_ASAAS_MIGRATION_V2
import "server-only";
import { createHash, randomUUID } from "node:crypto";
import type { NextRequest } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getPlanConfig } from "@/lib/plans/plan-config";
import {
  getAsaasCapabilities,
  requireAsaasRootWalletId,
} from "@/lib/payments/asaas-config";
import { AsaasProvider } from "@/lib/payments/providers/asaas";
import {
  getCompanyProviderAccount,
  getRequestIp,
  resolveCompanyBySlug,
} from "@/lib/payments/server-context";

type JsonRecord = Record<string, unknown>;

type CheckoutItem = {
  productId: string;
  quantity: number;
  variationId?: string;
  addonIds?: string[];
  observation?: string;
};

type CheckoutBody = {
  items: CheckoutItem[];
  customer: {
    name: string;
    email: string;
    phone: string;
    cpfCnpj: string;
    postalCode?: string;
    addressNumber?: string;
    addressComplement?: string;
  };
  delivery: {
    type: "delivery" | "pickup";
    zoneId?: string;
    address?: string;
    complement?: string;
    reference?: string;
  };
  couponCode?: string;
  paymentMethod: "PIX" | "CREDIT_CARD";
  card?: {
    holderName: string;
    number: string;
    expiryMonth: string;
    expiryYear: string;
    ccv: string;
  };
};

const text = (value: unknown) => String(value || "").trim();
const money = (value: unknown) => {
  const parsed = Number(value || 0);
  return Number.isFinite(parsed) ? Math.round(parsed * 100) / 100 : 0;
};
const array = (value: unknown) => (Array.isArray(value) ? value : []);

function optionId(value: unknown) {
  if (!value || typeof value !== "object") return "";
  const record = value as JsonRecord;
  return text(record.id || record.key || record.nome || record.name);
}

function optionPrice(value: unknown) {
  if (!value || typeof value !== "object") return 0;
  const record = value as JsonRecord;
  return money(
    record.priceDelta ||
      record.price_delta ||
      record.preco_adicional ||
      record.preco ||
      record.price,
  );
}

function productPrice(product: JsonRecord) {
  return money(
    product.preco_promocional ||
      product.sale_price ||
      product.preco ||
      product.price,
  );
}

function productName(product: JsonRecord) {
  return text(product.nome || product.name || "Produto");
}

function productVariations(product: JsonRecord) {
  return array(product.variacoes || product.variations || product.opcoes_variacao);
}

function productAddons(product: JsonRecord) {
  return array(product.adicionais || product.addons || product.complementos);
}

function idempotencyKey(
  companyId: string,
  body: CheckoutBody,
  request: NextRequest,
) {
  const provided = text(request.headers.get("idempotency-key"));
  if (provided.length >= 16 && provided.length <= 128) return provided;

  return createHash("sha256")
    .update(
      JSON.stringify({
        companyId,
        bucket: Math.floor(Date.now() / 300000),
        items: body.items,
        customer: {
          email: body.customer.email.toLowerCase(),
          phone: body.customer.phone,
        },
        delivery: body.delivery,
        paymentMethod: body.paymentMethod,
      }),
    )
    .digest("hex");
}

async function providerCustomer(
  provider: AsaasProvider,
  supabase: SupabaseClient,
  companyId: string,
  customer: CheckoutBody["customer"],
) {
  const internalId = createHash("sha256")
    .update(`${customer.email.toLowerCase()}:${customer.cpfCnpj}`)
    .digest("hex");

  const { data: existing } = await supabase
    .from("provider_customers")
    .select("provider_customer_id")
    .eq("company_id", companyId)
    .eq("provider", "asaas")
    .eq("customer_id", internalId)
    .maybeSingle();

  if (existing?.provider_customer_id) {
    return String(existing.provider_customer_id);
  }

  const created = await provider.createCustomer({
    name: customer.name,
    email: customer.email,
    cpfCnpj: customer.cpfCnpj,
    mobilePhone: customer.phone,
    externalReference: internalId,
    notificationDisabled: true,
  });

  await supabase.from("provider_customers").upsert(
    {
      company_id: companyId,
      customer_id: internalId,
      provider: "asaas",
      provider_customer_id: created.id,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "company_id,provider,customer_id" },
  );

  return created.id;
}

export async function getCheckoutCatalog(slug: string) {
  const { supabase, company } = await resolveCompanyBySlug(slug);
  const companyId = text(company.id);

  const [{ data: products }, { data: zones }, { data: account }] =
    await Promise.all([
      supabase
        .from("products")
        .select("*")
        .eq("company_id", companyId)
        .eq("ativo", true)
        .order("nome"),
      supabase
        .from("delivery_zones")
        .select("*")
        .eq("company_id", companyId)
        .eq("ativo", true)
        .order("nome"),
      supabase
        .from("marketplace_payment_settings")
        .select("account_status,charges_enabled,pix_enabled,card_enabled")
        .eq("company_id", companyId)
        .eq("provider", "asaas")
        .maybeSingle(),
    ]);

  const capabilities = getAsaasCapabilities();

  return {
    company: {
      name: text(company.nome || company.name),
      logoUrl: text(company.logo_url || company.logo),
      primaryColor: text(company.site_primary_color || company.cor_primaria),
      slug,
    },
    products: (products || []).map((raw) => {
      const product = raw as JsonRecord;

      return {
        id: text(product.id),
        name: productName(product),
        description: text(product.descricao || product.description),
        price: productPrice(product),
        imageUrl: text(product.imagem_url || product.image_url),
        variations: productVariations(product).map((item) => {
          const record = item as JsonRecord;
          return {
            id: optionId(item),
            name: text(record.nome || record.name) || optionId(item),
            priceDelta: optionPrice(item),
          };
        }),
        addons: productAddons(product).map((item) => {
          const record = item as JsonRecord;
          return {
            id: optionId(item),
            name: text(record.nome || record.name) || optionId(item),
            price: optionPrice(item),
          };
        }),
      };
    }),
    deliveryZones: (zones || []).map((raw) => {
      const zone = raw as JsonRecord;
      return {
        id: text(zone.id),
        name: text(zone.nome || zone.name),
        fee: money(zone.taxa || zone.fee),
        minimumOrder: money(zone.pedido_minimo || zone.minimum_order),
      };
    }),
    payment: {
      configured: Boolean(account),
      chargesEnabled: Boolean(account?.charges_enabled),
      pixEnabled: Boolean(account?.pix_enabled),
      cardEnabled:
        Boolean(account?.card_enabled) &&
        capabilities.cardTokenizationEnabled,
    },
  };
}

export async function createCheckoutPayment(
  slug: string,
  body: CheckoutBody,
  request: NextRequest,
) {
  if (!Array.isArray(body.items) || body.items.length === 0) {
    throw Object.assign(new Error("O carrinho esta vazio."), { status: 400 });
  }

  if (!body.customer?.name || !body.customer?.email || !body.customer?.cpfCnpj) {
    throw Object.assign(
      new Error("Informe nome, e-mail e CPF ou CNPJ para continuar."),
      { status: 400 },
    );
  }

  const { supabase, company } = await resolveCompanyBySlug(slug);
  const companyId = text(company.id);
  const providerAccount = await getCompanyProviderAccount(companyId);
  const account = providerAccount.record;

  if (!Boolean(account.charges_enabled)) {
    throw Object.assign(
      new Error("A conta de recebimento ainda nao esta aprovada para cobrar."),
      { status: 409 },
    );
  }

  if (
    body.paymentMethod === "CREDIT_CARD" &&
    !getAsaasCapabilities().cardTokenizationEnabled
  ) {
    throw Object.assign(
      new Error("O pagamento por cartao ainda nao foi habilitado. Utilize Pix."),
      { status: 409 },
    );
  }

  const productIds = Array.from(
    new Set(body.items.map((item) => text(item.productId))),
  );

  const { data: products, error: productsError } = await supabase
    .from("products")
    .select("*")
    .eq("company_id", companyId)
    .in("id", productIds);

  if (productsError || !products || products.length !== productIds.length) {
    throw Object.assign(
      new Error("Um ou mais produtos nao estao disponiveis."),
      { status: 400 },
    );
  }

  const byId = new Map<string, JsonRecord>(
    products.map((item): [string, JsonRecord] => {
      const record = item as JsonRecord;
      return [text(record.id), record];
    }),
  );

  const calculated = body.items.map((input) => {
    const product = byId.get(text(input.productId));

    if (!product || product.ativo === false) {
      throw Object.assign(new Error("Um produto ficou indisponivel."), {
        status: 400,
      });
    }

    const quantity = Math.max(1, Math.min(999, Number(input.quantity || 1)));
    const variation = productVariations(product).find(
      (item) => optionId(item) === text(input.variationId),
    );

    if (input.variationId && !variation) {
      throw Object.assign(new Error("A variacao selecionada nao esta disponivel."), {
        status: 400,
      });
    }

    const addonIds = new Set(input.addonIds || []);
    const addons = productAddons(product).filter((item) =>
      addonIds.has(optionId(item)),
    );

    if (addons.length !== addonIds.size) {
      throw Object.assign(new Error("Um adicional nao esta disponivel."), {
        status: 400,
      });
    }

    const unitPrice = money(
      productPrice(product) +
        optionPrice(variation) +
        addons.reduce((sum, item) => sum + optionPrice(item), 0),
    );

    return {
      productId: text(product.id),
      productName: productName(product),
      quantity,
      unitPrice,
      total: money(unitPrice * quantity),
      variation: variation || null,
      addons,
      observation: text(input.observation),
    };
  });

  const subtotal = money(calculated.reduce((sum, item) => sum + item.total, 0));
  let discountAmount = 0;
  let couponId: string | null = null;

  if (text(body.couponCode)) {
    const { data: coupon } = await supabase
      .from("coupons")
      .select("*")
      .eq("company_id", companyId)
      .ilike("codigo", text(body.couponCode))
      .eq("ativo", true)
      .maybeSingle();

    if (!coupon) {
      throw Object.assign(new Error("Cupom invalido ou indisponivel."), {
        status: 400,
      });
    }

    const record = coupon as JsonRecord;
    const minimum = money(record.valor_minimo || record.minimum_amount);

    if (subtotal < minimum) {
      throw Object.assign(
        new Error("O pedido nao atingiu o valor minimo do cupom."),
        { status: 400 },
      );
    }

    const type = text(record.tipo || record.type).toLowerCase();
    const value = money(record.valor || record.value);
    discountAmount = type.includes("percent")
      ? money(subtotal * (value / 100))
      : Math.min(subtotal, value);
    couponId = text(record.id) || null;
  }

  let deliveryFee = 0;
  let deliveryZoneId: string | null = null;

  if (body.delivery?.type === "delivery") {
    const { data: zone } = await supabase
      .from("delivery_zones")
      .select("*")
      .eq("id", body.delivery.zoneId || "")
      .eq("company_id", companyId)
      .eq("ativo", true)
      .maybeSingle();

    if (!zone) {
      throw Object.assign(new Error("A regiao de entrega nao esta disponivel."), {
        status: 400,
      });
    }

    const record = zone as JsonRecord;
    const minimum = money(record.pedido_minimo || record.minimum_order);

    if (subtotal - discountAmount < minimum) {
      throw Object.assign(
        new Error("O pedido nao atingiu o minimo para esta regiao."),
        { status: 400 },
      );
    }

    deliveryFee = money(record.taxa || record.fee);
    deliveryZoneId = text(record.id);
  }

  const total = money(subtotal - discountAmount + deliveryFee);
  const plan = getPlanConfig(
    company.assinatura_plano || company.plano || company.plan,
  );
  const feePercent = plan.marketplaceFeePercent;
  const key = idempotencyKey(companyId, body, request);

  const { data: existing } = await supabase
    .from("marketplace_payments")
    .select("*")
    .eq("idempotency_key", key)
    .maybeSingle();

  if (existing?.provider_payment_id) {
    return {
      repeated: true,
      transactionId: existing.id,
      orderId: existing.order_id,
      paymentId: existing.provider_payment_id,
      status: existing.status,
      total: existing.gross_amount,
    };
  }

  const { data: order, error: orderError } = await supabase
    .from("orders")
    .insert({
      company_id: companyId,
      nome: body.customer.name,
      customer_name: body.customer.name,
      customer_email: body.customer.email,
      customer_phone: body.customer.phone,
      telefone: body.customer.phone,
      produto: calculated.map((item) => item.productName).join(", "),
      quantidade: calculated.reduce((sum, item) => sum + item.quantity, 0),
      observacoes: calculated
        .map((item) => item.observation)
        .filter(Boolean)
        .join(" | "),
      status: "pending_payment",
      payment_status: "pending",
      payment_method: body.paymentMethod,
      subtotal,
      discount_amount: discountAmount,
      delivery_fee: deliveryFee,
      total,
      preco_estimado: total,
      coupon_id: couponId,
      checkout_idempotency_key: key,
      delivery_type: body.delivery?.type || "pickup",
    })
    .select("id")
    .single();

  if (orderError || !order?.id) {
    throw Object.assign(new Error("Nao foi possivel criar o pedido."), {
      status: 500,
    });
  }

  const orderId = String(order.id);

  const { error: itemsError } = await supabase.from("order_items").insert(
    calculated.map((item) => ({
      order_id: orderId,
      company_id: companyId,
      product_id: item.productId,
      product_name: item.productName,
      unit_price: item.unitPrice,
      quantity: item.quantity,
      total: item.total,
      variation_json: item.variation,
      addons_json: item.addons,
      observation: item.observation || null,
    })),
  );

  if (itemsError) {
    await supabase.from("orders").delete().eq("id", orderId);
    throw Object.assign(new Error("Nao foi possivel registrar os itens."), {
      status: 500,
    });
  }

  if (body.delivery?.type === "delivery") {
    await supabase.from("deliveries").insert({
      order_id: orderId,
      company_id: companyId,
      delivery_zone_id: deliveryZoneId,
      endereco: body.delivery.address || "",
      complemento: body.delivery.complement || "",
      referencia: body.delivery.reference || "",
      taxa: deliveryFee,
      status: "aguardando_pagamento",
    });
  }

  const transactionId = randomUUID();

  const { error: transactionError } = await supabase
    .from("marketplace_payments")
    .insert({
      id: transactionId,
      company_id: companyId,
      order_id: orderId,
      provider: "asaas",
      payment_method: body.paymentMethod,
      gross_amount: total,
      platform_fee_percent: feePercent,
      currency: "BRL",
      status: "PENDING",
      split_status: "PENDING",
      payout_status: "PENDING",
      external_reference: `order:${orderId}`,
      idempotency_key: key,
      expires_at: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
    });

  if (transactionError) {
    throw Object.assign(new Error("Nao foi possivel iniciar a transacao."), {
      status: 500,
    });
  }

  const provider = new AsaasProvider(providerAccount.apiKey);
  const customerId = await providerCustomer(
    provider,
    supabase,
    companyId,
    body.customer,
  );

  const splits = [
    {
      walletId: requireAsaasRootWalletId(),
      percentualValue: feePercent,
      externalReference: `commission:${transactionId}`,
      description: "Comissao Orcaly",
    },
  ];

  try {
    const dueDate = new Date().toISOString().slice(0, 10);
    const common = {
      customer: customerId,
      value: total,
      dueDate,
      description: `Pedido ${orderId}`,
      externalReference: `order:${orderId}`,
      splits,
    };

    const payment =
      body.paymentMethod === "PIX"
        ? await provider.createPixPayment(common)
        : await (async () => {
            if (!body.card) {
              throw Object.assign(new Error("Informe os dados do cartao."), {
                status: 400,
              });
            }

            const tokenized = await provider.tokenizeCreditCard({
              customer: customerId,
              creditCard: body.card,
              creditCardHolderInfo: {
                name: body.customer.name,
                email: body.customer.email,
                cpfCnpj: body.customer.cpfCnpj,
                postalCode: body.customer.postalCode || "",
                addressNumber: body.customer.addressNumber || "",
                addressComplement: body.customer.addressComplement || "",
                mobilePhone: body.customer.phone,
              },
              remoteIp: getRequestIp(request),
            });

            return provider.createCardPayment({
              ...common,
              customer: customerId,
              remoteIp: getRequestIp(request),
              creditCardToken: text(tokenized.creditCardToken),
            });
          })();

    await supabase
      .from("marketplace_payments")
      .update({
        provider_payment_id: payment.id,
        provider_customer_id: customerId,
        status: payment.status,
        card_brand: payment.creditCardBrand || null,
        card_last4: payment.creditCardNumber || null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", transactionId)
      .eq("company_id", companyId);

    return {
      repeated: false,
      transactionId,
      orderId,
      paymentId: payment.id,
      status: payment.status,
      total,
      pix:
        body.paymentMethod === "PIX"
          ? {
              encodedImage: payment.encodedImage,
              payload: payment.payload,
              expirationDate: payment.expirationDate,
            }
          : undefined,
    };
  } catch (error) {
    await supabase
      .from("marketplace_payments")
      .update({
        status: "FAILED",
        error_message:
          error instanceof Error
            ? error.message.slice(0, 500)
            : "Falha no provider",
        updated_at: new Date().toISOString(),
      })
      .eq("id", transactionId)
      .eq("company_id", companyId);

    throw error;
  }
}
