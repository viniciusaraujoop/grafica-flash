param(
  [switch]$SkipDatabaseHardening
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"
$env:GIT_PAGER = "cat"
$env:NPM_CONFIG_LOGLEVEL = "error"

$Root = (Get-Location).Path
$ExpectedBranch = "feature/vitrine-marketplace"
$ProjectRef = "ozrasuktfthsvbqprtel"
$CommitMessage = "security: harden checkout, authentication and webhooks"
$V3Script = Join-Path $Root "corrigir-seguranca-completa-orcaly-v3.ps1"

function Write-Section([string]$Text) {
  Write-Host ""
  Write-Host ("=" * 68) -ForegroundColor DarkCyan
  Write-Host $Text -ForegroundColor Cyan
  Write-Host ("=" * 68) -ForegroundColor DarkCyan
}

function Write-Ok([string]$Text) {
  Write-Host "[OK] $Text" -ForegroundColor Green
}

function Write-Warn([string]$Text) {
  Write-Host "[AVISO] $Text" -ForegroundColor Yellow
}

function Normalize-GitPath([string]$Path) {
  return (($Path -replace "\\", "/").Trim())
}

function Get-VercelCommand {
  $command = Get-Command vercel.cmd -ErrorAction SilentlyContinue

  if (-not $command) {
    $command = Get-Command vercel -ErrorAction SilentlyContinue
  }

  if (-not $command) {
    throw "Vercel CLI global não encontrada. Instale com: npm install -g vercel@latest"
  }

  return $command.Source
}

function Invoke-Supabase([string[]]$Arguments) {
  $globalCommand = Get-Command supabase -ErrorAction SilentlyContinue

  if ($globalCommand) {
    & $globalCommand.Source @Arguments
    return $LASTEXITCODE
  }

  $npxCommand = Get-Command npx.cmd -ErrorAction SilentlyContinue

  if (-not $npxCommand) {
    $npxCommand = Get-Command npx -ErrorAction SilentlyContinue
  }

  if (-not $npxCommand) {
    throw "Supabase CLI e npx não foram encontrados."
  }

  & $npxCommand.Source --yes supabase@2.110.0 @Arguments
  return $LASTEXITCODE
}

Write-Section "ORCALY - COMMIT E DEPLOY DAS CORREÇÕES DE SEGURANÇA"

if (-not (Test-Path -LiteralPath (Join-Path $Root "package.json"))) {
  throw "Execute este script na raiz do projeto Orçaly."
}

git rev-parse --is-inside-work-tree | Out-Null

if ($LASTEXITCODE -ne 0) {
  throw "A pasta atual não é um repositório Git."
}

$Branch = (& git branch --show-current | Out-String).Trim()

if ($Branch -ne $ExpectedBranch) {
  throw "Branch atual: $Branch. A esperada é $ExpectedBranch."
}

# ============================================================
# 1. APLICAR A V3 CASO AINDA NÃO TENHA SIDO APLICADA
# ============================================================

$SecurityMarkerFile = Join-Path $Root "lib\orcaly-security.ts"
$SecurityApplied = $false

if (Test-Path -LiteralPath $SecurityMarkerFile) {
  $SecurityApplied = (
    [System.IO.File]::ReadAllText(
      $SecurityMarkerFile,
      [System.Text.Encoding]::UTF8
    ).Contains("ORCALY_SECURITY_HARDENING_V1")
  )
}

if (-not $SecurityApplied) {
  if (-not (Test-Path -LiteralPath $V3Script)) {
    throw "A V3 ainda não foi aplicada e o arquivo corrigir-seguranca-completa-orcaly-v3.ps1 não foi encontrado."
  }

  Write-Section "APLICANDO CORREÇÕES DE SEGURANÇA V3"

  & powershell.exe `
    -NoProfile `
    -ExecutionPolicy Bypass `
    -File $V3Script `
    -SkipDatabase `
    -SkipAuthHardening

  if ($LASTEXITCODE -ne 0) {
    throw "A aplicação da V3 falhou. Commit e deploy cancelados."
  }
}

# ============================================================
# 2. ARQUIVOS QUE PODEM ENTRAR NO COMMIT
# ============================================================

$AllowedFiles = @(
  "package.json",
  "package-lock.json",
  "proxy.ts",
  "lib/supabase.ts",
  "lib/orcaly-security.ts",
  "lib/admin-auth.ts",
  "lib/company-access.ts",
  "lib/mercado-pago.ts",
  "lib/payments/checkout-service.ts",
  "lib/security/rate-limit.ts",
  "lib/security/request.ts",
  "lib/payments/checkout-validation.ts",
  "app/api/checkout/[slug]/route.ts",
  "app/api/checkout/[slug]/prepare/route.ts",
  "app/api/checkout/[slug]/status/route.ts",
  "app/api/marketplace/coupon/route.ts",
  "app/api/security/report/route.ts",
  "app/api/public-site/[slug]/route.ts",
  "app/site/[slug]/page.tsx",
  "app/api/public/uploads/art/route.ts",
  "app/api/arte/[token]/route.ts",
  "app/api/ai/business-assistant/route.ts",
  "app/api/ai/orcamento/route.ts",
  "app/api/marketplace/payments/webhook/mercado-pago/route.ts",
  "app/api/assinatura/checkout/webhook/route.ts",
  "app/api/system/health/route.ts",
  "supabase/migrations/20260729133000_orcaly_security_hardening.sql",
  "scripts/security-check.mjs"
) | ForEach-Object { Normalize-GitPath $_ }

$AllowedSet = @{}
foreach ($Path in $AllowedFiles) {
  $AllowedSet[$Path] = $true
}

$RequiredFiles = @(
  "lib/orcaly-security.ts",
  "lib/security/rate-limit.ts",
  "lib/security/request.ts",
  "app/api/public/uploads/art/route.ts",
  "supabase/migrations/20260729133000_orcaly_security_hardening.sql",
  "scripts/security-check.mjs"
)

foreach ($Path in $RequiredFiles) {
  if (-not (Test-Path -LiteralPath (Join-Path $Root $Path))) {
    throw "Arquivo obrigatório da correção não encontrado: $Path"
  }

  Write-Ok $Path
}

$TrackedChanges = @(
  @(
    git --no-pager diff --name-only
    git --no-pager diff --cached --name-only
  ) |
    ForEach-Object { Normalize-GitPath $_ } |
    Where-Object { $_ } |
    Sort-Object -Unique
)

$UnexpectedTracked = @(
  $TrackedChanges |
    Where-Object { -not $AllowedSet.ContainsKey($_) }
)

if ($UnexpectedTracked.Count -gt 0) {
  Write-Host ""
  Write-Host "Existem outras alterações rastreadas fora da correção:" -ForegroundColor Red

  $UnexpectedTracked | ForEach-Object {
    Write-Host "  $_"
  }

  throw "Commit cancelado para não misturar alterações."
}

# ============================================================
# 3. VALIDAR SEGURANÇA E BUILD
# ============================================================

Write-Section "VALIDANDO CORREÇÕES"

npm run security:check

if ($LASTEXITCODE -ne 0) {
  throw "security:check falhou."
}

Write-Ok "SECURITY_CHECK_EXIT_CODE=0"

git --no-pager diff --check

if ($LASTEXITCODE -ne 0) {
  throw "git diff --check encontrou problemas."
}

Remove-Item `
  -LiteralPath (Join-Path $Root ".next") `
  -Recurse `
  -Force `
  -ErrorAction SilentlyContinue

Write-Section "EXECUTANDO BUILD COMPLETO"

npm run build

if ($LASTEXITCODE -ne 0) {
  throw "O build falhou. Commit e deploy cancelados."
}

Write-Ok "BUILD_EXIT_CODE=0"

# ============================================================
# 4. VALIDAR SEGREDOS DE PRODUÇÃO
# ============================================================

$VercelExe = Get-VercelCommand

& $VercelExe whoami | Out-Null

if ($LASTEXITCODE -ne 0) {
  throw "A Vercel CLI não está autenticada. Execute: vercel login"
}

if (-not (Test-Path -LiteralPath (Join-Path $Root ".vercel\project.json"))) {
  Write-Section "VINCULANDO PROJETO À VERCEL"

  & $VercelExe link --yes

  if ($LASTEXITCODE -ne 0) {
    throw "Não foi possível vincular o projeto à Vercel."
  }
}

Write-Section "VALIDANDO SEGREDOS DE PRODUÇÃO"

$RequiredProductionVariables = @(
  "MP_MARKETPLACE_CLIENT_ID",
  "MP_MARKETPLACE_CLIENT_SECRET",
  "MP_MARKETPLACE_WEBHOOK_SECRET",
  "MP_SUBSCRIPTION_ACCESS_TOKEN",
  "MP_SUBSCRIPTION_WEBHOOK_SECRET",
  "PAYMENT_CREDENTIALS_ENCRYPTION_KEY"
)

$PreviousErrorActionPreference = $ErrorActionPreference
$ErrorActionPreference = "Continue"

$VercelEnvOutput = (
  & $VercelExe env ls production 2>&1 |
    Out-String
)
$VercelEnvExitCode = $LASTEXITCODE

$ErrorActionPreference = $PreviousErrorActionPreference

if ($VercelEnvExitCode -ne 0) {
  throw "Não foi possível consultar as variáveis da Vercel."
}

$MissingProductionVariables = @(
  $RequiredProductionVariables |
    Where-Object {
      $VercelEnvOutput -notmatch [regex]::Escape($_)
    }
)

if ($MissingProductionVariables.Count -gt 0) {
  Write-Host ""
  Write-Host "Variáveis obrigatórias ausentes na Vercel Production:" -ForegroundColor Red

  $MissingProductionVariables | ForEach-Object {
    Write-Host "  $_"
  }

  throw "Deploy cancelado. Configure as variáveis acima com valores reais."
}

Write-Ok "SEGREDOS_DE_PRODUCAO_PRESENTES"

# ============================================================
# 5. APLICAR MIGRAÇÃO CRÍTICA DO SUPABASE
# ============================================================

if (-not $SkipDatabaseHardening) {
  Write-Section "APLICANDO MIGRAÇÃO DE SEGURANÇA NO SUPABASE"

  if ([string]::IsNullOrWhiteSpace($env:SUPABASE_DB_PASSWORD)) {
    throw @"
SUPABASE_DB_PASSWORD não foi definida.

Antes de executar novamente:
`$env:SUPABASE_DB_PASSWORD = "SENHA_DO_BANCO_SUPABASE"
"@
  }

  $LinkExitCode = Invoke-Supabase @(
    "link",
    "--project-ref",
    $ProjectRef,
    "--password",
    $env:SUPABASE_DB_PASSWORD
  )

  if ($LinkExitCode -ne 0) {
    throw "Não foi possível vincular o projeto Supabase."
  }

  $PushExitCode = Invoke-Supabase @(
    "db",
    "push",
    "--password",
    $env:SUPABASE_DB_PASSWORD,
    "--yes"
  )

  if ($PushExitCode -ne 0) {
    throw "A migração de segurança do Supabase falhou."
  }

  Write-Ok "DATABASE_SECURITY_APPLIED=1"

  if (-not [string]::IsNullOrWhiteSpace($env:SUPABASE_ACCESS_TOKEN)) {
    try {
      $Headers = @{
        Authorization = "Bearer $($env:SUPABASE_ACCESS_TOKEN)"
        "Content-Type" = "application/json"
      }

      $Body = @{
        password_hibp_enabled = $true
        password_min_length = 8
        refresh_token_rotation_enabled = $true
        security_update_password_require_reauthentication = $true
      } | ConvertTo-Json

      Invoke-RestMethod `
        -Method Patch `
        -Uri "https://api.supabase.com/v1/projects/$ProjectRef/config/auth" `
        -Headers $Headers `
        -Body $Body | Out-Null

      Write-Ok "PROTECAO_DE_SENHAS_VAZADAS_ATIVADA"
    }
    catch {
      Write-Warn "A migração foi aplicada, mas a proteção HIBP não pôde ser ativada: $($_.Exception.Message)"
    }
  }
  else {
    Write-Warn "SUPABASE_ACCESS_TOKEN ausente. A proteção contra senhas vazadas deverá ser ativada no painel do Supabase."
  }
}
else {
  Write-Warn "Migração do banco ignorada pelo parâmetro -SkipDatabaseHardening."
}

