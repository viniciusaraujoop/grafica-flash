Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"
$env:GIT_PAGER = "cat"
$env:NPM_CONFIG_LOGLEVEL = "error"

$Root = (Get-Location).Path
$ExpectedBranch = "feature/vitrine-marketplace"
$RelativePath = "components/food/DeliveriesManager.tsx"
$Source = Join-Path $Root $RelativePath
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

if (-not (Test-Path -LiteralPath $Source)) {
    throw "Arquivo não encontrado: $RelativePath"
}

# ============================================================
# 2. NÃO MISTURAR OUTRAS ALTERAÇÕES RASTREADAS
# ============================================================

$AllowedPath = Normalize-GitPath $RelativePath

$TrackedChanges = @(
    git --no-pager diff --name-only
    git --no-pager diff --cached --name-only
) |
    ForEach-Object { Normalize-GitPath $_ } |
    Where-Object { $_ } |
    Sort-Object -Unique

$UnexpectedTracked = @(
    $TrackedChanges |
    Where-Object { $_ -ne $AllowedPath }
)

if ($UnexpectedTracked.Count -gt 0) {
    Write-Host ""
    Write-Host "Existem outras alterações rastreadas no projeto:" -ForegroundColor Red

    $UnexpectedTracked | ForEach-Object {
        Write-Host "  $_"
    }

    throw "Commit cancelado para não misturar alterações."
}

# ============================================================
# 3. VALIDAR A CENTRAL DE ENTREGAS
# ============================================================

Write-Host "==> Validando a Central de Entregas" -ForegroundColor Cyan

$Checks = @(
    "ORCALY_DELIVERIES_COMMAND_CENTER_V1",
    "Central de entregas",
    "!text-white",
    "color: '#ffffff'",
    "Operação logística",
    "Quadro",
    "Lista",
    "Nova entrega",
    "Confirmar entrega",
    "Cadastrar entrega"
)

foreach ($Text in $Checks) {
    $Found = Select-String `
        -LiteralPath $Source `
        -Pattern $Text `
        -SimpleMatch `
        -ErrorAction SilentlyContinue

    if (-not $Found) {
        throw "Atualização não encontrada: $Text"
    }

    Write-Host "[OK] $Text" -ForegroundColor Green
}

$Content = [System.IO.File]::ReadAllText(
    $Source,
    [System.Text.Encoding]::UTF8
)

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
# 4. BUILD COMPLETO
# ============================================================

Write-Host ""
Write-Host "==> Verificando diff" -ForegroundColor Cyan

git --no-pager diff --check -- $RelativePath

if ($LASTEXITCODE -ne 0) {
    throw "git diff --check encontrou problemas."
}

Remove-Item `
    -LiteralPath (Join-Path $Root ".next") `
    -Recurse `
    -Force `
    -ErrorAction SilentlyContinue

Write-Host ""
Write-Host "==> Executando build completo" -ForegroundColor Cyan

npm run build
$BuildExitCode = $LASTEXITCODE

Write-Host ""
Write-Host "BUILD_EXIT_CODE=$BuildExitCode" -ForegroundColor Yellow

if ($BuildExitCode -ne 0) {
    throw "O build falhou. Commit e deploy cancelados."
}

# ============================================================
# 5. STAGE E COMMIT SOMENTE DO COMPONENTE
# ============================================================

git restore --staged -- . 2>$null
git add -- $RelativePath

git --no-pager diff --cached --check

if ($LASTEXITCODE -ne 0) {
    git restore --staged -- $RelativePath
    throw "O arquivo preparado possui problemas."
}

$StagedFiles = @(
    git --no-pager diff --cached --name-only
) |
    ForEach-Object { Normalize-GitPath $_ } |
    Where-Object { $_ }

$UnexpectedStaged = @(
    $StagedFiles |
    Where-Object { $_ -ne $AllowedPath }
)

if ($UnexpectedStaged.Count -gt 0) {
    git restore --staged -- .

    Write-Host "Arquivos inesperados no commit:" -ForegroundColor Red
    $UnexpectedStaged | ForEach-Object {
        Write-Host "  $_"
    }

    throw "Stage cancelado."
}

Write-Host ""
Write-Host "Arquivo do commit:" -ForegroundColor Cyan
Write-Host "  $RelativePath"

if ($StagedFiles.Count -gt 0) {
    git --no-pager diff --cached --stat

    git commit -m $CommitMessage

    if ($LASTEXITCODE -ne 0) {
        throw "Não foi possível criar o commit."
    }
}
else {
    Write-Host ""
    Write-Host "Nenhuma alteração nova para commit." -ForegroundColor Yellow
    Write-Host "O deploy usará o commit atual da branch." -ForegroundColor Yellow
}

$Commit = (& git rev-parse --short HEAD | Out-String).Trim()

# ============================================================
# 6. PUSH
# ============================================================

Write-Host ""
Write-Host "==> Enviando commit $Commit ao GitHub" -ForegroundColor Cyan

git push -u origin $ExpectedBranch

if ($LASTEXITCODE -ne 0) {
    throw "O push para o GitHub falhou."
}

# ============================================================
# 7. LOCALIZAR OU INSTALAR VERCEL CLI
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
# 8. VERIFICAR LOGIN DA VERCEL
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
# 9. DEPLOY DE UMA CÓPIA LIMPA DO COMMIT
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
# 10. RESULTADO
# ============================================================

Write-Host ""
Write-Host "==================================================" -ForegroundColor Green
Write-Host "CENTRAL DE ENTREGAS PUBLICADA" -ForegroundColor Green
Write-Host "==================================================" -ForegroundColor Green
Write-Host "Branch: $ExpectedBranch"
Write-Host "Commit: $Commit"
Write-Host "Arquivo: $RelativePath"
Write-Host "Página: /painel/entregas"
Write-Host "Build: aprovado"
Write-Host "Deploy: produção"

Write-Host ""
git status -sb
git --no-pager log -3 --oneline
