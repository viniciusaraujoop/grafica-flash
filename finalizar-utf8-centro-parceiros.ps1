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

$Targets = @(
    "app/parceiros/painel/page.tsx",
    "app/parceiros/demo/page.tsx",
    "components/parceiros/PartnerCoursesTab.tsx",
    "components/parceiros/PartnerPromotionTab.tsx",
    "components/parceiros/PartnerSystemDemo.tsx"
)

Step "Fixing joined words"

$replacements = @{
    "estáprotegido" = "está protegido"
    "empresaou" = "empresa ou"
    "promessainventada" = "promessa inventada"
    "concorrentepior" = "concorrente pior"
    "financeiraou" = "financeira ou"
    "rápida:hoje" = "rápida: hoje"
    "organizaraquele" = "organizar aquele"
    "valorese" = "valores e"
}

foreach ($relative in $Targets) {
    $full = Join-Path $Root $relative

    if (-not (Test-Path -LiteralPath $full)) {
        throw "File not found: $relative"
    }

    $content = [System.IO.File]::ReadAllText($full)

    foreach ($key in $replacements.Keys) {
        $content = $content.Replace($key, $replacements[$key])
    }

    Write-Utf8 $full $content
    Write-Host "[OK] $relative" -ForegroundColor Green
}

Step "Checking real mojibake markers"

# Build suspicious strings by Unicode code points so the checker itself
# cannot be damaged by Windows PowerShell source encoding.
$markers = @(
    ([string][char]0x00C3 + [char]0x00A7), # Ã§
    ([string][char]0x00C3 + [char]0x00A3), # Ã£
    ([string][char]0x00C3 + [char]0x00A9), # Ã©
    ([string][char]0x00C3 + [char]0x00AA), # Ãª
    ([string][char]0x00C3 + [char]0x00AD), # Ã­
    ([string][char]0x00C3 + [char]0x00B3), # Ã³
    ([string][char]0x00C3 + [char]0x00BA), # Ãº
    ([string][char]0x00C2 + [char]0x00B7), # Â·
    ([string][char]0x00E2 + [char]0x0153 + [char]0x201C), # âœ“
    ([string][char]0x00E2 + [char]0x2020 + [char]0x2019)  # â†’
)

$badFound = $false

foreach ($relative in $Targets) {
    $full = Join-Path $Root $relative
    $text = [System.IO.File]::ReadAllText($full)

    foreach ($marker in $markers) {
        if ($text.Contains($marker)) {
            Write-Host "[BAD] $relative contains suspicious sequence: $marker" -ForegroundColor Red
            $badFound = $true
        }
    }
}

if ($badFound) {
    throw "Real mojibake markers still found."
}

Write-Host "[OK] No real mojibake markers found" -ForegroundColor Green

Step "ESLint"
Run $Npx (@("eslint") + $Targets)

Step "Build"
Run $Npm @("run", "build")

Step "Diff check"
Run $Git (@("diff", "--check", "--") + $Targets)

Write-Host ""
& $Git --no-pager diff --stat -- $Targets

Step "Commit"

Run $Git (@("add", "--") + $Targets)
Run $Git (@("diff", "--cached", "--check", "--") + $Targets)

Write-Host ""
Write-Host "Files in commit:" -ForegroundColor Yellow
& $Git --no-pager diff --cached --name-status -- $Targets

& $Git diff --cached --quiet -- $Targets
if ($LASTEXITCODE -eq 0) {
    throw "No changes to commit."
}

Run $Git @(
    "commit",
    "-m",
    "Corrige UTF-8 e finaliza centro de parceiros",
    "--",
    "app/parceiros/painel/page.tsx",
    "app/parceiros/demo/page.tsx",
    "components/parceiros/PartnerCoursesTab.tsx",
    "components/parceiros/PartnerPromotionTab.tsx",
    "components/parceiros/PartnerSystemDemo.tsx"
)

if ($Push) {
    $branch = (& $Git branch --show-current).Trim()

    Step "Push"
    Run $Git @(
        "push",
        "-u",
        "origin",
        $branch
    )
}

Write-Host ""
Write-Host "ORCALY_PARTNER_UTF8_FINAL_OK=1" -ForegroundColor Green
