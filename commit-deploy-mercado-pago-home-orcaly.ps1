param(
    [string]$CommitMessage = "feat: informa pagamentos online via Mercado Pago",
    [string]$ExpectedBranch = "",
    [switch]$SkipLint,
    [switch]$SkipBuild,
    [switch]$SkipDeploy
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"
$env:GIT_PAGER = "cat"
$env:NPM_CONFIG_LOGLEVEL = "error"

try {
    [Console]::OutputEncoding = New-Object System.Text.UTF8Encoding($false)
    $OutputEncoding = New-Object System.Text.UTF8Encoding($false)
}
catch {}

$Root = (Get-Location).Path
$ProductionDomain = "https://orcaly.com.br"

$AllowedFiles = @(
    "app/page.tsx",
    "lib/business-types.ts"
)

$RequiredHomeMarker = "Pagamentos online processados exclusivamente pelo Mercado Pago."
$RequiredFoodMarker = "Sim. Os pagamentos online do marketplace são processados exclusivamente pelo Mercado Pago, com Pix e cartão conforme disponibilidade da conta conectada."
$ForbiddenFoodMarker = "Nesta versão, o pagamento é combinado com a empresa pelo WhatsApp."

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
    if ($null -eq $Path) {
        return ""
    }

    return (($Path -replace "\\", "/").Trim())
}

