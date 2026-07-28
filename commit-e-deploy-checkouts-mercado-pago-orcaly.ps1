param(
  [switch]$SkipFeatureBuild,
  [switch]$SkipMainBuild
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$Root = (Get-Location).Path
$FeatureBranch = "feature/asaas-sandbox"
$ProductionBranch = "main"
$ExpectedRepo = "viniciusaraujoop/grafica-flash"
$Stamp = Get-Date -Format "yyyyMMdd-HHmmss"
$StashName = "orcaly-before-checkout-suite-deploy-$Stamp"

$Stashed = $false
$OnMain = $false
$MergeStarted = $false
$MainPushed = $false
$MainBefore = ""
$FeatureCommit = ""

function Run-Git {
  param(
    [Parameter(ValueFromRemainingArguments = $true)]
    [string[]]$Args
  )

  & git @Args

  if ($LASTEXITCODE -ne 0) {
    throw "Falha ao executar: git $($Args -join ' ')"
  }
}

function Get-GitText {
  param(
    [Parameter(ValueFromRemainingArguments = $true)]
    [string[]]$Args
  )

  $Output = (& git @Args 2>&1 | Out-String).Trim()

  if ($LASTEXITCODE -ne 0) {
    throw "Falha ao executar: git $($Args -join ' ')`n$Output"
  }

  return $Output
}

function Run-Build {
  param([string]$Label)

  Write-Host ""
  Write-Host "==> $Label" -ForegroundColor Cyan

  Remove-Item -Recurse -Force (Join-Path $Root ".next") -ErrorAction SilentlyContinue

  & npm.cmd run build
  $Code = $LASTEXITCODE

  Write-Host "BUILD_EXIT_CODE=$Code"

  if ($Code -ne 0) {
    throw "O build falhou. Commit e deploy foram interrompidos."
  }
}

function Restore-WorkingFiles {
  if (-not $Stashed) {
    return
  }

  Write-Host ""
  Write-Host "==> Restaurando arquivos locais fora do deploy" -ForegroundColor Cyan

  & git stash pop

  if ($LASTEXITCODE -ne 0) {
    Write-Host ""
    Write-Host "O Git nao reaplicou o stash automaticamente." -ForegroundColor Yellow
    Write-Host "Nada foi perdido. Consulte com: git stash list" -ForegroundColor Yellow
    Write-Host "Stash: $StashName" -ForegroundColor Yellow
  }
}

function Assert-Contains {
  param(
    [string]$Path,
    [string]$Pattern,
    [string]$Description
  )

  $Match = Select-String `
    -LiteralPath (Join-Path $Root ($Path -replace "/", "\")) `
    -Pattern $Pattern `
    -SimpleMatch `
    -ErrorAction SilentlyContinue

  if (-not $Match) {
    throw "Preflight falhou: $Description`nArquivo: $Path"
  }

  Write-Host "[OK] $Description" -ForegroundColor Green
}

function Assert-NotContains {
  param(
    [string]$Path,
    [string]$Pattern,
    [string]$Description
  )

  $Match = Select-String `
    -LiteralPath (Join-Path $Root ($Path -replace "/", "\")) `
    -Pattern $Pattern `
    -SimpleMatch `
    -ErrorAction SilentlyContinue

  if ($Match) {
    throw "Preflight falhou: $Description`nArquivo: $Path`nLinha: $($Match.LineNumber)"
  }

  Write-Host "[OK] $Description" -ForegroundColor Green
}

if (-not (Test-Path -LiteralPath (Join-Path $Root "package.json"))) {
  throw "Execute este script na raiz do projeto Orcaly."
}

$CurrentBranch = Get-GitText branch --show-current

if ($CurrentBranch -ne $FeatureBranch) {
  throw "Branch atual: $CurrentBranch. Execute na branch $FeatureBranch."
}

$Origin = Get-GitText remote get-url origin

if ($Origin -notmatch [regex]::Escape($ExpectedRepo)) {
  throw "Repositorio inesperado. Encontrado: $Origin"
}

$AlreadyStaged = Get-GitText diff --cached --name-only

if (-not [string]::IsNullOrWhiteSpace($AlreadyStaged)) {
  throw @"
Ja existem arquivos preparados para commit:

$AlreadyStaged

Finalize ou desfaça esse stage antes deste deploy.
"@
}

$DeployFiles = @(
  # Cadastro e checkout inicial
  "app/cadastro/page.tsx",
  "app/checkout/cadastro/page.tsx",
  "components/checkout/SignupCheckout.tsx",
  "lib/signup-checkout.ts",
  "app/api/checkout/lead/route.ts",
  "app/api/checkout/signup/route.ts",
  "app/api/checkout/signup/pix/route.ts",
  "app/api/checkout/signup/card/route.ts",
  "app/api/checkout/signup/status/route.ts",
  "app/api/leads/complete-account/route.ts",
  "app/api/mercado-pago/webhook-leads/route.ts",

  # Assinatura do Orcaly
  "app/painel/assinatura/page.tsx",
  "components/subscription/MercadoPagoSubscriptionCheckout.tsx",
  "lib/subscription-mercado-pago-transparent.ts",
  "lib/subscription-checkout-payment.ts",
  "lib/subscription-service.ts",
  "app/api/assinatura/mercado-pago/route.ts",
  "app/api/assinatura/cancelar/route.ts",
  "app/api/assinatura/checkout/route.ts",
  "app/api/assinatura/checkout/status/route.ts",
  "app/api/assinatura/checkout/webhook/route.ts",

  # Marketplace e recebimentos
  "components/checkout/CheckoutClient.tsx",
  "lib/payments/checkout-service.ts",
  "app/api/checkout/[slug]/route.ts",
  "app/api/checkout/[slug]/prepare/route.ts",
  "app/api/checkout/[slug]/status/route.ts",
  "app/api/checkout/[slug]/pix/route.ts",
  "app/api/checkout/[slug]/pix/[paymentId]/route.ts",
  "app/api/checkout/[slug]/card/route.ts",
  "components/painel/MarketplacePaymentsPanel.tsx",
  "lib/panel-modules.ts",
  "app/painel/formas-pagamento/page.tsx"
)

$Missing = @()

foreach ($File in $DeployFiles) {
  $Path = Join-Path $Root ($File -replace "/", "\")

  if (-not (Test-Path -LiteralPath $Path)) {
    $Missing += $File
  }
}

if ($Missing.Count -gt 0) {
  throw @"
Arquivos necessarios nao encontrados:

$($Missing -join "`n")

As alteracoes ainda nao foram aplicadas por completo.
"@
}

Write-Host ""
Write-Host "==================================================" -ForegroundColor Cyan
Write-Host "ORCALY - COMMIT E DEPLOY DOS CHECKOUTS" -ForegroundColor Cyan
Write-Host "Cadastro + assinatura + marketplace Mercado Pago" -ForegroundColor Cyan
Write-Host "==================================================" -ForegroundColor Cyan
Write-Host "Repositorio: $Origin"
Write-Host "Origem: $FeatureBranch"
Write-Host "Producao: $ProductionBranch"

Write-Host ""
Write-Host "==> Validando regras antes do commit" -ForegroundColor Cyan

Assert-Contains `
  "app/cadastro/page.tsx" `
  "cpf_cnpj" `
  "CPF/CNPJ presente no cadastro"

Assert-Contains `
  "components/checkout/SignupCheckout.tsx" `
  "signup_payment_brick" `
  "Payment Brick presente no checkout de cadastro"

Assert-Contains `
  "components/checkout/CheckoutClient.tsx" `
  "marketplace_payment_brick" `
  "Payment Brick presente no marketplace"

Assert-Contains `
  "lib/payments/checkout-service.ts" `
  "DEBIT_CARD" `
  "Credito e debito aceitos no marketplace"

Assert-Contains `
  "lib/signup-checkout.ts" `
  'url.protocol === "https:"' `
  "notification_url publica protegida"

Assert-Contains `
  "app/painel/formas-pagamento/page.tsx" `
  'redirect("/painel/pagamentos?tab=mercado-pago")' `
  "rota antiga redireciona para Mercado Pago"

Assert-NotContains `
  "components/painel/MarketplacePaymentsPanel.tsx" `
  "PaymentMethodsManager" `
  "gerenciador antigo de formas removido"

Assert-NotContains `
  "components/painel/MarketplacePaymentsPanel.tsx" `
  "tab=formas" `
  "aba antiga de formas removida"

Assert-NotContains `
  "lib/panel-modules.ts" `
  "id: 'formas_pagamento'" `
  "menu antigo de formas removido"

Run-Git fetch origin --prune

if (-not $SkipFeatureBuild) {
  Run-Build "Validando a branch de desenvolvimento"
}

Write-Host ""
Write-Host "==> Preparando somente os arquivos dos checkouts" -ForegroundColor Cyan

foreach ($File in $DeployFiles) {
  Run-Git add -- $File
}

$StagedFiles = Get-GitText diff --cached --name-only

if ([string]::IsNullOrWhiteSpace($StagedFiles)) {
  Write-Host "Nenhuma alteracao nova nesses arquivos." -ForegroundColor Yellow
  Write-Host "O script verificara commits pendentes para a producao." -ForegroundColor Yellow
} else {
  $Allowed = [System.Collections.Generic.HashSet[string]]::new(
    [string[]]$DeployFiles,
    [System.StringComparer]::OrdinalIgnoreCase
  )

  $Unexpected = @(
    $StagedFiles -split "`r?`n" |
      Where-Object { $_ -and -not $Allowed.Contains($_) }
  )

  if ($Unexpected.Count -gt 0) {
    Run-Git reset

    throw @"
Arquivos inesperados apareceram no stage:

$($Unexpected -join "`n")

O stage foi desfeito.
"@
  }

  Write-Host ""
  Write-Host "Arquivos do commit:" -ForegroundColor Green
  Write-Host $StagedFiles

  Run-Git commit -m "Padroniza checkouts e exige Mercado Pago no marketplace"
}

