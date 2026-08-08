param(
    [switch]$SkipPatch,
    [string]$ProductionDomain = "https://orcaly.com.br"
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"
$env:GIT_PAGER = "cat"
$env:NPM_CONFIG_LOGLEVEL = "error"

$Root = (Get-Location).Path
$PatchName = "adicionar-entregadores-historico-entregas-orcaly.ps1"
$PatchPath = Join-Path $Root $PatchName

$ManagerRelative = "components/food/DeliveriesManager.tsx"
$OperationsRelative = "components/food/DeliveryDriverOperations.tsx"

$ManagerPath = Join-Path $Root "components\food\DeliveriesManager.tsx"
$OperationsPath = Join-Path $Root "components\food\DeliveryDriverOperations.tsx"
$MigrationDirectory = Join-Path $Root "supabase\migrations"

$ManagerMarker = "ORCALY_DELIVERY_DRIVERS_UI_V1"
$OperationsMarker = "ORCALY_DELIVERY_DRIVER_OPERATIONS_V1"
$MigrationMarker = "ORCALY_DELIVERY_DRIVERS_ASSIGNMENTS_V1"

$CommitMessage = "feat: adiciona gestao de entregadores e historico de entregas"

$script:LastExternalExitCode = 1
$script:LastExternalStdOut = @()
$script:LastExternalStdErr = @()
$script:LastExternalAllOutput = @()

$script:VercelCommand = $null
$script:VercelPrefix = @()
$script:GitCommand = $null
$script:NpmCommand = $null

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

function Resolve-RequiredCommand(
    [string[]]$Candidates,
    [string]$FriendlyName
) {
    foreach ($Candidate in $Candidates) {
        $Resolved = Get-Command `
            $Candidate `
            -ErrorAction SilentlyContinue

        if ($Resolved) {
            return $Resolved.Source
        }
    }

    throw "$FriendlyName não foi encontrado."
}

function Invoke-External(
    [string]$Command,
    [string[]]$Arguments,
    [switch]$Quiet,
    [switch]$IncludeErrorOutput
) {
    $PreviousPreference = $ErrorActionPreference
    $ErrorActionPreference = "Continue"

    $StdOutFile = [System.IO.Path]::GetTempFileName()
    $StdErrFile = [System.IO.Path]::GetTempFileName()

    $StdOut = @()
    $StdErr = @()
    $ExitCode = 1

    try {
        & $Command @Arguments `
            1> $StdOutFile `
            2> $StdErrFile

        $ExitCode = $LASTEXITCODE

        if (Test-Path -LiteralPath $StdOutFile) {
            $StdOut = @(
                Get-Content `
                    -LiteralPath $StdOutFile `
                    -ErrorAction SilentlyContinue
            )
        }

        if (Test-Path -LiteralPath $StdErrFile) {
            $StdErr = @(
                Get-Content `
                    -LiteralPath $StdErrFile `
                    -ErrorAction SilentlyContinue
            )
        }
    }
    finally {
        Remove-Item `
            -LiteralPath $StdOutFile `
            -Force `
            -ErrorAction SilentlyContinue

        Remove-Item `
            -LiteralPath $StdErrFile `
            -Force `
            -ErrorAction SilentlyContinue

        $ErrorActionPreference = $PreviousPreference
    }

    $script:LastExternalExitCode = $ExitCode
    $script:LastExternalStdOut = @($StdOut)
    $script:LastExternalStdErr = @($StdErr)
    $script:LastExternalAllOutput = @(
        @($StdOut) + @($StdErr)
    )

    if (-not $Quiet) {
        foreach ($Line in $StdOut) {
            Write-Host $Line
        }

        foreach ($Line in $StdErr) {
            if ($ExitCode -eq 0) {
                Write-Host $Line -ForegroundColor DarkYellow
            }
            else {
                Write-Host $Line -ForegroundColor Red
            }
        }
    }

    if ($IncludeErrorOutput) {
        return @($script:LastExternalAllOutput)
    }

    return @($StdOut)
}

function Invoke-Git(
    [string[]]$Arguments,
    [switch]$Quiet,
    [switch]$IncludeErrorOutput
) {
    return Invoke-External `
        -Command $script:GitCommand `
        -Arguments $Arguments `
        -Quiet:$Quiet `
        -IncludeErrorOutput:$IncludeErrorOutput
}

function Invoke-Npm(
    [string[]]$Arguments,
    [switch]$Quiet
) {
    return Invoke-External `
        -Command $script:NpmCommand `
        -Arguments $Arguments `
        -Quiet:$Quiet
}

function Resolve-VercelCommand {
    $GlobalCommand = Get-Command `
        vercel.cmd `
        -ErrorAction SilentlyContinue

    if (-not $GlobalCommand) {
        $GlobalCommand = Get-Command `
            vercel `
            -ErrorAction SilentlyContinue
    }

    if ($GlobalCommand) {
        $script:VercelCommand = $GlobalCommand.Source
        $script:VercelPrefix = @()
        return
    }

    $NpxCommand = Get-Command `
        npx.cmd `
        -ErrorAction SilentlyContinue

    if (-not $NpxCommand) {
        $NpxCommand = Get-Command `
            npx `
            -ErrorAction SilentlyContinue
    }

    if (-not $NpxCommand) {
        throw "Vercel CLI e npx não foram encontrados."
    }

    $script:VercelCommand = $NpxCommand.Source
    $script:VercelPrefix = @(
        "--yes",
        "vercel@latest"
    )
}

function Invoke-Vercel(
    [string[]]$Arguments,
    [switch]$Quiet,
    [switch]$IncludeErrorOutput
) {
    $AllArguments = @()

    if ($script:VercelPrefix) {
        $AllArguments += $script:VercelPrefix
    }

    if ($Arguments) {
        $AllArguments += $Arguments
    }

    return Invoke-External `
        -Command $script:VercelCommand `
        -Arguments $AllArguments `
        -Quiet:$Quiet `
        -IncludeErrorOutput:$IncludeErrorOutput
}

function Get-NormalizedLines([object[]]$Lines) {
    return @(
        $Lines |
            ForEach-Object {
                Normalize-GitPath ([string]$_)
            } |
            Where-Object {
                $_
            } |
            Sort-Object -Unique
    )
}

function Find-MigrationFiles {
    if (-not (Test-Path -LiteralPath $MigrationDirectory)) {
        return @()
    }

    return @(
        Get-ChildItem `
            -LiteralPath $MigrationDirectory `
            -Filter "*.sql" `
            -File |
            Where-Object {
                $Content = Get-FileText $_.FullName
                $Content.Contains($MigrationMarker)
            }
    )
}

