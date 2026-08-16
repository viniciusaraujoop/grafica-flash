param()

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$Root = "C:\Users\arauj\grafica-flash"
$SourceBranch = "fix/unify-payment-flows-phase-1"
$FeeCommit = "a10633c"
$Checkout = "lib/payments/checkout-service.ts"
$PlanConfig = "lib/plans/plan-config.ts"
$CleanBranch = "agent/reactivate-marketplace-fees-clean"

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
    return $null
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
$Vercel = Resolve-Cmd "vercel"

if (-not $Git) { throw "git not found." }
if (-not $Npm) { throw "npm not found." }
if (-not $Npx) { throw "npx not found." }

Step "Validating current repository state"

$CurrentBranch = (& $Git branch --show-current).Trim()
if ($CurrentBranch -ne $SourceBranch) {
    throw "Expected branch '$SourceBranch'. Current: '$CurrentBranch'."
}

$TrackedDirty = @(
    & $Git status --porcelain |
    Where-Object {
        $_ -and -not $_.StartsWith("??")
    }
)

if ($TrackedDirty.Count -gt 0) {
    Write-Host "Tracked changes found:" -ForegroundColor Red
    $TrackedDirty | ForEach-Object { Write-Host $_ -ForegroundColor Red }
    throw "Tracked working tree must be clean. Untracked scripts are allowed."
}

Run $Git @("fetch", "origin", $SourceBranch)

Step "Verifying local marketplace fee commit"

& $Git cat-file -e "$FeeCommit^{commit}"
if ($LASTEXITCODE -ne 0) {
    throw "Local fee commit '$FeeCommit' was not found."
}

$FeeFiles = @(
    & $Git diff-tree `
        --no-commit-id `
        --name-only `
        -r `
        $FeeCommit
)

Write-Host "Files changed by $FeeCommit:"
$FeeFiles | ForEach-Object { Write-Host "  $_" }

if (
    $FeeFiles.Count -ne 1 -or
    $FeeFiles[0] -ne $Checkout
) {
    throw "Fee commit is not isolated to $Checkout."
}

$FeeMessage = (& $Git log -1 --pretty=%s $FeeCommit).Trim()
Write-Host "Fee commit message: $FeeMessage"

Step "Creating safety branch for current local history"

$Stamp = Get-Date -Format "yyyyMMdd-HHmmss"
$BackupBranch = "backup/local-before-fee-history-fix-$Stamp"
$OriginalHead = (& $Git rev-parse HEAD).Trim()

Run $Git @(
    "branch",
    $BackupBranch,
    $OriginalHead
)

Write-Host "BACKUP_BRANCH=$BackupBranch" -ForegroundColor Yellow
Write-Host "ORIGINAL_HEAD=$OriginalHead" -ForegroundColor Yellow

Step "Creating clean branch from origin"

Run $Git @(
    "switch",
    "-C",
    $CleanBranch,
    "origin/$SourceBranch"
)

$CleanBase = (& $Git rev-parse HEAD).Trim()
Write-Host "CLEAN_BASE=$CleanBase"

Step "Cherry-picking only the marketplace fee commit"

Run $Git @(
    "cherry-pick",
    $FeeCommit
)

$CleanFeeSha = (& $Git rev-parse HEAD).Trim()
Write-Host "CLEAN_FEE_COMMIT=$CleanFeeSha" -ForegroundColor Green

Step "Validating isolated diff"

$ReleaseFiles = @(
    & $Git diff `
        --name-only `
        "origin/$SourceBranch..HEAD"
)

Write-Host "Files that will be published:"
$ReleaseFiles | ForEach-Object { Write-Host "  $_" }

if (
    $ReleaseFiles.Count -ne 1 -or
    $ReleaseFiles[0] -ne $Checkout
) {
    throw "Clean release contains unexpected files."
}

Run $Git @(
    "diff",
    "--check",
    "origin/$SourceBranch..HEAD"
)

Step "Validating marketplace fee logic"

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
    throw "Mercado Pago application_fee assignment is missing."
}

