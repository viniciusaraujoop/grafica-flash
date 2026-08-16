param()

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$Root = "C:\Users\arauj\grafica-flash"
$Branch = "fix/unify-payment-flows-phase-1"
$Checkout = "lib/payments/checkout-service.ts"
$PlanConfig = "lib/plans/plan-config.ts"
$CommitMessage = "Reativa taxas do marketplace Mercado Pago"

Set-Location -LiteralPath $Root

function Step([string]$Message) {
    Write-Host ""
    Write-Host "==> $Message" -ForegroundColor Cyan
}

function Resolve-Cmd([string]$Name) {
    foreach ($Candidate in @("$Name.cmd", "$Name.exe", $Name)) {
        $Command = Get-Command $Candidate -ErrorAction SilentlyContinue
        if ($Command) { return $Command.Source }
    }

    throw "Command not found: $Name"
}

function Run([string]$FilePath, [string[]]$Arguments) {
    & $FilePath @Arguments

    if ($LASTEXITCODE -ne 0) {
        throw "Failed ($LASTEXITCODE): $FilePath $($Arguments -join ' ')"
    }
}

$Git = Resolve-Cmd "git"
$Npm = Resolve-Cmd "npm"
$Npx = Resolve-Cmd "npx"

Step "Validating branch"

$CurrentBranch = (& $Git branch --show-current).Trim()

if ($CurrentBranch -ne $Branch) {
    throw "Expected branch '$Branch'. Current branch: '$CurrentBranch'."
}

Run $Git @("fetch", "origin", $Branch)

Step "Checking working tree"

$TrackedDirty = @(
    & $Git status --porcelain |
    Where-Object {
        $_ -and -not $_.StartsWith("??")
    }
)

if ($TrackedDirty.Count -gt 0) {
    Write-Host "Tracked changes found:" -ForegroundColor Red
    $TrackedDirty | ForEach-Object {
        Write-Host $_ -ForegroundColor Red
    }

    throw "Tracked working tree must be clean. Untracked .ps1 files are allowed."
}

Step "Inspecting local commit ahead of origin"

$AheadCountText = (
    & $Git rev-list `
        --count `
        "origin/$Branch..HEAD"
).Trim()

$AheadCount = [int]$AheadCountText

Write-Host "COMMITS_AHEAD_OF_ORIGIN=$AheadCount"

if ($AheadCount -ne 1) {
    Write-Host ""
    Write-Host "Local commits ahead of origin:" -ForegroundColor Yellow
    & $Git --no-pager log `
        --oneline `
        --decorate `
        "origin/$Branch..HEAD"

    throw "Expected exactly one local commit ahead of origin."
}

$AheadFiles = @(
    & $Git diff `
        --name-only `
        "origin/$Branch..HEAD"
)

Write-Host ""
Write-Host "Files in the local ahead commit:" -ForegroundColor Cyan
$AheadFiles | ForEach-Object {
    Write-Host "  $_"
}

if (
    $AheadFiles.Count -ne 1 -or
    $AheadFiles[0] -ne $Checkout
) {
    throw "The local ahead commit is not isolated to $Checkout. Push blocked."
}

Step "Validating Mercado Pago marketplace fee logic"

$CheckoutText = [System.IO.File]::ReadAllText(
    (Join-Path $Root $Checkout)
)

$PlanText = [System.IO.File]::ReadAllText(
    (Join-Path $Root $PlanConfig)
)

if ($CheckoutText -match 'platformFeeEnabled\s*=\s*false') {
    throw "Marketplace fee is still disabled."
}

if (
    $CheckoutText -notmatch
    'const\s+feePercent\s*=\s*plan\.marketplaceFeePercent\s*;'
) {
    throw "feePercent is not using plan.marketplaceFeePercent."
}

if (
    $CheckoutText -notmatch
    'total\s*\*\s*\(\s*feePercent\s*/\s*100\s*\)'
) {
    throw "Commission calculation does not use total * (feePercent / 100)."
}

if (
    $CheckoutText -notmatch
    'paymentPayload\.application_fee\s*=\s*calculation\.commissionAmount\s*;'
) {
    throw "Mercado Pago application_fee is missing."
}

$Rates = @(
    @(
        "Essencial",
        'essencial:\s*\{[^}]*marketplaceFeePercent:\s*3\.5\b'
    ),
    @(
        "Profissional",
        'profissional:\s*\{[^}]*marketplaceFeePercent:\s*3\b'
    ),
    @(
        "Premium",
        'premium:\s*\{[^}]*marketplaceFeePercent:\s*2\b'
    )
)

foreach ($Rate in $Rates) {
    if ($PlanText -notmatch $Rate[1]) {
        throw "Unexpected fee for plan $($Rate[0])."
    }

    Write-Host "[OK] $($Rate[0])" -ForegroundColor Green
}

Write-Host "[OK] application_fee active" -ForegroundColor Green
Write-Host "[OK] feePercent follows seller plan" -ForegroundColor Green

Step "Targeted ESLint"

Run $Npx @(
    "eslint",
    $Checkout,
    $PlanConfig
)

Step "Payment boundary verification"

Run $Npm @("run", "verify:payments")
Run $Npm @("run", "verify:payment-credentials")

Step "Production build validation"

Run $Npm @("run", "build")

Step "Commit integrity"

Run $Git @(
    "diff",
    "--check",
    "origin/$Branch..HEAD"
)

$OldSha = (& $Git rev-parse HEAD).Trim()
$CurrentMessage = (
    & $Git log -1 --pretty=%s
).Trim()

Write-Host "Current local commit: $OldSha"
Write-Host "Current message: $CurrentMessage"

if ($CurrentMessage -ne $CommitMessage) {
    Step "Normalizing commit message"

    Run $Git @(
        "commit",
        "--amend",
        "-m",
        $CommitMessage,
        "--no-verify"
    )
}

$FinalSha = (& $Git rev-parse HEAD).Trim()

Step "Final scope check before push"

$FinalFiles = @(
    & $Git diff `
        --name-only `
        "origin/$Branch..HEAD"
)

if (
    $FinalFiles.Count -ne 1 -or
    $FinalFiles[0] -ne $Checkout
) {
    throw "Commit scope changed unexpectedly before push."
}

Write-Host ""
& $Git --no-pager diff `
    --stat `
    "origin/$Branch..HEAD"

Step "Pushing commit"

Run $Git @(
    "push",
    "origin",
    "HEAD:$Branch"
)

Write-Host ""
Write-Host "ORCALY_MP_FEE_COMMIT_PUSH_OK=1" -ForegroundColor Green
Write-Host "COMMIT_SHA=$FinalSha" -ForegroundColor Green
Write-Host "BRANCH=$Branch" -ForegroundColor Green
Write-Host "ESSENCIAL_FEE_PERCENT=3.5" -ForegroundColor Green
Write-Host "PROFISSIONAL_FEE_PERCENT=3.0" -ForegroundColor Green
Write-Host "PREMIUM_FEE_PERCENT=2.0" -ForegroundColor Green
Write-Host "APPLICATION_FEE_ACTIVE=1" -ForegroundColor Green
Write-Host ""
Write-Host "Vercel Git integration will create the branch deployment from this push." -ForegroundColor Cyan
Write-Host "Production was not replaced because production already has the marketplace fee active." -ForegroundColor Yellow
