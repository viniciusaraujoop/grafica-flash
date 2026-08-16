param(
    [switch]$DryRun,
    [switch]$SkipInitialBuild,
    [switch]$SkipFinalBuild,
    [switch]$SkipLint
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$Root = (Get-Location).Path
$Timestamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$BackupRoot = Join-Path $Root ('.orcaly-backups\mercado-pago-home-' + $Timestamp)
$LogPath = Join-Path $BackupRoot 'execucao.log'
$ManifestPath = Join-Path $BackupRoot 'manifesto.txt'
$ReportPath = Join-Path $BackupRoot 'relatorio.txt'

$HomeRelative = 'app/page.tsx'
$HomePath = Join-Path $Root 'app\page.tsx'

$PatchApplied = $false
$BackupHomePath = $null
$Utf8NoBom = New-Object System.Text.UTF8Encoding($false, $true)

$ProtectedFiles = @(
    'package.json',
    'package-lock.json',
    'proxy.ts',
    'middleware.ts',
    'lib/mercado-pago.ts',
    'lib/payments/checkout-service.ts',
    'app/api/marketplace/payments/mercado-pago/connect/route.ts',
    'app/api/marketplace/payments/mercado-pago/callback/route.ts',
    'app/api/marketplace/payments/mercado-pago/disconnect/route.ts',
    'app/api/marketplace/payments/webhook/mercado-pago/route.ts',
    'app/api/marketplace/payments/create/route.ts',
    'app/painel/assinatura/page.tsx',
    'app/painel/pagamentos/page.tsx'
)

function Ensure-Directory {
    param([string]$Path)

    if (-not (Test-Path -LiteralPath $Path -PathType Container)) {
        [System.IO.Directory]::CreateDirectory($Path) | Out-Null
    }
}

function Write-Log {
    param([string]$Message)

    if ($DryRun) {
        return
    }

    Ensure-Directory $BackupRoot

    $line = '[{0}] {1}{2}' -f (
        Get-Date -Format 'yyyy-MM-dd HH:mm:ss'
    ), $Message, [Environment]::NewLine

    [System.IO.File]::AppendAllText(
        $LogPath,
        $line,
        (New-Object System.Text.UTF8Encoding($false))
    )
}

function Step {
    param([string]$Message)

    Write-Host ''
    Write-Host ('==> ' + $Message) -ForegroundColor Cyan
    Write-Log ('STEP: ' + $Message)
}

function Ok {
    param([string]$Message)

    Write-Host ('[OK] ' + $Message) -ForegroundColor Green
    Write-Log ('OK: ' + $Message)
}

function Warn {
    param([string]$Message)

    Write-Host ('[AVISO] ' + $Message) -ForegroundColor Yellow
    Write-Log ('WARNING: ' + $Message)
}

function Fail {
    param([string]$Message)

    Write-Host ('[ERRO] ' + $Message) -ForegroundColor Red
    Write-Log ('ERROR: ' + $Message)
}

function Get-FileHashSafe {
    param([string]$RelativePath)

    $fullPath = Join-Path $Root ($RelativePath -replace '/', '\')

    if (-not (Test-Path -LiteralPath $fullPath -PathType Leaf)) {
        return $null
    }

    return (Get-FileHash -LiteralPath $fullPath -Algorithm SHA256).Hash
}

function Snapshot-ProtectedFiles {
    $snapshot = @{}

    foreach ($relative in $ProtectedFiles) {
        $snapshot[$relative] = Get-FileHashSafe $relative
    }

    return $snapshot
}

function Assert-ProtectedFilesUnchanged {
    param([hashtable]$Before)

    foreach ($relative in $ProtectedFiles) {
        $after = Get-FileHashSafe $relative
        $beforeHash = $Before[$relative]

        if ($beforeHash -ne $after) {
            throw "Arquivo protegido foi alterado inesperadamente: $relative"
        }
    }

    Ok 'Arquivos protegidos permaneceram intactos.'
}

function Get-Utf8FileState {
    param([string]$Path)

    $bytes = [System.IO.File]::ReadAllBytes($Path)

    $hasBom = (
        $bytes.Length -ge 3 -and
        $bytes[0] -eq 0xEF -and
        $bytes[1] -eq 0xBB -and
        $bytes[2] -eq 0xBF
    )

    $offset = if ($hasBom) { 3 } else { 0 }

    try {
        $text = $Utf8NoBom.GetString(
            $bytes,
            $offset,
            $bytes.Length - $offset
        )
    }
    catch {
        throw "O arquivo $Path nao esta em UTF-8 valido. Nenhuma alteracao sera feita."
    }

    $newLine = if ($text.Contains("`r`n")) { "`r`n" } else { "`n" }

    return [pscustomobject]@{
        Bytes = $bytes
        Text = $text
        HasBom = $hasBom
        NewLine = $newLine
    }
}

function Write-Utf8PreservingBom {
    param(
        [string]$Path,
        [string]$Content,
        [bool]$HasBom
    )

    $contentBytes = $Utf8NoBom.GetBytes($Content)

    if ($HasBom) {
        $bom = [byte[]](0xEF, 0xBB, 0xBF)
        $all = New-Object byte[] ($bom.Length + $contentBytes.Length)

        [System.Array]::Copy($bom, 0, $all, 0, $bom.Length)
        [System.Array]::Copy(
            $contentBytes,
            0,
            $all,
            $bom.Length,
            $contentBytes.Length
        )

        [System.IO.File]::WriteAllBytes($Path, $all)
        return
    }

    [System.IO.File]::WriteAllBytes($Path, $contentBytes)
}

function Backup-Home {
    if ($DryRun) {
        return $null
    }

    $destination = Join-Path $BackupRoot 'app\page.tsx'
    Ensure-Directory (Split-Path -Parent $destination)

    Copy-Item -LiteralPath $HomePath -Destination $destination -Force
    Ok ('Backup criado: ' + $destination)

    return $destination
}

function Restore-Home {
    if (
        $null -ne $BackupHomePath -and
        (Test-Path -LiteralPath $BackupHomePath -PathType Leaf)
    ) {
        Copy-Item -LiteralPath $BackupHomePath -Destination $HomePath -Force
        Warn 'A home foi restaurada automaticamente a partir do backup.'
    }
}

function Invoke-External {
    param(
        [string]$Executable,
        [string[]]$Arguments,
        [string]$Label,
        [switch]$AllowFailure
    )

    Step $Label

    $output = ''
    $exitCode = -1

    try {
        $output = (& $Executable @Arguments 2>&1 | Out-String)
        $exitCode = $LASTEXITCODE
    }
    catch {
        $output = $_.Exception.Message
        $exitCode = -1
    }

    if (-not [string]::IsNullOrWhiteSpace($output)) {
        Write-Host $output.TrimEnd()
        Write-Log $output.TrimEnd()
    }

    if ($exitCode -ne 0) {
        if ($AllowFailure) {
            Warn "$Label retornou codigo $exitCode."
        }
        else {
            throw "$Label falhou com codigo $exitCode."
        }
    }
    else {
        Ok $Label
    }

    return [pscustomobject]@{
        ExitCode = $exitCode
        Output = $output
        Passed = ($exitCode -eq 0)
    }
}

function Assert-ProjectRoot {
    Step 'Validando raiz do projeto'

    $required = @(
        'package.json',
        'app',
        'components',
        'lib',
        '.git'
    )

    foreach ($item in $required) {
        $path = Join-Path $Root $item

        if (-not (Test-Path -LiteralPath $path)) {
            throw "Execute este arquivo na raiz do projeto Orçaly. Ausente: $item"
        }
    }

    if (-not (Test-Path -LiteralPath $HomePath -PathType Leaf)) {
        throw 'A home esperada app/page.tsx nao foi encontrada.'
    }

    Ok ('Raiz confirmada: ' + $Root)
}

function Audit-Home {
    param([string]$Content)

    Step 'Lendo e auditando a home atual'

    $requiredMarkers = @(
        'export default function HomePage()',
        '<main className="w-full overflow-x-hidden bg-white text-[#061a36]"',
        'Especializado para vender. Unificado para escalar.',
        "['Food', 'Gráfica', 'Beauty', 'Assistência', 'Loja', 'Serviços'].map((item) => (",
        'Orçaly {item}'
    )

    foreach ($marker in $requiredMarkers) {
        if (-not $Content.Contains($marker)) {
            throw "A estrutura atual da home divergiu do esperado. Marcador ausente: $marker"
        }
    }

    $segmentMarker = "['Food', 'Gráfica', 'Beauty', 'Assistência', 'Loja', 'Serviços'].map((item) => ("

    $first = $Content.IndexOf(
        $segmentMarker,
        [System.StringComparison]::Ordinal
    )

    $last = $Content.LastIndexOf(
        $segmentMarker,
        [System.StringComparison]::Ordinal
    )

    if ($first -lt 0 -or $first -ne $last) {
        throw 'O bloco de segmentos da home nao e unico. O script abortou para evitar alteracao ambigua.'
    }

    Ok 'Estrutura principal e bloco de segmentos identificados sem ambiguidade.'
}

function Build-NewHomeContent {
    param(
        [string]$Content,
        [string]$NewLine
    )

    if ($Content.Contains('Recebimento exclusivo pelo Mercado Pago')) {
        return [pscustomobject]@{
            Changed = $false
            Content = $Content
            Reason = 'A informacao ja existe.'
        }
    }

    $segmentMarker = "['Food', 'Gráfica', 'Beauty', 'Assistência', 'Loja', 'Serviços'].map((item) => ("
    $markerIndex = $Content.IndexOf(
        $segmentMarker,
        [System.StringComparison]::Ordinal
    )

    if ($markerIndex -lt 0) {
        throw 'Nao foi possivel localizar o bloco de segmentos.'
    }

    $mapEndMarker = '              ))}'
    $mapEndIndex = $Content.IndexOf(
        $mapEndMarker,
        $markerIndex,
        [System.StringComparison]::Ordinal
    )

    if ($mapEndIndex -lt 0) {
        throw 'Nao foi possivel identificar o encerramento do map de segmentos.'
    }

    $closingDivMarker = $NewLine + '            </div>'
    $closingDivIndex = $Content.IndexOf(
        $closingDivMarker,
        $mapEndIndex,
        [System.StringComparison]::Ordinal
    )

    if ($closingDivIndex -lt 0) {
        throw 'Nao foi possivel identificar o fechamento do bloco visual dos segmentos.'
    }

    $insertAt = $closingDivIndex + $closingDivMarker.Length

    $nextSectionBoundary = $Content.IndexOf(
        $NewLine + '          </div>',
        $insertAt,
        [System.StringComparison]::Ordinal
    )

    if ($nextSectionBoundary -lt 0) {
        throw 'Nao foi possivel confirmar o limite do conteudo do hero.'
    }

    $DisclosureBlock = @'
            <p className="mx-auto mt-4 max-w-2xl text-center text-xs font-bold leading-5 text-[#607895] lg:mx-0 lg:text-left">
              <strong className="text-[#05245c]">Recebimento exclusivo pelo Mercado Pago.</strong>{' '}
              Todos os recebimentos de valores realizados pelo Orçaly são processados exclusivamente pela infraestrutura do Mercado Pago, oferecendo mais segurança e confiabilidade nas transações.
            </p>
'@

    $DisclosureBlock = $DisclosureBlock -replace "`r?`n", $NewLine

    $newContent = (
        $Content.Substring(0, $insertAt) +
        $NewLine +
        $NewLine +
        $DisclosureBlock +
        $Content.Substring($insertAt)
    )

    if (-not $newContent.Contains('Recebimento exclusivo pelo Mercado Pago')) {
        throw 'Falha interna: o texto esperado nao foi inserido.'
    }

    return [pscustomobject]@{
        Changed = $true
        Content = $newContent
        Reason = 'Aviso de recebimento exclusivo pelo Mercado Pago inserido no hero.'
    }
}

function Write-ManifestAndReport {
    param(
        [string]$InitialHash,
        [string]$FinalHash,
        [string]$InitialStatus,
        [string]$FinalStatus,
        [string]$LintStatus
    )

    if ($DryRun) {
        return
    }

    Ensure-Directory $BackupRoot

    $manifest = @(
        'ORCALY - MANIFESTO DA ALTERACAO',
        '',
        'Escopo permitido:',
        '- app/page.tsx',
        '',
        'Arquivos de negocio/pagamentos protegidos:',
        ($ProtectedFiles | ForEach-Object { '- ' + $_ }),
        '',
        'Hash inicial app/page.tsx:',
        $InitialHash,
        '',
        'Hash final app/page.tsx:',
        $FinalHash
    ) -join [Environment]::NewLine

    [System.IO.File]::WriteAllText(
        $ManifestPath,
        $manifest + [Environment]::NewLine,
        (New-Object System.Text.UTF8Encoding($false))
    )

    $report = @(
        'ORCALY - RELATORIO MERCADO PAGO NA HOME',
        '',
        ('Data: ' + (Get-Date -Format 'dd/MM/yyyy HH:mm:ss')),
        ('Projeto: ' + $Root),
        '',
        'OBJETIVO',
        'Adicionar na pagina inicial a informacao de que o recebimento de valores ocorre exclusivamente pelo Mercado Pago, preservando o visual e toda a logica existente.',
        '',
        'ALTERACAO',
        '- Arquivo alterado: app/page.tsx',
        '- Nenhuma API de pagamento alterada.',
        '- Nenhuma configuracao do Mercado Pago alterada.',
        '- Nenhuma regra de checkout alterada.',
        '- Nenhuma assinatura alterada.',
        '- Nenhum arquivo Supabase alterado.',
        '- Nenhuma dependencia adicionada.',
        '',
        'VALIDACOES',
        ('- Build inicial: ' + $InitialStatus),
        ('- ESLint direcionado: ' + $LintStatus),
        ('- Build final: ' + $FinalStatus),
        '- git diff --check: executado',
        '- arquivos protegidos: hashes comparados',
        '',
        'BACKUP',
        ('- ' + $BackupHomePath)
    ) -join [Environment]::NewLine

    [System.IO.File]::WriteAllText(
        $ReportPath,
        $report + [Environment]::NewLine,
        (New-Object System.Text.UTF8Encoding($false))
    )
}

$InitialBuildStatus = 'PULADO'
$FinalBuildStatus = 'PULADO'
$LintStatus = 'PULADO'
$InitialHomeHash = $null
$FinalHomeHash = $null

try {
    Write-Host ''
    Write-Host '============================================================' -ForegroundColor Cyan
    Write-Host ' ORCALY - MERCADO PAGO NA PAGINA INICIAL' -ForegroundColor Cyan
    Write-Host ' PATCHER CONSERVADOR / LEITURA ANTES DE ALTERAR' -ForegroundColor Cyan
    Write-Host '============================================================' -ForegroundColor Cyan

    Assert-ProjectRoot

    if (-not $DryRun) {
        Ensure-Directory $BackupRoot
    }

    Step 'Registrando estado atual do Git'
    $gitStatusBefore = (& git status --short 2>&1 | Out-String).TrimEnd()
    $branch = (& git branch --show-current 2>&1 | Out-String).Trim()

    Write-Host ('Branch: ' + $branch)

    if ([string]::IsNullOrWhiteSpace($gitStatusBefore)) {
        Write-Host 'Working tree: sem alteracoes locais.'
    }
    else {
        Write-Host 'Alteracoes locais existentes serao preservadas:'
        Write-Host $gitStatusBefore
    }

    Write-Log ('BRANCH: ' + $branch)
    Write-Log ('STATUS BEFORE: ' + $gitStatusBefore)

    $ProtectedBefore = Snapshot-ProtectedFiles
    $InitialHomeHash = Get-FileHashSafe $HomeRelative

    $homeState = Get-Utf8FileState $HomePath
    Audit-Home $homeState.Text

    Invoke-External `
        -Executable 'git' `
        -Arguments @('diff', '--check', '--', $HomeRelative) `
        -Label 'Validando diff preexistente da home' | Out-Null

    if (-not $SkipInitialBuild) {
        $initialBuild = Invoke-External `
            -Executable 'npm.cmd' `
            -Arguments @('run', 'build') `
            -Label 'Executando build inicial antes de alterar'

        $InitialBuildStatus = if ($initialBuild.Passed) { 'PASSOU' } else { 'FALHOU' }
    }

    $result = Build-NewHomeContent `
        -Content $homeState.Text `
        -NewLine $homeState.NewLine

    if (-not $result.Changed) {
        Warn $result.Reason
        Assert-ProtectedFilesUnchanged $ProtectedBefore

        Write-Host ''
        Write-Host 'Nenhuma alteracao foi necessaria.' -ForegroundColor Yellow
        exit 0
    }

    Step 'Preparando alteracao minima da home'

    if ($DryRun) {
        Write-Host '[DRY-RUN] O script adicionaria apenas o aviso do Mercado Pago em app/page.tsx.' -ForegroundColor Magenta
        Assert-ProtectedFilesUnchanged $ProtectedBefore
        exit 0
    }

    $BackupHomePath = Backup-Home

    Write-Utf8PreservingBom `
        -Path $HomePath `
        -Content $result.Content `
        -HasBom $homeState.HasBom

    $PatchApplied = $true
    Ok 'app/page.tsx atualizado sem reformatar o restante do arquivo.'

    Step 'Confirmando que somente o conteudo previsto foi inserido'
    $afterState = Get-Utf8FileState $HomePath

    Audit-Home $afterState.Text

    $occurrences = [regex]::Matches(
        $afterState.Text,
        [regex]::Escape('Recebimento exclusivo pelo Mercado Pago')
    ).Count

    if ($occurrences -ne 1) {
        throw "O aviso deveria existir exatamente uma vez, mas foram encontradas $occurrences ocorrencias."
    }

    Ok 'Aviso do Mercado Pago existe exatamente uma vez.'

    Invoke-External `
        -Executable 'git' `
        -Arguments @('diff', '--check', '--', $HomeRelative) `
        -Label 'Executando git diff --check' | Out-Null

    if (-not $SkipLint) {
        $lint = Invoke-External `
            -Executable 'npx.cmd' `
            -Arguments @('--no-install', 'eslint', $HomeRelative) `
            -Label 'Executando ESLint apenas em app/page.tsx'

        $LintStatus = if ($lint.Passed) { 'PASSOU' } else { 'FALHOU' }
    }

    Assert-ProtectedFilesUnchanged $ProtectedBefore

    if (-not $SkipFinalBuild) {
        $finalBuild = Invoke-External `
            -Executable 'npm.cmd' `
            -Arguments @('run', 'build') `
            -Label 'Executando build final'

        $FinalBuildStatus = if ($finalBuild.Passed) { 'PASSOU' } else { 'FALHOU' }
    }

    Assert-ProtectedFilesUnchanged $ProtectedBefore

    $FinalHomeHash = Get-FileHashSafe $HomeRelative

    Step 'Exibindo diff final da home'
    $diff = (& git --no-pager diff -- $HomeRelative 2>&1 | Out-String)

    if (-not [string]::IsNullOrWhiteSpace($diff)) {
        Write-Host $diff.TrimEnd()
        Write-Log $diff.TrimEnd()
    }

    Write-ManifestAndReport `
        -InitialHash $InitialHomeHash `
        -FinalHash $FinalHomeHash `
        -InitialStatus $InitialBuildStatus `
        -FinalStatus $FinalBuildStatus `
        -LintStatus $LintStatus

    Write-Host ''
    Write-Host '============================================================' -ForegroundColor Green
    Write-Host ' ORCALY - ALTERACAO CONCLUIDA COM SEGURANCA' -ForegroundColor Green
    Write-Host '============================================================' -ForegroundColor Green
    Write-Host ''
    Write-Host 'Arquivo alterado: app/page.tsx'
    Write-Host 'Pagamentos/APIs/Supabase/assinatura: NAO ALTERADOS'
    Write-Host ('Build inicial: ' + $InitialBuildStatus)
    Write-Host ('ESLint da home: ' + $LintStatus)
    Write-Host ('Build final: ' + $FinalBuildStatus)
    Write-Host ('Backup: ' + $BackupHomePath)
    Write-Host ('Relatorio: ' + $ReportPath)
    Write-Host ''
    Write-Host 'Texto adicionado:' -ForegroundColor Cyan
    Write-Host 'Recebimento exclusivo pelo Mercado Pago.'
    Write-Host 'Todos os recebimentos de valores realizados pelo Orçaly são processados exclusivamente pela infraestrutura do Mercado Pago, oferecendo mais segurança e confiabilidade nas transações.'
    Write-Host ''
}
catch {
    Fail $_.Exception.Message

    if ($PatchApplied) {
        try {
            Restore-Home
        }
        catch {
            Fail ('Falha ao restaurar backup automaticamente: ' + $_.Exception.Message)
        }
    }

    Write-Host ''
    Write-Host 'A operacao foi interrompida para evitar deixar o projeto em estado inconsistente.' -ForegroundColor Red

    if ($null -ne $BackupHomePath) {
        Write-Host ('Backup preservado em: ' + $BackupHomePath) -ForegroundColor Yellow
    }

    exit 1
}
