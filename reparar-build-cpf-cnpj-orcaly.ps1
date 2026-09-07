param(
  [switch]$SkipBuild
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$Root = (Get-Location).Path
$Stamp = Get-Date -Format "yyyyMMdd-HHmmss"
$Backup = Join-Path $Root ".orcaly-backups\reparo-cpf-cnpj-$Stamp"
$Utf8 = New-Object System.Text.UTF8Encoding($false)

function Full([string]$Path) {
  return Join-Path $Root ($Path -replace "/", "\")
}

function Read-Normalized([string]$Path) {
  $Target = Full $Path

  if (-not (Test-Path -LiteralPath $Target)) {
    throw "Arquivo nao encontrado: $Path"
  }

  return [IO.File]::ReadAllText($Target).Replace("`r`n", "`n")
}

function Save-WithBackup([string]$Path, [string]$Text) {
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

if (-not (Test-Path -LiteralPath (Join-Path $Root "package.json"))) {
  throw "Execute este script na raiz do projeto."
}

New-Item -ItemType Directory -Force -Path $Backup | Out-Null

Write-Host ""
Write-Host "==================================================" -ForegroundColor Cyan
Write-Host "ORCALY - REPARO DO BUILD CPF/CNPJ" -ForegroundColor Cyan
Write-Host "==================================================" -ForegroundColor Cyan

# ------------------------------------------------------------------
# 1. Corrige a funcao refreshAccountStatus duplicada.
# O script anterior manteve o marcador original depois de inserir
# uma nova copia, abrindo duas chaves e fechando apenas uma.
# ------------------------------------------------------------------
$PanelPath = "components/payments/AsaasFinancialPanel.tsx"
$Panel = Read-Normalized $PanelPath

$DuplicateRefreshPattern =
  '(?s)(  async function refreshAccountStatus\(\) \{)\s*(  async function refreshAccountStatus\(\) \{)'

$RefreshBefore = [regex]::Matches(
  $Panel,
  'async function refreshAccountStatus\(\)'
).Count

$PanelFixed = [regex]::Replace(
  $Panel,
  $DuplicateRefreshPattern,
  '  async function refreshAccountStatus() {',
  1
)

$RefreshAfter = [regex]::Matches(
  $PanelFixed,
  'async function refreshAccountStatus\(\)'
).Count

if ($PanelFixed -eq $Panel) {
  if ($RefreshBefore -eq 1) {
    Write-Host "[SEM ALTERACAO] refreshAccountStatus ja possui uma unica declaracao" -ForegroundColor Yellow
  } else {
    throw "A declaracao duplicada de refreshAccountStatus nao foi localizada. Encontradas: $RefreshBefore"
  }
} else {
  if ($RefreshAfter -ne 1) {
    throw "O reparo de refreshAccountStatus nao resultou em uma unica declaracao."
  }

  Save-WithBackup $PanelPath $PanelFixed
}

# ------------------------------------------------------------------
# 2. Remove a declaracao antiga de document.
# A variavel nova ja e criada no inicio do POST com digits().
# ------------------------------------------------------------------
$RoutePath = "app/api/payments/asaas/account/route.ts"
$Route = Read-Normalized $RoutePath

$NewDocumentLine = '    const document = digits(body.cpfCnpj);'
$LegacyDocumentLine =
  '    const document = String(body.cpfCnpj || "").replace(/\D/g, "");'

if (-not $Route.Contains($NewDocumentLine)) {
  throw "A nova declaracao de document nao foi localizada na rota."
}

$LegacyCount = (
  [regex]::Matches(
    $Route,
    [regex]::Escape($LegacyDocumentLine)
  )
).Count

if ($LegacyCount -gt 1) {
  throw "Foram localizadas varias declaracoes antigas de document: $LegacyCount"
}

if ($LegacyCount -eq 1) {
  $RouteFixed = $Route.Replace(
    $LegacyDocumentLine + "`n`n",
    ""
  )

  if ($RouteFixed -eq $Route) {
    $RouteFixed = $Route.Replace(
      $LegacyDocumentLine + "`n",
      ""
    )
  }

  if ($RouteFixed -eq $Route) {
    throw "Nao foi possivel remover a declaracao antiga de document."
  }

  Save-WithBackup $RoutePath $RouteFixed
} else {
  Write-Host "[SEM ALTERACAO] declaracao antiga de document ja foi removida" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "==> Verificacao rapida" -ForegroundColor Cyan

$PanelCheck = Read-Normalized $PanelPath
$RouteCheck = Read-Normalized $RoutePath

$RefreshCount = [regex]::Matches(
  $PanelCheck,
  'async function refreshAccountStatus\(\)'
).Count

$NewDocumentCount = [regex]::Matches(
  $RouteCheck,
  [regex]::Escape($NewDocumentLine)
).Count

$LegacyDocumentCount = [regex]::Matches(
  $RouteCheck,
  [regex]::Escape($LegacyDocumentLine)
).Count

Write-Host "refreshAccountStatus: $RefreshCount declaracao"
Write-Host "document novo: $NewDocumentCount declaracao"
Write-Host "document antigo: $LegacyDocumentCount declaracao"

if ($RefreshCount -ne 1) {
  throw "refreshAccountStatus ainda esta inconsistente."
}

if ($NewDocumentCount -ne 1 -or $LegacyDocumentCount -ne 0) {
  throw "A variavel document ainda esta inconsistente."
}

if (-not $SkipBuild) {
  Write-Host ""
  Write-Host "==> Executando build" -ForegroundColor Cyan

  & npm.cmd run build
  $Code = $LASTEXITCODE

  Write-Host "BUILD_EXIT_CODE=$Code"

  if ($Code -ne 0) {
    Write-Host "O build ainda falhou. Backup: $Backup" -ForegroundColor Red
    exit $Code
  }
}

Write-Host ""
Write-Host "==================================================" -ForegroundColor Magenta
Write-Host "REPARO CONCLUIDO" -ForegroundColor Magenta
Write-Host "==================================================" -ForegroundColor Magenta
Write-Host "Funcao duplicada: corrigida"
Write-Host "Variavel document duplicada: corrigida"
Write-Host "Backup: $Backup"
