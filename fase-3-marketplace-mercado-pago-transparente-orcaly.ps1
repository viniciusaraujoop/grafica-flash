param(
  [switch]$SkipBuild
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$Root = (Get-Location).Path
$Stamp = Get-Date -Format "yyyyMMdd-HHmmss"
$Backup = Join-Path $Root ".orcaly-backups\mercado-pago-checkout-fase3-$Stamp"
$Utf8 = New-Object System.Text.UTF8Encoding($false)

function Full([string]$Path) {
  Join-Path $Root ($Path -replace "/", "\")
}

function Save-Text([string]$Path, [string]$Text) {
  $Target = Full $Path

  if (Test-Path -LiteralPath $Target) {
    $Copy = Join-Path $Backup ($Path -replace "/", "\")
    New-Item -ItemType Directory -Force -Path (Split-Path $Copy -Parent) | Out-Null
    Copy-Item -LiteralPath $Target -Destination $Copy -Force
  }

  New-Item -ItemType Directory -Force -Path (Split-Path $Target -Parent) | Out-Null

  [IO.File]::WriteAllText(
    $Target,
    $Text.TrimStart("`r", "`n").TrimEnd("`r", "`n") + "`n",
    $Utf8
  )

  Write-Host "[OK] $Path" -ForegroundColor Green
}

if (-not (Test-Path -LiteralPath (Join-Path $Root "package.json"))) {
  throw "Execute este script na raiz do projeto Orcaly."
}

$Branch = (& git branch --show-current 2>$null | Out-String).Trim()

if ($Branch -ne "feature/asaas-sandbox") {
  throw "Branch atual: $Branch. Retorne para feature/asaas-sandbox antes de executar."
}

if (-not (Test-Path -LiteralPath (Full "components/subscription/MercadoPagoSubscriptionCheckout.tsx"))) {
  throw "A Fase 2 ainda nao foi encontrada no projeto. Execute e conclua a Fase 2 antes desta etapa."
}

New-Item -ItemType Directory -Force -Path $Backup | Out-Null

Write-Host ""
Write-Host "==================================================" -ForegroundColor Cyan
Write-Host "ORCALY - MERCADO PAGO TRANSPARENTE - FASE 3" -ForegroundColor Cyan
Write-Host "Pix, cartao e split no marketplace" -ForegroundColor Cyan
Write-Host "==================================================" -ForegroundColor Cyan

$CheckoutService = @'
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
  paymentMethod?: "PIX" | "CREDIT_CARD";
  cardPayment?: CardPaymentData;
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
            .NEXT_PUBLIC_MERCADO_PAGO_PUBLIC_KEY,
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
    body.paymentMethod !==
      "CREDIT_CARD"
  ) {
    throw Object.assign(
      new Error(
        "Selecione Pix ou cartao.",
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

  const customerDocument =
    digits(body.customer.cpfCnpj);
  const identificationType =
    body.cardPayment
      ?.identificationType ||
    (customerDocument.length === 14
      ? "CNPJ"
      : "CPF");
  const identificationNumber =
    digits(
      body.cardPayment
        ?.identificationNumber ||
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

    if (
      !card?.token ||
      !card.paymentMethodId
    ) {
      throw Object.assign(
        new Error(
          "Os dados seguros do cartao nao foram gerados.",
        ),
        { status: 400 },
      );
    }

    paymentPayload.token =
      card.token;
    paymentPayload.installments =
      Math.max(
        1,
        Math.min(
          12,
          Number(
            card.installments || 1,
          ),
        ),
      );
    paymentPayload.payment_method_id =
      card.paymentMethodId;

    if (text(card.issuerId)) {
      paymentPayload.issuer_id =
        card.issuerId;
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
'@

$CheckoutClient = @'
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
'@

$PrepareRoute = @'
import {
  NextRequest,
  NextResponse,
} from "next/server";
import {
  prepareCheckoutPayment,
} from "@/lib/payments/checkout-service";

type Context = {
  params: Promise<{
    slug: string;
  }>;
};

function statusFor(error: unknown) {
  if (
    error &&
    typeof error === "object" &&
    "status" in error
  ) {
    return Number(
      (error as { status?: number })
        .status || 500,
    );
  }

  return 500;
}

export async function POST(
  request: NextRequest,
  context: Context,
) {
  try {
    const { slug } =
      await context.params;
    const body = await request
      .json()
      .catch(() => ({}));

    return NextResponse.json(
      await prepareCheckoutPayment(
        slug,
        body,
      ),
    );
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Nao foi possivel calcular o checkout.",
      },
      { status: statusFor(error) },
    );
  }
}
'@

$StatusRoute = @'
import {
  NextRequest,
  NextResponse,
} from "next/server";
import {
  getCheckoutPaymentStatus,
} from "@/lib/payments/checkout-service";

type Context = {
  params: Promise<{
    slug: string;
  }>;
};

function statusFor(error: unknown) {
  if (
    error &&
    typeof error === "object" &&
    "status" in error
  ) {
    return Number(
      (error as { status?: number })
        .status || 500,
    );
  }

  return 500;
}

export async function GET(
  request: NextRequest,
  context: Context,
) {
  try {
    const { slug } =
      await context.params;
    const paymentId = String(
      request.nextUrl.searchParams.get(
        "paymentId",
      ) || "",
    ).trim();

    if (!paymentId) {
      return NextResponse.json(
        {
          error:
            "Informe o pagamento.",
        },
        { status: 400 },
      );
    }

    return NextResponse.json(
      await getCheckoutPaymentStatus(
        slug,
        paymentId,
      ),
    );
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Nao foi possivel consultar o pagamento.",
      },
      { status: statusFor(error) },
    );
  }
}
'@

$PixStatusRoute = @'
import {
  NextRequest,
  NextResponse,
} from "next/server";
import {
  getCheckoutPaymentStatus,
} from "@/lib/payments/checkout-service";

type Context = {
  params: Promise<{
    slug: string;
    paymentId: string;
  }>;
};

export async function GET(
  _request: NextRequest,
  context: Context,
) {
  try {
    const {
      slug,
      paymentId,
    } = await context.params;

    const payment =
      await getCheckoutPaymentStatus(
        slug,
        paymentId,
      );

    return NextResponse.json({
      payment,
    });
  } catch (error) {
    const status =
      error &&
      typeof error === "object" &&
      "status" in error
        ? Number(
            (
              error as {
                status?: number;
              }
            ).status || 500,
          )
        : 500;

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Nao foi possivel consultar o Pix.",
      },
      { status },
    );
  }
}
'@

$PixRoute = @'
import {
  NextRequest,
  NextResponse,
} from "next/server";
import {
  createCheckoutPayment,
} from "@/lib/payments/checkout-service";

type Context = {
  params: Promise<{
    slug: string;
  }>;
};

export async function POST(
  request: NextRequest,
  context: Context,
) {
  try {
    const { slug } =
      await context.params;
    const body = await request
      .json()
      .catch(() => ({}));

    return NextResponse.json(
      await createCheckoutPayment(
        slug,
        {
          ...body,
          paymentMethod: "PIX",
          cardPayment: undefined,
        },
        request,
      ),
    );
  } catch (error) {
    const status =
      error &&
      typeof error === "object" &&
      "status" in error
        ? Number(
            (
              error as {
                status?: number;
              }
            ).status || 500,
          )
        : 500;

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Nao foi possivel gerar o Pix.",
      },
      { status },
    );
  }
}
'@

