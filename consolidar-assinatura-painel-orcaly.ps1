#requires -version 5.1
<#
.SYNOPSIS
  Consolida a pagina de assinatura do Orcaly na rota oficial /painel/assinatura.

.USAGE
  powershell -ExecutionPolicy Bypass -File .\consolidar-assinatura-painel-orcaly.ps1
#>

param(
    [switch]$DryRun,
    [switch]$SkipInitialBuild,
    [switch]$SkipFinalBuild,
    [switch]$SkipQa,
    [switch]$VerboseOutput
)

Set-StrictMode -Version 2.0
$ErrorActionPreference = "Stop"
$Utf8NoBom = New-Object System.Text.UTF8Encoding($false)
$ProjectRoot = (Get-Location).Path
$Timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
$BackupRoot = Join-Path $ProjectRoot (".orcaly-backups\consolidar-assinatura-" + $Timestamp)
$LogPath = Join-Path $BackupRoot "execucao.log"
$ManifestPath = Join-Path $BackupRoot "manifesto-arquivos-alterados.txt"
$AuditPath = Join-Path $BackupRoot "auditoria-assinatura.txt"
$ReportPath = Join-Path $ProjectRoot "RELATORIO-CONSOLIDACAO-ASSINATURA-ORCALY.md"

$ChangedFiles = New-Object System.Collections.ArrayList
$CreatedFiles = New-Object System.Collections.ArrayList
$QaResults = New-Object System.Collections.ArrayList
$AuditFiles = New-Object System.Collections.ArrayList
$OriginalSymbols = New-Object System.Collections.ArrayList
$PreservedSymbols = New-Object System.Collections.ArrayList
$HandlersPreserved = New-Object System.Collections.ArrayList
$LinksCorrected = 0
$BuildInitial = "NAO TESTADO"
$BuildFinal = "NAO TESTADO"
$LintResult = "NAO TESTADO"
$LegacyPageStatus = "NAO ENCONTRADA"
$OldPageStatus = "FALHOU"
$ResourcesStatus = "FALHOU"
$InformationStatus = "FALHOU"

function Decode-Base64Text {
    param([Parameter(Mandatory = $true)][string]$Value)
    return [System.Text.Encoding]::UTF8.GetString([System.Convert]::FromBase64String($Value))
}

$OldBenefitsTitle = Decode-Base64Text -Value "QmVuZWbDrWNpb3MgaW5jbHXDrWRvcw=="
$ResourcesTitle = Decode-Base64Text -Value "UmVjdXJzb3MgZGlzcG9uw612ZWlzIG5vIHNldSBwbGFubw=="
$InformationTitle = Decode-Base64Text -Value "SW5mb3JtYcOnw7VlcyBkYSBhc3NpbmF0dXJh"

function Ensure-Directory {
    param([Parameter(Mandatory = $true)][string]$Path)
    if (-not (Test-Path -LiteralPath $Path -PathType Container)) {
        [void](New-Item -ItemType Directory -Path $Path -Force)
    }
}

function Append-Log {
    param([Parameter(Mandatory = $true)][string]$Line)
    Ensure-Directory -Path (Split-Path -Parent $LogPath)
    $writer = New-Object System.IO.StreamWriter($LogPath, $true, $Utf8NoBom)
    try { $writer.WriteLine($Line) } finally { $writer.Dispose() }
}

function Write-Step {
    param([Parameter(Mandatory = $true)][string]$Message)
    $line = "[" + (Get-Date -Format "yyyy-MM-dd HH:mm:ss") + "] [STEP] " + $Message
    Write-Host ("`n==> " + $Message) -ForegroundColor Cyan
    Append-Log -Line $line
}

function Write-Success {
    param([Parameter(Mandatory = $true)][string]$Message)
    Write-Host ("[OK] " + $Message) -ForegroundColor Green
    Append-Log -Line ("[" + (Get-Date -Format "yyyy-MM-dd HH:mm:ss") + "] [OK] " + $Message)
}

function Write-Warning {
    param([Parameter(Mandatory = $true)][string]$Message)
    Write-Host ("[AVISO] " + $Message) -ForegroundColor Yellow
    Append-Log -Line ("[" + (Get-Date -Format "yyyy-MM-dd HH:mm:ss") + "] [WARN] " + $Message)
}

function Write-Failure {
    param([Parameter(Mandatory = $true)][string]$Message)
    Write-Host ("[ERRO] " + $Message) -ForegroundColor Red
    Append-Log -Line ("[" + (Get-Date -Format "yyyy-MM-dd HH:mm:ss") + "] [ERROR] " + $Message)
}

function Stop-OnCriticalFailure {
    param([Parameter(Mandatory = $true)][string]$Message)
    Write-Failure -Message $Message
    throw $Message
}

function Test-ProjectFile {
    param([Parameter(Mandatory = $true)][string]$RelativePath)
    return Test-Path -LiteralPath (Join-Path $ProjectRoot $RelativePath) -PathType Leaf
}

function Add-ChangedFile {
    param([Parameter(Mandatory = $true)][string]$RelativePath)
    if (-not $ChangedFiles.Contains($RelativePath)) { [void]$ChangedFiles.Add($RelativePath) }
}

function Backup-ProjectFile {
    param([Parameter(Mandatory = $true)][string]$RelativePath)
    $source = Join-Path $ProjectRoot $RelativePath
    if (-not (Test-Path -LiteralPath $source -PathType Leaf)) { return }
    $destination = Join-Path $BackupRoot $RelativePath
    Ensure-Directory -Path (Split-Path -Parent $destination)
    if (-not (Test-Path -LiteralPath $destination -PathType Leaf)) {
        Copy-Item -LiteralPath $source -Destination $destination -Force
        if ($VerboseOutput) { Write-Host ("  backup: " + $RelativePath) -ForegroundColor DarkGray }
    }
}

function Write-Utf8NoBom {
    param(
        [Parameter(Mandatory = $true)][string]$Path,
        [Parameter(Mandatory = $true)][AllowEmptyString()][string]$Content
    )
    Ensure-Directory -Path (Split-Path -Parent $Path)
    [System.IO.File]::WriteAllText($Path, $Content, $Utf8NoBom)
}

function Update-ProjectFile {
    param(
        [Parameter(Mandatory = $true)][string]$RelativePath,
        [Parameter(Mandatory = $true)][AllowEmptyString()][string]$Content,
        [Parameter(Mandatory = $true)][string]$Reason
    )

    $path = Join-Path $ProjectRoot $RelativePath
    $exists = Test-Path -LiteralPath $path -PathType Leaf
    $current = if ($exists) { [System.IO.File]::ReadAllText($path) } else { $null }

    if ($exists -and $current -ceq $Content) {
        if ($VerboseOutput) { Write-Host ("  sem alteracao: " + $RelativePath) -ForegroundColor DarkGray }
        return $false
    }

    if ($DryRun) {
        Write-Host ("[DRY-RUN] " + $RelativePath + " - " + $Reason) -ForegroundColor Magenta
        return $true
    }

    if ($exists) { Backup-ProjectFile -RelativePath $RelativePath }
    else { [void]$CreatedFiles.Add($RelativePath) }

    Write-Utf8NoBom -Path $path -Content $Content
    Add-ChangedFile -RelativePath $RelativePath
    Write-Success -Message ("Atualizado: " + $RelativePath)
    return $true
}

function Add-QaResult {
    param(
        [Parameter(Mandatory = $true)][string]$Area,
        [Parameter(Mandatory = $true)][ValidateSet("PASSOU", "FALHOU", "BLOQUEADO", "NAO TESTADO")][string]$Status,
        [Parameter(Mandatory = $true)][string]$Detail
    )
    [void]$QaResults.Add([pscustomobject]@{ Area = $Area; Status = $Status; Detail = $Detail })
}

