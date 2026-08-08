param(
    [switch]$Push = $true
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

try {
    [Console]::OutputEncoding = New-Object System.Text.UTF8Encoding($false)
} catch {}

$Root = "C:\Users\arauj\grafica-flash"
$RestoreCommit = "2407d5d553e0266545b3cfcf519dd9f060fd60a3"

Set-Location -LiteralPath $Root

function Step([string]$Message) {
    Write-Host ""
    Write-Host "==> $Message" -ForegroundColor Cyan
}

function Resolve-Cmd([string]$Name) {
    foreach ($candidate in @("$Name.cmd", $Name)) {
        $cmd = Get-Command $candidate -ErrorAction SilentlyContinue
        if ($cmd) { return $cmd.Source }
    }
    throw "Comando não encontrado: $Name"
}

function Run([string]$Command, [string[]]$Arguments) {
    & $Command @Arguments
    if ($LASTEXITCODE -ne 0) {
        throw "Falhou: $Command $($Arguments -join ' ')"
    }
}

$Git = Resolve-Cmd "git"
$Npm = Resolve-Cmd "npm"
$Npx = Resolve-Cmd "npx"

$branch = (& $Git branch --show-current).Trim()
if (-not $branch) {
    throw "Não foi possível identificar a branch atual."
}

Step "Conferindo alterações locais"

& $Git diff --quiet
if ($LASTEXITCODE -ne 0) {
    throw "Existem alterações rastreadas não commitadas. Faça commit/stash antes para não perder trabalho."
}

& $Git diff --cached --quiet
if ($LASTEXITCODE -ne 0) {
    throw "Existem alterações em staging. Faça commit/stash antes para não perder trabalho."
}

Step "Removendo a migração Asaas recente"

$asaasTargets = @(
    "app/api/marketplace/payments/webhook/asaas/route.ts",
    "app/api/payments/asaas/account/route.ts",
    "app/api/payments/asaas/account/status/route.ts",
    "app/painel/pagamentos/asaas/page.tsx",
    "components/painel/AsaasMarketplaceSetup.tsx",
    "lib/payments/asaas-config.ts",
    "lib/payments/asaas.ts"
)

Run $Git (@(
    "restore",
    "--source=$RestoreCommit",
    "--staged",
    "--worktree",
    "--"
) + $asaasTargets)

Step "Pausando a taxa da plataforma no marketplace"

$CheckoutPath = Join-Path $Root "lib/payments/checkout-service.ts"
$content = [System.IO.File]::ReadAllText($CheckoutPath)

$oldFee = @'
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
'@

$newFee = @'
  const plan = getPlanConfig(
    companyRecord.assinatura_plano ||
      companyRecord.plano ||
      companyRecord.plan,
  );

  // A taxa da plataforma está temporariamente pausada.
  // Mantemos o percentual configurado no plano para
  // permitir reativação futura sem alterar os planos.
  const configuredFeePercent =
    plan.marketplaceFeePercent;
  const platformFeeEnabled = false;
  const feePercent =
    platformFeeEnabled
      ? configuredFeePercent
      : 0;
  const commissionAmount = money(
    total * (feePercent / 100),
  );
'@

if (-not $content.Contains($oldFee)) {
    throw "Trecho de cálculo da comissão não encontrado. O checkout pode ter mudado."
}

$content = $content.Replace($oldFee, $newFee)

$oldPayload = @'
    external_reference:
      externalReference,
    application_fee:
      calculation.commissionAmount,
    notification_url:
'@

$newPayload = @'
    external_reference:
      externalReference,
    notification_url:
'@

if (-not $content.Contains($oldPayload)) {
    throw "Trecho application_fee não encontrado."
}

$content = $content.Replace($oldPayload, $newPayload)

$oldBeforePix = @'
  };

  if (
    body.paymentMethod === "PIX"
  ) {
'@

$newBeforePix = @'
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
'@

if (-not $content.Contains($oldBeforePix)) {
    throw "Ponto de inserção do application_fee condicional não encontrado."
}

$content = $content.Replace($oldBeforePix, $newBeforePix)

[System.IO.File]::WriteAllText(
    $CheckoutPath,
    $content,
    (New-Object System.Text.UTF8Encoding($false))
)

Step "Validando que não há cobrança da plataforma"

$checkoutCheck = [System.IO.File]::ReadAllText($CheckoutPath)

if ($checkoutCheck -notmatch 'platformFeeEnabled = false') {
    throw "A flag de taxa pausada não foi aplicada."
}

if ($checkoutCheck -notmatch 'calculation\.commissionAmount > 0') {
    throw "O application_fee condicional não foi aplicado."
}

Step "ESLint"
Run $Npx @(
    "eslint",
    "lib/payments/checkout-service.ts"
)

Step "Build completo"
Run $Npm @("run", "build")

Step "Diff"
Run $Git @("diff", "--check")
& $Git --no-pager diff --stat

Step "Commit"

$targets = @(
    "lib/payments/checkout-service.ts"
) + $asaasTargets

Run $Git (@("add", "-A", "--") + $targets)
Run $Git @("diff", "--cached", "--check")

& $Git diff --cached --quiet

if ($LASTEXITCODE -eq 0) {
    Write-Host "Nenhuma alteração nova para commit." -ForegroundColor Yellow
}
else {
    Run $Git @(
        "commit",
        "-m",
        "Pausa taxa do marketplace e remove migracao Asaas"
    )
}

if ($Push) {
    Step "Push"
    Run $Git @(
        "push",
        "-u",
        "origin",
        $branch
    )
}

Write-Host ""
Write-Host "ORCALY_MARKETPLACE_FEE_PAUSED_OK=1" -ForegroundColor Green
Write-Host "Marketplace: Mercado Pago" -ForegroundColor Cyan
Write-Host "Taxa Orçaly: 0% temporariamente" -ForegroundColor Cyan
Write-Host "Asaas: migração recente removida" -ForegroundColor Cyan
