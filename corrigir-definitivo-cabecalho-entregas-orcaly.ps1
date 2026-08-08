Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$Root = (Get-Location).Path
$ExpectedBranch = "feature/vitrine-marketplace"
$RelativePath = "components\food\DeliveriesManager.tsx"
$Source = Join-Path $Root $RelativePath
$Timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
$Backup = "$Source.utf8-title-$Timestamp.backup"

if (-not (Test-Path -LiteralPath (Join-Path $Root "package.json"))) {
    throw "Execute este script na raiz do projeto Orçaly."
}

$Branch = (& git branch --show-current | Out-String).Trim()

if ($Branch -ne $ExpectedBranch) {
    throw "Branch atual: $Branch. Use $ExpectedBranch."
}

if (-not (Test-Path -LiteralPath $Source)) {
    throw "Arquivo não encontrado: $RelativePath"
}

Copy-Item -LiteralPath $Source -Destination $Backup -Force

function Restore-Backup {
    Write-Host ""
    Write-Host "Restaurando o arquivo anterior..." -ForegroundColor Yellow

    if (Test-Path -LiteralPath $Backup) {
        Copy-Item -LiteralPath $Backup -Destination $Source -Force
    }
}

try {
    $Utf8SemBom = New-Object System.Text.UTF8Encoding($false)
    $Content = [System.IO.File]::ReadAllText(
        $Source,
        [System.Text.Encoding]::UTF8
    )

    Write-Host "==> Restaurando a codificação UTF-8" -ForegroundColor Cyan

    try {
        [System.Text.Encoding]::RegisterProvider(
            [System.Text.CodePagesEncodingProvider]::Instance
        )
    }
    catch {
        # O Windows PowerShell 5.1 já possui a página de código necessária.
    }

    $Windows1252 = [System.Text.Encoding]::GetEncoding(
        1252,
        [System.Text.EncoderFallback]::ExceptionFallback,
        [System.Text.DecoderFallback]::ExceptionFallback
    )

    $MojibakePattern = 'Ã|Â|ðŸ|â€|â†|âœ|ï¸|OperaÃ|confirmaÃ|logÃ|preparaÃ|entregaÃ'

    $Passes = 0

    while (($Content -match $MojibakePattern) -and $Passes -lt 3) {
        $Bytes = $Windows1252.GetBytes($Content)
        $Content = [System.Text.Encoding]::UTF8.GetString($Bytes)
        $Passes++
    }

    if ($Content -match $MojibakePattern) {
        throw "Ainda existem caracteres corrompidos após $Passes tentativa(s)."
    }

    Write-Host "[OK] Codificação restaurada em $Passes passagem(ns)." -ForegroundColor Green

    Write-Host "==> Forçando o título na cor branca" -ForegroundColor Cyan

    $TitlePattern = '(?s)<h1\s+className="(?<classes>[^"]*)"(?<extra>[^>]*)>\s*Central\s+de\s+entregas\s*</h1>'
    $TitleMatch = [regex]::Match($Content, $TitlePattern)

    if (-not $TitleMatch.Success) {
        throw "O título Central de entregas não foi encontrado no JSX."
    }

    $Classes = @(
        $TitleMatch.Groups["classes"].Value -split '\s+' |
        Where-Object {
            $_ -and
            $_ -ne "text-white" -and
            $_ -ne "!text-white"
        }
    )

    $NewClasses = (($Classes + "!text-white") -join " ").Trim()
    $ExtraAttributes = $TitleMatch.Groups["extra"].Value

    if ($ExtraAttributes -match 'style=\{\{[^}]*color') {
        $ExtraAttributes = [regex]::Replace(
            $ExtraAttributes,
            'style=\{\{[^}]*color[^}]*\}\}',
            "style={{ color: '#ffffff' }}"
        )
    }
    elseif ($ExtraAttributes -notmatch 'style=\{\{') {
        $ExtraAttributes += " style={{ color: '#ffffff' }}"
    }

    $NewTitle = @"
<h1 className="$NewClasses"$ExtraAttributes>
                    Central de entregas
                  </h1>
"@

    $Content = (
        $Content.Substring(0, $TitleMatch.Index) +
        $NewTitle +
        $Content.Substring($TitleMatch.Index + $TitleMatch.Length)
    )

    [System.IO.File]::WriteAllText(
        $Source,
        $Content,
        $Utf8SemBom
    )

    $Saved = [System.IO.File]::ReadAllText(
        $Source,
        [System.Text.Encoding]::UTF8
    )

    Write-Host "==> Verificando textos e estilo" -ForegroundColor Cyan

    $LiteralChecks = @(
        "🚚",
        "Operação logística",
        "Central de entregas",
        "!text-white",
        "style={{ color: '#ffffff' }}"
    )

    foreach ($Text in $LiteralChecks) {
        if (-not $Saved.Contains($Text)) {
            throw "Verificação falhou: $Text"
        }

        Write-Host "[OK] $Text" -ForegroundColor Green
    }

    $DescriptionPattern = 'Acompanhe\s+cada\s+pedido\s+desde\s+o\s+preparo\s+até\s+a\s+confirmação\s+da\s+entrega\.'

    if (-not [regex]::IsMatch(
        $Saved,
        $DescriptionPattern,
        [System.Text.RegularExpressions.RegexOptions]::Singleline
    )) {
        throw "A descrição do cabeçalho não foi encontrada, mesmo ignorando quebras de linha."
    }

    Write-Host "[OK] Descrição do cabeçalho restaurada." -ForegroundColor Green

    if ($Saved -match $MojibakePattern) {
        throw "A verificação final encontrou caracteres corrompidos."
    }

    Write-Host ""
    Write-Host "==> Verificando diff" -ForegroundColor Cyan

    git --no-pager diff --check -- $RelativePath

    if ($LASTEXITCODE -ne 0) {
        throw "git diff --check encontrou problemas."
    }

    Remove-Item `
        -LiteralPath (Join-Path $Root ".next") `
        -Recurse `
        -Force `
        -ErrorAction SilentlyContinue

    Write-Host ""
    Write-Host "==> Executando build completo" -ForegroundColor Cyan

    npm run build
    $BuildExitCode = $LASTEXITCODE

    Write-Host ""
    Write-Host "BUILD_EXIT_CODE=$BuildExitCode" -ForegroundColor Yellow

    if ($BuildExitCode -ne 0) {
        throw "O build falhou."
    }

    Remove-Item -LiteralPath $Backup -Force

    Write-Host ""
    Write-Host "==================================================" -ForegroundColor Green
    Write-Host "CABEÇALHO DE ENTREGAS CORRIGIDO" -ForegroundColor Green
    Write-Host "==================================================" -ForegroundColor Green
    Write-Host "Emoji e acentos: restaurados"
    Write-Host "Título: branco com !text-white"
    Write-Host "Título: branco também por estilo inline"
    Write-Host "Build: aprovado"
    Write-Host ""
    Write-Host "Nenhum commit, push ou deploy foi criado."
}
catch {
    Restore-Backup
    Remove-Item -LiteralPath $Backup -Force -ErrorAction SilentlyContinue
    throw
}
