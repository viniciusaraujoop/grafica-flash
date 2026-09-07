Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"
$env:GIT_PAGER = "cat"
$env:NPM_CONFIG_LOGLEVEL = "error"

$Root = (Get-Location).Path
$ExpectedBranch = "feature/vitrine-marketplace"
$RelativePath = "components/food/DeliveriesManager.tsx"
$AllowedPath = "components/food/DeliveriesManager.tsx"
$CommitMessage = "feat: repagina central de entregas"

function Normalize-GitPath([string]$Path) {
    return ($Path -replace "\\", "/").Trim()
}

# ============================================================
# 1. VALIDAR PROJETO E BRANCH
# ============================================================

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

if (-not (Test-Path -LiteralPath (Join-Path $Root $RelativePath))) {
    throw "Arquivo não encontrado: $RelativePath"
}

# ============================================================
# 2. VALIDAR O ARQUIVO CORRIGIDO
# ============================================================

$Source = Join-Path $Root $RelativePath
$Content = [System.IO.File]::ReadAllText(
    $Source,
    [System.Text.Encoding]::UTF8
)

$Checks = @(
    "ORCALY_DELIVERIES_COMMAND_CENTER_V1",
    "Central de entregas",
    "!text-white",
    "color: '#ffffff'",
    "Operação logística",
    "Quadro",
    "Lista",
    "Nova entrega",
    "Confirmar entrega"
)

Write-Host "==> Validando a Central de Entregas" -ForegroundColor Cyan

foreach ($Text in $Checks) {
    if (-not $Content.Contains($Text)) {
        throw "Atualização não encontrada: $Text"
    }

    Write-Host "[OK] $Text" -ForegroundColor Green
}

$CorruptedPatterns = @(
    "ðŸ",
    "OperaÃ",
    "logÃ",
    "confirmaÃ",
    "preparaÃ",
    "entregaÃ",
    "Ã§",
    "Ã£",
    "Ã¡",
    "Ã©"
)

foreach ($Pattern in $CorruptedPatterns) {
    if ($Content.Contains($Pattern)) {
        throw "Texto corrompido encontrado: $Pattern"
    }
}

Write-Host "[OK] Codificação UTF-8 validada." -ForegroundColor Green

# ============================================================
# 3. GARANTIR QUE SOMENTE O ARQUIVO DE ENTREGAS ENTRE NO COMMIT
# ============================================================

git add -- $RelativePath

if ($LASTEXITCODE -ne 0) {
    throw "Não foi possível preparar o arquivo para commit."
}

git --no-pager diff --cached --check

if ($LASTEXITCODE -ne 0) {
    throw "O conteúdo preparado possui problemas."
}

$StagedFiles = @(
    @(git --no-pager diff --cached --name-only) |
    ForEach-Object { Normalize-GitPath $_ } |
    Where-Object { $_ }
)

$UnexpectedStaged = @(
    $StagedFiles |
    Where-Object { $_ -ne $AllowedPath }
)

if ($UnexpectedStaged.Count -gt 0) {
    Write-Host ""
    Write-Host "Existem arquivos inesperados preparados para commit:" -ForegroundColor Red

    $UnexpectedStaged | ForEach-Object {
        Write-Host "  $_"
    }

    throw "Commit cancelado para não misturar alterações."
}

if ($StagedFiles.Count -eq 0) {
    Write-Host ""
    Write-Host "Nenhuma alteração nova está preparada." -ForegroundColor Yellow
    Write-Host "O script seguirá com o commit atual da branch." -ForegroundColor Yellow
}
else {
    Write-Host ""
    Write-Host "Arquivo do commit:" -ForegroundColor Cyan

    $StagedFiles | ForEach-Object {
        Write-Host "  $_"
    }

    git --no-pager diff --cached --stat

    git commit -m $CommitMessage

    if ($LASTEXITCODE -ne 0) {
        throw "Não foi possível criar o commit."
    }
}

$Commit = (& git rev-parse --short HEAD | Out-String).Trim()

# ============================================================
# 4. PUSH
# ============================================================

Write-Host ""
Write-Host "==> Enviando commit $Commit ao GitHub" -ForegroundColor Cyan

git push -u origin $ExpectedBranch

