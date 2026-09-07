param(
  [switch]$SkipBuild
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$Root = (Get-Location).Path
$Target = Join-Path $Root "app\api\mercado-pago\webhook\route.ts"
$Stamp = Get-Date -Format "yyyyMMdd-HHmmss"
$Backup = Join-Path $Root ".orcaly-backups\corrigir-tipos-webhook-assinatura-$Stamp\route.ts"
$Utf8 = New-Object System.Text.UTF8Encoding($false)

if (-not (Test-Path -LiteralPath (Join-Path $Root "package.json"))) {
  throw "Execute este script na raiz do projeto Orcaly."
}

$Branch = (& git branch --show-current 2>$null | Out-String).Trim()

if ($Branch -ne "feature/asaas-sandbox") {
  throw "Branch atual: $Branch. Execute na branch feature/asaas-sandbox."
}

if (-not (Test-Path -LiteralPath $Target)) {
  throw "Arquivo nao encontrado: app/api/mercado-pago/webhook/route.ts"
}

New-Item -ItemType Directory -Force -Path (Split-Path $Backup -Parent) | Out-Null
Copy-Item -LiteralPath $Target -Destination $Backup -Force

$Content = [IO.File]::ReadAllText($Target).Replace("`r`n", "`n")
$Changed = $false

Write-Host ""
Write-Host "==================================================" -ForegroundColor Cyan
Write-Host "ORCALY - TIPOS DO WEBHOOK DE ASSINATURA" -ForegroundColor Cyan
Write-Host "Correcao resiliente sem depender do formato dos imports" -ForegroundColor Cyan
Write-Host "==================================================" -ForegroundColor Cyan

# 1. O terceiro argumento precisa ser string | null.
$OldReference = @'
    subscription.id || resourceId,
'@

$NewReference = @'
    String(subscription.id || resourceId),
'@

if ($Content.Contains($NewReference)) {
  Write-Host "[JA APLICADO] identificador da assinatura convertido para texto" -ForegroundColor DarkGreen
} elseif ($Content.Contains($OldReference)) {
  $Content = $Content.Replace($OldReference, $NewReference)
  $Changed = $true
  Write-Host "[OK] identificador da assinatura convertido para texto" -ForegroundColor Green
} else {
  throw "Nao foi localizado o argumento subscription.id || resourceId."
}

# 2. O preapproval_id retornado pelo provedor tambem precisa ser string | null.
$OldPreapproval = @'
  const preapprovalId = authorizedPayment.preapproval_id || null;
'@

$NewPreapproval = @'
  const preapprovalId = authorizedPayment.preapproval_id
    ? String(authorizedPayment.preapproval_id)
    : null;
'@

if ($Content.Contains($NewPreapproval)) {
  Write-Host "[JA APLICADO] preapproval_id convertido para texto" -ForegroundColor DarkGreen
} elseif ($Content.Contains($OldPreapproval)) {
  $Content = $Content.Replace($OldPreapproval, $NewPreapproval)
  $Changed = $true
  Write-Host "[OK] preapproval_id convertido para texto" -ForegroundColor Green
} else {
  Write-Host "[AVISO] trecho de preapproval_id ja possui outro formato" -ForegroundColor Yellow
}

# 3. A proxima cobranca precisa respeitar string | null.
$OldNextPayment = @'
      nextPaymentDate: subscription?.next_payment_date || null,
'@

$NewNextPayment = @'
      nextPaymentDate: subscription?.next_payment_date
        ? String(subscription.next_payment_date)
        : null,
'@

if ($Content.Contains($NewNextPayment)) {
  Write-Host "[JA APLICADO] proxima cobranca normalizada" -ForegroundColor DarkGreen
} elseif ($Content.Contains($OldNextPayment)) {
  $Content = $Content.Replace($OldNextPayment, $NewNextPayment)
  $Changed = $true
  Write-Host "[OK] proxima cobranca normalizada" -ForegroundColor Green
} else {
  Write-Host "[AVISO] trecho de proxima cobranca ja possui outro formato" -ForegroundColor Yellow
}

if ($Changed) {
  [IO.File]::WriteAllText(
    $Target,
    $Content.TrimEnd() + "`n",
    $Utf8
  )
}

Write-Host ""
Write-Host "==> Verificando a correcao" -ForegroundColor Cyan

$Final = [IO.File]::ReadAllText($Target).Replace("`r`n", "`n")

if (-not $Final.Contains("String(subscription.id || resourceId)")) {
  throw "A conversao do identificador nao foi aplicada."
}

Write-Host "[OK] findCompanyForProviderReference recebe string" -ForegroundColor Green

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
    Write-Host "O build avancou, mas encontrou outro erro. Nenhum commit foi criado." -ForegroundColor Red
    Write-Host "Backup: $Backup" -ForegroundColor Yellow
    exit $BuildCode
  }
}

Write-Host ""
Write-Host "==================================================" -ForegroundColor Magenta
Write-Host "TIPAGEM DO WEBHOOK CORRIGIDA" -ForegroundColor Magenta
Write-Host "==================================================" -ForegroundColor Magenta
Write-Host "A assinatura continua isolada em MP_SUBSCRIPTION_*."
Write-Host "Cadastro e marketplace nao foram alterados."
Write-Host "Nenhum commit ou deploy foi criado."
Write-Host "Backup: $Backup"
