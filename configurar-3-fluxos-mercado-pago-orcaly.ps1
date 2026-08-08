param(
    [ValidateSet("production", "preview", "development", "all")]
    [string]$Environment = "all",

    [switch]$AuditOnly
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

function Write-Step {
    param([string]$Message)
    Write-Host ""
    Write-Host "==> $Message" -ForegroundColor Cyan
}

function Assert-Command {
    param([string]$Name)
    if (-not (Get-Command $Name -ErrorAction SilentlyContinue)) {
        throw "Comando obrigatório não encontrado: $Name"
    }
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

function Set-VercelEnv {
    param(
        [string]$Name,
        [string]$Value,
        [string]$Target,
        [switch]$Sensitive
    )

    if (-not $Value) {
        Write-Host "  [SKIP] $Name ($Target): vazio"
        return
    }

    & vercel env rm $Name $Target --yes 2>$null | Out-Null

    $temp = [System.IO.Path]::GetTempFileName()

    try {
        [System.IO.File]::WriteAllText(
            $temp,
            $Value,
            (New-Object System.Text.UTF8Encoding($false))
        )

        if ($Sensitive) {
            Get-Content -LiteralPath $temp -Raw |
                vercel env add $Name $Target --sensitive
        }
        else {
            Get-Content -LiteralPath $temp -Raw |
                vercel env add $Name $Target
        }

        if ($LASTEXITCODE -ne 0) {
            throw "Falha ao cadastrar $Name em $Target."
        }

        Write-Host "  [OK] $Name -> $Target" -ForegroundColor Green
    }
    finally {
        Remove-Item -LiteralPath $temp -Force -ErrorAction SilentlyContinue
    }
}

function Get-Targets {
    if ($Environment -eq "all") {
        return @("production", "preview", "development")
    }

    return @($Environment)
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

    $extensions = @(
        "*.ts", "*.tsx", "*.js", "*.mjs", "*.cjs",
        "*.json", "*.env*", "*.md"
    )

    $ignoreParts = @(
        "\node_modules\",
        "\.next\",
        "\.git\",
        "\.orcaly-backups\"
    )

    $results = @()

    foreach ($pattern in $extensions) {
        Get-ChildItem -Path . -Recurse -File -Filter $pattern -ErrorAction SilentlyContinue |
            ForEach-Object {
                $full = $_.FullName
                $skip = $false

                foreach ($ignore in $ignoreParts) {
                    if ($full.Contains($ignore)) {
                        $skip = $true
                        break
                    }
                }

                if ($skip) {
                    return
                }

                foreach ($name in $legacy) {
                    $matches = Select-String `
                        -LiteralPath $full `
                        -Pattern $name `
                        -SimpleMatch `
                        -ErrorAction SilentlyContinue

                    foreach ($match in $matches) {
                        $results += [PSCustomObject]@{
                            Variable = $name
                            File = Resolve-Path -Relative $full
                            Line = $match.LineNumber
                        }
                    }
                }
            }
    }

    return $results |
        Sort-Object Variable, File, Line -Unique
}

Assert-Command "vercel"
Assert-Command "git"

if (-not (Test-Path -LiteralPath ".git" -PathType Container)) {
    throw "Execute este PS1 na raiz do projeto grafica-flash."
}

Write-Step "Verificando vínculo com Vercel"

if (-not (Test-Path -LiteralPath ".vercel\project.json" -PathType Leaf)) {
    throw @"
O projeto local ainda não está vinculado à Vercel.
Execute primeiro:

vercel link

e rode este script novamente.
"@
}

$projectJson = Get-Content ".vercel\project.json" -Raw | ConvertFrom-Json
Write-Host "Project ID: $($projectJson.projectId)"
Write-Host "Org/Team ID: $($projectJson.orgId)"

if (-not $AuditOnly) {
    Write-Step "Credenciais do CADASTRO"

    Write-Host "Aplicação Mercado Pago usada SOMENTE no primeiro pagamento/cadastro."
    $signupPublicKey = Read-PlainRequired "NEXT_PUBLIC_MP_SIGNUP_PUBLIC_KEY"
    $signupAccessToken = Read-Secret "MP_SIGNUP_ACCESS_TOKEN"
    $signupWebhookSecret = Read-Secret "MP_SIGNUP_WEBHOOK_SECRET"

    Write-Step "Credenciais da ASSINATURA"

    Write-Host "Aplicação Mercado Pago usada SOMENTE em renovação/assinatura."
    $subscriptionPublicKey = Read-PlainRequired "NEXT_PUBLIC_MP_SUBSCRIPTION_PUBLIC_KEY"
    $subscriptionAccessToken = Read-Secret "MP_SUBSCRIPTION_ACCESS_TOKEN"
    $subscriptionWebhookSecret = Read-Secret "MP_SUBSCRIPTION_WEBHOOK_SECRET"

    Write-Step "Credenciais do MARKETPLACE"

    Write-Host ""
    Write-Host "IMPORTANTE:" -ForegroundColor Yellow
    Write-Host "O marketplace NÃO usa um Access Token fixo para cobrar clientes." -ForegroundColor Yellow
    Write-Host "Cada lojista usa o próprio token OAuth armazenado criptografado no banco." -ForegroundColor Yellow
    Write-Host "Aqui cadastramos somente as credenciais da aplicação Marketplace." -ForegroundColor Yellow
    Write-Host ""

    $marketplacePublicKey = Read-PlainRequired "NEXT_PUBLIC_MP_MARKETPLACE_PUBLIC_KEY"
    $marketplaceClientId = Read-PlainRequired "MP_MARKETPLACE_CLIENT_ID"
    $marketplaceClientSecret = Read-Secret "MP_MARKETPLACE_CLIENT_SECRET"
    $marketplaceWebhookSecret = Read-Secret "MP_MARKETPLACE_WEBHOOK_SECRET"
    $defaultRedirect = "https://orcaly.com.br/api/marketplace/payments/mercado-pago/callback"
    $marketplaceRedirect = (Read-Host "MP_MARKETPLACE_REDIRECT_URI [$defaultRedirect]").Trim()

    if (-not $marketplaceRedirect) {
        $marketplaceRedirect = $defaultRedirect
    }

    $targets = Get-Targets

    foreach ($target in $targets) {
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

Write-Step "Auditando referências antigas no código"

$legacyReferences = @(Find-LegacyReferences)

if ($legacyReferences.Count -eq 0) {
    Write-Host "Nenhuma referência às variáveis Mercado Pago antigas foi encontrada." -ForegroundColor Green
}
else {
    Write-Host ""
    Write-Host "Ainda existem referências legadas. NÃO remova essas variáveis da Vercel ainda." -ForegroundColor Yellow
    $legacyReferences | Format-Table -AutoSize
}

Write-Step "Arquitetura esperada"

@(
    [PSCustomObject]@{
        Fluxo = "Cadastro"
        Credencial = "MP_SIGNUP_ACCESS_TOKEN"
        Uso = "Pagamento inicial"
    },
    [PSCustomObject]@{
        Fluxo = "Assinatura"
        Credencial = "MP_SUBSCRIPTION_ACCESS_TOKEN"
        Uso = "Renovação/recorrência"
    },
    [PSCustomObject]@{
        Fluxo = "Marketplace"
        Credencial = "OAuth por lojista"
        Uso = "Venda + split"
    }
) | Format-Table -AutoSize

Write-Host ""
Write-Host "Configuração concluída." -ForegroundColor Green
Write-Host "Nenhuma variável legada foi removida automaticamente." -ForegroundColor Yellow