if ($LASTEXITCODE -ne 0) {
    throw "O push para o GitHub falhou."
}

# ============================================================
# 5. LOCALIZAR OU INSTALAR VERCEL CLI
# ============================================================

$VercelCommand = Get-Command vercel.cmd -ErrorAction SilentlyContinue

if (-not $VercelCommand) {
    $VercelCommand = Get-Command vercel -ErrorAction SilentlyContinue
}

if (-not $VercelCommand) {
    Write-Host ""
    Write-Host "==> Instalando Vercel CLI" -ForegroundColor Cyan

    npm install -g vercel@latest

    if ($LASTEXITCODE -ne 0) {
        throw "Não foi possível instalar a Vercel CLI."
    }

    $VercelCommand = Get-Command vercel.cmd -ErrorAction SilentlyContinue

    if (-not $VercelCommand) {
        $VercelCommand = Get-Command vercel -ErrorAction SilentlyContinue
    }
}

if (-not $VercelCommand) {
    throw "O comando da Vercel não foi encontrado."
}

$VercelExe = $VercelCommand.Source

# ============================================================
# 6. VERIFICAR LOGIN DA VERCEL
# ============================================================

$PreviousErrorActionPreference = $ErrorActionPreference
$ErrorActionPreference = "Continue"

& $VercelExe whoami
$WhoAmIExitCode = $LASTEXITCODE

$ErrorActionPreference = $PreviousErrorActionPreference

if ($WhoAmIExitCode -ne 0) {
    Write-Host ""
    Write-Host "==> Autenticando na Vercel" -ForegroundColor Yellow

    & $VercelExe login

    if ($LASTEXITCODE -ne 0) {
        throw "Não foi possível autenticar na Vercel."
    }
}

# ============================================================
# 7. DEPLOY LIMPO DO COMMIT
# ============================================================

$DeployFolder = Join-Path `
    $env:TEMP `
    ("orcaly-deliveries-" + $Commit + "-" + (Get-Date -Format "yyyyMMddHHmmss"))

$WorktreeAdded = $false

try {
    Write-Host ""
    Write-Host "==> Criando cópia limpa do commit $Commit" -ForegroundColor Cyan

    git worktree add --detach $DeployFolder HEAD

    if ($LASTEXITCODE -ne 0) {
        throw "Não foi possível criar a pasta temporária de deploy."
    }

    $WorktreeAdded = $true

    $VercelProjectFolder = Join-Path $Root ".vercel"

    if (Test-Path -LiteralPath $VercelProjectFolder) {
        Copy-Item `
            -LiteralPath $VercelProjectFolder `
            -Destination (Join-Path $DeployFolder ".vercel") `
            -Recurse `
            -Force
    }

    Write-Host ""
    Write-Host "==> Publicando em produção" -ForegroundColor Cyan

    Push-Location $DeployFolder

    try {
        $PreviousErrorActionPreference = $ErrorActionPreference
        $ErrorActionPreference = "Continue"

        & $VercelExe --prod --yes
        $DeployExitCode = $LASTEXITCODE

        $ErrorActionPreference = $PreviousErrorActionPreference
    }
    finally {
        Pop-Location
    }

    if ($DeployExitCode -ne 0) {
        throw "O commit foi enviado, mas o deploy da Vercel falhou."
    }
}
finally {
    if ($WorktreeAdded) {
        git worktree remove --force $DeployFolder 2>$null | Out-Null
        git worktree prune | Out-Null
    }
    elseif (Test-Path -LiteralPath $DeployFolder) {
        Remove-Item `
            -LiteralPath $DeployFolder `
            -Recurse `
            -Force `
            -ErrorAction SilentlyContinue
    }
}

# ============================================================
# 8. RESULTADO
# ============================================================

Write-Host ""
Write-Host "==================================================" -ForegroundColor Green
Write-Host "CENTRAL DE ENTREGAS PUBLICADA" -ForegroundColor Green
Write-Host "==================================================" -ForegroundColor Green
Write-Host "Branch: $ExpectedBranch"
Write-Host "Commit: $Commit"
Write-Host "Página: /painel/entregas"
Write-Host "Push: concluído"
Write-Host "Deploy: produção"

Write-Host ""
git status -sb
git --no-pager log -3 --oneline
