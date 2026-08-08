param(
    [string]$TestSlug = "grafica-flash",
    [string]$RootDomain = "orcaly.com.br"
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"
$env:GIT_PAGER = "cat"
$env:NPM_CONFIG_LOGLEVEL = "error"

$Root = (Get-Location).Path
$ProxyPath = Join-Path $Root "proxy.ts"
$BackupDirectory = Join-Path `
    $Root `
    (
        ".orcaly-backups\checkout-subdomain-" +
        (Get-Date -Format "yyyyMMdd-HHmmss")
    )
$BackupPath = Join-Path $BackupDirectory "proxy.ts"
$CommitMessage = "fix: preserva checkout em subdominios"
$InstallerVersion = "V2_WINDOWS_POWERSHELL_PARSER_FIX"

$GitCommand = $null
$NpmCommand = $null
$VercelCommand = $null
$VercelPrefix = @()
$CommitCreated = $false
$PatchApplied = $false

function Write-Section([string]$Text) {
    Write-Host ""
    Write-Host ("=" * 76) -ForegroundColor DarkCyan
    Write-Host $Text -ForegroundColor Cyan
    Write-Host ("=" * 76) -ForegroundColor DarkCyan
}

function Write-Ok([string]$Text) {
    Write-Host "[OK] $Text" -ForegroundColor Green
}

function Write-Warn([string]$Text) {
    Write-Host "[AVISO] $Text" -ForegroundColor Yellow
}

function Resolve-CommandPath(
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
    [switch]$Quiet
) {
    $PreviousPreference = $ErrorActionPreference
    $ErrorActionPreference = "Continue"

    try {
        $Output = @(
            & $Command @Arguments 2>&1
        )
        $Code = $LASTEXITCODE
    }
    finally {
        $ErrorActionPreference = $PreviousPreference
    }

    if (-not $Quiet) {
        foreach ($Line in $Output) {
            Write-Host $Line
        }
    }

    return @{
        ExitCode = $Code
        Output = @($Output)
    }
}

function Invoke-Git(
    [string[]]$Arguments,
    [switch]$Quiet
) {
    return Invoke-External `
        -Command $GitCommand `
        -Arguments $Arguments `
        -Quiet:$Quiet
}

function Invoke-Npm(
    [string[]]$Arguments,
    [switch]$Quiet
) {
    return Invoke-External `
        -Command $NpmCommand `
        -Arguments $Arguments `
        -Quiet:$Quiet
}

function Resolve-Vercel {
    $Global = Get-Command `
        vercel.cmd `
        -ErrorAction SilentlyContinue

    if (-not $Global) {
        $Global = Get-Command `
            vercel `
            -ErrorAction SilentlyContinue
    }

    if ($Global) {
        $script:VercelCommand = $Global.Source
        $script:VercelPrefix = @()
        return
    }

    $Npx = Get-Command `
        npx.cmd `
        -ErrorAction SilentlyContinue

    if (-not $Npx) {
        $Npx = Get-Command `
            npx `
            -ErrorAction SilentlyContinue
    }

    if (-not $Npx) {
        throw "Vercel CLI e npx não foram encontrados."
    }

    $script:VercelCommand = $Npx.Source
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

function Read-Utf8([string]$Path) {
    return [System.IO.File]::ReadAllText(
        $Path,
        [System.Text.Encoding]::UTF8
    )
}

function Write-Utf8NoBom(
    [string]$Path,
    [string]$Content
) {
    $Encoding = New-Object System.Text.UTF8Encoding($false)

    [System.IO.File]::WriteAllText(
        $Path,
        $Content,
        $Encoding
    )
}

function Restore-Proxy {
    if (
        $PatchApplied -and
        -not $CommitCreated -and
        (Test-Path -LiteralPath $BackupPath)
    ) {
        Copy-Item `
            -LiteralPath $BackupPath `
            -Destination $ProxyPath `
            -Force

        Write-Warn "proxy.ts restaurado porque a validação falhou antes do commit."
    }
}

function Get-WebResponse([string]$Url) {
    try {
        $Response = Invoke-WebRequest `
            -Uri $Url `
            -UseBasicParsing `
            -MaximumRedirection 5 `
            -TimeoutSec 45

        return @{
            Status = [int]$Response.StatusCode
            Body = [string]$Response.Content
            Headers = $Response.Headers
        }
    }
    catch {
        $Status = 0
        $Body = ""

        if ($_.Exception.Response) {
            try {
                $Status = [int]$_.Exception.Response.StatusCode.value__
            }
            catch {
                $Status = 0
            }

            try {
                $Reader = New-Object System.IO.StreamReader(
                    $_.Exception.Response.GetResponseStream()
                )
                $Body = $Reader.ReadToEnd()
                $Reader.Dispose()
            }
            catch {
                $Body = ""
            }
        }

        return @{
            Status = $Status
            Body = $Body
            Headers = @{}
        }
    }
}

Write-Section "ORCALY - CORREÇÃO DO LOOP DO CHECKOUT EM SUBDOMÍNIO - V2"

if (-not (Test-Path -LiteralPath (Join-Path $Root "package.json"))) {
    throw "Execute este script na raiz do projeto Orçaly."
}

if (-not (Test-Path -LiteralPath $ProxyPath)) {
    throw "proxy.ts não foi encontrado."
}

$GitCommand = Resolve-CommandPath `
    -Candidates @(
        "git.exe",
        "git"
    ) `
    -FriendlyName "Git"

$NpmCommand = Resolve-CommandPath `
    -Candidates @(
        "npm.cmd",
        "npm"
    ) `
    -FriendlyName "npm"

$RepoCheck = Invoke-Git `
    -Arguments @(
        "rev-parse",
        "--is-inside-work-tree"
    ) `
    -Quiet

if (
    $RepoCheck.ExitCode -ne 0 -or
    (($RepoCheck.Output -join "`n").Trim() -ne "true")
) {
    throw "A pasta atual não é um repositório Git."
}

$BranchResult = Invoke-Git `
    -Arguments @(
        "branch",
        "--show-current"
    ) `
    -Quiet

if ($BranchResult.ExitCode -ne 0) {
    throw "Não foi possível identificar a branch atual."
}

$Branch = ($BranchResult.Output -join "`n").Trim()

if ([string]::IsNullOrWhiteSpace($Branch)) {
    throw "O repositório está em detached HEAD."
}

Write-Ok "Branch atual: $Branch"

Write-Section "CONFERINDO O GITHUB"

$FetchResult = Invoke-Git `
    -Arguments @(
        "fetch",
        "origin"
    )

if ($FetchResult.ExitCode -ne 0) {
    throw "Não foi possível consultar o GitHub."
}

$RemoteCheck = Invoke-Git `
    -Arguments @(
        "show-ref",
        "--verify",
        "--quiet",
        "refs/remotes/origin/$Branch"
    ) `
    -Quiet

if ($RemoteCheck.ExitCode -eq 0) {
    $BehindResult = Invoke-Git `
        -Arguments @(
            "rev-list",
            "--count",
            "HEAD..origin/$Branch"
        ) `
        -Quiet

    $Behind = 0

    [void][int]::TryParse(
        (($BehindResult.Output -join "`n").Trim()),
        [ref]$Behind
    )

    if ($Behind -gt 0) {
        throw "A branch local está ${Behind} commit(s) atrás do GitHub."
    }
}

$ExistingStage = Invoke-Git `
    -Arguments @(
        "diff",
        "--cached",
        "--name-only"
    ) `
    -Quiet

$StagedFiles = @(
    $ExistingStage.Output |
        ForEach-Object {
            ([string]$_).Trim()
        } |
        Where-Object {
            $_
        }
)

$UnexpectedStage = @(
    $StagedFiles |
        Where-Object {
            $_ -ne "proxy.ts"
        }
)

if ($UnexpectedStage.Count -gt 0) {
    Write-Host "Arquivos já preparados para outro commit:" -ForegroundColor Red

    foreach ($File in $UnexpectedStage) {
        Write-Host "  $File"
    }

    throw "Limpe ou conclua o stage atual antes de executar esta correção."
}

Write-Section "APLICANDO A CORREÇÃO"

New-Item `
    -ItemType Directory `
    -Path $BackupDirectory `
    -Force | Out-Null

Copy-Item `
    -LiteralPath $ProxyPath `
    -Destination $BackupPath `
    -Force

Write-Ok "Backup criado: $BackupPath"

$CurrentProxy = Read-Utf8 $ProxyPath

if (
    $CurrentProxy.Contains(
        "ORCALY_SUBDOMAIN_ROUTE_PASSTHROUGH_V1"
    )
) {
    Write-Ok "A correção já está presente no proxy.ts"
}
else {
    $OldBlock = @'
  const shouldRewriteSubdomain =
    subdomain &&
    !isReservedSubdomain(subdomain) &&
    !pathname.startsWith('/api') &&
    !pathname.startsWith('/_next') &&
    !pathname.includes('.')
'@

    $NewBlock = @'
  // ORCALY_SUBDOMAIN_ROUTE_PASSTHROUGH_V1
  // Apenas a raiz do subdomínio representa a vitrine da empresa.
  // Rotas reais, como /checkout/[slug], devem seguir para o Next.js.
  const shouldRewriteSubdomain =
    subdomain &&
    !isReservedSubdomain(subdomain) &&
    pathname === '/'
'@

    if (-not $CurrentProxy.Contains($OldBlock)) {
        throw "O bloco esperado do proxy não foi encontrado. Nenhum arquivo foi alterado."
    }

    $UpdatedProxy = $CurrentProxy.Replace(
        $OldBlock,
        $NewBlock
    )

    Write-Utf8NoBom `
        -Path $ProxyPath `
        -Content $UpdatedProxy

    $PatchApplied = $true
    Write-Ok "proxy.ts corrigido"
}

try {
    $ValidatedProxy = Read-Utf8 $ProxyPath

    foreach ($Marker in @(
        "ORCALY_SUBDOMAIN_ROUTE_PASSTHROUGH_V1",
        "pathname === '/'",
        'url.pathname = `/site/${subdomain}`'
    )) {
        if (-not $ValidatedProxy.Contains($Marker)) {
            throw "Validação falhou: marcador ausente no proxy.ts: $Marker"
        }
    }

    $LegacyRewriteRule = @'
    !pathname.startsWith('/api') &&
    !pathname.startsWith('/_next') &&
    !pathname.includes('.')
'@

    if ($ValidatedProxy.Contains($LegacyRewriteRule)) {
        throw "A regra antiga de reescrita ainda foi encontrada."
    }

    Write-Section "VALIDANDO SEGURANÇA"

    $AdminSecurityPath = Join-Path `
        $Root `
        "scripts\admin-security-check.mjs"

    if (Test-Path -LiteralPath $AdminSecurityPath) {
        $AdminSecurity = Invoke-External `
            -Command "node.exe" `
            -Arguments @(
                $AdminSecurityPath
            )

        if ($AdminSecurity.ExitCode -ne 0) {
            throw "A auditoria administrativa falhou."
        }

        Write-Ok "ADMIN_SECURITY_CHECK_EXIT_CODE=0"
    }

    $SecurityCheck = Invoke-Npm `
        -Arguments @(
            "run",
            "security:check"
        )

    if ($SecurityCheck.ExitCode -ne 0) {
        throw "security:check falhou."
    }

    Write-Ok "SECURITY_CHECK_EXIT_CODE=0"

    $DiffCheck = Invoke-Git `
        -Arguments @(
            "--no-pager",
            "diff",
            "--check",
            "--",
            "proxy.ts"
        )

    if ($DiffCheck.ExitCode -ne 0) {
        throw "git diff --check encontrou problemas em proxy.ts."
    }

    Write-Section "EXECUTANDO BUILD COMPLETO"

    Remove-Item `
        -LiteralPath (Join-Path $Root ".next") `
        -Recurse `
        -Force `
        -ErrorAction SilentlyContinue

    $BuildResult = Invoke-Npm `
        -Arguments @(
            "run",
            "build"
        )

    if ($BuildResult.ExitCode -ne 0) {
        throw "O build falhou."
    }

    Write-Ok "BUILD_EXIT_CODE=0"

    Write-Section "CRIANDO O COMMIT"

    $StageResult = Invoke-Git `
        -Arguments @(
            "add",
            "--",
            "proxy.ts"
        )

    if ($StageResult.ExitCode -ne 0) {
        throw "Não foi possível preparar proxy.ts."
    }

    $StageList = Invoke-Git `
        -Arguments @(
            "diff",
            "--cached",
            "--name-only"
        ) `
        -Quiet

    $PreparedFiles = @(
        $StageList.Output |
            ForEach-Object {
                ([string]$_).Trim()
            } |
            Where-Object {
                $_
            }
    )

    $UnexpectedPrepared = @(
        $PreparedFiles |
            Where-Object {
                $_ -ne "proxy.ts"
            }
    )

    if ($UnexpectedPrepared.Count -gt 0) {
        throw "O stage contém arquivos inesperados."
    }

    if ($PreparedFiles.Count -gt 0) {
        $CommitResult = Invoke-Git `
            -Arguments @(
                "commit",
                "-m",
                $CommitMessage
            )

        if ($CommitResult.ExitCode -ne 0) {
            throw "Não foi possível criar o commit."
        }

        $CommitCreated = $true
        Write-Ok "Commit criado: $CommitMessage"
    }
    else {
        Write-Warn "Nenhuma alteração nova para commit. O HEAD atual será publicado."
    }

    Write-Section "ENVIANDO AO GITHUB"

    $PushResult = Invoke-Git `
        -Arguments @(
            "push",
            "-u",
            "origin",
            $Branch
        )

    if ($PushResult.ExitCode -ne 0) {
        throw "O push para o GitHub falhou."
    }

    Write-Ok "PUSH_CONCLUIDO"

    $HeadResult = Invoke-Git `
        -Arguments @(
            "rev-parse",
            "HEAD"
        ) `
        -Quiet

    $CommitSha = (
        $HeadResult.Output -join "`n"
    ).Trim()

    $ShortResult = Invoke-Git `
        -Arguments @(
            "rev-parse",
            "--short",
            "HEAD"
        ) `
        -Quiet

    $ShortCommit = (
        $ShortResult.Output -join "`n"
    ).Trim()

    Resolve-Vercel

    $WhoAmI = Invoke-Vercel `
        -Arguments @(
            "whoami"
        ) `
        -Quiet

    if ($WhoAmI.ExitCode -ne 0) {
        throw "A Vercel CLI não está autenticada. Execute: vercel login"
    }

    $VercelDirectory = Join-Path $Root ".vercel"

    if (-not (Test-Path -LiteralPath $VercelDirectory)) {
        throw "A pasta .vercel não foi encontrada. Execute vercel link antes."
    }

    $DeployFolder = Join-Path `
        $env:TEMP `
        (
            "orcaly-checkout-fix-" +
            $ShortCommit +
            "-" +
            (Get-Date -Format "yyyyMMddHHmmss")
        )

    $WorktreeAdded = $false

    try {
        Write-Section "PUBLICANDO UMA CÓPIA LIMPA EM PRODUÇÃO"

        $WorktreeResult = Invoke-Git `
            -Arguments @(
                "worktree",
                "add",
                "--detach",
                $DeployFolder,
                $CommitSha
            )

        if ($WorktreeResult.ExitCode -ne 0) {
            throw "Não foi possível criar o worktree de deploy."
        }

        $WorktreeAdded = $true

        Copy-Item `
            -LiteralPath $VercelDirectory `
            -Destination (Join-Path $DeployFolder ".vercel") `
            -Recurse `
            -Force

        Push-Location $DeployFolder

        try {
            $DeployResult = Invoke-Vercel `
                -Arguments @(
                    "--prod",
                    "--yes",
                    "--force"
                )

            if ($DeployResult.ExitCode -ne 0) {
                throw "O deploy da Vercel falhou."
            }
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
    }

    Write-Ok "DEPLOY_PRODUCAO_CONCLUIDO"

    Write-Section "TESTANDO O CHECKOUT EM PRODUÇÃO"

    $RootCheckoutUrl =
        "https://${RootDomain}/checkout/${TestSlug}"

    $SubdomainHomeUrl =
        "https://${TestSlug}.${RootDomain}/"

    $SubdomainCheckoutUrl =
        "https://${TestSlug}.${RootDomain}/checkout/${TestSlug}"

    $ApiCheckoutUrl =
        "https://${TestSlug}.${RootDomain}/api/checkout/${TestSlug}"

    $ProductionValidated = $false
    $LastStatus = ""

    for ($Attempt = 1; $Attempt -le 12; $Attempt += 1) {
        $SubdomainHomeResponse = Get-WebResponse $SubdomainHomeUrl
        $RootCheckoutResponse = Get-WebResponse $RootCheckoutUrl
        $SubdomainCheckoutResponse = Get-WebResponse $SubdomainCheckoutUrl
        $ApiCheckoutResponse = Get-WebResponse $ApiCheckoutUrl

        $HomeOk =
            $SubdomainHomeResponse.Status -eq 200

        $RootCheckoutOk =
            $RootCheckoutResponse.Status -eq 200 -and
            $RootCheckoutResponse.Body.Contains(
                "Checkout seguro"
            )

        $SubdomainCheckoutOk =
            $SubdomainCheckoutResponse.Status -eq 200 -and
            $SubdomainCheckoutResponse.Body.Contains(
                "Checkout seguro"
            ) -and
            $SubdomainCheckoutResponse.Body.Contains(
                "Revise o pedido e pague sem sair desta página."
            )

        $ApiCheckoutOk =
            $ApiCheckoutResponse.Status -eq 200 -and
            $ApiCheckoutResponse.Body.Contains(
                '"company"'
            )

        if (
            $HomeOk -and
            $RootCheckoutOk -and
            $SubdomainCheckoutOk -and
            $ApiCheckoutOk
        ) {
            $ProductionValidated = $true
            break
        }

        $LastStatus = (
            "home=$($SubdomainHomeResponse.Status); " +
            "checkoutRaiz=$($RootCheckoutResponse.Status); " +
            "checkoutSubdominio=$($SubdomainCheckoutResponse.Status); " +
            "api=$($ApiCheckoutResponse.Status)"
        )

        if ($Attempt -lt 12) {
            Write-Warn "Produção ainda propagando. Tentativa ${Attempt} de 12. ${LastStatus}"
            Start-Sleep -Seconds 5
        }
    }

    if (-not $ProductionValidated) {
        throw "A produção foi publicada, mas o teste final não passou. ${LastStatus}"
    }

    Write-Ok "SUBDOMINIO_HOME_HTTP_200"
    Write-Ok "CHECKOUT_RAIZ_HTTP_200"
    Write-Ok "CHECKOUT_SUBDOMINIO_HTTP_200"
    Write-Ok "CHECKOUT_NAO_REESCRITO_PARA_VITRINE"
    Write-Ok "API_CHECKOUT_HTTP_200"
    Write-Ok "LOOP_CHECKOUT_CORRIGIDO=1"

    Write-Section "CORREÇÃO PUBLICADA"

    Write-Host "Commit: $ShortCommit"
    Write-Host "Branch: $Branch"
    Write-Host "Vitrine: $SubdomainHomeUrl"
    Write-Host "Checkout: $SubdomainCheckoutUrl"
    Write-Host "Apenas proxy.ts foi incluído no commit."
}
catch {
    Restore-Proxy
    throw
}
