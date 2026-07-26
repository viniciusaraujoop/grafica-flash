param(
    [switch]$SkipBuild
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$Root = (Get-Location).Path
$Timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
$BackupRoot = Join-Path $Root ".orcaly-backups\corrigir-utf8-checkout-$Timestamp"
$Utf8NoBom = New-Object System.Text.UTF8Encoding($false)
$Windows1252 = [System.Text.Encoding]::GetEncoding(1252)

$Files = @(
    "lib/payments/providers/asaas.ts",
    "lib/payments/server-context.ts",
    "lib/payments/payout-service.ts",
    "app/api/payments/asaas/payout-key/route.ts",
    "app/api/payments/asaas/payouts/route.ts",
    "app/api/payments/asaas/payouts/retry/route.ts",
    "app/api/payments/asaas/account/route.ts",
    "app/api/webhooks/asaas/route.ts",
    "app/painel/pagamentos/page.tsx",
    "components/payments/PaymentsHub.tsx",
    "components/payments/AsaasFinancialPanel.tsx",
    "CONFIGURAR-CHECKOUT-ASAAS-GRAFICA-FLASH.md"
)

function Count-Mojibake([string]$Text) {
    $CodePoints = @(0x00C3, 0x00C2, 0x00E2, 0x00F0, 0x00D4)
    $Total = 0
    foreach ($CodePoint in $CodePoints) {
        $Pattern = [string][char]$CodePoint
        $Total += ([regex]::Matches($Text, [regex]::Escape($Pattern))).Count
    }
    return $Total
}

function Backup-File([string]$RelativePath) {
    $Source = Join-Path $Root ($RelativePath -replace "/", "\")
    $Destination = Join-Path $BackupRoot ($RelativePath -replace "/", "\")
    $Directory = Split-Path $Destination -Parent

    if (-not (Test-Path $Directory)) {
        New-Item -ItemType Directory -Path $Directory -Force | Out-Null
    }

    Copy-Item $Source $Destination -Force
}

if (-not (Test-Path (Join-Path $Root "package.json"))) {
    throw "Execute este script na raiz do projeto."
}

New-Item -ItemType Directory -Path $BackupRoot -Force | Out-Null

$Fixed = 0
$Skipped = 0

Write-Host ""
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "ORCALY - CORRECAO DE CODIFICACAO UTF-8" -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan

foreach ($RelativePath in $Files) {
    $FullPath = Join-Path $Root ($RelativePath -replace "/", "\")

    if (-not (Test-Path $FullPath)) {
        Write-Host "[IGNORADO] Arquivo nao encontrado: $RelativePath" -ForegroundColor Yellow
        $Skipped++
        continue
    }

    $Current = [System.IO.File]::ReadAllText($FullPath, $Utf8NoBom)
    $BeforeCount = Count-Mojibake $Current

    if ($BeforeCount -eq 0) {
        Write-Host "[OK] Ja estava correto: $RelativePath" -ForegroundColor DarkGreen
        $Skipped++
        continue
    }

    $Bytes = $Windows1252.GetBytes($Current)
    $Candidate = $Utf8NoBom.GetString($Bytes)
    $AfterCount = Count-Mojibake $Candidate

    if ($Candidate.Contains([char]0xFFFD)) {
        Write-Host "[BLOQUEADO] A conversao gerou caractere invalido: $RelativePath" -ForegroundColor Red
        continue
    }

    if ($AfterCount -ge $BeforeCount) {
        Write-Host "[BLOQUEADO] A conversao nao melhorou o arquivo: $RelativePath" -ForegroundColor Red
        continue
    }

    Backup-File $RelativePath
    [System.IO.File]::WriteAllText($FullPath, $Candidate, $Utf8NoBom)
    Write-Host "[CORRIGIDO] $RelativePath ($BeforeCount -> $AfterCount)" -ForegroundColor Green
    $Fixed++
}

Write-Host ""
Write-Host "Arquivos corrigidos: $Fixed"
Write-Host "Arquivos ignorados: $Skipped"
Write-Host "Backup: $BackupRoot"

if (-not $SkipBuild) {
    Write-Host ""
    Write-Host "Executando npm.cmd run build..." -ForegroundColor Cyan
    & npm.cmd run build
    $BuildExit = $LASTEXITCODE
    Write-Host "BUILD_EXIT_CODE=$BuildExit"

    if ($BuildExit -ne 0) {
        exit $BuildExit
    }
}

Write-Host ""
Write-Host "Correcao concluida. Atualize a pagina com Ctrl+F5." -ForegroundColor Green
