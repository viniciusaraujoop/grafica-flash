param(
  [switch]$SkipBuild
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$Root = (Get-Location).Path
$Target = Join-Path $Root "app\api\checkout\lead\route.ts"
$Stamp = Get-Date -Format "yyyyMMdd-HHmmss"
$Backup = Join-Path $Root ".orcaly-backups\corrigir-lead-id-checkout-$Stamp\route.ts"
$Utf8 = New-Object System.Text.UTF8Encoding($false)

if (-not (Test-Path -LiteralPath (Join-Path $Root "package.json"))) {
  throw "Execute este script na raiz do projeto Orcaly."
}

if (-not (Test-Path -LiteralPath $Target)) {
  throw "Arquivo nao encontrado: app/api/checkout/lead/route.ts"
}

New-Item -ItemType Directory -Force -Path (Split-Path $Backup -Parent) | Out-Null
Copy-Item -LiteralPath $Target -Destination $Backup -Force

$Content = [IO.File]::ReadAllText($Target).Replace("`r`n", "`n")

$Old = @'
    const checkout = createSignupCheckoutToken(leadId);

    const checkoutUrl =
'@

$New = @'
    if (!leadId) {
      return erro("Não foi possível preparar o checkout.", 500);
    }

    const checkout = createSignupCheckoutToken(leadId);

    const checkoutUrl =
'@

if ($Content.Contains($New)) {
  Write-Host "[JA APLICADO] Validacao de leadId ja existe." -ForegroundColor DarkGreen
} elseif ($Content.Contains($Old)) {
  $Content = $Content.Replace($Old, $New)

  [IO.File]::WriteAllText(
    $Target,
    $Content.TrimEnd() + "`n",
    $Utf8
  )

  Write-Host "[OK] leadId validado antes de criar o checkout" -ForegroundColor Green
} else {
  throw "Nao foi possivel localizar o trecho esperado. Nenhuma alteracao foi feita."
}

if (-not $SkipBuild) {
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
Write-Host "leadId agora e validado antes do checkout."
Write-Host "Backup: $Backup"
