param(
    [string]$ProjectRoot = ""
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

try {
    [Console]::OutputEncoding = New-Object System.Text.UTF8Encoding($false)
    $OutputEncoding = New-Object System.Text.UTF8Encoding($false)
} catch {}

$Utf8NoBom = New-Object System.Text.UTF8Encoding($false)

if ([string]::IsNullOrWhiteSpace($ProjectRoot)) {
    $ProjectRoot = (Get-Location).Path
} else {
    $ProjectRoot = (Resolve-Path -LiteralPath $ProjectRoot).Path
}

$Target = Join-Path $ProjectRoot "lib\order-whatsapp.ts"
$Timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
$BackupRoot = Join-Path $ProjectRoot (".orcaly-backups\whatsapp-sem-emojis-" + $Timestamp)
$BackupFile = Join-Path $BackupRoot "lib\order-whatsapp.ts"

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

function Restore {
    if (Test-Path -LiteralPath $BackupFile -PathType Leaf) {
        Copy-Item -LiteralPath $BackupFile -Destination $Target -Force
        Warn "Rollback concluido."
    }
}

try {
    Write-Host ""
    Write-Host "ORCALY - REMOVER EMOJIS DO WHATSAPP V5" -ForegroundColor Cyan
    Write-Host "Remove placeholders, mapa de emojis e percent-encoding especial." -ForegroundColor DarkCyan

    if (-not (Test-Path -LiteralPath (Join-Path $ProjectRoot "package.json") -PathType Leaf)) {
        throw "Execute este script na raiz do projeto Orcaly."
    }

    if (-not (Test-Path -LiteralPath $Target -PathType Leaf)) {
        throw "lib/order-whatsapp.ts nao encontrado."
    }

    Set-Location $ProjectRoot

    $current = [IO.File]::ReadAllText($Target)

    if ($current.Contains("ORCALY_ORDER_WHATSAPP_TEXT_ONLY_V5")) {
        Ok "A versao sem emojis V5 ja esta aplicada."
        exit 0
    }

    if (-not $current.Contains("ORCALY_ORDER_WHATSAPP_PERCENT_EMOJI_V3")) {
        throw "A versao V3 com placeholders nao foi identificada."
    }

    if (-not $current.Contains("__EMOJI_")) {
        throw "Nenhum placeholder de emoji foi encontrado. O arquivo esta em um estado inesperado."
    }

    Step "Build inicial"
    & npm.cmd run build

    if ($LASTEXITCODE -ne 0) {
        throw "O projeto ja falha no build antes desta correcao. Nada foi alterado."
    }

    Ok "Build inicial passou."

    Step "Criando backup"
    [IO.Directory]::CreateDirectory((Split-Path -Parent $BackupFile)) | Out-Null
    Copy-Item -LiteralPath $Target -Destination $BackupFile -Force
    Ok ("Backup: " + $BackupFile)

    Step "Removendo placeholders de emojis"

    $text = [IO.File]::ReadAllText($Target)

    # Remove placeholders da mensagem.
    $text = [regex]::Replace(
        $text,
        "__EMOJI_[A-Z0-9_]+__\s*",
        ""
    )

    # Remove o bloco completo do mapa de emojis.
    $mapPattern = '(?s)\r?\n\s*const emojiUrlMap: Record<string, string> = \{.*?\r?\n\s*\}\r?\n'
    $mapMatches = [regex]::Matches($text, $mapPattern)

    if ($mapMatches.Count -ne 1) {
        throw ("Bloco emojiUrlMap encontrado " + $mapMatches.Count + " vez(es), esperado 1.")
    }

    $text = [regex]::Replace(
        $text,
        $mapPattern,
        "`r`n",
        1
    )

    # Remove o reduce que reinjetava emojis na URL.
    $reducePattern = '(?s)\r?\n\s*const finalText = Object\.entries\(emojiUrlMap\)\.reduce\(.*?\r?\n\s*\)\r?\n'
    $reduceMatches = [regex]::Matches($text, $reducePattern)

    if ($reduceMatches.Count -ne 1) {
        throw ("Bloco finalText encontrado " + $reduceMatches.Count + " vez(es), esperado 1.")
    }

    $text = [regex]::Replace(
        $text,
        $reducePattern,
        "`r`n",
        1
    )

    # Troca a URL final de finalText para encodeURIComponent(message).
    $oldReturn = 'return `https://wa.me/${phone}?text=${finalText}`'
    $newReturn = 'return `https://wa.me/${phone}?text=${encodeURIComponent(message)}`'

    if (-not $text.Contains($oldReturn)) {
        throw "Return com finalText nao encontrado."
    }

    $text = $text.Replace($oldReturn, $newReturn)

    # Remove a variável encodedText, que não é mais necessária.
    $encodedPattern = '\r?\n\s*const encodedText = encodeURIComponent\(message\)\r?\n'
    $encodedMatches = [regex]::Matches($text, $encodedPattern)

    if ($encodedMatches.Count -ne 1) {
        throw ("encodedText encontrado " + $encodedMatches.Count + " vez(es), esperado 1.")
    }

    $text = [regex]::Replace(
        $text,
        $encodedPattern,
        "`r`n",
        1
    )

    # Marca a versão corrigida.
    $marker = "// ORCALY_ORDER_WHATSAPP_TEXT_ONLY_V5"

    if (-not $text.Contains($marker)) {
        $text = $text.Replace(
            "// ORCALY_ORDER_WHATSAPP_PERCENT_EMOJI_V3",
            "// ORCALY_ORDER_WHATSAPP_PERCENT_EMOJI_V3`r`n" + $marker
        )
    }

    [IO.File]::WriteAllText($Target, $text, $Utf8NoBom)

    Step "Validando ausencia total de emojis/placeholders"

    $after = [IO.File]::ReadAllText($Target)

    if ($after.Contains("__EMOJI_")) {
        throw "Ainda existe placeholder __EMOJI_ no arquivo."
    }

    if ($after.Contains("emojiUrlMap")) {
        throw "Ainda existe emojiUrlMap no arquivo."
    }

    if ($after.Contains("finalText")) {
        throw "Ainda existe finalText do encoder de emojis."
    }

    if (
        $after.Contains("%F0%9F") -or
        $after.Contains("%E2%8F") -or
        $after.Contains("%EF%B8%8F")
    ) {
        throw "Ainda existe sequencia percent-encoded de emoji."
    }

    if (-not $after.Contains('return `https://wa.me/${phone}?text=${encodeURIComponent(message)}`')) {
        throw "A URL simples do WhatsApp nao foi encontrada."
    }

    if (-not $after.Contains("PEDIDO #")) {
        throw "Numero do pedido foi perdido."
    }

    if (-not $after.Contains("Horário da compra")) {
        throw "Horario da compra foi perdido."
    }

    if (-not $after.Contains("PAGAMENTO E VALORES")) {
        throw "Resumo financeiro foi perdido."
    }

    Ok "Nenhum placeholder ou encoder especial de emoji permaneceu."

    Step "Mostrando trechos finais"
    Select-String -Path $Target -Pattern "TEXT_ONLY_V5|__EMOJI_|emojiUrlMap|%F0%9F|PEDIDO #|Horário da compra|PAGAMENTO E VALORES"

    Step "Lint"
    & npx.cmd eslint "lib/order-whatsapp.ts"

    if ($LASTEXITCODE -ne 0) {
        throw "Lint falhou."
    }

    Ok "Lint passou."

    Step "Build final"
    & npm.cmd run build

    if ($LASTEXITCODE -ne 0) {
        throw "Build final falhou."
    }

    Ok "Build final passou."

    Write-Host ""
    Write-Host "============================================================" -ForegroundColor Green
    Write-Host " WHATSAPP SEM EMOJIS V5 APLICADO" -ForegroundColor Green
    Write-Host "============================================================" -ForegroundColor Green
    Write-Host ""
    Write-Host "Agora a mensagem usa somente texto."
    Write-Host "Sem __EMOJI_, sem emojiUrlMap e sem percent-encoding manual."
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
