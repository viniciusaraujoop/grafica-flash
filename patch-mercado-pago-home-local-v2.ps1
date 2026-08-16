param(
    [string]$RepoRoot = ""
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

try {
    [Console]::OutputEncoding = New-Object System.Text.UTF8Encoding($false)
    $OutputEncoding = New-Object System.Text.UTF8Encoding($false)
} catch {}

function Resolve-OrcalyRepo {
    param([string]$RequestedRoot)

    $candidates = @()

    if ($RequestedRoot) {
        $candidates += $RequestedRoot
    }

    $candidates += (Get-Location).Path
    $candidates += "C:\Users\arauj\grafica-flash"

    foreach ($candidate in ($candidates | Select-Object -Unique)) {
        if (-not $candidate) { continue }

        if (
            (Test-Path (Join-Path $candidate "package.json")) -and
            (Test-Path (Join-Path $candidate "app\page.tsx")) -and
            (Test-Path (Join-Path $candidate "lib\business-types.ts"))
        ) {
            return (Resolve-Path $candidate).Path
        }
    }

    throw "Não encontrei o projeto Orçaly. Execute o script dentro de C:\Users\arauj\grafica-flash."
}

function Get-TextFileState {
    param([string]$Path)

    $bytes = [System.IO.File]::ReadAllBytes($Path)
    $hasBom = (
        $bytes.Length -ge 3 -and
        $bytes[0] -eq 0xEF -and
        $bytes[1] -eq 0xBB -and
        $bytes[2] -eq 0xBF
    )

    $offset = if ($hasBom) { 3 } else { 0 }
    $utf8 = New-Object System.Text.UTF8Encoding($false, $true)

    try {
        $text = $utf8.GetString($bytes, $offset, $bytes.Length - $offset)
    }
    catch {
        throw "O arquivo '$Path' não está em UTF-8 válido. Nenhuma alteração será feita."
    }

    return [pscustomobject]@{
        Text = $text
        HasBom = $hasBom
        NewLine = if ($text.Contains("`r`n")) { "`r`n" } else { "`n" }
    }
}

function Write-TextFilePreservingBom {
    param(
        [string]$Path,
        [string]$Text,
        [bool]$HasBom
    )

    $utf8 = New-Object System.Text.UTF8Encoding($false)
    $contentBytes = $utf8.GetBytes($Text)

    if ($HasBom) {
        $bom = [byte[]](0xEF, 0xBB, 0xBF)
        $allBytes = New-Object byte[] ($bom.Length + $contentBytes.Length)
        [System.Array]::Copy($bom, 0, $allBytes, 0, $bom.Length)
        [System.Array]::Copy($contentBytes, 0, $allBytes, $bom.Length, $contentBytes.Length)
        [System.IO.File]::WriteAllBytes($Path, $allBytes)
    }
    else {
        [System.IO.File]::WriteAllBytes($Path, $contentBytes)
    }
}

function Create-Backup {
    param(
        [string]$Root,
        [string[]]$RelativeFiles
    )

    $timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
    $backupRoot = Join-Path $Root ".orcaly-backups\mercado-pago-home-$timestamp"

    foreach ($relative in $RelativeFiles) {
        $source = Join-Path $Root ($relative -replace '/', '\')
        $destination = Join-Path $backupRoot ($relative -replace '/', '\')
        $destinationDir = Split-Path $destination -Parent

        New-Item -ItemType Directory -Path $destinationDir -Force | Out-Null
        Copy-Item -LiteralPath $source -Destination $destination -Force
    }

    return $backupRoot
}

function Count-Occurrences {
    param(
        [string]$Text,
        [string]$Needle
    )

    if ([string]::IsNullOrEmpty($Needle)) { return 0 }

    $count = 0
    $index = 0

    while ($true) {
        $found = $Text.IndexOf($Needle, $index, [System.StringComparison]::Ordinal)

        if ($found -lt 0) { break }

        $count++
        $index = $found + $Needle.Length
    }

    return $count
}

function Find-HeroInsertionIndex {
    param([string]$Content)

    # Não depende de classes Tailwind, recuos ou CRLF/LF.
    # Procura o conteúdo semântico único do bloco de segmentos.
    $markerCandidates = @(
        "Orçaly {item}",
        "['Food', 'Gráfica', 'Beauty', 'Assistência', 'Loja', 'Serviços']",
        "['Food','Gráfica','Beauty','Assistência','Loja','Serviços']"
    )

    $markerIndex = -1
    $markerUsed = ""

    foreach ($marker in $markerCandidates) {
        $idx = $Content.IndexOf($marker, [System.StringComparison]::Ordinal)

        if ($idx -ge 0) {
            $markerIndex = $idx
            $markerUsed = $marker
            break
        }
    }

    if ($markerIndex -lt 0) {
        throw "[HOME] Não encontrei o bloco dos segmentos do hero por nenhum marcador seguro."
    }

    if ((Count-Occurrences -Text $Content -Needle $markerUsed) -ne 1) {
        throw "[HOME] O marcador '$markerUsed' aparece mais de uma vez. Abortando para evitar inserir no lugar errado."
    }

    # A partir do marcador, procura o encerramento do map.
    $mapCloseCandidates = @(
        "))}",
        ")) }",
        ")}"
    )

    $mapCloseIndex = -1
    $mapCloseLength = 0

    foreach ($candidate in $mapCloseCandidates) {
        $idx = $Content.IndexOf(
            $candidate,
            $markerIndex,
            [System.StringComparison]::Ordinal
        )

        if ($idx -ge 0) {
            $mapCloseIndex = $idx
            $mapCloseLength = $candidate.Length
            break
        }
    }

    if ($mapCloseIndex -lt 0) {
        throw "[HOME] Encontrei os segmentos, mas não consegui determinar o fim do .map()."
    }

    # O primeiro </div> depois do fechamento do map deve ser o container
    # dos chips. Limitamos a busca a 800 caracteres para não atravessar
    # estruturas distantes da home.
    $searchStart = $mapCloseIndex + $mapCloseLength
    $closingDivIndex = $Content.IndexOf(
        "</div>",
        $searchStart,
        [System.StringComparison]::Ordinal
    )

    if ($closingDivIndex -lt 0 -or ($closingDivIndex - $searchStart) -gt 800) {
        throw "[HOME] Não consegui confirmar com segurança o fechamento do container dos segmentos."
    }

    return ($closingDivIndex + "</div>".Length)
}

$root = Resolve-OrcalyRepo -RequestedRoot $RepoRoot
Set-Location $root

$homeRelative = "app/page.tsx"
$businessRelative = "lib/business-types.ts"

$homePath = Join-Path $root "app\page.tsx"
$businessPath = Join-Path $root "lib\business-types.ts"

Write-Host ""
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host " ORÇALY - PATCH MERCADO PAGO (ESTRUTURA LOCAL)" -ForegroundColor Cyan
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Repositório: $root"
Write-Host "Escopo permitido:"
Write-Host "  - $homeRelative"
Write-Host "  - $businessRelative"
Write-Host ""

$homeState = Get-TextFileState $homePath
$businessState = Get-TextFileState $businessPath

$homeContent = $homeState.Text
$businessContent = $businessState.Text

$homeChanged = $false
$businessChanged = $false

$homeNoticeTitle = "Pagamentos online processados exclusivamente pelo Mercado Pago."

if ($homeContent.Contains($homeNoticeTitle)) {
    Write-Host "[HOME] Aviso do Mercado Pago já existe. Nada será duplicado." -ForegroundColor Yellow
}
else {
    $insertAt = Find-HeroInsertionIndex -Content $homeContent

    $nl = $homeState.NewLine

    # Apenas acrescenta texto usando tipografia já existente.
    # Não altera botões, cards, grid, hero, animação ou seções existentes.
    $noticeLines = @(
        "",
        "",
        '            <p className="mx-auto mt-4 max-w-3xl text-center text-xs font-semibold leading-5 text-[#607895] lg:mx-0 lg:text-left sm:text-sm">',
        '              <strong className="font-black text-[#05245c]">Pagamentos online processados exclusivamente pelo Mercado Pago.</strong>{'' ''}',
        '              Os recebimentos online realizados pelo marketplace do Orçaly são processados pela infraestrutura do Mercado Pago, oferecendo mais segurança e confiabilidade nas transações.',
        '            </p>'
    )

    $notice = $noticeLines -join $nl

    $homeContent = (
        $homeContent.Substring(0, $insertAt) +
        $notice +
        $homeContent.Substring($insertAt)
    )

    if ((Count-Occurrences -Text $homeContent -Needle $homeNoticeTitle) -ne 1) {
        throw "[HOME] A validação pós-inserção falhou. Nenhum arquivo será gravado."
    }

    $homeChanged = $true
    Write-Host "[HOME] Aviso preparado no ponto estrutural dos segmentos." -ForegroundColor Green
}

$oldAnswer = "Nesta versão, o pagamento é combinado com a empresa pelo WhatsApp."
$newAnswer = "Sim. Os pagamentos online do marketplace são processados pelo Mercado Pago, com Pix e cartões quando a empresa possui a integração conectada."

if ($businessContent.Contains($newAnswer)) {
    Write-Host "[FOOD] FAQ já está atualizado. Nada será duplicado." -ForegroundColor Yellow
}
elseif ($businessContent.Contains($oldAnswer)) {
    if ((Count-Occurrences -Text $businessContent -Needle $oldAnswer) -ne 1) {
        throw "[FOOD] A frase antiga aparece mais de uma vez. Abortando para evitar substituição indevida."
    }

    $businessContent = $businessContent.Replace($oldAnswer, $newAnswer)

    if (
        $businessContent.Contains($oldAnswer) -or
        (Count-Occurrences -Text $businessContent -Needle $newAnswer) -ne 1
    ) {
        throw "[FOOD] A validação da troca do FAQ falhou. Nenhum arquivo será gravado."
    }

    $businessChanged = $true
    Write-Host "[FOOD] Nova resposta de pagamento preparada." -ForegroundColor Green
}
else {
    throw "[FOOD] Não encontrei nem a frase antiga nem a versão nova. Nenhum arquivo será gravado."
}

if (-not $homeChanged -and -not $businessChanged) {
    Write-Host ""
    Write-Host "O patch já está aplicado. Nenhuma alteração foi necessária." -ForegroundColor Yellow
    exit 0
}

Write-Host ""
Write-Host "Criando backup antes de gravar..." -ForegroundColor Cyan
$backupRoot = Create-Backup -Root $root -RelativeFiles @(
    $homeRelative,
    $businessRelative
)
Write-Host "Backup: $backupRoot" -ForegroundColor DarkGray

try {
    if ($homeChanged) {
        Write-TextFilePreservingBom `
            -Path $homePath `
            -Text $homeContent `
            -HasBom $homeState.HasBom
    }

    if ($businessChanged) {
        Write-TextFilePreservingBom `
            -Path $businessPath `
            -Text $businessContent `
            -HasBom $businessState.HasBom
    }

    Write-Host ""
    Write-Host "Executando git diff --check..." -ForegroundColor Cyan
    & git diff --check -- $homeRelative $businessRelative

    if ($LASTEXITCODE -ne 0) {
        throw "git diff --check encontrou problema."
    }

    Write-Host "[OK] git diff --check passou." -ForegroundColor Green

    Write-Host ""
    Write-Host "Diff das duas alterações:" -ForegroundColor Cyan
    & git --no-pager diff -- $homeRelative $businessRelative

    Write-Host ""
    Write-Host "============================================================" -ForegroundColor Green
    Write-Host " PATCH CONCLUÍDO" -ForegroundColor Green
    Write-Host "============================================================" -ForegroundColor Green
    Write-Host ""
    Write-Host "Nenhum commit, push, migration ou alteração no Supabase foi executado."
    Write-Host "Backup preservado em: $backupRoot"
}
catch {
    Write-Host ""
    Write-Host "[ERRO] $($_.Exception.Message)" -ForegroundColor Red
    Write-Host "Restaurando os dois arquivos pelo backup..." -ForegroundColor Yellow

    Copy-Item `
        -LiteralPath (Join-Path $backupRoot "app\page.tsx") `
        -Destination $homePath `
        -Force

    Copy-Item `
        -LiteralPath (Join-Path $backupRoot "lib\business-types.ts") `
        -Destination $businessPath `
        -Force

    Write-Host "Arquivos restaurados. O projeto voltou ao estado anterior ao patch." -ForegroundColor Green
    throw
}
