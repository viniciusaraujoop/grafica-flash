param()

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$Root = "C:\Users\arauj\grafica-flash"
$SourceBranch = "fix/unify-payment-flows-phase-1"
$ReleaseBranch = "agent/reactivate-marketplace-fees-20260808"
$Checkout = "lib/payments/checkout-service.ts"
$PlanConfig = "lib/plans/plan-config.ts"

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

$WorkDir = Join-Path $Root ".orcaly-fee-release-local"
New-Item -ItemType Directory -Force -Path $WorkDir | Out-Null

$PatchPath = Join-Path $WorkDir "marketplace-fee.patch"
$DeployLog = Join-Path $WorkDir "vercel-preview-deploy.txt"

Step "Checking current fee change"

$CurrentBranch = (& $Git branch --show-current).Trim()

if ($CurrentBranch -ne $SourceBranch) {
    throw "Expected branch '$SourceBranch'. Current branch: '$CurrentBranch'."
}

$TrackedChanges = @(& $Git diff --name-only)

$Unexpected = @(
    $TrackedChanges |
    Where-Object {
        $_ -and $_ -ne $Checkout
    }
)

if ($Unexpected.Count -gt 0) {
    Write-Host "Unexpected tracked changes:" -ForegroundColor Red
    $Unexpected | ForEach-Object {
        Write-Host " - $_" -ForegroundColor Red
    }

    throw "Refusing to mix unrelated changes."
}

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

Step "Capturing only the fee patch"

& $Git diff --binary -- $Checkout |
    Set-Content -LiteralPath $PatchPath -Encoding Ascii

if (
    -not (Test-Path -LiteralPath $PatchPath) -or
    (Get-Item -LiteralPath $PatchPath).Length -eq 0
) {
    throw "No marketplace fee diff found."
}

Write-Host "Patch: $PatchPath"

Step "Returning source branch working tree to clean state"

Run $Git @(
    "restore",
    "--staged",
    "--worktree",
    "--",
    $Checkout
)

$DirtyTracked = @(
    & $Git status --porcelain |
    Where-Object {
        $_ -and -not $_.StartsWith("??")
    }
)

if ($DirtyTracked.Count -gt 0) {
    $DirtyTracked | ForEach-Object {
        Write-Host $_ -ForegroundColor Red
    }

    throw "Tracked working tree is not clean after preserving the fee patch."
}

Step "Creating isolated release branch from remote"

Run $Git @(
    "fetch",
    "origin",
    $SourceBranch
)

Run $Git @(
    "switch",
    "-C",
    $ReleaseBranch,
    "origin/$SourceBranch"
)

Step "Applying only marketplace fee reactivation"

Run $Git @(
    "apply",
    "--whitespace=nowarn",
    $PatchPath
)

$Changed = @(& $Git diff --name-only)

if (
    $Changed.Count -ne 1 -or
    $Changed[0] -ne $Checkout
) {
    Write-Host "Unexpected release diff:" -ForegroundColor Red
    $Changed | ForEach-Object {
        Write-Host " - $_" -ForegroundColor Red
    }

    throw "Release branch contains more than the fee change."
}

Step "Validating release code"

$CheckoutText = [System.IO.File]::ReadAllText(
    (Join-Path $Root $Checkout)
)

if ($CheckoutText -match 'platformFeeEnabled\s*=\s*false') {
    throw "Fee remained disabled after patch."
}

if (
    $CheckoutText -notmatch
    'const\s+feePercent\s*=\s*plan\.marketplaceFeePercent\s*;'
) {
    throw "Fee percentage is not driven by the plan."
}

if (
    $CheckoutText -notmatch
    'paymentPayload\.application_fee\s*=\s*calculation\.commissionAmount\s*;'
) {
    throw "application_fee disappeared after patch."
}

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

Step "Diff validation"

Run $Git @(
    "diff",
    "--check",
    "--",
    $Checkout
)

Step "Creating commit"

Run $Git @(
    "add",
    "--",
    $Checkout
)

Run $Git @(
    "diff",
    "--cached",
    "--check",
    "--",
    $Checkout
)

Run $Git @(
    "commit",
    "-m",
    "Reativa taxas do marketplace Mercado Pago",
    "--",
    $Checkout
)

$CommitSha = (& $Git rev-parse HEAD).Trim()

Write-Host "COMMIT_SHA=$CommitSha" -ForegroundColor Green

Step "Pushing isolated release branch"

Run $Git @(
    "push",
    "-u",
    "origin",
    $ReleaseBranch
)

Write-Host "ORCALY_MP_FEE_PUSH_OK=1" -ForegroundColor Green

Step "Creating Vercel preview deployment"

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
    throw "Vercel preview deployment failed. See: $DeployLog"
}

$PreviewUrl = (
    $DeployOutput |
    ForEach-Object { [string]$_ } |
    Where-Object {
        $_ -match 'https://[A-Za-z0-9.-]+\.vercel\.app'
    } |
    Select-Object -Last 1
)

if ($PreviewUrl) {
    $Match = [regex]::Match(
        $PreviewUrl,
        'https://[A-Za-z0-9.-]+\.vercel\.app'
    )

    if ($Match.Success) {
        $PreviewUrl = $Match.Value
    }
}

Write-Host ""
Write-Host "ORCALY_MP_MARKETPLACE_FEES_COMMIT_DEPLOY_OK=1" -ForegroundColor Green
Write-Host "RELEASE_BRANCH=$ReleaseBranch" -ForegroundColor Green
Write-Host "COMMIT_SHA=$CommitSha" -ForegroundColor Green
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
Write-Host "Current production already predates the fee-pause commit and is distributing the marketplace fee." -ForegroundColor Yellow