$FeatureCommit = Get-GitText rev-parse HEAD

Write-Host ""
Write-Host "==> Enviando a branch de desenvolvimento" -ForegroundColor Cyan
Run-Git push origin $FeatureBranch

$Remaining = Get-GitText status --porcelain

if (-not [string]::IsNullOrWhiteSpace($Remaining)) {
  Write-Host ""
  Write-Host "==> Guardando temporariamente alteracoes fora do deploy" -ForegroundColor Cyan
  Run-Git stash push --include-untracked -m $StashName
  $Stashed = $true
}

try {
  Write-Host ""
  Write-Host "==> Abrindo a branch de producao" -ForegroundColor Cyan
  Run-Git checkout $ProductionBranch
  $OnMain = $true

  Run-Git pull --ff-only origin $ProductionBranch
  $MainBefore = Get-GitText rev-parse HEAD

  Write-Host ""
  Write-Host "MAIN_ANTERIOR=$MainBefore" -ForegroundColor DarkGray
  Write-Host "FEATURE_COMMIT=$FeatureCommit" -ForegroundColor DarkGray

  $PendingCountText = Get-GitText rev-list --count "$ProductionBranch..$FeatureBranch"
  $PendingCount = [int]$PendingCountText

  if ($PendingCount -gt 0) {
    Write-Host ""
    Write-Host "==> Integrando $PendingCount commit(s) na producao" -ForegroundColor Cyan
    $MergeStarted = $true

    & git merge --no-ff $FeatureBranch -m "Publica checkouts Mercado Pago no Orcaly"

    if ($LASTEXITCODE -ne 0) {
      & git merge --abort 2>$null
      $MergeStarted = $false
      throw "O merge encontrou conflito e foi abortado. Nada foi enviado para producao."
    }

    $MergeStarted = $false
  } else {
    Write-Host ""
    Write-Host "A main ja contem todos os commits da feature." -ForegroundColor Yellow
  }

  if (-not $SkipMainBuild) {
    try {
      Run-Build "Validando o resultado final na branch main"
    } catch {
      Write-Host ""
      Write-Host "O build da main falhou. Restaurando o commit anterior." -ForegroundColor Red
      Run-Git reset --hard $MainBefore
      throw
    }
  }

  $ProductionCommit = Get-GitText rev-parse HEAD

  if ($ProductionCommit -ne $MainBefore) {
    Write-Host ""
    Write-Host "==> Enviando a main e acionando a Vercel" -ForegroundColor Cyan
    Run-Git push origin $ProductionBranch
    $MainPushed = $true
  } else {
    Write-Host ""
    Write-Host "Nenhum commit novo para enviar na main." -ForegroundColor Yellow
    $MainPushed = $true
  }

  Write-Host ""
  Write-Host "PRODUCTION_COMMIT=$ProductionCommit" -ForegroundColor Magenta
  Write-Host "DEPLOY_TRIGGERED=$($ProductionCommit -ne $MainBefore)" -ForegroundColor Magenta
} catch {
  if ($OnMain -and $MergeStarted) {
    & git merge --abort 2>$null
  }

  if (
    $OnMain -and
    -not $MainPushed -and
    -not [string]::IsNullOrWhiteSpace($MainBefore)
  ) {
    & git reset --hard $MainBefore 2>$null
  }

  throw
} finally {
  if ($OnMain) {
    Write-Host ""
    Write-Host "==> Retornando para $FeatureBranch" -ForegroundColor Cyan
    & git checkout $FeatureBranch

    if ($LASTEXITCODE -ne 0) {
      Write-Host "Nao foi possivel retornar automaticamente para $FeatureBranch." -ForegroundColor Yellow
    }
  }

  Restore-WorkingFiles
}

Write-Host ""
Write-Host "==================================================" -ForegroundColor Magenta
Write-Host "COMMIT CRIADO E DEPLOY ACIONADO" -ForegroundColor Magenta
Write-Host "==================================================" -ForegroundColor Magenta
Write-Host "A Vercel iniciara o deployment da branch main."
Write-Host ""
Write-Host "Validar quando o deployment estiver READY:"
Write-Host "1. https://orcaly.com.br/cadastro"
Write-Host "2. https://orcaly.com.br/painel/assinatura"
Write-Host "3. https://orcaly.com.br/painel/pagamentos"
Write-Host "4. https://orcaly.com.br/checkout/grafica-flash"
