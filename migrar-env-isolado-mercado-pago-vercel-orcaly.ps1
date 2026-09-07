param(
  [string[]]$Environments = @("production", "preview", "development")
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$Root = (Get-Location).Path

if (-not (Test-Path -LiteralPath (Join-Path $Root "package.json"))) {
  throw "Execute este script na raiz do projeto Orcaly."
}

if (-not (Test-Path -LiteralPath (Join-Path $Root ".vercel\project.json"))) {
  throw "Projeto Vercel nao vinculado. Execute npx vercel link antes."
}

function Read-DotEnv([string]$Path) {
  $Result = @{}

  foreach ($Line in Get-Content -LiteralPath $Path) {
    if ($Line -match '^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=(.*)$') {
      $Name = $Matches[1]
      $Value = $Matches[2].Trim()

      if (
        $Value.Length -ge 2 -and
        (
          ($Value.StartsWith('"') -and $Value.EndsWith('"')) -or
          ($Value.StartsWith("'") -and $Value.EndsWith("'"))
        )
      ) {
        $Value = $Value.Substring(1, $Value.Length - 2)
      }

      $Result[$Name] = $Value
    }
  }

  return $Result
}

function Source-Value([hashtable]$Values, [string[]]$Sources) {
  foreach ($Source in $Sources) {
    if (
      $Values.ContainsKey($Source) -and
      -not [string]::IsNullOrWhiteSpace([string]$Values[$Source])
    ) {
      return [string]$Values[$Source]
    }
  }

  return ""
}

function Set-VercelVariable(
  [string]$Name,
  [string]$Value,
  [string]$Environment,
  [bool]$Sensitive
) {
  if ([string]::IsNullOrWhiteSpace($Value)) {
    Write-Host "[PENDENTE] $Name em $Environment" -ForegroundColor Yellow
    return $false
  }

  $ValueFile = [IO.Path]::GetTempFileName()

  try {
    [IO.File]::WriteAllText(
      $ValueFile,
      $Value,
      (New-Object System.Text.UTF8Encoding($false))
    )

    $Args = @(
      "vercel",
      "env",
      "add",
      $Name,
      $Environment,
      "--force"
    )

    if ($Sensitive) {
      $Args += "--sensitive"
    }

    Get-Content -LiteralPath $ValueFile -Raw | & npx.cmd @Args

    if ($LASTEXITCODE -ne 0) {
      throw "Falha ao gravar $Name em $Environment."
    }

    Write-Host "[OK] $Name em $Environment" -ForegroundColor Green
    return $true
  } finally {
    Remove-Item -LiteralPath $ValueFile -Force -ErrorAction SilentlyContinue
  }
}

$Mappings = @(
  @{
    Target = "NEXT_PUBLIC_MP_SIGNUP_PUBLIC_KEY"
    Sources = @("NEXT_PUBLIC_MERCADO_PAGO_PUBLIC_KEY", "MERCADO_PAGO_PUBLIC_KEY")
    Sensitive = $false
  },
  @{
    Target = "MP_SIGNUP_ACCESS_TOKEN"
    Sources = @("MERCADO_PAGO_PLATFORM_ACCESS_TOKEN", "MERCADO_PAGO_ACCESS_TOKEN")
    Sensitive = $true
  },
  @{
    Target = "MP_SIGNUP_WEBHOOK_SECRET"
    Sources = @("MERCADO_PAGO_WEBHOOK_SECRET")
    Sensitive = $true
  },
  @{
    Target = "NEXT_PUBLIC_MP_SUBSCRIPTION_PUBLIC_KEY"
    Sources = @("NEXT_PUBLIC_MERCADO_PAGO_PUBLIC_KEY", "MERCADO_PAGO_PUBLIC_KEY")
    Sensitive = $false
  },
  @{
    Target = "MP_SUBSCRIPTION_ACCESS_TOKEN"
    Sources = @("MERCADO_PAGO_PLATFORM_ACCESS_TOKEN", "MERCADO_PAGO_ACCESS_TOKEN")
    Sensitive = $true
  },
  @{
    Target = "MP_SUBSCRIPTION_WEBHOOK_SECRET"
    Sources = @("MERCADO_PAGO_WEBHOOK_SECRET")
    Sensitive = $true
  },
  @{
    Target = "NEXT_PUBLIC_MP_MARKETPLACE_PUBLIC_KEY"
    Sources = @("NEXT_PUBLIC_MERCADO_PAGO_PUBLIC_KEY", "MERCADO_PAGO_PUBLIC_KEY")
    Sensitive = $false
  },
  @{
    Target = "MP_MARKETPLACE_CLIENT_ID"
    Sources = @("MERCADO_PAGO_CLIENT_ID")
    Sensitive = $false
  },
  @{
    Target = "MP_MARKETPLACE_CLIENT_SECRET"
    Sources = @("MERCADO_PAGO_CLIENT_SECRET")
    Sensitive = $true
  },
  @{
    Target = "MP_MARKETPLACE_REDIRECT_URI"
    Sources = @("MERCADO_PAGO_REDIRECT_URI")
    Sensitive = $false
  },
  @{
    Target = "MP_MARKETPLACE_WEBHOOK_SECRET"
    Sources = @("MERCADO_PAGO_WEBHOOK_SECRET")
    Sensitive = $true
  }
)

Write-Host ""
Write-Host "==================================================" -ForegroundColor Cyan
Write-Host "ORCALY - MIGRACAO DE VARIAVEIS NA VERCEL" -ForegroundColor Cyan
Write-Host "Valores copiados sem serem exibidos." -ForegroundColor Cyan
Write-Host "==================================================" -ForegroundColor Cyan

foreach ($Environment in $Environments) {
  Write-Host ""
  Write-Host "==> Ambiente: $Environment" -ForegroundColor Cyan

  $PulledFile = [IO.Path]::GetTempFileName()

  try {
    & npx.cmd vercel env pull $PulledFile "--environment=$Environment" --yes

    if ($LASTEXITCODE -ne 0) {
      throw "Nao foi possivel obter as variaveis de $Environment."
    }

    $Values = Read-DotEnv $PulledFile
    $Configured = 0
    $Pending = 0

    foreach ($Mapping in $Mappings) {
      $Value = Source-Value $Values $Mapping.Sources

      if (
        Set-VercelVariable `
          $Mapping.Target `
          $Value `
          $Environment `
          ([bool]$Mapping.Sensitive)
      ) {
        $Configured += 1
      } else {
        $Pending += 1
      }
    }

    Write-Host "CONFIGURADAS_$($Environment.ToUpper())=$Configured"
    Write-Host "PENDENTES_$($Environment.ToUpper())=$Pending"
  } finally {
    Remove-Item -LiteralPath $PulledFile -Force -ErrorAction SilentlyContinue
  }
}

Write-Host ""
Write-Host "==================================================" -ForegroundColor Magenta
Write-Host "VARIAVEIS ISOLADAS NA VERCEL" -ForegroundColor Magenta
Write-Host "==================================================" -ForegroundColor Magenta
Write-Host "As variaveis antigas nao foram removidas."
Write-Host "Um novo deployment sera necessario para aplicar as novas Public Keys."