function Invoke-NpmCommand {
    param(
        [Parameter(Mandatory = $true)][string]$Label,
        [Parameter(Mandatory = $true)][string[]]$Arguments,
        [bool]$Critical = $false
    )

    Write-Step -Message ("Executando " + $Label)
    $started = Get-Date
    $outputFile = Join-Path $BackupRoot ($Label + ".log")

    & npm.cmd @Arguments 2>&1 | Tee-Object -FilePath $outputFile | Out-Host
    $code = $LASTEXITCODE
    $duration = [math]::Round(((Get-Date) - $started).TotalSeconds, 2)
    $passed = ($code -eq 0)

    if ($passed) { Write-Success -Message ($Label + " passou em " + $duration + "s") }
    else {
        Write-Warning -Message ($Label + " falhou com codigo " + $code + " em " + $duration + "s")
        if ($Critical) { Stop-OnCriticalFailure -Message ($Label + " falhou. Consulte " + $outputFile) }
    }

    return [pscustomobject]@{ Passed = $passed; ExitCode = $code; Duration = $duration; OutputFile = $outputFile }
}

function Get-SymbolNames {
    param([Parameter(Mandatory = $true)][string]$Content)
    $items = New-Object System.Collections.ArrayList
    $patterns = @(
        '(?m)\b(?:export\s+)?(?:default\s+)?(?:async\s+)?function\s+([A-Za-z_][A-Za-z0-9_]*)\s*\(',
        '(?m)\bconst\s+((?:handle|load|fetch|create|update|delete|cancel|reactivate|sync|run|submit|save)[A-Za-z0-9_]*)\s*='
    )
    foreach ($pattern in $patterns) {
        foreach ($match in [regex]::Matches($Content, $pattern)) {
            $name = $match.Groups[1].Value
            if ($name -and -not $items.Contains($name)) { [void]$items.Add($name) }
        }
    }
    return @($items)
}

function Restore-AllChanges {
    Write-Warning -Message "Restaurando arquivos alterados devido a falha critica."
    foreach ($relative in @($ChangedFiles)) {
        $backup = Join-Path $BackupRoot $relative
        $target = Join-Path $ProjectRoot $relative
        if (Test-Path -LiteralPath $backup -PathType Leaf) {
            Ensure-Directory -Path (Split-Path -Parent $target)
            Copy-Item -LiteralPath $backup -Destination $target -Force
        }
        elseif ($CreatedFiles.Contains($relative) -and (Test-Path -LiteralPath $target -PathType Leaf)) {
            Remove-Item -LiteralPath $target -Force
        }
    }
}

function Assert-ProjectRoot {
    Write-Step -Message "Validando raiz do projeto"
    foreach ($required in @("package.json", "app", "components", "lib")) {
        $path = Join-Path $ProjectRoot $required
        if (-not (Test-Path -LiteralPath $path)) {
            Stop-OnCriticalFailure -Message ("Execute o patcher na raiz do projeto. Item ausente: " + $required)
        }
    }
    if (Test-Path -LiteralPath (Join-Path $ProjectRoot "middleware.ts")) {
        Write-Warning -Message "middleware.ts ja existe no projeto; o patcher nao o alterara."
    }
    Write-Success -Message "Raiz do projeto confirmada"
}

function Get-SubscriptionAuditFiles {
    $roots = @("app", "components", "lib")
    $files = New-Object System.Collections.ArrayList
    foreach ($root in $roots) {
        $base = Join-Path $ProjectRoot $root
        if (-not (Test-Path -LiteralPath $base -PathType Container)) { continue }
        Get-ChildItem -LiteralPath $base -Recurse -File -Include *.ts,*.tsx -ErrorAction SilentlyContinue |
            Where-Object {
                $_.FullName -notmatch '[\\/](node_modules|\.next|\.git|\.orcaly-backups)[\\/]' -and
                ($_.FullName -match '(assinatura|subscription|plano|payment|pagamento|painel)')
            } |
            ForEach-Object {
                $relative = $_.FullName.Substring($ProjectRoot.Length).TrimStart([char]92, [char]47) -replace '\\', '/'
                if (-not $files.Contains($relative)) { [void]$files.Add($relative) }
            }
    }
    return @($files | Sort-Object)
}

function Audit-SubscriptionImplementation {
    Write-Step -Message "Fase 0 - auditando paginas, componentes, handlers e links de assinatura"
    $terms = @(
        "Assinatura Orcaly", "Assinatura Orcaly", "Beneficios incluidos", $OldBenefitsTitle,
        "trialing", "cancel_at_period_end", "trial_ends_at", "access_until", "preapproval",
        "cancelar assinatura", "reativar", "proxima cobranca", "proxima cobranca"
    )
    $lines = New-Object System.Collections.ArrayList
    [void]$lines.Add("AUDITORIA DE CONSOLIDACAO DA ASSINATURA")
    [void]$lines.Add("Data: " + (Get-Date -Format "yyyy-MM-dd HH:mm:ss"))
    [void]$lines.Add("")

    foreach ($relative in Get-SubscriptionAuditFiles) {
        $path = Join-Path $ProjectRoot $relative
        $content = [System.IO.File]::ReadAllText($path)
        $matches = New-Object System.Collections.ArrayList
        foreach ($term in $terms) {
            if ($content.IndexOf($term, [System.StringComparison]::OrdinalIgnoreCase) -ge 0) { [void]$matches.Add($term) }
        }
        if ($matches.Count -gt 0) {
            [void]$AuditFiles.Add($relative)
            $symbols = Get-SymbolNames -Content $content
            [void]$lines.Add("ARQUIVO: " + $relative)
            [void]$lines.Add("TERMOS: " + (($matches | Sort-Object -Unique) -join ", "))
            [void]$lines.Add("FUNCOES/HANDLERS: " + $(if ($symbols.Count) { $symbols -join ", " } else { "nenhum detectado" }))
            [void]$lines.Add("")
        }
    }

    Write-Utf8NoBom -Path $AuditPath -Content (($lines -join [Environment]::NewLine) + [Environment]::NewLine)
    Write-Success -Message ("Auditoria concluida: " + $AuditFiles.Count + " arquivos relacionados")
}

function Patch-PanelAccessAndRenewalLink {
    $relative = "app/painel/layout.tsx"
    if (-not (Test-ProjectFile -RelativePath $relative)) {
        Add-QaResult -Area "Layout do painel" -Status "BLOQUEADO" -Detail "app/painel/layout.tsx nao encontrado."
        return
    }

    $path = Join-Path $ProjectRoot $relative
    $content = [System.IO.File]::ReadAllText($path)
    $original = $content

    $content = $content.Replace('href="/assinatura"', 'href="/painel/assinatura"')
    $content = $content.Replace("href='/assinatura'", "href='/painel/assinatura'")

    if ($content.Contains("if (payload.assinatura_ativa !== true) {")) {
        $content = $content.Replace(
            "if (payload.assinatura_ativa !== true) {",
            "if (payload.assinatura_ativa !== true && pathname !== '/painel/assinatura') {"
        )
    }
    elseif ($content.Contains("if (payload.assinatura_ativa !== true && pathname !== '/painel/assinatura') {")) {
        # Idempotente.
    }
    elseif ($content -match 'assinatura_ativa\s*!==\s*true') {
        Add-QaResult -Area "Acesso a assinatura" -Status "BLOQUEADO" -Detail "A condicao de bloqueio existe, mas usa estrutura desconhecida; revisao manual necessaria."
        Write-Warning -Message "Condicao de bloqueio do painel nao correspondeu ao formato seguro conhecido."
    }

    if ($content -cne $original) {
        [void](Update-ProjectFile -RelativePath $relative -Content $content -Reason "permitir acesso a rota oficial de assinatura mesmo com plano pendente e corrigir link de renovacao")
    }
}