function Test-Implementation {
    $ManagerReady =
        (Get-FileText $ManagerPath).Contains(
            $ManagerMarker
        )

    $OperationsReady =
        (Get-FileText $OperationsPath).Contains(
            $OperationsMarker
        )

    $MigrationFiles = @(Find-MigrationFiles)
    $MigrationReady = $MigrationFiles.Count -eq 1

    return (
        $ManagerReady -and
        $OperationsReady -and
        $MigrationReady
    )
}

function Require-Implementation {
    if (Test-Implementation) {
        Write-Ok "Módulo de entregadores já aplicado"
        return
    }

    if ($SkipPatch) {
        throw "O módulo ainda não está completo e -SkipPatch foi informado."
    }

    if (-not (Test-Path -LiteralPath $PatchPath)) {
        throw "Patch necessário não encontrado: $PatchName"
    }

    Write-Section "APLICANDO O MÓDULO DE ENTREGADORES"

    Invoke-External `
        -Command "powershell.exe" `
        -Arguments @(
            "-NoProfile",
            "-ExecutionPolicy",
            "Bypass",
            "-File",
            $PatchPath
        )

    if ($script:LastExternalExitCode -ne 0) {
        throw "O patch de entregadores falhou."
    }

    if (-not (Test-Implementation)) {
        throw "O patch terminou, mas a implementação continua incompleta."
    }

    Write-Ok "Módulo de entregadores aplicado"
}