$CardRoute = @'
import {
  NextRequest,
  NextResponse,
} from "next/server";
import {
  createCheckoutPayment,
} from "@/lib/payments/checkout-service";

type Context = {
  params: Promise<{
    slug: string;
  }>;
};

export async function POST(
  request: NextRequest,
  context: Context,
) {
  try {
    const { slug } =
      await context.params;
    const body = await request
      .json()
      .catch(() => ({}));

    return NextResponse.json(
      await createCheckoutPayment(
        slug,
        {
          ...body,
          paymentMethod:
            "CREDIT_CARD",
        },
        request,
      ),
    );
  } catch (error) {
    const status =
      error &&
      typeof error === "object" &&
      "status" in error
        ? Number(
            (
              error as {
                status?: number;
              }
            ).status || 500,
          )
        : 500;

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Nao foi possivel processar o cartao.",
      },
      { status },
    );
  }
}
'@

Save-Text "lib/payments/checkout-service.ts" $CheckoutService
Save-Text "components/checkout/CheckoutClient.tsx" $CheckoutClient
Save-Text "app/api/checkout/[slug]/prepare/route.ts" $PrepareRoute
Save-Text "app/api/checkout/[slug]/status/route.ts" $StatusRoute
Save-Text "app/api/checkout/[slug]/pix/[paymentId]/route.ts" $PixStatusRoute
Save-Text "app/api/checkout/[slug]/pix/route.ts" $PixRoute
Save-Text "app/api/checkout/[slug]/card/route.ts" $CardRoute

Write-Host ""
Write-Host "==> Verificando configuracao" -ForegroundColor Cyan

$CheckPath = Join-Path $Root ".orcaly-check-marketplace-$Stamp.cjs"

$CheckCode = @'
const { loadEnvConfig } = require("@next/env");

loadEnvConfig(process.cwd(), true);

const names = [
  "MERCADO_PAGO_CLIENT_ID",
  "MERCADO_PAGO_CLIENT_SECRET",
  "NEXT_PUBLIC_MERCADO_PAGO_PUBLIC_KEY",
  "PAYMENT_CREDENTIALS_ENCRYPTION_KEY",
  "NEXT_PUBLIC_APP_URL",
  "NEXT_PUBLIC_SUPABASE_URL",
  "SUPABASE_SERVICE_ROLE_KEY",
];

console.table(
  names.map((name) => {
    const value = String(process.env[name] || "").trim();

    return {
      variavel: name,
      configurada: Boolean(value),
      tamanho: value.length,
    };
  }),
);
'@

[IO.File]::WriteAllText(
  $CheckPath,
  $CheckCode,
  $Utf8
)

try {
  & node $CheckPath

  if ($LASTEXITCODE -ne 0) {
    throw "A verificacao das variaveis falhou."
  }
} finally {
  Remove-Item -LiteralPath $CheckPath -Force -ErrorAction SilentlyContinue
}

if (-not $SkipBuild) {
  Write-Host ""
  Write-Host "==> Executando build" -ForegroundColor Cyan

  & npm.cmd run build
  $BuildCode = $LASTEXITCODE

  Write-Host "BUILD_EXIT_CODE=$BuildCode"

  if ($BuildCode -ne 0) {
    Write-Host ""
    Write-Host "O build falhou. Nenhum commit foi criado." -ForegroundColor Red
    Write-Host "Backup: $Backup" -ForegroundColor Yellow
    exit $BuildCode
  }
}

Write-Host ""
Write-Host "==================================================" -ForegroundColor Magenta
Write-Host "FASE 3 CONCLUIDA" -ForegroundColor Magenta
Write-Host "==================================================" -ForegroundColor Magenta
Write-Host "Marketplace: checkout transparente"
Write-Host "Pix: QR Code dentro do site"
Write-Host "Cartao: tokenizado no navegador"
Write-Host "Split 1:1: application_fee"
Write-Host "Vendedor: recebe na propria conta Mercado Pago"
Write-Host "Webhook e consulta de status: Mercado Pago"
Write-Host "Backup: $Backup"
