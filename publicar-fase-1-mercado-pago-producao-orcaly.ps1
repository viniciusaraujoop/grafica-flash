param(
  [switch]$SkipBuild
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$Root = (Get-Location).Path
$FeatureBranch = "feature/asaas-sandbox"
$ProductionBranch = "main"
$Stamp = Get-Date -Format "yyyyMMdd-HHmmss"
$StashName = "orcaly-before-production-$Stamp"
$Stashed = $false

function Run-Git {
  param([Parameter(ValueFromRemainingArguments = $true)][string[]]$Args)

  & git @Args

  if ($LASTEXITCODE -ne 0) {
    throw "Falha ao executar: git $($Args -join ' ')"
  }
}

if (-not (Test-Path -LiteralPath (Join-Path $Root "package.json"))) {
  throw "Execute este script na raiz do projeto Orcaly."
}

$CurrentBranch = (& git branch --show-current).Trim()

if ($CurrentBranch -ne $FeatureBranch) {
  throw "Branch atual: $CurrentBranch. Execute na branch $FeatureBranch."
}

Write-Host ""
Write-Host "==================================================" -ForegroundColor Cyan
Write-Host "ORCALY - PUBLICACAO DA FASE 1 EM PRODUCAO" -ForegroundColor Cyan
Write-Host "==================================================" -ForegroundColor Cyan

if (-not $SkipBuild) {
  Write-Host ""
  Write-Host "==> Executando build local" -ForegroundColor Cyan

  & npm.cmd run build
  $BuildCode = $LASTEXITCODE

  Write-Host "BUILD_EXIT_CODE=$BuildCode"

  if ($BuildCode -ne 0) {
    throw "O build falhou. A publicacao foi cancelada."
  }
}

$Files = @(
  ".env.example",
  "lib/mercado-pago.ts",
  "app/api/marketplace/payments/mercado-pago/connect/route.ts",
  "app/api/marketplace/payments/mercado-pago/callback/route.ts",
  "app/api/marketplace/payments/mercado-pago/disconnect/route.ts",
  "app/api/marketplace/payments/webhook/mercado-pago/route.ts",
  "app/painel/pagamentos/page.tsx",
  "app/api/payments/asaas/account/route.ts",
  "components/painel/MarketplacePaymentsPanel.tsx"
)

Write-Host ""
Write-Host "==> Preparando somente os arquivos da Fase 1" -ForegroundColor Cyan

foreach ($File in $Files) {
  if (-not (Test-Path -LiteralPath (Join-Path $Root ($File -replace "/", "\")))) {
    throw "Arquivo necessario nao encontrado: $File"
  }

  Run-Git add -- $File
}

$Staged = (& git diff --cached --name-only | Out-String).Trim()

if ([string]::IsNullOrWhiteSpace($Staged)) {
  Write-Host "Nenhuma alteracao nova para commit na Fase 1." -ForegroundColor Yellow
} else {
  Write-Host ""
  Write-Host "Arquivos preparados:" -ForegroundColor Green
  Write-Host $Staged

  Run-Git commit -m "Restaura OAuth Mercado Pago com tokens criptografados"
}

Write-Host ""
Write-Host "==> Enviando branch de desenvolvimento" -ForegroundColor Cyan
Run-Git push origin $FeatureBranch

$Remaining = (& git status --porcelain | Out-String).Trim()

if (-not [string]::IsNullOrWhiteSpace($Remaining)) {
  Write-Host ""
  Write-Host "==> Guardando alteracoes locais que nao pertencem ao deploy" -ForegroundColor Cyan
  Run-Git stash push --include-untracked -m $StashName
  $Stashed = $true
}

try {
  Write-Host ""
  Write-Host "==> Atualizando branch de producao" -ForegroundColor Cyan
  Run-Git checkout $ProductionBranch
  Run-Git pull --ff-only origin $ProductionBranch

  Write-Host ""
  Write-Host "==> Integrando a branch $FeatureBranch" -ForegroundColor Cyan
  Run-Git merge --no-ff $FeatureBranch -m "Publica Mercado Pago OAuth no site oficial"

  Write-Host ""
  Write-Host "==> Enviando producao para o GitHub" -ForegroundColor Cyan
  Run-Git push origin $ProductionBranch

  $ProductionSha = (& git rev-parse HEAD).Trim()

  Write-Host ""
  Write-Host "PRODUCTION_COMMIT=$ProductionSha" -ForegroundColor Magenta
} finally {
  Write-Host ""
  Write-Host "==> Retornando para a branch de desenvolvimento" -ForegroundColor Cyan
  Run-Git checkout $FeatureBranch

  if ($Stashed) {
    Write-Host ""
    Write-Host "==> Restaurando alteracoes locais guardadas" -ForegroundColor Cyan
    Run-Git stash pop
  }
}

Write-Host ""
Write-Host "==================================================" -ForegroundColor Magenta
Write-Host "CODIGO ENVIADO PARA PRODUCAO" -ForegroundColor Magenta
Write-Host "==================================================" -ForegroundColor Magenta
Write-Host "A Vercel iniciara o deploy da branch main."
Write-Host "Nao teste pagamentos ainda. Nesta etapa, valide apenas o OAuth."