Write-Section "ORCALY - COMMIT E DEPLOY DE ENTREGADORES"

if (-not (Test-Path -LiteralPath (Join-Path $Root "package.json"))) {
    throw "Execute este script na raiz do projeto Orçaly."
}

$script:GitCommand = Resolve-RequiredCommand `
    -Candidates @(
        "git.exe",
        "git"
    ) `
    -FriendlyName "Git"

$script:NpmCommand = Resolve-RequiredCommand `
    -Candidates @(
        "npm.cmd",
        "npm"
    ) `
    -FriendlyName "npm"

$GitCheck = @(
    Invoke-Git `
        -Arguments @(
            "rev-parse",
            "--is-inside-work-tree"
        ) `
        -Quiet
)

if (
    $script:LastExternalExitCode -ne 0 -or
    (($GitCheck -join "`n").Trim() -ne "true")
) {
    throw "A pasta atual não é um repositório Git."
}

$BranchOutput = @(
    Invoke-Git `
        -Arguments @(
            "branch",
            "--show-current"
        ) `
        -Quiet
)

if ($script:LastExternalExitCode -ne 0) {
    throw "Não foi possível identificar a branch atual."
}

$Branch = ($BranchOutput -join "`n").Trim()

if ([string]::IsNullOrWhiteSpace($Branch)) {
    throw "O repositório está em detached HEAD."
}

Write-Ok "Branch atual: $Branch"

$OriginOutput = @(
    Invoke-Git `
        -Arguments @(
            "remote",
            "get-url",
            "origin"
        ) `
        -Quiet
)

if ($script:LastExternalExitCode -ne 0) {
    throw "O remote origin não está configurado."
}

Write-Ok "Origin configurado"

Write-Section "ATUALIZANDO REFERÊNCIAS DO GITHUB"

Invoke-Git `
    -Arguments @(
        "fetch",
        "origin"
    )

if ($script:LastExternalExitCode -ne 0) {
    throw "Não foi possível atualizar as referências do GitHub."
}

$RemoteRef = "refs/remotes/origin/$Branch"

Invoke-Git `
    -Arguments @(
        "show-ref",
        "--verify",
        "--quiet",
        $RemoteRef
    ) `
    -Quiet | Out-Null

$RemoteBranchExists =
    $script:LastExternalExitCode -eq 0

if ($RemoteBranchExists) {
    $BehindOutput = @(
        Invoke-Git `
            -Arguments @(
                "rev-list",
                "--count",
                "HEAD..origin/$Branch"
            ) `
            -Quiet
    )

    if ($script:LastExternalExitCode -ne 0) {
        throw "Não foi possível comparar a branch com o GitHub."
    }

    $BehindCount = 0
    [void][int]::TryParse(
        (($BehindOutput -join "`n").Trim()),
        [ref]$BehindCount
    )

    if ($BehindCount -gt 0) {
        throw "A branch local está $BehindCount commit(s) atrás do GitHub. Atualize a branch antes de publicar."
    }
}

# ============================================================
# 1. GARANTIR QUE O PATCH E A MIGRAÇÃO EXISTEM
# ============================================================

Require-Implementation

$MigrationFiles = @(Find-MigrationFiles)

if ($MigrationFiles.Count -ne 1) {
    Write-Host "Migrações localizadas:" -ForegroundColor Red

    foreach ($Item in $MigrationFiles) {
        Write-Host "  $($Item.FullName)"
    }

    throw "Era esperada exatamente uma migração do módulo de entregadores."
}

$MigrationPath = $MigrationFiles[0].FullName
$MigrationRelative = Normalize-GitPath (
    $MigrationPath.Substring($Root.Length + 1)
)

