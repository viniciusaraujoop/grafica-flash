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
$StashName = "orcaly-before-checkout-deploy-$Stamp"

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
  Write-Host "==> Restaurando arquivos locais que nao pertencem ao deploy" -ForegroundColor Cyan

  & git stash pop

  if ($LASTEXITCODE -ne 0) {
    Write-Host ""
    Write-Host "O Git nao reaplicou o stash automaticamente." -ForegroundColor Yellow
    Write-Host "Nada foi perdido. O stash continua salvo como:" -ForegroundColor Yellow
    Write-Host $StashName -ForegroundColor Yellow
    Write-Host "Consulte com: git stash list" -ForegroundColor Yellow
  }
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

Finalize ou desfaça esse stage antes do deploy.
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

  # Checkout das empresas
  "components/checkout/CheckoutClient.tsx",
  "lib/payments/checkout-service.ts",
  "app/api/checkout/[slug]/prepare/route.ts",
  "app/api/checkout/[slug]/status/route.ts",
  "app/api/checkout/[slug]/pix/route.ts",
  "app/api/checkout/[slug]/pix/[paymentId]/route.ts",
  "app/api/checkout/[slug]/card/route.ts"
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
Write-Host "ORCALY - COMMIT E DEPLOY DO NOVO CHECKOUT" -ForegroundColor Cyan
Write-Host "Cadastro + assinatura + Pix + cartoes" -ForegroundColor Cyan
Write-Host "==================================================" -ForegroundColor Cyan
Write-Host "Repositorio: $Origin"
Write-Host "Origem: $FeatureBranch"
Write-Host "Producao: $ProductionBranch"

Run-Git fetch origin --prune

if (-not $SkipFeatureBuild) {
  Run-Build "Validando as alteracoes na branch de desenvolvimento"
}

Write-Host ""
Write-Host "==> Preparando somente os arquivos do checkout e pagamentos" -ForegroundColor Cyan

foreach ($File in $DeployFiles) {
  Run-Git add -- $File
}

$StagedFiles = Get-GitText diff --cached --name-only

if ([string]::IsNullOrWhiteSpace($StagedFiles)) {
  Write-Host "Nenhuma alteracao nova nesses arquivos." -ForegroundColor Yellow
  Write-Host "O script verificara se a branch possui commits pendentes para producao." -ForegroundColor Yellow
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

  Run-Git commit -m "Redesenha checkout de cadastro e assinatura Mercado Pago"
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

  Write-Host ""
  Write-Host "==> Integrando o novo checkout na producao" -ForegroundColor Cyan
  $MergeStarted = $true

  & git merge --no-ff $FeatureBranch -m "Publica novo checkout Mercado Pago no Orcaly"

  if ($LASTEXITCODE -ne 0) {
    & git merge --abort 2>$null
    $MergeStarted = $false
    throw "O merge encontrou conflito e foi abortado. Nada foi enviado para producao."
  }

  $MergeStarted = $false

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

  Write-Host ""
  Write-Host "==> Enviando a main e acionando a Vercel" -ForegroundColor Cyan
  Run-Git push origin $ProductionBranch
  $MainPushed = $true

  Write-Host ""
  Write-Host "PRODUCTION_COMMIT=$ProductionCommit" -ForegroundColor Magenta
  Write-Host "DEPLOY_TRIGGERED=true" -ForegroundColor Magenta
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
Write-Host "Validar somente quando o deployment estiver READY:"
Write-Host "1. https://orcaly.com.br/cadastro"
Write-Host "2. https://orcaly.com.br/checkout/cadastro"
Write-Host "3. https://orcaly.com.br/painel/assinatura"
Write-Host "4. https://orcaly.com.br/checkout/grafica-flash"
