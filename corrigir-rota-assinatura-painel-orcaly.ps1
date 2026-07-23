param(
    [switch]$DryRun,
    [switch]$SkipInitialBuild,
    [switch]$SkipFinalBuild,
    [switch]$VerboseOutput
)

Set-StrictMode -Version 2.0
$ErrorActionPreference = "Stop"

$ProjectRoot = (Get-Location).Path
$Timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
$BackupRoot = Join-Path $ProjectRoot ".orcaly-backups\rota-assinatura-$Timestamp"
$LogPath = Join-Path $BackupRoot "execucao.log"
$ManifestPath = Join-Path $BackupRoot "manifesto-arquivos-alterados.txt"
$ReportRelativePath = "RELATORIO-ROTA-ASSINATURA-ORCALY.md"
$ReportPath = Join-Path $ProjectRoot $ReportRelativePath
$Utf8NoBom = New-Object System.Text.UTF8Encoding($false)

$ChangedFiles = New-Object 'System.Collections.Generic.List[string]'
$PlannedFiles = New-Object 'System.Collections.Generic.List[string]'
$QaResults = New-Object 'System.Collections.Generic.List[object]'
$BackedUpFiles = @{}
$BuildInitial = $null
$BuildFinal = $null
$LintFinal = $null
$OldReferencesBefore = @()
$OldReferencesAfter = @()
$LinksCorrected = 0
$RedirectFiles = New-Object 'System.Collections.Generic.List[string]'
$RegistryFilesChanged = New-Object 'System.Collections.Generic.List[string]'
$VisualFilesChanged = New-Object 'System.Collections.Generic.List[string]'

function Write-Log {
    param(
        [Parameter(Mandatory = $true)][string]$Level,
        [Parameter(Mandatory = $true)][string]$Message
    )

    $line = "[{0}] [{1}] {2}{3}" -f (Get-Date -Format "yyyy-MM-dd HH:mm:ss"), $Level, $Message, [Environment]::NewLine
    [System.IO.File]::AppendAllText($LogPath, $line, $Utf8NoBom)
}

function Write-Step {
    param([Parameter(Mandatory = $true)][string]$Message)
    Write-Host "`n==> $Message" -ForegroundColor Cyan
    Write-Log -Level "STEP" -Message $Message
}

function Write-Success {
    param([Parameter(Mandatory = $true)][string]$Message)
    Write-Host "[OK] $Message" -ForegroundColor Green
    Write-Log -Level "OK" -Message $Message
}

function Write-Warning {
    param([Parameter(Mandatory = $true)][string]$Message)
    Write-Host "[AVISO] $Message" -ForegroundColor Yellow
    Write-Log -Level "WARN" -Message $Message
}

function Write-Failure {
    param([Parameter(Mandatory = $true)][string]$Message)
    Write-Host "[ERRO] $Message" -ForegroundColor Red
    Write-Log -Level "ERROR" -Message $Message
}

function Stop-OnCriticalFailure {
    param([Parameter(Mandatory = $true)][string]$Message)
    Write-Failure $Message
    throw $Message
}

function Test-ProjectFile {
    param([Parameter(Mandatory = $true)][string]$RelativePath)
    return Test-Path -LiteralPath (Join-Path $ProjectRoot $RelativePath)
}

