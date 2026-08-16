param(
    [string]$ProjectRoot = "",
    [switch]$DryRun,
    [switch]$SkipInitialBuild,
    [switch]$SkipFinalBuild,
    [switch]$SkipLint,
    [switch]$SkipTypecheck,
    [switch]$VerboseOutput
)

Set-StrictMode -Version 2.0
$ErrorActionPreference = 'Stop'

# Compatibilidade com Windows PowerShell 5.1.
try {
    [Console]::OutputEncoding = New-Object System.Text.UTF8Encoding($false)
    $OutputEncoding = New-Object System.Text.UTF8Encoding($false)
}
catch {}

$Utf8NoBom = New-Object System.Text.UTF8Encoding($false)
$Utf8WithBom = New-Object System.Text.UTF8Encoding($true)

if ([string]::IsNullOrWhiteSpace($ProjectRoot)) {
    $ProjectRoot = (Get-Location).Path
}
else {
    $ProjectRoot = (Resolve-Path -LiteralPath $ProjectRoot).Path
}

$Timestamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$BackupRoot = Join-Path $ProjectRoot ('.orcaly-backups\mercado-pago-home-' + $Timestamp)
$LogPath = Join-Path $BackupRoot 'execucao.log'
$ManifestPath = Join-Path $BackupRoot 'manifesto-arquivos-alterados.txt'
$ReportPath = Join-Path $BackupRoot 'RELATORIO-MERCADO-PAGO-HOME.md'

$HomeRelativePath = 'app/page.tsx'
$BusinessTypesRelativePath = 'lib/business-types.ts'

