param(
    [switch]$SkipAutomaticPatches
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"
$env:GIT_PAGER = "cat"
$env:NPM_CONFIG_LOGLEVEL = "error"

$Root = (Get-Location).Path
$ExpectedBranch = "feature/vitrine-marketplace"
$CommitMessage = "feat: publica nova home, chat com IA e seguranca"
$ProductionDomain = "https://orcaly.com.br"

function Write-Section([string]$Text) {
    Write-Host ""
    Write-Host ("=" * 72) -ForegroundColor DarkCyan
    Write-Host $Text -ForegroundColor Cyan
    Write-Host ("=" * 72) -ForegroundColor DarkCyan
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

function Get-FileText([string]$Path) {
    if (-not (Test-Path -LiteralPath $Path)) {
        return ""
    }

    return [System.IO.File]::ReadAllText(
        $Path,
        [System.Text.Encoding]::UTF8
    )
}

function Invoke-PatchScript(
    [string]$ScriptName,
    [string[]]$Arguments
) {
    $ScriptPath = Join-Path $Root $ScriptName

    if (-not (Test-Path -LiteralPath $ScriptPath)) {
        throw "Patch necessário não encontrado: $ScriptName"
    }

    Write-Section "EXECUTANDO $ScriptName"

    $PowerShellArguments = @(
        "-NoProfile",
        "-ExecutionPolicy",
        "Bypass",
        "-File",
        $ScriptPath
    )

    if ($Arguments) {
        $PowerShellArguments += $Arguments
    }

    & powershell.exe @PowerShellArguments

    if ($LASTEXITCODE -ne 0) {
        throw "O patch $ScriptName falhou."
    }
}

function Require-Marker(
    [string]$RelativePath,
    [string]$Marker,
    [string]$PatchScript,
    [string[]]$PatchArguments
) {
    $FullPath = Join-Path $Root $RelativePath
    $Content = Get-FileText $FullPath

    if ($Content.Contains($Marker)) {
        Write-Ok "$RelativePath contém $Marker"
        return
    }

    if ($SkipAutomaticPatches) {
        throw "Marcador ausente em ${RelativePath}: $Marker"
    }

    Invoke-PatchScript `
        -ScriptName $PatchScript `
        -Arguments $PatchArguments

    $Content = Get-FileText $FullPath

    if (-not $Content.Contains($Marker)) {
        throw "O patch terminou, mas o marcador ainda está ausente: $Marker"
    }

    Write-Ok "$Marker aplicado"
}

function Resolve-VercelCommand {
    $GlobalCommand = Get-Command vercel.cmd -ErrorAction SilentlyContinue

    if (-not $GlobalCommand) {
        $GlobalCommand = Get-Command vercel -ErrorAction SilentlyContinue
    }

    if ($GlobalCommand) {
        $script:VercelCommand = $GlobalCommand.Source
        $script:VercelPrefix = @()
        return
    }

    $NpxCommand = Get-Command npx.cmd -ErrorAction SilentlyContinue

    if (-not $NpxCommand) {
        $NpxCommand = Get-Command npx -ErrorAction SilentlyContinue
    }

    if (-not $NpxCommand) {
        throw "Vercel CLI e npx não foram encontrados."
    }

    $script:VercelCommand = $NpxCommand.Source
    $script:VercelPrefix = @("--yes", "vercel@latest")
}

function Invoke-Vercel([string[]]$Arguments) {
    $AllArguments = @()

    if ($script:VercelPrefix) {
        $AllArguments += $script:VercelPrefix
    }

    if ($Arguments) {
        $AllArguments += $Arguments
    }

    $PreviousErrorActionPreference = $ErrorActionPreference
    $ErrorActionPreference = "Continue"
    $script:LastVercelExitCode = 1

    try {
        & $script:VercelCommand @AllArguments 2>&1
        $script:LastVercelExitCode = $LASTEXITCODE
    }
    finally {
        $ErrorActionPreference = $PreviousErrorActionPreference
    }
}

Write-Section "ORCALY - COMMIT E DEPLOY COMPLETO V4"

if (-not (Test-Path -LiteralPath (Join-Path $Root "package.json"))) {
    throw "Execute este script na raiz do projeto Orçaly."
}

git rev-parse --is-inside-work-tree | Out-Null

if ($LASTEXITCODE -ne 0) {
    throw "A pasta atual não é um repositório Git."
}

$Branch = (& git branch --show-current | Out-String).Trim()

if ($Branch -ne $ExpectedBranch) {
    throw "Branch atual: $Branch. Branch esperada: $ExpectedBranch."
}

Write-Ok "Branch: $Branch"

git fetch origin

if ($LASTEXITCODE -ne 0) {
    throw "Não foi possível atualizar as referências do GitHub."
}

# ============================================================
# 1. GARANTIR QUE TODOS OS PATCHES FORAM APLICADOS
# ============================================================

Write-Section "VERIFICANDO SEGURANÇA, HOME E CHAT"

Require-Marker `
    -RelativePath "lib\orcaly-security.ts" `
    -Marker "ORCALY_SECURITY_HARDENING_V1" `
    -PatchScript "corrigir-seguranca-completa-orcaly-v3.ps1" `
    -PatchArguments @("-SkipDatabase", "-SkipAuthHardening")

Require-Marker `
    -RelativePath "app\page.tsx" `
    -Marker "ORCALY_HOME_CONVERSION_V2" `
    -PatchScript "repaginar-home-responsiva-orcaly-v2.ps1" `
    -PatchArguments @()

Require-Marker `
    -RelativePath "components\home\HomeAiChat.tsx" `
    -Marker "ORCALY_HOME_AI_CHAT_V2" `
    -PatchScript "aprimorar-chat-ia-home-orcaly-v2.ps1" `
    -PatchArguments @()

Require-Marker `
    -RelativePath "app\api\public\home-chat\route.ts" `
    -Marker "ORCALY_HOME_AI_CHAT_API_V2" `
    -PatchScript "aprimorar-chat-ia-home-orcaly-v2.ps1" `
    -PatchArguments @()

# ============================================================
# 2. DEFINIR ESCOPO EXATO DO COMMIT
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
    "scripts/security-check.mjs",
    "app/page.tsx",
    "components/home/HomeAiChat.tsx",
    "app/api/public/home-chat/route.ts"
) | ForEach-Object {
    Normalize-GitPath $_
}

$AllowedSet = @{}

foreach ($File in $AllowedFiles) {
    $AllowedSet[$File] = $true
}

$TrackedChanges = @()

$TrackedChanges += @(
    git --no-pager diff --name-only
)

$TrackedChanges += @(
    git --no-pager diff --cached --name-only
)

$TrackedChanges = @(
    $TrackedChanges |
        ForEach-Object {
            Normalize-GitPath $_
        } |
        Where-Object {
            $_
        } |
        Sort-Object -Unique
)

$UnexpectedTracked = @(
    $TrackedChanges |
        Where-Object {
            -not $AllowedSet.ContainsKey($_)
        }
)

if ($UnexpectedTracked.Count -gt 0) {
    Write-Host ""
    Write-Host "Alterações rastreadas fora do escopo:" -ForegroundColor Red

    foreach ($File in $UnexpectedTracked) {
        Write-Host "  $File"
    }

    throw "Commit cancelado para não misturar alterações não relacionadas."
}

Write-Ok "Escopo do commit validado"

# ============================================================
# 3. DEPENDÊNCIAS, SEGURANÇA E BUILD
# ============================================================

Write-Section "ATUALIZANDO DEPENDÊNCIAS"

npm install --no-audit --no-fund

if ($LASTEXITCODE -ne 0) {
    throw "npm install falhou."
}

Write-Section "VALIDANDO SEGURANÇA"

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
# 4. VALIDAR VERCEL E VARIÁVEIS DE PRODUÇÃO
# ============================================================

Resolve-VercelCommand

Write-Section "VALIDANDO CONEXÃO COM A VERCEL"

$WhoAmIOutput = @(
    Invoke-Vercel @("whoami") 2>&1
)

$WhoAmIExitCode = $script:LastVercelExitCode

if ($WhoAmIExitCode -ne 0) {
    $WhoAmIOutput | ForEach-Object {
        Write-Host $_
    }

    throw "A Vercel CLI não está autenticada. Execute: vercel login"
}

Write-Ok "Vercel autenticada"

if (-not (Test-Path -LiteralPath (Join-Path $Root ".vercel\project.json"))) {
    Write-Section "VINCULANDO O PROJETO À VERCEL"

    Invoke-Vercel @("link", "--yes")

    if ($script:LastVercelExitCode -ne 0) {
        throw "Não foi possível vincular o projeto à Vercel."
    }
}

Write-Section "VALIDANDO VARIÁVEIS DE PRODUÇÃO"

$VercelEnvOutputArray = @(
    Invoke-Vercel @("env", "ls", "production") 2>&1
)

$VercelEnvExitCode = $script:LastVercelExitCode
$VercelEnvOutput = $VercelEnvOutputArray -join "`n"

if ($VercelEnvExitCode -ne 0) {
    $VercelEnvOutputArray | ForEach-Object {
        Write-Host $_
    }

    throw "Não foi possível consultar as variáveis da Vercel."
}

$RequiredVariables = @(
    "AI_GATEWAY_API_KEY",
    "MP_MARKETPLACE_CLIENT_ID",
    "MP_MARKETPLACE_CLIENT_SECRET",
    "MP_MARKETPLACE_WEBHOOK_SECRET",
    "MP_SUBSCRIPTION_ACCESS_TOKEN",
    "MP_SUBSCRIPTION_WEBHOOK_SECRET",
    "PAYMENT_CREDENTIALS_ENCRYPTION_KEY"
)

$MissingVariables = @()

foreach ($Variable in $RequiredVariables) {
    if ($VercelEnvOutput -notmatch [regex]::Escape($Variable)) {
        $MissingVariables += $Variable
    }
    else {
        Write-Ok $Variable
    }
}

if ($MissingVariables.Count -gt 0) {
    Write-Host ""
    Write-Host "Variáveis ausentes em Production:" -ForegroundColor Red

    foreach ($Variable in $MissingVariables) {
        Write-Host "  $Variable"
    }

    throw "Deploy cancelado até que as variáveis sejam configuradas."
}

# ============================================================
# 5. PREPARAR E CRIAR O COMMIT
# ============================================================

Write-Section "PREPARANDO COMMIT"

git restore --staged -- . 2>$null

foreach ($File in $AllowedFiles) {
    $FullPath = Join-Path $Root ($File -replace "/", "\")
    $TrackedOutput = @(
        git ls-files -- $File
    )

    $Tracked = $TrackedOutput.Count -gt 0

    if ((Test-Path -LiteralPath $FullPath) -or $Tracked) {
        git add -A -- $File

        if ($LASTEXITCODE -ne 0) {
            throw "Não foi possível preparar o arquivo: $File"
        }
    }
}

$StagedFiles = @(
    git --no-pager diff --cached --name-only |
        ForEach-Object {
            Normalize-GitPath $_
        } |
        Where-Object {
            $_
        } |
        Sort-Object -Unique
)

$UnexpectedStaged = @(
    $StagedFiles |
        Where-Object {
            -not $AllowedSet.ContainsKey($_)
        }
)

if ($UnexpectedStaged.Count -gt 0) {
    git restore --staged -- .

    Write-Host "Arquivos inesperados no stage:" -ForegroundColor Red

    foreach ($File in $UnexpectedStaged) {
        Write-Host "  $File"
    }

    throw "Stage cancelado."
}

git --no-pager diff --cached --check

if ($LASTEXITCODE -ne 0) {
    throw "O conteúdo preparado possui problemas."
}

if ($StagedFiles.Count -gt 0) {
    Write-Host ""
    Write-Host "Arquivos incluídos:" -ForegroundColor Cyan

    foreach ($File in $StagedFiles) {
        Write-Host "  $File"
    }

    git --no-pager diff --cached --stat

    git commit -m $CommitMessage

    if ($LASTEXITCODE -ne 0) {
        throw "Não foi possível criar o commit."
    }

    Write-Ok "Commit criado"
}
else {
    Write-Warn "Nenhuma alteração nova para commit. O HEAD atual será publicado."
}

$CommitSha = (& git rev-parse HEAD | Out-String).Trim()
$ShortCommit = (& git rev-parse --short HEAD | Out-String).Trim()

# ============================================================
# 6. PUSH PARA O GITHUB
# ============================================================

Write-Section "ENVIANDO AO GITHUB"

git push -u origin $Branch

if ($LASTEXITCODE -ne 0) {
    throw "O push para o GitHub falhou."
}

Write-Ok "PUSH_CONCLUIDO"
Write-Ok "Commit: $ShortCommit"

# ============================================================
# 7. DEPLOY LIMPO NA VERCEL
# ============================================================

$DeployFolder = Join-Path `
    $env:TEMP `
    ("orcaly-production-" + $ShortCommit + "-" + (Get-Date -Format "yyyyMMddHHmmss"))

$WorktreeAdded = $false
$DeploymentSucceeded = $false
$DeploymentUrl = ""

try {
    Write-Section "CRIANDO CÓPIA LIMPA DO COMMIT"

    git worktree add --detach $DeployFolder $CommitSha

    if ($LASTEXITCODE -ne 0) {
        throw "Não foi possível criar a cópia limpa para deploy."
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

        $DeployOutputArray = @(
            Invoke-Vercel @("--prod", "--yes", "--force") 2>&1
        )

        $DeployExitCode = $script:LastVercelExitCode

        $DeployOutputArray | ForEach-Object {
            Write-Host $_
        }

        if ($DeployExitCode -ne 0) {
            throw "O deploy da Vercel falhou."
        }

        $DeployText = $DeployOutputArray -join "`n"
        $UrlMatches = [regex]::Matches(
            $DeployText,
            "https://[A-Za-z0-9.-]+\.vercel\.app"
        )

        if ($UrlMatches.Count -gt 0) {
            $DeploymentUrl = $UrlMatches[$UrlMatches.Count - 1].Value
        }

        $DeploymentSucceeded = $true
    }
    finally {
        Pop-Location
    }
}
finally {
    if ($WorktreeAdded) {
        try {
            git worktree remove --force $DeployFolder 2>$null | Out-Null
            git worktree prune | Out-Null
        }
        catch {
            Write-Warn "Não foi possível remover automaticamente: $DeployFolder"
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

if (-not $DeploymentSucceeded) {
    throw "O deploy não foi concluído."
}

# ============================================================
# 8. TESTE REAL EM PRODUÇÃO
# ============================================================

Write-Section "TESTANDO PRODUÇÃO"

$HomeResponse = Invoke-WebRequest `
    -Uri $ProductionDomain `
    -UseBasicParsing `
    -TimeoutSec 40

if ($HomeResponse.StatusCode -ne 200) {
    throw "A Home respondeu HTTP $($HomeResponse.StatusCode)."
}

Write-Ok "HOME_HTTP_200"

$ChatBody = @{
    question = "Tenho uma pequena gráfica e estou começando. Qual plano combina comigo?"
    messages = @()
} | ConvertTo-Json -Depth 5

$ChatResponse = Invoke-RestMethod `
    -Method Post `
    -Uri "$ProductionDomain/api/public/home-chat" `
    -ContentType "application/json; charset=utf-8" `
    -Body $ChatBody `
    -TimeoutSec 45

$ChatAnswer = [string]$ChatResponse.answer
$ChatSource = [string]$ChatResponse.source

if ([string]::IsNullOrWhiteSpace($ChatAnswer)) {
    throw "O chat de produção não retornou uma resposta."
}

Write-Ok "CHAT_RESPONDEU"

if ($ChatSource -eq "ai") {
    Write-Ok "CHAT_USANDO_IA"
}
else {
    Write-Warn "O chat respondeu pelo fallback guiado. Revise os logs e o crédito do AI Gateway."
}

Write-Host ""
Write-Host "Resposta de teste:" -ForegroundColor Cyan
Write-Host $ChatAnswer

# ============================================================
# 9. RESULTADO
# ============================================================

Write-Section "PUBLICAÇÃO CONCLUÍDA"

Write-Host "Branch: $Branch"
Write-Host "Commit: $ShortCommit"
Write-Host "Mensagem: $CommitMessage"
Write-Host "GitHub: push concluído"
Write-Host "Deploy: produção"
Write-Host "Domínio: $ProductionDomain"

if ($DeploymentUrl) {
    Write-Host "Deploy Vercel: $DeploymentUrl"
}

Write-Host "Home: HTTP 200"
Write-Host "Chat: respondendo"
Write-Host "Fonte do chat: $ChatSource"
Write-Host ""
git status -sb
git --no-pager log -3 --oneline
