param(
    [switch]$ApplySupabase,
    [switch]$Commit,
    [switch]$Push,
    [string]$CommitMessage = "Hardening completo de seguranca do Orcaly"
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function Write-Step([string]$Message) {
    Write-Host ""
    Write-Host "==> $Message" -ForegroundColor Cyan
}

function Require-Command([string[]]$Candidates) {
    foreach ($Candidate in $Candidates) {
        $Command = Get-Command $Candidate -ErrorAction SilentlyContinue
        if ($Command) { return $Command.Source }
    }

    throw "Comando obrigatorio nao encontrado: $($Candidates -join ', ')"
}

function Invoke-Checked(
    [string]$FilePath,
    [Parameter(ValueFromRemainingArguments = $true)]
    [string[]]$Arguments
) {
    & $FilePath @Arguments
    if ($LASTEXITCODE -ne 0) {
        throw "Comando falhou ($LASTEXITCODE): $FilePath $($Arguments -join ' ')"
    }
}

function Test-ArtifactPath([string]$Path) {
    if ($Path -match '^[^/]+\.ps1$') { return $true }
    if ($Path -match '^\.orcaly-') { return $true }
    if ($Path -match '^qa-orcaly-') { return $true }
    if ($Path -match '^qa-.*\.txt$') { return $true }
    if ($Path -match '^auditoria-.*\.(txt|json|log)$') { return $true }
    if ($Path -match '^resultado-.*\.(txt|json|log)$') { return $true }
    if ($Path -match '^erro-.*\.log$') { return $true }
    if ($Path -eq 'orcaly-payment-flows-phase1.zip') { return $true }
    if ($Path -eq 'orcaly-payment-flows-phase1.mjs') { return $true }
    if ($Path -match '^orcaly-payment-flows-phase1/') { return $true }
    return $false
}

function Test-PlaceholderValue([string]$Value) {
    if (-not $Value) { return $true }

    $Upper = $Value.ToUpperInvariant()

    $PlaceholderWords = @(
        "YOUR",
        "EXAMPLE",
        "PLACEHOLDER",
        "CHANGEME",
        "CHANGE_ME",
        "REPLACE",
        "DUMMY",
        "FAKE",
        "INSERT",
        "PREENCHA",
        "COLE_",
        "COLE-",
        "XXX",
        "__"
    )

    foreach ($Word in $PlaceholderWords) {
        if ($Upper.Contains($Word)) { return $true }
    }

    if (
        $Value.Contains("<") -or
        $Value.Contains(">") -or
        $Value.Contains('${') -or
        $Value.Contains('$env:') -or
        $Value.Contains('process.env')
    ) {
        return $true
    }

    return $false
}

function Get-SecretKind([string]$Line) {
    if (-not $Line) { return $null }

    # Mercado Pago public keys may also use APP_USR-like prefixes.
    # Never classify a line explicitly describing a PUBLIC_KEY as a secret.
    if (
        $Line -notmatch '(?i)PUBLIC_KEY' -and
        $Line -match 'APP_USR-[A-Za-z0-9_-]{20,}'
    ) {
        return "mercado_pago_token"
    }

    if ($Line -match 'sk-proj-[A-Za-z0-9_-]{20,}') {
        return "openai_project_key"
    }

    if ($Line -match 'github_pat_[A-Za-z0-9_]{20,}') {
        return "github_pat"
    }

    if ($Line -match 'ghp_[A-Za-z0-9]{30,}') {
        return "github_token"
    }

    if ($Line -match 'sk_live_[A-Za-z0-9]{20,}') {
        return "stripe_live_key"
    }

    if ($Line -match 'AKIA[0-9A-Z]{16}') {
        return "aws_access_key"
    }

    # IMPORTANT: horizontal whitespace only. Using \s here would cross
    # line breaks when scanning a whole file and turn KEY=<empty> plus
    # the next variable name into a fake credential.
    $AssignmentPattern = '(?i)(?:^|[+-])[ \t]*[\x22\x27]?(?<name>SUPABASE_SERVICE_ROLE_KEY|PAYMENT_CREDENTIALS_ENCRYPTION_KEY|MP_[A-Z0-9_]*(?:ACCESS_TOKEN|CLIENT_SECRET|WEBHOOK_SECRET)|ASAAS_[A-Z0-9_]*(?:API_KEY|AUTH_TOKEN)|OPENAI_API_KEY|AI_GATEWAY_API_KEY|CRON_SECRET)[\x22\x27]?[ \t]*[:=][ \t]*[\x22\x27]?(?<value>[A-Za-z0-9._~+\/=-]{16,})'

    $Match = [regex]::Match($Line, $AssignmentPattern)
    if ($Match.Success) {
        $Value = $Match.Groups["value"].Value
        if (-not (Test-PlaceholderValue $Value)) {
            return "env_secret_assignment:$($Match.Groups['name'].Value)"
        }
    }

    return $null
}

$script:RepairedMojibakeFiles = @()

function Repair-MojibakeTrackedFiles([string]$Git) {
    Write-Step "Reparando apenas sequencias reais de mojibake em arquivos rastreados"

    $Extensions = @(
        ".ts", ".tsx", ".js", ".mjs", ".cjs",
        ".json", ".sql", ".md", ".css"
    )

    $Markers = @(
        (-join @([char]0x00C3, [char]0x00A7)),
        (-join @([char]0x00C3, [char]0x00A3)),
        (-join @([char]0x00C3, [char]0x00B5)),
        (-join @([char]0x00C3, [char]0x00A9)),
        (-join @([char]0x00C3, [char]0x00AA)),
        (-join @([char]0x00C3, [char]0x00A1)),
        (-join @([char]0x00C3, [char]0x00ED)),
        (-join @([char]0x00C3, [char]0x00AD)),
        (-join @([char]0x00C3, [char]0x00B3)),
        (-join @([char]0x00C3, [char]0x00BA)),
        (-join @([char]0x00C2, [char]0x00B7)),
        (-join @([char]0x00C2, [char]0x00BA)),
        (-join @([char]0x00C2, [char]0x00AA)),
        (-join @([char]0x00E2, [char]0x0153, [char]0x201C)),
        (-join @([char]0x00E2, [char]0x2020, [char]0x2019)),
        (-join @([char]0x00E2, [char]0x20AC, [char]0x0153)),
        (-join @([char]0x00E2, [char]0x20AC))
    )

    $Cp1252 = [System.Text.Encoding]::GetEncoding(1252)
    $Utf8 = New-Object System.Text.UTF8Encoding($false, $true)
    $WriteEncoding = New-Object System.Text.UTF8Encoding($false)

    $Tracked = @(& $Git ls-files)

    foreach ($Relative in $Tracked) {
        $Ext = [System.IO.Path]::GetExtension($Relative).ToLowerInvariant()
        if ($Extensions -notcontains $Ext) { continue }
        if (-not (Test-Path -LiteralPath $Relative)) { continue }

        $Lines = [System.IO.File]::ReadAllLines(
            (Resolve-Path -LiteralPath $Relative)
        )
        $Changed = $false

        for ($i = 0; $i -lt $Lines.Length; $i++) {
            $Line = $Lines[$i]
            $HasMarker = $false

            foreach ($Marker in $Markers) {
                if ($Line.Contains($Marker)) {
                    $HasMarker = $true
                    break
                }
            }

            if (-not $HasMarker) { continue }

            $Current = $Line

            for ($Pass = 0; $Pass -lt 3; $Pass++) {
                $StillBad = $false

                foreach ($Marker in $Markers) {
                    if ($Current.Contains($Marker)) {
                        $StillBad = $true
                        break
                    }
                }

                if (-not $StillBad) { break }

                try {
                    $Bytes = $Cp1252.GetBytes($Current)
                    $Candidate = $Utf8.GetString($Bytes)
                }
                catch {
                    break
                }

                if (
                    $Candidate.Contains([char]0xFFFD) -or
                    $Candidate -eq $Current
                ) {
                    break
                }

                $Current = $Candidate
            }

            if ($Current -ne $Line) {
                $Lines[$i] = $Current
                $Changed = $true
            }
        }

        if ($Changed) {
            [System.IO.File]::WriteAllLines(
                (Resolve-Path -LiteralPath $Relative),
                $Lines,
                $WriteEncoding
            )
            $script:RepairedMojibakeFiles += $Relative
            Write-Host "[UTF8] $Relative"
        }
    }
}

function Fix-SecurityScannerSelfInspection([string]$RepoRoot) {
    Write-Step "Corrigindo autoinspecao do scanner de seguranca"

    $Relative = "scripts/security-check.mjs"
    $Path = Join-Path $RepoRoot $Relative

    if (-not (Test-Path -LiteralPath $Path)) {
        throw "Scanner nao encontrado: $Relative"
    }

    $Content = [System.IO.File]::ReadAllText($Path)

    $Replacement = @'
const mojibakeMarkers = [
  '\u00C3\u00A7',
  '\u00C3\u00A3',
  '\u00C3\u00B5',
  '\u00C3\u00A9',
  '\u00C3\u00AA',
  '\u00C3\u00A1',
  '\u00C3\u00ED',
  '\u00C3\u00AD',
  '\u00C3\u00B3',
  '\u00C3\u00BA',
  '\u00C2\u00B7',
  '\u00C2\u00BA',
  '\u00C2\u00AA',
  '\u00E2\u0153\u201C',
  '\u00E2\u2020\u2019',
  '\u00E2\u20AC\u0153',
  '\u00E2\u20AC',
]

for (const file of tracked) {
'@

    $Pattern = 'const mojibakeMarkers = \[[\s\S]*?\]\r?\n\r?\nfor \(const file of tracked\) \{'
    $Matches = [regex]::Matches($Content, $Pattern)

    if ($Matches.Count -eq 1) {
        $Updated = [regex]::Replace($Content, $Pattern, $Replacement, 1)

        [System.IO.File]::WriteAllText(
            $Path,
            $Updated,
            (New-Object System.Text.UTF8Encoding($false))
        )

        Write-Host "[OK] scanner usa escapes Unicode ASCII"
        return
    }

    if (
        $Content.Contains("'\u00C3\u00A7'") -and
        $Content.Contains("for (const file of tracked) {")
    ) {
        Write-Host "[OK] scanner ja estava corrigido"
        return
    }

    throw "Nao foi possivel localizar de forma unica a lista de mojibake do scanner."
}

$Git = Require-Command @("git.exe", "git")
$Node = Require-Command @("node.exe", "node")
$Npm = Require-Command @("npm.cmd", "npm")
$Npx = Require-Command @("npx.cmd", "npx")

$RepoRoot = (& $Git rev-parse --show-toplevel).Trim()

if (-not $RepoRoot) {
    throw "Nao foi possivel localizar o repositorio Git."
}

Set-Location $RepoRoot

$ExpectedBranch = "agent/hardening-orcaly-2026-08-08"
$CurrentBranch = (& $Git branch --show-current).Trim()

if ($CurrentBranch -ne $ExpectedBranch) {
    throw "Branch incorreta. Esperado: $ExpectedBranch. Atual: $CurrentBranch"
}

if ($Push -and -not $Commit) {
    throw "-Push exige -Commit."
}

if ($Push -and -not $ApplySupabase) {
    throw "Por seguranca, -Push exige -ApplySupabase."
}

$ReportDir = Join-Path $RepoRoot ".orcaly-hardening-local"
New-Item -ItemType Directory -Force -Path $ReportDir | Out-Null

$Stamp = Get-Date -Format "yyyyMMdd-HHmmss"
$TranscriptPath = Join-Path $ReportDir "hardening-continuacao-$Stamp.txt"

Start-Transcript -Path $TranscriptPath -Force | Out-Null

try {
    Write-Step "Validando estado deixado pelo hardening V3"

    $RequiredFiles = @(
        "lib/affiliates/academy-catalog.ts",
        "lib/br-document.ts",
        "scripts/security-check.mjs"
    )

    foreach ($File in $RequiredFiles) {
        if (-not (Test-Path -LiteralPath $File)) {
            throw "Arquivo esperado do V3 nao encontrado: $File"
        }
    }

    $Migration = Get-ChildItem `
        -LiteralPath (Join-Path $RepoRoot "supabase\migrations") `
        -Filter "*_affiliate_workspace_server_authority.sql" |
        Sort-Object LastWriteTime |
        Select-Object -Last 1

    if (-not $Migration) {
        throw "Migration de hardening criada pelo V3 nao foi encontrada."
    }

    $MigrationRelative = $Migration.FullName.Substring($RepoRoot.Length)
    $MigrationRelative = $MigrationRelative.TrimStart(
        [System.IO.Path]::DirectorySeparatorChar,
        [System.IO.Path]::AltDirectorySeparatorChar
    )
    $MigrationRelative = $MigrationRelative.Replace('\','/')

    $Changed = @(& $Git diff --name-only)
    $RequiredChanged = @(
        "proxy.ts",
        "lib/subscription-service.ts",
        "app/api/leads/complete-account/route.ts",
        "lib/affiliates/workspace.ts"
    )

    foreach ($File in $RequiredChanged) {
        if ($Changed -notcontains $File) {
            throw "O patch V3 nao parece estar aplicado em: $File"
        }
    }

    Write-Host "Branch: $CurrentBranch"
    Write-Host "Migration: $MigrationRelative"
    Write-Host "Arquivos modificados no working tree: $($Changed.Count)"
    Write-Host "ORCALY_V3_STATE_OK=1" -ForegroundColor Green

    Fix-SecurityScannerSelfInspection $RepoRoot

    Write-Step "Desversionando artefatos temporarios antes do scan atual"

    $ArtifactPaths = @(
        & $Git ls-files |
        Where-Object { Test-ArtifactPath $_ }
    )

    foreach ($Artifact in $ArtifactPaths) {
        & $Git rm --cached --ignore-unmatch -- "$Artifact" | Out-Null

        if ($LASTEXITCODE -ne 0) {
            throw "Falha ao remover artefato do indice: $Artifact"
        }

        Write-Host "[UNTRACK] $Artifact"
    }

    Write-Host "Artefatos desversionados: $($ArtifactPaths.Count)"

    Write-Step "Scanner de credenciais corrigido - arquivos atualmente rastreados"

    $CurrentSecretFindings = New-Object System.Collections.Generic.List[string]

    foreach ($TrackedFile in @(& $Git ls-files)) {
        $TrackedPath = Join-Path $RepoRoot $TrackedFile

        if (-not (Test-Path -LiteralPath $TrackedPath -PathType Leaf)) {
            continue
        }

        try {
            $Info = Get-Item -LiteralPath $TrackedPath
            if ($Info.Length -gt 8MB) { continue }

            $Lines = [System.IO.File]::ReadAllLines($TrackedPath)
        }
        catch {
            continue
        }

        for ($Index = 0; $Index -lt $Lines.Length; $Index++) {
            $Kind = Get-SecretKind $Lines[$Index]

            if ($Kind) {
                $CurrentSecretFindings.Add(
                    "$TrackedFile :: line $($Index + 1) :: $Kind"
                )
            }
        }
    }

    if ($CurrentSecretFindings.Count -gt 0) {
        Write-Host ""
        Write-Host "Possiveis segredos reais no conteudo atual:" -ForegroundColor Red

        foreach ($Finding in $CurrentSecretFindings) {
            Write-Host "[SECRET-CURRENT] $Finding" -ForegroundColor Red
        }

        Write-Host "Nenhum valor foi impresso." -ForegroundColor Yellow
        throw "Credencial possivelmente real encontrada no conteudo atual."
    }

    Write-Host "CURRENT_SECRET_SCAN_OK=1" -ForegroundColor Green

    Write-Step "Scanner de credenciais corrigido - historico Git"

    $HistoryFindings = New-Object System.Collections.Generic.List[string]
    $HistorySeen = New-Object System.Collections.Generic.HashSet[string]
    $HistoryCommit = "unknown"

    & $Git log `
        -p `
        --all `
        --no-ext-diff `
        --pretty=format:"@@ORCALY_COMMIT:%H%n" `
        2>$null |
    ForEach-Object {
        $Line = [string]$_

        if ($Line.StartsWith("@@ORCALY_COMMIT:")) {
            $HistoryCommit = $Line.Substring("@@ORCALY_COMMIT:".Length).Trim()
            return
        }

        $Kind = Get-SecretKind $Line

        if ($Kind) {
            $Key = "$HistoryCommit::$Kind"

            if ($HistorySeen.Add($Key)) {
                $HistoryFindings.Add(
                    "commit $HistoryCommit :: $Kind"
                )
            }
        }
    }

    if ($LASTEXITCODE -ne 0) {
        throw "Falha ao auditar o historico Git."
    }

    if ($HistoryFindings.Count -gt 0) {
        Write-Host ""
        Write-Host "Possiveis credenciais reais no historico:" -ForegroundColor Red

        foreach ($Finding in $HistoryFindings) {
            Write-Host "[SECRET-HISTORY] $Finding" -ForegroundColor Red
        }

        Write-Host "Nenhum valor foi impresso." -ForegroundColor Yellow
        throw "O historico Git possui possivel credencial real. Rotacao e saneamento sao obrigatorios antes de push."
    }

    Write-Host "GIT_SECRET_HISTORY_SCAN_OK=1" -ForegroundColor Green

    Repair-MojibakeTrackedFiles $Git

    Write-Host "Arquivos UTF-8 reparados: $($script:RepairedMojibakeFiles.Count)"

    Write-Step "Validando sintaxe do scanner de seguranca"
    & $Node --check scripts/security-check.mjs
    if ($LASTEXITCODE -ne 0) {
        throw "node --check falhou em scripts/security-check.mjs"
    }

    Write-Step "Varredura estatica de seguranca em todos os arquivos rastreados"
    Invoke-Checked $Node scripts/security-check.mjs

    Write-Step "ESLint completo"
    Invoke-Checked $Npm run lint

    Write-Step "TypeScript noEmit"
    Invoke-Checked $Npx tsc --noEmit

    Write-Step "Verificacao de fronteiras de pagamentos"
    Invoke-Checked $Npm run verify:payments

    Write-Step "Verificacao de isolamento de credenciais"
    Invoke-Checked $Npm run verify:payment-credentials

    Write-Step "Auditoria de dependencias de producao"
    & $Npm audit --omit=dev --audit-level=high

    if ($LASTEXITCODE -ne 0) {
        throw "npm audit encontrou vulnerabilidade high/critical ou nao conseguiu concluir."
    }

    Write-Step "Build de producao"
    Invoke-Checked $Npm run build

    Write-Step "Verificando whitespace e conflitos de diff"
    Invoke-Checked $Git diff --check

    Write-Step "Auditoria local de policies/migrations relacionadas a dados sensiveis"

    $SensitiveTerms = @(
        "financial_transactions",
        "proposals",
        "proposals_dashboard",
        "company_members",
        "storage.objects",
        "affiliate_activity_events",
        "affiliate_certifications"
    )

    $PolicyAuditPath = Join-Path $ReportDir "policy-audit-$Stamp.txt"
    $AuditLines = New-Object System.Collections.Generic.List[string]

    foreach (
        $SqlFile in Get-ChildItem `
            -LiteralPath (Join-Path $RepoRoot "supabase\migrations") `
            -Filter "*.sql" |
        Sort-Object Name
    ) {
        $Text = [System.IO.File]::ReadAllText($SqlFile.FullName)

        foreach ($Term in $SensitiveTerms) {
            if (
                $Text.IndexOf(
                    $Term,
                    [System.StringComparison]::OrdinalIgnoreCase
                ) -ge 0
            ) {
                $AuditLines.Add("$($SqlFile.Name) :: $Term")
            }
        }
    }

    [System.IO.File]::WriteAllLines(
        $PolicyAuditPath,
        $AuditLines,
        (New-Object System.Text.UTF8Encoding($false))
    )

    Write-Host "Policy audit local: $PolicyAuditPath"

    Write-Step "Supabase dry-run quando o CLI estiver vinculado"

    $DryRunOk = $false
    $PushHelp = (& $Npx supabase db push --help 2>&1 | Out-String)

    if ($LASTEXITCODE -ne 0) {
        throw "Nao foi possivel consultar supabase db push --help."
    }

    if ($PushHelp -match "--dry-run") {
        & $Npx supabase db push --dry-run

        if ($LASTEXITCODE -eq 0) {
            $DryRunOk = $true
            Write-Host "ORCALY_SUPABASE_DRY_RUN_OK=1" -ForegroundColor Green
        }
        else {
            if ($ApplySupabase) {
                throw "Supabase dry-run falhou. Migration NAO sera aplicada."
            }

            Write-Warning "Supabase dry-run nao concluiu. O banco nao foi alterado."
        }
    }
    else {
        Write-Warning "A versao local do Supabase CLI nao anuncia --dry-run."

        if ($ApplySupabase) {
            throw "-ApplySupabase exige suporte a --dry-run."
        }
    }

    if ($ApplySupabase) {
        if (-not $DryRunOk) {
            throw "Migration nao sera aplicada sem dry-run bem sucedido."
        }

        Write-Step "Aplicando migrations pendentes no projeto Supabase vinculado"

        $PushArgs = @("supabase", "db", "push")

        if ($PushHelp -match "--yes") {
            $PushArgs += "--yes"
        }

        & $Npx @PushArgs

        if ($LASTEXITCODE -ne 0) {
            throw "Supabase db push falhou. Codigo NAO sera enviado ao GitHub."
        }

        Write-Host "ORCALY_SUPABASE_APPLIED=1" -ForegroundColor Green
    }

    Write-Step "Staging explicito, sem git add -A"

    $StageFiles = @(
        ".gitignore",
        ".env.example",
        "proxy.ts",
        "lib/br-document.ts",
        "lib/company-access.ts",
        "app/api/company/current/route.ts",
        "lib/panel-modules.ts",
        "components/painel/PanelSidebar.tsx",
        "components/painel/PanelPremiumShell.tsx",
        "app/painel/layout.tsx",
        "components/parceiros/PartnerCoursesTab.tsx",
        "lib/affiliates/academy-catalog.ts",
        "lib/affiliates/workspace.ts",
        "components/parceiros/PartnerGrowthHub.tsx",
        "lib/affiliates/server.ts",
        "app/api/parceiros/route.ts",
        "app/api/parceiros/workspace/route.ts",
        "app/api/parceiros/register/route.ts",
        "app/api/parceiros/track/route.ts",
        "app/api/crm/leads/route.ts",
        "app/api/crm/leads/[id]/route.ts",
        "app/api/checkout/lead/route.ts",
        "app/api/leads/complete-account/route.ts",
        "components/checkout/SignupCheckout.tsx",
        "app/api/checkout/signup/pix/route.ts",
        "app/api/checkout/signup/card/route.ts",
        "app/api/checkout/signup/route.ts",
        "app/api/checkout/signup/status/route.ts",
        "lib/slug.ts",
        "lib/orcaly-security.ts",
        "lib/payments/server-context.ts",
        "app/api/public-site/[slug]/route.ts",
        "app/api/public/uploads/art/route.ts",
        "lib/panel-storage.ts",
        "lib/security/request.ts",
        "app/api/public/home-chat/route.ts",
        "app/api/ai/business-assistant/route.ts",
        "app/api/ai/orcamento/route.ts",
        "app/api/marketplace/coupon/route.ts",
        "app/api/marketplace/payments/settings/route.ts",
        "app/api/marketplace/payments/sales/route.ts",
        "app/api/marketplace/payments/mercado-pago/callback/route.ts",
        "app/api/marketplace/payments/mercado-pago/connect/route.ts",
        "app/api/marketplace/payments/webhook/mercado-pago/route.ts",
        "app/api/mercado-pago/webhook/route.ts",
        "app/api/assinatura/checkout/webhook/route.ts",
        "lib/subscription-checkout-payment.ts",
        "components/subscription/MercadoPagoSubscriptionCheckout.tsx",
        "lib/subscription-mercado-pago-transparent.ts",
        "app/api/company/subscription/route.ts",
        "app/api/mercado-pago/webhook-leads/route.ts",
        "app/api/webhooks/asaas/route.ts",
        "lib/subscription-service.ts",
        "lib/platform-admin.ts",
        "app/api/admin/scan/route.ts",
        "app/api/admin/team/route.ts",
        "app/api/admin/affiliates/route.ts",
        "app/api/admin/change-password/route.ts",
        "app/api/system/health/route.ts",
        "scripts/security-check.mjs",
        $MigrationRelative
    )

    foreach ($StageFile in $StageFiles) {
        if (Test-Path -LiteralPath $StageFile) {
            & $Git add -- "$StageFile"

            if ($LASTEXITCODE -ne 0) {
                throw "git add falhou: $StageFile"
            }
        }
    }

    foreach ($RepairedFile in $script:RepairedMojibakeFiles) {
        if (Test-Path -LiteralPath $RepairedFile) {
            & $Git add -- "$RepairedFile"

            if ($LASTEXITCODE -ne 0) {
                throw "git add falhou no reparo UTF-8: $RepairedFile"
            }
        }
    }

    Invoke-Checked $Git diff --cached --check

    Write-Step "Verificando se o staging contem apenas hardening e remocoes de artefatos"

    $Allowed = New-Object 'System.Collections.Generic.HashSet[string]'

    foreach ($File in $StageFiles) {
        [void]$Allowed.Add($File)
    }

    foreach ($File in $script:RepairedMojibakeFiles) {
        [void]$Allowed.Add($File)
    }

    $UnexpectedStaged = @()

    foreach ($File in @(& $Git diff --cached --name-only)) {
        if (
            -not $Allowed.Contains($File) -and
            -not (Test-ArtifactPath $File)
        ) {
            $UnexpectedStaged += $File
        }
    }

    if ($UnexpectedStaged.Count -gt 0) {
        Write-Host "Arquivos inesperados no staging:" -ForegroundColor Red
        $UnexpectedStaged | ForEach-Object {
            Write-Host " - $_" -ForegroundColor Red
        }

        throw "Staging contem arquivos fora do hardening."
    }

    Write-Step "Resumo do diff"
    & $Git status --short
    & $Git diff --cached --stat

    $Head = (& $Git rev-parse HEAD).Trim()

    $Summary = [ordered]@{
        ok = $true
        timestamp = (Get-Date).ToString("o")
        branch = $CurrentBranch
        head_before_commit = $Head
        migration = $MigrationRelative
        artifact_untracks = $ArtifactPaths.Count
        supabase_dry_run = $DryRunOk
        supabase_applied = [bool]$ApplySupabase
        committed = $false
        pushed = $false
        transcript = $TranscriptPath
        policy_audit = $PolicyAuditPath
    }

    if ($Commit) {
        Write-Step "Commit"

        & $Git diff --cached --quiet
        $HasStaged = $LASTEXITCODE -ne 0

        if ($HasStaged) {
            Invoke-Checked $Git commit -m $CommitMessage
            $Summary.committed = $true
            Write-Host "ORCALY_COMMIT_OK=1" -ForegroundColor Green
        }
        else {
            Write-Host "Nenhuma alteracao staged para commit."
        }
    }

    if ($Push) {
        Write-Step "Push da branch de hardening"
        Invoke-Checked $Git push -u origin $CurrentBranch
        $Summary.pushed = $true
        Write-Host "ORCALY_PUSH_OK=1" -ForegroundColor Green
    }

    $SummaryPath = Join-Path $ReportDir "hardening-summary-$Stamp.json"

    $Summary |
        ConvertTo-Json -Depth 6 |
        Set-Content -LiteralPath $SummaryPath -Encoding UTF8

    Write-Host ""
    Write-Host "CURRENT_SECRET_SCAN_OK=1" -ForegroundColor Green
    Write-Host "GIT_SECRET_HISTORY_SCAN_OK=1" -ForegroundColor Green
    Write-Host "SECURITY_CHECK_EXIT_CODE=0" -ForegroundColor Green
    Write-Host "ORCALY_HARDENING_CODE_OK=1" -ForegroundColor Green
    Write-Host "HARDENING_BRANCH=$CurrentBranch"
    Write-Host "HARDENING_MIGRATION=$MigrationRelative"
    Write-Host "HARDENING_REPORT=$TranscriptPath"
    Write-Host "HARDENING_SUMMARY=$SummaryPath"
    Write-Host "ORCALY_HARDENING_READY=1" -ForegroundColor Green
}
catch {
    Write-Host ""
    Write-Host "ORCALY_HARDENING_CONTINUATION_FAILED=1" -ForegroundColor Red
    Write-Host $_.Exception.Message -ForegroundColor Red

    try {
        & $Git status --short
    }
    catch {}

    throw
}
finally {
    try {
        Stop-Transcript | Out-Null
    }
    catch {}
}
