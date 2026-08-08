param(
    [string]$ProjectRoot = "C:\Users\arauj\grafica-flash"
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$ExpectedProjectId = "prj_SzlsQ0ovx6JnDE8v5jJbAa5U9U4O"
$ExpectedOrgId = "team_c5p2Uiz9b1SqKxOhmnmxUWZH"
$RedirectUri = "https://orcaly.com.br/api/marketplace/payments/mercado-pago/callback"
$Timestamp = Get-Date -Format "yyyyMMdd-HHmmss"

function Write-Section {
    param([string]$Title)

    Write-Host ""
    Write-Host ("=" * 76)
    Write-Host $Title
    Write-Host ("=" * 76)
}

function Write-Ok {
    param([string]$Message)

    Write-Host "[OK] $Message" -ForegroundColor Green
}

function Write-Warn {
    param([string]$Message)

    Write-Host "[AVISO] $Message" -ForegroundColor Yellow
}

function Resolve-Executable {
    param(
        [string[]]$Candidates,
        [string]$Label
    )

    foreach ($Candidate in $Candidates) {
        $Resolved = Get-Command `
            $Candidate `
            -ErrorAction SilentlyContinue

        if ($Resolved) {
            return $Resolved.Source
        }
    }

    throw "$Label não foi encontrado."
}

function Invoke-Native {
    param(
        [string]$Command,
        [string[]]$Arguments,
        [AllowNull()]
        [string]$StdinValue = $null,
        [switch]$HasStdin
    )

    $PreviousPreference = $ErrorActionPreference
    $ErrorActionPreference = "Continue"
    $CommandOutput = @()
    $ExitCode = 1

    try {
        if ($HasStdin) {
            $CommandOutput = @(
                $StdinValue |
                    & $Command @Arguments 2>&1
            )
        }
        else {
            $CommandOutput = @(
                & $Command @Arguments 2>&1
            )
        }

        $ExitCode = $LASTEXITCODE
    }
    finally {
        $ErrorActionPreference = $PreviousPreference
    }

    foreach ($OutputLine in $CommandOutput) {
        Write-Host $OutputLine
    }

    return [pscustomobject]@{
        ExitCode = [int]$ExitCode
        Output = @($CommandOutput)
    }
}

function Set-VercelEnvironmentVariable {
    param(
        [string]$Name,
        [string]$Value,
        [switch]$Sensitive
    )

    if ([string]::IsNullOrWhiteSpace($Value)) {
        throw "O valor de $Name está vazio."
    }

    Write-Host ""
    Write-Host "Atualizando $Name..."

    $RemoveResult = Invoke-Native `
        -Command $Vercel `
        -Arguments @(
            "env",
            "rm",
            $Name,
            "production",
            "--yes"
        )

    if ($RemoveResult.ExitCode -ne 0) {
        Write-Warn "$Name não existia ou não pôde ser removida. Tentando criar."
    }

    $AddArguments = @(
        "env",
        "add",
        $Name,
        "production"
    )

    if ($Sensitive) {
        $AddArguments += "--sensitive"
    }

    $AddResult = Invoke-Native `
        -Command $Vercel `
        -Arguments $AddArguments `
        -StdinValue $Value `
        -HasStdin

    if ($AddResult.ExitCode -ne 0) {
        throw "Não foi possível salvar $Name na Vercel."
    }

    Write-Ok "ENV_UPDATED=$Name"
}

Write-Section "ORÇALY - ATUALIZAR MERCADO PAGO E PUBLICAR"

if (-not (Test-Path -LiteralPath $ProjectRoot)) {
    throw "Projeto não encontrado: $ProjectRoot"
}

Set-Location $ProjectRoot

$Git = Resolve-Executable `
    -Candidates @("git.exe", "git") `
    -Label "Git"

$Vercel = Resolve-Executable `
    -Candidates @("vercel.cmd", "vercel") `
    -Label "Vercel CLI"

$Cmd = Resolve-Executable `
    -Candidates @("cmd.exe", "cmd") `
    -Label "Prompt de Comando"

$ProjectFile = Join-Path `
    $ProjectRoot `
    ".vercel\project.json"

if (-not (Test-Path -LiteralPath $ProjectFile)) {
    throw "O projeto não está vinculado à Vercel. Execute vercel link primeiro."
}

$ProjectInfo = Get-Content `
    -LiteralPath $ProjectFile `
    -Raw |
    ConvertFrom-Json

if ($ProjectInfo.projectId -ne $ExpectedProjectId) {
    throw "Projeto Vercel incorreto: $($ProjectInfo.projectId)"
}

if ($ProjectInfo.orgId -ne $ExpectedOrgId) {
    throw "Equipe Vercel incorreta: $($ProjectInfo.orgId)"
}

Write-Ok "Projeto Vercel confirmado: Orçaly"

$HeadSha = (
    & $Git rev-parse HEAD
).Trim()

$ShortSha = (
    & $Git rev-parse --short HEAD
).Trim()

if (
    [string]::IsNullOrWhiteSpace($HeadSha) -or
    [string]::IsNullOrWhiteSpace($ShortSha)
) {
    throw "Não foi possível identificar o commit atual."
}

Write-Ok "Commit que será publicado: $ShortSha"

Write-Section "ATUALIZANDO REDIRECT URI"

Set-VercelEnvironmentVariable `
    -Name "MP_MARKETPLACE_REDIRECT_URI" `
    -Value $RedirectUri

Write-Section "CREDENCIAIS DA NOVA APLICAÇÃO"

$UpdateCredentials = (
    Read-Host "Atualizar Client ID, Client Secret e Public Key? [S/N]"
).Trim().ToUpperInvariant()

if ($UpdateCredentials -eq "S") {
    $ClientId = (
        Read-Host "Cole o Client ID da aplicação Marketplace"
    ).Trim()

    $SecureClientSecret = Read-Host `
        "Cole o Client Secret da aplicação Marketplace" `
        -AsSecureString

    $SecretPointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR(
        $SecureClientSecret
    )

    try {
        $ClientSecret = [Runtime.InteropServices.Marshal]::PtrToStringBSTR(
            $SecretPointer
        )
    }
    finally {
        [Runtime.InteropServices.Marshal]::ZeroFreeBSTR(
            $SecretPointer
        )
    }

    $PublicKey = (
        Read-Host "Cole a Public Key de produção da mesma aplicação"
    ).Trim()

    if (
        [string]::IsNullOrWhiteSpace($ClientId) -or
        [string]::IsNullOrWhiteSpace($ClientSecret) -or
        [string]::IsNullOrWhiteSpace($PublicKey)
    ) {
        throw "As três credenciais precisam ser informadas."
    }

    Set-VercelEnvironmentVariable `
        -Name "MP_MARKETPLACE_CLIENT_ID" `
        -Value $ClientId

    Set-VercelEnvironmentVariable `
        -Name "MP_MARKETPLACE_CLIENT_SECRET" `
        -Value $ClientSecret `
        -Sensitive

    Set-VercelEnvironmentVariable `
        -Name "NEXT_PUBLIC_MP_MARKETPLACE_PUBLIC_KEY" `
        -Value $PublicKey

    $ClientSecret = $null
    Write-Ok "CREDENCIAIS_MARKETPLACE_ATUALIZADAS=1"
}
elseif ($UpdateCredentials -eq "N") {
    Write-Warn "Credenciais mantidas. Apenas a Redirect URI foi atualizada."
}
else {
    throw "Responda somente S ou N."
}

Write-Section "PREPARANDO DEPLOY LIMPO DO COMMIT"

$TempRoot = Join-Path `
    $env:TEMP `
    "orcaly-deploy-$ShortSha-$Timestamp"

$ArchiveFile = "$TempRoot.zip"
$DeployFolder = "$TempRoot-files"

New-Item `
    -ItemType Directory `
    -Path $DeployFolder `
    -Force | Out-Null

try {
    $ArchiveResult = Invoke-Native `
        -Command $Git `
        -Arguments @(
            "archive",
            "--format=zip",
            "--output=$ArchiveFile",
            $HeadSha
        )

    if ($ArchiveResult.ExitCode -ne 0) {
        throw "Não foi possível criar o arquivo do commit."
    }

    Expand-Archive `
        -LiteralPath $ArchiveFile `
        -DestinationPath $DeployFolder `
        -Force

    Copy-Item `
        -LiteralPath (Join-Path $ProjectRoot ".vercel") `
        -Destination (Join-Path $DeployFolder ".vercel") `
        -Recurse `
        -Force

    Write-Ok "DEPLOY_SOURCE_COMMIT=$ShortSha"

    Write-Section "PUBLICANDO NA VERCEL"

    Push-Location $DeployFolder

    try {
        $DeployResult = Invoke-Native `
            -Command $Vercel `
            -Arguments @(
                "--prod",
                "--yes",
                "--force"
            )
    }
    finally {
        Pop-Location
    }

    if ($DeployResult.ExitCode -ne 0) {
        throw "O deploy da Vercel falhou."
    }

    Write-Ok "DEPLOY_CONCLUIDO=1"
    Write-Ok "PRODUCAO=https://orcaly.com.br"
}
finally {
    if (Test-Path -LiteralPath $ArchiveFile) {
        Remove-Item `
            -LiteralPath $ArchiveFile `
            -Force `
            -ErrorAction SilentlyContinue
    }

    if (Test-Path -LiteralPath $DeployFolder) {
        $CleanupCommand = (
            'rmdir /s /q "{0}"' -f
            $DeployFolder.Replace(
                '"',
                '""'
            )
        )

        & $Cmd `
            /d `
            /c `
            $CleanupCommand `
            | Out-Null
    }
}

Write-Section "CONCLUÍDO"

Write-Host "Redirect URI:"
Write-Host $RedirectUri
Write-Host ""
Write-Host "Commit publicado: $ShortSha"
Write-Host "Produção: https://orcaly.com.br"
Write-Host ""
Write-Host "Agora teste novamente a conexão do Mercado Pago em uma janela anônima."
