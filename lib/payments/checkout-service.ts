import "server-only";
import { validateCheckoutPayload } from "@/lib/payments/checkout-validation";
// ORCALY_MP_TRANSPARENT_CHECKOUT_V1
import {
  createHash,
  randomUUID,
} from "node:crypto";
import type { NextRequest } from "next/server";
import { getPlanConfig } from "@/lib/plans/plan-config";
// ORCALY_MP_APPLICATION_FEE_OAUTH_V1
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
import {
  getCheckoutOptionPayload,
  getOptionSelectionSummary,
  getOptionSelectionsPrice,
  getProductOptionGroups,
  validateProductOptionSelections,
  type ProductOptionSelections,
} from "@/lib/product-options";

type JsonRecord = Record<string, unknown>;

type CheckoutItem = {
  productId: string;
  quantity: number;
  variationId?: string;
  addonIds?: string[];
  optionSelections?: ProductOptionSelections;
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

function normalizeMarketplaceCouponCode(value: unknown) {
  return text(value)
    .toUpperCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/Ç/g, "C")
    .replace(/[^A-Z0-9-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 32);
}

function normalizeMarketplaceCouponType(coupon: JsonRecord) {
  const raw = text(
    coupon.coupon_type ||
      coupon.tipo,
  ).toLowerCase();

  if (
    coupon.free_delivery === true ||
    ["free_delivery", "frete_gratis", "frete-gratis"].includes(raw)
  ) {
    return "free_delivery";
  }

  if (["fixed", "fixo"].includes(raw)) {
    return "fixed";
  }

  return "percentage";
}

function digits(value: unknown) {
  return text(value).replace(/\D/g, "");
}

function asRecord(value: unknown): JsonRecord {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  return value as JsonRecord;
}

function marketplacePublicKey() {
  return text(
    process.env.NEXT_PUBLIC_MP_MARKETPLACE_PUBLIC_KEY,
  );
}

function verifiedMarketplaceOauth(value: unknown) {
  const metadata = asRecord(value);
  const configuredClientId = text(
    process.env.MP_MARKETPLACE_CLIENT_ID,
  );

  return Boolean(
    configuredClientId &&
      metadata.oauth_grant_type === "authorization_code" &&
      text(metadata.marketplace_client_id) ===
        configuredClientId,
  );
}

function mercadoPagoProviderErrorCode(cause: unknown) {
  if (!cause || typeof cause !== "object") return 0;

  const providerPayload =
    "providerPayload" in cause
      ? asRecord(
          (
            cause as {
              providerPayload?: unknown;
            }
          ).providerPayload,
        )
      : {};
  const directCode = Number(
    providerPayload.code ||
      providerPayload.status ||
      0,
  );

  if (directCode) return directCode;

  for (const rawCause of array(providerPayload.cause)) {
    const record = asRecord(rawCause);
    const code = Number(
      record.code ||
        record.status ||
        0,
    );

    if (code) return code;
  }

  return 0;
}

// ORCALY_SERVER_OPTION_VALIDATION_1C1
function normalizeOptionSelections(
  value: unknown,
): ProductOptionSelections {
  const record = asRecord(value);

  return Object.fromEntries(
    Object.entries(record).map(([groupId, selected]) => [
      groupId,
      Array.from(
        new Set(
          array(selected)
            .map((item) => text(item))
            .filter(Boolean),
        ),
      ),
    ]),
  ) as ProductOptionSelections;
}

function assertProductAvailability(
  product: JsonRecord,
  quantity: number,
) {
  if (product.available === false) {
    throw Object.assign(
      new Error("Um produto ficou indisponivel."),
      { status: 409 },
    );
  }

  const extras = asRecord(product.extras);
  const controlled =
    extras.controle_estoque === true ||
    extras.stock_control === true ||
    product.controle_estoque === true ||
    product.stock_control === true;

  if (!controlled) return;

  const rawStock =
    extras.estoque ??
    extras.stock ??
    product.estoque ??
    product.stock ??
    0;
  const parsedStock = Number(rawStock);
  const stock = Number.isFinite(parsedStock)
    ? Math.max(0, Math.floor(parsedStock))
    : 0;

  if (quantity > stock) {
    throw Object.assign(
      new Error(
        stock > 0
          ? `Estoque insuficiente para ${productName(product)}. Disponivel: ${stock}.`
          : `${productName(product)} esta esgotado.`,
      ),
      { status: 409 },
    );
  }
}

function resolveConfiguredProductOptions(
  product: JsonRecord,
  input: CheckoutItem,
) {
  const groups = getProductOptionGroups({
    extras: asRecord(product.extras),
    variations: product.variations,
    addons: product.addons,
    variacoes: product.variacoes,
    adicionais: product.adicionais,
    configuracoes: asRecord(product.configuracoes),
  });

  if (!groups.length) return null;

  const provided = normalizeOptionSelections(
    input.optionSelections,
  );
  const groupIds = new Set(
    groups.map((group) => group.id),
  );
  const ownerByOptionId = new Map<string, string>();

  for (const group of groups) {
    for (const option of group.options) {
      const previousOwner =
        ownerByOptionId.get(option.id);

      if (
        previousOwner &&
        previousOwner !== group.id
      ) {
        throw Object.assign(
          new Error(
            `A configuracao de opcoes de ${productName(product)} possui identificadores duplicados.`,
          ),
          { status: 409 },
        );
      }

      ownerByOptionId.set(
        option.id,
        group.id,
      );
    }
  }

  for (const [groupId, selected] of Object.entries(provided)) {
    if (selected.length && !groupIds.has(groupId)) {
      throw Object.assign(
        new Error(
          "Um grupo de opcoes nao esta mais disponivel.",
        ),
        { status: 400 },
      );
    }
  }

  const compatibilityIds = [
    text(input.variationId),
    ...array(input.addonIds)
      .map((item) => text(item)),
  ].filter(Boolean);
  const submittedIds = new Set([
    ...compatibilityIds,
    ...Object.values(provided).flat(),
  ]);

  for (const optionIdValue of submittedIds) {
    if (!ownerByOptionId.has(optionIdValue)) {
      throw Object.assign(
        new Error(
          "Uma opcao selecionada nao esta mais disponivel.",
        ),
        { status: 400 },
      );
    }
  }

  const selections: ProductOptionSelections =
    Object.fromEntries(
      groups.map((group) => [
        group.id,
        Array.from(
          new Set([
            ...(provided[group.id] || []),
            ...compatibilityIds.filter(
              (optionIdValue) =>
                ownerByOptionId.get(
                  optionIdValue,
                ) === group.id,
            ),
          ]),
        ),
      ]),
    );

  const validation =
    validateProductOptionSelections(
      groups,
      selections,
    );

  if (validation) {
    throw Object.assign(
      new Error(validation),
      { status: 400 },
    );
  }

  const payload = getCheckoutOptionPayload(
    groups,
    selections,
  );
  const selectedById = new Map<
    string,
    {
      groupId: string;
      groupName: string;
      selection: string;
      id: string;
      name: string;
      price: number;
    }
  >();

  for (const group of groups) {
    const selectedIds = new Set(
      selections[group.id] || [],
    );

    for (const option of group.options) {
      if (!selectedIds.has(option.id)) continue;

      selectedById.set(option.id, {
        groupId: group.id,
        groupName: group.name,
        selection: group.selection,
        id: option.id,
        name: option.name,
        price: option.price,
      });
    }
  }

  const variationEntry = payload.variationId
    ? selectedById.get(payload.variationId)
    : undefined;
  const variation: JsonRecord | null =
    variationEntry
      ? {
          id: variationEntry.id,
          name: `${variationEntry.groupName}: ${variationEntry.name}`,
          nome: `${variationEntry.groupName}: ${variationEntry.name}`,
          price: variationEntry.price,
          priceDelta: variationEntry.price,
          price_delta: variationEntry.price,
          preco: variationEntry.price,
          preco_adicional:
            variationEntry.price,
          group_id: variationEntry.groupId,
          group_name:
            variationEntry.groupName,
          selection:
            variationEntry.selection,
        }
      : null;
  const addons: JsonRecord[] = [];

  for (const addonId of payload.addonIds) {
    const entry = selectedById.get(addonId);
    if (!entry) continue;

    addons.push({
      id: entry.id,
      name: `${entry.groupName}: ${entry.name}`,
      nome: `${entry.groupName}: ${entry.name}`,
      price: entry.price,
      preco: entry.price,
      preco_adicional: entry.price,
      group_id: entry.groupId,
      group_name: entry.groupName,
      selection: entry.selection,
    });
  }

  return {
    selections,
    variation,
    addons,
    optionsPrice: money(
      getOptionSelectionsPrice(
        groups,
        selections,
      ),
    ),
    summary: getOptionSelectionSummary(
      groups,
      selections,
    ),
  };
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

// ORCALY_ATOMIC_STOCK_RESERVATION_1C2
async function expireMarketplaceStockReservations(
  supabase: CheckoutCalculation["supabase"],
) {
  const { error } = await supabase.rpc(
    "expire_marketplace_stock_reservations",
    { p_limit: 100 },
  );

  if (error) {
    throw Object.assign(
      new Error(
        `Nao foi possivel liberar reservas vencidas: ${error.message}`,
      ),
      { status: 500 },
    );
  }
}

async function reserveMarketplaceStock(
  calculation: CheckoutCalculation,
  transaction: {
    id: string;
    orderId: string;
    expiresAt: string;
  },
) {
  const { data, error } = await calculation.supabase.rpc(
    "reserve_marketplace_stock",
    {
      p_company_id: calculation.companyId,
      p_order_id: transaction.orderId,
      p_marketplace_payment_id: transaction.id,
      p_expires_at: transaction.expiresAt,
      p_items: calculation.calculated.map((item) => ({
        product_id: item.productId,
        quantity: item.quantity,
      })),
    },
  );

  if (error) {
    throw Object.assign(
      new Error(error.message || "Estoque insuficiente."),
      { status: 409 },
    );
  }

  return data;
}

async function settleMarketplaceStock(
  supabase: CheckoutCalculation["supabase"],
  companyId: string,
  transactionId: string,
  status: string,
  reason?: string,
) {
  const { data, error } = await supabase.rpc(
    "settle_marketplace_stock",
    {
      p_company_id: companyId,
      p_marketplace_payment_id: transactionId,
      p_payment_status: status,
      p_reason: reason || null,
    },
  );

  if (error) {
    throw Object.assign(
      new Error(
        `Nao foi possivel liquidar o estoque: ${error.message}`,
      ),
      { status: 500 },
    );
  }

  return data;
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
        "id,access_token,refresh_token,public_key,token_expires_at,onboarding_status,is_active,last_error,provider_metadata_sanitized",
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

  if (
    !verifiedMarketplaceOauth(
      setting.provider_metadata_sanitized,
    )
  ) {
    throw Object.assign(
      new Error(
        "Reconecte a conta Mercado Pago pelo painel. A conexão atual não foi validada como OAuth Marketplace.",
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
  // ORCALY_CHECKOUT_VALIDATION_V1
  validateCheckoutPayload(body, { requireCustomer: false });
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

  await expireMarketplaceStockReservations(
    supabase,
  );

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

      assertProductAvailability(
        product,
        quantity,
      );

      const configuredOptions =
        resolveConfiguredProductOptions(
          product,
          input,
        );
      let variation: unknown = null;
      let addons: unknown[] = [];
      let optionsPrice = 0;

      if (configuredOptions) {
        variation =
          configuredOptions.variation;
        addons = configuredOptions.addons;
        optionsPrice =
          configuredOptions.optionsPrice;
      } else {
        variation =
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
          array(input.addonIds)
            .map((item) => text(item))
            .filter(Boolean),
        );
        const legacyAddons: unknown[] =
          productAddons(product).filter(
            (item) =>
              addonIds.has(optionId(item)),
          ) as unknown[];

        if (
          legacyAddons.length !==
          addonIds.size
        ) {
          throw Object.assign(
            new Error(
              "Um adicional nao esta disponivel.",
            ),
            { status: 400 },
          );
        }

        addons = legacyAddons;
        optionsPrice =
          optionPrice(variation) +
          legacyAddons.reduce<number>(
            (sum, item) =>
              sum + optionPrice(item),
            0,
          );
      }

      const unitPrice = money(
        productPrice(product) +
          optionsPrice,
      );
      const suppliedObservation = text(
        input.observation,
      );
      const optionSummary =
        configuredOptions?.summary || "";
      const observation =
        optionSummary &&
        !suppliedObservation.includes(
          optionSummary,
        )
          ? [optionSummary, suppliedObservation]
              .filter(Boolean)
              .join(" | ")
          : suppliedObservation;

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
        observation,
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
  let productDiscount = 0;
  let deliveryDiscount = 0;
  let couponId: string | null = null;
  let deliveryFeeBase = 0;
  let deliveryFee = 0;
  let deliveryZoneId:
    | string
    | null = null;

  if (
    body.delivery?.type === "delivery"
  ) {
    const { data: zone, error: zoneError } =
      await supabase
        .from("delivery_zones")
        .select("*")
        .eq(
          "id",
          body.delivery.zoneId || "",
        )
        .eq("company_id", companyId)
        .maybeSingle();

    if (zoneError) throw zoneError;

    const record =
      zone as JsonRecord | null;
    const enabled = Boolean(
      record &&
      (
        record.is_active === true ||
        record.active === true ||
        (
          record.is_active == null &&
          record.active == null
        )
      )
    );

    if (!record || !enabled) {
      throw Object.assign(
        new Error(
          "A regiao de entrega nao esta disponivel.",
        ),
        { status: 400 },
      );
    }

    const minimum = money(
      record.minimum_order ??
        record.min_order ??
        0,
    );

    if (subtotal < minimum) {
      throw Object.assign(
        new Error(
          "O pedido nao atingiu o minimo para esta regiao.",
        ),
        { status: 400 },
      );
    }

    deliveryFeeBase = money(
      record.fee ?? 0,
    );
    deliveryFee = deliveryFeeBase;
    deliveryZoneId =
      text(record.id);
  }

  const normalizedCouponCode =
    normalizeMarketplaceCouponCode(
      body.couponCode,
    );

  if (normalizedCouponCode) {
    const { data: coupon, error: couponError } =
      await supabase
        .from("marketplace_coupons")
        .select("*")
        .eq("company_id", companyId)
        .eq(
          "codigo_normalizado",
          normalizedCouponCode,
        )
        .maybeSingle();

    if (couponError) throw couponError;

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
    const now = Date.now();
    const startsAt = record.starts_at
      ? new Date(
          text(record.starts_at),
        ).getTime()
      : 0;
    const endsAt = record.ends_at
      ? new Date(
          text(record.ends_at),
        ).getTime()
      : 0;
    const usageLimit =
      record.usage_limit == null
        ? null
        : Number(record.usage_limit);
    const usedCount = Number(
      record.used_count || 0,
    );

    if (
      record.ativo === false ||
      (startsAt && startsAt > now) ||
      (endsAt && endsAt < now) ||
      (
        usageLimit !== null &&
        usedCount >= usageLimit
      )
    ) {
      throw Object.assign(
        new Error(
          "Cupom invalido, expirado ou esgotado.",
        ),
        { status: 400 },
      );
    }

    const minimum = money(
      record.valor_minimo_pedido ??
        0,
    );

    if (subtotal < minimum) {
      throw Object.assign(
        new Error(
          "O pedido nao atingiu o valor minimo do cupom.",
        ),
        { status: 400 },
      );
    }

    const type =
      normalizeMarketplaceCouponType(
        record,
      );
    const value = money(
      record.valor,
    );
    const maxDiscount =
      record.valor_maximo_desconto == null
        ? null
        : money(
            record.valor_maximo_desconto,
          );

    if (type === "free_delivery") {
      if (deliveryFeeBase <= 0) {
        throw Object.assign(
          new Error(
            "Este cupom exige uma entrega com taxa.",
          ),
          { status: 400 },
        );
      }

      deliveryDiscount =
        deliveryFeeBase;
    } else if (type === "fixed") {
      productDiscount =
        Math.min(subtotal, value);
    } else {
      productDiscount = money(
        subtotal * (value / 100),
      );
    }

    if (
      maxDiscount !== null &&
      maxDiscount > 0 &&
      type !== "free_delivery"
    ) {
      productDiscount = Math.min(
        productDiscount,
        maxDiscount,
      );
    }

    productDiscount = Math.min(
      subtotal,
      money(productDiscount),
    );
    deliveryDiscount = Math.min(
      deliveryFeeBase,
      money(deliveryDiscount),
    );
    deliveryFee = money(
      deliveryFeeBase -
        deliveryDiscount,
    );
    discountAmount = money(
      productDiscount +
        deliveryDiscount,
    );
    couponId =
      text(record.id) || null;
  }

  const total = money(
    subtotal -
      productDiscount +
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

  // Marketplace fee is active and follows the seller plan.
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
    { data: products, error: productsError },
    { data: zones, error: zonesError },
    { data: account, error: accountError },
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
      .order("name"),
    supabase
      .from("marketplace_payment_settings")
      .select(
        "access_token,public_key,onboarding_status,account_status,is_active,charges_enabled,pix_enabled,card_enabled,last_error,provider_metadata_sanitized",
      )
      .eq("company_id", companyId)
      .eq("provider", "mercado_pago")
      .maybeSingle(),
  ]);

  if (productsError) throw productsError;
  if (zonesError) throw zonesError;
  if (accountError) throw accountError;

  const publicKey =
    marketplacePublicKey();
  const oauthVerified =
    verifiedMarketplaceOauth(
      account?.provider_metadata_sanitized,
    );
  const connectionRequiresReconnect =
    Boolean(
      account?.access_token &&
        !oauthVerified,
    );

  const connected = Boolean(
    account?.is_active &&
      account?.access_token &&
      publicKey &&
      oauthVerified &&
      account?.onboarding_status ===
        "connected",
  );

  const chargesEnabled = Boolean(
    connected &&
      account?.charges_enabled !== false,
  );

  const pixEnabled = Boolean(
    chargesEnabled &&
      account?.pix_enabled !== false,
  );

  const cardEnabled = Boolean(
    chargesEnabled &&
      account?.card_enabled !== false,
  );

  const activeZones = (zones || []).filter(
    (raw) => {
      const zone = raw as JsonRecord;

      return (
        zone.ativo !== false &&
        zone.active !== false &&
        zone.is_active !== false
      );
    },
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

          name:
            productName(product),

          description: text(
            product.descricao ||
              product.description,
          ),

          price:
            productPrice(product),

          imageUrl: text(
            product.imagem_url ||
              product.image_url,
          ),

          variations:
            productVariations(product).map(
              (item) => {
                const record =
                  item as JsonRecord;

                return {
                  id: optionId(item),

                  name:
                    text(
                      record.nome ||
                        record.name,
                    ) ||
                    optionId(item),

                  priceDelta:
                    optionPrice(item),
                };
              },
            ),

          addons:
            productAddons(product).map(
              (item) => {
                const record =
                  item as JsonRecord;

                return {
                  id: optionId(item),

                  name:
                    text(
                      record.nome ||
                        record.name,
                    ) ||
                    optionId(item),

                  price:
                    optionPrice(item),
                };
              },
            ),
        };
      },
    ),

    deliveryZones:
      activeZones.map((raw) => {
        const zone =
          raw as JsonRecord;

        return {
          id: text(zone.id),

          name: text(
            zone.nome ||
              zone.name,
          ),

          fee: money(
            zone.taxa ||
              zone.fee,
          ),

          minimumOrder: money(
            zone.pedido_minimo ||
              zone.minimum_order ||
              zone.min_order,
          ),
        };
      }),

    payment: {
      provider: "mercado_pago",

      configured:
        connected,

      chargesEnabled,

      pixEnabled,

      cardEnabled,

      publicKey:
        connected
          ? publicKey
          : "",

      lastError:
        connectionRequiresReconnect
          ? "Reconecte a conta Mercado Pago para ativar o split de pagamentos."
          : !publicKey
            ? "A chave pública do integrador Mercado Pago não está configurada."
            : account?.last_error || null,
      connectionRequiresReconnect,
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

// ORCALY_ORDER_TRACKING_FINANCE_V1
async function getOrderTracking(
  supabase: CheckoutCalculation["supabase"],
  orderId: string,
) {
  const { data, error } = await supabase
    .from("orders")
    .select("customer_portal_token")
    .eq("id", orderId)
    .maybeSingle();

  if (error) throw error;

  const trackingToken = text(
    data?.customer_portal_token,
  );

  return {
    trackingToken,
    trackingUrl: trackingToken
      ? `/pedido/${encodeURIComponent(
          trackingToken,
        )}`
      : "",
  };
}

async function syncPaidOrderArtifacts(
  calculation: Pick<
    CheckoutCalculation,
    "supabase" | "companyId"
  >,
  transaction: {
    id: string;
    orderId: string;
  },
  payment: JsonRecord,
  paidAt: string,
) {
  const { data: order, error: orderError } =
    await calculation.supabase
      .from("orders")
      .select(
        "id,customer_name,nome,customer_phone,telefone,produto,total,total_amount,payment_method,delivery_type,delivery_fee,delivery_zone_id,address,neighborhood,complement,reference_point",
      )
      .eq("id", transaction.orderId)
      .eq(
        "company_id",
        calculation.companyId,
      )
      .maybeSingle();

  if (orderError) throw orderError;
  if (!order) return;

  const customerName = text(
    order.customer_name || order.nome,
  ) || "Cliente";
  const grossAmount = money(
    payment.transaction_amount ||
      order.total_amount ||
      order.total,
  );
  const paymentMethod =
    text(
      payment.payment_method_id ||
        order.payment_method,
    ) || "Mercado Pago";
  const code = transaction.orderId
    .slice(0, 8)
    .toUpperCase();
  const financialDescription =
    `Venda #${code} - ${customerName}`;

  const { error: financialError } =
    await calculation.supabase
      .from("financial_transactions")
      .upsert(
        {
          id: transaction.id,
          company_id:
            calculation.companyId,
          tipo: "entrada",
          type: "income",
          categoria: "Venda",
          descricao:
            financialDescription,
          description:
            financialDescription,
          valor: grossAmount,
          amount: grossAmount,
          data_competencia:
            paidAt.slice(0, 10),
          status: "recebido",
          forma_pagamento:
            paymentMethod,
          payment_method:
            paymentMethod,
          fornecedor_cliente:
            customerName,
          order_id:
            transaction.orderId,
          origem:
            "marketplace_checkout",
          paid_at: paidAt,
          notes:
            "Venda online confirmada pelo Mercado Pago.",
          raw_data: {
            marketplace_payment_id:
              transaction.id,
            provider_payment_id:
              text(payment.id) || null,
            provider:
              "mercado_pago",
          },
          updated_at:
            new Date().toISOString(),
        },
        {
          onConflict: "id",
        },
      );

  if (financialError) {
    throw financialError;
  }

  if (
    text(order.delivery_type).toLowerCase() !==
    "delivery"
  ) {
    return;
  }

  let neighborhood =
    text(order.neighborhood);

  if (
    !neighborhood &&
    order.delivery_zone_id
  ) {
    const { data: zone } =
      await calculation.supabase
        .from("delivery_zones")
        .select("name")
        .eq(
          "id",
          String(order.delivery_zone_id),
        )
        .eq(
          "company_id",
          calculation.companyId,
        )
        .maybeSingle();

    neighborhood = text(zone?.name);
  }

  const deliveryPayload = {
    company_id:
      calculation.companyId,
    order_id:
      transaction.orderId,
    customer_name:
      customerName,
    customer_phone:
      text(
        order.customer_phone ||
          order.telefone,
      ) || null,
    address:
      text(order.address) || null,
    neighborhood:
      neighborhood || null,
    delivery_zone_id:
      order.delivery_zone_id || null,
    delivery_fee:
      money(order.delivery_fee),
    status:
      "waiting_preparation",
    notes:
      [
        text(order.complement)
          ? `Complemento: ${text(
              order.complement,
            )}`
          : "",
        text(order.reference_point)
          ? `Referencia: ${text(
              order.reference_point,
            )}`
          : "",
      ]
        .filter(Boolean)
        .join(" | ") || null,
    updated_at:
      new Date().toISOString(),
  };

  const {
    data: existingDelivery,
    error: existingError,
  } = await calculation.supabase
    .from("deliveries")
    .select("id,status")
    .eq(
      "company_id",
      calculation.companyId,
    )
    .eq(
      "order_id",
      transaction.orderId,
    )
    .limit(1)
    .maybeSingle();

  if (existingError) throw existingError;

  if (existingDelivery?.id) {
    const existingStatus =
      text(existingDelivery.status);

    const patch = {
      ...deliveryPayload,
      ...(existingStatus &&
      ![
        "aguardando_pagamento",
        "pending_payment",
      ].includes(existingStatus)
        ? { status: existingStatus }
        : {}),
    };

    const { error } =
      await calculation.supabase
        .from("deliveries")
        .update(patch)
        .eq(
          "id",
          String(existingDelivery.id),
        );

    if (error) throw error;
    return;
  }

  // O id deterministico evita duas entregas se o webhook
  // e a consulta de status confirmarem o mesmo pagamento juntos.
  const { error: deliveryError } =
    await calculation.supabase
      .from("deliveries")
      .upsert(
        {
          id: transaction.orderId,
          ...deliveryPayload,
        },
        { onConflict: "id" },
      );

  if (deliveryError) {
    throw deliveryError;
  }
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
  const feeDetails = array(payment.fee_details)
    .map((item) => asRecord(item));
  const chargesDetails = array(payment.charges_details)
    .map((item) => asRecord(item));
  const applicationFeeFromFees = money(
    feeDetails
      .filter(
        (fee) =>
          text(fee.type).toLowerCase() ===
          "application_fee",
      )
      .reduce(
        (sum, fee) =>
          sum + Math.max(0, Number(fee.amount || 0)),
        0,
      ),
  );
  const applicationFeeFromCharges = money(
    chargesDetails
      .filter((charge) => {
        const accounts = asRecord(charge.accounts);

        return (
          text(charge.name).toLowerCase() ===
            "third_payment" &&
          text(accounts.from).toLowerCase() ===
            "collector" &&
          text(accounts.to).toLowerCase() ===
            "marketplace_owner"
        );
      })
      .reduce((sum, charge) => {
        const amounts = asRecord(charge.amounts);

        return (
          sum +
          Math.max(
            0,
            Number(amounts.original || 0),
          )
        );
      }, 0),
  );
  const platformFeeAmount = money(
    Math.max(
      applicationFeeFromFees,
      applicationFeeFromCharges,
    ),
  );
  const providerFeeAmount = money(
    feeDetails
      .filter(
        (fee) =>
          text(fee.type).toLowerCase() !==
          "application_fee",
      )
      .reduce(
        (sum, fee) =>
          sum + Math.max(0, Number(fee.amount || 0)),
        0,
      ),
  );
  const transactionDetails =
    asRecord(payment.transaction_details);
  const reportedNetAmount = money(
    transactionDetails.net_received_amount,
  );
  const grossAmount = money(
    payment.transaction_amount,
  );

  const {
    data: splitExpectation,
    error: splitExpectationError,
  } = await calculation.supabase
    .from("marketplace_payments")
    .select(
      "commission_amount,platform_fee_amount",
    )
    .eq("id", transaction.id)
    .eq(
      "company_id",
      calculation.companyId,
    )
    .maybeSingle();

  if (splitExpectationError) {
    throw splitExpectationError;
  }

  const expectedPlatformFee = money(
    splitExpectation?.commission_amount ||
      splitExpectation?.platform_fee_amount ||
      0,
  );

  const splitApplied =
    mappedStatus !== "paid" ||
    expectedPlatformFee <= 0 ||
    (
      platformFeeAmount > 0 &&
      platformFeeAmount + 0.005 >=
        expectedPlatformFee
    );

  const effectiveStatus =
    mappedStatus === "paid" && !splitApplied
      ? "pending"
      : mappedStatus;

  const effectivePaidAt =
    effectiveStatus === "paid"
      ? paidAt
      : null;

  const sellerNetAmount =
    mappedStatus === "paid"
      ? reportedNetAmount > 0
        ? reportedNetAmount
        : money(
            grossAmount -
              providerFeeAmount -
              platformFeeAmount,
          )
      : null;
  const splitStatus =
    mappedStatus === "paid"
      ? splitApplied
        ? "applied"
        : "missing"
      : "pending";

  await settleMarketplaceStock(
    calculation.supabase,
    calculation.companyId,
    transaction.id,
    effectiveStatus,
    splitApplied
      ? remoteStatus || effectiveStatus
      : "payment_paid_without_confirmed_application_fee",
  );

  await Promise.all([
    calculation.supabase
      .from("marketplace_payments")
      .update({
        provider_payment_id:
          paymentId || null,
        provider_status:
          remoteStatus || null,
        status: effectiveStatus,
        gross_amount:
          grossAmount || null,
        amount:
          grossAmount || null,
        provider_fee_amount:
          providerFeeAmount,
        provider_net_amount:
          sellerNetAmount,
        platform_fee_amount:
          platformFeeAmount,
        seller_net_amount:
          sellerNetAmount,
        split_status:
          splitStatus,
        last_error:
          mappedStatus === "paid" && !splitApplied
            ? "Pagamento aprovado sem confirmaÃ§Ã£o da taxa do marketplace."
            : null,
        raw_payload: payment,
        card_brand:
          methodId || null,
        card_last4:
          lastFour || null,
        paid_at: effectivePaidAt,
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
          effectiveStatus,
        status:
          effectiveStatus === "paid"
            ? "Recebido"
            : "pending_payment",
        paid_at: effectivePaidAt,
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
        status: effectiveStatus,
        paid_amount:
          effectiveStatus === "paid"
            ? Number(
                payment.transaction_amount ||
                  0,
              )
            : 0,
        remaining_amount:
          effectiveStatus === "paid"
            ? 0
            : Number(
                payment.transaction_amount ||
                  0,
              ),
        paid_at: effectivePaidAt,
        updated_at:
          new Date().toISOString(),
      })
      .eq("order_id", transaction.orderId)
      .eq(
        "company_id",
        calculation.companyId,
      ),
  ]);

  if (
    mappedStatus === "paid" &&
    splitApplied
  ) {
    await syncPaidOrderArtifacts(
      calculation,
      transaction,
      payment,
      effectivePaidAt ||
        new Date().toISOString(),
    );

    const { error: couponConsumeError } =
      await calculation.supabase.rpc(
        "consume_marketplace_coupon",
        {
          p_company_id:
            calculation.companyId,
          p_order_id:
            transaction.orderId,
        },
      );

    if (couponConsumeError) {
      throw couponConsumeError;
    }

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
    mappedStatus: effectiveStatus,
    remoteStatus,
    paidAt: effectivePaidAt,
  };
}

export async function createCheckoutPayment(
  slug: string,
  body: CheckoutBody,
  request: NextRequest,
) {
  validateCheckoutPayload(body, { requireCustomer: true });
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
    const tracking =
      await getOrderTracking(
        supabase,
        String(existing.order_id),
      );

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
      trackingToken:
        tracking.trackingToken,
      trackingUrl:
        tracking.trackingUrl,
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
        customer_portal_token:
          randomUUID(),
        delivery_type:
          body.delivery?.type ||
          "pickup",
        delivery_zone_id:
          calculation.deliveryZoneId,
        address:
          body.delivery?.address || null,
        complement:
          body.delivery?.complement || null,
        reference_point:
          body.delivery?.reference || null,
      })
      .select("id,customer_portal_token")
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
  const trackingToken =
    text(order.customer_portal_token);
  const trackingUrl = trackingToken
    ? `/pedido/${encodeURIComponent(trackingToken)}`
    : "";

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

  // A entrega e criada somente depois da confirmacao
  // do pagamento, evitando pedidos nao pagos na central.

  const transactionId =
    randomUUID();
  const reservationExpiresAt =
    new Date(
      Date.now() + 30 * 60 * 1000,
    ).toISOString();
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
          reservationExpiresAt,
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
    notification_url:
      `${appUrl}/api/marketplace/payments/webhook/mercado-pago` +
      `?company_id=${encodeURIComponent(companyId)}` +
      `&marketplace_payment_id=${encodeURIComponent(transactionId)}` +
      `&source_news=webhooks`,
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
    calculation.commissionAmount > 0
  ) {
    paymentPayload.application_fee =
      calculation.commissionAmount;
  }

  if (
    body.paymentMethod === "PIX"
  ) {
    paymentPayload.payment_method_id =
      "pix";
    paymentPayload.date_of_expiration =
      reservationExpiresAt;
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
    await reserveMarketplaceStock(
      calculation,
      {
        id: transactionId,
        orderId,
        expiresAt:
          reservationExpiresAt,
      },
    );

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
      trackingToken,
      trackingUrl,
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

    await settleMarketplaceStock(
      supabase,
      companyId,
      transactionId,
      "failed",
      message,
    ).catch(() => null);

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

    const providerCode =
      mercadoPagoProviderErrorCode(
        cause,
      );
    const applicationFeeOauthRejected =
      providerCode === 2059 ||
      message
        .toLowerCase()
        .includes("application_fee");

    if (applicationFeeOauthRejected) {
      const reconnectMessage =
        "A conta Mercado Pago precisa ser reconectada por OAuth usando uma aplicação configurada como Marketplace.";

      await supabase
        .from(
          "marketplace_payment_settings",
        )
        .update({
          onboarding_status:
            "reconnect_required",
          charges_enabled: false,
          last_error:
            reconnectMessage,
          updated_at:
            new Date().toISOString(),
        })
        .eq("company_id", companyId)
        .eq("provider", "mercado_pago");

      throw Object.assign(
        new Error(reconnectMessage),
        { status: 409 },
      );
    }

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

  const tracking =
    await getOrderTracking(
      supabase,
      String(transaction.order_id),
    );

  if (
    terminalStatus(
      transaction.status,
    )
  ) {
    await settleMarketplaceStock(
      supabase,
      companyId,
      String(transaction.id),
      String(transaction.status),
      String(
        transaction.provider_status ||
          transaction.status,
      ),
    );

    return {
      ...transaction,
      trackingToken:
        tracking.trackingToken,
      trackingUrl:
        tracking.trackingUrl,
    };
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
    trackingToken:
      tracking.trackingToken,
    trackingUrl:
      tracking.trackingUrl,
  };
}
