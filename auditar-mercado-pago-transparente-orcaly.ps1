param(
  [switch]$RunBuild
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$Root = (Get-Location).Path
$Stamp = Get-Date -Format "yyyyMMdd-HHmmss"
$Report = Join-Path $Root "auditoria-mercado-pago-transparente-$Stamp.txt"

if (-not (Test-Path -LiteralPath (Join-Path $Root "package.json"))) {
  throw "Execute este script na raiz do projeto Orcaly."
}

$Lines = New-Object System.Collections.Generic.List[string]

function Add-Line([string]$Text = "") {
  $Lines.Add($Text)
  Write-Host $Text
}

function Add-Section([string]$Title) {
  Add-Line ""
  Add-Line ("=" * 72)
  Add-Line $Title
  Add-Line ("=" * 72)
}

function Safe-Env([string]$Name) {
  $Value = [Environment]::GetEnvironmentVariable($Name, "Process")

  if ($null -eq $Value) {
    return [PSCustomObject]@{
      Variavel = $Name
      Configurada = $false
      Tamanho = 0
    }
  }

  return [PSCustomObject]@{
    Variavel = $Name
    Configurada = -not [string]::IsNullOrWhiteSpace($Value)
    Tamanho = $Value.Length
  }
}

function File-Info([string]$RelativePath) {
  $Path = Join-Path $Root ($RelativePath -replace "/", "\")

  if (-not (Test-Path -LiteralPath $Path)) {
    return [PSCustomObject]@{
      Arquivo = $RelativePath
      Existe = $false
      Linhas = 0
      Tamanho = 0
    }
  }

  $Text = [IO.File]::ReadAllText($Path)

  return [PSCustomObject]@{
    Arquivo = $RelativePath
    Existe = $true
    Linhas = ($Text -split "`r?`n").Count
    Tamanho = $Text.Length
  }
}

function Count-Marker([string]$RelativePath, [string]$Marker) {
  $Path = Join-Path $Root ($RelativePath -replace "/", "\")

  if (-not (Test-Path -LiteralPath $Path)) {
    return 0
  }

  $Text = [IO.File]::ReadAllText($Path)
  return ([regex]::Matches($Text, [regex]::Escape($Marker))).Count
}

Add-Section "ORCALY - AUDITORIA PARA MERCADO PAGO TRANSPARENTE"
Add-Line "Raiz: $Root"
Add-Line "Data: $(Get-Date -Format 'dd/MM/yyyy HH:mm:ss')"

Add-Section "GIT"

try {
  $Branch = (& git branch --show-current 2>$null | Out-String).Trim()
  Add-Line "Branch: $Branch"

  $Status = (& git status --short 2>$null | Out-String).TrimEnd()

  if ([string]::IsNullOrWhiteSpace($Status)) {
    Add-Line "Status: sem alteracoes locais"
  } else {
    Add-Line "Alteracoes locais:"
    Add-Line $Status
  }
} catch {
  Add-Line "Git indisponivel: $($_.Exception.Message)"
}

Add-Section "ARQUIVOS IMPORTANTES"

$Files = @(
  "package.json",
  "lib/mercado-pago.ts",
  "lib/payments/credential-encryption.ts",
  "lib/payments/server-context.ts",
  "lib/payments/checkout-service.ts",
  "lib/payments/subscription-asaas.ts",
  "app/painel/assinatura/page.tsx",
  "components/subscription/AsaasSubscriptionPayment.tsx",
  "app/api/assinatura/asaas/route.ts",
  "app/api/assinatura/asaas/cancelar/route.ts",
  "app/api/assinatura/cancelar/route.ts",
  "components/payments/PaymentsHub.tsx",
  "components/payments/AsaasFinancialPanel.tsx",
  "app/painel/pagamentos/page.tsx",
  "app/painel/pagamentos/configuracao/page.tsx",
  "components/painel/MarketplacePaymentsPanel.tsx",
  "app/api/marketplace/payments/settings/route.ts",
  "app/api/marketplace/payments/sales/route.ts",
  "app/api/marketplace/payments/create/route.ts",
  "app/api/marketplace/payments/mercado-pago/connect/route.ts",
  "app/api/marketplace/payments/mercado-pago/callback/route.ts",
  "app/api/marketplace/payments/mercado-pago/disconnect/route.ts",
  "app/api/marketplace/payments/webhook/mercado-pago/route.ts",
  "app/checkout/[slug]/page.tsx",
  "components/checkout/CheckoutClient.tsx",
  "app/api/checkout/[slug]/route.ts",
  "app/api/checkout/[slug]/prepare/route.ts",
  "app/api/checkout/[slug]/pix/route.ts",
  "app/api/checkout/[slug]/pix/[paymentId]/route.ts",
  "app/api/checkout/[slug]/card/route.ts",
  "app/api/checkout/[slug]/status/route.ts"
)

$FileTable = $Files | ForEach-Object { File-Info $_ }
$FileOutput = $FileTable | Format-Table -AutoSize | Out-String
Add-Line $FileOutput.TrimEnd()

Add-Section "MARCADORES DO ESTADO ATUAL"

$Checks = @(
  [PSCustomObject]@{
    Arquivo = "app/api/marketplace/payments/mercado-pago/connect/route.ts"
    Marcador = "LEGACY_PROVIDER_DISABLED"
  },
  [PSCustomObject]@{
    Arquivo = "app/api/marketplace/payments/mercado-pago/callback/route.ts"
    Marcador = "LEGACY_PROVIDER_DISABLED"
  },
  [PSCustomObject]@{
    Arquivo = "app/api/marketplace/payments/create/route.ts"
    Marcador = "LEGACY_CHECKOUT_DISABLED"
  },
  [PSCustomObject]@{
    Arquivo = "app/painel/assinatura/page.tsx"
    Marcador = "AsaasSubscriptionPayment"
  },
  [PSCustomObject]@{
    Arquivo = "components/payments/PaymentsHub.tsx"
    Marcador = "AsaasFinancialPanel"
  },
  [PSCustomObject]@{
    Arquivo = "components/checkout/CheckoutClient.tsx"
    Marcador = "CREDIT_CARD"
  },
  [PSCustomObject]@{
    Arquivo = "components/checkout/CheckoutClient.tsx"
    Marcador = "MercadoPago"
  },
  [PSCustomObject]@{
    Arquivo = "app/api/checkout/[slug]/route.ts"
    Marcador = "Asaas"
  },
  [PSCustomObject]@{
    Arquivo = "app/api/checkout/[slug]/route.ts"
    Marcador = "mercado_pago"
  }
)

$CheckRows = $Checks | ForEach-Object {
  [PSCustomObject]@{
    Arquivo = $_.Arquivo
    Marcador = $_.Marcador
    Ocorrencias = Count-Marker $_.Arquivo $_.Marcador
  }
}

$CheckOutput = $CheckRows | Format-Table -AutoSize | Out-String
Add-Line $CheckOutput.TrimEnd()

Add-Section "VARIAVEIS DE AMBIENTE SEM EXIBIR SEGREDOS"

$EnvNames = @(
  "MERCADO_PAGO_CLIENT_ID",
  "MERCADO_PAGO_CLIENT_SECRET",
  "MERCADO_PAGO_ACCESS_TOKEN",
  "MERCADO_PAGO_PUBLIC_KEY",
  "NEXT_PUBLIC_MERCADO_PAGO_PUBLIC_KEY",
  "MERCADO_PAGO_REDIRECT_URI",
  "MERCADO_PAGO_WEBHOOK_SECRET",
  "PAYMENT_CREDENTIALS_ENCRYPTION_KEY",
  "NEXT_PUBLIC_APP_URL",
  "NEXT_PUBLIC_SITE_URL",
  "ORCALY_APP_URL",
  "NEXT_PUBLIC_SUPABASE_URL",
  "SUPABASE_SERVICE_ROLE_KEY"
)

$EnvRows = $EnvNames | ForEach-Object { Safe-Env $_ }
$EnvOutput = $EnvRows | Format-Table -AutoSize | Out-String
Add-Line $EnvOutput.TrimEnd()

Add-Section "MIGRACOES RELACIONADAS"

$MigrationRoot = Join-Path $Root "supabase\migrations"

if (Test-Path -LiteralPath $MigrationRoot) {
  $Migrations = Get-ChildItem -LiteralPath $MigrationRoot -File |
    Where-Object {
      $_.Name -match "payment|pagamento|subscription|assinatura|mercado|asaas|checkout"
    } |
    Sort-Object Name |
    Select-Object Name, Length, LastWriteTime

  if ($Migrations) {
    Add-Line (($Migrations | Format-Table -AutoSize | Out-String).TrimEnd())
  } else {
    Add-Line "Nenhuma migracao relacionada foi encontrada."
  }
} else {
  Add-Line "Pasta supabase/migrations nao encontrada."
}

Add-Section "DEPENDENCIAS"

try {
  $Package = Get-Content -LiteralPath (Join-Path $Root "package.json") -Raw |
    ConvertFrom-Json

  Add-Line "Next.js: $($Package.dependencies.next)"
  Add-Line "React: $($Package.dependencies.react)"
  Add-Line "Supabase: $($Package.dependencies.'@supabase/supabase-js')"
  Add-Line "SDK Mercado Pago instalado: $([bool]$Package.dependencies.'mercadopago')"
} catch {
  Add-Line "Nao foi possivel ler package.json: $($_.Exception.Message)"
}

if ($RunBuild) {
  Add-Section "BUILD"

  $BuildLog = Join-Path $Root "auditoria-build-mercado-pago-$Stamp.log"

  & npm.cmd run build 2>&1 |
    Tee-Object -FilePath $BuildLog |
    ForEach-Object { Add-Line ([string]$_) }

  Add-Line "BUILD_EXIT_CODE=$LASTEXITCODE"
  Add-Line "Log: $BuildLog"
}

Add-Section "RESUMO"
Add-Line "A auditoria nao modificou codigo, banco de dados ou variaveis."
Add-Line "Relatorio: $Report"

[IO.File]::WriteAllLines(
  $Report,
  $Lines,
  (New-Object System.Text.UTF8Encoding($false))
)

Write-Host ""
Write-Host "AUDITORIA CONCLUIDA" -ForegroundColor Green
Write-Host "Relatorio salvo em: $Report" -ForegroundColor Green
