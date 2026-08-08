Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"
$env:GIT_PAGER = "cat"
$env:NPM_CONFIG_LOGLEVEL = "error"

$Root = (Get-Location).Path
$ExpectedBranch = "feature/vitrine-marketplace"

$Files = @(
    "app/login/page.tsx",
    "app/painel/page.tsx",
    "lib/order-status.ts",
    "app/painel/inicio/page.tsx",
    "app/painel/pedidos/page.tsx",
    "app/painel/pedidos/[id]/page.tsx",
    "components/painel/MarketplacePaymentsPanel.tsx"
)

$Checks = @(
    @{ Path = "app/login/page.tsx"; Text = "ORCALY_LOGIN_DEFAULT_INICIO_V1" },
    @{ Path = "app/painel/page.tsx"; Text = "ORCALY_PAINEL_ROOT_INICIO_V1" },
    @{ Path = "lib/order-status.ts"; Text = "ORCALY_ORDER_STATUS_V1" },
    @{ Path = "app/painel/inicio/page.tsx"; Text = "ORCALY_PAID_REVENUE_V1" },
    @{ Path = "app/painel/pedidos/page.tsx"; Text = "ORCALY_PAID_ORDERS_METRICS_V1" },
    @{ Path = "app/painel/pedidos/[id]/page.tsx"; Text = "ORCALY_PAYMENT_AWARE_ORDER_DETAIL_V1" },
    @{ Path = "components/painel/MarketplacePaymentsPanel.tsx"; Text = "ORCALY_PAYMENTS_EXPERIENCE_V2" }
)

function Normalize-GitPath([string]$Path) {
    return ($Path -replace "\\", "/").Trim()
}

# ============================================================
# 1. VALIDAR REPOSITÓRIO E BRANCH
# ============================================================

if (-not (Test-Path -LiteralPath (Join-Path $Root "package.json"))) {
    throw "Execute este script na raiz do projeto Orçaly."
}

git rev-parse --is-inside-work-tree | Out-Null

if ($LASTEXITCODE -ne 0) {
    throw "A pasta atual não é um repositório Git."
}

$Branch = (git branch --show-current).Trim()

if ($Branch -ne $ExpectedBranch) {
    throw "Branch atual: $Branch. A esperada é $ExpectedBranch."
}

foreach ($File in $Files) {
    if (-not (Test-Path -LiteralPath (Join-Path $Root $File))) {
        throw "Arquivo não encontrado: $File"
    }
}

# ============================================================
# 2. IMPEDIR ARQUIVOS RASTREADOS INDESEJADOS
# ============================================================

$Allowed = @{}
foreach ($File in $Files) {
    $Allowed[(Normalize-GitPath $File)] = $true
}

$TrackedChanges = @(
    git --no-pager diff --name-only
    git --no-pager diff --cached --name-only
) |
    ForEach-Object { Normalize-GitPath $_ } |
    Where-Object { $_ } |
    Sort-Object -Unique

$UnexpectedTracked = @(
    $TrackedChanges |
    Where-Object { -not $Allowed.ContainsKey($_) }
)

if ($UnexpectedTracked.Count -gt 0) {
    Write-Host ""
    Write-Host "Existem alterações rastreadas fora desta atualização:" -ForegroundColor Red

    $UnexpectedTracked | ForEach-Object {
        Write-Host "  $_"
    }

    throw "Commit e deploy cancelados para não misturar alterações."
}

# ============================================================
# 3. VALIDAR MARCADORES DAS ATUALIZAÇÕES
# ============================================================

Write-Host "==> Verificando atualizações" -ForegroundColor Cyan

foreach ($Check in $Checks) {
    $Found = Select-String `
        -LiteralPath (Join-Path $Root $Check.Path) `
        -Pattern $Check.Text `
        -SimpleMatch `
        -ErrorAction SilentlyContinue

    if (-not $Found) {
        throw "Atualização não encontrada: $($Check.Path) -> $($Check.Text)"
    }

    Write-Host "[OK] $($Check.Text)" -ForegroundColor Green
}

# ============================================================
# 4. BUILD
# ============================================================

Write-Host ""
Write-Host "==> Executando build completo" -ForegroundColor Cyan

Remove-Item `
    -LiteralPath (Join-Path $Root ".next") `
    -Recurse `
    -Force `
    -ErrorAction SilentlyContinue

git --no-pager diff --check -- $Files

if ($LASTEXITCODE -ne 0) {
    throw "git diff --check encontrou problemas."
}

npm run build
$BuildExitCode = $LASTEXITCODE

Write-Host ""
Write-Host "BUILD_EXIT_CODE=$BuildExitCode" -ForegroundColor Yellow

if ($BuildExitCode -ne 0) {
    throw "O build falhou. Commit cancelado."
}

# ============================================================
# 5. STAGE E COMMIT SOMENTE DOS ARQUIVOS DESTA ATUALIZAÇÃO
# ============================================================

git restore --staged -- . 2>$null
git add -- $Files

git --no-pager diff --cached --check

if ($LASTEXITCODE -ne 0) {
    git restore --staged -- $Files
    throw "O conteúdo preparado possui problemas."
}

$StagedFiles = @(
    git --no-pager diff --cached --name-only
) |
    ForEach-Object { Normalize-GitPath $_ } |
    Where-Object { $_ }

$UnexpectedStaged = @(
    $StagedFiles |
    Where-Object { -not $Allowed.ContainsKey($_) }
)

if ($UnexpectedStaged.Count -gt 0) {
    git restore --staged -- .

    Write-Host "Arquivos inesperados no commit:" -ForegroundColor Red
    $UnexpectedStaged | ForEach-Object { Write-Host "  $_" }

    throw "Stage cancelado."
}

Write-Host ""
Write-Host "Arquivos do commit:" -ForegroundColor Cyan

$StagedFiles | ForEach-Object {
    Write-Host "  $_"
}

if ($StagedFiles.Count -gt 0) {
    git --no-pager diff --cached --stat

    git commit -m "fix: corrige faturamento e reformula central de pagamentos"

    if ($LASTEXITCODE -ne 0) {
        throw "Não foi possível criar o commit."
    }
}
else {
    Write-Host "Nenhuma alteração nova para commit. O deploy usará o commit atual." -ForegroundColor Yellow
}

$Commit = (git rev-parse --short HEAD).Trim()

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
# 8. VERIFICAR AUTENTICAÇÃO
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
# 9. DEPLOY DO COMMIT LIMPO
# ============================================================

$DeployFolder = Join-Path `
    $env:TEMP `
    ("orcaly-deploy-" + $Commit + "-" + (Get-Date -Format "yyyyMMddHHmmss"))

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
        Remove-Item -LiteralPath $DeployFolder -Recurse -Force -ErrorAction SilentlyContinue
    }
}

# ============================================================
# 10. RESULTADO
# ============================================================

Write-Host ""
Write-Host "==================================================" -ForegroundColor Green
Write-Host "ATUALIZAÇÃO PUBLICADA EM PRODUÇÃO" -ForegroundColor Green
Write-Host "==================================================" -ForegroundColor Green
Write-Host "Branch: $ExpectedBranch"
Write-Host "Commit: $Commit"
Write-Host "Login inicial: /painel/inicio"
Write-Host "Faturamento: somente pagamentos confirmados"
Write-Host "Status: mensagens amigáveis"
Write-Host "Pagamentos: central reformulada"

Write-Host ""
git status -sb
git --no-pager log -3 --oneline
