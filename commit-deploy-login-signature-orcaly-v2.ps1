param(
    [switch]$SkipPatch,
    [string]$ProductionDomain = "https://orcaly.com.br"
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"
$env:GIT_PAGER = "cat"
$env:NPM_CONFIG_LOGLEVEL = "error"

$Root = (Get-Location).Path
$RelativePath = "app/login/page.tsx"
$LoginPath = Join-Path $Root "app\login\page.tsx"
$PatchName = "repaginar-login-signature-orcaly-v3.ps1"
$PatchPath = Join-Path $Root $PatchName
$RequiredMarker = "ORCALY_LOGIN_SIGNATURE_V3"
$CommitMessage = "feat: repagina login com experiencia premium"

$script:LastExternalExitCode = 1
$script:VercelCommand = $null
$script:VercelPrefix = @()

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

function Invoke-External(
    [string]$Command,
    [string[]]$Arguments,
    [switch]$Quiet
) {
    $PreviousPreference = $ErrorActionPreference
    $ErrorActionPreference = "Continue"
    $Output = @()
    $ErrorOutput = @()
    $ExitCode = 1
    $ErrorFile = [System.IO.Path]::GetTempFileName()

    try {
        $Output = @(
            & $Command @Arguments 2> $ErrorFile
        )

        $ExitCode = $LASTEXITCODE

        if (
            Test-Path -LiteralPath $ErrorFile
        ) {
            $ErrorOutput = @(
                Get-Content `
                    -LiteralPath $ErrorFile `
                    -ErrorAction SilentlyContinue
            )
        }
    }
    finally {
        Remove-Item `
            -LiteralPath $ErrorFile `
            -Force `
            -ErrorAction SilentlyContinue

        $ErrorActionPreference = $PreviousPreference
    }

    $script:LastExternalExitCode = $ExitCode

    if (-not $Quiet) {
        foreach ($Line in $Output) {
            Write-Host $Line
        }

        foreach ($Line in $ErrorOutput) {
            if ($ExitCode -eq 0) {
                Write-Host $Line -ForegroundColor DarkYellow
            }
            else {
                Write-Host $Line -ForegroundColor Red
            }
        }
    }

    # Retorna somente stdout. Avisos do Git em stderr não contaminam
    # listas de arquivos nem viram objetos NativeCommandError.
    return $Output
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
    $script:VercelPrefix = @(
        "--yes",
        "vercel@latest"
    )
}

function Invoke-Vercel(
    [string[]]$Arguments,
    [switch]$Quiet
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
        -Quiet:$Quiet
}

function Get-NormalizedLines([object[]]$Lines) {
    return @(
        $Lines |
            ForEach-Object {
                ([string]$_).Trim() -replace "\\", "/"
            } |
            Where-Object {
                $_
            } |
            Sort-Object -Unique
    )
}

Write-Section "ORCALY - COMMIT E DEPLOY DO NOVO LOGIN V2"

if (-not (Test-Path -LiteralPath (Join-Path $Root "package.json"))) {
    throw "Execute este script na raiz do projeto Orçaly."
}

$GitCheck = @(
    Invoke-External `
        -Command "git" `
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
    Invoke-External `
        -Command "git" `
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

if (-not (Test-Path -LiteralPath $LoginPath)) {
    throw "Arquivo não encontrado: $RelativePath"
}

# ============================================================
# 1. GARANTIR QUE O VISUAL SIGNATURE FOI APLICADO
# ============================================================

$LoginContent = [System.IO.File]::ReadAllText(
    $LoginPath,
    [System.Text.Encoding]::UTF8
)

if (-not $LoginContent.Contains($RequiredMarker)) {
    if ($SkipPatch) {
        throw "O novo login ainda não foi aplicado. Marcador ausente: $RequiredMarker"
    }

    if (-not (Test-Path -LiteralPath $PatchPath)) {
        throw "O novo login não foi aplicado e o patch não foi encontrado: $PatchName"
    }

    Write-Section "APLICANDO O LOGIN SIGNATURE V3"

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
        throw "O patch do login falhou."
    }

    $LoginContent = [System.IO.File]::ReadAllText(
        $LoginPath,
        [System.Text.Encoding]::UTF8
    )

    if (-not $LoginContent.Contains($RequiredMarker)) {
        throw "O patch terminou, mas o marcador do novo login continua ausente."
    }
}

Write-Ok "Login Signature V3 confirmado"

# ============================================================
# 2. MOSTRAR ALTERAÇÕES QUE FICARÃO FORA DO COMMIT
# ============================================================

Write-Section "CONFERINDO O ESCOPO"

$TrackedOutput = @(
    Invoke-External `
        -Command "git" `
        -Arguments @(
            "diff",
            "--name-only"
        ) `
        -Quiet
)

$CachedOutput = @(
    Invoke-External `
        -Command "git" `
        -Arguments @(
            "diff",
            "--cached",
            "--name-only"
        ) `
        -Quiet
)

$UntrackedOutput = @(
    Invoke-External `
        -Command "git" `
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
            $_ -ne $RelativePath
        }
)

if ($OtherFiles.Count -gt 0) {
    Write-Warn "Os arquivos abaixo permanecerão fora do commit e do deploy:"

    foreach ($File in $OtherFiles) {
        Write-Host "  $File"
    }
}
else {
    Write-Ok "Nenhuma alteração externa ao login encontrada"
}

$DiffCheckOutput = @(
    Invoke-External `
        -Command "git" `
        -Arguments @(
            "--no-pager",
            "diff",
            "--check",
            "--",
            $RelativePath
        )
)

if ($script:LastExternalExitCode -ne 0) {
    throw "git diff --check encontrou problemas no login."
}

$DiffStatOutput = @(
    Invoke-External `
        -Command "git" `
        -Arguments @(
            "--no-pager",
            "diff",
            "--stat",
            "--",
            $RelativePath
        )
)

# ============================================================
# 3. SEGURANÇA E BUILD LOCAL
# ============================================================

$Package = Get-Content `
    -LiteralPath (Join-Path $Root "package.json") `
    -Raw |
    ConvertFrom-Json

if ($Package.scripts.PSObject.Properties.Name -contains "security:check") {
    Write-Section "VALIDANDO SEGURANÇA"

    Invoke-External `
        -Command "npm.cmd" `
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

Invoke-External `
    -Command "npm.cmd" `
    -Arguments @(
        "run",
        "build"
    )

if ($script:LastExternalExitCode -ne 0) {
    throw "O build falhou. Commit e deploy cancelados."
}

Write-Ok "BUILD_EXIT_CODE=0"

# ============================================================
# 4. VALIDAR VERCEL ANTES DO COMMIT
# ============================================================

Resolve-VercelCommand

Write-Section "VALIDANDO A VERCEL"

$WhoAmIOutput = @(
    Invoke-Vercel `
        -Arguments @(
            "whoami"
        ) `
        -Quiet
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
# 5. CRIAR COMMIT SOMENTE DO LOGIN
# ============================================================

Write-Section "PREPARANDO O COMMIT"

Invoke-External `
    -Command "git" `
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

Invoke-External `
    -Command "git" `
    -Arguments @(
        "add",
        "--",
        $RelativePath
    )

if ($script:LastExternalExitCode -ne 0) {
    throw "Não foi possível preparar o arquivo de login."
}

$StagedOutput = @(
    Invoke-External `
        -Command "git" `
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
            $_ -ne $RelativePath
        }
)

if ($UnexpectedStaged.Count -gt 0) {
    Invoke-External `
        -Command "git" `
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

if ($StagedFiles.Count -eq 1) {
    Invoke-External `
        -Command "git" `
        -Arguments @(
            "--no-pager",
            "diff",
            "--cached",
            "--check"
        )

    if ($script:LastExternalExitCode -ne 0) {
        throw "O conteúdo preparado possui problemas."
    }

    Invoke-External `
        -Command "git" `
        -Arguments @(
            "--no-pager",
            "diff",
            "--cached",
            "--stat"
        )

    Invoke-External `
        -Command "git" `
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
elseif ($StagedFiles.Count -eq 0) {
    Write-Warn "O login já está registrado no HEAD atual; nenhum novo commit foi necessário."
}
else {
    throw "Quantidade inesperada de arquivos preparados."
}

$CommitOutput = @(
    Invoke-External `
        -Command "git" `
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
    Invoke-External `
        -Command "git" `
        -Arguments @(
            "rev-parse",
            "--short",
            "HEAD"
        ) `
        -Quiet
)

$ShortCommit = ($ShortCommitOutput -join "`n").Trim()

# ============================================================
# 6. PUSH
# ============================================================

Write-Section "ENVIANDO AO GITHUB"

Invoke-External `
    -Command "git" `
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
# 7. DEPLOY A PARTIR DE UMA CÓPIA LIMPA DO COMMIT
# ============================================================

$DeployFolder = Join-Path `
    $env:TEMP `
    (
        "orcaly-login-" +
        $ShortCommit +
        "-" +
        (Get-Date -Format "yyyyMMddHHmmss")
    )

$WorktreeAdded = $false
$DeploymentUrl = ""

try {
    Write-Section "CRIANDO CÓPIA LIMPA PARA O DEPLOY"

    Invoke-External `
        -Command "git" `
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
        Write-Section "PUBLICANDO O LOGIN EM PRODUÇÃO"

        $DeployOutput = @(
            Invoke-Vercel `
                -Arguments @(
                    "--prod",
                    "--yes",
                    "--force"
                ) `
                -Quiet
        )

        $DeployExitCode = $script:LastExternalExitCode

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
                $UrlMatches[$UrlMatches.Count - 1].Value
        }
    }
    finally {
        Pop-Location
    }
}
finally {
    if ($WorktreeAdded) {
        Invoke-External `
            -Command "git" `
            -Arguments @(
                "worktree",
                "remove",
                "--force",
                $DeployFolder
            ) `
            -Quiet | Out-Null

        Invoke-External `
            -Command "git" `
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

# ============================================================
# 8. TESTAR O LOGIN NO DOMÍNIO OFICIAL
# ============================================================

Write-Section "TESTANDO O LOGIN EM PRODUÇÃO"

$LoginUrl = $ProductionDomain.TrimEnd("/") + "/login"
$LoginValidated = $false
$LastTestError = ""

for ($Attempt = 1; $Attempt -le 10; $Attempt++) {
    try {
        $Response = Invoke-WebRequest `
            -Uri $LoginUrl `
            -UseBasicParsing `
            -MaximumRedirection 5 `
            -TimeoutSec 40

        $HasExpectedText =
            $Response.Content -match "Bem-vindo de volta"

        if (
            $Response.StatusCode -eq 200 -and
            $HasExpectedText
        ) {
            $LoginValidated = $true
            break
        }

        $LastTestError =
            "HTTP $($Response.StatusCode), texto esperado não encontrado."
    }
    catch {
        $LastTestError = $_.Exception.Message
    }

    if ($Attempt -lt 10) {
        Write-Warn "Produção ainda propagando. Tentativa $Attempt de 10."
        Start-Sleep -Seconds 5
    }
}

if (-not $LoginValidated) {
    throw "O deploy terminou, mas o teste do login falhou: $LastTestError"
}

Write-Ok "LOGIN_HTTP_200"
Write-Ok "CONTEUDO_SIGNATURE_CONFIRMADO"

# ============================================================
# 9. RESULTADO
# ============================================================

Write-Section "LOGIN PUBLICADO COM SUCESSO"

Write-Host "Branch: $Branch"
Write-Host "Commit: $ShortCommit"
Write-Host "Mensagem: $CommitMessage"
Write-Host "Arquivo publicado: $RelativePath"
Write-Host "Domínio: $LoginUrl"

if ($DeploymentUrl) {
    Write-Host "Deploy Vercel: $DeploymentUrl"
}

Write-Host "Build: aprovado"
Write-Host "GitHub: push concluído"
Write-Host "Produção: validada"
Write-Host ""
Write-Host "Arquivos externos permaneceram fora do commit."

Invoke-External `
    -Command "git" `
    -Arguments @(
        "status",
        "-sb"
    )

Invoke-External `
    -Command "git" `
    -Arguments @(
        "--no-pager",
        "log",
        "-3",
        "--oneline"
    )
