param(
  [switch]$DryRun,
  [switch]$SkipBuild
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$Root = (Get-Location).Path
$Stamp = Get-Date -Format "yyyyMMdd-HHmmss"
$Backup = Join-Path $Root ".orcaly-backups\continuar-cutover-$Stamp"
$Utf8 = New-Object System.Text.UTF8Encoding($false)

function Full([string]$Path) {
  return Join-Path $Root ($Path -replace "/", "\")
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
  [IO.File]::WriteAllText(
    $Target,
    $Text.TrimStart("`r", "`n") + "`r`n",
    $Utf8
  )

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

function Replace-SubmitOrder(
  [string]$Text,
  [string]$Replacement,
  [string]$Label
) {
  $Pattern = '(?s)  async function submitOrder\(\) \{.*?\r?\n  \}\r?\n\r?\n  return \('
  $Updated = [regex]::Replace($Text, $Pattern, $Replacement, 1)

  if ($Updated -eq $Text) {
    if (
      $Text.Contains("orcaly-checkout:") -and
      $Text.Contains("/checkout/")
    ) {
      Write-Host "[JA MIGRADO] $Label" -ForegroundColor DarkGreen
      return $Text
    }

    throw "Nao foi possivel localizar submitOrder em $Label."
  }

  return $Updated
}

if (-not (Test-Path -LiteralPath (Join-Path $Root "package.json"))) {
  throw "Execute este script na raiz do projeto."
}

if (-not $DryRun) {
  New-Item -ItemType Directory -Force -Path $Backup | Out-Null
}

Write-Host ""
Write-Host "==================================================" -ForegroundColor Cyan
Write-Host "ORCALY - CONTINUAR CUTOVER DO MARKETPLACE" -ForegroundColor Cyan
Write-Host "==================================================" -ForegroundColor Cyan
Write-Host "Corrigindo os dois componentes que ficaram pendentes."

Patch "components/public-site/FoodMarketplaceCatalog.tsx" {
  param($T)

  $T = $T.Replace(
    "const mercadoPagoConnected = (company as any).marketplace_payment_online_enabled === true",
    "const unifiedCheckoutEnabled = (company as any).unified_checkout_enabled === true || (company as any).marketplace_payment_online_enabled === true"
  )

  $T = $T.Replace(
    "const mercadoPagoConnected = company.marketplace_payment_online_enabled === true",
    "const unifiedCheckoutEnabled = (company as any).unified_checkout_enabled === true || company.marketplace_payment_online_enabled === true"
  )

  $T = $T.Replace("mercadoPagoConnected", "unifiedCheckoutEnabled")

  $T = $T.Replace(
    "Esta loja ainda não ativou pagamentos online. Fale com a loja para concluir o pedido.",
    "Esta loja ainda nao ativou o checkout online."
  )

  $T = $T.Replace(
    "Esta loja ainda não ativou pagamentos online. Fale com a loja para concluir.",
    "Esta loja ainda nao ativou o checkout online."
  )

  $T = $T.Replace(
    "Mercado Pago Checkout Pro",
    "Checkout seguro Orcaly"
  )

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

  return Replace-SubmitOrder $T $Replacement "FoodMarketplaceCatalog"
}

Patch "components/public-site/SegmentMarketplaceCatalog.tsx" {
  param($T)

  $T = $T.Replace(
    "const mercadoPagoConnected = company.marketplace_payment_online_enabled === true",
    "const unifiedCheckoutEnabled = (company as any).unified_checkout_enabled === true || company.marketplace_payment_online_enabled === true"
  )

  $T = $T.Replace(
    "const mercadoPagoConnected = (company as any).marketplace_payment_online_enabled === true",
    "const unifiedCheckoutEnabled = (company as any).unified_checkout_enabled === true || (company as any).marketplace_payment_online_enabled === true"
  )

  $T = $T.Replace("mercadoPagoConnected", "unifiedCheckoutEnabled")

  $T = $T.Replace(
    "Esta loja ainda não ativou pagamentos online. Fale com a loja para concluir.",
    "Esta loja ainda nao ativou o checkout online."
  )

  $T = $T.Replace(
    "Esta loja ainda não ativou pagamentos online. Fale com a loja para concluir o pedido.",
    "Esta loja ainda nao ativou o checkout online."
  )

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

  return Replace-SubmitOrder $T $Replacement "SegmentMarketplaceCatalog"
}

if (-not $SkipBuild) {
  Write-Host ""
  Write-Host "==> Executando build" -ForegroundColor Cyan
  & npm.cmd run build
  $Code = $LASTEXITCODE
  Write-Host "BUILD_EXIT_CODE=$Code"

  if ($Code -ne 0) {
    Write-Host "O build falhou. Backup: $Backup" -ForegroundColor Red
    exit $Code
  }
}

Write-Host ""
Write-Host "==================================================" -ForegroundColor Magenta
Write-Host "CUTOVER DO MARKETPLACE FINALIZADO" -ForegroundColor Magenta
Write-Host "==================================================" -ForegroundColor Magenta
Write-Host "Food: encaminhado ao checkout unificado"
Write-Host "Demais segmentos: encaminhados ao checkout unificado"
Write-Host "Carrinho: preservado por sessionStorage"
Write-Host "Build: concluido"
Write-Host "Backup: $Backup"