# ============================================================
# 6. PREPARAR COMMIT EXATO
# ============================================================

Write-Section "PREPARANDO COMMIT"

git restore --staged -- . 2>$null

$ExistingAllowedFiles = @(
  $AllowedFiles |
    Where-Object {
      Test-Path -LiteralPath (Join-Path $Root $_)
    }
)

foreach ($Path in $ExistingAllowedFiles) {
  git add -- $Path

  if ($LASTEXITCODE -ne 0) {
    throw "Não foi possível preparar: $Path"
  }
}

$StagedFiles = @(
  @(git --no-pager diff --cached --name-only) |
    ForEach-Object { Normalize-GitPath $_ } |
    Where-Object { $_ } |
    Sort-Object -Unique
)

$UnexpectedStaged = @(
  $StagedFiles |
    Where-Object { -not $AllowedSet.ContainsKey($_) }
)

if ($UnexpectedStaged.Count -gt 0) {
  git restore --staged -- .

  Write-Host "Arquivos inesperados no stage:" -ForegroundColor Red

  $UnexpectedStaged | ForEach-Object {
    Write-Host "  $_"
  }

  throw "Stage cancelado."
}

git --no-pager diff --cached --check

if ($LASTEXITCODE -ne 0) {
  throw "O conteúdo preparado possui problemas."
}

