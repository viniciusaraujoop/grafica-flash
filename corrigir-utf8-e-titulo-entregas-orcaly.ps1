Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$Root = (Get-Location).Path
$ExpectedBranch = "feature/vitrine-marketplace"
$RelativePath = "components\food\DeliveriesManager.tsx"
$Source = Join-Path $Root $RelativePath
$Timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
$Backup = "$Source.encoding-$Timestamp.backup"

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

try {
    Write-Host "==> Corrigindo a codificação UTF-8" -ForegroundColor Cyan

    $Utf8SemBom = New-Object System.Text.UTF8Encoding($false)
    $Content = [System.IO.File]::ReadAllText($Source, [System.Text.Encoding]::UTF8)

    $MojibakePattern = 'Ã|Â|ðŸ|â€|â†|âœ|ï¸|OperaÃ|confirmaÃ|logÃ'

    if ($Content -match $MojibakePattern) {
        try {
            [System.Text.Encoding]::RegisterProvider(
                [System.Text.CodePagesEncodingProvider]::Instance
            )
        }
        catch {
            # Windows PowerShell 5.1 já possui a página de código 1252.
        }

        $Windows1252 = [System.Text.Encoding]::GetEncoding(1252)
        $OriginalBytes = $Windows1252.GetBytes($Content)
        $Content = [System.Text.Encoding]::UTF8.GetString($OriginalBytes)

        Write-Host "[OK] Caracteres corrompidos restaurados." -ForegroundColor Green
    }
    else {
        Write-Host "[OK] Nenhum caractere corrompido detectado." -ForegroundColor Green
    }

    Write-Host "==> Fixando o título em branco" -ForegroundColor Cyan

    $TitlePattern = '(<h1\s+className=")([^"]*)(">\s*Central de entregas\s*</h1>)'
    $TitleMatch = [regex]::Match(
        $Content,
        $TitlePattern,
        [System.Text.RegularExpressions.RegexOptions]::Singleline
    )

    if (-not $TitleMatch.Success) {
        throw "O título Central de entregas não foi encontrado."
    }

    $CurrentClasses = @(
        $TitleMatch.Groups[2].Value -split '\s+' |
        Where-Object {
            $_ -and
            $_ -ne "text-white" -and
            $_ -ne "!text-white"
        }
    )

    $NewClasses = (($CurrentClasses + "!text-white") -join " ").Trim()

    $Replacement = (
        $TitleMatch.Groups[1].Value +
        $NewClasses +
        $TitleMatch.Groups[3].Value
    )

    $Content = (
        $Content.Substring(0, $TitleMatch.Index) +
        $Replacement +
        $Content.Substring($TitleMatch.Index + $TitleMatch.Length)
    )

    [System.IO.File]::WriteAllText(
        $Source,
        $Content,
        $Utf8SemBom
    )

    $SavedContent = [System.IO.File]::ReadAllText(
        $Source,
        [System.Text.Encoding]::UTF8
    )

    $Checks = @(
        "🚚",
        "Operação logística",
        "Central de entregas",
        "Acompanhe cada pedido desde o preparo até a confirmação da entrega.",
        "!text-white"
    )

    foreach ($Text in $Checks) {
        if (-not $SavedContent.Contains($Text)) {
            throw "Verificação falhou: $Text"
        }

        Write-Host "[OK] $Text" -ForegroundColor Green
    }

    if ($SavedContent -match $MojibakePattern) {
        throw "Ainda existem caracteres corrompidos no arquivo."
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
    Write-Host "TEXTO E COR DO TÍTULO CORRIGIDOS" -ForegroundColor Green
    Write-Host "==================================================" -ForegroundColor Green
    Write-Host "Codificação: UTF-8 sem BOM"
    Write-Host "Título: branco forçado com !text-white"
    Write-Host "Acentos e emoji: restaurados"
    Write-Host ""
    Write-Host "Nenhum commit, push ou deploy foi criado."
}
catch {
    Write-Host ""
    Write-Host "Falha detectada. Restaurando o arquivo anterior..." -ForegroundColor Yellow

    if (Test-Path -LiteralPath $Backup) {
        Copy-Item -LiteralPath $Backup -Destination $Source -Force
    }

    Remove-Item -LiteralPath $Backup -Force -ErrorAction SilentlyContinue
    throw
}
