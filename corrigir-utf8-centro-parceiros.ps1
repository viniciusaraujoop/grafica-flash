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

function Repair-Line([string]$Line) {
    if (
        $Line.Contains([char]0x00C3) -or
        $Line.Contains([char]0x00C2) -or
        $Line.Contains([char]0x00E2)
    ) {
        try {
            $bytes = [System.Text.Encoding]::GetEncoding(1252).GetBytes($Line)
            $fixed = [System.Text.Encoding]::UTF8.GetString($bytes)

            if (-not $fixed.Contains([char]0xFFFD)) {
                return $fixed
            }
        }
        catch {
        }
    }

    return $Line
}

function Repair-File([string]$Path) {
    if (-not (Test-Path -LiteralPath $Path)) {
        throw "File not found: $Path"
    }

    $text = [System.IO.File]::ReadAllText($Path)
    $normalized = $text -replace "`r`n", "`n"
    $lines = $normalized -split "`n", -1

    $repaired = foreach ($line in $lines) {
        Repair-Line $line
    }

    $output = ($repaired -join "`n").TrimEnd("`r", "`n", " ", "`t") + "`n"

    [System.IO.File]::WriteAllText(
        $Path,
        $output,
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

Step "Repairing UTF-8 mojibake"

foreach ($relative in $Targets) {
    $full = Join-Path $Root $relative
    Repair-File $full
    Write-Host "[OK] $relative" -ForegroundColor Green
}

Step "Checking for corrupted markers"

$bad = @()

foreach ($relative in $Targets) {
    $matches = Select-String `
        -Path (Join-Path $Root $relative) `
        -Pattern "Ã|Â|â" `
        -SimpleMatch:$false `
        -ErrorAction SilentlyContinue

    if ($matches) {
        $bad += $matches
    }
}

if ($bad.Count -gt 0) {
    $bad | ForEach-Object {
        Write-Host "$($_.Path):$($_.LineNumber): $($_.Line)" -ForegroundColor Yellow
    }
    throw "Mojibake markers still found."
}

Step "ESLint"
Run $Npx (@("eslint") + $Targets)

Step "Build"
Run $Npm @("run", "build")

Step "Diff check"
Run $Git (@("diff", "--check", "--") + $Targets)

& $Git --no-pager diff --stat -- $Targets

Step "Commit"

Run $Git (@("add", "--") + $Targets)
Run $Git (@("diff", "--cached", "--check", "--") + $Targets)

& $Git diff --cached --quiet -- $Targets
if ($LASTEXITCODE -eq 0) {
    throw "No changes to commit."
}

Run $Git @(
    "commit",
    "-m",
    "Corrige UTF-8 no centro de parceiros",
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
Write-Host "ORCALY_PARTNER_UTF8_OK=1" -ForegroundColor Green
