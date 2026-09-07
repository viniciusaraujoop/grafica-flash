param(
    [string]$ProductionDomain = "https://orcaly.com.br",
    [switch]$SkipHardening
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"
$env:GIT_PAGER = "cat"
$env:NPM_CONFIG_LOGLEVEL = "error"

$Root = (Get-Location).Path
$HardeningScriptName = "endurecer-acesso-admin-dono-orcaly.ps1"
$HardeningScriptPath = Join-Path $Root $HardeningScriptName
$CommitMessage = "feat: adiciona parceiros e painel administrativo seguro"
$InstallerVersion = "V2_WINDOWS_POWERSHELL_51_PARSER_FIX"

$ProgramMarker = "ORCALY_AFFILIATE_PROGRAM_V1"
$ProgramIntegrationMarker = "ORCALY_AFFILIATE_INTEGRATION_V1"
$ProgramMigrationMarker = "ORCALY_AFFILIATE_PROGRAM_DATABASE_V1"

$OwnerMarker = "ORCALY_OWNER_SUPPORT_CONTROL_V1"
$OwnerMigrationMarker = "ORCALY_OWNER_SUPPORT_CONTROL_V1"

$HardeningMarker = "ORCALY_PLATFORM_ADMIN_HARDENING_V1"
$HardeningMigrationMarker = "ORCALY_PLATFORM_ADMIN_HARDENING_V1"

$script:GitCommand = $null
$script:NpmCommand = $null
$script:VercelCommand = $null
$script:VercelPrefix = @()

$script:LastExitCode = 1
$script:LastStdOut = @()
$script:LastStdErr = @()
$script:LastOutput = @()

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

function Normalize-GitPath([string]$Path) {
    return (($Path -replace "\\", "/").Trim())
}

function Read-Utf8([string]$Path) {
    if (-not (Test-Path -LiteralPath $Path)) {
        return ""
    }

    return [System.IO.File]::ReadAllText(
        $Path,
        [System.Text.Encoding]::UTF8
    )
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

    $script:LastExitCode = $ExitCode
    $script:LastStdOut = @($StdOut)
    $script:LastStdErr = @($StdErr)
    $script:LastOutput = @(
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
        return @($script:LastOutput)
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

function Find-Migrations([string]$Marker) {
    $Directory = Join-Path $Root "supabase\migrations"

    if (-not (Test-Path -LiteralPath $Directory)) {
        return @()
    }

    return @(
        Get-ChildItem `
            -LiteralPath $Directory `
            -Filter "*.sql" `
            -File |
            Where-Object {
                (Read-Utf8 $_.FullName).Contains($Marker)
            }
    )
}

function Require-Migration(
    [string]$Marker,
    [string]$Label
) {
    $Files = @(Find-Migrations $Marker)

    if ($Files.Count -ne 1) {
        Write-Host "Migrações encontradas para ${Label}:" -ForegroundColor Red

        foreach ($File in $Files) {
            Write-Host "  $($File.FullName)"
        }

        throw "Era esperada exatamente uma migration de $Label."
    }

    return $Files[0]
}

function Test-FileMarkers(
    [string]$Relative,
    [string[]]$Markers
) {
    $Path = Join-Path `
        $Root `
        ($Relative -replace "/", "\")

    if (-not (Test-Path -LiteralPath $Path)) {
        throw "Arquivo obrigatório ausente: $Relative"
    }

    $Content = Read-Utf8 $Path

    foreach ($Marker in $Markers) {
        if (-not $Content.Contains($Marker)) {
            throw "Marcador ausente em ${Relative}: $Marker"
        }
    }

    Write-Ok $Relative
}

function Invoke-HardeningWhenNeeded {
    $ProxyPath = Join-Path $Root "proxy.ts"
    $ProxyText = Read-Utf8 $ProxyPath

    if ($ProxyText.Contains($HardeningMarker)) {
        Write-Ok "Endurecimento administrativo já aplicado"
        return
    }

    if ($SkipHardening) {
        throw "O endurecimento administrativo ainda não foi aplicado e -SkipHardening foi informado."
    }

    if (-not (Test-Path -LiteralPath $HardeningScriptPath)) {
        throw "Arquivo necessário não encontrado: $HardeningScriptName"
    }

    Write-Section "APLICANDO O ENDURECIMENTO ADMINISTRATIVO"

    Invoke-External `
        -Command "powershell.exe" `
        -Arguments @(
            "-NoProfile",
            "-ExecutionPolicy",
            "Bypass",
            "-File",
            $HardeningScriptPath
        )

    if ($script:LastExitCode -ne 0) {
        throw "O endurecimento administrativo falhou."
    }

    $UpdatedProxy = Read-Utf8 $ProxyPath

    if (-not $UpdatedProxy.Contains($HardeningMarker)) {
        throw "O script terminou, mas o marcador de endurecimento não foi encontrado."
    }

    Write-Ok "Endurecimento administrativo aplicado"
}

function Test-KnownPasswordAbsent {
    $Roots = @(
        "app",
        "components",
        "lib",
        "scripts",
        "supabase"
    )

    $IgnoredPasswordScanFiles = @(
        (
            Join-Path `
                $Root `
                "scripts\admin-security-check.mjs"
        ).ToLowerInvariant()
    )

    $Extensions = @(
        ".ts",
        ".tsx",
        ".js",
        ".mjs",
        ".json",
        ".sql",
        ".ps1"
    )

    foreach ($RelativeRoot in $Roots) {
        $Directory = Join-Path $Root $RelativeRoot

        if (-not (Test-Path -LiteralPath $Directory)) {
            continue
        }

        $Matches = @(
            Get-ChildItem `
                -LiteralPath $Directory `
                -File `
                -Recurse `
                -ErrorAction SilentlyContinue |
                Where-Object {
                    (
                        $Extensions -contains
                            $_.Extension.ToLowerInvariant()
                    ) -and (
                        $IgnoredPasswordScanFiles -notcontains
                            $_.FullName.ToLowerInvariant()
                    )
                } |
                Select-String `
                    -SimpleMatch `
                    -Pattern "Vini1503." `
                    -ErrorAction SilentlyContinue
        )

        if ($Matches.Count -gt 0) {
            foreach ($Match in $Matches) {
                Write-Host "  $($Match.Path):$($Match.LineNumber)" -ForegroundColor Red
            }

            throw "A senha conhecida foi encontrada no código."
        }
    }

    Write-Ok "Nenhuma senha administrativa conhecida foi encontrada no código"
}

function Invoke-HttpProbe(
    [string]$Url,
    [bool]$AllowRedirect
) {
    Add-Type `
        -AssemblyName System.Net.Http `
        -ErrorAction SilentlyContinue

    $Handler = New-Object System.Net.Http.HttpClientHandler
    $Handler.AllowAutoRedirect = $AllowRedirect

    $Client = New-Object System.Net.Http.HttpClient($Handler)
    $Client.Timeout = [TimeSpan]::FromSeconds(40)
    $Client.DefaultRequestHeaders.UserAgent.ParseAdd(
        "Orcaly-Deploy-Validator/1.0"
    )

    try {
        $Response = $Client.GetAsync(
            $Url
        ).GetAwaiter().GetResult()

        $Body = $Response.Content.ReadAsStringAsync(
        ).GetAwaiter().GetResult()

        $Headers = @{}

        foreach ($Header in $Response.Headers) {
            $Headers[$Header.Key] = (
                @($Header.Value) -join ", "
            )
        }

        foreach ($Header in $Response.Content.Headers) {
            $Headers[$Header.Key] = (
                @($Header.Value) -join ", "
            )
        }

        return @{
            Status = [int]$Response.StatusCode
            Body = [string]$Body
            Headers = $Headers
            Location = [string]$Response.Headers.Location
        }
    }
    finally {
        $Client.Dispose()
        $Handler.Dispose()
    }
}

Write-Section "ORCALY - COMMIT E DEPLOY DO PROGRAMA DE PARCEIROS - V2"

if (-not (Test-Path -LiteralPath (Join-Path $Root "package.json"))) {
    throw "Execute este script na raiz do projeto Orçaly."
}

$script:GitCommand = Resolve-CommandPath `
    -Candidates @(
        "git.exe",
        "git"
    ) `
    -FriendlyName "Git"

$script:NpmCommand = Resolve-CommandPath `
    -Candidates @(
        "npm.cmd",
        "npm"
    ) `
    -FriendlyName "npm"

$Inside = @(
    Invoke-Git `
        -Arguments @(
            "rev-parse",
            "--is-inside-work-tree"
        ) `
        -Quiet
)

if (
    $script:LastExitCode -ne 0 -or
    (($Inside -join "`n").Trim() -ne "true")
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

if ($script:LastExitCode -ne 0) {
    throw "Não foi possível identificar a branch atual."
}

$Branch = ($BranchOutput -join "`n").Trim()

if ([string]::IsNullOrWhiteSpace($Branch)) {
    throw "O repositório está em detached HEAD."
}

Write-Ok "Branch atual: $Branch"

Invoke-Git `
    -Arguments @(
        "remote",
        "get-url",
        "origin"
    ) `
    -Quiet | Out-Null

if ($script:LastExitCode -ne 0) {
    throw "O remote origin não está configurado."
}

Write-Ok "Remote origin configurado"

Write-Section "ATUALIZANDO REFERÊNCIAS DO GITHUB"

Invoke-Git `
    -Arguments @(
        "fetch",
        "origin"
    )

if ($script:LastExitCode -ne 0) {
    throw "Não foi possível consultar o GitHub."
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

$RemoteBranchExists = $script:LastExitCode -eq 0

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

    if ($script:LastExitCode -ne 0) {
        throw "Não foi possível comparar a branch local com o GitHub."
    }

    $Behind = 0
    [void][int]::TryParse(
        (($BehindOutput -join "`n").Trim()),
        [ref]$Behind
    )

    if ($Behind -gt 0) {
        throw "A branch local está $Behind commit(s) atrás do GitHub. Atualize-a antes do deploy."
    }
}

# ============================================================
# 1. APLICAR E VALIDAR A PROTEÇÃO FINAL
# ============================================================

Invoke-HardeningWhenNeeded

Write-Section "VALIDANDO O PROGRAMA E O PAINEL DONO"

$Checks = @(
    @{
        File = "lib/affiliates/server.ts"
        Markers = @(
            $ProgramMarker,
            "createAffiliateCommissionForApprovedPayment",
            "reverseAffiliateCommissionForPayment",
            "requestAffiliatePayout"
        )
    },
    @{
        File = "app/parceiros/page.tsx"
        Markers = @(
            $ProgramMarker,
            "60%",
            "Orçaly Parceiros"
        )
    },
    @{
        File = "app/parceiros/painel/page.tsx"
        Markers = @(
            $ProgramMarker,
            "Comissão futura",
            "Ranking"
        )
    },
    @{
        File = "app/parceiros/termos/page.tsx"
        Markers = @(
            $ProgramMarker,
            "60%",
            "Retenção"
        )
    },
    @{
        File = "app/cadastro/page.tsx"
        Markers = @(
            $ProgramIntegrationMarker,
            "/api/parceiros/track"
        )
    },
    @{
        File = "lib/subscription-service.ts"
        Markers = @(
            $ProgramIntegrationMarker,
            "createAffiliateCommissionForApprovedPayment"
        )
    },
    @{
        File = "lib/platform-admin.ts"
        Markers = @(
            $OwnerMarker,
            "requirePlatformAdmin",
            "OWNER_ONLY"
        )
    },
    @{
        File = "lib/admin-auth.ts"
        Markers = @(
            $OwnerMarker,
            "supabaseAdmin",
            "requireAdmin"
        )
    },
    @{
        File = "app/admin/page.tsx"
        Markers = @(
            $OwnerMarker,
            "OwnerControlCenter"
        )
    },
    @{
        File = "app/admin/indicacoes/page.tsx"
        Markers = @(
            $OwnerMarker,
            "Controle geral de indicações",
            "Revelar chave Pix"
        )
    },
    @{
        File = "app/admin/equipe/page.tsx"
        Markers = @(
            $OwnerMarker,
            "Equipe"
        )
    },
    @{
        File = "proxy.ts"
        Markers = @(
            $OwnerMarker,
            $HardeningMarker,
            "get_my_platform_admin_access",
            "viniciusadm@orcaly.com",
            "X-Robots-Tag"
        )
    },
    @{
        File = "scripts/admin-security-check.mjs"
        Markers = @(
            "ORCALY_PLATFORM_ADMIN_SECURITY_CHECK_V1",
            "ADMIN_SECURITY_CHECK_EXIT_CODE=0"
        )
    }
)

foreach ($Check in $Checks) {
    Test-FileMarkers `
        -Relative $Check.File `
        -Markers $Check.Markers
}

Test-KnownPasswordAbsent

$ProgramMigration = Require-Migration `
    -Marker $ProgramMigrationMarker `
    -Label "programa de parceiros"

$OwnerMigration = Require-Migration `
    -Marker $OwnerMigrationMarker `
    -Label "controle DONO e SUPORTE"

$HardeningMigration = Require-Migration `
    -Marker $HardeningMigrationMarker `
    -Label "endurecimento administrativo"

$ProgramMigrationRelative = Normalize-GitPath (
    $ProgramMigration.FullName.Substring(
        $Root.Length + 1
    )
)

$OwnerMigrationRelative = Normalize-GitPath (
    $OwnerMigration.FullName.Substring(
        $Root.Length + 1
    )
)

$HardeningMigrationRelative = Normalize-GitPath (
    $HardeningMigration.FullName.Substring(
        $Root.Length + 1
    )
)

Write-Ok "Migration parceiros: $ProgramMigrationRelative"
Write-Ok "Migration DONO/SUPORTE: $OwnerMigrationRelative"
Write-Ok "Migration de segurança: $HardeningMigrationRelative"

# ============================================================
# 2. DEFINIR O ESCOPO EXATO
# ============================================================

$RequiredFiles = @(
    "app/page.tsx",
    "app/cadastro/page.tsx",
    "app/api/checkout/lead/route.ts",
    "app/api/leads/complete-account/route.ts",
    "app/api/mercado-pago/webhook/route.ts",
    "app/api/webhooks/asaas/route.ts",
    "lib/subscription-service.ts",
    "lib/subscription-checkout-payment.ts",
    "proxy.ts",

    "lib/affiliates/server.ts",
    "app/api/parceiros/register/route.ts",
    "app/api/parceiros/route.ts",
    "app/api/parceiros/track/route.ts",
    "app/parceiros/layout.tsx",
    "app/parceiros/page.tsx",
    "app/parceiros/login/page.tsx",
    "app/parceiros/cadastro/page.tsx",
    "app/parceiros/termos/page.tsx",
    "app/parceiros/painel/page.tsx",

    "app/admin/page.tsx",
    "app/admin/login/page.tsx",
    "app/admin/alterar-senha/page.tsx",
    "app/admin/auditoria/page.tsx",
    "app/admin/equipe/page.tsx",
    "app/admin/indicacoes/page.tsx",
    "app/api/admin/affiliates/route.ts",
    "app/api/admin/audit/route.ts",
    "app/api/admin/change-password/route.ts",
    "app/api/admin/session/route.ts",
    "app/api/admin/team/route.ts",
    "app/api/platform-admin/summary/route.ts",
    "components/admin/OwnerControlCenter.tsx",
    "components/admin/InternalAdminClient.tsx",
    "lib/admin-auth.ts",
    "lib/platform-admin.ts",
    "scripts/admin-security-check.mjs",

    $ProgramMigrationRelative,
    $OwnerMigrationRelative,
    $HardeningMigrationRelative
) |
    ForEach-Object {
        Normalize-GitPath $_
    } |
    Sort-Object -Unique

foreach ($File in $RequiredFiles) {
    $Path = Join-Path `
        $Root `
        ($File -replace "/", "\")

    if (-not (Test-Path -LiteralPath $Path)) {
        throw "Arquivo do escopo não encontrado: $File"
    }
}

$AllowedSet = @{}

foreach ($File in $RequiredFiles) {
    $AllowedSet[$File] = $true
}

Write-Section "CONFERINDO ALTERAÇÕES LOCAIS"

$Tracked = @(
    Invoke-Git `
        -Arguments @(
            "diff",
            "--name-only"
        ) `
        -Quiet
)

$Cached = @(
    Invoke-Git `
        -Arguments @(
            "diff",
            "--cached",
            "--name-only"
        ) `
        -Quiet
)

$Untracked = @(
    Invoke-Git `
        -Arguments @(
            "ls-files",
            "--others",
            "--exclude-standard"
        ) `
        -Quiet
)

$WorkingFiles = @(
    Get-NormalizedLines (
        @($Tracked) +
        @($Cached) +
        @($Untracked)
    )
)

$OutsideScope = @(
    $WorkingFiles |
        Where-Object {
            -not $AllowedSet.ContainsKey($_)
        }
)

if ($OutsideScope.Count -gt 0) {
    Write-Warn "Estes arquivos permanecerão fora do commit e do deploy:"

    foreach ($File in $OutsideScope) {
        Write-Host "  $File"
    }
}
else {
    Write-Ok "Nenhuma alteração externa ao módulo foi encontrada"
}

# ============================================================
# 3. SEGURANÇA E BUILD
# ============================================================

Write-Section "AUDITANDO ROTAS ADMINISTRATIVAS"

Invoke-External `
    -Command "node.exe" `
    -Arguments @(
        (Join-Path $Root "scripts\admin-security-check.mjs")
    )

if ($script:LastExitCode -ne 0) {
    throw "A auditoria das rotas administrativas falhou."
}

Write-Ok "ADMIN_SECURITY_CHECK_EXIT_CODE=0"

$Package = Get-Content `
    -LiteralPath (Join-Path $Root "package.json") `
    -Raw |
    ConvertFrom-Json

if (
    $Package.scripts.PSObject.Properties.Name -contains
    "security:check"
) {
    Write-Section "VALIDANDO SEGURANÇA GERAL"

    Invoke-Npm `
        -Arguments @(
            "run",
            "security:check"
        )

    if ($script:LastExitCode -ne 0) {
        throw "security:check falhou."
    }

    Write-Ok "SECURITY_CHECK_EXIT_CODE=0"
}

$DiffCheckArgs = @(
    "--no-pager",
    "diff",
    "--check",
    "--"
) + $RequiredFiles

Invoke-Git `
    -Arguments $DiffCheckArgs

if ($script:LastExitCode -ne 0) {
    throw "git diff --check encontrou problemas no escopo."
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

if ($script:LastExitCode -ne 0) {
    throw "O build falhou. Commit e deploy cancelados."
}

$BuildText = $BuildOutput -join "`n"

foreach ($Route in @(
    "/parceiros",
    "/parceiros/login",
    "/parceiros/painel",
    "/admin",
    "/admin/login",
    "/admin/indicacoes",
    "/admin/equipe"
)) {
    if ($BuildText -notmatch [regex]::Escape($Route)) {
        Write-Warn "A rota $Route não apareceu no resumo do build."
    }
}

Write-Ok "BUILD_EXIT_CODE=0"

# ============================================================
# 4. VALIDAR VERCEL
# ============================================================

Resolve-Vercel

Write-Section "VALIDANDO A VERCEL"

$WhoAmI = @(
    Invoke-Vercel `
        -Arguments @(
            "whoami"
        ) `
        -Quiet `
        -IncludeErrorOutput
)

if ($script:LastExitCode -ne 0) {
    foreach ($Line in $WhoAmI) {
        Write-Host $Line
    }

    throw "A Vercel CLI não está autenticada. Execute: vercel login"
}

Write-Ok "Vercel autenticada"

$VercelDirectory = Join-Path $Root ".vercel"
$VercelProjectFile = Join-Path `
    $VercelDirectory `
    "project.json"

if (-not (Test-Path -LiteralPath $VercelProjectFile)) {
    Write-Section "VINCULANDO O PROJETO À VERCEL"

    Invoke-Vercel `
        -Arguments @(
            "link",
            "--yes"
        )

    if ($script:LastExitCode -ne 0) {
        throw "Não foi possível vincular o projeto à Vercel."
    }
}

Write-Ok "Projeto Vercel vinculado"

# ============================================================
# 5. PREPARAR E CRIAR O COMMIT
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

if ($script:LastExitCode -ne 0) {
    throw "Não foi possível limpar o stage anterior."
}

foreach ($File in $RequiredFiles) {
    Invoke-Git `
        -Arguments @(
            "add",
            "-A",
            "--",
            $File
        )

    if ($script:LastExitCode -ne 0) {
        throw "Não foi possível preparar: $File"
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

$Unexpected = @(
    $StagedFiles |
        Where-Object {
            -not $AllowedSet.ContainsKey($_)
        }
)

if ($Unexpected.Count -gt 0) {
    Invoke-Git `
        -Arguments @(
            "restore",
            "--staged",
            "--",
            "."
        ) `
        -Quiet | Out-Null

    Write-Host "Arquivos inesperados no stage:" -ForegroundColor Red

    foreach ($File in $Unexpected) {
        Write-Host "  $File"
    }

    throw "Commit cancelado para não misturar alterações."
}

if ($StagedFiles.Count -gt 0) {
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
            "--check"
        )

    if ($script:LastExitCode -ne 0) {
        throw "O conteúdo preparado possui problemas."
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

    if ($script:LastExitCode -ne 0) {
        throw "Não foi possível criar o commit."
    }

    Write-Ok "Commit criado"
}
else {
    Write-Warn "Nenhuma alteração nova no escopo. O HEAD atual será publicado."
}

$CommitOutput = @(
    Invoke-Git `
        -Arguments @(
            "rev-parse",
            "HEAD"
        ) `
        -Quiet
)

if ($script:LastExitCode -ne 0) {
    throw "Não foi possível identificar o commit atual."
}

$CommitSha = ($CommitOutput -join "`n").Trim()

$ShortOutput = @(
    Invoke-Git `
        -Arguments @(
            "rev-parse",
            "--short",
            "HEAD"
        ) `
        -Quiet
)

$ShortCommit = ($ShortOutput -join "`n").Trim()

# ============================================================
# 6. PUSH
# ============================================================

Write-Section "ENVIANDO AO GITHUB"

Invoke-Git `
    -Arguments @(
        "push",
        "-u",
        "origin",
        $Branch
    )

if ($script:LastExitCode -ne 0) {
    throw "O push para o GitHub falhou."
}

Write-Ok "PUSH_CONCLUIDO"
Write-Ok "Commit: $ShortCommit"

# ============================================================
# 7. DEPLOY LIMPO
# ============================================================

$DeployFolder = Join-Path `
    $env:TEMP `
    (
        "orcaly-partners-admin-" +
        $ShortCommit +
        "-" +
        (Get-Date -Format "yyyyMMddHHmmss")
    )

$WorktreeAdded = $false
$DeploymentSucceeded = $false
$DeploymentUrl = ""

try {
    Write-Section "CRIANDO CÓPIA LIMPA DO COMMIT"

    Invoke-Git `
        -Arguments @(
            "worktree",
            "add",
            "--detach",
            $DeployFolder,
            $CommitSha
        )

    if ($script:LastExitCode -ne 0) {
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

        $DeployExitCode = $script:LastExitCode

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
            $DeploymentUrl = $UrlMatches[
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
# 8. TESTAR PRODUÇÃO E BLOQUEIO ANÔNIMO
# ============================================================

Write-Section "TESTANDO PRODUÇÃO"

$BaseUrl = $ProductionDomain.TrimEnd("/")
$HomeOk = $false
$PartnersOk = $false
$AdminLoginOk = $false
$AdminRedirectOk = $false
$AdminApiBlocked = $false
$AdminHeadersOk = $false
$LastError = ""

for ($Attempt = 1; $Attempt -le 12; $Attempt++) {
    try {
        $Home = Invoke-HttpProbe `
            -Url ($BaseUrl + "/") `
            -AllowRedirect $true

        $Partners = Invoke-HttpProbe `
            -Url ($BaseUrl + "/parceiros") `
            -AllowRedirect $true

        $AdminLogin = Invoke-HttpProbe `
            -Url ($BaseUrl + "/admin/login") `
            -AllowRedirect $true

        $Admin = Invoke-HttpProbe `
            -Url ($BaseUrl + "/admin") `
            -AllowRedirect $false

        $AdminApi = Invoke-HttpProbe `
            -Url ($BaseUrl + "/api/admin/session") `
            -AllowRedirect $false

        $HomeOk = $Home.Status -eq 200

        $PartnersOk =
            $Partners.Status -eq 200 -and
            (
                $Partners.Body.Contains(
                    "Orçaly Parceiros"
                ) -or
                $Partners.Body.Contains(
                    "Programa Orçaly Parceiros"
                )
            )

        $AdminLoginOk =
            $AdminLogin.Status -eq 200 -and
            (
                $AdminLogin.Body.Contains(
                    "Login administrativo"
                ) -or
                $AdminLogin.Body.Contains(
                    "Centro de controle"
                )
            )

        $AdminRedirectOk =
            @(
                301,
                302,
                303,
                307,
                308
            ) -contains $Admin.Status

        $AdminApiBlocked =
            @(
                401,
                403
            ) -contains $AdminApi.Status

        $CacheHeader = ""

        if ($Admin.Headers.ContainsKey("Cache-Control")) {
            $CacheHeader = [string]$Admin.Headers["Cache-Control"]
        }

        $RobotsHeader = ""

        if ($Admin.Headers.ContainsKey("X-Robots-Tag")) {
            $RobotsHeader = [string]$Admin.Headers["X-Robots-Tag"]
        }

        $AdminHeadersOk =
            $CacheHeader.Contains("no-store") -and
            $RobotsHeader.Contains("noindex")

        if (
            $HomeOk -and
            $PartnersOk -and
            $AdminLoginOk -and
            $AdminRedirectOk -and
            $AdminApiBlocked -and
            $AdminHeadersOk
        ) {
            break
        }

        $LastError = (
            "home=$($Home.Status); " +
            "parceiros=$($Partners.Status); " +
            "adminLogin=$($AdminLogin.Status); " +
            "admin=$($Admin.Status); " +
            "adminApi=$($AdminApi.Status); " +
            "headers=$AdminHeadersOk"
        )
    }
    catch {
        $LastError = $_.Exception.Message
    }

    if ($Attempt -lt 12) {
        Write-Warn "Produção ainda propagando. Tentativa $Attempt de 12."
        Start-Sleep -Seconds 5
    }
}

if (-not $HomeOk) {
    throw "A Home de produção não respondeu corretamente. $LastError"
}

if (-not $PartnersOk) {
    throw "O Portal de Parceiros não foi validado. $LastError"
}

if (-not $AdminLoginOk) {
    throw "O login administrativo não foi validado. $LastError"
}

if (-not $AdminRedirectOk) {
    throw "/admin não bloqueou o acesso anônimo por redirecionamento. $LastError"
}

if (-not $AdminApiBlocked) {
    throw "A API administrativa não recusou o acesso anônimo. $LastError"
}

if (-not $AdminHeadersOk) {
    throw "Os cabeçalhos privados do painel administrativo não foram encontrados. $LastError"
}

Write-Ok "HOME_HTTP_200"
Write-Ok "PARCEIROS_HTTP_200"
Write-Ok "ADMIN_LOGIN_HTTP_200"
Write-Ok "ADMIN_ANONIMO_REDIRECIONADO"
Write-Ok "ADMIN_API_ANONIMA_BLOQUEADA"
Write-Ok "ADMIN_CACHE_NO_STORE"
Write-Ok "ADMIN_NOINDEX"

# ============================================================
# 9. RESULTADO
# ============================================================

Write-Section "PROGRAMA DE PARCEIROS PUBLICADO COM SEGURANÇA"

Write-Host "Branch: $Branch"
Write-Host "Commit: $ShortCommit"
Write-Host "Mensagem: $CommitMessage"
Write-Host "GitHub: push concluído"
Write-Host "Vercel: produção publicada"
Write-Host "Portal: $BaseUrl/parceiros"
Write-Host "Login DONO: $BaseUrl/admin/login"
Write-Host "Painel DONO: $BaseUrl/admin"
Write-Host "Owner oficial: viniciusadm@orcaly.com"
Write-Host "Acesso anônimo ao admin: bloqueado"
Write-Host "API administrativa anônima: bloqueada"
Write-Host "Outras alterações locais: fora do commit e do deploy"

if ($DeploymentUrl) {
    Write-Host "URL do deploy: $DeploymentUrl"
}

Write-Host ""

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
