param(
  [switch]$DryRun,
  [switch]$SkipBuild
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$Root = (Get-Location).Path
$Stamp = Get-Date -Format "yyyyMMdd-HHmmss"
$Backup = Join-Path $Root ".orcaly-backups\cutover-checkout-$Stamp"
$Utf8 = New-Object System.Text.UTF8Encoding($false)

function Full([string]$Path) {
  Join-Path $Root ($Path -replace "/", "\")
}

function Save([string]$Path, [string]$Text) {
  if ($DryRun) {
    Write-Host "[DRY-RUN] $Path"
    return
  }

  $Target = Full $Path

  if (Test-Path -LiteralPath $Target) {
    $Copy = Join-Path $Backup ($Path -replace "/", "\")
    New-Item -ItemType Directory -Force -Path (Split-Path $Copy -Parent) | Out-Null
    Copy-Item -LiteralPath $Target -Destination $Copy -Force
  }

  New-Item -ItemType Directory -Force -Path (Split-Path $Target -Parent) | Out-Null
  [IO.File]::WriteAllText($Target, $Text.TrimStart("`r", "`n") + "`r`n", $Utf8)
  Write-Host "[OK] $Path" -ForegroundColor Green
}

function Patch([string]$Path, [scriptblock]$Transform) {
  $Target = Full $Path
  if (-not (Test-Path -LiteralPath $Target)) {
    throw "Arquivo nao encontrado: $Path"
  }

  $Old = [IO.File]::ReadAllText($Target)
  $New = & $Transform $Old

  if ($New -eq $Old) {
    Write-Host "[SEM ALTERACAO] $Path" -ForegroundColor Yellow
    return
  }

  Save $Path $New
}

if (-not (Test-Path (Join-Path $Root "package.json"))) {
  throw "Execute na raiz do projeto."
}

if (-not $DryRun) {
  New-Item -ItemType Directory -Force -Path $Backup | Out-Null
}

Write-Host "==> Forcando o checkout unificado em todos os novos fluxos" -ForegroundColor Cyan

Patch "lib/payments/asaas-config.ts" {
  param($T)

  if (-not $T.Contains("export function forceNewPayments()")) {
    $T = $T.Replace(
      "export function getAsaasEnvironment() {",
      @'
export function forceNewPayments() {
  return enabled("ORCALY_FORCE_NEW_PAYMENTS");
}

export function getAsaasEnvironment() {
'@
    )
  }

  $T = [regex]::Replace(
    $T,
    '(?s)export function getPaymentDefaultProvider\(\): PaymentProviderName \{.*?\n\}',
    @'
export function getPaymentDefaultProvider(): PaymentProviderName {
  if (forceNewPayments()) return "asaas";

  return String(
    process.env.PAYMENT_PROVIDER_DEFAULT || "mercado_pago",
  ).toLowerCase() === "asaas"
    ? "asaas"
    : "mercado_pago";
}
'@,
    1
  )

  $T = $T.Replace(
    'checkoutV2Enabled: enabled("PAYMENT_CHECKOUT_V2_ENABLED"),',
    'checkoutV2Enabled: forceNewPayments() || enabled("PAYMENT_CHECKOUT_V2_ENABLED"),'
  )
  $T = $T.Replace(
    'asaasEnabled: enabled("ASAAS_ENABLED") && environmentAllowed,',
    'asaasEnabled: (forceNewPayments() || enabled("ASAAS_ENABLED")) && environmentAllowed,'
  )
  $T = $T.Replace(
    'enabled("ASAAS_SUBACCOUNTS_ENABLED") && environmentAllowed,',
    '(forceNewPayments() || enabled("ASAAS_SUBACCOUNTS_ENABLED")) && environmentAllowed,'
  )
  $T = $T.Replace(
    'enabled("ASAAS_MARKETPLACE_ENABLED") && environmentAllowed,',
    '(forceNewPayments() || enabled("ASAAS_MARKETPLACE_ENABLED")) && environmentAllowed,'
  )
  $T = $T.Replace(
    'enabled("ASAAS_SUBSCRIPTIONS_ENABLED") && environmentAllowed,',
    '(forceNewPayments() || enabled("ASAAS_SUBSCRIPTIONS_ENABLED")) && environmentAllowed,'
  )

  return $T
}

Patch "app/api/public-site/[slug]/route.ts" {
  param($T)

  $T = $T.Replace(
    ".select('id,onboarding_status,is_active')",
    ".select('id,onboarding_status,account_status,is_active,charges_enabled,pix_enabled')"
  )
  $T = $T.Replace(
    ".eq('provider', 'mercado_pago')",
    ".eq('provider', 'asaas')"
  )
  $T = $T.Replace(
    "marketplace_payment_online_enabled: !paymentSettingsResult.error && paymentSettingsResult.data?.is_active === true && paymentSettingsResult.data?.onboarding_status === 'connected',",
    @'
marketplace_payment_online_enabled:
        !paymentSettingsResult.error &&
        paymentSettingsResult.data?.is_active === true &&
        paymentSettingsResult.data?.charges_enabled === true &&
        paymentSettingsResult.data?.pix_enabled === true,
      unified_checkout_enabled:
        !paymentSettingsResult.error &&
        paymentSettingsResult.data?.is_active === true &&
        paymentSettingsResult.data?.charges_enabled === true &&
        paymentSettingsResult.data?.pix_enabled === true,
'@
  )

  return $T
}

$Redirect = @'
import { redirect } from "next/navigation";

export default function LegacyPaymentsRedirect() {
  redirect("/painel/pagamentos");
}
'@

Save "app/painel/pagamentos/configuracao/page.tsx" $Redirect
Save "app/painel/pagamentos/vendas/page.tsx" $Redirect

$DisabledOrder = @'
import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  const slug = String(body.slug || "").trim();

  return NextResponse.json(
    {
      error: "O fluxo antigo foi desativado. Utilize o checkout unificado.",
      code: "LEGACY_CHECKOUT_DISABLED",
      checkout_url: slug
        ? `/checkout/${encodeURIComponent(slug)}`
        : null,
    },
    { status: 410 },
  );
}
'@

Save "app/api/marketplace/order/route.ts" $DisabledOrder
Save "app/api/marketplace/payments/create/route.ts" $DisabledOrder

$DisabledConnect = @'
import { NextResponse } from "next/server";

function disabled() {
  return NextResponse.json(
    {
      error: "A integracao antiga foi desativada.",
      code: "LEGACY_PROVIDER_DISABLED",
    },
    { status: 410 },
  );
}

export async function GET() {
  return disabled();
}

export async function POST() {
  return disabled();
}
'@

Save "app/api/marketplace/payments/mercado-pago/connect/route.ts" $DisabledConnect
Save "app/api/marketplace/payments/mercado-pago/callback/route.ts" $DisabledConnect

Patch "components/checkout/CheckoutClient.tsx" {
  param($T)

  if ($T.Contains("ORCALY_MARKETPLACE_HANDOFF_V1")) {
    return $T
  }

  $Needle = @'
  }, [slug]);

  useEffect(() => {
    if (!paymentId) return;
'@

  $Insert = @'
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
'@

  if (-not $T.Contains($Needle)) {
    throw "Ponto de importacao nao encontrado no CheckoutClient."
  }

  return $T.Replace($Needle, $Insert)
}

Patch "components/public-site/FoodMarketplaceCatalog.tsx" {
  param($T)

  $T = $T.Replace(
    "const mercadoPagoConnected = (company as any).marketplace_payment_online_enabled === true",
    "const unifiedCheckoutEnabled = (company as any).unified_checkout_enabled === true || (company as any).marketplace_payment_online_enabled === true"
  )
  $T = $T.Replace("mercadoPagoConnected", "unifiedCheckoutEnabled")
  $T = $T.Replace(
    "Esta loja ainda não ativou pagamentos online. Fale com a loja para concluir o pedido.",
    "Esta loja ainda nao ativou o checkout online."
  )
  $T = $T.Replace("Mercado Pago Checkout Pro", "Checkout seguro Orcaly")

  $Pattern = '(?s)  async function submitOrder\(\) \{.*?\n  \}\n\n  return \('
  $Replacement = @'
  async function submitOrder() {
    setError("");
    setResult(null);

    const validation = validateCheckout();
    if (validation) {
      setError(validation);
      return;
    }

    const slug = String(
      company.slug || company.subdomain_slug || "",
    ).trim();

    if (!slug) {
      setError("Loja nao identificada.");
      return;
    }

    window.sessionStorage.setItem(
      `orcaly-checkout:${slug}`,
      JSON.stringify({
        items: cart.map((item) => ({
          productId: item.productId,
          quantity: item.quantity,
          variationId: item.variation?.id || undefined,
          addonIds: item.addons.map((addon) => addon.id),
          observation: item.notes,
        })),
        customer: {
          name: checkout.customerName,
          email: "",
          phone: checkout.customerPhone,
          cpfCnpj: "",
          postalCode: "",
          addressNumber: "",
          addressComplement: checkout.complement,
        },
        delivery: {
          type: checkout.deliveryType,
          zoneId:
            checkout.deliveryType === "delivery"
              ? checkout.deliveryZoneId
              : "",
          address: checkout.address,
          complement: checkout.complement,
          reference: checkout.referencePoint,
        },
        couponCode: coupon.appliedCode || "",
      }),
    );

    window.location.assign(
      `/checkout/${encodeURIComponent(slug)}?origem=marketplace-food`,
    );
  }

  return (
'@

  $New = [regex]::Replace($T, $Pattern, $Replacement, 1)
  if ($New -eq $T) {
    throw "submitOrder do Food nao foi localizado."
  }
  return $New
}

Patch "components/public-site/SegmentMarketplaceCatalog.tsx" {
  param($T)

  $T = $T.Replace(
    "const mercadoPagoConnected = company.marketplace_payment_online_enabled === true",
    "const unifiedCheckoutEnabled = (company as any).unified_checkout_enabled === true || company.marketplace_payment_online_enabled === true"
  )
  $T = $T.Replace("mercadoPagoConnected", "unifiedCheckoutEnabled")
  $T = $T.Replace(
    "Esta loja ainda não ativou pagamentos online. Fale com a loja para concluir.",
    "Esta loja ainda nao ativou o checkout online."
  )

  $Pattern = '(?s)  async function submitOrder\(\) \{.*?\n  \}\n\n  return \('
  $Replacement = @'
  async function submitOrder() {
    setError("");
    setSuccess("");

    const validation = validateCheckout();
    if (validation) {
      setError(validation);
      return;
    }

    const slug = String(
      company.slug || company.subdomain_slug || "",
    ).trim();

    if (!slug) {
      setError("Empresa nao identificada.");
      return;
    }

    window.sessionStorage.setItem(
      `orcaly-checkout:${slug}`,
      JSON.stringify({
        items: cart.map((item) => ({
          productId: item.productId,
          quantity: item.quantity,
          addonIds: [],
          observation: [
            item.notes,
            ...Object.entries(item.answers || {}).map(
              ([key, value]) => `${key}: ${value}`,
            ),
          ]
            .filter(Boolean)
            .join(" | "),
        })),
        customer: {
          name: checkout.customerName,
          email: checkout.customerEmail,
          phone: checkout.customerPhone,
          cpfCnpj: "",
          postalCode: "",
          addressNumber: "",
          addressComplement: checkout.complement,
        },
        delivery: {
          type: logisticsEnabled
            ? checkout.deliveryType
            : "pickup",
          zoneId:
            logisticsEnabled &&
            checkout.deliveryType === "delivery"
              ? checkout.deliveryZoneId
              : "",
          address: checkout.address,
          complement: checkout.complement,
          reference: checkout.referencePoint,
        },
        couponCode: coupon.appliedCode || "",
      }),
    );

    window.location.assign(
      `/checkout/${encodeURIComponent(slug)}?origem=marketplace`,
    );
  }

  return (
'@

  $New = [regex]::Replace($T, $Pattern, $Replacement, 1)
  if ($New -eq $T) {
    throw "submitOrder segmentado nao foi localizado."
  }
  return $New
}

$Guide = @'
# Cutover do checkout unificado

Variaveis para Preview e Production durante o desenvolvimento:

ORCALY_FORCE_NEW_PAYMENTS=true
PAYMENT_PROVIDER_DEFAULT=asaas
PAYMENT_CHECKOUT_V2_ENABLED=true
ASAAS_ENABLED=true
ASAAS_ENV=sandbox
ASAAS_SUBACCOUNTS_ENABLED=true
ASAAS_MARKETPLACE_ENABLED=true
ASAAS_SUBSCRIPTIONS_ENABLED=true
ASAAS_CARD_TOKENIZATION_ENABLED=false
ASAAS_PRODUCTION_APPROVED=false

Depois que o novo deploy de Production estiver READY, desative os registros
Mercado Pago no banco. Nao faça isso antes, pois a producao atual ainda usa
o codigo antigo.
'@

Save "CUTOVER-CHECKOUT-UNIFICADO.md" $Guide

if (-not $SkipBuild) {
  Write-Host "==> Executando build" -ForegroundColor Cyan
  & npm.cmd run build
  $Code = $LASTEXITCODE
  Write-Host "BUILD_EXIT_CODE=$Code"

  if ($Code -ne 0) {
    Write-Host "Build falhou. Backup: $Backup" -ForegroundColor Red
    exit $Code
  }
}

Write-Host ""
Write-Host "CUTOVER CONCLUIDO" -ForegroundColor Magenta
Write-Host "Novo checkout: forçado por flag"
Write-Host "Marketplace: encaminhado ao checkout unificado"
Write-Host "Carrinho: transferido para o checkout"
Write-Host "Novas cobrancas antigas: bloqueadas"
Write-Host "Historico antigo: preservado"
Write-Host "Backup: $Backup"
