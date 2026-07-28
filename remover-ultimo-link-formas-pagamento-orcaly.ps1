param(
  [switch]$SkipBuild
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$Root = (Get-Location).Path
$Target = Join-Path $Root "components\painel\MarketplacePaymentsPanel.tsx"
$Modules = Join-Path $Root "lib\panel-modules.ts"
$Stamp = Get-Date -Format "yyyyMMdd-HHmmss"
$Backup = Join-Path $Root ".orcaly-backups\remover-ultimo-link-formas-$Stamp\MarketplacePaymentsPanel.tsx"
$Utf8 = New-Object System.Text.UTF8Encoding($false)

if (-not (Test-Path -LiteralPath (Join-Path $Root "package.json"))) {
  throw "Execute este script na raiz do projeto Orcaly."
}

$Branch = (& git branch --show-current 2>$null | Out-String).Trim()

if ($Branch -ne "feature/asaas-sandbox") {
  throw "Branch atual: $Branch. Execute na branch feature/asaas-sandbox."
}

if (-not (Test-Path -LiteralPath $Target)) {
  throw "Arquivo nao encontrado: components/painel/MarketplacePaymentsPanel.tsx"
}

New-Item -ItemType Directory -Force -Path (Split-Path $Backup -Parent) | Out-Null
Copy-Item -LiteralPath $Target -Destination $Backup -Force

$Content = [IO.File]::ReadAllText($Target).Replace("`r`n", "`n")

$Pattern = '(?ms)\s*<Link\s+href="/painel/pagamentos\?tab=formas"[^>]*>\s*Pagamentos presenciais\s*</Link>\s*'
$Updated = [regex]::Replace($Content, $Pattern, "`n", 1)

if ($Updated -eq $Content) {
  $StillExists = Select-String `
    -Path $Target `
    -Pattern "tab=formas|Pagamentos presenciais" `
    -ErrorAction SilentlyContinue

  if ($StillExists) {
    throw "A referencia antiga ainda existe, mas o formato nao corresponde ao esperado."
  }

  Write-Host "[JA APLICADO] Link antigo ja foi removido." -ForegroundColor DarkGreen
} else {
  [IO.File]::WriteAllText(
    $Target,
    $Updated.TrimEnd() + "`n",
    $Utf8
  )

  Write-Host "[OK] Ultimo link de Pagamentos presenciais removido" -ForegroundColor Green
}

Write-Host ""
Write-Host "==> Verificando referencias antigas" -ForegroundColor Cyan

$Legacy = @()

$Legacy += Select-String `
  -Path $Target `
  -Pattern "PaymentMethodsManager|tab=formas|activeTab === 'formas'|Pagamentos presenciais" `
  -ErrorAction SilentlyContinue

if (Test-Path -LiteralPath $Modules) {
  $Legacy += Select-String `
    -Path $Modules `
    -Pattern "id: 'formas_pagamento'|tab=formas" `
    -ErrorAction SilentlyContinue
}

if ($Legacy.Count -gt 0) {
  $Legacy | ForEach-Object {
    Write-Host "$($_.Path):$($_.LineNumber) $($_.Line.Trim())" -ForegroundColor Red
  }

  throw "Ainda existem referencias ativas a Formas de pagamento."
}

Write-Host "[OK] Nenhuma referencia ativa a Formas de pagamento" -ForegroundColor Green

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
Write-Host "REFERENCIA ANTIGA REMOVIDA" -ForegroundColor Magenta
Write-Host "==================================================" -ForegroundColor Magenta
Write-Host "Pagamentos presenciais saiu da central."
Write-Host "Mercado Pago permanece como unico recebimento online."
Write-Host "Backup: $Backup"
