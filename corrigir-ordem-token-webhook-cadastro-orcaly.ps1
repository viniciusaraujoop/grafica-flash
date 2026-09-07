param(
  [switch]$SkipBuild
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$Root = (Get-Location).Path
$Target = Join-Path $Root "app\api\mercado-pago\webhook-leads\route.ts"
$Stamp = Get-Date -Format "yyyyMMdd-HHmmss"
$Backup = Join-Path $Root ".orcaly-backups\corrigir-token-webhook-cadastro-$Stamp\route.ts"
$Utf8 = New-Object System.Text.UTF8Encoding($false)

if (-not (Test-Path -LiteralPath (Join-Path $Root "package.json"))) {
  throw "Execute este script na raiz do projeto Orcaly."
}

$Branch = (& git branch --show-current 2>$null | Out-String).Trim()

if ($Branch -ne "feature/asaas-sandbox") {
  throw "Branch atual: $Branch. Execute na branch feature/asaas-sandbox."
}

if (-not (Test-Path -LiteralPath $Target)) {
  throw "Arquivo nao encontrado: app/api/mercado-pago/webhook-leads/route.ts"
}

New-Item -ItemType Directory -Force -Path (Split-Path $Backup -Parent) | Out-Null
Copy-Item -LiteralPath $Target -Destination $Backup -Force

$Content = [IO.File]::ReadAllText($Target).Replace("`r`n", "`n")
$Original = $Content

Write-Host ""
Write-Host "==================================================" -ForegroundColor Cyan
Write-Host "ORCALY - CORRECAO DO WEBHOOK DE CADASTRO" -ForegroundColor Cyan
Write-Host "Access Token declarado antes do uso" -ForegroundColor Cyan
Write-Host "==================================================" -ForegroundColor Cyan

$OldGuardPattern = '(?ms)\n\s*if\s*\(\s*!mercadoPagoToken\s*\)\s*\{\s*return\s*\{\s*ok:\s*false,\s*reason:\s*"access_token ausente"\s*\};\s*\}\s*'
$Content = [regex]::Replace($Content, $OldGuardPattern, "`n", 1)

if ($Content -ne $Original) {
  Write-Host "[OK] validacao antiga removida" -ForegroundColor Green
} else {
  Write-Host "[JA APLICADO] validacao antiga nao estava presente" -ForegroundColor DarkGreen
}

$DeclarationPattern = '(?m)^\s*const mercadoPagoToken = getSignupAccessToken\(\);\s*$'
$Declarations = [regex]::Matches($Content, $DeclarationPattern)

if ($Declarations.Count -gt 1) {
  $FirstSeen = $false
  $Content = [regex]::Replace(
    $Content,
    $DeclarationPattern,
    {
      param($Match)

      if (-not $FirstSeen) {
        $script:FirstSeen = $true
        return $Match.Value
      }

      return ""
    }
  )

  Write-Host "[OK] declaracoes duplicadas removidas" -ForegroundColor Green
}

if (-not [regex]::IsMatch($Content, $DeclarationPattern)) {
  $FetchMarker = "  const response = await fetch("

  if (-not $Content.Contains($FetchMarker)) {
    throw "Nao foi possivel localizar a chamada do Mercado Pago."
  }

  $Content = $Content.Replace(
    $FetchMarker,
    "  const mercadoPagoToken = getSignupAccessToken();`n`n$FetchMarker"
  )

  Write-Host "[OK] Access Token declarado antes da requisicao" -ForegroundColor Green
} else {
  Write-Host "[OK] declaracao do Access Token encontrada" -ForegroundColor Green
}

[IO.File]::WriteAllText(
  $Target,
  $Content.TrimEnd() + "`n",
  $Utf8
)

Write-Host ""
Write-Host "==> Verificando ordem da declaracao" -ForegroundColor Cyan

$Final = [IO.File]::ReadAllText($Target).Replace("`r`n", "`n")
$DeclarationIndex = $Final.IndexOf("const mercadoPagoToken = getSignupAccessToken();")
$AuthorizationIndex = $Final.IndexOf('Authorization: `Bearer ${mercadoPagoToken}`')

if ($DeclarationIndex -lt 0) {
  throw "A declaracao do Access Token nao foi encontrada."
}

if ($AuthorizationIndex -lt 0) {
  throw "O cabecalho Authorization do webhook nao foi encontrado."
}

if ($DeclarationIndex -gt $AuthorizationIndex) {
  throw "O Access Token ainda aparece depois do uso."
}

$OldGuard = Select-String `
  -LiteralPath $Target `
  -Pattern 'if (!mercadoPagoToken)' `
  -SimpleMatch `
  -ErrorAction SilentlyContinue

if ($OldGuard) {
  throw "A validacao antiga ainda existe."
}

Write-Host "[OK] token exclusivo do cadastro declarado antes do Authorization" -ForegroundColor Green

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
    Write-Host "O build ainda encontrou outro erro. Nenhum commit foi criado." -ForegroundColor Red
    Write-Host "Backup: $Backup" -ForegroundColor Yellow
    exit $BuildCode
  }
}

Write-Host ""
Write-Host "==================================================" -ForegroundColor Magenta
Write-Host "WEBHOOK DE CADASTRO CORRIGIDO" -ForegroundColor Magenta
Write-Host "==================================================" -ForegroundColor Magenta
Write-Host "O fluxo de cadastro continua usando apenas MP_SIGNUP_ACCESS_TOKEN."
Write-Host "Nenhum fluxo compartilhado foi restaurado."
Write-Host "Nenhum commit ou deploy foi criado."
Write-Host "Backup: $Backup"
