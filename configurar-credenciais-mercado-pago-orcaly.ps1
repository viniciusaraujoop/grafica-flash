param(
  [switch]$SkipBuild
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$Root = (Get-Location).Path
$EnvPath = Join-Path $Root ".env.local"
$Stamp = Get-Date -Format "yyyyMMdd-HHmmss"
$BackupPath = Join-Path $Root ".orcaly-backups\env-mercado-pago-$Stamp\.env.local"
$Utf8 = New-Object System.Text.UTF8Encoding($false)

function Read-Secret([string]$Prompt, [switch]$AllowEmpty) {
  while ($true) {
    $Secure = Read-Host $Prompt -AsSecureString
    $Bstr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($Secure)

    try {
      $Value = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($Bstr)
    } finally {
      [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($Bstr)
    }

    if ($AllowEmpty -or -not [string]::IsNullOrWhiteSpace($Value)) {
      return $Value.Trim()
    }

    Write-Host "O valor nao pode ficar vazio." -ForegroundColor Yellow
  }
}

function Read-Required([string]$Prompt, [string]$DefaultValue = "") {
  while ($true) {
    $Suffix = if ($DefaultValue) { " [$DefaultValue]" } else { "" }
    $Value = Read-Host "$Prompt$Suffix"

    if ([string]::IsNullOrWhiteSpace($Value) -and $DefaultValue) {
      return $DefaultValue
    }

    if (-not [string]::IsNullOrWhiteSpace($Value)) {
      return $Value.Trim()
    }

    Write-Host "O valor nao pode ficar vazio." -ForegroundColor Yellow
  }
}

function Set-EnvValue(
  [System.Collections.Generic.List[string]]$Lines,
  [string]$Name,
  [string]$Value
) {
  $Found = $false

  for ($Index = 0; $Index -lt $Lines.Count; $Index++) {
    if ($Lines[$Index] -match "^\s*$([regex]::Escape($Name))\s*=") {
      $Lines[$Index] = "$Name=$Value"
      $Found = $true
      break
    }
  }

  if (-not $Found) {
    $Lines.Add("$Name=$Value")
  }
}

function Has-EnvValue(
  [System.Collections.Generic.List[string]]$Lines,
  [string]$Name
) {
  foreach ($Line in $Lines) {
    if ($Line -match "^\s*$([regex]::Escape($Name))\s*=(.*)$") {
      return -not [string]::IsNullOrWhiteSpace($Matches[1])
    }
  }

  return $false
}

if (-not (Test-Path -LiteralPath (Join-Path $Root "package.json"))) {
  throw "Execute este script na raiz do projeto Orcaly."
}

if (-not (Test-Path -LiteralPath $EnvPath)) {
  throw "Arquivo .env.local nao encontrado."
}

New-Item -ItemType Directory -Force -Path (Split-Path $BackupPath -Parent) | Out-Null
Copy-Item -LiteralPath $EnvPath -Destination $BackupPath -Force

$Original = [IO.File]::ReadAllText($EnvPath).Replace("`r`n", "`n")
$Lines = New-Object "System.Collections.Generic.List[string]"

foreach ($Line in ($Original -split "`n")) {
  $Lines.Add($Line)
}

Write-Host ""
Write-Host "==================================================" -ForegroundColor Cyan
Write-Host "ORCALY - CREDENCIAIS MERCADO PAGO" -ForegroundColor Cyan
Write-Host "==================================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Os segredos digitados nao serao exibidos na tela." -ForegroundColor Green
Write-Host "Use todas as credenciais da MESMA aplicacao Mercado Pago." -ForegroundColor Yellow
Write-Host ""

$ClientId = Read-Required "Client ID"
$ClientSecret = Read-Secret "Client Secret"
$PlatformAccessToken = Read-Secret "Access Token da conta principal do Orcaly"
$PublicKey = Read-Required "Public Key"

$DefaultRedirect =
  "https://orcaly.com.br/api/marketplace/payments/mercado-pago/callback"

$RedirectUri = Read-Required `
  "URL de redirecionamento OAuth" `
  $DefaultRedirect

Write-Host ""
Write-Host "A assinatura secreta do webhook pode ficar vazia apenas durante o desenvolvimento." -ForegroundColor Yellow
Write-Host "Antes da producao, ela deve ser configurada obrigatoriamente." -ForegroundColor Yellow
$WebhookSecret = Read-Secret `
  "Assinatura secreta do Webhook (Enter para deixar vazia agora)" `
  -AllowEmpty

Set-EnvValue $Lines "MERCADO_PAGO_CLIENT_ID" $ClientId
Set-EnvValue $Lines "MERCADO_PAGO_CLIENT_SECRET" $ClientSecret
Set-EnvValue $Lines "MERCADO_PAGO_PLATFORM_ACCESS_TOKEN" $PlatformAccessToken
Set-EnvValue $Lines "MERCADO_PAGO_ACCESS_TOKEN" $PlatformAccessToken
Set-EnvValue $Lines "MERCADO_PAGO_PUBLIC_KEY" $PublicKey
Set-EnvValue $Lines "NEXT_PUBLIC_MERCADO_PAGO_PUBLIC_KEY" $PublicKey
Set-EnvValue $Lines "MERCADO_PAGO_REDIRECT_URI" $RedirectUri
Set-EnvValue $Lines "MERCADO_PAGO_WEBHOOK_SECRET" $WebhookSecret

if (-not (Has-EnvValue $Lines "PAYMENT_CREDENTIALS_ENCRYPTION_KEY")) {
  $Bytes = New-Object byte[] 32
  [Security.Cryptography.RandomNumberGenerator]::Fill($Bytes)
  $GeneratedKey = [Convert]::ToBase64String($Bytes)
  Set-EnvValue $Lines "PAYMENT_CREDENTIALS_ENCRYPTION_KEY" $GeneratedKey
  Write-Host "[CRIADA] PAYMENT_CREDENTIALS_ENCRYPTION_KEY" -ForegroundColor Green
}

if (-not (Has-EnvValue $Lines "NEXT_PUBLIC_APP_URL")) {
  Set-EnvValue $Lines "NEXT_PUBLIC_APP_URL" "https://orcaly.com.br"
}

$CleanLines = New-Object "System.Collections.Generic.List[string]"
$PreviousBlank = $false

foreach ($Line in $Lines) {
  $IsBlank = [string]::IsNullOrWhiteSpace($Line)

  if ($IsBlank -and $PreviousBlank) {
    continue
  }

  $CleanLines.Add($Line)
  $PreviousBlank = $IsBlank
}

[IO.File]::WriteAllText(
  $EnvPath,
  (($CleanLines -join "`n").TrimEnd() + "`n"),
  $Utf8
)

Write-Host ""
Write-Host "[OK] .env.local atualizado" -ForegroundColor Green
Write-Host "Backup: $BackupPath" -ForegroundColor DarkGray

$CheckPath = Join-Path $Root ".orcaly-check-mp-$Stamp.cjs"

$CheckCode = @'
const { loadEnvConfig } = require("@next/env");

loadEnvConfig(process.cwd(), true);

const names = [
  "MERCADO_PAGO_CLIENT_ID",
  "MERCADO_PAGO_CLIENT_SECRET",
  "MERCADO_PAGO_PLATFORM_ACCESS_TOKEN",
  "MERCADO_PAGO_ACCESS_TOKEN",
  "MERCADO_PAGO_PUBLIC_KEY",
  "NEXT_PUBLIC_MERCADO_PAGO_PUBLIC_KEY",
  "MERCADO_PAGO_REDIRECT_URI",
  "MERCADO_PAGO_WEBHOOK_SECRET",
  "PAYMENT_CREDENTIALS_ENCRYPTION_KEY",
  "NEXT_PUBLIC_APP_URL",
];

console.table(
  names.map((name) => {
    const value = String(process.env[name] || "").trim();

    return {
      variavel: name,
      configurada: Boolean(value),
      tamanho: value.length,
    };
  }),
);
'@

[IO.File]::WriteAllText($CheckPath, $CheckCode, $Utf8)

try {
  Write-Host ""
  Write-Host "==> Conferindo configuracao sem exibir valores" -ForegroundColor Cyan
  & node $CheckPath

  if ($LASTEXITCODE -ne 0) {
    throw "A conferencia das variaveis falhou."
  }
} finally {
  Remove-Item -LiteralPath $CheckPath -Force -ErrorAction SilentlyContinue
}

if (-not $SkipBuild) {
  Write-Host ""
  Write-Host "==> Executando build" -ForegroundColor Cyan

  & npm.cmd run build
  $Code = $LASTEXITCODE

  Write-Host "BUILD_EXIT_CODE=$Code"

  if ($Code -ne 0) {
    Write-Host "O build falhou. As credenciais foram preservadas no .env.local." -ForegroundColor Red
    exit $Code
  }
}

Write-Host ""
Write-Host "==================================================" -ForegroundColor Magenta
Write-Host "CREDENCIAIS CONFIGURADAS" -ForegroundColor Magenta
Write-Host "==================================================" -ForegroundColor Magenta
Write-Host "Reinicie o servidor local antes de testar."
