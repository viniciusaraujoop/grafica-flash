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

function Set-VercelEnv(
    [string]$Vercel,
    [string]$Name,
    [string]$Value,
    [bool]$Sensitive
) {
    $args = @("env", "add", $Name, "production", "--force")

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
        throw "Falha ao gravar $Name na Vercel.`n$stderr"
    }

    Write-Host "[OK] $Name configurada em Production" -ForegroundColor Green
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
    throw "Projeto não está vinculado à Vercel. Execute 'vercel link' primeiro."
}

$Vercel = Resolve-Cmd "vercel"

Step "Informe as credenciais do Asaas"
Write-Host "Os valores ficam ocultos e não serão impressos." -ForegroundColor DarkGray

$apiSecure = Read-Host "Cole a API Key da conta Asaas" -AsSecureString
$webhookSecure = Read-Host "Cole o token de autenticação do webhook Asaas" -AsSecureString

$apiKey = (SecureToPlain $apiSecure).Trim()
$webhookToken = (SecureToPlain $webhookSecure).Trim()

if ([string]::IsNullOrWhiteSpace($apiKey)) {
    throw "API Key vazia."
}

if ([string]::IsNullOrWhiteSpace($webhookToken)) {
    throw "Token do webhook vazio."
}

if ($apiKey.StartsWith('$aact_prod_')) {
    $environment = "production"
    $apiUrl = "https://api.asaas.com/v3"
}
elseif ($apiKey.StartsWith('$aact_hmlg_')) {
    $environment = "sandbox"
    $apiUrl = "https://api-sandbox.asaas.com/v3"
}
else {
    throw @"
A chave não possui um prefixo válido do Asaas.

Produção deve começar com:
`$aact_prod_

Sandbox deve começar com:
`$aact_hmlg_

Confira se o caractere `$ no início da chave foi copiado.
"@
}

Step "Ambiente detectado"
Write-Host "Ambiente da chave: $environment"
Write-Host "API utilizada: $apiUrl"

$headers = @{
    "access_token" = $apiKey
    "accept" = "application/json"
    "Content-Type" = "application/json"
    "User-Agent" = "Orcaly/1.0 (PowerShell; $environment)"
}

Step "Testando autenticação e recuperando walletId"

try {
    $walletResponse = Invoke-RestMethod `
        -Method Get `
        -Uri "$apiUrl/wallets/" `
        -Headers $headers `
        -ErrorAction Stop
}
catch {
    $body = Get-AsaasErrorBody $_.Exception

    Write-Host ""
    Write-Host "O Asaas recusou a autenticação." -ForegroundColor Red

    if ($body) {
        try {
            $parsed = $body | ConvertFrom-Json

            if ($parsed.errors) {
                foreach ($errorItem in @($parsed.errors)) {
                    Write-Host ("Código: " + [string]$errorItem.code) -ForegroundColor Yellow
                    Write-Host ("Descrição: " + [string]$errorItem.description) -ForegroundColor Yellow
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

    throw "Nenhuma variável foi gravada na Vercel."
}

$walletId = $null

if ($walletResponse.walletId) {
    $walletId = [string]$walletResponse.walletId
}
elseif ($walletResponse.id) {
    $walletId = [string]$walletResponse.id
}
elseif ($walletResponse.data) {
    $first = @($walletResponse.data)[0]

    if ($first.walletId) {
        $walletId = [string]$first.walletId
    }
    elseif ($first.id) {
        $walletId = [string]$first.id
    }
}

if ([string]::IsNullOrWhiteSpace($walletId)) {
    throw "Autenticação funcionou, mas o walletId não foi encontrado. Nenhuma variável foi gravada."
}

Write-Host "[OK] API Key aceita pelo Asaas" -ForegroundColor Green
Write-Host "[OK] walletId encontrado: $walletId" -ForegroundColor Green

if ($environment -ne "production") {
    Write-Host ""
    Write-Host "A chave é de SANDBOX." -ForegroundColor Yellow
    Write-Host "Ela foi validada, mas NÃO será gravada como credencial Production da Vercel." -ForegroundColor Yellow
    Write-Host "Gere uma API Key na conta real do Asaas que comece com `$aact_prod_." -ForegroundColor Yellow
    exit 2
}

Step "Gravando variáveis na Vercel Production"

Set-VercelEnv $Vercel "ASAAS_MARKETPLACE_ACCESS_TOKEN" $apiKey $true
Set-VercelEnv $Vercel "ASAAS_MARKETPLACE_WEBHOOK_TOKEN" $webhookToken $true
Set-VercelEnv $Vercel "ASAAS_MARKETPLACE_WALLET_ID" $walletId $true
Set-VercelEnv $Vercel "ASAAS_MARKETPLACE_API_URL" $apiUrl $false

Step "Conferindo nomes das variáveis"
& $Vercel env ls production

$apiKey = $null
$webhookToken = $null
[GC]::Collect()

Write-Host ""
Write-Host "ASAAS_MARKETPLACE_CONFIG_OK=1" -ForegroundColor Green
Write-Host "Conta Asaas de produção configurada na Vercel." -ForegroundColor Green