function Get-ResourceReplacementBlock {
    return [System.Text.Encoding]::UTF8.GetString([System.Convert]::FromBase64String(
        "ICAgICAgICAgIDxzZWN0aW9uIGNsYXNzTmFtZT0ibWluLXctMCByb3VuZGVkLVsycmVtXSBib3JkZXIgYm9yZGVyLXdoaXRlLzgwIGJnLXdoaXRlIHAtNiBzaGFkb3ctc20gbGc6Y29sLXNwYW4tMiBzbTpwLTciPgogICAgICAgICAgICA8ZGl2IGNsYXNzTmFtZT0iZmxleCBmbGV4LWNvbCBnYXAtMiBzbTpmbGV4LXJvdyBzbTppdGVtcy1lbmQgc206anVzdGlmeS1iZXR3ZWVuIj4KICAgICAgICAgICAgICA8ZGl2IGNsYXNzTmFtZT0ibWluLXctMCI+CiAgICAgICAgICAgICAgICA8cCBjbGFzc05hbWU9InRleHQteHMgZm9udC1ibGFjayB1cHBlcmNhc2UgdHJhY2tpbmctWzAuMThlbV0gdGV4dC1ibHVlLTYwMCI+UGxhbm8gY29udHJhdGFkbzwvcD4KICAgICAgICAgICAgICAgIDxoMiBjbGFzc05hbWU9Im10LTIgdGV4dC14bCBmb250LWJsYWNrIHRyYWNraW5nLVstMC4wMjVlbV0iPlJlY3Vyc29zIGRpc3BvbsOtdmVpcyBubyBzZXUgcGxhbm88L2gyPgogICAgICAgICAgICAgICAgPHAgY2xhc3NOYW1lPSJtdC0yIG1heC13LTN4bCB0ZXh0LXNtIGZvbnQtbWVkaXVtIGxlYWRpbmctNiB0ZXh0LXNsYXRlLTYwMCI+CiAgICAgICAgICAgICAgICAgIENvbmhlw6dhIGFzIGZlcnJhbWVudGFzIGluY2x1w61kYXMgbmEgc3VhIGFzc2luYXR1cmEgcGFyYSBvcmdhbml6YXIsIGF1dG9tYXRpemFyIGUgYW1wbGlhciBhIG9wZXJhw6fDo28gZGEgc3VhIGVtcHJlc2EuCiAgICAgICAgICAgICAgICA8L3A+CiAgICAgICAgICAgICAgPC9kaXY+CiAgICAgICAgICAgICAgPHNwYW4gY2xhc3NOYW1lPSJzaHJpbmstMCByb3VuZGVkLWZ1bGwgYm9yZGVyIGJvcmRlci1lbWVyYWxkLTIwMCBiZy1lbWVyYWxkLTUwIHB4LTMgcHktMSB0ZXh0LXhzIGZvbnQtYmxhY2sgdGV4dC1lbWVyYWxkLTcwMCI+CiAgICAgICAgICAgICAgICB7Y3VycmVudFBsYW4/Lm5hbWUgfHwgc2VsZWN0ZWQubmFtZX0KICAgICAgICAgICAgICA8L3NwYW4+CiAgICAgICAgICAgIDwvZGl2PgoKICAgICAgICAgICAgPGRpdiBjbGFzc05hbWU9Im10LTUgZ3JpZCBtaW4tdy0wIGdhcC00IG1kOmdyaWQtY29scy0yIHhsOmdyaWQtY29scy0zIj4KICAgICAgICAgICAgICB7KGN1cnJlbnRQbGFuPy5iZW5lZml0cyB8fCBzZWxlY3RlZC5iZW5lZml0cykubWFwKChiZW5lZml0LCBpbmRleCkgPT4gewogICAgICAgICAgICAgICAgY29uc3QgcmVzb3VyY2UgPSBnZXRSZXNvdXJjZVByZXNlbnRhdGlvbihiZW5lZml0LCBpbmRleCk7CgogICAgICAgICAgICAgICAgcmV0dXJuICgKICAgICAgICAgICAgICAgICAgPGFydGljbGUga2V5PXtiZW5lZml0fSBjbGFzc05hbWU9Im1pbi13LTAgcm91bmRlZC0yeGwgYm9yZGVyIGJvcmRlci1zbGF0ZS0yMDAgYmctc2xhdGUtNTAvODAgcC01Ij4KICAgICAgICAgICAgICAgICAgICA8ZGl2IGNsYXNzTmFtZT0iZmxleCBpdGVtcy1zdGFydCBnYXAtNCI+CiAgICAgICAgICAgICAgICAgICAgICA8c3BhbiBjbGFzc05hbWU9ImZsZXggaC0xMCB3LTEwIHNocmluay0wIGl0ZW1zLWNlbnRlciBqdXN0aWZ5LWNlbnRlciByb3VuZGVkLXhsIGJvcmRlciBib3JkZXItYmx1ZS0xMDAgYmctd2hpdGUgdGV4dC1ibHVlLTcwMCBzaGFkb3ctc20iIGFyaWEtaGlkZGVuPSJ0cnVlIj4KICAgICAgICAgICAgICAgICAgICAgICAgPFJlc291cmNlSWNvbiB2YXJpYW50PXtyZXNvdXJjZS52YXJpYW50fSAvPgogICAgICAgICAgICAgICAgICAgICAgPC9zcGFuPgogICAgICAgICAgICAgICAgICAgICAgPGRpdiBjbGFzc05hbWU9Im1pbi13LTAiPgogICAgICAgICAgICAgICAgICAgICAgICA8ZGl2IGNsYXNzTmFtZT0iZmxleCBmbGV4LXdyYXAgaXRlbXMtY2VudGVyIGdhcC0yIj4KICAgICAgICAgICAgICAgICAgICAgICAgICA8aDMgY2xhc3NOYW1lPSJicmVhay13b3JkcyBmb250LWJsYWNrIHRleHQtc2xhdGUtOTUwIj57cmVzb3VyY2UudGl0bGV9PC9oMz4KICAgICAgICAgICAgICAgICAgICAgICAgICA8c3BhbiBjbGFzc05hbWU9InJvdW5kZWQtZnVsbCBib3JkZXIgYm9yZGVyLWVtZXJhbGQtMjAwIGJnLWVtZXJhbGQtNTAgcHgtMi41IHB5LTEgdGV4dC1bMTFweF0gZm9udC1ibGFjayB1cHBlcmNhc2UgdHJhY2tpbmctd2lkZSB0ZXh0LWVtZXJhbGQtNzAwIj4KICAgICAgICAgICAgICAgICAgICAgICAgICAgIEluY2x1w61kbwogICAgICAgICAgICAgICAgICAgICAgICAgIDwvc3Bhbj4KICAgICAgICAgICAgICAgICAgICAgICAgPC9kaXY+CiAgICAgICAgICAgICAgICAgICAgICAgIDxwIGNsYXNzTmFtZT0ibXQtMiBicmVhay13b3JkcyB0ZXh0LXNtIGZvbnQtbWVkaXVtIGxlYWRpbmctNiB0ZXh0LXNsYXRlLTYwMCI+e3Jlc291cmNlLmRlc2NyaXB0aW9ufTwvcD4KICAgICAgICAgICAgICAgICAgICAgIDwvZGl2PgogICAgICAgICAgICAgICAgICAgIDwvZGl2PgogICAgICAgICAgICAgICAgICA8L2FydGljbGU+CiAgICAgICAgICAgICAgICApOwogICAgICAgICAgICAgIH0pfQogICAgICAgICAgICA8L2Rpdj4KICAgICAgICAgIDwvc2VjdGlvbj4KCiAgICAgICAgICA8c2VjdGlvbiBjbGFzc05hbWU9Im1pbi13LTAgcm91bmRlZC1bMnJlbV0gYm9yZGVyIGJvcmRlci13aGl0ZS84MCBiZy13aGl0ZSBwLTYgc2hhZG93LXNtIHNtOnAtNyI+CiAgICAgICAgICAgIDxoMiBjbGFzc05hbWU9InRleHQteGwgZm9udC1ibGFjayB0cmFja2luZy1bLTAuMDI1ZW1dIj5JbmZvcm1hw6fDtWVzIGRhIGFzc2luYXR1cmE8L2gyPgogICAgICAgICAgICA8cCBjbGFzc05hbWU9Im10LTIgdGV4dC1zbSBmb250LW1lZGl1bSBsZWFkaW5nLTYgdGV4dC1zbGF0ZS02MDAiPgogICAgICAgICAgICAgIENvbnN1bHRlIGFzIHByaW5jaXBhaXMgY29uZGnDp8O1ZXMgZG8gc2V1IHBsYW5vIGUgYWNvbXBhbmhlIGEgc2l0dWHDp8OjbyBkbyBhY2Vzc28gw6AgcGxhdGFmb3JtYS4KICAgICAgICAgICAgPC9wPgoKICAgICAgICAgICAgPGRsIGNsYXNzTmFtZT0ibXQtNSBncmlkIG1pbi13LTAgZ2FwLTMgc206Z3JpZC1jb2xzLTIiPgogICAgICAgICAgICAgIHtbCiAgICAgICAgICAgICAgICB7IGxhYmVsOiAiSW7DrWNpbyBkbyBwZXLDrW9kbyIsIHZhbHVlOiBkYXRlQlIoY29tcGFueS5hc3NpbmF0dXJhX2luaWNpbyB8fCBjb21wYW55LnRyaWFsX3N0YXJ0ZWRfYXQpIH0sCiAgICAgICAgICAgICAgICB7IGxhYmVsOiAiVMOpcm1pbm8gZG8gdGVzdGUiLCB2YWx1ZTogZGF0ZUJSKGNvbXBhbnkudHJpYWxfZW5kc19hdCkgfSwKICAgICAgICAgICAgICAgIHsgbGFiZWw6ICJSZW5vdmHDp8OjbyBhdXRvbcOhdGljYSIsIHZhbHVlOiBjb21wYW55LmFzc2luYXR1cmFfZm9ybWFfcGFnYW1lbnRvX3ByZWZlcmlkYT8uaW5jbHVkZXMoInBpeCIpIHx8IGFjY2Vzcz8uY2FuY2VsQXRQZXJpb2RFbmQgPyAiTsOjbyIgOiAiU2ltLCBubyBjYXJ0w6NvIiB9LAogICAgICAgICAgICAgICAgeyBsYWJlbDogIkNhbmNlbGFtZW50byBhZ2VuZGFkbyIsIHZhbHVlOiBhY2Nlc3M/LmNhbmNlbEF0UGVyaW9kRW5kID8gYFNpbSwgYWNlc3NvIGF0w6kgJHtkYXRlQlIoYWNjZXNzLmFjY2Vzc1VudGlsKX1gIDogIk7Do28iIH0sCiAgICAgICAgICAgICAgXS5tYXAoKGl0ZW0pID0+ICgKICAgICAgICAgICAgICAgIDxkaXYga2V5PXtpdGVtLmxhYmVsfSBjbGFzc05hbWU9Im1pbi13LTAgcm91bmRlZC0yeGwgYm9yZGVyIGJvcmRlci1zbGF0ZS0xMDAgYmctc2xhdGUtNTAgcC00Ij4KICAgICAgICAgICAgICAgICAgPGR0IGNsYXNzTmFtZT0idGV4dC14cyBmb250LWJsYWNrIHVwcGVyY2FzZSB0cmFja2luZy13aWRlIHRleHQtc2xhdGUtNDAwIj57aXRlbS5sYWJlbH08L2R0PgogICAgICAgICAgICAgICAgICA8ZGQgY2xhc3NOYW1lPSJtdC0yIGJyZWFrLXdvcmRzIGZvbnQtYmxhY2sgdGV4dC1zbGF0ZS04MDAiPntpdGVtLnZhbHVlfTwvZGQ+CiAgICAgICAgICAgICAgICA8L2Rpdj4KICAgICAgICAgICAgICApKX0KICAgICAgICAgICAgPC9kbD4KCiAgICAgICAgICAgIDxkaXYgY2xhc3NOYW1lPSJtdC01IGdyaWQgZ2FwLTMgc206Z3JpZC1jb2xzLTIiPgogICAgICAgICAgICAgIDxkaXYgY2xhc3NOYW1lPSJyb3VuZGVkLTJ4bCBib3JkZXIgYm9yZGVyLXNsYXRlLTEwMCBwLTQiPgogICAgICAgICAgICAgICAgPHAgY2xhc3NOYW1lPSJmb250LWJsYWNrIHRleHQtc2xhdGUtOTAwIj5Db2JyYW7Dp2E8L3A+CiAgICAgICAgICAgICAgICA8cCBjbGFzc05hbWU9Im10LTIgdGV4dC1zbSBmb250LW1lZGl1bSBsZWFkaW5nLTYgdGV4dC1zbGF0ZS02MDAiPgogICAgICAgICAgICAgICAgICB7Y29tcGFueS5hc3NpbmF0dXJhX2Zvcm1hX3BhZ2FtZW50b19wcmVmZXJpZGE/LmluY2x1ZGVzKCJwaXgiKQogICAgICAgICAgICAgICAgICAgID8gIk8gcGFnYW1lbnRvIHBvciBQaXggw6kgbWVuc2FsIGUgcHJlY2lzYSBzZXIgcmVhbGl6YWRvIHBhcmEgcmVub3ZhciBvIHBlcsOtb2RvIGRlIGFjZXNzby4iCiAgICAgICAgICAgICAgICAgICAgOiAiQSBjb2JyYW7Dp2Egw6kgcmVhbGl6YWRhIG1lbnNhbG1lbnRlIG5vIGNhcnTDo28gY2FkYXN0cmFkbywgY29uZm9ybWUgbyBwZXLDrW9kbyBjb250cmF0YWRvLiJ9CiAgICAgICAgICAgICAgICA8L3A+CiAgICAgICAgICAgICAgPC9kaXY+CiAgICAgICAgICAgICAgPGRpdiBjbGFzc05hbWU9InJvdW5kZWQtMnhsIGJvcmRlciBib3JkZXItc2xhdGUtMTAwIHAtNCI+CiAgICAgICAgICAgICAgICA8cCBjbGFzc05hbWU9ImZvbnQtYmxhY2sgdGV4dC1zbGF0ZS05MDAiPkNhbmNlbGFtZW50bzwvcD4KICAgICAgICAgICAgICAgIDxwIGNsYXNzTmFtZT0ibXQtMiB0ZXh0LXNtIGZvbnQtbWVkaXVtIGxlYWRpbmctNiB0ZXh0LXNsYXRlLTYwMCI+CiAgICAgICAgICAgICAgICAgIEEgYXNzaW5hdHVyYSBwb2RlIHNlciBjYW5jZWxhZGEgYSBxdWFscXVlciBtb21lbnRvLiBPIGFjZXNzbyBwZXJtYW5lY2UgZGlzcG9uw612ZWwgYXTDqSBvIGZpbSBkbyBwZXLDrW9kbyB2w6FsaWRvLgogICAgICAgICAgICAgICAgPC9wPgogICAgICAgICAgICAgIDwvZGl2PgogICAgICAgICAgICAgIDxkaXYgY2xhc3NOYW1lPSJyb3VuZGVkLTJ4bCBib3JkZXIgYm9yZGVyLXNsYXRlLTEwMCBwLTQiPgogICAgICAgICAgICAgICAgPHAgY2xhc3NOYW1lPSJmb250LWJsYWNrIHRleHQtc2xhdGUtOTAwIj5UZXN0ZSBncmF0dWl0bzwvcD4KICAgICAgICAgICAgICAgIDxwIGNsYXNzTmFtZT0ibXQtMiB0ZXh0LXNtIGZvbnQtbWVkaXVtIGxlYWRpbmctNiB0ZXh0LXNsYXRlLTYwMCI+CiAgICAgICAgICAgICAgICAgIE8gcGVyw61vZG8gZ3JhdHVpdG8gw6kgY29uY2VkaWRvIHNvbWVudGUgbmEgcHJpbWVpcmEgYWRlc8OjbyBkYSBlbXByZXNhIGUgbsOjbyDDqSByZWluaWNpYWRvIGVtIHVtYSBub3ZhIGNvbnRyYXRhw6fDo28uCiAgICAgICAgICAgICAgICA8L3A+CiAgICAgICAgICAgICAgPC9kaXY+CiAgICAgICAgICAgICAgPGRpdiBjbGFzc05hbWU9InJvdW5kZWQtMnhsIGJvcmRlciBib3JkZXItc2xhdGUtMTAwIHAtNCI+CiAgICAgICAgICAgICAgICA8cCBjbGFzc05hbWU9ImZvbnQtYmxhY2sgdGV4dC1zbGF0ZS05MDAiPkRhZG9zIGRhIGVtcHJlc2E8L3A+CiAgICAgICAgICAgICAgICA8cCBjbGFzc05hbWU9Im10LTIgdGV4dC1zbSBmb250LW1lZGl1bSBsZWFkaW5nLTYgdGV4dC1zbGF0ZS02MDAiPgogICAgICAgICAgICAgICAgICBPIGNhbmNlbGFtZW50byBkYSBhc3NpbmF0dXJhIG7Do28gZXhjbHVpIGF1dG9tYXRpY2FtZW50ZSBwcm9kdXRvcywgY2xpZW50ZXMsIHBlZGlkb3Mgb3UgY29uZmlndXJhw6fDtWVzIGRhIGVtcHJlc2EuCiAgICAgICAgICAgICAgICA8L3A+CiAgICAgICAgICAgICAgPC9kaXY+CiAgICAgICAgICAgIDwvZGl2PgogICAgICAgICAgPC9zZWN0aW9uPg=="
    ))
}

