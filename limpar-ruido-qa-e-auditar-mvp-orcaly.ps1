param(
  [switch]$SkipBuild
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$Root = (Get-Location).Path
$ConfigPath = Join-Path $Root "eslint.config.mjs"
$Stamp = Get-Date -Format "yyyyMMdd-HHmmss"
$BackupDir = Join-Path $Root ".orcaly-backups\qa-lint-scope-$Stamp"
$BackupPath = Join-Path $BackupDir "eslint.config.mjs"
$ReportPath = Join-Path $Root "qa-mvp-lint-$Stamp.txt"
$Utf8 = New-Object System.Text.UTF8Encoding($false)

if (-not (Test-Path -LiteralPath (Join-Path $Root "package.json"))) {
  throw "Execute este script na raiz do projeto Orcaly."
}

if (-not (Test-Path -LiteralPath $ConfigPath)) {
  throw "eslint.config.mjs nao encontrado."
}

New-Item -ItemType Directory -Force -Path $BackupDir | Out-Null
Copy-Item -LiteralPath $ConfigPath -Destination $BackupPath -Force

$Original = [IO.File]::ReadAllText($ConfigPath).Replace("`r`n", "`n")

$Expected = @'
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
'@

$Replacement = @'
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",

    // Arquivos que nao fazem parte da aplicacao executada.
    ".orcaly-backups/**",
    "qa-orcaly-*/**",
    ".orcaly-qa/**",
    "scripts/**",
    "**/*.ps1",
    "**/*.backup-*",
    "**/*.bak.*",
    "**/*.old.*",
    "**/*.tmp.*",
'@

if ($Original.Contains($Replacement)) {
  Write-Host "[JA APLICADO] Escopo do ESLint ja esta limpo." -ForegroundColor DarkGreen
} elseif ($Original.Contains($Expected)) {
  $Updated = $Original.Replace($Expected, $Replacement)

  [IO.File]::WriteAllText(
    $ConfigPath,
    $Updated.TrimEnd() + "`n",
    $Utf8
  )

  Write-Host "[OK] eslint.config.mjs atualizado" -ForegroundColor Green
} else {
  throw "O formato atual do eslint.config.mjs nao corresponde ao esperado. Nenhuma alteracao foi feita."
}

$MvpFiles = @(
  "app/page.tsx",
  "app/login/page.tsx",
  "app/cadastro/page.tsx",
  "app/painel/page.tsx",
  "app/painel/assinatura/page.tsx",
  "app/painel/pagamentos/page.tsx",
  "app/painel/produtos/page.tsx",
  "app/painel/pedidos/page.tsx",
  "app/painel/pedidos/[id]/page.tsx",
  "app/checkout/[slug]/page.tsx",
  "components/checkout/CheckoutClient.tsx",
  "components/subscription/MercadoPagoSubscriptionCheckout.tsx",
  "components/painel/MarketplacePaymentsPanel.tsx",
  "lib/mercado-pago.ts",
  "lib/payments/checkout-service.ts",
  "app/api/checkout/[slug]/route.ts",
  "app/api/checkout/[slug]/prepare/route.ts",
  "app/api/checkout/[slug]/status/route.ts",
  "app/api/checkout/[slug]/pix/route.ts",
  "app/api/checkout/[slug]/card/route.ts",
  "app/api/assinatura/mercado-pago/route.ts",
  "app/api/assinatura/cancelar/route.ts",
  "app/api/marketplace/payments/mercado-pago/connect/route.ts",
  "app/api/marketplace/payments/mercado-pago/callback/route.ts",
  "app/api/marketplace/payments/webhook/mercado-pago/route.ts"
)

$Missing = @()

foreach ($Relative in $MvpFiles) {
  if (-not (Test-Path -LiteralPath (Join-Path $Root ($Relative -replace "/", "\")))) {
    $Missing += $Relative
  }
}

if ($Missing.Count -gt 0) {
  Write-Host ""
  Write-Host "Arquivos MVP ausentes:" -ForegroundColor Yellow
  $Missing | ForEach-Object { Write-Host "  $_" }
}

$ExistingMvpFiles = @(
  $MvpFiles | Where-Object {
    Test-Path -LiteralPath (Join-Path $Root ($_ -replace "/", "\"))
  }
)

Write-Host ""
Write-Host "==> Executando lint somente no fluxo MVP" -ForegroundColor Cyan

$LintOutput = & npx.cmd eslint @ExistingMvpFiles 2>&1 | Out-String
$LintCode = $LASTEXITCODE

[IO.File]::WriteAllText(
  $ReportPath,
  $LintOutput,
  $Utf8
)

Write-Host $LintOutput
Write-Host "MVP_LINT_EXIT_CODE=$LintCode"
Write-Host "Relatorio MVP: $ReportPath"

if (-not $SkipBuild) {
  Write-Host ""
  Write-Host "==> Confirmando build" -ForegroundColor Cyan

  & npm.cmd run build
  $BuildCode = $LASTEXITCODE

  Write-Host "BUILD_EXIT_CODE=$BuildCode"

  if ($BuildCode -ne 0) {
    Write-Host ""
    Write-Host "O build falhou. O arquivo ESLint pode ser restaurado em:" -ForegroundColor Red
    Write-Host $BackupPath -ForegroundColor Yellow
    exit $BuildCode
  }
}

Write-Host ""
Write-Host "==================================================" -ForegroundColor Magenta
Write-Host "ESCOPO DE QA MVP PREPARADO" -ForegroundColor Magenta
Write-Host "==================================================" -ForegroundColor Magenta
Write-Host "Backups e patchers nao poluem mais o lint."
Write-Host "O relatorio agora mostra apenas problemas do fluxo usado na validacao."
Write-Host "Backup: $BackupPath"
