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

if (-not (Test-Path -LiteralPath ".vercel\project.json")) {
    throw "Projeto não está vinculado à Vercel. Execute 'vercel link' primeiro."
}

$Vercel = Resolve-Cmd "vercel"

Step "Informe as credenciais do Asaas"
Write-Host "Os valores ficam ocultos e não serão impressos." -ForegroundColor DarkGray

$apiSecure = Read-Host "Cole a API Key da conta PJ Asaas" -AsSecureString
$webhookSecure = Read-Host "Cole o token de autenticação do webhook Asaas" -AsSecureString

$apiKey = SecureToPlain $apiSecure
$webhookToken = SecureToPlain $webhookSecure

if ([string]::IsNullOrWhiteSpace($apiKey)) {
    throw "API Key vazia."
}

if ([string]::IsNullOrWhiteSpace($webhookToken)) {
    throw "Token do webhook vazio."
}

Step "Validando API Key e recuperando walletId da conta Orçaly"

$headers = @{
    "access_token" = $apiKey.Trim()
    "accept" = "application/json"
    "User-Agent" = "Orcaly/1.0"
}

try {
    $walletResponse = Invoke-RestMethod `
        -Method Get `
        -Uri "https://api.asaas.com/v3/wallets/" `
        -Headers $headers `
        -ErrorAction Stop
}
catch {
    throw "A API Key do Asaas não foi aceita ou a conta não permite consultar a carteira. $($_.Exception.Message)"
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
    throw "O Asaas respondeu, mas não consegui identificar o walletId. Nenhuma variável foi gravada."
}

Write-Host "[OK] Conta Asaas autenticada" -ForegroundColor Green
Write-Host "[OK] walletId encontrado: $walletId" -ForegroundColor Green

Step "Gravando variáveis na Vercel Production"

Set-VercelEnv $Vercel "ASAAS_MARKETPLACE_ACCESS_TOKEN" $apiKey $true
Set-VercelEnv $Vercel "ASAAS_MARKETPLACE_WEBHOOK_TOKEN" $webhookToken $true
Set-VercelEnv $Vercel "ASAAS_MARKETPLACE_WALLET_ID" $walletId $true
Set-VercelEnv $Vercel "ASAAS_MARKETPLACE_API_URL" "https://api.asaas.com/v3" $false

Step "Conferindo nomes das variáveis"
& $Vercel env ls production

$apiKey = $null
$webhookToken = $null
[GC]::Collect()

Write-Host ""
Write-Host "Configuração concluída." -ForegroundColor Green
Write-Host "A conta principal do Asaas está pronta para receber a comissão do Orçaly." -ForegroundColor Green
Write-Host "Próxima etapa: implementar subcontas, cobrança PIX e split no marketplace." -ForegroundColor Cyan