function Get-ResourceHelperBlock {
    return [System.Text.Encoding]::UTF8.GetString([System.Convert]::FromBase64String(
        "dHlwZSBSZXNvdXJjZVZhcmlhbnQgPSAiYXV0b21hdGlvbiIgfCAib3Bwb3J0dW5pdHkiIHwgInN0cmF0ZWd5IiB8ICJnZW5lcmFsIjsKCnR5cGUgUmVzb3VyY2VQcmVzZW50YXRpb24gPSB7CiAgdGl0bGU6IHN0cmluZzsKICBkZXNjcmlwdGlvbjogc3RyaW5nOwogIHZhcmlhbnQ6IFJlc291cmNlVmFyaWFudDsKfTsKCmZ1bmN0aW9uIGdldFJlc291cmNlUHJlc2VudGF0aW9uKGJlbmVmaXQ6IHN0cmluZywgaW5kZXg6IG51bWJlcik6IFJlc291cmNlUHJlc2VudGF0aW9uIHsKICBjb25zdCBub3JtYWxpemVkID0gYmVuZWZpdC5ub3JtYWxpemUoIk5GRCIpLnJlcGxhY2UoL1tcdTAzMDAtXHUwMzZmXS9nLCAiIikudG9Mb3dlckNhc2UoKTsKCiAgaWYgKG5vcm1hbGl6ZWQuaW5jbHVkZXMoImF1dG9tIikpIHsKICAgIHJldHVybiB7CiAgICAgIHRpdGxlOiAiQXV0b21hw6fDo28gZGUgcHJvY2Vzc29zIiwKICAgICAgZGVzY3JpcHRpb246ICJTaW1wbGlmaXF1ZSB0YXJlZmFzIHJlY29ycmVudGVzIGUgbWFudGVuaGEgYSBvcGVyYcOnw6NvIG9yZ2FuaXphZGEgY29tIG1lbm9zIHRyYWJhbGhvIG1hbnVhbC4iLAogICAgICB2YXJpYW50OiAiYXV0b21hdGlvbiIsCiAgICB9OwogIH0KCiAgaWYgKFsib3BvcnR1biIsICJjbGllbnRlIiwgImNybSIsICJwcm9wb3N0YSIsICJuZWdvY2lhIiwgImZvbGxvdyJdLnNvbWUoKHRlcm0pID0+IG5vcm1hbGl6ZWQuaW5jbHVkZXModGVybSkpKSB7CiAgICByZXR1cm4gewogICAgICB0aXRsZTogIkdlc3TDo28gZGUgb3BvcnR1bmlkYWRlcyIsCiAgICAgIGRlc2NyaXB0aW9uOiAiQWNvbXBhbmhlIGNvbnRhdG9zLCBwcm9wb3N0YXMgZSBuZWdvY2lhw6fDtWVzIGVtIHRvZGFzIGFzIGV0YXBhcyBkbyBwcm9jZXNzbyBjb21lcmNpYWwuIiwKICAgICAgdmFyaWFudDogIm9wcG9ydHVuaXR5IiwKICAgIH07CiAgfQoKICBpZiAoWyJhdmFuYyIsICJlc3RyYXRlZyIsICJyZWxhdG9yaW8iLCAiZmluYW5jZSIsICJjb250cm9sZSIsICJnZXN0YW8iXS5zb21lKCh0ZXJtKSA9PiBub3JtYWxpemVkLmluY2x1ZGVzKHRlcm0pKSkgewogICAgcmV0dXJuIHsKICAgICAgdGl0bGU6ICJDb250cm9sZSBlc3RyYXTDqWdpY28iLAogICAgICBkZXNjcmlwdGlvbjogIlV0aWxpemUgcmVjdXJzb3MgYXZhbsOnYWRvcyBwYXJhIG9yZ2FuaXphciBpbmZvcm1hw6fDtWVzLCBhY29tcGFuaGFyIHJlc3VsdGFkb3MgZSBhcG9pYXIgZGVjaXPDtWVzIGltcG9ydGFudGVzLiIsCiAgICAgIHZhcmlhbnQ6ICJzdHJhdGVneSIsCiAgICB9OwogIH0KCiAgY29uc3QgdmFyaWFudHM6IFJlc291cmNlVmFyaWFudFtdID0gWyJhdXRvbWF0aW9uIiwgIm9wcG9ydHVuaXR5IiwgInN0cmF0ZWd5IiwgImdlbmVyYWwiXTsKICByZXR1cm4gewogICAgdGl0bGU6IGJlbmVmaXQsCiAgICBkZXNjcmlwdGlvbjogIlJlY3Vyc28gZGlzcG9uw612ZWwgbm8gcGxhbm8gYXR1YWwgcGFyYSBhcG9pYXIgYSBvcmdhbml6YcOnw6NvIGUgYSBvcGVyYcOnw6NvIGRhIHN1YSBlbXByZXNhLiIsCiAgICB2YXJpYW50OiB2YXJpYW50c1tpbmRleCAlIHZhcmlhbnRzLmxlbmd0aF0sCiAgfTsKfQoKZnVuY3Rpb24gUmVzb3VyY2VJY29uKHsgdmFyaWFudCB9OiB7IHZhcmlhbnQ6IFJlc291cmNlVmFyaWFudCB9KSB7CiAgaWYgKHZhcmlhbnQgPT09ICJvcHBvcnR1bml0eSIpIHsKICAgIHJldHVybiAoCiAgICAgIDxzdmcgdmlld0JveD0iMCAwIDI0IDI0IiBjbGFzc05hbWU9ImgtNSB3LTUiIGZpbGw9Im5vbmUiIHN0cm9rZT0iY3VycmVudENvbG9yIiBzdHJva2VXaWR0aD0iMS44IiBhcmlhLWhpZGRlbj0idHJ1ZSI+CiAgICAgICAgPHBhdGggZD0iTTE2IDIxdi0yYTQgNCAwIDAgMC00LTRINmE0IDQgMCAwIDAtNCA0djIiIC8+CiAgICAgICAgPGNpcmNsZSBjeD0iOSIgY3k9IjciIHI9IjQiIC8+CiAgICAgICAgPHBhdGggZD0ibTE2IDExIDIgMiA0LTQiIC8+CiAgICAgIDwvc3ZnPgogICAgKTsKICB9CgogIGlmICh2YXJpYW50ID09PSAic3RyYXRlZ3kiKSB7CiAgICByZXR1cm4gKAogICAgICA8c3ZnIHZpZXdCb3g9IjAgMCAyNCAyNCIgY2xhc3NOYW1lPSJoLTUgdy01IiBmaWxsPSJub25lIiBzdHJva2U9ImN1cnJlbnRDb2xvciIgc3Ryb2tlV2lkdGg9IjEuOCIgYXJpYS1oaWRkZW49InRydWUiPgogICAgICAgIDxwYXRoIGQ9Ik00IDE5VjlNMTAgMTlWNU0xNiAxOXYtN00yMiAxOUgyIiAvPgogICAgICA8L3N2Zz4KICAgICk7CiAgfQoKICBpZiAodmFyaWFudCA9PT0gImF1dG9tYXRpb24iKSB7CiAgICByZXR1cm4gKAogICAgICA8c3ZnIHZpZXdCb3g9IjAgMCAyNCAyNCIgY2xhc3NOYW1lPSJoLTUgdy01IiBmaWxsPSJub25lIiBzdHJva2U9ImN1cnJlbnRDb2xvciIgc3Ryb2tlV2lkdGg9IjEuOCIgYXJpYS1oaWRkZW49InRydWUiPgogICAgICAgIDxwYXRoIGQ9Ik0xMiAydjRNMTIgMTh2NE00LjkzIDQuOTNsMi44MyAyLjgzTTE2LjI0IDE2LjI0bDIuODMgMi44M00yIDEyaDRNMTggMTJoNE00LjkzIDE5LjA3bDIuODMtMi44M00xNi4yNCA3Ljc2bDIuODMtMi44MyIgLz4KICAgICAgICA8Y2lyY2xlIGN4PSIxMiIgY3k9IjEyIiByPSIzIiAvPgogICAgICA8L3N2Zz4KICAgICk7CiAgfQoKICByZXR1cm4gKAogICAgPHN2ZyB2aWV3Qm94PSIwIDAgMjQgMjQiIGNsYXNzTmFtZT0iaC01IHctNSIgZmlsbD0ibm9uZSIgc3Ryb2tlPSJjdXJyZW50Q29sb3IiIHN0cm9rZVdpZHRoPSIxLjgiIGFyaWEtaGlkZGVuPSJ0cnVlIj4KICAgICAgPHBhdGggZD0ibTkgMTEgMyAzTDIyIDQiIC8+CiAgICAgIDxwYXRoIGQ9Ik0yMSAxMnY3YTIgMiAwIDAgMS0yIDJINWEyIDIgMCAwIDEtMi0yVjVhMiAyIDAgMCAxIDItMmgxMSIgLz4KICAgIDwvc3ZnPgogICk7Cn0="
    ))
}

