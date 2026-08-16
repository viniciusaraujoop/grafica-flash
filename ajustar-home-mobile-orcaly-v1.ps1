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
$Marker = "ORCALY_HOME_MOBILE_RESPONSIVE_V1"

if ([string]::IsNullOrWhiteSpace($ProjectRoot)) {
    $ProjectRoot = (Get-Location).Path
} else {
    $ProjectRoot = (Resolve-Path -LiteralPath $ProjectRoot).Path
}

$Timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
$BackupRoot = Join-Path $ProjectRoot (".orcaly-backups\home-mobile-responsive-" + $Timestamp)
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

function ReplaceOnce(
    [string]$Text,
    [string]$Needle,
    [string]$Replacement,
    [string]$Label
) {
    $count = CountExact $Text $Needle

    if ($count -ne 1) {
        throw ($Label + ": ancora encontrada " + $count + " vez(es), esperado 1.")
    }

    $index = $Text.IndexOf($Needle, [StringComparison]::Ordinal)

    return (
        $Text.Substring(0, $index) +
        $Replacement +
        $Text.Substring($index + $Needle.Length)
    )
}

function GitHeadBlob([string]$Relative) {
    $result = & git rev-parse ("HEAD:" + $Relative) 2>$null

    if ($LASTEXITCODE -ne 0) { return "" }

    return ([string]($result | Select-Object -First 1)).Trim().ToLowerInvariant()
}

function AssertHead([string]$Relative, [string]$Expected) {
    $actual = GitHeadBlob $Relative

    if ($actual -ne $Expected.ToLowerInvariant()) {
        throw (
            $Relative +
            " nao corresponde ao codigo auditado no GitHub. Esperado " +
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

    Ok ($Relative + " esta limpo para patch.")
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
            Copy-Item -LiteralPath $BackupMap[$relative] -Destination (FullPath $relative) -Force
            Warn ("Restaurado: " + $relative)
        }
    }
}

