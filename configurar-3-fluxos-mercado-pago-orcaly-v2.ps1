param(
    [ValidateSet("production", "preview", "development", "all")]
    [string]$Environment = "production",

    [switch]$AuditOnly
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

# Evita que stderr de programas nativos seja promovido a erro fatal
# em PowerShells que suportam essa configuração.
if (Get-Variable PSNativeCommandUseErrorActionPreference -ErrorAction SilentlyContinue) {
    $PSNativeCommandUseErrorActionPreference = $false
}

function Write-Step {
    param([string]$Message)
    Write-Host ""
    Write-Host "==> $Message" -ForegroundColor Cyan
}

function Resolve-VercelCmd {
    $candidates = @(
        (Join-Path $env:APPDATA "npm\vercel.cmd"),
        (Join-Path $env:LOCALAPPDATA "npm\vercel.cmd")
    )

    foreach ($candidate in $candidates) {
        if (Test-Path -LiteralPath $candidate -PathType Leaf) {
            return $candidate
        }
    }

    $command = Get-Command vercel.cmd -ErrorAction SilentlyContinue

    if ($command) {
        return $command.Source
    }

    throw "vercel.cmd não foi encontrado. Execute: npm install -g vercel"
}

function Invoke-Vercel {
    param(
        [Parameter(Mandatory = $true)]
        [string[]]$Arguments,

        [switch]$IgnoreFailure
    )

    $previousErrorAction = $ErrorActionPreference

    try {
        $ErrorActionPreference = "Continue"
        & $script:VercelCmd @Arguments
        $exitCode = $LASTEXITCODE
    }
    finally {
        $ErrorActionPreference = $previousErrorAction
    }

    if ($exitCode -ne 0 -and -not $IgnoreFailure) {
        throw "Vercel CLI falhou (exit code $exitCode): vercel $($Arguments -join ' ')"
    }

    return $exitCode
}

function Convert-SecureToPlain {
    param([Security.SecureString]$Secure)

    $ptr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($Secure)

    try {
        return [Runtime.InteropServices.Marshal]::PtrToStringBSTR($ptr)
    }
    finally {
        [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($ptr)
    }
}

function Read-Secret {
    param([string]$Label)

    while ($true) {
        $secure = Read-Host $Label -AsSecureString
        $plain = Convert-SecureToPlain $secure

        if ($plain) {
            return $plain.Trim()
        }

        Write-Host "Valor obrigatório." -ForegroundColor Yellow
    }
}

function Read-PlainRequired {
    param([string]$Label)

    while ($true) {
        $value = (Read-Host $Label).Trim()

        if ($value) {
            return $value
        }

        Write-Host "Valor obrigatório." -ForegroundColor Yellow
    }
}

function Get-Targets {
    if ($Environment -eq "all") {
        return @("production", "preview", "development")
    }

    return @($Environment)
}

function Set-VercelEnv {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Name,

        [Parameter(Mandatory = $true)]
        [string]$Value,

        [Parameter(Mandatory = $true)]
        [string]$Target,

        [switch]$Sensitive
    )

    if (-not $Value) {
        throw "$Name está vazio."
    }

    # Remove valor anterior no ambiente específico.
    # Ausência da variável é aceitável, por isso ignoramos falha aqui.
    Invoke-Vercel -Arguments @(
        "env", "rm", $Name, $Target, "--yes"
    ) -IgnoreFailure | Out-Null

    $previousErrorAction = $ErrorActionPreference

    try {
        $ErrorActionPreference = "Continue"

        if ($Sensitive) {
            $Value | & $script:VercelCmd env add $Name $Target --sensitive
        }
        else {
            $Value | & $script:VercelCmd env add $Name $Target
        }

        $exitCode = $LASTEXITCODE
    }
    finally {
        $ErrorActionPreference = $previousErrorAction
    }

    if ($exitCode -ne 0) {
        throw "Não foi possível configurar $Name em $Target (exit code $exitCode)."
    }

    Write-Host "  [OK] $Name -> $Target" -ForegroundColor Green
}

function Find-LegacyReferences {
    $legacy = @(
        "MERCADO_PAGO_PLATFORM_ACCESS_TOKEN",
        "MERCADO_PAGO_ACCESS_TOKEN",
        "MERCADO_PAGO_CLIENT_ID",
        "MERCADO_PAGO_CLIENT_SECRET",
        "MERCADO_PAGO_REDIRECT_URI",
        "MERCADO_PAGO_WEBHOOK_SECRET",
        "NEXT_PUBLIC_MERCADO_PAGO_PUBLIC_KEY",
        "MERCADO_PAGO_PUBLIC_KEY"
    )

    $files = Get-ChildItem -Path . -Recurse -File -ErrorAction SilentlyContinue |
        Where-Object {
            $_.FullName -notmatch "\\node_modules\\" -and
            $_.FullName -notmatch "\\\.next\\" -and
            $_.FullName -notmatch "\\\.git\\" -and
            $_.FullName -notmatch "\\\.orcaly-backups\\" -and
            $_.Extension -in @(
                ".ts", ".tsx", ".js", ".mjs", ".cjs", ".json", ".md"
            )
        }

    $results = @()

    foreach ($file in $files) {
        foreach ($name in $legacy) {
            $matches = Select-String `
                -LiteralPath $file.FullName `
                -Pattern $name `
                -SimpleMatch `
                -ErrorAction SilentlyContinue

            foreach ($match in $matches) {
                $results += [PSCustomObject]@{
                    Variable = $name
                    File = Resolve-Path -Relative $file.FullName
                    Line = $match.LineNumber
                }
            }
        }
    }

    return $results | Sort-Object Variable, File, Line -Unique
}

if (-not (Test-Path -LiteralPath ".git" -PathType Container)) {
    throw "Execute este PS1 na raiz do projeto grafica-flash."
}

$script:VercelCmd = Resolve-VercelCmd

Write-Step "Verificando Vercel CLI"
Write-Host "Executável: $script:VercelCmd"

Invoke-Vercel -Arguments @("--version") | Out-Null

Write-Step "Verificando vínculo com Vercel"

if (-not (Test-Path -LiteralPath ".vercel\project.json" -PathType Leaf)) {
    throw "Projeto não vinculado. Execute 'vercel link' primeiro."
}

$projectJson = Get-Content ".vercel\project.json" -Raw | ConvertFrom-Json
Write-Host "Project ID: $($projectJson.projectId)"
Write-Host "Org/Team ID: $($projectJson.orgId)"

if (-not $AuditOnly) {
    Write-Step "Credenciais do CADASTRO"
    Write-Host "Use as credenciais da aplicação Mercado Pago exclusiva do cadastro."

    $signupPublicKey = Read-PlainRequired "NEXT_PUBLIC_MP_SIGNUP_PUBLIC_KEY"
    $signupAccessToken = Read-Secret "MP_SIGNUP_ACCESS_TOKEN"
    $signupWebhookSecret = Read-Secret "MP_SIGNUP_WEBHOOK_SECRET"

    Write-Step "Credenciais da ASSINATURA"
    Write-Host "Use as credenciais da aplicação Mercado Pago exclusiva de assinaturas."

    $subscriptionPublicKey = Read-PlainRequired "NEXT_PUBLIC_MP_SUBSCRIPTION_PUBLIC_KEY"
    $subscriptionAccessToken = Read-Secret "MP_SUBSCRIPTION_ACCESS_TOKEN"
    $subscriptionWebhookSecret = Read-Secret "MP_SUBSCRIPTION_WEBHOOK_SECRET"

    Write-Step "Credenciais do MARKETPLACE"
    Write-Host "A aplicação Marketplace usa Client ID/Secret; cobranças usam OAuth do lojista." -ForegroundColor Yellow

    $marketplacePublicKey = Read-PlainRequired "NEXT_PUBLIC_MP_MARKETPLACE_PUBLIC_KEY"
    $marketplaceClientId = Read-PlainRequired "MP_MARKETPLACE_CLIENT_ID"
    $marketplaceClientSecret = Read-Secret "MP_MARKETPLACE_CLIENT_SECRET"
    $marketplaceWebhookSecret = Read-Secret "MP_MARKETPLACE_WEBHOOK_SECRET"

    $defaultRedirect = "https://orcaly.com.br/api/marketplace/payments/mercado-pago/callback"
    $marketplaceRedirect = (Read-Host "MP_MARKETPLACE_REDIRECT_URI [$defaultRedirect]").Trim()

    if (-not $marketplaceRedirect) {
        $marketplaceRedirect = $defaultRedirect
    }

    foreach ($target in (Get-Targets)) {
        Write-Step "Configurando ambiente $target"

        Set-VercelEnv "NEXT_PUBLIC_MP_SIGNUP_PUBLIC_KEY" $signupPublicKey $target
        Set-VercelEnv "MP_SIGNUP_ACCESS_TOKEN" $signupAccessToken $target -Sensitive
        Set-VercelEnv "MP_SIGNUP_WEBHOOK_SECRET" $signupWebhookSecret $target -Sensitive

        Set-VercelEnv "NEXT_PUBLIC_MP_SUBSCRIPTION_PUBLIC_KEY" $subscriptionPublicKey $target
        Set-VercelEnv "MP_SUBSCRIPTION_ACCESS_TOKEN" $subscriptionAccessToken $target -Sensitive
        Set-VercelEnv "MP_SUBSCRIPTION_WEBHOOK_SECRET" $subscriptionWebhookSecret $target -Sensitive

        Set-VercelEnv "NEXT_PUBLIC_MP_MARKETPLACE_PUBLIC_KEY" $marketplacePublicKey $target
        Set-VercelEnv "MP_MARKETPLACE_CLIENT_ID" $marketplaceClientId $target
        Set-VercelEnv "MP_MARKETPLACE_CLIENT_SECRET" $marketplaceClientSecret $target -Sensitive
        Set-VercelEnv "MP_MARKETPLACE_WEBHOOK_SECRET" $marketplaceWebhookSecret $target -Sensitive
        Set-VercelEnv "MP_MARKETPLACE_REDIRECT_URI" $marketplaceRedirect $target
    }

    $signupAccessToken = $null
    $signupWebhookSecret = $null
    $subscriptionAccessToken = $null
    $subscriptionWebhookSecret = $null
    $marketplaceClientSecret = $null
    $marketplaceWebhookSecret = $null

    [GC]::Collect()
}

Write-Step "Conferindo variáveis configuradas"
Invoke-Vercel -Arguments @("env", "ls", $Environment) | Out-Null

Write-Step "Auditando referências legadas"

$legacyReferences = @(Find-LegacyReferences)

if ($legacyReferences.Count -eq 0) {
    Write-Host "Nenhuma referência legada encontrada." -ForegroundColor Green
}
else {
    Write-Host "Ainda existem consumidores das variáveis antigas. Não remova as antigas ainda." -ForegroundColor Yellow
    $legacyReferences | Format-Table -AutoSize
}

Write-Host ""
Write-Host "Configuração dos 3 fluxos concluída." -ForegroundColor Green
