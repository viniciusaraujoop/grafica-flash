param(
    [switch]$SkipBuild,
    [switch]$SkipLint,
    [switch]$SkipTypecheck,
    [switch]$SkipTests,
    [switch]$SkipSmokeTest,
    [int]$Port = 4317,
    [int]$TimeoutSeconds = 60,
    [switch]$VerboseOutput
)

Set-StrictMode -Version 2.0
$ErrorActionPreference = "Stop"

$script:ScriptPath = $PSCommandPath
$script:Root = (Get-Location).Path
$script:Timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
$script:QaRoot = Join-Path $script:Root ".orcaly-qa"
$script:RunDir = Join-Path $script:QaRoot $script:Timestamp
$script:MarkdownPath = Join-Path $script:Root "RELATORIO-QA-OPERACIONAL-ORCALY.md"
$script:JsonPath = Join-Path $script:Root "RELATORIO-QA-OPERACIONAL-ORCALY.json"
$script:ChecklistPath = Join-Path $script:Root "CHECKLIST-QA-MANUAL-ORCALY.md"
$script:MainLog = Join-Path $script:RunDir "qa-operacional.log"
$script:ServerProcess = $null
$script:Categories = New-Object System.Collections.ArrayList
$script:CriticalFailures = New-Object System.Collections.ArrayList
$script:HighRisks = New-Object System.Collections.ArrayList
$script:Warnings = New-Object System.Collections.ArrayList
$script:BlockedTests = New-Object System.Collections.ArrayList
$script:NotTested = New-Object System.Collections.ArrayList
$script:CriticalCaps = New-Object System.Collections.ArrayList
$script:Evidence = New-Object System.Collections.ArrayList
$script:SmokeResults = New-Object System.Collections.ArrayList
$script:TextFiles = @()
$script:RouteFiles = @()
$script:InitialGitState = @()
$script:FinalGitState = @()
$script:BuildResult = $null
$script:LintResult = $null
$script:TypecheckResult = $null
$script:TestResult = $null
$script:SmokeExecuted = $false
$script:StaticAuditCompleted = $false

$Utf8NoBom = New-Object System.Text.UTF8Encoding($false)
[Console]::OutputEncoding = $Utf8NoBom
$OutputEncoding = $Utf8NoBom

function Write-Log {
    param(
        [string]$Level,
        [string]$Message
    )

    $line = "[{0}] [{1}] {2}" -f (Get-Date -Format "yyyy-MM-dd HH:mm:ss"), $Level, $Message
    Add-Content -LiteralPath $script:MainLog -Value $line -Encoding UTF8

    if ($VerboseOutput -or $Level -in @("STEP", "OK", "WARN", "ERROR")) {
        $color = "Gray"
        if ($Level -eq "STEP") { $color = "Cyan" }
        if ($Level -eq "OK") { $color = "Green" }
        if ($Level -eq "WARN") { $color = "Yellow" }
        if ($Level -eq "ERROR") { $color = "Red" }
        Write-Host $line -ForegroundColor $color
    }
}

function Write-Step { param([string]$Message) Write-Log -Level "STEP" -Message $Message }
function Write-Success { param([string]$Message) Write-Log -Level "OK" -Message $Message }
function Write-Warning { param([string]$Message) Write-Log -Level "WARN" -Message $Message }
function Write-Failure { param([string]$Message) Write-Log -Level "ERROR" -Message $Message }

function Write-Utf8NoBom {
    param(
        [string]$Path,
        [string]$Content
    )

    [System.IO.File]::WriteAllText($Path, $Content, $Utf8NoBom)
}

