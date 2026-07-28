param(
  [switch]$SkipBuild
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$Root = (Get-Location).Path
$Target = Join-Path $Root "lib\signup-checkout.ts"
$Stamp = Get-Date -Format "yyyyMMdd-HHmmss"
$Backup = Join-Path $Root ".orcaly-backups\corrigir-notification-url-$Stamp\signup-checkout.ts"
$Utf8 = New-Object System.Text.UTF8Encoding($false)

if (-not (Test-Path -LiteralPath (Join-Path $Root "package.json"))) {
  throw "Execute este script na raiz do projeto Orcaly."
}

if (-not (Test-Path -LiteralPath $Target)) {
  throw "Arquivo nao encontrado: lib/signup-checkout.ts"
}

New-Item -ItemType Directory -Force -Path (Split-Path $Backup -Parent) | Out-Null
Copy-Item -LiteralPath $Target -Destination $Backup -Force

$Content = [IO.File]::ReadAllText($Target).Replace("`r`n", "`n")

$Old = @'
function appUrl() {
  const value = text(
    process.env.NEXT_PUBLIC_APP_URL ||
      process.env.ORCALY_APP_URL ||
      process.env.NEXT_PUBLIC_SITE_URL ||
      "https://orcaly.com.br",
  ).replace(/\/$/, "");

  return value || "https://orcaly.com.br";
}
'@

$New = @'
function appUrl() {
  const candidates = [
    process.env.ORCALY_APP_URL,
    process.env.NEXT_PUBLIC_SITE_URL,
    process.env.NEXT_PUBLIC_APP_URL,
    "https://orcaly.com.br",
  ];

  for (const candidate of candidates) {
    const value = text(candidate).replace(/\/$/, "");

    if (!value) continue;

    try {
      const url = new URL(value);
      const localHost = [
        "localhost",
        "127.0.0.1",
        "::1",
      ].includes(url.hostname);

      if (url.protocol === "https:" && !localHost) {
        return url.origin;
      }
    } catch {
      // Ignora valores malformados e tenta a proxima URL publica.
    }
  }

  return "https://orcaly.com.br";
}
'@

if ($Content.Contains($New)) {
  Write-Host "[JA APLICADO] URL publica do webhook ja esta protegida." -ForegroundColor DarkGreen
} elseif ($Content.Contains($Old)) {
  $Content = $Content.Replace($Old, $New)

  [IO.File]::WriteAllText(
    $Target,
    $Content.TrimEnd() + "`n",
    $Utf8
  )

  Write-Host "[OK] localhost removido da notification_url" -ForegroundColor Green
  Write-Host "[OK] URL HTTPS publica priorizada para o Mercado Pago" -ForegroundColor Green
} else {
  throw "Nao foi possivel localizar a funcao appUrl esperada. Nenhuma alteracao foi feita."
}

Write-Host ""
Write-Host "==> Conferindo URL publica sem mostrar credenciais" -ForegroundColor Cyan

$CheckPath = Join-Path $Root ".orcaly-check-url-$Stamp.cjs"
$CheckCode = @'
const { loadEnvConfig } = require("@next/env");

loadEnvConfig(process.cwd(), true);

const candidates = [
  process.env.ORCALY_APP_URL,
  process.env.NEXT_PUBLIC_SITE_URL,
  process.env.NEXT_PUBLIC_APP_URL,
  "https://orcaly.com.br",
];

let selected = "https://orcaly.com.br";

for (const candidate of candidates) {
  const value = String(candidate || "").trim().replace(/\/$/, "");

  if (!value) continue;

  try {
    const url = new URL(value);
    const local = ["localhost", "127.0.0.1", "::1"].includes(url.hostname);

    if (url.protocol === "https:" && !local) {
      selected = url.origin;
      break;
    }
  } catch {}
}

console.log("NOTIFICATION_URL=" + selected + "/api/mercado-pago/webhook-leads");
'@

[IO.File]::WriteAllText($CheckPath, $CheckCode, $Utf8)

try {
  & node $CheckPath

  if ($LASTEXITCODE -ne 0) {
    throw "Nao foi possivel conferir a URL publica."
  }
} finally {
  Remove-Item -LiteralPath $CheckPath -Force -ErrorAction SilentlyContinue
}

if (-not $SkipBuild) {
  Write-Host ""
  Write-Host "==> Limpando cache do Next" -ForegroundColor Cyan
  Remove-Item -Recurse -Force (Join-Path $Root ".next") -ErrorAction SilentlyContinue

  Write-Host ""
  Write-Host "==> Executando build" -ForegroundColor Cyan

  & npm.cmd run build
  $BuildCode = $LASTEXITCODE

  Write-Host "BUILD_EXIT_CODE=$BuildCode"

  if ($BuildCode -ne 0) {
    Write-Host ""
    Write-Host "O build falhou. Nenhum commit foi criado." -ForegroundColor Red
    Write-Host "Backup: $Backup" -ForegroundColor Yellow
    exit $BuildCode
  }
}

Write-Host ""
Write-Host "==================================================" -ForegroundColor Magenta
Write-Host "NOTIFICATION_URL CORRIGIDA" -ForegroundColor Magenta
Write-Host "==================================================" -ForegroundColor Magenta
Write-Host "O Pix agora envia uma URL HTTPS publica ao Mercado Pago."
Write-Host "localhost continua sendo usado apenas para abrir a interface local."
Write-Host "Backup: $Backup"
