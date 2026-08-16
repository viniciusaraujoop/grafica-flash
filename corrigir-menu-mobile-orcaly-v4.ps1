param(
    [string]$ProjectRoot = "",
    [switch]$SkipInitialBuild,
    [switch]$SkipFinalBuild
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

try {
    [Console]::OutputEncoding = New-Object System.Text.UTF8Encoding($false)
    $OutputEncoding = New-Object System.Text.UTF8Encoding($false)
} catch {}

$Utf8NoBom = New-Object System.Text.UTF8Encoding($false)
$MarkerPrevious = "ORCALY_HOME_MOBILE_RESPONSIVE_V3"
$MarkerNew = "ORCALY_HOME_MOBILE_MENU_FIX_V4"

if ([string]::IsNullOrWhiteSpace($ProjectRoot)) {
    $ProjectRoot = (Get-Location).Path
} else {
    $ProjectRoot = (Resolve-Path -LiteralPath $ProjectRoot).Path
}

$Target = Join-Path $ProjectRoot "app\page.tsx"
$Timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
$BackupRoot = Join-Path $ProjectRoot (".orcaly-backups\home-mobile-menu-v4-" + $Timestamp)
$BackupFile = Join-Path $BackupRoot "app\page.tsx"

function Step([string]$Text) {
    Write-Host ""
    Write-Host ("==> " + $Text) -ForegroundColor Cyan
}

function Ok([string]$Text) {
    Write-Host ("[OK] " + $Text) -ForegroundColor Green
}

function Warn([string]$Text) {
    Write-Host ("[AVISO] " + $Text) -ForegroundColor Yellow
}

function CountExact([string]$Text, [string]$Needle) {
    $count = 0
    $start = 0

    while ($true) {
        $index = $Text.IndexOf($Needle, $start, [StringComparison]::Ordinal)
        if ($index -lt 0) { break }

        $count++
        $start = $index + $Needle.Length
    }

    return $count
}

function Restore {
    if (Test-Path -LiteralPath $BackupFile -PathType Leaf) {
        Copy-Item -LiteralPath $BackupFile -Destination $Target -Force
        Warn "Rollback concluido: app/page.tsx restaurado."
    }
}

try {
    Write-Host ""
    Write-Host "ORCALY - MOBILE MENU FIX V4" -ForegroundColor Cyan
    Write-Host "Corrige o menu dos tres tracos no celular." -ForegroundColor DarkCyan

    if (-not (Test-Path -LiteralPath (Join-Path $ProjectRoot "package.json") -PathType Leaf)) {
        throw "Execute este script na raiz do projeto Orcaly."
    }

    if (-not (Test-Path -LiteralPath $Target -PathType Leaf)) {
        throw "app/page.tsx nao encontrado."
    }

    Set-Location $ProjectRoot

    $text = [IO.File]::ReadAllText($Target)

    if ($text.Contains($MarkerNew)) {
        Ok "A correcao do menu mobile V4 ja esta aplicada."
        exit 0
    }

    if (-not $text.Contains($MarkerPrevious)) {
        throw "A camada responsiva V3 nao foi encontrada. O script recusou alterar uma versao inesperada."
    }

    if (-not $text.Contains('id="mobile-navigation"')) {
        throw "O menu mobile nao foi encontrado no arquivo."
    }

    if (-not $SkipInitialBuild) {
        Step "Build inicial"

        & npm.cmd run build

        if ($LASTEXITCODE -ne 0) {
            throw "O projeto ja falha no build antes desta correcao. Nada foi alterado."
        }

        Ok "Build inicial passou."
    }

    Step "Criando backup"

    [IO.Directory]::CreateDirectory((Split-Path -Parent $BackupFile)) | Out-Null
    Copy-Item -LiteralPath $Target -Destination $BackupFile -Force
    Ok ("Backup: " + $BackupFile)

    Step "Corrigindo menu mobile"

    $anchor = "        @media (prefers-reduced-motion: reduce) {"
    $anchorCount = CountExact $text $anchor

    if ($anchorCount -ne 1) {
        throw ("Ancora CSS encontrada " + $anchorCount + " vez(es), esperado 1.")
    }

    $css = @'
        /* ORCALY_HOME_MOBILE_MENU_FIX_V4 */
        @media (max-width: 639px) {
          main > header {
            z-index: 90 !important;
            overflow: visible !important;
            backdrop-filter: none !important;
            -webkit-backdrop-filter: none !important;
            background: rgba(255, 255, 255, 0.98) !important;
          }

          #mobile-navigation {
            position: fixed !important;
            inset: auto 0 0 0 !important;
            top: 68px !important;
            width: 100vw !important;
            height: calc(100dvh - 68px) !important;
            min-height: 0 !important;
            max-height: none !important;
            overflow-x: hidden !important;
            overflow-y: auto !important;
            padding: 0.75rem !important;
            z-index: 9999 !important;
            overscroll-behavior: contain;
            -webkit-overflow-scrolling: touch;
          }

          #mobile-navigation > nav {
            position: relative !important;
            width: 100% !important;
            min-width: 0 !important;
            max-width: 100% !important;
            max-height: calc(100dvh - 92px) !important;
            overflow-x: hidden !important;
            overflow-y: auto !important;
            margin: 0 auto !important;
            z-index: 1 !important;
          }

          #mobile-navigation a {
            width: 100%;
          }
        }