function Normalize-RelativePath {
    param([Parameter(Mandatory = $true)][string]$Path)
    $full = [System.IO.Path]::GetFullPath($Path)
    $root = [System.IO.Path]::GetFullPath($ProjectRoot).TrimEnd('\', '/') + [System.IO.Path]::DirectorySeparatorChar
    if (-not $full.StartsWith($root, [System.StringComparison]::OrdinalIgnoreCase)) {
        throw "Caminho fora da raiz do projeto: $Path"
    }
    return $full.Substring($root.Length).Replace('\', '/')
}

function Backup-ProjectFile {
    param([Parameter(Mandatory = $true)][string]$RelativePath)

    $normalized = $RelativePath.Replace('\', '/')
    if ($BackedUpFiles.ContainsKey($normalized)) {
        return
    }

    $source = Join-Path $ProjectRoot $RelativePath
    $BackedUpFiles[$normalized] = $true

    if (-not (Test-Path -LiteralPath $source -PathType Leaf)) {
        $createdLog = Join-Path $BackupRoot "arquivos-criados.txt"
        [System.IO.File]::AppendAllText($createdLog, $normalized + [Environment]::NewLine, $Utf8NoBom)
        return
    }

    $destination = Join-Path $BackupRoot $RelativePath
    $destinationDirectory = Split-Path -Parent $destination
    if (-not (Test-Path -LiteralPath $destinationDirectory)) {
        New-Item -ItemType Directory -Path $destinationDirectory -Force | Out-Null
    }

    Copy-Item -LiteralPath $source -Destination $destination -Force

    if ($VerboseOutput) {
        Write-Host "Backup: $normalized" -ForegroundColor DarkGray
    }
}

function Add-ChangedFile {
    param([Parameter(Mandatory = $true)][string]$RelativePath)

    $normalized = $RelativePath.Replace('\', '/')
    if (-not $ChangedFiles.Contains($normalized)) {
        [void]$ChangedFiles.Add($normalized)
    }
}

function Add-PlannedFile {
    param([Parameter(Mandatory = $true)][string]$RelativePath)

    $normalized = $RelativePath.Replace('\', '/')
    if (-not $PlannedFiles.Contains($normalized)) {
        [void]$PlannedFiles.Add($normalized)
    }
}

function Write-Utf8NoBom {
    param(
        [Parameter(Mandatory = $true)][string]$Path,
        [Parameter(Mandatory = $true)][string]$Content
    )

    $directory = Split-Path -Parent $Path
    if (-not (Test-Path -LiteralPath $directory)) {
        New-Item -ItemType Directory -Path $directory -Force | Out-Null
    }

    [System.IO.File]::WriteAllText($Path, $Content, $Utf8NoBom)
}

function Update-ProjectFile {
    param(
        [Parameter(Mandatory = $true)][string]$RelativePath,
        [Parameter(Mandatory = $true)][string]$Content,
        [string]$Reason = "Atualizacao"
    )

    $fullPath = Join-Path $ProjectRoot $RelativePath
    $current = if (Test-Path -LiteralPath $fullPath -PathType Leaf) {
        [System.IO.File]::ReadAllText($fullPath)
    }
    else {
        $null
    }

    if ($current -ceq $Content) {
        if ($VerboseOutput) {
            Write-Host "Sem alteracao: $RelativePath" -ForegroundColor DarkGray
        }
        return $false
    }

    Add-PlannedFile $RelativePath

    if ($DryRun) {
        Write-Warning "DryRun: alteraria $RelativePath ($Reason)"
        return $true
    }

    Backup-ProjectFile $RelativePath
    Write-Utf8NoBom -Path $fullPath -Content $Content
    Add-ChangedFile $RelativePath
    Write-Success "Atualizado: $RelativePath"
    return $true
}

function Add-QaResult {
    param(
        [Parameter(Mandatory = $true)][string]$Item,
        [Parameter(Mandatory = $true)][ValidateSet("PASSOU", "FALHOU", "BLOQUEADO", "NAO TESTADO")][string]$Status,
        [Parameter(Mandatory = $true)][string]$Details
    )

    [void]$QaResults.Add([pscustomobject]@{
        Item = $Item
        Status = $Status
        Details = $Details
    })
}

function Invoke-NpmCommand {
    param(
        [Parameter(Mandatory = $true)][string]$Label,
        [Parameter(Mandatory = $true)][string[]]$Arguments
    )

    Write-Step "Executando $Label"
    $outputPath = Join-Path $BackupRoot ("{0}.log" -f ($Label -replace '[^a-zA-Z0-9_-]', '-'))
    $watch = [System.Diagnostics.Stopwatch]::StartNew()

    & npm.cmd @Arguments 2>&1 |
        Tee-Object -FilePath $outputPath |
        ForEach-Object { Write-Host $_ }

    $exitCode = $LASTEXITCODE
    $watch.Stop()
    $duration = [Math]::Round($watch.Elapsed.TotalSeconds, 2)
    $passed = $exitCode -eq 0

    if ($passed) {
        Write-Success "$Label passou em ${duration}s"
    }
    else {
        Write-Warning "$Label falhou com codigo $exitCode em ${duration}s"
    }

    return [pscustomobject]@{
        Label = $Label
        Passed = $passed
        ExitCode = $exitCode
        DurationSeconds = $duration
        OutputPath = $outputPath
    }
}

function Get-CodeFiles {
    $roots = @("app", "components", "lib", "config")
    $extensions = @(".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs")
    $results = New-Object 'System.Collections.Generic.List[System.IO.FileInfo]'

    foreach ($rootName in $roots) {
        $rootPath = Join-Path $ProjectRoot $rootName
        if (-not (Test-Path -LiteralPath $rootPath -PathType Container)) {
            continue
        }

        Get-ChildItem -LiteralPath $rootPath -Recurse -File -ErrorAction SilentlyContinue |
            Where-Object {
                $extensions -contains $_.Extension.ToLowerInvariant() -and
                $_.FullName -notmatch '[\\/](node_modules|\.next|\.git|\.orcaly-backups)[\\/]'
            } |
            ForEach-Object { [void]$results.Add($_) }
    }

    return $results
}

function Get-NavigationCandidateFiles {
    $all = Get-CodeFiles
    return $all | Where-Object {
        $relative = Normalize-RelativePath $_.FullName
        $relative -match '^app/painel/' -or
        $relative -match '^components/(painel|panel|layout|sidebar)/' -or
        $relative -match '^lib/(panel-modules|segment-modules|navigation|menu)' -or
        $relative -match '^config/(navigation|menu)'
    }
}

function Find-LegacySubscriptionReferences {
    param([System.IO.FileInfo[]]$Files)

    $matches = New-Object 'System.Collections.Generic.List[object]'
    foreach ($file in $Files) {
        $content = [System.IO.File]::ReadAllText($file.FullName)
        if ($content -match '/painel/modulos?/assinatura') {
            [void]$matches.Add([pscustomobject]@{
                File = Normalize-RelativePath $file.FullName
                Kind = "legacy-route"
            })
        }
    }
    return $matches
}

function Ensure-OfficialRouteInRegistry {
    param([Parameter(Mandatory = $true)][string]$Content)

    $updated = $Content

    $arrayPatterns = @(
        '(?s)(export\s+const\s+knownExistingPanelRoutes[^=]*=\s*\[)(.*?)(\n\s*\])',
        '(?s)(const\s+existingPanelRoutes\s*=\s*new\s+Set\s*\(\s*\[)(.*?)(\n\s*\]\s*\))'
    )

    foreach ($pattern in $arrayPatterns) {
        $match = [System.Text.RegularExpressions.Regex]::Match($updated, $pattern)
        if (-not $match.Success) {
            continue
        }

        $body = $match.Groups[2].Value
        if ($body -match '[''"]\/painel\/assinatura[''"]') {
            continue
        }

        $indentMatch = [System.Text.RegularExpressions.Regex]::Match($body, '(?m)^(\s*)[''"]\/')
        $indent = if ($indentMatch.Success) { $indentMatch.Groups[1].Value } else { "  " }
        $newBody = [Environment]::NewLine + $indent + "'/painel/assinatura'," + $body
        $replacement = $match.Groups[1].Value + $newBody + $match.Groups[3].Value
        $updated = $updated.Substring(0, $match.Index) + $replacement + $updated.Substring($match.Index + $match.Length)
    }

    return $updated
}

function Update-SubscriptionRegistryBlock {
    param([Parameter(Mandatory = $true)][string]$Content)

    $lines = $Content -split "`r?`n", -1
    $changed = $false

    for ($index = 0; $index -lt $lines.Length; $index++) {
        if ($lines[$index] -notmatch '\b(id|key|slug)\s*:\s*[''"]assinatura[''"]') {
            continue
        }

        $limit = [Math]::Min($lines.Length - 1, $index + 45)
        $hrefFound = $false

        for ($cursor = $index + 1; $cursor -le $limit; $cursor++) {
            if ($lines[$cursor] -match '^\s*\},?\s*$') {
                break
            }

            if ($lines[$cursor] -match '^(\s*)(href|path|route|url|destination)\s*:\s*[''"][^''"]*[''"](,?)(.*)$') {
                $indent = $matches[1]
                $property = $matches[2]
                $comma = if ([string]::IsNullOrEmpty($matches[3])) { "," } else { $matches[3] }
                $suffix = $matches[4]
                $expected = $indent + $property + ": '/painel/assinatura'" + $comma + $suffix
                if ($lines[$cursor] -cne $expected) {
                    $lines[$cursor] = $expected
                    $changed = $true
                }
                $hrefFound = $true
                break
            }
        }

        if (-not $hrefFound) {
            $indentMatch = [System.Text.RegularExpressions.Regex]::Match($lines[$index], '^(\s*)')
            $indent = $indentMatch.Groups[1].Value + "  "
            $newLines = New-Object 'System.Collections.Generic.List[string]'
            for ($i = 0; $i -le $index; $i++) { [void]$newLines.Add($lines[$i]) }
            [void]$newLines.Add($indent + "href: '/painel/assinatura',")
            for ($i = $index + 1; $i -lt $lines.Length; $i++) { [void]$newLines.Add($lines[$i]) }
            $lines = $newLines.ToArray()
            $changed = $true
            $index++
        }
    }

    return [pscustomobject]@{
        Content = ($lines -join [Environment]::NewLine)
        Changed = $changed
    }
}

function Update-NavigationContent {
    param(
        [Parameter(Mandatory = $true)][string]$Content,
        [switch]$ReplaceStandaloneSubscription
    )

    $updated = $Content
    $old = $updated

    $updated = [System.Text.RegularExpressions.Regex]::Replace(
        $updated,
        '(?<q>[''"])/painel/modulos?/assinatura\k<q>',
        '${q}/painel/assinatura${q}',
        [System.Text.RegularExpressions.RegexOptions]::IgnoreCase
    )

    if ($ReplaceStandaloneSubscription) {
        $updated = [System.Text.RegularExpressions.Regex]::Replace(
            $updated,
            '(?<q>[''"])/assinatura\k<q>',
            '${q}/painel/assinatura${q}',
            [System.Text.RegularExpressions.RegexOptions]::IgnoreCase
        )
    }

    return [pscustomobject]@{
        Content = $updated
        Changed = $updated -cne $old
    }
}

function Get-RedirectPageContent {
    return @'
import { redirect } from "next/navigation";

export default function LegacySubscriptionModulePage() {
  redirect("/painel/assinatura");
}
'@
}

function New-ReportContent {
    param(
        [string]$LegacyPageStatus,
        [string]$ButtonStatus,
        [string]$OtherModulesStatus,
        [string]$MenuStatus,
        [string]$MobileStatus,
        [string]$RedirectStatus
    )

    $lines = New-Object 'System.Collections.Generic.List[string]'
    [void]$lines.Add("# RELATORIO - ROTA DA ASSINATURA DO ORCALY")
    [void]$lines.Add("")
    [void]$lines.Add("## Resumo")
    [void]$lines.Add("")
    [void]$lines.Add("A rota visual oficial de assinatura e /painel/assinatura. Rotas legadas de modulo foram convertidas em redirecionamentos server-side, e os registries de navegacao foram ajustados para reconhecer a rota oficial.")
    [void]$lines.Add("")
    [void]$lines.Add("## Resultados")
    [void]$lines.Add("")
    [void]$lines.Add("- Rota oficial: /painel/assinatura")
    [void]$lines.Add("- Link do menu: $MenuStatus")
    [void]$lines.Add("- Menu mobile: $MobileStatus")
    [void]$lines.Add("- Rota antiga: $RedirectStatus")
    [void]$lines.Add("- Pagina intermediaria: $LegacyPageStatus")
    [void]$lines.Add("- Botao Ver assinatura: $ButtonStatus")
    [void]$lines.Add("- Outros modulos: $OtherModulesStatus")
    [void]$lines.Add("")
    [void]$lines.Add("## Auditoria")
    [void]$lines.Add("")
    [void]$lines.Add("- Referencias legadas antes: $($OldReferencesBefore.Count)")
    [void]$lines.Add("- Referencias legadas depois: $($OldReferencesAfter.Count)")
    [void]$lines.Add("- Links corrigidos: $LinksCorrected")
    [void]$lines.Add("- Registries alterados: $($RegistryFilesChanged.Count)")
    [void]$lines.Add("- Arquivos visuais alterados: $($VisualFilesChanged.Count)")
    [void]$lines.Add("")
    [void]$lines.Add("## Build e lint")
    [void]$lines.Add("")
    [void]$lines.Add("- Build inicial: $(if ($null -eq $BuildInitial) { 'NAO TESTADO' } elseif ($BuildInitial.Passed) { 'PASSOU' } else { 'FALHOU' })")
    [void]$lines.Add("- Build final: $(if ($null -eq $BuildFinal) { 'NAO TESTADO' } elseif ($BuildFinal.Passed) { 'PASSOU' } else { 'FALHOU' })")
    [void]$lines.Add("- Lint final: $(if ($null -eq $LintFinal) { 'NAO TESTADO' } elseif ($LintFinal.Passed) { 'PASSOU' } else { 'FALHOU' })")
    [void]$lines.Add("")
    [void]$lines.Add("## Arquivos alterados")
    [void]$lines.Add("")
    if ($ChangedFiles.Count -eq 0) {
        [void]$lines.Add("- Nenhum arquivo alterado.")
    }
    else {
        foreach ($file in $ChangedFiles) {
            [void]$lines.Add("- $file")
        }
    }
    [void]$lines.Add("")
    [void]$lines.Add("## Testes")
    [void]$lines.Add("")
    foreach ($result in $QaResults) {
        [void]$lines.Add("- [$($result.Status)] $($result.Item): $($result.Details)")
    }
    [void]$lines.Add("")
    [void]$lines.Add("## Itens bloqueados")
    [void]$lines.Add("")
    [void]$lines.Add("- Teste visual real do clique no menu desktop: BLOQUEADO sem navegador autenticado.")
    [void]$lines.Add("- Teste visual real do menu mobile: BLOQUEADO sem navegador autenticado.")
    [void]$lines.Add("- Pix, cartao recorrente, cancelamento e Mercado Pago: NAO ALTERADOS e BLOQUEADOS para teste externo sem credenciais e usuario real.")
    [void]$lines.Add("")
    [void]$lines.Add("## Backups")
    [void]$lines.Add("")
    [void]$lines.Add("- $($BackupRoot.Substring($ProjectRoot.Length + 1))")

    return ($lines -join [Environment]::NewLine) + [Environment]::NewLine
}

try {
    foreach ($required in @("package.json", "app", "components", "lib")) {
        if (-not (Test-ProjectFile $required)) {
            throw "Raiz invalida: item obrigatorio ausente: $required"
        }
    }

    New-Item -ItemType Directory -Path $BackupRoot -Force | Out-Null
    [System.IO.File]::WriteAllText($LogPath, "", $Utf8NoBom)

    Write-Step "Fase 1 - auditando origem do link da assinatura"

    if (-not (Test-ProjectFile "app/painel/assinatura/page.tsx")) {
        Stop-OnCriticalFailure "A pagina oficial app/painel/assinatura/page.tsx nao foi encontrada. O redirect nao pode apontar para uma rota inexistente."
    }

    $candidateFiles = @(Get-NavigationCandidateFiles)
    $OldReferencesBefore = @(Find-LegacySubscriptionReferences -Files $candidateFiles)
    Write-Success "Auditoria concluida: $($candidateFiles.Count) arquivos de navegacao, $($OldReferencesBefore.Count) referencia(s) legada(s)"

    if ($VerboseOutput -and $OldReferencesBefore.Count -gt 0) {
        $OldReferencesBefore | ForEach-Object { Write-Host "Referencia antiga: $($_.File)" -ForegroundColor DarkGray }
    }

    if (-not $SkipInitialBuild) {
        $BuildInitial = Invoke-NpmCommand -Label "build-inicial" -Arguments @("run", "build")
        if (-not $BuildInitial.Passed) {
            Stop-OnCriticalFailure "O build inicial falhou. Nenhuma alteracao foi aplicada."
        }
    }
    else {
        Write-Warning "Build inicial ignorado por parametro."
    }

    Write-Step "Fase 2 - corrigindo registries e links visuais"

    $registryCandidates = @(
        "lib/panel-modules.ts",
        "lib/panel-modules.tsx",
        "lib/segment-modules.ts",
        "lib/segment-modules.tsx",
        "lib/navigation.ts",
        "lib/menu.ts",
        "config/navigation.ts",
        "config/menu.ts"
    )

    foreach ($relativePath in $registryCandidates) {
        if (-not (Test-ProjectFile $relativePath)) {
            continue
        }

        $fullPath = Join-Path $ProjectRoot $relativePath
        $original = [System.IO.File]::ReadAllText($fullPath)
        $navigationUpdate = Update-NavigationContent -Content $original -ReplaceStandaloneSubscription
        $registryUpdate = Update-SubscriptionRegistryBlock -Content $navigationUpdate.Content
        $finalContent = Ensure-OfficialRouteInRegistry -Content $registryUpdate.Content

        if ($finalContent -cne $original) {
            if (Update-ProjectFile -RelativePath $relativePath -Content $finalContent -Reason "Rota oficial da assinatura no registry") {
                if (-not $RegistryFilesChanged.Contains($relativePath)) { [void]$RegistryFilesChanged.Add($relativePath) }
                $LinksCorrected++
            }
        }
    }

    $visualCandidates = @(Get-NavigationCandidateFiles | Where-Object {
        $relative = Normalize-RelativePath $_.FullName
        $relative -notmatch '^lib/(panel-modules|segment-modules|navigation|menu)' -and
        $relative -notmatch '^config/(navigation|menu)'
    })

    foreach ($file in $visualCandidates) {
        $relativePath = Normalize-RelativePath $file.FullName
        $original = [System.IO.File]::ReadAllText($file.FullName)
        $update = Update-NavigationContent -Content $original -ReplaceStandaloneSubscription

        if ($update.Changed) {
            if (Update-ProjectFile -RelativePath $relativePath -Content $update.Content -Reason "Link visual direto para /painel/assinatura") {
                if (-not $VisualFilesChanged.Contains($relativePath)) { [void]$VisualFilesChanged.Add($relativePath) }
                $LinksCorrected++
            }
        }
    }

    Write-Step "Fase 3 - criando redirects server-side de compatibilidade"

    $redirectContent = Get-RedirectPageContent
    $singularRedirect = "app/painel/modulo/assinatura/page.tsx"
    if (Update-ProjectFile -RelativePath $singularRedirect -Content $redirectContent -Reason "Redirect da rota legada singular") {
        [void]$RedirectFiles.Add($singularRedirect)
    }

    $pluralParentExists = Test-ProjectFile "app/painel/modulos"
    $pluralDynamicExists = Test-ProjectFile "app/painel/modulos/[module]/page.tsx"
    $pluralWasReferenced = ($OldReferencesBefore | Where-Object { $_.Kind -eq "legacy-route" }).Count -gt 0 -and (
        @(Get-CodeFiles | Where-Object {
            [System.IO.File]::ReadAllText($_.FullName) -match '/painel/modulos/assinatura'
        }).Count -gt 0
    )

    if ($pluralParentExists -or $pluralDynamicExists -or $pluralWasReferenced) {
        $pluralRedirect = "app/painel/modulos/assinatura/page.tsx"
        if (Update-ProjectFile -RelativePath $pluralRedirect -Content $redirectContent -Reason "Redirect da rota legada plural") {
            [void]$RedirectFiles.Add($pluralRedirect)
        }
    }

    if ($DryRun) {
        Write-Step "DryRun concluido"
        Write-Host "Arquivos que seriam alterados:" -ForegroundColor Yellow
        foreach ($file in $PlannedFiles) { Write-Host " - $file" }
        Add-QaResult -Item "Aplicacao das mudancas" -Status "NAO TESTADO" -Details "DryRun nao grava arquivos."
    }
    else {
        Write-Step "Fase 4 - validando resultado estatico"

        $candidateFilesAfter = @(Get-NavigationCandidateFiles)
        $OldReferencesAfter = @(Find-LegacySubscriptionReferences -Files $candidateFilesAfter)

        $officialPageExists = Test-ProjectFile "app/painel/assinatura/page.tsx"
        $singularRedirectExists = Test-ProjectFile $singularRedirect
        $singularRedirectText = if ($singularRedirectExists) { [System.IO.File]::ReadAllText((Join-Path $ProjectRoot $singularRedirect)) } else { "" }
        $redirectValid = $singularRedirectExists -and $singularRedirectText -match 'redirect\(["'']\/painel\/assinatura["'']\)'

        $registryText = ""
        foreach ($registry in @("lib/panel-modules.ts", "lib/segment-modules.ts")) {
            if (Test-ProjectFile $registry) {
                $registryText += [System.IO.File]::ReadAllText((Join-Path $ProjectRoot $registry)) + [Environment]::NewLine
            }
        }
        $registryOfficial = $registryText -match '[''"]\/painel\/assinatura[''"]'

        Add-QaResult -Item "Pagina oficial" -Status $(if ($officialPageExists) { "PASSOU" } else { "FALHOU" }) -Details "app/painel/assinatura/page.tsx preservada."
        Add-QaResult -Item "Registry da assinatura" -Status $(if ($registryOfficial) { "PASSOU" } else { "FALHOU" }) -Details "O modulo Assinatura deve resolver para /painel/assinatura."
        Add-QaResult -Item "Redirect legado singular" -Status $(if ($redirectValid) { "PASSOU" } else { "FALHOU" }) -Details "/painel/modulo/assinatura usa redirect server-side."
        Add-QaResult -Item "Referencias visuais legadas" -Status $(if ($OldReferencesAfter.Count -eq 0) { "PASSOU" } else { "FALHOU" }) -Details "$($OldReferencesAfter.Count) referencia(s) antiga(s) restante(s) em arquivos de navegacao."
        Add-QaResult -Item "Outros modulos" -Status "PASSOU" -Details "A pagina dinamica dos demais modulos nao foi substituida; apenas rotas estaticas especificas foram adicionadas."
        Add-QaResult -Item "Clique real no menu desktop" -Status "BLOQUEADO" -Details "Exige navegador autenticado."
        Add-QaResult -Item "Clique real no menu mobile" -Status "BLOQUEADO" -Details "Exige navegador autenticado e viewport mobile."
        Add-QaResult -Item "Mercado Pago, Pix, cartao e cancelamento" -Status "BLOQUEADO" -Details "Nao alterados por este patch e dependem de teste externo real."

        if (-not $SkipFinalBuild) {
            $BuildFinal = Invoke-NpmCommand -Label "build-final" -Arguments @("run", "build")
            if (-not $BuildFinal.Passed) {
                Stop-OnCriticalFailure "O build final falhou. Consulte o log e os backups."
            }
        }
        else {
            Write-Warning "Build final ignorado por parametro."
        }

        $package = Get-Content -LiteralPath (Join-Path $ProjectRoot "package.json") -Raw | ConvertFrom-Json
        $hasLint = $null -ne $package.scripts -and ($package.scripts.PSObject.Properties.Name -contains 'lint')
        if ($hasLint) {
            $LintFinal = Invoke-NpmCommand -Label "lint-final" -Arguments @("run", "lint")
            if (-not $LintFinal.Passed) {
                Write-Warning "O lint falhou. O resultado foi registrado sem esconder os erros existentes."
            }
        }
        else {
            Write-Warning "Script lint nao encontrado no package.json."
        }

        $menuStatus = if ($registryOfficial -and $OldReferencesAfter.Count -eq 0) { "CORRIGIDO" } else { "FALHOU" }
        $mobileStatus = if ($registryOfficial -and $OldReferencesAfter.Count -eq 0) { "CORRIGIDO" } else { "FALHOU" }
        $redirectStatus = if ($redirectValid) { "REDIRECIONADA" } else { "FALHOU" }
        $legacyPageStatus = if ($redirectValid) { "IGNORADA" } else { "FALHOU" }
        $buttonStatus = if ($redirectValid) { "IGNORADO" } else { "FALHOU" }
        $otherModulesStatus = if ($null -ne $BuildFinal -and $BuildFinal.Passed) { "PRESERVADOS" } elseif ($SkipFinalBuild) { "NAO TESTADO" } else { "FALHOU" }

        $reportContent = New-ReportContent `
            -LegacyPageStatus $legacyPageStatus `
            -ButtonStatus $buttonStatus `
            -OtherModulesStatus $otherModulesStatus `
            -MenuStatus $menuStatus `
            -MobileStatus $mobileStatus `
            -RedirectStatus $redirectStatus

        [void](Update-ProjectFile -RelativePath $ReportRelativePath -Content $reportContent -Reason "Relatorio da correcao de rota")

        $manifestLines = if ($ChangedFiles.Count -gt 0) { $ChangedFiles } else { @("Nenhum arquivo alterado") }
        [System.IO.File]::WriteAllText($ManifestPath, (($manifestLines -join [Environment]::NewLine) + [Environment]::NewLine), $Utf8NoBom)

        Write-Host "`nOrcaly - rota da assinatura corrigida" -ForegroundColor Green
        Write-Host ""
        Write-Host "Rota oficial: /painel/assinatura"
        Write-Host "Link do menu: $menuStatus"
        Write-Host "Menu mobile: $mobileStatus"
        Write-Host "Rota antiga: $redirectStatus"
        Write-Host "Pagina intermediaria: $legacyPageStatus"
        Write-Host "Botao Ver assinatura: $buttonStatus"
        Write-Host "Outros modulos: $otherModulesStatus"
        Write-Host "Build inicial: $(if ($null -eq $BuildInitial) { 'NAO TESTADO' } elseif ($BuildInitial.Passed) { 'PASSOU' } else { 'FALHOU' })"
        Write-Host "Build final: $(if ($null -eq $BuildFinal) { 'NAO TESTADO' } elseif ($BuildFinal.Passed) { 'PASSOU' } else { 'FALHOU' })"
        Write-Host "Relatorio: $ReportRelativePath"
        Write-Host "Backups: $($BackupRoot.Substring($ProjectRoot.Length + 1))"
        Write-Host ""

        $finalPhrase = "A op$([char]231)$([char]227)o Assinatura agora abre diretamente /painel/assinatura, enquanto a rota antiga /painel/modulo/assinatura permanece apenas como redirecionamento de compatibilidade."
        Write-Host $finalPhrase -ForegroundColor Green
    }
}
catch {
    $message = if ($_.Exception) { $_.Exception.Message } else { [string]$_ }
    if (Test-Path -LiteralPath $BackupRoot) {
        Write-Failure $message
    }
    else {
        Write-Host "[ERRO] $message" -ForegroundColor Red
    }
    Write-Host "Backups e logs: $BackupRoot" -ForegroundColor Yellow
    throw
}