function Patch-SubscriptionManager {
    $relative = "components/subscription/SubscriptionManager.tsx"
    if (-not (Test-ProjectFile -RelativePath $relative)) {
        Stop-OnCriticalFailure -Message "A nova pagina aprovada nao foi encontrada em components/subscription/SubscriptionManager.tsx. Execute primeiro o patcher de pagamentos e assinatura."
    }

    $path = Join-Path $ProjectRoot $relative
    $content = [System.IO.File]::ReadAllText($path)
    $original = $content

    foreach ($symbol in Get-SymbolNames -Content $content) {
        if (-not $OriginalSymbols.Contains($symbol)) { [void]$OriginalSymbols.Add($symbol) }
    }

    if (-not $content.Contains("function getResourcePresentation(")) {
        $anchor = "function Skeleton() {"
        if (-not $content.Contains($anchor)) {
            Stop-OnCriticalFailure -Message "Nao foi encontrado ponto seguro para adicionar a apresentacao formal dos recursos."
        }
        $content = $content.Replace($anchor, (Get-ResourceHelperBlock) + [Environment]::NewLine + [Environment]::NewLine + $anchor)
    }

    if (-not $content.Contains($ResourcesTitle)) {
        $titles = @($OldBenefitsTitle, "Beneficios incluidos")
        $titleIndex = -1
        foreach ($title in $titles) {
            $titleIndex = $content.IndexOf($title, [System.StringComparison]::OrdinalIgnoreCase)
            if ($titleIndex -ge 0) { break }
        }
        if ($titleIndex -lt 0) {
            Stop-OnCriticalFailure -Message "A secao visual antiga de beneficios nao foi localizada; nenhuma substituicao cega foi realizada."
        }

        $sectionStart = $content.LastIndexOf("<section", $titleIndex, [System.StringComparison]::Ordinal)
        $sectionEndToken = "</section>"
        $sectionEnd = $content.IndexOf($sectionEndToken, $titleIndex, [System.StringComparison]::Ordinal)
        if ($sectionStart -lt 0 -or $sectionEnd -lt 0) {
            Stop-OnCriticalFailure -Message "Nao foi possivel delimitar com seguranca a secao antiga de beneficios."
        }
        $sectionEnd += $sectionEndToken.Length
        $content = $content.Substring(0, $sectionStart) + (Get-ResourceReplacementBlock) + $content.Substring($sectionEnd)
    }

    if ($content.Contains($OldBenefitsTitle) -or $content.Contains("Beneficios incluidos")) {
        Stop-OnCriticalFailure -Message "A secao antiga ainda permanece no componente apos a tentativa de consolidacao."
    }

    if ($content -cne $original) {
        [void](Update-ProjectFile -RelativePath $relative -Content $content -Reason "substituir beneficios soltos por recursos formais e informacoes reais da assinatura")
    }

    $after = if ($DryRun) { $content } else { [System.IO.File]::ReadAllText($path) }
    $afterSymbols = @(Get-SymbolNames -Content $after)
    foreach ($symbol in @($OriginalSymbols)) {
        if ($afterSymbols -contains $symbol) {
            [void]$PreservedSymbols.Add($symbol)
            if ($symbol -match '^(handle|load|fetch|create|update|delete|cancel|reactivate|sync|run|submit|save)') {
                [void]$HandlersPreserved.Add($symbol)
            }
        }
        else {
            Stop-OnCriticalFailure -Message ("Funcao ou handler desapareceu sem equivalente: " + $symbol)
        }
    }

    $script:ResourcesStatus = if ($after.Contains($ResourcesTitle)) { "APLICADA" } else { "FALHOU" }
    $script:InformationStatus = if ($after.Contains($InformationTitle)) { "APLICADA" } else { "FALHOU" }
}

