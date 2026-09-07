param(
  [switch]$SkipBuild
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$Root = (Get-Location).Path
$Target = Join-Path $Root "components\checkout\SignupCheckout.tsx"
$Stamp = Get-Date -Format "yyyyMMdd-HHmmss"
$Backup = Join-Path $Root ".orcaly-backups\corrigir-signup-checkout-null-$Stamp\SignupCheckout.tsx"
$Utf8 = New-Object System.Text.UTF8Encoding($false)

if (-not (Test-Path -LiteralPath (Join-Path $Root "package.json"))) {
  throw "Execute este script na raiz do projeto Orcaly."
}

if (-not (Test-Path -LiteralPath $Target)) {
  throw "Arquivo nao encontrado: components/checkout/SignupCheckout.tsx"
}

New-Item -ItemType Directory -Force -Path (Split-Path $Backup -Parent) | Out-Null
Copy-Item -LiteralPath $Target -Destination $Backup -Force

$Content = [IO.File]::ReadAllText($Target).Replace("`r`n", "`n")

$OldGuard = @'
    let cancelled = false;

    async function renderBrick() {
'@

$NewGuard = @'
    const currentCheckout = checkout;
    let cancelled = false;

    async function renderBrick() {
'@

if ($Content.Contains($NewGuard)) {
  Write-Host "[JA APLICADO] checkout fixado antes do renderBrick" -ForegroundColor DarkGreen
} elseif ($Content.Contains($OldGuard)) {
  $Content = $Content.Replace($OldGuard, $NewGuard)
  Write-Host "[OK] checkout fixado antes do renderBrick" -ForegroundColor Green
} else {
  throw "Nao foi possivel localizar o inicio do renderBrick."
}

$OldAmount = @'
            amount: checkout.plan.price,
            payer: {
              email: checkout.email,
            },
'@

$NewAmount = @'
            amount: currentCheckout.plan.price,
            payer: {
              email: currentCheckout.email,
            },
'@

if ($Content.Contains($NewAmount)) {
  Write-Host "[JA APLICADO] dados do checkout usam referencia segura" -ForegroundColor DarkGreen
} elseif ($Content.Contains($OldAmount)) {
  $Content = $Content.Replace($OldAmount, $NewAmount)
  Write-Host "[OK] dados do checkout usam referencia segura" -ForegroundColor Green
} else {
  throw "Nao foi possivel localizar amount/email do Payment Brick."
}

[IO.File]::WriteAllText(
  $Target,
  $Content.TrimEnd() + "`n",
  $Utf8
)

if (-not $SkipBuild) {
  Write-Host ""
  Write-Host "==> Limpando cache do Next" -ForegroundColor Cyan
  Remove-Item -Recurse -Force (Join-Path $Root ".next") -ErrorAction SilentlyContinue

  Write-Host ""
  Write-Host "==> Executando build" -ForegroundColor Cyan

  & npm.cmd run build
  $BuildCode = $LASTEXITCODE

  Write-Host "BUILD_EXIT_CODE=$BuildCode"

  if ($BuildCode -ne 0) {
    Write-Host ""
    Write-Host "O build ainda falhou. Nenhum commit foi criado." -ForegroundColor Red
    Write-Host "Backup: $Backup" -ForegroundColor Yellow
    exit $BuildCode
  }
}

Write-Host ""
Write-Host "==================================================" -ForegroundColor Magenta
Write-Host "CORRECAO APLICADA" -ForegroundColor Magenta
Write-Host "==================================================" -ForegroundColor Magenta
Write-Host "O TypeScript agora reconhece o checkout dentro do Payment Brick."
Write-Host "Backup: $Backup"
