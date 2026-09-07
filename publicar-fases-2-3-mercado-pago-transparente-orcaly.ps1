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
$StashName = "orcaly-before-mp-phases-2-3-deploy-$Stamp"

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

  & npm.cmd run build
  $Code = $LASTEXITCODE

  Write-Host "BUILD_EXIT_CODE=$Code"

  if ($Code -ne 0) {
    throw "O build falhou. O deploy foi interrompido."
  }
}

function Restore-WorkingFiles {
  if (-not $Stashed) {
    return
  }

  Write-Host ""
  Write-Host "==> Restaurando arquivos locais guardados" -ForegroundColor Cyan

  & git stash pop

  if ($LASTEXITCODE -ne 0) {
    Write-Host ""
    Write-Host "O Git nao conseguiu reaplicar o stash automaticamente." -ForegroundColor Yellow
    Write-Host "Seus arquivos continuam preservados no stash: $StashName" -ForegroundColor Yellow
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
  throw "O repositorio origin nao parece ser $ExpectedRepo. Encontrado: $Origin"
}

$PreStaged = Get-GitText diff --cached --name-only

if (-not [string]::IsNullOrWhiteSpace($PreStaged)) {
  throw @"
Ja existem arquivos preparados para commit:

$PreStaged

Finalize ou desfaça esse stage antes de executar o deploy. O script nao mistura alterações sem autorização.
"@
}

$DeployFiles = @(
  "lib/subscription-mercado-pago-transparent.ts",
  "app/api/assinatura/mercado-pago/route.ts",
  "app/api/assinatura/cancelar/route.ts",
  "app/painel/assinatura/page.tsx",
  "components/subscription/MercadoPagoSubscriptionCheckout.tsx",

  "lib/payments/checkout-service.ts",
  "components/checkout/CheckoutClient.tsx",
  "app/api/checkout/[slug]/prepare/route.ts",
  "app/api/checkout/[slug]/status/route.ts",
  "app/api/checkout/[slug]/pix/route.ts",
  "app/api/checkout/[slug]/pix/[paymentId]/route.ts",
  "app/api/checkout/[slug]/card/route.ts"
)

foreach ($File in $DeployFiles) {
  $LocalPath = Join-Path $Root ($File -replace "/", "\")

  if (-not (Test-Path -LiteralPath $LocalPath)) {
    throw "Arquivo necessario da Fase 2 ou 3 nao encontrado: $File"
  }
}

Write-Host ""
Write-Host "==================================================" -ForegroundColor Cyan
Write-Host "ORCALY - DEPLOY MERCADO PAGO FASES 2 E 3" -ForegroundColor Cyan
Write-Host "Assinatura + checkout transparente + split" -ForegroundColor Cyan
Write-Host "==================================================" -ForegroundColor Cyan
Write-Host "Branch de origem: $FeatureBranch"
Write-Host "Branch de producao: $ProductionBranch"
Write-Host "Repositorio: $Origin"

Run-Git fetch origin --prune

if (-not $SkipFeatureBuild) {
  Run-Build "Validando a branch de desenvolvimento"
}

Write-Host ""
Write-Host "==> Preparando somente os arquivos das Fases 2 e 3" -ForegroundColor Cyan

foreach ($File in $DeployFiles) {
  Run-Git add -- $File
}

$StagedFiles = Get-GitText diff --cached --name-only

if ([string]::IsNullOrWhiteSpace($StagedFiles)) {
  Write-Host "Nenhuma alteracao nova encontrada nesses arquivos." -ForegroundColor Yellow
  Write-Host "O script continuara para verificar se a branch ja possui commits pendentes de deploy." -ForegroundColor Yellow
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

O stage foi desfeito. Nenhum commit foi criado.
"@
  }

  Write-Host ""
  Write-Host "Arquivos que entrarao no commit:" -ForegroundColor Green
  Write-Host $StagedFiles

  Run-Git commit -m "Implementa assinatura e checkout transparente Mercado Pago"
}

$FeatureCommit = Get-GitText rev-parse HEAD

Write-Host ""
Write-Host "==> Enviando a branch de desenvolvimento" -ForegroundColor Cyan
Run-Git push origin $FeatureBranch

$Remaining = Get-GitText status --porcelain

if (-not [string]::IsNullOrWhiteSpace($Remaining)) {
  Write-Host ""
  Write-Host "==> Guardando temporariamente alterações que nao pertencem ao deploy" -ForegroundColor Cyan
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
  Write-Host "==> Integrando as Fases 2 e 3 na producao" -ForegroundColor Cyan
  $MergeStarted = $true

  & git merge --no-ff $FeatureBranch -m "Publica Mercado Pago transparente no Orcaly"

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
      Write-Host "O build da main falhou. Voltando ao commit anterior." -ForegroundColor Red
      Run-Git reset --hard $MainBefore
      throw
    }
  }

  $ProductionCommit = Get-GitText rev-parse HEAD

  Write-Host ""
  Write-Host "==> Enviando a main para o GitHub e acionando a Vercel" -ForegroundColor Cyan
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
Write-Host "DEPLOY DAS FASES 2 E 3 ACIONADO" -ForegroundColor Magenta
Write-Host "==================================================" -ForegroundColor Magenta
Write-Host "A Vercel iniciara o deployment da branch main."
Write-Host ""
Write-Host "Validar depois que o status estiver READY:"
Write-Host "1. https://orcaly.com.br/painel/assinatura"
Write-Host "2. https://orcaly.com.br/painel/pagamentos"
Write-Host "3. https://orcaly.com.br/checkout/grafica-flash"
Write-Host ""
Write-Host "Nao teste com comprador e vendedor na mesma conta Mercado Pago."