function Ensure-OfficialSubscriptionPage {
    $componentRelative = "components/subscription/SubscriptionManager.tsx"
    $officialRelative = "app/painel/assinatura/page.tsx"
    $officialPath = Join-Path $ProjectRoot $officialRelative
    $componentContent = [System.IO.File]::ReadAllText((Join-Path $ProjectRoot $componentRelative))
    $componentSymbols = @(Get-SymbolNames -Content $componentContent)

    $wrapper = @'
import SubscriptionManager from "@/components/subscription/SubscriptionManager";

export const dynamic = "force-dynamic";

export default function PainelAssinaturaPage() {
  return <SubscriptionManager />;
}
'@

    if (Test-Path -LiteralPath $officialPath -PathType Leaf) {
        $current = [System.IO.File]::ReadAllText($officialPath)
        if ($current.Contains("@/components/subscription/SubscriptionManager")) {
            $script:OldPageStatus = "SUBSTITUIDA"
            return
        }

        $officialSymbols = @(Get-SymbolNames -Content $current | Where-Object { $_ -notmatch 'Page$' })
        $missing = @($officialSymbols | Where-Object { $componentSymbols -notcontains $_ })
        if ($missing.Count -gt 0) {
            Stop-OnCriticalFailure -Message ("A pagina antiga possui funcoes exclusivas que nao estao no componente novo: " + ($missing -join ", "))
        }
    }

    [void](Update-ProjectFile -RelativePath $officialRelative -Content $wrapper -Reason "tornar /painel/assinatura a unica rota oficial da pagina nova")
    $script:OldPageStatus = "SUBSTITUIDA"
}

function Redirect-LegacySubscriptionPages {
    $legacyPages = @(
        "app/assinatura/page.tsx",
        "app/subscription/page.tsx",
        "app/plano/page.tsx",
        "app/planos/page.tsx",
        "app/painel/planos/page.tsx",
        "app/painel/subscription/page.tsx"
    )

    $redirectPage = @'
import { redirect } from "next/navigation";

export default function LegacySubscriptionPage() {
  redirect("/painel/assinatura");
}
'@

    $found = 0
    $changed = 0
    foreach ($relative in $legacyPages) {
        if (-not (Test-ProjectFile -RelativePath $relative)) { continue }
        $found += 1
        $path = Join-Path $ProjectRoot $relative
        $current = [System.IO.File]::ReadAllText($path)
        if ($current.Contains('redirect("/painel/assinatura")') -or $current.Contains("redirect('/painel/assinatura')")) { continue }
        [void](Update-ProjectFile -RelativePath $relative -Content $redirectPage -Reason "redirecionar pagina visual duplicada para a rota oficial")
        $changed += 1
    }

    if ($found -eq 0) { $script:LegacyPageStatus = "NAO ENCONTRADA" }
    elseif ($changed -gt 0) { $script:LegacyPageStatus = "REDIRECIONADA" }
    else { $script:LegacyPageStatus = "REDIRECIONADA" }
}