$AllowedFiles = @(
    $ManagerRelative,
    $OperationsRelative,
    $MigrationRelative
) |
    ForEach-Object {
        Normalize-GitPath $_
    } |
    Sort-Object -Unique

$AllowedSet = @{}

foreach ($File in $AllowedFiles) {
    $AllowedSet[$File] = $true
}

Write-Ok "Migração localizada: $MigrationRelative"

# ============================================================
# 2. VALIDAR MARCADORES E CONTEÚDO
# ============================================================

Write-Section "VALIDANDO A IMPLEMENTAÇÃO"

$RequiredChecks = @(
    @{
        Path = $ManagerPath
        Label = $ManagerRelative
        Markers = @(
            $ManagerMarker,
            "DeliveryDriverProvider",
            "DeliveryDriverHeaderButtons",
            "DeliveryDriverAction",
            "DeliveryDriverInfo",
            "assigned_driver_id",
            "payment_status"
        )
    },
    @{
        Path = $OperationsPath
        Label = $OperationsRelative
        Markers = @(
            $OperationsMarker,
            "delivery_drivers",
            "delivery_assignments",
            "Alocar entregador",
            "Histórico de entregas",
            "Marcar prestação conferida",
            "Google Maps",
            "allocationMessage"
        )
    },
    @{
        Path = $MigrationPath
        Label = $MigrationRelative
        Markers = @(
            $MigrationMarker,
            "create table if not exists public.delivery_drivers",
            "create table if not exists public.delivery_assignments",
            "enable row level security",
            "delivery_drivers_company_access",
            "delivery_assignments_company_access"
        )
    }
)

foreach ($Check in $RequiredChecks) {
    $Content = Get-FileText $Check.Path

    if ([string]::IsNullOrWhiteSpace($Content)) {
        throw "Arquivo vazio ou ausente: $($Check.Label)"
    }

    foreach ($Marker in $Check.Markers) {
        if (-not $Content.Contains($Marker)) {
            throw "Marcador ausente em $($Check.Label): $Marker"
        }
    }

    Write-Ok $Check.Label
}

# ============================================================
# 3. MOSTRAR O QUE FICARÁ FORA DO COMMIT
# ============================================================

Write-Section "CONFERINDO O ESCOPO"

$TrackedOutput = @(
    Invoke-Git `
        -Arguments @(
            "diff",
            "--name-only"
        ) `
        -Quiet
)

$CachedOutput = @(
    Invoke-Git `
        -Arguments @(
            "diff",
            "--cached",
            "--name-only"
        ) `
        -Quiet
)

$UntrackedOutput = @(
    Invoke-Git `
        -Arguments @(
            "ls-files",
            "--others",
            "--exclude-standard"
        ) `
        -Quiet
)

$AllWorkingFiles = @(
    Get-NormalizedLines (
        @($TrackedOutput) +
        @($CachedOutput) +
        @($UntrackedOutput)
    )
)

$OtherFiles = @(
    $AllWorkingFiles |
        Where-Object {
            -not $AllowedSet.ContainsKey($_)
        }
)

if ($OtherFiles.Count -gt 0) {
    Write-Warn "Os arquivos abaixo permanecerão fora do commit e do deploy:"

    foreach ($File in $OtherFiles) {
        Write-Host "  $File"
    }
}
else {
    Write-Ok "Nenhuma alteração externa ao módulo encontrada"
}

$DiffArguments = @(
    "--no-pager",
    "diff",
    "--check",
    "--"
) + $AllowedFiles

Invoke-Git `
    -Arguments $DiffArguments

if ($script:LastExternalExitCode -ne 0) {
    throw "git diff --check encontrou problemas no módulo."
}

# ============================================================
# 4. SEGURANÇA E BUILD LOCAL
# ============================================================

$Package = Get-Content `
    -LiteralPath (Join-Path $Root "package.json") `
    -Raw |
    ConvertFrom-Json

if (
    $Package.scripts.PSObject.Properties.Name -contains
    "security:check"
) {
    Write-Section "VALIDANDO SEGURANÇA"

    Invoke-Npm `
        -Arguments @(
            "run",
            "security:check"
        )

    if ($script:LastExternalExitCode -ne 0) {
        throw "security:check falhou."
    }

    Write-Ok "SECURITY_CHECK_EXIT_CODE=0"
}

