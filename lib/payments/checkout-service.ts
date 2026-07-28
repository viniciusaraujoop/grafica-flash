import "server-only";
import {
  createHash,
  randomUUID,
} from "node:crypto";
import type { NextRequest } from "next/server";
import { getPlanConfig } from "@/lib/plans/plan-config";
import {
  createMercadoPagoPayment,
  getMercadoPagoPayment,
  getOrcalyAppUrl,
  mapMercadoPagoStatus,
  protectMercadoPagoToken,
  refreshMercadoPagoAccessToken,
  unprotectMercadoPagoToken,
} from "@/lib/mercado-pago";
import {
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

type CheckoutCustomer = {
  name: string;
  email: string;
  phone: string;
  cpfCnpj: string;
  postalCode?: string;
  addressNumber?: string;
  addressComplement?: string;
};

type CheckoutDelivery = {
  type: "delivery" | "pickup";
  zoneId?: string;
  address?: string;
  complement?: string;
  reference?: string;
};

type CardPaymentData = {
  token: string;
  paymentMethodId: string;
  issuerId?: string;
  installments?: number;
  identificationType?: string;
  identificationNumber?: string;
};

type CheckoutBody = {
  items: CheckoutItem[];
  customer?: CheckoutCustomer;
  delivery?: CheckoutDelivery;
  couponCode?: string;
  paymentMethod?: "PIX" | "CREDIT_CARD" | "DEBIT_CARD";
  cardPayment?: CardPaymentData;
  paymentFormData?: JsonRecord;
};

type CheckoutCalculation = {
  supabase: Awaited<
    ReturnType<typeof resolveCompanyBySlug>
  >["supabase"];
  company: JsonRecord;
  companyId: string;
  calculated: Array<{
    productId: string;
    productName: string;
    quantity: number;
    unitPrice: number;
    total: number;
    variation: unknown;
    addons: unknown[];
    observation: string;
  }>;
  subtotal: number;
  discountAmount: number;
  couponId: string | null;
  deliveryFee: number;
  deliveryZoneId: string | null;
  total: number;
  feePercent: number;
  commissionAmount: number;
};

const text = (value: unknown) =>
  String(value || "").trim();

const money = (value: unknown) => {
  const parsed = Number(value || 0);

  return Number.isFinite(parsed)
    ? Math.round(parsed * 100) / 100
    : 0;
};

const array = (value: unknown) =>
  Array.isArray(value) ? value : [];

function digits(value: unknown) {
  return text(value).replace(/\D/g, "");
}

function asRecord(value: unknown): JsonRecord {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  return value as JsonRecord;
}

function resolveCheckoutPaymentMethod(
  body: CheckoutBody,
): CheckoutBody["paymentMethod"] {
  const formData = asRecord(body.paymentFormData);
  const selected = text(
    formData.selected_payment_method ||
      formData.selectedPaymentMethod,
  ).toLowerCase();
  const methodId = text(
    formData.payment_method_id ||
      body.cardPayment?.paymentMethodId,
  ).toLowerCase();
  const paymentTypeId = text(
    formData.payment_type_id,
  ).toLowerCase();

  if (
    methodId === "pix" ||
    paymentTypeId === "bank_transfer" ||
    selected.includes("pix") ||
    selected.includes("bank_transfer")
  ) {
    return "PIX";
  }

  if (
    paymentTypeId === "debit_card" ||
    selected.includes("debit")
  ) {
    return "DEBIT_CARD";
  }

  if (
    paymentTypeId === "credit_card" ||
    selected.includes("credit") ||
    selected.includes("card") ||
    formData.token
  ) {
    return "CREDIT_CARD";
  }

  return body.paymentMethod;
}

function optionId(value: unknown) {
  if (!value || typeof value !== "object") {
    return "";
  }

  const record = value as JsonRecord;

  return text(
    record.id ||
      record.key ||
      record.nome ||
      record.name,
  );
}

function optionPrice(value: unknown) {
  if (!value || typeof value !== "object") {
    return 0;
  }

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
  return text(
    product.nome ||
      product.name ||
      "Produto",
  );
}

function productVariations(product: JsonRecord) {
  return array(
    product.variacoes ||
      product.variations ||
      product.opcoes_variacao,
  );
}

function productAddons(product: JsonRecord) {
  return array(
    product.adicionais ||
      product.addons ||
      product.complementos,
  );
}

function idempotencyKey(
  companyId: string,
  body: CheckoutBody,
  request: NextRequest,
) {
  const provided = text(
    request.headers.get("idempotency-key"),
  );

  if (
    provided.length >= 16 &&
    provided.length <= 128
  ) {
    return provided;
  }

  return createHash("sha256")
    .update(
      JSON.stringify({
        companyId,
        bucket: Math.floor(Date.now() / 300000),
        items: body.items,
        customer: {
          email:
            body.customer?.email?.toLowerCase(),
          phone: body.customer?.phone,
        },
        delivery: body.delivery,
        paymentMethod: body.paymentMethod,
      }),
    )
    .digest("hex");
}

function terminalStatus(status: unknown) {
  return [
    "paid",
    "failed",
    "canceled",
    "refunded",
    "charged_back",
  ].includes(text(status).toLowerCase());
}

function pixData(payment: JsonRecord) {
  const point =
    payment.point_of_interaction &&
    typeof payment.point_of_interaction ===
      "object"
      ? (payment.point_of_interaction as JsonRecord)
      : {};

  const transaction =
    point.transaction_data &&
    typeof point.transaction_data === "object"
      ? (point.transaction_data as JsonRecord)
      : {};

  return {
    encodedImage: text(
      transaction.qr_code_base64,
    ),
    payload: text(transaction.qr_code),
    ticketUrl: text(
      transaction.ticket_url,
    ),
    expirationDate: text(
      payment.date_of_expiration,
    ),
  };
}

async function getSellerAccessToken(
  supabase: CheckoutCalculation["supabase"],
  companyId: string,
) {
  const { data: setting, error } =
    await supabase
      .from("marketplace_payment_settings")
      .select(
        "id,access_token,refresh_token,public_key,token_expires_at,onboarding_status,is_active,last_error",
      )
      .eq("company_id", companyId)
      .eq("provider", "mercado_pago")
      .maybeSingle();

  if (error) throw error;

  if (
    !setting?.is_active ||
    setting.onboarding_status !== "connected" ||
    !setting.access_token
  ) {
    throw Object.assign(
      new Error(
        "Esta empresa ainda nao conectou uma conta Mercado Pago para receber.",
      ),
      { status: 409 },
    );
  }

  let accessToken =
    unprotectMercadoPagoToken(
      setting.access_token,
    );

  const expiresAt = setting.token_expires_at
    ? new Date(setting.token_expires_at)
    : null;

  const shouldRefresh =
    expiresAt &&
    !Number.isNaN(expiresAt.getTime()) &&
    expiresAt.getTime() <=
      Date.now() + 10 * 60 * 1000;

  if (shouldRefresh) {
    if (!setting.refresh_token) {
      throw Object.assign(
        new Error(
          "A autorizacao Mercado Pago expirou. Reconecte a conta no painel de pagamentos.",
        ),
        { status: 409 },
      );
    }

    try {
      const refreshed =
        await refreshMercadoPagoAccessToken(
          unprotectMercadoPagoToken(
            setting.refresh_token,
          ),
        );

      accessToken = text(
        refreshed.access_token,
      );

      if (!accessToken) {
        throw new Error(
          "O Mercado Pago nao retornou o novo token.",
        );
      }

      const refreshToken = text(
        refreshed.refresh_token,
      );
      const expiresIn = Number(
        refreshed.expires_in || 0,
      );
      const tokenExpiresAt =
        expiresIn > 0
          ? new Date(
              Date.now() +
                expiresIn * 1000,
            ).toISOString()
          : null;

      await supabase
        .from(
          "marketplace_payment_settings",
        )
        .update({
          access_token:
            protectMercadoPagoToken(
              accessToken,
            ),
          refresh_token: refreshToken
            ? protectMercadoPagoToken(
                refreshToken,
              )
            : setting.refresh_token,
          public_key:
            refreshed.public_key ||
            setting.public_key ||
            null,
          token_expires_at:
            tokenExpiresAt,
          last_error: null,
          updated_at:
            new Date().toISOString(),
        })
        .eq("id", setting.id);
    } catch (cause) {
      const message =
        cause instanceof Error
          ? cause.message
          : "Falha ao renovar Mercado Pago.";

      await supabase
        .from(
          "marketplace_payment_settings",
        )
        .update({
          onboarding_status: "error",
          last_error: message.slice(0, 500),
          updated_at:
            new Date().toISOString(),
        })
        .eq("id", setting.id);

      throw Object.assign(
        new Error(
          "A autorizacao Mercado Pago precisa ser renovada no painel de pagamentos.",
        ),
        { status: 409 },
      );
    }
  }

  return accessToken;
}

async function calculateCheckout(
  slug: string,
  body: CheckoutBody,
): Promise<CheckoutCalculation> {
  if (
    !Array.isArray(body.items) ||
    body.items.length === 0
  ) {
    throw Object.assign(
      new Error("O carrinho esta vazio."),
      { status: 400 },
    );
  }

  const { supabase, company } =
    await resolveCompanyBySlug(slug);
  const companyRecord =
    company as JsonRecord;
  const companyId = text(company.id);
  const productIds = Array.from(
    new Set(
      body.items.map((item) =>
        text(item.productId),
      ),
    ),
  );

  const { data: products, error: productsError } =
    await supabase
      .from("products")
      .select("*")
      .eq("company_id", companyId)
      .in("id", productIds);

  if (
    productsError ||
    !products ||
    products.length !== productIds.length
  ) {
    throw Object.assign(
      new Error(
        "Um ou mais produtos nao estao disponiveis.",
      ),
      { status: 400 },
    );
  }

  const byId = new Map<
    string,
    JsonRecord
  >(
    products.map(
      (item): [string, JsonRecord] => {
        const record =
          item as JsonRecord;

        return [
          text(record.id),
          record,
        ];
      },
    ),
  );

  const calculated = body.items.map(
    (input) => {
      const product = byId.get(
        text(input.productId),
      );

      if (
        !product ||
        product.ativo === false
      ) {
        throw Object.assign(
          new Error(
            "Um produto ficou indisponivel.",
          ),
          { status: 400 },
        );
      }

      const quantity = Math.max(
        1,
        Math.min(
          999,
          Number(input.quantity || 1),
        ),
      );

      const variation =
        productVariations(product).find(
          (item) =>
            optionId(item) ===
            text(input.variationId),
        );

      if (
        input.variationId &&
        !variation
      ) {
        throw Object.assign(
          new Error(
            "A variacao selecionada nao esta disponivel.",
          ),
          { status: 400 },
        );
      }

      const addonIds = new Set(
        input.addonIds || [],
      );

      const addons =
        productAddons(product).filter(
          (item) =>
            addonIds.has(optionId(item)),
        );

      if (addons.length !== addonIds.size) {
        throw Object.assign(
          new Error(
            "Um adicional nao esta disponivel.",
          ),
          { status: 400 },
        );
      }

      const unitPrice = money(
        productPrice(product) +
          optionPrice(variation) +
          addons.reduce(
            (sum, item) =>
              sum + optionPrice(item),
            0,
          ),
      );

      return {
        productId: text(product.id),
        productName:
          productName(product),
        quantity,
        unitPrice,
        total: money(
          unitPrice * quantity,
        ),
        variation: variation || null,
        addons,
        observation: text(
          input.observation,
        ),
      };
    },
  );

  const subtotal = money(
    calculated.reduce(
      (sum, item) =>
        sum + item.total,
      0,
    ),
  );

  let discountAmount = 0;
  let couponId: string | null = null;

  if (text(body.couponCode)) {
    const { data: coupon } =
      await supabase
        .from("coupons")
        .select("*")
        .eq("company_id", companyId)
        .ilike(
          "codigo",
          text(body.couponCode),
        )
        .eq("ativo", true)
        .maybeSingle();

    if (!coupon) {
      throw Object.assign(
        new Error(
          "Cupom invalido ou indisponivel.",
        ),
        { status: 400 },
      );
    }

    const record =
      coupon as JsonRecord;
    const minimum = money(
      record.valor_minimo ||
        record.minimum_amount,
    );

    if (subtotal < minimum) {
      throw Object.assign(
        new Error(
          "O pedido nao atingiu o valor minimo do cupom.",
        ),
        { status: 400 },
      );
    }

    const type = text(
      record.tipo || record.type,
    ).toLowerCase();
    const value = money(
      record.valor || record.value,
    );

    discountAmount =
      type.includes("percent")
        ? money(
            subtotal * (value / 100),
          )
        : Math.min(subtotal, value);

    couponId =
      text(record.id) || null;
  }

  let deliveryFee = 0;
  let deliveryZoneId:
    | string
    | null = null;

  if (
    body.delivery?.type === "delivery"
  ) {
    const { data: zone } =
      await supabase
        .from("delivery_zones")
        .select("*")
        .eq(
          "id",
          body.delivery.zoneId || "",
        )
        .eq("company_id", companyId)
        .eq("ativo", true)
        .maybeSingle();

    if (!zone) {
      throw Object.assign(
        new Error(
          "A regiao de entrega nao esta disponivel.",
        ),
        { status: 400 },
      );
    }

    const record =
      zone as JsonRecord;
    const minimum = money(
      record.pedido_minimo ||
        record.minimum_order,
    );

    if (
      subtotal - discountAmount <
      minimum
    ) {
      throw Object.assign(
        new Error(
          "O pedido nao atingiu o minimo para esta regiao.",
        ),
        { status: 400 },
      );
    }

    deliveryFee = money(
      record.taxa || record.fee,
    );
    deliveryZoneId =
      text(record.id);
  }

  const total = money(
    subtotal -
      discountAmount +
      deliveryFee,
  );

  if (total <= 0) {
    throw Object.assign(
      new Error(
        "O total do pedido precisa ser maior que zero.",
      ),
      { status: 400 },
    );
  }

  const plan = getPlanConfig(
    companyRecord.assinatura_plano ||
      companyRecord.plano ||
      companyRecord.plan,
  );
  const feePercent =
    plan.marketplaceFeePercent;
  const commissionAmount = money(
    total * (feePercent / 100),
  );

  return {
    supabase,
    company: companyRecord,
    companyId,
    calculated,
    subtotal,
    discountAmount,
    couponId,
    deliveryFee,
    deliveryZoneId,
    total,
    feePercent,
    commissionAmount,
  };
}

export async function getCheckoutCatalog(
  slug: string,
) {
  const { supabase, company } =
    await resolveCompanyBySlug(slug);
  const companyId = text(company.id);

  const [
    { data: products },
    { data: zones },
    { data: account },
  ] = await Promise.all([
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
      .from(
        "marketplace_payment_settings",
      )
      .select(
        "access_token,onboarding_status,is_active,last_error",
      )
      .eq("company_id", companyId)
      .eq("provider", "mercado_pago")
      .maybeSingle(),
  ]);

  const connected = Boolean(
    account?.is_active &&
      account?.access_token &&
      account?.onboarding_status ===
        "connected",
  );

  return {
    company: {
      name: text(
        company.nome || company.name,
      ),
      logoUrl: text(
        company.logo_url ||
          company.logo,
      ),
      primaryColor: text(
        company.site_primary_color ||
          company.cor_primaria,
      ),
      slug,
    },
    products: (products || []).map(
      (raw) => {
        const product =
          raw as JsonRecord;

        return {
          id: text(product.id),
          name: productName(product),
          description: text(
            product.descricao ||
              product.description,
          ),
          price: productPrice(product),
          imageUrl: text(
            product.imagem_url ||
              product.image_url,
          ),
          variations:
            productVariations(
              product,
            ).map((item) => {
              const record =
                item as JsonRecord;

              return {
                id: optionId(item),
                name:
                  text(
                    record.nome ||
                      record.name,
                  ) || optionId(item),
                priceDelta:
                  optionPrice(item),
              };
            }),
          addons:
            productAddons(
              product,
            ).map((item) => {
              const record =
                item as JsonRecord;

              return {
                id: optionId(item),
                name:
                  text(
                    record.nome ||
                      record.name,
                  ) || optionId(item),
                price:
                  optionPrice(item),
              };
            }),
        };
      },
    ),
    deliveryZones: (zones || []).map(
      (raw) => {
        const zone =
          raw as JsonRecord;

        return {
          id: text(zone.id),
          name: text(
            zone.nome ||
              zone.name,
          ),
          fee: money(
            zone.taxa || zone.fee,
          ),
          minimumOrder: money(
            zone.pedido_minimo ||
              zone.minimum_order,
          ),
        };
      },
    ),
    payment: {
      provider: "mercado_pago",
      configured: connected,
      chargesEnabled: connected,
      pixEnabled: connected,
      cardEnabled:
        connected &&
        Boolean(
          process.env
            .NEXT_PUBLIC_MP_MARKETPLACE_PUBLIC_KEY,
        ),
      lastError:
        account?.last_error || null,
    },
  };
}

export async function prepareCheckoutPayment(
  slug: string,
  body: CheckoutBody,
) {
  const calculation =
    await calculateCheckout(slug, body);

  return {
    subtotal: calculation.subtotal,
    discountAmount:
      calculation.discountAmount,
    deliveryFee:
      calculation.deliveryFee,
    total: calculation.total,
    commissionPercentage:
      calculation.feePercent,
  };
}

async function persistPaymentStatus(
  calculation: Pick<
    CheckoutCalculation,
    "supabase" | "companyId"
  >,
  transaction: {
    id: string;
    orderId: string;
  },
  payment: JsonRecord,
) {
  const remoteStatus = text(
    payment.status,
  );
  const mappedStatus =
    mapMercadoPagoStatus(remoteStatus);
  const paidAt =
    mappedStatus === "paid"
      ? text(payment.date_approved) ||
        new Date().toISOString()
      : null;
  const paymentId = text(payment.id);
  const methodId = text(
    payment.payment_method_id,
  );
  const card =
    payment.card &&
    typeof payment.card === "object"
      ? (payment.card as JsonRecord)
      : {};
  const lastFour = text(
    card.last_four_digits,
  );

  await Promise.all([
    calculation.supabase
      .from("marketplace_payments")
      .update({
        provider_payment_id:
          paymentId || null,
        provider_status:
          remoteStatus || null,
        status: mappedStatus,
        raw_payload: payment,
        card_brand:
          methodId || null,
        card_last4:
          lastFour || null,
        paid_at: paidAt,
        updated_at:
          new Date().toISOString(),
      })
      .eq("id", transaction.id)
      .eq(
        "company_id",
        calculation.companyId,
      ),
    calculation.supabase
      .from("orders")
      .update({
        marketplace_payment_id:
          transaction.id,
        payment_provider:
          "mercado_pago",
        payment_status:
          mappedStatus,
        status:
          mappedStatus === "paid"
            ? "Recebido"
            : "pending_payment",
        paid_at: paidAt,
        updated_at:
          new Date().toISOString(),
      })
      .eq("id", transaction.orderId)
      .eq(
        "company_id",
        calculation.companyId,
      ),
    calculation.supabase
      .from("order_payments")
      .update({
        provider:
          "mercado_pago",
        provider_payment_id:
          paymentId || null,
        provider_status:
          remoteStatus || null,
        status: mappedStatus,
        paid_amount:
          mappedStatus === "paid"
            ? Number(
                payment.transaction_amount ||
                  0,
              )
            : 0,
        remaining_amount:
          mappedStatus === "paid"
            ? 0
            : Number(
                payment.transaction_amount ||
                  0,
              ),
        paid_at: paidAt,
        updated_at:
          new Date().toISOString(),
      })
      .eq("order_id", transaction.orderId)
      .eq(
        "company_id",
        calculation.companyId,
      ),
  ]);

  if (mappedStatus === "paid") {
    await calculation.supabase
      .from(
        "marketplace_commissions",
      )
      .update({
        status: "confirmed",
        confirmed_at:
          new Date().toISOString(),
        updated_at:
          new Date().toISOString(),
      })
      .eq(
        "marketplace_payment_id",
        transaction.id,
      )
      .eq(
        "company_id",
        calculation.companyId,
      );
  }

  return {
    mappedStatus,
    remoteStatus,
    paidAt,
  };
}

export async function createCheckoutPayment(
  slug: string,
  body: CheckoutBody,
  request: NextRequest,
) {
  body.paymentMethod = resolveCheckoutPaymentMethod(body);

  if (
    !body.customer?.name ||
    !body.customer?.email ||
    !body.customer?.cpfCnpj
  ) {
    throw Object.assign(
      new Error(
        "Informe nome, e-mail e CPF ou CNPJ para continuar.",
      ),
      { status: 400 },
    );
  }

  if (
    !body.customer.email.includes("@")
  ) {
    throw Object.assign(
      new Error(
        "Informe um e-mail valido.",
      ),
      { status: 400 },
    );
  }

  if (
    body.paymentMethod !== "PIX" &&
    body.paymentMethod !== "CREDIT_CARD" &&
    body.paymentMethod !== "DEBIT_CARD"
  ) {
    throw Object.assign(
      new Error(
        "Selecione Pix, cartão de crédito ou débito.",
      ),
      { status: 400 },
    );
  }

  const calculation =
    await calculateCheckout(slug, body);
  const {
    supabase,
    company,
    companyId,
  } = calculation;
  const accessToken =
    await getSellerAccessToken(
      supabase,
      companyId,
    );
  const key = idempotencyKey(
    companyId,
    body,
    request,
  );

  const { data: existing } =
    await supabase
      .from("marketplace_payments")
      .select(
        "id,order_id,provider_payment_id,status,amount,gross_amount,raw_payload",
      )
      .eq("company_id", companyId)
      .eq("idempotency_key", key)
      .maybeSingle();

  if (existing?.provider_payment_id) {
    const raw =
      existing.raw_payload &&
      typeof existing.raw_payload ===
        "object"
        ? (existing.raw_payload as JsonRecord)
        : {};

    return {
      repeated: true,
      transactionId: existing.id,
      orderId: existing.order_id,
      paymentId:
        existing.provider_payment_id,
      status: existing.status,
      total: money(
        existing.gross_amount ||
          existing.amount,
      ),
      pix:
        body.paymentMethod === "PIX"
          ? pixData(raw)
          : undefined,
    };
  }

  const { data: order, error: orderError } =
    await supabase
      .from("orders")
      .insert({
        company_id: companyId,
        nome: body.customer.name,
        customer_name:
          body.customer.name,
        customer_email:
          body.customer.email,
        customer_phone:
          body.customer.phone,
        telefone: body.customer.phone,
        produto:
          calculation.calculated
            .map(
              (item) =>
                item.productName,
            )
            .join(", "),
        quantidade:
          calculation.calculated.reduce(
            (sum, item) =>
              sum + item.quantity,
            0,
          ),
        observacoes:
          calculation.calculated
            .map(
              (item) =>
                item.observation,
            )
            .filter(Boolean)
            .join(" | "),
        status: "pending_payment",
        payment_provider:
          "mercado_pago",
        payment_status: "pending",
        payment_method:
          body.paymentMethod,
        subtotal:
          calculation.subtotal,
        discount_amount:
          calculation.discountAmount,
        delivery_fee:
          calculation.deliveryFee,
        total: calculation.total,
        total_amount:
          calculation.total,
        preco_estimado:
          calculation.total,
        coupon_id:
          calculation.couponId,
        coupon_code:
          text(body.couponCode) ||
          null,
        checkout_idempotency_key:
          key,
        delivery_type:
          body.delivery?.type ||
          "pickup",
      })
      .select("id")
      .single();

  if (orderError || !order?.id) {
    throw Object.assign(
      new Error(
        orderError?.message ||
          "Nao foi possivel criar o pedido.",
      ),
      { status: 500 },
    );
  }

  const orderId = String(order.id);

  const { error: itemsError } =
    await supabase
      .from("order_items")
      .insert(
        calculation.calculated.map(
          (item) => ({
            order_id: orderId,
            company_id: companyId,
            product_id:
              item.productId,
            nome: item.productName,
            product_name:
              item.productName,
            quantidade:
              item.quantity,
            quantity: item.quantity,
            preco_unitario:
              item.unitPrice,
            unit_price:
              item.unitPrice,
            subtotal: item.total,
            total: item.total,
            variation:
              item.variation || {},
            variation_json:
              item.variation,
            addons:
              item.addons,
            addons_json:
              item.addons,
            notes:
              item.observation ||
              null,
            observation:
              item.observation ||
              null,
          }),
        ),
      );

  if (itemsError) {
    await supabase
      .from("orders")
      .delete()
      .eq("id", orderId);

    throw Object.assign(
      new Error(
        "Nao foi possivel registrar os itens.",
      ),
      { status: 500 },
    );
  }

  if (
    body.delivery?.type === "delivery"
  ) {
    await supabase
      .from("deliveries")
      .insert({
        order_id: orderId,
        company_id: companyId,
        delivery_zone_id:
          calculation.deliveryZoneId,
        customer_name:
          body.customer.name,
        customer_phone:
          body.customer.phone,
        endereco:
          body.delivery.address ||
          "",
        address:
          body.delivery.address ||
          "",
        complemento:
          body.delivery.complement ||
          "",
        referencia:
          body.delivery.reference ||
          "",
        taxa:
          calculation.deliveryFee,
        delivery_fee:
          calculation.deliveryFee,
        status:
          "aguardando_pagamento",
      });
  }

  const transactionId =
    randomUUID();
  const externalReference =
    `orcaly:${companyId}:${orderId}:${transactionId}`;
  const sellerNetEstimate = money(
    calculation.total -
      calculation.commissionAmount,
  );

  const { error: transactionError } =
    await supabase
      .from("marketplace_payments")
      .insert({
        id: transactionId,
        company_id: companyId,
        order_id: orderId,
        provider: "mercado_pago",
        payment_method:
          body.paymentMethod,
        gross_amount:
          calculation.total,
        amount: calculation.total,
        subtotal:
          calculation.subtotal,
        delivery_fee:
          calculation.deliveryFee,
        discount_amount:
          calculation.discountAmount,
        commission_amount:
          calculation.commissionAmount,
        commission_percentage:
          calculation.feePercent,
        platform_fee_percent:
          calculation.feePercent,
        platform_fee_amount:
          calculation.commissionAmount,
        seller_net_amount:
          sellerNetEstimate,
        currency: "BRL",
        status: "pending",
        provider_status: "pending",
        split_status: "pending",
        payout_status:
          "provider_managed",
        external_reference:
          externalReference,
        idempotency_key: key,
        expires_at:
          new Date(
            Date.now() +
              30 * 60 * 1000,
          ).toISOString(),
        payer_name:
          body.customer.name,
        payer_email:
          body.customer.email,
        payer_phone:
          body.customer.phone,
        raw_payload: {
          stage:
            "before_provider_request",
          checkout: "transparent",
        },
      });

  if (transactionError) {
    throw Object.assign(
      new Error(
        transactionError.message ||
          "Nao foi possivel iniciar a transacao.",
      ),
      { status: 500 },
    );
  }

  await supabase
    .from("orders")
    .update({
      marketplace_payment_id:
        transactionId,
    })
    .eq("id", orderId)
    .eq("company_id", companyId);

  await Promise.all([
    supabase
      .from("order_payments")
      .insert({
        company_id: companyId,
        order_id: orderId,
        type: "full",
        status: "pending",
        amount:
          calculation.total,
        paid_amount: 0,
        remaining_amount:
          calculation.total,
        provider: "mercado_pago",
        idempotency_key: key,
        external_reference:
          externalReference,
      }),
    supabase
      .from(
        "marketplace_commissions",
      )
      .insert({
        company_id: companyId,
        order_id: orderId,
        marketplace_payment_id:
          transactionId,
        provider: "mercado_pago",
        gross_amount:
          calculation.total,
        commission_percentage:
          calculation.feePercent,
        commission_fixed: 0,
        commission_amount:
          calculation.commissionAmount,
        fee_percent:
          calculation.feePercent,
        estimated_amount:
          calculation.commissionAmount,
        calculation_base:
          "gross_amount",
        status: "pending",
        external_reference:
          `commission:${transactionId}`,
      }),
  ]);

  const paymentForm =
    asRecord(body.paymentFormData);
  const paymentPayer =
    asRecord(paymentForm.payer);
  const paymentIdentification =
    asRecord(paymentPayer.identification);
  const customerDocument =
    digits(body.customer.cpfCnpj);
  const identificationType =
    text(
      paymentIdentification.type ||
        body.cardPayment?.identificationType,
    ) ||
    (customerDocument.length === 14
      ? "CNPJ"
      : "CPF");
  const identificationNumber =
    digits(
      paymentIdentification.number ||
        body.cardPayment?.identificationNumber ||
        customerDocument,
    );
  const appUrl = getOrcalyAppUrl();
  const paymentPayload: JsonRecord = {
    transaction_amount:
      calculation.total,
    description:
      `Pedido ${orderId} - ${text(
        company.nome || company.name,
      )}`.slice(0, 120),
    external_reference:
      externalReference,
    application_fee:
      calculation.commissionAmount,
    notification_url:
      `${appUrl}/api/marketplace/payments/webhook/mercado-pago` +
      `?company_id=${encodeURIComponent(companyId)}` +
      `&marketplace_payment_id=${encodeURIComponent(transactionId)}`,
    statement_descriptor: "ORCALY",
    binary_mode: false,
    metadata: {
      company_id: companyId,
      order_id: orderId,
      marketplace_payment_id:
        transactionId,
      payment_method:
        body.paymentMethod,
      slug,
    },
    payer: {
      email:
        body.customer.email,
      first_name:
        body.customer.name,
      identification: {
        type: identificationType,
        number:
          identificationNumber,
      },
    },
    additional_info: {
      items:
        calculation.calculated.map(
          (item) => ({
            id: item.productId,
            title:
              item.productName,
            quantity:
              item.quantity,
            unit_price:
              item.unitPrice,
          }),
        ),
      payer: {
        first_name:
          body.customer.name,
        phone: {
          number:
            body.customer.phone,
        },
      },
    },
  };

  if (
    body.paymentMethod === "PIX"
  ) {
    paymentPayload.payment_method_id =
      "pix";
    paymentPayload.date_of_expiration =
      new Date(
        Date.now() +
          30 * 60 * 1000,
      ).toISOString();
  } else {
    const card =
      body.cardPayment;
    const cardToken =
      text(paymentForm.token || card?.token);
    const cardMethodId =
      text(
        paymentForm.payment_method_id ||
          card?.paymentMethodId,
      );
    const issuerId =
      text(
        paymentForm.issuer_id ||
          card?.issuerId,
      );
    const installments =
      body.paymentMethod === "DEBIT_CARD"
        ? 1
        : Math.max(
            1,
            Math.min(
              12,
              Number(
                paymentForm.installments ||
                  card?.installments ||
                  1,
              ),
            ),
          );

    if (
      !cardToken ||
      !cardMethodId
    ) {
      throw Object.assign(
        new Error(
          "Os dados seguros do cartão não foram gerados.",
        ),
        { status: 400 },
      );
    }

    paymentPayload.token =
      cardToken;
    paymentPayload.installments =
      installments;
    paymentPayload.payment_method_id =
      cardMethodId;

    if (issuerId) {
      paymentPayload.issuer_id =
        issuerId;
    }
  }

  try {
    const payment =
      (await createMercadoPagoPayment(
        accessToken,
        paymentPayload,
        key,
      )) as JsonRecord;

    const status =
      await persistPaymentStatus(
        calculation,
        {
          id: transactionId,
          orderId,
        },
        payment,
      );

    return {
      repeated: false,
      transactionId,
      orderId,
      paymentId: text(payment.id),
      status:
        status.mappedStatus,
      providerStatus:
        status.remoteStatus,
      total: calculation.total,
      commissionAmount:
        calculation.commissionAmount,
      pix:
        body.paymentMethod === "PIX"
          ? pixData(payment)
          : undefined,
    };
  } catch (cause) {
    const message =
      cause instanceof Error
        ? cause.message
        : "Falha no Mercado Pago.";

    await Promise.all([
      supabase
        .from(
          "marketplace_payments",
        )
        .update({
          status: "failed",
          last_error:
            message.slice(0, 500),
          error_message:
            message.slice(0, 500),
          updated_at:
            new Date().toISOString(),
        })
        .eq("id", transactionId)
        .eq(
          "company_id",
          companyId,
        ),
      supabase
        .from("order_payments")
        .update({
          status: "failed",
          notes:
            message.slice(0, 500),
          updated_at:
            new Date().toISOString(),
        })
        .eq("order_id", orderId)
        .eq(
          "company_id",
          companyId,
        ),
    ]);

    throw cause;
  }
}

export async function getCheckoutPaymentStatus(
  slug: string,
  paymentId: string,
) {
  const { supabase, company } =
    await resolveCompanyBySlug(slug);
  const companyId = text(company.id);

  const { data: transaction } =
    await supabase
      .from("marketplace_payments")
      .select(
        "id,order_id,provider_payment_id,status,provider_status,paid_at",
      )
      .eq("company_id", companyId)
      .eq("provider", "mercado_pago")
      .eq(
        "provider_payment_id",
        paymentId,
      )
      .maybeSingle();

  if (!transaction) {
    throw Object.assign(
      new Error(
        "Pagamento nao encontrado.",
      ),
      { status: 404 },
    );
  }

  if (
    terminalStatus(
      transaction.status,
    )
  ) {
    return transaction;
  }

  const accessToken =
    await getSellerAccessToken(
      supabase,
      companyId,
    );
  const payment =
    (await getMercadoPagoPayment(
      accessToken,
      paymentId,
    )) as JsonRecord;
  const status =
    await persistPaymentStatus(
      { supabase, companyId },
      {
        id: String(transaction.id),
        orderId: String(
          transaction.order_id,
        ),
      },
      payment,
    );

  return {
    ...transaction,
    status: status.mappedStatus,
    providerStatus:
      status.remoteStatus,
    paidAt: status.paidAt,
  };
}