$HomePath = Join-Path $ProjectRoot ($HomeRelativePath -replace '/', '\')
$BusinessTypesPath = Join-Path $ProjectRoot ($BusinessTypesRelativePath -replace '/', '\')

$ChangedFiles = New-Object System.Collections.Generic.List[string]
$QaResults = New-Object System.Collections.Generic.List[object]
$AuditLines = New-Object System.Collections.Generic.List[string]
$BackupMap = @{}
$BuildResults = @{}
$ProtectedHashesBefore = @{}
$ProtectedHashesAfter = @{}

$HomeNoticeTitle = 'Pagamentos online processados exclusivamente pelo Mercado Pago.'
$HomeNoticeBody = 'Os recebimentos online realizados pelo marketplace do Orçaly são processados pela infraestrutura do Mercado Pago, oferecendo mais segurança e confiabilidade nas transações.'
$OldFoodAnswer = 'Nesta versão, o pagamento é combinado com a empresa pelo WhatsApp.'
$NewFoodAnswer = 'Sim. Os pagamentos online do marketplace são processados exclusivamente pelo Mercado Pago, com Pix e cartão conforme disponibilidade da conta conectada.'

# Arquivos que este patch NÃO pode modificar.
$ProtectedFiles = @(
    'package.json',
    'package-lock.json',
    'proxy.ts',
    'middleware.ts',
    'lib/mercado-pago.ts',
    'lib/payments/checkout-service.ts',
    'components/checkout/CheckoutClient.tsx',
    'components/painel/MarketplacePaymentsPanel.tsx',
    'app/painel/assinatura/page.tsx',
    'app/painel/pagamentos/page.tsx',
    'app/api/checkout/[slug]/route.ts',
    'app/api/marketplace/payments/create/route.ts',
    'app/api/marketplace/payments/mercado-pago/connect/route.ts',
    'app/api/marketplace/payments/mercado-pago/callback/route.ts',
    'app/api/marketplace/payments/mercado-pago/disconnect/route.ts',
    'app/api/marketplace/payments/webhook/mercado-pago/route.ts'
)

function Write-LogLine {
    param([string]$Message)

    if ($DryRun) {
        return
    }

    $directory = Split-Path -Parent $LogPath
    if (-not (Test-Path -LiteralPath $directory)) {
        [System.IO.Directory]::CreateDirectory($directory) | Out-Null
    }

    [System.IO.File]::AppendAllText(
        $LogPath,
        ('[{0}] {1}{2}' -f (Get-Date -Format 'yyyy-MM-dd HH:mm:ss'), $Message, [Environment]::NewLine),
        $Utf8NoBom
    )
}

function Write-Step {
    param([string]$Message)

    Write-Host ''
    Write-Host ('==> ' + $Message) -ForegroundColor Cyan
    Write-LogLine ('STEP: ' + $Message)
}

function Write-Success {
    param([string]$Message)

    Write-Host ('[OK] ' + $Message) -ForegroundColor Green
    Write-LogLine ('OK: ' + $Message)
}

function Write-Warning {
    param([string]$Message)

    Write-Host ('[AVISO] ' + $Message) -ForegroundColor Yellow
    Write-LogLine ('WARNING: ' + $Message)
}

function Write-Failure {
    param([string]$Message)

    Write-Host ('[ERRO] ' + $Message) -ForegroundColor Red
    Write-LogLine ('ERROR: ' + $Message)
}

function Stop-OnCriticalFailure {
    param([string]$Message)

    Write-Failure $Message
    throw $Message
}

function Add-AuditLine {
    param([string]$Text = '')

    $AuditLines.Add($Text)
    if ($VerboseOutput) {
        Write-Host $Text -ForegroundColor DarkGray
    }
}

function Add-QaResult {
    param(
        [string]$Area,
        [ValidateSet('PASSOU', 'FALHOU', 'BLOQUEADO', 'NAO TESTADO')]
        [string]$Status,
        [string]$Detail
    )

    $QaResults.Add([pscustomobject]@{
        Area = $Area
        Status = $Status
        Detail = $Detail
    })
}

function Get-RelativeProjectPath {
    param([string]$Path)

    $full = [System.IO.Path]::GetFullPath($Path)
    $rootWithSeparator = $ProjectRoot.TrimEnd('\') + '\'

    if ($full.StartsWith($rootWithSeparator, [System.StringComparison]::OrdinalIgnoreCase)) {
        return $full.Substring($rootWithSeparator.Length).Replace('\', '/')
    }

    return $full.Replace('\', '/')
}

function Test-ProjectFile {
    param(
        [string]$RelativePath,
        [switch]$Directory
    )

    $fullPath = Join-Path $ProjectRoot ($RelativePath -replace '/', '\')

    if ($Directory) {
        return Test-Path -LiteralPath $fullPath -PathType Container
    }

    return Test-Path -LiteralPath $fullPath -PathType Leaf
}

function Count-Occurrences {
    param(
        [string]$Text,
        [string]$Needle
    )

    if ([string]::IsNullOrEmpty($Needle)) {
        return 0
    }

    $count = 0
    $index = 0

    while ($true) {
        $found = $Text.IndexOf($Needle, $index, [System.StringComparison]::Ordinal)

        if ($found -lt 0) {
            break
        }

        $count++
        $index = $found + $Needle.Length
    }

    return $count
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
    $strictUtf8 = New-Object System.Text.UTF8Encoding($false, $true)

    try {
        $text = $strictUtf8.GetString(
            $bytes,
            $offset,
            $bytes.Length - $offset
        )
    }
    catch {
        Stop-OnCriticalFailure ('Arquivo não está em UTF-8 válido: ' + (Get-RelativeProjectPath $Path))
    }

    $newLine = if ($text.Contains("`r`n")) { "`r`n" } else { "`n" }

    return [pscustomobject]@{
        Text = $text
        HasBom = $hasBom
        NewLine = $newLine
        Length = $text.Length
        Lines = ($text -split "`r?`n").Count
    }
}

function Write-TextFilePreservingEncoding {
    param(
        [string]$Path,
        [string]$Content,
        [bool]$HasBom
    )

    $parent = Split-Path -Parent $Path
    if (-not (Test-Path -LiteralPath $parent)) {
        [System.IO.Directory]::CreateDirectory($parent) | Out-Null
    }

    if ($HasBom) {
        [System.IO.File]::WriteAllText($Path, $Content, $Utf8WithBom)
    }
    else {
        [System.IO.File]::WriteAllText($Path, $Content, $Utf8NoBom)
    }
}

function Backup-ProjectFile {
    param([string]$RelativePath)

    $normalized = $RelativePath.Replace('/', '\')
    $source = Join-Path $ProjectRoot $normalized

    if (-not (Test-Path -LiteralPath $source -PathType Leaf)) {
        return $null
    }

    if ($BackupMap.ContainsKey($RelativePath)) {
        return $BackupMap[$RelativePath]
    }

    if ($DryRun) {
        return $null
    }

    $destination = Join-Path $BackupRoot $normalized
    $destinationDirectory = Split-Path -Parent $destination

    if (-not (Test-Path -LiteralPath $destinationDirectory)) {
        [System.IO.Directory]::CreateDirectory($destinationDirectory) | Out-Null
    }

    Copy-Item -LiteralPath $source -Destination $destination -Force

    $BackupMap[$RelativePath] = $destination
    Write-LogLine ('BACKUP: ' + $RelativePath + ' -> ' + $destination)

    return $destination
}

function Add-ChangedFile {
    param([string]$RelativePath)

    $normalized = $RelativePath.Replace('\', '/')

    if (-not $ChangedFiles.Contains($normalized)) {
        $ChangedFiles.Add($normalized)
    }
}

function Restore-ChangedFiles {
    if ($DryRun) {
        return
    }

    foreach ($relative in @($ChangedFiles)) {
        if (-not $BackupMap.ContainsKey($relative)) {
            continue
        }

        $backup = $BackupMap[$relative]
        $target = Join-Path $ProjectRoot ($relative -replace '/', '\')

        if (Test-Path -LiteralPath $backup -PathType Leaf) {
            Copy-Item -LiteralPath $backup -Destination $target -Force
            Write-Warning ('Rollback: ' + $relative)
        }
    }
}

function Get-FileSha256 {
    param([string]$RelativePath)

    $path = Join-Path $ProjectRoot ($RelativePath -replace '/', '\')

    if (-not (Test-Path -LiteralPath $path -PathType Leaf)) {
        return $null
    }

    return (Get-FileHash -Algorithm SHA256 -LiteralPath $path).Hash
}

function Snapshot-ProtectedHashes {
    param([hashtable]$Destination)

    foreach ($relative in $ProtectedFiles) {
        $hash = Get-FileSha256 $relative

        if ($null -ne $hash) {
            $Destination[$relative] = $hash
        }
    }
}

function Test-ProtectedFilesUnchanged {
    Snapshot-ProtectedHashes -Destination $ProtectedHashesAfter

    $failures = New-Object System.Collections.Generic.List[string]

    foreach ($relative in $ProtectedHashesBefore.Keys) {
        if (-not $ProtectedHashesAfter.ContainsKey($relative)) {
            $failures.Add($relative + ' deixou de existir.')
            continue
        }

        if ($ProtectedHashesBefore[$relative] -ne $ProtectedHashesAfter[$relative]) {
            $failures.Add($relative + ' foi alterado fora do escopo.')
        }
    }

    if ($failures.Count -gt 0) {
        foreach ($failure in $failures) {
            Write-Failure $failure
        }

        return $false
    }

    Write-Success 'Arquivos protegidos permaneceram byte a byte inalterados.'
    return $true
}

function Get-PackageScripts {
    $packagePath = Join-Path $ProjectRoot 'package.json'
    $package = Get-Content -LiteralPath $packagePath -Raw | ConvertFrom-Json
    $names = @()

    if ($package.scripts) {
        $names = @(
            $package.scripts.PSObject.Properties |
            ForEach-Object { $_.Name }
        )
    }

    return $names
}

function Invoke-NpmCommand {
    param(
        [string]$Label,
        [string[]]$Arguments
    )

    $result = [ordered]@{
        Label = $Label
        Command = 'npm.cmd ' + ($Arguments -join ' ')
        ExitCode = -1
        DurationSeconds = 0
        Output = ''
        Passed = $false
        Skipped = $false
    }

    if (-not (Get-Command npm.cmd -ErrorAction SilentlyContinue)) {
        $result.Output = 'npm.cmd não encontrado.'
        return [pscustomobject]$result
    }

    $commandRoot = if ($DryRun) {
        Join-Path $env:TEMP ('orcaly-command-' + [guid]::NewGuid().ToString('N'))
    }
    else {
        Join-Path $BackupRoot ('comandos\' + $Label)
    }

    [System.IO.Directory]::CreateDirectory($commandRoot) | Out-Null

    $stdoutPath = Join-Path $commandRoot 'stdout.log'
    $stderrPath = Join-Path $commandRoot 'stderr.log'

    $watch = [System.Diagnostics.Stopwatch]::StartNew()

    try {
        $process = Start-Process `
            -FilePath 'npm.cmd' `
            -ArgumentList $Arguments `
            -WorkingDirectory $ProjectRoot `
            -Wait `
            -PassThru `
            -NoNewWindow `
            -RedirectStandardOutput $stdoutPath `
            -RedirectStandardError $stderrPath

        $watch.Stop()

        $stdout = if (Test-Path -LiteralPath $stdoutPath) {
            [System.IO.File]::ReadAllText($stdoutPath)
        }
        else {
            ''
        }

        $stderr = if (Test-Path -LiteralPath $stderrPath) {
            [System.IO.File]::ReadAllText($stderrPath)
        }
        else {
            ''
        }

        $result.ExitCode = $process.ExitCode
        $result.DurationSeconds = [Math]::Round($watch.Elapsed.TotalSeconds, 2)
        $result.Output = ($stdout + [Environment]::NewLine + $stderr).Trim()
        $result.Passed = ($process.ExitCode -eq 0)
    }
    catch {
        $watch.Stop()
        $result.Output = $_.Exception.Message
        $result.DurationSeconds = [Math]::Round($watch.Elapsed.TotalSeconds, 2)
    }
    finally {
        if ($DryRun -and (Test-Path -LiteralPath $commandRoot)) {
            Remove-Item -LiteralPath $commandRoot -Recurse -Force -ErrorAction SilentlyContinue
        }
    }

    return [pscustomobject]$result
}

function Invoke-GitDiffCheck {
    param([string]$Label)

    $result = [ordered]@{
        Label = $Label
        Passed = $false
        ExitCode = -1
        Output = ''
    }

    if (-not (Get-Command git.exe -ErrorAction SilentlyContinue) -and -not (Get-Command git -ErrorAction SilentlyContinue)) {
        $result.Output = 'Git não encontrado.'
        return [pscustomobject]$result
    }

    $commandRoot = if ($DryRun) {
        Join-Path $env:TEMP ('orcaly-git-' + [guid]::NewGuid().ToString('N'))
    }
    else {
        Join-Path $BackupRoot ('comandos\' + $Label)
    }

    [System.IO.Directory]::CreateDirectory($commandRoot) | Out-Null

    $stdoutPath = Join-Path $commandRoot 'stdout.log'
    $stderrPath = Join-Path $commandRoot 'stderr.log'

    $args = @(
        'diff',
        '--check',
        '--',
        $HomeRelativePath,
        $BusinessTypesRelativePath
    )

    try {
        $process = Start-Process `
            -FilePath 'git.exe' `
            -ArgumentList $args `
            -WorkingDirectory $ProjectRoot `
            -Wait `
            -PassThru `
            -NoNewWindow `
            -RedirectStandardOutput $stdoutPath `
            -RedirectStandardError $stderrPath

        $stdout = if (Test-Path -LiteralPath $stdoutPath) {
            [System.IO.File]::ReadAllText($stdoutPath)
        }
        else {
            ''
        }

        $stderr = if (Test-Path -LiteralPath $stderrPath) {
            [System.IO.File]::ReadAllText($stderrPath)
        }
        else {
            ''
        }

        $result.ExitCode = $process.ExitCode
        $result.Output = ($stdout + [Environment]::NewLine + $stderr).Trim()
        $result.Passed = ($process.ExitCode -eq 0)
    }
    catch {
        $result.Output = $_.Exception.Message
    }
    finally {
        if ($DryRun -and (Test-Path -LiteralPath $commandRoot)) {
            Remove-Item -LiteralPath $commandRoot -Recurse -Force -ErrorAction SilentlyContinue
        }
    }

    return [pscustomobject]$result
}

function Get-GitInfo {
    $branch = ''
    $status = ''

    try {
        $branch = (& git branch --show-current 2>$null | Out-String).Trim()
    }
    catch {
        $branch = 'indisponível'
    }

    try {
        $status = (& git status --short 2>$null | Out-String).TrimEnd()
    }
    catch {
        $status = 'indisponível'
    }

    return [pscustomobject]@{
        Branch = $branch
        Status = $status
    }
}

function Find-HomeHeroInsertionPoint {
    param([string]$Content)

    $homePatterns = @(
        '(?m)\bexport\s+default\s+function\s+HomePage\s*\(',
        '(?m)\bfunction\s+HomePage\s*\(',
        '(?m)\bconst\s+HomePage\s*=',
        '(?m)\bHomePage\s*='
    )

    $homeMatch = $null

    foreach ($pattern in $homePatterns) {
        $candidate = [regex]::Match($Content, $pattern)

        if ($candidate.Success) {
            $homeMatch = $candidate
            break
        }
    }

    if ($null -eq $homeMatch -or -not $homeMatch.Success) {
        Stop-OnCriticalFailure '[HOME] Não foi possível localizar a declaração de HomePage no arquivo local.'
    }

    $mainMatch = [regex]::Match(
        $Content.Substring($homeMatch.Index),
        '(?is)<main\b[^>]*>'
    )

    if (-not $mainMatch.Success) {
        Stop-OnCriticalFailure '[HOME] HomePage foi encontrada, mas o <main> retornado pela página não foi localizado.'
    }

    $mainAbsoluteIndex = $homeMatch.Index + $mainMatch.Index
    $searchText = $Content.Substring($mainAbsoluteIndex)

    $tagRegex = New-Object System.Text.RegularExpressions.Regex(
        '(?is)<section\b[^>]*>|</section\s*>'
    )

    $matches = $tagRegex.Matches($searchText)

    if ($matches.Count -lt 2) {
        Stop-OnCriticalFailure '[HOME] Não foi possível localizar uma <section> completa dentro da HomePage local.'
    }

    $depth = 0
    $started = $false
    $closingMatch = $null
    $openingMatch = $null

    foreach ($match in $matches) {
        $tag = $match.Value

        if ($tag -match '(?is)^<section\b') {
            if (-not $started) {
                $started = $true
                $openingMatch = $match
            }

            if ($started) {
                $depth++
            }

            continue
        }

        if ($started -and $tag -match '(?is)^</section') {
            $depth--

            if ($depth -eq 0) {
                $closingMatch = $match
                break
            }
        }
    }

    if ($null -eq $openingMatch -or $null -eq $closingMatch) {
        Stop-OnCriticalFailure '[HOME] A primeira section da HomePage não possui fechamento estrutural confiável.'
    }

    $openingAbsolute = $mainAbsoluteIndex + $openingMatch.Index
    $closingAbsolute = $mainAbsoluteIndex + $closingMatch.Index

    if ($closingAbsolute -le $openingAbsolute) {
        Stop-OnCriticalFailure '[HOME] A análise estrutural retornou posições inválidas.'
    }

    $lineStart = $Content.LastIndexOf("`n", [Math]::Max(0, $closingAbsolute - 1))

    if ($lineStart -lt 0) {
        $lineStart = 0
    }
    else {
        $lineStart++
    }

    $indentSegment = $Content.Substring(
        $lineStart,
        $closingAbsolute - $lineStart
    )

    $indentMatch = [regex]::Match($indentSegment, '^\s*')
    $closingIndent = if ($indentMatch.Success) { $indentMatch.Value } else { '' }

    return [pscustomobject]@{
        HomeDeclarationIndex = $homeMatch.Index
        MainIndex = $mainAbsoluteIndex
        SectionOpenIndex = $openingAbsolute
        SectionCloseIndex = $closingAbsolute
        InsertionIndex = $lineStart
        ClosingIndent = $closingIndent
        SectionLength = ($closingAbsolute + $closingMatch.Length - $openingAbsolute)
    }
}

function Build-HomeNoticeBlock {
    param(
        [string]$NewLine,
        [string]$ClosingIndent
    )

    $child = $ClosingIndent + '  '
    $grand = $child + '  '
    $great = $grand + '  '

    $lines = @(
        ($child + '<div className="relative mx-auto w-full max-w-7xl px-4 pb-6 sm:px-6 lg:px-8">'),
        ($grand + '<p className="text-center text-xs font-semibold leading-5 text-[#607895] sm:text-sm lg:text-left">'),
        ($great + '<strong className="font-black text-[#05245c]">Pagamentos online processados exclusivamente pelo Mercado Pago.</strong>{'' ''}'),
        ($great + 'Os recebimentos online realizados pelo marketplace do Orçaly são processados pela infraestrutura do Mercado Pago, oferecendo mais segurança e confiabilidade nas transações.'),
        ($grand + '</p>'),
        ($child + '</div>')
    )

    return (($lines -join $NewLine) + $NewLine)
}

function Audit-Project {
    Write-Step 'Auditando o projeto local antes de qualquer alteração'

    $gitInfo = Get-GitInfo

    Add-AuditLine ('Raiz: ' + $ProjectRoot)
    Add-AuditLine ('Data: ' + (Get-Date -Format 'dd/MM/yyyy HH:mm:ss'))
    Add-AuditLine ('Branch: ' + $gitInfo.Branch)

    if ([string]::IsNullOrWhiteSpace($gitInfo.Status)) {
        Add-AuditLine 'Git status: sem alterações locais.'
    }
    else {
        Add-AuditLine 'Git status antes do patch:'
        Add-AuditLine $gitInfo.Status
    }

    $homeState = Get-TextFileState $HomePath
    $businessState = Get-TextFileState $BusinessTypesPath

    Add-AuditLine ''
    Add-AuditLine ('app/page.tsx: ' + $homeState.Lines + ' linhas; ' + $homeState.Length + ' caracteres.')
    Add-AuditLine ('lib/business-types.ts: ' + $businessState.Lines + ' linhas; ' + $businessState.Length + ' caracteres.')

    $homeNoticeCount = Count-Occurrences -Text $homeState.Text -Needle $HomeNoticeTitle
    $oldFaqCount = Count-Occurrences -Text $businessState.Text -Needle $OldFoodAnswer
    $newFaqCount = Count-Occurrences -Text $businessState.Text -Needle $NewFoodAnswer

    Add-AuditLine ('Aviso Mercado Pago na home: ' + $homeNoticeCount)
    Add-AuditLine ('FAQ antigo Food: ' + $oldFaqCount)
    Add-AuditLine ('FAQ novo Food: ' + $newFaqCount)

    $homePosition = Find-HomeHeroInsertionPoint -Content $homeState.Text

    Add-AuditLine ('HomePage encontrada no índice: ' + $homePosition.HomeDeclarationIndex)
    Add-AuditLine ('<main> da HomePage no índice: ' + $homePosition.MainIndex)
    Add-AuditLine ('Primeira <section> da HomePage: ' + $homePosition.SectionOpenIndex + ' -> ' + $homePosition.SectionCloseIndex)

    if ($homeNoticeCount -gt 1) {
        Stop-OnCriticalFailure '[HOME] O aviso do Mercado Pago já aparece mais de uma vez. Corrija a duplicidade antes de executar o patch.'
    }

    if ($oldFaqCount -gt 1) {
        Stop-OnCriticalFailure '[FOOD] A frase antiga aparece mais de uma vez em business-types.ts. O patch não fará uma substituição ambígua.'
    }

    if ($newFaqCount -gt 1) {
        Stop-OnCriticalFailure '[FOOD] A nova resposta já aparece mais de uma vez em business-types.ts.'
    }

    if ($oldFaqCount -eq 0 -and $newFaqCount -eq 0) {
        Stop-OnCriticalFailure '[FOOD] O FAQ esperado não foi encontrado. O script não vai adivinhar outro texto.'
    }

    Write-Success 'Auditoria estrutural concluída usando exclusivamente os arquivos locais.'

    return [pscustomobject]@{
        HomeState = $homeState
        BusinessState = $businessState
        HomePosition = $homePosition
        HomeNoticeCount = $homeNoticeCount
        OldFaqCount = $oldFaqCount
        NewFaqCount = $newFaqCount
        GitInfo = $gitInfo
    }
}

function Apply-RequestedChanges {
    param([object]$Audit)

    Write-Step 'Preparando exatamente as duas mudanças solicitadas'

    $homeOriginal = $Audit.HomeState.Text
    $businessOriginal = $Audit.BusinessState.Text

    $homePatched = $homeOriginal
    $businessPatched = $businessOriginal

    $homeChanged = $false
    $businessChanged = $false
    $insertedBlock = ''

    if ($Audit.HomeNoticeCount -eq 0) {
        $insertedBlock = Build-HomeNoticeBlock `
            -NewLine $Audit.HomeState.NewLine `
            -ClosingIndent $Audit.HomePosition.ClosingIndent

        $insertAt = $Audit.HomePosition.InsertionIndex

        $homePatched = (
            $homeOriginal.Substring(0, $insertAt) +
            $insertedBlock +
            $homeOriginal.Substring($insertAt)
        )

        # Prova de conservação: ao remover SOMENTE o bloco inserido,
        # o arquivo deve voltar byte-textualmente ao conteúdo original.
        $homeRoundTrip = $homePatched.Remove(
            $insertAt,
            $insertedBlock.Length
        )

        if ($homeRoundTrip -ne $homeOriginal) {
            Stop-OnCriticalFailure '[HOME] A prova de conservação falhou. O patch seria capaz de alterar conteúdo existente.'
        }

        if ((Count-Occurrences -Text $homePatched -Needle $HomeNoticeTitle) -ne 1) {
            Stop-OnCriticalFailure '[HOME] A validação do aviso após inserção falhou.'
        }

        $homeChanged = $true
        Write-Success 'Home preparada: somente um bloco informativo foi acrescentado.'
    }
    else {
        Write-Warning 'O aviso já existe na home. Nenhuma nova cópia será adicionada.'
    }

    if ($Audit.OldFaqCount -eq 1) {
        $businessPatched = $businessOriginal.Replace(
            $OldFoodAnswer,
            $NewFoodAnswer
        )

        # Prova de conservação: desfazer a única troca deve reproduzir
        # exatamente o arquivo original.
        $businessRoundTrip = $businessPatched.Replace(
            $NewFoodAnswer,
            $OldFoodAnswer
        )

        if ($businessRoundTrip -ne $businessOriginal) {
            Stop-OnCriticalFailure '[FOOD] A prova de conservação do FAQ falhou.'
        }

        if ((Count-Occurrences -Text $businessPatched -Needle $OldFoodAnswer) -ne 0) {
            Stop-OnCriticalFailure '[FOOD] A frase antiga permaneceu após a substituição.'
        }

        if ((Count-Occurrences -Text $businessPatched -Needle $NewFoodAnswer) -ne 1) {
            Stop-OnCriticalFailure '[FOOD] A nova resposta não ficou exatamente uma vez.'
        }

        $businessChanged = $true
        Write-Success 'FAQ Food preparado: somente a resposta antiga foi substituída.'
    }
    elseif ($Audit.NewFaqCount -eq 1) {
        Write-Warning 'O FAQ Food já contém a nova resposta. Nenhuma troca será repetida.'
    }

    if ($DryRun) {
        Write-Host ''
        Write-Host '[DRY-RUN] Mudanças que seriam feitas:' -ForegroundColor Magenta

        if ($homeChanged) {
            Write-Host ('  + ' + $HomeRelativePath + ': acrescentar aviso sobre Mercado Pago.')
        }

        if ($businessChanged) {
            Write-Host ('  ~ ' + $BusinessTypesRelativePath + ': atualizar uma resposta do FAQ Food.')
        }

        return [pscustomobject]@{
            HomeChanged = $homeChanged
            BusinessChanged = $businessChanged
            HomePatched = $homePatched
            BusinessPatched = $businessPatched
            InsertedBlock = $insertedBlock
        }
    }

    if ($homeChanged) {
        Backup-ProjectFile $HomeRelativePath | Out-Null

        Write-TextFilePreservingEncoding `
            -Path $HomePath `
            -Content $homePatched `
            -HasBom $Audit.HomeState.HasBom

        Add-ChangedFile $HomeRelativePath
        Write-LogLine ('CHANGE: ' + $HomeRelativePath + ' - acréscimo informativo Mercado Pago')
    }

    if ($businessChanged) {
        Backup-ProjectFile $BusinessTypesRelativePath | Out-Null

        Write-TextFilePreservingEncoding `
            -Path $BusinessTypesPath `
            -Content $businessPatched `
            -HasBom $Audit.BusinessState.HasBom

        Add-ChangedFile $BusinessTypesRelativePath
        Write-LogLine ('CHANGE: ' + $BusinessTypesRelativePath + ' - atualização FAQ Food')
    }

    return [pscustomobject]@{
        HomeChanged = $homeChanged
        BusinessChanged = $businessChanged
        HomePatched = $homePatched
        BusinessPatched = $businessPatched
        InsertedBlock = $insertedBlock
    }
}

function Validate-PostPatch {
    param(
        [object]$Audit,
        [object]$Patch
    )

    Write-Step 'Validando que nenhuma lógica existente foi alterada'

    $homeAfter = Get-TextFileState $HomePath
    $businessAfter = Get-TextFileState $BusinessTypesPath

    if ((Count-Occurrences -Text $homeAfter.Text -Needle $HomeNoticeTitle) -ne 1) {
        Stop-OnCriticalFailure '[QA] O aviso Mercado Pago não existe exatamente uma vez na home.'
    }

    if ((Count-Occurrences -Text $businessAfter.Text -Needle $OldFoodAnswer) -ne 0) {
        Stop-OnCriticalFailure '[QA] A resposta antiga do FAQ ainda está presente.'
    }

    if ((Count-Occurrences -Text $businessAfter.Text -Needle $NewFoodAnswer) -ne 1) {
        Stop-OnCriticalFailure '[QA] A nova resposta do FAQ não existe exatamente uma vez.'
    }

    if ($Patch.HomeChanged) {
        $positionAfter = Find-HomeHeroInsertionPoint -Content $homeAfter.Text

        if ($positionAfter.HomeDeclarationIndex -ne $Audit.HomePosition.HomeDeclarationIndex) {
            Stop-OnCriticalFailure '[QA] A declaração HomePage mudou de posição de forma inesperada.'
        }

        $withoutNotice = $homeAfter.Text.Replace($Patch.InsertedBlock, '')

        if ($withoutNotice -ne $Audit.HomeState.Text) {
            Stop-OnCriticalFailure '[QA] A home possui diferenças além do bloco informativo acrescentado.'
        }

        Add-QaResult `
            -Area 'Conservação da home' `
            -Status 'PASSOU' `
            -Detail 'Removendo o novo bloco, app/page.tsx volta exatamente ao texto auditado antes do patch.'
    }
    else {
        Add-QaResult `
            -Area 'Conservação da home' `
            -Status 'PASSOU' `
            -Detail 'Aviso já existia e a home não foi reescrita.'
    }

    if ($Patch.BusinessChanged) {
        $businessRoundTrip = $businessAfter.Text.Replace(
            $NewFoodAnswer,
            $OldFoodAnswer
        )

        if ($businessRoundTrip -ne $Audit.BusinessState.Text) {
            Stop-OnCriticalFailure '[QA] business-types.ts possui diferença além da resposta solicitada.'
        }

        Add-QaResult `
            -Area 'Conservação business-types' `
            -Status 'PASSOU' `
            -Detail 'Revertendo a resposta nova para a antiga, o arquivo volta exatamente ao texto auditado.'
    }
    else {
        Add-QaResult `
            -Area 'Conservação business-types' `
            -Status 'PASSOU' `
            -Detail 'FAQ já estava atualizado e o arquivo não foi reescrito.'
    }

    if (-not (Test-ProtectedFilesUnchanged)) {
        Stop-OnCriticalFailure '[QA] Um ou mais arquivos fora do escopo foram modificados.'
    }

    Add-QaResult `
        -Area 'Escopo protegido' `
        -Status 'PASSOU' `
        -Detail 'Pagamentos, checkout, proxy, package e componentes protegidos permaneceram inalterados.'

    Write-Success 'QA de conservação passou.'
}

function Write-Manifest {
    if ($DryRun) {
        return
    }

    $lines = New-Object System.Collections.Generic.List[string]
    $lines.Add('ORCALY - MANIFESTO DO PATCH MERCADO PAGO HOME')
    $lines.Add(('Data: ' + (Get-Date -Format 'dd/MM/yyyy HH:mm:ss')))
    $lines.Add('')

    if ($ChangedFiles.Count -eq 0) {
        $lines.Add('Nenhum arquivo foi alterado.')
    }
    else {
        $lines.Add('Arquivos alterados:')

        foreach ($relative in $ChangedFiles) {
            $lines.Add('- ' + $relative)
        }
    }

    $lines.Add('')
    $lines.Add('Arquivos explicitamente fora do escopo:')

    foreach ($relative in $ProtectedFiles) {
        $lines.Add('- ' + $relative)
    }

    [System.IO.File]::WriteAllText(
        $ManifestPath,
        (($lines -join [Environment]::NewLine) + [Environment]::NewLine),
        $Utf8NoBom
    )
}

function Format-CommandResult {
    param([object]$Result)

    if ($null -eq $Result) {
        return 'NAO TESTADO'
    }

    if ($Result.PSObject.Properties.Name -contains 'Skipped' -and $Result.Skipped) {
        return 'NAO TESTADO'
    }

    if ($Result.Passed) {
        return 'PASSOU'
    }

    return 'FALHOU'
}

function Write-Report {
    param(
        [object]$Audit,
        [object]$Patch
    )

    if ($DryRun) {
        return
    }

    $lines = New-Object System.Collections.Generic.List[string]

    $lines.Add('# Relatório - Mercado Pago na Home do Orçaly')
    $lines.Add('')
    $lines.Add(('Gerado em: ' + (Get-Date -Format 'dd/MM/yyyy HH:mm:ss')))
    $lines.Add(('Branch: ' + $Audit.GitInfo.Branch))
    $lines.Add('')
    $lines.Add('## 1. Escopo solicitado')
    $lines.Add('- Acrescentar informação de recebimento online via Mercado Pago na home.')
    $lines.Add('- Substituir a resposta antiga do FAQ Food que dizia que o pagamento era combinado pelo WhatsApp.')
    $lines.Add('- Não alterar layout, lógica, backend, Supabase, checkout, OAuth, assinatura ou pagamentos.')
    $lines.Add('')
    $lines.Add('## 2. Auditoria antes do patch')

    foreach ($line in $AuditLines) {
        if ([string]::IsNullOrWhiteSpace($line)) {
            $lines.Add('')
        }
        else {
            $lines.Add('- ' + $line)
        }
    }

    $lines.Add('')
    $lines.Add('## 3. Arquivos alterados')

    if ($ChangedFiles.Count -eq 0) {
        $lines.Add('- Nenhum. O conteúdo solicitado já estava aplicado.')
    }
    else {
        foreach ($relative in $ChangedFiles) {
            $lines.Add('- ' + $relative)
        }
    }

    $lines.Add('')
    $lines.Add('## 4. Conteúdo acrescentado na home')
    $lines.Add('- Título: ' + $HomeNoticeTitle)
    $lines.Add('- Texto: ' + $HomeNoticeBody)
    $lines.Add('')
    $lines.Add('## 5. FAQ Food')
    $lines.Add('- Antes: ' + $OldFoodAnswer)
    $lines.Add('- Depois: ' + $NewFoodAnswer)
    $lines.Add('')
    $lines.Add('## 6. Validações')

    foreach ($qa in $QaResults) {
        $lines.Add('- [' + $qa.Status + '] ' + $qa.Area + ': ' + $qa.Detail)
    }

    $lines.Add('')
    $lines.Add('## 7. Comandos')
    $lines.Add('- Build inicial: ' + (Format-CommandResult $BuildResults.InitialBuild))
    $lines.Add('- Lint inicial: ' + (Format-CommandResult $BuildResults.InitialLint))
    $lines.Add('- Typecheck inicial: ' + (Format-CommandResult $BuildResults.InitialTypecheck))
    $lines.Add('- Build final: ' + (Format-CommandResult $BuildResults.FinalBuild))
    $lines.Add('- Lint final: ' + (Format-CommandResult $BuildResults.FinalLint))
    $lines.Add('- Typecheck final: ' + (Format-CommandResult $BuildResults.FinalTypecheck))
    $lines.Add('')
    $lines.Add('## 8. Itens não alterados')
    $lines.Add('- Mercado Pago backend e OAuth.')
    $lines.Add('- Checkout e webhooks.')
    $lines.Add('- Supabase, migrations e RLS.')
    $lines.Add('- package.json e dependências.')
    $lines.Add('- proxy.ts / middleware.ts.')
    $lines.Add('- Assinatura e painel de pagamentos.')
    $lines.Add('- Estrutura visual e componentes existentes da home.')
    $lines.Add('')
    $lines.Add('## 9. Publicação')
    $lines.Add('- Nenhum commit foi criado.')
    $lines.Add('- Nenhum push foi executado.')
    $lines.Add('- Nenhum deploy foi executado.')

    [System.IO.File]::WriteAllText(
        $ReportPath,
        (($lines -join [Environment]::NewLine) + [Environment]::NewLine),
        $Utf8NoBom
    )
}

function Show-Diff {
    Write-Step 'Diff final restrito aos dois arquivos do escopo'

    try {
        & git --no-pager diff -- $HomeRelativePath $BusinessTypesRelativePath
    }
    catch {
        Write-Warning ('Não foi possível mostrar git diff: ' + $_.Exception.Message)
    }
}

function Show-FinalSummary {
    Write-Host ''
    Write-Host '============================================================' -ForegroundColor Green
    Write-Host ' ORÇALY - PATCH MERCADO PAGO CONCLUÍDO' -ForegroundColor Green
    Write-Host '============================================================' -ForegroundColor Green
    Write-Host ''
    Write-Host ('Build inicial: ' + (Format-CommandResult $BuildResults.InitialBuild))
    Write-Host ('Build final: ' + (Format-CommandResult $BuildResults.FinalBuild))
    Write-Host ('Lint inicial: ' + (Format-CommandResult $BuildResults.InitialLint))
    Write-Host ('Lint final: ' + (Format-CommandResult $BuildResults.FinalLint))
    Write-Host ('Typecheck inicial: ' + (Format-CommandResult $BuildResults.InitialTypecheck))
    Write-Host ('Typecheck final: ' + (Format-CommandResult $BuildResults.FinalTypecheck))
    Write-Host ('Arquivos alterados: ' + $ChangedFiles.Count)

    foreach ($relative in $ChangedFiles) {
        Write-Host ('  - ' + $relative)
    }

    Write-Host ''
    Write-Host ('Backup: ' + (Get-RelativeProjectPath $BackupRoot))
    Write-Host ('Relatório: ' + (Get-RelativeProjectPath $ReportPath))
    Write-Host ('Manifesto: ' + (Get-RelativeProjectPath $ManifestPath))
    Write-Host ''
    Write-Host 'Nenhum commit, push, deploy, migration ou alteração no Supabase foi executado.' -ForegroundColor Cyan
}

$Audit = $null
$Patch = $null
$CriticalPostWriteFailure = $false

try {
    Write-Host ''
    Write-Host 'ORÇALY - PATCH CONSERVADOR: MERCADO PAGO NA HOME' -ForegroundColor Cyan
    Write-Host 'Audita primeiro, altera somente depois e valida conservação.' -ForegroundColor DarkCyan

    $requiredFiles = @(
        'package.json',
        $HomeRelativePath,
        $BusinessTypesRelativePath
    )

    $requiredDirectories = @(
        'app',
        'components',
        'lib'
    )

    foreach ($relative in $requiredFiles) {
        if (-not (Test-ProjectFile $relative)) {
            Stop-OnCriticalFailure ('Execute o script na raiz correta. Arquivo ausente: ' + $relative)
        }
    }

    foreach ($relative in $requiredDirectories) {
        if (-not (Test-ProjectFile -RelativePath $relative -Directory)) {
            Stop-OnCriticalFailure ('Execute o script na raiz correta. Diretório ausente: ' + $relative)
        }
    }

    if (-not (Test-Path -LiteralPath (Join-Path $ProjectRoot '.git') -PathType Container)) {
        Stop-OnCriticalFailure 'A pasta atual não parece ser o repositório Git do Orçaly.'
    }

    if (-not $DryRun) {
        [System.IO.Directory]::CreateDirectory($BackupRoot) | Out-Null
        Write-LogLine ('START: ' + $ProjectRoot)
        Write-Success ('Diretório de segurança criado: ' + (Get-RelativeProjectPath $BackupRoot))
    }
    else {
        Write-Warning 'DryRun ativo: nenhuma alteração será gravada.'
    }

    Snapshot-ProtectedHashes -Destination $ProtectedHashesBefore

    $Audit = Audit-Project

    Write-Step 'Validando o estado atual antes da mudança'

    $initialDiff = Invoke-GitDiffCheck -Label 'git-diff-check-inicial'
    $BuildResults.InitialDiffCheck = $initialDiff

    if (-not $initialDiff.Passed) {
        Stop-OnCriticalFailure ('git diff --check já falha nos arquivos do escopo antes do patch. Corrija primeiro. ' + $initialDiff.Output)
    }

    Add-QaResult `
        -Area 'git diff --check inicial' `
        -Status 'PASSOU' `
        -Detail 'Os arquivos-alvo não tinham erros de whitespace no diff atual.'

    $scripts = @(Get-PackageScripts)

    if ($DryRun) {
        $BuildResults.InitialBuild = [pscustomobject]@{ Passed = $false; Skipped = $true }
        $BuildResults.InitialLint = [pscustomobject]@{ Passed = $false; Skipped = $true }
        $BuildResults.InitialTypecheck = [pscustomobject]@{ Passed = $false; Skipped = $true }
    }
    else {
        if (-not $SkipInitialBuild -and ('build' -in $scripts)) {
            Write-Step 'Executando build inicial para registrar o estado anterior'
            $BuildResults.InitialBuild = Invoke-NpmCommand -Label 'build-inicial' -Arguments @('run', 'build')

            if ($BuildResults.InitialBuild.Passed) {
                Write-Success 'Build inicial passou.'
            }
            else {
                Write-Warning 'Build inicial já falhava antes do patch. O script continuará e comparará o resultado final.'
            }
        }
        else {
            $BuildResults.InitialBuild = [pscustomobject]@{ Passed = $false; Skipped = $true }
        }

        if (-not $SkipLint -and ('lint' -in $scripts)) {
            Write-Step 'Executando lint inicial'
            $BuildResults.InitialLint = Invoke-NpmCommand -Label 'lint-inicial' -Arguments @('run', 'lint')

            if ($BuildResults.InitialLint.Passed) {
                Write-Success 'Lint inicial passou.'
            }
            else {
                Write-Warning 'Lint inicial já apresentava falha.'
            }
        }
        else {
            $BuildResults.InitialLint = [pscustomobject]@{ Passed = $false; Skipped = $true }
        }

        if (-not $SkipTypecheck -and ('typecheck' -in $scripts)) {
            Write-Step 'Executando typecheck inicial'
            $BuildResults.InitialTypecheck = Invoke-NpmCommand -Label 'typecheck-inicial' -Arguments @('run', 'typecheck')

            if ($BuildResults.InitialTypecheck.Passed) {
                Write-Success 'Typecheck inicial passou.'
            }
            else {
                Write-Warning 'Typecheck inicial já apresentava falha.'
            }
        }
        else {
            $BuildResults.InitialTypecheck = [pscustomobject]@{ Passed = $false; Skipped = $true }
        }
    }

    $Patch = Apply-RequestedChanges -Audit $Audit

    if ($DryRun) {
        Write-Host ''
        Write-Host 'DryRun concluído. Nenhum arquivo foi alterado.' -ForegroundColor Green
        exit 0
    }

    if (-not $Patch.HomeChanged -and -not $Patch.BusinessChanged) {
        Add-QaResult `
            -Area 'Idempotência' `
            -Status 'PASSOU' `
            -Detail 'As duas mudanças já estavam aplicadas; nenhum arquivo foi reescrito.'
    }

    Validate-PostPatch -Audit $Audit -Patch $Patch

    Write-Step 'Executando git diff --check final'
    $finalDiff = Invoke-GitDiffCheck -Label 'git-diff-check-final'
    $BuildResults.FinalDiffCheck = $finalDiff

    if (-not $finalDiff.Passed) {
        $CriticalPostWriteFailure = $true
        Stop-OnCriticalFailure ('git diff --check falhou após o patch: ' + $finalDiff.Output)
    }

    Add-QaResult `
        -Area 'git diff --check final' `
        -Status 'PASSOU' `
        -Detail 'Nenhum erro de whitespace introduzido.'

    if (-not $SkipFinalBuild -and ('build' -in $scripts)) {
        Write-Step 'Executando build final'
        $BuildResults.FinalBuild = Invoke-NpmCommand -Label 'build-final' -Arguments @('run', 'build')

        if ($BuildResults.FinalBuild.Passed) {
            Write-Success 'Build final passou.'
            Add-QaResult -Area 'Build final' -Status 'PASSOU' -Detail 'npm.cmd run build concluiu com sucesso.'
        }
        else {
            Add-QaResult -Area 'Build final' -Status 'FALHOU' -Detail ('Código de saída: ' + $BuildResults.FinalBuild.ExitCode)

            if (
                $null -ne $BuildResults.InitialBuild -and
                -not $BuildResults.InitialBuild.Skipped -and
                $BuildResults.InitialBuild.Passed
            ) {
                $CriticalPostWriteFailure = $true
                Stop-OnCriticalFailure 'O build passava antes e falhou após o patch. Rollback obrigatório.'
            }

            Write-Warning 'Build final falhou, mas o build inicial também já falhava. O relatório preservará essa informação.'
        }
    }
    else {
        $BuildResults.FinalBuild = [pscustomobject]@{ Passed = $false; Skipped = $true }
        Add-QaResult -Area 'Build final' -Status 'NAO TESTADO' -Detail 'Ignorado por parâmetro ou script build ausente.'
    }

    if (-not $SkipLint -and ('lint' -in $scripts)) {
        Write-Step 'Executando lint final'
        $BuildResults.FinalLint = Invoke-NpmCommand -Label 'lint-final' -Arguments @('run', 'lint')

        if ($BuildResults.FinalLint.Passed) {
            Write-Success 'Lint final passou.'
            Add-QaResult -Area 'Lint final' -Status 'PASSOU' -Detail 'npm.cmd run lint concluiu com sucesso.'
        }
        else {
            Add-QaResult -Area 'Lint final' -Status 'FALHOU' -Detail ('Código de saída: ' + $BuildResults.FinalLint.ExitCode)

            if (
                $null -ne $BuildResults.InitialLint -and
                -not $BuildResults.InitialLint.Skipped -and
                $BuildResults.InitialLint.Passed
            ) {
                $CriticalPostWriteFailure = $true
                Stop-OnCriticalFailure 'O lint passava antes e falhou após o patch. Rollback obrigatório.'
            }

            Write-Warning 'Lint final falhou, mas o lint inicial também já falhava.'
        }
    }
    else {
        $BuildResults.FinalLint = [pscustomobject]@{ Passed = $false; Skipped = $true }
        Add-QaResult -Area 'Lint final' -Status 'NAO TESTADO' -Detail 'Ignorado por parâmetro ou script lint ausente.'
    }

    if (-not $SkipTypecheck -and ('typecheck' -in $scripts)) {
        Write-Step 'Executando typecheck final'
        $BuildResults.FinalTypecheck = Invoke-NpmCommand -Label 'typecheck-final' -Arguments @('run', 'typecheck')

        if ($BuildResults.FinalTypecheck.Passed) {
            Write-Success 'Typecheck final passou.'
            Add-QaResult -Area 'Typecheck final' -Status 'PASSOU' -Detail 'npm.cmd run typecheck concluiu com sucesso.'
        }
        else {
            Add-QaResult -Area 'Typecheck final' -Status 'FALHOU' -Detail ('Código de saída: ' + $BuildResults.FinalTypecheck.ExitCode)

            if (
                $null -ne $BuildResults.InitialTypecheck -and
                -not $BuildResults.InitialTypecheck.Skipped -and
                $BuildResults.InitialTypecheck.Passed
            ) {
                $CriticalPostWriteFailure = $true
                Stop-OnCriticalFailure 'O typecheck passava antes e falhou após o patch. Rollback obrigatório.'
            }

            Write-Warning 'Typecheck final falhou, mas o typecheck inicial também já falhava.'
        }
    }
    else {
        $BuildResults.FinalTypecheck = [pscustomobject]@{ Passed = $false; Skipped = $true }
        Add-QaResult -Area 'Typecheck final' -Status 'NAO TESTADO' -Detail 'Ignorado por parâmetro ou script typecheck ausente.'
    }

    if (-not (Test-ProtectedFilesUnchanged)) {
        $CriticalPostWriteFailure = $true
        Stop-OnCriticalFailure 'Arquivo fora do escopo foi modificado durante as validações.'
    }

    Show-Diff

    Write-Manifest
    Write-Report -Audit $Audit -Patch $Patch
    Show-FinalSummary
}
catch {
    Write-Failure $_.Exception.Message

    if (-not $DryRun) {
        if ($ChangedFiles.Count -gt 0) {
            Write-Warning 'Uma falha ocorreu após preparação/gravação. Restaurando somente os arquivos alterados por este patch.'
            Restore-ChangedFiles
        }

        try {
            Write-Manifest

            if ($null -ne $Audit -and $null -ne $Patch) {
                Write-Report -Audit $Audit -Patch $Patch
            }
        }
        catch {
            Write-Failure ('Também houve falha ao gerar o diagnóstico final: ' + $_.Exception.Message)
        }

        if (Test-Path -LiteralPath $BackupRoot -PathType Container) {
            Write-Host ('Backups e logs preservados em: ' + (Get-RelativeProjectPath $BackupRoot)) -ForegroundColor Yellow
        }
    }

    exit 1
}