function Get-RelativePath {
    param([string]$Path)

    $full = [System.IO.Path]::GetFullPath($Path)
    $root = [System.IO.Path]::GetFullPath($script:Root)
    if ($full.StartsWith($root, [System.StringComparison]::OrdinalIgnoreCase)) {
        return $full.Substring($root.Length).TrimStart([char[]]@('\','/')).Replace('\','/')
    }
    return $full.Replace('\','/')
}

function Add-UniqueItem {
    param(
        [System.Collections.ArrayList]$List,
        [string]$Value
    )

    if (-not [string]::IsNullOrWhiteSpace($Value) -and -not $List.Contains($Value)) {
        [void]$List.Add($Value)
    }
}

function Add-Evidence {
    param([string]$Value)
    Add-UniqueItem -List $script:Evidence -Value $Value
}

function Add-Category {
    param(
        [string]$Name,
        [double]$Weight,
        [double]$Points,
        [string]$Status,
        [string[]]$Evidence
    )

    if ($Points -lt 0) { $Points = 0 }
    if ($Points -gt $Weight) { $Points = $Weight }

    $item = [pscustomobject]@{
        name = $Name
        weight = [math]::Round($Weight, 2)
        points = [math]::Round($Points, 2)
        status = $Status
        evidence = @($Evidence)
    }
    [void]$script:Categories.Add($item)
}

function Add-CriticalFailure { param([string]$Value) Add-UniqueItem -List $script:CriticalFailures -Value $Value }
function Add-HighRisk { param([string]$Value) Add-UniqueItem -List $script:HighRisks -Value $Value }
function Add-WarningItem { param([string]$Value) Add-UniqueItem -List $script:Warnings -Value $Value }
function Add-Blocked { param([string]$Value) Add-UniqueItem -List $script:BlockedTests -Value $Value }
function Add-NotTested { param([string]$Value) Add-UniqueItem -List $script:NotTested -Value $Value }
function Add-Cap { param([string]$Value) Add-UniqueItem -List $script:CriticalCaps -Value $Value }

function Test-SelfSyntax {
    Write-Step "Validando sintaxe do proprio script"
    $tokens = $null
    $errors = $null
    [System.Management.Automation.Language.Parser]::ParseFile(
        $script:ScriptPath,
        [ref]$tokens,
        [ref]$errors
    ) | Out-Null

    if ($errors -and $errors.Count -gt 0) {
        foreach ($error in $errors) {
            Write-Failure ("Linha {0}: {1}" -f $error.Extent.StartLineNumber, $error.Message)
        }
        throw "O script possui erro de sintaxe."
    }
    Write-Success "Sintaxe PowerShell valida"
}

function Test-ProjectRoot {
    Write-Step "Validando raiz do projeto"
    foreach ($item in @("package.json", "app", "components", "lib")) {
        if (-not (Test-Path -LiteralPath (Join-Path $script:Root $item))) {
            throw "Item obrigatorio nao encontrado na raiz: $item"
        }
    }
    Write-Success "Raiz do projeto confirmada"
}

function Get-SafeProjectFiles {
    Write-Step "Mapeando arquivos de texto sem ler .env, node_modules ou artefatos"
    $roots = @("app", "components", "lib", "supabase", "public", "config", "styles")
    $extensions = @(".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs", ".sql", ".css", ".scss", ".json", ".md")
    $files = New-Object System.Collections.ArrayList

    foreach ($rootName in $roots) {
        $rootPath = Join-Path $script:Root $rootName
        if (-not (Test-Path -LiteralPath $rootPath)) { continue }

        $items = Get-ChildItem -LiteralPath $rootPath -Recurse -File -ErrorAction SilentlyContinue
        foreach ($item in $items) {
            $relative = Get-RelativePath $item.FullName
            if ($relative -match '(^|/)(node_modules|\.next|\.git|\.orcaly-backups|\.orcaly-qa)(/|$)') { continue }
            if ($relative -match '(^|/)\.env($|\.)') { continue }
            if ($extensions -contains $item.Extension.ToLowerInvariant()) {
                [void]$files.Add($item.FullName)
            }
        }
    }

    $script:TextFiles = @($files | Sort-Object -Unique)
    Write-Success ("Arquivos auditaveis: {0}" -f $script:TextFiles.Count)
}

function Find-Pattern {
    param(
        [string[]]$Patterns,
        [string[]]$Files,
        [int]$MaxSamples = 12
    )

    if (-not $Files) { $Files = $script:TextFiles }
    $count = 0
    $paths = New-Object System.Collections.ArrayList
    $samples = New-Object System.Collections.ArrayList

    foreach ($file in $Files) {
        if (-not (Test-Path -LiteralPath $file)) { continue }
        try {
            $matches = Select-String -LiteralPath $file -Pattern $Patterns -AllMatches -ErrorAction SilentlyContinue
            foreach ($match in $matches) {
                $count += $match.Matches.Count
                $relative = Get-RelativePath $file
                if (-not $paths.Contains($relative)) { [void]$paths.Add($relative) }
                if ($samples.Count -lt $MaxSamples) {
                    [void]$samples.Add(("{0}:{1}" -f $relative, $match.LineNumber))
                }
            }
        }
        catch {
            Write-Warning ("Nao foi possivel ler: {0}" -f (Get-RelativePath $file))
        }
    }

    return [pscustomobject]@{
        Count = $count
        Files = @($paths)
        Samples = @($samples)
    }
}

function Get-PackageScripts {
    $packagePath = Join-Path $script:Root "package.json"
    $package = Get-Content -LiteralPath $packagePath -Raw | ConvertFrom-Json
    $result = @{}
    if ($package.scripts) {
        foreach ($property in $package.scripts.PSObject.Properties) {
            $result[$property.Name] = [string]$property.Value
        }
    }
    return $result
}

function Invoke-NpmScript {
    param(
        [string]$Name,
        [string[]]$Arguments,
        [string]$LogName
    )

    $logPath = Join-Path $script:RunDir $LogName
    $watch = [System.Diagnostics.Stopwatch]::StartNew()
    Write-Step ("Executando npm.cmd {0}" -f ($Arguments -join " "))

    & npm.cmd @Arguments 2>&1 |
        Tee-Object -FilePath $logPath |
        Out-Host

    $exitCode = $LASTEXITCODE
    $watch.Stop()
    $passed = ($exitCode -eq 0)

    if ($passed) {
        Write-Success ("{0} passou em {1:N2}s" -f $Name, $watch.Elapsed.TotalSeconds)
    }
    else {
        Write-Failure ("{0} falhou com codigo {1} em {2:N2}s" -f $Name, $exitCode, $watch.Elapsed.TotalSeconds)
    }

    return [pscustomobject]@{
        Name = $Name
        Passed = $passed
        ExitCode = $exitCode
        DurationSeconds = [math]::Round($watch.Elapsed.TotalSeconds, 2)
        Log = Get-RelativePath $logPath
    }
}

function Get-GitState {
    if (-not (Test-Path -LiteralPath (Join-Path $script:Root ".git"))) { return @() }
    $raw = @(git status --porcelain 2>$null)
    return @($raw | Where-Object {
        $_ -notmatch 'RELATORIO-QA-OPERACIONAL-ORCALY\.(md|json)$' -and
        $_ -notmatch 'CHECKLIST-QA-MANUAL-ORCALY\.md$' -and
        $_ -notmatch '\.orcaly-qa/'
    } | Sort-Object)
}

function Get-AppRoutes {
    $appPath = Join-Path $script:Root "app"
    $routes = New-Object System.Collections.ArrayList
    if (-not (Test-Path -LiteralPath $appPath)) { return @() }

    $pages = Get-ChildItem -LiteralPath $appPath -Recurse -File -ErrorAction SilentlyContinue |
        Where-Object { $_.Name -match '^page\.(tsx|ts|jsx|js)$' }

    foreach ($page in $pages) {
        $relative = Get-RelativePath $page.DirectoryName
        $relative = $relative -replace '^app/?', ''
        $parts = @()
        if (-not [string]::IsNullOrWhiteSpace($relative)) {
            foreach ($part in ($relative -split '/')) {
                if ($part -match '^\(.*\)$') { continue }
                if ($part -match '^@') { continue }
                $parts += $part
            }
        }
        $route = "/" + ($parts -join "/")
        if ($route -eq "//") { $route = "/" }
        if ($route -match '^/api(?:/|$)') { continue }
        if (-not $routes.Contains($route)) { [void]$routes.Add($route) }
    }

    $script:RouteFiles = @($routes | Sort-Object)
    return $script:RouteFiles
}

function Test-RouteExists {
    param([string]$Route)

    $clean = $Route.Split('?')[0].TrimEnd('/')
    if ([string]::IsNullOrWhiteSpace($clean)) { $clean = "/" }

    foreach ($known in $script:RouteFiles) {
        $pattern = [regex]::Escape($known.TrimEnd('/'))
        $pattern = $pattern -replace '\\\[[^/]+\\\]', '[^/]+'
        $pattern = $pattern -replace '\\\[\\\.\\\.\\\.[^/]+\\\]', '.+'
        if ($known -eq "/") { $pattern = "" }
        if ($clean -match ("^" + $pattern + "/?$")) { return $true }
    }
    return $false
}

function Get-StaticNavigationLinks {
    $links = New-Object System.Collections.ArrayList
    $uiFiles = @($script:TextFiles | Where-Object { $_ -match '\.(tsx|ts|jsx|js)$' })
    $regexes = @(
        '(?i)href\s*=\s*["''](/[^"''?#\s]+)',
        '(?i)(?:router\.(?:push|replace)|redirect)\s*\(\s*["''](/[^"''?#\s]+)'
    )

    foreach ($file in $uiFiles) {
        $content = ""
        try { $content = Get-Content -LiteralPath $file -Raw } catch { continue }
        foreach ($regex in $regexes) {
            $matches = [regex]::Matches($content, $regex)
            foreach ($match in $matches) {
                $route = $match.Groups[1].Value
                if ($route -match '^/(api|_next)(/|$)') { continue }
                if ($route -match '\.(png|jpg|jpeg|svg|ico|webp|pdf)$') { continue }
                $entry = [pscustomobject]@{
                    Route = $route
                    File = Get-RelativePath $file
                }
                [void]$links.Add($entry)
            }
        }
    }
    return @($links)
}

function Test-HttpRoute {
    param(
        [object]$Client,
        [string]$BaseUrl,
        [string]$Route
    )

    $url = $BaseUrl.TrimEnd('/') + $Route
    try {
        $response = $Client.GetAsync($url).GetAwaiter().GetResult()
        $statusCode = [int]$response.StatusCode
        $location = ""
        if ($response.Headers.Location) { $location = [string]$response.Headers.Location }
        $body = $response.Content.ReadAsStringAsync().GetAwaiter().GetResult()
        $hasInternalError = $false
        foreach ($marker in @("Internal Server Error", "Application error", "This page could not be found due to an internal error")) {
            if ($body.IndexOf($marker, [System.StringComparison]::OrdinalIgnoreCase) -ge 0) {
                $hasInternalError = $true
                break
            }
        }

        $expectedNotFound = ($Route -eq "/site/slug-inexistente" -and $statusCode -eq 404)
        $allowed = $statusCode -in @(200, 301, 302, 307, 308, 401, 403)
        $passed = (($allowed -or $expectedNotFound) -and -not $hasInternalError -and $statusCode -ne 500)

        return [pscustomobject]@{
            route = $Route
            statusCode = $statusCode
            location = $location
            passed = $passed
            error = ""
        }
    }
    catch {
        return [pscustomobject]@{
            route = $Route
            statusCode = 0
            location = ""
            passed = $false
            error = $_.Exception.Message
        }
    }
}

function Invoke-SmokeTest {
    param([hashtable]$Scripts)

    if ($SkipSmokeTest) {
        Add-NotTested "Smoke test HTTP foi ignorado por parametro."
        return
    }
    if (-not $script:BuildResult -or -not $script:BuildResult.Passed) {
        Add-Blocked "Smoke test HTTP bloqueado porque o build nao passou."
        return
    }
    if (-not $Scripts.ContainsKey("start")) {
        Add-Blocked "Smoke test HTTP bloqueado porque package.json nao possui script start."
        return
    }

    Write-Step ("Iniciando servidor local na porta {0}" -f $Port)
    $stdout = Join-Path $script:RunDir "server-stdout.log"
    $stderr = Join-Path $script:RunDir "server-stderr.log"
    $arguments = @("run", "start", "--", "-p", [string]$Port)

    $script:ServerProcess = Start-Process -FilePath "npm.cmd" -ArgumentList $arguments -WorkingDirectory $script:Root -RedirectStandardOutput $stdout -RedirectStandardError $stderr -PassThru -WindowStyle Hidden
    $baseUrl = "http://127.0.0.1:{0}" -f $Port
    $deadline = (Get-Date).AddSeconds($TimeoutSeconds)
    $ready = $false

    while ((Get-Date) -lt $deadline) {
        if ($script:ServerProcess.HasExited) { break }
        try {
            $request = [System.Net.WebRequest]::Create($baseUrl + "/")
            $request.Timeout = 3000
            $request.AllowAutoRedirect = $false
            $response = $request.GetResponse()
            $response.Close()
            $ready = $true
            break
        }
        catch [System.Net.WebException] {
            if ($_.Exception.Response) {
                $_.Exception.Response.Close()
                $ready = $true
                break
            }
            Start-Sleep -Milliseconds 800
        }
        catch {
            Start-Sleep -Milliseconds 800
        }
    }

    if (-not $ready) {
        Add-CriticalFailure "Servidor local nao respondeu dentro do timeout do smoke test."
        Add-Cap "Smoke test sem resposta: nota maxima 59."
        Add-Blocked "Rotas HTTP nao puderam ser verificadas."
        return
    }

    try {
        Add-Type -AssemblyName System.Net.Http -ErrorAction Stop
    }
    catch {
        Add-Blocked "Smoke test HTTP bloqueado porque System.Net.Http nao esta disponivel."
        return
    }

    $handler = New-Object System.Net.Http.HttpClientHandler
    $handler.AllowAutoRedirect = $false
    $client = New-Object System.Net.Http.HttpClient -ArgumentList $handler
    $client.Timeout = [TimeSpan]::FromSeconds(15)

    try {
        $routes = @(
            "/",
            "/login",
            "/cadastro",
            "/painel",
            "/painel/assinatura",
            "/painel/configuracoes",
            "/painel/pagamentos",
            "/site/slug-inexistente",
            "/favicon.ico",
            "/icon.png",
            "/og-orcaly.png"
        )

        foreach ($route in $routes) {
            $result = Test-HttpRoute -Client $client -BaseUrl $baseUrl -Route $route
            [void]$script:SmokeResults.Add($result)
            if ($result.passed) {
                Write-Success ("HTTP {0}: {1}" -f $route, $result.statusCode)
            }
            else {
                Write-Warning ("HTTP {0}: falhou ({1})" -f $route, $result.statusCode)
                if ($result.statusCode -eq 500) {
                    Add-CriticalFailure ("Smoke test encontrou HTTP 500 em {0}." -f $route)
                    Add-Cap "HTTP 500 no smoke test: nota maxima 59."
                }
            }
        }
        $script:SmokeExecuted = $true
    }
    finally {
        $client.Dispose()
        $handler.Dispose()
    }
}

function Stop-LocalServer {
    if ($script:ServerProcess) {
        try {
            if (-not $script:ServerProcess.HasExited) {
                Write-Step "Encerrando servidor local do smoke test"
                Stop-Process -Id $script:ServerProcess.Id -Force -ErrorAction SilentlyContinue
                $script:ServerProcess.WaitForExit(5000) | Out-Null
            }
        }
        catch {
            Write-Warning "Nao foi possivel confirmar o encerramento do servidor local."
        }
    }
}

function Get-FilesMatchingPath {
    param([string]$Pattern)
    return @($script:TextFiles | Where-Object { (Get-RelativePath $_) -match $Pattern })
}

function Audit-BuildQuality {
    $points = 0.0
    $evidence = New-Object System.Collections.ArrayList

    if ($script:BuildResult -and $script:BuildResult.Passed) { $points += 6; [void]$evidence.Add("Build passou.") }
    elseif ($script:BuildResult) { [void]$evidence.Add("Build falhou.") }
    else { [void]$evidence.Add("Build nao testado.") }

    if ($script:LintResult -and $script:LintResult.Passed) { $points += 2; [void]$evidence.Add("Lint passou.") }
    elseif ($script:LintResult) { [void]$evidence.Add("Lint falhou.") }

    if ($script:TypecheckResult -and $script:TypecheckResult.Passed) { $points += 2; [void]$evidence.Add("Typecheck passou.") }
    elseif ($script:TypecheckResult) { [void]$evidence.Add("Typecheck falhou.") }

    if ($script:TestResult -and $script:TestResult.Passed) { $points += 2; [void]$evidence.Add("Testes automatizados passaram.") }
    elseif ($script:TestResult) { [void]$evidence.Add("Testes automatizados falharam.") }

    $status = "ALERTA"
    if ($script:BuildResult -and -not $script:BuildResult.Passed) { $status = "FALHOU" }
    elseif ($points -ge 10) { $status = "PASSOU" }
    elseif (-not $script:BuildResult) { $status = "NAO TESTADO" }

    Add-Category -Name "Build, lint e qualidade automatizada" -Weight 12 -Points $points -Status $status -Evidence @($evidence)
}

function Audit-MultiCompanySecurity {
    $points = 0.0
    $evidence = New-Object System.Collections.ArrayList
    $apiFiles = Get-FilesMatchingPath '^app/api/.+/route\.(ts|tsx|js|jsx)$'
    $dbApiFiles = New-Object System.Collections.ArrayList

    foreach ($file in $apiFiles) {
        $content = ""
        try { $content = Get-Content -LiteralPath $file -Raw } catch { continue }
        if ($content -match '\.from\s*\(') { [void]$dbApiFiles.Add($file) }
    }

    $scoped = 0
    foreach ($file in $dbApiFiles) {
        $content = Get-Content -LiteralPath $file -Raw
        if ($content -match 'company_id') { $scoped++ }
    }

    $ratio = 0.0
    if ($dbApiFiles.Count -gt 0) { $ratio = $scoped / [double]$dbApiFiles.Count }
    if ($ratio -ge 0.60) { $points += 4; [void]$evidence.Add(("{0:P0} das APIs com banco mencionam company_id." -f $ratio)) }
    elseif ($ratio -ge 0.30) { $points += 2; [void]$evidence.Add(("Escopo company_id parcial: {0:P0}." -f $ratio)); Add-HighRisk "Cobertura estatica de company_id abaixo de 60% nas APIs com acesso ao banco." }
    else { [void]$evidence.Add(("Escopo company_id baixo: {0:P0}." -f $ratio)); Add-CriticalFailure "Poucas APIs com acesso ao banco apresentam evidencia estatica de company_id."; Add-Cap "Isolamento multiempresa critico: nota maxima 39." }

    $authEvidence = Find-Pattern -Patterns @('auth\.getUser', 'createServerClient', 'getCurrentCompany', 'resolveCompany', 'requireCompany', 'getServerSession') -Files $apiFiles
    if ($authEvidence.Count -ge 4) { $points += 3; [void]$evidence.Add("Resolucao server-side de usuario/empresa encontrada.") }
    elseif ($authEvidence.Count -gt 0) { $points += 1.5; [void]$evidence.Add("Resolucao server-side encontrada apenas parcialmente.") }
    else { Add-HighRisk "Nao foi encontrada evidencia suficiente de resolucao server-side de usuario/empresa nas APIs." }

    $sqlFiles = Get-FilesMatchingPath '^supabase/.+\.sql$'
    $rls = Find-Pattern -Patterns @('enable row level security', 'create policy', 'alter table.+enable row level security') -Files $sqlFiles
    if ($rls.Count -gt 0) { $points += 2; [void]$evidence.Add("Politicas ou ativacao de RLS encontradas em migrations.") }
    else { Add-HighRisk "Nenhuma evidencia estatica de RLS foi encontrada nas migrations auditadas." }

    $clientFiles = New-Object System.Collections.ArrayList
    foreach ($file in $script:TextFiles) {
        if ($file -notmatch '\.(ts|tsx|js|jsx)$') { continue }
        $content = ""
        try { $content = Get-Content -LiteralPath $file -Raw } catch { continue }
        if ($content -match '^[\s\r\n]*["'']use client["'']') { [void]$clientFiles.Add($file) }
    }
    $clientSecrets = Find-Pattern -Patterns @('SUPABASE_SERVICE_ROLE_KEY', 'MERCADO_PAGO_ACCESS_TOKEN', 'MERCADO_PAGO_CLIENT_SECRET', 'MERCADO_PAGO_WEBHOOK_SECRET') -Files @($clientFiles)
    if ($clientSecrets.Count -eq 0) { $points += 2; [void]$evidence.Add("Nenhum identificador de segredo server-side encontrado em Client Components.") }
    else { Add-CriticalFailure "Identificadores de credenciais server-side foram encontrados em Client Components."; Add-Cap "Possivel segredo no cliente: nota maxima 25." }

    $teamFiles = Get-FilesMatchingPath '(team|member|employee|equipe|funcionario)'
    $teamScope = Find-Pattern -Patterns @('company_id', 'owner', 'admin', 'role') -Files $teamFiles
    if ($teamScope.Count -ge 3) { $points += 2; [void]$evidence.Add("Escopo e autorizacao de equipe possuem evidencia estatica.") }
    elseif ($teamFiles.Count -gt 0) { $points += 0.5; Add-HighRisk "Fluxos de equipe existem, mas a evidencia estatica de escopo/autorizacao e limitada." }

    $status = "ALERTA"
    if ($script:CriticalFailures.Count -gt 0 -and $points -lt 7) { $status = "FALHOU" }
    elseif ($points -ge 11) { $status = "PASSOU" }
    Add-Category -Name "Seguranca multiempresa" -Weight 13 -Points $points -Status $status -Evidence @($evidence)
}

function Audit-Authentication {
    $points = 0.0
    $evidence = New-Object System.Collections.ArrayList

    if (Test-Path -LiteralPath (Join-Path $script:Root "app/login/page.tsx")) { $points += 1.5; [void]$evidence.Add("Rota de login encontrada.") }
    if (Test-Path -LiteralPath (Join-Path $script:Root "app/cadastro/page.tsx")) { $points += 1; [void]$evidence.Add("Rota de cadastro encontrada.") }

    $auth = Find-Pattern -Patterns @('auth\.getUser', 'signInWithPassword', 'signOut', 'createServerClient', 'createBrowserClient') -Files $script:TextFiles
    if ($auth.Count -ge 5) { $points += 2; [void]$evidence.Add("Fluxos Supabase Auth encontrados.") }
    elseif ($auth.Count -gt 0) { $points += 1; [void]$evidence.Add("Fluxos de Auth encontrados parcialmente.") }

    $protectionFiles = @()
    foreach ($candidate in @("proxy.ts", "app/painel/layout.tsx", "lib/supabase/server.ts", "lib/auth.ts")) {
        $path = Join-Path $script:Root $candidate
        if (Test-Path -LiteralPath $path) { $protectionFiles += $path }
    }
    $protection = Find-Pattern -Patterns @('redirect\s*\(.+/login', 'auth\.getUser', 'getUser\s*\(', 'cookies\s*\(') -Files $protectionFiles
    if ($protection.Count -ge 2) { $points += 2; [void]$evidence.Add("Protecao de painel/sessao encontrada.") }
    elseif ($protection.Count -gt 0) { $points += 1; Add-HighRisk "Protecao de painel possui evidencia estatica limitada." }
    else { Add-CriticalFailure "Nao foi encontrada evidencia suficiente de protecao da area /painel."; Add-Cap "Autenticacao critica nao comprovada: nota maxima 49." }

    $logout = Find-Pattern -Patterns @('signOut\s*\(', 'logout') -Files $script:TextFiles
    if ($logout.Count -gt 0) { $points += 1; [void]$evidence.Add("Acao de logout encontrada.") }

    $rawToken = Find-Pattern -Patterns @('localStorage\.(setItem|getItem)\s*\([^\)]*(access_token|refresh_token)', 'sessionStorage\.(setItem|getItem)\s*\([^\)]*(access_token|refresh_token)') -Files $script:TextFiles
    if ($rawToken.Count -eq 0) { $points += 0.5; [void]$evidence.Add("Nenhum armazenamento manual evidente de token encontrado.") }
    else { Add-HighRisk "Possivel armazenamento manual de token no navegador encontrado." }

    $status = "ALERTA"
    if ($points -ge 7) { $status = "PASSOU" }
    if ($points -lt 3) { $status = "FALHOU" }
    Add-Category -Name "Autenticacao e sessao" -Weight 8 -Points $points -Status $status -Evidence @($evidence)
}

function Audit-RoutesAndMenu {
    $points = 0.0
    $evidence = New-Object System.Collections.ArrayList
    [void](Get-AppRoutes)

    $coreRoutes = @("/", "/login", "/painel", "/painel/assinatura", "/painel/configuracoes", "/painel/pagamentos")
    $coreOk = 0
    foreach ($route in $coreRoutes) { if (Test-RouteExists $route) { $coreOk++ } }
    $points += 3 * ($coreOk / [double]$coreRoutes.Count)
    [void]$evidence.Add(("Rotas principais encontradas: {0}/{1}." -f $coreOk, $coreRoutes.Count))

    $links = Get-StaticNavigationLinks
    $missing = New-Object System.Collections.ArrayList
    foreach ($link in $links) {
        if ($link.Route -match '\$\{|\[') { continue }
        if (-not (Test-RouteExists $link.Route)) {
            $key = "{0} em {1}" -f $link.Route, $link.File
            if (-not $missing.Contains($key)) { [void]$missing.Add($key) }
        }
    }
    if ($missing.Count -eq 0) { $points += 2; [void]$evidence.Add("Nenhum link estatico interno claramente inexistente foi encontrado.") }
    elseif ($missing.Count -le 3) { $points += 1; Add-WarningItem ("Links internos potencialmente inexistentes: {0}." -f $missing.Count) }
    else { Add-HighRisk ("Foram encontrados {0} links internos potencialmente inexistentes." -f $missing.Count) }

    $oldRoute = Find-Pattern -Patterns @('/painel/modulo/assinatura') -Files $script:TextFiles
    $legacyFiles = Get-FilesMatchingPath '^app/painel/modulo/(assinatura|\[module\])/page\.'
    $redirect = Find-Pattern -Patterns @('redirect\s*\(\s*["'']/painel/assinatura["'']') -Files $legacyFiles
    if ($oldRoute.Count -le 2) { $points += 2; [void]$evidence.Add("Poucas referencias residuais a rota antiga de assinatura.") }
    else { Add-HighRisk "A rota antiga de assinatura ainda aparece em diversos arquivos de navegacao." }
    if ($redirect.Count -gt 0) { $points += 1; [void]$evidence.Add("Redirect server-side da rota antiga encontrado.") }
    else { Add-WarningItem "Redirect de compatibilidade da assinatura nao foi comprovado estaticamente." }

    $duplicates = Find-Pattern -Patterns @('Ver assinatura', 'Minha assinatura', 'Modulo Assinatura', 'Módulo Assinatura') -Files (Get-FilesMatchingPath '(layout|sidebar|navigation|menu|panel-modules|segment-modules|dashboard)')
    if ($duplicates.Count -gt 2) { Add-WarningItem "Possiveis rotulos duplicados de assinatura foram encontrados em menus/registries." }

    $status = "ALERTA"
    if ($points -ge 7) { $status = "PASSOU" }
    if ($points -lt 4) { $status = "FALHOU" }
    Add-Category -Name "Rotas e menu" -Weight 8 -Points $points -Status $status -Evidence @($evidence)
}

function Audit-MercadoPago {
    $points = 0.0
    $evidence = New-Object System.Collections.ArrayList
    $marketFiles = Get-FilesMatchingPath '(marketplace|mercado-pago|checkout|payment)'
    $marketApi = Get-FilesMatchingPath '^app/api/(marketplace|mercado-pago|checkout)/'

    $serverValidation = Find-Pattern -Patterns @('company_id', 'product', 'preco|price', 'delivery_fee', 'coupon|cupom', 'minimum|pedido_minimo|pedido mínimo') -Files $marketApi
    if ($serverValidation.Count -ge 12) { $points += 3; [void]$evidence.Add("Validacoes server-side de empresa, produto, preco, entrega e cupom encontradas.") }
    elseif ($serverValidation.Count -ge 5) { $points += 1.5; Add-HighRisk "Checkout possui apenas evidencia parcial de recalculo/validacao server-side." }
    else { Add-CriticalFailure "Checkout nao apresentou evidencia estatica suficiente de validacao server-side." }

    $orderCreation = Find-Pattern -Patterns @('order_items', 'deliveries|delivery', 'marketplace_payment', 'status.+pending|pendente', 'insert\s*\(') -Files $marketApi
    if ($orderCreation.Count -ge 8) { $points += 2; [void]$evidence.Add("Criacao de pedido, itens, entrega e pagamento possui evidencia estatica.") }
    elseif ($orderCreation.Count -gt 0) { $points += 1; Add-HighRisk "Criacao coerente do pedido esta apenas parcialmente comprovada." }

    $mpIntegration = Find-Pattern -Patterns @('mercadopago', 'preference', 'init_point', 'sandbox_init_point', 'access_token') -Files $marketApi
    if ($mpIntegration.Count -ge 5) { $points += 2; [void]$evidence.Add("Criacao de preferencia/checkout Mercado Pago encontrada no servidor.") }
    elseif ($mpIntegration.Count -gt 0) { $points += 1 }

    $webhookFiles = Get-FilesMatchingPath '^app/api/.+webhook.+/route\.'
    $webhook = Find-Pattern -Patterns @('payment', 'status', 'merchant_order|preapproval', 'fetch\s*\(|mercadopago', 'idempot|external_reference') -Files $webhookFiles
    if ($webhookFiles.Count -gt 0 -and $webhook.Count -ge 8) { $points += 3; [void]$evidence.Add("Webhook e consulta de estado externo possuem evidencia estatica.") }
    elseif ($webhookFiles.Count -gt 0) { $points += 1.5; Add-HighRisk "Webhook existe, mas sua validacao/idempotencia nao ficou plenamente comprovada." }
    else { Add-CriticalFailure "Webhook Mercado Pago nao foi encontrado."; Add-Cap "Webhook ausente: pagamentos reais nao liberados e nota maxima 69." }

    $idempotency = Find-Pattern -Patterns @('idempot', 'external_reference', 'payment_id', 'preapproval_id', 'upsert', 'on conflict') -Files $marketFiles
    if ($idempotency.Count -ge 5) { $points += 2; [void]$evidence.Add("Mecanismos de idempotencia/referencia externa encontrados.") }
    elseif ($idempotency.Count -gt 0) { $points += 1; Add-HighRisk "Idempotencia de pagamentos possui evidencia parcial." }

    $frontendRisk = Find-Pattern -Patterns @('total\s*:', 'price\s*:', 'delivery_fee\s*:', 'commission_percentage\s*:') -Files (Get-FilesMatchingPath '(components|app)/(.*marketplace|.*checkout|.*loja)')
    if ($frontendRisk.Count -gt 0) { Add-WarningItem "Valores financeiros aparecem em payloads de frontend; confirmar que o servidor recalcula todos eles." }

    $validated = ($env:ORCALY_QA_MERCADO_PAGO_VALIDATED -eq "1")
    $status = "BLOQUEADO"
    if ($validated -and $points -ge 10) { $status = "PASSOU"; [void]$evidence.Add("Flag externa de validacao Mercado Pago informada.") }
    else { Add-Blocked "Pagamento real Mercado Pago nao foi disparado por este QA somente leitura." }
    if ($points -lt 5) { $status = "FALHOU" }

    Add-Category -Name "Checkout e Mercado Pago" -Weight 12 -Points $points -Status $status -Evidence @($evidence)
}

function Audit-Subscription {
    $points = 0.0
    $evidence = New-Object System.Collections.ArrayList
    $subscriptionFiles = Get-FilesMatchingPath '(assinatura|subscription|preapproval|mercado-pago/webhook)'

    if (Test-Path -LiteralPath (Join-Path $script:Root "app/painel/assinatura/page.tsx")) { $points += 1; [void]$evidence.Add("Rota oficial /painel/assinatura encontrada.") }
    $legacy = Get-FilesMatchingPath '^app/painel/modulo/(assinatura|\[module\])/page\.'
    $legacyRedirect = Find-Pattern -Patterns @('redirect\s*\(\s*["'']/painel/assinatura["'']') -Files $legacy
    if ($legacyRedirect.Count -gt 0) { $points += 1; [void]$evidence.Add("Pagina intermediaria substituida por redirect server-side.") }

    $trialFields = Find-Pattern -Patterns @('trial_started_at', 'trial_ends_at', 'trial_used_at', 'access_until') -Files $subscriptionFiles
    if ($trialFields.Count -ge 4) { $points += 2; [void]$evidence.Add("Campos de trial e acesso encontrados.") }
    elseif ($trialFields.Count -gt 0) { $points += 1 }

    $trialUnique = Find-Pattern -Patterns @('trial_used_at.+(null|is)', 'interval.+7 day', 'addDays\s*\(.+7', 'trial.+7', 'rpc\s*\(') -Files $subscriptionFiles
    if ($trialUnique.Count -ge 2) { $points += 1; [void]$evidence.Add("Regras de trial unico/sete dias possuem evidencia estatica.") }
    else { Add-HighRisk "Trial unico de sete dias nao ficou plenamente comprovado estaticamente." }

    $card = Find-Pattern -Patterns @('preapproval_id', 'preapproval', 'card|cartao|cartão', 'recurring|recorr') -Files $subscriptionFiles
    if ($card.Count -ge 6) { $points += 2; [void]$evidence.Add("Cartao recorrente/preapproval encontrado.") }
    elseif ($card.Count -gt 0) { $points += 1 }

    $pix = Find-Pattern -Patterns @('pix', 'qr_code', 'ticket_url') -Files $subscriptionFiles
    if ($pix.Count -ge 2) { $points += 1; [void]$evidence.Add("Fluxo Pix encontrado.") }

    $cancel = Find-Pattern -Patterns @('cancel', 'cancelar', 'company_id', 'preapproval_id', 'access_until', 'subscription_cancelled_at') -Files $subscriptionFiles
    if ($cancel.Count -ge 8) { $points += 1.5; [void]$evidence.Add("Cancelamento server-side e preservacao de acesso possuem evidencia.") }
    elseif ($cancel.Count -gt 0) { $points += 0.5; Add-HighRisk "Cancelamento possui evidencia estatica parcial." }

    $ordering = Find-Pattern -Patterns @('next_billing_at', 'updated_at', 'event.+date', 'created_at.+status', 'idempot') -Files $subscriptionFiles
    if ($ordering.Count -ge 2) { $points += 0.5; [void]$evidence.Add("Ordenacao/idempotencia de eventos possui evidencia estatica.") }

    $status = "BLOQUEADO"
    if ($env:ORCALY_QA_MERCADO_PAGO_VALIDATED -eq "1" -and $points -ge 8.5) { $status = "PASSOU" }
    elseif ($points -lt 4) { $status = "FALHOU" }
    else { Add-Blocked "Trial, Pix, recorrencia e cancelamento exigem validacao com sessao, banco e conta de teste." }

    Add-Category -Name "Assinatura, trial e cancelamento" -Weight 10 -Points $points -Status $status -Evidence @($evidence)
}

function Audit-Food {
    $points = 0.0
    $evidence = New-Object System.Collections.ArrayList
    $foodFiles = Get-FilesMatchingPath '(food|cardapio|loja|marketplace|entregas|taxas-entrega|horarios|delivery|coupon|cupom)'

    $product = Find-Pattern -Patterns @('ativo|active', 'preco|price', 'imagem|image', 'variation|variacao|variação', 'additional|adicional', 'quantity|quantidade', 'observacao|observação') -Files $foodFiles
    if ($product.Count -ge 12) { $points += 1.5; [void]$evidence.Add("Produto Food possui campos esperados.") }
    elseif ($product.Count -gt 0) { $points += 0.75 }

    $cart = Find-Pattern -Patterns @('cart|carrinho', 'subtotal', 'quantity|quantidade', 'remove', 'additional|adicional', 'variation|variacao|variação') -Files $foodFiles
    if ($cart.Count -ge 10) { $points += 1.5; [void]$evidence.Add("Carrinho, quantidades, variacoes e adicionais encontrados.") }
    elseif ($cart.Count -gt 0) { $points += 0.75 }

    $coupon = Find-Pattern -Patterns @('company_id', 'expires|validade', 'minimum|minimo|mínimo', 'limit|limite', 'percent|percentual', 'fixed|fixo', 'free_shipping|frete') -Files (Get-FilesMatchingPath '(coupon|cupom|marketplace/order)')
    if ($coupon.Count -ge 8) { $points += 1.5; [void]$evidence.Add("Cupom possui validacao estatica relevante.") }
    elseif ($coupon.Count -gt 0) { $points += 0.75 }

    $delivery = Find-Pattern -Patterns @('delivery_zones', 'delivery_fee', 'pedido_minimo|minimum_order', 'address|endereco|endereço', 'pickup|retirada') -Files $foodFiles
    if ($delivery.Count -ge 7) { $points += 1.5; [void]$evidence.Add("Entrega, taxa, minimo e retirada encontrados.") }
    elseif ($delivery.Count -gt 0) { $points += 0.75 }

    $payment = Find-Pattern -Patterns @('pending|pendente', 'mercado', 'webhook', 'order_items', 'deliveries', 'payments') -Files $foodFiles
    if ($payment.Count -ge 10) { $points += 2; [void]$evidence.Add("Pedido, pagamento e webhook possuem evidencia estatica.") }
    elseif ($payment.Count -gt 0) { $points += 1 }

    $panelRoutes = @("app/painel/entregas/page.tsx", "app/painel/taxas-entrega/page.tsx", "app/painel/horarios/page.tsx", "app/painel/formas-pagamento/page.tsx")
    $existing = 0
    foreach ($route in $panelRoutes) { if (Test-Path -LiteralPath (Join-Path $script:Root $route)) { $existing++ } }
    $points += 2 * ($existing / [double]$panelRoutes.Count)
    [void]$evidence.Add(("Paginas operacionais Food: {0}/{1}." -f $existing, $panelRoutes.Count))

    $status = "BLOQUEADO"
    if ($env:ORCALY_QA_BROWSER_VALIDATED -eq "1" -and $env:ORCALY_QA_DATABASE_VALIDATED -eq "1" -and $points -ge 8) { $status = "PASSOU" }
    elseif ($points -lt 4) { $status = "FALHOU" }
    else { Add-Blocked "Food completo exige navegador, sessao e banco real para validar CRUD e checkout." }

    Add-Category -Name "Food completo" -Weight 10 -Points $points -Status $status -Evidence @($evidence)
}

function Audit-SettingsTeam {
    $points = 0.0
    $evidence = New-Object System.Collections.ArrayList
    $settingsFiles = Get-FilesMatchingPath '(configuracoes|settings|company|team|member|employee|equipe|slug|company-url)'

    $company = Find-Pattern -Patterns @('loadCompany|company/current|company/settings', 'updateCompany|saveCompany', 'logo', 'company_id') -Files $settingsFiles
    if ($company.Count -ge 8) { $points += 2; [void]$evidence.Add("Carregamento, salvamento, logo e company_id encontrados.") }
    elseif ($company.Count -gt 0) { $points += 1 }

    $businessType = Find-Pattern -Patterns @('business_type', 'already.+defined|ja foi definido|já foi definido', 'disabled|readOnly', 'support|suporte') -Files $settingsFiles
    if ($businessType.Count -ge 5) { $points += 1; [void]$evidence.Add("Bloqueio de business_type possui evidencia frontend/backend.") }
    else { Add-HighRisk "Bloqueio server-side do business_type nao ficou plenamente comprovado." }

    $team = Find-Pattern -Patterns @('addEmployee|removeEmployee|loadMembers|invite|invitation', 'owner|proprietario|proprietário', 'company_id', 'role', 'delete|remove') -Files $settingsFiles
    if ($team.Count -ge 12) { $points += 3; [void]$evidence.Add("Equipe: listagem, convite/remocao, papel e escopo encontrados.") }
    elseif ($team.Count -ge 5) { $points += 1.5; Add-HighRisk "Equipe possui evidencia funcional parcial." }
    else { Add-HighRisk "Gerenciamento de equipe nao ficou comprovado estaticamente." }

    $slug = Find-Pattern -Patterns @('normalizeSlug|normalize.+slug', 'reserved|reservad', 'availability|disponibilidade|check-subdomain', 'subdomain_slug|companies\.slug', 'orcaly\.com\.br', 'company-url') -Files $settingsFiles
    if ($slug.Count -ge 8) { $points += 2; [void]$evidence.Add("Subdominio: normalizacao, disponibilidade, reservados e URL oficial encontrados.") }
    elseif ($slug.Count -gt 0) { $points += 1; Add-HighRisk "Validacao de subdominio possui evidencia parcial." }

    $badOfficial = Find-Pattern -Patterns @('https://orcaly\.com\.br/site/', 'vercel\.orcaly\.com\.br') -Files $settingsFiles
    if ($badOfficial.Count -gt 0) { Add-WarningItem "URLs antigas/inadequadas de site aparecem em arquivos de configuracao; revisar se sao apenas fallback tecnico." }

    $status = "ALERTA"
    if ($points -ge 7) { $status = "PASSOU" }
    if ($points -lt 3) { $status = "FALHOU" }
    if ($env:ORCALY_QA_DATABASE_VALIDATED -ne "1") { Add-Blocked "Operacoes de empresa/equipe/subdominio nao foram executadas contra banco real."; if ($status -eq "PASSOU") { $status = "BLOQUEADO" } }

    Add-Category -Name "Configuracoes e equipe" -Weight 8 -Points $points -Status $status -Evidence @($evidence)
}

function Audit-PanelUx {
    $points = 0.0
    $evidence = New-Object System.Collections.ArrayList
    $panelFiles = Get-FilesMatchingPath '^(app/painel|components/(panel|painel|panel-ui|dashboard|layout|sidebar))/'

    $visual = Find-Pattern -Patterns @('PanelPageHeader|PanelSection|PanelMetricCard|PanelTable|PanelBadge|StatusBadge|rounded-', 'shadow-', 'border-') -Files $panelFiles
    if ($visual.Count -ge 20) { $points += 2; [void]$evidence.Add("Design system/superficies consistentes encontrados.") }
    elseif ($visual.Count -gt 0) { $points += 1 }

    $loading = Find-Pattern -Patterns @('loading\.tsx', 'animate-pulse', 'skeleton', 'animate-spin', 'disabled=') -Files $panelFiles
    if ($loading.Count -ge 6) { $points += 1; [void]$evidence.Add("Loading, skeleton e bloqueio de acao encontrados.") }
    elseif ($loading.Count -gt 0) { $points += 0.5 }

    $responsive = Find-Pattern -Patterns @('min-w-0', 'max-w-full', 'overflow-x-auto', 'flex-wrap', 'break-words', 'grid-cols-1', 'sm:', 'md:', 'lg:') -Files $panelFiles
    if ($responsive.Count -ge 15) { $points += 1; [void]$evidence.Add("Classes responsivas encontradas.") }
    elseif ($responsive.Count -gt 0) { $points += 0.5 }

    $a11y = Find-Pattern -Patterns @('aria-label', 'focus-visible', 'prefers-reduced-motion', 'role=', 'aria-describedby') -Files $panelFiles
    if ($a11y.Count -ge 5) { $points += 1; [void]$evidence.Add("Acessibilidade e reduced motion possuem evidencia.") }
    elseif ($a11y.Count -gt 0) { $points += 0.5 }

    $adaptive = Find-Pattern -Patterns @('business_type|businessType|segmento|segment', 'food|beauty|oficina|grafica|gráfica|eventos|loja|servicos|serviços') -Files (Get-FilesMatchingPath '(app/painel/page|dashboard|segment-modules|panel-modules)')
    if ($adaptive.Count -ge 10) { $points += 2; [void]$evidence.Add("Dashboard/menu adaptativo por segmento encontrado.") }
    elseif ($adaptive.Count -gt 0) { $points += 1 }

    $placeholder = Find-Pattern -Patterns @('PanelPlaceholderPage', 'Em breve', 'Coming soon') -Files $panelFiles
    if ($placeholder.Count -gt 0) {
        Add-HighRisk ("Foram encontradas {0} referencias a placeholders visiveis no painel." -f $placeholder.Count)
        Add-Cap "Placeholders visiveis: nota maxima 79."
    }

    $status = "ALERTA"
    if ($points -ge 6) { $status = "PASSOU" }
    if ($env:ORCALY_QA_BROWSER_VALIDATED -ne "1") {
        Add-Blocked "Responsividade e UX visual exigem navegador; analise estatica nao equivale a teste visual."
        if ($status -eq "PASSOU") { $status = "BLOQUEADO" }
    }
    Add-Category -Name "Painel, UX e responsividade" -Weight 7 -Points $points -Status $status -Evidence @($evidence)
}

function Audit-SiteMetadata {
    $points = 0.0
    $evidence = New-Object System.Collections.ArrayList
    $siteFiles = Get-FilesMatchingPath '(app/layout|app/site|public|company-url|metadata|coupon|cupom|marketplace)'

    $publicSite = Find-Pattern -Patterns @('generateMetadata', 'metadataBase', 'openGraph', 'twitter', 'site/\[slug\]', 'public-site') -Files $siteFiles
    if ($publicSite.Count -ge 6) { $points += 2; [void]$evidence.Add("Site publico e metadata dinamica encontrados.") }
    elseif ($publicSite.Count -gt 0) { $points += 1 }

    $coupon = Find-Pattern -Patterns @('coupon|cupom', 'company_id', 'minimum|minimo|mínimo', 'expires|validade', 'discount|desconto') -Files (Get-FilesMatchingPath '(coupon|cupom|marketplace/order|checkout)')
    if ($coupon.Count -ge 8) { $points += 2; [void]$evidence.Add("Cupom validado no fluxo server-side possui evidencia.") }
    elseif ($coupon.Count -gt 0) { $points += 1 }

    $url = Find-Pattern -Patterns @('company-url', '\{slug\}\.orcaly\.com\.br', 'orcaly\.com\.br', 'subdomain') -Files $siteFiles
    if ($url.Count -ge 3) { $points += 1; [void]$evidence.Add("Helper/URL de subdominio encontrado.") }

    $assets = @("app/favicon.ico", "app/icon.png", "app/apple-icon.png", "public/logo-orcaly.png", "public/og-orcaly.png")
    $assetCount = 0
    foreach ($asset in $assets) { if (Test-Path -LiteralPath (Join-Path $script:Root $asset)) { $assetCount++ } }
    if ($assetCount -ge 4) { $points += 1; [void]$evidence.Add(("Assets de favicon/OG encontrados: {0}/{1}." -f $assetCount, $assets.Count)) }
    elseif ($assetCount -gt 0) { $points += 0.5 }

    $status = "ALERTA"
    if ($points -ge 5) { $status = "PASSOU" }
    Add-Category -Name "Site, cupom, favicon e Open Graph" -Weight 6 -Points $points -Status $status -Evidence @($evidence)
}

function Audit-FinanceOperation {
    $points = 0.0
    $evidence = New-Object System.Collections.ArrayList
    $financeFiles = Get-FilesMatchingPath '(finance|financeiro|payment|pagamento|marketplace|order|pedido|webhook|transaction)'

    $integration = Find-Pattern -Patterns @('financial_transactions|financeiro|contas_receber|accounts_receivable', 'order_id|pedido_id', 'gross|bruto', 'discount|desconto', 'fee|taxa', 'net|liquido|líquido') -Files $financeFiles
    if ($integration.Count -ge 10) { $points += 2; [void]$evidence.Add("Integracao pedido/pagamento/financeiro possui evidencia.") }
    elseif ($integration.Count -gt 0) { $points += 1 }

    $scope = Find-Pattern -Patterns @('company_id') -Files $financeFiles
    if ($scope.Count -ge 5) { $points += 1; [void]$evidence.Add("company_id encontrado em fluxos financeiros.") }
    else { Add-HighRisk "Escopo multiempresa financeiro possui pouca evidencia estatica." }

    $idempot = Find-Pattern -Patterns @('idempot', 'payment_id', 'external_reference', 'upsert', 'on conflict') -Files $financeFiles
    if ($idempot.Count -ge 4) { $points += 1; [void]$evidence.Add("Idempotencia financeira encontrada.") }
    elseif ($idempot.Count -gt 0) { $points += 0.5 }

    $errors = Find-Pattern -Patterns @('try\s*\{', 'catch\s*\(', 'console\.error', 'error\.tsx', 'not-found') -Files $financeFiles
    if ($errors.Count -ge 8) { $points += 1; [void]$evidence.Add("Tratamento de erros/logs encontrado.") }
    elseif ($errors.Count -gt 0) { $points += 0.5 }

    $ops = Find-Pattern -Patterns @('rate.?limit', 'revalidate', 'timeout', 'retry', 'status.+failed|falhou', 'refund|estorno') -Files $financeFiles
    if ($ops.Count -ge 4) { $points += 1; [void]$evidence.Add("Preparacao operacional possui evidencia.") }
    elseif ($ops.Count -gt 0) { $points += 0.5 }
    else { Add-WarningItem "APIs publicas sensiveis podem precisar de rate limiting e estrategia explicita de retry/timeout." }

    $status = "ALERTA"
    if ($points -ge 5) { $status = "PASSOU" }
    if ($points -lt 2) { $status = "FALHOU" }
    Add-Category -Name "Financeiro e operacao" -Weight 6 -Points $points -Status $status -Evidence @($evidence)
}

function Get-SegmentSummary {
    $segments = @(
        [pscustomobject]@{ Name = "Food"; Patterns = @('food', 'cardapio', 'entregas', 'taxas-entrega', 'horarios') },
        [pscustomobject]@{ Name = "Grafica"; Patterns = @('grafica', 'gráfica', 'artes', 'producao', 'produção') },
        [pscustomobject]@{ Name = "Oficina/Auto"; Patterns = @('oficina', 'auto', 'veiculos', 'veículos', 'ordens-servico') },
        [pscustomobject]@{ Name = "Assistencia"; Patterns = @('assistencia', 'assistência', 'aparelhos', 'diagnostico', 'diagnóstico') },
        [pscustomobject]@{ Name = "Beauty"; Patterns = @('beauty', 'barbearia', 'agenda', 'profissionais') },
        [pscustomobject]@{ Name = "Eventos"; Patterns = @('eventos', 'pacotes', 'contratos', 'checklist-evento') },
        [pscustomobject]@{ Name = "Loja"; Patterns = @('loja', 'estoque', 'catalogo', 'catálogo') },
        [pscustomobject]@{ Name = "Servicos"; Patterns = @('servicos', 'serviços', 'solicitacoes', 'solicitações', 'propostas') }
    )
    $result = New-Object System.Collections.ArrayList

    foreach ($segment in $segments) {
        $patterns = @($segment.Patterns | ForEach-Object { [regex]::Escape($_) })
        $regex = '(' + ($patterns -join '|') + ')'
        $files = Get-FilesMatchingPath $regex
        $contentEvidence = Find-Pattern -Patterns $segment.Patterns -Files $script:TextFiles
        $placeholder = Find-Pattern -Patterns @('PanelPlaceholderPage', 'Em breve', 'Coming soon') -Files $files
        $status = "AUSENTE"
        if ($files.Count -gt 0 -and $contentEvidence.Count -gt 3) { $status = "PARCIAL" }
        if ($files.Count -ge 3 -and $contentEvidence.Count -ge 8 -and $placeholder.Count -eq 0) { $status = "IMPLEMENTADO" }
        if ($placeholder.Count -gt 0) { $status = "PLACEHOLDER" }
        if ($env:ORCALY_QA_BROWSER_VALIDATED -ne "1" -and $status -eq "IMPLEMENTADO") { $status = "BLOQUEADO PARA TESTE" }

        [void]$result.Add([pscustomobject]@{
            name = $segment.Name
            status = $status
            files = $files.Count
            evidenceCount = $contentEvidence.Count
        })
    }
    return @($result)
}

function Get-Classification {
    param([double]$Score)
    if ($Score -ge 90) { return "APTO PARA PRODUCAO, SUJEITO A VALIDACOES EXTERNAS" }
    if ($Score -ge 75) { return "APTO PARA BETA COM RESTRICOES" }
    if ($Score -ge 60) { return "APTO PARA TESTE INTERNO" }
    if ($Score -ge 40) { return "TESTE INTERNO COM RESTRICOES IMPORTANTES" }
    return "NAO APTO"
}

function Get-Confidence {
    $confidence = 20
    if ($script:BuildResult) { $confidence += 15 }
    if ($script:LintResult) { $confidence += 10 }
    if ($script:TypecheckResult) { $confidence += 10 }
    if ($script:TestResult) { $confidence += 10 }
    if ($script:SmokeExecuted) { $confidence += 15 }
    if ($env:ORCALY_QA_BROWSER_VALIDATED -eq "1") { $confidence += 5 }
    if ($env:ORCALY_QA_DATABASE_VALIDATED -eq "1") { $confidence += 5 }
    if ($env:ORCALY_QA_TWO_COMPANIES_VALIDATED -eq "1") { $confidence += 5 }
    if ($env:ORCALY_QA_MERCADO_PAGO_VALIDATED -eq "1") { $confidence += 5 }

    if ($env:ORCALY_QA_BROWSER_VALIDATED -ne "1" -or $env:ORCALY_QA_DATABASE_VALIDATED -ne "1" -or $env:ORCALY_QA_TWO_COMPANIES_VALIDATED -ne "1") {
        $confidence = [math]::Min($confidence, 69)
    }
    if (-not $script:BuildResult) { $confidence = [math]::Min($confidence, 49) }
    return [int][math]::Min(100, $confidence)
}

function Get-ConfidenceClass {
    param([int]$Confidence)
    if ($Confidence -ge 90) { return "ALTA CONFIANCA" }
    if ($Confidence -ge 70) { return "BOA CONFIANCA" }
    if ($Confidence -ge 40) { return "CONFIANCA MODERADA" }
    return "BAIXA CONFIANCA"
}

function Apply-CriticalCaps {
    param([double]$ScoreBeforeCaps)
    $score = $ScoreBeforeCaps

    if ($script:BuildResult -and -not $script:BuildResult.Passed) {
        $score = [math]::Min($score, 49)
        Add-Cap "Build falhou: nota maxima 49."
    }
    if (-not $script:BuildResult) {
        $score = [math]::Min($score, 59)
        Add-Cap "Build nao executado: nota maxima 59."
    }
    if ($script:CriticalFailures -contains "Poucas APIs com acesso ao banco apresentam evidencia estatica de company_id.") {
        $score = [math]::Min($score, 39)
    }
    if ($script:CriticalFailures -contains "Identificadores de credenciais server-side foram encontrados em Client Components.") {
        $score = [math]::Min($score, 25)
    }
    foreach ($cap in $script:CriticalCaps) {
        if ($cap -match 'nota maxima ([0-9]+)') {
            $limit = [int]$matches[1]
            $score = [math]::Min($score, $limit)
        }
    }
    return [math]::Round([math]::Max(0, [math]::Min(100, $score)), 2)
}

function Get-ReleaseDecision {
    param(
        [double]$Score,
        [int]$Confidence
    )

    $buildPassed = ($script:BuildResult -and $script:BuildResult.Passed)
    $securityCategory = $script:Categories | Where-Object { $_.name -eq "Seguranca multiempresa" } | Select-Object -First 1
    $mpCategory = $script:Categories | Where-Object { $_.name -eq "Checkout e Mercado Pago" } | Select-Object -First 1
    $webhookValidated = ($env:ORCALY_QA_MERCADO_PAGO_VALIDATED -eq "1" -and $mpCategory -and $mpCategory.status -eq "PASSOU")

    $internal = "NAO"
    if ($buildPassed -and $Score -ge 60) { $internal = "SIM" }
    elseif ($buildPassed -and $Score -ge 40) { $internal = "COM RESTRICOES" }

    $beta = "NAO"
    if ($buildPassed -and $Score -ge 75 -and $Confidence -ge 55 -and $script:CriticalFailures.Count -eq 0) { $beta = "SIM" }
    elseif ($buildPassed -and $Score -ge 60 -and $script:CriticalFailures.Count -eq 0) { $beta = "COM RESTRICOES" }

    $payments = "NAO LIBERADO"
    if ($webhookValidated -and $buildPassed -and $securityCategory.status -ne "FALHOU") { $payments = "LIBERADO" }
    elseif ($mpCategory.status -eq "BLOQUEADO") { $payments = "BLOQUEADO PARA VALIDACAO" }

    $production = "NAO LIBERADO"
    if ($buildPassed -and $Score -ge 90 -and $Confidence -ge 90 -and $script:CriticalFailures.Count -eq 0 -and $payments -eq "LIBERADO") {
        $production = "LIBERADO"
    }

    return [pscustomobject]@{
        internal = $internal
        beta = $beta
        payments = $payments
        production = $production
        internalBool = ($internal -eq "SIM")
        betaBool = ($beta -eq "SIM")
        paymentsBool = ($payments -eq "LIBERADO")
        productionBool = ($production -eq "LIBERADO")
    }
}

function New-ManualChecklist {
    $tests = @(
        @("P0-001","P0","Login","Usuario de teste valido","Acessar /login; informar credenciais; entrar","Usuario entra e vai ao painel","Captura da tela e URL"),
        @("P0-002","P0","Logout","Usuario autenticado","Acionar logout; voltar no navegador","Sessao termina e painel fica protegido","Video curto ou capturas"),
        @("P0-003","P0","Sessao","Usuario autenticado","Recarregar; fechar/abrir aba; aguardar expiracao controlada","Sessao permanece ou renova sem expor token","Console e capturas"),
        @("P0-004","P0","Multiempresa","Duas empresas e dois usuarios","Criar registro na empresa A; consultar pela empresa B","Empresa B nao le nem altera dados da A","IDs mascarados e consultas"),
        @("P0-005","P0","Webhook","Conta Mercado Pago de teste","Gerar pagamento teste; repetir notificacao","Status atualiza uma vez e sem duplicar financeiro","Logs e IDs de teste mascarados"),
        @("P0-006","P0","Trial","Empresa nunca assinante","Iniciar assinatura; conferir datas; tentar nova adesao","Trial dura 7 dias e nao reinicia","Capturas e dados mascarados"),
        @("P0-007","P0","Cancelamento","Assinatura de teste ativa","Cancelar; simular falha externa; repetir webhook antigo","Falha nao cancela localmente; acesso preservado; evento antigo nao reativa","Logs mascarados"),
        @("P0-008","P0","Pix","Empresa elegivel","Escolher Pix; gerar cobranca; concluir em sandbox","Nao cobra no primeiro dia do trial quando aplicavel","Capturas sandbox"),
        @("P0-009","P0","Cartao recorrente","Cartao de teste","Criar recorrencia; validar preapproval; cancelar","Recorrencia e cancelamento consistentes","Capturas sandbox"),
        @("P1-001","P1","Funcionario","Proprietario autenticado","Adicionar; aceitar convite; remover acesso","Vinculo correto e historico preservado","Capturas e logs"),
        @("P1-002","P1","Business type","Empresa sem ramo e empresa com ramo","Definir uma vez; tentar alterar novamente","Primeira definicao aceita; segunda rejeitada no servidor","Resposta da API mascarada"),
        @("P1-003","P1","Slug","Empresa autenticada","Testar reservado, ocupado, proprio e valido","Normalizacao e disponibilidade corretas","Capturas"),
        @("P1-004","P1","Produto","Empresa Food","Criar, editar, desativar e excluir produto","CRUD persiste apenas na empresa atual","Capturas"),
        @("P1-005","P1","Pedido","Loja publica configurada","Montar carrinho; finalizar; conferir painel","Pedido, itens e totais recalculados no servidor","Capturas e pedido teste"),
        @("P1-006","P1","Cupom","Cupom de teste valido","Aplicar abaixo/acima do minimo; expirar; exceder limite","Servidor rejeita casos invalidos","Capturas"),
        @("P1-007","P1","Food","Produtos com variacao/adicional","Adicionar itens, alterar quantidades e observacoes","Subtotal considera variacoes e adicionais multiplicados","Capturas"),
        @("P1-008","P1","Entrega","Zona e retirada configuradas","Testar endereco valido/invalido e retirada","Taxa/minimo corretos; retirada sem delivery","Capturas"),
        @("P1-009","P1","Configuracoes","Empresa autenticada","Editar dados e logo; recarregar","Dados persistem sem alterar ramo","Capturas"),
        @("P2-001","P2","Rotas","Build implantado","Abrir menus desktop/mobile e links principais","Sem 404 e sem pagina intermediaria de assinatura","Lista de URLs"),
        @("P2-002","P2","Site publico","Slug publicado","Abrir subdominio e compartilhar URL","Site abre em https://slug.orcaly.com.br","Capturas"),
        @("P2-003","P2","WhatsApp","Site publico acessivel","Compartilhar URL no WhatsApp","Preview usa titulo, descricao e OG corretos","Captura do preview"),
        @("P2-004","P2","Chrome favicon","Deploy concluido","Limpar cache; abrir site em nova aba","Favicon do Orcaly aparece","Captura da aba"),
        @("P3-001","P3","Mobile 360px","Navegador com DevTools","Testar painel, tabelas, modais e formularios","Sem overflow; botoes utilizaveis","Capturas 360px"),
        @("P3-002","P3","Mobile 390px","Navegador com DevTools","Repetir fluxo principal","Layout consistente e legivel","Capturas 390px"),
        @("P3-003","P3","Acessibilidade","Navegador desktop","Navegar por teclado; reduzir movimento","Foco visivel e animacoes reduzidas","Video curto")
    )

    $builder = New-Object System.Text.StringBuilder
    [void]$builder.AppendLine("# Checklist QA Manual do Orcaly")
    [void]$builder.AppendLine("")
    [void]$builder.AppendLine("Preencha Resultado obtido e Status durante a execucao manual.")
    [void]$builder.AppendLine("")

    foreach ($priority in @("P0", "P1", "P2", "P3")) {
        [void]$builder.AppendLine(("## {0}" -f $priority))
        [void]$builder.AppendLine("")
        foreach ($test in $tests | Where-Object { $_[1] -eq $priority }) {
            [void]$builder.AppendLine(("### {0} - {1}" -f $test[0], $test[2]))
            [void]$builder.AppendLine("")
            [void]$builder.AppendLine(("- Area: {0}" -f $test[2]))
            [void]$builder.AppendLine(("- Pre-condicao: {0}" -f $test[3]))
            [void]$builder.AppendLine(("- Passos: {0}" -f $test[4]))
            [void]$builder.AppendLine(("- Resultado esperado: {0}" -f $test[5]))
            [void]$builder.AppendLine("- Resultado obtido: ")
            [void]$builder.AppendLine("- Status: ")
            [void]$builder.AppendLine(("- Evidencia necessaria: {0}" -f $test[6]))
            [void]$builder.AppendLine("")
        }
    }

    Write-Utf8NoBom -Path $script:ChecklistPath -Content $builder.ToString()
    Write-Success "Checklist manual gerado"
}

function New-Reports {
    param(
        [double]$ScoreBeforeCaps,
        [double]$Score,
        [int]$Confidence,
        [string]$ConfidenceClass,
        [string]$Classification,
        [pscustomobject]$Decision,
        [object[]]$Segments
    )

    $topBlockers = @($script:CriticalFailures + $script:BlockedTests | Select-Object -First 5)
    $topRisks = @($script:HighRisks | Select-Object -First 5)
    $topPriorities = New-Object System.Collections.ArrayList
    foreach ($item in $topBlockers) { Add-UniqueItem -List $topPriorities -Value ("Corrigir/validar: " + $item) }
    foreach ($item in $topRisks) {
        if ($topPriorities.Count -ge 5) { break }
        Add-UniqueItem -List $topPriorities -Value ("Mitigar: " + $item)
    }
    while ($topPriorities.Count -lt 5) {
        Add-UniqueItem -List $topPriorities -Value "Executar checklist manual P0/P1 com duas empresas e credenciais de sandbox."
        if ($topPriorities.Count -lt 5) { Add-UniqueItem -List $topPriorities -Value "Revisar logs de build, lint e smoke test antes do beta." }
        if ($topPriorities.Count -lt 5) { Add-UniqueItem -List $topPriorities -Value "Validar webhook e idempotencia com eventos repetidos de teste." }
        if ($topPriorities.Count -lt 5) { Add-UniqueItem -List $topPriorities -Value "Confirmar isolamento multiempresa em leitura, update e delete." }
        if ($topPriorities.Count -lt 5) { Add-UniqueItem -List $topPriorities -Value "Executar teste visual em 360px, 390px, 768px e desktop." }
    }

    $jsonObject = [ordered]@{
        project = "Orcaly"
        generatedAt = (Get-Date).ToString("o")
        score = $Score
        scoreBeforeCaps = $ScoreBeforeCaps
        classification = $Classification
        confidence = $Confidence
        confidenceClassification = $ConfidenceClass
        operationalForInternalTesting = $Decision.internalBool
        operationalForInternalTestingLabel = $Decision.internal
        operationalForBeta = $Decision.betaBool
        operationalForBetaLabel = $Decision.beta
        realPaymentsReleased = $Decision.paymentsBool
        realPaymentsLabel = $Decision.payments
        productionReleased = $Decision.productionBool
        productionLabel = $Decision.production
        criticalCaps = @($script:CriticalCaps)
        categories = @($script:Categories)
        criticalFailures = @($script:CriticalFailures)
        highRisks = @($script:HighRisks)
        warnings = @($script:Warnings)
        blockedTests = @($script:BlockedTests)
        notTested = @($script:NotTested)
        topBlockers = @($topBlockers)
        topPriorities = @($topPriorities | Select-Object -First 5)
        smokeTests = @($script:SmokeResults)
        segments = @($Segments)
        logs = @(
            Get-RelativePath $script:MainLog
            if ($script:BuildResult) { $script:BuildResult.Log }
            if ($script:LintResult) { $script:LintResult.Log }
            if ($script:TypecheckResult) { $script:TypecheckResult.Log }
            if ($script:TestResult) { $script:TestResult.Log }
        ) | Where-Object { -not [string]::IsNullOrWhiteSpace([string]$_) }
    }

    $json = $jsonObject | ConvertTo-Json -Depth 10
    Write-Utf8NoBom -Path $script:JsonPath -Content $json

    $md = New-Object System.Text.StringBuilder
    [void]$md.AppendLine("# QA Operacional do Orcaly")
    [void]$md.AppendLine("")
    [void]$md.AppendLine("## Resumo executivo")
    [void]$md.AppendLine("")
    [void]$md.AppendLine(("- Nota: {0}/100" -f $Score))
    [void]$md.AppendLine(("- Nota antes dos limitadores: {0}/100" -f $ScoreBeforeCaps))
    [void]$md.AppendLine(("- Classificacao: {0}" -f $Classification))
    [void]$md.AppendLine(("- Confianca: {0}% ({1})" -f $Confidence, $ConfidenceClass))
    [void]$md.AppendLine(("- Operacional para teste interno: {0}" -f $Decision.internal))
    [void]$md.AppendLine(("- Operacional para beta: {0}" -f $Decision.beta))
    [void]$md.AppendLine(("- Pagamentos reais: {0}" -f $Decision.payments))
    [void]$md.AppendLine(("- Producao: {0}" -f $Decision.production))
    [void]$md.AppendLine("")

    [void]$md.AppendLine("## Limitadores aplicados")
    [void]$md.AppendLine("")
    if ($script:CriticalCaps.Count -eq 0) { [void]$md.AppendLine("- Nenhum limitador critico aplicado.") }
    else { foreach ($item in $script:CriticalCaps) { [void]$md.AppendLine(("- {0}" -f $item)) } }
    [void]$md.AppendLine("")

    [void]$md.AppendLine("## Pontuacao por categoria")
    [void]$md.AppendLine("")
    [void]$md.AppendLine("| Categoria | Peso | Pontos | Status |")
    [void]$md.AppendLine("|---|---:|---:|---|")
    foreach ($category in $script:Categories) {
        [void]$md.AppendLine(("| {0} | {1} | {2} | {3} |" -f $category.name, $category.weight, $category.points, $category.status))
    }
    [void]$md.AppendLine("")

    $sections = @(
        @("Falhas criticas", $script:CriticalFailures),
        @("Riscos altos", $script:HighRisks),
        @("Alertas", $script:Warnings),
        @("Itens bloqueados", $script:BlockedTests),
        @("Itens nao testados", $script:NotTested)
    )
    foreach ($section in $sections) {
        [void]$md.AppendLine(("## {0}" -f $section[0]))
        [void]$md.AppendLine("")
        $list = $section[1]
        if ($list.Count -eq 0) { [void]$md.AppendLine("- Nenhum.") }
        else { foreach ($item in $list) { [void]$md.AppendLine(("- {0}" -f $item)) } }
        [void]$md.AppendLine("")
    }

    [void]$md.AppendLine("## Evidencias")
    [void]$md.AppendLine("")
    foreach ($category in $script:Categories) {
        [void]$md.AppendLine(("### {0}" -f $category.name))
        foreach ($item in $category.evidence) { [void]$md.AppendLine(("- {0}" -f $item)) }
        [void]$md.AppendLine("")
    }

    $buildLabel = "NAO TESTADO"
    if ($script:BuildResult) { if ($script:BuildResult.Passed) { $buildLabel = "PASSOU" } else { $buildLabel = "FALHOU" } }
    $lintLabel = "NAO TESTADO"
    if ($script:LintResult) { if ($script:LintResult.Passed) { $lintLabel = "PASSOU" } else { $lintLabel = "FALHOU" } }
    $typeLabel = "NAO TESTADO"
    if ($script:TypecheckResult) { if ($script:TypecheckResult.Passed) { $typeLabel = "PASSOU" } else { $typeLabel = "FALHOU" } }
    $testLabel = "NAO TESTADO"
    if ($script:TestResult) { if ($script:TestResult.Passed) { $testLabel = "PASSOU" } else { $testLabel = "FALHOU" } }

    [void]$md.AppendLine("## Build")
    [void]$md.AppendLine("")
    [void]$md.AppendLine(("- Status: {0}" -f $buildLabel))
    if ($script:BuildResult) { [void]$md.AppendLine(("- Duracao: {0}s" -f $script:BuildResult.DurationSeconds)); [void]$md.AppendLine(("- Log: {0}" -f $script:BuildResult.Log)) }
    [void]$md.AppendLine("")
    [void]$md.AppendLine("## Lint")
    [void]$md.AppendLine("")
    [void]$md.AppendLine(("- Status: {0}" -f $lintLabel))
    if ($script:LintResult) { [void]$md.AppendLine(("- Log: {0}" -f $script:LintResult.Log)) }
    [void]$md.AppendLine("")
    [void]$md.AppendLine("## TypeScript")
    [void]$md.AppendLine("")
    [void]$md.AppendLine(("- Status: {0}" -f $typeLabel))
    [void]$md.AppendLine("")
    [void]$md.AppendLine("## Testes automatizados")
    [void]$md.AppendLine("")
    [void]$md.AppendLine(("- Status: {0}" -f $testLabel))
    [void]$md.AppendLine("")

    foreach ($heading in @("Seguranca multiempresa", "Autenticacao", "Rotas e menu", "Checkout Mercado Pago", "Webhook", "Assinatura e trial", "Cancelamento", "Food", "Configuracoes", "Funcionarios", "Subdominios", "Painel e UX", "Responsividade", "Site publico", "Favicon/Open Graph", "Financeiro")) {
        [void]$md.AppendLine(("## {0}" -f $heading))
        [void]$md.AppendLine("")
        [void]$md.AppendLine("Consulte a pontuacao, evidencias, riscos, itens bloqueados e checklist manual relacionados a esta area.")
        [void]$md.AppendLine("")
    }

    [void]$md.AppendLine("## Segmentos")
    [void]$md.AppendLine("")
    [void]$md.AppendLine("| Segmento | Status | Arquivos | Evidencias |")
    [void]$md.AppendLine("|---|---|---:|---:|")
    foreach ($segment in $Segments) {
        [void]$md.AppendLine(("| {0} | {1} | {2} | {3} |" -f $segment.name, $segment.status, $segment.files, $segment.evidenceCount))
    }
    [void]$md.AppendLine("")

    [void]$md.AppendLine("## Cinco bloqueadores principais")
    [void]$md.AppendLine("")
    if ($topBlockers.Count -eq 0) { [void]$md.AppendLine("- Nenhum bloqueador critico automatico; ainda execute o checklist manual.") }
    else { foreach ($item in $topBlockers) { [void]$md.AppendLine(("- {0}" -f $item)) } }
    [void]$md.AppendLine("")

    [void]$md.AppendLine("## Cinco correcoes prioritarias")
    [void]$md.AppendLine("")
    foreach ($item in ($topPriorities | Select-Object -First 5)) { [void]$md.AppendLine(("- {0}" -f $item)) }
    [void]$md.AppendLine("")

    [void]$md.AppendLine("## Recomendacao final")
    [void]$md.AppendLine("")
    [void]$md.AppendLine(("- OPERACIONAL PARA TESTE INTERNO: {0}" -f $Decision.internal))
    [void]$md.AppendLine(("- OPERACIONAL PARA BETA: {0}" -f $Decision.beta))
    [void]$md.AppendLine(("- PAGAMENTOS REAIS: {0}" -f $Decision.payments))
    [void]$md.AppendLine(("- PRODUCAO: {0}" -f $Decision.production))
    [void]$md.AppendLine("")
    [void]$md.AppendLine("A nota mede evidencias disponiveis. Itens bloqueados e baixa confianca impedem interpretar uma nota alta como liberacao automatica.")
    [void]$md.AppendLine("")

    [void]$md.AppendLine("## Arquivos de log")
    [void]$md.AppendLine("")
    [void]$md.AppendLine(("- {0}" -f (Get-RelativePath $script:RunDir)))
    [void]$md.AppendLine("")

    Write-Utf8NoBom -Path $script:MarkdownPath -Content $md.ToString()
    Write-Success "Relatorios Markdown e JSON gerados"
}

function Show-TerminalSummary {
    param(
        [double]$ScoreBeforeCaps,
        [double]$Score,
        [int]$Confidence,
        [string]$Classification,
        [pscustomobject]$Decision
    )

    function Get-CategoryStatus([string]$Name) {
        $category = $script:Categories | Where-Object { $_.name -eq $Name } | Select-Object -First 1
        if ($category) { return $category.status }
        return "NAO TESTADO"
    }

    $buildLabel = "NAO TESTADO"
    if ($script:BuildResult) { if ($script:BuildResult.Passed) { $buildLabel = "PASSOU" } else { $buildLabel = "FALHOU" } }
    $lintLabel = "NAO TESTADO"
    if ($script:LintResult) { if ($script:LintResult.Passed) { $lintLabel = "PASSOU" } else { $lintLabel = "FALHOU" } }

    Write-Host ""
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host "ORCALY - QA OPERACIONAL" -ForegroundColor Cyan
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host ""
    Write-Host ("Nota antes dos limitadores: {0}/100" -f $ScoreBeforeCaps)
    Write-Host ("Nota final: {0}/100" -f $Score)
    Write-Host ("Confianca da auditoria: {0}%" -f $Confidence)
    Write-Host ""
    Write-Host "Classificacao:"
    Write-Host $Classification -ForegroundColor Yellow
    Write-Host ""
    Write-Host ("Build: {0}" -f $buildLabel)
    Write-Host ("Lint: {0}" -f $lintLabel)
    Write-Host ("Seguranca multiempresa: {0}" -f (Get-CategoryStatus "Seguranca multiempresa"))
    Write-Host ("Rotas: {0}" -f (Get-CategoryStatus "Rotas e menu"))
    Write-Host ("Mercado Pago: {0}" -f (Get-CategoryStatus "Checkout e Mercado Pago"))
    Write-Host ("Assinatura: {0}" -f (Get-CategoryStatus "Assinatura, trial e cancelamento"))
    Write-Host ("Food: {0}" -f (Get-CategoryStatus "Food completo"))
    Write-Host ("Configuracoes: {0}" -f (Get-CategoryStatus "Configuracoes e equipe"))
    Write-Host ("Site publico: {0}" -f (Get-CategoryStatus "Site, cupom, favicon e Open Graph"))
    Write-Host ("Painel e UX: {0}" -f (Get-CategoryStatus "Painel, UX e responsividade"))
    Write-Host ""
    Write-Host "Operacional para teste interno:"
    Write-Host $Decision.internal
    Write-Host ""
    Write-Host "Operacional para beta:"
    Write-Host $Decision.beta
    Write-Host ""
    Write-Host "Pagamentos reais:"
    Write-Host $Decision.payments
    Write-Host ""
    Write-Host "Producao:"
    Write-Host $Decision.production
    Write-Host ""
    Write-Host ("Bloqueadores criticos: {0}" -f $script:CriticalFailures.Count)
    Write-Host ("Riscos altos: {0}" -f $script:HighRisks.Count)
    Write-Host ("Alertas: {0}" -f $script:Warnings.Count)
    Write-Host ("Testes bloqueados: {0}" -f $script:BlockedTests.Count)
    Write-Host ("Testes nao realizados: {0}" -f $script:NotTested.Count)
    Write-Host ""
    Write-Host "Relatorio:"
    Write-Host "RELATORIO-QA-OPERACIONAL-ORCALY.md"
    Write-Host ""
    Write-Host "JSON:"
    Write-Host "RELATORIO-QA-OPERACIONAL-ORCALY.json"
    Write-Host ""
    Write-Host "Checklist manual:"
    Write-Host "CHECKLIST-QA-MANUAL-ORCALY.md"
    Write-Host ""
    Write-Host "Logs:"
    Write-Host (Get-RelativePath $script:RunDir)
    Write-Host ""

    $phrase = [System.Text.Encoding]::UTF8.GetString([System.Convert]::FromBase64String("TyBRQSBkbyBPcsOnYWx5IGZvaSBjb25jbHXDrWRvIGNvbSBwb250dWHDp8OjbyBiYXNlYWRhIGVtIGV2aWTDqm5jaWFzLCBsaW1pdGFkb3JlcyBjcsOtdGljb3MgZSBkaXN0aW7Dp8OjbyBjbGFyYSBlbnRyZSBzaXN0ZW1hIHZpc3VhbG1lbnRlIGNvbXBsZXRvIGUgc2lzdGVtYSByZWFsbWVudGUgb3BlcmFjaW9uYWwu"))
    Write-Host $phrase -ForegroundColor Green
}

try {
    New-Item -ItemType Directory -Path $script:RunDir -Force | Out-Null
    New-Item -ItemType File -Path $script:MainLog -Force | Out-Null

    Test-SelfSyntax
    Test-ProjectRoot
    $script:InitialGitState = Get-GitState
    Get-SafeProjectFiles
    $scripts = Get-PackageScripts

    if (-not $SkipBuild) {
        if ($scripts.ContainsKey("build")) {
            $script:BuildResult = Invoke-NpmScript -Name "build" -Arguments @("run", "build") -LogName "build.log"
            if (-not $script:BuildResult.Passed) { Add-CriticalFailure "Build falhou." }
        }
        else {
            Add-NotTested "package.json nao possui script build."
            Add-Cap "Build nao executado: nota maxima 59."
        }
    }
    else {
        Add-NotTested "Build ignorado por parametro."
        Add-Cap "Build nao executado: nota maxima 59."
    }

    if (-not $SkipLint) {
        if ($scripts.ContainsKey("lint")) {
            $script:LintResult = Invoke-NpmScript -Name "lint" -Arguments @("run", "lint") -LogName "lint.log"
            if (-not $script:LintResult.Passed) { Add-WarningItem "Lint falhou; comparar erros com o baseline conhecido." }
        }
        else { Add-NotTested "package.json nao possui script lint." }
    }
    else { Add-NotTested "Lint ignorado por parametro." }

    if (-not $SkipTypecheck) {
        if ($scripts.ContainsKey("typecheck")) {
            $script:TypecheckResult = Invoke-NpmScript -Name "typecheck" -Arguments @("run", "typecheck") -LogName "typecheck.log"
        }
        else { Add-NotTested "package.json nao possui script typecheck separado." }
    }
    else { Add-NotTested "Typecheck ignorado por parametro." }

    if (-not $SkipTests) {
        if ($scripts.ContainsKey("test")) {
            $script:TestResult = Invoke-NpmScript -Name "test" -Arguments @("run", "test", "--", "--runInBand") -LogName "tests.log"
            if (-not $script:TestResult.Passed) {
                Write-Warning "Teste com --runInBand falhou; executando exatamente o script test como fallback."
                $script:TestResult = Invoke-NpmScript -Name "test" -Arguments @("run", "test") -LogName "tests-fallback.log"
            }
        }
        else { Add-NotTested "package.json nao possui script test." }
    }
    else { Add-NotTested "Testes automatizados ignorados por parametro." }

    Invoke-SmokeTest -Scripts $scripts

    Write-Step "Executando auditoria estatica e pontuacao"
    Audit-BuildQuality
    Audit-MultiCompanySecurity
    Audit-Authentication
    Audit-RoutesAndMenu
    Audit-MercadoPago
    Audit-Subscription
    Audit-Food
    Audit-SettingsTeam
    Audit-PanelUx
    Audit-SiteMetadata
    Audit-FinanceOperation
    $script:StaticAuditCompleted = $true

    $weightSum = [math]::Round((($script:Categories | Measure-Object -Property weight -Sum).Sum), 2)
    if ($weightSum -ne 100) { throw "A soma dos pesos nao e 100. Soma encontrada: $weightSum" }

    $scoreBeforeCaps = [math]::Round((($script:Categories | Measure-Object -Property points -Sum).Sum), 2)
    $score = Apply-CriticalCaps -ScoreBeforeCaps $scoreBeforeCaps
    $confidence = Get-Confidence
    $confidenceClass = Get-ConfidenceClass -Confidence $confidence
    $classification = Get-Classification -Score $score
    $decision = Get-ReleaseDecision -Score $score -Confidence $confidence
    $segments = Get-SegmentSummary

    $script:FinalGitState = Get-GitState
    $newGitChanges = @($script:FinalGitState | Where-Object { $script:InitialGitState -notcontains $_ })
    if ($newGitChanges.Count -gt 0) {
        Add-CriticalFailure ("O QA detectou novas alteracoes no estado Git durante a execucao: {0}" -f ($newGitChanges -join ", "))
        Add-Cap "Script/build alterou estado rastreado do projeto: nota maxima 49."
        $score = Apply-CriticalCaps -ScoreBeforeCaps $scoreBeforeCaps
        $classification = Get-Classification -Score $score
        $decision = Get-ReleaseDecision -Score $score -Confidence $confidence
    }

    New-ManualChecklist
    New-Reports -ScoreBeforeCaps $scoreBeforeCaps -Score $score -Confidence $confidence -ConfidenceClass $confidenceClass -Classification $classification -Decision $decision -Segments $segments
    Show-TerminalSummary -ScoreBeforeCaps $scoreBeforeCaps -Score $score -Confidence $confidence -Classification $classification -Decision $decision
}
catch {
    Write-Failure $_.Exception.Message
    Add-CriticalFailure $_.Exception.Message
    try {
        $emergency = [ordered]@{
            project = "Orcaly"
            generatedAt = (Get-Date).ToString("o")
            score = 0
            scoreBeforeCaps = 0
            classification = "QA INTERROMPIDO"
            confidence = 0
            operationalForInternalTesting = $false
            operationalForBeta = $false
            realPaymentsReleased = $false
            productionReleased = $false
            criticalCaps = @("Falha durante a execucao do QA.")
            categories = @($script:Categories)
            criticalFailures = @($script:CriticalFailures)
            highRisks = @($script:HighRisks)
            warnings = @($script:Warnings)
            blockedTests = @($script:BlockedTests)
            notTested = @($script:NotTested)
            topBlockers = @($script:CriticalFailures | Select-Object -First 5)
            topPriorities = @("Corrigir a falha registrada no log e executar novamente.")
            logs = @((Get-RelativePath $script:MainLog))
        }
        Write-Utf8NoBom -Path $script:JsonPath -Content ($emergency | ConvertTo-Json -Depth 8)
    }
    catch { }
    Write-Host "QA interrompido. Consulte: $script:MainLog" -ForegroundColor Red
}
finally {
    Stop-LocalServer
}