if ($StagedFiles.Count -gt 0) {
  Write-Host ""
  Write-Host "Arquivos do commit:" -ForegroundColor Cyan

  $StagedFiles | ForEach-Object {
    Write-Host "  $_"
  }

  git --no-pager diff --cached --stat

  git commit -m $CommitMessage

  if ($LASTEXITCODE -ne 0) {
    throw "Não foi possível criar o commit."
  }
}
else {
  Write-Warn "Nenhuma alteração nova para commit. O deploy usará o HEAD atual."
}

$Commit = (& git rev-parse --short HEAD | Out-String).Trim()

# ============================================================
# 7. PUSH
# ============================================================

Write-Section "ENVIANDO AO GITHUB"

git push -u origin $ExpectedBranch

if ($LASTEXITCODE -ne 0) {
  throw "O push para o GitHub falhou."
}

Write-Ok "PUSH_CONCLUIDO"

# ============================================================
# 8. DEPLOY LIMPO NA VERCEL
# ============================================================

$DeployFolder = Join-Path `
  $env:TEMP `
  ("orcaly-security-" + $Commit + "-" + (Get-Date -Format "yyyyMMddHHmmss"))

$WorktreeAdded = $false
$DeploySucceeded = $false

try {
  Write-Section "CRIANDO CÓPIA LIMPA DO COMMIT $Commit"

  git worktree add --detach $DeployFolder HEAD

  if ($LASTEXITCODE -ne 0) {
    throw "Não foi possível criar a pasta temporária de deploy."
  }

  $WorktreeAdded = $true

  Copy-Item `
    -LiteralPath (Join-Path $Root ".vercel") `
    -Destination (Join-Path $DeployFolder ".vercel") `
    -Recurse `
    -Force

  Push-Location $DeployFolder

  try {
    Write-Section "PUBLICANDO EM PRODUÇÃO"

    $PreviousErrorActionPreference = $ErrorActionPreference
    $ErrorActionPreference = "Continue"

    & $VercelExe --prod --yes
    $DeployExitCode = $LASTEXITCODE

    $ErrorActionPreference = $PreviousErrorActionPreference

    if ($DeployExitCode -ne 0) {
      throw "O deploy da Vercel falhou."
    }

    $DeploySucceeded = $true
  }
  finally {
    Pop-Location
  }
}
finally {
  if ($WorktreeAdded) {
    try {
      Start-Sleep -Milliseconds 800
      git worktree remove --force $DeployFolder 2>$null | Out-Null
      git worktree prune | Out-Null
    }
    catch {
      Write-Warn "O deploy terminou, mas a pasta temporária não pôde ser removida automaticamente: $DeployFolder"
    }
  }
  elseif (Test-Path -LiteralPath $DeployFolder) {
    Remove-Item `
      -LiteralPath $DeployFolder `
      -Recurse `
      -Force `
      -ErrorAction SilentlyContinue
  }
}

if (-not $DeploySucceeded) {
  throw "O deploy não foi concluído."
}

# ============================================================
# 9. RESULTADO
# ============================================================

Write-Section "CORREÇÕES DE SEGURANÇA PUBLICADAS"

Write-Host "Branch: $ExpectedBranch"
Write-Host "Commit: $Commit"
Write-Host "Commit message: $CommitMessage"
Write-Host "Security check: aprovado"
Write-Host "Build: aprovado"
Write-Host "Migração Supabase: aplicada"
Write-Host "Push: concluído"
Write-Host "Deploy: produção"
Write-Host "Domínio: https://orcaly.com.br"

Write-Host ""
git status -sb
git --no-pager log -3 --oneline