Remove-Item `
    -LiteralPath (Join-Path $Root ".next") `
    -Recurse `
    -Force `
    -ErrorAction SilentlyContinue

Write-Section "EXECUTANDO BUILD COMPLETO"

$BuildOutput = @(
    Invoke-Npm `
        -Arguments @(
            "run",
            "build"
        )
)

if ($script:LastExternalExitCode -ne 0) {
    throw "O build falhou. Commit e deploy cancelados."
}

$BuildText = $BuildOutput -join "`n"

if ($BuildText -notmatch [regex]::Escape("/painel/entregas")) {
    Write-Warn "O build passou, mas a rota /painel/entregas não apareceu no resumo."
}

Write-Ok "BUILD_EXIT_CODE=0"

# ============================================================
# 5. VALIDAR VERCEL ANTES DO COMMIT
# ============================================================

Resolve-VercelCommand

Write-Section "VALIDANDO A VERCEL"

$WhoAmIOutput = @(
    Invoke-Vercel `
        -Arguments @(
            "whoami"
        ) `
        -Quiet `
        -IncludeErrorOutput
)

if ($script:LastExternalExitCode -ne 0) {
    foreach ($Line in $WhoAmIOutput) {
        Write-Host $Line
    }

    throw "A Vercel CLI não está autenticada. Execute: vercel login"
}

Write-Ok "Vercel autenticada"

$VercelDirectory = Join-Path $Root ".vercel"
$VercelProjectFile = Join-Path $VercelDirectory "project.json"

if (-not (Test-Path -LiteralPath $VercelProjectFile)) {
    Write-Section "VINCULANDO O PROJETO À VERCEL"

    Invoke-Vercel `
        -Arguments @(
            "link",
            "--yes"
        )

    if ($script:LastExternalExitCode -ne 0) {
        throw "Não foi possível vincular o projeto à Vercel."
    }
}

Write-Ok "Projeto Vercel vinculado"

# ============================================================
# 6. PREPARAR COMMIT SOMENTE DO MÓDULO
# ============================================================

Write-Section "PREPARANDO O COMMIT"

Invoke-Git `
    -Arguments @(
        "restore",
        "--staged",
        "--",
        "."
    ) `
    -Quiet | Out-Null

if ($script:LastExternalExitCode -ne 0) {
    throw "Não foi possível limpar o stage anterior."
}

foreach ($File in $AllowedFiles) {
    Invoke-Git `
        -Arguments @(
            "add",
            "-A",
            "--",
            $File
        )

    if ($script:LastExternalExitCode -ne 0) {
        throw "Não foi possível preparar o arquivo: $File"
    }
}

$StagedOutput = @(
    Invoke-Git `
        -Arguments @(
            "--no-pager",
            "diff",
            "--cached",
            "--name-only"
        ) `
        -Quiet
)

$StagedFiles = @(
    Get-NormalizedLines $StagedOutput
)

$UnexpectedStaged = @(
    $StagedFiles |
        Where-Object {
            -not $AllowedSet.ContainsKey($_)
        }
)

if ($UnexpectedStaged.Count -gt 0) {
    Invoke-Git `
        -Arguments @(
            "restore",
            "--staged",
            "--",
            "."
        ) `
        -Quiet | Out-Null

    Write-Host "Arquivos inesperados no stage:" -ForegroundColor Red

    foreach ($File in $UnexpectedStaged) {
        Write-Host "  $File"
    }

    throw "Commit cancelado para não misturar alterações."
}

if ($StagedFiles.Count -gt 0) {
    Invoke-Git `
        -Arguments @(
            "--no-pager",
            "diff",
            "--cached",
            "--check"
        )

    if ($script:LastExternalExitCode -ne 0) {
        throw "O conteúdo preparado possui problemas."
    }

    Write-Host ""
    Write-Host "Arquivos incluídos:" -ForegroundColor Cyan

    foreach ($File in $StagedFiles) {
        Write-Host "  $File"
    }

    Invoke-Git `
        -Arguments @(
            "--no-pager",
            "diff",
            "--cached",
            "--stat"
        )

    Invoke-Git `
        -Arguments @(
            "commit",
            "-m",
            $CommitMessage
        )

    if ($script:LastExternalExitCode -ne 0) {
        throw "Não foi possível criar o commit."
    }

    Write-Ok "Commit criado"
}
else {
    Write-Warn "O módulo já está registrado no HEAD atual; nenhum novo commit foi necessário."
}

$CommitOutput = @(
    Invoke-Git `
        -Arguments @(
            "rev-parse",
            "HEAD"
        ) `
        -Quiet
)

if ($script:LastExternalExitCode -ne 0) {
    throw "Não foi possível identificar o commit atual."
}

$CommitSha = ($CommitOutput -join "`n").Trim()

$ShortCommitOutput = @(
    Invoke-Git `
        -Arguments @(
            "rev-parse",
            "--short",
            "HEAD"
        ) `
        -Quiet
)

$ShortCommit = ($ShortCommitOutput -join "`n").Trim()

# ============================================================
# 7. PUSH PARA O GITHUB
# ============================================================

Write-Section "ENVIANDO AO GITHUB"

Invoke-Git `
    -Arguments @(
        "push",
        "-u",
        "origin",
        $Branch
    )

if ($script:LastExternalExitCode -ne 0) {
    throw "O push para o GitHub falhou."
}

Write-Ok "PUSH_CONCLUIDO"
Write-Ok "Commit: $ShortCommit"

# ============================================================
# 8. DEPLOY LIMPO DO COMMIT
# ============================================================

$DeployFolder = Join-Path `
    $env:TEMP `
    (
        "orcaly-delivery-drivers-" +
        $ShortCommit +
        "-" +
        (Get-Date -Format "yyyyMMddHHmmss")
    )

$WorktreeAdded = $false
$DeploymentSucceeded = $false
$DeploymentUrl = ""

try {
    Write-Section "CRIANDO CÓPIA LIMPA PARA O DEPLOY"

    Invoke-Git `
        -Arguments @(
            "worktree",
            "add",
            "--detach",
            $DeployFolder,
            $CommitSha
        )

    if ($script:LastExternalExitCode -ne 0) {
        throw "Não foi possível criar a cópia limpa para deploy."
    }

    $WorktreeAdded = $true

    Copy-Item `
        -LiteralPath $VercelDirectory `
        -Destination (Join-Path $DeployFolder ".vercel") `
        -Recurse `
        -Force

    Push-Location $DeployFolder

    try {
        Write-Section "PUBLICANDO EM PRODUÇÃO"

        $DeployOutput = @(
            Invoke-Vercel `
                -Arguments @(
                    "--prod",
                    "--yes",
                    "--force"
                ) `
                -Quiet `
                -IncludeErrorOutput
        )

        $DeployExitCode =
            $script:LastExternalExitCode

        foreach ($Line in $DeployOutput) {
            Write-Host $Line
        }

        if ($DeployExitCode -ne 0) {
            throw "O deploy da Vercel falhou."
        }

        $DeployText = $DeployOutput -join "`n"

        $UrlMatches = [regex]::Matches(
            $DeployText,
            "https://[A-Za-z0-9.-]+\.vercel\.app"
        )

        if ($UrlMatches.Count -gt 0) {
            $DeploymentUrl =
                $UrlMatches[
                    $UrlMatches.Count - 1
                ].Value
        }

        $DeploymentSucceeded = $true
    }
    finally {
        Pop-Location
    }
}
finally {
    if ($WorktreeAdded) {
        Invoke-Git `
            -Arguments @(
                "worktree",
                "remove",
                "--force",
                $DeployFolder
            ) `
            -Quiet | Out-Null

        Invoke-Git `
            -Arguments @(
                "worktree",
                "prune"
            ) `
            -Quiet | Out-Null
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
# 9. TESTAR PRODUÇÃO
# ============================================================

Write-Section "TESTANDO PRODUÇÃO"

$BaseUrl = $ProductionDomain.TrimEnd("/")
$HomeUrl = $BaseUrl + "/"
$DeliveryUrl = $BaseUrl + "/painel/entregas"

$HomeValidated = $false
$DeliveryRouteValidated = $false
$LastHomeError = ""
$LastDeliveryError = ""

for ($Attempt = 1; $Attempt -le 10; $Attempt++) {
    try {
        $HomeResponse = Invoke-WebRequest `
            -Uri $HomeUrl `
            -UseBasicParsing `
            -MaximumRedirection 5 `
            -TimeoutSec 40

        if ($HomeResponse.StatusCode -eq 200) {
            $HomeValidated = $true
        }
        else {
            $LastHomeError =
                "HTTP $($HomeResponse.StatusCode)"
        }
    }
    catch {
        $LastHomeError = $_.Exception.Message
    }

    try {
        $DeliveryResponse = Invoke-WebRequest `
            -Uri $DeliveryUrl `
            -UseBasicParsing `
            -MaximumRedirection 5 `
            -TimeoutSec 40

        $DeliveryContent = [string]$DeliveryResponse.Content

        if (
            $DeliveryResponse.StatusCode -eq 200 -and
            (
                $DeliveryContent -match "Bem-vindo de volta" -or
                $DeliveryContent -match "Central de entregas" -or
                $DeliveryContent -match "Entrar"
            )
        ) {
            $DeliveryRouteValidated = $true
        }
        else {
            $LastDeliveryError =
                "HTTP $($DeliveryResponse.StatusCode), conteúdo esperado não encontrado."
        }
    }
    catch {
        $LastDeliveryError = $_.Exception.Message
    }

    if (
        $HomeValidated -and
        $DeliveryRouteValidated
    ) {
        break
    }

    if ($Attempt -lt 10) {
        Write-Warn "Produção ainda propagando. Tentativa $Attempt de 10."
        Start-Sleep -Seconds 5
    }
}

if (-not $HomeValidated) {
    throw "A Home de produção não foi validada: $LastHomeError"
}

if (-not $DeliveryRouteValidated) {
    throw "A rota /painel/entregas não foi validada: $LastDeliveryError"
}

Write-Ok "HOME_HTTP_200"
Write-Ok "ROTA_ENTREGAS_RESPONDENDO"

# ============================================================
# 10. RESULTADO
# ============================================================

Write-Section "ENTREGADORES PUBLICADOS COM SUCESSO"

Write-Host "Branch: $Branch"
Write-Host "Commit: $ShortCommit"
Write-Host "Mensagem: $CommitMessage"
Write-Host "Arquivos do módulo:"

foreach ($File in $AllowedFiles) {
    Write-Host "  $File"
}

Write-Host "GitHub: push concluído"
Write-Host "Deploy: produção"
Write-Host "Domínio: $DeliveryUrl"
Write-Host "Banco: estrutura já aplicada no Supabase"
Write-Host "Build: aprovado"

if ($DeploymentUrl) {
    Write-Host "Deploy Vercel: $DeploymentUrl"
}

Write-Host ""
Write-Host "Outras alterações locais permaneceram fora do commit e do deploy."

Invoke-Git `
    -Arguments @(
        "status",
        "-sb"
    )

Invoke-Git `
    -Arguments @(
        "--no-pager",
        "log",
        "-3",
        "--oneline"
    )
