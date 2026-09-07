param()

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

Set-Location -LiteralPath "C:\Users\arauj\grafica-flash"

function Step([string]$Message) {
    Write-Host ""
    Write-Host "==> $Message" -ForegroundColor Cyan
}

function Resolve-Cmd([string]$Name) {
    foreach ($candidate in @("$Name.cmd", $Name)) {
        $cmd = Get-Command $candidate -ErrorAction SilentlyContinue
        if ($cmd) { return $cmd.Source }
    }
    throw "Comando não encontrado: $Name"
}

function SecureToPlain([Security.SecureString]$Secure) {
    $ptr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($Secure)
    try {
        return [Runtime.InteropServices.Marshal]::PtrToStringBSTR($ptr)
    }
    finally {
        [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($ptr)
    }
}

function Has-Property($Object, [string]$Name) {
    if ($null -eq $Object) { return $false }
    return $null -ne $Object.PSObject.Properties[$Name]
}

function Property-Value($Object, [string]$Name) {
    if (Has-Property $Object $Name) {
        return $Object.PSObject.Properties[$Name].Value
    }
    return $null
}

function Find-WalletId($Object) {
    if ($null -eq $Object) { return $null }

    foreach ($name in @("walletId", "wallet_id", "id")) {
        $value = Property-Value $Object $name
        if ($null -ne $value -and -not [string]::IsNullOrWhiteSpace([string]$value)) {
            return [string]$value
        }
    }

    foreach ($containerName in @("data", "wallet", "wallets")) {
        $container = Property-Value $Object $containerName

        if ($null -eq $container) { continue }

        foreach ($item in @($container)) {
            $found = Find-WalletId $item
            if ($found) { return $found }
        }
    }

    return $null
}

function Set-VercelEnv(
    [string]$Vercel,
    [string]$Name,
    [string]$Value,
    [string]$Environment,
    [bool]$Sensitive
) {
    $args = @("env", "add", $Name, $Environment, "--force")

    if ($Sensitive) {
        $args += "--sensitive"
    }

    $psi = New-Object System.Diagnostics.ProcessStartInfo
    $psi.FileName = $Vercel
    $psi.UseShellExecute = $false
    $psi.RedirectStandardInput = $true
    $psi.RedirectStandardOutput = $true
    $psi.RedirectStandardError = $true

    foreach ($arg in $args) {
        [void]$psi.ArgumentList.Add($arg)
    }

    $process = New-Object System.Diagnostics.Process
    $process.StartInfo = $psi

    [void]$process.Start()
    $process.StandardInput.Write($Value)
    $process.StandardInput.Close()

    $stdout = $process.StandardOutput.ReadToEnd()
    $stderr = $process.StandardError.ReadToEnd()
    $process.WaitForExit()

    if ($process.ExitCode -ne 0) {
        throw "Falha ao gravar $Name na Vercel ($Environment).`n$stderr"
    }

    Write-Host "[OK] $Name -> $Environment" -ForegroundColor Green
}

function Get-AsaasErrorBody($Exception) {
    try {
        if ($Exception.Response) {
            $response = $Exception.Response

            if ($response.Content) {
                return $response.Content.ReadAsStringAsync().GetAwaiter().GetResult()
            }

            $stream = $response.GetResponseStream()
            if ($stream) {
                $reader = New-Object System.IO.StreamReader($stream)
                try {
                    return $reader.ReadToEnd()
                }
                finally {
                    $reader.Dispose()
                }
            }
        }
    }
    catch {}

    return ""
}

if (-not (Test-Path -LiteralPath ".vercel\project.json")) {
    throw "Projeto não está vinculado à Vercel."
}

$Vercel = Resolve-Cmd "vercel"

Step "Informe as credenciais do Asaas"
Write-Host "Os valores ficam ocultos e não serão impressos." -ForegroundColor DarkGray

$apiSecure = Read-Host "Cole a API Key do Asaas" -AsSecureString
$webhookSecure = Read-Host "Cole o token do webhook Asaas" -AsSecureString

$apiKey = (SecureToPlain $apiSecure).Trim()
$webhookToken = (SecureToPlain $webhookSecure).Trim()

if ([string]::IsNullOrWhiteSpace($apiKey)) {
    throw "API Key vazia."
}
if ([string]::IsNullOrWhiteSpace($webhookToken)) {
    throw "Token do webhook vazio."
}

if ($apiKey.StartsWith('$aact_prod_')) {
    $asaasEnvironment = "production"
    $apiUrl = "https://api.asaas.com/v3"
    $vercelEnvironment = "production"
    $prefix = "ASAAS_MARKETPLACE"
}
elseif ($apiKey.StartsWith('$aact_hmlg_')) {
    $asaasEnvironment = "sandbox"
    $apiUrl = "https://api-sandbox.asaas.com/v3"
    $vercelEnvironment = "preview"
    $prefix = "ASAAS_SANDBOX"
}
else {
    throw @"
Prefixo da API Key não reconhecido.

Produção:
`$aact_prod_...

Sandbox:
`$aact_hmlg_...
"@
}

Step "Ambiente detectado"
Write-Host "Asaas: $asaasEnvironment"
Write-Host "URL: $apiUrl"
Write-Host "Vercel: $vercelEnvironment"

$headers = @{
    "access_token" = $apiKey
    "accept" = "application/json"
    "Content-Type" = "application/json"
    "User-Agent" = "Orcaly/1.0 (PowerShell; $asaasEnvironment)"
}

Step "Validando chave e consultando walletId"

try {
    $walletResponse = Invoke-RestMethod `
        -Method Get `
        -Uri "$apiUrl/wallets/" `
        -Headers $headers `
        -ErrorAction Stop
}
catch {
    $body = Get-AsaasErrorBody $_.Exception

    Write-Host "Falha na API do Asaas." -ForegroundColor Red

    if ($body) {
        try {
            $parsed = $body | ConvertFrom-Json
            $errors = Property-Value $parsed "errors"

            if ($errors) {
                foreach ($item in @($errors)) {
                    $code = Property-Value $item "code"
                    $description = Property-Value $item "description"
                    Write-Host "Código: $code" -ForegroundColor Yellow
                    Write-Host "Descrição: $description" -ForegroundColor Yellow
                }
            }
            else {
                Write-Host $body -ForegroundColor Yellow
            }
        }
        catch {
            Write-Host $body -ForegroundColor Yellow
        }
    }
    else {
        Write-Host $_.Exception.Message -ForegroundColor Yellow
    }

    throw "Nenhuma variável foi gravada."
}

$walletId = Find-WalletId $walletResponse

if ([string]::IsNullOrWhiteSpace($walletId)) {
    Write-Host ""
    Write-Host "A autenticação FUNCIONOU, mas a resposta não trouxe um walletId reconhecível." -ForegroundColor Yellow
    Write-Host "Estrutura recebida (sem exibir sua API Key):" -ForegroundColor Yellow
    $walletResponse | ConvertTo-Json -Depth 8
    throw "Envie apenas essa estrutura JSON, sem nenhuma credencial."
}

Write-Host "[OK] API Key aceita pelo Asaas" -ForegroundColor Green
Write-Host "[OK] walletId: $walletId" -ForegroundColor Green

Step "Gravando configuração segura na Vercel"

if ($asaasEnvironment -eq "production") {
    Set-VercelEnv $Vercel "ASAAS_MARKETPLACE_ACCESS_TOKEN" $apiKey "production" $true
    Set-VercelEnv $Vercel "ASAAS_MARKETPLACE_WEBHOOK_TOKEN" $webhookToken "production" $true
    Set-VercelEnv $Vercel "ASAAS_MARKETPLACE_WALLET_ID" $walletId "production" $true
    Set-VercelEnv $Vercel "ASAAS_MARKETPLACE_API_URL" $apiUrl "production" $false

    Write-Host ""
    Write-Host "ASAAS_PRODUCTION_CONFIG_OK=1" -ForegroundColor Green
}
else {
    Set-VercelEnv $Vercel "ASAAS_SANDBOX_ACCESS_TOKEN" $apiKey "preview" $true
    Set-VercelEnv $Vercel "ASAAS_SANDBOX_WEBHOOK_TOKEN" $webhookToken "preview" $true
    Set-VercelEnv $Vercel "ASAAS_SANDBOX_WALLET_ID" $walletId "preview" $true
    Set-VercelEnv $Vercel "ASAAS_SANDBOX_API_URL" $apiUrl "preview" $false

    Write-Host ""
    Write-Host "ASAAS_SANDBOX_CONFIG_OK=1" -ForegroundColor Green
    Write-Host "Sandbox salvo apenas em Preview. Produção permaneceu intocada." -ForegroundColor Yellow
}

$apiKey = $null
$webhookToken = $null
[GC]::Collect()