try {
    Write-Host ""
    Write-Host "ORCALY - HOME MOBILE RESPONSIVE V1" -ForegroundColor Cyan
    Write-Host "Ajuste completo da home para celular sem alterar o visual desktop." -ForegroundColor DarkCyan

    if (-not (Test-Path -LiteralPath (FullPath "package.json") -PathType Leaf)) {
        throw "Execute este script na raiz do projeto Orcaly."
    }

    Set-Location $ProjectRoot
    [IO.Directory]::CreateDirectory($BackupRoot) | Out-Null

    Step "Validando branch e arquivos auditados"

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

    $homeBefore = ReadUtf8 $homePath
    $chatBefore = ReadUtf8 $chatPath

    if ($homeBefore.Contains($Marker) -or $chatBefore.Contains($Marker)) {
        throw "O patch mobile V1 ja parece estar aplicado."
    }

    if (-not $SkipInitialBuild) {
        Step "Build inicial"
        & npm.cmd run build

        if ($LASTEXITCODE -ne 0) {
            throw "O projeto ja falha no build antes do patch. Nada foi alterado."
        }

        Ok "Build inicial passou."
    }

    Step "Criando backups"
    Backup "app/page.tsx"
    Backup "components/home/HomeAiChat.tsx"

    Step "Ajustando toda a home para mobile"

    $home = $homeBefore

    $home = ReplaceOnce $home `
        "// ORCALY_HOME_CONVERSION_V2" `
        "// ORCALY_HOME_CONVERSION_V2`r`n// ORCALY_HOME_MOBILE_RESPONSIVE_V1" `
        "Marcador mobile da home"

    $home = ReplaceOnce $home `
        "className={`${centered ? 'mx-auto text-center' : ''} max-w-4xl`}" `
        "className={`${centered ? 'mx-auto text-center' : ''} w-full min-w-0 max-w-4xl px-0.5 sm:px-0`}" `
        "SectionHeading seguro"

    $home = ReplaceOnce $home `
        "className={`mt-3 text-[2rem] font-black leading-[1.04] tracking-[-0.055em] sm:text-5xl lg:text-6xl `${" `
        "className={`mt-3 break-words text-[clamp(1.9rem,9vw,2.3rem)] font-black leading-[1.05] tracking-[-0.045em] sm:text-5xl sm:tracking-[-0.055em] lg:text-6xl `${" `
        "Titulos de secao responsivos"

    $home = ReplaceOnce $home `
        '<div className="relative mx-auto w-full max-w-xl">' `
        '<div className="relative mx-auto w-full min-w-0 max-w-xl px-0.5 sm:px-0">' `
        "Preview container"

    $home = ReplaceOnce $home `
        'className={`absolute -inset-5 rounded-[2.8rem] bg-gradient-to-br ${segment.gradient} opacity-20 blur-3xl`}' `
        'className={`absolute inset-x-0 -inset-y-5 rounded-[2.8rem] bg-gradient-to-br ${segment.gradient} opacity-20 blur-3xl sm:-inset-5`}' `
        "Glow do preview"

    $home = ReplaceOnce $home `
        '<div className="relative overflow-hidden rounded-[2rem] border border-white/80 bg-white p-2.5 shadow-[0_32px_80px_rgba(7,27,58,0.18)] sm:rounded-[2.5rem] sm:p-3">' `
        '<div className="relative w-full min-w-0 max-w-full overflow-hidden rounded-[1.65rem] border border-white/80 bg-white p-2 shadow-[0_24px_60px_rgba(7,27,58,0.16)] sm:rounded-[2.5rem] sm:p-3 sm:shadow-[0_32px_80px_rgba(7,27,58,0.18)]">' `
        "Moldura do preview"

    $home = ReplaceOnce $home `
        '<div className="grid gap-3 p-4 sm:gap-4 sm:p-5 lg:grid-cols-[0.78fr_1.22fr]">' `
        '<div className="grid min-w-0 gap-3 p-3 sm:gap-4 sm:p-5 lg:grid-cols-[0.78fr_1.22fr]">' `
        "Grid do preview"

    $home = ReplaceOnce $home `
        '<div className="flex items-center justify-between gap-3">' `
        '<div className="flex min-w-0 items-center justify-between gap-3">' `
        "Cabecalho interno do preview"

    $home = ReplaceOnce $home `
        '<div>`r`n                    <p className="text-[0.65rem] font-black uppercase tracking-[0.16em] text-white/45">' `
        '<div className="min-w-0">`r`n                    <p className="text-[0.65rem] font-black uppercase tracking-[0.16em] text-white/45">' `
        "Texto interno do preview"

    $home = ReplaceOnce $home `
        '<p className="mt-2 text-xl font-black">`r`n                      {segment.eyebrow}`r`n                    </p>' `
        '<p className="mt-2 break-words text-lg font-black leading-6 sm:text-xl">`r`n                      {segment.eyebrow}`r`n                    </p>' `
        "Eyebrow do preview"

    $home = ReplaceOnce $home `
        '<div className="absolute -bottom-5 left-4 right-4 flex items-center justify-between gap-3 rounded-2xl border border-blue-100 bg-white px-4 py-3 shadow-xl shadow-blue-950/10 sm:left-10 sm:right-10">' `
        '<div className="absolute -bottom-5 left-2 right-2 flex min-w-0 flex-wrap items-center justify-between gap-2 rounded-2xl border border-blue-100 bg-white px-3 py-3 shadow-xl shadow-blue-950/10 sm:left-10 sm:right-10 sm:gap-3 sm:px-4">' `
        "Badge inferior do preview"

    $home = ReplaceOnce $home `
        "className={`relative flex h-full flex-col rounded-[2rem] border p-5 sm:p-6 `${" `
        "className={`relative flex h-full min-w-0 flex-col rounded-[1.7rem] border p-5 sm:rounded-[2rem] sm:p-6 `${" `
        "PlanCard mobile"

    $home = ReplaceOnce $home `
        '<p className="mt-4 text-4xl font-black tracking-[-0.06em]">' `
        '<p className="mt-4 break-words text-3xl font-black tracking-[-0.05em] min-[360px]:text-4xl sm:tracking-[-0.06em]">' `
        "Preco dos planos"

    $home = ReplaceOnce $home `
        'className="w-full overflow-x-hidden bg-white pb-20 text-[#071b3a] sm:pb-0"' `
        'className="w-full min-w-0 overflow-x-hidden bg-white pb-20 text-[#071b3a] sm:pb-0"' `
        "Root da home"

    $home = ReplaceOnce $home `
        '.orcaly-section {`r`n          content-visibility: auto;`r`n          contain-intrinsic-size: 1px 820px;`r`n        }' `
        '.orcaly-section {`r`n          max-width: 100%;`r`n          overflow-x: clip;`r`n          content-visibility: auto;`r`n          contain-intrinsic-size: 1px 820px;`r`n        }`r`n`r`n        @media (max-width: 639px) {`r`n          .orcaly-mobile-break {`r`n            overflow-wrap: anywhere;`r`n            word-break: normal;`r`n          }`r`n        }' `
        "CSS mobile da home"

    $home = ReplaceOnce $home `
        '<div className="mx-auto flex h-[68px] w-full max-w-7xl items-center justify-between gap-3 px-4 sm:h-[76px] sm:px-6 lg:px-8">' `
        '<div className="mx-auto flex h-[68px] w-full min-w-0 max-w-7xl items-center justify-between gap-2 px-3 sm:h-[76px] sm:gap-3 sm:px-6 lg:px-8">' `
        "Header mobile"

    $home = ReplaceOnce $home `
        'className="h-10 w-auto object-contain sm:h-12"' `
        'className="h-9 w-auto max-w-[150px] object-contain sm:h-12 sm:max-w-none"' `
        "Logo mobile"

    $home = ReplaceOnce $home `
        'className="rounded-[1.8rem] border border-blue-100 bg-white p-3 shadow-2xl shadow-blue-950/20"' `
        'className="max-h-[calc(100dvh-88px)] overflow-y-auto rounded-[1.5rem] border border-blue-100 bg-white p-3 shadow-2xl shadow-blue-950/20 sm:rounded-[1.8rem]"' `
        "Menu mobile"

    $home = ReplaceOnce $home `
        '<div className="relative mx-auto grid max-w-7xl gap-12 px-4 pb-20 pt-12 sm:px-6 sm:pb-24 sm:pt-16 lg:grid-cols-[1fr_0.94fr] lg:items-center lg:px-8 lg:pb-28 lg:pt-24">' `
        '<div className="relative mx-auto grid w-full min-w-0 max-w-7xl gap-8 px-3 pb-16 pt-10 sm:gap-12 sm:px-6 sm:pb-24 sm:pt-16 lg:grid-cols-[1fr_0.94fr] lg:items-center lg:px-8 lg:pb-28 lg:pt-24">' `
        "Hero container"

    $home = ReplaceOnce $home `
        '<div className="orcaly-fade-up text-center lg:text-left">' `
        '<div className="orcaly-fade-up min-w-0 text-center lg:text-left">' `
        "Hero texto"

    $home = ReplaceOnce $home `
        '<h1 className="mx-auto mt-6 max-w-4xl text-[2.55rem] font-black leading-[0.99] tracking-[-0.067em] text-[#071b3a] sm:text-6xl lg:mx-0 lg:text-[4.6rem]">' `
        '<h1 className="orcaly-mobile-break mx-auto mt-6 max-w-[22ch] text-[clamp(2.05rem,10vw,2.55rem)] font-black leading-[1.01] tracking-[-0.05em] text-[#071b3a] sm:max-w-4xl sm:text-6xl sm:tracking-[-0.067em] lg:mx-0 lg:text-[4.6rem]">' `
        "Hero h1"

    $home = ReplaceOnce $home `
        '<div className="mt-7 grid grid-cols-3 gap-2 sm:max-w-xl">' `
        '<div className="mx-auto mt-7 grid w-full max-w-xl grid-cols-1 gap-2 min-[360px]:grid-cols-3 lg:mx-0">' `
        "Metricas hero"

    $home = ReplaceOnce $home `
        '<div className="orcaly-fade-up orcaly-float pb-4 sm:pb-0">' `
        '<div className="orcaly-fade-up orcaly-float min-w-0 pb-4 sm:pb-0">' `
        "Preview hero wrapper"

    $home = ReplaceOnce $home `
        '<div className="relative mx-auto w-full max-w-7xl px-4 pb-6 sm:px-6 lg:px-8">' `
        '<div className="relative mx-auto w-full min-w-0 max-w-7xl px-3 pb-6 sm:px-6 lg:px-8">' `
        "Aviso Mercado Pago"

    $home = ReplaceOnce $home `
        '<div className="mx-auto grid max-w-7xl grid-cols-2 gap-px bg-blue-100 md:grid-cols-4">' `
        '<div className="mx-auto grid w-full min-w-0 max-w-7xl grid-cols-1 gap-px bg-blue-100 min-[360px]:grid-cols-2 md:grid-cols-4">' `
        "Faixa de beneficios"

    $home = $home.Replace(
        'className="orcaly-section scroll-mt-24 bg-white px-4 py-16 sm:px-6 sm:py-24 lg:px-8"',
        'className="orcaly-section scroll-mt-24 bg-white px-3 py-14 sm:px-6 sm:py-24 lg:px-8"'
    )

    $home = ReplaceOnce $home `
        'className="orcaly-section scroll-mt-24 overflow-hidden bg-[#071b3a] px-4 py-16 text-white sm:px-6 sm:py-24 lg:px-8"' `
        'className="orcaly-section scroll-mt-24 overflow-hidden bg-[#071b3a] px-3 py-14 text-white sm:px-6 sm:py-24 lg:px-8"' `
        "Recursos mobile"

    $home = ReplaceOnce $home `
        'className="orcaly-section scroll-mt-24 bg-[#f5f8ff] px-4 py-16 sm:px-6 sm:py-24 lg:px-8"' `
        'className="orcaly-section scroll-mt-24 bg-[#f5f8ff] px-3 py-14 sm:px-6 sm:py-24 lg:px-8"' `
        "Planos mobile"

    $home = ReplaceOnce $home `
        '<div className="flex gap-2 overflow-x-auto pb-1">' `
        '<div className="flex max-w-full snap-x snap-mandatory gap-2 overflow-x-auto overscroll-x-contain pb-2">' `
        "Tabs de segmentos"

    $home = ReplaceOnce $home `
        "className={`flex shrink-0 items-center gap-2 rounded-2xl px-4 py-3 text-sm font-black transition `${" `
        "className={`flex max-w-[78vw] shrink-0 snap-start items-center gap-2 rounded-2xl px-4 py-3 text-sm font-black transition `${" `
        "Botao de segmento"

    $home = ReplaceOnce $home `
        '<div className="flex items-start gap-4 sm:gap-6">' `
        '<div className="flex min-w-0 flex-col items-start gap-4 min-[360px]:flex-row sm:gap-6">' `
        "Cards de beneficios"

    $home = ReplaceOnce $home `
        '<h3 className="text-2xl font-black tracking-[-0.035em] sm:text-3xl">' `
        '<h3 className="orcaly-mobile-break text-2xl font-black tracking-[-0.03em] sm:text-3xl sm:tracking-[-0.035em]">' `
        "Titulo dos beneficios"

    $home = ReplaceOnce $home `
        '<div className="mt-3 grid grid-cols-3 gap-2">' `
        '<div className="mt-3 grid grid-cols-1 gap-2 min-[360px]:grid-cols-3">' `
        "Comparacao de planos mobile"

    $home = ReplaceOnce $home `
        'className={`rounded-xl px-2 py-2.5 text-center text-[0.65rem] font-black `${' `
        'className={`orcaly-mobile-break rounded-xl px-2 py-2.5 text-center text-[0.65rem] font-black leading-4 ${' `
        "Nome dos planos mobile"

    $home = ReplaceOnce $home `
        '<div className="mt-10 grid gap-5 overflow-hidden rounded-[2rem] bg-[#071b3a] p-5 text-white sm:p-8 lg:grid-cols-[1.05fr_0.95fr] lg:items-center">' `
        '<div className="mt-10 grid min-w-0 gap-5 overflow-hidden rounded-[1.7rem] bg-[#071b3a] p-4 text-white min-[360px]:p-5 sm:rounded-[2rem] sm:p-8 lg:grid-cols-[1.05fr_0.95fr] lg:items-center">' `
        "Bloco link profissional"

    $home = ReplaceOnce $home `
        'className="mt-7 inline-flex max-w-full items-center gap-3 rounded-2xl bg-white px-5 py-4 font-black text-[#05245c] shadow-xl shadow-black/15 transition hover:-translate-y-0.5"' `
        'className="mt-7 flex w-full max-w-full items-center justify-center gap-3 rounded-2xl bg-white px-4 py-4 font-black text-[#05245c] shadow-xl shadow-black/15 transition hover:-translate-y-0.5 sm:inline-flex sm:w-auto sm:px-5"' `
        "Email contato mobile"

    $home = ReplaceOnce $home `
        '<footer className="border-t border-blue-100 bg-[#f7faff] px-4 py-10 sm:px-6 lg:px-8">' `
        '<footer className="border-t border-blue-100 bg-[#f7faff] px-3 py-10 sm:px-6 lg:px-8">' `
        "Footer mobile"

    $home = ReplaceOnce $home `
        'className="mt-4 inline-flex items-center gap-2 text-sm font-black text-[#05245c] hover:underline"' `
        'className="mt-4 inline-flex max-w-full items-center gap-2 break-all text-sm font-black text-[#05245c] hover:underline"' `
        "Email footer"

    $home = ReplaceOnce $home `
        '<div className="fixed inset-x-0 bottom-0 z-40 border-t border-blue-100 bg-white/95 p-3 shadow-2xl shadow-blue-950/15 backdrop-blur sm:hidden">' `
        '<div className="fixed inset-x-0 bottom-0 z-40 border-t border-blue-100 bg-white/95 px-2 pt-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] shadow-2xl shadow-blue-950/15 backdrop-blur sm:hidden">' `
        "Barra inferior safe area"

    WriteUtf8 $homePath $home
    $Changed.Add("app/page.tsx")
    Ok "Home ajustada."

    Step "Ajustando assistente flutuante para viewport mobile"

    $chat = $chatBefore

    $chat = ReplaceOnce $chat `
        "// ORCALY_HOME_AI_CHAT_V2" `
        "// ORCALY_HOME_AI_CHAT_V2`r`n// ORCALY_HOME_MOBILE_RESPONSIVE_V1" `
        "Marcador mobile do chat"

    $chat = ReplaceOnce $chat `
        'className="orcaly-home-chat-enter-v2 fixed inset-x-3 bottom-[5.8rem] z-[70] flex max-h-[min(76vh,680px)] flex-col overflow-hidden rounded-[1.8rem] border border-blue-100 bg-white shadow-2xl shadow-blue-950/25 sm:inset-x-auto sm:bottom-6 sm:right-6 sm:h-[650px] sm:max-h-[calc(100vh-3rem)] sm:w-[430px]"' `
        'className="orcaly-home-chat-enter-v2 fixed inset-x-2 bottom-[5.4rem] z-[70] flex max-h-[calc(100dvh-6.4rem)] min-w-0 flex-col overflow-hidden rounded-[1.4rem] border border-blue-100 bg-white shadow-2xl shadow-blue-950/25 min-[380px]:inset-x-3 min-[380px]:rounded-[1.8rem] sm:inset-x-auto sm:bottom-6 sm:right-6 sm:h-[650px] sm:max-h-[calc(100dvh-3rem)] sm:w-[min(430px,calc(100vw-3rem))]"' `
        "Janela do chat mobile"

    $chat = ReplaceOnce $chat `
        '<header className="relative overflow-hidden bg-[#061a36] px-5 py-5 text-white">' `
        '<header className="relative overflow-hidden bg-[#061a36] px-4 py-4 text-white min-[380px]:px-5 min-[380px]:py-5">' `
        "Header do chat"

    $chat = ReplaceOnce $chat `
        'className="min-h-0 flex-1 space-y-4 overflow-y-auto bg-[#f6f9ff] px-4 py-5"' `
        'className="min-h-0 min-w-0 flex-1 space-y-4 overflow-y-auto overflow-x-hidden bg-[#f6f9ff] px-3 py-4 min-[380px]:px-4 min-[380px]:py-5"' `
        "Mensagens do chat"

    $chat = ReplaceOnce $chat `
        'className={`max-w-[84%] whitespace-pre-wrap rounded-[1.35rem] px-4 py-3 text-sm font-semibold leading-6 shadow-sm ${' `
        'className={`max-w-[86%] break-words whitespace-pre-wrap rounded-[1.25rem] px-3 py-3 text-sm font-semibold leading-6 shadow-sm min-[380px]:max-w-[84%] min-[380px]:rounded-[1.35rem] min-[380px]:px-4 ${' `
        "Baloes do chat"

    $chat = ReplaceOnce $chat `
        '<div className="border-t border-blue-100 bg-white px-4 py-4">' `
        '<div className="min-w-0 border-t border-blue-100 bg-white px-3 py-3 min-[380px]:px-4 min-[380px]:py-4">' `
        "Rodape do chat"

    $chat = ReplaceOnce $chat `
        '<div className="mb-3 flex gap-2 overflow-x-auto pb-1 sm:flex-wrap sm:overflow-visible">' `
        '<div className="mb-3 flex max-w-full gap-2 overflow-x-auto overscroll-x-contain pb-1 sm:flex-wrap sm:overflow-visible">' `
        "Sugestoes do chat"

    $chat = ReplaceOnce $chat `
        '<div className="fixed bottom-[5.8rem] right-4 z-[70] sm:bottom-6 sm:right-6">' `
        '<div className="fixed bottom-[5.4rem] right-3 z-[70] sm:bottom-6 sm:right-6">' `
        "Botao flutuante chat"

    $chat = ReplaceOnce $chat `
        'className="orcaly-home-chat-pulse-v2 group relative grid h-16 w-16 place-items-center rounded-[1.4rem] border-4 border-white bg-[#05245c] text-3xl shadow-2xl shadow-blue-950/25 transition hover:-translate-y-1 hover:scale-105"' `
        'className="orcaly-home-chat-pulse-v2 group relative grid h-14 w-14 place-items-center rounded-[1.25rem] border-4 border-white bg-[#05245c] text-2xl shadow-2xl shadow-blue-950/25 transition hover:-translate-y-1 hover:scale-105 min-[380px]:h-16 min-[380px]:w-16 min-[380px]:rounded-[1.4rem] min-[380px]:text-3xl"' `
        "Tamanho botao chat"

    WriteUtf8 $chatPath $chat
    $Changed.Add("components/home/HomeAiChat.tsx")
    Ok "Chat ajustado."

    Step "Validacao estrutural"

    $homeAfter = ReadUtf8 $homePath
    $chatAfter = ReadUtf8 $chatPath

    $checks = @(
        @($homeAfter.Contains($Marker), "marcador na home"),
        @($chatAfter.Contains($Marker), "marcador no chat"),
        @($homeAfter.Contains("text-[clamp(2.05rem,10vw,2.55rem)]"), "hero fluido"),
        @($homeAfter.Contains("min-[360px]:grid-cols-3"), "grids de celular pequeno"),
        @($homeAfter.Contains("100dvh"), "menu com viewport dinamica"),
        @($homeAfter.Contains("safe-area-inset-bottom"), "safe area inferior"),
        @($chatAfter.Contains("100dvh"), "chat com viewport dinamica"),
        @($chatAfter.Contains("sm:w-[min(430px,calc(100vw-3rem))]"), "chat limitado a viewport")
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
        throw "git diff --check encontrou problema no patch."
    }

    Step "Lint dos dois arquivos alterados"
    & npx.cmd eslint "app/page.tsx" "components/home/HomeAiChat.tsx"

    if ($LASTEXITCODE -ne 0) {
        Warn "O lint encontrou problemas. O build final sera a trava de compilacao."
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

    Step "Resumo"
    Write-Host ""
    Write-Host "HOME MOBILE RESPONSIVE V1 APLICADA" -ForegroundColor Green
    Write-Host ""
    Write-Host "Ajustado:"
    Write-Host " - header e logo"
    Write-Host " - menu mobile"
    Write-Host " - hero e titulos"
    Write-Host " - preview do painel"
    Write-Host " - metricas e cards"
    Write-Host " - segmentos"
    Write-Host " - recursos"
    Write-Host " - planos e comparacao"
    Write-Host " - como funciona"
    Write-Host " - contato e footer"
    Write-Host " - barra fixa inferior"
    Write-Host " - assistente de IA"
    Write-Host ""
    Write-Host "Breakpoints reforcados para 320px, 360px, 390px e tablets."
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