function Get-FileText([string]$RelativePath) {
    $Path = Join-Path $Root ($RelativePath -replace "/", "\")

    if (-not (Test-Path -LiteralPath $Path -PathType Leaf)) {
        throw "Arquivo obrigatório não encontrado: $RelativePath"
    }

    return [System.IO.File]::ReadAllText(
        $Path,
        [System.Text.Encoding]::UTF8
    )
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
        throw "Nem Vercel CLI nem npx foram encontrados."
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

    $PreviousPreference = $ErrorActionPreference
    $ErrorActionPreference = "Continue"

    try {
        & $script:VercelCommand @AllArguments
        $script:LastVercelExitCode = $LASTEXITCODE
    }
    finally {
        $ErrorActionPreference = $PreviousPreference
    }
}

function Get-AllTrackedChanges {
    $Changes = @()

    $Changes += @(
        git --no-pager diff --name-only
    )

    $Changes += @(
        git --no-pager diff --cached --name-only
    )

    return @(
        $Changes |
            ForEach-Object { Normalize-GitPath $_ } |
            Where-Object { $_ } |
            Sort-Object -Unique
    )
}

function Get-StagedFiles {
    return @(
        git --no-pager diff --cached --name-only |
            ForEach-Object { Normalize-GitPath $_ } |
            Where-Object { $_ } |
            Sort-Object -Unique
    )
}

function Test-AllowedScope([string[]]$Files) {
    $AllowedSet = @{}

    foreach ($File in $AllowedFiles) {
        $AllowedSet[(Normalize-GitPath $File)] = $true
    }

    return @(
        $Files |
            Where-Object {
                -not $AllowedSet.ContainsKey(
                    (Normalize-GitPath $_)
                )
            }
    )
}

Write-Section "ORÇALY - COMMIT E DEPLOY DO AVISO MERCADO PAGO"

# ============================================================
# 1. VALIDAR REPOSITÓRIO
# ============================================================

if (-not (Test-Path -LiteralPath (Join-Path $Root "package.json"))) {
    throw "Execute este script na raiz do projeto Orçaly."
}

git rev-parse --is-inside-work-tree *> $null

if ($LASTEXITCODE -ne 0) {
    throw "A pasta atual não é um repositório Git."
}

$Branch = (& git branch --show-current | Out-String).Trim()

if ([string]::IsNullOrWhiteSpace($Branch)) {
    throw "HEAD destacado. Faça checkout de uma branch antes do deploy."
}

if (
    -not [string]::IsNullOrWhiteSpace($ExpectedBranch) -and
    $Branch -ne $ExpectedBranch
) {
    throw "Branch atual: $Branch. Branch esperada: $ExpectedBranch."
}

Write-Ok "Branch atual: $Branch"

$RemoteUrl = (& git remote get-url origin | Out-String).Trim()

if ([string]::IsNullOrWhiteSpace($RemoteUrl)) {
    throw "Remote 'origin' não configurado."
}

Write-Ok "Origin configurado"

# ============================================================
# 2. AUDITAR O PATCH QUE SERÁ PUBLICADO
# ============================================================

Write-Section "AUDITANDO AS ALTERAÇÕES"

$HomeText = Get-FileText "app/page.tsx"
$BusinessTypesText = Get-FileText "lib/business-types.ts"

if (-not $HomeText.Contains($RequiredHomeMarker)) {
    throw "O aviso do Mercado Pago não foi encontrado em app/page.tsx. Commit cancelado."
}

Write-Ok "Aviso do Mercado Pago encontrado na home"

if ($BusinessTypesText.Contains($ForbiddenFoodMarker)) {
    throw "A resposta antiga do FAQ Food ainda está presente. Commit cancelado."
}

if (-not $BusinessTypesText.Contains($RequiredFoodMarker)) {
    throw "A nova resposta do FAQ Food não foi encontrada exatamente como esperado. Commit cancelado."
}

Write-Ok "FAQ Food atualizado"

$TrackedChanges = Get-AllTrackedChanges
$UnexpectedTracked = Test-AllowedScope $TrackedChanges

if ($UnexpectedTracked.Count -gt 0) {
    Write-Host ""
    Write-Host "Alterações rastreadas fora do escopo deste deploy:" -ForegroundColor Red

    foreach ($File in $UnexpectedTracked) {
        Write-Host "  $File"
    }

    throw "Commit cancelado para não misturar outras alterações do projeto."
}

if ($TrackedChanges.Count -eq 0) {
    Write-Warn "Não há alterações rastreadas nos dois arquivos."
    Write-Warn "O script continuará somente se o commit atual já contiver o patch."
}
else {
    Write-Host ""
    Write-Host "Alterações rastreadas autorizadas:" -ForegroundColor Cyan

    foreach ($File in $TrackedChanges) {
        Write-Host "  $File"
    }
}

# ============================================================
# 3. GARANTIR SINCRONIA COM O GITHUB
# ============================================================

Write-Section "VALIDANDO SINCRONIA COM O GITHUB"

git fetch origin

if ($LASTEXITCODE -ne 0) {
    throw "Não foi possível atualizar as referências do GitHub."
}

$RemoteBranchExists = $false

git show-ref --verify --quiet ("refs/remotes/origin/" + $Branch)

if ($LASTEXITCODE -eq 0) {
    $RemoteBranchExists = $true
}

if ($RemoteBranchExists) {
    $Behind = [int](
        (& git rev-list --count ("HEAD..origin/" + $Branch) | Out-String).Trim()
    )

    $AheadBeforeCommit = [int](
        (& git rev-list --count ("origin/" + $Branch + "..HEAD") | Out-String).Trim()
    )

    if ($Behind -gt 0) {
        throw "A branch local está $Behind commit(s) atrás de origin/$Branch. Atualize/rebase antes de publicar."
    }

    if ($AheadBeforeCommit -gt 0) {
        Write-Host ""
        Write-Host "Commits locais ainda não publicados:" -ForegroundColor Yellow
        git --no-pager log --oneline ("origin/" + $Branch + "..HEAD")
        Write-Host ""

        throw "Existem commits locais anteriores ainda não publicados. Deploy cancelado para não enviar commits fora deste escopo sem revisão."
    }

    Write-Ok "Branch local sincronizada com origin/$Branch"
}
else {
    Write-Warn "A branch ainda não existe no origin. O push criará origin/$Branch."
}

# ============================================================
# 4. PREPARAR SOMENTE OS DOIS ARQUIVOS
# ============================================================

Write-Section "PREPARANDO COMMIT EXATO"

$ExistingStaged = Get-StagedFiles
$UnexpectedExistingStaged = Test-AllowedScope $ExistingStaged

if ($UnexpectedExistingStaged.Count -gt 0) {
    Write-Host ""
    Write-Host "Já existem arquivos inesperados no stage:" -ForegroundColor Red

    foreach ($File in $UnexpectedExistingStaged) {
        Write-Host "  $File"
    }

    throw "Stage existente não foi alterado. Limpe/revise antes de continuar."
}

foreach ($File in $AllowedFiles) {
    $FullPath = Join-Path $Root ($File -replace "/", "\")

    $Tracked = $false
    git ls-files --error-unmatch -- $File *> $null

    if ($LASTEXITCODE -eq 0) {
        $Tracked = $true
    }

    if ((Test-Path -LiteralPath $FullPath) -or $Tracked) {
        git add -A -- $File

        if ($LASTEXITCODE -ne 0) {
            throw "Não foi possível preparar: $File"
        }
    }
}

$StagedFiles = Get-StagedFiles
$UnexpectedStaged = Test-AllowedScope $StagedFiles

if ($UnexpectedStaged.Count -gt 0) {
    Write-Host ""
    Write-Host "Arquivos inesperados no stage:" -ForegroundColor Red

    foreach ($File in $UnexpectedStaged) {
        Write-Host "  $File"
    }

    throw "Stage cancelado."
}

if ($StagedFiles.Count -eq 0) {
    Write-Warn "Nenhuma alteração nova foi preparada para commit."
}
else {
    Write-Host ""
    Write-Host "Arquivos que entrarão no commit:" -ForegroundColor Cyan

    foreach ($File in $StagedFiles) {
        Write-Host "  $File"
    }

    git --no-pager diff --cached --check

    if ($LASTEXITCODE -ne 0) {
        throw "git diff --cached --check encontrou problemas."
    }

    Write-Ok "diff --cached --check passou"

    git --no-pager diff --cached --stat
}

# ============================================================
# 5. LINT E BUILD ANTES DO COMMIT
# ============================================================

$Package = Get-Content `
    -LiteralPath (Join-Path $Root "package.json") `
    -Raw |
    ConvertFrom-Json

$Scripts = @()

if ($Package.scripts) {
    $Scripts = @(
        $Package.scripts.PSObject.Properties |
            ForEach-Object { $_.Name }
    )
}

git --no-pager diff --check

if ($LASTEXITCODE -ne 0) {
    throw "git diff --check encontrou problemas."
}

if (-not $SkipLint -and ("lint" -in $Scripts)) {
    Write-Section "EXECUTANDO LINT"

    npm.cmd run lint

    if ($LASTEXITCODE -ne 0) {
        throw "O lint falhou. Commit e deploy cancelados."
    }

    Write-Ok "LINT_EXIT_CODE=0"
}
elseif ($SkipLint) {
    Write-Warn "Lint ignorado por parâmetro -SkipLint."
}

if (-not $SkipBuild -and ("build" -in $Scripts)) {
    Write-Section "EXECUTANDO BUILD"

    Remove-Item `
        -LiteralPath (Join-Path $Root ".next") `
        -Recurse `
        -Force `
        -ErrorAction SilentlyContinue

    npm.cmd run build

    if ($LASTEXITCODE -ne 0) {
        throw "O build falhou. Commit e deploy cancelados."
    }

    Write-Ok "BUILD_EXIT_CODE=0"
}
elseif ($SkipBuild) {
    Write-Warn "Build ignorado por parâmetro -SkipBuild."
}

# ============================================================
# 6. CRIAR COMMIT
# ============================================================

Write-Section "CRIANDO COMMIT"

if ($StagedFiles.Count -gt 0) {
    git commit -m $CommitMessage

    if ($LASTEXITCODE -ne 0) {
        throw "Não foi possível criar o commit."
    }

    Write-Ok "Commit criado"
}
else {
    Write-Warn "Sem alteração nova para commit. Validando se o HEAD já contém o patch."

    $HomeAtHead = (& git show "HEAD:app/page.tsx" 2>$null | Out-String)
    $BusinessAtHead = (& git show "HEAD:lib/business-types.ts" 2>$null | Out-String)

    if (-not $HomeAtHead.Contains($RequiredHomeMarker)) {
        throw "O HEAD atual não contém o aviso da home. Não há nada seguro para publicar."
    }

    if (
        $BusinessAtHead.Contains($ForbiddenFoodMarker) -or
        -not $BusinessAtHead.Contains($RequiredFoodMarker)
    ) {
        throw "O HEAD atual não contém a atualização correta do FAQ Food."
    }

    Write-Ok "O HEAD atual já contém as duas alterações."
}

$CommitSha = (& git rev-parse HEAD | Out-String).Trim()
$ShortCommit = (& git rev-parse --short HEAD | Out-String).Trim()

Write-Ok "Commit: $ShortCommit"

# ============================================================
# 7. PUSH
# ============================================================

Write-Section "ENVIANDO AO GITHUB"

git push -u origin $Branch

if ($LASTEXITCODE -ne 0) {
    throw "O push para o GitHub falhou."
}

Write-Ok "PUSH_CONCLUIDO"
Write-Ok "origin/$Branch atualizado em $ShortCommit"

if ($SkipDeploy) {
    Write-Warn "Deploy ignorado por parâmetro -SkipDeploy."

    Write-Host ""
    Write-Host "Commit e push concluídos." -ForegroundColor Green
    exit 0
}

# ============================================================
# 8. VALIDAR VERCEL
# ============================================================

Write-Section "VALIDANDO VERCEL"

Resolve-VercelCommand

$WhoAmIOutput = @(
    Invoke-Vercel @("whoami") 2>&1
)

$WhoAmIExitCode = $script:LastVercelExitCode

if ($WhoAmIExitCode -ne 0) {
    $WhoAmIOutput | ForEach-Object { Write-Host $_ }
    throw "A Vercel CLI não está autenticada. Execute 'vercel login' e rode o script novamente."
}

Write-Ok "Vercel autenticada"

$VercelDirectory = Join-Path $Root ".vercel"
$VercelProjectFile = Join-Path $VercelDirectory "project.json"

if (-not (Test-Path -LiteralPath $VercelProjectFile -PathType Leaf)) {
    Write-Section "VINCULANDO PROJETO À VERCEL"

    Invoke-Vercel @("link", "--yes")

    if ($script:LastVercelExitCode -ne 0) {
        throw "Não foi possível vincular o projeto à Vercel."
    }
}

if (-not (Test-Path -LiteralPath $VercelProjectFile -PathType Leaf)) {
    throw ".vercel/project.json não foi encontrado após o vínculo."
}

Write-Ok "Projeto Vercel vinculado"

# ============================================================
# 9. DEPLOY LIMPO DO COMMIT
# ============================================================

$DeployFolder = Join-Path `
    $env:TEMP `
    ("orcaly-production-" + $ShortCommit + "-" + (Get-Date -Format "yyyyMMddHHmmss"))

$WorktreeAdded = $false
$DeploymentSucceeded = $false
$DeploymentUrl = ""

try {
    Write-Section "CRIANDO WORKTREE LIMPO DO COMMIT $ShortCommit"

    git worktree add --detach $DeployFolder $CommitSha

    if ($LASTEXITCODE -ne 0) {
        throw "Não foi possível criar a cópia limpa para deploy."
    }

    $WorktreeAdded = $true

    Copy-Item `
        -LiteralPath $VercelDirectory `
        -Destination (Join-Path $DeployFolder ".vercel") `
        -Recurse `
        -Force

    Write-Ok "Worktree limpo criado"

    Push-Location $DeployFolder

    try {
        Write-Section "PUBLICANDO EM PRODUÇÃO"

        $DeployOutputArray = @(
            Invoke-Vercel @(
                "--prod",
                "--yes",
                "--force"
            ) 2>&1
        )

        $DeployExitCode = $script:LastVercelExitCode

        foreach ($Line in $DeployOutputArray) {
            Write-Host $Line
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
            Start-Sleep -Milliseconds 500

            git worktree remove --force $DeployFolder 2>$null | Out-Null
            git worktree prune | Out-Null
        }
        catch {
            Write-Warn "Deploy terminou, mas o worktree temporário não pôde ser removido automaticamente: $DeployFolder"
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
# 10. RESULTADO
# ============================================================

Write-Section "PUBLICAÇÃO CONCLUÍDA"

Write-Ok "Commit: $ShortCommit"
Write-Ok "GitHub: origin/$Branch"
Write-Ok "Produção: $ProductionDomain"

if (-not [string]::IsNullOrWhiteSpace($DeploymentUrl)) {
    Write-Ok "Deploy Vercel: $DeploymentUrl"
}

Write-Host ""
Write-Host "Arquivos publicados neste commit:" -ForegroundColor Cyan

foreach ($File in $AllowedFiles) {
    Write-Host "  - $File"
}

Write-Host ""
Write-Host "Nenhuma migration ou alteração no Supabase foi executada." -ForegroundColor DarkGray
Write-Host "Commit, push e deploy concluídos." -ForegroundColor Green
