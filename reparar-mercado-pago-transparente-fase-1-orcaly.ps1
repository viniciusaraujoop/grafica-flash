param(
  [switch]$SkipBuild
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$Root = (Get-Location).Path
$Stamp = Get-Date -Format "yyyyMMdd-HHmmss"
$Backup = Join-Path $Root ".orcaly-backups\reparo-mercado-pago-fase1-$Stamp"
$Utf8 = New-Object System.Text.UTF8Encoding($false)

function Full([string]$Path) {
  Join-Path $Root ($Path -replace "/", "\")
}

function Read-Text([string]$Path) {
  $Target = Full $Path

  if (-not (Test-Path -LiteralPath $Target)) {
    throw "Arquivo nao encontrado: $Path"
  }

  [IO.File]::ReadAllText($Target).Replace("`r`n", "`n")
}

function Save-Text([string]$Path, [string]$Text) {
  $Target = Full $Path
  $Copy = Join-Path $Backup ($Path -replace "/", "\")

  New-Item -ItemType Directory -Force -Path (Split-Path $Copy -Parent) | Out-Null
  Copy-Item -LiteralPath $Target -Destination $Copy -Force

  [IO.File]::WriteAllText(
    $Target,
    $Text.TrimEnd("`r", "`n") + "`n",
    $Utf8
  )

  Write-Host "[OK] $Path" -ForegroundColor Green
}

function Replace-Required(
  [string]$Text,
  [string]$Old,
  [string]$New,
  [string]$Label
) {
  if ($Text.Contains($New)) {
    Write-Host "[JA APLICADO] $Label" -ForegroundColor DarkGreen
    return $Text
  }

  if (-not $Text.Contains($Old)) {
    throw "Trecho nao localizado: $Label"
  }

  return $Text.Replace($Old, $New)
}

if (-not (Test-Path -LiteralPath (Join-Path $Root "package.json"))) {
  throw "Execute este script na raiz do projeto Orcaly."
}

New-Item -ItemType Directory -Force -Path $Backup | Out-Null

Write-Host ""
Write-Host "==================================================" -ForegroundColor Cyan
Write-Host "ORCALY - REPARO MERCADO PAGO FASE 1" -ForegroundColor Cyan
Write-Host "==================================================" -ForegroundColor Cyan

$WebhookPath =
  "app/api/marketplace/payments/webhook/mercado-pago/route.ts"

$Webhook = Read-Text $WebhookPath

$Webhook = Replace-Required $Webhook @'
import { getMercadoPagoPayment, mapMercadoPagoStatus, verifyMercadoPagoWebhookSignature } from '@/lib/mercado-pago'
'@ @'
import {
  getMercadoPagoPayment,
  mapMercadoPagoStatus,
  unprotectMercadoPagoToken,
  verifyMercadoPagoWebhookSignature,
} from '@/lib/mercado-pago'
'@ "import da descriptografia"

$Webhook = Replace-Required $Webhook @'
    const mpPayment = await getMercadoPagoPayment(setting.access_token, paymentId)
'@ @'
    const mpPayment: any = await getMercadoPagoPayment(
      unprotectMercadoPagoToken(setting.access_token),
      paymentId,
    )
'@ "token criptografado no webhook"

$Webhook = Replace-Required $Webhook @'
    const mappedStatus = mapMercadoPagoStatus(mpPayment.status)
'@ @'
    const mappedStatus = mapMercadoPagoStatus(
      String(mpPayment.status || ''),
    )
'@ "tipagem do status"

$Webhook = Replace-Required $Webhook @'
        provider_status: mpPayment.status || null,
'@ @'
        provider_status: String(mpPayment.status || '') || null,
'@ "status salvo como texto"

Save-Text $WebhookPath $Webhook

Write-Host ""
Write-Host "==> Verificando variaveis do .env.local sem exibir segredos" -ForegroundColor Cyan

$EnvCheckPath = Join-Path $Root ".orcaly-env-check-$Stamp.cjs"

$EnvCheck = @'
const { loadEnvConfig } = require("@next/env");

loadEnvConfig(process.cwd(), true);

const names = [
  "MERCADO_PAGO_CLIENT_ID",
  "MERCADO_PAGO_CLIENT_SECRET",
  "MERCADO_PAGO_PLATFORM_ACCESS_TOKEN",
  "NEXT_PUBLIC_MERCADO_PAGO_PUBLIC_KEY",
  "MERCADO_PAGO_REDIRECT_URI",
  "MERCADO_PAGO_WEBHOOK_SECRET",
  "PAYMENT_CREDENTIALS_ENCRYPTION_KEY",
  "NEXT_PUBLIC_APP_URL",
  "NEXT_PUBLIC_SUPABASE_URL",
  "SUPABASE_SERVICE_ROLE_KEY",
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

[IO.File]::WriteAllText($EnvCheckPath, $EnvCheck, $Utf8)

try {
  & node $EnvCheckPath
  $EnvCode = $LASTEXITCODE

  if ($EnvCode -ne 0) {
    throw "O diagnostico de ambiente falhou com codigo $EnvCode."
  }
} finally {
  Remove-Item -LiteralPath $EnvCheckPath -Force -ErrorAction SilentlyContinue
}

if (-not $SkipBuild) {
  Write-Host ""
  Write-Host "==> Executando build" -ForegroundColor Cyan

  & npm.cmd run build
  $Code = $LASTEXITCODE

  Write-Host "BUILD_EXIT_CODE=$Code"

  if ($Code -ne 0) {
    Write-Host ""
    Write-Host "O build ainda falhou." -ForegroundColor Red
    Write-Host "Backup: $Backup" -ForegroundColor Yellow
    exit $Code
  }
}

Write-Host ""
Write-Host "==================================================" -ForegroundColor Magenta
Write-Host "REPARO DA FASE 1 CONCLUIDO" -ForegroundColor Magenta
Write-Host "==================================================" -ForegroundColor Magenta
Write-Host "Webhook: tipagem corrigida"
Write-Host "Webhook: token OAuth descriptografado no servidor"
Write-Host "Diagnostico .env.local: corrigido"
Write-Host "Backup: $Backup"
