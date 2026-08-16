param(
    [switch]$Push = $true
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$Root = "C:\Users\arauj\grafica-flash"
$HardeningBranch = "agent/hardening-orcaly-2026-08-08"
$TargetBranch = "fix/unify-payment-flows-phase-1"

Set-Location -LiteralPath $Root

function Step([string]$Message) {
    Write-Host ""
    Write-Host "==> $Message" -ForegroundColor Cyan
}

function Resolve-Cmd([string]$Name) {
    foreach ($Candidate in @("$Name.cmd", "$Name.exe", $Name)) {
        $Command = Get-Command $Candidate -ErrorAction SilentlyContinue
        if ($Command) {
            return $Command.Source
        }
    }

    throw "Command not found: $Name"
}

function Run([string]$FilePath, [string[]]$Arguments) {
    & $FilePath @Arguments

    if ($LASTEXITCODE -ne 0) {
        throw "Failed ($LASTEXITCODE): $FilePath $($Arguments -join ' ')"
    }
}

function Write-Utf8NoBom([string]$Path, [string]$Content) {
    [System.IO.File]::WriteAllText(
        $Path,
        $Content.TrimEnd("`r", "`n") + "`n",
        (New-Object System.Text.UTF8Encoding($false))
    )
}

$Git = Resolve-Cmd "git"
$Npm = Resolve-Cmd "npm"
$Npx = Resolve-Cmd "npx"

Step "Preserving unfinished hardening work"

$CurrentBranch = (& $Git branch --show-current).Trim()
Write-Host "Current branch: $CurrentBranch"

if ($CurrentBranch -eq $HardeningBranch) {
    $Dirty = @(& $Git status --porcelain)

    if ($Dirty.Count -gt 0) {
        $Stamp = Get-Date -Format "yyyyMMdd-HHmmss"
        $Message = "WIP hardening paused before restoring Mercado Pago marketplace fees $Stamp"

        Run $Git @(
            "stash",
            "push",
            "-u",
            "-m",
            $Message
        )

        $LatestStash = (& $Git stash list -1).Trim()

        Write-Host ""
        Write-Host "Hardening preserved in Git stash:" -ForegroundColor Yellow
        Write-Host $LatestStash -ForegroundColor Yellow
    }
    else {
        Write-Host "Hardening branch had no tracked/untracked work to stash."
    }
}
elseif ($CurrentBranch -ne $TargetBranch) {
    throw "Unexpected branch: $CurrentBranch"
}

Step "Returning to clean payment branch"

Run $Git @("fetch", "origin", $TargetBranch)

$LocalTarget = (& $Git branch --list $TargetBranch).Trim()

if ($LocalTarget) {
    Run $Git @("switch", $TargetBranch)
}
else {
    Run $Git @(
        "switch",
        "-c",
        $TargetBranch,
        "--track",
        "origin/$TargetBranch"
    )
}

Run $Git @(
    "merge",
    "--ff-only",
    "origin/$TargetBranch"
)

$TrackedDirty = @(
    & $Git status --porcelain |
    Where-Object {
        $_ -and -not $_.StartsWith("??")
    }
)

if ($TrackedDirty.Count -gt 0) {
    Write-Host "Unexpected tracked changes after switching branches:" -ForegroundColor Red
    $TrackedDirty | ForEach-Object { Write-Host $_ -ForegroundColor Red }
    throw "Target branch is not clean."
}

Step "Restoring marketplace platform fees"

$CheckoutRelative = "lib/payments/checkout-service.ts"
$CheckoutPath = Join-Path $Root $CheckoutRelative
$PlanRelative = "lib/plans/plan-config.ts"
$PlanPath = Join-Path $Root $PlanRelative

if (-not (Test-Path -LiteralPath $CheckoutPath)) {
    throw "Missing file: $CheckoutRelative"
}

if (-not (Test-Path -LiteralPath $PlanPath)) {
    throw "Missing file: $PlanRelative"
}

$Checkout = [System.IO.File]::ReadAllText($CheckoutPath)

$OldPattern = '(?ms)' +
    '  // A taxa da plataforma[^\r\n]*\r?\n' +
    '  // Mantemos o percentual[^\r\n]*\r?\n' +
    '  // permitir reativa[^\r\n]*\r?\n' +
    '  const configuredFeePercent =\s*\r?\n' +
    '    plan\.marketplaceFeePercent;\s*\r?\n' +
    '  const platformFeeEnabled = false;\s*\r?\n' +
    '  const feePercent =\s*\r?\n' +
    '    platformFeeEnabled\s*\r?\n' +
    '      \? configuredFeePercent\s*\r?\n' +
    '      : 0;'

$Matches = [regex]::Matches($Checkout, $OldPattern)

if ($Matches.Count -eq 1) {
    $Replacement = @'
  // Marketplace fee is active and follows the seller plan.
  const feePercent =
    plan.marketplaceFeePercent;
'@

    $Checkout = [regex]::Replace(
        $Checkout,
        $OldPattern,
        $Replacement,
        1
    )

    Write-Utf8NoBom $CheckoutPath $Checkout
    Write-Host "[OK] marketplace fee switch removed; configured plan fee is active" -ForegroundColor Green
}
elseif (
    $Checkout.Contains(
        "const feePercent =" + "`n" +
        "    plan.marketplaceFeePercent;"
    ) -or
    $Checkout.Contains(
        "const feePercent =" + "`r`n" +
        "    plan.marketplaceFeePercent;"
    )
) {
    Write-Host "[OK] marketplace fee was already active" -ForegroundColor Green
}
else {
    throw "Could not identify the paused marketplace fee block safely."
}

Step "Validating configured rates and Mercado Pago application_fee"

$Plan = [System.IO.File]::ReadAllText($PlanPath)
$Checkout = [System.IO.File]::ReadAllText($CheckoutPath)

$RateChecks = @(
    @("Essencial", 'essencial:\s*\{[^}]*marketplaceFeePercent:\s*3\.5\b'),
    @("Profissional", 'profissional:\s*\{[^}]*marketplaceFeePercent:\s*3\b'),
    @("Premium", 'premium:\s*\{[^}]*marketplaceFeePercent:\s*2\b')
)

foreach ($Check in $RateChecks) {
    $Label = $Check[0]
    $Pattern = $Check[1]

    if ($Plan -notmatch $Pattern) {
        throw "Unexpected marketplace fee for plan: $Label"
    }

    Write-Host "[OK] $Label fee configuration" -ForegroundColor Green
}

if ($Checkout -match 'platformFeeEnabled\s*=\s*false') {
    throw "Marketplace fee is still disabled."
}

if ($Checkout -notmatch 'const feePercent\s*=\s*plan\.marketplaceFeePercent;') {
    throw "Checkout is not using the plan marketplace fee."
}

if ($Checkout -notmatch 'paymentPayload\.application_fee\s*=\s*calculation\.commissionAmount;') {
    throw "Mercado Pago application_fee assignment is missing."
}

if ($Checkout -notmatch 'calculation\.total\s*\*\s*\(feePercent\s*/\s*100\)') {
    throw "Commission calculation does not use the marketplace fee percentage."
}

Write-Host ""
Write-Host "Marketplace fees restored:" -ForegroundColor Cyan
Write-Host "  Essencial:     3.5%" -ForegroundColor Cyan
Write-Host "  Profissional:  3.0%" -ForegroundColor Cyan
Write-Host "  Premium:       2.0%" -ForegroundColor Cyan
Write-Host "  Provider:      Mercado Pago application_fee" -ForegroundColor Cyan

Step "Targeted ESLint"

Run $Npx @(
    "eslint",
    $CheckoutRelative,
    $PlanRelative
)

Step "Payment boundary verification"

Run $Npm @("run", "verify:payments")
Run $Npm @("run", "verify:payment-credentials")

Step "Production build"

Run $Npm @("run", "build")

Step "Diff validation"

Run $Git @(
    "diff",
    "--check",
    "--",
    $CheckoutRelative
)

$ChangedFiles = @(& $Git diff --name-only)

$Unexpected = @(
    $ChangedFiles |
    Where-Object {
        $_ -and $_ -ne $CheckoutRelative
    }
)

if ($Unexpected.Count -gt 0) {
    Write-Host "Unexpected changed files:" -ForegroundColor Red
    $Unexpected | ForEach-Object {
        Write-Host " - $_" -ForegroundColor Red
    }

    throw "Refusing to commit unrelated changes."
}

Write-Host ""
& $Git --no-pager diff -- $CheckoutRelative

Step "Commit"

Run $Git @(
    "add",
    "--",
    $CheckoutRelative
)

Run $Git @(
    "diff",
    "--cached",
    "--check",
    "--",
    $CheckoutRelative
)

& $Git diff --cached --quiet -- $CheckoutRelative

if ($LASTEXITCODE -eq 0) {
    throw "No marketplace fee change to commit."
}

Run $Git @(
    "commit",
    "-m",
    "Reativa taxas do marketplace Mercado Pago",
    "--",
    $CheckoutRelative
)

if ($Push) {
    Step "Push"
    Run $Git @(
        "push",
        "-u",
        "origin",
        $TargetBranch
    )
}

Write-Host ""
Write-Host "ORCALY_MP_MARKETPLACE_FEES_RESTORED=1" -ForegroundColor Green
Write-Host "ESSENCIAL_FEE_PERCENT=3.5" -ForegroundColor Green
Write-Host "PROFISSIONAL_FEE_PERCENT=3.0" -ForegroundColor Green
Write-Host "PREMIUM_FEE_PERCENT=2.0" -ForegroundColor Green
Write-Host "APPLICATION_FEE_ACTIVE=1" -ForegroundColor Green
Write-Host "HARDENING_WIP_PRESERVED=1" -ForegroundColor Green