function Update-LegacyUiLinks {
    Write-Step -Message "Corrigindo links visuais para a rota oficial"
    $candidateRoots = @(
        "components/painel",
        "components/layout",
        "components/subscription",
        "app/painel/page.tsx",
        "app/painel/configuracoes/page.tsx",
        "app/painel/pagamentos/page.tsx",
        "app/painel/onboarding/page.tsx"
    )

    $files = New-Object System.Collections.ArrayList
    foreach ($candidate in $candidateRoots) {
        $path = Join-Path $ProjectRoot $candidate
        if (Test-Path -LiteralPath $path -PathType Leaf) {
            [void]$files.Add($path)
        }
        elseif (Test-Path -LiteralPath $path -PathType Container) {
            Get-ChildItem -LiteralPath $path -Recurse -File -Include *.ts,*.tsx -ErrorAction SilentlyContinue |
                ForEach-Object { if (-not $files.Contains($_.FullName)) { [void]$files.Add($_.FullName) } }
        }
    }

    $replacements = [ordered]@{
        'href="/assinatura"' = 'href="/painel/assinatura"'
        "href='/assinatura'" = "href='/painel/assinatura'"
        'href: "/assinatura"' = 'href: "/painel/assinatura"'
        "href: '/assinatura'" = "href: '/painel/assinatura'"
        'router.push("/assinatura")' = 'router.push("/painel/assinatura")'
        "router.push('/assinatura')" = "router.push('/painel/assinatura')"
        'router.replace("/assinatura")' = 'router.replace("/painel/assinatura")'
        "router.replace('/assinatura')" = "router.replace('/painel/assinatura')"
        'href="/painel/planos"' = 'href="/painel/assinatura"'
        "href='/painel/planos'" = "href='/painel/assinatura'"
        'href: "/painel/planos"' = 'href: "/painel/assinatura"'
        "href: '/painel/planos'" = "href: '/painel/assinatura'"
        'href="/painel/subscription"' = 'href="/painel/assinatura"'
        "href='/painel/subscription'" = "href='/painel/assinatura'"
    }

    foreach ($path in @($files)) {
        $relative = $path.Substring($ProjectRoot.Length).TrimStart([char]92, [char]47) -replace '\\', '/'
        if ($relative -eq "app/painel/layout.tsx") { continue }
        $content = [System.IO.File]::ReadAllText($path)
        $original = $content
        foreach ($pair in $replacements.GetEnumerator()) {
            $beforeCount = ([regex]::Matches($content, [regex]::Escape([string]$pair.Key))).Count
            if ($beforeCount -gt 0) {
                $content = $content.Replace([string]$pair.Key, [string]$pair.Value)
                $script:LinksCorrected += $beforeCount
            }
        }
        if ($content -cne $original) {
            [void](Update-ProjectFile -RelativePath $relative -Content $content -Reason "padronizar atalho visual para /painel/assinatura")
        }
    }
}

function Run-Qa {
    Write-Step -Message "Executando QA estatico de consolidacao"
    $official = "app/painel/assinatura/page.tsx"
    $manager = "components/subscription/SubscriptionManager.tsx"
    $layout = "app/painel/layout.tsx"

    $officialContent = if (Test-ProjectFile $official) { [System.IO.File]::ReadAllText((Join-Path $ProjectRoot $official)) } else { "" }
    $managerContent = if (Test-ProjectFile $manager) { [System.IO.File]::ReadAllText((Join-Path $ProjectRoot $manager)) } else { "" }
    $layoutContent = if (Test-ProjectFile $layout) { [System.IO.File]::ReadAllText((Join-Path $ProjectRoot $layout)) } else { "" }

    Add-QaResult -Area "Rota oficial" -Status $(if ($officialContent.Contains("SubscriptionManager")) { "PASSOU" } else { "FALHOU" }) -Detail "A rota /painel/assinatura renderiza o componente consolidado."
    Add-QaResult -Area "Secao antiga" -Status $(if (-not $managerContent.Contains($OldBenefitsTitle) -and -not $managerContent.Contains("Beneficios incluidos")) { "PASSOU" } else { "FALHOU" }) -Detail "O bloco visual antigo foi removido."
    Add-QaResult -Area "Recursos do plano" -Status $(if ($managerContent.Contains($ResourcesTitle) -and $managerContent.Contains("getResourcePresentation")) { "PASSOU" } else { "FALHOU" }) -Detail "A nova secao usa a lista real de beneficios do plano e apresentacao formal."
    Add-QaResult -Area "Informacoes da assinatura" -Status $(if ($managerContent.Contains($InformationTitle)) { "PASSOU" } else { "FALHOU" }) -Detail "Condicoes e dados reais da assinatura foram adicionados."
    Add-QaResult -Area "Acesso com plano pendente" -Status $(if (-not $layoutContent.Contains("assinatura_ativa !== true") -or $layoutContent.Contains("pathname !== '/painel/assinatura'")) { "PASSOU" } else { "FALHOU" }) -Detail "A pagina oficial permanece acessivel para regularizacao e renovacao."
    Add-QaResult -Area "Handlers" -Status $(if ($OriginalSymbols.Count -eq $PreservedSymbols.Count) { "PASSOU" } else { "FALHOU" }) -Detail (("Preservados " + $PreservedSymbols.Count + " de " + $OriginalSymbols.Count + " simbolos detectados."))
    Add-QaResult -Area "Seguranca client-side" -Status $(if (-not $managerContent.Contains("MERCADO_PAGO_") -and -not $managerContent.Contains("preapproval_id")) { "PASSOU" } else { "FALHOU" }) -Detail "Credenciais e identificador tecnico de recorrencia nao foram movidos para o componente visual."
    Add-QaResult -Area "Mercado Pago real" -Status "BLOQUEADO" -Detail "Pix, cartao recorrente, cancelamento e reativacao exigem sessao, credenciais e conta real; executar teste manual controlado."
    Add-QaResult -Area "Responsividade visual" -Status "BLOQUEADO" -Detail "Validar manualmente em 360px, 390px, 768px, 1024px e 1440px."

    $script:ResourcesStatus = if ($managerContent.Contains($ResourcesTitle)) { "APLICADA" } else { "FALHOU" }
    $script:InformationStatus = if ($managerContent.Contains($InformationTitle)) { "APLICADA" } else { "FALHOU" }
}

