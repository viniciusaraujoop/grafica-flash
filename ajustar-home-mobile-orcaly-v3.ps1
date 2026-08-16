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
$ExpectedBranch = "fix/unify-payment-flows-phase-1"
$MarkerHome = "ORCALY_HOME_MOBILE_RESPONSIVE_V3"
$MarkerChat = "ORCALY_HOME_CHAT_MOBILE_RESPONSIVE_V3"

if ([string]::IsNullOrWhiteSpace($ProjectRoot)) {
    $ProjectRoot = (Get-Location).Path
} else {
    $ProjectRoot = (Resolve-Path -LiteralPath $ProjectRoot).Path
}

$Timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
$BackupRoot = Join-Path $ProjectRoot (".orcaly-backups\home-mobile-responsive-v3-" + $Timestamp)
$Changed = New-Object System.Collections.Generic.List[string]
$BackupMap = @{}

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

function FullPath([string]$Relative) {
    return Join-Path $ProjectRoot ($Relative -replace "/", "\")
}

function ReadUtf8([string]$Path) {
    return [IO.File]::ReadAllText($Path)
}

function WriteUtf8([string]$Path, [string]$Text) {
    [IO.File]::WriteAllText($Path, $Text, $Utf8NoBom)
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

function InsertBeforeOnce(
    [string]$Text,
    [string]$Anchor,
    [string]$Insertion,
    [string]$Label
) {
    $count = CountExact $Text $Anchor

    if ($count -ne 1) {
        throw ($Label + ": ancora encontrada " + $count + " vez(es), esperado 1.")
    }

    $index = $Text.IndexOf($Anchor, [StringComparison]::Ordinal)

    return (
        $Text.Substring(0, $index) +
        $Insertion +
        $Text.Substring($index)
    )
}

function GitHeadBlob([string]$Relative) {
    $result = & git rev-parse ("HEAD:" + $Relative) 2>$null

    if ($LASTEXITCODE -ne 0) {
        return ""
    }

    return ([string]($result | Select-Object -First 1)).Trim().ToLowerInvariant()
}

function AssertHead([string]$Relative, [string]$Expected) {
    $actual = GitHeadBlob $Relative

    if ($actual -ne $Expected.ToLowerInvariant()) {
        throw (
            $Relative +
            " nao corresponde ao codigo auditado. Esperado " +
            $Expected +
            "; atual " +
            $actual
        )
    }

    Ok ($Relative + " corresponde ao codigo auditado.")
}

function AssertClean([string]$Relative) {
    & git diff --quiet -- $Relative

    if ($LASTEXITCODE -ne 0) {
        throw ($Relative + " possui alteracao local nao auditada.")
    }

    & git diff --cached --quiet -- $Relative

    if ($LASTEXITCODE -ne 0) {
        throw ($Relative + " possui alteracao staged nao auditada.")
    }

    Ok ($Relative + " esta limpo.")
}

function Backup([string]$Relative) {
    $source = FullPath $Relative
    $destination = Join-Path $BackupRoot ($Relative -replace "/", "\")

    [IO.Directory]::CreateDirectory((Split-Path -Parent $destination)) | Out-Null
    Copy-Item -LiteralPath $source -Destination $destination -Force
    $BackupMap[$Relative] = $destination
}

function Rollback {
    [array]$items = @($Changed)
    [Array]::Reverse($items)

    foreach ($relative in $items) {
        if ($BackupMap.ContainsKey($relative)) {
            Copy-Item `
                -LiteralPath $BackupMap[$relative] `
                -Destination (FullPath $relative) `
                -Force

            Warn ("Restaurado: " + $relative)
        }
    }
}

try {
    Write-Host ""
    Write-Host "ORCALY - HOME MOBILE RESPONSIVE V3" -ForegroundColor Cyan
    Write-Host "Hardening mobile por CSS, sem reescrever a estrutura da home." -ForegroundColor DarkCyan

    if (-not (Test-Path -LiteralPath (FullPath "package.json") -PathType Leaf)) {
        throw "Execute este script na raiz do projeto Orcaly."
    }

    Set-Location $ProjectRoot
    [IO.Directory]::CreateDirectory($BackupRoot) | Out-Null

    Step "Validando branch e arquivos"

    $branch = ([string]((& git branch --show-current) | Select-Object -First 1)).Trim()

    if ($branch -ne $ExpectedBranch) {
        throw ("Branch inesperada: " + $branch + ". Esperada: " + $ExpectedBranch)
    }

    AssertHead "app/page.tsx" "243c44db01a239effc943348796e27765e5902d1"
    AssertHead "components/home/HomeAiChat.tsx" "a987d9fbf209814c7a9a967bf1a5e7db411f7d97"

    AssertClean "app/page.tsx"
    AssertClean "components/home/HomeAiChat.tsx"

    $homePath = FullPath "app/page.tsx"
    $chatPath = FullPath "components/home/HomeAiChat.tsx"

    $homeText = ReadUtf8 $homePath
    $chatText = ReadUtf8 $chatPath

    if ($homeText.Contains($MarkerHome) -or $chatText.Contains($MarkerChat)) {
        throw "O patch V3 ja parece estar aplicado."
    }

    if (-not $SkipInitialBuild) {
        Step "Build inicial"
        & npm.cmd run build

        if ($LASTEXITCODE -ne 0) {
            throw "O projeto ja falha antes do patch. Nada foi alterado."
        }

        Ok "Build inicial passou."
    }

    Step "Criando backups"

    Backup "app/page.tsx"
    Backup "components/home/HomeAiChat.tsx"

    Step "Inserindo camada responsiva na home"

    $homeCss = @'
        /* ORCALY_HOME_MOBILE_RESPONSIVE_V3 */
        html,
        body {
          width: 100%;
          max-width: 100%;
          overflow-x: clip;
        }

        main {
          width: 100%;
          min-width: 0;
          max-width: 100%;
        }

        main *,
        main *::before,
        main *::after {
          box-sizing: border-box;
        }

        main img,
        main video,
        main canvas,
        main svg {
          max-width: 100%;
        }

        main [class*="grid"] > *,
        main [class*="flex"] > * {
          min-width: 0;
        }

        main article,
        main nav,
        main form,
        main details {
          min-width: 0;
          max-width: 100%;
        }

        main input,
        main textarea,
        main select,
        main button,
        main a {
          min-width: 0;
          max-width: 100%;
        }

        main [class*="overflow-x-auto"] {
          max-width: 100%;
          overscroll-behavior-x: contain;
          -webkit-overflow-scrolling: touch;
        }

        .orcaly-fade-up,
        .orcaly-float,
        .orcaly-section,
        .orcaly-section > div {
          min-width: 0;
          max-width: 100%;
        }

        @supports not (overflow: clip) {
          html,
          body {
            overflow-x: hidden;
          }
        }

        @media (max-width: 639px) {
          html,
          body {
            width: 100%;
            max-width: 100vw;
            overflow-x: hidden;
          }

          body {
            position: relative;
          }

          main {
            width: 100%;
            max-width: 100vw;
            overflow-x: hidden;
          }

          main header,
          main section,
          main footer {
            max-width: 100vw;
          }

          .orcaly-section {
            padding-left: 0.75rem !important;
            padding-right: 0.75rem !important;
          }

          main header > div:first-child {
            padding-left: 0.75rem !important;
            padding-right: 0.75rem !important;
          }

          main header img {
            width: auto !important;
            max-width: 9.25rem !important;
            height: auto !important;
          }

          main h1,
          main h2,
          main h3 {
            max-width: 100%;
            overflow-wrap: anywhere;
          }

          main h1 {
            font-size: clamp(2.05rem, 10vw, 2.7rem) !important;
            line-height: 1.02 !important;
            letter-spacing: -0.05em !important;
          }

          main h2 {
            font-size: clamp(1.85rem, 8.6vw, 2.35rem) !important;
            line-height: 1.06 !important;
            letter-spacing: -0.045em !important;
          }

          main h3 {
            overflow-wrap: anywhere;
          }

          main p,
          main li {
            overflow-wrap: break-word;
          }

          .orcaly-float {
            width: 100%;
            max-width: 100%;
          }

          .orcaly-float > * {
            width: 100%;
            min-width: 0;
            max-width: 100%;
          }

          main [class*="max-w-7xl"],
          main [class*="max-w-5xl"],
          main [class*="max-w-4xl"],
          main [class*="max-w-3xl"],
          main [class*="max-w-2xl"],
          main [class*="max-w-xl"] {
            max-width: 100%;
          }

          main [class*="absolute"] {
            max-width: none;
          }

          main footer {
            padding-left: 0.75rem !important;
            padding-right: 0.75rem !important;
          }

          main footer a[href^="mailto:"] {
            overflow-wrap: anywhere;
            word-break: break-word;
          }

          main > div[class*="fixed"][class*="bottom-0"] {
            padding-left: 0.5rem !important;
            padding-right: 0.5rem !important;
            padding-bottom: max(0.5rem, env(safe-area-inset-bottom)) !important;
          }

          #mobile-navigation {
            max-height: calc(100dvh - 68px);
            overflow-y: auto;
          }

          #mobile-navigation > nav {
            max-height: calc(100dvh - 92px);
            overflow-y: auto;
          }
        }

        @media (max-width: 340px) {
          main [class~="grid-cols-3"] {
            grid-template-columns: minmax(0, 1fr) !important;
          }

          main [class~="grid-cols-2"] {
            grid-template-columns: minmax(0, 1fr) !important;
          }

          main h1 {
            font-size: 2rem !important;
          }

          main h2 {
            font-size: 1.8rem !important;
          }
        }

'@

    $homeAnchor = "        @media (prefers-reduced-motion: reduce) {"

    $homeText = InsertBeforeOnce `
        $homeText `
        $homeAnchor `
        $homeCss `
        "CSS responsivo da home"

    WriteUtf8 $homePath $homeText
    $Changed.Add("app/page.tsx")

    Ok "Camada responsiva da home inserida."

    Step "Inserindo camada responsiva no assistente"

    $chatCss = @'
        /* ORCALY_HOME_CHAT_MOBILE_RESPONSIVE_V3 */
        @media (max-width: 639px) {
          section[role="dialog"][aria-label="Assistente virtual do Orçaly"] {
            left: 0.5rem !important;
            right: 0.5rem !important;
            bottom: 5.4rem !important;
            width: auto !important;
            min-width: 0 !important;
            max-width: none !important;
            max-height: calc(100dvh - 6.3rem) !important;
            border-radius: 1.4rem !important;
          }

          section[role="dialog"][aria-label="Assistente virtual do Orçaly"] header {
            padding: 1rem !important;
          }

          section[role="dialog"][aria-label="Assistente virtual do Orçaly"] > div {
            min-width: 0;
            max-width: 100%;
          }

          section[role="dialog"][aria-label="Assistente virtual do Orçaly"] p,
          section[role="dialog"][aria-label="Assistente virtual do Orçaly"] a,
          section[role="dialog"][aria-label="Assistente virtual do Orçaly"] button {
            overflow-wrap: anywhere;
          }

          section[role="dialog"][aria-label="Assistente virtual do Orçaly"] input {
            min-width: 0;
            max-width: 100%;
          }

          button[aria-label="Abrir assistente virtual do Orçaly"] {
            width: 3.5rem !important;
            height: 3.5rem !important;
            font-size: 1.5rem !important;
          }
        }

'@

    $chatAnchor = "        @media (prefers-reduced-motion: reduce) {"

    $chatText = InsertBeforeOnce `
        $chatText `
        $chatAnchor `
        $chatCss `
        "CSS responsivo do chat"

    WriteUtf8 $chatPath $chatText
    $Changed.Add("components/home/HomeAiChat.tsx")

    Ok "Camada responsiva do chat inserida."

    Step "Validando patch"

    $homeAfter = ReadUtf8 $homePath
    $chatAfter = ReadUtf8 $chatPath

    $checks = @(
        @($homeAfter.Contains($MarkerHome), "marcador da home"),
        @($homeAfter.Contains("overflow-x: clip"), "bloqueio de overflow horizontal"),
        @($homeAfter.Contains("max-width: 100vw"), "limite de viewport"),
        @($homeAfter.Contains("grid-template-columns: minmax(0, 1fr)"), "fallback para celulares muito estreitos"),
        @($homeAfter.Contains("safe-area-inset-bottom"), "safe area inferior"),
        @($homeAfter.Contains("100dvh"), "menu com viewport dinamica"),
        @($chatAfter.Contains($MarkerChat), "marcador do chat"),
        @($chatAfter.Contains("calc(100dvh - 6.3rem)"), "chat limitado a viewport dinamica")
    )

    foreach ($check in $checks) {
        if (-not [bool]$check[0]) {
            throw ("Validacao falhou: " + [string]$check[1])
        }

        Ok ([string]$check[1])
    }

    & git --no-pager diff --check -- `
        "app/page.tsx" `
        "components/home/HomeAiChat.tsx"

    if ($LASTEXITCODE -ne 0) {
        throw "git diff --check encontrou problema."
    }

    Step "Lint"

    & npx.cmd eslint `
        "app/page.tsx" `
        "components/home/HomeAiChat.tsx"

    if ($LASTEXITCODE -ne 0) {
        Warn "Lint apontou problemas. O build final sera a validacao decisiva."
    } else {
        Ok "Lint passou."
    }

    if (-not $SkipFinalBuild) {
        Step "Build final"

        & npm.cmd run build

        if ($LASTEXITCODE -ne 0) {
            throw "Build final falhou apos os ajustes mobile."
        }

        Ok "Build final passou."
    }

    Write-Host ""
    Write-Host "============================================================" -ForegroundColor Green
    Write-Host " HOME MOBILE RESPONSIVE V3 APLICADA" -ForegroundColor Green
    Write-Host "============================================================" -ForegroundColor Green
    Write-Host ""
    Write-Host "Ajustado sem reescrever JSX:"
    Write-Host " - overflow horizontal"
    Write-Host " - grids e flex containers"
    Write-Host " - imagens e previews"
    Write-Host " - titulos em telas pequenas"
    Write-Host " - cards e formularios"
    Write-Host " - menu mobile"
    Write-Host " - footer e emails"
    Write-Host " - barra inferior e safe area"
    Write-Host " - assistente flutuante"
    Write-Host " - fallback especial abaixo de 340px"
    Write-Host ""
    Write-Host ("Backup: " + $BackupRoot)
    Write-Host ""
    Write-Host "Nenhum commit, push ou deploy foi executado." -ForegroundColor Cyan
}
catch {
    Write-Host ""
    Write-Host ("[ERRO] " + $_.Exception.Message) -ForegroundColor Red

    if ($Changed.Count -gt 0) {
        Warn "Executando rollback."
        Rollback
    }

    Write-Host ("Backup/diagnostico: " + $BackupRoot) -ForegroundColor Yellow
    exit 1
}