$RateChecks = @(
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

foreach ($Check in $RateChecks) {
    if ($PlanText -notmatch $Check[1]) {
        throw "Unexpected marketplace fee for $($Check[0])."
    }

    Write-Host "[OK] $($Check[0])" -ForegroundColor Green
}

Write-Host "[OK] application_fee active" -ForegroundColor Green
Write-Host "[OK] commission uses seller plan fee" -ForegroundColor Green

Step "Targeted ESLint"

Run $Npx @(
    "eslint",
    $Checkout,
    $PlanConfig
)

Step "Payment verification"

Run $Npm @("run", "verify:payments")
Run $Npm @("run", "verify:payment-credentials")

Step "Production build validation"

Run $Npm @("run", "build")

Step "Final Git scope check"

$ReleaseFiles = @(
    & $Git diff `
        --name-only `
        "origin/$SourceBranch..HEAD"
)

if (
    $ReleaseFiles.Count -ne 1 -or
    $ReleaseFiles[0] -ne $Checkout
) {
    throw "Release scope changed during validation."
}

Write-Host ""
& $Git --no-pager diff `
    --stat `
    "origin/$SourceBranch..HEAD"

Step "Publishing clean commit to GitHub branch"

Run $Git @(
    "push",
    "origin",
    "HEAD:$SourceBranch"
)

Write-Host "ORCALY_MP_FEE_PUSH_OK=1" -ForegroundColor Green

Step "Aligning local source branch with clean remote history"

Run $Git @(
    "switch",
    $SourceBranch
)

Run $Git @(
    "reset",
    "--hard",
    "origin/$SourceBranch"
)

$FinalHead = (& $Git rev-parse HEAD).Trim()
Write-Host "FINAL_SOURCE_HEAD=$FinalHead" -ForegroundColor Green

Step "Creating Vercel Preview deployment"

$DeployLogDir = Join-Path $Root ".orcaly-fee-release-local"
New-Item -ItemType Directory -Force -Path $DeployLogDir | Out-Null
$DeployLog = Join-Path $DeployLogDir "vercel-preview-$Stamp.txt"

if ($Vercel) {
    $DeployOutput = @(
        & $Vercel deploy --yes 2>&1 |
        Tee-Object -FilePath $DeployLog
    )
}
else {
    $DeployOutput = @(
        & $Npx vercel deploy --yes 2>&1 |
        Tee-Object -FilePath $DeployLog
    )
}

if ($LASTEXITCODE -ne 0) {
    throw "Vercel Preview deploy failed. See: $DeployLog"
}

$PreviewUrl = $null

foreach ($Line in $DeployOutput) {
    $Match = [regex]::Match(
        [string]$Line,
        'https://[A-Za-z0-9.-]+\.vercel\.app'
    )

    if ($Match.Success) {
        $PreviewUrl = $Match.Value
    }
}

Write-Host ""
Write-Host "ORCALY_MP_FEE_COMMIT_AND_DEPLOY_OK=1" -ForegroundColor Green
Write-Host "COMMIT_SHA=$FinalHead" -ForegroundColor Green
Write-Host "BRANCH=$SourceBranch" -ForegroundColor Green
Write-Host "BACKUP_BRANCH=$BackupBranch" -ForegroundColor Yellow
Write-Host "ESSENCIAL_FEE_PERCENT=3.5" -ForegroundColor Green
Write-Host "PROFISSIONAL_FEE_PERCENT=3.0" -ForegroundColor Green
Write-Host "PREMIUM_FEE_PERCENT=2.0" -ForegroundColor Green
Write-Host "APPLICATION_FEE_ACTIVE=1" -ForegroundColor Green

if ($PreviewUrl) {
    Write-Host "VERCEL_PREVIEW_URL=$PreviewUrl" -ForegroundColor Cyan
}
else {
    Write-Host "VERCEL_PREVIEW_DEPLOYED=1" -ForegroundColor Cyan
    Write-Host "Deploy log: $DeployLog" -ForegroundColor Cyan
}

Write-Host ""
Write-Host "Production was intentionally not replaced." -ForegroundColor Yellow
Write-Host "Current production already predates the fee-pause commit and is already distributing the marketplace fee." -ForegroundColor Yellow