'@

    $index = $text.IndexOf($anchor, [StringComparison]::Ordinal)

    $text = (
        $text.Substring(0, $index) +
        $css +
        $text.Substring($index)
    )

    [IO.File]::WriteAllText($Target, $text, $Utf8NoBom)

    Step "Validando correcao"

    $after = [IO.File]::ReadAllText($Target)

    $checks = @(
        @($after.Contains($MarkerNew), "marcador V4"),
        @($after.Contains("backdrop-filter: none !important"), "header sem containing block no mobile"),
        @($after.Contains("height: calc(100dvh - 68px) !important"), "menu com altura real da viewport"),
        @($after.Contains("z-index: 9999 !important"), "menu acima do conteudo"),
        @($after.Contains("#mobile-navigation > nav"), "painel branco com rolagem propria")
    )

    foreach ($check in $checks) {
        if (-not [bool]$check[0]) {
            throw ("Validacao falhou: " + [string]$check[1])
        }

        Ok ([string]$check[1])
    }

    & git --no-pager diff --check -- "app/page.tsx"

    if ($LASTEXITCODE -ne 0) {
        throw "git diff --check encontrou problema."
    }

    Step "Build final"

    if (-not $SkipFinalBuild) {
        & npm.cmd run build

        if ($LASTEXITCODE -ne 0) {
            throw "Build final falhou apos a correcao do menu."
        }

        Ok "Build final passou."
    }

    Write-Host ""
    Write-Host "============================================================" -ForegroundColor Green
    Write-Host " MENU MOBILE V4 CORRIGIDO" -ForegroundColor Green
    Write-Host "============================================================" -ForegroundColor Green
    Write-Host ""
    Write-Host "Corrigido:"
    Write-Host " - menu nao fica mais preso ao header"
    Write-Host " - menu ocupa a viewport abaixo do cabecalho"
    Write-Host " - painel branco fica visivel e rolavel"
    Write-Host " - menu fica acima do chat e da barra inferior"
    Write-Host " - desktop permanece sem alteracao"
    Write-Host ""
    Write-Host "Nenhum commit, push ou deploy foi executado." -ForegroundColor Cyan
}
catch {
    Write-Host ""
    Write-Host ("[ERRO] " + $_.Exception.Message) -ForegroundColor Red

    if (Test-Path -LiteralPath $BackupFile -PathType Leaf) {
        Restore
    }

    Write-Host ("Backup/diagnostico: " + $BackupRoot) -ForegroundColor Yellow
    exit 1
}
