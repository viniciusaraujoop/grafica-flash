param(
    [switch]$Push = $true
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

$Root = "C:\Users\arauj\grafica-flash"
Set-Location -LiteralPath $Root

function Step([string]$Message) {
    Write-Host ""
    Write-Host "==> $Message" -ForegroundColor Cyan
}

function Resolve-Cmd([string]$Name) {
    foreach ($candidate in @("$Name.cmd", $Name)) {
        $cmd = Get-Command $candidate -ErrorAction SilentlyContinue
        if ($cmd) { return $cmd.Source }
    }
    throw "Command not found: $Name"
}

function Run([string]$Command, [string[]]$Arguments) {
    & $Command @Arguments
    if ($LASTEXITCODE -ne 0) {
        throw "Failed: $Command $($Arguments -join ' ')"
    }
}

function Write-Utf8([string]$Path, [string]$Content) {
    [System.IO.File]::WriteAllText(
        $Path,
        $Content.TrimEnd("`r", "`n", " ", "`t") + "`n",
        (New-Object System.Text.UTF8Encoding($false))
    )
}

$Git = Resolve-Cmd "git"
$Npm = Resolve-Cmd "npm"
$Npx = Resolve-Cmd "npx"

$TargetRelative = "components/parceiros/PartnerSystemDemo.tsx"
$Target = Join-Path $Root $TargetRelative

if (-not (Test-Path -LiteralPath $Target)) {
    throw "PartnerSystemDemo.tsx not found."
}

Step "Renaming reserved module identifiers"

$content = [System.IO.File]::ReadAllText($Target)

# Replace only the standalone identifier `module`.
# Does not touch `modules`, `PanelModule`, etc.
$content = [regex]::Replace(
    $content,
    '\bmodule\b',
    'panelItem',
    [System.Text.RegularExpressions.RegexOptions]::CultureInvariant
)

Write-Utf8 $Target $content

Step "Verifying reserved identifier is gone"

$final = [System.IO.File]::ReadAllText($Target)

if ([regex]::IsMatch(
    $final,
    '\bmodule\b',
    [System.Text.RegularExpressions.RegexOptions]::CultureInvariant
)) {
    Select-String -Path $Target -Pattern '\bmodule\b' -CaseSensitive
    throw "Standalone module identifier still exists."
}

Write-Host "[OK] no standalone module identifiers" -ForegroundColor Green

Step "ESLint"
Run $Npx @(
    "eslint",
    "app/parceiros/demo/page.tsx",
    "app/parceiros/demo/layout.tsx",
    "components/parceiros/PartnerSystemDemo.tsx"
)

Step "Build"
Run $Npm @("run", "build")

Step "Diff check"
Run $Git @(
    "diff",
    "--check",
    "--",
    "app/parceiros/demo/page.tsx",
    "app/parceiros/demo/layout.tsx",
    "components/parceiros/PartnerSystemDemo.tsx"
)

Write-Host ""
& $Git --no-pager diff --stat -- `
    "app/parceiros/demo/page.tsx" `
    "app/parceiros/demo/layout.tsx" `
    "components/parceiros/PartnerSystemDemo.tsx"

Step "Commit"

Run $Git @(
    "add",
    "--",
    "app/parceiros/demo/page.tsx",
    "app/parceiros/demo/layout.tsx",
    "components/parceiros/PartnerSystemDemo.tsx"
)

Run $Git @(
    "diff",
    "--cached",
    "--check",
    "--",
    "app/parceiros/demo/page.tsx",
    "app/parceiros/demo/layout.tsx",
    "components/parceiros/PartnerSystemDemo.tsx"
)

Write-Host ""
Write-Host "Files in commit:" -ForegroundColor Yellow
& $Git --no-pager diff --cached --name-status -- `
    "app/parceiros/demo/page.tsx" `
    "app/parceiros/demo/layout.tsx" `
    "components/parceiros/PartnerSystemDemo.tsx"

& $Git diff --cached --quiet -- `
    "app/parceiros/demo/page.tsx" `
    "app/parceiros/demo/layout.tsx" `
    "components/parceiros/PartnerSystemDemo.tsx"

if ($LASTEXITCODE -eq 0) {
    throw "No mirrored demo changes to commit."
}

Run $Git @(
    "commit",
    "-m",
    "Espelha painel real no demonstrativo de parceiros",
    "--",
    "app/parceiros/demo/page.tsx",
    "app/parceiros/demo/layout.tsx",
    "components/parceiros/PartnerSystemDemo.tsx"
)

if ($Push) {
    $branch = (& $Git branch --show-current).Trim()

    if (-not $branch) {
        throw "Could not resolve current branch."
    }

    Step "Push"
    Run $Git @(
        "push",
        "-u",
        "origin",
        $branch
    )
}

Write-Host ""
Write-Host "ORCALY_PARTNER_MIRROR_DEMO_V2_OK=1" -ForegroundColor Green
Write-Host "ESLint: OK" -ForegroundColor Cyan
Write-Host "Build: OK" -ForegroundColor Cyan
Write-Host "Mirrored read-only demo: OK" -ForegroundColor Cyan