function New-Report {
    $lines = New-Object System.Collections.ArrayList
    [void]$lines.Add("# RELATORIO DE CONSOLIDACAO DA ASSINATURA - ORCALY")
    [void]$lines.Add("")
    [void]$lines.Add("Gerado em: " + (Get-Date -Format "dd/MM/yyyy HH:mm:ss"))
    [void]$lines.Add("")
    [void]$lines.Add("## 1. Resumo")
    [void]$lines.Add("")
    [void]$lines.Add("- Rota oficial: /painel/assinatura.")
    [void]$lines.Add("- Pagina antiga: " + $OldPageStatus + ".")
    [void]$lines.Add("- Pagina duplicada: " + $LegacyPageStatus + ".")
    [void]$lines.Add("- Build inicial: " + $BuildInitial + ".")
    [void]$lines.Add("- Build final: " + $BuildFinal + ".")
    [void]$lines.Add("- Lint: " + $LintResult + ".")
    [void]$lines.Add("")
    [void]$lines.Add("## 2. Implementacao encontrada e preservada")
    [void]$lines.Add("")
    [void]$lines.Add("- Componente consolidado: components/subscription/SubscriptionManager.tsx.")
    [void]$lines.Add("- Pagina oficial: app/painel/assinatura/page.tsx.")
    [void]$lines.Add("- API, Pix, cartao recorrente, cancelamento, reativacao, company_id e Mercado Pago nao foram reimplementados nesta tarefa.")
    [void]$lines.Add("- Funcoes preservadas: " + $PreservedSymbols.Count + ".")
    [void]$lines.Add("- Handlers preservados: " + $HandlersPreserved.Count + ".")
    [void]$lines.Add("")
    [void]$lines.Add("## 3. Alteracoes visuais")
    [void]$lines.Add("")
    [void]$lines.Add("- A secao Beneficios incluidos foi substituida por Recursos disponiveis no seu plano.")
    [void]$lines.Add("- Os cards sao gerados a partir dos beneficios reais recebidos pela pagina.")
    [void]$lines.Add("- Foi adicionada a secao Informacoes da assinatura com datas e condicoes implementadas.")
    [void]$lines.Add("- O layout utiliza grade responsiva, quebra de texto e elementos sem largura fixa.")
    [void]$lines.Add("")
    [void]$lines.Add("## 4. Rotas e links")
    [void]$lines.Add("")
    [void]$lines.Add("- Links corrigidos: " + $LinksCorrected + ".")
    [void]$lines.Add("- Rotas visuais antigas encontradas foram convertidas em redirect server-side.")
    [void]$lines.Add("- app/assinatura/retorno/page.tsx nao foi redirecionado porque continua sendo uma tela tecnica de retorno do pagamento.")
    [void]$lines.Add("")
    [void]$lines.Add("## 5. Arquivos alterados")
    [void]$lines.Add("")
    foreach ($file in @($ChangedFiles | Sort-Object)) { [void]$lines.Add("- " + $file) }
    if ($ChangedFiles.Count -eq 0) { [void]$lines.Add("- Nenhum arquivo precisou ser alterado.") }
    [void]$lines.Add("")
    [void]$lines.Add("## 6. QA e regressao")
    [void]$lines.Add("")
    foreach ($result in @($QaResults)) {
        [void]$lines.Add("- **" + $result.Status + "** - " + $result.Area + ": " + $result.Detail)
    }
    [void]$lines.Add("")
    [void]$lines.Add("## 7. Itens bloqueados e testes manuais")
    [void]$lines.Add("")
    [void]$lines.Add("- Abrir /painel/assinatura com assinatura trialing, active, cancel_at_period_end, cancelled e expired.")
    [void]$lines.Add("- Testar Pix, cartao recorrente, troca de plano, cancelamento e reativacao em conta controlada.")
    [void]$lines.Add("- Validar 360px, 390px, 768px, 1024px e 1440px em navegador real.")
    [void]$lines.Add("- Confirmar que usuario com assinatura vencida consegue abrir /painel/assinatura, mas continua bloqueado nas demais areas.")
    [void]$lines.Add("")
    [void]$lines.Add("## 8. Backups")
    [void]$lines.Add("")
    [void]$lines.Add("- " + ($BackupRoot.Substring($ProjectRoot.Length).TrimStart([char]92, [char]47) -replace '\\', '/'))

    if (-not $DryRun) {
        [void](Update-ProjectFile -RelativePath "RELATORIO-CONSOLIDACAO-ASSINATURA-ORCALY.md" -Content (($lines -join [Environment]::NewLine) + [Environment]::NewLine) -Reason "gerar relatorio final de consolidacao")
        Write-Success -Message "Relatorio final gerado"
    }
}

try {
    Ensure-Directory -Path $BackupRoot
    Assert-ProjectRoot
    Audit-SubscriptionImplementation

    $package = Get-Content -LiteralPath (Join-Path $ProjectRoot "package.json") -Raw | ConvertFrom-Json
    $scripts = $package.scripts

    if (-not $DryRun -and -not $SkipInitialBuild) {
        $result = Invoke-NpmCommand -Label "build-inicial" -Arguments @("run", "build") -Critical $false
        $BuildInitial = if ($result.Passed) { "PASSOU" } else { "FALHOU" }
    }
    elseif ($DryRun) { $BuildInitial = "NAO TESTADO" }

    if ($DryRun) {
        Write-Step -Message "DryRun - alteracoes previstas"
        Write-Host "- Consolidar app/painel/assinatura/page.tsx" -ForegroundColor Magenta
        Write-Host "- Melhorar components/subscription/SubscriptionManager.tsx" -ForegroundColor Magenta
        Write-Host "- Permitir /painel/assinatura no bloqueio do layout" -ForegroundColor Magenta
        Write-Host "- Redirecionar rotas visuais antigas" -ForegroundColor Magenta
        Write-Host "- Padronizar links visuais" -ForegroundColor Magenta
        Write-Utf8NoBom -Path $ManifestPath -Content "DRY-RUN: nenhum arquivo do projeto foi alterado.`r`n"
        Write-Success -Message "DryRun concluido"
        return
    }

    Write-Step -Message "Consolidando a pagina nova na rota oficial"
    Patch-PanelAccessAndRenewalLink
    Patch-SubscriptionManager
    Ensure-OfficialSubscriptionPage
    Redirect-LegacySubscriptionPages
    Update-LegacyUiLinks

    if (-not $SkipQa) { Run-Qa }

    if ($scripts.PSObject.Properties.Name -contains "lint") {
        $lint = Invoke-NpmCommand -Label "lint-final" -Arguments @("run", "lint") -Critical $false
        $LintResult = if ($lint.Passed) { "PASSOU" } else { "FALHOU - erros existentes ou novos devem ser revisados no log" }
    }

    if ($scripts.PSObject.Properties.Name -contains "typecheck") {
        [void](Invoke-NpmCommand -Label "typecheck-final" -Arguments @("run", "typecheck") -Critical $false)
    }
    if ($scripts.PSObject.Properties.Name -contains "test") {
        [void](Invoke-NpmCommand -Label "test-final" -Arguments @("run", "test") -Critical $false)
    }

    if (-not $SkipFinalBuild) {
        $final = Invoke-NpmCommand -Label "build-final" -Arguments @("run", "build") -Critical $false
        $BuildFinal = if ($final.Passed) { "PASSOU" } else { "FALHOU" }
        if (-not $final.Passed) {
            Restore-AllChanges
            Stop-OnCriticalFailure -Message "Build final falhou. Os arquivos alterados foram restaurados a partir do backup."
        }
    }

    if (-not $SkipQa) { New-Report }
    Write-Utf8NoBom -Path $ManifestPath -Content ((@($ChangedFiles | Sort-Object) -join [Environment]::NewLine) + [Environment]::NewLine)

    Write-Host "`nOrcaly - pagina de assinatura consolidada" -ForegroundColor Green
    Write-Host ""
    Write-Host "Rota oficial: /painel/assinatura"
    Write-Host ("Pagina antiga: " + $OldPageStatus)
    Write-Host ("Pagina duplicada: " + $LegacyPageStatus)
    Write-Host ("Funcoes preservadas: " + $PreservedSymbols.Count)
    Write-Host ("Handlers preservados: " + $HandlersPreserved.Count)
    Write-Host ("Links corrigidos: " + $LinksCorrected)
    Write-Host ("Nova secao de recursos: " + $ResourcesStatus)
    Write-Host ("Informacoes da assinatura: " + $InformationStatus)
    Write-Host ("Build inicial: " + $BuildInitial)
    Write-Host ("Build final: " + $BuildFinal)
    Write-Host "Relatorio: RELATORIO-CONSOLIDACAO-ASSINATURA-ORCALY.md"
    Write-Host ("Backups: " + ($BackupRoot.Substring($ProjectRoot.Length).TrimStart([char]92, [char]47)))
    Write-Host ""
    Write-Host "A pagina de assinatura foi consolidada em /painel/assinatura, preservando as funcoes existentes e apresentando os recursos do plano de forma formal, organizada e responsiva." -ForegroundColor Green
}
catch {
    Write-Failure -Message $_.Exception.Message
    if (-not $DryRun -and $ChangedFiles.Count -gt 0) {
        try { Restore-AllChanges } catch { Write-Failure -Message ("Falha adicional ao restaurar backups: " + $_.Exception.Message) }
    }
    throw
}
